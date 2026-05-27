import { guardAdmin, guardBotAdmin, send } from './_helpers.js';

export default {
  name: 'unmute',
  description: 'Buka grup — semua member bisa kirim pesan',
  category: 'group',
  scope: 'group',
  cooldown: 3,
  async execute({ sock, msg, from, sender }) {
    const meta = await sock.groupMetadata(from);
    if (!await guardAdmin(sock, from, sender, msg, meta)) return;
    if (!await guardBotAdmin(sock, from, msg, meta)) return;
    await sock.groupSettingUpdate(from, 'not_announcement');
    await send(sock, from, '🔊 Grup dibuka. Semua member bisa mengirim pesan.', msg);
  },
};
