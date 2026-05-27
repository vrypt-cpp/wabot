import { formatUptime } from '../../utils/format.js';

export default {
  name: 'stats',
  description: 'Tampilkan statistik runtime bot',
  category: 'info',
  ownerOnly: false,
  scope: 'all',
  cooldown: 10,
  hidden: false,

  async execute({ sock, msg, from, registry }) {
    const mem = process.memoryUsage();
    const mb = v => (v / 1024 / 1024).toFixed(2);
    const uptime = formatUptime(process.uptime());
    const cmdCount = registry.all({ includeHidden: true }).length;

    const cpuUsage = process.cpuUsage();
    const cpuUser = (cpuUsage.user / 1000).toFixed(0);
    const cpuSys = (cpuUsage.system / 1000).toFixed(0);

    const text = [
      `📊 *Statistik Bot*`,
      ``,
      `⏱️ Uptime    : ${uptime}`,
      `🧠 Heap      : ${mb(mem.heapUsed)} / ${mb(mem.heapTotal)} MB`,
      `💾 RSS       : ${mb(mem.rss)} MB`,
      `🔧 External  : ${mb(mem.external)} MB`,
      `⚙️ CPU User  : ${cpuUser} ms`,
      `⚙️ CPU Sys   : ${cpuSys} ms`,
      `📦 Commands  : ${cmdCount}`,
      `🟢 Node.js   : ${process.version}`,
      `🖥️ Platform  : ${process.platform} (${process.arch})`,
    ].join('\n');

    await sock.sendMessage(from, { text }, { quoted: msg });
  },
};
