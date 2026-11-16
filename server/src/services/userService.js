import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Search by exact wallet address or username prefix. Excludes the caller and users who blocked them.
export async function searchUsers(me, q) {
  const term = q.trim().toLowerCase();
  const filter = { _id: { $ne: me._id }, blockedUsers: { $ne: me._id } };

  if (/^0x[a-f0-9]{40}$/.test(term)) {
    filter.walletAddress = term;
  } else {
    filter.username = { $regex: `^${escapeRegex(term.replace(/^@/, ''))}` };
  }
  const users = await User.find(filter).limit(20);
  return users.map((u) => u.toPublic());
}

export async function getUserById(me, id) {
  const user = await User.findById(id);
  // Hide users who blocked the caller as if they do not exist.
  if (!user || user.blockedUsers.some((b) => b.equals(me._id))) throw ApiError.notFound('User not found');
  return user.toPublic();
}

export async function updateProfile(me, patch) {
  const { username, ...rest } = patch;
  Object.assign(me, rest);
  // A null username must be removed entirely: the sparse unique index would otherwise collide on repeated nulls.
  if (username !== undefined) me.username = username === null ? undefined : username;
  await me.save();
  return me.toSelf();
}

// Returns the caller's public key and the PIN-encrypted private key backup.
export async function getOwnKeys(userId) {
  const u = await User.findById(userId).select('+encryptedPrivateKeyBackup +keySalt');
  return {
    publicKey: u.publicKey,
    encryptedPrivateKeyBackup: u.encryptedPrivateKeyBackup,
    keySalt: u.keySalt,
  };
}

// First upload sets the public key. Later uploads (PIN change) must keep the same public key,
// because replacing it would make all previously received messages undecryptable.
export async function saveKeys(userId, { publicKey, encryptedPrivateKeyBackup, keySalt, replace }) {
  const u = await User.findById(userId);
  if (u.publicKey && u.publicKey !== publicKey && !replace) {
    throw ApiError.conflict('A different public key is already registered for this account');
  }
  u.publicKey = publicKey;
  u.encryptedPrivateKeyBackup = encryptedPrivateKeyBackup;
  u.keySalt = keySalt;
  await u.save();
  return u.toSelf();
}
