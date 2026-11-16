import { pipeline } from 'node:stream/promises';
import { ok } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';
import * as files from '../services/fileService.js';
import { storage } from '../services/storage/index.js';

export async function upload(req, res) {
  if (!req.file) throw ApiError.badRequest('No file uploaded');
  ok(res, { file: await files.saveUpload(req.user, req.valid.body.conversationId, req.file) }, 'Uploaded', 201);
}

export async function download(req, res) {
  const file = await files.getFileForDownload(req.user, req.valid.params.id);
  res.set({
    'Content-Type': 'application/octet-stream', // always opaque; the client restores the real type after decrypting
    'Content-Length': String(file.size),
    'Content-Disposition': 'attachment; filename="blob"',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, max-age=3600',
  });
  await pipeline(storage.createReadStream(file.storagePath), res);
}
