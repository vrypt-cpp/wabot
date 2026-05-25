import { safeStringify } from '../utils/format.js';
import {
  getChatType, getSender, getSenderAlt,
  isFromOwner, getPhoneNumber,
} from '../utils/jid.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('CMD:EVAL');

export default {
  name: ['eval', '=>'],
  description: 'Jalankan kode JS arbitrary di runtime bot',
  category: 'admin',
  ownerOnly: true,
  scope: 'all',
  cooldown: 3,
  hidden: true,

  async execute({ sock, msg, from, sender, senderAlt, args, pool }) {
    const code = args;
    if (!code) {
      await sock.sendMessage(from, { text: '⚠️ Tidak ada kode.' }, { quoted: msg });
      return;
    }

    let result;
    try {
      const fn = new Function(
        'sock', 'msg', 'from', 'sender', 'senderAlt', 'pool',
        'getChatType', 'getSender', 'getSenderAlt', 'isFromOwner', 'getPhoneNumber',
        `return (async () => { try { return await eval(${JSON.stringify(code)}) } catch(e) { throw e } })()`
      );
      result = await fn(
        sock, msg, from, sender, senderAlt, pool,
        getChatType, getSender, getSenderAlt, isFromOwner, getPhoneNumber
      );

      if (result === undefined)           result = 'undefined';
      else if (result === null)           result = 'null';
      else if (typeof result === 'object') {
        try { result = JSON.stringify(result, null, 2); }
        catch { result = safeStringify(result); }
      } else {
        result = String(result);
      }
    } catch (err) {
      result = `Error: ${err.message}`;
      log.error('eval error', { detail: err.message });
    }

    await sock.sendMessage(from, {
      text: `\`\`\`\n${result}\n\`\`\``
    }, { quoted: msg });
  },
};
