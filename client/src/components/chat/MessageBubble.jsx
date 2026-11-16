import { useState } from 'react';
import { formatTime, previewText } from '../../lib/format.js';
import Icon from '../Icons.jsx';
import MediaMessage from './MediaMessage.jsx';
import Ticks, { aggregateStatus } from './Ticks.jsx';

function Quote({ original, mine }) {
  return (
    <div className={`mb-1.5 rounded-xl border-l-[3px] px-2.5 py-1.5 text-xs ${mine ? 'border-white/70 bg-black/20' : 'border-brand-purple bg-black/25'}`}>
      <p className="line-clamp-2 text-white/75">{original ? previewText(original.payload) : 'Original message'}</p>
    </div>
  );
}

const DELETE_WINDOW_MS = 60 * 60 * 1000;
const R = 22; // outer corner radius
const r = 6; // tight corner used inside a run of messages from the same sender

// `groupedPrev` / `groupedNext`: neighbouring messages from the same sender, so runs read as one visual block.
export default function MessageBubble({ message: m, meId, original, senderName, groupedPrev, groupedNext, onReply, onRetry, onDelete }) {
  const [menu, setMenu] = useState(false);
  const mine = m.senderId === meId;
  const status = mine ? aggregateStatus(m, meId) : null;
  const tombstone = m.deletedForEveryone || m.undecryptable;

  let body;
  if (m.deletedForEveryone) body = <span className="flex items-center gap-1.5 italic text-white/55"><Icon name="ban" size={14} /> This message was deleted</span>;
  else if (m.undecryptable) body = <span className="flex items-center gap-1.5 italic text-white/55"><Icon name="lock" size={14} /> Unable to decrypt this message</span>;
  else if (m.payload.type === 'text' || !m.payload.type) body = <span className="whitespace-pre-wrap break-words">{m.payload.text}</span>;
  else body = <><MediaMessage message={m} />{m.payload.text && <span className="whitespace-pre-wrap break-words">{m.payload.text}</span>}</>;

  // Rounded corners with a small "tail" on the last message of a run.
  const radius = mine
    ? `${R}px ${groupedPrev ? r : R}px ${groupedNext ? r : 4}px ${R}px`
    : `${groupedPrev ? r : R}px ${R}px ${R}px ${groupedNext ? r : 4}px`;

  return (
    <div className={`group flex animate-msg-in items-end gap-1.5 ${mine ? 'flex-row-reverse' : ''} ${groupedPrev ? 'mt-0.5' : 'mt-3'}`}>
      <div
        style={{ borderRadius: radius }}
        className={`relative max-w-[82%] px-3.5 py-2 text-[15px] leading-[1.45] md:max-w-[70%] ${
          mine
            ? `bg-brand-gradient text-white shadow-bubble ${tombstone ? 'opacity-70' : ''}`
            : 'border border-white/[0.07] bg-white/[0.065] text-slate-100 backdrop-blur-sm'
        }`}
      >
        {senderName && !groupedPrev && <p className="mb-0.5 text-xs font-semibold text-brand-cyan">{senderName}</p>}
        {m.replyTo && <Quote original={original} mine={mine} />}
        {body}
        <span className="float-right ml-3 mt-1.5 inline-flex items-center gap-1 text-[10.5px] font-medium tabular-nums text-white/55">
          {formatTime(m.createdAt)}
          {mine && <Ticks status={status} />}
        </span>
      </div>

      {status === 'failed' ? (
        <button className="mb-1 flex items-center gap-1 rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/25" onClick={() => onRetry(m)} title={m.error}>
          <Icon name="alert" size={12} /> Retry
        </button>
      ) : (
        !m.local && (
          <div className="relative mb-0.5 flex items-center rounded-full border border-white/[0.07] bg-surface-2/90 p-0.5 opacity-0 shadow-lg backdrop-blur transition group-hover:opacity-100 focus-within:opacity-100">
            {!m.deletedForEveryone && (
              <button className="icon-btn h-8 w-8" onClick={() => onReply(m)} title="Reply" aria-label="Reply"><Icon name="reply" size={15} /></button>
            )}
            <button className="icon-btn h-8 w-8 hover:!text-red-300" onClick={() => setMenu((v) => !v)} title="Delete" aria-label="Delete message"><Icon name="trash" size={15} /></button>
            {menu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                <div className={`glass-strong absolute bottom-full z-20 mb-2 w-52 animate-scale-in overflow-hidden rounded-2xl py-1.5 text-sm ${mine ? 'right-0' : 'left-0'}`}>
                  <button className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-white/[0.07]" onClick={() => { setMenu(false); onDelete(m, 'me'); }}>
                    Delete for me
                  </button>
                  {mine && !m.deletedForEveryone && Date.now() - new Date(m.createdAt).getTime() < DELETE_WINDOW_MS && (
                    <button className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-red-400 hover:bg-red-500/10" onClick={() => { setMenu(false); onDelete(m, 'everyone'); }}>
                      Delete for everyone
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )
      )}
    </div>
  );
}
