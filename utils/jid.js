import {
  isJidGroup,
  isJidBroadcast,
  isJidNewsletter,
  isPnUser,
} from '@whiskeysockets/baileys';
import { config } from '../config.js';

export function getOwnerJids() {
  return config.bot.ownerNumber.flatMap(num => [
    `${num}@s.whatsapp.net`,
    `${num}@lid`,
  ]);
}

export function getChatType(remoteJid) {
  if (isJidGroup(remoteJid)) return 'group';
  if (isJidNewsletter(remoteJid)) return 'newsletter';
  if (isJidBroadcast(remoteJid)) return 'broadcast';
  if (isPnUser(remoteJid)) return 'private';
  if (remoteJid.endsWith('@lid')) return 'private';
  return 'unknown';
}

export function getSender(msg) {
  const { remoteJid, participant, fromMe } = msg.key;

  if (isJidGroup(remoteJid)) {
    if (fromMe) return getOwnerJids()[0];
    return participant ?? remoteJid;
  }

  if (fromMe) return getOwnerJids()[0];
  return remoteJid;
}

export function getSenderAlt(msg) {
  const { remoteJid, remoteJidAlt, participantAlt, fromMe } = msg.key;

  if (isJidGroup(remoteJid)) {
    if (fromMe) return getOwnerJids()[1];
    return participantAlt ?? null;
  }

  if (fromMe) return getOwnerJids()[1];
  return remoteJidAlt ?? null;
}

export function getPhoneNumber(jid) {
  if (!jid) return null;
  return jid.split('@')[0];
}

export function isFromOwner(sender, senderAlt) {
  const ownerJids = getOwnerJids();
  return ownerJids.includes(sender) || ownerJids.includes(senderAlt);
}

export async function isAdminGroup(sock, groupJid, sender) {
  try {
    const meta = await sock.groupMetadata(groupJid);
    return meta.participants.some(p => {
      const matchId          = p.id          === sender;
      const matchPhoneNumber = p.phoneNumber === sender;
      const isAdmin          = p.admin === 'admin' || p.admin === 'superadmin';
      return (matchId || matchPhoneNumber) && isAdmin;
    });
  } catch {
    return false;
  }
}

export async function isBotAdmin(sock, groupJid) {
  const [pnJid] = getOwnerJids();
  return isAdminGroup(sock, groupJid, pnJid);
}
