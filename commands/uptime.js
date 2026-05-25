import { formatUptime } from '../utils/format.js';

export default {
  name: 'uptime',
  description: 'Tampilkan sudah berapa lama bot berjalan',
  category: 'info',
  ownerOnly: false,
  scope: 'all',
  cooldown: 10,
  hidden: false,

  async execute({ sock, msg, from }) {
    await sock.sendMessage(from, {
      text: `⏱ Uptime: ${formatUptime(process.uptime())}`
    }, { quoted: msg });
  },
};
