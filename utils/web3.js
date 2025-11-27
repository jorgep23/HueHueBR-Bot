// utils/web3.js
const Web3 = require("web3");
require("dotenv").config();

const tokenABI = require("../abis/token.json");
const nftABI = require("../abis/nft.json");
const pairABI = require("../abis/pair.json");

// Validate RPC
if (!process.env.RPC_URL) {
  console.error("❌ RPC_URL is required in .env");
  process.exit(1);
}

const web3 = new Web3(new Web3.providers.HttpProvider(process.env.RPC_URL));

// Validate addresses
function validateAddress(name, addr) {
  if (!addr || !web3.utils.isAddress(addr)) {
    console.error(`❌ Invalid or missing ${name}: ${addr}`);
    process.exit(1);
  }
}

validateAddress("TOKEN_CONTRACT", process.env.TOKEN_CONTRACT);
validateAddress("NFT_CONTRACT", process.env.NFT_CONTRACT);
validateAddress("PAIR_CONTRACT", process.env.PAIR_CONTRACT);

const tokenContract = new web3.eth.Contract(tokenABI, process.env.TOKEN_CONTRACT);
const nftContract = new web3.eth.Contract(nftABI, process.env.NFT_CONTRACT);
const pairContract = new web3.eth.Contract(pairABI, process.env.PAIR_CONTRACT);

module.exports = {
  web3,
  tokenContract,
  nftContract,
  pairContract
};
