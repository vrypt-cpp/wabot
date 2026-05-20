import 'dotenv/config';
import {
  Browsers,
  makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import pkg from 'pg';
import { usePgAuthState } from './utils/pgAuthState.js';
import pino from 'pino';
import { createHttpServer } from './server.js';
import { handleMessage } from './handler.js';

const { Pool } = pkg;

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || 5432,
  database: process.env.PG_DATABASE || 'database_name',
  user: process.env.PG_USER || 'postgres_user',
  password: process.env.PG_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

const PHONE_NUMBER = process.env.PHONE_NUMBER || '62xxxxx';

const RECONNECT_CONFIG = {
  maxRetries: 10,
  baseDelay: 3000,
  maxDelay: 60000,
  backoffMultiplier: 2,
};

let version = [];
let retryCount = 0;
let isReconnecting = false;

createHttpServer(() => version);

function getReconnectDelay() {
  const delay = Math.min(
    RECONNECT_CONFIG.baseDelay * Math.pow(RECONNECT_CONFIG.backoffMultiplier, retryCount),
    RECONNECT_CONFIG.maxDelay
  );
  
  const jitter = delay * 0.2 * (Math.random() * 2 - 1);
  return Math.floor(delay + jitter);
}

async function scheduleReconnect(reason = 'unknown') {
  if (isReconnecting) {
    console.log('[WA] Reconnect sudah dijadwalkan, skip.');
    return;
  }

  if (retryCount >= RECONNECT_CONFIG.maxRetries) {
    console.error(`[WA] Gagal reconnect setelah ${RECONNECT_CONFIG.maxRetries} percobaan. Berhenti.`);
    process.exit(1);
  }

  isReconnecting = true;
  retryCount++;

  const delay = getReconnectDelay();
  console.log(`[WA] Disconnect (${reason}). Reconnect ke-${retryCount}/${RECONNECT_CONFIG.maxRetries} dalam ${delay}ms...`);

  await new Promise(resolve => setTimeout(resolve, delay));
  isReconnecting = false;

  try {
    await start();
  } catch (err) {
    console.error('[WA] Error saat reconnect:', err);
    await scheduleReconnect('reconnect_error');
  }
}

async function start() {
  const { state, saveCreds } = await usePgAuthState(pool, 'session-1');
  const { version: v, isLatest } = await fetchLatestBaileysVersion();
  version = v;

  console.log(`[WA] Menggunakan WA v${version.join('.')}, isLatest: ${isLatest}`);

  const sock = makeWASocket({
    browser: Browsers.macOS('Edge'),
    logger: pino({ level: 'error' }),
    auth: state,
    version,
    syncFullHistory: false,
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
  });

  if (!sock.authState.creds.registered) {
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const PAIRING_CODE = await sock.requestPairingCode(PHONE_NUMBER);
      console.log('[WA] PAIRING CODE:', PAIRING_CODE);
    } catch (err) {
      console.error('[WA] Error meminta pairing code:', err);
    }
  }

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    const code = lastDisconnect?.error?.output?.statusCode;
    const errorMessage = lastDisconnect?.error?.message || 'tidak diketahui';

    if (connection === 'connecting') {
      console.log('[WA] Sedang menghubungkan...');
    }

    if (connection === 'open') {
      retryCount = 0;
      console.log('[WA] Terhubung!');
      try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await sock.sendMessage(PHONE_NUMBER + '@s.whatsapp.net', {
          text: '✅ Bot berhasil terhubung!'
        });
      } catch (err) {
        console.error('[WA] Gagal mengirim notifikasi koneksi:', err);
      }
    }

    if (connection === 'close') {
      console.warn(`[WA] Koneksi terputus. Kode: ${code}, Pesan: ${errorMessage}`);

      switch (code) {
        case DisconnectReason.loggedOut:
          console.error('[WA] Sesi logout. Hapus sesi dan daftarkan ulang.');
          // Opsional: hapus sesi dari DB di sini
          process.exit(1);
          break;

        case DisconnectReason.badSession:
          console.error('[WA] Sesi rusak (badSession). Perlu daftar ulang.');
          process.exit(1);
          break;

        case DisconnectReason.multideviceMismatch:
          console.error('[WA] Multidevice mismatch. Perlu daftar ulang.');
          process.exit(1);
          break;

        case DisconnectReason.connectionClosed:
          console.warn('[WA] Koneksi ditutup, mencoba reconnect...');
          await scheduleReconnect('connectionClosed');
          break;

        case DisconnectReason.connectionLost:
          console.warn('[WA] Koneksi hilang (jaringan?), mencoba reconnect...');
          await scheduleReconnect('connectionLost');
          break;

        case DisconnectReason.connectionReplaced:
          console.error('[WA] Koneksi digantikan perangkat lain. Bot dihentikan.');
          process.exit(1);
          break;

        case DisconnectReason.timedOut:
          console.warn('[WA] Koneksi timeout, mencoba reconnect...');
          await scheduleReconnect('timedOut');
          break;

        case DisconnectReason.restartRequired:
          console.warn('[WA] Restart diperlukan oleh server WA.');
          await scheduleReconnect('restartRequired');
          break;

        case 428:
          console.warn('[WA] Koneksi tiba-tiba terputus (428), mencoba reconnect...');
          await scheduleReconnect('unexpectedClose_428');
          break;

        default:
          console.warn(`[WA] Disconnect tidak dikenal (code: ${code}), mencoba reconnect...`);
          await scheduleReconnect(`unknown_${code}`);
          break;
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      await handleMessage(sock, msg, version, pool);
    }
  });
}

process.on('uncaughtException', (err) => {
  console.error('[PROCESS] uncaughtException:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[PROCESS] unhandledRejection:', reason);
});

start();
