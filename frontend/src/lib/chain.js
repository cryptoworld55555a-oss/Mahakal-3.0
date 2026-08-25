import { Contract, parseEther } from "ethers";
import { getInjectedSigner } from "@/lib/wallet";
import { ONCHAIN, config } from "@/config";
import axios from "axios";

const api = axios.create({ baseURL: config.apiUrl, timeout: 20000 });

const PROTOCOL_ABI = [
  "function register()",
  "function renew()",
  "function stake(uint256 amount, uint256 minTtnOut, uint256 deadline)",
  "function claimRoi(uint256 cumulativeUsd, uint256 minTtnOut, uint256 deadline, bytes32[] proof)",
  "function claimLevelIncome(uint256 cumulativeUsd, uint256 minTtnOut, uint256 deadline, bytes32[] proof)",
  "function claimDailyPool(uint256 cumulativeUsd, uint256 minTtnOut, uint256 deadline, bytes32[] proof)",
  "function claimWeeklyPool(uint256 cumulativeUsd, uint256 minTtnOut, uint256 deadline, bytes32[] proof)",
  "function claimMonthlyPool(uint256 cumulativeUsd, uint256 minTtnOut, uint256 deadline, bytes32[] proof)",
  "function sell(uint256 ttnIn, uint256 minUsdtOut, uint256 deadline)",
  "function isRenewalDue(address user) view returns (bool)",
  "function accountOf(address user) view returns (bool registered, bool ownerTier, uint256 totalStaked, uint256 miningCap)",
];

// category -> named contract method (BscScan shows a distinct label per claim type).
export const CLAIM_FN = {
  0: "claimRoi",
  1: "claimLevelIncome",
  2: "claimDailyPool",
  3: "claimWeeklyPool",
  4: "claimMonthlyPool",
};
export const CATEGORY_LABEL = {
  0: "ROI", 1: "Level Income", 2: "Daily Pool", 3: "Weekly Pool", 4: "Monthly Pool",
};
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];

const MAXU = "115792089237316195423570985008687907853269984665640564039457584007913129639935";
const deadline = () => Math.floor(Date.now() / 1000) + 1200;

async function protocol() {
  return new Contract(ONCHAIN.protocol, PROTOCOL_ABI, await getInjectedSigner());
}
async function erc20(addr) {
  return new Contract(addr, ERC20_ABI, await getInjectedSigner());
}
async function ensureAllowance(tokenAddr, ownerAddr) {
  const t = await erc20(tokenAddr);
  const cur = await t.allowance(ownerAddr, ONCHAIN.protocol);
  if (cur < parseEther("1000000")) {
    await (await t.approve(ONCHAIN.protocol, MAXU)).wait();
  }
}

export async function getAccount(address) {
  const p = await protocol();
  const [registered, ownerTier, totalStaked, miningCap] = await p.accountOf(address);
  const due = await p.isRenewalDue(address);
  return { registered, ownerTier, totalStaked, miningCap, renewalDue: due };
}

export async function registerOnChain() {
  const p = await protocol();
  const tx = await p.register(); await tx.wait(); return tx.hash;
}

export async function stakeOnChain(amountUsd, ownerAddr) {
  await ensureAllowance(ONCHAIN.usdt, ownerAddr);
  const p = await protocol();
  const tx = await p.stake(parseEther(String(amountUsd)), 0, deadline());
  await tx.wait(); return tx.hash;
}

export async function renewOnChain(ownerAddr) {
  await ensureAllowance(ONCHAIN.usdt, ownerAddr);
  const p = await protocol();
  const tx = await p.renew(); await tx.wait(); return tx.hash;
}

// Fetch this user's reward breakdown + Merkle proofs, then claim each category via its
// dedicated named function so every claim shows a clear label on BscScan.
export async function claimAllRewards(address) {
  const { data } = await api.get(`/reward/tree/user/${address}`);
  const proofs = data.proofs || [];
  if (!proofs.length) throw new Error("No claimable rewards yet");
  const p = await protocol();
  const hashes = [];
  for (const leaf of proofs) {
    const fn = CLAIM_FN[leaf.category];
    if (!fn) continue;
    const tx = await p[fn](leaf.amount_wei, 0, deadline(), leaf.proof);
    await tx.wait();
    hashes.push({ category: leaf.category, label: CATEGORY_LABEL[leaf.category], hash: tx.hash });
  }
  return hashes;
}

// Claim a single reward category (used by per-pool "Claim" buttons).
export async function claimCategory(address, category) {
  const { data } = await api.get(`/reward/tree/user/${address}`);
  const leaf = (data.proofs || []).find((l) => l.category === category);
  if (!leaf) throw new Error(`No claimable ${CATEGORY_LABEL[category] || "reward"} yet`);
  const p = await protocol();
  const tx = await p[CLAIM_FN[category]](leaf.amount_wei, 0, deadline(), leaf.proof);
  await tx.wait();
  return tx.hash;
}

export async function sellOnChain(ttnAmount, ownerAddr) {
  await ensureAllowance(ONCHAIN.token, ownerAddr);
  const p = await protocol();
  const tx = await p.sell(parseEther(String(ttnAmount)), 0, deadline());
  await tx.wait(); return tx.hash;
}
