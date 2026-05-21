export default {
  name: 'help',
  description: 'Tampilkan daftar command',

  async execute({ sock, msg, from, registry }) {
    const commands = registry.all();

    const lines = ['📋 *Self Commands*', ''];
    for (const cmd of commands) {
      const names = Array.isArray(cmd.name) ? cmd.name : [cmd.name];
      const trigger = names.map(n => `/${n}`).join(' | ');
      const scope = cmd.scope && cmd.scope !== 'all' ? ` _(${cmd.scope} only)_` : '';
      lines.push(`├ ${trigger}${scope}`);
      lines.push(`│   ${cmd.description}`);
    }
    lines[lines.length - 1] = lines[lines.length - 1].replace('├', '└');

    await sock.sendMessage(from, { text: lines.join('\n') }, { quoted: msg });
  },
};
