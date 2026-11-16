import { useState } from 'react';
import Icon from './Icons.jsx';

// Rough strength hint only: PIN strength matters because the encrypted backup lives on the server.
function strength(pin) {
  if (pin.length < 6) return { label: 'Too short', color: 'from-red-500 to-red-400', level: 1 };
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pin)).length;
  const score = pin.length + classes * 2;
  if (score < 12) return { label: 'Weak – use a longer PIN or a passphrase', color: 'from-orange-500 to-amber-400', level: 2 };
  if (score < 18) return { label: 'Good', color: 'from-yellow-400 to-lime-400', level: 3 };
  return { label: 'Strong', color: 'from-emerald-500 to-emerald-300', level: 4 };
}

export default function PinForm({ confirm = false, busy, submitLabel, onSubmit, error }) {
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [localErr, setLocalErr] = useState('');
  const st = strength(pin);

  const submit = (e) => {
    e.preventDefault();
    if (pin.length < 6) return setLocalErr('PIN must be at least 6 characters');
    if (confirm && pin !== pin2) return setLocalErr('PINs do not match');
    setLocalErr('');
    onSubmit(pin);
  };

  return (
    <form onSubmit={submit} className="space-y-4 text-left">
      <input
        className="input !py-4 text-center text-lg tracking-[0.35em] placeholder:tracking-normal"
        type="password"
        autoFocus
        autoComplete="off"
        placeholder="Enter PIN"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        maxLength={64}
      />
      {confirm && (
        <>
          <div>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                  <div className={`h-full rounded-full bg-gradient-to-r transition-all duration-300 ${st.color}`} style={{ width: pin && st.level >= i ? '100%' : '0%' }} />
                </div>
              ))}
            </div>
            {pin && <p className="mt-1.5 text-xs text-slate-400">{st.label}</p>}
          </div>
          <input
            className="input !py-4 text-center text-lg tracking-[0.35em] placeholder:tracking-normal"
            type="password"
            autoComplete="off"
            placeholder="Confirm PIN"
            value={pin2}
            onChange={(e) => setPin2(e.target.value)}
            maxLength={64}
          />
        </>
      )}
      {(localErr || error) && (
        <p className="flex items-center gap-2 rounded-xl bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300"><Icon name="alert" size={15} /> {localErr || error}</p>
      )}
      <button className="btn-primary w-full !py-4" disabled={busy}>{busy ? 'Working…' : submitLabel}</button>
    </form>
  );
}
