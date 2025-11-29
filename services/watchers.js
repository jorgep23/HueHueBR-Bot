const { getPrice } = require("../services/price");

function startWatchers(bot) {
  console.log("🔔 Watchers iniciados...");

  setInterval(async () => {
    const price = await getPrice();
    console.log(`💰 Preço HBR: ${price.usd.toFixed(4)} USD`);
    // opcional: enviar alertas para grupo
    if (bot && process.env.GROUP_ID) {
      bot.sendMessage(process.env.GROUP_ID, `💰 Preço HBR: ${price.usd.toFixed(4)} USD`);
    }
  }, Number(process.env.WATCHER_INTERVAL_MS) || 20000);
}

module.exports = { startWatchers };
