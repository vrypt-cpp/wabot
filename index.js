import 'dotenv/config';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  Browsers,
  makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import { useMysqlAuthState } from './utils/mysqlAuthState.js'
import pino from 'pino';
import { createHttpServer, setBotState, getBotState, incrementMessages } from './server.js';
import { handleMessage } from './handler.js';
import { createLogger } from './utils/logger.js';
import { CommandRegistry } from './loader.js';
import { pool } from './utils/mysqlPool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const log = createLogger('WA');
const logProcess = createLogger('PROCESS');

const PHONE_NUMBER = process.env.PHONE_NUMBER || '62xxxxx';

const RECONNECT_CONFIG = {
  maxRetries: 10,
  baseDelay: 3000,
  maxDelay: 60000,
  backoffMultiplier: 2,
};

let version = [];
let registry;

createHttpServer(() => version);
setBotState({ pool, isReconnecting: false, retryCount: 0 });

async function initRegistry(sock) {
  if (registry) {
    registry.destroy();
    registry = null;
  }
  registry = new CommandRegistry();
  const dir = resolve(__dirname, 'commands');
  await registry.loadDir(dir);
  registry.watch(dir, {
    sock,
    from: PHONE_NUMBER + '@s.whatsapp.net',
  }).catch(err => log.error('watch error', { detail: err.message }));
}

function getReconnectDelay() {
  const { retryCount } = getBotState();
  const delay = Math.min(
    RECONNECT_CONFIG.baseDelay * Math.pow(RECONNECT_CONFIG.backoffMultiplier, retryCount),
    RECONNECT_CONFIG.maxDelay
  );
  const jitter = delay * 0.2 * (Math.random() * 2 - 1);
  return Math.floor(delay + jitter);
}

async function scheduleReconnect(reason = 'unknown') {
  if (getBotState().isReconnecting) {
    log.warn('Reconnect sudah dijadwalkan, skip.');
    return;
  }

  const { retryCount } = getBotState();

  if (retryCount >= RECONNECT_CONFIG.maxRetries) {
    log.fatal(`Gagal reconnect setelah ${RECONNECT_CONFIG.maxRetries} percobaan. Berhenti.`);
    process.exit(1);
  }

  const nextRetry = retryCount + 1;
  setBotState({ isReconnecting: true, retryCount: nextRetry });

  const delay = getReconnectDelay();
  log.warn(`Disconnect (${reason}). Reconnect ke-${nextRetry}/${RECONNECT_CONFIG.maxRetries} dalam ${delay}ms...`);

  await new Promise(resolve => setTimeout(resolve, delay));
  setBotState({ isReconnecting: false });

  try {
    await start();
  } catch (err) {
    log.error('Error saat reconnect:', { detail: err.message });
    await scheduleReconnect('reconnect_error');
  }
}

async function start() {
  const { state, saveCreds, removeSession } = await useMysqlAuthState(pool, 'session-1');
  const { version: v, isLatest } = await fetchLatestBaileysVersion();
  version = v;

  log.info(`Menggunakan WA v${version.join('.')}`, { isLatest });

  const sock = makeWASocket({
    browser: Browsers.macOS('Edge'),
    logger: pino({ level: 'silent' }),
    auth: state,
    version,
    syncFullHistory: false,
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
  });

  await initRegistry(sock);

  if (!sock.authState.creds.registered) {
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const PAIRING_CODE = await sock.requestPairingCode(PHONE_NUMBER, 'VRYPTBOT');
      log.info(`PAIRING CODE: ${PAIRING_CODE}`);
    } catch (err) {
      log.error('Error meminta pairing code', { detail: err.message });
    }
  }

  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    const code = lastDisconnect?.error?.output?.statusCode;
    const errorMessage = lastDisconnect?.error?.message || 'tidak diketahui';

    if (connection === 'connecting') {
      setBotState({ connection: 'connecting' });
      log.info('Sedang menghubungkan...');
    }

    if (connection === 'open') {
      setBotState({ connection: 'open', retryCount: 0, isReconnecting: false, lastConnectedAt: new Date().toISOString() });
      log.info('Terhubung!');
      try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await sock.sendMessage(PHONE_NUMBER + '@s.whatsapp.net', {
          text: '✅ Bot berhasil terhubung!'
        });
      } catch (err) {
        log.error('Gagal mengirim notifikasi koneksi', { detail: err.message });
      }
    }

    if (connection === 'close') {
      if (getBotState().isRestarting) return;
      
      setBotState({
        connection: 'close',
        retryCount: getBotState().retryCount,
        isReconnecting: false,
        lastDisconnectReason: `${code}`,
      });
      log.warn('Koneksi terputus', { code, pesan: errorMessage });

      switch (code) {
        case DisconnectReason.loggedOut:
          log.fatal('Sesi logout. Hapus sesi dan daftarkan ulang.');
          await removeSession();
          process.exit(1);
          break;
        case DisconnectReason.badSession:
          log.fatal('Sesi rusak (badSession). Perlu daftar ulang.');
          await removeSession();
          process.exit(1);
          break;
        case DisconnectReason.multideviceMismatch:
          log.fatal('Multidevice mismatch. Perlu daftar ulang.');
          await removeSession();
          process.exit(1);
          break;
        case DisconnectReason.connectionClosed:
          await scheduleReconnect('connectionClosed');
          break;
        case DisconnectReason.connectionLost:
          await scheduleReconnect('connectionLost');
          break;
        case DisconnectReason.connectionReplaced:
          log.fatal('Koneksi digantikan perangkat lain. Bot dihentikan.');
          process.exit(1);
          break;
        case DisconnectReason.timedOut:
          await scheduleReconnect('timedOut');
          break;
        case DisconnectReason.restartRequired:
          await scheduleReconnect('restartRequired');
          break;
        case 428:
          await scheduleReconnect('unexpectedClose_428');
          break;
        default:
          log.warn('Disconnect tidak dikenal', { code });
          await scheduleReconnect(`unknown_${code}`);
          break;
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    if (!registry) {
      log.warn('Pesan masuk sebelum registry siap, diabaikan.');
      return;
    }
    for (const msg of messages) {
      try {
        await handleMessage(sock, msg, version, pool, registry);
        incrementMessages(true);
      } catch (err) {
        log.error('Gagal memproses pesan', { detail: err.message });
        incrementMessages(false);
      }
    }
  });
}

process.on('uncaughtException', (err) => {
  logProcess.fatal('uncaughtException', { detail: err.message });
});

process.on('unhandledRejection', (reason) => {
  logProcess.error('unhandledRejection', { reason: String(reason) });
});

start();
