import { isAdminGroup, isBotAdmin, getPhoneNumber } from '../utils/jid.js';

const send = (sock, from, text, msg) =>
  sock.sendMessage(from, { text }, { quoted: msg });

async function guardGroup(sock, from, msg) {
  return true;
}

async function guardAdmin(sock, from, sender, msg) {
  const ok = await isAdminGroup(sock, from, sender);
  if (!ok) await send(sock, from, '❌ Kamu harus admin untuk menggunakan command ini.', msg);
  return ok;
}

async function guardBotAdmin(sock, from, msg) {
  const ok = await isBotAdmin(sock, from);
  if (!ok) await send(sock, from, '❌ Bot harus menjadi admin grup terlebih dahulu.', msg);
  return ok;
}

function getMentioned(msg) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const mentions = ctx?.mentionedJid ?? [];
  const quoted = ctx?.participant ?? null;
  return [...new Set([...mentions, quoted].filter(Boolean))];
}

const SUBCOMMANDS = {
  async kick(sock, from, msg, sender) {
    if (!await guardAdmin(sock, from, sender, msg)) return;
    if (!await guardBotAdmin(sock, from, msg)) return;

    const targets = getMentioned(msg);
    if (!targets.length) return send(sock, from, '❌ Tag atau reply member yang ingin dikick.', msg);

    await sock.groupParticipantsUpdate(from, targets, 'remove');
    const names = targets.map(t => `@${getPhoneNumber(t)}`).join(', ');
    await sock.sendMessage(from, { text: `✅ Berhasil kick ${names}`, mentions: targets }, { quoted: msg });
  },

  async add(sock, from, msg, sender, args) {
    if (!await guardAdmin(sock, from, sender, msg)) return;
    if (!await guardBotAdmin(sock, from, msg)) return;

    const numbers = args.trim().split(/\s+/).filter(Boolean);
    if (!numbers.length) return send(sock, from, '❌ Masukkan nomor yang ingin ditambahkan.\nContoh: /group add 628xxxxxx', msg);

    const jids = numbers.map(n => `${n.replace(/\D/g, '')}@s.whatsapp.net`);
    const result = await sock.groupParticipantsUpdate(from, jids, 'add');

    const lines = result.map(r => {
      const num = getPhoneNumber(r.jid);
      if (r.status === '200') return `✅ @${num} berhasil ditambahkan`;
      if (r.status === '403') return `⛔ @${num} privasi membatasi penambahan`;
      if (r.status === '408') return `⚠️ @${num} tidak ditemukan`;
      if (r.status === '409') return `ℹ️ @${num} sudah ada di grup`;
      return `❌ @${num} gagal (${r.status})`;
    });

    await sock.sendMessage(from, {
      text: lines.join('\n'),
      mentions: jids,
    }, { quoted: msg });
  },

  async promote(sock, from, msg, sender) {
    if (!await guardAdmin(sock, from, sender, msg)) return;
    if (!await guardBotAdmin(sock, from, msg)) return;

    const targets = getMentioned(msg);
    if (!targets.length) return send(sock, from, '❌ Tag atau reply member yang ingin dipromote.', msg);

    await sock.groupParticipantsUpdate(from, targets, 'promote');
    const names = targets.map(t => `@${getPhoneNumber(t)}`).join(', ');
    await sock.sendMessage(from, { text: `⬆️ Berhasil promote ${names} menjadi admin`, mentions: targets }, { quoted: msg });
  },

  async demote(sock, from, msg, sender) {
    if (!await guardAdmin(sock, from, sender, msg)) return;
    if (!await guardBotAdmin(sock, from, msg)) return;

    const targets = getMentioned(msg);
    if (!targets.length) return send(sock, from, '❌ Tag atau reply member yang ingin didemote.', msg);

    await sock.groupParticipantsUpdate(from, targets, 'demote');
    const names = targets.map(t => `@${getPhoneNumber(t)}`).join(', ');
    await sock.sendMessage(from, { text: `⬇️ Berhasil demote ${names} dari admin`, mentions: targets }, { quoted: msg });
  },

  async mute(sock, from, msg, sender) {
    if (!await guardAdmin(sock, from, sender, msg)) return;
    if (!await guardBotAdmin(sock, from, msg)) return;

    await sock.groupSettingUpdate(from, 'announcement');
    await send(sock, from, '🔇 Grup dikunci. Hanya admin yang bisa mengirim pesan.', msg);
  },

  async unmute(sock, from, msg, sender) {
    if (!await guardAdmin(sock, from, sender, msg)) return;
    if (!await guardBotAdmin(sock, from, msg)) return;

    await sock.groupSettingUpdate(from, 'not_announcement');
    await send(sock, from, '🔊 Grup dibuka. Semua member bisa mengirim pesan.', msg);
  },

  async link(sock, from, msg, sender) {
    if (!await guardAdmin(sock, from, sender, msg)) return;

    const code = await sock.groupInviteCode(from);
    await send(sock, from, `🔗 Link undangan grup:\nhttps://chat.whatsapp.com/${code}`, msg);
  },

  async revoke(sock, from, msg, sender) {
    if (!await guardAdmin(sock, from, sender, msg)) return;
    if (!await guardBotAdmin(sock, from, msg)) return;

    await sock.groupRevokeInvite(from);
    const newCode = await sock.groupInviteCode(from);
    await send(sock, from, `🔄 Link undangan diperbarui:\nhttps://chat.whatsapp.com/${newCode}`, msg);
  },

  async info(sock, from, msg) {
    const meta = await sock.groupMetadata(from);
    const admins = meta.participants.filter(p => p.admin).map(p => `@${getPhoneNumber(p.phoneNumber ?? p.id)}`);
    const total = meta.participants.length;

    const text = [
      `📋 *Info Grup*`,
      `├ Nama      : ${meta.subject}`,
      `├ ID        : ${meta.id}`,
      `├ Member    : ${total}`,
      `├ Admin     : ${admins.join(', ')}`,
      `├ Deskripsi : ${meta.desc ?? '-'}`,
      `└ Dibuat    : ${new Date(meta.creation * 1000).toLocaleDateString('id-ID', { dateStyle: 'long' })}`,
    ].join('\n');

    await sock.sendMessage(from, {
      text,
      mentions: meta.participants.filter(p => p.admin).map(p => p.phoneNumber ?? p.id),
    }, { quoted: msg });
  },

  async tagall(sock, from, msg, sender) {
    if (!await guardAdmin(sock, from, sender, msg)) return;

    const meta = await sock.groupMetadata(from);
    const members = meta.participants.map(p => p.phoneNumber ?? p.id);
    const tags = members.map(j => `@${getPhoneNumber(j)}`).join(' ');

    await sock.sendMessage(from, {
      text: `📢 *Tag Semua Member*\n${tags}`,
      mentions: members,
    }, { quoted: msg });
  },

  async leave(sock, from, msg, sender, args, isOwner) {
    if (!isOwner) return send(sock, from, '❌ Hanya owner bot yang bisa menggunakan command ini.', msg);

    await send(sock, from, '👋 Bot keluar dari grup. Sampai jumpa!', msg);
    await sock.groupLeave(from);
  },
};

const HELP_TEXT = [
  '📦 *Group Management*',
  '',
  '├ /group kick @mention    — Kick member',
  '├ /group add 628xxx       — Tambah member',
  '├ /group promote @mention — Jadikan admin',
  '├ /group demote @mention  — Cabut admin',
  '├ /group mute             — Kunci grup',
  '├ /group unmute           — Buka grup',
  '├ /group link             — Lihat link undangan',
  '├ /group revoke           — Reset link undangan',
  '├ /group info             — Info grup',
  '├ /group tagall           — Tag semua member',
  '└ /group leave            — Bot keluar grup (owner only)',
].join('\n');

export default {
  name: ['group', 'g'],
  description: 'Manajemen grup lengkap (kick, add, promote, demote, mute, dll)',
  category: 'moderation',
  scope: 'group',
  ownerOnly: false,
  cooldown: 3,

  async execute({ sock, msg, from, sender, args, isOwner }) {
    const [sub, ...rest] = (args ?? '').trim().split(/\s+/);
    const subArgs = rest.join(' ');
    const command = sub?.toLowerCase();

    if (!command || !SUBCOMMANDS[command]) {
      return sock.sendMessage(from, { text: HELP_TEXT }, { quoted: msg });
    }

    try {
      await SUBCOMMANDS[command](sock, from, msg, sender, subArgs, isOwner);
    } catch (err) {
      await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
    }
  },
};
