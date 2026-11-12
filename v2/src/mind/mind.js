// Mind — v1 MORC emotion model (bond + persona), plus energy for sleep.
//   joy · stress · boredom (v1 bond)  ·  trust · playDrive · caution · curiosity · confidence (v1 persona)  ·  energy
// Mood = best score with hysteresis + min dwell. Temperament ("modus") = how it moves/looks/sounds right now:
//   rage · angry · lazy · playful · normal. Behaviour choice follows v1 decideBehavior weights.
import { clamp, pick, rand } from '../util.js';

const EXPR = {
  neutral: ['neutral', 'neutral', 'curious'], happy: ['happy', 'glee', 'smug'], curious: ['curious', 'focused', 'awe', 'mischief'],
  suspicious: ['suspicious', 'skeptic', 'focused'], annoyed: ['annoyed', 'chevron', 'skeptic'], angry: ['angry', 'furious'],
  sleepy: ['sleepy', 'bored', 'squint'], bored: ['bored', 'squint'], sad: ['sad', 'worried'],
};

export function createMind() {
  const s = { joy: 0.45, stress: 0, boredom: 0, trust: 0.46, playDrive: 0.68, caution: 0.22, curiosity: 0.72, confidence: 0.44, energy: 0.9 };
  const st = { t: 0, mood: 'neutral', since: 0, pokes: [], sulkUntil: 0, lastInput: 0, lastPointer: -9e9, asleep: false, sleptAt: 0, nextEval: 0, nextDecide: 6500 };
  const add = (k, v) => { s[k] = clamp(s[k] + v, 0, 1); };
  // v1 rememberEvent
  function remember(type, w = 1) {
    if (type === 'gentle') { add('trust', 0.028 * w); add('confidence', 0.018 * w); add('caution', -0.02 * w); }
    else if (type === 'rough') { add('trust', -0.055 * w); add('caution', 0.085 * w); add('confidence', -0.016 * w); }
    else if (type === 'tap') { add('playDrive', 0.024 * w); add('curiosity', 0.016 * w); }
    else if (type === 'ignore') { add('playDrive', -0.03 * w); add('curiosity', 0.016 * w); }
  }

  function event(kind, x = 0) {
    const t = st.t; st.lastInput = t; st.lastPointer = t;
    if (kind === 'hover') { add('boredom', -0.004); return null; }
    if (st.asleep) { st.asleep = false; add('energy', 0.15); add('stress', 0.15); return 'wake'; }
    add('boredom', -0.3); add('energy', -0.006);
    switch (kind) {
      case 'poke': {
        st.pokes = st.pokes.filter((p) => t - p < 6000); st.pokes.push(t);
        const n = st.pokes.length;
        if (t < st.sulkUntil) { st.sulkUntil = Math.min(st.sulkUntil + 1500, t + 15000); add('stress', 0.1); return 'sulk'; }
        if (n >= 7) { s.stress = 1; remember('rough', 2); st.sulkUntil = t + rand(10000, 13000); st.pokes = []; return 'angry'; }
        if (n >= 4) { add('stress', 0.2); add('joy', -0.05); remember('rough'); return 'annoyed'; }
        add('joy', 0.07); remember('tap'); add('stress', -0.04); return 'giggle';
      }
      case 'pet':
        add('joy', 0.12 * x); add('stress', -0.25 * x); add('energy', -0.03 * x); remember('gentle', x * 3);
        if (t < st.sulkUntil) st.sulkUntil = Math.min(st.sulkUntil, t + 1500);
        return null;
      case 'fling': add('stress', 0.15 * x); remember('rough', x * 2); return x > 0.6 ? 'dizzy' : 'whoa';
      case 'drag': return null;
      case 'tap': add('curiosity', 0.06); add('joy', 0.02); remember('tap'); return 'curious';
      case 'impact': add('stress', 0.08); add('caution', 0.04); return 'impact';
    }
    return null;
  }

  function score(m) {
    if (st.asleep) return m === 'sleepy' ? 9 : 0;
    if (st.t < st.sulkUntil) return m === 'annoyed' ? 2 + s.stress : m === 'angry' ? s.stress * 2.2 : 0;
    switch (m) {
      case 'angry': return s.stress * 1.3 - 0.25;
      case 'annoyed': return s.stress * 1.05;
      case 'suspicious': return s.caution * 1.1 - 0.2;
      case 'sleepy': return (1 - s.energy) * 0.95;
      case 'bored': return s.boredom * 0.9;
      case 'happy': return s.joy * 0.95 + s.trust * 0.15 - 0.12;
      case 'curious': return s.curiosity * 0.6;
      case 'sad': return (0.25 - s.joy) * 2.2;
      default: return 0.42;
    }
  }

  // temperament ("modus") drives kinetics, eyes and voice together
  function temper() {
    if (st.asleep || s.energy < 0.3) return 'lazy';
    if (s.stress > 0.85 && st.t < st.sulkUntil) return 'rage';
    if (s.stress > 0.55) return 'angry';
    if (s.boredom > 0.6) return 'lazy';
    if (s.playDrive > 0.7 && s.joy > 0.55) return 'playful';
    return 'normal';
  }

  // tick → {changed, drive}. drive = self-started behaviour (v1 decideBehavior) or sleep/wake/forgive.
  function tick(dt) {
    st.t += dt * 1000;
    const t = st.t, idle = t - st.lastInput, near = t - st.lastPointer < 4500;
    add('stress', -0.03 * dt * (t < st.sulkUntil ? 0.3 : 1));
    add('joy', (s.joy > 0.48 ? -0.004 : 0.003) * dt);
    add('caution', -0.004 * dt); add('confidence', 0.001 * dt);
    let drive = null;
    if (st.asleep) {
      add('energy', 0.03 * dt); add('boredom', -0.05 * dt);
      if (t - st.sleptAt > 25000 && s.energy > 0.9 && Math.random() < dt * 0.05) { st.asleep = false; drive = 'wake'; }
    } else {
      add('energy', -0.0015 * dt);
      add('boredom', dt * (idle > 18000 ? 0.007 : idle > 8000 ? 0.004 : 0.001));
      if (idle > 12000) remember('ignore', dt * 0.2);
      if (s.energy < 0.15 || (s.boredom > 0.92 && idle > 45000)) { st.asleep = true; st.sleptAt = t; drive = 'sleep'; }
    }

    let changed = false;
    if (t > st.nextEval) {
      st.nextEval = t + 500;
      let best = st.mood, bs = score(st.mood) + 0.08;
      for (const m of Object.keys(EXPR)) { const v = score(m); if (v > bs) { bs = v; best = m; } }
      if (best !== st.mood && t - st.since > 1200) { st.mood = best; st.since = t; changed = true; }
    }
    if (!drive && !st.asleep && t > st.nextDecide && t > st.sulkUntil) {
      st.nextDecide = t + rand(6500, 11000);
      const stress = (s.stress + s.caution) / 2;
      const W = [
        ['investigate', 0.2 + s.curiosity * 0.65 + (near ? 0.2 : 0)],
        ['approach', near ? Math.max(0.03, s.trust * 0.65 + s.joy * 0.2 - stress * 0.6) : 0.04],
        ['retreat', near ? stress * 0.85 : 0.03],
        ['play', near ? s.playDrive * 0.65 * (1 - stress) : 0.08],
        ['rest', idle > 18000 ? 0.2 + s.boredom * 0.6 : 0.05],
        ['observe', 0.22],
        ['attention', s.boredom > 0.55 && idle > 8000 ? 0.5 : 0],
      ];
      let r = Math.random() * W.reduce((a, w) => a + w[1], 0);
      for (const [k, w] of W) { r -= w; if (r <= 0) { drive = k; break; } }
    }
    if (st.sulkUntil && t > st.sulkUntil && t - st.sulkUntil < 600) { st.sulkUntil = 0; drive = 'forgive'; }
    return { mood: st.mood, changed, drive };
  }

  return {
    s, st, event, tick, temper,
    expr: (m = st.mood) => (st.asleep ? 'sleep' : pick(EXPR[m] || EXPR.neutral)),
    get mood() { return st.asleep ? 'sleepy' : st.mood; },
    get sulking() { return st.t < st.sulkUntil; },
  };
}
