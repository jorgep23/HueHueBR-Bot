// services/founders.js
const { ethers } = require("ethers");

const provider = new ethers.JsonRpcProvider(
  process.env.BSC_RPC || "https://bsc-mainnet.public.blastapi.io"
);

const FOUNDERS_CONTRACT = "0x8984bbd48BC0e945889EaeB4d2aFD031783fB411";

const erc721Abi = [
  "function balanceOf(address owner) view returns (uint256)"
];

async function getFounderCount(wallet) {
  if (!wallet) return 0;

  try {
    const contract = new ethers.Contract(FOUNDERS_CONTRACT, erc721Abi, provider);

    // NORMALIZA
    const addr = wallet.toLowerCase();

    // CHAMADA REAL
    const count = await contract.balanceOf(addr);

    // LOG PRO HARD DEBUG
    console.log(`🧩 NFT Founders balanceOf(${addr}) = ${count.toString()}`);

    return Number(count);
  } catch (err) {
    console.error("❌ founders.js ERRO:", err);
    return 0;
  }
}

module.exports = { getFounderCount };
