require("dotenv").config();

/**
 * Deploy + verify on Base mainnet.
 *
 * Env:
 * - PK (required): private key (with or without 0x)
 * - ETHERSCAN_API_KEY (required for verify)
 * - BASE_RPC_URL (optional): defaults to https://mainnet.base.org
 * - STAKING_TOKEN_ADDRESS (optional): defaults to Base WETH 0x4200...0006
 * - BURN_ADDRESS (optional): defaults to 0x...dEaD
 * - BURN_BPS (optional): defaults to 500 (5%)
 */

const DEAD = "0x000000000000000000000000000000000000dEaD";
const BASE_WETH = "0x4200000000000000000000000000000000000006";

async function main() {
  const hre = require("hardhat");
  const { ethers } = hre;

  const burnAddress = process.env.BURN_ADDRESS || DEAD;
  const burnBps = Number(process.env.BURN_BPS || "500");
  const stakingToken = process.env.STAKING_TOKEN_ADDRESS || BASE_WETH;

  const [deployer] = await ethers.getSigners();
  const owner = deployer.address;

  console.log("Deployer:", deployer.address);
  console.log("Staking token:", stakingToken);
  console.log("Burn address:", burnAddress);
  console.log("Burn bps:", burnBps);

  const Factory = await ethers.getContractFactory("StakingTreasuryBurn");
  const contract = await Factory.deploy(stakingToken, owner, burnAddress, burnBps);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("Deployed StakingTreasuryBurn:", address);

  // Wait a bit so BaseScan can index the bytecode.
  console.log("Waiting 20 seconds before verify...");
  await new Promise((r) => setTimeout(r, 20_000));

  try {
    await hre.run("verify:verify", {
      address,
      constructorArguments: [stakingToken, owner, burnAddress, burnBps],
    });
    console.log("Verified on BaseScan.");
  } catch (e) {
    console.log("Verify failed (might already be verified).");
    console.log(String(e));
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

