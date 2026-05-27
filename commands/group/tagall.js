import { guardAdmin, getParticipantJids, getParticipantDisplayId } from './_helpers.js';

export default {
  name: 'tagall',
  description: 'Tag semua member grup',
  category: 'group',
  scope: 'group',
  cooldown: 10,
  async execute({ sock, msg, from, sender }) {
    const meta = await sock.groupMetadata(from);
    if (!await guardAdmin(sock, from, sender, msg, meta)) return;

    const memberJids = getParticipantJids(meta.participants);
    const tags = meta.participants.map(p => `@${getParticipantDisplayId(p)}`).join(' ');

    await sock.sendMessage(from, {
      text: `📢 *Tag Semua Member*\n${tags}`,
      mentions: memberJids,
    }, { quoted: msg });
  },
};
