import { Message } from '../models/Message.js';
import { Conversation } from '../models/Conversation.js';
import { File } from '../models/File.js';
import { ApiError } from '../utils/ApiError.js';
import { emitTo } from './emit.js';
import { storage } from './storage/index.js';

const same = (a, b) => String(a) === String(b);

// Shape a message for one viewer. Senders get their own re-encrypted copy; recipients get the main copy.
export function serializeMessage(msg, viewerId) {
  const mine = same(msg.senderId, viewerId);
  const useSenderCopy = mine && msg.ciphertextForSender;
  const gone = msg.deletedForEveryone;
  return {
    id: String(msg._id),
    conversationId: String(msg.conversationId),
    senderId: String(msg.senderId),
    type: msg.type,
    ciphertext: gone ? '' : useSenderCopy ? msg.ciphertextForSender : msg.ciphertext,
    nonce: gone ? '' : useSenderCopy ? msg.nonceForSender : msg.nonce,
    keyVersion: msg.keyVersion,
    replyTo: msg.replyTo ? String(msg.replyTo) : null,
    status: (msg.status || []).map((s) => ({
      userId: String(s.userId), status: s.status, deliveredAt: s.deliveredAt, readAt: s.readAt,
    })),
    deletedForEveryone: gone,
    createdAt: msg.createdAt,
  };
}

export async function assertParticipant(conversationId, userId) {
  const conv = await Conversation.findOne({ _id: conversationId, participants: userId });
  if (!conv) throw ApiError.forbidden('Not a participant of this conversation');
  return conv;
}

// Cursor pagination: newest first, `before` is the id of the oldest message the client already has.
export async function listMessages(conversationId, userId, { before, limit }) {
  await assertParticipant(conversationId, userId);
  const filter = { conversationId, deletedFor: { $ne: userId } };
  if (before) filter._id = { $lt: before };
  const rows = await Message.find(filter).sort({ _id: -1 }).limit(limit + 1);
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  return {
    messages: page.map((m) => serializeMessage(m, userId)),
    hasMore,
    nextCursor: hasMore ? String(page[page.length - 1]._id) : null,
  };
}

// Move the caller's per-recipient status forward ('delivered' or 'read') on matching messages.
// Returns notifications grouped by sender so the caller can emit message:status events.
export async function advanceStatus(userId, { conversationId, ids }, target) {
  const from = target === 'read' ? { $ne: 'read' } : 'sent';
  const filter = { senderId: { $ne: userId }, deletedFor: { $ne: userId }, status: { $elemMatch: { userId, status: from } } };
  if (conversationId) filter.conversationId = conversationId;
  if (ids) filter._id = { $in: ids };
  const rows = await Message.find(filter).select('senderId conversationId').limit(1000).lean();
  if (!rows.length) return [];

  const now = new Date();
  const set = { 'status.$[s].status': target };
  set[target === 'read' ? 'status.$[s].readAt' : 'status.$[s].deliveredAt'] = now;
  await Message.updateMany(
    { _id: { $in: rows.map((r) => r._id) } },
    { $set: set },
    { arrayFilters: [{ 's.userId': userId, 's.status': from }] }
  );

  const groups = new Map();
  for (const r of rows) {
    const k = `${r.senderId}|${r.conversationId}`;
    if (!groups.has(k)) groups.set(k, { senderId: String(r.senderId), conversationId: String(r.conversationId), messageIds: [] });
    groups.get(k).messageIds.push(String(r._id));
  }
  return [...groups.values()].map((g) => ({ ...g, userId: String(userId), status: target, at: now }));
}

const DELETE_WINDOW_MS = 60 * 60 * 1000;

// scope "me": hide the message for this user only. scope "everyone": sender only, within one hour.
export async function deleteMessage(user, messageId, { scope, fileId }) {
  const msg = await Message.findById(messageId);
  if (!msg) throw ApiError.notFound('Message not found');
  const conv = await assertParticipant(msg.conversationId, user._id);
  const event = { conversationId: String(conv._id), messageId: String(msg._id) };

  if (scope === 'me') {
    await Message.updateOne({ _id: msg._id }, { $addToSet: { deletedFor: user._id } });
    emitTo([user._id], 'message:deleted', { ...event, scope: 'me' }); // keeps the user's other devices in sync
    return;
  }

  if (!msg.senderId.equals(user._id)) throw ApiError.forbidden('Only the sender can delete a message for everyone');
  if (msg.deletedForEveryone) return; // idempotent
  if (Date.now() - msg.createdAt.getTime() > DELETE_WINDOW_MS) {
    throw ApiError.badRequest('Messages can only be deleted for everyone within 1 hour of sending');
  }
  // Wipe the ciphertext but keep a tombstone so the other side can show "This message was deleted".
  await Message.updateOne(
    { _id: msg._id },
    { $set: { deletedForEveryone: true, ciphertext: '', nonce: '' }, $unset: { ciphertextForSender: 1, nonceForSender: 1 } }
  );
  // The file id is inside the encrypted payload, so the client tells us which blob to remove (ownership is verified).
  if (fileId) {
    const file = await File.findOne({ _id: fileId, ownerId: user._id, conversationId: conv._id });
    if (file) {
      await storage.remove(file.storagePath);
      await file.deleteOne();
    }
  }
  const audience = conv.participants.filter((p) => !msg.deletedFor.some((d) => d.equals(p))); // never reveal suppressed messages
  emitTo(audience, 'message:deleted', { ...event, scope: 'everyone' });
}
