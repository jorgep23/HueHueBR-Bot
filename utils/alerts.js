const { web3, tokenContract, nftContract, TOKEN_ADDRESS } = require("./web3");

let lastBuyBlock = null;
let lastMintBlock = null;

// Evita spam de erros do Telegram
function safeSend(bot, chatId, msg) {
    bot.sendMessage(chatId, msg).catch(() => {});
}

// Monitor de compras de token
async function checkTokenBuys(bot, chatId) {
    try {
        const currentBlock = Number(await web3.eth.getBlockNumber());

        if (!lastBuyBlock) lastBuyBlock = currentBlock - 5;

        const from = lastBuyBlock;
        const to = currentBlock;

        const events = await tokenContract.getPastEvents("Transfer", {
            fromBlock: from,
            toBlock: to
        });

        events.forEach(evt => {
            const { from, to, value } = evt.returnValues;

            // Apenas compras: de pair/pancake para usuário
            if (from.toLowerCase() === TOKEN_ADDRESS.toLowerCase()) return;

            if (Number(value) > 0) {
                const amount = Number(web3.utils.fromWei(value, "ether"));

                safeSend(
                    bot,
                    chatId,
                    `💸 *Compra Detectada!*\n\n👤 Para: \`${to}\`\n💰 Quantidade: *${amount} HBR*`
                );
            }
        });

        lastBuyBlock = currentBlock;

    } catch (err) {
        console.log("Erro monitorando compras:", err.message);
    }
}

// Monitor de mint da coleção NFT
async function checkMints(bot, chatId) {
    try {
        const currentBlock = Number(await web3.eth.getBlockNumber());

        if (!lastMintBlock) lastMintBlock = currentBlock - 5;

        const events = await nftContract.getPastEvents("Transfer", {
            fromBlock: lastMintBlock,
            toBlock: currentBlock
        });

        events.forEach(evt => {
            const { from, to, tokenId } = evt.returnValues;

            // Mint = Transfer do endereço ZERO
            if (from === "0x0000000000000000000000000000000000000000") {
                safeSend(
                    bot,
                    chatId,
                    `🖼️ *Novo NFT Mintado!*\n\n👤 Dono: \`${to}\`\n🆔 Token ID: *${tokenId}*`
                );
            }
        });

        lastMintBlock = currentBlock;

    } catch (err) {
        console.log("Erro monitorando mint de NFT:", err.message);
    }
}

// Loop global
function startAlerts(bot, chatId) {
    console.log("🔔 Alerts monitor ativo...");

    setInterval(() => checkTokenBuys(bot, chatId), 8000);
    setInterval(() => checkMints(bot, chatId), 9000);
}

module.exports = {
    startAlerts
};
