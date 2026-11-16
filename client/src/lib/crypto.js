import nacl from 'tweetnacl';
import util from 'tweetnacl-util';

const { encodeBase64, decodeBase64 } = util;

// Pure crypto helpers (no storage, no network). Used for the PIN-protected private key.
export const PBKDF2_ITERATIONS = 310_000;
export const SALT_BYTES = 16;

export const b64 = encodeBase64;
export const unb64 = decodeBase64;

export function generateKeyPair() {
  return nacl.box.keyPair(); // X25519
}

export const randomSalt = () => nacl.randomBytes(SALT_BYTES);

// PIN -> 32-byte key using PBKDF2-HMAC-SHA256 through WebCrypto.
export async function deriveKeyFromPin(pin, salt) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
    material,
    256
  );
  return new Uint8Array(bits);
}

// Encrypt the secret key with the PIN-derived key. Output = base64(nonce(24) || secretbox).
export async function encryptSecretKey(secretKey, pin, salt) {
  const key = await deriveKeyFromPin(pin, salt);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const box = nacl.secretbox(secretKey, nonce, key);
  key.fill(0);
  const out = new Uint8Array(nonce.length + box.length);
  out.set(nonce);
  out.set(box, nonce.length);
  return b64(out);
}

// Returns the secret key, or null when the PIN is wrong / data is corrupted (secretbox is authenticated).
export async function decryptSecretKey(blobB64, pin, salt) {
  const blob = unb64(blobB64);
  const nonce = blob.slice(0, nacl.secretbox.nonceLength);
  const box = blob.slice(nacl.secretbox.nonceLength);
  const key = await deriveKeyFromPin(pin, salt);
  const secret = nacl.secretbox.open(box, nonce, key);
  key.fill(0);
  return secret;
}

export const publicKeyFromSecret = (secretKey) => nacl.box.keyPair.fromSecretKey(secretKey).publicKey;
