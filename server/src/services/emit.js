import { getIo } from '../sockets/io.js';
import { userRoom } from '../sockets/helpers.js';

// Emit an event to every device of each listed user.
export function emitTo(userIds, event, payload) {
  const io = getIo();
  if (!io) return;
  for (const id of userIds) io.to(userRoom(String(id))).emit(event, payload);
}
