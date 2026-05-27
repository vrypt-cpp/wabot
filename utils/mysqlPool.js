import mysql from 'mysql2/promise';
import { createLogger } from './logger.js';

const log = createLogger('DB');

const KEEP_ALIVE_INTERVAL_MS = 3 * 60 * 1000;

export const pool = mysql.createPool({
  host:     process.env.MYSQL_HOST,
  port:     Number(process.env.MYSQL_PORT),
  database: process.env.MYSQL_DATABASE,
  user:     process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  ssl: { rejectUnauthorized: false },
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 50,
  connectTimeout: 10_000,
  idleTimeout: 120_000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 30_000,
});

(async () => {
  try {
    await pool.query('SELECT 1');
    log.info('Koneksi database berhasil.');
  } catch (err) {
    log.fatal('Gagal konek ke database saat startup.', { detail: err.message });
    process.exit(1);
  }
})();

const keepAliveTimer = setInterval(async () => {
  try {
    await pool.query('SELECT 1');
    log.debug('DB keep-alive OK');
  } catch (err) {
    log.warn('DB keep-alive gagal.', { detail: err.message });
  }
}, KEEP_ALIVE_INTERVAL_MS);

keepAliveTimer.unref();
