// Frontend config (Base mainnet)
// Edit here after redeploys.
window.SPECTER_CONFIG = {
  chainId: 8453,
  chainHex: "0x2105",
  blockExplorer: "https://basescan.org",

  // Deployed + verified
  stakingTreasuryBurn: {
    address: "0x95B2CDA322AfECddA3B5d3eD4118ed0F3A1fc55c",
    stakingToken: "0x4200000000000000000000000000000000000006", // Base WETH
    burnAddress: "0x000000000000000000000000000000000000dEaD",
    burnBps: 500,
  },

  // Optional (project-token) — keep empty if not deployed yet
  specterToken: {
    address: "",
    treasuryAddress: "",
  },
};

