import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Modal from '../Modal.jsx';
import Avatar from '../Avatar.jsx';
import Icon from '../Icons.jsx';
import Skeleton from '../Skeleton.jsx';
import { useSearchUsersQuery, errorMessage } from '../../services/api.js';
import { startDirectChat } from '../../store/chatThunks.js';
import { userTitle } from '../../lib/format.js';

export default function NewChatModal({ onClose }) {
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [busyId, setBusyId] = useState(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Debounce so we do not query on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isFetching } = useSearchUsersQuery(term, { skip: term.length < 2 });
  const users = data?.data?.users ?? [];

  const open = async (u) => {
    setBusyId(u.id);
    try {
      const id = await dispatch(startDirectChat(u.id));
      onClose();
      navigate(`/app/${id}`);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not start chat'));
      setBusyId(null);
    }
  };

  return (
    <Modal title="New chat" onClose={onClose}>
      <div className="relative">
        <Icon name="search" size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input className="input !pl-10" autoFocus placeholder="Search by username or wallet address (0x…)" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="mt-4 min-h-[9rem] space-y-1">
        {term.length < 2 && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient-soft text-brand-cyan ring-1 ring-white/10"><Icon name="userPlus" size={22} /></span>
            <p className="max-w-[16rem] text-sm text-slate-500">Type at least 2 characters of a username, or paste a full wallet address.</p>
          </div>
        )}
        {isFetching && <Skeleton className="h-14 w-full" />}
        {!isFetching && term.length >= 2 && users.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No users found.</p>}
        {!isFetching && users.map((u) => (
          <button key={u.id} disabled={busyId === u.id} onClick={() => open(u)} className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition hover:bg-white/[0.06] disabled:opacity-50">
            <Avatar user={u} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{userTitle(u)}</p>
              <p className="truncate text-xs text-slate-500">{u.username ? `@${u.username}` : u.walletAddress}</p>
            </div>
            <Icon name="message" size={18} className="text-slate-500" />
          </button>
        ))}
      </div>
    </Modal>
  );
}
