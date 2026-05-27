import { guardAdmin, guardBotAdmin, send } from './_helpers.js';

export default {
  name: 'mute',
  description: 'Kunci grup — hanya admin yang bisa kirim pesan',
  category: 'moderation',
  scope: 'group',
  cooldown: 3,
  async execute({ sock, msg, from, sender }) {
    const meta = await sock.groupMetadata(from);
    if (!await guardAdmin(sock, from, sender, msg, meta)) return;
    if (!await guardBotAdmin(sock, from, msg, meta)) return;
    await sock.groupSettingUpdate(from, 'announcement');
    await send(sock, from, '🔇 Grup dikunci. Hanya admin yang bisa mengirim pesan.', msg);
  },
};
