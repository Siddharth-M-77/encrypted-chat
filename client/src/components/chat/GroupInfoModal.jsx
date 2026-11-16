import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Modal from '../Modal.jsx';
import Avatar from '../Avatar.jsx';
import Icon from '../Icons.jsx';
import UserPicker from './UserPicker.jsx';
import { selectUser } from '../../store/authSlice.js';
import { addGroupMembers, leaveGroup, removeGroupMember, renameGroup } from '../../store/chatThunks.js';
import { errorMessage } from '../../services/api.js';
import { safetyNumber } from '../../lib/e2ee.js';
import { getPublicKey } from '../../lib/keystore.js';
import { userTitle } from '../../lib/format.js';

export default function GroupInfoModal({ convId, onClose }) {
  const me = useSelector(selectUser);
  const conv = useSelector((s) => s.chat.convs[convId]);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [name, setName] = useState(conv?.name || '');
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState([]);
  const [verify, setVerify] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!conv) return null;
  const isAdmin = conv.admins.includes(me.id);

  // Run an action with a busy flag and a uniform error toast.
  const run = async (fn, ok) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast.success(ok);
    } catch (err) {
      toast.error(err?.data?.message || errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const togglePick = (u) => setPicked((p) => (p.some((x) => x.id === u.id) ? p.filter((x) => x.id !== u.id) : [...p, u]));

  const onLeave = async () => {
    if (!window.confirm('Leave this group? You will stop receiving its messages.')) return;
    await run(async () => {
      await dispatch(leaveGroup(convId));
      onClose();
      navigate('/app');
    });
  };

  return (
    <Modal title="Group info" onClose={onClose} wide>
      <div className="space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Avatar user={{ id: conv.id, displayName: conv.name, avatarUrl: conv.avatarUrl }} size={84} ring />
          {isAdmin ? (
            <div className="mt-2 flex w-full gap-2">
              <input className="input !py-2.5" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
              <button className="btn-ghost !py-2.5" disabled={busy || !name.trim() || name.trim() === conv.name} onClick={() => run(() => dispatch(renameGroup(convId, name.trim())), 'Group renamed')}>Save</button>
            </div>
          ) : (
            <p className="mt-2 text-xl font-extrabold tracking-tight">{conv.name}</p>
          )}
          <p className="flex items-center gap-1.5 text-sm text-slate-500"><Icon name="lock" size={13} className="text-emerald-400" /> {conv.participants.length} members · end-to-end encrypted</p>
          {conv.rotationPending && <p className="rounded-full bg-amber-400/10 px-3 py-1 text-xs text-amber-300">A member left. An admin will refresh the group key shortly.</p>}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-bold">Members</h3>
            {isAdmin && (
              <button className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold text-brand-cyan transition hover:bg-white/[0.06]" onClick={() => { setAdding((a) => !a); setPicked([]); }}>
                <Icon name={adding ? 'x' : 'userPlus'} size={15} /> {adding ? 'Cancel' : 'Add'}
              </button>
            )}
          </div>

          {adding && (
            <div className="mb-4 space-y-3 rounded-3xl border border-white/[0.07] bg-white/[0.03] p-3">
              <UserPicker selected={picked} onToggle={togglePick} excludeIds={conv.participants.map((p) => p.id)} />
              <button
                className="btn-primary w-full"
                disabled={busy || picked.length === 0}
                onClick={() => run(async () => { await dispatch(addGroupMembers(convId, picked)); setAdding(false); setPicked([]); }, 'Members added')}
              >
                Add {picked.length || ''} member{picked.length === 1 ? '' : 's'}
              </button>
            </div>
          )}

          <ul className="space-y-1">
            {conv.participants.map((p) => {
              const self = p.id === me.id;
              const groups = verify === p.id && p.publicKey && getPublicKey() ? safetyNumber(getPublicKey(), p.publicKey) : null;
              return (
                <li key={p.id} className="rounded-2xl p-2 transition hover:bg-white/[0.04]">
                  <div className="flex items-center gap-3">
                    <Avatar user={p} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{userTitle(p)}{self && <span className="font-normal text-slate-500"> (you)</span>}</p>
                      {conv.admins.includes(p.id) && <span className="rounded-full bg-brand-purple/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-cyan">admin</span>}
                    </div>
                    {!self && <button className="icon-btn h-9 w-9" title="Safety number" aria-label="Safety number" onClick={() => setVerify(verify === p.id ? null : p.id)}><Icon name="fingerprint" size={17} /></button>}
                    {isAdmin && !self && !conv.admins.includes(p.id) && (
                      <button
                        className="rounded-full px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/10"
                        disabled={busy}
                        onClick={() => window.confirm(`Remove ${userTitle(p)}? The group key will be rotated.`) && run(() => dispatch(removeGroupMember(convId, p.id)), 'Member removed')}
                      >Remove</button>
                    )}
                  </div>
                  {groups && (
                    <div className="mt-2 grid grid-cols-4 gap-1.5 rounded-2xl bg-black/30 p-2.5 text-center font-mono text-xs">
                      {groups.map((g, i) => <span key={i}>{g}</span>)}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <button className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/25 py-3.5 font-semibold text-red-400 transition hover:bg-red-500/10" disabled={busy} onClick={onLeave}>
          <Icon name="logout" size={17} /> Leave group
        </button>
      </div>
    </Modal>
  );
}
