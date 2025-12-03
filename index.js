require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const { botUserHandlers } = require('./commands/user.js');


const token = process.env.BOT_TOKEN;
if (!token) throw new Error('BOT_TOKEN não definido no .env');


const PORT = process.env.PORT || 3000;
const SERVER_URL = process.env.SERVER_URL;
if (!SERVER_URL) throw new Error('SERVER_URL não definido no .env');


const bot = new TelegramBot(token);
bot.setWebHook(`${SERVER_URL}/bot${token}`);


const app = express();
app.use(express.json());


// Recebe updates do Telegram
app.post(`/bot${token}`, (req, res) => {
bot.processUpdate(req.body);
res.sendStatus(200);
});


// Inicializa handlers de usuário
botUserHandlers(bot);


app.get('/', (req, res) => res.send('Bot HBR online ✅'));


app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
