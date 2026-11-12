// MORC v2 core: composes loop, actors, eyes, body and renderer into one character.
// MORC.mount(host, opts) → api. No DOM outside `host` (plus an optional subtitle element).
import { clamp, rand, pick } from './util.js';
import { createLoop } from './core/loop.js';
import { Actor, motion } from './physics/spring.js';
import { createEyes, EYE_PRESETS } from './eyes/eyes.js';
import { createTarget } from './body/target.js';
import { createRenderer } from './render/vfx.js';
import { createSubtitle } from './ui/subtitle.js';

export const VERSION = '2.0.0-p1';
export const EXPRESSIONS = Object.keys(EYE_PRESETS);
export { motion };

export function mount(host, opts = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'morc-canvas';
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
  host.appendChild(canvas);

  const listeners = {};
  const emit = (ev, d) => (listeners[ev] || []).forEach((fn) => fn(d));
  const status = (s) => emit('status', s);

  const renderer = createRenderer(canvas, (lvl) => status('VFX AUTO-DROP → ' + ['flat', 'scan', 'glow', 'full'][lvl]));
  const subtitle = createSubtitle(opts.subtitle || null);
  const eyes = createEyes();
  const body = createTarget();

  // Actors (face units). Every movement goes through act().
  const A = {
    body: new Actor({ x: 0, y: 0 }, { f: 3.5, z: 0.8 }),   // base slide / hop
    head: new Actor({ x: 0, y: 0 }, { f: 4.5, z: 0.82 }),  // head offset on the neck
    tilt: new Actor({ a: 0 }, { f: 4, z: 0.8 }),           // head roll
    lift: new Actor({ l: 0 }, { f: 4, z: 0.75 }),          // ring compression (-) / expansion (+)
    zoom: new Actor({ z: 0 }, { f: 3, z: 0.8 }),           // lean in (+) / back (-)
  };
  const face = { x: 0, y: 0, vx: 0, vy: 0 };
  const view = { w: 1, h: 1, S: 1 };
  const colors = { eye: '#4be8f0', ring: '#8be3e7', ring2: '#4a8f9a', bg: '#020c10' };
  const stats = { joy: 0.5, energy: 0.8, irritation: 0, curiosity: 0.6, bond: 0.3, boredom: 0, fatigue: 0 };
  const P = { inside: false, x: 0, y: 0, lastLook: 0, lastMove: 0 };
  let nextIdle = 2000, exprUntil = 0;

  function theme() {
    const cs = getComputedStyle(host);
    const v = (k, d) => (cs.getPropertyValue(k) || '').trim() || d;
    colors.eye = v('--morc-eye', colors.eye); colors.ring = v('--morc-ring', colors.ring);
    colors.ring2 = v('--morc-ring-2', colors.ring2); colors.bg = v('--morc-bg', colors.bg);
  }

  function resize() {
    const r = host.getBoundingClientRect();
    view.w = r.width; view.h = r.height; view.S = Math.min(r.width, r.height) / 350;
    renderer.resize(r.width, r.height);
  }

  // ---- behaviour primitives --------------------------------------------------------------
  // Look at a point (face units). Eyes lead, head follows ~70 ms later (follow-through).
  function look(x, y, o = {}) {
    eyes.look(x * 0.55, y * 0.5, o);
    loop.after(70, () => A.head.act({ x: clamp(x * 0.45, -40, 40), y: clamp(y * 0.4, -26, 26) }, { windup: 0.3, overshoot: 0.12, ...o }));
  }

  function express(name, ms = 0) {
    eyes.setExpression(name);
    exprUntil = ms ? loop.now + ms : 0;
  }

  const seq = (steps) => { let t = 0; for (const [wait, fn] of steps) { t += wait; loop.after(t, fn); } };

  const GESTURES = {
    hop() {
      A.body.act({ x: A.body.goal('x'), y: -34 }, { windup: 0.4, windupHold: 70, overshoot: 0.06, f: 5 });
      A.lift.act({ l: -0.9 }, { windup: 0, f: 8 });
      seq([[220, () => A.lift.act({ l: 0.5 }, { windup: 0, f: 7 })],
        [180, () => { A.body.act({ y: 0 }, { windup: 0, overshoot: 0.2, f: 6 }); A.lift.act({ l: -0.6 }, { windup: 0, f: 9 }); }],
        [160, () => A.lift.act({ l: 0 }, { windup: 0, overshoot: 0.25, f: 6 })]]);
    },
    wiggle() {
      const s = Math.random() < 0.5 ? 1 : -1;
      seq([[0, () => A.tilt.act({ a: 0.16 * s }, { f: 7 })], [130, () => A.tilt.act({ a: -0.16 * s }, { windup: 0.1, f: 7 })],
        [130, () => A.tilt.act({ a: 0.12 * s }, { windup: 0.1, f: 7 })], [130, () => A.tilt.act({ a: -0.08 * s }, { windup: 0.1, f: 7 })],
        [130, () => A.tilt.act({ a: 0 }, { windup: 0.1, overshoot: 0.15 })]]);
      seq([[0, () => A.body.act({ x: 6 * s }, { f: 7 })], [260, () => A.body.act({ x: -6 * s }, { f: 7 })], [260, () => A.body.act({ x: 0 }, { f: 6 })]]);
    },
    recoil() {
      eyes.blink(110); express('surprised', 700);
      A.zoom.act({ z: -0.6 }, { windup: 0.15, f: 8, overshoot: 0.15 });
      A.head.act({ x: A.head.get('x') * 0.3, y: -14 }, { windup: 0.2, f: 8 });
      seq([[380, () => { A.zoom.act({ z: 0 }, { overshoot: 0.15 }); A.head.act({ x: 0, y: 0 }, { overshoot: 0.12 }); }]]);
    },
    nod() {
      seq([[0, () => A.head.act({ y: 14 }, { windup: 0.35, f: 6 })], [200, () => A.head.act({ y: -5 }, { windup: 0, f: 6 })],
        [170, () => A.head.act({ y: 0 }, { windup: 0, overshoot: 0.15 })]]);
    },
    refuse() {
      const s = Math.random() < 0.5 ? 1 : -1;
      express('annoyed', 1900);
      look(48 * s, 4);
      A.body.act({ x: 30 * s }, { windup: 0.35, f: 3.5, tempo: 1.2 });
      A.tilt.act({ a: 0.12 * s }, { windup: 0.3 });
      seq([[1000, () => { eyes.look(-34 * s, 0); eyes.blink(); }],
        [650, () => { look(0, 0); A.body.act({ x: 0 }, { windup: 0.25 }); A.tilt.act({ a: 0 }); }]]);
    },
    lean() {
      express('curious', 1600);
      A.zoom.act({ z: 0.9 }, { windup: 0.3, windupHold: 60, f: 3.5, hold: 700 });
      A.tilt.act({ a: pick([-0.1, 0.1]) }, { windup: 0.3 });
      seq([[1300, () => { A.zoom.act({ z: 0 }, { windup: 0.15 }); A.tilt.act({ a: 0 }); }]]);
    },
    lift() {
      seq([[0, () => A.lift.act({ l: -1 }, { windup: 0.3, f: 6 })], [260, () => A.lift.act({ l: 1 }, { windup: 0, f: 6 })],
        [300, () => A.lift.act({ l: 0 }, { windup: 0, overshoot: 0.2 })]]);
    },
    spin() {
      const s = Math.random() < 0.5 ? 1 : -1;
      body.spin.forEach((sp, j) => sp.act({ a: sp.get('a') + s * (j ? -4 : 6) }, { windup: 0.12, f: 1.2, overshoot: 0.12 }));
      eyes.macro('confused');
    },
    laugh() { express('glee', 1200); eyes.macro('laugh'); A.head.act({ y: -6 }, { windup: 0.3 }); seq([[600, () => A.head.act({ y: 0 })]]); },
    shiver() { express('scared', 1100); eyes.macro('shiver', 1000); },
    wink() { eyes.macro('wink'); },
    lookAround() { look(rand(-60, 60), rand(-30, 20)); },
  };

  function gesture(name) { if (GESTURES[name]) { GESTURES[name](); status('GESTURE / ' + name.toUpperCase()); } }

  // ---- input --------------------------------------------------------------------------
  const toFace = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left - view.w / 2) / view.S, y: (e.clientY - r.top - view.h / 2) / view.S };
  };
  function onMove(e) {
    const p = toFace(e);
    P.inside = true; P.lastMove = loop.now;
    const gx = p.x - face.x, gy = p.y - face.y;
    if (loop.now - P.lastLook > 220 && Math.hypot(gx * 0.5 - eyes.gaze.goal('x'), gy * 0.4 - eyes.gaze.goal('y')) > 6) {
      P.lastLook = loop.now; look(clamp(gx * 0.5, -70, 70), clamp(gy * 0.45, -40, 40));
    }
  }
  function onDown(e) {
    emit('unlock');
    const p = toFace(e);
    if (Math.hypot(p.x - face.x, p.y - face.y) < 80) gesture(pick(['recoil', 'laugh', 'wiggle']));
    else { look(clamp((p.x - face.x) * 0.5, -70, 70), clamp((p.y - face.y) * 0.45, -40, 40)); express('curious', 900); }
    onMove(e);
  }
  const onLeave = () => { P.inside = false; };
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerleave', onLeave);

  // ---- simulation -----------------------------------------------------------------------
  function step(dt, now) {
    for (const k in A) A[k].step(dt);
    eyes.step(dt);
    eyes.squash = Math.max(A.head.sq, A.body.sq) * 0.6;

    const fx = A.body.get('x') + A.head.get('x'), fy = A.body.get('y') + A.head.get('y');
    face.vx = (fx - face.x) / dt; face.vy = (fy - face.y) / dt; face.x = fx; face.y = fy;
    body.step(dt, face, { x: A.body.get('x'), y: A.body.get('y') }, A.head.s.x.v);

    if (exprUntil && now > exprUntil) { exprUntil = 0; eyes.setExpression('neutral'); }
    // idle: return to centre after the pointer leaves, then look around now and then
    if (!P.inside && now - P.lastMove > 1500 && now > nextIdle) {
      nextIdle = now + rand(2500, 6000);
      if (Math.random() < 0.45) look(0, 0); else GESTURES.lookAround();
      if (Math.random() < 0.12) body.spin[Math.random() < 0.5 ? 0 : 1].act({ a: body.spin[0].get('a') + rand(-1.5, 1.5) }, { windup: 0.15, f: 1 });
    }
  }

  function drawScene(g) {
    const S = view.S * (1 + A.zoom.get('z') * 0.15);
    g.save();
    g.translate(view.w / 2, view.h / 2); g.scale(S, S);
    g.lineCap = 'round';
    body.draw(g, face, A.lift.get('l'), colors);
    // head group: tilt, squash during wind-up, stretch along velocity
    g.translate(face.x, face.y);
    g.rotate(A.tilt.get('a'));
    const sq = Math.max(A.head.sq, A.body.sq), sp = Math.hypot(face.vx, face.vy);
    const amt = clamp(sp * 0.00025, 0, 0.09);
    if (amt > 0.005) { const an = Math.atan2(face.vy, face.vx); g.rotate(an); g.scale(1 + amt, 1 - amt * 0.6); g.rotate(-an); }
    if (sq > 0.01) g.scale(1 + sq * 0.07, 1 - sq * 0.09);
    eyes.draw(g, colors.eye);
    g.restore();
  }

  const loop = createLoop(step, (now, realDt) => renderer.frame(drawScene, colors.bg, realDt));

  const ro = new ResizeObserver(resize);
  ro.observe(host);
  theme(); resize(); body.reset(0, 0); loop.start();
  loop.after(400, () => { gesture('hop'); express('happy', 1400); subtitle.say(opts.bootLine || 'MORC v2.0 online. Hello, human.'); });
  status('BOOT / KINEMATICS READY');

  return {
    VERSION, stats,
    look, express, gesture, theme,
    gestures: Object.keys(GESTURES),
    say: (text) => subtitle.say(text),
    setVfx: (on) => renderer.setVfx(on),
    on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
    hud: () => ({
      x: face.x, y: face.y, z: A.zoom.get('z'), tilt: A.tilt.get('a'), lift: A.lift.get('l'),
      rpm: body.rpm(), fps: 1000 / renderer.frameMs, vfx: renderer.level, expr: eyes.expression,
      phase: A.head.phase,
    }),
    destroy() { loop.destroy(); ro.disconnect(); subtitle.stop(); canvas.remove(); },
  };
}
