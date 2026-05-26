import { formatUptime } from '../../utils/format.js';

export default {
  name: 'info',
  description: 'Tampilkan informasi lengkap bot',
  category: 'info',
  ownerOnly: false,
  scope: 'all',
  cooldown: 10,
  hidden: false,

  async execute({ sock, msg, from, version }) {
    const mb = v => (v / 1024 / 1024).toFixed(2);
    const mem = process.memoryUsage();

    const info = [
      `🤖 *Bot Info*`,
      `├ JID     : ${sock.user?.id}`,
      `├ Name    : ${sock.user?.name}`,
      `├ Version : ${version.join('.')}`,
      `├ Uptime  : ${formatUptime(process.uptime())}`,
      `├ Heap    : ${mb(mem.heapUsed)} / ${mb(mem.heapTotal)} MB`,
      `├ RSS     : ${mb(mem.rss)} MB`,
      `└ Node    : ${process.version}`,
    ].join('\n');

    await sock.sendMessage(from, { text: info }, { quoted: msg });
  },
};
