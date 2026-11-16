// Supported BNB Smart Chain networks.
export const CHAINS = {
  56: {
    chainId: '0x38',
    chainName: 'BNB Smart Chain',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpcUrls: ['https://bsc-dataseed.binance.org'],
    blockExplorerUrls: ['https://bscscan.com'],
  },
  97: {
    chainId: '0x61',
    chainName: 'BNB Smart Chain Testnet',
    nativeCurrency: { name: 'tBNB', symbol: 'tBNB', decimals: 18 },
    rpcUrls: ['https://data-seed-prebsc-1-s1.bnbchain.org:8545'],
    blockExplorerUrls: ['https://testnet.bscscan.com'],
  },
};

export const SUPPORTED_CHAIN_IDS = Object.keys(CHAINS).map(Number);
export const TARGET_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID) || 97;
