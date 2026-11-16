import { io } from 'socket.io-client';

let socket = null;

export const getSocket = () => socket;

// Same-origin connection (Vite proxy in dev, Nginx in prod); the JWT cookie authenticates the handshake.
export function connectSocket() {
  if (!socket) socket = io({ withCredentials: true });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

// Emit with an acknowledgement; resolves with the server reply or rejects with its error message.
export function emitAck(event, payload, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) return reject(new Error('Not connected. Check your connection.'));
    socket.timeout(timeoutMs).emit(event, payload, (err, res) => {
      if (err) return reject(new Error('Request timed out'));
      if (!res?.ok) return reject(new Error(res?.message || 'Request failed'));
      resolve(res);
    });
  });
}
