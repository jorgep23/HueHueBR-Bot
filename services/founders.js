// services/founders.js
const { ethers } = require("ethers");

const provider = new ethers.JsonRpcProvider(
  process.env.BSC_RPC || "https://bsc-dataseed1.binance.org/"
);

const FOUNDERS_CONTRACT = "0x8984bbd48BC0e945889EaeB4d2aFD031783fB411";

const erc721Abi = [
  "function balanceOf(address owner) view returns (uint256)"
];

async function getFounderCount(wallet) {
  if (!wallet) return 0;

  try {
    const w = ethers.getAddress(wallet.toLowerCase());

    const contract = new ethers.Contract(
      FOUNDERS_CONTRACT,
      erc721Abi,
      provider
    );

    const count = await contract.balanceOf(w);

    console.log(`🧩 NFT Founders balanceOf(${w}) =`, count.toString());  // <--- DEBUG REAL

    return Number(count);

  } catch (err) {
    console.error("❌ founders balanceOf ERROR:", err);
    return 0;
  }
}

module.exports = { getFounderCount };
