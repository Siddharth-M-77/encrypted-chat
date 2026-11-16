import { z } from 'zod';
import { Conversation } from '../models/Conversation.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { zObjectId } from '../utils/objectId.js';
import { hit } from '../utils/rateLimitRedis.js';
import { blockState } from '../services/blockService.js';
import * as calls from '../services/callService.js';
import * as presence from '../services/presenceService.js';
import { makeOn, userRoom } from './helpers.js';

const callId = z.string().uuid();
const sdp = z.string().min(10).max(30000);
const candidate = z.object({
  candidate: z.string().max(2000),
  sdpMid: z.string().max(100).nullish(),
  sdpMLineIndex: z.number().int().min(0).max(255).nullish(),
  usernameFragment: z.string().max(100).nullish(),
});

// Load a call and make sure the caller of this handler is one of its two participants.
async function requireParticipant(id, uid) {
  const call = await calls.getCall(id);
  if (!call || (call.caller !== uid && call.callee !== uid)) throw ApiError.notFound('Call not found');
  return call;
}

export function registerCallHandlers(io, socket) {
  const uid = socket.data.userId;
  const on = makeOn(socket);

  on('call:offer', z.object({ callId, to: zObjectId, conversationId: zObjectId, video: z.boolean(), sdp }), async (p) => {
    if (!(await hit(`rl:call:${uid}`, 10, 60))) throw new ApiError(429, 'Too many call attempts');
    if (p.to === uid) throw ApiError.badRequest('You cannot call yourself');

    // Calls are only allowed inside an existing 1:1 conversation, and never across a block.
    const conv = await Conversation.exists({ _id: p.conversationId, type: 'direct', participants: { $all: [uid, p.to] } });
    if (!conv) throw ApiError.forbidden('You can only call people you have a chat with');
    const block = await blockState(uid, p.to);
    if (block.aBlockedB) throw ApiError.forbidden('You blocked this user. Unblock them to call.');
    // "They blocked us" and "they are offline" look identical to the caller, so a block is not revealed.
    if (block.bBlockedA || !(await presence.onlineMap([p.to]))[p.to]) throw ApiError.conflict('User is unavailable');

    if (!(await calls.createCall({ callId: p.callId, caller: uid, callee: p.to, video: p.video }))) {
      throw ApiError.conflict('User is busy');
    }
    const caller = await User.findById(uid);
    io.to(userRoom(p.to)).emit('call:incoming', {
      callId: p.callId, conversationId: p.conversationId, video: p.video, sdp: p.sdp, from: caller.toPublic(),
    });
  });

  on('call:answer', z.object({ callId, sdp }), async (p) => {
    const call = await requireParticipant(p.callId, uid);
    if (call.callee !== uid || call.state !== 'ringing') throw ApiError.badRequest('Call cannot be answered');
    await calls.activateCall(p.callId, call);
    io.to(userRoom(call.caller)).emit('call:answered', { callId: p.callId, sdp: p.sdp });
    // The user's other devices stop ringing: this one took the call.
    socket.to(userRoom(uid)).emit('call:ended', { callId: p.callId, reason: 'answered_elsewhere' });
  });

  on('call:ice-candidate', z.object({ callId, candidate }), async (p) => {
    const call = await requireParticipant(p.callId, uid);
    const other = call.caller === uid ? call.callee : call.caller;
    io.to(userRoom(other)).emit('call:ice-candidate', { callId: p.callId, candidate: p.candidate });
  });

  on('call:reject', z.object({ callId }), async (p) => {
    const call = await requireParticipant(p.callId, uid);
    if (call.callee !== uid || call.state !== 'ringing') throw ApiError.badRequest('Call cannot be rejected');
    await calls.deleteCall(p.callId, call);
    io.to(userRoom(call.caller)).emit('call:ended', { callId: p.callId, reason: 'rejected' });
    socket.to(userRoom(uid)).emit('call:ended', { callId: p.callId, reason: 'rejected_elsewhere' });
  });

  on('call:end', z.object({ callId }), async (p) => {
    const call = await calls.getCall(p.callId);
    if (!call) return; // already over: ending twice is harmless
    if (call.caller !== uid && call.callee !== uid) throw ApiError.notFound('Call not found');
    await calls.deleteCall(p.callId, call);
    const other = call.caller === uid ? call.callee : call.caller;
    // Caller hanging up while it still rings = "cancelled": every device of the callee stops ringing.
    const reason = call.state === 'ringing' && call.caller === uid ? 'cancelled' : 'ended';
    io.to(userRoom(other)).emit('call:ended', { callId: p.callId, reason });
  });
}

// When a user's last connection drops, tear down their call and tell the other side.
export async function endCallsOf(io, uid) {
  const id = await calls.callIdOf(uid);
  if (!id) return;
  const call = await calls.getCall(id);
  if (!call) return;
  await calls.deleteCall(id, call);
  const other = call.caller === uid ? call.callee : call.caller;
  io.to(userRoom(other)).emit('call:ended', { callId: id, reason: 'disconnected' });
}

// Called when one user blocks the other: any call between them is torn down on both sides.
export async function endCallBetween(io, a, b) {
  const id = await calls.callIdOf(a);
  if (!id) return;
  const call = await calls.getCall(id);
  if (!call || ![call.caller, call.callee].includes(String(b))) return;
  await calls.deleteCall(id, call);
  io.to(userRoom(a)).emit('call:ended', { callId: id, reason: 'ended' });
  io.to(userRoom(b)).emit('call:ended', { callId: id, reason: 'ended' });
}
