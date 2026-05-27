import {
  isAdminGroup,
  isBotAdmin,
  getDisplayId,
  getPhoneNumber,
  normalizeJid,
  isSameJid,
  getParticipantJids,
  getParticipantDisplayId,
} from '../../utils/jid.js';

export const send = (sock, from, text, msg) =>
  sock.sendMessage(from, { text }, { quoted: msg });

export async function guardAdmin(sock, from, sender, msg, meta = null) {
  const ok = await isAdminGroup(sock, from, sender, meta);
  if (!ok) await send(sock, from, '❌ Kamu harus admin untuk menggunakan command ini.', msg);
  return ok;
}

export async function guardBotAdmin(sock, from, msg, meta = null) {
  const ok = await isBotAdmin(sock, from, meta);
  if (!ok) await send(sock, from, '❌ Bot harus menjadi admin grup terlebih dahulu.', msg);
  return ok;
}

export async function isBotJoined(sock, jid) {
  if (!jid?.endsWith('@g.us')) return false;
  try {
    const meta = await sock.groupMetadata(jid);
    const botId = normalizeJid(sock.user?.id);
    if (!botId) return false;
    return meta.participants.some(p => isSameJid(normalizeJid(p.id), botId));
  } catch {
    return false;
  }
}

export function getMentioned(msg) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const mentions = ctx?.mentionedJid ?? [];
  const quoted = ctx?.participant ?? null;
  return [...new Set([...mentions, quoted].filter(Boolean))];
}

export {
  getDisplayId,
  getPhoneNumber,
  normalizeJid,
  isSameJid,
  getParticipantJids,
  getParticipantDisplayId,
};
