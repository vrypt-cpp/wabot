# wabot

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?style=flat-square&logo=node.js&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-supported-4479A1?style=flat-square&logo=mysql&logoColor=white)
![Baileys](https://img.shields.io/badge/Baileys-7.x-25D366?style=flat-square&logo=whatsapp&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)
![ESM](https://img.shields.io/badge/Module-ESM-blueviolet?style=flat-square)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)

WhatsApp bot ringan berbasis [Baileys](https://github.com/WhiskeySockets/Baileys) dengan penyimpanan sesi di MySQL, hot-reload plugin, dan HTTP status server bawaan.

---

## Fitur

- **Pairing code** — login tanpa scan QR
- **MySQL session** — sesi tersimpan di database, tidak hilang saat restart
- **Hot-reload plugin** — tambah/edit/hapus command tanpa restart bot
- **Command registry** — validasi otomatis, cooldown, scope (all/group/private), ownerOnly
- **Reconnect otomatis** — exponential backoff hingga 10 percobaan
- **HTTP status server** — endpoint `/`, `/health`, `/stats` untuk monitoring
- **Multi-tipe pesan** — command dari teks, caption gambar/video/dokumen, button reply, list response

---

## Prasyarat

- Node.js >= 18
- MySQL / MariaDB
- npm

---

## Instalasi

```bash
git clone https://github.com/vrypt-cpp/wabot.git
cd wabot
npm install
```

Salin file environment:

```bash
cp .env.example .env
```

Isi `.env` dengan konfigurasi kamu (lihat bagian [Konfigurasi](#konfigurasi)).

---

## Konfigurasi

Edit file `.env`:

```env
# MySQL
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=wabot
MYSQL_USER=root
MYSQL_PASSWORD=password

# Bot
OWNER_NUMBER=628xxxxxxxxxx   # nomor HP owner tanpa + (contoh: 6281234567890)
PHONE_NUMBER=628xxxxxxxxxx   # nomor HP yang dipakai bot

# HTTP Server
PORT=3000
```

> **Penting:** `OWNER_NUMBER` dan `PHONE_NUMBER` wajib diisi. Bot akan menolak start jika tidak ada.

---

## Menjalankan Bot

```bash
npm start
```

Saat pertama kali jalan, bot akan mencetak **pairing code** di terminal:

```
[INFO] [WA] PAIRING CODE: ABCD-1234
```

Masukkan kode tersebut di WhatsApp → Perangkat Tertaut → Tautkan Perangkat → Tautkan dengan nomor telepon.

---

## Struktur Project

```
wabot/
├── commands/          # Plugin command (hot-reload)
│   ├── eval.js
│   ├── exec.js
│   ├── help.js
│   ├── info.js
│   ├── memory.js
│   ├── ping.js
│   ├── restart.js
│   └── uptime.js
├── utils/
│   ├── format.js      # formatUptime, safeStringify
│   ├── jid.js         # Helper JID & deteksi owner
│   ├── logger.js      # Logger berwarna dengan tag
│   ├── mysqlAuthState.js  # Baileys auth state via MySQL
│   └── mysqlPool.js   # MySQL connection pool
├── handler.js         # Parser pesan & dispatch command
├── index.js           # Entry point, koneksi WA, reconnect
├── loader.js          # CommandRegistry & hot-reload watcher
├── server.js          # HTTP status server
├── .env.example
└── package.json
```

---

## Membuat Command Baru

Buat file `.js` baru di folder `commands/`. Bot akan otomatis memuatnya tanpa restart.

```js
// commands/hello.js
export default {
  name: 'hello',                        // string atau array ['hello', 'hi']
  description: 'Sapa pengguna',
  category: 'utility',                  // utility | fun | admin | info | media | moderation
  ownerOnly: false,                     // true = hanya owner
  scope: 'all',                         // all | group | private
  cooldown: 5,                          // detik, 0 = tidak ada cooldown
  hidden: false,                        // true = tidak muncul di /help

  async execute({ sock, msg, from, sender, args }) {
    await sock.sendMessage(from, { text: `Halo! Args: ${args}` }, { quoted: msg });
  },
};
```

### Context yang tersedia di `execute(ctx)`

| Property | Tipe | Keterangan |
|---|---|---|
| `sock` | WASocket | Instance koneksi Baileys |
| `msg` | WAMessage | Objek pesan lengkap |
| `from` | string | JID chat asal |
| `sender` | string | JID pengirim |
| `senderAlt` | string\|null | JID alternatif pengirim (LID) |
| `isOwner` | boolean | Apakah pengirim adalah owner |
| `text` | string | Teks pesan lengkap |
| `args` | string | Teks setelah nama command |
| `chatType` | string | `group` \| `private` \| `newsletter` \| `broadcast` |
| `version` | number[] | Versi WA yang digunakan |
| `pool` | Pool | MySQL connection pool |
| `registry` | CommandRegistry | Registry command aktif |

---

## Prefix Command

| Prefix | Contoh | Keterangan |
|---|---|---|
| `/` | `/ping` | Command biasa |
| `=> ` | `=> ctx.sock.user` | Alias untuk command `eval` |
| `$ ` | `$ ls -la` | Alias untuk command `exec` |

---

## HTTP Status Server

Bot menjalankan HTTP server (default port `3000`) dengan tiga endpoint:

| Endpoint | Keterangan |
|---|---|
| `GET /` | Status lengkap bot (sama dengan `/stats`) |
| `GET /health` | Health check ringkas |
| `GET /stats` | Statistik detail: koneksi, uptime, pesan, DB pool |

Contoh response `/health`:

```json
{
  "status": "ok",
  "connection": "open",
  "uptime": 3600,
  "timestamp": "2026-05-25T10:00:00.000Z"
}
```

---

## Command Bawaan

| Command | Kategori | Owner Only | Keterangan |
|---|---|---|---|
| `/ping` | utility | ❌ | Cek latensi bot |
| `/help [kategori]` | info | ❌ | Daftar command |
| `/info` | info | ❌ | Info bot (versi, uptime, memori) |
| `/memory` | info | ❌ | Detail penggunaan memori |
| `/uptime` | info | ❌ | Sudah berapa lama bot jalan |
| `/eval <kode>` | admin | ✅ | Jalankan kode JS di runtime bot |
| `/exec <perintah>` | admin | ✅ | Jalankan shell command di server |
| `/restart` | admin | ✅ | Restart bot |

---

## Lisensi

MIT — lihat [LICENSE](./LICENSE).
