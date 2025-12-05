// pancakeswap.js – compatível com Ethers v6

const { JsonRpcProvider, Contract } = require("ethers");

const provider = new JsonRpcProvider(
  process.env.BSC_RPC || "https://bsc-dataseed.binance.org/"
);

const PCS_ROUTER = process.env.PCS_ROUTER || "0x10ED43C718714eb63d5aA57B78B54704E256024E";

const ABI = [
  "function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory amounts)"
];

async function getPrice(tokenAddress) {
  try {
    const router = new Contract(PCS_ROUTER, ABI, provider);

    const amount = await router.getAmountsOut(
      1e18, // 1 token (18 decimals)
      [
        tokenAddress,
        "0x55d398326f99059fF775485246999027B3197955" // USDT BSC
      ]
    );

    const price = Number(amount[1]) / 1e18;
    return price;
  } catch (err) {
    console.error("Erro ao consultar preço:", err);
    return null;
  }
}

module.exports = { getPrice };
