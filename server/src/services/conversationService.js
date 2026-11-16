import { Conversation, directKeyFor } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { serializeMessage } from './messageService.js';

// Shape a conversation for one viewer (participants are public profiles, lastMessage is ciphertext).
export function serializeConversation(conv, viewerId, unreadCount = 0) {
  return {
    id: String(conv._id),
    type: conv.type,
    name: conv.name ?? null,
    avatarUrl: conv.avatarUrl ?? null,
    participants: conv.participants.map((p) => p.toPublic()),
    admins: conv.admins.map(String),
    createdBy: String(conv.createdBy),
    keyVersion: conv.keyVersion,
    rotationPending: Boolean(conv.rotationPending),
    lastMessage: conv.lastMessage?.ciphertext !== undefined ? serializeMessage(conv.lastMessage, viewerId) : null,
    unreadCount,
    updatedAt: conv.updatedAt,
    createdAt: conv.createdAt,
  };
}

export const populateConv = (q) => q.populate('participants').populate('lastMessage');

async function unreadCounts(userId, conversationIds) {
  if (!conversationIds.length) return new Map();
  const rows = await Message.aggregate([
    {
      $match: {
        conversationId: { $in: conversationIds },
        senderId: { $ne: userId },
        deletedForEveryone: false,
        deletedFor: { $ne: userId },
        status: { $elemMatch: { userId, status: { $ne: 'read' } } },
      },
    },
    { $group: { _id: '$conversationId', n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

export async function listConversations(user, { page, limit }) {
  // Conversations show up for everyone once they have a message; the creator also sees empty ones.
  const filter = {
    participants: user._id,
    $or: [{ lastMessage: { $ne: null } }, { createdBy: user._id }, { type: 'group' }],
  };
  const rows = await populateConv(
    Conversation.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit + 1)
  );
  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);
  const counts = await unreadCounts(user._id, pageRows.map((c) => c._id));
  return {
    conversations: pageRows.map((c) => serializeConversation(c, user._id, counts.get(String(c._id)) || 0)),
    page,
    hasMore,
  };
}

export async function createDirect(user, targetId) {
  if (String(targetId) === String(user._id)) throw ApiError.badRequest('You cannot chat with yourself');
  const target = await User.findById(targetId).select('_id');
  if (!target) throw ApiError.notFound('User not found');

  const directKey = directKeyFor(user._id, target._id);
  let conv = await Conversation.findOne({ directKey });
  if (!conv) {
    try {
      conv = await Conversation.create({
        type: 'direct', participants: [user._id, target._id], createdBy: user._id, directKey,
      });
    } catch (err) {
      if (err?.code !== 11000) throw err;
      conv = await Conversation.findOne({ directKey }); // lost a creation race
    }
  }
  const full = await populateConv(Conversation.findById(conv._id));
  return serializeConversation(full, user._id, 0);
}

export async function loadConversation(id) {
  return populateConv(Conversation.findById(id));
}
