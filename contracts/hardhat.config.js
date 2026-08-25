require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("@nomicfoundation/hardhat-verify");
require("dotenv").config();

const { DEPLOYER_PRIVATE_KEY, DEPLOYER_MNEMONIC, BSCSCAN_API_KEY } = process.env;

const testnetAccounts = DEPLOYER_PRIVATE_KEY
  ? [DEPLOYER_PRIVATE_KEY]
  : DEPLOYER_MNEMONIC
  ? { mnemonic: DEPLOYER_MNEMONIC }
  : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "paris", viaIR: true },
  },
  networks: {
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
      chainId: 97,
      accounts: testnetAccounts,
      gasPrice: 10000000000,
    },
    bscMainnet: {
      url: "https://bsc-dataseed.binance.org",
      chainId: 56,
      accounts: testnetAccounts,
    },
  },
  etherscan: {
    apiKey: BSCSCAN_API_KEY || "",
  },
};
