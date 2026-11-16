import nacl from 'tweetnacl';
import util from 'tweetnacl-util';

const { encodeBase64, decodeBase64 } = util;

// Server limit is 25 MB for the encrypted blob: nonce (24) + MAC (16) are added to the plaintext.
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_PLAINTEXT_BYTES = MAX_FILE_BYTES - 40;

// Only these types are ever rendered inline. Everything else (including SVG/HTML) is download-only.
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const AUDIO_TYPES = new Set(['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-m4a', 'audio/aac']);

export const baseMime = (t = '') => String(t).split(';')[0].trim().toLowerCase();

export function kindOf(file) {
  const t = baseMime(file.type);
  if (IMAGE_TYPES.has(t)) return 'image';
  if (AUDIO_TYPES.has(t)) return 'audio';
  return 'file';
}

// A file id comes from another user's message, so it must be validated before it goes into a URL.
export const isValidFileId = (id) => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);

export function sanitizeFileName(name) {
  const cleaned = String(name || '').replace(/[\\/\u0000-\u001f]/g, '_').replace(/^\.+/, '').trim().slice(0, 120);
  return cleaned || 'file';
}

export function formatBytes(n = 0) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// Encrypt in the browser with a random one-time key. Output blob = nonce(24) || secretbox(file).
export async function encryptFile(file) {
  const plain = new Uint8Array(await file.arrayBuffer());
  const key = nacl.randomBytes(nacl.secretbox.keyLength);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const box = nacl.secretbox(plain, nonce, key);
  const out = new Uint8Array(nonce.length + box.length);
  out.set(nonce);
  out.set(box, nonce.length);
  return { blob: new Blob([out], { type: 'application/octet-stream' }), key: encodeBase64(key) };
}

// XMLHttpRequest instead of fetch because fetch cannot report upload progress.
export function uploadEncrypted(blob, conversationId, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/files');
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let body = null;
      try { body = JSON.parse(xhr.responseText); } catch { /* non-JSON error page */ }
      if (xhr.status >= 200 && xhr.status < 300 && body?.data?.file) resolve(body.data.file.id);
      else reject(new Error(body?.message || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    const form = new FormData();
    form.append('conversationId', conversationId); // must precede the file field
    form.append('file', blob, 'blob');
    xhr.send(form);
  });
}

export async function downloadDecrypted(fileId, fileKeyB64) {
  if (!isValidFileId(fileId)) throw new Error('Invalid attachment');
  const res = await fetch(`/api/files/${fileId}`, { credentials: 'include' });
  if (!res.ok) throw new Error(res.status === 404 ? 'File is no longer available' : 'Could not download file');
  const data = new Uint8Array(await res.arrayBuffer());
  const plain = nacl.secretbox.open(data.slice(nacl.secretbox.nonceLength), data.slice(0, nacl.secretbox.nonceLength), decodeBase64(fileKeyB64));
  if (!plain) throw new Error('File is corrupted or was tampered with');
  return plain;
}

// Decrypted object URLs, shared so each attachment is downloaded and decrypted only once.
const urlCache = new Map();

export function getMediaUrl(payload) {
  if (!urlCache.has(payload.fileId)) {
    const promise = downloadDecrypted(payload.fileId, payload.fileKey)
      .then((plain) => {
        const mime = baseMime(payload.mimeType);
        const allowed = payload.type === 'image' ? IMAGE_TYPES.has(mime) : payload.type === 'audio' ? AUDIO_TYPES.has(mime) : false;
        return URL.createObjectURL(new Blob([plain], { type: allowed ? mime : 'application/octet-stream' }));
      })
      .catch((err) => { urlCache.delete(payload.fileId); throw err; });
    urlCache.set(payload.fileId, promise);
  }
  return urlCache.get(payload.fileId);
}

export function clearMediaCache() {
  urlCache.forEach((p) => p.then((u) => URL.revokeObjectURL(u)).catch(() => {}));
  urlCache.clear();
}

// Save any attachment to disk. The blob is always octet-stream so the browser never tries to render it.
export async function saveAttachment(payload) {
  const plain = await downloadDecrypted(payload.fileId, payload.fileKey);
  const url = URL.createObjectURL(new Blob([plain], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = sanitizeFileName(payload.fileName);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
