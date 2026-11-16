import { emitTo } from './emit.js';
import { loadConversation, serializeConversation } from './conversationService.js';

export { emitTo };

// Push the fresh conversation state (members, name, key version…) to every current participant.
export async function notifyConversation(conversationId) {
  const conv = await loadConversation(conversationId);
  if (!conv) return;
  for (const p of conv.participants) {
    emitTo([p._id], 'conversation:updated', { conversationId: String(conv._id), conversation: serializeConversation(conv, p._id, 0) });
  }
}

// Tell a user they are no longer part of the conversation.
export const notifyRemoved = (userId, conversationId) =>
  emitTo([userId], 'conversation:updated', { conversationId: String(conversationId), removed: true });
