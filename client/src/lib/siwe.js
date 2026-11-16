import { getAddress } from 'ethers';

// Build an EIP-4361 (Sign-In With Ethereum) message. Format must match what the `siwe` library on the server parses.
export function buildSiweMessage({ address, chainId, nonce }) {
  const checksummed = getAddress(address);
  return [
    `${window.location.host} wants you to sign in with your Ethereum account:`,
    checksummed,
    '',
    'Sign in to M Talk',
    '',
    `URI: ${window.location.origin}`,
    'Version: 1',
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${new Date().toISOString()}`,
  ].join('\n');
}
