import { guardAdmin, guardBotAdmin, getMentioned, getParticipantDisplayId } from './_helpers.js';

export default {
  name: 'kick',
  description: 'Kick member dari grup',
  category: 'moderation',
  scope: 'group',
  cooldown: 3,
  async execute({ sock, msg, from, sender }) {
    const meta = await sock.groupMetadata(from);
    if (!await guardAdmin(sock, from, sender, msg, meta)) return;
    if (!await guardBotAdmin(sock, from, msg, meta)) return;

    const targets = getMentioned(msg);
    if (!targets.length) {
      return sock.sendMessage(from, { text: '❌ Tag atau reply member yang ingin dikick.' }, { quoted: msg });
    }

    const names = targets.map(t => {
      const p = meta.participants.find(x => x.id === t);
      return `@${p ? getParticipantDisplayId(p) : t.split('@')[0]}`;
    }).join(', ');

    await sock.groupParticipantsUpdate(from, targets, 'remove');
    await sock.sendMessage(from, { text: `✅ Berhasil kick ${names}`, mentions: targets }, { quoted: msg });
  },
};
