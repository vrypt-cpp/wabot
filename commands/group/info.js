import { getParticipantDisplayId } from './_helpers.js';

export default {
  name: 'info',
  description: 'Tampilkan info grup',
  category: 'group',
  scope: 'group',
  cooldown: 5,
  async execute({ sock, msg, from }) {
    const meta = await sock.groupMetadata(from);
    const adminParticipants = meta.participants.filter(p => p.admin);
    const adminLabels = adminParticipants.map(p => `@${getParticipantDisplayId(p)}`);
    const adminJids = adminParticipants.map(p => p.id ?? p.phoneNumber);
    const ownerDisplay = meta.ownerPn
      ? meta.ownerPn.split('@')[0]
      : (meta.owner ? meta.owner.split('@')[0] : '-');

    const text = [
      `📋 *Info Grup*`,
      `├ Nama      : ${meta.subject}`,
      `├ ID        : ${meta.id}`,
      `├ Owner     : ${ownerDisplay}`,
      `├ Member    : ${meta.participants.length}`,
      `├ Admin     : ${adminLabels.join(', ')}`,
      `├ Deskripsi : ${meta.desc ?? '-'}`,
      `└ Dibuat    : ${new Date(meta.creation * 1000).toLocaleDateString('id-ID', { dateStyle: 'long' })}`,
    ].join('\n');

    await sock.sendMessage(from, { text, mentions: adminJids }, { quoted: msg });
  },
};
