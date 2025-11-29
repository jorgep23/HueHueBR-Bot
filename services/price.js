const { ethers } = require("ethers");
const { Pool, TickMath, Position, nearestUsableTick } = require("@uniswap/v3-sdk");
const { Token, Price } = require("@uniswap/sdk-core");

// RPC e carteira
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

// Token HBR e WBNB
const HBR = new Token(56, process.env.TOKEN_CONTRACT, 18, "HBR", "HueHueBR");
const WBNB = new Token(56, "0xBB4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", 18, "WBNB");

// Endereço da pool HBR/WBNB
const POOL_ADDRESS = "0xf69D28c20C4a28b00227f33be5108e2d8b66cf9f"; // PancakeSwap v3

// ABI mínima da pool
const POOL_ABI = [
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function liquidity() view returns (uint128)"
];

const poolContract = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);

async function getPrice() {
  try {
    const slot0 = await poolContract.slot0();
    const sqrtPriceX96 = slot0[0];

    // Preço HBR/WBNB
    const price = (Number(sqrtPriceX96) ** 2) / 2 ** 192;

    // Considerando BNB ~ US$ 330 (substituir por API real)
    const priceUSD = price * 330;

    return priceUSD;
  } catch (err) {
    console.error("getPrice ERROR:", err);
    return 0;
  }
}

module.exports = { getPrice };
