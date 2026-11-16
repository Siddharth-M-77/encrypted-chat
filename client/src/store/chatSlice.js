import { createSlice, createSelector } from '@reduxjs/toolkit';

const RANK = { sent: 1, delivered: 2, read: 3 };
const bucket = () => ({ items: [], hasMore: false, cursor: null, loaded: false, loading: false });
const ensure = (s, id) => (s.messages[id] ||= bucket());
const keyOf = (m) => m.tempId || m.id;

const slice = createSlice({
  name: 'chat',
  initialState: {
    convs: {}, convsLoaded: false, hasMore: false, page: 1,
    messages: {}, presence: {}, typing: {}, activeId: null, connected: false,
  },
  reducers: {
    setConnected: (s, { payload }) => { s.connected = payload; },
    setActive: (s, { payload }) => { s.activeId = payload; },

    setConversations: (s, { payload: { list, append, hasMore, page } }) => {
      if (!append) s.convs = {};
      for (const c of list) s.convs[c.id] = c;
      s.convsLoaded = true; s.hasMore = hasMore; s.page = page;
    },
    upsertConversation: (s, { payload }) => { s.convs[payload.id] = { ...s.convs[payload.id], ...payload }; },
    patchConversation: (s, { payload: { id, patch } }) => { if (s.convs[id]) Object.assign(s.convs[id], patch); },
    removeConversation: (s, { payload }) => {
      delete s.convs[payload]; delete s.messages[payload]; delete s.typing[payload];
      if (s.activeId === payload) s.activeId = null;
    },
    incUnread: (s, { payload }) => { if (s.convs[payload]) s.convs[payload].unreadCount += 1; },
    clearUnread: (s, { payload }) => { if (s.convs[payload]) s.convs[payload].unreadCount = 0; },

    setLoading: (s, { payload: { id, loading } }) => { ensure(s, id).loading = loading; },
    setMessages: (s, { payload: { id, items, hasMore, cursor, prepend } }) => {
      const b = ensure(s, id);
      if (prepend) {
        const have = new Set(b.items.map(keyOf));
        b.items = [...items.filter((m) => !have.has(keyOf(m))), ...b.items];
      } else {
        // The fetched page is a snapshot. Keep anything we added while it was in flight: optimistic messages, and
        // messages (sent or received) newer than the snapshot. Otherwise a fast reply would vanish when the load finishes.
        const newest = items.length ? new Date(items[items.length - 1].createdAt).getTime() : 0;
        const have = new Set(items.map((i) => i.id));
        b.items = [...items, ...b.items.filter((m) => !have.has(m.id) && (m.local || new Date(m.createdAt).getTime() >= newest))];
      }
      b.hasMore = hasMore; b.cursor = cursor; b.loaded = true; b.loading = false;
    },
    addMessage: (s, { payload }) => {
      const b = ensure(s, payload.conversationId);
      if (b.items.some((m) => m.id === payload.id || (payload.tempId && m.tempId === payload.tempId))) return;
      b.items.push(payload);
    },
    replaceTemp: (s, { payload: { tempId, message } }) => {
      const b = ensure(s, message.conversationId);
      const i = b.items.findIndex((m) => m.tempId === tempId);
      if (i >= 0) b.items[i] = { ...message, tempId };
      else if (!b.items.some((m) => m.id === message.id)) b.items.push({ ...message, tempId });
    },
    patchTemp: (s, { payload: { conversationId, tempId, patch } }) => {
      const m = ensure(s, conversationId).items.find((x) => x.tempId === tempId);
      if (m) Object.assign(m, patch);
    },
    removeMessage: (s, { payload: { conversationId, id } }) => {
      const b = s.messages[conversationId];
      if (b) b.items = b.items.filter((m) => m.id !== id);
    },
    markMessageDeleted: (s, { payload: { conversationId, id } }) => {
      const m = s.messages[conversationId]?.items.find((x) => x.id === id);
      if (m) { m.deletedForEveryone = true; m.payload = null; m.undecryptable = false; }
    },
    applyStatus: (s, { payload: { conversationId, messageIds, userId, status } }) => {
      const ids = new Set(messageIds);
      for (const m of ensure(s, conversationId).items) {
        if (ids.has(m.id) && (RANK[m.statuses[userId]] || 0) < RANK[status]) m.statuses[userId] = status;
      }
    },

    setPresence: (s, { payload }) => { Object.assign(s.presence, payload); },
    updatePresence: (s, { payload: { userId, online, lastSeen } }) => { s.presence[userId] = { online, lastSeen }; },
    setTyping: (s, { payload: { conversationId, userId, isTyping } }) => {
      s.typing[conversationId] = { ...s.typing[conversationId], [userId]: isTyping };
    },
    resetChat: () => slice.getInitialState(),
  },
});

export const {
  setConnected, setActive, setConversations, upsertConversation, removeConversation, patchConversation, incUnread, clearUnread,
  setLoading, setMessages, addMessage, replaceTemp, patchTemp, removeMessage, markMessageDeleted, applyStatus, setPresence, updatePresence, setTyping, resetChat,
} = slice.actions;
export default slice.reducer;

export const selectChat = (s) => s.chat;
export const selectConversationList = createSelector([(s) => s.chat.convs], (convs) =>
  Object.values(convs).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
);
