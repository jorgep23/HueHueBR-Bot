const { ethers } = require("ethers");

if (!process.env.RPC_URL || !process.env.TOKEN_CONTRACT) {
  throw new Error("❌ RPC_URL ou TOKEN_ADDRESS não definidos");
}

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const tokenAddress = process.env.TOKEN_CONTRACT;

// ABI mínima ERC20
const tokenContract = new ethers.Contract(tokenAddress, [
  "function balanceOf(address owner) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)"
], provider);

async function getPrice() {
  // Aqui você pode adicionar lógica de PancakeSwap v3 ou API externa
  return {
    usd: "0.0000",
    brl: "0.00",
    marketcap: "0",
    holders: 0,
    liquidity: "0"
  };
}

module.exports = { getPrice };
