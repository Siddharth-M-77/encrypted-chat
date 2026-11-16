import { env } from '../../config/env.js';
import { LocalStorage } from './localStorage.js';

// Storage backends implement: put(key, tempFilePath), createReadStream(key), remove(key).
// To move to S3/IPFS later, add a backend with the same three methods and select it here.
export const storage = new LocalStorage(env.UPLOAD_DIR);
export const uploadTmpDir = storage.tmpDir;
