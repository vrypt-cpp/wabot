import { guardAdmin, guardBotAdmin } from './_helpers.js';

export default {
  name: 'add',
  description: 'Tambah member ke grup',
  category: 'moderation',
  scope: 'group',
  cooldown: 3,
  async execute({ sock, msg, from, sender, args }) {
    if (!await guardAdmin(sock, from, sender, msg)) return;
    if (!await guardBotAdmin(sock, from, msg)) return;

    const numbers = (args ?? '').trim().split(/\s+/).filter(Boolean);
    if (!numbers.length) {
      return sock.sendMessage(from, {
        text: '❌ Masukkan nomor yang ingin ditambahkan.\nContoh: /add 628xxxxxx'
      }, { quoted: msg });
    }

    const jids = numbers.map(n => `${n.replace(/\D/g, '')}@s.whatsapp.net`);
    const result = await sock.groupParticipantsUpdate(from, jids, 'add');

    const lines = result.map(r => {
      const num = r.jid.split('@')[0];
      if (r.status === '200') return `✅ @${num} berhasil ditambahkan`;
      if (r.status === '403') return `⛔ @${num} privasi membatasi penambahan`;
      if (r.status === '408') return `⚠️ @${num} tidak ditemukan`;
      if (r.status === '409') return `ℹ️ @${num} sudah ada di grup`;
      return `❌ @${num} gagal (${r.status})`;
    });

    await sock.sendMessage(from, { text: lines.join('\n'), mentions: jids }, { quoted: msg });
  },
};
