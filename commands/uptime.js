import { formatUptime } from '../utils/format.js';

export default {
  name: 'uptime',
  description: 'Uptime bot',

  async execute({ sock, msg, from }) {
    await sock.sendMessage(from, {
      text: `⏱ Uptime: ${formatUptime(process.uptime())}`
    }, { quoted: msg });
  },
};
