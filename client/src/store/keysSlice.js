import { createSlice } from '@reduxjs/toolkit';

// status: 'checking' | 'setup' (no keys anywhere) | 'locked' (keys exist, PIN needed) | 'unlocked'
// source (for 'locked'): 'local' (IndexedDB on this device) | 'server' (restore from backup on a new device)
const slice = createSlice({
  name: 'keys',
  initialState: { status: 'checking', source: null, publicKey: null },
  reducers: {
    setKeyState: (s, { payload }) => ({ ...s, ...payload }),
    resetKeys: () => ({ status: 'checking', source: null, publicKey: null }),
  },
});

export const { setKeyState, resetKeys } = slice.actions;
export default slice.reducer;
export const selectKeys = (s) => s.keys;
