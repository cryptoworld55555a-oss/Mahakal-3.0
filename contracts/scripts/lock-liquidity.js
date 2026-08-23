// Permanently LOCK liquidity by BURNING all LP tokens to the dead address.
// After this NOBODY (not even the owner) can removeLiquidity -> shows as locked/burned on DEX trackers.
// MAINNET runbook: 1) add liquidity  2) run this to burn LP  3) renounce token ownership.
const { ethers } = require("hardhat");

const DEAD = "0x000000000000000000000000000000000000dEaD";
const ROUTER = "0xD99D1c33F9fC3444f8101754aBC46c52416550D1"; // testnet pancake router
const TTN = "0xd3123574F7C204c73c982972ea46b1086Bbe1079";
const USDT = "0x2e64bc6A398A48F7767830d4F7Db875AeD1E2bF1";

const ROUTER_ABI = ["function factory() view returns (address)"];
const FACTORY_ABI = ["function getPair(address,address) view returns (address)"];
const PAIR_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address,uint256) returns (bool)",
  "function totalSupply() view returns (uint256)",
];

async function main() {
  const [d] = await ethers.getSigners();
  const router = new ethers.Contract(ROUTER, ROUTER_ABI, d);
  const factory = new ethers.Contract(await router.factory(), FACTORY_ABI, d);
  const pairAddr = await factory.getPair(TTN, USDT);
  console.log("LP pair (TTN/USDT):", pairAddr);

  const pair = new ethers.Contract(pairAddr, PAIR_ABI, d);
  const bal = await pair.balanceOf(d.address);
  const supply = await pair.totalSupply();
  console.log("My LP balance:", ethers.formatEther(bal), "of total", ethers.formatEther(supply));
  if (bal === 0n) { console.log("No LP to burn."); return; }

  console.log("Burning ALL LP to dead address...");
  await (await pair.transfer(DEAD, bal)).wait();

  const after = await pair.balanceOf(d.address);
  const dead = await pair.balanceOf(DEAD);
  const pct = (Number(ethers.formatEther(dead)) / Number(ethers.formatEther(supply)) * 100).toFixed(2);
  console.log("My LP after burn:", ethers.formatEther(after), "(should be 0)");
  console.log("Dead address LP:", ethers.formatEther(dead), `(${pct}% of supply LOCKED FOREVER)`);
  console.log("\n=> Liquidity permanently LOCKED. removeLiquidity now impossible for EVERYONE (incl owner).");
}
main().catch((e) => { console.error(e.shortMessage || e.message || e); process.exit(1); });
