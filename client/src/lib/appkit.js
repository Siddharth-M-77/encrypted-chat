import { createAppKit } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { bsc, bscTestnet } from '@reown/appkit/networks';

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

// WalletConnect is optional: without a Reown project ID the app falls back to injected wallets only.
export const WC_ENABLED = Boolean(projectId);

if (WC_ENABLED) {
  createAppKit({
    adapters: [new EthersAdapter()],
    networks: [bscTestnet, bsc],
    defaultNetwork: Number(import.meta.env.VITE_CHAIN_ID) === 56 ? bsc : bscTestnet,
    projectId,
    metadata: {
      name: 'M Talk',
      description: 'M Talk – Communication Without Boundaries',
      url: window.location.origin,
      icons: [],
    },
    themeMode: 'dark',
    themeVariables: { '--w3m-accent': '#7B2FF7' },
    features: { analytics: false, email: false, socials: false },
  });
}
