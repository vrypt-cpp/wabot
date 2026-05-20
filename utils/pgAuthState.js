import { proto, initAuthCreds, BufferJSON } from '@whiskeysockets/baileys';

export async function usePgAuthState(pool, sessionId = 'default') {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wa_sessions (
      session_id TEXT NOT NULL,
      key        TEXT NOT NULL,
      value      JSONB NOT NULL,
      PRIMARY KEY (session_id, key)
    )
  `);

  const write = async (key, data) => {
    const value = JSON.stringify(data, BufferJSON.replacer);
    await pool.query(
      `INSERT INTO wa_sessions (session_id, key, value)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (session_id, key)
       DO UPDATE SET value = EXCLUDED.value`,
      [sessionId, key, value]
    );
  };

  const read = async (key) => {
    const { rows } = await pool.query(
      `SELECT value FROM wa_sessions WHERE session_id = $1 AND key = $2`,
      [sessionId, key]
    );
    if (!rows.length) return null;
    return JSON.parse(JSON.stringify(rows[0].value), BufferJSON.reviver);
  };

  const remove = async (key) => {
    await pool.query(
      `DELETE FROM wa_sessions WHERE session_id = $1 AND key = $2`,
      [sessionId, key]
    );
  };

  const creds = (await read('creds')) ?? initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          for (const id of ids) {
            const val = await read(`${type}-${id}`);
            if (val) data[id] = val;
          }
          return data;
        },
        set: async (data) => {
          for (const [type, entries] of Object.entries(data)) {
            for (const [id, value] of Object.entries(entries)) {
              value ? await write(`${type}-${id}`, value) : await remove(`${type}-${id}`);
            }
          }
        },
      },
    },
    saveCreds: () => write('creds', creds),
  };
}
