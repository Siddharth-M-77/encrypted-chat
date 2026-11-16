import Icon from './Icons.jsx';

// Shared frame for the PIN screens: aurora backdrop + a centred glass card with a glowing icon header.
export default function AuthShell({ icon = 'lock', title, subtitle, children, footer }) {
  return (
    <main className="relative flex min-h-full items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 animate-drift rounded-full bg-brand-purple/25 blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 animate-drift-2 rounded-full bg-brand-blue/20 blur-[120px]" />
        <div className="bg-grid absolute inset-0 opacity-60" />
      </div>

      <section className="glass-strong gradient-border relative w-full max-w-md animate-scale-in space-y-7 rounded-[32px] p-8 text-center sm:p-10">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 animate-ring rounded-full bg-brand-purple/40" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-brand-gradient text-white" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,.35), 0 12px 40px -8px rgba(123,47,247,.7)' }}>
              <Icon name={icon} size={28} />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-400">{subtitle}</p>
          </div>
        </div>
        {children}
        {footer}
      </section>
    </main>
  );
}
