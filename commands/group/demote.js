import { guardAdmin, guardBotAdmin, getMentioned, resolveToPhoneJids, getPhoneNumber } from './_helpers.js';

export default {
  name: 'demote',
  description: 'Cabut admin member dari grup',
  category: 'moderation',
  scope: 'group',
  cooldown: 3,
  async execute({ sock, msg, from, sender }) {
    if (!await guardAdmin(sock, from, sender, msg)) return;
    if (!await guardBotAdmin(sock, from, msg)) return;
    const targets = getMentioned(msg);
    if (!targets.length) return sock.sendMessage(from, { text: '❌ Tag atau reply member yang ingin didemote.' }, { quoted: msg });
    const resolved = await resolveToPhoneJids(sock, from, targets);
    await sock.groupParticipantsUpdate(from, resolved, 'demote');
    const names = resolved.map(t => `@${getPhoneNumber(t)}`).join(', ');
    await sock.sendMessage(from, { text: `⬇️ Berhasil demote ${names} dari admin`, mentions: resolved }, { quoted: msg });
  },
};
