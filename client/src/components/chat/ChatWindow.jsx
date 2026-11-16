import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { selectUser } from '../../store/authSlice.js';
import { selectChat } from '../../store/chatSlice.js';
import { startCall } from '../../lib/callManager.js';
import { deleteMessage, fetchMessages, openConversation, retrySend } from '../../store/chatThunks.js';
import { convTitle, dayLabel, lastSeenLabel, otherUser, userTitle } from '../../lib/format.js';
import Avatar from '../Avatar.jsx';
import Icon from '../Icons.jsx';
import Skeleton from '../Skeleton.jsx';
import MessageBubble from './MessageBubble.jsx';
import Composer from './Composer.jsx';
import TypingIndicator from './TypingIndicator.jsx';
import ChatInfoModal from './ChatInfoModal.jsx';
import GroupInfoModal from './GroupInfoModal.jsx';

const EMPTY = [];
const RUN_GAP_MS = 5 * 60 * 1000; // messages further apart than this start a new visual run

function MessageList({ id, items, loading, hasMore, meId, typing, onReply, nameOf }) {
  const dispatch = useDispatch();
  const onDelete = (msg, scope) => dispatch(deleteMessage(id, msg, scope)).catch((err) => toast.error(err?.data?.message || 'Could not delete the message'));
  const ref = useRef(null);
  const nearBottom = useRef(true);
  const restore = useRef(null); // distance from bottom to restore after prepending older messages
  const [showJump, setShowJump] = useState(false);

  const byId = useMemo(() => new Map(items.map((m) => [m.id, m])), [items]);

  // Keep the viewport stable when older messages are prepended; otherwise stick to the bottom if the user is there.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (restore.current !== null) {
      el.scrollTop = el.scrollHeight - restore.current;
      restore.current = null;
    } else if (nearBottom.current || items[items.length - 1]?.senderId === meId) {
      el.scrollTop = el.scrollHeight;
    }
  }, [items, typing, meId]);

  const onScroll = useCallback(() => {
    const el = ref.current;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    nearBottom.current = distance < 150;
    setShowJump(distance > 500);
    if (el.scrollTop < 80 && hasMore && !loading) {
      restore.current = el.scrollHeight - el.scrollTop;
      dispatch(fetchMessages(id, { older: true }));
    }
  }, [dispatch, id, hasMore, loading]);

  const jumpToBottom = () => ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' });

  let lastDay = null;
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={ref} onScroll={onScroll} className="flex-1 overflow-y-auto px-3 py-4 md:px-8">
        {loading && <div className="py-2 text-center text-xs text-slate-500">Loading earlier messages…</div>}
        {items.map((m, i) => {
          const day = dayLabel(m.createdAt);
          const showDay = day !== lastDay;
          lastDay = day;
          const prev = items[i - 1];
          const next = items[i + 1];
          const near = (a, b) => Math.abs(new Date(b.createdAt) - new Date(a.createdAt)) < RUN_GAP_MS;
          const groupedPrev = Boolean(prev && !showDay && prev.senderId === m.senderId && near(prev, m));
          const groupedNext = Boolean(next && dayLabel(next.createdAt) === day && next.senderId === m.senderId && near(m, next));
          return (
            <div key={m.tempId || m.id}>
              {showDay && (
                <div className="my-5 flex justify-center">
                  <span className="glass rounded-full px-3.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{day}</span>
                </div>
              )}
              <MessageBubble
                message={m}
                meId={meId}
                original={m.replyTo ? byId.get(m.replyTo) : null}
                senderName={nameOf && m.senderId !== meId ? nameOf(m.senderId) : null}
                groupedPrev={groupedPrev}
                groupedNext={groupedNext}
                onReply={onReply}
                onDelete={onDelete}
                onRetry={(msg) => dispatch(retrySend(id, msg.tempId))}
              />
            </div>
          );
        })}
        {typing && <div className="pt-3"><TypingIndicator /></div>}
      </div>

      {showJump && (
        <button onClick={jumpToBottom} aria-label="Jump to latest" className="glass-strong absolute bottom-4 right-5 flex h-11 w-11 animate-scale-in items-center justify-center rounded-full text-slate-200 hover:text-white">
          <Icon name="arrowLeft" size={18} className="-rotate-90" />
        </button>
      )}
    </div>
  );
}

function EmptyChat({ conv, meId }) {
  const group = conv.type === 'group';
  return (
    <div className="flex flex-1 animate-fade-up flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="relative">
        <div className="absolute inset-0 animate-ring rounded-full bg-brand-purple/30" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-brand-gradient-soft text-brand-cyan ring-1 ring-white/10">
          <Icon name="shield" size={34} />
        </div>
      </div>
      <div>
        <p className="text-xl font-bold tracking-tight">Say hello</p>
        <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-slate-400">
          Messages in this chat are end-to-end encrypted. Only {group ? 'group members' : `you and ${convTitle(conv, meId)}`} can read them.
        </p>
      </div>
    </div>
  );
}

export default function ChatWindow({ id }) {
  const me = useSelector(selectUser);
  const { convs, convsLoaded, messages, presence, typing } = useSelector(selectChat);
  const callStatus = useSelector((st) => st.call.status);
  const dispatch = useDispatch();
  const [replyTo, setReplyTo] = useState(null);
  const [info, setInfo] = useState(false);

  const conv = convs[id];
  const bucket = messages[id];

  // (Re)open whenever the route or the conversation list changes (e.g. conversation list finished loading).
  useEffect(() => { if (conv) dispatch(openConversation(id)); }, [dispatch, id, Boolean(conv)]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setReplyTo(null); setInfo(false); }, [id]);

  if (!conv) {
    return (
      <div className="bg-chat flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        {convsLoaded ? (
          <>
            <p className="text-lg font-semibold">Conversation not found</p>
            <Link to="/app" className="btn-ghost">Back to chats</Link>
          </>
        ) : <Skeleton className="h-10 w-48" />}
      </div>
    );
  }

  const other = conv.type === 'direct' ? otherUser(conv, me.id) : null;
  const online = Boolean(other && presence[other.id]?.online);
  const someoneTyping = Object.entries(typing[id] || {}).some(([uid, t]) => t && uid !== me.id);
  const nameOf = conv.type === 'group'
    ? (uid) => { const p = conv.participants.find((x) => x.id === uid); return p ? userTitle(p) : 'Former member'; }
    : null;
  const typers = Object.entries(typing[id] || {}).filter(([uid, t]) => t && uid !== me.id).map(([uid]) => nameOf?.(uid));
  const subtitle = someoneTyping
    ? (nameOf ? `${typers.join(', ')} typing…` : 'typing…')
    : other ? lastSeenLabel(presence[other.id]) : `${conv.participants.length} members`;
  const iBlocked = Boolean(other && me.blockedUsers?.includes(other.id));
  const disabledReason = iBlocked
    ? `You blocked ${convTitle(conv, me.id)}. Unblock them in chat info to send messages.`
    : other && !other.publicKey ? `${convTitle(conv, me.id)} has not set up encryption yet, so you cannot message them.` : null;

  return (
    <section className="bg-chat flex h-full min-w-0 flex-1 flex-col">
      <header className="glass-strong z-10 flex items-center gap-1.5 rounded-none border-x-0 border-t-0 px-2 py-2.5 md:px-4">
        <Link to="/app" className="icon-btn md:hidden" aria-label="Back"><Icon name="arrowLeft" size={20} /></Link>
        <button className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-1.5 text-left transition hover:bg-white/[0.04]" onClick={() => setInfo(true)}>
          <Avatar user={other || { id: conv.id, displayName: convTitle(conv, me.id), avatarUrl: conv.avatarUrl }} size={42} online={other ? online : undefined} />
          <div className="min-w-0">
            <p className="truncate font-semibold leading-tight">{convTitle(conv, me.id)}</p>
            <p className={`truncate text-xs ${someoneTyping ? 'font-medium text-brand-cyan' : online ? 'text-emerald-400' : 'text-slate-500'}`}>{subtitle}</p>
          </div>
        </button>
        {other && (
          <>
            <button className="icon-btn" disabled={callStatus !== 'idle' || iBlocked} onClick={() => startCall({ peer: other, conversationId: id, video: false })} aria-label="Voice call" title="Voice call"><Icon name="phone" size={19} /></button>
            <button className="icon-btn" disabled={callStatus !== 'idle' || iBlocked} onClick={() => startCall({ peer: other, conversationId: id, video: true })} aria-label="Video call" title="Video call"><Icon name="video" size={20} /></button>
          </>
        )}
        <button className="icon-btn" onClick={() => setInfo(true)} aria-label="Chat info" title="Chat info"><Icon name="info" size={19} /></button>
      </header>

      {!bucket?.loaded ? (
        <div className="flex-1 space-y-3 p-6">
          {[60, 40, 70, 50].map((w, i) => <Skeleton key={i} className={`h-11 !rounded-3xl ${i % 2 ? 'ml-auto' : ''}`} style={{ width: `${w}%` }} />)}
        </div>
      ) : bucket.items.length === 0 ? (
        <EmptyChat conv={conv} meId={me.id} />
      ) : (
        <MessageList
          key={id}
          id={id}
          items={bucket?.items ?? EMPTY}
          loading={bucket?.loading}
          hasMore={bucket?.hasMore}
          meId={me.id}
          typing={someoneTyping}
          onReply={setReplyTo}
          nameOf={nameOf}
        />
      )}

      <Composer conversationId={id} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} disabledReason={disabledReason} />
      {info && other && <ChatInfoModal user={other} onClose={() => setInfo(false)} />}
      {info && conv.type === 'group' && <GroupInfoModal convId={id} onClose={() => setInfo(false)} />}
    </section>
  );
}
