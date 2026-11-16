import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import Avatar from '../Avatar.jsx';
import Icon from '../Icons.jsx';
import { userTitle } from '../../lib/format.js';
import {
  acceptCall, endCall, getLocalStream, getRemoteStream, rejectCall, subscribeStreams, toggleCamera, toggleMute,
} from '../../lib/callManager.js';

// Re-render when the manager's streams change, and expose them to the video elements.
function useStreams() {
  const [, tick] = useState(0);
  useEffect(() => subscribeStreams(() => tick((n) => n + 1)), []);
  return { local: getLocalStream(), remote: getRemoteStream() };
}

function useElapsed(startedAt) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startedAt) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  if (!startedAt) return '';
  const s = Math.max(0, Math.floor((now - startedAt) / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Avatar with expanding rings, used while a call is ringing or audio-only.
function PulsingAvatar({ user, size, pulse }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {pulse && (
        <>
          <span className="absolute inset-0 animate-ring rounded-full bg-brand-purple/40" />
          <span className="absolute inset-0 animate-ring rounded-full bg-brand-blue/30 [animation-delay:.7s]" />
        </>
      )}
      <div className="relative"><Avatar user={user} size={size} ring /></div>
    </div>
  );
}

function RoundButton({ onClick, active, danger, label, children, size = 'h-16 w-16' }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex ${size} items-center justify-center rounded-full border transition duration-200 hover:scale-105 active:scale-90 ${
        danger
          ? 'border-red-400/30 bg-red-500 text-white shadow-[0_10px_36px_-6px_rgba(239,68,68,.7)] hover:bg-red-400'
          : active
            ? 'border-white bg-white text-slate-900'
            : 'border-white/15 bg-white/[0.12] text-white backdrop-blur-xl hover:bg-white/20'
      }`}
    >
      {children}
    </button>
  );
}

function IncomingCall({ call }) {
  return (
    <div className="fixed inset-0 z-[70] flex animate-fade-in items-center justify-center bg-black/70 p-4 backdrop-blur-xl">
      <div className="glass-strong gradient-border w-full max-w-sm animate-scale-in space-y-8 rounded-[32px] p-9 text-center">
        <div className="flex flex-col items-center gap-5">
          <PulsingAvatar user={call.peer} size={104} pulse />
          <div>
            <p className="text-2xl font-extrabold tracking-tight">{userTitle(call.peer)}</p>
            <p className="mt-1.5 flex items-center justify-center gap-2 text-slate-400">
              <Icon name={call.video ? 'video' : 'phone'} size={15} className="text-brand-cyan" />
              Incoming {call.video ? 'video' : 'voice'} call…
            </p>
          </div>
        </div>
        <div className="flex justify-center gap-12">
          <div className="flex flex-col items-center gap-2.5">
            <RoundButton onClick={rejectCall} danger label="Decline"><Icon name="phoneOff" size={26} /></RoundButton>
            <span className="text-xs font-medium text-slate-400">Decline</span>
          </div>
          <div className="flex flex-col items-center gap-2.5">
            <button
              onClick={acceptCall}
              aria-label="Accept"
              title="Accept"
              className="flex h-16 w-16 animate-bounce items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_10px_36px_-6px_rgba(16,185,129,.8)] transition hover:bg-emerald-400 active:scale-90"
            >
              <Icon name={call.video ? 'video' : 'phone'} size={26} />
            </button>
            <span className="text-xs font-medium text-slate-400">Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActiveCall({ call }) {
  const { local, remote } = useStreams();
  const remoteRef = useRef(null);
  const localRef = useRef(null);
  const elapsed = useElapsed(call.startedAt);

  useEffect(() => { if (remoteRef.current) remoteRef.current.srcObject = remote; }, [remote]);
  useEffect(() => { if (localRef.current) localRef.current.srcObject = local; }, [local]);

  const statusText = call.status === 'calling' ? 'Calling…' : call.status === 'connecting' ? 'Connecting…' : elapsed;
  const showRemoteVideo = call.video && call.status === 'active';

  return (
    <div className="fixed inset-0 z-[70] flex animate-fade-in flex-col overflow-hidden bg-surface text-white">
      {/* The remote element always exists: it also plays the audio of voice-only calls. */}
      <video
        ref={remoteRef}
        autoPlay
        playsInline
        className={showRemoteVideo ? 'absolute inset-0 h-full w-full object-cover' : 'pointer-events-none absolute h-px w-px opacity-0'}
      />

      {!showRemoteVideo && (
        <div className="relative flex flex-1 flex-col items-center justify-center gap-6">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-1/3 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 animate-drift rounded-full bg-brand-purple/25 blur-[120px]" />
            <div className="absolute bottom-0 right-0 h-[380px] w-[380px] animate-drift-2 rounded-full bg-brand-blue/20 blur-[120px]" />
          </div>
          <div className="relative"><PulsingAvatar user={call.peer} size={144} pulse={call.status !== 'active'} /></div>
          <p className="relative text-3xl font-extrabold tracking-tight">{userTitle(call.peer)}</p>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center bg-gradient-to-b from-black/70 via-black/30 to-transparent px-6 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
        {showRemoteVideo && <p className="text-lg font-bold drop-shadow">{userTitle(call.peer)}</p>}
        <p className="font-mono text-sm tabular-nums text-white/85 drop-shadow">{statusText}</p>
        <p className="mt-2 flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-emerald-300 backdrop-blur">
          <Icon name="lock" size={11} /> End-to-end encrypted
        </p>
      </div>

      {call.video && local && (
        <video
          ref={localRef}
          autoPlay
          muted
          playsInline
          className={`absolute right-4 top-24 h-44 w-32 rounded-3xl border border-white/20 object-cover shadow-float [transform:scaleX(-1)] sm:h-52 sm:w-40 ${call.cameraOff ? 'opacity-30' : ''}`}
        />
      )}

      <div className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/75 via-black/30 to-transparent px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-16">
        <div className="flex items-center gap-4 rounded-full border border-white/10 bg-white/[0.07] p-3 backdrop-blur-2xl">
          <RoundButton onClick={toggleMute} active={call.muted} label={call.muted ? 'Unmute' : 'Mute'} size="h-14 w-14">
            <Icon name={call.muted ? 'micOff' : 'mic'} size={22} />
          </RoundButton>
          {call.video && (
            <RoundButton onClick={toggleCamera} active={call.cameraOff} label={call.cameraOff ? 'Turn camera on' : 'Turn camera off'} size="h-14 w-14">
              <Icon name={call.cameraOff ? 'videoOff' : 'video'} size={22} />
            </RoundButton>
          )}
          <RoundButton onClick={() => endCall()} danger label="End call" size="h-14 w-14 sm:h-16 sm:w-16">
            <Icon name="phoneOff" size={24} />
          </RoundButton>
        </div>
      </div>
    </div>
  );
}

export default function CallUI() {
  const call = useSelector((s) => s.call);
  if (call.status === 'idle') return null;
  if (call.status === 'ringing') return <IncomingCall call={call} />;
  return <ActiveCall call={call} />;
}
