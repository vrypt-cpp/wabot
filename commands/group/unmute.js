import { guardAdmin, guardBotAdmin, send } from './_helpers.js';

export default {
  name: 'unmute',
  description: 'Buka grup — semua member bisa kirim pesan',
  category: 'moderation',
  scope: 'group',
  cooldown: 3,
  async execute({ sock, msg, from, sender }) {
    if (!await guardAdmin(sock, from, sender, msg)) return;
    if (!await guardBotAdmin(sock, from, msg)) return;
    await sock.groupSettingUpdate(from, 'not_announcement');
    await send(sock, from, '🔊 Grup dibuka. Semua member bisa mengirim pesan.', msg);
  },
};
