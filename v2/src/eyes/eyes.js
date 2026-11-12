// Eyes v2: organic rounded-quad shapes (no lid masks). Every expression is a real shape change:
// corner drops (lids), edge bulges (dome / crescent), top/bottom width (taper), skew, roundness.
// Both eyes move as ONE unit. Every shape change has anticipation (counter-shape) → overshoot → settle.
import { TAU, clamp, rand } from '../util.js';
import { Actor, motion } from '../physics/spring.js';

// w/h size mult · r corner radius · ti/to inner/outer top-corner drop · bi/bo bottom-corner raise (×h)
// tb/bb top/bottom bulge (+ outward dome, − concave) · tw/bw top/bottom width mult · sk skew (+ outward)
// y offset · gx extra spacing · rot tilt · hz heart morph
const P0 = { w: 1, h: 1, r: 16, ti: 0, to: 0, bi: 0, bo: 0, tb: 0.06, bb: 0.06, tw: 1, bw: 1, sk: 0, y: 0, gx: 0, rot: 0, hz: 0 };
const KEYS = Object.keys(P0);
const SLOW = new Set(['sleepy', 'sleep', 'bored', 'sad']);
const BASE = [{ x: -42, w: 54, h: 66 }, { x: 42, w: 54, h: 66 }];
export const GAZE = { x: 22, y: 16 }; // eyes stay inside the display; head/body do the big moves

const both = (o) => () => o;
export const EYE_PRESETS = {
  neutral: both({}),
  happy: both({ h: 0.58, r: 22, tb: 0.32, bb: -0.5, bi: 0.08, bo: 0.08, y: -4 }),
  glee: both({ w: 1.12, h: 0.52, r: 24, tb: 0.4, bb: -0.72, bi: 0.1, bo: 0.1, y: -12, gx: 2 }),
  love: both({ hz: 1 }),
  sad: both({ h: 0.6, to: 0.42, ti: 0, tw: 0.92, bb: 0.12, y: 18, gx: 4 }),
  worried: both({ h: 0.85, to: 0.26, sk: -0.04, bb: 0.1, gx: -2 }),
  angry: both({ h: 0.78, ti: 0.48, to: 0.02, bw: 1.06, tb: 0, y: 6, gx: -2 }),
  furious: both({ w: 1.1, h: 0.95, ti: 0.62, to: 0.04, tb: 0, bw: 1.1, y: 2, gx: -4 }),
  annoyed: both({ h: 0.6, ti: 0.24, to: 0.24, tb: -0.04, y: 6 }),
  bored: both({ h: 0.52, ti: 0.34, to: 0.3, tb: -0.04, y: 12 }),
  skeptic: (i) => (i ? { h: 0.58, ti: 0.28, to: 0.1, tb: 0, rot: -0.05 } : { h: 1.04, tb: 0.14 }),
  suspicious: both({ w: 1.1, h: 0.5, ti: 0.2, to: 0.06, tb: 0, gx: -3 }),
  squint: both({ w: 1.14, h: 0.26, r: 9, tb: 0, bb: 0 }),
  focused: both({ w: 1.14, h: 0.46, r: 10, tb: 0, bb: 0, gx: -3 }),
  sleepy: (i) => ({ h: 0.4, to: 0.34, ti: 0.12, tb: 0, y: 10, rot: i ? -0.08 : 0.08 }),
  sleep: both({ w: 1.35, h: 0.08, r: 4, tb: 0, bb: 0.3, y: 16 }),
  scared: both({ w: 0.84, h: 1.2, r: 20, tb: 0.22, bi: 0.08, bo: 0.08, y: -12, gx: -6 }),
  surprised: both({ w: 1.1, h: 1.18, r: 30, tb: 0.26, bb: 0.26, gx: 3 }),
  awe: both({ w: 1.08, h: 1.12, r: 34, tb: 0.32, bb: 0.32, y: -6, gx: 2 }),
  mischief: (i) => (i ? { h: 0.5, ti: 0.36, tb: 0, y: 4 } : { h: 1.08, r: 20, tb: 0.2, y: -6, rot: 0.05 }),
  smug: (i) => (i ? { h: 0.55, tb: 0.3, bb: -0.36, y: -2, rot: -0.05 } : { h: 0.6, ti: 0.26, to: 0.26, tb: -0.03, y: 2 }),
  wonky: (i) => (i ? { w: 0.8, h: 0.8, y: 8, rot: 0.18 } : { w: 1.15, h: 1.12, y: -8, rot: -0.1, gx: -4 }),
  curious: (i) => (i ? { w: 0.86, h: 0.84, tb: 0.04 } : { w: 1.14, h: 1.14, tb: 0.16 }),
  confused: (i) => (i ? { h: 0.78, to: 0.22, ti: 0 } : { h: 1.06, tb: 0.16 }),
  wink: both({ h: 0.3, r: 14, tb: 0.34, bb: -0.62, bi: 0.1, bo: 0.1, y: -2 }),
};

export function createEyes() {
  const m = [{ ...P0 }, { ...P0 }], mv = [{}, {}];
  const gaze = new Actor({ x: 0, y: 0 }, { f: 6, z: 0.82 });   // shared by both eyes
  const sac = new Actor({ x: 0, y: 0 }, { f: 14, z: 0.92 });   // idle micro-saccades
  const mac = new Actor({ x: 0, y: 0 }, { f: 8, z: 0.7 });     // macro offsets (laugh hop, shake)
  const spread = new Actor({ s: 0 }, { f: 5, z: 0.7 });        // gesture-driven spacing (never idles)
  const st = {
    t: 0, exp: 'neutral', over: [null, null], overUntil: [0, 0], ant: [0, 0], from: [null, null], shape: ['neutral', 'neutral'],
    bk0: 0, bk1: -1, nextBlink: 2500, pendBlink: -1, nextSac: 900, shiverUntil: 0, sx: 0, sy: 0, sNext: 0,
    squash: 0, dizzy: 0, q: [],
  };
  const later = (ms, fn) => st.q.push({ at: st.t + ms, fn });

  function setExpression(name) { if (EYE_PRESETS[name]) st.exp = name; }
  function setOverride(i, name, ms) { st.over[i] = name; st.overUntil[i] = st.t + ms; }

  function blink(ms = rand(100, 150)) {
    if (st.t < st.bk1) return;
    st.bk0 = st.t; st.bk1 = st.t + (SLOW.has(st.exp) ? ms * 2.4 : ms);
  }

  // x,y in face units; clamped so the eyes never leave the display.
  function look(x, y, o = {}) {
    x = clamp(x, -GAZE.x, GAZE.x); y = clamp(y, -GAZE.y, GAZE.y);
    const d = Math.hypot(x - gaze.goal('x'), y - gaze.goal('y'));
    gaze.act({ x, y }, { windup: rand(0.25, 0.35), overshoot: 0.1, f: 6, micro: 1.5, ...o });
    if (d > 12 && Math.random() < 0.55) st.pendBlink = st.t + rand(40, 90);
    st.nextSac = st.t + rand(500, 1400);
  }

  function setSpread(v, o = {}) { spread.act({ s: v }, { windup: 0.3, overshoot: 0.15, ...o }); }

  const MACROS = {
    laugh() {
      const ys = [-7, 0, -5, 0, -3, 0];
      ys.forEach((y, k) => later(k * 135, () => mac.act({ y }, { windup: k ? 0.15 : 0.35, f: 9, overshoot: 0.15 })));
    },
    confused() {
      [6, -6, 5, -3, 0].forEach((x, k) => later(k * 115, () => mac.act({ x }, { windup: 0.2, f: 9 })));
    },
    shiver(ms = 900) { st.shiverUntil = st.t + ms; },
    wink() { setOverride(Math.random() < 0.5 ? 0 : 1, 'wink', 650); },
    doubleTake() { later(0, () => look(-gaze.goal('x') || 14, 0)); later(260, () => blink()); later(420, () => look(0, 0, { overshoot: 0.2 })); },
  };
  function macro(kind, ms) { if (MACROS[kind]) MACROS[kind](ms); }

  function step(dt) {
    st.t += dt * 1000;
    const t = st.t, E = motion.exaggeration;
    for (let k = st.q.length - 1; k >= 0; k--) if (st.q[k].at <= t) { const fn = st.q[k].fn; st.q.splice(k, 1); fn(); }
    gaze.step(dt); sac.step(dt); mac.step(dt); spread.step(dt);

    if (st.pendBlink > 0 && t >= st.pendBlink) { st.pendBlink = -1; blink(); }
    if (t > st.nextBlink && st.exp !== 'sleep') {
      blink();
      if (Math.random() < 0.15) st.pendBlink = t + rand(230, 300);
      st.nextBlink = t + 3000 + rand(0, 2000);
    }
    if (t > st.nextSac && gaze.phase === 'rest') {
      st.nextSac = t + rand(600, 2800);
      sac.act({ x: rand(-2.5, 2.5), y: rand(-1.8, 1.8) }, { micro: 99 });
    }
    if (t < st.shiverUntil && t > st.sNext) { st.sNext = t + 40; st.sx = rand(-1, 1); st.sy = rand(-1, 1); }
    else if (t >= st.shiverUntil) st.sx = st.sy = 0;

    for (let i = 0; i < 2; i++) {
      if (st.over[i] && t > st.overUntil[i]) st.over[i] = null;
      const name = st.over[i] || st.exp;
      if (name !== st.shape[i]) { // shape change → anticipation (counter-shape), skipped for slow moods
        st.shape[i] = name; st.from[i] = { ...m[i] };
        st.ant[i] = SLOW.has(name) ? 0 : (0.09 + 0.05 * Math.random()) * Math.min(1.6, E);
      }
      st.ant[i] = Math.max(0, st.ant[i] - dt);
      const slow = SLOW.has(name), ant = st.ant[i] > 0;
      const tg = { ...P0, ...EYE_PRESETS[name](i) };
      tg.gx += spread.get('s');
      if (ant) { const F = st.from[i], k = 0.5 * E; for (const key of KEYS) if (key !== 'hz') tg[key] = F[key] - (tg[key] - F[key]) * k; }
      if (st.squash > 0.01) { const K = st.squash; tg.h *= 1 - 0.3 * K; tg.w *= 1 + 0.18 * K; tg.y += 8 * K; }
      tg.w = clamp(tg.w, 0.7, 1.4); tg.h = clamp(tg.h, 0.06, 1.3);
      const f = ant ? 10 : slow ? 3 : 5.4, z = ant ? 1 : slow ? 0.95 : 0.52, w = TAU * f;
      const e = m[i], ev = mv[i];
      for (const k of KEYS) {
        let v = ev[k] || 0;
        v += (w * w * (tg[k] - e[k]) - 2 * z * w * v) * dt;
        ev[k] = v; e[k] += v * dt;
      }
      e.w = clamp(e.w, 0.6, 1.5); e.h = clamp(e.h, 0.03, 1.4); e.r = Math.max(2, e.r);
      for (const k of ['ti', 'to', 'bi', 'bo']) e[k] = clamp(e[k], 0, 0.8);
      e.tb = clamp(e.tb, -0.6, 0.6); e.bb = clamp(e.bb, -0.85, 0.6);
    }
  }

  // ctx at face centre in face units. LX/LY = head look direction (−1..1) for perspective.
  function draw(ctx, color, LX = 0, LY = 0) {
    const t = st.t;
    const bq = (t - st.bk0) / Math.max(1, st.bk1 - st.bk0);
    const bk = t < st.bk1 && bq >= 0 ? Math.sin(Math.PI * clamp(bq, 0, 1)) : 0;
    const lx = clamp(LX + gaze.get('x') / GAZE.x * 0.6, -1, 1), ly = clamp(LY + gaze.get('y') / GAZE.y * 0.6, -1, 1);
    const gx = gaze.get('x') + sac.get('x') + mac.get('x') + st.sx, gy = gaze.get('y') + sac.get('y') + mac.get('y') + st.sy;
    const gvx = gaze.s.x.v, gvy = gaze.s.y.v;
    let stv = clamp(Math.hypot(gvx, gvy) * 0.002 - 0.02, 0, 0.08);
    if (gaze.phase === 'ant') stv = -0.09 * gaze.sq;
    const an = Math.atan2(gvy, gvx), par = 1 - Math.abs(lx) * 0.12; // parallax: spacing compresses on side looks
    ctx.fillStyle = color;

    for (let i = 0; i < 2; i++) {
      const b = BASE[i], e = m[i], sg = i ? 1 : -1;
      const side = Math.max(0, sg * lx);                       // the eye on the look side foreshortens
      const w = b.w * e.w * (1 + bk * 0.25) * (1 - side * 0.22);
      const h = Math.max(1.6, b.h * e.h * (1 - bk * 0.93) * (1 - side * 0.06));
      const tw = e.tw * (1 + Math.min(0, ly) * 0.14), bw = e.bw * (1 - Math.max(0, ly) * 0.14);
      ctx.save();
      ctx.translate(b.x * par + sg * e.gx + gx, e.y + gy);
      if (Math.abs(stv) > 0.01) { ctx.rotate(an); ctx.scale(1 + stv, 1 - stv * 0.6); ctx.rotate(-an); }
      ctx.rotate(e.rot);
      const a = clamp(1 - e.hz, 0, 1), k = 1 - bk;
      if (a > 0.02) {
        ctx.globalAlpha = a;
        eyePath(ctx, w, h, sg, e.r, e.ti * k, e.to * k, e.bi * k, e.bo * k, e.tb * k, e.bb * k, tw, bw, e.sk);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (e.hz > 0.02) {
        const s = w * 1.05 * clamp(e.hz, 0, 1.3) * (1 + Math.sin(t * 0.012) * 0.07);
        ctx.beginPath(); ctx.moveTo(0, s * 0.42);
        ctx.bezierCurveTo(-s * 0.95, -s * 0.1, -s * 0.5, -s * 0.85, 0, -s * 0.36);
        ctx.bezierCurveTo(s * 0.5, -s * 0.85, s * 0.95, -s * 0.1, 0, s * 0.42); ctx.fill();
      }
      if (st.dizzy > 0.16) {
        ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3; ctx.beginPath();
        for (let n = 0; n < 80; n++) {
          const q = n * 0.26 + t * 0.009 * sg, rd = (n / 80) * Math.min(w, h) * 0.42;
          n ? ctx.lineTo(Math.cos(q) * rd, Math.sin(q) * rd) : ctx.moveTo(0, 0);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  return {
    st, gaze, look, blink, macro, setExpression, setOverride, setSpread, step, draw,
    get expression() { return st.exp; },
    set squash(v) { st.squash = v; },
    set dizzy(v) { st.dizzy = v; },
  };
}

// Rounded quad with bulged edges. sg −1 = left eye (outer side is left).
function eyePath(c, w, h, sg, r, ti, to, bi, bo, tb, bb, tw, bw, sk) {
  const L = sg < 0, tL = L ? to : ti, tR = L ? ti : to, bL = L ? bo : bi, bR = L ? bi : bo, kx = sg * sk * w;
  const P = [[-w / 2 * tw + kx, -h / 2 + tL * h], [w / 2 * tw + kx, -h / 2 + tR * h], [w / 2 * bw, h / 2 - bR * h], [-w / 2 * bw, h / 2 - bL * h]];
  const bul = [tb * h, 0.02 * w, bb * h, 0.02 * w]; // top, right, bottom, left (outward +)
  const rr = Math.min(r, w / 2, h / 2);
  const IN = [], OUT = [];
  for (let i = 0; i < 4; i++) {
    const p = P[i], a = P[(i + 3) % 4], n = P[(i + 1) % 4];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]) || 1, ln = Math.hypot(n[0] - p[0], n[1] - p[1]) || 1;
    const q = Math.min(rr, la / 2, ln / 2);
    IN[i] = [p[0] + (a[0] - p[0]) / la * q, p[1] + (a[1] - p[1]) / la * q];
    OUT[i] = [p[0] + (n[0] - p[0]) / ln * q, p[1] + (n[1] - p[1]) / ln * q];
  }
  c.beginPath(); c.moveTo(OUT[0][0], OUT[0][1]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4, A = OUT[i], B = IN[j], dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy) || 1;
    // bulge scales with how much straight edge is left after corner rounding (no spikes on round eyes)
    const full = Math.hypot(P[j][0] - P[i][0], P[j][1] - P[i][1]) || 1, bg = bul[i] * 2 * Math.min(1, (l / full) * 1.6);
    c.quadraticCurveTo((A[0] + B[0]) / 2 + (dy / l) * bg, (A[1] + B[1]) / 2 - (dx / l) * bg, B[0], B[1]);
    c.quadraticCurveTo(P[j][0], P[j][1], OUT[j][0], OUT[j][1]);
  }
  c.closePath();
}
