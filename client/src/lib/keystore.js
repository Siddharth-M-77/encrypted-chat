import { get, set, del } from 'idb-keyval';
import { b64, unb64, generateKeyPair, randomSalt, encryptSecretKey, decryptSecretKey, publicKeyFromSecret } from './crypto.js';

// The decrypted secret key lives only in this module's memory. It is never written to disk or Redux,
// and is gone on reload or logout (the user re-enters the PIN).
let unlocked = null; // { publicKey: string(b64), secretKey: Uint8Array }

const idbKey = (wallet) => `mtalk:keys:${wallet.toLowerCase()}`;

export const isUnlocked = () => unlocked !== null;
export const getSecretKey = () => unlocked?.secretKey ?? null;
export const getPublicKey = () => unlocked?.publicKey ?? null;

// Decrypted group keys ("<conversationId>:<version>" -> 32 bytes). Memory only, wiped on lock like the secret key.
const groupKeys = new Map();
const gk = (conversationId, version) => `${conversationId}:${version}`;
export const setGroupKey = (conversationId, version, key) => groupKeys.set(gk(conversationId, version), key);
export const getGroupKey = (conversationId, version) => groupKeys.get(gk(conversationId, version)) ?? null;
export const hasGroupKey = (conversationId, version) => groupKeys.has(gk(conversationId, version));

export function lock() {
  if (unlocked) unlocked.secretKey.fill(0);
  unlocked = null;
  groupKeys.forEach((k) => k.fill(0));
  groupKeys.clear();
}

export const getLocalRecord = (wallet) => get(idbKey(wallet));
export const clearLocalRecord = (wallet) => del(idbKey(wallet));

const saveLocal = (wallet, record) => set(idbKey(wallet), record);

// First-time setup: new keypair protected by the PIN. Returns the payload to upload to the server.
export async function createKeys(wallet, pin) {
  const kp = generateKeyPair();
  const salt = randomSalt();
  const encrypted = await encryptSecretKey(kp.secretKey, pin, salt);
  const record = { publicKey: b64(kp.publicKey), encryptedPrivateKey: encrypted, salt: b64(salt) };
  await saveLocal(wallet, record);
  unlocked = { publicKey: record.publicKey, secretKey: kp.secretKey };
  return {
    publicKey: record.publicKey,
    encryptedPrivateKeyBackup: record.encryptedPrivateKey,
    keySalt: record.salt,
  };
}

// Unlock with a PIN using a record (local IndexedDB copy or the server backup). Returns false on wrong PIN.
export async function unlockWithRecord(wallet, record, pin) {
  const secret = await decryptSecretKey(record.encryptedPrivateKey, pin, unb64(record.salt));
  if (!secret) return false;
  const publicKey = b64(publicKeyFromSecret(secret));
  if (record.publicKey && record.publicKey !== publicKey) return false; // blob does not belong to this public key
  await saveLocal(wallet, { ...record, publicKey });
  unlocked = { publicKey, secretKey: secret };
  return true;
}

// Re-encrypt the unlocked secret key under a new PIN (and fresh salt). Requires the old PIN as confirmation.
export async function changePin(wallet, oldPin, newPin) {
  const record = await getLocalRecord(wallet);
  if (!record || !unlocked) throw new Error('Keys are locked');
  const check = await decryptSecretKey(record.encryptedPrivateKey, oldPin, unb64(record.salt));
  if (!check) throw new Error('Current PIN is incorrect');
  check.fill(0);
  const salt = randomSalt();
  const encrypted = await encryptSecretKey(unlocked.secretKey, newPin, salt);
  const next = { publicKey: unlocked.publicKey, encryptedPrivateKey: encrypted, salt: b64(salt) };
  await saveLocal(wallet, next);
  return { publicKey: next.publicKey, encryptedPrivateKeyBackup: next.encryptedPrivateKey, keySalt: next.salt };
}
