import { guardAdmin, guardBotAdmin, send, normalizeJid, isSameJid } from './_helpers.js';

export default {
  name: ['delete', 'del'],
  description: 'Hapus pesan (reply pesan yang ingin dihapus)',
  category: 'group',
  scope: 'group',
  cooldown: 3,
  async execute({ sock, msg, from, sender }) {
    const meta = await sock.groupMetadata(from);
    if (!await guardAdmin(sock, from, sender, msg, meta)) return;
    if (!await guardBotAdmin(sock, from, msg, meta)) return;

    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    if (!ctx?.stanzaId) return send(sock, from, '❌ Reply pesan yang ingin dihapus.', msg);

    const botId = normalizeJid(sock.user?.id);
    const ctxParticipant = normalizeJid(ctx.participant ?? '');
    const isFromMe = !!botId && isSameJid(botId, ctxParticipant);

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
