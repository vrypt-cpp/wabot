import { send } from './_helpers.js';

export default {
  name: 'join',
  description: 'Bot bergabung ke grup via link invite (owner only)',
  category: 'moderation',
  scope: 'all',
  ownerOnly: true,
  cooldown: 3,
  async execute({ sock, msg, from, args }) {
    if (!args[0]) {
      return await send(sock, from, '❌ Masukkan link grup!\n\nContoh: `.join https://chat.whatsapp.com/xxxxx`', msg);
    }

    const link = args[0];
    const match = link.match(/chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/);

    if (!match) {
      return await send(sock, from, '❌ Link grup tidak valid! Pastikan formatnya benar.\n\nContoh: `https://chat.whatsapp.com/xxxxx`', msg);
    }

    const inviteCode = match[1];

    try {
      await send(sock, from, '⏳ Sedang mencoba bergabung ke grup...', msg);
      const result = await sock.groupAcceptInvite(inviteCode);
      await send(sock, from, `✅ Berhasil bergabung ke grup!\nGroup ID: ${result}`, msg);
    } catch (err) {
      if (err.message?.includes('401')) {
        await send(sock, from, '❌ Link tidak valid atau sudah kadaluarsa.', msg);
      } else if (err.message?.includes('403')) {
        await send(sock, from, '❌ Bot diblokir dari grup ini.', msg);
      } else if (err.message?.includes('408')) {
        await send(sock, from, '❌ Bot sudah ada di dalam grup ini.', msg);
      } else {
        await send(sock, from, `❌ Gagal bergabung: ${err.message}`, msg);
      }
    }
  },
};
