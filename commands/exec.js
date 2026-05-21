import { exec } from 'child_process';
import { promisify } from 'util';
import { createLogger } from '../utils/logger.js';

const execAsync = promisify(exec);
const log = createLogger('CMD:EXEC');
const BLOCKED = /^\s*(rm\s+-rf|dd\s+if|mkfs|shutdown|reboot|halt|poweroff|:()\{.*\})/i;
const cooldowns = new Map();
const COOLDOWN_MS = 5_000;

export default {
  name: ['exec', '$'],
  description: 'Jalankan shell command',

  async execute({ sock, msg, from, sender, args }) {
    const now = Date.now();
    const last = cooldowns.get(sender) ?? 0;
    if (now - last < COOLDOWN_MS) {
      const remaining = ((COOLDOWN_MS - (now - last)) / 1000).toFixed(1);
      await sock.sendMessage(from, { text: `⏳ Cooldown: tunggu ${remaining}s lagi.` }, { quoted: msg });
      return;
    }

    const command = args;
    if (!command) {
      await sock.sendMessage(from, { text: '⚠️ Tidak ada command.' }, { quoted: msg });
      return;
    }

    if (BLOCKED.test(command)) {
      log.warn('Blocked command attempt', { sender, command });
      await sock.sendMessage(from, { text: '🚫 Command diblokir.' }, { quoted: msg });
      return;
    }

    cooldowns.set(sender, now);

    let result;
    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 10_000 });
      result = stdout || stderr || '(no output)';
    } catch (err) {
      result = `Error: ${err.message}`;
      log.error('exec error', { command, detail: err.message });
    }

    await sock.sendMessage(from, { text: `\`\`\`\n${result}\n\`\`\`` }, { quoted: msg });
  },
};
