import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import Modal from '../Modal.jsx';
import Icon from '../Icons.jsx';
import { selectUser } from '../../store/authSlice.js';
import { useBlockUserMutation, useUnblockUserMutation, errorMessage } from '../../services/api.js';
import Avatar from '../Avatar.jsx';
import { safetyNumber } from '../../lib/e2ee.js';
import { getPublicKey } from '../../lib/keystore.js';
import { userTitle } from '../../lib/format.js';

// Chat info for a direct conversation, including the safety number for verifying the contact out-of-band.
export default function ChatInfoModal({ user, onClose }) {
  const me = useSelector(selectUser);
  const [block, { isLoading: blocking }] = useBlockUserMutation();
  const [unblock, { isLoading: unblocking }] = useUnblockUserMutation();
  const blocked = me.blockedUsers?.includes(user.id);

  const toggleBlock = async () => {
    if (!blocked && !window.confirm(`Block ${userTitle(user)}? They will not be able to message or call you, and will not see when you are online.`)) return;
    try {
      await (blocked ? unblock(user.id) : block(user.id)).unwrap();
      toast.success(blocked ? 'User unblocked' : 'User blocked');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const mine = getPublicKey();
  const groups = mine && user.publicKey ? safetyNumber(mine, user.publicKey) : null;
  const copyAddress = () => navigator.clipboard?.writeText(user.walletAddress).then(() => toast.success('Address copied'));

  return (
    <Modal title="Chat info" onClose={onClose}>
      <div className="flex flex-col items-center gap-1.5 text-center">
        <Avatar user={user} size={88} ring />
        <p className="mt-2 text-xl font-extrabold tracking-tight">{userTitle(user)}</p>
        {user.username && <p className="text-sm text-slate-400">@{user.username}</p>}
        {user.bio && <p className="mt-1 max-w-xs text-sm text-slate-300">{user.bio}</p>}
        <button onClick={copyAddress} className="mt-2 flex max-w-full items-center gap-2 rounded-full bg-white/[0.05] px-3.5 py-1.5 font-mono text-[11px] text-slate-400 transition hover:bg-white/[0.09] hover:text-white" title="Copy address">
          <span className="truncate">{user.walletAddress}</span> <Icon name="copy" size={12} />
        </button>
      </div>

      <div className="mt-6 rounded-3xl border border-white/[0.07] bg-white/[0.03] p-5">
        <h3 className="mb-3 flex items-center gap-2 font-bold"><Icon name="fingerprint" size={18} className="text-brand-cyan" /> Safety number</h3>
        {groups ? (
          <div className="grid grid-cols-4 gap-2 text-center font-mono text-[13px] tracking-wider">
            {groups.map((g, i) => <span key={i} className="rounded-lg bg-black/30 py-1.5">{g}</span>)}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Not available: this contact has not set up encryption yet.</p>
        )}
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Compare this number with {userTitle(user)} in person or over another channel. If it matches on both devices,
          your messages are end-to-end encrypted and no one is in the middle.
        </p>
      </div>

      <button
        className={`mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border py-3.5 font-semibold transition ${blocked ? 'border-white/10 hover:bg-white/[0.06]' : 'border-red-500/25 text-red-400 hover:bg-red-500/10'}`}
        disabled={blocking || unblocking}
        onClick={toggleBlock}
      >
        <Icon name="ban" size={17} /> {blocked ? 'Unblock user' : 'Block user'}
      </button>
    </Modal>
  );
}
