import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '../Icons.jsx';
import { useMediaUrl } from '../../hooks/useMediaUrl.js';
import { formatBytes, saveAttachment } from '../../lib/media.js';

function UploadOverlay({ upload }) {
  if (!upload) return null;
  const label = upload.stage === 'encrypting' ? 'Encrypting…' : upload.stage === 'uploading' ? `Uploading ${upload.progress}%` : 'Sending…';
  const pct = upload.stage === 'uploading' ? upload.progress : upload.stage === 'sending' ? 100 : 6;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 rounded-[inherit] bg-black/55 text-xs font-semibold text-white backdrop-blur-sm">
      <span className="flex items-center gap-1.5"><Icon name="lock" size={12} /> {label}</span>
      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/20">
        <div className="h-full rounded-full bg-white transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Lightbox({ url, payload, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex animate-fade-in flex-col bg-black/92 backdrop-blur-xl" onClick={onClose}>
      <div className="flex items-center justify-between p-4 text-white" onClick={(e) => e.stopPropagation()}>
        <span className="truncate text-sm font-medium text-white/80">{payload.fileName}</span>
        <div className="flex gap-1">
          <button className="icon-btn !text-white" onClick={() => saveAttachment(payload).catch((e) => toast.error(e.message))} aria-label="Download" title="Download"><Icon name="download" size={19} /></button>
          <button className="icon-btn !text-white" onClick={onClose} aria-label="Close" title="Close"><Icon name="x" size={20} /></button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        <img src={url} alt={payload.fileName} className="max-h-full max-w-full animate-scale-in rounded-2xl object-contain shadow-float" onClick={(e) => e.stopPropagation()} />
      </div>
    </div>
  );
}

function ImageMedia({ message }) {
  const { payload } = message;
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const { url, error, loading } = useMediaUrl(payload, visible);

  // Decrypt only when scrolled into view, so opening a long chat does not decrypt every image.
  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return undefined;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  return (
    <div ref={ref} className="relative -mx-1.5 -mt-0.5 mb-1.5 min-h-[7rem] min-w-[11rem] overflow-hidden rounded-[16px] bg-black/25">
      {url && <img src={url} alt={payload.fileName} className="max-h-80 w-full cursor-zoom-in object-cover transition duration-300 hover:scale-[1.02]" onClick={() => setOpen(true)} />}
      {!url && (
        <div className="flex h-36 flex-col items-center justify-center gap-2 px-3 text-center text-xs text-white/70">
          <Icon name={error ? 'alert' : 'image'} size={22} className={loading ? 'animate-pulse' : ''} />
          {error || (loading ? 'Decrypting…' : 'Image')}
        </div>
      )}
      {message.local === 'sending' && <UploadOverlay upload={message.upload} />}
      {open && url && <Lightbox url={url} payload={payload} onClose={() => setOpen(false)} />}
    </div>
  );
}

function AudioMedia({ message }) {
  const { payload } = message;
  const { url, error, loading } = useMediaUrl(payload, true);
  return (
    <div className="relative mb-1 min-w-[15rem] rounded-2xl">
      {url ? <audio controls preload="metadata" src={url} className="h-10 w-full max-w-[17rem]" />
        : (
          <p className="flex items-center gap-2 py-2 text-xs text-white/70">
            <Icon name={error ? 'alert' : 'mic'} size={15} /> {error || (loading ? 'Decrypting…' : 'Voice message')}
          </p>
        )}
      {message.local === 'sending' && <UploadOverlay upload={message.upload} />}
    </div>
  );
}

function FileMedia({ message }) {
  const { payload } = message;
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try { await saveAttachment(payload); } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <div className="relative mb-1 flex min-w-[14rem] items-center gap-3 overflow-hidden rounded-2xl bg-black/25 p-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10"><Icon name="file" size={22} /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{payload.fileName}</p>
        <p className="text-xs text-white/55">{formatBytes(payload.size)}</p>
      </div>
      {message.local !== 'sending' && (
        <button className="icon-btn !h-9 !w-9 !bg-white/10 !text-white hover:!bg-white/20" disabled={busy} onClick={download} aria-label="Download file" title="Download">
          <Icon name="download" size={16} className={busy ? 'animate-pulse' : ''} />
        </button>
      )}
      {message.local === 'sending' && <UploadOverlay upload={message.upload} />}
    </div>
  );
}

// Renders the attachment of a message according to its decrypted payload type.
export default function MediaMessage({ message }) {
  switch (message.payload.type) {
    case 'image': return <ImageMedia message={message} />;
    case 'audio': return <AudioMedia message={message} />;
    default: return <FileMedia message={message} />;
  }
}
