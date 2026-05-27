import { config } from '../config.js'

export async function reply(sock, message, msg, options = {}) {
  if (!sock)               throw new TypeError('[reply] "sock" wajib diisi.')
  if (!message)            throw new TypeError('[reply] "message" wajib diisi.')
  if (!msg?.key?.remoteJid) throw new TypeError('[reply] "msg" tidak valid atau tidak memiliki remoteJid.')

  const {
    participant      = '0@s.whatsapp.net',
    forwardingScore  = 999999,
    isForwarded      = true,
    businessOwnerJid = '0@s.whatsapp.net',
    newsletterJid    = '120363321038123456@newsletter',
    serverMessageId  = 1,
    newsletterName   = config.settings.newsletterName ?? 'Vrypt Bot Updates',
    expiration       = 86400,
    trustBannerType  = 'E2E_ENCRYPTED',
    trustBannerAction = 1,
    isSampled        = true,
  } = options

  const from = msg.key.remoteJid

  try {
    const sent = await sock.sendMessage(from, {
      text: message,
      contextInfo: {
        participant,
        forwardingScore,
        isForwarded,

        quotedMessage: {
          conversation: config.settings.body,
        },

        businessMessageForwardInfo: {
          businessOwnerJid,
        },

        forwardedNewsletterMessageInfo: {
          newsletterJid,
          serverMessageId,
          newsletterName,
        },

        expiration,
        ephemeralSettingTimestamp: Math.floor(Date.now() / 1000),

        trustBannerType,
        trustBannerAction,

        isSampled,
      },
    })

    return sent
  } catch (err) {
    throw new Error(`[reply] Gagal mengirim pesan ke ${from}: ${err.message}`)
  }
}
