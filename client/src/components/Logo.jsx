// Brand mark: gradient tile with an "M" drawn as two peaks (reads as a letter and as a speech wave).
export default function Logo({ size = 40, glow = true }) {
  return (
    <div
      className="relative flex items-center justify-center rounded-[28%] bg-brand-gradient"
      style={{
        width: size,
        height: size,
        boxShadow: glow ? 'inset 0 1px 0 rgba(255,255,255,.35), 0 10px 36px -8px rgba(123,47,247,.7)' : 'inset 0 1px 0 rgba(255,255,255,.35)',
      }}
      aria-label="M Talk"
    >
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 19V6.5a1 1 0 0 1 1.8-.6L12 13l6.2-7.1a1 1 0 0 1 1.8.6V19" />
      </svg>
    </div>
  );
}
