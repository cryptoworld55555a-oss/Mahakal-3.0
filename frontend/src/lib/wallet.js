import { BrowserProvider, Wallet } from "ethers";
import { config } from "@/config";

// Build an EIP-4361 (SIWE) style message the backend can verify.
export function buildSiweMessage(address, nonce) {
  const host = window.location.host;
  const origin = window.location.origin;
  return (
    `${host} wants you to sign in with your Ethereum account:\n` +
    `${address}\n\n` +
    `Sign in to TITAN (TTN).\n\n` +
    `URI: ${origin}\n` +
    `Version: 1\n` +
    `Chain ID: ${config.chainId}\n` +
    `Nonce: ${nonce}\n` +
    `Issued At: ${new Date().toISOString()}`
  );
}

// Injected wallet (MetaMask / mobile in-app browser). Returns an ethers signer.
export async function getInjectedSigner() {
  if (!window.ethereum) {
    throw new Error("No injected wallet found. Install MetaMask or use Demo mode.");
  }
  const provider = new BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  return provider.getSigner();
}

// WalletConnect v2 (mobile wallets via QR / deep link). Requires a project id.
export async function getWalletConnectSigner() {
  if (!config.wcProjectId) {
    throw new Error("WalletConnect is not configured yet (missing Project ID).");
  }
  const { EthereumProvider } = await import("@walletconnect/ethereum-provider");
  const wcProvider = await EthereumProvider.init({
    projectId: config.wcProjectId,
    chains: [config.chainId],
    optionalChains: [config.chainId],
    showQrModal: true,
    rpcMap: { [config.chainId]: config.rpcUrl },
    metadata: {
      name: "TITAN (TTN)",
      description: "Mobile-first DeFi dApp on BNB Smart Chain",
      url: window.location.origin,
      icons: [`${window.location.origin}/favicon.ico`],
    },
  });
  await wcProvider.enable();
  const provider = new BrowserProvider(wcProvider);
  const signer = await provider.getSigner();
  signer._wcProvider = wcProvider;
  return signer;
}

// Demo wallet: an in-browser random wallet that can sign SIWE messages.
// Lets the full activation/dashboard flow be tested without any extension.
export function getDemoSigner() {
  return Wallet.createRandom();
}
