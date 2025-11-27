const { Web3 } = require("web3");
require("dotenv").config();
const tokenABI = require("../abis/token.json");
const nftABI = require("../abis/nft.json");
const pairABI = require("../abis/pair.json");

const web3 = new Web3(new Web3.providers.HttpProvider(process.env.RPC_URL));

const tokenContract = new web3.eth.Contract(tokenABI, process.env.TOKEN_CONTRACT);
const nftContract = new web3.eth.Contract(nftABI, process.env.NFT_CONTRACT);
const pairContract = new web3.eth.Contract(pairABI, process.env.PAIR_CONTRACT);

module.exports = {
    web3,
    tokenContract,
    nftContract,
    pairContract
};
