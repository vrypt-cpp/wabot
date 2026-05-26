import { guardAdmin, send } from './_helpers.js';

export default {
  name: 'link',
  description: 'Lihat link undangan grup',
  category: 'moderation',
  scope: 'group',
  cooldown: 3,
  async execute({ sock, msg, from, sender }) {
    if (!await guardAdmin(sock, from, sender, msg)) return;
    const code = await sock.groupInviteCode(from);
    await send(sock, from, `🔗 Link undangan grup:\nhttps://chat.whatsapp.com/${code}`, msg);
  },
};
