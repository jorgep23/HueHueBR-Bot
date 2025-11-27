const { web3, tokenContract, nftContract, pairContract } = require("./web3");

let lastBuyBlock = 0;
let lastMintBlock = 0;

// =============================
// MONITOR DE COMPRAS DO TOKEN
// =============================
async function monitorTokenBuys(bot, admin) {
    setInterval(async () => {
        const current = await web3.eth.getBlockNumber();

        const events = await tokenContract.getPastEvents("Transfer", {
            fromBlock: lastBuyBlock || current - 5,
            toBlock: "latest"
        });

        lastBuyBlock = current;

        events.forEach(ev => {
            if (ev.returnValues.from === "0x0000000000000000000000000000000000000000") return;

            const amount = web3.utils.fromWei(ev.returnValues.value, "ether");

            bot.sendMessage(
                admin,
                `🔥 *COMPRA DE HBR DETECTADA!*\n\nComprador: ${ev.returnValues.to}\nQtd: ${amount} HBR`,
                { parse_mode: "Markdown" }
            );
        });
    }, 5000);
}

// =============================
// MONITOR DE MINT NFT
// =============================
async function monitorNFTMints(bot, admin) {
    setInterval(async () => {
        const current = await web3.eth.getBlockNumber();

        const events = await nftContract.getPastEvents("Transfer", {
            fromBlock: lastMintBlock || current - 5,
            toBlock: "latest"
        });

        lastMintBlock = current;

        events.forEach(ev => {
            if (ev.returnValues.from !== "0x0000000000000000000000000000000000000000") return;

            bot.sendMessage(
                admin,
                `🖼🔥 *NOVO MINT DE NFT!*\n\nWallet: ${ev.returnValues.to}\nTokenID: ${ev.returnValues.tokenId}`,
                { parse_mode: "Markdown" }
            );
        });

    }, 5000);
}

module.exports = { monitorTokenBuys, monitorNFTMints };
