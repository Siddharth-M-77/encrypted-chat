import { BrowserProvider } from 'ethers';
import { CHAINS, SUPPORTED_CHAIN_IDS, TARGET_CHAIN_ID } from './chains.js';

// The EIP-1193 provider of the wallet currently used to sign in (MetaMask or WalletConnect).
let activeProvider = null;
export const setActiveProvider = (p) => { activeProvider = p; };
export const getActiveProvider = () => activeProvider || window.ethereum || null;

export const hasInjectedWallet = () => typeof window !== 'undefined' && Boolean(window.ethereum);

export async function connectInjected() {
  if (!hasInjectedWallet()) throw new Error('No browser wallet found. Install MetaMask or use WalletConnect.');
  return window.ethereum;
}

// Make sure the wallet is on a supported chain; otherwise ask it to switch (adding the chain if unknown).
export async function ensureSupportedChain(eip1193) {
  const provider = new BrowserProvider(eip1193);
  const { chainId } = await provider.getNetwork();
  if (SUPPORTED_CHAIN_IDS.includes(Number(chainId))) return Number(chainId);

  const target = CHAINS[TARGET_CHAIN_ID];
  try {
    await eip1193.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: target.chainId }] });
  } catch (err) {
    if (err?.code === 4902 || err?.data?.originalError?.code === 4902) {
      await eip1193.request({ method: 'wallet_addEthereumChain', params: [target] });
    } else {
      throw err;
    }
  }
  return TARGET_CHAIN_ID;
}

// Request an account, sign the SIWE message, return { address, chainId, sign }.
export async function openSigner(eip1193) {
  await eip1193.request({ method: 'eth_requestAccounts' });
  const chainId = await ensureSupportedChain(eip1193);
  // Re-create the provider after a chain switch so ethers does not cache the old network.
  const signer = await new BrowserProvider(eip1193).getSigner();
  return { address: await signer.getAddress(), chainId, signer };
}
