export const config = {
  bot: {
    name: 'VryptBot',
    description: 'Simple WhatsApp bot built with @whiskeysockets/baileys, lightweight, and customizable automation using Node.js.',
    phoneNumber: process.env.PHONE_NUMBER || '',
    ownerNumber: process.env.OWNER_NUMBER
      ? process.env.OWNER_NUMBER.split(',').map(n => n.trim())
      : [],
  },
  settings: {
    defaultCooldown: 3,
    sessionName: 'session-1',
    prefix: ['.', '#', '/', '&'],
    customPairing: {
      enable: true,
      code: 'VRYPTBOT',
    },
    autoRead: true,
    warmUp: true,
    markOnline: true,
    title: 'VryptBot || automation WhatsApp bot',
    body: 'Simple modern WhatsApp bot powered by Baileys.',
    footer: 'copyright © 2026 VryptDev',
    defaultLink: 'https://github.com/vrypt-cpp',
  },
  reconnect: {
    maxRetries: 10,
    baseDelay: 3000,
    maxDelay: 60000,
    backoffMultiplier: 2,
  },
  server: {
    port: Number(process.env.PORT) || 3000,
  },
};
