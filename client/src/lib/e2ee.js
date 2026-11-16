import nacl from 'tweetnacl';
import util from 'tweetnacl-util';
import { getSecretKey, getPublicKey, getGroupKey } from './keystore.js';

const { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } = util;

// ---- 1:1 messages (nacl.box, X25519 + XSalsa20-Poly1305) ----
// Message payload (before encryption): { type: "text"|"image"|"file"|"audio", text?, fileId?, fileKey?, fileName?, mimeType?, size? }

// Encrypt for the recipient AND for ourselves (so our own history can be read on other devices).
export function encryptDirect(payload, recipientPublicKeyB64) {
  const secret = getSecretKey();
  const myPublic = decodeBase64(getPublicKey());
  const plain = decodeUTF8(JSON.stringify(payload));
  const n1 = nacl.randomBytes(nacl.box.nonceLength);
  const n2 = nacl.randomBytes(nacl.box.nonceLength);
  return {
    ciphertext: encodeBase64(nacl.box(plain, n1, decodeBase64(recipientPublicKeyB64), secret)),
    nonce: encodeBase64(n1),
    ciphertextForSender: encodeBase64(nacl.box(plain, n2, myPublic, secret)),
    nonceForSender: encodeBase64(n2),
  };
}

// `mine` messages arrive as the copy encrypted to our own key; others' messages use the sender's public key.
export function decryptDirect(msg, { mine, senderPublicKey }) {
  try {
    if (!msg.ciphertext) return null;
    const peerPublic = mine ? decodeBase64(getPublicKey()) : decodeBase64(senderPublicKey);
    const plain = nacl.box.open(decodeBase64(msg.ciphertext), decodeBase64(msg.nonce), peerPublic, getSecretKey());
    return plain ? JSON.parse(encodeUTF8(plain)) : null;
  } catch {
    return null;
  }
}

// ---- Group messages (nacl.secretbox with a shared 32-byte group key) ----

export const generateGroupKey = () => nacl.randomBytes(nacl.secretbox.keyLength);

// Seal the group key for one member with nacl.box (our secret key + their public key).
export function wrapGroupKey(groupKey, memberPublicKeyB64) {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  return {
    encryptedKey: encodeBase64(nacl.box(groupKey, nonce, decodeBase64(memberPublicKeyB64), getSecretKey())),
    nonce: encodeBase64(nonce),
  };
}

// Open a key row from the server; returns null if it cannot be opened.
export function unwrapGroupKey(row) {
  try {
    return nacl.box.open(decodeBase64(row.encryptedKey), decodeBase64(row.nonce), decodeBase64(row.encryptedByPublicKey), getSecretKey());
  } catch {
    return null;
  }
}

export function encryptGroup(payload, conversationId, keyVersion) {
  const key = getGroupKey(conversationId, keyVersion);
  if (!key) throw new Error('Group key unavailable');
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  return { ciphertext: encodeBase64(nacl.secretbox(decodeUTF8(JSON.stringify(payload)), nonce, key)), nonce: encodeBase64(nonce) };
}

export function decryptGroup(msg, conversationId) {
  try {
    const key = getGroupKey(conversationId, msg.keyVersion);
    if (!key || !msg.ciphertext) return null;
    const plain = nacl.secretbox.open(decodeBase64(msg.ciphertext), decodeBase64(msg.nonce), key);
    return plain ? JSON.parse(encodeUTF8(plain)) : null;
  } catch {
    return null;
  }
}

// ---- Safety number ----
// 60-digit fingerprint of both public keys. Both users see the same number; if it differs, someone is in the middle.
export function safetyNumber(publicKeyA, publicKeyB) {
  const [a, b] = [publicKeyA, publicKeyB].sort();
  const hash = nacl.hash(decodeUTF8(`${a}|${b}`)); // SHA-512
  const groups = [];
  for (let i = 0; i < 12; i++) {
    const n = ((hash[i * 4] << 24) | (hash[i * 4 + 1] << 16) | (hash[i * 4 + 2] << 8) | hash[i * 4 + 3]) >>> 0;
    groups.push(String(n % 100000).padStart(5, '0'));
  }
  return groups;
}
