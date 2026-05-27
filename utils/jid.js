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

export function getDisplayId(jid, phoneNumber = null) {
  if (!jid) return null;
  if (phoneNumber) return phoneNumber.replace(/\D/g, '');
  return jid.split('@')[0];
}

export const getPhoneNumber = getDisplayId;

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
    return sock?.user?.id ?? `${config.bot.phoneNumber}@s.whatsapp.net`;
  }
  if (isJidGroup(remoteJid)) {
    return participant ?? remoteJid;
  }
  return remoteJid;
}

export function getSenderAlt(msg) {
  const { remoteJid, remoteJidAlt, participantAlt, fromMe } = msg.key;
  if (fromMe) return null;
  if (isJidGroup(remoteJid)) return participantAlt ?? null;
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
  const checkJid = (jid) => {
    if (!jid) return false;
    const num = normalizeJid(jid)?.split('@')[0]?.replace(/\D/g, '');
    return !!num && ownerNumbers.includes(num);
  };
  return checkJid(sender) || checkJid(senderAlt);
}

export async function isAdminGroup(sock, groupJid, sender, meta = null) {
  if (!sender) return false;
  try {
    const m = meta ?? await sock.groupMetadata(groupJid);
    const normalSender = normalizeJid(sender);
    return m.participants.some(p => {
      const isAdmin = p.admin === 'admin' || p.admin === 'superadmin';
      if (!isAdmin) return false;
      if (p.id && isSameJid(p.id, normalSender)) return true;
      if (p.phoneNumber && isSameJid(p.phoneNumber, normalSender)) return true;
      return false;
    });
  } catch {
    return false;
  }
}

export async function isBotAdmin(sock, groupJid, meta = null) {
  try {
    const m = meta ?? await sock.groupMetadata(groupJid);
    const botId = normalizeJid(sock?.user?.id);
    return m.participants.some(p => {
      const isAdmin = p.admin === 'admin' || p.admin === 'superadmin';
      if (!isAdmin) return false;
      if (p.id && isSameJid(normalizeJid(p.id), botId)) return true;
      if (p.phoneNumber && isSameJid(p.phoneNumber, botId)) return true;
      return false;
    });
  } catch {
    return false;
  }
}

export function getParticipantJids(participants) {
  return participants.map(p => p.id ?? p.phoneNumber);
}

export function getParticipantDisplayId(p) {
  if (isLid(p.id) && p.phoneNumber) {
    return p.phoneNumber.split('@')[0].replace(/\D/g, '');
  }
  return (p.id ?? p.phoneNumber ?? '').split('@')[0];
}
