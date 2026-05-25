export const config = {
  bot: {
    name: 'VryptBot',
    description: 'Simple WhatsApp bot built with @whiskeysockets/baileys, lightweight, and customizable automation using Node.js.',
    phoneNumber: process.env.PHONE_NUMBER || '67073454525',
    ownerNumber: process.env.OWNER_NUMBER || ["67073454525", "62882005514880", "6285185985868"],
    defaultCooldown: 3000 // 3s
  },
  settings: {
    prefix: ['.', '#', '/', '&'],
    title: 'VryptBot || automation WhatsApp bot',
    body: 'Simple modern WhatsApp bot powered by Baileys.',
    footer: 'copyright © 2026 VryptDev',
    defaultLink: 'https://github.com/vrypt-cpp'
  }
}