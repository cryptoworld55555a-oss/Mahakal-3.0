export const config = {
  backendUrl: process.env.REACT_APP_BACKEND_URL,
  apiUrl: `${process.env.REACT_APP_BACKEND_URL}/api`,
  chainId: Number(process.env.REACT_APP_CHAIN_ID || 97),
  wcProjectId: process.env.REACT_APP_WC_PROJECT_ID || "",
  tokenAddress: process.env.REACT_APP_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000",
  mainProtocolAddress: process.env.REACT_APP_MAIN_PROTOCOL_ADDRESS || "0x0000000000000000000000000000000000000000",
  rpcUrl: "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
  explorer: "https://testnet.bscscan.com",
};

export const hasWalletConnect = Boolean(config.wcProjectId);

export const LOGO_URL =
  "https://customer-assets-lxgj4vgw.emergentagent.net/job_ttn-reward-engine/artifacts/xy0rdd74_file_000000001404820883ab85fa82478a61.png";
