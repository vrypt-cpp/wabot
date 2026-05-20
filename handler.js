import { exec } from 'child_process';
import { promisify } from 'util';
import { formatUptime, safeStringify } from './utils/format.js';
import {
  getChatType,
  getSender,
  getSenderAlt,
  isFromOwner,
  getPhoneNumber,
} from './utils/jid.js';

const execAsync = promisify(exec);

export async function handleMessage(sock, msg, version, pool) {
  if (!msg.message) return;

  const from = msg.key.remoteJid;
  const text = msg.message.conversation ?? msg.message.extendedTextMessage?.text ?? '';
  const chatType = getChatType(from);
  const sender = getSender(msg);
  const senderAlt = getSenderAlt(msg);
  const isOwner = isFromOwner(sender, senderAlt);

  if (chatType === 'group') {
    console.log(`[GROUP] ${from} | sender: ${sender} | senderAlt: ${senderAlt} | isOwner: ${isOwner}`);
  } else if (chatType === 'private') {
    const mode = msg.key.addressingMode || 'pn';
    console.log(`[PRIVATE (${mode})] sender: ${sender} | alt: ${senderAlt} | isOwner: ${isOwner}`);
  } else if (chatType === 'newsletter') {
    console.log(`[NEWSLETTER] ${from}`);
  } else if (chatType === 'broadcast') {
    console.log(`[BROADCAST] ${from}`);
  } else {
    console.log(`[UNKNOWN] ${from}`);
  }

  if (!isOwner) return;

  if (text.toLowerCase() === '/invite' && chatType === 'private') {
    const inviteExpiration = String(Math.floor(Date.now() / 1000) + 604800);
    await sock.relayMessage(from, {
      newsletterAdminInviteMessage: {
        newsletterJid: '120363411786163149@newsletter',
        newsletterName: 'Yapink Universe',
        caption: "Accept this invitation to be an admin for my WhatsApp channel, 'tes'",
        inviteExpiration
      }
    }, { messageId: sock.generateMessageTag() });
    return;
  }

  if (text.startsWith('/eval ') || text.startsWith('=> ')) {
    const code = text.startsWith('=> ') ? text.slice(3).trim() : text.slice(6).trim();
    let result;
    try {
      const fn = new Function(
        'sock', 'msg', 'from', 'sender', 'senderAlt', 'pool',
        'getChatType', 'getSender', 'getSenderAlt', 'isFromOwner', 'getPhoneNumber',
        `return (async () => { try { return await eval(${JSON.stringify(code)}) } catch(e) { throw e } })()`
      );
      result = await fn(sock, msg, from, sender, senderAlt, pool, getChatType, getSender, getSenderAlt, isFromOwner, getPhoneNumber);

      if (result === undefined) result = 'undefined';
      else if (result === null) result = 'null';
      else if (typeof result === 'object') {
        try { result = JSON.stringify(result, null, 2); }
        catch { result = safeStringify(result); }
      } else {
        result = String(result);
      }
    } catch (err) {
      result = `Error: ${err.message}`;
    }
    await sock.sendMessage(from, { text: `\`\`\`\n${result}\n\`\`\`` }, { quoted: msg });
    return;
  }

  if (text.startsWith('/exec ') || text.startsWith('$ ')) {
    const command = text.startsWith('$ ') ? text.slice(2).trim() : text.slice(6).trim();
    let result;
    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 10000 });
      result = stdout || stderr || '(no output)';
    } catch (err) {
      result = `Error: ${err.message}`;
    }
    await sock.sendMessage(from, { text: `\`\`\`\n${result}\n\`\`\`` }, { quoted: msg });
    return;
  }

  if (text.toLowerCase() === '/uptime') {
    await sock.sendMessage(from, {
      text: `⏱ Uptime: ${formatUptime(process.uptime())}`
    }, { quoted: msg });
    return;
  }

  if (text.toLowerCase() === '/ping') {
    const pingStart = Date.now();
    await sock.sendMessage(from, { text: '🏓 Pong!' }, { quoted: msg });
    const latency = Date.now() - pingStart;
    await sock.sendMessage(from, { text: `🏓 Pong! ${latency}ms` }, { quoted: msg });
    return;
  }

  if (text.toLowerCase() === '/info') {
    const info = [
      `🤖 Bot Info`,
      `├ JID     : ${sock.user?.id}`,
      `├ Name    : ${sock.user?.name}`,
      `├ Version : ${version.join('.')}`,
      `├ Uptime  : ${formatUptime(process.uptime())}`,
      `├ Memory  : ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
      `└ Node    : ${process.version}`
    ].join('\n');
    await sock.sendMessage(from, { text: info }, { quoted: msg });
    return;
  }

  if (text.toLowerCase() === '/restart') {
    await sock.sendMessage(from, { text: '🔄 Restarting...' }, { quoted: msg });
    process.exit(0);
  }

  if (text.toLowerCase() === '/memory') {
    const mem = process.memoryUsage();
    const info = [
      `🧠 Memory Usage`,
      `├ RSS       : ${(mem.rss / 1024 / 1024).toFixed(2)} MB`,
      `├ Heap Used : ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      `├ Heap Total: ${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      `└ External  : ${(mem.external / 1024 / 1024).toFixed(2)} MB`
    ].join('\n');
    await sock.sendMessage(from, { text: info }, { quoted: msg });
    return;
  }

  if (text.toLowerCase() === '/help') {
    const help = [
      `📋 Self Commands`,
      `├ /uptime        - Uptime bot`,
      `├ /ping          - Latency bot`,
      `├ /info          - Info lengkap bot`,
      `├ /memory        - Memory usage`,
      `├ /restart       - Restart bot`,
      `├ /eval | =>     - Jalankan kode JS`,
      `├ /exec | $      - Jalankan shell command`,
      `└ /invite        - Kirim invite newsletter`
    ].join('\n');
    await sock.sendMessage(from, { text: help }, { quoted: msg });
    return;
  }

  console.log(JSON.stringify(msg, null, 2));
}
