export const shortAddress = (a = '') => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');

export const userTitle = (u) => u?.displayName || (u?.username && `@${u.username}`) || shortAddress(u?.walletAddress) || 'Unknown';

export const otherUser = (conv, meId) => conv?.participants.find((p) => p.id !== meId) || null;

export function convTitle(conv, meId) {
  if (!conv) return '';
  return conv.type === 'group' ? conv.name || 'Group' : userTitle(otherUser(conv, meId));
}

export const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function dayLabel(date) {
  const d = new Date(date);
  const diff = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: diff < 7 ? 'long' : undefined, year: 'numeric', month: 'short', day: 'numeric' });
}

// Time for the conversation list: clock time today, otherwise a short date.
export function listTime(date) {
  if (!date) return '';
  const d = new Date(date);
  return startOfDay(d) === startOfDay(new Date()) ? formatTime(d) : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function lastSeenLabel(p) {
  if (!p) return '';
  if (p.online) return 'online';
  if (!p.lastSeen) return '';
  return `last seen ${dayLabel(p.lastSeen).toLowerCase()} at ${formatTime(p.lastSeen)}`;
}

export function previewText(payload) {
  if (!payload) return '🔒 Encrypted message';
  switch (payload.type) {
    case 'image': return '📷 Photo';
    case 'file': return `📎 ${payload.fileName || 'File'}`;
    case 'audio': return '🎤 Voice message';
    default: return payload.text || '';
  }
}
