export default {
  name: 'ping',
  description: 'Latency bot',

  async execute({ sock, msg, from }) {
    const start = Date.now();

    const sent = await sock.sendMessage(
      from,
      {
        text: '🏓 Pong!',
      },
      {
        quoted: msg,
      }
    );

    const latency = Date.now() - start;

    await sock.sendMessage(
      from,
      {
        text: `🏓 Pong! ${latency}ms`,
      },
      {
        edit: sent.key,
      }
    );
  },
};