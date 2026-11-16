import crypto from 'node:crypto';
import fs from 'node:fs';
import { File } from '../models/File.js';
import { ApiError } from '../utils/ApiError.js';
import { assertParticipant } from './messageService.js';
import { storage } from './storage/index.js';

// 24-byte nonce + 16-byte Poly1305 tag is the minimum size of anything the client's secretbox can produce.
const MIN_ENCRYPTED_SIZE = 40;

export async function saveUpload(user, conversationId, tempFile) {
  try {
    await assertParticipant(conversationId, user._id);
    if (tempFile.size < MIN_ENCRYPTED_SIZE) throw ApiError.badRequest('Invalid encrypted file');
    const key = crypto.randomBytes(16).toString('hex');
    await storage.put(key, tempFile.path);
    const file = await File.create({
      ownerId: user._id, conversationId, storagePath: key, size: tempFile.size, mimeType: 'application/octet-stream',
    });
    return { id: String(file._id), size: file.size, createdAt: file.createdAt };
  } catch (err) {
    await fs.promises.unlink(tempFile.path).catch(() => {}); // never leave rejected uploads on disk
    throw err;
  }
}

// Only current participants of the conversation may download.
export async function getFileForDownload(user, fileId) {
  const file = await File.findById(fileId);
  if (!file) throw ApiError.notFound('File not found');
  await assertParticipant(file.conversationId, user._id);
  return file;
}

export async function deleteConversationFiles(conversationId) {
  const files = await File.find({ conversationId });
  await Promise.all(files.map((f) => storage.remove(f.storagePath)));
  await File.deleteMany({ conversationId });
}
