// Bodies: neck chain physics shared by all modes + independent ring motors.
// Modes: target (neck rings) · circle (one disc, tick marks) · screen (rounded rect, Cozmo-ish) · eyes (none).
import { TAU, clamp, rand } from '../util.js';
import { Actor, follow } from '../physics/spring.js';

const R_IN = 108, R_OUT = 145, GAP = 22, REACH = 42;
export const BODY_MODES = ['target', 'circle', 'screen', 'eyes'];

// Ring motor behaviours. Every one runs through act(): wind-up, ease, overshoot, settle.
const MOVES = {
  micro: (a, s) => [a + s * rand(0.03, 0.08), { f: 7, windup: 0.25, overshoot: 0.2 }],
  small: (a, s) => [a + s * rand(0.2, 0.6), { f: 3, windup: 0.3, overshoot: 0.12 }],
  drift: (a, s) => [a + s * rand(1, 3), { f: 0.35, windup: 0.12, overshoot: 0.03 }],
  reverse: (a, s) => [a - s * rand(0.5, 1.5), { f: 2.2, windup: 0.35, overshoot: 0.15 }],
  jerk: (a, s) => [a + s * rand(1.2, 3), { f: 4.5, windup: 0.3, windupHold: 60, overshoot: 0.22 }],
};
const STYLE = { // weights: micro small drift reverse jerk rest · interval scale
  neutral: [3, 3, 3, 1, 1, 3, 1], happy: [2, 3, 1, 2, 3, 1, 0.7], angry: [4, 1, 0, 3, 4, 0, 0.45],
  sleepy: [0, 0, 4, 0, 0, 5, 2.2], curious: [3, 4, 2, 1, 1, 2, 0.8], scared: [6, 0, 0, 1, 1, 1, 0.4],
  sad: [0, 1, 3, 0, 0, 4, 1.8], bored: [1, 1, 3, 0, 0, 4, 1.5],
};
const NAMES = ['micro', 'small', 'drift', 'reverse', 'jerk', 'rest'];

export function createBody() {
  const P = () => ({ x: 0, y: 0, vx: 0, vy: 0 });
  const neck = P(), inner = P(), outer = P();
  const spin = [new Actor({ a: 0 }, { f: 1.2, z: 0.9, micro: 0.004 }), new Actor({ a: 1 }, { f: 0.9, z: 0.9, micro: 0.004 })];
  const motor = [{ next: 600, dir: 1, last: '' }, { next: 1300, dir: -1, last: '' }];
  let t = 0;

  function runMotor(j, mood, energy) {
    const M = motor[j], W = STYLE[mood] || STYLE.neutral;
    if (t < M.next || spin[j].phase === 'act' || spin[j].phase === 'ant') return;
    let sum = 0; for (let k = 0; k < 6; k++) sum += W[k];
    let r = Math.random() * sum, k = 0;
    while (k < 5 && (r -= W[k]) > 0) k++;
    let name = NAMES[k];
    if (name === M.last && name !== 'rest' && Math.random() < 0.6) name = 'small';
    M.last = name;
    if (Math.random() < 0.3) M.dir = -M.dir;
    if (name !== 'rest') {
      const [goal, o] = MOVES[name](spin[j].get('a'), M.dir);
      if (mood === 'sleepy') o.f *= 0.5;
      spin[j].act({ a: goal }, o);
      if (name === 'reverse') M.dir = -M.dir;
    }
    M.next = t + rand(350, 2600) * W[6] / (0.5 + energy);
  }

  // kick: counter-rotate during a wind-up (dir ±1). Reactive coupling to head/body moves.
  function kick(dir, amt = 0.5) {
    spin.forEach((s, j) => s.act({ a: s.get('a') - dir * amt * (j ? -0.7 : 1) }, { f: 3.5, windup: 0.3, overshoot: 0.18 }));
    motor.forEach((m) => { m.next = t + rand(500, 1200); });
  }

  function step(dt, face, base, headVx, mood, energy) {
    t += dt * 1000;
    follow(neck, face.x, face.y, 6, 0.9, dt);
    follow(inner, neck.x, neck.y, 9, 0.86, dt);
    follow(outer, base.x + (inner.x - base.x) * 0.5, base.y + (inner.y - base.y) * 0.5, 5.5, 0.86, dt);
    const g = Math.hypot(outer.x - inner.x, outer.y - inner.y);
    if (g > GAP) { outer.x = inner.x + (outer.x - inner.x) * GAP / g; outer.y = inner.y + (outer.y - inner.y) * GAP / g; outer.vx *= 0.84; outer.vy *= 0.84; }
    const dx = face.x - outer.x, dy = face.y - outer.y, d = Math.hypot(dx, dy);
    if (d > REACH) { const ex = (dx / d) * (d - REACH), ey = (dy / d) * (d - REACH); outer.x += ex; outer.y += ey; inner.x += ex * 0.5; inner.y += ey * 0.5; }
    spin[0].s.a.v -= headVx * 0.0003; spin[1].s.a.v += headVx * 0.0002;
    runMotor(0, mood, energy); runMotor(1, mood, energy);
    spin[0].step(dt); spin[1].step(dt);
  }

  function lagT(ctx, p, face) { // subtle stretch from relative velocity (not jelly)
    const lx = clamp((p.vx - face.vx) / 4000, -0.025, 0.025), ly = clamp((p.vy - face.vy) / 4000, -0.025, 0.025);
    ctx.translate(p.x, p.y); ctx.scale(1 + lx, 1 + ly);
  }

  function draw(ctx, mode, face, lift, tilt, C) {
    const L = 1 + lift * 0.08;
    if (mode === 'target') {
      [inner, outer].forEach((p, j) => {
        const r = (j ? R_OUT : R_IN) * L, a = spin[j].get('a');
        ctx.save(); lagT(ctx, p, face);
        ctx.strokeStyle = j ? C.ring2 : C.ring;
        ctx.setLineDash([3, 9]); ctx.lineWidth = 2.5; ctx.lineDashOffset = -a * r;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        ctx.lineWidth = 5;
        for (let k = 0; k < 4; k++) { const q = a + (k * TAU) / 4; ctx.beginPath(); ctx.arc(0, 0, r, q, q + 0.12); ctx.stroke(); }
        ctx.restore();
      });
    } else if (mode === 'circle') {
      const r = 150 * L, a = spin[0].get('a');
      ctx.save(); lagT(ctx, outer, face);
      ctx.strokeStyle = C.ring2; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = C.ring; ctx.lineWidth = 2;
      for (let k = 0; k < 24; k++) { const q = a + (k * TAU) / 24, l = k % 6 ? 6 : 13; ctx.beginPath(); ctx.moveTo(Math.cos(q) * (r - 4), Math.sin(q) * (r - 4)); ctx.lineTo(Math.cos(q) * (r - 4 - l), Math.sin(q) * (r - 4 - l)); ctx.stroke(); }
      ctx.restore();
    } else if (mode === 'screen') {
      const w = 250 * L, h = 190 * L;
      ctx.save(); lagT(ctx, neck, face); ctx.rotate(tilt * 0.6);
      ctx.strokeStyle = C.ring; ctx.lineWidth = 3; ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-w / 2, -h / 2, w, h, 46); else ctx.rect(-w / 2, -h / 2, w, h);
      ctx.stroke();
      ctx.restore();
    }
  }

  function reset(x, y) { for (const p of [neck, inner, outer]) { p.x = x; p.y = y; p.vx = p.vy = 0; } }

  return { step, draw, reset, kick, spin, rpm: () => spin.map((s) => Math.round(Math.abs(s.s.a.v) * 60 / TAU)) };
}
