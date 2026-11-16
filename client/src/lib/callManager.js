import toast from 'react-hot-toast';
import { store } from '../store/index.js';
import { api } from '../services/api.js';
import { setCall, resetCall } from '../store/callSlice.js';
import { emitAck, getSocket } from './socket.js';
import { startRingtone, stopRingtone } from './ringtone.js';

// Owns the WebRTC peer connection and media streams (non-serializable, so kept out of Redux).
// Media flows peer-to-peer, encrypted by DTLS-SRTP; the server only relays signaling.

const RING_TIMEOUT_MS = 45_000;
const DISCONNECT_GRACE_MS = 8_000;

let pc = null;
let localStream = null;
let remoteStream = null;
let activeCallId = null;
let pendingOffer = null; // SDP of an incoming call that has not been answered yet
let remoteQueue = []; // ICE candidates received before the remote description was set
let localQueue = []; // our ICE candidates generated before the server knows about the call
let signalingReady = false;
let ringTimer = null;
let disconnectTimer = null;

const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());
export const subscribeStreams = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const getLocalStream = () => localStream;
export const getRemoteStream = () => remoteStream;

const status = () => store.getState().call.status;
const set = (patch) => store.dispatch(setCall(patch));
const sendSignal = (event, payload) => getSocket()?.emit(event, payload);

const END_MESSAGES = {
  rejected: 'Call declined',
  cancelled: 'Call cancelled',
  disconnected: 'The other person disconnected',
  answered_elsewhere: null,
  rejected_elsewhere: null,
  ended: 'Call ended',
};

function mediaErrorMessage(err) {
  if (err?.name === 'NotAllowedError') return 'Microphone or camera permission was denied';
  if (err?.name === 'NotFoundError') return 'No microphone or camera was found';
  return err?.message || 'Could not access microphone or camera';
}

async function getMedia(video) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Calls need a secure (HTTPS) connection');
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
  });
}

async function createPeer(callId) {
  const { data } = await store.dispatch(api.endpoints.getIceServers.initiate(undefined, { forceRefetch: true })).unwrap();
  pc = new RTCPeerConnection({ iceServers: data.iceServers });
  remoteStream = new MediaStream();

  pc.ontrack = (e) => {
    e.streams[0]?.getTracks().forEach((t) => { if (!remoteStream.getTracks().includes(t)) remoteStream.addTrack(t); });
    notify();
  };
  pc.onicecandidate = (e) => {
    if (!e.candidate) return;
    const candidate = e.candidate.toJSON();
    if (signalingReady) sendSignal('call:ice-candidate', { callId, candidate });
    else localQueue.push(candidate);
  };
  pc.onconnectionstatechange = () => {
    const st = pc?.connectionState;
    if (st === 'connected') {
      clearTimeout(disconnectTimer);
      if (status() !== 'active') set({ status: 'active', startedAt: Date.now() });
    } else if (st === 'disconnected') {
      // Often transient (network blip): give it a few seconds to recover before hanging up.
      clearTimeout(disconnectTimer);
      disconnectTimer = setTimeout(() => endCall('Connection lost'), DISCONNECT_GRACE_MS);
    } else if (st === 'failed') {
      endCall('Connection failed');
    }
  };
  localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
}

function flushLocalCandidates(callId) {
  signalingReady = true;
  localQueue.forEach((candidate) => sendSignal('call:ice-candidate', { callId, candidate }));
  localQueue = [];
}

async function drainRemoteCandidates() {
  const queued = remoteQueue;
  remoteQueue = [];
  for (const c of queued) await pc.addIceCandidate(c).catch(() => {});
}

// Release everything and return to idle. Safe to call repeatedly.
function cleanup() {
  clearTimeout(ringTimer);
  clearTimeout(disconnectTimer);
  stopRingtone();
  if (pc) {
    pc.ontrack = null; pc.onicecandidate = null; pc.onconnectionstatechange = null;
    pc.close();
  }
  localStream?.getTracks().forEach((t) => t.stop());
  pc = null; localStream = null; remoteStream = null;
  activeCallId = null; pendingOffer = null; remoteQueue = []; localQueue = []; signalingReady = false;
  notify();
  store.dispatch(resetCall());
}

// ---- Public API ----

export async function startCall({ peer, conversationId, video }) {
  if (status() !== 'idle') return toast.error('You are already in a call');
  const callId = crypto.randomUUID();
  activeCallId = callId;
  set({ status: 'calling', callId, direction: 'out', peer, conversationId, video, muted: false, cameraOff: false });
  try {
    localStream = await getMedia(video);
    notify();
    await createPeer(callId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await emitAck('call:offer', { callId, to: peer.id, conversationId, video, sdp: offer.sdp });
    flushLocalCandidates(callId);
    ringTimer = setTimeout(() => endCall('No answer'), RING_TIMEOUT_MS);
  } catch (err) {
    cleanup();
    toast.error(mediaErrorMessage(err));
  }
  return undefined;
}

export function handleIncoming({ callId, from, video, sdp, conversationId }) {
  if (status() !== 'idle') return; // the server already prevents double calls; ignore stragglers
  activeCallId = callId;
  pendingOffer = sdp;
  set({ status: 'ringing', callId, direction: 'in', peer: from, conversationId, video, muted: false, cameraOff: false });
  startRingtone();
  ringTimer = setTimeout(() => { if (status() === 'ringing') cleanup(); }, RING_TIMEOUT_MS + 15_000);
}

export async function acceptCall() {
  const { callId, video } = store.getState().call;
  if (status() !== 'ringing' || callId !== activeCallId) return;
  clearTimeout(ringTimer);
  stopRingtone();
  set({ status: 'connecting' });
  try {
    localStream = await getMedia(video);
    notify();
    await createPeer(callId);
    await pc.setRemoteDescription({ type: 'offer', sdp: pendingOffer });
    await drainRemoteCandidates();
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await emitAck('call:answer', { callId, sdp: answer.sdp });
    flushLocalCandidates(callId);
  } catch (err) {
    sendSignal('call:end', { callId });
    cleanup();
    toast.error(mediaErrorMessage(err));
  }
}

export function rejectCall() {
  if (status() !== 'ringing') return;
  sendSignal('call:reject', { callId: activeCallId });
  cleanup();
}

// Hang up (or cancel a call that is still ringing). Pass a message to also show a toast.
export function endCall(message) {
  if (activeCallId) sendSignal('call:end', { callId: activeCallId });
  cleanup();
  if (typeof message === 'string') toast(message);
}

export async function handleAnswered({ callId, sdp }) {
  if (callId !== activeCallId || !pc) return;
  clearTimeout(ringTimer);
  set({ status: 'connecting' });
  try {
    await pc.setRemoteDescription({ type: 'answer', sdp });
    await drainRemoteCandidates();
  } catch {
    endCall('Could not connect the call');
  }
}

export async function handleRemoteCandidate({ callId, candidate }) {
  if (callId !== activeCallId) return;
  if (pc?.remoteDescription) await pc.addIceCandidate(candidate).catch(() => {});
  else remoteQueue.push(candidate); // arrived early (e.g. while still ringing)
}

export function handleEnded({ callId, reason }) {
  if (callId !== activeCallId) return;
  const message = END_MESSAGES[reason];
  cleanup();
  if (message) toast(message);
}

export function toggleMute() {
  const track = localStream?.getAudioTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  set({ muted: !track.enabled });
}

export function toggleCamera() {
  const track = localStream?.getVideoTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  set({ cameraOff: !track.enabled });
}

// Used on logout / unmount.
export const resetCalls = () => { if (activeCallId) endCall(); else cleanup(); };
