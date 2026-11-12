// Mind v0: stats with decay + event deltas, mood = best score with hysteresis + min dwell,
// drives (attention / play / rest) that let MORC start things on its own. Bounded sulk.
import { clamp, pick, rand } from '../util.js';

const EXPR = {
  neutral: ['neutral'], happy: ['happy', 'glee', 'smug'], curious: ['curious', 'focused', 'awe'],
  annoyed: ['annoyed', 'skeptic', 'suspicious'], angry: ['angry', 'furious'], sleepy: ['sleepy'],
  bored: ['bored', 'squint'], sad: ['sad', 'worried'],
};

export function createMind() {
  const s = { joy: 0.55, energy: 0.85, irritation: 0, curiosity: 0.6, bond: 0.3, boredom: 0, fatigue: 0 };
  const st = { t: 0, mood: 'neutral', since: 0, pokes: [], sulkUntil: 0, lastInput: 0, asleep: false, sleptAt: 0, nextEval: 0, nextDrive: 8000 };
  const add = (k, v) => { s[k] = clamp(s[k] + v, 0, 1); };

  // Returns a reaction key for the body/voice layer.
  function event(kind, x = 0) {
    const t = st.t; st.lastInput = t;
    const wasAsleep = st.asleep;
    if (st.asleep && kind !== 'hover') { st.asleep = false; add('energy', 0.15); add('irritation', 0.15); return 'wake'; }
    if (kind === 'hover') { add('boredom', -0.004); return null; }
    add('boredom', -0.3); add('fatigue', 0.015);
    if (kind === 'poke') {
      st.pokes = st.pokes.filter((p) => t - p < 6000); st.pokes.push(t);
      const n = st.pokes.length;
      if (t < st.sulkUntil) { st.sulkUntil = Math.min(st.sulkUntil + 1500, t + 15000); return 'sulk'; }
      if (n >= 7) { s.irritation = 1; st.sulkUntil = t + rand(10000, 13000); st.pokes = []; return 'angry'; }
      if (n >= 4) { add('irritation', 0.2); add('joy', -0.05); return 'annoyed'; }
      add('joy', 0.07); add('bond', 0.02); add('irritation', -0.05); return 'giggle';
    }
    if (kind === 'pet') { // x = seconds held this tick
      add('joy', 0.12 * x); add('bond', 0.05 * x); add('irritation', -0.25 * x); add('energy', -0.04 * x);
      if (t < st.sulkUntil) { st.sulkUntil = Math.min(st.sulkUntil, t + 1500); }
      return null;
    }
    if (kind === 'fling') { add('irritation', 0.12 * x); add('fatigue', 0.05); return x > 0.6 ? 'dizzy' : 'whoa'; }
    if (kind === 'drag') { add('curiosity', -0.002); return null; }
    if (kind === 'tap') { add('curiosity', 0.08); add('joy', 0.02); return 'curious'; }
    if (kind === 'impact') { add('irritation', 0.08); return 'impact'; }
    return wasAsleep ? 'wake' : null;
  }

  function score(m) {
    if (st.asleep) return m === 'sleepy' ? 9 : 0;
    if (st.t < st.sulkUntil) return m === 'annoyed' ? 2 + s.irritation : m === 'angry' ? s.irritation * 2 : 0;
    switch (m) {
      case 'angry': return s.irritation * 1.3 - 0.25;
      case 'annoyed': return s.irritation * 1.05;
      case 'sleepy': return Math.max(s.fatigue, 1 - s.energy) * 0.95;
      case 'bored': return s.boredom * 0.9;
      case 'happy': return s.joy * 0.95 + s.bond * 0.15 - 0.12;
      case 'curious': return s.curiosity * 0.62;
      case 'sad': return (0.28 - s.joy) * 2.2;
      default: return 0.42;
    }
  }

  // Returns {mood, changed, drive} — drive is a self-started behaviour key or null.
  function tick(dt) {
    st.t += dt * 1000;
    const t = st.t, idle = t - st.lastInput;
    add('irritation', -0.035 * dt * (t < st.sulkUntil ? 0.3 : 1));
    add('joy', (s.joy > 0.55 ? -0.006 : 0.004) * dt);
    add('fatigue', -0.008 * dt);
    add('curiosity', (idle > 5000 ? 0.012 : -0.004) * dt);
    add('bond', -0.0004 * dt);
    if (st.asleep) { add('energy', 0.03 * dt); add('boredom', -0.05 * dt); if (t - st.sleptAt > 25000 && s.energy > 0.9 && Math.random() < dt * 0.05) { st.asleep = false; return { mood: st.mood, changed: false, drive: 'wake' }; } }
    else { add('energy', -0.0012 * dt - s.fatigue * 0.002 * dt); if (idle > 9000) add('boredom', 0.018 * dt); }
    let drive = null;
    if (!st.asleep && (s.energy < 0.18 || (s.boredom > 0.92 && idle > 45000))) { st.asleep = true; st.sleptAt = t; drive = 'sleep'; }

    let changed = false;
    if (t > st.nextEval) {
      st.nextEval = t + 500;
      let best = st.mood, bs = score(st.mood) + 0.08;
      for (const m of Object.keys(EXPR)) { const v = score(m); if (v > bs) { bs = v; best = m; } }
      if (best !== st.mood && t - st.since > 1200) { st.mood = best; st.since = t; changed = true; }
    }
    if (!drive && !st.asleep && t > st.nextDrive && t > st.sulkUntil) {
      st.nextDrive = t + rand(6000, 14000);
      if (s.boredom > 0.55 && idle > 8000) drive = 'attention';
      else if (s.energy > 0.6 && s.joy > 0.62 && Math.random() < 0.6) drive = 'play';
      else if (idle > 5000 && Math.random() < 0.7) drive = s.curiosity > 0.5 ? 'explore' : 'idle';
    }
    if (t > st.sulkUntil && st.sulkUntil && t - st.sulkUntil < 600) { st.sulkUntil = 0; drive = 'forgive'; }
    return { mood: st.mood, changed, drive };
  }

  return {
    s, st, event, tick,
    expr: (m = st.mood) => (st.asleep ? 'sleep' : pick(EXPR[m] || EXPR.neutral)),
    get mood() { return st.asleep ? 'sleepy' : st.mood; },
    get sulking() { return st.t < st.sulkUntil; },
  };
}
