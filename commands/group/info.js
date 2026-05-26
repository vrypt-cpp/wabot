import { getPhoneNumber } from './_helpers.js';

export default {
  name: 'info',
  description: 'Tampilkan info grup',
  category: 'moderation',
  scope: 'group',
  cooldown: 5,
  async execute({ sock, msg, from }) {
    const meta = await sock.groupMetadata(from);
    const admins = meta.participants.filter(p => p.admin).map(p => `@${getPhoneNumber(p.phoneNumber ?? p.id)}`);
    const adminMentions = meta.participants.filter(p => p.admin).map(p => p.phoneNumber ?? p.id);
    const text = [
      `📋 *Info Grup*`,
      `├ Nama      : ${meta.subject}`,
      `├ ID        : ${meta.id}`,
      `├ Member    : ${meta.participants.length}`,
      `├ Admin     : ${admins.join(', ')}`,
      `├ Deskripsi : ${meta.desc ?? '-'}`,
      `└ Dibuat    : ${new Date(meta.creation * 1000).toLocaleDateString('id-ID', { dateStyle: 'long' })}`,
    ].join('\n');
    await sock.sendMessage(from, { text, mentions: adminMentions }, { quoted: msg });
  },
};
