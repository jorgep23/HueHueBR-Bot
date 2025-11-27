// utils/web3.js
require("dotenv").config();
const Web3 = require("web3");

const tokenABI = require("../abis/token.json");
const nftABI = require("../abis/nft.json");
const pairABI = require("../abis/pair.json");

// ===============================
// 1) MULTI RPC (reduz 90% dos erros)
// ===============================
const RPCs = [
  process.env.RPC_URL,
  "https://bsc-dataseed1.binance.org",
  "https://bsc-dataseed2.binance.org",
  "https://bsc-dataseed3.ninicoin.io",
  "https://bscrpc.com"
].filter(Boolean);

let rpcIndex = 0;

function getWeb3() {
  const rpc = RPCs[rpcIndex % RPCs.length];
  rpcIndex++;
  return new Web3(new Web3.providers.HttpProvider(rpc, { keepAlive: true }));
}

let web3 = getWeb3();

// ===============================
// 2) AUTO-RETRY DE RPC
// ===============================
async function callWithRetry(fn, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      const msg = e?.message || "";

      // erro clássico:
      //   Returned error: limit exceeded
      if (msg.includes("limit") || msg.includes("exceed")) {
        console.log("⏳ RPC limit — mudando de nó e tentando novamente...");
        web3 = getWeb3();
        await new Promise(r => setTimeout(r, 500)); // espera 500ms
        continue;
      }

      // erro leve → tentar de novo
      if (i < tries - 1) {
        console.log(`⚠️ Tentativa ${i + 1} falhou. Tentando novamente...`);
        await new Promise(r => setTimeout(r, 300));
        continue;
      }

      // falhou todas → explodir
      throw e;
    }
  }
}

// ===============================
// 3) VALIDAR ENDEREÇOS
// ===============================
function validateAddress(name, addr) {
  if (!addr || !web3.utils.isAddress(addr)) {
    console.error(`❌ Invalid or missing ${name}: ${addr}`);
    process.exit(1);
  }
}

validateAddress("TOKEN_CONTRACT", process.env.TOKEN_CONTRACT);
validateAddress("NFT_CONTRACT", process.env.NFT_CONTRACT);
validateAddress("PAIR_CONTRACT", process.env.PAIR_CONTRACT);

// ===============================
// 4) SMART CONTRACTS
// ===============================
const tokenContract = new web3.eth.Contract(tokenABI, process.env.TOKEN_CONTRACT);
const nftContract = new web3.eth.Contract(nftABI, process.env.NFT_CONTRACT);
const pairContract = new web3.eth.Contract(pairABI, process.env.PAIR_CONTRACT);

// ===============================
// 5) EXPORTAR TUDO
// ===============================
module.exports = {
  web3,
  getWeb3,
  callWithRetry,
  tokenContract,
  nftContract,
  pairContract
};
