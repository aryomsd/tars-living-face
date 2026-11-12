// Audio: one shared AudioContext (unlocked on first tap), computer-like SFX, servo whirr, Cozmo-style babble.
// All synthesised — no files, no network. Babble per BRIEF measurements: ~7 syl/s, 80–160 ms syllables,
// energy in a 1.6–2.4 kHz band, pitch glides, 5–7 Hz wobble vibrato, sung vowels ~0.6 s.
import { rand, clamp, pick } from '../util.js';

const VOICE = { // base pitch Hz, syllables/s, contour (+ rising end, − falling), wobble
  neutral: [520, 7, 0, 0], happy: [640, 7.5, 0.25, 0], glee: [720, 8, 0.35, 0.3], curious: [560, 6.5, 0.45, 0],
  annoyed: [430, 7, -0.1, 0], angry: [330, 8.5, -0.25, 0.2], sad: [380, 5, -0.4, 0.4], sleepy: [300, 4, -0.35, 0],
  bored: [400, 5, -0.2, 0], scared: [700, 9, 0.2, 1], dizzy: [480, 6, 0, 1],
  suspicious: [450, 6, 0.1, 0], rage: [250, 10, -0.3, 0.5], lazy: [280, 4, -0.3, 0], playful: [680, 8, 0.3, 0.2],
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

  // ---- Voice A: formant speech synth -----------------------------------------------------
  // Glottal saw → 3 parallel formant bandpasses (F1/F2/F3, shifted up for a tiny robot) → envelope.
  // Consonants from a shared noise buffer. Words come from the subtitle text, so rhythm and
  // vowel colour follow the line MORC "says" — synthesized gibberish-speech, Cozmo style.
  const FORM = { a: [850, 1220, 2810], e: [610, 1900, 2600], i: [300, 2300, 3000], o: [590, 880, 2540],
    u: [320, 920, 2400], y: [300, 2300, 3000], '@': [500, 1500, 2500], m: [250, 1000, 2400], n: [250, 1400, 2500], l: [360, 1300, 2600], r: [420, 1300, 1700], w: [300, 700, 2300] };
  const SHIFT = 1.32, CLS = { p: 'stop', t: 'stop', k: 'stop', b: 'stop', d: 'stop', g: 'stop', c: 'stop', q: 'stop',
    s: 'fric', f: 'fric', h: 'breath', z: 'fric', v: 'fric', x: 'fric', j: 'fric', m: 'nasal', n: 'nasal', l: 'liquid', r: 'liquid', w: 'liquid' };
  let noise = null, crush = null;
  function noiseBuf() {
    if (noise) return noise;
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noise;
  }
  function crusher() { // light bitcrush = robot grit
    if (crush) return crush;
    crush = ctx.createWaveShaper(); const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.round(x * 12) / 12; }
    crush.curve = c; crush.connect(voiceBus); return crush;
  }
  function phonemes(word) {
    const w = String(word).toLowerCase().replace(/[^a-z]/g, '');
    const out = [];
    for (let i = 0; i < w.length; i++) {
      const ch = w[i];
      if ('aeiouy'.includes(ch)) { if (out.length && out[out.length - 1].v) out[out.length - 1].d += 0.4; else out.push({ v: true, f: FORM[ch], d: 1 }); }
      else if (CLS[ch]) out.push({ v: false, k: CLS[ch], ch });
    }
    if (!out.some((p) => p.v)) out.push({ v: true, f: FORM['@'], d: 1 });
    return out;
  }
  // Speak one word; returns its duration (s). The subtitle waits this long before the next word.
  function speakWord(word, mood = 'neutral', last = false) {
    if (!ok(voiceBus) || !on.voice) return 0.08 + String(word).length * 0.05;
    const [base, rate, contour, wob] = VOICE[mood] || VOICE.neutral;
    const ph = phonemes(word), T0 = ctx.currentTime + 0.01, vow = clamp(1 / rate, 0.09, 0.22);
    const src = ctx.createOscillator(); src.type = 'sawtooth';
    const buzz = ctx.createOscillator(), bg = ctx.createGain(); buzz.frequency.value = rand(22, 32); bg.gain.value = base * 0.012;
    buzz.connect(bg); bg.connect(src.frequency);
    const env = ctx.createGain(); env.gain.value = 0.0001;
    const F = [0, 1, 2].map((k) => { const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = [7, 11, 13][k]; const g = ctx.createGain(); g.gain.value = [1, 0.7, 0.35][k]; src.connect(f); f.connect(g); g.connect(env); return f; });
    env.connect(crusher());
    if (wob > 0) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = rand(5, 7); lg.gain.value = base * 0.05 * wob; l.connect(lg); lg.connect(src.frequency); l.start(T0); l.stop(T0 + 3); }
    let t = T0, p = base * rand(0.9, 1.1);
    const nb = noiseBuf();
    const burst = (at, dur, freq, gain) => {
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = nb; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.4;
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(gain, at + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      s.connect(f); f.connect(g); g.connect(voiceBus); s.start(at, Math.random() * 0.3); s.stop(at + dur + 0.02);
    };
    const nV = ph.filter((q) => q.v).length; let vi = 0;
    src.frequency.setValueAtTime(p, t);
    for (const q of ph) {
      if (q.v) {
        const d = vow * q.d * rand(0.85, 1.15), end = last && ++vi === nV;
        F.forEach((f, k) => f.frequency.setTargetAtTime(q.f[k] * SHIFT, t, 0.012));
        const tgt = end ? p * (1 + contour) : p * rand(0.88, 1.14);
        src.frequency.setTargetAtTime(Math.max(90, tgt), t, d * 0.4);
        env.gain.setTargetAtTime(0.55, t, 0.008); env.gain.setTargetAtTime(0.4, t + d * 0.5, 0.03);
        t += d; p = clamp(tgt, base * 0.6, base * 1.7);
      } else if (q.k === 'stop') { env.gain.setTargetAtTime(0.0001, t, 0.004); burst(t + 0.022, 0.018, 2500, 0.25); t += 0.035; }
      else if (q.k === 'fric') { env.gain.setTargetAtTime(0.03, t, 0.006); burst(t, 0.055, q.ch === 's' || q.ch === 'z' ? 5200 : 3200, 0.16); t += 0.05; }
      else if (q.k === 'breath') { env.gain.setTargetAtTime(0.02, t, 0.006); burst(t, 0.04, 1800, 0.08); t += 0.035; }
      else { const f0 = FORM[q.ch] || FORM.n; F.forEach((f, k) => f.frequency.setTargetAtTime(f0[k] * SHIFT, t, 0.01)); env.gain.setTargetAtTime(q.k === 'nasal' ? 0.2 : 0.3, t, 0.008); t += 0.045; }
    }
    env.gain.setTargetAtTime(0.0001, t, 0.02);
    src.start(T0); buzz.start(T0); src.stop(t + 0.15); buzz.stop(t + 0.15);
    return t - T0 + (last ? 0.12 : 0.04);
  }

  const SYL = ['ba', 'di', 'mo', 'ko', 'pi', 'nu', 'la', 'we', 'to', 'bee', 'doo', 'mi', 'ga', 'yo', 'zo', 'hm'];
  // Babble n syllables of pseudo-words in a mood. Returns duration (s).
  function babble(n, mood = 'neutral') {
    let w = '', d = 0, k = 0;
    while (k < n) { w += pick(SYL); k++; if (Math.random() < 0.4 || k === n) { d += speakAt(w, mood, k === n, d); w = ''; } }
    return d;
  }
  function speakAt(word, mood, last, delay) {
    if (!ok(voiceBus)) return 0.2;
    if (delay < 0.01) return speakWord(word, mood, last);
    setTimeout(() => speakWord(word, mood, last), delay * 1000);
    return 0.08 + word.length * 0.055;
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

  return { unlock, sfx, servo, babble, speakWord, sing, set, get ready() { return !!ctx && ctx.state === 'running'; } };
}
