import { initAuthCreds, BufferJSON } from '@whiskeysockets/baileys';
import NodeCache from 'node-cache';

const TABLE_DDL = `
  CREATE TABLE IF NOT EXISTS wa_sessions (
    session_id VARCHAR(255) NOT NULL,
    \`key\`     VARCHAR(255) NOT NULL,
    value      JSON         NOT NULL,
    updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (session_id, \`key\`)
  )
`;

const MIGRATE_DDL = `
  ALTER TABLE wa_sessions
  ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
`;

const cacheRegistry = new Map();

export async function useMysqlAuthState(pool, sessionId = 'default') {
  await pool.query(TABLE_DDL);

  try {
    await pool.query(MIGRATE_DDL);
  } catch (e) {
    if (e.code !== 'ER_DUP_FIELDNAME') throw e;
  }

  if (cacheRegistry.has(sessionId)) {
    cacheRegistry.get(sessionId).close();
    cacheRegistry.delete(sessionId);
  }

  const cache = new NodeCache({ stdTTL: 300, checkperiod: 60, useClones: false });
  cacheRegistry.set(sessionId, cache);

  const cacheKey = (key) => `${sessionId}:${key}`;

  const serialize   = (data) => JSON.stringify(data, BufferJSON.replacer);
  const deserialize = (raw)  => {
    const str = typeof raw === 'string' ? raw : JSON.stringify(raw);
    return JSON.parse(str, BufferJSON.reviver);
  };
  const deepClone = (data) => deserialize(serialize(data));

  const writeLocks = new Map();
  const withLock = async (key, fn) => {
    const prev = writeLocks.get(key) ?? Promise.resolve();
    let release;
    const next = new Promise((res) => (release = res));
    writeLocks.set(key, next);
    try {
      await prev;
      return await fn();
    } finally {
      release();
      if (writeLocks.get(key) === next) writeLocks.delete(key);
    }
  };

  const write = async (key, data) => {
    return withLock(key, async () => {
      await pool.query(
        `INSERT INTO wa_sessions (session_id, \`key\`, value, updated_at)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()`,
        [sessionId, key, serialize(data)]
      );
      cache.set(cacheKey(key), deepClone(data));
    });
  };

  const writeBatch = async (entries) => {
    if (!entries.length) return;
    await Promise.all(
      entries.map(([k, v]) =>
        withLock(k, () => cache.set(cacheKey(k), deepClone(v)))
      )
    );
    const placeholders = entries.map(() => '(?, ?, ?, NOW())').join(', ');
    const params = entries.flatMap(([k, v]) => [sessionId, k, serialize(v)]);
    await pool.query(
      `INSERT INTO wa_sessions (session_id, \`key\`, value, updated_at)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()`,
      params
    );
  };

  const read = async (key) => {
    const ck = cacheKey(key);
    if (cache.has(ck)) return cache.get(ck);
    const [rows] = await pool.query(
      `SELECT value FROM wa_sessions WHERE session_id = ? AND \`key\` = ?`,
      [sessionId, key]
    );
    if (!rows.length) return null;
    const data = deserialize(rows[0].value);
    cache.set(ck, deepClone(data));
    return data;
  };

  const readBatch = async (keys) => {
    if (!keys.length) return {};
    const result  = {};
    const missing = [];
    for (const key of keys) {
      const ck = cacheKey(key);
      if (cache.has(ck)) {
        result[key] = cache.get(ck);
      } else {
        missing.push(key);
      }
    }
    if (missing.length) {
      const placeholders = missing.map(() => '?').join(', ');
      const [rows] = await pool.query(
        `SELECT \`key\`, value FROM wa_sessions
         WHERE session_id = ? AND \`key\` IN (${placeholders})`,
        [sessionId, ...missing]
      );
      for (const row of rows) {
        const data = deserialize(row.value);
        result[row.key] = data;
        cache.set(cacheKey(row.key), deepClone(data));
      }
    }
    return result;
  };

  const removeBatch = async (keys) => {
    if (!keys.length) return;
    const placeholders = keys.map(() => '?').join(', ');
    await pool.query(
      `DELETE FROM wa_sessions WHERE session_id = ? AND \`key\` IN (${placeholders})`,
      [sessionId, ...keys]
    );
    cache.del(keys.map(cacheKey));
  };

  const removeSession = async () => {
    await pool.query(
      `DELETE FROM wa_sessions WHERE session_id = ?`,
      [sessionId]
    );
    cache.flushAll();
    cache.close();
    cacheRegistry.delete(sessionId);
  };

  const creds = (await read('creds')) ?? initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const dbKeys  = ids.map((id) => `${type}-${id}`);
          const fetched = await readBatch(dbKeys);
          return Object.fromEntries(
            ids
              .filter((id) => fetched[`${type}-${id}`] != null)
              .map((id) => [id, fetched[`${type}-${id}`]])
          );
        },
        set: async (data) => {
          const toWrite  = [];
          const toDelete = [];
          for (const [type, entries] of Object.entries(data)) {
            for (const [id, value] of Object.entries(entries)) {
              const key = `${type}-${id}`;
              value ? toWrite.push([key, value]) : toDelete.push(key);
            }
          }
          await Promise.all([writeBatch(toWrite), removeBatch(toDelete)]);
        },
      },
    },
    saveCreds: () => write('creds', creds),
    removeSession,
  };
}