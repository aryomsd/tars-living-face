// MORC v2 core. mount(host, opts) → api. Composes loop, actors, eyes, body, mind, audio, renderer.
// "Face units" around the stage centre (1 unit = view.S px). Movement, depth, micro-quirks and behaviour
// choice are ported from v1 MORC (plan/route kinetics, depth gestures, microTick, decideBehavior).
import { clamp, rand, pick, smooth } from './util.js';
import { createLoop } from './core/loop.js';
import { Actor, motion } from './physics/spring.js';
import { createEyes, EYE_PRESETS } from './eyes/eyes.js';
import { createBody, BODY_MODES } from './body/target.js';
import { createRenderer } from './render/vfx.js';
import { createSubtitle } from './ui/subtitle.js';
import { createMind } from './mind/mind.js';
import { createAudio } from './audio/audio.js';
import { LINES } from './mind/lines.js';

export const VERSION = '2.0.0-p1.2';
export const EXPRESSIONS = Object.keys(EYE_PRESETS);
export { motion, BODY_MODES };

const R_BODY = 165;
// v1 route kinetics: ms per segment, follow spring Hz, speed factor
const KIN = {
  sleepy: [2100, 1.4, 0.18], sluggish: [1400, 1.9, 0.28], lazy: [1050, 2.7, 0.38], normal: [680, 4.5, 0.55],
  active: [390, 6.5, 0.75], fast: [250, 8.5, 0.9], snappy: [170, 10.5, 1],
};
const TEMPER_KIN = {
  rage: ['snappy', 'fast'], angry: ['fast', 'snappy', 'active'], lazy: ['sleepy', 'sluggish', 'lazy'],
  playful: ['active', 'fast', 'normal'], normal: ['lazy', 'normal', 'active', 'fast', 'snappy', 'sluggish'],
};
// depth → scale. v1 had a huge range (tiny far away … filling the screen close up).
const zScale = (z) => (z < 0 ? 0.3 + 0.7 * (z + 1) : 1 + 1.5 * z);
const cubic = (s, u) => {
  const v = 1 - u, a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u;
  return { x: a * s[0].x + b * s[1].x + c * s[2].x + d * s[3].x, y: a * s[0].y + b * s[1].y + c * s[2].y + d * s[3].y };
};

export function mount(host, opts = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'morc-canvas';
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:pointer';
  host.appendChild(canvas);

  const listeners = {};
  const emit = (ev, d) => (listeners[ev] || []).forEach((fn) => fn(d));
  const status = (s) => emit('status', s);

  const cfg = { size: opts.size || 1, mode: opts.body || 'target', lang: opts.lang || 'en' };
  const renderer = createRenderer(canvas, (l) => status('VFX AUTO-DROP → ' + ['flat', 'scan', 'glow'][l]));
  const subtitle = createSubtitle(opts.subtitle || null);
  const eyes = createEyes(), body = createBody(), mind = createMind(), audio = createAudio();

  const A = {
    body: new Actor({ x: 0, y: 0 }, { f: 3.2, z: 0.8 }),
    depth: new Actor({ z: 0 }, { f: 2.4, z: 0.75, micro: 0.01 }),
    head: new Actor({ x: 0, y: 0 }, { f: 4.5, z: 0.82 }),
    tilt: new Actor({ a: 0 }, { f: 4, z: 0.8, micro: 0.004 }),
    lift: new Actor({ l: 0 }, { f: 4, z: 0.75, micro: 0.01 }),
  };
  const face = { x: 0, y: 0, vx: 0, vy: 0 }, post = { x: 0, y: 0 };
  const view = { w: 1, h: 1, S: 1 };
  const colors = { eye: '#4be8f0', glow: '#57f4fa', ring: '#8be3e7', ring2: '#4a8f9a', bg: '#020c10' };
  const S = {
    dizzy: 0, exprUntil: 0, lastTalk: -9e9, recent: [], press: null, drag: false, hist: [], lastLook: 0, petTalk: false, side: 1,
    px: 0, py: 0, route: null, depthAct: '', depthCool: 0, nextDepth: 5000, micro: null, nextMicro: 6500,
  };
  let loop;

  function theme() {
    const cs = getComputedStyle(host), v = (k, d) => (cs.getPropertyValue(k) || '').trim() || d;
    colors.eye = v('--morc-eye', colors.eye); colors.ring = v('--morc-ring', colors.ring); colors.glow = v('--morc-glow', colors.glow);
    colors.ring2 = v('--morc-ring-2', colors.ring2); colors.bg = v('--morc-bg', colors.bg);
  }
  function resize() {
    const r = host.getBoundingClientRect();
    view.w = r.width; view.h = r.height; view.S = (Math.min(r.width, r.height) / 520) * cfg.size;
    renderer.resize(r.width, r.height);
  }
  const zs = () => zScale(A.depth.get('z'));
  function bounds(z = A.depth.get('z')) {
    const k = R_BODY * zScale(z);
    return { x: Math.max(0, view.w / 2 / view.S - k), y: Math.max(0, view.h / 2 / view.S - k) };
  }
  const temper = () => mind.temper();
  const voiceMood = () => ({ rage: 'rage', lazy: 'lazy', playful: 'playful' })[temper()] || mind.mood;
  const busy = () => S.route || S.press || S.depthAct;

  // ---- voice ---------------------------------------------------------------------------
  function talk(key, o = {}) {
    const now = loop.now;
    if (!o.force && now - S.lastTalk < 2800) return;
    S.lastTalk = now;
    const mood = o.mood || voiceMood();
    const pool = (LINES[cfg.lang] || LINES.en)[key] || [];
    if (pool.length && Math.random() < (o.sub ?? 0.6)) {
      let line = pick(pool);
      if (S.recent.includes(line)) line = pick(pool);
      S.recent.push(line); if (S.recent.length > 6) S.recent.shift();
      const words = line.split(/\s+/);
      subtitle.say(line, (w, i) => { eyes.blink(70); return audio.speakWord(w, mood, i === words.length - 1); });
    } else audio.babble((rand(2, 5)) | 0, mood);
  }

  // ---- primitives ------------------------------------------------------------------------
  function look(x, y, o = {}) {
    eyes.look(x * 0.55, y * 0.5, o);
    loop.after(70, () => A.head.act({ x: clamp(x * 0.45, -36, 36), y: clamp(y * 0.4, -24, 24) }, { windup: 0.3, overshoot: 0.12, ...o }));
  }
  function express(name, ms = 0) { eyes.setExpression(name); S.exprUntil = ms ? loop.now + ms : 0; }
  const home = (k) => { const J = A.body.job; return J && J.goal[k] != null ? J.goal[k] : A.body.goal(k); };
  const seq = (steps) => { let t = 0; for (const [w, fn] of steps) { t += w; loop.after(t, fn); } };

  // ---- travel: v1 plan() — curve / turns (zigzag) / slingshot / circle-in, with wind-up and kinetics
  function travel(x, y, o = {}) {
    const B = bounds();
    const a = { x: home('x'), y: home('y') }, b = { x: clamp(x, -B.x, B.x), y: clamp(y, -B.y, B.y) };
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d < 14) return;
    const nx = -dy / d, ny = dx / d, ux = dx / d, uy = dy / d;
    const kind = o.style || pick(d > 200 ? ['curve', 'turns', 'slingshot', 'curve', 'circle'] : ['curve', 'curve', 'turns', 'circle']);
    const kin = o.kin || pick(TEMPER_KIN[temper()] || TEMPER_KIN.normal);
    const cb = (p) => ({ x: clamp(p.x, -B.x, B.x), y: clamp(p.y, -B.y, B.y) });
    const nodes = [a];
    if (kind === 'slingshot') nodes.push(cb({ x: a.x - dx * 0.33, y: a.y - dy * 0.33 }));
    if (kind === 'turns') { const n = pick([3, 4, 5]); for (let j = 1; j < n; j++) { const m = (j % 2 ? 1 : -1) * rand(45, 115); nodes.push(cb({ x: a.x + dx * j / n + nx * m, y: a.y + dy * j / n + ny * m })); } }
    if (kind === 'circle') { // overshoot past the goal, loop around it, settle in
      const R = clamp(d * 0.25, 40, 110), s = Math.random() < 0.5 ? 1 : -1;
      nodes.push(cb({ x: b.x + ux * R + nx * R * 0.6 * s, y: b.y + uy * R + ny * R * 0.6 * s }));
      nodes.push(cb({ x: b.x + nx * R * s - ux * R * 0.2, y: b.y + ny * R * s - uy * R * 0.2 }));
    }
    nodes.push(b);
    const segs = [];
    for (let j = 0; j < nodes.length - 1; j++) {
      const p = nodes[j], q = nodes[j + 1], ox = q.x - p.x, oy = q.y - p.y, bend = kind === 'curve' ? rand(-0.35, 0.35) : rand(-0.12, 0.12);
      const len = Math.hypot(ox, oy);
      segs.push({ c: [p, { x: p.x + ox * 0.3 - oy * bend, y: p.y + oy * 0.3 + ox * bend }, { x: p.x + ox * 0.7 - oy * bend, y: p.y + oy * 0.7 + ox * bend }, q], len });
    }
    const [msBase, hz, spd] = KIN[kin], E = motion.exaggeration;
    const now = loop.now, slow = spd < 0.4;
    const back = clamp(12 + d * 0.16 * (0.6 + spd), 12, 110) * E * (kind === 'slingshot' ? 0 : 1);
    S.route = { segs, i: 0, t0: 0, kin, hz, spd, msBase, n: segs.length, windUntil: now + (back ? (slow ? 520 : 240) + 100 : 0), wind: { x: a.x - ux * back, y: a.y - uy * back }, pause: 0, end: b, lastLook: 0 };
    A.body.job = null;
    if (back) { // wind-up: lean back, squash, counter-spin the rings
      setGoal(S.route.wind, 6, 1);
      A.lift.act({ l: -0.6 }, { windup: 0, f: 7 }); body.kick(Math.sign(dx) || 1, 0.4 + Math.min(1, d / 400));
    }
    look(clamp(dx * 0.5, -60, 60), clamp(dy * 0.4, -40, 40));
    status('TRAVEL / ' + kind.toUpperCase() + ' / ' + kin.toUpperCase());
  }
  function setGoal(p, f, z) { for (const k of ['x', 'y']) { const s = A.body.s[k]; s.goal = p[k]; s.f = f; s.z = z; } }

  function driveRoute(now) {
    const R = S.route;
    if (!R) return;
    if (now < R.windUntil) return;
    if (!R.t0) { R.t0 = now; A.lift.act({ l: 0.3 }, { windup: 0, f: 6 }); if (R.spd > 0.5) audio.sfx('whoosh'); }
    if (now < R.pause) return;
    const seg = R.segs[R.i], ms = R.msBase / Math.max(1, R.n * 0.68) * clamp(seg.len / 220, 0.7, 2.2);
    let u = (now - R.t0) / ms;
    if (u >= 1) {
      R.i++; R.t0 = now; u = 0;
      if (R.spd < 0.4) R.pause = now + rand(150, 450);            // lazy drag: stop-and-go
      if (R.i >= R.n) { // arrive: overshoot + settle
        S.route = null; setGoal(R.end, 4, 0.5); A.lift.act({ l: 0 }, { overshoot: 0.25 });
        loop.after(700, () => { for (const k of ['x', 'y']) { A.body.s[k].f = 3.2; A.body.s[k].z = 0.8; } });
        A.tilt.act({ a: 0 }, { windup: 0.15, overshoot: 0.2 }); look(0, 0);
        return;
      }
      if (R.n > 2) body.kick(S.side = -S.side, 0.3);               // each turn twists the rings
    }
    const e = R.spd >= 1 ? 1 - (1 - u) ** 4 : R.spd < 0.3 ? smooth(u) : u * u * (3 - 2 * u);
    const s = R.segs[R.i].c, p = cubic(s, e), q = cubic(s, Math.min(1, e + 0.05));
    if (R.spd < 0.4) p.y += Math.sin(u * Math.PI) * 10;             // lazy sag
    setGoal(p, R.hz, 0.82);
    const tx = q.x - p.x, ty = q.y - p.y, tl = Math.hypot(tx, ty) || 1;
    A.tilt.s.a.goal = clamp(tx / tl * 0.12 * R.spd, -0.14, 0.14);  // lean into the curve
    if (now - R.lastLook > 260) { R.lastLook = now; look(tx / tl * 40, ty / tl * 26, { windup: 0.15 }); }
  }

  // ---- depth (Z plane): idle drift + v1 depth gestures --------------------------------------
  function depthTo(z, o = {}) { A.depth.act({ z: clamp(z, -1, 1) }, { windup: 0.3, overshoot: 0.1, ...o }); }
  const DEPTH = {
    boo() {
      S.depthAct = 'boo'; depthTo(-1, { f: 6, windup: 0.1 }); express('mischief', 900);
      seq([[320, () => { depthTo(1, { f: 7, windup: 0.05, overshoot: 0.12 }); express('surprised', 1300); audio.sfx('thud'); audio.sfx('powerup'); eyes.setSpread(6); }],
        [900, () => { depthTo(0, { f: 2.5 }); eyes.setSpread(0); S.depthAct = ''; }]]);
    },
    pounce() {
      S.depthAct = 'pounce'; express('stalk', 1400); depthTo(-0.55, { f: 3 }); A.lift.act({ l: -0.9 }, { windup: 0.2 }); eyes.macro('shiver', 400);
      seq([[700, () => { express('glee', 1500); A.lift.act({ l: 0.6 }, { windup: 0 }); depthTo(0.7, { f: 7, windup: 0 }); travel(S.px, S.py, { style: 'curve', kin: 'snappy' }); }],
        [900, () => { A.lift.act({ l: 0 }); depthTo(0); S.depthAct = ''; }]]);
    },
    intimidate() {
      S.depthAct = 'intimidate'; express('angry', 4000); depthTo(0.9, { f: 1.1, windup: 0.4, windupHold: 120 }); A.head.act({ y: 12 }, { windup: 0.3 });
      seq([[4000, () => { depthTo(0, { f: 2 }); A.head.act({ y: 0 }); S.depthAct = ''; }]]);
    },
    hide() {
      S.depthAct = 'hide'; express('scared', 4200); depthTo(-1, { f: 1.4 }); eyes.macro('shiver', 1200);
      seq([[4300, () => { depthTo(0, { f: 1.6 }); S.depthAct = ''; eyes.macro('doubleTake'); }]]);
    },
  };
  function depthGesture(k) { if (loop.now < S.depthCool || S.depthAct || S.press) return; S.depthCool = loop.now + rand(11000, 22000); DEPTH[k](); status('DEPTH / ' + k.toUpperCase()); }

  // ---- v1 micro-quirks: tiny, bounded, mood-dependent ---------------------------------------
  function microTick(now) {
    if (S.micro && now > S.micro.until) {
      const M = S.micro; S.micro = null;
      if (M.kind === 'tilt' || M.kind === 'sideeye') A.tilt.act({ a: 0 }, { windup: 0.2 });
      if (M.kind === 'glance' || M.kind === 'sideeye') eyes.look(0, 0);
      if (M.kind === 'droop') A.head.act({ y: 0 });
      S.nextMicro = now + rand(3500, 8000);
    }
    if (S.micro || now < S.nextMicro || busy() || mind.sulking) return;
    const m = mind.mood, opts = m === 'angry' || m === 'suspicious' || m === 'annoyed' ? ['squint', 'sideeye', 'pause']
      : m === 'sleepy' ? ['droop', 'blink', 'pause'] : ['glance', 'tilt', 'squint', 'blink', 'wink', 'pause', 'pause'];
    const kind = pick(opts), side = Math.random() < 0.5 ? -1 : 1, dur = rand(550, 1400);
    S.micro = { kind, until: now + dur };
    if (kind === 'glance') eyes.look(side * rand(8, 18), rand(-6, 6));
    else if (kind === 'tilt') A.tilt.act({ a: side * rand(0.04, 0.09) }, { windup: 0.3 });
    else if (kind === 'squint') eyes.setOverride(side < 0 ? 0 : 1, 'squint', dur), eyes.setOverride(side < 0 ? 1 : 0, 'squint', dur);
    else if (kind === 'sideeye') { eyes.look(side * 18, 0); A.tilt.act({ a: side * 0.05 }); eyes.setOverride(0, 'suspicious', dur); eyes.setOverride(1, 'suspicious', dur); }
    else if (kind === 'droop') { A.head.act({ y: 7 }, { windup: 0.2, f: 2 }); }
    else if (kind === 'wink') eyes.macro('wink');
    else if (kind === 'blink') eyes.blink();
  }

  // ---- gestures ----------------------------------------------------------------------------
  const GESTURES = {
    hop() {
      const y0 = home('y');
      A.body.act({ y: y0 - 34 }, { windup: 0.4, windupHold: 70, overshoot: 0.06, f: 5 });
      A.lift.act({ l: -0.9 }, { windup: 0, f: 8 });
      seq([[220, () => A.lift.act({ l: 0.5 }, { windup: 0, f: 7 })],
        [180, () => { A.body.act({ y: y0 }, { windup: 0, overshoot: 0.2, f: 6 }); A.lift.act({ l: -0.6 }, { windup: 0, f: 9 }); audio.sfx('boop'); }],
        [160, () => A.lift.act({ l: 0 }, { windup: 0, overshoot: 0.25, f: 6 })]]);
    },
    wiggle() {
      const s = S.side = -S.side, x0 = home('x');
      [0.16, -0.16, 0.12, -0.08, 0].forEach((a, k) => loop.after(k * 130, () => A.tilt.act({ a: a * s }, { windup: k ? 0.12 : 0.3, f: 7, overshoot: k === 4 ? 0.15 : 0.1 })));
      seq([[0, () => A.body.act({ x: x0 + 6 * s }, { f: 7 })], [260, () => A.body.act({ x: x0 - 6 * s }, { f: 7 })], [260, () => A.body.act({ x: x0 }, { f: 6 })]]);
      eyes.setSpread(4); loop.after(650, () => eyes.setSpread(0));
    },
    recoil() {
      eyes.blink(110); express('surprised', 700); eyes.setSpread(-4);
      depthTo(A.depth.get('z') - 0.35, { windup: 0.2, f: 6, overshoot: 0.15 });
      A.head.act({ x: A.head.get('x') * 0.3, y: -14 }, { windup: 0.2, f: 8 });
      seq([[400, () => { depthTo(0, { overshoot: 0.15 }); A.head.act({ x: 0, y: 0 }, { overshoot: 0.12 }); eyes.setSpread(0); }]]);
    },
    nod() {
      seq([[0, () => A.head.act({ y: 14 }, { windup: 0.35, f: 6 })], [200, () => A.head.act({ y: -5 }, { windup: 0, f: 6 })],
        [170, () => A.head.act({ y: 0 }, { windup: 0, overshoot: 0.15 })]]);
    },
    refuse() {
      const s = S.side = -S.side, x0 = home('x');
      express('chevron', 2000); look(48 * s, 4); body.kick(s, 0.8);
      A.body.act({ x: x0 + 30 * s }, { windup: 0.35, f: 3.5, tempo: 1.2 });
      A.tilt.act({ a: 0.12 * s }, { windup: 0.3 });
      seq([[1000, () => { eyes.look(-20 * s, 0); eyes.blink(); }],
        [650, () => { look(0, 0); A.body.act({ x: x0 }, { windup: 0.25 }); A.tilt.act({ a: 0 }); }]]);
    },
    lean() {
      express('curious', 1600); eyes.setSpread(3);
      depthTo(0.6, { windup: 0.3, windupHold: 60, f: 3.5, hold: 700 });
      A.tilt.act({ a: pick([-0.1, 0.1]) }, { windup: 0.3 });
      seq([[1300, () => { depthTo(0, { windup: 0.15 }); A.tilt.act({ a: 0 }); eyes.setSpread(0); }]]);
    },
    stomp() {
      express('furious', 2200); body.kick(1, 1.2);
      [0, 260, 520].forEach((t, k) => seq([[t, () => A.head.act({ y: 16 }, { windup: 0.4, f: 9 })], [130, () => { A.head.act({ y: 4 }, { windup: 0, f: 9 }); A.lift.act({ l: k % 2 ? 0.4 : -0.4 }, { f: 9 }); audio.sfx('thud'); }]]));
      seq([[900, () => { A.head.act({ y: 0 }); A.lift.act({ l: 0 }); }]]);
    },
    lift() {
      seq([[0, () => A.lift.act({ l: -1 }, { windup: 0.3, f: 6 })], [260, () => A.lift.act({ l: 1 }, { windup: 0, f: 6 })],
        [300, () => A.lift.act({ l: 0 }, { windup: 0, overshoot: 0.2 })]]);
    },
    spin() {
      const s = S.side = -S.side;
      body.spin.forEach((sp, j) => sp.act({ a: sp.get('a') + s * (j ? -4 : 6) }, { windup: 0.15, f: 1.2, overshoot: 0.12 }));
      eyes.macro('confused'); audio.sfx('data');
    },
    laugh() { express('glee', 1200); eyes.macro('laugh'); A.head.act({ y: -6 }, { windup: 0.3 }); seq([[600, () => A.head.act({ y: 0 })]]); },
    shiver() { express('scared', 1100); eyes.macro('shiver', 1000); depthTo(-0.3, { windup: 0.2 }); loop.after(1100, () => depthTo(0)); },
    wink() { eyes.macro('wink'); audio.sfx('chirp'); },
    doubleTake() { eyes.macro('doubleTake'); },
    lookAround() { look(rand(-70, 70), rand(-35, 25)); },
    wander() { const B = bounds(); travel(rand(-B.x, B.x), rand(-B.y, B.y)); },
    zigzag() { const B = bounds(); travel(rand(-B.x, B.x), rand(-B.y, B.y), { style: 'turns' }); },
    circleIn() { const B = bounds(); travel(rand(-B.x, B.x) * 0.7, rand(-B.y, B.y) * 0.7, { style: 'circle' }); },
    lazyDrag() { const B = bounds(); travel(rand(-B.x, B.x), rand(-B.y, B.y), { style: 'curve', kin: 'sleepy' }); },
    boo() { S.depthCool = 0; depthGesture('boo'); },
    pounce() { S.depthCool = 0; depthGesture('pounce'); },
    intimidate() { S.depthCool = 0; depthGesture('intimidate'); },
    hide() { S.depthCool = 0; depthGesture('hide'); },
  };
  function gesture(name) { if (GESTURES[name]) { GESTURES[name](); status('GESTURE / ' + name.toUpperCase()); } }

  // ---- reactions (mind → body + voice) ------------------------------------------------------
  function react(k) {
    if (!k) return;
    status('REACT / ' + k.toUpperCase());
    const near = (f) => ({ x: home('x') + (S.px - home('x')) * f, y: home('y') + (S.py - home('y')) * f });
    switch (k) {
      case 'giggle': gesture(pick(['laugh', 'wiggle', 'laugh'])); audio.sfx('boop'); talk('giggle', { sub: 0.35, mood: 'glee' }); break;
      case 'annoyed': gesture('recoil'); express('chevron', 1800); audio.sfx('deny'); talk('annoyed', { force: true, sub: 0.7, mood: 'annoyed' }); break;
      case 'angry': gesture('stomp'); audio.sfx('deny'); talk('angry', { force: true, sub: 0.9, mood: 'rage' }); loop.after(1200, () => depthGesture('intimidate')); break;
      case 'sulk': gesture('refuse'); talk('sulk', { sub: 0.6, mood: 'annoyed' }); break;
      case 'forgive': express('happy', 1500); gesture('nod'); audio.sfx('confirm'); talk('forgive', { force: true, sub: 0.8, mood: 'happy' }); break;
      case 'wake': express('surprised', 900); A.lift.act({ l: 0 }); depthTo(0); gesture('hop'); audio.sfx('powerup'); talk('wake', { force: true, sub: 0.8, mood: 'scared' }); break;
      case 'sleep': S.route = null; express('sleep'); A.lift.act({ l: -0.5 }, { windup: 0.2, f: 1.5 }); depthTo(-0.35, { f: 1 }); look(0, 10); audio.sfx('powerdown'); talk('sleepy', { force: true, sub: 0.8, mood: 'sleepy' }); break;
      case 'dizzy': S.dizzy = 1; express('wonky', 2600); eyes.macro('confused'); talk('dizzy', { force: true, sub: 0.7, mood: 'dizzy' }); break;
      case 'whoa': express('surprised', 700); audio.sfx('chirp'); break;
      case 'impact': express('squint', 600); talk('impact', { sub: 0.6, mood: 'annoyed' }); break;
      case 'curious': express('curious', 1200); audio.sfx('chirp'); break;
      // v1 decideBehavior choices
      case 'investigate': { const B = bounds(); travel(rand(-B.x, B.x), rand(-B.y, B.y)); express('curious', 2300); loop.after(2500, () => gesture(pick(['lookAround', 'doubleTake']))); break; }
      case 'approach': { const p = near(rand(0.28, 0.56)); travel(p.x, p.y, { style: 'curve' }); depthTo(rand(0.2, 0.55)); express('curious', 2300); if (Math.random() < 0.05 && mind.s.stress < 0.35) loop.after(1800, () => depthGesture('boo')); break; }
      case 'retreat': { const p = near(-0.65); travel(p.x, p.y, { style: 'slingshot' }); express('suspicious', 3300); if ((mind.s.stress + mind.s.caution) / 2 > 0.45) loop.after(900, () => depthGesture('hide')); break; }
      case 'play': { travel(S.px + rand(-170, 170), S.py + rand(-110, 110), { style: 'turns' }); express('glee', 2400); if (Math.random() < 0.15) loop.after(1500, () => depthGesture('pounce')); else loop.after(1600, () => gesture(pick(['wiggle', 'spin', 'hop', 'laugh']))); if (Math.random() < 0.3) audio.sing('happy'); break; }
      case 'rest': depthTo(-0.4, { f: 1.2 }); express('bored', 3500); A.head.act({ y: 8 }, { f: 1.5 }); loop.after(3500, () => A.head.act({ y: 0 })); break;
      case 'observe': gesture(pick(['lookAround', 'lookAround', 'doubleTake'])); break;
      case 'attention': travel(0, 0, { style: 'curve' }); loop.after(1200, () => { depthTo(0.6); gesture('hop'); }); talk('attention', { force: true, sub: 0.7, mood: 'curious' }); break;
    }
  }

  // ---- input -------------------------------------------------------------------------------
  const toUnits = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left - view.w / 2) / view.S, y: (e.clientY - r.top - view.h / 2) / view.S };
  };
  const faceScreen = () => { const bx = A.body.get('x'), by = A.body.get('y'), k = zs(); return { x: bx + (face.x - bx) * k, y: by + (face.y - by) * k }; };

  function onDown(e) {
    audio.unlock();
    const p = toUnits(e), f = faceScreen();
    S.px = p.x; S.py = p.y;
    const onFace = Math.hypot(p.x - f.x, p.y - f.y) < 85 * zs();
    S.press = { t0: loop.now, x: p.x, y: p.y, onFace, offX: A.body.get('x') - p.x, offY: A.body.get('y') - p.y, petted: 0 };
    S.hist = [{ t: loop.now, x: p.x, y: p.y }]; S.petTalk = false;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  }
  function onMove(e) {
    const p = toUnits(e), P = S.press;
    S.px = p.x; S.py = p.y;
    if (P) {
      S.hist.push({ t: loop.now, x: p.x, y: p.y }); if (S.hist.length > 6) S.hist.shift();
      if (!S.drag && P.onFace && Math.hypot(p.x - P.x, p.y - P.y) > 10 && P.petted < 0.3) {
        S.drag = true; S.route = null; mind.event('drag'); express('awe'); body.kick(1, 0.6); audio.sfx('chirp'); A.body.job = null;
      }
      if (S.drag) { const B = bounds(); setGoal({ x: clamp(p.x + P.offX, -B.x, B.x), y: clamp(p.y + P.offY, -B.y, B.y) }, 9, 0.7); return; }
    }
    if (loop.now - S.lastLook > 220 && !S.route) {
      const f = faceScreen(), gx = p.x - f.x, gy = p.y - f.y;
      const lx = clamp(gx * 0.5, -70, 70), ly = clamp(gy * 0.45, -40, 40);
      if (Math.hypot(lx * 0.55 - eyes.gaze.goal('x'), ly * 0.5 - eyes.gaze.goal('y')) > 4) { S.lastLook = loop.now; look(lx, ly); }
      mind.event('hover');
    }
  }
  function onUp() {
    const P = S.press; S.press = null;
    if (!P) return;
    if (S.drag) {
      S.drag = false;
      const h = S.hist, a = h[0], b = h[h.length - 1], dt = Math.max(16, b.t - a.t) / 1000;
      const vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt, sp = Math.hypot(vx, vy), B = bounds();
      A.body.s.x.v = vx * 0.8; A.body.s.y.v = vy * 0.8;
      setGoal({ x: clamp(A.body.get('x') + vx * 0.25, -B.x, B.x), y: clamp(A.body.get('y') + vy * 0.25, -B.y, B.y) }, 2.2, 0.95);
      loop.after(900, () => { for (const k of ['x', 'y']) { A.body.s[k].f = 3.2; A.body.s[k].z = 0.8; } });
      react(mind.event('fling', clamp(sp / 2500, 0, 1)));
      if (sp > 300) audio.sfx('whoosh');
      return;
    }
    if (P.onFace) { if (P.petted > 0.3) express(mind.expr(), 0); else react(mind.event('poke')); }
    else { react(mind.event('tap')); travel(P.x, P.y); }
  }
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  // ---- simulation --------------------------------------------------------------------------
  const POSTURE = { // head offset by mood/temperament (continuous body language)
    rage: (t) => [Math.sin(t * 0.05) * 2.5, 14], angry: (t) => [Math.sin(t * 0.04) * 1.5, 10], annoyed: () => [S.side * 10, 4],
    suspicious: () => [S.side * 8, 2], sad: () => [0, 14], happy: (t) => [0, -Math.abs(Math.sin(t * 0.011)) * 4],
    playful: (t) => [Math.sin(t * 0.007) * 4, -Math.abs(Math.sin(t * 0.014)) * 5], sleepy: (t) => [Math.sin(t * 0.0013) * 7, 9],
    lazy: (t) => [Math.sin(t * 0.0011) * 6, 8], bored: (t) => [Math.sin(t * 0.0009) * 5, 6], curious: () => [0, -2], neutral: () => [0, 0],
  };

  function step(dt, now) {
    driveRoute(now);
    for (const k in A) A[k].step(dt);
    eyes.step(dt);
    const P = S.press;
    if (P && P.onFace && !S.drag && now - P.t0 > 450) { // pet = press and hold
      P.petted += dt; mind.event('pet', dt);
      if (P.petted < dt * 1.5) { express(mind.s.energy < 0.5 ? 'sleepy' : 'happy'); audio.sfx('confirm'); }
      if (!S.petTalk && P.petted > 1.2) { S.petTalk = true; talk('pet', { force: true, sub: 0.7, mood: 'happy' }); audio.sing('happy'); }
    }
    const M = mind.tick(dt), T = temper();
    if (M.changed && !S.exprUntil && !(P && P.petted > 0)) {
      express(mind.expr());
      if (Math.random() < 0.4 && ['happy', 'bored', 'curious', 'sleepy', 'sad'].includes(M.mood)) talk(M.mood === 'sad' ? 'bored' : M.mood === 'sleepy' ? 'sleepy' : M.mood);
    }
    if (M.drive && !S.drag && !P && (!busy() || ['sleep', 'wake', 'forgive'].includes(M.drive))) react(M.drive);
    if (S.exprUntil && now > S.exprUntil) { S.exprUntil = 0; eyes.setExpression(mind.expr()); }
    microTick(now);
    // idle depth drift (v1: every 5.5–10.5 s, 70 %)
    if (now > S.nextDepth && !S.depthAct && !P) { S.nextDepth = now + rand(5500, 10500); if (Math.random() < 0.7) depthTo(rand(-0.2, 0.25), { f: T === 'lazy' ? 1.2 : 2.4 }); }

    eyes.squash = Math.max(A.head.sq, A.body.sq) * 0.6;
    eyes.anger = T === 'rage' ? 1 : T === 'angry' ? 0.45 : 0;
    S.dizzy = Math.max(0, S.dizzy - dt * 0.3); eyes.dizzy = S.dizzy;
    const [pgx, pgy] = (POSTURE[T] || POSTURE[mind.mood] || POSTURE.neutral)(now);
    const kk = Math.min(1, dt * 4);
    post.x += (pgx + Math.sin(now * 0.012) * S.dizzy * 16 - post.x) * kk; post.y += (pgy - post.y) * kk;

    // stage bounds: soft (goal) normally, hard bounce only when flung past the edge
    const B = bounds();
    for (const k of ['x', 'y']) {
      const s = A.body.s[k], lim = B[k];
      if (Math.abs(s.goal) > lim) s.goal = clamp(s.goal, -lim, lim);
      if (Math.abs(s.x) > lim + 2 && Math.abs(s.v) > 350 && Math.sign(s.v) === Math.sign(s.x)) {
        s.x = clamp(s.x, -lim, lim); s.v = -s.v * 0.45; audio.sfx('thud'); body.kick(Math.sign(s.v) || 1, 0.8);
        A.lift.act({ l: -0.6 }, { windup: 0, f: 9 }); loop.after(150, () => A.lift.act({ l: 0 }, { overshoot: 0.3 })); react(mind.event('impact'));
      }
    }

    const fx = A.body.get('x') + A.head.get('x') + post.x, fy = A.body.get('y') + A.head.get('y') + post.y;
    if (!Number.isFinite(fx + fy)) { for (const k in A) for (const q of A[k].keys) { A[k].s[q].x = A[k].s[q].goal = 0; A[k].s[q].v = 0; } return; }
    face.vx = (fx - face.x) / dt; face.vy = (fy - face.y) / dt; face.x = fx; face.y = fy;
    const ringMood = T === 'rage' || T === 'angry' ? 'angry' : T === 'lazy' ? 'sleepy' : T === 'playful' ? 'happy' : mind.mood;
    body.step(dt, face, { x: A.body.get('x'), y: A.body.get('y') }, A.head.s.x.v + A.body.s.x.v * 0.3, ringMood, mind.s.energy);
    audio.servo(A.body.speed() + A.head.speed() * 0.4 + Math.abs(A.depth.s.z.v) * 300, now);
  }

  function drawScene(g, L) {
    const bx = A.body.get('x'), by = A.body.get('y'), k = zs();
    g.save();
    g.translate(view.w / 2, view.h / 2); g.scale(view.S, view.S);
    g.translate(bx, by); g.scale(k, k); g.translate(-bx, -by);
    g.lineCap = 'round';
    body.draw(g, cfg.mode, face, A.lift.get('l'), A.tilt.get('a'), colors);
    g.translate(face.x, face.y);
    g.rotate(A.tilt.get('a'));
    const sq = Math.max(A.head.sq, A.body.sq), amt = clamp(Math.hypot(face.vx, face.vy) * 0.00022, 0, 0.08);
    if (amt > 0.005) { const an = Math.atan2(face.vy, face.vx); g.rotate(an); g.scale(1 + amt, 1 - amt * 0.6); g.rotate(-an); }
    if (sq > 0.01) g.scale(1 + sq * 0.07, 1 - sq * 0.09);
    eyes.draw(g, colors.eye, colors.glow, (A.head.get('x') + post.x) / 36, (A.head.get('y') + post.y) / 24, L >= 2);
    g.restore();
  }

  loop = createLoop(step, (now, realDt) => renderer.frame(drawScene, colors.bg, realDt));
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  theme(); resize(); body.reset(0, 0); loop.start();
  loop.after(400, () => { gesture('hop'); express('happy', 1400); talk('boot', { force: true, sub: 1, mood: 'happy' }); });
  status('BOOT / KINEMATICS READY');

  return {
    VERSION, stats: mind.s,
    look, express, gesture, travel, theme,
    gestures: Object.keys(GESTURES),
    say: (text) => { const w = text.split(/\s+/); subtitle.say(text, (x, i) => audio.speakWord(x, voiceMood(), i === w.length - 1)); },
    setVfx: (on) => renderer.setVfx(on),
    setSound: (k, on) => audio.set(k, on),
    setSize(v) { cfg.size = clamp(+v || 1, 0.5, 1.6); resize(); },
    setBody(m) { if (BODY_MODES.includes(m)) cfg.mode = m; },
    setLang(l) { cfg.lang = LINES[l] ? l : 'en'; },
    on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
    hud: () => ({
      x: A.body.get('x'), y: A.body.get('y'), z: A.depth.get('z'), tilt: A.tilt.get('a'), lift: A.lift.get('l'),
      rpm: body.rpm(), fps: 1000 / renderer.frameMs, vfx: renderer.level, expr: eyes.expression,
      mood: mind.mood + (mind.sulking ? ' (sulk)' : ''), temper: temper(), phase: S.route ? 'route' : A.body.phase, audio: audio.ready,
    }),
    _pump: (ms) => loop.pump(ms),
    destroy() { loop.destroy(); ro.disconnect(); subtitle.stop(); canvas.remove(); },
  };
}
