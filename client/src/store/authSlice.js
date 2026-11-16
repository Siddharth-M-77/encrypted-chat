import { createSlice } from '@reduxjs/toolkit';
import { api } from '../services/api.js';

// status: 'loading' (checking session) | 'authed' | 'anon'
const slice = createSlice({
  name: 'auth',
  initialState: { user: null, status: 'loading' },
  reducers: {},
  extraReducers: (b) => {
    const { me, verify, logout, updateProfile, putKeys, blockUser, unblockUser } = api.endpoints;
    b.addCase('auth/sessionExpired', (s) => { if (s.status === 'authed') { s.user = null; s.status = 'anon'; } });
    b.addMatcher(me.matchFulfilled, (s, { payload }) => { s.user = payload.data.user; s.status = 'authed'; });
    b.addMatcher(me.matchRejected, (s) => { s.user = null; s.status = 'anon'; });
    b.addMatcher(verify.matchFulfilled, (s, { payload }) => { s.user = payload.data.user; s.status = 'authed'; });
    b.addMatcher(updateProfile.matchFulfilled, (s, { payload }) => { s.user = payload.data.user; });
    b.addMatcher(putKeys.matchFulfilled, (s, { payload }) => { s.user = payload.data.user; });
    b.addMatcher(blockUser.matchFulfilled, (s, { payload }) => { s.user = payload.data.user; });
    b.addMatcher(unblockUser.matchFulfilled, (s, { payload }) => { s.user = payload.data.user; });
    b.addMatcher(logout.matchFulfilled, (s) => { s.user = null; s.status = 'anon'; });
    b.addMatcher(logout.matchRejected, (s) => { s.user = null; s.status = 'anon'; });
  },
});

export default slice.reducer;
export const selectUser = (s) => s.auth.user;
export const selectAuthStatus = (s) => s.auth.status;
