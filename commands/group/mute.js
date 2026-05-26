import { guardAdmin, guardBotAdmin, send } from './_helpers.js';

export default {
  name: 'mute',
  description: 'Kunci grup — hanya admin yang bisa kirim pesan',
  category: 'moderation',
  scope: 'group',
  cooldown: 3,
  async execute({ sock, msg, from, sender }) {
    if (!await guardAdmin(sock, from, sender, msg)) return;
    if (!await guardBotAdmin(sock, from, msg)) return;
    await sock.groupSettingUpdate(from, 'announcement');
    await send(sock, from, '🔇 Grup dikunci. Hanya admin yang bisa mengirim pesan.', msg);
  },
};
