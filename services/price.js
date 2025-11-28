// services/price.js
const axios = require("axios");

// Configure process.env.PRICE_API como endpoint que retorna dados:
// Exemplo simples: usar Dexscreener, CoinGecko, ou endpoint próprio.
// Aqui fazemos fetch de um endpoint que você configurar.
async function getPrice() {
  try {
    if (!process.env.PRICE_API) {
      // fallback: bloque de valores default
      return { usd: "0.00001", brl: "0.00005", mc: 0, liq: 0, holders: 0 };
    }
    const res = await axios.get(process.env.PRICE_API);
    // espera-se que res.data possua { usd, brl, mc, liq, holders }
    return res.data;
  } catch (err) {
    console.error("getPrice error:", err.message || err);
    return { usd: "0.00001", brl: "0.00005", mc: 0, liq: 0, holders: 0 };
  }
}

module.exports = { getPrice };
