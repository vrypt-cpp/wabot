import { guardAdmin, getPhoneNumber, getParticipantJids } from './_helpers.js';

export default {
  name: 'tagall',
  description: 'Tag semua member grup',
  category: 'moderation',
  scope: 'group',
  cooldown: 10,
  async execute({ sock, msg, from, sender }) {
    if (!await guardAdmin(sock, from, sender, msg)) return;
    const meta = await sock.groupMetadata(from);
    const members = getParticipantJids(meta.participants);
    const tags = members.map(j => `@${getPhoneNumber(j)}`).join(' ');
    await sock.sendMessage(from, { text: `📢 *Tag Semua Member*\n${tags}`, mentions: members }, { quoted: msg });
  },
};
