import toast from 'react-hot-toast';
import { api } from '../services/api.js';
import { emitAck, getSocket } from '../lib/socket.js';
import {
  decryptDirect, decryptGroup, encryptDirect, encryptGroup, generateGroupKey, unwrapGroupKey, wrapGroupKey,
} from '../lib/e2ee.js';
import { getGroupKey, getPublicKey, hasGroupKey, setGroupKey } from '../lib/keystore.js';
import { MAX_PLAINTEXT_BYTES, baseMime, encryptFile, kindOf, sanitizeFileName, uploadEncrypted } from '../lib/media.js';
import { otherUser, previewText, userTitle } from '../lib/format.js';
import {
  setConversations, upsertConversation, patchConversation, removeConversation, incUnread, clearUnread, setLoading,
  setMessages, addMessage, replaceTemp, patchTemp, removeMessage, markMessageDeleted, setPresence, setTyping, setActive,
} from './chatSlice.js';

const meOf = (getState) => getState().auth.user;

// ---- Decryption helpers ----

function toClientMessage(raw, conv, meId, extra = {}) {
  const mine = raw.senderId === meId;
  let payload = null;
  if (!raw.deletedForEveryone) {
    if (conv.type === 'group') {
      payload = decryptGroup(raw, conv.id);
    } else {
      const sender = conv.participants.find((p) => p.id === raw.senderId);
      payload = decryptDirect(raw, { mine, senderPublicKey: sender?.publicKey });
    }
  }
  return {
    id: raw.id,
    conversationId: raw.conversationId,
    senderId: raw.senderId,
    type: raw.type,
    payload,
    undecryptable: !payload && !raw.deletedForEveryone,
    deletedForEveryone: raw.deletedForEveryone,
    replyTo: raw.replyTo,
    createdAt: raw.createdAt,
    statuses: Object.fromEntries(raw.status.map((s) => [s.userId, s.status])),
    ...extra,
  };
}

// Conversation-list preview. In groups, messages from others are prefixed with the sender's name.
function previewFor(conv, m, meId) {
  const mine = m.senderId === meId;
  let sender = null;
  if (conv.type === 'group' && !mine) {
    const p = conv.participants.find((x) => x.id === m.senderId);
    sender = p ? userTitle(p) : 'Former member';
  }
  return { text: m.deletedForEveryone ? '🚫 Message deleted' : previewText(m.payload), mine, sender, at: m.createdAt, messageId: m.id };
}

function withPreview(conv, meId) {
  const { lastMessage, ...rest } = conv;
  return { ...rest, preview: lastMessage ? previewFor(conv, toClientMessage(lastMessage, conv, meId), meId) : null };
}

// ---- Group keys ----

function importGroupKeys(rows) {
  for (const row of rows) {
    if (hasGroupKey(row.conversationId, row.keyVersion)) continue;
    const key = unwrapGroupKey(row);
    if (key) setGroupKey(row.conversationId, row.keyVersion, key);
  }
}

export const loadGroupKeys = (convId) => async (dispatch) => {
  const { data } = await dispatch(api.endpoints.getGroupKeys.initiate(convId, { forceRefetch: true })).unwrap();
  importGroupKeys(data.keys);
};

export const ensureGroupKey = (convId, version) => async (dispatch) => {
  if (hasGroupKey(convId, version)) return true;
  try { await dispatch(loadGroupKeys(convId)); } catch { /* handled by caller via undecryptable state */ }
  return hasGroupKey(convId, version);
};

// Seal `key` for every participant except `excludeId` (our own copy included, sealed to our own public key).
function wrapForMembers(key, participants, excludeId = null) {
  return participants
    .filter((p) => p.id !== excludeId)
    .map((p) => ({ userId: p.id, ...wrapGroupKey(key, p.publicKey) }));
}

// ---- Conversations & messages ----

const rotating = new Set();

// If a member left, an admin client generates and distributes the next key.
export const maybeRotate = (conv) => async (dispatch, getState) => {
  const me = meOf(getState);
  if (conv.type !== 'group' || !conv.rotationPending || !conv.admins.includes(me.id) || rotating.has(conv.id)) return;
  rotating.add(conv.id);
  try {
    const key = generateGroupKey();
    const keyVersion = conv.keyVersion + 1;
    await dispatch(api.endpoints.rotateGroupKey.initiate({ id: conv.id, keyVersion, encryptedKeys: wrapForMembers(key, conv.participants) })).unwrap();
    setGroupKey(conv.id, keyVersion, key);
  } catch { /* another admin probably rotated first; the next conversation:updated resyncs */ } finally {
    rotating.delete(conv.id);
  }
};

export const fetchConversations = (page = 1) => async (dispatch, getState) => {
  const me = meOf(getState);
  const { data } = await dispatch(api.endpoints.getConversations.initiate({ page }, { forceRefetch: true })).unwrap();

  if (data.conversations.some((c) => c.type === 'group')) {
    try {
      const keys = await dispatch(api.endpoints.getAllGroupKeys.initiate(undefined, { forceRefetch: true })).unwrap();
      importGroupKeys(keys.data.keys);
    } catch { /* previews fall back to "Encrypted message" */ }
  }

  const list = data.conversations.map((c) => withPreview(c, me.id));
  dispatch(setConversations({ list, append: page > 1, hasMore: data.hasMore, page }));
  list.forEach((c) => dispatch(maybeRotate(c)));

  // After a reconnect the open, visible conversation may have unread messages from the resync.
  const { activeId } = getState().chat;
  if (activeId && document.visibilityState === 'visible' && getState().chat.convs[activeId]?.unreadCount > 0) dispatch(markRead(activeId));

  const ids = [...new Set(list.flatMap((c) => c.participants.map((p) => p.id)))].filter((id) => id !== me.id);
  if (ids.length) emitAck('presence:get', { userIds: ids }).then((r) => dispatch(setPresence(r.presence))).catch(() => {});
};

export const fetchMessages = (id, { older = false } = {}) => async (dispatch, getState) => {
  const me = meOf(getState);
  const bucket = getState().chat.messages[id];
  if (bucket?.loading || (older && (!bucket?.hasMore || !bucket.cursor))) return;
  const conv = getState().chat.convs[id];
  if (!conv) return;
  dispatch(setLoading({ id, loading: true }));
  try {
    if (conv.type === 'group' && !older) await dispatch(loadGroupKeys(id)).catch(() => {});
    const { data } = await dispatch(
      api.endpoints.getMessages.initiate({ id, before: older ? bucket.cursor : undefined }, { forceRefetch: true })
    ).unwrap();
    const current = getState().chat.convs[id] || conv;
    const items = [...data.messages].reverse().map((m) => toClientMessage(m, current, me.id)); // oldest first
    dispatch(setMessages({ id, items, hasMore: data.hasMore, cursor: data.nextCursor, prepend: older }));
  } catch (err) {
    dispatch(setLoading({ id, loading: false }));
    toast.error(err?.data?.message || 'Could not load messages');
  }
};

export const markRead = (id) => (dispatch) => {
  dispatch(clearUnread(id));
  emitAck('message:read', { conversationId: id }).catch(() => {});
};

export const openConversation = (id) => (dispatch, getState) => {
  dispatch(setActive(id));
  const st = getState().chat;
  if (!st.convs[id]) return;
  if (!st.messages[id]?.loaded) dispatch(fetchMessages(id));
  if (st.convs[id].unreadCount > 0) dispatch(markRead(id));
};

export const startDirectChat = (userId) => async (dispatch, getState) => {
  const me = meOf(getState);
  const { data } = await dispatch(api.endpoints.createDirect.initiate(userId)).unwrap();
  const conv = withPreview(data.conversation, me.id);
  dispatch(upsertConversation(conv));
  return conv.id;
};

// Encrypt, send over the socket, and reconcile the optimistic message with the server's copy.
// Returns true when the server accepted the message. `displayPayload` is what the UI keeps (e.g. with a local preview URL).
async function transmit(dispatch, getState, { conversationId, tempId, payload, replyTo, displayPayload }, retried = false) {
  const me = meOf(getState);
  const conv = getState().chat.convs[conversationId];
  try {
    let enc;
    if (conv.type === 'group') {
      if (!(await dispatch(ensureGroupKey(conv.id, conv.keyVersion)))) throw new Error('Group key unavailable');
      enc = encryptGroup(payload, conv.id, conv.keyVersion);
    } else {
      const other = otherUser(conv, me.id);
      if (!other?.publicKey) throw new Error('This user has not set up encryption yet');
      enc = encryptDirect(payload, other.publicKey);
    }
    const res = await emitAck('message:send', {
      tempId, conversationId, ...enc, type: payload.type, replyTo: replyTo || undefined, keyVersion: conv.keyVersion,
    });
    const msg = toClientMessage(res.message, conv, me.id);
    dispatch(replaceTemp({ tempId, message: { ...msg, payload: displayPayload || payload } }));
    dispatch(patchConversation({ id: conversationId, patch: { preview: previewFor(conv, { ...msg, payload }, me.id), updatedAt: msg.createdAt } }));
    return true;
  } catch (err) {
    // The group key rotated while we were composing: resync once and retry transparently.
    if (!retried && /key version/i.test(err.message)) {
      await dispatch(fetchConversations()).catch(() => {});
      await dispatch(loadGroupKeys(conversationId)).catch(() => {});
      return transmit(dispatch, getState, { conversationId, tempId, payload, replyTo, displayPayload }, true);
    }
    dispatch(patchTemp({ conversationId, tempId, patch: { local: 'failed', error: err.message } }));
    return false;
  }
}

export const sendText = (conversationId, text, replyTo) => (dispatch, getState) => {
  const me = meOf(getState);
  const tempId = crypto.randomUUID();
  const payload = { type: 'text', text };
  dispatch(addMessage({
    id: tempId, tempId, conversationId, senderId: me.id, type: 'text', payload, replyTo: replyTo || null,
    createdAt: new Date().toISOString(), statuses: {}, local: 'sending',
  }));
  return transmit(dispatch, getState, { conversationId, tempId, payload, replyTo });
};

// ---- Media ----

const pendingFiles = new Map(); // tempId -> { file, kind, mime, name, localUrl, replyTo }
const uploaded = new Map(); // tempId -> wire payload, so a retry after a failed send does not re-upload

async function uploadAndSend(dispatch, getState, conversationId, tempId) {
  const job = pendingFiles.get(tempId);
  try {
    let wire = uploaded.get(tempId);
    if (!wire) {
      dispatch(patchTemp({ conversationId, tempId, patch: { local: 'sending', error: null, upload: { stage: 'encrypting', progress: 0 } } }));
      const { blob, key } = await encryptFile(job.file);
      let last = -1;
      const fileId = await uploadEncrypted(blob, conversationId, (pct) => {
        if (pct === last) return; // only dispatch when the integer percentage changes
        last = pct;
        dispatch(patchTemp({ conversationId, tempId, patch: { upload: { stage: 'uploading', progress: pct } } }));
      });
      wire = { type: job.kind, fileId, fileKey: key, fileName: job.name, mimeType: job.mime, size: job.file.size };
      uploaded.set(tempId, wire);
    }
    dispatch(patchTemp({ conversationId, tempId, patch: { upload: { stage: 'sending', progress: 100 } } }));
    const ok = await transmit(dispatch, getState, {
      conversationId, tempId, payload: wire, replyTo: job.replyTo, displayPayload: { ...wire, localUrl: job.localUrl },
    });
    if (ok) { pendingFiles.delete(tempId); uploaded.delete(tempId); }
  } catch (err) {
    dispatch(patchTemp({ conversationId, tempId, patch: { local: 'failed', error: err.message, upload: null } }));
  }
}

export const sendMedia = (conversationId, file, replyTo) => (dispatch, getState) => {
  const me = meOf(getState);
  if (!file.size) return toast.error('That file is empty');
  if (file.size > MAX_PLAINTEXT_BYTES) return toast.error('Files can be at most 25 MB');
  const kind = kindOf(file);
  const mime = baseMime(file.type) || 'application/octet-stream';
  const name = sanitizeFileName(file.name || kind);
  const localUrl = kind === 'file' ? null : URL.createObjectURL(file); // instant local preview
  const tempId = crypto.randomUUID();
  pendingFiles.set(tempId, { file, kind, mime, name, localUrl, replyTo: replyTo || null });
  dispatch(addMessage({
    id: tempId, tempId, conversationId, senderId: me.id, type: kind, replyTo: replyTo || null,
    payload: { type: kind, fileName: name, mimeType: mime, size: file.size, localUrl },
    createdAt: new Date().toISOString(), statuses: {}, local: 'sending', upload: { stage: 'encrypting', progress: 0 },
  }));
  return uploadAndSend(dispatch, getState, conversationId, tempId);
};

export const retrySend = (conversationId, tempId) => (dispatch, getState) => {
  if (pendingFiles.has(tempId)) return uploadAndSend(dispatch, getState, conversationId, tempId);
  const m = getState().chat.messages[conversationId]?.items.find((x) => x.tempId === tempId);
  if (!m) return undefined;
  dispatch(patchTemp({ conversationId, tempId, patch: { local: 'sending', error: null } }));
  return transmit(dispatch, getState, { conversationId, tempId, payload: m.payload, replyTo: m.replyTo });
};

// ---- Group management ----

export const createGroup = (name, users) => async (dispatch, getState) => {
  const me = meOf(getState);
  const key = generateGroupKey();
  const members = [{ id: me.id, publicKey: getPublicKey() }, ...users];
  const { data } = await dispatch(api.endpoints.createGroup.initiate({
    name, memberIds: users.map((u) => u.id), encryptedKeys: wrapForMembers(key, members),
  })).unwrap();
  setGroupKey(data.conversation.id, 1, key);
  const conv = withPreview(data.conversation, me.id);
  dispatch(upsertConversation(conv));
  return conv.id;
};

export const renameGroup = (id, name) => async (dispatch) => {
  const { data } = await dispatch(api.endpoints.updateConversation.initiate({ id, name })).unwrap();
  dispatch(patchConversation({ id, patch: { name: data.conversation.name } }));
};

export const addGroupMembers = (id, users) => async (dispatch, getState) => {
  const me = meOf(getState);
  const conv = getState().chat.convs[id];
  if (!(await dispatch(ensureGroupKey(id, conv.keyVersion)))) throw new Error('Group key unavailable');
  const key = getGroupKey(id, conv.keyVersion);
  const { data } = await dispatch(api.endpoints.addMembers.initiate({
    id, userIds: users.map((u) => u.id), keyVersion: conv.keyVersion, encryptedKeys: wrapForMembers(key, users),
  })).unwrap();
  dispatch(upsertConversation({ ...withPreview(data.conversation, me.id), unreadCount: conv.unreadCount }));
};

// Removing a member also rotates the key; the removed user is excluded from the new key's recipients.
export const removeGroupMember = (id, userId) => async (dispatch, getState) => {
  const me = meOf(getState);
  const conv = getState().chat.convs[id];
  const key = generateGroupKey();
  const keyVersion = conv.keyVersion + 1;
  const { data } = await dispatch(api.endpoints.removeMember.initiate({
    id, userId, keyVersion, encryptedKeys: wrapForMembers(key, conv.participants, userId),
  })).unwrap();
  setGroupKey(id, keyVersion, key);
  dispatch(upsertConversation({ ...withPreview(data.conversation, me.id), unreadCount: conv.unreadCount }));
};

export const leaveGroup = (id) => async (dispatch) => {
  await dispatch(api.endpoints.leaveGroup.initiate(id)).unwrap();
  dispatch(removeConversation(id));
};

// ---- Incoming socket events ----

export const ingestIncoming = (raw) => async (dispatch, getState) => {
  const me = meOf(getState);
  let conv = getState().chat.convs[raw.conversationId];
  let fresh = false;
  if (!conv) {
    // First message of a conversation we do not know yet: reload the list (it already counts this message as unread).
    await dispatch(fetchConversations());
    conv = getState().chat.convs[raw.conversationId];
    if (!conv) return;
    fresh = true;
  }
  if (conv.type === 'group') await dispatch(ensureGroupKey(conv.id, raw.keyVersion));
  const msg = toClientMessage(raw, conv, me.id);
  if (getState().chat.messages[conv.id]?.loaded) dispatch(addMessage(msg));

  const mine = msg.senderId === me.id;
  const viewing = getState().chat.activeId === conv.id && document.visibilityState === 'visible';
  if (!fresh) {
    dispatch(patchConversation({ id: conv.id, patch: { preview: previewFor(conv, msg, me.id), updatedAt: msg.createdAt } }));
    if (!mine && !viewing) dispatch(incUnread(conv.id));
  }
  if (mine) return;
  if (viewing) dispatch(markRead(conv.id));
  else emitAck('message:delivered', { conversationId: conv.id, messageIds: [msg.id] }).catch(() => {});
};

// Group changed (rename, members, key version) or we were removed from it.
export const handleConversationUpdated = (p) => async (dispatch, getState) => {
  if (p.removed) {
    const had = getState().chat.convs[p.conversationId];
    dispatch(removeConversation(p.conversationId));
    if (had) toast(`You are no longer in "${had.name || 'this group'}"`);
    return;
  }
  const me = meOf(getState);
  const existing = getState().chat.convs[p.conversationId];
  const conv = p.conversation;
  if (conv.type === 'group') await dispatch(ensureGroupKey(conv.id, conv.keyVersion));
  const full = withPreview(conv, me.id);
  // The event carries no per-user unread count, so keep what we already track.
  dispatch(upsertConversation({ ...full, unreadCount: existing?.unreadCount ?? 0 }));
  dispatch(maybeRotate(full));
  if (!existing) emitAck('presence:get', { userIds: full.participants.map((x) => x.id).filter((id) => id !== me.id) })
    .then((r) => dispatch(setPresence(r.presence))).catch(() => {});
};

export const handleKeyRotated = ({ conversationId }) => (dispatch) => dispatch(loadGroupKeys(conversationId)).catch(() => {});

const typingTimers = new Map();
export const receiveTyping = ({ conversationId, userId, isTyping }) => (dispatch) => {
  dispatch(setTyping({ conversationId, userId, isTyping }));
  const k = `${conversationId}:${userId}`;
  clearTimeout(typingTimers.get(k));
  // Safety net: drop the indicator if the "stop" event never arrives.
  if (isTyping) typingTimers.set(k, setTimeout(() => dispatch(setTyping({ conversationId, userId, isTyping: false })), 5000));
};

export const emitTyping = (conversationId, isTyping) => () => {
  getSocket()?.emit(isTyping ? 'typing:start' : 'typing:stop', { conversationId });
};

// ---- Deleting messages ----

// Update local state (and the list preview) after a message was deleted, by us or by the sender.
const applyDeletion = ({ conversationId, messageId, scope }) => (dispatch, getState) => {
  dispatch(scope === 'me' ? removeMessage({ conversationId, id: messageId }) : markMessageDeleted({ conversationId, id: messageId }));
  const conv = getState().chat.convs[conversationId];
  if (conv?.preview?.messageId !== messageId) return;
  if (scope === 'everyone') dispatch(patchConversation({ id: conversationId, patch: { preview: { ...conv.preview, text: '🚫 Message deleted' } } }));
  else dispatch(fetchConversations()).catch(() => {}); // the previous message becomes the preview: let the server tell us which
};

export const deleteMessage = (conversationId, message, scope) => async (dispatch) => {
  // The file id lives in the encrypted payload, so we tell the server which blob to remove (it verifies ownership).
  const fileId = scope === 'everyone' ? message.payload?.fileId : undefined;
  await dispatch(api.endpoints.deleteMessage.initiate({ id: message.id, scope, fileId })).unwrap();
  dispatch(applyDeletion({ conversationId, messageId: message.id, scope }));
};

export const handleMessageDeleted = (p) => (dispatch) => dispatch(applyDeletion(p));
