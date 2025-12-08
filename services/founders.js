// services/founders.js
const { ethers } = require("ethers");

const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC);

// contrato ERC721 HueHueBR Founders
const FOUNDERS_CONTRACT = "0x8984bbd48BC0e945889EaeB4d2aFD031783fB411";

const erc721Abi = [
  "function balanceOf(address owner) external view returns (uint256)"
];

async function getFounderCount(wallet) {
  if (!wallet) return 0;

  try {
    const contract = new ethers.Contract(FOUNDERS_CONTRACT, erc721Abi, provider);
    const count = await contract.balanceOf(wallet);
    return Number(count);
  } catch (err) {
    console.error("❌ erro NFT Founders:", err.message);
    return 0;
  }
}

module.exports = { getFounderCount };
