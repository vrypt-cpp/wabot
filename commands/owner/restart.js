import { setBotState } from '../../server.js'

export default {
  name: 'restart',
  description: 'Restart proses bot dan tutup semua koneksi',
  category: 'moderation',
  ownerOnly: true,
  scope: 'all',
  cooldown: 0,
  hidden: true,

  async execute({ sock, msg, from, pool }) {
    await sock.sendMessage(from, { text: '🔄 Restarting...' }, { quoted: msg });

    setBotState({ isRestarting: true });

    try { await pool?.end(); } catch {}
    try { await sock.logout(); } catch {}
    process.exit(0);
  },
};
