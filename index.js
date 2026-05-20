import 'dotenv/config';
import {
  Browsers,
  makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  isJidGroup,
  isJidBroadcast,
  isJidNewsletter,
  isPnUser,
} from '@whiskeysockets/baileys';
import pkg from 'pg';
import {
  usePgAuthState
} from './pgAuthState.js';
import pino from 'pino';
import {
  exec
} from 'child_process';
import {
  promisify
} from 'util';
import http from 'http';

const execAsync = promisify(exec);
const {
  Pool
} = pkg;

const pool = new Pool( {
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || 5432,
  database: process.env.PG_DATABASE || 'neondb',
  user: process.env.PG_USER || 'neondb_owner',
  password: process.env.PG_PASSWORD || 'my_secure_password',
  ssl: {
    rejectUnauthorized: false
  }
});

const PHONE_NUMBER = process.env.PHONE_NUMBER || '6285185985868';
const OWNER_NUMBER = process.env.OWNER_NUMBER || '6285185985868';

function getOwnerJids() {
  return [
    `${OWNER_NUMBER}@s.whatsapp.net`,
    `${OWNER_NUMBER}@lid`
  ];
}

let version = [];

async function start() {
  const {
    state,
    saveCreds
  } = await usePgAuthState(pool, 'session-1');
  const {
    version: v,
    isLatest
  } = await fetchLatestBaileysVersion();
  version = v;


  console.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

  const sock = makeWASocket( {
    browser: Browsers.macOS('Edge'),
    logger: pino( {
      level: 'error'
    }),
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

  sock.ev.on('connection.update', async ({
    connection, lastDisconnect
  }) => {
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) start();
    }
    if (connection === 'open') console.log('Connected');
  });

  sock.ev.on('creds.update',
    saveCreds);

  sock.ev.on('messages.upsert',
    async ({
      messages
    }) => {
      for (const msg of messages) {
        if (!msg.message) continue;

        const from = msg.key.remoteJid;
        const text = msg.message.conversation ?? msg.message.extendedTextMessage?.text ?? '';
        const chatType = getChatType(from);
        const sender = getSender(msg);
        const senderAlt = getSenderAlt(msg);

        if (chatType === 'group') {
          console.log(`[GROUP] ${from} | sender: ${sender} | senderAlt: ${senderAlt}`);
        } else if (chatType === 'private') {
          const mode = msg.key.addressingMode || 'pn';
          console.log(`[PRIVATE (${mode})] sender: ${sender} | alt: ${senderAlt}`);
        } else if (chatType === 'newsletter') {
          console.log(`[NEWSLETTER] ${from}`);
        } else if (chatType === 'broadcast') {
          console.log(`[BROADCAST] ${from}`);
        } else {
          console.log(`[UNKNOWN] ${from}`);
        }

        const isOwner = isFromOwner(sender, senderAlt);

        if (text.toLowerCase() === '/invite' && chatType === 'private') {
          const inviteExpiration = String(Math.floor(Date.now() / 1000) + 604800);
          await sock.relayMessage(from, {
            newsletterAdminInviteMessage: {
              newsletterJid: '120363411786163149@newsletter',
              newsletterName: 'Yapink Universe',
              caption: "Accept this invitation to be an admin for my WhatsApp channel, 'tes'",
              inviteExpiration
            }
          }, {
            messageId: sock.generateMessageTag()
          });
        }
        if (text.startsWith('/eval ') && isOwner) {
          const code = text.slice(6).trim();
          let result;
          try {
            const fn = new Function(
              'sock', 'msg', 'from', 'sender', 'senderAlt', 'pool',
              'getChatType', 'getSender', 'getSenderAlt', 'isFromOwner', 'getPhoneNumber',
              `return (async () => { return ${code} })()`
            );
            result = await fn(sock, msg, from, sender, senderAlt, pool, getChatType, getSender, getSenderAlt, isFromOwner, getPhoneNumber);

            if (result === undefined) result = 'undefined';
            else if (result === null) result = 'null';
            else if (typeof result === 'object') {
              try {
                result = JSON.stringify(result, null, 2);
              } catch {
                result = safeStringify(result);
              }
            } else {
              result = String(result);
            }
          } catch (err) {
            result = `Error: ${err.message}`;
          }
          await sock.sendMessage(from, {
            text: `\`\`\`\n${result}\n\`\`\``
          }, {
            quoted: msg
          });
        }


        if (text.startsWith('/exec ') && isOwner) {
          const command = text.slice(6).trim();
          let result;
          try {
            const {
              stdout,
              stderr
            } = await execAsync(command, {
                timeout: 10000
              });
            result = stdout || stderr || '(no output)';
          } catch (err) {
            result = `Error: ${err.message}`;
          }
          await sock.sendMessage(from, {
            text: `\`\`\`\n${result}\n\`\`\``
          }, {
            quoted: msg
          });
        }

        if (isOwner) {
          if (text.toLowerCase() === '/uptime') {
            const seconds = Math.floor(process.uptime());
            const d = Math.floor(seconds / 86400);
            const h = Math.floor((seconds % 86400) / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = seconds % 60;
            const uptime = `${d}d ${h}h ${m}m ${s}s`;
            await sock.sendMessage(from, {
              text: `⏱ Uptime: ${uptime}`
            }, {
              quoted: msg
            });
          }

          if (text.toLowerCase() === '/ping') {
            const start = Date.now();
            await sock.sendMessage(from, {
              text: `🏓 Pong! ${Date.now() - start}ms`
            }, {
              quoted: msg
            });
          }

          if (text.toLowerCase() === '/info') {
            const info = [
              `🤖 Bot Info`,
              `├ JID     : ${sock.user?.id}`,
              `├ Name    : ${sock.user?.name}`,
              `├ Version : ${version.join('.')}`,
              `├ Uptime  : ${formatUptime(process.uptime())}`,
              `├ Memory  : ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
              `└ Node    : ${process.version}`
            ].join('\n');
            await sock.sendMessage(from, {
              text: info
            }, {
              quoted: msg
            });
          }

          if (text.toLowerCase() === '/restart') {
            await sock.sendMessage(from, {
              text: '🔄 Restarting...'
            }, {
              quoted: msg
            });
            process.exit(0);
          }

          if (text.toLowerCase() === '/memory') {
            const mem = process.memoryUsage();
            const info = [
              `🧠 Memory Usage`,
              `├ RSS      : ${(mem.rss / 1024 / 1024).toFixed(2)} MB`,
              `├ Heap Used: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`,
              `├ Heap Total: ${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`,
              `└ External : ${(mem.external / 1024 / 1024).toFixed(2)} MB`
            ].join('\n');
            await sock.sendMessage(from, {
              text: info
            }, {
              quoted: msg
            });
          }

          if (text.toLowerCase() === '/help') {
            const help = [
              `📋 Self Commands`,
              `├ /uptime  - Uptime bot`,
              `├ /ping    - Latency bot`,
              `├ /info    - Info lengkap bot`,
              `├ /memory  - Memory usage`,
              `├ /restart - Restart bot`,
              `├ /eval    - Jalankan kode JS`,
              `├ /exec    - Jalankan shell command`,
              `└ /invite  - Kirim invite newsletter`
            ].join('\n');
            await sock.sendMessage(from, {
              text: help
            }, {
              quoted: msg
            });
          }
        }

        //console.log(JSON.stringify(msg, null, 2));
      }
    });
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'ok',
    uptime: formatUptime(process.uptime()),
    memory: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
    version: version.join('.')
  }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`HTTP server running on port ${PORT}`));

start();

function getChatType(remoteJid) {
  if (isJidGroup(remoteJid)) return 'group';
  if (isJidNewsletter(remoteJid)) return 'newsletter';
  if (isJidBroadcast(remoteJid)) return 'broadcast';
  if (isPnUser(remoteJid)) return 'private';
  if (remoteJid.endsWith('@lid')) return 'private';
  return 'unknown';
}

function getSender(msg) {
  const {
    remoteJid,
    participant
  } = msg.key;
  return isJidGroup(remoteJid) ? participant: remoteJid;
}

function getSenderAlt(msg) {
  const {
    remoteJid,
    remoteJidAlt,
    participantAlt
  } = msg.key;
  return isJidGroup(remoteJid) ? participantAlt: remoteJidAlt;
}

function getPhoneNumber(jid) {
  if (!jid) return null;
  return jid.split('@')[0];
}

function isFromOwner(sender, senderAlt) {
  const ownerJids = getOwnerJids();
  return ownerJids.includes(sender) || ownerJids.includes(senderAlt);
}

function safeStringify(obj, indent = 2) {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
    }
    if (typeof value === 'function') return `[Function: ${value.name || 'anonymous'}]`;
    if (typeof value === 'bigint') return value.toString();
    return value;
  },
    indent);
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
}