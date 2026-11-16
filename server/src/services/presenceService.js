import { redis } from '../config/redis.js';
import { User } from '../models/User.js';
import { Conversation } from '../models/Conversation.js';

const key = (id) => `presence:${id}`;

// Per-user connection counter so multiple tabs/devices count as one "online" user.
export async function connected(userId) {
  const n = await redis.incr(key(userId));
  await redis.expire(key(userId), 86400); // safety net against leaks after a crash
  return n === 1; // true => user just came online
}

export async function disconnected(userId) {
  const n = await redis.decr(key(userId));
  if (n <= 0) {
    await redis.del(key(userId));
    return true; // user just went offline
  }
  return false;
}

export async function onlineMap(ids) {
  if (!ids.length) return {};
  const vals = await redis.mget(ids.map(key));
  return Object.fromEntries(ids.map((id, i) => [id, Number(vals[i]) > 0]));
}

// Users who share a conversation with `userId` and are not blocked in either direction.
export async function visibleContacts(userId) {
  const [me, ids] = await Promise.all([
    User.findById(userId).select('blockedUsers').lean(),
    Conversation.find({ participants: userId }).distinct('participants'),
  ]);
  const contactIds = ids.map(String).filter((id) => id !== String(userId));
  if (!contactIds.length) return [];
  const iBlocked = new Set((me?.blockedUsers || []).map(String));
  const blockedMe = await User.find({ _id: { $in: contactIds }, blockedUsers: userId }).distinct('_id');
  const blockedMeSet = new Set(blockedMe.map(String));
  return contactIds.filter((id) => !iBlocked.has(id) && !blockedMeSet.has(id));
}
