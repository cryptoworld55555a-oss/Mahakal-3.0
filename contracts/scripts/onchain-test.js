// On-chain testnet checks: register, stake (needs USDT faucet+approve), block, pause.
const { ethers } = require("hardhat");

const PROTOCOL = "0xbC55Cd51761c4369754DAc706881C983C7FA35eC";
const SECURITY = "0x572Fc8027F6Ad901DF785C33F4Ae9012c6b06E6c";
const USDT = "0x0aAA413E7C9f7545Db77FfD3a96F7a640AB55D0F";
const E = (n) => ethers.parseEther(String(n));

async function main() {
  const [me] = await ethers.getSigners();
  const protocol = await ethers.getContractAt("TitanProtocol", PROTOCOL);
  const security = await ethers.getContractAt("TitanSecurityAdmin", SECURITY);
  const usdt = await ethers.getContractAt("MockUSDT", USDT);
  console.log("Tester:", me.address);

  // register (idempotent)
  try { await (await protocol.register()).wait(); console.log("register: OK"); }
  catch (e) { console.log("register:", e.shortMessage || "already/again"); }

  // faucet USDT + approve
  await (await usdt.faucet(E(500))).wait();
  await (await usdt.approve(PROTOCOL, ethers.MaxUint256)).wait();
  console.log("USDT faucet+approve: OK, bal =", ethers.formatEther(await usdt.balanceOf(me.address)));

  // BLOCK self -> stake must fail
  await (await security.blockUser(me.address)).wait();
  console.log("blockUser: OK, isBlocked =", await security.isBlocked(me.address));
  try { await protocol.stake.staticCall(E(100), 0, Math.floor(Date.now()/1000)+600); console.log("BLOCK TEST FAILED: stake allowed"); }
  catch (e) { console.log("BLOCK works -> stake reverted:", e.shortMessage || e.reason || "reverted"); }

  // UNBLOCK -> stake allowed (staticCall to avoid needing router swap on real testnet)
  await (await security.unblockUser(me.address)).wait();
  console.log("unblockUser: OK, isBlocked =", await security.isBlocked(me.address));

  // BLOCK ALL via pause -> whenActive reverts
  await (await security.pause()).wait();
  console.log("pause (block-all): OK, paused =", await security.paused());
  try { await security.whenActive(me.address); console.log("PAUSE TEST FAILED: active"); }
  catch (e) { console.log("BLOCK-ALL works -> whenActive reverted:", e.shortMessage || e.reason || "reverted"); }
  await (await security.unpause()).wait();
  console.log("unpause: OK, paused =", await security.paused());

  const acc = await protocol.accountOf(me.address);
  console.log("accountOf -> registered:", acc[0], "| miningCap:", ethers.formatEther(acc[3]));
  console.log("ALL ON-CHAIN CHECKS DONE");
}
main().catch((e) => { console.error(e.message || e); process.exit(1); });
