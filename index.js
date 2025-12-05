// index.js
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const path = require('path');

const storage = require('./services/storage');
const { botRegisterHandlers } = require('./commands/registrar');
const { botAdminHandlers } = require('./commands/admin');
const { botUserHandlers } = require('./commands/user');
const { startDropper } = require('./services/dropper');

(async () => {
  // env checks
  const BOT_TOKEN = process.env.BOT_TOKEN_DROP;
  if (!BOT_TOKEN) { console.error("❌ Missing BOT_TOKEN_DROP"); process.exit(1); }
  const SERVER_URL = process.env.SERVER_URL;
  if (!SERVER_URL) { console.error("❌ Missing SERVER_URL"); process.exit(1); }

  // ensure DB and tables
  await storage.ensure();

  // create bot with webhook
  const bot = new TelegramBot(BOT_TOKEN, { webHook: {} });
  const webhookUrl = `${SERVER_URL}/webhook/${BOT_TOKEN}`;
  try {
    await bot.setWebHook(webhookUrl);
    console.log("📡 Webhook configured:", webhookUrl);
  } catch (err) {
    console.error("❌ Failed to set webhook:", err);
  }

  // register handlers
  botRegisterHandlers(bot);
  botAdminHandlers(bot);
  botUserHandlers(bot);

  // start dropper
  await startDropper(bot);

  // daily reset
  let lastResetDay = Math.floor(Date.now()/(24*3600));
  setInterval(async () => {
    const today = Math.floor(Date.now()/(24*3600));
    if (today !== lastResetDay) {
      console.log('Running daily reset');
      try {
        await storage.resetDailyTotals();
        lastResetDay = today;
        const GROUP_ID = process.env.GROUP_ID;
        if (GROUP_ID) {
          await bot.sendMessage(GROUP_ID, `🕛 *Reset Diário*: limites e total diário reiniciados. Boa sorte!`, { parse_mode:'Markdown' });
        }
      } catch (e) {
        console.error('daily reset error', e);
      }
    }
  }, 60 * 1000);

  // express server for webhook
  const app = express();
  app.use(express.json());
  app.post(`/webhook/${BOT_TOKEN}`, (req, res) => {
    try {
      bot.processUpdate(req.body);
      return res.sendStatus(200);
    } catch (err) {
      console.error("❌ Error inside webhook handler:", err);
      return res.sendStatus(500);
    }
  });

  app.get('/', (req,res) => res.json({ ok:true, bot: 'HueHueBR Airdrop Bot', webhook: webhookUrl }));
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`🚀 HTTP server listening on port ${PORT}`));
  console.log("🤖 HueHueBR Drop Bot started successfully!");
})();
