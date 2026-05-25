# wabot

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?style=flat-square&logo=node.js&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-supported-4479A1?style=flat-square&logo=mysql&logoColor=white)
![Baileys](https://img.shields.io/badge/Baileys-7.x-25D366?style=flat-square&logo=whatsapp&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)
![ESM](https://img.shields.io/badge/Module-ESM-blueviolet?style=flat-square)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)

A lightweight WhatsApp bot built on [Baileys](https://github.com/WhiskeySockets/Baileys) with MySQL session storage, hot-reload plugins, and a built-in HTTP status server.

---

## Features

- **Pairing code** — log in without scanning a QR code
- **MySQL session** — session is persisted in the database and survives restarts
- **Hot-reload plugins** — add, edit, or remove commands without restarting the bot
- **Command registry** — automatic validation, cooldowns, scope (all/group/private), ownerOnly flag
- **Auto-reconnect** — exponential backoff with up to 10 retry attempts
- **HTTP status server** — `/`, `/health`, and `/stats` endpoints for monitoring
- **Multi-message-type support** — commands from plain text, image/video/document captions, button replies, and list responses

---

## Requirements

- Node.js >= 18
- MySQL / MariaDB
- npm

---

## Installation

```bash
git clone https://github.com/vrypt-cpp/wabot.git
cd wabot
npm install
```

Copy the environment file:

```bash
cp .env.example .env
```

Fill in `.env` with your configuration (see [Configuration](#configuration) below).

---

## Configuration

Edit `.env`:

```env
# MySQL
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=wabot
MYSQL_USER=root
MYSQL_PASSWORD=password

# Bot
OWNER_NUMBER=628xxxxxxxxxx   # owner phone number without + (e.g. 6281234567890)
PHONE_NUMBER=628xxxxxxxxxx   # phone number the bot will use

# HTTP Server
PORT=3000
```

> **Important:** `OWNER_NUMBER` and `PHONE_NUMBER` are required. The bot will exit on startup if either is missing.

---

## Running the Bot

```bash
npm start
```

On first run, the bot prints a **pairing code** in the terminal:

```
[INFO] [WA] PAIRING CODE: ABCD-1234
```

Enter that code in WhatsApp → Linked Devices → Link a Device → Link with phone number.

---

## Project Structure

```
wabot/
├── commands/              # Command plugins (hot-reload)
│   ├── eval.js
│   ├── exec.js
│   ├── help.js
│   ├── info.js
│   ├── memory.js
│   ├── ping.js
│   ├── restart.js
│   └── uptime.js
├── utils/
│   ├── format.js          # formatUptime, safeStringify
│   ├── jid.js             # JID helpers & owner detection
│   ├── logger.js          # Colored tagged logger
│   ├── mysqlAuthState.js  # Baileys auth state backed by MySQL
│   └── mysqlPool.js       # MySQL connection pool
├── handler.js             # Message parser & command dispatcher
├── index.js               # Entry point, WA connection, reconnect logic
├── loader.js              # CommandRegistry & hot-reload watcher
├── server.js              # HTTP status server
├── .env.example
└── package.json
```

---

## Writing a Command

Create a new `.js` file inside the `commands/` folder. The bot will load it automatically without a restart.

```js
// commands/hello.js
export default {
  name: 'hello',          // string or array: ['hello', 'hi']
  description: 'Greet the user',
  category: 'utility',   // utility | fun | admin | info | media | moderation
  ownerOnly: false,       // true = owner only
  scope: 'all',           // all | group | private
  cooldown: 5,            // seconds; 0 = no cooldown
  hidden: false,          // true = hidden from /help

  async execute({ sock, msg, from, sender, args }) {
    await sock.sendMessage(from, { text: `Hello! Args: ${args}` }, { quoted: msg });
  },
};
```

### Available context properties in `execute(ctx)`

| Property | Type | Description |
|---|---|---|
| `sock` | WASocket | Active Baileys socket instance |
| `msg` | WAMessage | Full incoming message object |
| `from` | string | Chat JID the message came from |
| `sender` | string | Sender's JID |
| `senderAlt` | string\|null | Alternative sender JID (LID) |
| `isOwner` | boolean | Whether the sender is the bot owner |
| `text` | string | Full message text |
| `args` | string | Text after the command name |
| `chatType` | string | `group` \| `private` \| `newsletter` \| `broadcast` |
| `version` | number[] | WhatsApp version in use |
| `pool` | Pool | MySQL connection pool |
| `registry` | CommandRegistry | Active command registry |

---

## Command Prefixes

| Prefix | Example | Notes |
|---|---|---|
| `/` | `/ping` | Standard command trigger |
| `=> ` | `=> sock.user` | Shorthand alias for `eval` |
| `$ ` | `$ ls -la` | Shorthand alias for `exec` |

---

## HTTP Status Server

The bot starts an HTTP server (default port `3000`) with three endpoints:

| Endpoint | Description |
|---|---|
| `GET /` | Full bot status (identical to `/stats`) |
| `GET /health` | Lightweight health check |
| `GET /stats` | Detailed stats: connection, uptime, messages, DB pool |

Example `/health` response:

```json
{
  "status": "ok",
  "connection": "open",
  "uptime": 3600,
  "timestamp": "2026-05-25T10:00:00.000Z"
}
```

---

## Built-in Commands

| Command | Category | Owner Only | Description |
|---|---|---|---|
| `/ping` | utility | ❌ | Check bot response latency |
| `/help [category]` | info | ❌ | List available commands |
| `/info` | info | ❌ | Bot info (version, uptime, memory) |
| `/memory` | info | ❌ | Detailed memory usage |
| `/uptime` | info | ❌ | How long the bot has been running |
| `/eval <code>` | admin | ✅ | Execute arbitrary JS in the bot runtime |
| `/exec <command>` | admin | ✅ | Run a shell command on the server |
| `/restart` | admin | ✅ | Restart the bot process |

---

## License

MIT — see [LICENSE](./LICENSE).
