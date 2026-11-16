import { z } from 'zod';
import { zObjectId } from './objectId.js';

// Base64 string that decodes to exactly `bytes` bytes (the server only validates shape; it cannot read the content).
export const b64Bytes = (bytes) =>
  z.string().max(512).regex(/^[A-Za-z0-9+/]+={0,2}$/, 'Invalid base64')
    .refine((v) => Buffer.from(v, 'base64').length === bytes, `Must decode to ${bytes} bytes`);

// A group key sealed (nacl.box) for one member: 32-byte key + 16-byte MAC, 24-byte nonce.
export const wrappedKey = z.object({
  userId: zObjectId,
  encryptedKey: b64Bytes(48),
  nonce: b64Bytes(24),
});
