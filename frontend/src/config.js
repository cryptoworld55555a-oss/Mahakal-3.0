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
  protocol: "0xc78f03C989Ae4820cCeE94E4A97D66b9605F426D",
  token: "0xC7ed8B984A0b445EcC1f8531CAAb1eB41E5326dB",
  usdt: "0x05D9cBf1509A8643972Ac6d136F648686F5aF679",
  security: "0x1C61F12D72b4092DFf6E36F58496bda0fe1f2e24",
  community: "0x073DB912A0c86d5903A3CD6571de0adC441D5849",
  router: "0xD99D1c33F9fC3444f8101754aBC46c52416550D1",
  creator: "",
  publishedKey: "",
  chainId: 97,
  chainName: "BSC Testnet",
  rpc: "https://data-seed-prebsc-1-s1.binance.org:8545/",
  explorer: "https://testnet.bscscan.com",
};
