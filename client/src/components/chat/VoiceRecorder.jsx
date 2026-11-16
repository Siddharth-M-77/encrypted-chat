import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '../Icons.jsx';
import { baseMime } from '../../lib/media.js';

const MAX_SECONDS = 300;
const EXT = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a' };

// Records a voice note with MediaRecorder; hands the finished File to onDone.
export default function VoiceRecorder({ onDone, onCancel }) {
  const [seconds, setSeconds] = useState(0);
  const rec = useRef(null);
  const chunks = useRef([]);
  const discard = useRef(false);
  const sent = useRef(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone; // always call the latest callback, not the one from the first render

  useEffect(() => {
    let stream;
    let timer;
    let alive = true;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!alive) return stream.getTracks().forEach((t) => t.stop());
        const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported(t));
        rec.current = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
        rec.current.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
        rec.current.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          if (discard.current || !chunks.current.length) return;
          const mime = baseMime(rec.current.mimeType) || 'audio/webm';
          doneRef.current(new File(chunks.current, `voice-${Date.now()}.${EXT[mime] || 'webm'}`, { type: mime }));
        };
        rec.current.start();
        timer = setInterval(() => setSeconds((s) => s + 1), 1000);
      } catch {
        toast.error('Microphone access was denied');
        onCancel();
      }
    })();
    return () => {
      alive = false;
      clearInterval(timer);
      if (!sent.current) discard.current = true; // closing without pressing send discards the recording
      if (rec.current?.state === 'recording') rec.current.stop();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (seconds >= MAX_SECONDS) finish(); }, [seconds]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = () => {
    sent.current = true;
    discard.current = false;
    if (rec.current?.state === 'recording') rec.current.stop();
    onCancel(); // closes the recorder UI; the onstop handler delivers the file
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return (
    <div className="flex items-center gap-2">
      <button className="icon-btn h-11 w-11 hover:!text-red-300" onClick={onCancel} aria-label="Discard recording" title="Discard"><Icon name="trash" size={19} /></button>
      <div className="flex flex-1 items-center gap-3 px-2">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,.9)]" />
        <span className="font-mono text-sm tabular-nums">{mm}:{ss}</span>
        {/* Animated level bars: purely decorative, tells the user the mic is live. */}
        <div className="flex h-6 flex-1 items-center gap-[3px]">
          {Array.from({ length: 28 }).map((_, i) => (
            <span key={i} className="h-full w-[3px] origin-center animate-bars rounded-full bg-gradient-to-t from-brand-purple to-brand-blue" style={{ animationDelay: `${(i % 7) * 90}ms`, animationDuration: `${0.8 + (i % 5) * 0.15}s` }} />
          ))}
        </div>
      </div>
      <button
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-white transition hover:brightness-110 active:scale-90"
        style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,.3), 0 6px 20px -6px rgba(123,47,247,.8)' }}
        onClick={finish}
        aria-label="Send voice message"
      >
        <Icon name="send" size={19} className="-ml-0.5 mt-0.5" />
      </button>
    </div>
  );
}
