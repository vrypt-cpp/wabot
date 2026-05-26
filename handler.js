import { createLogger } from './utils/logger.js';
import { getChatType, getSender, getSenderAlt, isFromOwner } from './utils/jid.js';
import { config } from './config.js';
const log = createLogger('HANDLER');
function extractText(message) {
  if (!message) return '';
  return (
    message.conversation                                          ??
    message.extendedTextMessage?.text                            ??
    message.imageMessage?.caption                                ??
    message.videoMessage?.caption                                ??
    message.documentMessage?.caption                             ??
    message.documentWithCaptionMessage?.message?.documentMessage?.caption ??
    message.listResponseMessage?.title                           ??
    message.buttonsResponseMessage?.selectedDisplayText          ??
    message.templateButtonReplyMessage?.selectedDisplayText      ??
    message.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson ??
    message.viewOnceMessage?.message?.imageMessage?.caption      ??
    message.viewOnceMessage?.message?.videoMessage?.caption      ??
    ''
  );
}
function parseCommand(text) {
  const prefixes = config.settings.prefix;
  for (const prefix of prefixes) {
    if (text.startsWith(prefix)) {
      const rest = text.slice(prefix.length).trimStart();
      const [name, ...argParts] = rest.split(' ');
      return { name: name.toLowerCase(), args: argParts.join(' ') };
    }
  }
  return null;
}
export async function handleMessage(sock, msg, version, pool, registry) {
  if (!msg.message) return;
  const from = msg.key.remoteJid;
  const text = extractText(msg.message);
  const chatType = getChatType(from);
  const sender    = getSender(msg, sock);
  const senderAlt = getSenderAlt(msg, sock);
  const isOwner   = isFromOwner(sender, senderAlt);
  switch (chatType) {
    case 'group':      log.debug('GROUP',      { from, sender, senderAlt, isOwner }); break;
    case 'private':    log.debug('PRIVATE',    { sender, senderAlt, isOwner });       break;
    case 'newsletter': log.debug('NEWSLETTER', { from });                             break;
    case 'broadcast':  log.debug('BROADCAST',  { from });                             break;
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
