import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { getIo } from '../sockets/io.js';
import { userRoom } from '../sockets/helpers.js';
import { endCallBetween } from '../sockets/calls.js';
import { isBlockedEitherWay } from './blockService.js';
import * as presence from './presenceService.js';

// After a block/unblock, each side must stop (or resume) seeing the other's presence immediately.
async function refreshPresencePair(io, a, b) {
  const blocked = await isBlockedEitherWay(a, b);
  const ids = [String(a), String(b)];
  const [online, users] = await Promise.all([presence.onlineMap(ids), User.find({ _id: { $in: ids } }).select('lastSeen').lean()]);
  const seen = Object.fromEntries(users.map((u) => [String(u._id), u.lastSeen]));
  for (const [from, to] of [ids, [...ids].reverse()]) {
    io.to(userRoom(to)).emit('presence:update', blocked
      ? { userId: from, online: false, lastSeen: null }
      : { userId: from, online: online[from], lastSeen: seen[from] });
  }
}

async function loadTarget(me, targetId) {
  if (String(targetId) === String(me._id)) throw ApiError.badRequest('You cannot block yourself');
  if (!(await User.exists({ _id: targetId }))) throw ApiError.notFound('User not found');
}

export async function blockUser(me, targetId) {
  await loadTarget(me, targetId);
  const updated = await User.findByIdAndUpdate(me._id, { $addToSet: { blockedUsers: targetId } }, { new: true });
  const io = getIo();
  if (io) {
    await endCallBetween(io, String(me._id), String(targetId));
    await refreshPresencePair(io, me._id, targetId);
  }
  return updated.toSelf();
}

export async function unblockUser(me, targetId) {
  await loadTarget(me, targetId);
  const updated = await User.findByIdAndUpdate(me._id, { $pull: { blockedUsers: targetId } }, { new: true });
  const io = getIo();
  if (io) await refreshPresencePair(io, me._id, targetId);
  return updated.toSelf();
}

export async function listBlocked(me) {
  const users = await User.find({ _id: { $in: me.blockedUsers } });
  return users.map((u) => u.toPublic());
}
