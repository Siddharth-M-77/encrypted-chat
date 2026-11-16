import { useEffect } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { connectSocket, disconnectSocket } from '../lib/socket.js';
import { selectUser } from '../store/authSlice.js';
import { applyStatus, clearUnread, setConnected, updatePresence } from '../store/chatSlice.js';
import {
  fetchConversations, fetchMessages, handleConversationUpdated, handleKeyRotated, handleMessageDeleted, ingestIncoming, markRead, receiveTyping,
} from '../store/chatThunks.js';

// Connects the authenticated socket and routes server events into the store. Mounted once, inside the key gate.
export function useChatSocket() {
  const dispatch = useDispatch();
  const store = useStore();
  const me = useSelector(selectUser);

  useEffect(() => {
    const socket = connectSocket();
    let firstConnect = true;

    const onConnect = () => {
      dispatch(setConnected(true));
      dispatch(fetchConversations()).catch(() => {});
      // After a reconnect, re-sync the open conversation to pick up anything missed.
      const active = store.getState().chat.activeId;
      if (!firstConnect && active) dispatch(fetchMessages(active));
      firstConnect = false;
    };
    const onStatus = (p) => {
      dispatch(applyStatus(p));
      // Another of my devices read the conversation: clear the badge here too.
      if (p.userId === me.id && p.status === 'read') dispatch(clearUnread(p.conversationId));
    };
    const onVisible = () => {
      const { activeId, convs } = store.getState().chat;
      if (document.visibilityState === 'visible' && activeId && convs[activeId]?.unreadCount > 0) dispatch(markRead(activeId));
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', () => dispatch(setConnected(false)));
    socket.on('message:new', (m) => dispatch(ingestIncoming(m)));
    socket.on('message:status', onStatus);
    socket.on('conversation:updated', (p) => dispatch(handleConversationUpdated(p)));
    socket.on('group:key-rotated', (p) => dispatch(handleKeyRotated(p)));
    socket.on('message:deleted', (p) => dispatch(handleMessageDeleted(p)));
    // The handshake is rejected when the session cookie is gone or expired.
    socket.on('connect_error', (err) => { if (err.message === 'unauthorized') dispatch({ type: 'auth/sessionExpired' }); });
    socket.on('typing', (p) => dispatch(receiveTyping(p)));
    socket.on('presence:update', (p) => dispatch(updatePresence(p)));
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      disconnectSocket();
    };
  }, [dispatch, store, me.id]);
}
