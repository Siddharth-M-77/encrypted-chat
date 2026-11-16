import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import AuthShell from '../components/AuthShell.jsx';
import PinForm from '../components/PinForm.jsx';
import { selectUser } from '../store/authSlice.js';
import { selectKeys, setKeyState } from '../store/keysSlice.js';
import { api, errorMessage } from '../services/api.js';
import { getLocalRecord, unlockWithRecord } from '../lib/keystore.js';
import { useLogout } from '../hooks/useSession.js';

// Unlock with the PIN. On a new device the encrypted private key is first restored from the server backup.
export default function PinUnlock() {
  const user = useSelector(selectUser);
  const { source } = useSelector(selectKeys);
  const dispatch = useDispatch();
  const logout = useLogout();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const restoring = source === 'server';

  const onSubmit = async (pin) => {
    setBusy(true);
    setError('');
    try {
      let record;
      if (restoring) {
        const { data } = await dispatch(api.endpoints.getKeys.initiate(undefined, { forceRefetch: true })).unwrap();
        record = { publicKey: data.publicKey, encryptedPrivateKey: data.encryptedPrivateKeyBackup, salt: data.keySalt };
      } else {
        record = await getLocalRecord(user.walletAddress);
      }
      const ok = record && (await unlockWithRecord(user.walletAddress, record, pin));
      if (!ok) return setError('Incorrect PIN');
      dispatch(setKeyState({ status: 'unlocked' }));
    } catch (err) {
      setError(errorMessage(err, 'Could not unlock'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      icon="lock"
      title={restoring ? 'Restore your keys' : 'Unlock M Talk'}
      subtitle={restoring
        ? 'This is a new device. Enter your PIN to restore your encrypted keys from backup.'
        : 'Enter your PIN to decrypt your messages.'}
      footer={<button className="text-sm font-medium text-slate-500 transition hover:text-slate-200" onClick={logout}>Sign out</button>}
    >
      <PinForm busy={busy} error={error} submitLabel={restoring ? 'Restore' : 'Unlock'} onSubmit={onSubmit} />
    </AuthShell>
  );
}
