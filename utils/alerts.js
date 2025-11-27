const { web3, tokenContract, nftContract, pairContract } = require("./web3");

let lastBlockBuy = 0;
let lastBlockMint = 0;

async function startAlerts(bot, chatId) {
    console.log("📡 Monitoramento iniciado...");

    setInterval(async () => {
        try {
            const currentBlock = await web3.eth.getBlockNumber();

            //
            // ====== MONITORAR COMPRAS ==============
            //
            const fromBlock = lastBlockBuy === 0
                ? currentBlock - 5
                : lastBlockBuy + 1;

            if (fromBlock < 0) return;

            const events = await pairContract.getPastEvents("Swap", {
                fromBlock,
                toBlock: "latest",
            });

            events.forEach(ev => {
                const { amount0In, amount1In, amount0Out, amount1Out } = ev.returnValues;

                const isBuy = 
                    BigInt(amount0In) > 0n && BigInt(amount1Out) > 0n;

                if (isBuy) {
                    bot.sendMessage(
                        chatId,
                        `💰 *COMPRA Detectada!*\n\n` +
                        `Token: HBR\n` +
                        `Bloco: ${ev.blockNumber}\n` +
                        `Tx: https://bscscan.com/tx/${ev.transactionHash}`,
                        { parse_mode: "Markdown" }
                    );
                }
            });

            lastBlockBuy = currentBlock;

        } catch (err) {
            console.log("Erro monitorando compras:", err.message);
        }
    }, 8000);




    //
    // ====== MONITORAR MINT DE NFT ==============
    //
    setInterval(async () => {
        try {
            const currentBlock = await web3.eth.getBlockNumber();

            const fromBlock = lastBlockMint === 0 
                ? currentBlock - 5
                : lastBlockMint + 1;

            if (fromBlock < 0) return;

            const mints = await nftContract.getPastEvents("Transfer", {
                filter: { from: "0x0000000000000000000000000000000000000000" },
                fromBlock,
                toBlock: "latest",
            });

            for (let ev of mints) {
                const to = ev.returnValues.to;
                const id = ev.returnValues.tokenId;

                bot.sendMessage(
                    chatId,
                    `🎨 *Novo NFT Mintado!*\n\n` +
                    `ID: ${id}\n` +
                    `Para: ${to}\n` +
                    `Tx: https://bscscan.com/tx/${ev.transactionHash}`,
                    { parse_mode: "Markdown" }
                );
            }

            lastBlockMint = currentBlock;

        } catch (err) {
            console.log("Erro monitorando mint de NFT:", err.message);
        }
    }, 8000);
}

module.exports = { startAlerts };
