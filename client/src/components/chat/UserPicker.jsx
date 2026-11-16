import { useEffect, useState } from 'react';
import Avatar from '../Avatar.jsx';
import Icon from '../Icons.jsx';
import Skeleton from '../Skeleton.jsx';
import { useSearchUsersQuery } from '../../services/api.js';
import { userTitle } from '../../lib/format.js';

// Search users and toggle a multi-selection. Users without an encryption key cannot join encrypted groups.
export default function UserPicker({ selected, onToggle, excludeIds = [] }) {
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isFetching } = useSearchUsersQuery(term, { skip: term.length < 2 });
  const users = (data?.data?.users ?? []).filter((u) => !excludeIds.includes(u.id));
  const isSelected = (id) => selected.some((u) => u.id === id);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Icon name="search" size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input className="input !pl-10" placeholder="Search username or wallet address (0x…)" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="min-h-[6rem] space-y-1">
        {term.length < 2 && <p className="py-7 text-center text-sm text-slate-500">Type at least 2 characters to search.</p>}
        {isFetching && <Skeleton className="h-14 w-full" />}
        {!isFetching && term.length >= 2 && users.length === 0 && <p className="py-7 text-center text-sm text-slate-500">No users found.</p>}
        {!isFetching && users.map((u) => (
          <button
            key={u.id}
            type="button"
            disabled={!u.publicKey}
            onClick={() => onToggle(u)}
            className={`flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition hover:bg-white/[0.06] disabled:opacity-40 ${isSelected(u.id) ? 'bg-brand-purple/15 ring-1 ring-brand-purple/40' : ''}`}
          >
            <Avatar user={u} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{userTitle(u)}</p>
              <p className="truncate text-xs text-slate-500">{u.publicKey ? (u.username ? `@${u.username}` : u.walletAddress) : 'Has not set up encryption yet'}</p>
            </div>
            {isSelected(u.id) && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-gradient text-white"><Icon name="check" size={14} strokeWidth={3} /></span>}
          </button>
        ))}
      </div>
    </div>
  );
}
