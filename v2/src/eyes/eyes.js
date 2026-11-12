// Eyes — port of the v1 R2.35–R2.42 renderer. Two rounded rects, expression = lid masks.
// Both eyes move as ONE unit; idle life = stepped micro-saccades; blinks merge into one line.
import { TAU, clamp, rand } from '../util.js';
import { Actor } from '../physics/spring.js';

// wm/hm width/height mult, r corner, lt top-lid drop, la lid slant (+angry/-sad), lb happy bottom arch,
// y vertical offset, gx extra spacing, rot tilt, hz heart morph.
const P0 = { wm: 1, hm: 1, r: 11, lt: 0, la: 0, lb: 0, y: 0, gx: 0, rot: 0, hz: 0 };
const ANT = ['wm', 'hm', 'lt', 'la', 'lb', 'y'];
const SLOW = new Set(['sleepy', 'sleep', 'bored']);
const BASE = [{ x: -35, w: 56, h: 65 }, { x: 35, w: 54, h: 62 }];

export const EYE_PRESETS = {
  neutral: () => ({}),
  happy: () => ({ hm: 0.69, lb: 0.55, y: -4 }),
  glee: () => ({ wm: 1.07, hm: 0.53, r: 12, lb: 0.72, y: -14 }),
  love: () => ({ hz: 1 }),
  worried: () => ({ hm: 0.88, lt: 0.16, la: -0.38 }),
  sad: () => ({ wm: 1.04, hm: 0.53, r: 10, lt: 0.12, la: -0.6, y: 22, gx: 4 }),
  focused: () => ({ wm: 1.14, hm: 0.44, r: 7, gx: 2 }),
  annoyed: () => ({ wm: 1.07, hm: 0.62, r: 9, lt: 0.42, la: 0.12, y: 6 }),
  bored: () => ({ wm: 1.07, hm: 0.62, r: 12, lt: 0.52, y: 12 }),
  skeptic: (i) => (i ? { hm: 0.9, lt: 0.38, la: -0.28, rot: -0.06 } : { hm: 0.97 }),
  suspicious: () => ({ wm: 1.1, hm: 0.53, r: 8, lt: 0.12, la: 0.14 }),
  squint: () => ({ wm: 1.14, hm: 0.23, r: 6 }),
  sleepy: (i) => (i ? { wm: 0.82, hm: 0.33, r: 8, rot: -0.1, y: 12 } : { hm: 0.56, r: 10, rot: 0.12, y: 8 }),
  sleep: () => ({ wm: 1.4, hm: 0.1, r: 3, y: 16 }),
  angry: () => ({ hm: 0.78, lt: 0.3, la: 0.55, y: 6 }),
  furious: () => ({ wm: 1.1, hm: 0.97, r: 10, lt: 0.22, la: 0.95, y: 2 }),
  scared: () => ({ wm: 0.86, hm: 1.19, r: 14, y: -12, gx: -6 }),
  surprised: () => ({ wm: 1.14, hm: 1.16, r: 24, gx: 2 }),
  awe: () => ({ wm: 1.1, hm: 1.12, r: 31, y: -6, gx: 1 }),
  mischief: (i) => (i ? { wm: 1.08, hm: 0.5, r: 9, lt: 0.3, la: 0.25, y: 4 } : { wm: 0.94, hm: 1.1, r: 16, y: -6, rot: 0.05 }),
  smug: (i) => (i ? { wm: 1.05, hm: 0.55, lb: 0.4, y: -2, rot: -0.05 } : { wm: 1.05, hm: 0.62, lt: 0.22, y: 2 }),
  wonky: (i) => (i ? { wm: 0.8, hm: 0.8, y: 8, rot: 0.18 } : { wm: 1.15, hm: 1.12, y: -8, rot: -0.1, gx: -4 }),
  curious: (i) => (i ? { wm: 0.86, hm: 0.86 } : { wm: 1.14, hm: 1.14 }),
  confused: (i) => (i ? { hm: 0.81, lt: 0.14, la: -0.25 } : { hm: 1.06 }),
};

export function createEyes() {
  const m = [{ ...P0 }, { ...P0 }], mv = [{}, {}];
  const gaze = new Actor({ x: 0, y: 0 }, { f: 6, z: 0.82 });   // shared by both eyes
  const sac = new Actor({ x: 0, y: 0 }, { f: 14, z: 0.92 });   // idle micro-saccades
  const st = {
    t: 0, exp: 'neutral', ant: 0, from: null,
    bk0: 0, bk1: -1, nextBlink: 2500, pendBlink: -1,
    nextSac: 900, macro: null, squash: 0, dizzy: 0,
  };
  const oc = [document.createElement('canvas'), document.createElement('canvas')];

  function setExpression(name) {
    if (!EYE_PRESETS[name] || name === st.exp) return;
    st.from = m.map((e) => ({ ...e }));
    st.ant = SLOW.has(name) ? 0 : 0.15; // R2.35b: brief counter-move before the new shape
    st.exp = name;
  }

  function blink(ms = rand(100, 150)) {
    if (st.t < st.bk1) return;
    st.bk0 = st.t; st.bk1 = st.t + (SLOW.has(st.exp) ? ms * 2.6 : ms);
  }

  // x,y in face units (±40, ±28). Blinks often fire during big look shifts.
  function look(x, y, o = {}) {
    x = clamp(x, -40, 40); y = clamp(y, -28, 28);
    const d = Math.hypot(x - gaze.goal('x'), y - gaze.goal('y'));
    gaze.act({ x, y }, { windup: rand(0.25, 0.35), overshoot: 0.1, f: 6, ...o });
    if (d > 22 && Math.random() < 0.55) st.pendBlink = st.t + rand(40, 90);
    st.nextSac = st.t + rand(500, 1400);
  }

  // laugh = eyes hop · confused = side shake · shiver = 1 px flicker · wink
  function macro(kind, ms) {
    const dur = ms || { laugh: 700, confused: 520, shiver: 900, wink: 650 }[kind] || 600;
    st.macro = { kind, t0: st.t, dur, side: Math.random() < 0.5 ? 0 : 1, fx: 0, fy: 0, next: 0 };
  }

  function macroOffset() {
    const M = st.macro;
    if (!M) return { x: 0, y: 0 };
    const p = (st.t - M.t0) / M.dur;
    if (p >= 1) { st.macro = null; return { x: 0, y: 0 }; }
    if (M.kind === 'laugh') return { x: 0, y: -Math.abs(Math.sin(p * Math.PI * 3)) * 7 * (1 - p * 0.5) };
    if (M.kind === 'confused') return { x: Math.sin(p * TAU * 3) * 7 * (1 - p), y: 0 };
    if (M.kind === 'shiver') {
      if (st.t > M.next) { M.next = st.t + 40; M.fx = rand(-1, 1); M.fy = rand(-1, 1); }
      return { x: M.fx, y: M.fy };
    }
    return { x: 0, y: 0 };
  }

  function step(dt) {
    st.t += dt * 1000;
    gaze.step(dt); sac.step(dt);
    const t = st.t;

    // blinks: auto 3 s + rand(0–2 s), 15 % double, plus blink-on-look
    if (st.pendBlink > 0 && t >= st.pendBlink) { st.pendBlink = -1; blink(); }
    if (t > st.nextBlink && st.exp !== 'sleep') {
      blink();
      if (Math.random() < 0.15) st.pendBlink = t + rand(230, 300);
      st.nextBlink = t + 3000 + rand(0, 2000);
    }
    // idle micro-saccades: 1–3 px steps every 0.6–2.8 s, then still. No drift.
    if (t > st.nextSac && gaze.phase === 'rest' && !st.macro) {
      st.nextSac = t + rand(600, 2800);
      sac.act({ x: rand(-2.5, 2.5), y: rand(-1.8, 1.8) }, { micro: 99 });
    }

    // shape morph — every parameter rides its own spring (R2.35 numbers)
    const v = st.exp, slow = SLOW.has(v), f0 = slow ? 3 : 5.2, z = slow ? 0.95 : 0.6;
    st.ant = Math.max(0, st.ant - dt);
    const f = f0 * (st.ant > 0 ? 1.6 : 1), w = TAU * f;
    const wink = st.macro && st.macro.kind === 'wink' ? st.macro.side : -1;
    for (let i = 0; i < 2; i++) {
      const e = m[i], ev = mv[i];
      const tg = { ...P0, ...(i === wink ? { hm: 0.69, lb: 0.55 } : EYE_PRESETS[v](i)) };
      if (v === 'focused' || v === 'suspicious') tg.gx -= 3; else if (v === 'scared' || v === 'awe') tg.gx += 3;
      if (st.ant > 0 && i !== wink) for (const k of ANT) tg[k] = st.from[i][k] - (tg[k] - st.from[i][k]) * 0.45;
      if (st.squash > 0.01) { const K = st.squash; tg.hm *= 1 - 0.32 * K; tg.wm *= 1 + 0.2 * K; tg.y += 10 * K; }
      tg.wm = clamp(tg.wm, 0.72, 1.32); tg.hm = clamp(tg.hm, 0.08, 1.28);
      for (const k in P0) {
        let vel = ev[k] || 0;
        vel += (w * w * (tg[k] - e[k]) - 2 * z * w * vel) * dt;
        ev[k] = vel; e[k] += vel * dt;
      }
      e.wm = clamp(e.wm, 0.6, 1.42); e.hm = clamp(e.hm, 0.02, 1.38); e.r = Math.max(0, e.r);
    }
  }

  // ctx is already translated to the face centre and scaled to face units.
  function draw(ctx, color) {
    const t = st.t, mo = macroOffset();
    const bq = (t - st.bk0) / Math.max(1, st.bk1 - st.bk0);
    const bk = t < st.bk1 && bq >= 0 ? Math.sin(Math.PI * clamp(bq, 0, 1)) : 0;
    const gx = gaze.get('x') + sac.get('x') + mo.x, gy = gaze.get('y') + sac.get('y') + mo.y;
    // stretch along gaze velocity; squash during the gaze wind-up
    const gvx = gaze.s.x.v, gvy = gaze.s.y.v;
    let stv = clamp(Math.hypot(gvx, gvy) * 0.0016 - 0.02, 0, 0.08);
    if (gaze.phase === 'ant') stv = -0.09 * gaze.sq;
    const an = Math.atan2(gvy, gvx);

    for (let i = 0; i < 2; i++) {
      const b = BASE[i], e = m[i], sg = i === 0 ? -1 : 1, inner = -sg;
      const w = b.w * e.wm * (1 + bk * 0.22) * (1 - clamp((mv[i].hm || 0) * 0.018, -0.08, 0.08));
      const h = Math.max(2, b.h * e.hm * (1 - bk * 0.9));
      const r = Math.min(e.r, w / 2, h / 2);
      ctx.save();
      ctx.translate(b.x + sg * e.gx + gx, e.y + gy);
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
        if (h > 12) { o.fillStyle = 'rgba(255,255,255,.65)'; rr(o, -w * 0.32, -h * 0.36, w * 0.3, Math.max(2, h * 0.09), 3); o.fill(); }
        // feathered lid erase
        o.globalCompositeOperation = 'destination-out'; o.fillStyle = '#000'; o.shadowColor = '#000'; o.shadowBlur = 5 * kq;
        if (e.lt > 0.01 || Math.abs(e.la) > 0.01) {
          const y0 = -h / 2 + h * e.lt, sl = (h * e.la / w) * inner;
          o.beginPath(); o.moveTo(-w, -h * 2); o.lineTo(w, -h * 2); o.lineTo(w, y0 + sl * w); o.lineTo(-w, y0 - sl * w); o.closePath(); o.fill();
        }
        if (e.lb > 0.01) { const R = w * 0.95, cy = h / 2 + R - e.lb * h * 0.8; o.beginPath(); o.arc(0, cy, R, 0, TAU); o.fill(); }
        o.shadowBlur = 0;
        ctx.globalAlpha = a;
        ctx.drawImage(cv, -C / kq, -C / kq, cv.width / kq, cv.height / kq);
        ctx.globalAlpha = 1;
      }
      if (e.hz > 0.02) {
        const s = w * 1.05 * clamp(e.hz, 0, 1.3) * (1 + Math.sin(t * 0.012) * 0.07);
        ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, s * 0.42);
        ctx.bezierCurveTo(-s * 0.95, -s * 0.1, -s * 0.5, -s * 0.85, 0, -s * 0.36);
        ctx.bezierCurveTo(s * 0.5, -s * 0.85, s * 0.95, -s * 0.1, 0, s * 0.42); ctx.fill();
      }
      if (st.dizzy > 0.16) {
        ctx.strokeStyle = 'rgba(1,31,39,.8)'; ctx.lineWidth = 2.8; ctx.beginPath();
        for (let n = 0; n < 90; n++) {
          const q = n * 0.24 + t * 0.009 * (i ? -1 : 1), rd = (n / 90) * Math.min(w, h) * 0.43;
          n ? ctx.lineTo(Math.cos(q) * rd, Math.sin(q) * rd) : ctx.moveTo(0, 0);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  return {
    st, gaze, look, blink, macro, setExpression, step, draw,
    get expression() { return st.exp; },
    set squash(v) { st.squash = v; },
    set dizzy(v) { st.dizzy = v; },
  };
}

function rr(o, x, y, w, h, r) {
  o.beginPath();
  if (o.roundRect) o.roundRect(x, y, w, h, r); else o.rect(x, y, w, h);
}

