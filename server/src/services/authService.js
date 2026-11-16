import { SiweMessage, generateNonce } from 'siwe';
import { redis } from '../config/redis.js';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';

const NONCE_TTL_SECONDS = 300;
const MAX_MESSAGE_AGE_MS = 5 * 60 * 1000;
const nonceKey = (address) => `nonce:${address.toLowerCase()}`;

export async function createNonce(address) {
  const nonce = generateNonce();
  await redis.set(nonceKey(address), nonce, 'EX', NONCE_TTL_SECONDS);
  return nonce;
}

// Verify a SIWE (EIP-4361) message + signature and return the (possibly new) user.
export async function verifySiwe({ message, signature }) {
  let siwe;
  try {
    siwe = new SiweMessage(message);
  } catch {
    throw ApiError.badRequest('Malformed SIWE message');
  }

  const address = siwe.address.toLowerCase();

  // One-time nonce: GETDEL consumes it atomically so a replayed signature always fails.
  const storedNonce = await redis.getdel(nonceKey(address));
  if (!storedNonce) throw ApiError.unauthorized('Nonce expired or already used');

  if (!env.allowedChainIds.includes(siwe.chainId)) {
    throw ApiError.badRequest('Unsupported chain');
  }
  if (siwe.issuedAt && Date.now() - new Date(siwe.issuedAt).getTime() > MAX_MESSAGE_AGE_MS) {
    throw ApiError.unauthorized('Sign-in message expired');
  }
  if (siwe.statement !== 'Sign in to M Talk') {
    throw ApiError.badRequest('Unexpected statement');
  }

  // siwe.verify checks the signature, the domain binding and the nonce.
  const result = await siwe.verify({ signature, domain: env.SIWE_DOMAIN, nonce: storedNonce });
  if (!result.success) throw ApiError.unauthorized('Invalid signature');

  // Upsert user on first login.
  const user = await User.findOneAndUpdate(
    { walletAddress: address },
    { $set: { lastSeen: new Date() }, $setOnInsert: { walletAddress: address } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return user;
}
