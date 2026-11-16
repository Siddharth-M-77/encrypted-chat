// Each person gets a stable gradient derived from their id, so avatars are recognisable at a glance.
const GRADIENTS = [
  ['#7B2FF7', '#2F80ED'], ['#F5576C', '#7B2FF7'], ['#00C6FF', '#0072FF'], ['#F7971E', '#FF5E62'],
  ['#11998E', '#38EF7D'], ['#8E2DE2', '#4A00E0'], ['#FF6A88', '#C04CFD'], ['#3A7BD5', '#22D3EE'],
];

function hash(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

// `online` adds a presence dot; `ring` adds a soft gradient ring (used for headers and profile heroes).
export default function Avatar({ user, size = 44, online, ring = false }) {
  const seed = user?.id || user?.walletAddress || user?.displayName || '?';
  const [from, to] = GRADIENTS[hash(seed) % GRADIENTS.length];
  const label = (user?.displayName || user?.username || user?.walletAddress || '?').replace(/^0x/, '')[0]?.toUpperCase();
  const dot = Math.max(10, Math.round(size * 0.26));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className={`flex h-full w-full items-center justify-center overflow-hidden rounded-full font-bold text-white ${ring ? 'ring-2 ring-white/15 ring-offset-2 ring-offset-surface' : ''}`}
        style={{ background: `linear-gradient(135deg, ${from}, ${to})`, fontSize: size * 0.4, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.3)' }}
      >
        {user?.avatarUrl ? (
          <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
        ) : label}
      </div>
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 rounded-full border-2 border-surface-1 ${online ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]' : 'hidden'}`}
          style={{ width: dot, height: dot }}
        />
      )}
    </div>
  );
}
