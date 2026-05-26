import mysql from 'mysql2/promise';
import { createLogger } from './logger.js';

const log = createLogger('DB');

export const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT),
  database: process.env.MYSQL_DATABASE,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

(async () => {
  try {
    const conn = await pool.getConnection();
    conn.release();
    log.info('Koneksi database berhasil.');
  } catch (err) {
    log.fatal('Gagal konek ke database saat startup.', { detail: err.message });
    process.exit(1);
  }
})();

const POOL_KEEP_ALIVE_INTERVAL = 15_000;

setInterval(async () => {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
  } catch (err) {
    log.warn('Pool keep-alive ping gagal.', { detail: err.message });
  }
}, POOL_KEEP_ALIVE_INTERVAL);