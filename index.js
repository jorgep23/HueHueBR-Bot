require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const path = require('path');
const { startDropper } = require('./services/dropper');
const { botRegisterHandlers } = require('./commands/registrar');
const { botAdminHandlers } = require('./commands/admin');
const { botUserHandlers } = require('./commands/user');
const storage = require('./services/storage');

// =====================================
// ENV VALIDATION
// =====================================
const BOT_TOKEN = process.env.BOT_TOKEN_DROP;
if (!BOT_TOKEN) {
  console.error("❌ ERROR: Missing BOT_TOKEN_DROP");
  process.exit(1);
}

const SERVER_URL = process.env.SERVER_URL;
if (!SERVER_URL) {
  console.error("❌ ERROR: Missing SERVER_URL");
  process.exit(1);
}

const ADMIN_ID = process.env.ADMIN_ID;
const GROUP_ID = process.env.GROUP_ID || null;

// =====================================
// TELEGRAM BOT VIA WEBHOOK
// =====================================
const bot = new TelegramBot(BOT_TOKEN, { webHook: true });

// webhook URL: SERVER_URL/webhook/<TOKEN>
const webhookUrl = `${SERVER_URL}/webhook/${BOT_TOKEN}`;
bot.setWebHook(webhookUrl);

console.log("📡 Webhook set to:", webhookUrl);

// expose bot to modules
module.exports.bot = bot;

// =====================================
// DATABASE INIT
// =====================================
storage.ensure();

// =====================================
// REGISTER BOT HANDLERS
// =====================================
botRegisterHandlers(bot);
botAdminHandlers(bot);
botUserHandlers(bot);

// =====================================
// DROPPER SERVICE (AIRDR0P ENGINE)
// =====================================
startDropper(bot).catch(e => console.error("dropper error", e));

// =====================================
// EXPRESS SERVER FOR WEBHOOK & HEALTH
// =====================================
const app = express();
app.use(express.json());

// Telegram WebHook endpoint
app.post(`/webhook/${BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Health-check (Railway)
app.get('/', (req, res) => res.json({ ok: true, bot: "HueHueBR Airdrop Bot" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 HTTP server listening on port ${PORT}`);
});

console.log("🤖 HueHueBR Drop Bot started successfully!");
