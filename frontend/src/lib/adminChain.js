import { Contract } from "ethers";
import { getInjectedSigner } from "@/lib/wallet";
import { ONCHAIN } from "@/config";

const SECURITY_ABI = [
  "function blockUser(address user)",
  "function unblockUser(address user)",
  "function pause()",
  "function unpause()",
  "function isBlocked(address user) view returns (bool)",
];

const PROTOCOL_ABI = [
  "function setMerkleRoot(bytes32 root)",
  "function setOwnerTier(address user, bool ownerTier)",
  "function rewardEpoch() view returns (uint256)",
];

async function securityContract() {
  const signer = await getInjectedSigner();
  return new Contract(ONCHAIN.security, SECURITY_ABI, signer);
}

async function protocolContract() {
  const signer = await getInjectedSigner();
  return new Contract(ONCHAIN.protocol, PROTOCOL_ABI, signer);
}

export async function blockUserOnChain(address) {
  const c = await securityContract();
  const tx = await c.blockUser(address);
  await tx.wait();
  return tx.hash;
}

export async function unblockUserOnChain(address) {
  const c = await securityContract();
  const tx = await c.unblockUser(address);
  await tx.wait();
  return tx.hash;
}

export async function pauseOnChain() {
  const c = await securityContract();
  const tx = await c.pause();
  await tx.wait();
  return tx.hash;
}

export async function unpauseOnChain() {
  const c = await securityContract();
  const tx = await c.unpause();
  await tx.wait();
  return tx.hash;
}

// "Block ALL users" and "Unblock ALL" are implemented as the on-chain global pause/resume:
// while paused, the contract's whenActive check blocks activate/claim/sell for EVERY user in a
// single cheap transaction (looping blockUser over thousands of users would be gas-prohibitive).
export async function blockAllOnChain() {
  return pauseOnChain();
}
export async function unblockAllOnChain() {
  return unpauseOnChain();
}

export async function postMerkleRootOnChain(root) {
  const c = await protocolContract();
  const tx = await c.setMerkleRoot(root);
  await tx.wait();
  return tx.hash;
}

export async function setOwnerTierOnChain(address, isOwner) {
  const c = await protocolContract();
  const tx = await c.setOwnerTier(address, isOwner);
  await tx.wait();
  return tx.hash;
}
