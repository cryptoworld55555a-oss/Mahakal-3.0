// Add TTN/USDT liquidity on PancakeSwap testnet (1 TTN = $10 => 1000 TTN : 10000 USDT).
const { ethers } = require("hardhat");

const ROUTER = "0xD99D1c33F9fC3444f8101754aBC46c52416550D1";
const TTN = "0xa38427DA27828A72699Df34c694038921Aa19f9B";
const USDT = "0x0aAA413E7C9f7545Db77FfD3a96F7a640AB55D0F";
const E = (n) => ethers.parseEther(String(n));

const ROUTER_ABI = [
  "function factory() view returns (address)",
  "function addLiquidity(address tokenA,address tokenB,uint amountADesired,uint amountBDesired,uint amountAMin,uint amountBMin,address to,uint deadline) returns (uint amountA,uint amountB,uint liquidity)",
];
const FACTORY_ABI = ["function getPair(address,address) view returns (address)"];

async function main() {
  const [me] = await ethers.getSigners();
  const ttn = await ethers.getContractAt("TitanToken", TTN);
  const usdt = await ethers.getContractAt("MockUSDT", USDT);
  const router = new ethers.Contract(ROUTER, ROUTER_ABI, me);
  console.log("Wallet:", me.address);

  const amtTTN = E(1000);
  const amtUSDT = E(10000);

  // ensure balances
  const usdtBal = await usdt.balanceOf(me.address);
  if (usdtBal < amtUSDT) { await (await usdt.faucet(amtUSDT)).wait(); console.log("faucet USDT done"); }
  console.log("TTN bal:", ethers.formatEther(await ttn.balanceOf(me.address)));
  console.log("USDT bal:", ethers.formatEther(await usdt.balanceOf(me.address)));

  await (await ttn.approve(ROUTER, amtTTN)).wait();
  await (await usdt.approve(ROUTER, amtUSDT)).wait();
  console.log("approvals done");

  const deadline = Math.floor(Date.now() / 1000) + 1200;
  const tx = await router.addLiquidity(TTN, USDT, amtTTN, amtUSDT, 0, 0, me.address, deadline);
  console.log("addLiquidity tx:", tx.hash);
  await tx.wait();
  console.log("Liquidity added.");

  const factoryAddr = await router.factory();
  const factory = new ethers.Contract(factoryAddr, FACTORY_ABI, me);
  const pair = await factory.getPair(TTN, USDT);
  console.log("Pair (LP) address:", pair);
}
main().catch((e) => { console.error(e.shortMessage || e.message || e); process.exit(1); });
