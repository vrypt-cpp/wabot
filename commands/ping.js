export default {
  name: 'ping',
  description: 'Latency bot',

  async execute({ sock, msg, from }) {
    const start = Date.now();
    await sock.sendMessage(from, { text: '🏓 Pong!' }, { quoted: msg });
    const latency = Date.now() - start;
    await sock.sendMessage(from, { text: `🏓 Pong! ${latency}ms` }, { quoted: msg });
  },
};
