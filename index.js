require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { startWatchers } = require("./services/watchers");

// Comandos
require("./commands/tokenInfo");
require("./commands/welcome");
require("./commands/dropCommand");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log("🤖 Bot HueHueBR iniciado...");

// Inicia watchers
startWatchers(bot);
