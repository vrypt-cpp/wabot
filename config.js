export const config = {
  bot: {
    name: 'VryptBot',
    description: 'Simple WhatsApp bot built with @whiskeysockets/baileys, lightweight, and customizable automation using Node.js.',
    phoneNumber: process.env.PHONE_NUMBER || '67073454525',
    ownerNumber: process.env.OWNER_NUMBER
      ? process.env.OWNER_NUMBER.split(',').map(n => n.trim())
      : ['67073454525', '62882005514880', '6285185985868'],
    defaultCooldown: 3,
  },
  settings: {
    prefix: ['.', '#', '/', '&'],
    autoRead: true,
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
