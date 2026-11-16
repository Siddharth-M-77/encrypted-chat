import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { selectUser } from '../store/authSlice.js';
import { useUpdateProfileMutation, usePutKeysMutation, useGetBlockedQuery, useUnblockUserMutation, errorMessage } from '../services/api.js';
import { useLogout } from '../hooks/useSession.js';
import Avatar from '../components/Avatar.jsx';
import Icon from '../components/Icons.jsx';
import PinForm from '../components/PinForm.jsx';
import { changePin } from '../lib/keystore.js';
import { userTitle } from '../lib/format.js';

function Card({ icon, title, subtitle, action, children }) {
  return (
    <section className="glass animate-fade-up rounded-[28px] p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient-soft text-brand-cyan ring-1 ring-white/10"><Icon name={icon} size={20} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children && <div className="mt-5">{children}</div>}
    </section>
  );
}

// Change PIN: re-encrypts the same private key under a new PIN and updates the server backup.
function ChangePin({ wallet }) {
  const [putKeys] = usePutKeysMutation();
  const [oldPin, setOldPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const onSubmit = async (newPin) => {
    setBusy(true);
    setError('');
    try {
      const payload = await changePin(wallet, oldPin, newPin);
      await putKeys(payload).unwrap();
      toast.success('PIN changed');
      setOpen(false);
      setOldPin('');
    } catch (err) {
      setError(errorMessage(err, 'Could not change PIN'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      icon="key"
      title="Encryption PIN"
      subtitle="Protects your private key backup."
      action={<button className="btn-ghost !px-4 !py-2 text-sm" onClick={() => setOpen((o) => !o)}>{open ? 'Cancel' : 'Change PIN'}</button>}
    >
      {open && (
        <div className="space-y-4">
          <input className="input" type="password" autoComplete="off" placeholder="Current PIN" value={oldPin} onChange={(e) => setOldPin(e.target.value)} />
          <PinForm confirm busy={busy} error={error} submitLabel="Save new PIN" onSubmit={onSubmit} />
        </div>
      )}
    </Card>
  );
}

// Lists blocked users with one-click unblock.
function BlockedUsers() {
  const { data, isLoading } = useGetBlockedQuery();
  const [unblock, { isLoading: busy }] = useUnblockUserMutation();
  const users = data?.data?.users ?? [];
  return (
    <Card icon="ban" title="Blocked users" subtitle="They can’t message or call you, and don’t see when you’re online.">
      {isLoading ? <p className="text-sm text-slate-500">Loading…</p> : users.length === 0 ? (
        <p className="rounded-2xl bg-white/[0.03] py-5 text-center text-sm text-slate-500">You have not blocked anyone.</p>
      ) : (
        <ul className="space-y-1">
          {users.map((u) => (
            <li key={u.id} className="flex items-center gap-3 rounded-2xl p-2">
              <Avatar user={u} size={38} />
              <p className="min-w-0 flex-1 truncate font-medium">{userTitle(u)}</p>
              <button
                className="btn-ghost !px-3.5 !py-1.5 text-sm"
                disabled={busy}
                onClick={() => unblock(u.id).unwrap().then(() => toast.success('User unblocked')).catch((e) => toast.error(errorMessage(e)))}
              >Unblock</button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function Settings() {
  const user = useSelector(selectUser);
  const logout = useLogout();
  const [update, { isLoading }] = useUpdateProfileMutation();
  const [form, setForm] = useState({ username: '', displayName: '', bio: '', avatarUrl: '' });

  useEffect(() => {
    setForm({
      username: user.username || '',
      displayName: user.displayName || '',
      bio: user.bio || '',
      avatarUrl: user.avatarUrl || '',
    });
  }, [user]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    // Empty username means "remove it"; the server expects null for that.
    const body = { ...form, username: form.username.trim() ? form.username.trim().toLowerCase() : null };
    try {
      await update(body).unwrap();
      toast.success('Profile saved');
    } catch (err) {
      const first = err?.data?.data?.[0]?.message;
      toast.error(first || errorMessage(err, 'Could not save profile'));
    }
  };

  const copyAddress = () => navigator.clipboard?.writeText(user.walletAddress).then(() => toast.success('Address copied'));

  return (
    <div className="relative min-h-full overflow-y-auto">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-brand-purple/15 to-transparent" />
      <div className="relative mx-auto flex max-w-2xl flex-col gap-5 px-4 py-6 sm:py-10">
        <Link to="/app" className="flex w-fit items-center gap-2 rounded-full py-1.5 pl-2 pr-4 text-sm font-medium text-slate-400 transition hover:bg-white/[0.06] hover:text-white">
          <Icon name="arrowLeft" size={17} /> Back to chats
        </Link>

        {/* Profile hero */}
        <div className="glass gradient-border animate-fade-up flex flex-col items-center gap-3 rounded-[32px] px-6 py-8 text-center">
          <Avatar user={{ ...user, avatarUrl: form.avatarUrl }} size={96} ring />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{form.displayName || (form.username && `@${form.username}`) || 'Your profile'}</h1>
            {user.username && <p className="text-sm text-slate-400">@{user.username}</p>}
          </div>
          <button onClick={copyAddress} className="flex max-w-full items-center gap-2 rounded-full bg-white/[0.05] px-4 py-2 font-mono text-xs text-slate-400 transition hover:bg-white/[0.09] hover:text-white" title="Copy wallet address">
            <Icon name="wallet" size={14} /> <span className="truncate">{user.walletAddress}</span> <Icon name="copy" size={13} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <Card icon="settings" title="Profile" subtitle="How other people see you.">
            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-400">Username</span>
                <input className="input" value={form.username} onChange={set('username')} placeholder="3–20 chars: a-z, 0-9, _" maxLength={20} autoCapitalize="none" />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-400">Display name</span>
                <input className="input" value={form.displayName} onChange={set('displayName')} maxLength={40} />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-400">Bio</span>
                <textarea className="input resize-none" rows={3} value={form.bio} onChange={set('bio')} maxLength={160} />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-400">Avatar URL (https)</span>
                <input className="input" value={form.avatarUrl} onChange={set('avatarUrl')} placeholder="https://…" maxLength={500} />
              </label>
              <button className="btn-primary w-full" disabled={isLoading}>{isLoading ? 'Saving…' : 'Save changes'}</button>
            </div>
          </Card>
        </form>

        <ChangePin wallet={user.walletAddress} />
        <BlockedUsers />

        <button onClick={logout} className="flex items-center justify-center gap-2 rounded-2xl border border-red-500/20 py-3.5 font-semibold text-red-400 transition hover:bg-red-500/10">
          <Icon name="logout" size={17} /> Sign out
        </button>
      </div>
    </div>
  );
}
