// Audio: one shared AudioContext (unlocked on first tap), computer-like SFX, servo whirr, Cozmo-style babble.
// All synthesised — no files, no network. Babble per BRIEF measurements: ~7 syl/s, 80–160 ms syllables,
// energy in a 1.6–2.4 kHz band, pitch glides, 5–7 Hz wobble vibrato, sung vowels ~0.6 s.
import { rand, clamp } from '../util.js';

const VOICE = { // base pitch Hz, syllables/s, contour (+ rising end, − falling), wobble
  neutral: [520, 7, 0, 0], happy: [640, 7.5, 0.25, 0], glee: [720, 8, 0.35, 0.3], curious: [560, 6.5, 0.45, 0],
  annoyed: [430, 7, -0.1, 0], angry: [330, 8.5, -0.25, 0.2], sad: [380, 5, -0.4, 0.4], sleepy: [300, 4, -0.35, 0],
  bored: [400, 5, -0.2, 0], scared: [700, 9, 0.2, 1], dizzy: [480, 6, 0, 1],
};

export function createAudio() {
  let ctx = null, master, sfxBus, voiceBus, whirr = null, lastWhirr = 0;
  const on = { sfx: true, voice: true };

  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = on.sfx ? 1 : 0; sfxBus.connect(master);
    voiceBus = ctx.createGain(); voiceBus.gain.value = on.voice ? 1 : 0; voiceBus.connect(master);
    // servo whirr: detuned saws → bandpass, gain follows movement speed
    const g = ctx.createGain(); g.gain.value = 0;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.5; bp.frequency.value = 600;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type = o2.type = 'sawtooth'; o1.frequency.value = 95; o2.frequency.value = 97.5;
    o1.connect(bp); o2.connect(bp); bp.connect(g); g.connect(sfxBus); o1.start(); o2.start();
    whirr = { g, bp, o1, o2 };
  }

  const ok = (bus) => ctx && ctx.state === 'running' && bus;
  function tone(t0, dur, f0, f1, type, peak, bus, filt) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.012, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    if (filt) { o.connect(filt); filt.connect(g); } else o.connect(g);
    g.connect(bus); o.start(t0); o.stop(t0 + dur + 0.03);
    return o;
  }

  const SFX = {
    beep: (t) => tone(t, 0.07, 1320, 1320, 'square', 0.06, sfxBus),
    chirp: (t) => tone(t, 0.07, 900, 2600, 'sine', 0.09, sfxBus),
    confirm: (t) => { tone(t, 0.07, 880, 880, 'square', 0.05, sfxBus); tone(t + 0.08, 0.09, 1320, 1320, 'square', 0.05, sfxBus); },
    deny: (t) => { tone(t, 0.09, 420, 400, 'square', 0.06, sfxBus); tone(t + 0.1, 0.14, 260, 240, 'square', 0.06, sfxBus); },
    data: (t) => { for (let k = 0; k < 7; k++) tone(t + k * 0.035, 0.025, rand(1200, 3200), rand(1200, 3200), 'square', 0.035, sfxBus); },
    boop: (t) => tone(t, 0.09, 640, 300, 'triangle', 0.12, sfxBus),
    thud: (t) => { tone(t, 0.18, 140, 50, 'sine', 0.3, sfxBus); tone(t, 0.05, 900, 200, 'square', 0.04, sfxBus); },
    whoosh: (t) => { const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.5; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.2); tone(t, 0.22, 180, 120, 'sawtooth', 0.08, sfxBus, f); },
    powerup: (t) => tone(t, 0.35, 300, 1800, 'square', 0.04, sfxBus),
    powerdown: (t) => tone(t, 0.5, 900, 120, 'square', 0.04, sfxBus),
  };
  function sfx(name) { if (!ok(sfxBus) || !on.sfx || !SFX[name]) return; SFX[name](ctx.currentTime + 0.005); }

  // speed in face-units/s; called ~30 Hz from the sim
  function servo(speed, now) {
    if (!whirr || !ctx || now - lastWhirr < 33) return; lastWhirr = now;
    const s = clamp(speed / 900, 0, 1), T = ctx.currentTime;
    whirr.g.gain.setTargetAtTime(on.sfx ? s * s * 0.07 : 0, T, 0.03);
    whirr.bp.frequency.setTargetAtTime(450 + s * 1400, T, 0.04);
    whirr.o1.frequency.setTargetAtTime(80 + s * 70, T, 0.05); whirr.o2.frequency.setTargetAtTime(82 + s * 72, T, 0.05);
  }

  // One syllable: pulse source → bright formant (1.6–2.4 kHz) + body formant, short envelope, glide, optional wobble.
  function syllable(t0, dur, f0, f1, wob) {
    const o = ctx.createOscillator(); o.type = 'square';
    o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    if (wob > 0) {
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = rand(5, 7); lg.gain.value = f0 * 0.06 * wob; l.connect(lg); lg.connect(o.frequency);
      l.start(t0); l.stop(t0 + dur + 0.03);
    }
    const g = ctx.createGain(), f2 = ctx.createBiquadFilter(), f1b = ctx.createBiquadFilter(), mix = ctx.createGain();
    f2.type = 'bandpass'; f2.frequency.value = rand(1600, 2400); f2.Q.value = 4;
    f1b.type = 'bandpass'; f1b.frequency.value = rand(600, 950); f1b.Q.value = 3;
    o.connect(f2); o.connect(f1b); f2.connect(mix); f1b.connect(mix); mix.gain.value = 1.6; mix.connect(g);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.012);
    g.gain.setValueAtTime(0.5, t0 + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    g.connect(voiceBus); o.start(t0); o.stop(t0 + dur + 0.03);
  }

  // Babble n syllables in a mood. `last` gives the phrase-end contour. Returns duration (s).
  function babble(n, mood = 'neutral', last = true) {
    if (!ok(voiceBus) || !on.voice) return n / 7;
    const [base, rate, contour, wob] = VOICE[mood] || VOICE.neutral;
    let t = ctx.currentTime + 0.01, p = base * rand(0.92, 1.08);
    for (let k = 0; k < n; k++) {
      const dur = clamp(rand(0.8, 1.6) / rate, 0.08, 0.2);
      const end = last && k === n - 1;
      const target = end ? p * (1 + contour) : p * rand(0.85, 1.18);
      syllable(t, dur, p, Math.max(80, target), wob);
      p = clamp(target * rand(0.95, 1.05), base * 0.6, base * 1.6);
      t += dur + rand(0.005, 0.03);
    }
    return t - ctx.currentTime;
  }

  // Sung vowel: stacked harmonics, ~0.6 s, glide up then down, vibrato.
  function sing(mood = 'happy') {
    if (!ok(voiceBus) || !on.voice) return;
    const base = (VOICE[mood] || VOICE.happy)[0], t = ctx.currentTime + 0.01, d = 0.62;
    [1, 2, 3].forEach((h, k) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(base * h, t); o.frequency.linearRampToValueAtTime(base * h * 1.25, t + d * 0.45); o.frequency.linearRampToValueAtTime(base * h * 0.95, t + d);
      l.frequency.value = 6; lg.gain.value = base * h * 0.015; l.connect(lg); lg.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16 / (k + 1), t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(voiceBus); o.start(t); l.start(t); o.stop(t + d + 0.03); l.stop(t + d + 0.03);
    });
  }

  function set(k, v) {
    on[k] = !!v;
    if (!ctx) return;
    const bus = k === 'sfx' ? sfxBus : voiceBus;
    bus.gain.setTargetAtTime(v ? 1 : 0, ctx.currentTime, 0.02);
  }

  return { unlock, sfx, servo, babble, sing, set, get ready() { return !!ctx && ctx.state === 'running'; } };
}
