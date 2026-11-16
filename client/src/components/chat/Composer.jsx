import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { sendText, sendMedia, emitTyping } from '../../store/chatThunks.js';
import { previewText } from '../../lib/format.js';
import Icon from '../Icons.jsx';
import EmojiPicker from './EmojiPicker.jsx';
import VoiceRecorder from './VoiceRecorder.jsx';

// Floating glass composer: attach, emoji, auto-growing text box, and send / record button.
export default function Composer({ conversationId, replyTo, onCancelReply, disabledReason }) {
  const dispatch = useDispatch();
  const [text, setText] = useState('');
  const [emoji, setEmoji] = useState(false);
  const [recording, setRecording] = useState(false);
  const ref = useRef(null);
  const fileRef = useRef(null);
  const typingRef = useRef({ sent: 0, timer: null });

  useEffect(() => { ref.current?.focus(); }, [conversationId, replyTo]);
  // Stop the typing indicator when leaving the conversation.
  useEffect(() => () => { clearTimeout(typingRef.current.timer); }, [conversationId]);

  // Grow the textarea with its content (up to a cap) instead of showing a scrollbar for two lines.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  const stopTyping = () => {
    clearTimeout(typingRef.current.timer);
    if (typingRef.current.sent) dispatch(emitTyping(conversationId, false));
    typingRef.current.sent = 0;
  };

  const onChange = (e) => {
    setText(e.target.value);
    const t = typingRef.current;
    // Throttle "typing" to one event every 2.5s while the user keeps typing.
    if (Date.now() - t.sent > 2500) { dispatch(emitTyping(conversationId, true)); t.sent = Date.now(); }
    clearTimeout(t.timer);
    t.timer = setTimeout(stopTyping, 2000);
  };

  const replyId = replyTo?.id && !replyTo.local ? replyTo.id : null;

  const send = () => {
    const value = text.trim();
    if (!value || disabledReason) return;
    stopTyping();
    dispatch(sendText(conversationId, value, replyId));
    setText('');
    setEmoji(false);
    onCancelReply();
  };

  const sendFiles = (files) => {
    if (disabledReason) return;
    [...files].forEach((f) => dispatch(sendMedia(conversationId, f, replyId)));
    onCancelReply();
  };
  const onPaste = (e) => {
    const files = [...(e.clipboardData?.files || [])];
    if (files.length) { e.preventDefault(); sendFiles(files); }
  };
  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const hasText = Boolean(text.trim());

  return (
    <div className="px-3 pb-3 pt-1 md:px-5 md:pb-5">
      {replyTo && (
        <div className="glass mb-2 flex animate-fade-up items-center justify-between rounded-2xl border-l-[3px] !border-l-brand-purple px-3.5 py-2.5 text-sm">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-cyan"><Icon name="reply" size={12} /> Replying</p>
            <p className="line-clamp-1 text-slate-300">{previewText(replyTo.payload)}</p>
          </div>
          <button className="icon-btn ml-2 h-8 w-8" onClick={onCancelReply} aria-label="Cancel reply"><Icon name="x" size={16} /></button>
        </div>
      )}
      {disabledReason && (
        <p className="mb-2 flex items-center justify-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-2.5 text-center text-sm text-amber-200">
          <Icon name="ban" size={15} /> {disabledReason}
        </p>
      )}

      {recording ? (
        <div className="glass rounded-[26px] p-2">
          <VoiceRecorder onCancel={() => setRecording(false)} onDone={(file) => sendFiles([file])} />
        </div>
      ) : (
        <div className="glass relative flex items-end gap-1 rounded-[26px] p-1.5 transition focus-within:border-brand-purple/40 focus-within:shadow-[0_0_0_4px_rgba(123,47,247,.12)]">
          <input ref={fileRef} type="file" multiple hidden onChange={(e) => { sendFiles(e.target.files); e.target.value = ''; }} />
          <button type="button" className="icon-btn h-11 w-11" disabled={Boolean(disabledReason)} onClick={() => fileRef.current?.click()} aria-label="Attach file" title="Attach file">
            <Icon name="paperclip" size={20} />
          </button>
          <div className="relative">
            <button type="button" className="icon-btn h-11 w-11" onClick={() => setEmoji((v) => !v)} aria-label="Emoji" title="Emoji"><Icon name="smile" size={20} /></button>
            {emoji && <EmojiPicker onPick={(e) => { setText((t) => t + e); ref.current?.focus(); }} />}
          </div>
          <textarea
            ref={ref}
            className="max-h-[140px] min-h-[44px] flex-1 resize-none bg-transparent px-2 py-[11px] text-[15px] text-slate-100 placeholder-slate-500 outline-none disabled:cursor-not-allowed"
            rows={1}
            placeholder="Write a message…"
            value={text}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onBlur={stopTyping}
            maxLength={4000}
            disabled={Boolean(disabledReason)}
          />
          {hasText ? (
            <button
              className="flex h-11 w-11 shrink-0 animate-scale-in items-center justify-center rounded-full bg-brand-gradient text-white transition hover:brightness-110 active:scale-90 disabled:opacity-40"
              style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,.3), 0 6px 20px -6px rgba(123,47,247,.8)' }}
              onClick={send}
              disabled={Boolean(disabledReason)}
              aria-label="Send"
            >
              <Icon name="send" size={19} className="-ml-0.5 mt-0.5" />
            </button>
          ) : (
            <button className="icon-btn h-11 w-11" onClick={() => setRecording(true)} disabled={Boolean(disabledReason)} aria-label="Record voice message" title="Record voice message">
              <Icon name="mic" size={20} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
