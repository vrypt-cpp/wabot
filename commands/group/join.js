import { isBotJoined } from './_helpers.js';

export default {
  name: 'join',
  description: 'Bot bergabung ke grup via link invite (owner only)',
  category: 'moderation',
  scope: 'all',
  ownerOnly: true,
  cooldown: 3,

  async execute({ sock, msg, from, args }) {
    if (!args) {
      return await sock.sendMessage(
        from,
        {
          text:
            '❌ Masukkan link grup!\n\nContoh: `.join https://chat.whatsapp.com/xxxxx`',
        },
        { quoted: msg }
      );
    }

    const link = args.trim();

    const match = link.match(
      /(?:chat\.whatsapp\.com\/|whatsapp\.com\/invite\/)([A-Za-z0-9_-]+)/
    );

    if (!match) {
      return await sock.sendMessage(
        from,
        {
          text:
            '❌ Link grup tidak valid! Pastikan formatnya benar.\n\nContoh: `https://chat.whatsapp.com/xxxxx`',
        },
        { quoted: msg }
      );
    }

    const inviteCode = match[1];

    try {
      await sock.sendMessage(
        from,
        {
          text: '⏳ Sedang mencoba bergabung ke grup...',
        },
        { quoted: msg }
      );

      const groupJid = await sock.groupGetInviteInfo(inviteCode)
        .then(res => res.id)
        .catch(() => null);

      if (groupJid) {
        const joined = await isBotJoined(sock, groupJid);

        if (joined) {
          return await sock.sendMessage(
            from,
            {
              text: '❌ Bot sudah berada di dalam grup tersebut.',
            },
            { quoted: msg }
          );
        }
      }

      const result = await sock.groupAcceptInvite(inviteCode);

      await sock.sendMessage(
        from,
        {
          text:
            `✅ Berhasil bergabung ke grup!\n` +
            `Group ID: ${result}`,
        },
        { quoted: msg }
      );
    } catch (err) {
      const message = err?.message || '';

      if (message.includes('401')) {
        await sock.sendMessage(
          from,
          {
            text: '❌ Link tidak valid atau sudah kadaluarsa.',
          },
          { quoted: msg }
        );
      } else if (message.includes('403')) {
        await sock.sendMessage(
          from,
          {
            text: '❌ Bot diblokir dari grup ini.',
          },
          { quoted: msg }
        );
      } else {
        await sock.sendMessage(
          from,
          {
            text: `❌ Gagal bergabung: ${message}`,
          },
          { quoted: msg }
        );
      }
    }
  },
};
