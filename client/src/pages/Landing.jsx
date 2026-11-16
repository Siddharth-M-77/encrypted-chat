import { useEffect } from 'react';
import { useAppKit, useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import toast from 'react-hot-toast';
import Logo from '../components/Logo.jsx';
import Icon from '../components/Icons.jsx';
import { useSignIn } from '../hooks/useSignIn.js';
import { connectInjected, hasInjectedWallet } from '../lib/wallet.js';
import { WC_ENABLED } from '../lib/appkit.js';
import { errorMessage } from '../services/api.js';

// Only rendered when WalletConnect is configured, so the AppKit hooks are always valid here.
function WalletConnectButton({ signIn, loading }) {
  const { open } = useAppKit();
  const { isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider('eip155');

  if (isConnected && walletProvider) {
    return (
      <button className="btn-ghost w-full sm:w-auto" disabled={loading} onClick={() => signIn(walletProvider)}>
        {loading ? 'Waiting for signature…' : 'Sign message with connected wallet'}
      </button>
    );
  }
  return (
    <button className="btn-ghost w-full sm:w-auto" onClick={() => open()}>
      <Icon name="globe" size={18} /> WalletConnect
    </button>
  );
}

// Decorative, static product preview: a believable encrypted conversation.
function PhoneMock() {
  const bubble = 'max-w-[82%] rounded-[20px] px-3.5 py-2 text-[13.5px] leading-snug';
  return (
    <div className="relative mx-auto w-full max-w-[360px]">
      <div className="absolute -inset-10 rounded-full bg-brand-gradient opacity-25 blur-[90px]" />

      <div className="glass-strong gradient-border relative overflow-hidden rounded-[36px] shadow-float">
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#F5576C] to-[#7B2FF7] font-bold">N</div>
          <div className="flex-1">
            <p className="text-sm font-semibold leading-tight">Nova</p>
            <p className="flex items-center gap-1.5 text-xs text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> online</p>
          </div>
          <Icon name="phone" size={18} className="text-slate-400" />
          <Icon name="video" size={19} className="text-slate-400" />
        </div>

        <div className="bg-chat space-y-2.5 px-4 py-5">
          <div className={`${bubble} rounded-bl-[4px] border border-white/[0.07] bg-white/[0.07]`}>gm 👋 is this chat really private?</div>
          <div className={`${bubble} ml-auto rounded-br-[4px] bg-brand-gradient shadow-bubble`}>
            Keys are generated in your browser. The server only ever sees ciphertext.
            <span className="mt-1 flex items-center justify-end gap-1 text-[10px] text-white/70">09:41 <Icon name="checkCheck" size={13} className="text-cyan-300" /></span>
          </div>
          <div className={`${bubble} rounded-bl-[4px] border border-white/[0.07] bg-white/[0.07]`}>Love it. Calling you in a sec 📞</div>
          <div className="flex w-fit items-center gap-1.5 rounded-[18px] rounded-bl-[4px] border border-white/[0.07] bg-white/[0.07] px-3.5 py-3">
            {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-blue" style={{ animationDelay: `${i * 150}ms` }} />)}
          </div>
        </div>

        <div className="border-t border-white/[0.06] p-3">
          <div className="flex items-center gap-2 rounded-full bg-white/[0.05] px-4 py-2.5 text-sm text-slate-500">
            <Icon name="paperclip" size={16} /> <span className="flex-1">Write a message…</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gradient text-white"><Icon name="send" size={14} /></span>
          </div>
        </div>
      </div>

      {/* Floating proof points */}
      <div className="glass-strong absolute -left-4 -top-10 hidden animate-float items-center gap-2.5 rounded-2xl px-3.5 py-2.5 sm:flex md:-left-12">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-400"><Icon name="lock" size={16} /></span>
        <div><p className="text-xs font-semibold">End-to-end encrypted</p><p className="text-[10.5px] text-slate-500">XSalsa20-Poly1305</p></div>
      </div>
      <div className="glass-strong absolute -bottom-6 -right-3 hidden animate-float-slow items-center gap-2.5 rounded-2xl px-3.5 py-2.5 sm:flex md:-right-12">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-purple/20 text-brand-cyan"><Icon name="fingerprint" size={16} /></span>
        <div><p className="text-xs font-semibold">Safety number</p><p className="font-mono text-[10.5px] tracking-wider text-slate-400">76716 95808 99249</p></div>
      </div>
    </div>
  );
}

const FEATURES = [
  { icon: 'wallet', title: 'Your wallet is your identity', text: 'Sign in with a signature. No email, no password, no phone number to leak.' },
  { icon: 'shield', title: 'The server can’t read anything', text: 'Messages, files and keys are encrypted in your browser before they ever leave it.' },
  { icon: 'video', title: 'Calls & media, built in', text: 'Peer-to-peer voice and video, encrypted files, voice notes and group chats.' },
];

export default function Landing() {
  const { signIn, loading } = useSignIn();

  useEffect(() => { document.title = 'M Talk – Communication Without Boundaries'; }, []);

  const onMetaMask = async () => {
    try {
      await signIn(await connectInjected());
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <main className="relative min-h-full overflow-x-hidden">
      {/* Ambient aurora + grid */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[520px] w-[520px] animate-drift rounded-full bg-brand-purple/30 blur-[130px]" />
        <div className="absolute -right-40 top-1/3 h-[520px] w-[520px] animate-drift-2 rounded-full bg-brand-blue/25 blur-[130px]" />
        <div className="bg-grid absolute inset-0" />
      </div>

      <div className="relative mx-auto flex min-h-full max-w-6xl flex-col px-5 sm:px-8">
        <nav className="flex animate-fade-in items-center justify-between py-6">
          <div className="flex items-center gap-3">
            <Logo size={38} />
            <div className="leading-none">
              <p className="text-lg font-extrabold tracking-tight">M Talk</p>
              <p className="eyebrow mt-1 !text-[9px]">by MASQOO</p>
            </div>
          </div>
          <span className="glass hidden items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-slate-300 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,.9)]" /> BNB Smart Chain
          </span>
        </nav>

        <section className="grid flex-1 items-center gap-14 py-10 lg:grid-cols-[1.05fr_.95fr] lg:py-16">
          <div className="animate-fade-up text-center lg:text-left">
            <span className="glass inline-flex items-center gap-2 rounded-full py-1.5 pl-2 pr-4 text-xs font-medium text-slate-300">
              <span className="rounded-full bg-brand-gradient px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">New</span>
              Part of the MASQOO ecosystem
            </span>

            <h1 className="mt-6 text-[2.75rem] font-black leading-[1.04] tracking-[-0.035em] sm:text-6xl lg:text-[4.25rem]">
              Communication<br />
              <span className="text-gradient-animated">Without Boundaries.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-400 lg:mx-0">
              The private messenger where your wallet is your identity. End-to-end encrypted chats, calls and files that no server, company or government can read.
            </p>

            <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center lg:justify-start">
              <button className="btn-primary !px-8 !py-4 text-base" onClick={onMetaMask} disabled={loading}>
                <Icon name="wallet" size={20} />
                {loading ? 'Waiting for signature…' : hasInjectedWallet() ? 'Connect Wallet' : 'Install a wallet to continue'}
              </button>
              {WC_ENABLED && <WalletConnectButton signIn={signIn} loading={loading} />}
            </div>

            <p className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-500 lg:justify-start">
              <Icon name="shield" size={14} className="text-emerald-400" />
              Signing only proves you own the wallet. It costs no gas and can’t move your funds.
            </p>

            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-white/[0.07] pt-6 text-center lg:text-left">
              {[['E2EE', 'by default'], ['0', 'passwords'], ['P2P', 'calls']].map(([k, v]) => (
                <div key={k}><dt className="text-2xl font-extrabold tracking-tight text-gradient">{k}</dt><dd className="mt-0.5 text-xs text-slate-500">{v}</dd></div>
              ))}
            </dl>
          </div>

          <div className="animate-fade-up [animation-delay:.15s]"><PhoneMock /></div>
        </section>

        <section className="grid gap-4 pb-16 sm:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="glass group animate-fade-up rounded-3xl p-6 transition duration-300 hover:-translate-y-1 hover:border-white/15" style={{ animationDelay: `${0.25 + i * 0.08}s` }}>
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-gradient-soft text-brand-cyan ring-1 ring-white/10 transition group-hover:scale-110"><Icon name={f.icon} size={21} /></span>
              <h3 className="font-bold tracking-tight">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{f.text}</p>
            </div>
          ))}
        </section>

        <footer className="mt-auto border-t border-white/[0.06] py-6 text-center text-xs text-slate-600">
          © {new Date().getFullYear()} MASQOO · M Talk — Communication Without Boundaries.
        </footer>
      </div>
    </main>
  );
}
