import { guardAdmin, guardBotAdmin, send } from './_helpers.js';

export default {
  name: 'revoke',
  description: 'Reset link undangan grup',
  category: 'moderation',
  scope: 'group',
  cooldown: 3,
  async execute({ sock, msg, from, sender }) {
    const meta = await sock.groupMetadata(from);
    if (!await guardAdmin(sock, from, sender, msg, meta)) return;
    if (!await guardBotAdmin(sock, from, msg, meta)) return;
    await sock.groupRevokeInvite(from);
    const newCode = await sock.groupInviteCode(from);
    await send(sock, from, `🔄 Link undangan diperbarui:\nhttps://chat.whatsapp.com/${newCode}`, msg);
  },
};
