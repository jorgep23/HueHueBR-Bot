const ethers = require("ethers");

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

const HBR = process.env.TOKEN_ADDRESS;
const WBNB = process.env.WBNB_ADDRESS;
const POOL_V3 = process.env.POOL_V3_ADDRESS;

const POOL_ABI = [
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function decimals0() view returns (uint8)",
  "function decimals1() view returns (uint8)"
];

async function getPrice() {
  try {
    const pool = new ethers.Contract(POOL_V3, POOL_ABI, provider);
    const [token0, token1] = await Promise.all([pool.token0(), pool.token1()]);
    const [slot0, decimals0, decimals1] = await Promise.all([
      pool.slot0(),
      pool.decimals0(),
      pool.decimals1()
    ]);

    const sqrtPriceX96 = slot0.sqrtPriceX96;

    let priceHBRinWBNB;
    if (token0.toLowerCase() === HBR.toLowerCase()) {
      priceHBRinWBNB = (Number(sqrtPriceX96) ** 2 / 2 ** 192) * (10 ** (decimals0 - decimals1));
    } else {
      priceHBRinWBNB = (2 ** 192 / (Number(sqrtPriceX96) ** 2)) * (10 ** (decimals1 - decimals0));
    }

    // Aproximação em USD (pegar valor real via outro pool)
    const WBNB_USD = 300;
    const priceUSD = priceHBRinWBNB * WBNB_USD;
    const priceBRL = priceUSD * 5.5;

    return { usd: priceUSD, brl: priceBRL, bnb: priceHBRinWBNB };
  } catch (err) {
    console.log("getPrice ERROR:", err.message);
    return { usd: 0, brl: 0, bnb: 0 };
  }
}

module.exports = { getPrice };
