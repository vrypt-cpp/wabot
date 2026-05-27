export default {
  name: ['help', 'menu'],
  description: 'Tampilkan daftar command yang tersedia',
  category: 'info',
  ownerOnly: false,
  scope: 'all',
  cooldown: 5,
  hidden: false,

  async execute({ sock, msg, from, args, isOwner, registry }) {
    const category = args?.trim().toLowerCase() || null;
    const commands = registry.all({ includeHidden: isOwner, category });
    const categories = category ? [category] : registry.categories();

    if (category && commands.length === 0) {
      await sock.sendMessage(from, { text: `⚠️ Kategori *${category}* tidak ditemukan.` }, { quoted: msg });
      return;
    }

    const lines = ['📋 *Daftar Command*', ''];

    for (const cat of categories) {
      const cmds = commands.filter(cmd => cmd.category === cat);
      if (cmds.length === 0) continue;

      lines.push(`*${cat.toUpperCase()}*`);

      for (let i = 0; i < cmds.length; i++) {
        const cmd = cmds[i];
        const isLast = i === cmds.length - 1;
        const names = Array.isArray(cmd.name) ? cmd.name : [cmd.name];
        const trigger = names.map(n => `\`/${n}\``).join(' | ');
        const scope = cmd.scope !== 'all' ? ` _(${cmd.scope})_` : '';
        const owner = cmd.ownerOnly ? ' 👑' : '';
        const tree = isLast ? '└' : '├';

        lines.push(`${tree} ${trigger}${scope}${owner}`);
        lines.push(`${isLast ? ' ' : '│'}   ${cmd.description}`);
      }

      lines.push('');
    }

    lines.push(`_Gunakan /help <kategori> untuk filter._`);
    lines.push(`_Kategori: ${registry.categories().join(', ')}_`);

    await sock.sendMessage(from, { text: lines.join('\n') }, { quoted: msg });
  },
};
