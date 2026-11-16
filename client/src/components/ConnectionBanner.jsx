import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import Icon from './Icons.jsx';

// Thin banner for network problems: browser offline, or the realtime socket is down for more than a moment.
export default function ConnectionBanner() {
  const connected = useSelector((s) => s.chat.connected);
  const [online, setOnline] = useState(navigator.onLine);
  const [grace, setGrace] = useState(false);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  // Avoid flashing the banner during the initial connection or a very short reconnect.
  useEffect(() => {
    if (connected) { setGrace(false); return undefined; }
    const t = setTimeout(() => setGrace(true), 4000);
    return () => clearTimeout(t);
  }, [connected]);

  if (online && !(grace && !connected)) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-[80] flex animate-fade-up justify-center px-4 pt-3">
      <div className="flex items-center gap-2.5 rounded-full border border-amber-400/25 bg-amber-500/15 px-4 py-2 text-sm font-medium text-amber-100 shadow-float backdrop-blur-xl">
        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
        {online ? 'Reconnecting…' : 'You are offline. Messages cannot be sent until you reconnect.'}
        <Icon name="zap" size={14} className="text-amber-300" />
      </div>
    </div>
  );
}
