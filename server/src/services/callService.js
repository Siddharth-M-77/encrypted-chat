import { redis } from '../config/redis.js';

// Call state lives in Redis so every PM2 worker sees the same calls.
//   call:<id>     -> JSON { caller, callee, video, state: 'ringing' | 'active' }
//   usercall:<id> -> callId the user is currently in (used for "busy" detection)
const RING_TTL = 90; // seconds a call may ring
const ACTIVE_TTL = 4 * 60 * 60;

const callKey = (id) => `call:${id}`;
const userKey = (id) => `usercall:${id}`;

// Atomically reserve both users. Returns false if either is already in a call.
export async function createCall({ callId, caller, callee, video }) {
  const gotCaller = await redis.set(userKey(caller), callId, 'EX', RING_TTL, 'NX');
  if (!gotCaller) return false;
  const gotCallee = await redis.set(userKey(callee), callId, 'EX', RING_TTL, 'NX');
  if (!gotCallee) { await redis.del(userKey(caller)); return false; }
  const created = await redis.set(callKey(callId), JSON.stringify({ caller, callee, video, state: 'ringing' }), 'EX', RING_TTL, 'NX');
  if (!created) { await redis.del(userKey(caller), userKey(callee)); return false; }
  return true;
}

export async function getCall(callId) {
  const raw = await redis.get(callKey(callId));
  return raw ? JSON.parse(raw) : null;
}

export async function activateCall(callId, call) {
  await redis.multi()
    .set(callKey(callId), JSON.stringify({ ...call, state: 'active' }), 'EX', ACTIVE_TTL)
    .expire(userKey(call.caller), ACTIVE_TTL)
    .expire(userKey(call.callee), ACTIVE_TTL)
    .exec();
}

export async function deleteCall(callId, call) {
  await redis.del(callKey(callId), userKey(call.caller), userKey(call.callee));
}

export const callIdOf = (userId) => redis.get(userKey(userId));
