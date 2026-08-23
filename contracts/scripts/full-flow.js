// Full on-chain flow: stake (60% buys TTN via Pancake) -> claim (signed) -> sell (signed).
const { ethers } = require("hardhat");

const PROTOCOL = "0xbC55Cd51761c4369754DAc706881C983C7FA35eC";
const USDT = "0x0aAA413E7C9f7545Db77FfD3a96F7a640AB55D0F";
const TTN = "0xa38427DA27828A72699Df34c694038921Aa19f9B";
const E = (n) => ethers.parseEther(String(n));

async function main() {
  const [me] = await ethers.getSigners(); // deployer == signer
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const protocol = await ethers.getContractAt("TitanProtocol", PROTOCOL);
  const usdt = await ethers.getContractAt("MockUSDT", USDT);
  const ttn = await ethers.getContractAt("TitanToken", TTN);

  await (await usdt.approve(PROTOCOL, ethers.MaxUint256)).wait();

  // STAKE $100
  const dl = Math.floor(Date.now()/1000) + 900;
  const devBefore = await usdt.balanceOf(await protocol.devWallet());
  const ttnResBefore = await ttn.balanceOf(PROTOCOL);
  console.log("Staking $100...");
  await (await protocol.stake(E(100), 0, dl)).wait();
  const acc = await protocol.accountOf(me.address);
  console.log("  miningCap:", ethers.formatEther(acc[3]), "(expect 200)");
  console.log("  dev received:", ethers.formatEther((await usdt.balanceOf(await protocol.devWallet())) - devBefore), "(expect ~5)");
  console.log("  TTN reserve gained:", ethers.formatEther((await ttn.balanceOf(PROTOCOL)) - ttnResBefore), "(~6 TTN from $60)");

  // CLAIM reward $10 (capReduce=true), signed
  const nonce1 = Date.now();
  const dCl = ethers.solidityPackedKeccak256(
    ["string","address","uint256","bool","uint256","uint256","address","uint256"],
    ["CLAIM", me.address, E(10), true, nonce1, dl, PROTOCOL, chainId]);
  const sigCl = await me.signMessage(ethers.getBytes(dCl));
  const uBefore = await usdt.balanceOf(me.address);
  await (await protocol.claimReward(E(10), true, nonce1, dl, sigCl)).wait();
  console.log("Claim $10 -> user USDT +", ethers.formatEther((await usdt.balanceOf(me.address)) - uBefore));
  console.log("  cap after claim:", ethers.formatEther((await protocol.accountOf(me.address))[3]), "(expect 190)");

  // SELL 2 TTN (signed) -> USDT to user, cap reduces
  const nonce2 = Date.now() + 1;
  const dSl = ethers.solidityPackedKeccak256(
    ["string","address","uint256","uint256","uint256","uint256","address","uint256"],
    ["SELL", me.address, E(2), 0, nonce2, dl, PROTOCOL, chainId]);
  const sigSl = await me.signMessage(ethers.getBytes(dSl));
  const uBefore2 = await usdt.balanceOf(me.address);
  const capBefore = (await protocol.accountOf(me.address))[3];
  await (await protocol.sellMined(E(2), 0, nonce2, dl, sigSl)).wait();
  const gained = (await usdt.balanceOf(me.address)) - uBefore2;
  console.log("Sell 2 TTN -> user USDT +", ethers.formatEther(gained), "(~$20 minus slippage)");
  console.log("  cap after sell:", ethers.formatEther((await protocol.accountOf(me.address))[3]), "(reduced by USD received)");
  console.log("FULL FLOW OK");
}
main().catch((e) => { console.error(e.shortMessage || e.message || e); process.exit(1); });
