import { send } from './_helpers.js';

export default {
  name: 'leave',
  description: 'Bot keluar dari grup (owner only)',
  category: 'moderation',
  scope: 'group',
  ownerOnly: true,
  cooldown: 3,
  async execute({ sock, msg, from }) {
    await send(sock, from, '👋 Bot keluar dari grup. Sampai jumpa!', msg);
    await sock.groupLeave(from);
  },
};
