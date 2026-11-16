import { useMemo, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { selectUser } from '../../store/authSlice.js';
import { selectChat, selectConversationList } from '../../store/chatSlice.js';
import { fetchConversations } from '../../store/chatThunks.js';
import { useLogout } from '../../hooks/useSession.js';
import { convTitle, listTime, otherUser, shortAddress } from '../../lib/format.js';
import Avatar from '../Avatar.jsx';
import Icon from '../Icons.jsx';
import Skeleton from '../Skeleton.jsx';
import NewChatModal from './NewChatModal.jsx';
import NewGroupModal from './NewGroupModal.jsx';

function ConversationItem({ conv, meId, online }) {
  const other = conv.type === 'direct' ? otherUser(conv, meId) : null;
  const title = convTitle(conv, meId);
  const unread = conv.unreadCount > 0;
  return (
    <NavLink
      to={`/app/${conv.id}`}
      className={({ isActive }) => `group relative mx-2 flex items-center gap-3 rounded-2xl px-3 py-3 transition duration-150 ${
        isActive ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
      }`}
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-full bg-brand-gradient" />}
          <Avatar user={other || { id: conv.id, displayName: title, avatarUrl: conv.avatarUrl }} online={other ? online : undefined} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className={`truncate ${unread ? 'font-bold text-white' : 'font-semibold text-slate-100'}`}>{title}</p>
              <span className={`shrink-0 text-[11px] tabular-nums ${unread ? 'font-semibold text-brand-cyan' : 'text-slate-500'}`}>{listTime(conv.preview?.at || conv.updatedAt)}</span>
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-2">
              <p className={`truncate text-[13px] ${unread ? 'text-slate-200' : 'text-slate-500'}`}>
                {conv.preview
                  ? `${conv.preview.mine ? 'You: ' : conv.preview.sender ? `${conv.preview.sender}: ` : ''}${conv.preview.text}`
                  : <span className="italic">No messages yet</span>}
              </p>
              {unread && (
                <span className="min-w-[1.35rem] shrink-0 rounded-full bg-brand-gradient px-1.5 text-center text-[11px] font-bold leading-[1.35rem] text-white shadow-glow">
                  {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </NavLink>
  );
}

function EmptyList({ query, onStart }) {
  return (
    <div className="flex animate-fade-up flex-col items-center gap-4 px-8 py-14 text-center">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <div className="absolute inset-0 rounded-[32px] bg-brand-gradient opacity-20 blur-2xl" />
        <div className="relative flex h-20 w-20 rotate-6 items-center justify-center rounded-[28px] bg-brand-gradient-soft ring-1 ring-white/10">
          <Icon name="message" size={34} className="-rotate-6 text-brand-cyan" />
        </div>
      </div>
      <div>
        <p className="text-base font-bold">{query ? 'No matching chats' : 'No conversations yet'}</p>
        {!query && <p className="mt-1 text-sm text-slate-500">Find someone by username or wallet address to start an encrypted chat.</p>}
      </div>
      {!query && <button className="btn-primary !px-5 !py-3" onClick={onStart}><Icon name="plus" size={18} /> Start a chat</button>}
    </div>
  );
}

export default function Sidebar() {
  const me = useSelector(selectUser);
  const { convsLoaded, hasMore, page, presence, connected } = useSelector(selectChat);
  const list = useSelector(selectConversationList);
  const dispatch = useDispatch();
  const logout = useLogout();
  const [query, setQuery] = useState('');
  const [newChat, setNewChat] = useState(false);
  const [newGroup, setNewGroup] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => convTitle(c, me.id).toLowerCase().includes(q) || c.preview?.text?.toLowerCase().includes(q));
  }, [list, query, me.id]);

  return (
    <aside className="glass-strong flex h-full w-full flex-col rounded-none border-y-0 border-l-0">
      <header className="flex items-center gap-2 px-4 pb-3 pt-4">
        <Link to="/settings" className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-1 transition hover:bg-white/[0.04]" title="Profile & settings">
          <Avatar user={me} size={44} ring />
          <div className="min-w-0">
            <p className="truncate font-bold leading-tight">{me.displayName || (me.username && `@${me.username}`) || 'Set up your profile'}</p>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-slate-500">
              <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.9)]' : 'animate-pulse bg-amber-400'}`} />
              {connected ? shortAddress(me.walletAddress) : 'Connecting…'}
            </p>
          </div>
        </Link>
        <button className="icon-btn" onClick={() => setNewGroup(true)} aria-label="New group" title="New group"><Icon name="users" size={19} /></button>
        <button className="icon-btn !bg-brand-gradient !text-white shadow-glow hover:brightness-110" onClick={() => setNewChat(true)} aria-label="New chat" title="New chat"><Icon name="plus" size={20} strokeWidth={2.4} /></button>
      </header>

      <div className="px-4 pb-3">
        <div className="relative">
          <Icon name="search" size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input !rounded-full !py-2.5 !pl-10 text-sm" placeholder="Search chats" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <div className="flex-1 space-y-0.5 overflow-y-auto pb-3">
        {!convsLoaded && Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-3">
            <Skeleton className="h-11 w-11 !rounded-full" />
            <div className="flex-1 space-y-2"><Skeleton className="h-3 w-1/2" /><Skeleton className="h-3 w-3/4" /></div>
          </div>
        ))}
        {convsLoaded && filtered.length === 0 && <EmptyList query={query} onStart={() => setNewChat(true)} />}
        {filtered.map((c) => {
          const other = c.type === 'direct' ? otherUser(c, me.id) : null;
          return <ConversationItem key={c.id} conv={c} meId={me.id} online={Boolean(other && presence[other.id]?.online)} />;
        })}
        {hasMore && !query && (
          <button className="w-full p-3 text-sm font-medium text-slate-400 hover:text-white" onClick={() => dispatch(fetchConversations(page + 1))}>Load more</button>
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><Icon name="lock" size={13} className="text-emerald-400" /> End-to-end encrypted</span>
        <button className="flex items-center gap-1.5 rounded-lg px-2 py-1 font-medium transition hover:bg-white/[0.06] hover:text-white" onClick={logout} aria-label="Sign out">
          <Icon name="logout" size={14} /> Sign out
        </button>
      </footer>

      {newChat && <NewChatModal onClose={() => setNewChat(false)} />}
      {newGroup && <NewGroupModal onClose={() => setNewGroup(false)} />}
    </aside>
  );
}
