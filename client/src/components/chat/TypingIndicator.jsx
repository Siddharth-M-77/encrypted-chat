export default function TypingIndicator() {
  return (
    <div className="flex w-fit animate-msg-in items-center gap-1.5 rounded-[22px] rounded-bl-[4px] border border-white/[0.06] bg-white/[0.06] px-4 py-3.5" aria-label="typing">
      {[0, 160, 320].map((d) => (
        <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-gradient-to-br from-brand-purple to-brand-blue" style={{ animationDelay: `${d}ms` }} />
      ))}
    </div>
  );
}
