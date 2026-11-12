// Eyes — v1 look (rounded squares + feathered lid masks), rules from docs/morc-v2/REFERENCE_ANALYSIS.md:
// · both eyes = one locked unit; expression lives in the lids, shape barely deforms
// · big expression changes go THROUGH a blink frame (A → line → B); small ones tween with anticipation
// · blink ≤ 100–150 ms, both eyes collapse into one line wider than the pair
// · idle = holds + stepped 1–3 px micro-shifts + slight breathing, never drift
// · curious/side looks: the near eye grows; head pitch squashes eye height (cos)
import { TAU, clamp, rand } from '../util.js';
import { Actor, motion } from '../physics/spring.js';

// wm/hm size mult · r corner · lt top-lid drop · la top-lid slant (+angry inner-down / −sad outer-down)
// lb happy bottom arch · bl bottom-lid raise · ba bottom-lid slant (chevrons) · y · gx spacing · rot · hz heart
const P0 = { wm: 1, hm: 1, r: 11, lt: 0, la: 0, lb: 0, bl: 0, ba: 0, y: 0, gx: 0, rot: 0, hz: 0 };
const KEYS = Object.keys(P0);
const SLOW = new Set(['sleepy', 'sleep', 'bored', 'sad']);
const BASE = [{ x: -33, w: 56, h: 64 }, { x: 33, w: 56, h: 64 }]; // gap ≈ 15 % of eye width
export const GAZE = { x: 20, y: 15 };

const both = (o) => () => o;
export const EYE_PRESETS = {
  neutral: both({}),
  happy: both({ hm: 0.69, lb: 0.55, y: -4 }),
  glee: both({ wm: 1.07, hm: 0.53, r: 12, lb: 0.72, y: -14 }),
  love: both({ hz: 1 }),
  worried: both({ hm: 0.88, lt: 0.16, la: -0.38 }),
  sad: both({ wm: 1.04, hm: 0.53, r: 10, lt: 0.12, la: -0.6, y: 22, gx: 4 }),
  focused: both({ wm: 1.14, hm: 0.44, r: 7, gx: 2 }),
  annoyed: both({ wm: 1.07, hm: 0.62, r: 9, lt: 0.42, la: 0.12, y: 6 }),
  chevron: both({ wm: 1.05, hm: 0.9, r: 8, lt: 0.3, la: 0.9, bl: 0.3, ba: 0.9, gx: -2 }), // "> <" annoyed squint
  bored: both({ wm: 1.07, hm: 0.62, r: 12, lt: 0.52, y: 12 }),
  skeptic: (i) => (i ? { hm: 0.9, lt: 0.38, la: -0.28, rot: -0.06 } : { hm: 0.97 }),
  suspicious: both({ wm: 1.1, hm: 0.53, r: 8, lt: 0.12, la: 0.14 }),
  squint: both({ wm: 1.14, hm: 0.23, r: 6 }),
  stalk: both({ wm: 1.18, hm: 0.3, r: 6, lt: 0.1, y: 6 }), // cat creep: narrow, flat
  sleepy: (i) => (i ? { wm: 0.82, hm: 0.33, r: 8, rot: -0.1, y: 12 } : { hm: 0.56, r: 10, rot: 0.12, y: 8 }),
  sleep: both({ wm: 1.4, hm: 0.1, r: 3, y: 16 }),
  angry: both({ hm: 0.78, lt: 0.3, la: 0.55, y: 6 }),
  furious: both({ wm: 1.1, hm: 0.97, r: 10, lt: 0.22, la: 0.95, y: 2 }),
  scared: both({ wm: 0.8, hm: 0.9, r: 14, y: 8, gx: -6 }),            // fear = small + low
  surprised: both({ wm: 1.14, hm: 1.16, r: 24, gx: 2 }),
  awe: both({ wm: 1.1, hm: 1.12, r: 31, y: -6, gx: 1 }),
  mischief: (i) => (i ? { wm: 1.08, hm: 0.5, r: 9, lt: 0.3, la: 0.25, y: 4 } : { wm: 0.94, hm: 1.1, r: 16, y: -6, rot: 0.05 }),
  smug: (i) => (i ? { wm: 1.05, hm: 0.55, lb: 0.4, y: -2, rot: -0.05 } : { wm: 1.05, hm: 0.62, lt: 0.22, y: 2 }),
  wonky: (i) => (i ? { wm: 0.8, hm: 0.8, y: 8, rot: 0.18 } : { wm: 1.15, hm: 1.12, y: -8, rot: -0.1, gx: -4 }),
  curious: (i) => (i ? { wm: 0.86, hm: 0.86 } : { wm: 1.14, hm: 1.14 }),
  confused: (i) => (i ? { hm: 0.81, lt: 0.14, la: -0.25 } : { hm: 1.06 }),
  wink: both({ hm: 0.69, lb: 0.55, y: -2 }),
};

// how different two presets are (drives the blink-through rule)
function diff(a, b) {
  return Math.abs(a.wm - b.wm) + Math.abs(a.hm - b.hm) + Math.abs(a.lt - b.lt) + Math.abs(a.la - b.la) * 0.6 +
    Math.abs(a.lb - b.lb) + Math.abs(a.bl - b.bl) + Math.abs(a.y - b.y) / 40 + Math.abs(a.hz - b.hz);
}

export function createEyes() {
  const m = [{ ...P0 }, { ...P0 }], mv = [{}, {}];
  const gaze = new Actor({ x: 0, y: 0 }, { f: 6.5, z: 0.6, micro: 1.5 });  // ~10 % overshoot, settle ~200 ms
  const sac = new Actor({ x: 0, y: 0 }, { f: 14, z: 0.92 });
  const mac = new Actor({ x: 0, y: 0 }, { f: 8, z: 0.7 });
  const spread = new Actor({ s: 0 }, { f: 5, z: 0.7 });
  const oc = [document.createElement('canvas'), document.createElement('canvas')];
  const st = {
    t: 0, exp: 'neutral', over: [null, null], overUntil: [0, 0], shape: ['neutral', 'neutral'], ant: [0, 0], from: [null, null],
    bk0: 0, bk1: -1, snapAt: -1, nextBlink: 2500, pendBlink: -1, nextSac: 900,
    shiverUntil: 0, sx: 0, sy: 0, sNext: 0, squash: 0, dizzy: 0, q: [],
  };
  const later = (ms, fn) => st.q.push({ at: st.t + ms, fn });
  const target = (name, i) => ({ ...P0, ...EYE_PRESETS[name](i) });

  function blink(ms = rand(90, 130)) {
    if (st.t < st.bk1) return;
    st.bk0 = st.t; st.bk1 = st.t + (SLOW.has(st.exp) ? ms * 2.4 : ms);
  }
  function setExpression(name) { if (EYE_PRESETS[name]) st.exp = name; }
  function setOverride(i, name, ms) { st.over[i] = name; st.overUntil[i] = st.t + ms; }
  function setSpread(v, o = {}) { spread.act({ s: v }, { windup: 0.3, overshoot: 0.15, ...o }); }

  function look(x, y, o = {}) {
    x = clamp(x, -GAZE.x, GAZE.x); y = clamp(y, -GAZE.y, GAZE.y);
    const d = Math.hypot(x - gaze.goal('x'), y - gaze.goal('y'));
    gaze.act({ x, y }, { windup: rand(0.25, 0.35), overshoot: 0.1, f: 6.5, ...o });
    if (d > 12 && Math.random() < 0.55) st.pendBlink = st.t + rand(30, 70); // blink mid-jump
    st.nextSac = st.t + rand(1000, 3000);
  }

  const MACROS = {
    laugh() { [-7, 0, -5, 0, -3, 0].forEach((y, k) => later(k * 120, () => mac.act({ y }, { windup: k ? 0.15 : 0.35, f: 10, overshoot: 0.15 }))); },
    confused() { [6, -6, 5, -3, 0].forEach((x, k) => later(k * 110, () => mac.act({ x }, { windup: 0.2, f: 10 }))); },
    shiver(ms = 900) { st.shiverUntil = st.t + ms; },
    wink() { setOverride(Math.random() < 0.5 ? 0 : 1, 'wink', 600); },
    doubleTake() { const s = gaze.goal('x') >= 0 ? -1 : 1; look(14 * s, 0); later(280, () => blink()); later(420, () => look(0, 0, { overshoot: 0.2 })); },
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
      if (Math.random() < 0.15) st.pendBlink = t + rand(200, 260); // double blink
      st.nextBlink = t + 3000 + rand(0, 2000);
    }
    if (t > st.nextSac && gaze.phase === 'rest') { // hold, then a stepped micro-shift
      st.nextSac = t + rand(1000, 3000);
      sac.act({ x: rand(-2.5, 2.5), y: rand(-1.8, 1.8) }, { micro: 99 });
    }
    if (t < st.shiverUntil) { if (t > st.sNext) { st.sNext = t + 40; st.sx = rand(-1, 1); st.sy = rand(-1, 1); } } else st.sx = st.sy = 0;

    const snap = st.snapAt > 0 && t >= st.snapAt;
    if (snap) st.snapAt = -1;
    for (let i = 0; i < 2; i++) {
      if (st.over[i] && t > st.overUntil[i]) st.over[i] = null;
      const name = st.over[i] || st.exp, e = m[i], ev = mv[i];
      if (name !== st.shape[i]) {
        const tg0 = target(name, i), big = diff(e, tg0) > 0.4 && !st.over[i] && name !== 'sleep';
        st.shape[i] = name; st.from[i] = { ...e };
        if (big) { st.bk0 = t; st.bk1 = t + 110; st.snapAt = t + 50; st.ant[i] = 0; } // A → line → B
        else st.ant[i] = SLOW.has(name) ? 0 : (0.09 + 0.04 * Math.random()) * Math.min(1.6, E);
      }
      const tg = target(name, i);
      tg.gx += spread.get('s');
      if (snap) for (const k of KEYS) { e[k] = tg[k]; ev[k] = 0; }
      st.ant[i] = Math.max(0, st.ant[i] - dt);
      const ant = st.ant[i] > 0, slow = SLOW.has(name);
      if (ant) { const F = st.from[i]; for (const k of ['wm', 'hm', 'lt', 'la', 'lb', 'y']) tg[k] = F[k] - (tg[k] - F[k]) * 0.45 * E; }
      if (st.squash > 0.01) { const K = st.squash; tg.hm *= 1 - 0.3 * K; tg.wm *= 1 + 0.18 * K; tg.y += 8 * K; }
      tg.wm = clamp(tg.wm, 0.72, 1.32); tg.hm = clamp(tg.hm, 0.08, 1.28);
      const f = ant ? 8.3 : slow ? 3 : 5.2, z = ant ? 1 : slow ? 0.95 : 0.6, w = TAU * f;
      for (const k of KEYS) {
        let v = ev[k] || 0;
        v += (w * w * (tg[k] - e[k]) - 2 * z * w * v) * dt;
        ev[k] = v; e[k] += v * dt;
        if (!Number.isFinite(e[k])) { e[k] = tg[k]; ev[k] = 0; } // never let a bad frame kill the eyes
      }
      e.wm = clamp(e.wm, 0.6, 1.42); e.hm = clamp(e.hm, 0.02, 1.38); e.r = Math.max(0, e.r);
    }
  }

  // ctx at face centre, face units. LX/LY head look (−1..1). glow = VFX on.
  function draw(ctx, color, glowColor, LX = 0, LY = 0, glow = true) {
    const t = st.t;
    const bq = (t - st.bk0) / Math.max(1, st.bk1 - st.bk0);
    const bk = t < st.bk1 && bq >= 0 ? Math.sin(Math.PI * clamp(bq, 0, 1)) : 0;
    const lx = clamp(LX + gaze.get('x') / GAZE.x * 0.5, -1, 1), ly = clamp(LY + gaze.get('y') / GAZE.y * 0.5, -1, 1);
    const gx = gaze.get('x') + sac.get('x') + mac.get('x') + st.sx, gy = gaze.get('y') + sac.get('y') + mac.get('y') + st.sy;
    const gvx = gaze.s.x.v, gvy = gaze.s.y.v;
    let stv = clamp(Math.hypot(gvx, gvy) * 0.0016 - 0.02, 0, 0.08);
    if (gaze.phase === 'ant') stv = -0.09 * gaze.sq;
    const an = Math.atan2(gvy, gvx);
    const breathe = 1 + Math.sin(t * 0.0016) * 0.012;
    const pitch = Math.cos(clamp(ly, -1, 1) * 0.55);              // pitch squashes height
    const merge = bk * 0.42;                                       // blink: both eyes become one wide line

    for (let i = 0; i < 2; i++) {
      const b = BASE[i], e = m[i], sg = i ? 1 : -1, inner = -sg;
      const near = 1 + sg * lx * 0.12;                              // the eye on the look side grows
      const w = b.w * e.wm * near * breathe * (1 + merge) * (1 - clamp((mv[i].hm || 0) * 0.018, -0.08, 0.08));
      const h = Math.max(2, b.h * e.hm * near * breathe * pitch * (1 - bk * 0.92));
      const r = Math.min(e.r, w / 2, h / 2);
      ctx.save();
      ctx.translate(b.x * (1 - bk * 0.2) + sg * e.gx + gx, e.y + gy + ly * 6);
      if (Math.abs(stv) > 0.01) { ctx.rotate(an); ctx.scale(1 + stv, 1 - stv * 0.6); ctx.rotate(-an); }
      ctx.rotate(e.rot);
      const a = clamp(1 - e.hz, 0, 1);
      if (a > 0.02) {
        const tf = ctx.getTransform(), kq = clamp(Math.hypot(tf.a, tf.b), 0.5, 4);
        const S = Math.ceil(Math.max(w, h) * 1.6 + 30), P = Math.ceil(S * kq), cv = oc[i];
        if (cv.width < P || cv.width > P * 1.5) cv.width = cv.height = P;
        const o = cv.getContext('2d'), C = cv.width / 2;
        o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-over'; o.clearRect(0, 0, cv.width, cv.height);
        o.setTransform(kq, 0, 0, kq, C, C);
        o.fillStyle = color; rr(o, -w / 2, -h / 2, w, h, r); o.fill();
        if (h > 12) { o.fillStyle = 'rgba(255,255,255,.6)'; rr(o, -w * 0.32, -h * 0.36, w * 0.3, Math.max(2, h * 0.09), 3); o.fill(); }
        o.globalCompositeOperation = 'destination-out'; o.fillStyle = '#000'; o.shadowColor = '#000'; o.shadowBlur = 6 * kq;
        if (e.lt > 0.01 || Math.abs(e.la) > 0.01) { // top lid
          const y0 = -h / 2 + h * e.lt, sl = (h * e.la / w) * inner;
          o.beginPath(); o.moveTo(-w, -h * 2); o.lineTo(w, -h * 2); o.lineTo(w, y0 + sl * w); o.lineTo(-w, y0 - sl * w); o.closePath(); o.fill();
        }
        if (e.bl > 0.01 || Math.abs(e.ba) > 0.01) { // bottom lid (chevrons)
          const y1 = h / 2 - h * e.bl, sl = (h * e.ba / w) * inner;
          o.beginPath(); o.moveTo(-w, h * 2); o.lineTo(w, h * 2); o.lineTo(w, y1 - sl * w); o.lineTo(-w, y1 + sl * w); o.closePath(); o.fill();
        }
        if (e.lb > 0.01) { const R = w * 0.95, cy = h / 2 + R - e.lb * h * 0.8; o.beginPath(); o.arc(0, cy, R, 0, TAU); o.fill(); }
        o.shadowBlur = 0;
        ctx.globalAlpha = a;
        if (glow) { ctx.shadowColor = glowColor; ctx.shadowBlur = clamp(9 * kq, 8, 40); }
        ctx.drawImage(cv, -C / kq, -C / kq, cv.width / kq, cv.height / kq);
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      }
      if (e.hz > 0.02) {
        const s = w * 1.05 * clamp(e.hz, 0, 1.3) * (1 + Math.sin(t * 0.012) * 0.07);
        if (glow) { ctx.shadowColor = glowColor; ctx.shadowBlur = 22; }
        ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, s * 0.42);
        ctx.bezierCurveTo(-s * 0.95, -s * 0.1, -s * 0.5, -s * 0.85, 0, -s * 0.36);
        ctx.bezierCurveTo(s * 0.5, -s * 0.85, s * 0.95, -s * 0.1, 0, s * 0.42); ctx.fill(); ctx.shadowBlur = 0;
      }
      if (st.dizzy > 0.16) {
        ctx.strokeStyle = 'rgba(1,31,39,.8)'; ctx.lineWidth = 2.8; ctx.beginPath();
        for (let n = 0; n < 90; n++) {
          const q = n * 0.24 + t * 0.009 * sg, rd = (n / 90) * Math.min(w, h) * 0.43;
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

function rr(o, x, y, w, h, r) { o.beginPath(); if (o.roundRect) o.roundRect(x, y, w, h, r); else o.rect(x, y, w, h); }
