// index.js
require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

const storage = require("./services/storage.js");
const { botRegisterHandlers } = require("./commands/registrar.js");
const { botAdminHandlers } = require("./commands/admin.js");
const { botUserHandlers } = require("./commands/user.js");
const { startDropper } = require("./services/dropper.js");

(async () => {

  console.log("=============================================");
  console.log(" 🤖 HueHueBR Airdrop Bot — Inicializando...");
  console.log("=============================================\n");

  /* ==========================================================
     ENV VALIDATION
  ========================================================== */
  const BOT_TOKEN = process.env.BOT_TOKEN_DROP;
  const SERVER_URL = process.env.SERVER_URL;

  if (!BOT_TOKEN) {
    console.error("❌ ERRO FATAL: BOT_TOKEN_DROP não encontrado no .env");
    process.exit(1);
  }

  if (!SERVER_URL) {
    console.error("❌ ERRO FATAL: SERVER_URL não encontrado no .env");
    process.exit(1);
  }

  /* ==========================================================
     DATABASE READY
  ========================================================== */
  console.log("🗄  Validando banco de dados...");
  await storage.ensure();
  console.log("✅ Banco de dados OK!\n");


  /* ==========================================================
     BOT + WEBHOOK
  ========================================================== */
  console.log("🔗 Configurando webhook do Telegram...");

  const bot = new TelegramBot(BOT_TOKEN, { webHook: {} });
  const webhookUrl = `${SERVER_URL}/webhook/${BOT_TOKEN}`;

  try {
    await bot.setWebHook(webhookUrl);
    console.log(`📡 Webhook conectado:\n➡ ${webhookUrl}\n`);
  } catch (err) {
    console.error("❌ Falha ao configurar webhook:", err);
  }

  /* ==========================================================
     HANDLERS
  ========================================================== */
  console.log("📚 Carregando comandos...");

  botRegisterHandlers(bot);
  botAdminHandlers(bot);
  botUserHandlers(bot);

  console.log("✅ Handlers carregados!\n");


  /* ==========================================================
     START DROPPER
  ========================================================== */
  console.log("💸 Iniciando sistema de drops automáticos...");
  await startDropper(bot);
  console.log("🚀 Dropper iniciado!\n");


  /* ==========================================================
     DAILY RESET SYSTEM
  ========================================================== */
  let lastResetDay = new Date().toISOString().slice(0, 10);

  console.log("🕛 Sistema de reset diário ativado.");

  setInterval(async () => {
    const today = new Date().toISOString().slice(0, 10);

    if (today !== lastResetDay) {
      console.log("\n🔄 Executando reset diário...");

      try {
        await storage.resetDailyTotals();
        lastResetDay = today;

        const GROUP_ID = process.env.GROUP_ID;
        if (GROUP_ID) {
          await bot.sendMessage(
            GROUP_ID,
            `🕛 *Reset Diário!*\n\nOs limites e o contador de ganhos foram reiniciados.\nBoa sorte nos próximos drops! 🚀`,
            { parse_mode: "Markdown" }
          );
        }

        console.log("✅ Reset diário concluído!");
      } catch (err) {
        console.error("❌ Erro no reset diário:", err);
      }
    }
  }, 60 * 1000);


  /* ==========================================================
     EXPRESS WEBHOOK SERVER 
  ========================================================== */
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  app.post(`/webhook/${BOT_TOKEN}`, (req, res) => {
    try {
      bot.processUpdate(req.body);
      return res.sendStatus(200);
    } catch (err) {
      console.error("❌ Erro no handler do webhook:", err);
      return res.sendStatus(500);
    }
  });

  app.get("/", (req, res) =>
    res.json({ 
      status: "ok",
      bot: "HueHueBR Airdrop Bot",
      webhook: webhookUrl
    })
  );

  app.listen(PORT, () =>
    console.log(`🌐 Servidor HTTP ativo!\n➡ Porta: ${PORT}\n`)
  );

  console.log("🎉 Bot iniciado com sucesso!");
  console.log("=============================================");
  console.log("  Tudo pronto! DROP SYSTEM ONLINE 🔥");
  console.log("=============================================\n");

})();
