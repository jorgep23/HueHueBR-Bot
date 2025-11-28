// index.js
require("dotenv").config();
const fs = require("fs");
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

const { ensureFiles } = require("./utils/files");
const { getPrice } = require("./services/price");
const { sendDrop } = require("./services/drop");
const { randomMeme } = require("./services/humor");
const { canReceive, increment } = require("./utils/limits");
const { startWatchers } = require("./services/watchers");

ensureFiles();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const app = express();

const DATA_USERS = "./data/users.json";
const DATA_INVITES = "./data/invites.json";

// ---------- Comando: /registrar <carteira>
bot.onText(/\/registrar (.+)/, (msg, match) => {
  try {
    const wallet = match[1].trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return bot.sendMessage(msg.chat.id, "❌ Endereço inválido. Envie uma carteira BNB (começando com 0x).");
    }

    const users = JSON.parse(fs.readFileSync(DATA_USERS));
    users[String(msg.from.id)] = wallet;
    fs.writeFileSync(DATA_USERS, JSON.stringify(users, null, 2));

    bot.sendMessage(msg.chat.id, `✅ Carteira registrada com sucesso!\n\n${wallet}`);
  } catch (e) {
    console.error(e);
    bot.sendMessage(msg.chat.id, "⚠ Erro ao registrar carteira.");
  }
});

// ---------- Comando: /hbr (painel do token)
bot.onText(/\/hbr/, async (msg) => {
  const chatId = msg.chat.id;
  const price = await getPrice();
  bot.sendMessage(
    chatId,
    `📊 *Painel HueHueBR (HBR)*\n\n` +
      `💰 Preço: US$ *${price.usd}*\n` +
      `💵 Preço BRL: R$ *${price.brl}*\n` +
      `📈 MarketCap: *${price.mc}*\n` +
      `💧 Liquidez: *${price.liq}*\n` +
      `👥 Holders: *${price.holders}*`,
    { parse_mode: "Markdown" }
  );
});

// ---------- Comando: /preco (apenas preço rápido)
bot.onText(/\/preco/, async (msg) => {
  const chatId = msg.chat.id;
  const price = await getPrice();
  bot.sendMessage(chatId, `💰 HBR: US$ ${price.usd} | R$ ${price.brl}`);
});

// ---------- Comando: /meme
bot.onText(/\/meme/, (msg) => {
  bot.sendPhoto(msg.chat.id, randomMeme());
});

// ---------- Comando admin: /drop <quantia>
// Observação: ADMIN_ID no .env deve ser seu Telegram user id (número)
bot.onText(/\/drop (.+)/, async (msg, match) => {
  try {
    if (String(msg.from.id) !== String(process.env.ADMIN_ID)) return;
    const amount = Number(match[1]);
    if (isNaN(amount) || amount <= 0) return bot.sendMessage(msg.chat.id, "❌ Use: /drop 1 (quantia em tokens inteiros)");

    // envia drop (o sendDrop verifica limites)
    const result = await sendDrop(amount);
    if (result.error) {
      return bot.sendMessage(msg.chat.id, `⚠ Erro: ${result.error}`);
    }

    // após enviar, incrementamos limite (sendDrop já fez, mas mantemos segurança)
    increment(result.sorteado);

    bot.sendMessage(
      msg.chat.id,
      `🎉 *DROP ENVIADO!* \n\n👤 Usuario: [link](tg://user?id=${result.sorteado})\n💳 Carteira: \`${result.wallet}\`\n💰 Quantia: *${amount} HBR*\n🔗 Tx: \`${result.txHash}\``,
      { parse_mode: "Markdown" }
    );
  } catch (e) {
    console.error(e);
    bot.sendMessage(msg.chat.id, "⚠ Erro interno ao processar /drop.");
  }
});

// ---------- Evento: new_chat_members (drop por convite + boas-vindas)
bot.on("new_chat_members", async (msg) => {
  try {
    // message.from é quem adicionou (convidador) em alguns casos de bots; cuidado: comportamento depende de como são adicionados
    const inviterId = msg.from && msg.from.id ? String(msg.from.id) : null;

    // boas-vindas para cada novo membro
    for (const member of msg.new_chat_members) {
      bot.sendMessage(msg.chat.id, `👋 Bem-vindo, ${member.first_name}!\nUse /registrar SUA_CARTEIRA para participar dos drops!`);

      // se o novo membro já tiver registrado carteira e o convidador existir, damos drop ao convidador
      if (inviterId) {
        // atualizar invites count
        const invites = JSON.parse(fs.readFileSync(DATA_INVITES));
        invites[inviterId] = (invites[inviterId] || 0) + 1;
        fs.writeFileSync(DATA_INVITES, JSON.stringify(invites, null, 2));

        // recompensa por convite (se o convidador ainda puder receber)
        if (canReceive(inviterId)) {
          const drop = await sendDrop(1); // 1 HBR por convite
          if (!drop.error) {
            increment(inviterId);
            bot.sendMessage(msg.chat.id, `🎉 *DROP POR CONVITE!*\n${msg.from.first_name} recebeu +1 HBR\nTx: \`${drop.txHash}\``, {
              parse_mode: "Markdown"
            });
          }
        }
      }
    }
  } catch (e) {
    console.error("new_chat_members error:", e);
  }
});

// ---------- Start watchers (pump/queda/etc)
startWatchers(bot);

// ---------- express health (opcional para hospedagem)
app.get("/", (req, res) => res.send("HueHueBR Bot rodando"));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Bot rodando na porta ${port}`));
