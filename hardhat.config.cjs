require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type {import("hardhat/config").HardhatUserConfig} */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    base: {
      url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
      chainId: 8453,
      accounts: process.env.PK
        ? [(process.env.PK.startsWith("0x") ? process.env.PK : `0x${process.env.PK}`)]
        : [],
    },
  },
  etherscan: {
    // Etherscan API v2 uses a single api key across supported chains.
    apiKey: process.env.ETHERSCAN_API_KEY || "",
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: {
          // Force Etherscan API v2 (chainid is required in v2).
          apiURL: "https://api.etherscan.io/v2/api?chainid=8453",
          browserURL: "https://basescan.org",
        },
      },
    ],
  },
  sourcify: {
    enabled: false,
  },
};

