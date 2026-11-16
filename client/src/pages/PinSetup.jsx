import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import AuthShell from '../components/AuthShell.jsx';
import Icon from '../components/Icons.jsx';
import PinForm from '../components/PinForm.jsx';
import { selectUser } from '../store/authSlice.js';
import { setKeyState } from '../store/keysSlice.js';
import { usePutKeysMutation, errorMessage } from '../services/api.js';
import { createKeys, clearLocalRecord } from '../lib/keystore.js';

// First login: create the keypair, encrypt the private key with the PIN, back it up to the server.
export default function PinSetup() {
  const user = useSelector(selectUser);
  const dispatch = useDispatch();
  const [putKeys] = usePutKeysMutation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (pin) => {
    setBusy(true);
    setError('');
    try {
      const payload = await createKeys(user.walletAddress, pin);
      try {
        await putKeys(payload).unwrap();
      } catch (err) {
        // Do not keep a local key the server never learned about.
        await clearLocalRecord(user.walletAddress);
        throw err;
      }
      dispatch(setKeyState({ status: 'unlocked', publicKey: payload.publicKey }));
      toast.success('Encryption keys created');
    } catch (err) {
      setError(errorMessage(err, 'Could not set up encryption'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      icon="key"
      title="Create your PIN"
      subtitle="Your PIN encrypts your private key before it leaves this device. We never see your PIN or your key."
      footer={(
        <p className="flex items-start gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/[0.07] p-3.5 text-left text-xs leading-relaxed text-amber-200/90">
          <Icon name="alert" size={16} className="mt-0.5" />
          If you forget this PIN, your message history cannot be recovered. Nobody, including us, can reset it.
        </p>
      )}
    >
      <PinForm confirm busy={busy} error={error} submitLabel="Create encryption keys" onSubmit={onSubmit} />
    </AuthShell>
  );
}
