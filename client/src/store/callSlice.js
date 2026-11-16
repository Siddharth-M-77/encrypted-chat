import { createSlice } from '@reduxjs/toolkit';

// Serializable call state only. MediaStreams and the RTCPeerConnection live in lib/callManager.js.
// status: 'idle' | 'calling' (outgoing, ringing remotely) | 'ringing' (incoming) | 'connecting' | 'active'
const initial = {
  status: 'idle', callId: null, direction: null, peer: null, conversationId: null,
  video: false, muted: false, cameraOff: false, startedAt: null,
};

const slice = createSlice({
  name: 'call',
  initialState: initial,
  reducers: {
    setCall: (s, { payload }) => ({ ...s, ...payload }),
    resetCall: () => initial,
  },
});

export const { setCall, resetCall } = slice.actions;
export default slice.reducer;
