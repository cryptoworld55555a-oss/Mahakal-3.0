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
  "https://static.prod-images.emergentagent.com/jobs/3867ed87-dcc2-48ad-adde-0ee1b9542d8a/images/bf3bd36c8c7e77626a97dc38583d9203f3522b5c4ab8b8cef43a2f818b20147e.jpeg";

export const COIN_HERO_URL =
  "https://static.prod-images.emergentagent.com/jobs/3867ed87-dcc2-48ad-adde-0ee1b9542d8a/images/ecf39d18a731b51c7772de8a4415d0fa1e9f62e39ce341b922f43cf8c7c6b1ea.jpeg";

export const ONCHAIN = {
  protocol: "0x53F278bfCa7acED4c41734FF78840d52fdFD1a6f",
  token: "0xd3123574F7C204c73c982972ea46b1086Bbe1079",
  usdt: "0x2e64bc6A398A48F7767830d4F7Db875AeD1E2bF1",
  security: "0x314DCAb3Acd0dC3b4721B02123609192FF38BEa7",
  community: "0x073DB912A0c86d5903A3CD6571de0adC441D5849",
  chainId: 97,
  chainName: "BSC Testnet",
  rpc: "https://data-seed-prebsc-1-s1.binance.org:8545/",
  explorer: "https://testnet.bscscan.com",
};
