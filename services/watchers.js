// services/watchers.js
const { getPrice } = require("./price");

let lastPrice = null;

function startWatchers(botInstance = null) {
  console.log("🔔 Iniciando watchers...");

  // exemplo simples: checa preço a cada 20s e detecta pump >8%
  setInterval(async () => {
    try {
      const priceData = await getPrice();
      if (!priceData || !priceData.usd) return;

      const current = Number(priceData.usd);
      if (lastPrice) {
        if (current > lastPrice * 1.08) {
          // pump detectado
          console.log("🚀 Pump detectado!");
          if (botInstance && process.env.GROUP_ID) {
            // enviar mensagem no grupo e fazer um drop (se quiser)
            botInstance.sendMessage(process.env.GROUP_ID, `🚀 *PUMP DETECTADO!* Price subiu >8% desde o último check.`, { parse_mode: "Markdown" });
            // você pode chamar sendDrop aqui se quiser, mas cuidado com limites
          }
        } else if (current < lastPrice * 0.85) {
          // queda grande
          console.log("📉 Queda detectada!");
          if (botInstance && process.env.GROUP_ID) {
            botInstance.sendMessage(process.env.GROUP_ID, `📉 *QUEDA FORTE DETECTADA!* Mantenham a calma.`, { parse_mode: "Markdown" });
          }
        }
      }
      lastPrice = current;
    } catch (e) {
      console.error("Watcher error:", e);
    }
  }, Number(process.env.WATCHER_INTERVAL_MS || 20000));
}

module.exports = { startWatchers };
