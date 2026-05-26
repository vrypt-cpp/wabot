import { exec } from 'child_process';
import { promisify } from 'util';
import { createLogger } from '../../utils/logger.js';

const execAsync = promisify(exec);
const log = createLogger('CMD:EXEC');
const BLOCKED = /^\s*(rm\s+-rf|dd\s+if|mkfs|shutdown|reboot|halt|poweroff|:()\{.*\})/i;

export default {
  name: ['exec', '$'],
  description: 'Jalankan shell command di server bot',
  category: 'moderation',
  ownerOnly: true,
  scope: 'all',
  cooldown: 5,
  hidden: true,

  async execute({ sock, msg, from, sender, args }) {
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
