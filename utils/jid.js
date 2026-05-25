import {
  isJidGroup,
  isJidBroadcast,
  isJidNewsletter,
  isPnUser,
} from '@whiskeysockets/baileys';
import { config } from '../config.js';
export function isLid(jid) {
  return typeof jid === 'string' && jid.endsWith('@lid');
}
export function isPn(jid) {
  return typeof jid === 'string' && jid.endsWith('@s.whatsapp.net');
}
export function getPhoneNumber(jid) {
  if (!jid) return null;
  return jid.split('@')[0];
}
export function getOwnerJids() {
  return config.bot.ownerNumber.flatMap(num => [
    `${num}@s.whatsapp.net`,
    `${num}@lid`,       
  ]);
}
export function getChatType(remoteJid) {
  if (!remoteJid) return 'unknown';
  if (isJidGroup(remoteJid)) return 'group';
  if (isJidNewsletter(remoteJid)) return 'newsletter';
  if (isJidBroadcast(remoteJid)) return 'broadcast';
  if (isPnUser(remoteJid)) return 'private';
  if (isLid(remoteJid)) return 'private';   
  return 'unknown';
}
export function getSender(msg, sock = null) {
  const { remoteJid, participant, fromMe } = msg.key;
  if (fromMe) {
    const botJid = sock?.user?.id ?? `${config.bot.phoneNumber}@s.whatsapp.net`;
    return botJid;
  }
  if (isJidGroup(remoteJid)) {
    return participant ?? remoteJid;
  }
  return remoteJid;
}
export function getSenderAlt(msg, sock = null) {
  const { remoteJid, remoteJidAlt, participantAlt, fromMe } = msg.key;
  if (fromMe) {
    const botJid = sock?.user?.id ?? `${config.bot.phoneNumber}@s.whatsapp.net`;
    return null;
  }
  if (isJidGroup(remoteJid)) {
    return participantAlt ?? null;
  }
  return remoteJidAlt ?? null;
}
export function normalizeJid(jid) {
  if (!jid) return null;
  return jid.replace(/:\d+(?=@)/, '');
}
export function isSameJid(a, b) {
  if (!a || !b) return false;
  return normalizeJid(a) === normalizeJid(b);
}
export function isFromOwner(sender, senderAlt) {
  const ownerNumbers = config.bot.ownerNumber.map(n => n.replace(/\D/g, ''));
  const check = (jid) => {
    if (!jid) return false;
    const num = getPhoneNumber(normalizeJid(jid)).replace(/\D/g, '');
    return ownerNumbers.includes(num);
  };
  return check(sender) || check(senderAlt);
}
export async function isAdminGroup(sock, groupJid, sender) {
  if (!sender) return false;
  try {
    const meta = await sock.groupMetadata(groupJid);
    const senderNum = getPhoneNumber(normalizeJid(sender)).replace(/\D/g, '');
    return meta.participants.some(p => {
      const isAdmin = p.admin === 'admin' || p.admin === 'superadmin';
      if (!isAdmin) return false;
      const pidNum = getPhoneNumber(p.id ?? '').replace(/\D/g, '');
      if (pidNum && pidNum === senderNum) return true;
      const pnNum = getPhoneNumber(p.phoneNumber ?? '').replace(/\D/g, '');
      if (pnNum && pnNum === senderNum) return true;
      return false;
    });
  } catch {
    return false;
  }
}
export async function isBotAdmin(sock, groupJid) {
  const botNum = config.bot.phoneNumber.replace(/\D/g, '');
  try {
    const meta = await sock.groupMetadata(groupJid);
    return meta.participants.some(p => {
      const isAdmin = p.admin === 'admin' || p.admin === 'superadmin';
      if (!isAdmin) return false;
      const pidNum = getPhoneNumber(p.id ?? '').replace(/\D/g, '');
      if (pidNum === botNum) return true;
      const pnNum = getPhoneNumber(p.phoneNumber ?? '').replace(/\D/g, '');
      if (pnNum === botNum) return true;
      return false;
    });
  } catch {
    return false;
  }
}
export function getParticipantJids(participants) {
  return participants.map(p => p.phoneNumber ?? p.id);
}
