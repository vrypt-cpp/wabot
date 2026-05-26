import {
  isAdminGroup,
  isBotAdmin,
  getPhoneNumber,
  normalizeJid,
  getParticipantJids,
  isLid,
} from '../../utils/jid.js';

export const send = (sock, from, text, msg) =>
  sock.sendMessage(from, { text }, { quoted: msg });

export async function guardAdmin(sock, from, sender, msg) {
  const ok = await isAdminGroup(sock, from, sender);
  if (!ok) await send(sock, from, '❌ Kamu harus admin untuk menggunakan command ini.', msg);
  return ok;
}

export async function guardBotAdmin(sock, from, msg) {
  const ok = await isBotAdmin(sock, from);
  if (!ok) await send(sock, from, '❌ Bot harus menjadi admin grup terlebih dahulu.', msg);
  return ok;
}

export function getMentioned(msg) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const mentions = ctx?.mentionedJid ?? [];
  const quoted = ctx?.participant ?? null;
  return [...new Set([...mentions, quoted].filter(Boolean))];
}

export async function resolveToPhoneJids(sock, groupJid, targets) {
  if (targets.every(t => !isLid(t))) return targets;
  try {
    const meta = await sock.groupMetadata(groupJid);
    return targets.map(t => {
      if (!isLid(t)) return t;
      const found = meta.participants.find(p => p.id === t);
      return found?.phoneNumber ?? t;
    });
  } catch {
    return targets;
  }
}

export { getPhoneNumber, normalizeJid, getParticipantJids };
