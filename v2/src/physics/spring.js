import { TAU, clamp } from '../util.js';

// Global motion feel. exaggeration 0.5–2.0 scales wind-up depth and overshoot.
export const motion = { exaggeration: 1 };

// Damped spring. f = natural frequency (Hz), z = damping ratio (0.59 ≈ 10 % overshoot).
export class Spring {
  constructor(x = 0, f = 5, z = 0.85) { this.x = x; this.v = 0; this.goal = x; this.f = f; this.z = z; }
  step(dt) {
    const w = TAU * this.f;
    this.v += (w * w * (this.goal - this.x) - 2 * this.z * w * this.v) * dt;
    this.x += this.v * dt;
  }
}

// Damping ratio that gives a target overshoot fraction.
const zetaFor = (os) => { const l = Math.log(clamp(os, 0.005, 0.6)); return -l / Math.sqrt(Math.PI * Math.PI + l * l); };

/**
 * Actor: a group of springs sharing one move. act() runs the 4 phases on EVERY move:
 *   anticipation (counter-move + squash) → action (fast, under-damped) → overshoot/settle → hold.
 * Tiny moves (< opts.micro units) skip wind-up and step crisply (micro-saccade style, no drift).
 *
 * act(goal, {windup=.3, overshoot=.1, f, tempo=1, windupHold=0, hold=0, exaggerate=1, micro=3, done})
 */
export class Actor {
  constructor(init, o = {}) {
    this.base = { f: o.f || 5, z: o.z || 0.85 };
    this.keys = Object.keys(init);
    this.s = {};
    for (const k of this.keys) this.s[k] = new Spring(init[k], this.base.f, this.base.z);
    this.micro = o.micro ?? 3; // below this distance a move steps crisply (units of this actor)
    this.t = 0; this.job = null; this.sq = 0;
  }
  get(k) { return this.s[k].x; }
  goal(k) { return this.s[k].goal; }
  speed() { let a = 0; for (const k of this.keys) a += this.s[k].v * this.s[k].v; return Math.sqrt(a); }
  get phase() { return this.job ? this.job.phase : 'rest'; }

  _set(goal, f, z) {
    for (const k in goal) { const s = this.s[k]; if (!s) continue; s.goal = goal[k]; s.f = f; s.z = z; }
  }

  act(goal, o = {}) {
    const E = motion.exaggeration * (o.exaggerate ?? 1);
    const dir = {}; let d = 0;
    for (const k in goal) { if (!this.s[k]) continue; dir[k] = goal[k] - this.s[k].x; d += dir[k] * dir[k]; }
    d = Math.sqrt(d);
    const J = { goal, o, E, d, dir, f: o.f || this.base.f, phase: '', until: 0, held: false };
    this.job = J;
    if (d < (o.micro ?? this.micro)) { // micro step: crisp, no wind-up
      this._set(goal, J.f * 1.8, 0.92); J.phase = 'settle'; J.until = this.t + 120 + (o.hold || 0);
      return J;
    }
    const wf = Math.min(0.6, (o.windup ?? 0.3) * E);
    if (wf > 0.01) {
      const ant = {};
      for (const k in dir) ant[k] = this.s[k].x - dir[k] * wf;
      const ms = clamp(90 + d * 0.5, 90, 170) * (o.tempo || 1);
      J.phase = 'ant'; J.until = this.t + ms; J.hold = (o.windupHold || 0) * E;
      this._set(ant, 600 / ms, 1);
    } else this._launch(J);
    return J;
  }

  _launch(J) {
    const os = clamp((J.o.overshoot ?? 0.1) * J.E, 0.01, 0.55);
    J.phase = 'act';
    this._set(J.goal, J.f * (1 + 0.15 * (J.E - 1)), zetaFor(os));
    J.until = this.t + (1100 / J.f) * (J.o.tempo || 1);
  }

  step(dt) {
    this.t += dt * 1000;
    const J = this.job;
    if (J && this.t >= J.until) {
      if (J.phase === 'ant') {
        if (J.hold > 0 && !J.held) { J.held = true; J.until = this.t + J.hold; } else this._launch(J);
      } else if (J.phase === 'act') {
        J.phase = 'settle';
        for (const k in J.goal) if (this.s[k]) this.s[k].z = Math.max(this.s[k].z, 0.7);
        J.until = this.t + 160 + (J.o.hold || 0);
      } else {
        this.job = null;
        for (const k in J.goal) if (this.s[k]) { this.s[k].f = this.base.f; this.s[k].z = this.base.z; }
        if (J.o.done) J.o.done();
      }
    }
    this.sq += ((J && J.phase === 'ant' ? 1 : 0) - this.sq) * Math.min(1, dt * 30);
    for (const k of this.keys) this.s[k].step(dt);
  }
}

// Point mass chained to a goal (neck rings). Velocity-clamped spring.
export function follow(p, x, y, f, z, dt) {
  const w = TAU * f;
  p.vx = clamp(p.vx + (w * w * (x - p.x) - 2 * z * w * p.vx) * dt, -2500, 2500);
  p.vy = clamp(p.vy + (w * w * (y - p.y) - 2 * z * w * p.vy) * dt, -2500, 2500);
  p.x += p.vx * dt; p.y += p.vy * dt;
}
