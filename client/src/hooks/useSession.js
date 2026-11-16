import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { api, notifySessionExpired, useLogoutMutation } from '../services/api.js';
import { setActiveProvider } from '../lib/wallet.js';
import { lock } from '../lib/keystore.js';
import { clearMediaCache } from '../lib/media.js';
import { resetCalls } from '../lib/callManager.js';
import { disconnectSocket } from '../lib/socket.js';
import { resetKeys } from '../store/keysSlice.js';
import { resetChat } from '../store/chatSlice.js';
import { selectAuthStatus } from '../store/authSlice.js';

// Set while the user (or the wallet watcher) is signing out on purpose, so the guard does not announce an expiry.
let deliberateLogout = false;

// Remove everything sensitive that lives in this tab: decrypted keys, media, call, chat cache, socket.
function wipeLocalSession(dispatch) {
  resetCalls();
  clearMediaCache();
  lock(); // wipes the decrypted private key and group keys from memory
  setActiveProvider(null);
  disconnectSocket();
  dispatch(resetKeys());
  dispatch(resetChat());
  dispatch(api.util.resetApiState());
}

// Logout clears the server cookie, then wipes local state.
export function useLogout() {
  const [logout] = useLogoutMutation();
  const dispatch = useDispatch();
  return useCallback(async () => {
    deliberateLogout = true;
    try { await logout().unwrap(); } catch { /* cookie may already be gone */ }
    wipeLocalSession(dispatch);
    setTimeout(() => { deliberateLogout = false; }, 500);
  }, [logout, dispatch]);
}

// If the session ends without the user pressing "Sign out" (expired cookie, revoked), wipe local state too.
export function useSessionGuard() {
  const status = useSelector(selectAuthStatus);
  const dispatch = useDispatch();
  const prev = useRef(status);
  useEffect(() => {
    if (prev.current === 'authed' && status === 'anon') {
      wipeLocalSession(dispatch);
      if (!deliberateLogout) notifySessionExpired();
    }
    prev.current = status;
  }, [status, dispatch]);
}
