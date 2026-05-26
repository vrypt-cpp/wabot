import { guardAdmin, guardBotAdmin, send, getPhoneNumber, normalizeJid } from './_helpers.js';

export default {
  name: 'delete',
  description: 'Hapus pesan (reply pesan yang ingin dihapus)',
  category: 'moderation',
  scope: 'group',
  cooldown: 3,
  async execute({ sock, msg, from, sender }) {
    if (!await guardAdmin(sock, from, sender, msg)) return;
    if (!await guardBotAdmin(sock, from, msg)) return;
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    if (!ctx?.stanzaId) return send(sock, from, '❌ Reply pesan yang ingin dihapus.', msg);
    const ctxParticipantNum = getPhoneNumber(normalizeJid(ctx.participant ?? '')).replace(/\D/g, '');
    const botNum = (sock.user?.id ? getPhoneNumber(normalizeJid(sock.user.id)) : '').replace(/\D/g, '');
    const isFromMe = botNum && ctxParticipantNum === botNum;
    await sock.sendMessage(from, {
      delete: {
        remoteJid: from,
        id: ctx.stanzaId,
        participant: ctx.participant,
        fromMe: isFromMe,
      },
    });
  },
};
