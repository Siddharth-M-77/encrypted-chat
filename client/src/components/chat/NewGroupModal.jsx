import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Modal from '../Modal.jsx';
import Icon from '../Icons.jsx';
import UserPicker from './UserPicker.jsx';
import { createGroup } from '../../store/chatThunks.js';
import { errorMessage } from '../../services/api.js';
import { userTitle } from '../../lib/format.js';

export default function NewGroupModal({ onClose }) {
  const [name, setName] = useState('');
  const [members, setMembers] = useState([]);
  const [busy, setBusy] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const toggle = (u) => setMembers((m) => (m.some((x) => x.id === u.id) ? m.filter((x) => x.id !== u.id) : [...m, u]));

  const create = async () => {
    setBusy(true);
    try {
      const id = await dispatch(createGroup(name.trim(), members));
      onClose();
      navigate(`/app/${id}`);
    } catch (err) {
      toast.error(err?.data?.message || errorMessage(err, 'Could not create group'));
      setBusy(false);
    }
  };

  return (
    <Modal title="New group" onClose={onClose}>
      <div className="space-y-4">
        <input className="input" autoFocus placeholder="Group name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        {members.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {members.map((u) => (
              <button key={u.id} onClick={() => toggle(u)} className="flex items-center gap-1.5 rounded-full border border-brand-purple/30 bg-brand-purple/15 py-1 pl-3 pr-2 text-sm font-medium transition hover:bg-brand-purple/25">
                {userTitle(u)} <Icon name="x" size={13} />
              </button>
            ))}
          </div>
        )}
        <UserPicker selected={members} onToggle={toggle} />
        <button className="btn-primary w-full" disabled={busy || !name.trim() || members.length === 0} onClick={create}>
          {busy ? 'Creating…' : `Create group${members.length ? ` (${members.length + 1} members)` : ''}`}
        </button>
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
          <Icon name="key" size={12} /> A fresh encryption key is generated in your browser and sealed separately for each member.
        </p>
      </div>
    </Modal>
  );
}
