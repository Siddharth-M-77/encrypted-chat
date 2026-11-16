import { useEffect } from 'react';
import { connectSocket } from '../lib/socket.js';
import {
  handleAnswered, handleEnded, handleIncoming, handleRemoteCandidate, resetCalls,
} from '../lib/callManager.js';

// Routes call:* socket events into the call manager. Must run after useChatSocket (which creates the socket).
export function useCallSignaling() {
  useEffect(() => {
    const socket = connectSocket();
    socket.on('call:incoming', handleIncoming);
    socket.on('call:answered', handleAnswered);
    socket.on('call:ice-candidate', handleRemoteCandidate);
    socket.on('call:ended', handleEnded);
    return () => {
      socket.off('call:incoming', handleIncoming);
      socket.off('call:answered', handleAnswered);
      socket.off('call:ice-candidate', handleRemoteCandidate);
      socket.off('call:ended', handleEnded);
      resetCalls();
    };
  }, []);
}
