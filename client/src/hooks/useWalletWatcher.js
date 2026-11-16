import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { getActiveProvider } from '../lib/wallet.js';
import { SUPPORTED_CHAIN_IDS } from '../lib/chains.js';
import { useLogout } from './useSession.js';

// While signed in, force a logout if the wallet switches account or moves to an unsupported chain.
export function useWalletWatcher(user) {
  const logout = useLogout();

  useEffect(() => {
    const provider = getActiveProvider();
    if (!user || !provider?.on) return undefined;

    const onAccounts = (accounts) => {
      if (!accounts?.length || accounts[0].toLowerCase() !== user.walletAddress) {
        toast.error('Wallet account changed. Please sign in again.');
        logout();
      }
    };
    const onChain = (hexId) => {
      const id = Number(hexId);
      if (!SUPPORTED_CHAIN_IDS.includes(id)) {
        toast.error('Unsupported network. Please sign in again on BNB Smart Chain.');
        logout();
      } else {
        toast('Network changed');
      }
    };

    provider.on('accountsChanged', onAccounts);
    provider.on('chainChanged', onChain);
    return () => {
      provider.removeListener?.('accountsChanged', onAccounts);
      provider.removeListener?.('chainChanged', onChain);
    };
  }, [user, logout]);
}
