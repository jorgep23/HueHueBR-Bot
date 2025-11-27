require("dotenv").config();
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const { startAlerts, getTotalMinted } = require("./utils/alerts");
const { web3, nftContract, pairContract } = require("./utils/web3");
const { getV3Price } = require("./utils/price");

const app = express();

// ============================
// VARIÁVEIS DO .env
// ============================
const TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.OWNER_CHAT_ID;
const POOL_V3 = process.env.POOL_V3;
const RPC_URL = process.env.RPC_URL;

if (!TOKEN || !CHAT_ID || !POOL_V3 || !RPC_URL) {
    console.error("❌ Verifique BOT_TOKEN, OWNER_CHAT_ID, POOL_V3 e RPC_URL no .env");
    process.exit(1);
}

// ============================
// BOT EM MODO POLLING
// ============================
const bot = new TelegramBot(TOKEN, { polling: true });

console.log("🤖 Bot iniciado em modo POLLING...");

// Mensagem padrão
bot.on("message", (msg) => {
    //bot.sendMessage(msg.chat.id, "Bot está rodando! Monitoramento ativo.");
});

// ============================
// ALERTS AUTOMÁTICOS
// ============================
startAlerts(bot, CHAT_ID);
console.log("📡 Alerts started");

// ============================
// COMMAND: /start
// ============================
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

// ============================
// COMMAND: /price (PancakeSwap V3)
// ============================
bot.onText(/\/price/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        const poolAddress = process.env.PAIR_CONTRACT; // endereço V3
        const { price, token0, token1 } = await getV3Price(poolAddress);

        bot.sendMessage(
            chatId,
            `💰 *Preço HBR/VBNB (V3):* ${price.toFixed(12)} (${token0}/${token1})`,
            { parse_mode: "Markdown" }
        );
    } catch (err) {
        console.error("Erro no /price:", err.message || err);
        bot.sendMessage(chatId, "Erro no /price: verifique RPC, endereço da pool e logs do servidor.");
    }
});


// ============================
// COMMAND: /tokeninfo
// ============================
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
        const total = await getTotalMinted();

        bot.sendMessage(
            msg.chat.id,
            `🖼 *HueHueBR Founders NFT*
Contrato: \`${process.env.NFT_CONTRACT}\`
Supply mintado: ${total}/500
Funções: boosts, staking, recompensas.

Use /mint para mintar.`,
            { parse_mode: "Markdown" }
        );
    } catch (err) {
        bot.sendMessage(msg.chat.id, "Erro ao buscar informações do NFT.");
        console.log("Erro ao buscar informações do NFT:", err.message || err);
    }
});


// ============================
// COMMAND: /mint <quantidade> (avançado)
// ============================
bot.onText(/\/mint(?: (\d+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const qtd = match[1] ? parseInt(match[1], 10) : 1; // quantidade padrão 1

    if (isNaN(qtd) || qtd <= 0) {
        bot.sendMessage(chatId, "❌ Quantidade inválida. Use /mint <quantidade>.");
        return;
    }

    try {
        // 1️⃣ Busca o preço do NFT
        const priceWei = await nftContract.methods.mintPrice().call();
        const priceBNB = parseFloat(web3.utils.fromWei(priceWei, "ether"));
        const totalBNB = (priceBNB * qtd).toFixed(6);

        // 2️⃣ Cria dados da transação
        const mintData = nftContract.methods.mint(qtd).encodeABI();
        const contractAddress = process.env.NFT_CONTRACT;

        // 3️⃣ Gera link de transação para MetaMask / Trust Wallet
        const txLink = `https://bscscan.com/address/${contractAddress}#writeContract`;

        // 4️⃣ Envia mensagem com instruções
        await bot.sendMessage(
            chatId,
            `🖼 *NFT Founders HueHueBR*  
Quantidade: ${qtd}  
Preço unitário: ${priceBNB} BNB  
💰 Total: ${totalBNB} BNB  

Para mintar seu NFT(s) com 1 clique:  
1️⃣ Abra sua carteira (MetaMask, TrustWallet, etc.)  
2️⃣ Clique no link abaixo para abrir o contrato no BscScan:  
[Open Contract → mint](https://bscscan.com/address/${contractAddress}#writeContract)  
3️⃣ Escolha a função *mint* e insira a quantidade: *${qtd}*  
4️⃣ Confirme o envio de *${totalBNB} BNB*  
5️⃣ Assine a transação na sua carteira

✅ Transação pré-preenchida para facilitar o mint.`,
            { parse_mode: "Markdown", disable_web_page_preview: true }
        );
    } catch (err) {
        console.error("Erro ao gerar link de mint:", err.message || err);
        bot.sendMessage(chatId, `❌ Erro ao tentar mintar NFT: ${err.message || err}`);
    }
});


// ============================
// COMMAND: /buy
// ============================
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

// ============================
// COMMAND: /help
// ============================
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

// ============================
// SERVIDOR EXPRESS
// ============================
app.get("/", (req, res) => {
    res.send("HueHueBR Bot funcionando!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor ativo na porta ${PORT}`);
});
