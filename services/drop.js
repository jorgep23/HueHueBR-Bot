// services/drop.js
const Web3 = require("web3");
const fs = require("fs");
const path = require("path");
const ABI = require("../utils/abi.json");

const web3 = new Web3(process.env.RPC_URL);
const account = web3.eth.accounts.privateKeyToAccount(process.env.BOT_PRIVATE_KEY);
web3.eth.accounts.wallet.add(account);

const token = new web3.eth.Contract(ABI, process.env.TOKEN_ADDRESS);

const DATA_USERS = path.resolve("./data/users.json");
const DATA_DROPS = path.resolve("./data/drops.json");
const DATA_LIMITS = path.resolve("./data/limits.json");

function loadJSON(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file));
}
function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Nota sobre amount: aqui assumimos amount como número inteiro de tokens (ex: 1 = 1 HBR).
// Se HBR tem 18 decimais, o código converte multiplicando por 10^decimals.
async function sendDrop(amount) {
  const users = loadJSON(DATA_USERS) || {};
  const drops = loadJSON(DATA_DROPS) || [];
  const limits = loadJSON(DATA_LIMITS) || {};

  const ids = Object.keys(users);
  if (ids.length === 0) return { error: "Nenhum usuário registrado" };

  // escolher sorteado aleatório
  const sorteado = ids[Math.floor(Math.random() * ids.length)];
  const wallet = users[sorteado];

  // checar limite diário (limits estrutura: { userId: { "YYYY-MM-DD": count } })
  const today = new Date().toISOString().slice(0, 10);
  if (!limits[sorteado]) limits[sorteado] = {};
  limits[sorteado][today] = limits[sorteado][today] || 0;
  const dailyCount = limits[sorteado][today];
  const MAX_PER_DAY = Number(process.env.MAX_DROPS_PER_DAY || 3);
  if (dailyCount >= MAX_PER_DAY) return { error: "Usuário já atingiu o limite diário" };

  // preparar valor no token decimals
  const decimals = Number(await token.methods.decimals().call());
  const multiplier = web3.utils.toBN(10).pow(web3.utils.toBN(decimals));
  const value = web3.utils.toBN(String(amount)).mul(multiplier);

  try {
    // estimar e enviar transação
    const tx = token.methods.transfer(wallet, value.toString());
    const gas = await tx.estimateGas({ from: account.address });
    const txReceipt = await tx.send({ from: account.address, gas: gas + 50000 });

    // registrar drop
    drops.push({ user: sorteado, wallet, amount, tx: txReceipt.transactionHash, time: new Date().toISOString() });
    saveJSON(DATA_DROPS, drops);

    // incrementar limite
    limits[sorteado][today] = (limits[sorteado][today] || 0) + 1;
    saveJSON(DATA_LIMITS, limits);

    return { sorteado, wallet, txHash: txReceipt.transactionHash, amount };
  } catch (err) {
    console.error("sendDrop error:", err);
    return { error: (err && err.message) ? err.message : String(err) };
  }
}

module.exports = { sendDrop };
