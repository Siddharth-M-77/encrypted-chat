import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useGetNonceMutation, useVerifyMutation, errorMessage } from '../services/api.js';
import { buildSiweMessage } from '../lib/siwe.js';
import { openSigner, setActiveProvider } from '../lib/wallet.js';

// Full SIWE login given any EIP-1193 provider (MetaMask or WalletConnect).
export function useSignIn() {
  const [getNonce] = useGetNonceMutation();
  const [verify] = useVerifyMutation();
  const [loading, setLoading] = useState(false);

  const signIn = useCallback(async (eip1193) => {
    setLoading(true);
    try {
      const { address, chainId, signer } = await openSigner(eip1193);
      const { data } = await getNonce(address.toLowerCase()).unwrap();
      const message = buildSiweMessage({ address, chainId, nonce: data.nonce });
      const signature = await signer.signMessage(message);
      setActiveProvider(eip1193);
      await verify({ message, signature }).unwrap();
      toast.success('Signed in');
    } catch (err) {
      // 4001 = user rejected the request in the wallet
      if (err?.code === 4001 || err?.code === 'ACTION_REJECTED') toast.error('Request rejected in wallet');
      else toast.error(errorMessage(err, 'Sign-in failed'));
    } finally {
      setLoading(false);
    }
  }, [getNonce, verify]);

  return { signIn, loading };
}
