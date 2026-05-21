import { formatUptime } from '../utils/format.js';

export default {
  name: 'info',
  description: 'Info lengkap bot',

  async execute({ sock, msg, from, version }) {
    const mb = v => (v / 1024 / 1024).toFixed(2);
    const info = [
      `🤖 Bot Info`,
      `├ JID     : ${sock.user?.id}`,
      `├ Name    : ${sock.user?.name}`,
      `├ Version : ${version.join('.')}`,
      `├ Uptime  : ${formatUptime(process.uptime())}`,
      `├ Memory  : ${mb(process.memoryUsage().heapUsed)} MB`,
      `└ Node    : ${process.version}`,
    ].join('\n');
    await sock.sendMessage(from, { text: info }, { quoted: msg });
  },
};
