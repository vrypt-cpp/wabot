import { createLogger } from './utils/logger.js';
import { getChatType, getSender, getSenderAlt, isFromOwner } from './utils/jid.js';

const log = createLogger('HANDLER');

const SLASH_PREFIX = '/';
const ALIAS_PREFIXES = [
  { prefix: '=> ', name: '=>' },
  { prefix: '$ ',  name: '$'  },
];

function parseCommand(text) {
  for (const { prefix, name } of ALIAS_PREFIXES) {
    if (text.startsWith(prefix)) {
      return { name, args: text.slice(prefix.length).trim() };
    }
  }

  if (text.startsWith(SLASH_PREFIX)) {
    const rest = text.slice(1).trimStart();
    const [name, ...argParts] = rest.split(' ');
    return { name: name.toLowerCase(), args: argParts.join(' ') };
  }

  return null;
}

export async function handleMessage(sock, msg, version, pool, registry) {
  if (!msg.message) return;

  const from = msg.key.remoteJid;
  const text = msg.message.conversation ?? msg.message.extendedTextMessage?.text ?? '';
  const chatType = getChatType(from);
  const sender = getSender(msg);
  const senderAlt = getSenderAlt(msg);
  const isOwner = isFromOwner(sender, senderAlt);

  switch (chatType) {
    case 'group':      log.info('GROUP',      { from, sender, senderAlt, isOwner }); break;
    case 'private':    log.info('PRIVATE',    { sender, senderAlt, isOwner });       break;
    case 'newsletter': log.info('NEWSLETTER', { from });                             break;
    case 'broadcast':  log.info('BROADCAST',  { from });                             break;
    default:           log.warn('UNKNOWN',    { from });
  }

  const parsed = parseCommand(text);
  if (!parsed) return;

  const { name, args } = parsed;
  const cmd = registry.find(name);
  if (!cmd) return;

  if (cmd.ownerOnly && !isOwner) return;

  const scope = cmd.scope ?? 'all';
  if (scope !== 'all' && scope !== chatType) {
    await sock.sendMessage(from, {
      text: `⚠️ Command /${name} hanya bisa di chat ${scope}.`
    }, { quoted: msg });
    return;
  }

  if (registry.isOnCooldown(name, sender)) {
    const key = `${name}:${sender}`;
    const remaining = Math.ceil((registry._cooldowns.get(key) - Date.now()) / 1000);
    await sock.sendMessage(from, {
      text: `⏳ Tunggu ${remaining}s sebelum pakai /${name} lagi.`
    }, { quoted: msg });
    return;
  }

  registry.setCooldown(name, sender, cmd.cooldown);

  const ctx = { sock, msg, from, sender, senderAlt, isOwner, text, args, chatType, version, pool, registry };

  try {
    await cmd.execute(ctx);
  } catch (err) {
    log.error(`Error in "${name}"`, { detail: err.message });
    await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
  }
}
