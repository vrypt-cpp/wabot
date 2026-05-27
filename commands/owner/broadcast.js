export default {
  name: 'broadcast',
  aliases: ['bc'],
  description: 'Kirim pesan ke semua grup (owner only)',
  category: 'moderation',
  ownerOnly: true,
  scope: 'all',
  cooldown: 30,

  async execute({ sock, msg, from, args, config }) {
    const text = args?.trim();
    if (!text) {
      await sock.sendMessage(from, {
        text: '❌ Tulis pesan yang ingin dibroadcast.\nContoh: /broadcast Halo semua!',
      }, { quoted: msg });
      return;
    }

    const groups = await sock.groupFetchAllParticipating();
    const groupIds = Object.keys(groups);

    if (groupIds.length === 0) {
      await sock.sendMessage(from, { text: 'ℹ️ Bot tidak ada di grup manapun.' }, { quoted: msg });
      return;
    }

    await sock.sendMessage(from, {
      text: `📡 Memulai broadcast ke *${groupIds.length}* grup...`,
    }, { quoted: msg });

    let success = 0, failed = 0;
    for (const gid of groupIds) {
      try {
        await sock.sendMessage(gid, { text: `📢 *Broadcast*\n\n${text}` });
        success++;
        await new Promise(r => setTimeout(r, config.settings.defaultCooldown * 1000));
      } catch {
        failed++;
      }
    }

    await sock.sendMessage(from, {
      text: ` Broadcast selesai!\n├  \`jeda:\` ${config.settings.defaultCooldown} detik\n├ \`Berhasil:\` ${success}\n└ \`Gagal:\` ${failed}`,
    }, { quoted: msg });
  },
};
