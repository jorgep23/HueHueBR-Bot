// services/coingecko.js

async function getHbrPriceFromCoingecko(contract) {
  try {
    const url =
      `https://api.coingecko.com/api/v3/simple/token_price/binance-smart-chain` +
      `?contract_addresses=${contract}&vs_currencies=usd`;

    const res = await fetch(url);
    const data = await res.json();

    const key = contract.toLowerCase();

    if (
      !data ||
      !data[key] ||
      typeof data[key].usd !== "number"
    ) {
      return null;
    }

    return Number(data[key].usd);

  } catch (err) {
    console.error("⚠️ Coingecko error:", err.message);
    return null;
  }
}

module.exports = { getHbrPriceFromCoingecko };
