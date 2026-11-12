// Body mode "Target": neck rings ported from v1 (R2.9 chain + lag deformation, target dash style).
// Chain: face → neck → inner ring → outer ring (outer half-anchored to the body base = telescoping neck).
import { TAU, clamp } from '../util.js';
import { Actor, follow } from '../physics/spring.js';

const R_IN = 108, R_OUT = 145, GAP = 26, REACH = 46;

export function createTarget() {
  const P = () => ({ x: 0, y: 0, vx: 0, vy: 0 });
  const neck = P(), inner = P(), outer = P();
  const spin = [new Actor({ a: 0 }, { f: 1.1, z: 0.9 }), new Actor({ a: 1 }, { f: 0.85, z: 0.9 })];

  function step(dt, face, base, headVx) {
    follow(neck, face.x, face.y, 4.2, 0.85, dt);
    follow(inner, neck.x, neck.y, 8.1, 0.7, dt);
    follow(outer, base.x + (inner.x - base.x) * 0.5, base.y + (inner.y - base.y) * 0.5, 4.3, 0.74, dt);
    // ring gap limit
    const g = Math.hypot(outer.x - inner.x, outer.y - inner.y);
    if (g > GAP) { outer.x = inner.x + (outer.x - inner.x) * GAP / g; outer.y = inner.y + (outer.y - inner.y) * GAP / g; outer.vx *= 0.84; outer.vy *= 0.84; }
    // face reach limit: drag the chain along
    const dx = face.x - outer.x, dy = face.y - outer.y, d = Math.hypot(dx, dy);
    if (d > REACH) {
      const ex = (dx / d) * (d - REACH), ey = (dy / d) * (d - REACH);
      outer.x += ex; outer.y += ey; inner.x += ex * 0.5; inner.y += ey * 0.5;
    }
    // rings rotate against head yaw (inertia), plus their own slow idle spins
    spin[0].s.a.v -= headVx * 0.00045; spin[1].s.a.v += headVx * 0.0003;
    spin[0].step(dt); spin[1].step(dt);
  }

  function draw(ctx, face, lift, colors) {
    const L = 1 + lift * 0.08;
    [inner, outer].forEach((p, j) => {
      const r = (j ? R_OUT : R_IN) * L;
      const lagX = clamp((p.vx - face.vx) / 1800, -0.055, 0.055), lagY = clamp((p.vy - face.vy) / 1800, -0.055, 0.055);
      const a = spin[j].get('a');
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(clamp((lagX - lagY) * 0.35, -0.05, 0.05)); ctx.scale(1 + lagX, 1 + lagY);
      ctx.strokeStyle = j ? colors.ring2 : colors.ring;
      ctx.setLineDash([3, 9]); ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, r, a, a + TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.lineWidth = 5;
      for (let k = 0; k < 4; k++) { const q = a + (k * TAU) / 4; ctx.beginPath(); ctx.arc(0, 0, r, q, q + 0.12); ctx.stroke(); }
      ctx.restore();
    });
  }

  function reset(x, y) { for (const p of [neck, inner, outer]) { p.x = x; p.y = y; p.vx = p.vy = 0; } }

  return { step, draw, reset, spin, rpm: () => spin.map((s) => Math.round(Math.abs(s.s.a.v) * 60 / TAU)) };
}
