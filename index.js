require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const path = require('path');
const { startDropper } = require('./services/dropper');
const { botRegisterHandlers } = require('./commands/registrar');
const { botAdminHandlers } = require('./commands/admin');
const { botUserHandlers } = require('./commands/user');
const storage = require('./services/storage');

const BOT_TOKEN = process.env.BOT_TOKEN_DROP;
if (!BOT_TOKEN) {
  console.error('Missing BOT_TOKEN_DROP in env. Exiting.');
  process.exit(1);


const SERVER_URL = process.env.SERVER_URL;
if (!SERVER_URL) {
  console.error("❌ ERROR: SERVER_URL is missing!");
  process.exit(1);
}
}
const ADMIN_ID = process.env.ADMIN_ID;
const GROUP_ID = process.env.GROUP_ID || null;

const bot = new TelegramBot(TOKEN, { webHook: { } });
bot.setWebHook(`${process.env.SERVER_URL}/webhook/${BOT_TOKEN}`);

// expose bot to command modules
module.exports.bot = bot;

// ensure DB exists
storage.ensure();

// register handlers
botRegisterHandlers(bot);
botAdminHandlers(bot);
botUserHandlers(bot);

// start dropper service
startDropper(bot).catch(e => console.error('dropper error', e));

// simple http server for health & railway
const app = express();
app.get('/', (req,res) => res.json({ ok:true }));
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log('HTTP server listening on', PORT));
console.log('🤖 HueHueBR Drop Bot started.');
