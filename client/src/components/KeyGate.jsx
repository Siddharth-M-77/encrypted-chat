import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectUser } from '../store/authSlice.js';
import { selectKeys, setKeyState } from '../store/keysSlice.js';
import { getLocalRecord, isUnlocked, clearLocalRecord } from '../lib/keystore.js';
import { FullScreenLoader } from './ProtectedRoute.jsx';
import PinSetup from '../pages/PinSetup.jsx';
import PinUnlock from '../pages/PinUnlock.jsx';
import AppShell from './AppShell.jsx';

// Decide which key screen is needed: setup (no keys), unlock (local copy), restore (server backup only).
export default function KeyGate() {
  const user = useSelector(selectUser);
  const { status } = useSelector(selectKeys);
  const dispatch = useDispatch();

  useEffect(() => {
    if (status !== 'checking') return;
    let cancelled = false;
    (async () => {
      if (isUnlocked()) return dispatch(setKeyState({ status: 'unlocked' }));
      const local = await getLocalRecord(user.walletAddress);
      if (cancelled) return;
      if (local && user.hasKeys && local.publicKey === user.publicKey) {
        return dispatch(setKeyState({ status: 'locked', source: 'local', publicKey: local.publicKey }));
      }
      // A stale local record (different public key than the server's) must not be used.
      if (local) await clearLocalRecord(user.walletAddress);
      if (user.hasKeys) dispatch(setKeyState({ status: 'locked', source: 'server', publicKey: user.publicKey }));
      else dispatch(setKeyState({ status: 'setup' }));
    })();
    return () => { cancelled = true; };
  }, [status, user, dispatch]);

  if (status === 'checking') return <FullScreenLoader />;
  if (status === 'setup') return <PinSetup />;
  if (status === 'locked') return <PinUnlock />;
  return <AppShell />;
}
