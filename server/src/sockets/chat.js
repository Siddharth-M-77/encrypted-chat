import { z } from 'zod';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { zObjectId } from '../utils/objectId.js';
import { hit } from '../utils/rateLimitRedis.js';
import { blockState, isBlockedEitherWay } from '../services/blockService.js';
import { advanceStatus, assertParticipant, serializeMessage } from '../services/messageService.js';
import * as presence from '../services/presenceService.js';
import { makeOn, userRoom } from './helpers.js';
import { endCallsOf } from './calls.js';

const b64 = (max) => z.string().max(max).regex(/^[A-Za-z0-9+/]+={0,2}$/, 'Invalid base64');
const sendSchema = z.object({
  tempId: z.string().min(1).max(64),
  conversationId: zObjectId,
  ciphertext: b64(20000),
  nonce: b64(64),
  ciphertextForSender: b64(20000).optional(),
  nonceForSender: b64(64).optional(),
  keyVersion: z.number().int().min(1).default(1),
  type: z.enum(['text', 'image', 'file', 'audio']).default('text'),
  replyTo: zObjectId.nullish(),
});
const idsSchema = z.object({ conversationId: zObjectId, messageIds: z.array(zObjectId).min(1).max(100) });
const convSchema = z.object({ conversationId: zObjectId });

export { userRoom };

export function registerChatHandlers(io, socket) {
  const uid = socket.data.userId;

  const on = makeOn(socket);

  const emitStatus = (notes) => {
    for (const n of notes) {
      const { senderId, ...body } = n;
      io.to(userRoom(senderId)).emit('message:status', body);
      if (body.status === 'read') io.to(userRoom(uid)).emit('message:status', body); // sync my other devices
    }
  };

  const otherParticipants = (conv) => conv.participants.filter((p) => String(p) !== uid);

  on('message:send', sendSchema, async (p) => {
    if (!(await hit(`rl:msg:${uid}`, 20, 10))) throw new ApiError(429, 'You are sending messages too fast');
    const conv = await assertParticipant(p.conversationId, uid);
    const others = otherParticipants(conv);
    let suppressed = false;

    if (conv.type === 'group' && p.keyVersion !== conv.keyVersion) {
      throw ApiError.conflict('Group key version changed, please retry');
    }
    if (conv.type === 'direct') {
      if (!p.ciphertextForSender || !p.nonceForSender) throw ApiError.badRequest('Sender copy is required');
      const other = await User.findById(others[0]).select('publicKey');
      if (!other) throw ApiError.notFound('Recipient not found');
      const block = await blockState(uid, other._id);
      if (block.aBlockedB) throw ApiError.forbidden('You blocked this user. Unblock them to send messages.');
      // If THEY blocked us, pretend everything worked: a visible error would reveal the block.
      suppressed = block.bBlockedA;
      if (!other.publicKey) throw ApiError.badRequest('Recipient has not set up encryption yet');
    }
    if (p.replyTo && !(await Message.exists({ _id: p.replyTo, conversationId: conv._id }))) {
      throw ApiError.badRequest('Invalid reply target');
    }

    const msg = await Message.create({
      conversationId: conv._id,
      senderId: uid,
      ciphertext: p.ciphertext,
      nonce: p.nonce,
      ciphertextForSender: p.ciphertextForSender,
      nonceForSender: p.nonceForSender,
      keyVersion: p.keyVersion,
      type: p.type,
      replyTo: p.replyTo || null,
      status: others.map((userId) => ({ userId, status: 'sent' })),
      deletedFor: suppressed ? others : [], // hidden from a recipient who blocked the sender; never delivered
    });
    if (!suppressed) {
      await Conversation.updateOne({ _id: conv._id }, { $set: { lastMessage: msg._id } }); // bumps updatedAt
      for (const o of others) io.to(userRoom(o)).emit('message:new', serializeMessage(msg, o));
    }
    // The sender's other devices receive the message too (this socket gets the ack instead).
    socket.to(userRoom(uid)).emit('message:new', serializeMessage(msg, uid));

    return { tempId: p.tempId, message: serializeMessage(msg, uid) };
  });

  on('message:delivered', idsSchema, async (p) => {
    await assertParticipant(p.conversationId, uid);
    emitStatus(await advanceStatus(uid, { conversationId: p.conversationId, ids: p.messageIds }, 'delivered'));
  });

  on('message:read', convSchema, async (p) => {
    await assertParticipant(p.conversationId, uid);
    emitStatus(await advanceStatus(uid, { conversationId: p.conversationId }, 'read'));
  });

  const typing = (isTyping) => async (p) => {
    if (!(await hit(`rl:typing:${uid}`, 60, 10))) return; // drop floods silently
    const conv = await assertParticipant(p.conversationId, uid);
    for (const o of otherParticipants(conv)) {
      if (conv.type === 'direct' && (await isBlockedEitherWay(uid, o))) continue;
      io.to(userRoom(o)).emit('typing', { conversationId: String(conv._id), userId: uid, isTyping });
    }
  };
  on('typing:start', convSchema, typing(true));
  on('typing:stop', convSchema, typing(false));

  on('conversation:join', convSchema, async (p) => {
    await assertParticipant(p.conversationId, uid);
    socket.join(`conversation:${p.conversationId}`);
  });

  // Initial presence snapshot for people the caller shares a conversation with.
  on('presence:get', z.object({ userIds: z.array(zObjectId).max(200) }), async (p) => {
    if (!(await hit(`rl:presence:${uid}`, 20, 60))) throw new ApiError(429, 'Too many requests');
    const visible = new Set(await presence.visibleContacts(uid));
    const ids = p.userIds.filter((id) => visible.has(id));
    const [online, users] = await Promise.all([
      presence.onlineMap(ids),
      User.find({ _id: { $in: ids } }).select('lastSeen').lean(),
    ]);
    const seen = Object.fromEntries(users.map((u) => [String(u._id), u.lastSeen]));
    return { presence: Object.fromEntries(ids.map((id) => [id, { online: online[id], lastSeen: seen[id] }])) };
  });
}

// Called once per connection / disconnection from sockets/index.js.
export async function onConnect(io, socket) {
  const uid = socket.data.userId;
  const cameOnline = await presence.connected(uid);
  // Anything sent while this user was offline is now delivered.
  const notes = await advanceStatus(uid, {}, 'delivered');
  for (const n of notes) {
    const { senderId, ...body } = n;
    io.to(userRoom(senderId)).emit('message:status', body);
  }
  if (cameOnline) await broadcastPresence(io, uid, true, new Date());
}

export async function onDisconnect(io, socket) {
  const uid = socket.data.userId;
  if (await presence.disconnected(uid)) {
    const lastSeen = new Date();
    await endCallsOf(io, uid); // a user who is fully offline cannot stay in a call
    await User.updateOne({ _id: uid }, { $set: { lastSeen } });
    await broadcastPresence(io, uid, false, lastSeen);
  }
}

async function broadcastPresence(io, uid, online, lastSeen) {
  for (const contact of await presence.visibleContacts(uid)) {
    io.to(userRoom(contact)).emit('presence:update', { userId: uid, online, lastSeen });
  }
}
