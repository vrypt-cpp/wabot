# Patch Notes — Migrasi LID Addressing (Baileys v7)

## Latar Belakang

WhatsApp secara resmi memfinalisasi sistem **LID (Linked ID)** di Baileys v7.
LID adalah identifier unik per-pengguna yang menggantikan pengalamatan berbasis
nomor telepon (PN / `@s.whatsapp.net`) sebagai identifier utama di sesi Signal baru.

---

## Masalah di Kode Lama

| File | Masalah |
|------|---------|
| `utils/jid.js` | `getOwnerJids()` sudah benar, tapi `isAdminGroup` & `isBotAdmin` masih ekstrak nomor dari string JID — tidak cocok jika JID adalah LID |
| `utils/jid.js` | `getParticipantJids()` hanya pakai `p.phoneNumber ?? p.id`, urutan prioritas terbalik |
| `commands/group/_helpers.js` | `resolveToPhoneJids()` berusaha konversi LID → PN via `p.phoneNumber`, padahal WA v7 sudah menerima LID langsung untuk `groupParticipantsUpdate` |
| `commands/group/_helpers.js` | `isBotJoined()` hardcode `@s.whatsapp.net` — tidak cocok jika bot terdaftar dengan LID |
| `commands/group/tagall.js` | Memakai `getPhoneNumber(p)` langsung tanpa `p.phoneNumber`, menghasilkan user-part LID (`abc123`) bukan nomor telepon |
| `commands/group/info.js` | Sama dengan tagall — label admin tidak memanfaatkan `p.phoneNumber` |
| `commands/group/kick/promote/demote.js` | Memanggil `resolveToPhoneJids()` yang tidak diperlukan lagi |
| `commands/group/delete.js` | Ekstrak nomor dari JID untuk bandingkan bot — tidak cocok untuk LID |
| `index.js` | Notifikasi koneksi dikirim ke `PHONE_NUMBER + '@s.whatsapp.net'` — harusnya `sock.user.id` |
| `index.js` | Tidak ada listener `lid-mapping.update` |
| `loader.js` | `notify.from` di-hardcode sebagai `PHONE_NUMBER + '@s.whatsapp.net'` |

---

## Perubahan yang Diterapkan

### `utils/jid.js`
- `getPhoneNumber()` → diganti `getDisplayId(jid, phoneNumber?)` — hanya untuk tampilan teks
- `getPhoneNumber` tetap di-export sebagai alias agar tidak breaking
- `isAdminGroup()` → pencocokan via `isSameJid(p.id, sender)` DAN `isSameJid(p.phoneNumber, sender)` — tidak lagi ekstrak angka dari string
- `isBotAdmin()` → sama, pakai `isSameJid` terhadap `sock.user.id`
- `getParticipantJids()` → kembalikan `p.id` (LID atau PN, sesuai WA) sebagai primary — untuk routing mention
- `getParticipantDisplayId()` → fungsi baru — kembalikan nomor telepon yang bisa dibaca manusia untuk label `@mention` di teks

### `commands/group/_helpers.js`
- `resolveToPhoneJids()` → **tidak lagi melakukan konversi**, langsung return `targets` — WA v7 menerima LID langsung
- `isBotJoined()` → pakai `isSameJid(normalizeJid(p.id), botId)` — cocok untuk LID maupun PN
- Export `getParticipantDisplayId` untuk dipakai command

### `commands/group/tagall.js`
- Mentions menggunakan `getParticipantJids()` (LID/PN untuk routing)
- Label teks menggunakan `getParticipantDisplayId()` (nomor telepon jika tersedia)

### `commands/group/info.js`
- Admin JID untuk mentions pakai `p.id` langsung
- Label teks admin pakai `getParticipantDisplayId()`
- Tambah field `Owner` di output (dari `meta.ownerPn ?? meta.owner`)

### `commands/group/kick.js` / `promote.js` / `demote.js`
- Hapus pemanggilan `resolveToPhoneJids()` — tidak diperlukan
- Kirim `targets` (LID/PN) langsung ke `groupParticipantsUpdate`
- Label nama di reply pakai `getParticipantDisplayId()` dari metadata

### `commands/group/delete.js`
- Perbandingan bot vs participant pakai `isSameJid()` — aman untuk LID maupun PN

### `commands/group/add.js`
- Tetap menggunakan `@s.whatsapp.net` untuk `add` karena input adalah nomor dari user (bukan dari participant yang sudah ada di grup)

### `index.js`
- Notifikasi koneksi dikirim ke `sock.user.id` bukan `PHONE_NUMBER + '@s.whatsapp.net'`
- `initRegistry` meneruskan `sock.user.id` sebagai `notify.from` untuk hot-reload
- Tambah listener `lid-mapping.update` untuk debug

### `handler.js`
- Komentar diperbarui untuk menjelaskan semantik `sender` (LID atau PN) dan `senderAlt`
- Cooldown key tetap pakai `sender` — konsisten per sesi

---

## Prinsip Utama Setelah Patch

1. **Jangan paksa konversi LID → PN** untuk routing. WA v7 menerima LID langsung.
2. **`p.id`** adalah identifier utama participant (bisa LID atau PN).
3. **`p.phoneNumber`** adalah field opsional untuk label tampilan jika `p.id` adalah LID.
4. **`sock.user.id`** adalah JID bot yang aktif — selalu gunakan ini, bukan `PHONE_NUMBER + '@s.whatsapp.net'`.
5. **`getSender()`** dan **`getSenderAlt()`** menangani dualitas LID/PN — selalu gunakan keduanya untuk pengecekan identitas.
