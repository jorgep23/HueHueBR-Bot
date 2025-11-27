require("dotenv").config();
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const { startAlerts } = require("./utils/alerts");
const { web3, nftContract, pairContract } = require("./utils/web3");

const app = express();

// ============================
// VARIÁVEIS DO .env
// ============================
const TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.OWNER_CHAT_ID;

if (!TOKEN) {
    console.error("❌ BOT_TOKEN não configurado no .env");
    process.exit(1);
}

if (!CHAT_ID) {
    console.error("❌ CHAT_ID não configurado no .env");
    process.exit(1);
}

// ============================
// BOT EM MODO POLLING
// ============================
const bot = new TelegramBot(TOKEN, {
    polling: {
        interval: 300,
        autoStart: true
    }
});

console.log("🤖 Bot iniciado em modo POLLING...");

// Mensagem padrão
bot.on("message", (msg) => {
    //bot.sendMessage(msg.chat.id, "Bot está rodando! Monitoramento ativo.");
});

// ============================
// ALERTS AUTOMÁTICOS (CORRETO)
// ============================
startAlerts(bot, CHAT_ID);

console.log("📡 Alerts started");

// ===============================
//       COMMAND: /start
// ===============================
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(
        msg.chat.id,
        `👋 Bem-vindo ao *HueHueBR Bot*!

Funções disponíveis:
/price – Ver preço do HBR
/tokeninfo – Infos do token
/nftinfo – Infos dos NFTs
/mint – Mint de NFTs
/buy – Como comprar
/help – Ajuda`,
        { parse_mode: "Markdown" }
    );
});

// ===============================
//       COMMAND: /price  (substituir)
// ===============================
bot.onText(/\/price/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    // endereços
    const HBR = (process.env.TOKEN_CONTRACT || "").toLowerCase();
    const pairAddr = (process.env.PAIR_CONTRACT || "").toLowerCase();
    if (!HBR || !pairAddr) {
      return bot.sendMessage(chatId, "Erro: TOKEN_CONTRACT ou PAIR_CONTRACT não configurado.");
    }

    // pega reserves e token0/token1
    const [reserves, token0, token1] = await Promise.all([
      pairContract.methods.getReserves().call(),
      pairContract.methods.token0().call(),
      pairContract.methods.token1().call()
    ]);

    // reserves vem como strings (uint112)
    const reserve0 = reserves._reserve0;
    const reserve1 = reserves._reserve1;

    // converte para BN -> depois para float via fromWei (assumindo 18 decimais)
    const reserve0Float = parseFloat(web3.utils.fromWei(reserve0.toString(), "ether"));
    const reserve1Float = parseFloat(web3.utils.fromWei(reserve1.toString(), "ether"));

    let reserveHBR, reserveWBNB;
    // identifica qual reserve é HBR
    if (token0.toLowerCase() === HBR) {
      reserveHBR = reserve0Float;
      reserveWBNB = reserve1Float;
    } else if (token1.toLowerCase() === HBR) {
      reserveHBR = reserve1Float;
      reserveWBNB = reserve0Float;
    } else {
      // token HBR não está na pair informada
      return bot.sendMessage(chatId, "Erro: token HBR não encontrado na pair configurada.");
    }

    // evita divisão por zero
    if (reserveHBR === 0 || reserveWBNB === 0) {
      return bot.sendMessage(chatId, "Erro: liquidez insuficiente na pool.");
    }

    // calcula preços
    const bnbPerHbr = reserveWBNB / reserveHBR; // BNB por 1 HBR
    const hbrPerBnb = reserveHBR / reserveWBNB; // HBR por 1 BNB

    // formatação
    const bnbPerHbrStr = bnbPerHbr.toFixed(12).replace(/\.?0+$/, "");
    const hbrPerBnbStr = hbrPerBnb.toFixed(6).replace(/\.?0+$/, "");

    await bot.sendMessage(
      chatId,
      `💰 *Preço HBR / WBNB*\n\n1 HBR ≈ *${bnbPerHbrStr}* BNB\n1 BNB ≈ *${hbrPerBnbStr}* HBR\n\nPair: \`${process.env.PAIR_CONTRACT}\``,
      { parse_mode: "Markdown" }
    );
  } catch (err) {
    console.error("Erro no /price:", err && err.message ? err.message : err);
    // envia mensagem amigável pro usuário
    bot.sendMessage(chatId, "Erro ao buscar preço da pool. Verifique RPC, endereço da pair e logs do servidor.");
  }
});

// ===============================
// COMMAND: /tokeninfo
// ===============================
bot.onText(/\/tokeninfo/, (msg) => {
    bot.sendMessage(
        msg.chat.id,
        `📘 *Token HueHueBR (HBR)*  
Contrato: \`${process.env.TOKEN_CONTRACT}\`
Rede: BSC  
Supply: 100.000.000 HBR  
Par: HBR/WBNB  

Use /price para ver o preço atual.`,
        { parse_mode: "Markdown" }
    );
});

// ===============================
// COMMAND: /nftinfo
// ===============================
bot.onText(/\/nftinfo/, async (msg) => {
    try {
        const total = await nftContract.methods.totalSupply().call();

        bot.sendMessage(
            msg.chat.id,
            `🖼 *HueHueBR Founders NFT*
Contrato: \`${process.env.NFT_CONTRACT}\`
Supply mintado: ${total}/500
Funções: boosts, staking, recompensas.

Use /mint para mintar.`,
            { parse_mode: "Markdown" }
        );
    } catch {
        bot.sendMessage(msg.chat.id, "Erro ao buscar informações do NFT.");
    }
});

// ===============================
// COMMAND: /mint
// ===============================
bot.onText(/\/mint/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        const mintPrice = await nftContract.methods.price().call();
        const mintBnB = web3.utils.fromWei(mintPrice, "ether");

        bot.sendMessage(
            chatId,
            `🖼 *Mint de NFT HueHueBR Founders*\n\nPreço: *${mintBnB} BNB* por NFT\n\nEnvie agora para executar o mint:\n\n\`${process.env.NFT_CONTRACT}\``,
            { parse_mode: "Markdown" }
        );
    } catch {
        bot.sendMessage(chatId, "Erro ao buscar preço de mint.");
    }
});

// ===============================
// COMMAND: /buy
// ===============================
bot.onText(/\/buy/, (msg) => {
    bot.sendMessage(
        msg.chat.id,
        `💹 *Como comprar HBR:*

1️⃣ Vá na PancakeSwap  
2️⃣ Cole o contrato:  
\`${process.env.TOKEN_CONTRACT}\`  
3️⃣ Par: HBR/WBNB  
4️⃣ Slippage recomendado: 1%–3%

Link direto:  
https://pancakeswap.finance/swap?outputCurrency=${process.env.TOKEN_CONTRACT}`,
        { parse_mode: "Markdown" }
    );
});

// ===============================
// COMMAND: /help
// ===============================
bot.onText(/\/help/, (msg) => {
    bot.sendMessage(
        msg.chat.id,
        `ℹ️ *Ajuda do bot*

/price – Ver preço HBR  
/tokeninfo – Info do token  
/nftinfo – Info dos NFTs  
/mint – Mint de NFT  
/buy – Como comprar`,
        { parse_mode: "Markdown" }
    );
});

// ===============================
// SERVIDOR EXPRESS (RAILWAY OK)
// ===============================
app.get("/", (req, res) => {
    res.send("HueHueBR Bot funcionando!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor ativo na porta ${PORT}`);
});
