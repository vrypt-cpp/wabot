export default {
  name: 'memory',
  description: 'Tampilkan memory usage proses bot',
  category: 'info',
  ownerOnly: false,
  scope: 'all',
  cooldown: 10,
  hidden: false,

  async execute({ sock, msg, from }) {
    const mem = process.memoryUsage();
    const mb = v => (v / 1024 / 1024).toFixed(2);

    const info = [
      `🧠 *Memory Usage*`,
      `├ RSS        : ${mb(mem.rss)} MB`,
      `├ Heap Used  : ${mb(mem.heapUsed)} MB`,
      `├ Heap Total : ${mb(mem.heapTotal)} MB`,
      `└ External   : ${mb(mem.external)} MB`,
    ].join('\n');

    await sock.sendMessage(from, { text: info }, { quoted: msg });
  },
};
