// Synthesised ringtone (no audio asset needed): two short beeps every two seconds.
let ctx = null;
let timer = null;

function beep(offset) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const t = ctx.currentTime + offset;
  osc.frequency.value = 480;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.15, t + 0.03);
  gain.gain.linearRampToValueAtTime(0, t + 0.35);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.4);
}

export function startRingtone() {
  stopRingtone();
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctx.resume?.().catch(() => {}); // browsers may keep audio suspended until the user interacts with the page
    const ring = () => { beep(0); beep(0.5); };
    ring();
    timer = setInterval(ring, 2000);
    navigator.vibrate?.([300, 150, 300]);
  } catch { /* audio is a nicety; the call UI still shows */ }
}

export function stopRingtone() {
  clearInterval(timer);
  timer = null;
  ctx?.close().catch(() => {});
  ctx = null;
}
