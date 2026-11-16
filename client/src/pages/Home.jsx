import { useParams } from 'react-router-dom';
import Sidebar from '../components/chat/Sidebar.jsx';
import ChatWindow from '../components/chat/ChatWindow.jsx';
import Logo from '../components/Logo.jsx';
import Icon from '../components/Icons.jsx';

function Welcome() {
  return (
    <div className="bg-chat relative flex flex-1 flex-col items-center justify-center gap-6 overflow-hidden p-8 text-center">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 animate-drift rounded-full bg-brand-purple/15 blur-[110px]" />
      <div className="relative animate-float"><Logo size={84} /></div>
      <div className="relative animate-fade-up">
        <h2 className="text-3xl font-black tracking-tight">M Talk</h2>
        <p className="mt-2 text-slate-400">Select a conversation or start a new one.</p>
      </div>
      <div className="relative flex flex-wrap justify-center gap-2.5">
        {[['lock', 'End-to-end encrypted'], ['video', 'HD calls'], ['wallet', 'Wallet identity']].map(([icon, label]) => (
          <span key={label} className="glass flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-slate-300">
            <Icon name={icon} size={14} className="text-brand-cyan" /> {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// Two-pane messenger. On phones only one pane shows at a time (list or chat).
export default function Home() {
  const { id } = useParams();

  return (
    <div className="flex h-full">
      <div className={`${id ? 'hidden md:block' : 'block'} h-full w-full shrink-0 md:w-[24rem]`}>
        <Sidebar />
      </div>
      <div className={`${id ? 'flex' : 'hidden md:flex'} h-full min-w-0 flex-1`}>
        {id ? <ChatWindow key={id} id={id} /> : <Welcome />}
      </div>
    </div>
  );
}
