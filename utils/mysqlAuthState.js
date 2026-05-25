import { initAuthCreds, BufferJSON } from '@whiskeysockets/baileys';

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
  ADD COLUMN IF NOT EXISTS updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
`;

export async function useMysqlAuthState(pool, sessionId = 'default') {
  await pool.query(TABLE_DDL);

  try {
    await pool.query(MIGRATE_DDL);
  } catch (e) {
    if (e.code !== 'ER_DUP_FIELDNAME') throw e;
  }

  const serialize   = (data) => JSON.stringify(data, BufferJSON.replacer);
  const deserialize = (raw)  => JSON.parse(JSON.stringify(raw), BufferJSON.reviver);

  const write = async (key, data) => {
    await pool.query(
      `INSERT INTO wa_sessions (session_id, \`key\`, value, updated_at)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()`,
      [sessionId, key, serialize(data)]
    );
  };

  const writeBatch = async (entries) => {
    if (!entries.length) return;
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
    const [rows] = await pool.query(
      `SELECT value FROM wa_sessions WHERE session_id = ? AND \`key\` = ?`,
      [sessionId, key]
    );
    if (!rows.length) return null;
    return deserialize(rows[0].value);
  };

  const readBatch = async (keys) => {
    if (!keys.length) return {};
    const placeholders = keys.map(() => '?').join(', ');
    const [rows] = await pool.query(
      `SELECT \`key\`, value FROM wa_sessions
       WHERE session_id = ? AND \`key\` IN (${placeholders})`,
      [sessionId, ...keys]
    );
    return Object.fromEntries(
      rows.map((row) => [row.key, deserialize(row.value)])
    );
  };

  const removeBatch = async (keys) => {
    if (!keys.length) return;
    const placeholders = keys.map(() => '?').join(', ');
    await pool.query(
      `DELETE FROM wa_sessions WHERE session_id = ? AND \`key\` IN (${placeholders})`,
      [sessionId, ...keys]
    );
  };

  const removeSession = async () => {
    await pool.query(
      `DELETE FROM wa_sessions WHERE session_id = ?`,
      [sessionId]
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
    removeSession,
  };
}
