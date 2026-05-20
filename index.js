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

let version = [];

createHttpServer(() => version);

async function start() {
  const { state, saveCreds } = await usePgAuthState(pool, 'session-1');
  const { version: v, isLatest } = await fetchLatestBaileysVersion();
  version = v;

  console.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

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
      console.log('YOUR PAIRING CODE: ', PAIRING_CODE);
    } catch (err) {
      console.error('Error requesting pairing code: ', err);
    }
  }

  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) start();
    }
    if (connection === 'open') console.log('Connected');
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      await handleMessage(sock, msg, version, pool);
    }
  });
}

start();
