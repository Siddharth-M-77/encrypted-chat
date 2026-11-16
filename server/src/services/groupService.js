import { Conversation } from '../models/Conversation.js';
import { GroupKey } from '../models/GroupKey.js';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { blockedBetween } from './blockService.js';
import { loadConversation, serializeConversation } from './conversationService.js';
import { deleteConversationFiles } from './fileService.js';
import { emitTo, notifyConversation, notifyRemoved } from './notify.js';

const MAX_MEMBERS = 100;
const ids = (arr) => arr.map(String);

async function requireMembersWithKeys(userIds) {
  const users = await User.find({ _id: { $in: userIds } }).select('publicKey');
  if (users.length !== userIds.length) throw ApiError.notFound('One or more users were not found');
  if (users.some((u) => !u.publicKey)) throw ApiError.badRequest('A selected user has not set up encryption yet');
}

// The client must wrap the group key for exactly the members who should have it, no more and no fewer.
function assertKeysCover(keys, expectedIds) {
  const got = new Set(keys.map((k) => k.userId));
  if (got.size !== keys.length || got.size !== expectedIds.length || expectedIds.some((id) => !got.has(id))) {
    throw ApiError.badRequest('Group keys must be provided for exactly the expected members');
  }
}

const insertKeys = (conversationId, keyVersion, keys, byPublicKey) =>
  GroupKey.insertMany(keys.map((k) => ({
    conversationId, userId: k.userId, keyVersion, encryptedKey: k.encryptedKey, nonce: k.nonce, encryptedByPublicKey: byPublicKey,
  })));

async function loadGroup(userId, id) {
  const conv = await Conversation.findOne({ _id: id, type: 'group', participants: userId });
  if (!conv) throw ApiError.notFound('Group not found');
  return conv;
}
async function loadGroupAsAdmin(userId, id) {
  const conv = await loadGroup(userId, id);
  if (!conv.admins.some((a) => a.equals(userId))) throw ApiError.forbidden('Only group admins can do this');
  return conv;
}

export async function createGroup(user, { name, memberIds, encryptedKeys }) {
  const members = [...new Set([...ids(memberIds), String(user._id)])];
  if (members.length < 2) throw ApiError.badRequest('A group needs at least one other member');
  if (members.length > MAX_MEMBERS) throw ApiError.badRequest(`Groups are limited to ${MAX_MEMBERS} members`);
  await requireMembersWithKeys(members);
  if ((await blockedBetween(user._id, members.filter((m) => m !== String(user._id)))).length) {
    throw ApiError.forbidden('You cannot add a user who has blocked you or whom you blocked');
  }
  assertKeysCover(encryptedKeys, members);

  const conv = await Conversation.create({
    type: 'group', name, participants: members, admins: [user._id], createdBy: user._id, keyVersion: 1,
  });
  await insertKeys(conv._id, 1, encryptedKeys, user.publicKey);
  await notifyConversation(conv._id);
  return serializeConversation(await loadConversation(conv._id), user._id, 0);
}

export async function updateGroup(user, id, patch) {
  const conv = await loadGroupAsAdmin(user._id, id);
  Object.assign(conv, patch);
  await conv.save();
  await notifyConversation(conv._id);
  return serializeConversation(await loadConversation(conv._id), user._id, 0);
}

// Adding members does not rotate the key: the admin seals the CURRENT key for each newcomer.
export async function addMembers(user, id, { userIds, keyVersion, encryptedKeys }) {
  const conv = await loadGroupAsAdmin(user._id, id);
  if (keyVersion !== conv.keyVersion) throw ApiError.conflict('Group key changed, refresh and retry');
  const fresh = [...new Set(ids(userIds))];
  if (fresh.some((u) => conv.participants.some((p) => p.equals(u)))) throw ApiError.conflict('Already a member');
  if (conv.participants.length + fresh.length > MAX_MEMBERS) throw ApiError.badRequest(`Groups are limited to ${MAX_MEMBERS} members`);
  await requireMembersWithKeys(fresh);
  if ((await blockedBetween(user._id, fresh)).length) throw ApiError.forbidden('You cannot add this user');
  assertKeysCover(encryptedKeys, fresh);

  await insertKeys(conv._id, conv.keyVersion, encryptedKeys, user.publicKey);
  await Conversation.updateOne({ _id: conv._id }, { $addToSet: { participants: { $each: fresh } } });
  await notifyConversation(conv._id);
  return serializeConversation(await loadConversation(conv._id), user._id, 0);
}

// Removing a member rotates the key in the same request, so the removed user never learns the new key.
export async function removeMember(user, id, targetId, { keyVersion, encryptedKeys }) {
  const conv = await loadGroupAsAdmin(user._id, id);
  if (String(targetId) === String(user._id)) throw ApiError.badRequest('Use "leave" to leave the group');
  if (!conv.participants.some((p) => p.equals(targetId))) throw ApiError.notFound('Not a member of this group');
  if (conv.admins.some((a) => a.equals(targetId))) throw ApiError.forbidden('Admins cannot be removed');
  if (keyVersion !== conv.keyVersion + 1) throw ApiError.conflict('Group key changed, refresh and retry');

  const remaining = ids(conv.participants).filter((p) => p !== String(targetId));
  assertKeysCover(encryptedKeys, remaining);

  // The keyVersion filter makes the rotation atomic: only one concurrent rotation can win.
  const updated = await Conversation.findOneAndUpdate(
    { _id: conv._id, keyVersion: conv.keyVersion, participants: targetId },
    { $pull: { participants: targetId, admins: targetId }, $set: { keyVersion, rotationPending: false } },
    { new: true }
  );
  if (!updated) throw ApiError.conflict('Group changed, refresh and retry');

  await GroupKey.deleteMany({ conversationId: conv._id, userId: targetId });
  await insertKeys(conv._id, keyVersion, encryptedKeys, user.publicKey);
  notifyRemoved(targetId, conv._id);
  await notifyConversation(conv._id);
  emitTo(remaining, 'group:key-rotated', { conversationId: String(conv._id), keyVersion });
  return serializeConversation(await loadConversation(conv._id), user._id, 0);
}

// A leaver cannot safely generate the next key (they would know it), so rotation is deferred to an admin.
export async function leaveGroup(user, id) {
  const conv = await loadGroup(user._id, id);
  await GroupKey.deleteMany({ conversationId: conv._id, userId: user._id });
  const remaining = conv.participants.filter((p) => !p.equals(user._id));

  if (!remaining.length) {
    await Promise.all([deleteConversationFiles(conv._id), Message.deleteMany({ conversationId: conv._id }), GroupKey.deleteMany({ conversationId: conv._id }), conv.deleteOne()]);
    return;
  }
  const admins = conv.admins.filter((a) => !a.equals(user._id));
  if (!admins.length) admins.push(remaining[0]); // never leave a group without an admin
  await Conversation.updateOne(
    { _id: conv._id },
    { $set: { participants: remaining, admins, rotationPending: true } }
  );
  notifyRemoved(user._id, conv._id);
  await notifyConversation(conv._id);
}

// Completes a pending rotation (after someone left), or rotates on demand.
export async function rotateKeys(user, id, { keyVersion, encryptedKeys }) {
  const conv = await loadGroupAsAdmin(user._id, id);
  if (keyVersion !== conv.keyVersion + 1) throw ApiError.conflict('Group key already rotated');
  assertKeysCover(encryptedKeys, ids(conv.participants));

  const updated = await Conversation.findOneAndUpdate(
    { _id: conv._id, keyVersion: conv.keyVersion },
    { $set: { keyVersion, rotationPending: false } },
    { new: true }
  );
  if (!updated) throw ApiError.conflict('Group key already rotated');
  await insertKeys(conv._id, keyVersion, encryptedKeys, user.publicKey);
  await notifyConversation(conv._id);
  emitTo(ids(conv.participants), 'group:key-rotated', { conversationId: String(conv._id), keyVersion });
}

const serializeKey = (k) => ({
  conversationId: String(k.conversationId), keyVersion: k.keyVersion, encryptedKey: k.encryptedKey,
  nonce: k.nonce, encryptedByPublicKey: k.encryptedByPublicKey,
});

// All key versions the caller holds for one group.
export async function getKeys(userId, conversationId) {
  await loadGroup(userId, conversationId);
  const rows = await GroupKey.find({ conversationId, userId }).sort({ keyVersion: 1 });
  return rows.map(serializeKey);
}

// Every group key the caller holds, in one request (used to bootstrap the conversation list).
export async function getAllKeys(userId) {
  const rows = await GroupKey.find({ userId }).limit(5000);
  return rows.map(serializeKey);
}
