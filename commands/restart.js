export default {
  name: 'restart',
  description: 'Restart bot',

  async execute({ sock, msg, from, pool }) {
    await sock.sendMessage(from, { text: '🔄 Restarting...' }, { quoted: msg });
    try { await pool?.end(); } catch {}
    try { await sock.logout(); } catch {}
    process.exit(0);
  },
};
