export const config = {
  backendUrl: process.env.REACT_APP_BACKEND_URL,
  apiUrl: `${process.env.REACT_APP_BACKEND_URL}/api`,
  chainId: Number(process.env.REACT_APP_CHAIN_ID || 56),
  wcProjectId: process.env.REACT_APP_WC_PROJECT_ID || "",
  tokenAddress: process.env.REACT_APP_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000",
  mainProtocolAddress: process.env.REACT_APP_MAIN_PROTOCOL_ADDRESS || "0x0000000000000000000000000000000000000000",
  rpcUrl: "https://bsc-dataseed.binance.org",
  explorer: "https://bscscan.com",
};

export const hasWalletConnect = Boolean(config.wcProjectId);

export const LOGO_URL = "/ttn-logo.png";

export const COIN_HERO_URL = "/ttn-logo.png";

export const ONCHAIN = {
  protocol: "0x5A483E367f818202A5fb4E273E93d4cE5dE4EEFD",
  token: "0x3430D0DAd0BFedC83335A6c85f917DCc7BB344Bc",
  usdt: "0x55d398326f99059fF775485246999027B3197955",
  security: "0x833D8A87ae0314aFb48c1b6C80C286708B537a12",
  community: "0x1aB174e3B96615726007115759DD30716759F408",
  router: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
  creator: "",
  publishedKey: "",
  chainId: 56,
  chainName: "BSC Mainnet",
  rpc: "https://bsc-dataseed.binance.org",
  explorer: "https://bscscan.com",
};
