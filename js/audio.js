let ctx = null;
let master = null;
let keyOsc = null;
let keyGain = null;

export function getContext() {
  return ctx;
}

export function unlockAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return Promise.reject(new Error("Web Audio fehlt"));
  if (!ctx) {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") {
    return Promise.race([
      ctx.resume(),
      new Promise((resolve) => setTimeout(resolve, 700)),
    ]);
  }
  return Promise.resolve();
}

export function isAudioReady() {
  return !!(ctx && ctx.state === "running");
}

function tone(freq, start, duration, volume) {
  if (!ctx || duration <= 0) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, start);
  const vol = Math.max(0, Math.min(1, volume));
  const a = 0.004;
  const r = Math.min(0.01, duration / 4);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(vol, start + a);
  const end = start + duration;
  g.gain.setValueAtTime(vol, Math.max(start + a, end - r));
  g.gain.linearRampToValueAtTime(0.0001, end);
  osc.connect(g);
  g.connect(master);
  osc.start(start);
  osc.stop(end + 0.02);
}

/**
 * Schedule Morse tones. Returns { durationSec, stop }.
 * `source` may be plain text ("SOS") or a Morse string (".- / ...").
 */
export function playMorse(source, settings, { onStart, onEnd } = {}) {
  if (!ctx) return { durationSec: 0, stop() {} };
  const {
    wpm = 15,
    farnsworth = true,
    charWpm = 18,
    pitch = 600,
    volume = 0.7,
  } = settings || {};

  // Import is avoided here to keep audio.js standalone; timeline is passed
  // in from the app via playTimeline.
  return { source, wpm, farnsworth, charWpm, pitch, volume, onStart, onEnd };
}

let stopCurrent = null;

export function stopPlayback() {
  if (stopCurrent) {
    stopCurrent();
    stopCurrent = null;
  }
}

export function playTimeline(timeline, { pitch = 600, volume = 0.7, onEnd } = {}) {
  if (!ctx) return 0;
  stopPlayback();
  const startAt = ctx.currentTime + 0.03;
  const vol = Math.max(0, Math.min(1, volume));
  const freq = Math.max(200, Math.min(1400, pitch));
  const oscillators = [];
  for (const ev of timeline.events) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    const t0 = startAt + ev.start / 1000;
    const dur = ev.duration / 1000;
    osc.frequency.setValueAtTime(freq, t0);
    const a = 0.004;
    const r = Math.min(0.012, dur / 4);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + a);
    g.gain.setValueAtTime(vol, Math.max(t0 + a, t0 + dur - r));
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
    oscillators.push(osc);
  }
  const durationSec = timeline.duration / 1000;
  let ended = false;
  const finish = () => {
    if (ended) return;
    ended = true;
    stopCurrent = null;
    if (onEnd) onEnd();
  };
  const timer = setTimeout(finish, (durationSec + 0.05) * 1000);
  stopCurrent = () => {
    clearTimeout(timer);
    for (const osc of oscillators) {
      try {
        osc.stop();
      } catch {
        /* already stopped */
      }
    }
    finish();
  };
  return durationSec;
}

export function startSidetone(pitch = 600, volume = 0.7) {
  if (!ctx) return;
  stopSidetone();
  const t = ctx.currentTime;
  keyOsc = ctx.createOscillator();
  keyGain = ctx.createGain();
  keyOsc.type = "sine";
  keyOsc.frequency.setValueAtTime(Math.max(200, Math.min(1400, pitch)), t);
  keyGain.gain.setValueAtTime(0.0001, t);
  keyGain.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, volume)), t + 0.004);
  keyOsc.connect(keyGain);
  keyGain.connect(master);
  keyOsc.start(t);
}

export function stopSidetone() {
  if (!ctx || !keyOsc || !keyGain) {
    keyOsc = null;
    keyGain = null;
    return;
  }
  const t = ctx.currentTime;
  try {
    keyGain.gain.cancelScheduledValues(t);
    keyGain.gain.setValueAtTime(keyGain.gain.value, t);
    keyGain.gain.linearRampToValueAtTime(0.0001, t + 0.012);
    keyOsc.stop(t + 0.04);
  } catch {
    /* ignore */
  }
  keyOsc = null;
  keyGain = null;
}

export function playCue(kind, { volume = 0.55 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + 0.01;
  const v = Math.max(0, Math.min(1, volume)) * 0.55;
  if (kind === "ok") {
    tone(660, t, 0.09, v);
    tone(880, t + 0.09, 0.14, v);
  } else if (kind === "fail") {
    tone(220, t, 0.18, v * 0.9);
    tone(180, t + 0.1, 0.16, v * 0.7);
  } else if (kind === "level") {
    tone(523, t, 0.1, v);
    tone(659, t + 0.11, 0.1, v);
    tone(784, t + 0.22, 0.12, v);
    tone(1046, t + 0.34, 0.22, v);
  } else if (kind === "combo") {
    tone(880, t, 0.07, v);
    tone(1174, t + 0.08, 0.12, v);
  } else if (kind === "tick") {
    tone(800, t, 0.04, v * 0.4);
  } else if (kind === "blitz") {
    tone(440, t, 0.08, v);
    tone(660, t + 0.09, 0.1, v);
    tone(880, t + 0.2, 0.16, v);
  }
}

export function playPitchPreview(pitch, volume) {
  if (!ctx) return;
  tone(pitch, ctx.currentTime + 0.01, 0.22, volume);
}

// silence unused warning if bundlers look at tone via playCue only
void tone;
