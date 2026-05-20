import { proto, initAuthCreds, BufferJSON } from '@whiskeysockets/baileys';

const TABLE_DDL = `
  CREATE TABLE IF NOT EXISTS wa_sessions (
    session_id TEXT NOT NULL,
    key        TEXT NOT NULL,
    value      JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_id, key)
  )
`;

export async function usePgAuthState(pool, sessionId = 'default') {
  await pool.query(TABLE_DDL);

  const cache = new Map();

  const cacheKey   = (key) => `${sessionId}:${key}`;
  const serialize   = (data) => JSON.stringify(data, BufferJSON.replacer);
  const deserialize = (raw)  => JSON.parse(JSON.stringify(raw), BufferJSON.reviver);

  const write = async (key, data) => {
    const value = serialize(data);
    cache.set(cacheKey(key), data);
    await pool.query(
      `INSERT INTO wa_sessions (session_id, key, value, updated_at)
       VALUES ($1, $2, $3::jsonb, NOW())
       ON CONFLICT (session_id, key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [sessionId, key, value]
    );
  };

  const writeBatch = async (entries) => {
    if (!entries.length) return;
    for (const [key, data] of entries) cache.set(cacheKey(key), data);
    const sessionIds = entries.map(() => sessionId);
    const keys       = entries.map(([k]) => k);
    const values     = entries.map(([, v]) => serialize(v));
    await pool.query(
      `INSERT INTO wa_sessions (session_id, key, value, updated_at)
       SELECT * FROM UNNEST($1::text[], $2::text[], $3::jsonb[], array_fill(NOW(), ARRAY[$4::int]))
       ON CONFLICT (session_id, key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [sessionIds, keys, values, entries.length]
    );
  };

  const read = async (key) => {
    const ck = cacheKey(key);
    if (cache.has(ck)) return cache.get(ck);
    const { rows } = await pool.query(
      `SELECT value FROM wa_sessions WHERE session_id = $1 AND key = $2`,
      [sessionId, key]
    );
    if (!rows.length) return null;
    const parsed = deserialize(rows[0].value);
    cache.set(ck, parsed);
    return parsed;
  };

  const readBatch = async (keys) => {
    const result  = {};
    const missing = [];
    for (const key of keys) {
      const ck = cacheKey(key);
      if (cache.has(ck)) result[key] = cache.get(ck);
      else missing.push(key);
    }
    if (missing.length) {
      const { rows } = await pool.query(
        `SELECT key, value FROM wa_sessions
         WHERE session_id = $1 AND key = ANY($2::text[])`,
        [sessionId, missing]
      );
      for (const row of rows) {
        const parsed = deserialize(row.value);
        cache.set(cacheKey(row.key), parsed);
        result[row.key] = parsed;
      }
    }
    return result;
  };

  const removeBatch = async (keys) => {
    if (!keys.length) return;
    for (const key of keys) cache.delete(cacheKey(key));
    await pool.query(
      `DELETE FROM wa_sessions WHERE session_id = $1 AND key = ANY($2::text[])`,
      [sessionId, keys]
    );
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
    clearCache: () => cache.clear(),
  };
}
