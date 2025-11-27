const { ethers } = require("ethers");

// Configurações
const provider = new ethers.providers.JsonRpcProvider("https://bsc-dataseed.binance.org/"); // RPC BSC
const nftContractAddress = "0x8984bbd48BC0e945889EaeB4d2aFD031783fB411";
const nftAbi = [
  "function mintPrice() view returns (uint256)",
  "function mint(uint256 quantity) payable"
];

const walletPrivateKey = process.env.BOT_WALLET_KEY; // carteira do bot para interagir
const wallet = new ethers.Wallet(walletPrivateKey, provider);

const nftContract = new ethers.Contract(nftContractAddress, nftAbi, wallet);

module.exports = { provider, nftContract, wallet };
