import { User } from '../models/User.js';

// True when either user has blocked the other.
export async function isBlockedEitherWay(aId, bId) {
  const [a, b] = await Promise.all([
    User.findById(aId).select('blockedUsers').lean(),
    User.findById(bId).select('blockedUsers').lean(),
  ]);
  const has = (u, id) => (u?.blockedUsers || []).some((x) => String(x) === String(id));
  return has(a, bId) || has(b, aId);
}

// Of `ids`, which users have a block relationship (either direction) with `actorId`.
export async function blockedBetween(actorId, ids) {
  const [actor, blockers] = await Promise.all([
    User.findById(actorId).select('blockedUsers').lean(),
    User.find({ _id: { $in: ids }, blockedUsers: actorId }).select('_id').lean(),
  ]);
  const set = new Set((actor?.blockedUsers || []).map(String));
  blockers.forEach((b) => set.add(String(b._id)));
  return ids.filter((id) => set.has(String(id)));
}

// Directional block state between two users.
export async function blockState(aId, bId) {
  const [a, b] = await Promise.all([
    User.findById(aId).select('blockedUsers').lean(),
    User.findById(bId).select('blockedUsers').lean(),
  ]);
  const has = (u, id) => (u?.blockedUsers || []).some((x) => String(x) === String(id));
  return { aBlockedB: has(a, bId), bBlockedA: has(b, aId) };
}
