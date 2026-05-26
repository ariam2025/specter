import { expect } from "chai";
import hardhat from "hardhat";

const { ethers } = hardhat;

const DEAD = "0x000000000000000000000000000000000000dEaD";

describe("StakingTreasuryBurn", function () {
  it("stakes net-of-burn and withdraws correctly", async function () {
    const [owner, alice] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const token = await MockERC20.deploy("External", "EXT");
    await token.waitForDeployment();

    await token.mint(alice.address, ethers.parseEther("1000"));

    const StakingTreasuryBurn = await ethers.getContractFactory("StakingTreasuryBurn");
    const burnBps = 500; // 5%
    const treasury = await StakingTreasuryBurn.deploy(await token.getAddress(), owner.address, DEAD, burnBps);
    await treasury.waitForDeployment();

    await token.connect(alice).approve(await treasury.getAddress(), ethers.parseEther("100"));
    await expect(treasury.connect(alice).stake(ethers.parseEther("100")))
      .to.emit(treasury, "Staked");

    // 5% burned => 95 credited
    expect(await treasury.stakedBalance(alice.address)).to.equal(ethers.parseEther("95"));
    expect(await treasury.totalStaked()).to.equal(ethers.parseEther("95"));

    expect(await token.balanceOf(DEAD)).to.equal(ethers.parseEther("5"));
    expect(await token.balanceOf(await treasury.getAddress())).to.equal(ethers.parseEther("95"));

    await expect(treasury.connect(alice).withdraw(ethers.parseEther("50")))
      .to.emit(treasury, "Withdrawn")
      .withArgs(alice.address, ethers.parseEther("50"));

    expect(await treasury.stakedBalance(alice.address)).to.equal(ethers.parseEther("45"));
    expect(await token.balanceOf(await treasury.getAddress())).to.equal(ethers.parseEther("45"));
  });

  it("reverts when withdrawing more than staked", async function () {
    const [owner, alice] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const token = await MockERC20.deploy("External", "EXT");
    await token.waitForDeployment();

    const StakingTreasuryBurn = await ethers.getContractFactory("StakingTreasuryBurn");
    const treasury = await StakingTreasuryBurn.deploy(await token.getAddress(), owner.address, DEAD, 0);
    await treasury.waitForDeployment();

    await expect(treasury.connect(alice).withdraw(1)).to.be.reverted;
  });

  it("owner can update burn config", async function () {
    const [owner] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const token = await MockERC20.deploy("External", "EXT");
    await token.waitForDeployment();

    const StakingTreasuryBurn = await ethers.getContractFactory("StakingTreasuryBurn");
    const treasury = await StakingTreasuryBurn.deploy(await token.getAddress(), owner.address, DEAD, 0);
    await treasury.waitForDeployment();

    await expect(treasury.setBurnConfig(DEAD, 1234)).to.emit(treasury, "BurnConfigUpdated").withArgs(DEAD, 1234);
    expect(await treasury.burnBps()).to.equal(1234);
  });
});

