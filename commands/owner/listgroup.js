export default {
  name: ['listgroup', 'groups'],
  description: 'Tampilkan semua grup yang diikuti bot (owner only)',
  category: 'moderation',
  ownerOnly: true,
  scope: 'all',
  cooldown: 10,

  async execute({ sock, msg, from }) {
    const groups = await sock.groupFetchAllParticipating();
    const entries = Object.values(groups);

    if (entries.length === 0) {
      await sock.sendMessage(from, { text: 'ℹ️ Bot tidak bergabung di grup manapun.' }, { quoted: msg });
      return;
    }

    const lines = [`📋 *Daftar Grup Bot* (${entries.length} grup)\n`];
    entries.forEach((g, i) => {
      const tree = i === entries.length - 1 ? '└' : '├';
      lines.push(`${tree} ${g.subject}\n${i === entries.length - 1 ? ' ' : '│'}   👥 ${g.participants.length} member`);
    });

    await sock.sendMessage(from, { text: lines.join('\n') }, { quoted: msg });
  },
};
