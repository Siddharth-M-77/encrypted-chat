import { useEffect, useState } from 'react';
import { getMediaUrl, isValidFileId } from '../lib/media.js';

// Download + decrypt an attachment when `enabled`; prefers the local preview URL for messages we just sent.
export function useMediaUrl(payload, enabled = true) {
  const [state, setState] = useState({ url: payload?.localUrl || null, error: null, loading: false });

  useEffect(() => {
    if (payload?.localUrl) return setState({ url: payload.localUrl, error: null, loading: false });
    if (!enabled) return undefined;
    if (!isValidFileId(payload?.fileId) || !payload?.fileKey) return setState({ url: null, error: 'Invalid attachment', loading: false });
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    getMediaUrl(payload)
      .then((url) => !cancelled && setState({ url, error: null, loading: false }))
      .catch((err) => !cancelled && setState({ url: null, error: err.message, loading: false }));
    return () => { cancelled = true; };
  }, [payload?.fileId, payload?.fileKey, payload?.localUrl, payload?.type, payload?.mimeType, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}
