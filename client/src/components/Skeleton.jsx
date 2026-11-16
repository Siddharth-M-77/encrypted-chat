// Shimmering placeholder block for loading states.
export default function Skeleton({ className = '', style }) {
  return (
    <div style={style} className={`relative overflow-hidden rounded-xl bg-white/[0.05] ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
    </div>
  );
}
