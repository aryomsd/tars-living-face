// MORC v2 core. mount(host, opts) → api. Composes loop, actors, eyes, body, mind, audio, renderer.
// Coordinates: "face units" around the stage centre (1 unit = view.S px). Everything moves via act().
import { clamp, rand, pick } from './util.js';
import { createLoop } from './core/loop.js';
import { Actor, motion } from './physics/spring.js';
import { createEyes, EYE_PRESETS } from './eyes/eyes.js';
import { createBody, BODY_MODES } from './body/target.js';
import { createRenderer } from './render/vfx.js';
import { createSubtitle } from './ui/subtitle.js';
import { createMind } from './mind/mind.js';
import { createAudio } from './audio/audio.js';
import { LINES } from './mind/lines.js';

export const VERSION = '2.0.0-p1.1';
export const EXPRESSIONS = Object.keys(EYE_PRESETS);
export { motion, BODY_MODES };

const R_BODY = 165; // body radius incl. margin (face units)
const sylls = (w) => clamp((w.match(/[aeiouy]+/gi) || []).length, 1, 3);

export function mount(host, opts = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'morc-canvas';
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:pointer';
  host.appendChild(canvas);

  const listeners = {};
  const emit = (ev, d) => (listeners[ev] || []).forEach((fn) => fn(d));
  const status = (s) => emit('status', s);

  const cfg = { size: opts.size || 1, mode: opts.body || 'target', lang: opts.lang || 'en' };
  const renderer = createRenderer(canvas, (l) => status('VFX AUTO-DROP → ' + ['flat', 'scan', 'glow', 'full'][l]));
  const subtitle = createSubtitle(opts.subtitle || null);
  const eyes = createEyes(), body = createBody(), mind = createMind(), audio = createAudio();

  const A = {
    body: new Actor({ x: 0, y: 0 }, { f: 3.2, z: 0.8 }),                 // travel / hop / slide
    depth: new Actor({ z: 0 }, { f: 2.2, z: 0.8, micro: 0.01 }),         // Z plane (−1 far … +1 near)
    head: new Actor({ x: 0, y: 0 }, { f: 4.5, z: 0.82 }),                // head on the neck
    tilt: new Actor({ a: 0 }, { f: 4, z: 0.8, micro: 0.004 }),           // head roll
    lift: new Actor({ l: 0 }, { f: 4, z: 0.75, micro: 0.01 }),           // ring compression/expansion
  };
  const face = { x: 0, y: 0, vx: 0, vy: 0 }, post = { x: 0, y: 0 };
  const view = { w: 1, h: 1, S: 1 };
  const colors = { eye: '#4be8f0', ring: '#8be3e7', ring2: '#4a8f9a', bg: '#020c10' };
  const S = { dizzy: 0, exprUntil: 0, lastTalk: -9e9, recent: [], press: null, drag: false, hist: [], lastLook: 0, hover: false, lastHover: 0, petTalk: false, side: 1 };
  let loop;

  function theme() {
    const cs = getComputedStyle(host), v = (k, d) => (cs.getPropertyValue(k) || '').trim() || d;
    colors.eye = v('--morc-eye', colors.eye); colors.ring = v('--morc-ring', colors.ring);
    colors.ring2 = v('--morc-ring-2', colors.ring2); colors.bg = v('--morc-bg', colors.bg);
  }
  function resize() {
    const r = host.getBoundingClientRect();
    view.w = r.width; view.h = r.height; view.S = (Math.min(r.width, r.height) / 520) * cfg.size;
    renderer.resize(r.width, r.height);
  }
  const zs = () => 1 + A.depth.get('z') * 0.28;
  function bounds() {
    const k = R_BODY * zs();
    return { x: Math.max(0, view.w / 2 / view.S - k), y: Math.max(0, view.h / 2 / view.S - k) };
  }

  // ---- voice ---------------------------------------------------------------------------
  function talk(key, o = {}) {
    const now = loop.now;
    if (!o.force && now - S.lastTalk < 2800) return;
    S.lastTalk = now;
    const mood = o.mood || mind.mood;
    const pool = (LINES[cfg.lang] || LINES.en)[key] || [];
    if (pool.length && Math.random() < (o.sub ?? 0.55)) {
      let line = pick(pool);
      if (S.recent.includes(line)) line = pick(pool);
      S.recent.push(line); if (S.recent.length > 6) S.recent.shift();
      const words = line.split(/\s+/);
      subtitle.say(line, (w, i) => audio.babble(sylls(w), mood, i === words.length - 1));
    } else audio.babble((rand(2, 5)) | 0, mood);
  }

  // ---- primitives ------------------------------------------------------------------------
  function look(x, y, o = {}) {
    eyes.look(x * 0.55, y * 0.5, o);
    loop.after(70, () => A.head.act({ x: clamp(x * 0.45, -36, 36), y: clamp(y * 0.4, -24, 24) }, { windup: 0.3, overshoot: 0.12, ...o }));
  }
  function express(name, ms = 0) { eyes.setExpression(name); S.exprUntil = ms ? loop.now + ms : 0; }
  const seq = (steps) => { let t = 0; for (const [w, fn] of steps) { t += w; loop.after(t, fn); } };

  // Travel: look first, wind up (lean back + ring counter-spin), go, overshoot, settle.
  function travel(x, y, o = {}) {
    const B = bounds();
    x = clamp(x, -B.x, B.x); y = clamp(y, -B.y, B.y);
    const dx = x - A.body.get('x'), dy = y - A.body.get('y'), d = Math.hypot(dx, dy);
    if (d < 12) return;
    const dir = Math.sign(dx) || 1, energy = mind.s.energy, sleepy = mind.mood === 'sleepy';
    look(clamp(dx * 0.5, -60, 60), clamp(dy * 0.4, -40, 40));
    seq([[150, () => {
      body.kick(dir, 0.4 + Math.min(1, d / 400));
      A.tilt.act({ a: dir * 0.09 }, { windup: 0.35 });
      A.body.act({ x, y }, {
        windup: 0.3, windupHold: 40, overshoot: 0.08, f: clamp(3.2 - d / 500, 1.3, 3) * (sleepy ? 0.6 : 0.7 + energy * 0.5),
        done: () => { A.tilt.act({ a: 0 }, { windup: 0.15, overshoot: 0.2 }); look(0, 0); },
      });
      if (o.z != null) A.depth.act({ z: o.z }, { windup: 0.3 });
      if (d > 160) audio.sfx('whoosh');
    }]]);
  }

  const GESTURES = {
    hop() {
      A.body.act({ y: A.body.goal('y') - 34 }, { windup: 0.4, windupHold: 70, overshoot: 0.06, f: 5 });
      A.lift.act({ l: -0.9 }, { windup: 0, f: 8 });
      const y0 = A.body.goal('y') + 34;
      seq([[220, () => A.lift.act({ l: 0.5 }, { windup: 0, f: 7 })],
        [180, () => { A.body.act({ y: y0 }, { windup: 0, overshoot: 0.2, f: 6 }); A.lift.act({ l: -0.6 }, { windup: 0, f: 9 }); audio.sfx('boop'); }],
        [160, () => A.lift.act({ l: 0 }, { windup: 0, overshoot: 0.25, f: 6 })]]);
    },
    wiggle() {
      const s = S.side = -S.side, x0 = A.body.goal('x');
      [0.16, -0.16, 0.12, -0.08, 0].forEach((a, k) => loop.after(k * 130, () => A.tilt.act({ a: a * s }, { windup: k ? 0.12 : 0.3, f: 7, overshoot: k === 4 ? 0.15 : 0.1 })));
      seq([[0, () => A.body.act({ x: x0 + 6 * s }, { f: 7 })], [260, () => A.body.act({ x: x0 - 6 * s }, { f: 7 })], [260, () => A.body.act({ x: x0 }, { f: 6 })]]);
      eyes.setSpread(4); loop.after(650, () => eyes.setSpread(0));
    },
    recoil() {
      eyes.blink(110); express('surprised', 700); eyes.setSpread(-4);
      A.depth.act({ z: A.depth.get('z') - 0.45 }, { windup: 0.2, f: 6, overshoot: 0.15 });
      A.head.act({ x: A.head.get('x') * 0.3, y: -14 }, { windup: 0.2, f: 8 });
      seq([[400, () => { A.depth.act({ z: 0 }, { overshoot: 0.15 }); A.head.act({ x: 0, y: 0 }, { overshoot: 0.12 }); eyes.setSpread(0); }]]);
    },
    nod() {
      seq([[0, () => A.head.act({ y: 14 }, { windup: 0.35, f: 6 })], [200, () => A.head.act({ y: -5 }, { windup: 0, f: 6 })],
        [170, () => A.head.act({ y: 0 }, { windup: 0, overshoot: 0.15 })]]);
    },
    refuse() {
      const s = S.side = -S.side, x0 = A.body.goal('x');
      express('annoyed', 2000); look(48 * s, 4); body.kick(s, 0.8);
      A.body.act({ x: x0 + 30 * s }, { windup: 0.35, f: 3.5, tempo: 1.2 });
      A.tilt.act({ a: 0.12 * s }, { windup: 0.3 });
      seq([[1000, () => { eyes.look(-20 * s, 0); eyes.blink(); }],
        [650, () => { look(0, 0); A.body.act({ x: x0 }, { windup: 0.25 }); A.tilt.act({ a: 0 }); }]]);
    },
    lean() {
      express('curious', 1600); eyes.setSpread(3);
      A.depth.act({ z: 0.8 }, { windup: 0.3, windupHold: 60, f: 3.5, hold: 700 });
      A.tilt.act({ a: pick([-0.1, 0.1]) }, { windup: 0.3 });
      seq([[1300, () => { A.depth.act({ z: 0 }, { windup: 0.15 }); A.tilt.act({ a: 0 }); eyes.setSpread(0); }]]);
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
    shiver() { express('scared', 1100); eyes.macro('shiver', 1000); A.depth.act({ z: -0.3 }, { windup: 0.2 }); loop.after(1100, () => A.depth.act({ z: 0 })); },
    wink() { eyes.macro('wink'); audio.sfx('chirp'); },
    doubleTake() { eyes.macro('doubleTake'); },
    lookAround() { look(rand(-70, 70), rand(-35, 25)); },
    wander() { const B = bounds(); travel(rand(-B.x, B.x), rand(-B.y, B.y), { z: rand(-0.5, 0.5) }); },
    approach() { travel(0, 0, { z: 0.7 }); },
    retreat() { const B = bounds(); travel(rand(-B.x, B.x) * 0.5, -B.y * 0.6, { z: -0.7 }); },
  };
  function gesture(name) { if (GESTURES[name]) { GESTURES[name](); status('GESTURE / ' + name.toUpperCase()); } }

  // ---- reactions (mind → body + voice) ------------------------------------------------------
  function react(k) {
    if (!k) return;
    status('REACT / ' + k.toUpperCase());
    switch (k) {
      case 'giggle': gesture(pick(['laugh', 'wiggle', 'laugh'])); audio.sfx('boop'); talk('giggle', { sub: 0.35, mood: 'glee' }); break;
      case 'annoyed': gesture('recoil'); express('annoyed', 1800); audio.sfx('deny'); talk('annoyed', { force: true, sub: 0.7, mood: 'annoyed' }); break;
      case 'angry': gesture('stomp'); audio.sfx('deny'); talk('angry', { force: true, sub: 0.9, mood: 'angry' }); break;
      case 'sulk': gesture('refuse'); talk('sulk', { sub: 0.6, mood: 'annoyed' }); break;
      case 'forgive': express('happy', 1500); gesture('nod'); audio.sfx('confirm'); talk('forgive', { force: true, sub: 0.8, mood: 'happy' }); break;
      case 'wake': express('surprised', 900); A.lift.act({ l: 0 }); A.depth.act({ z: 0 }); gesture('hop'); audio.sfx('powerup'); talk('wake', { force: true, sub: 0.8, mood: 'scared' }); break;
      case 'sleep': express('sleep'); A.lift.act({ l: -0.5 }, { windup: 0.2, f: 1.5 }); A.depth.act({ z: -0.3 }, { f: 1 }); look(0, 10); audio.sfx('powerdown'); talk('sleepy', { force: true, sub: 0.8, mood: 'sleepy' }); break;
      case 'dizzy': S.dizzy = 1; express('wonky', 2600); eyes.macro('confused'); talk('dizzy', { force: true, sub: 0.7, mood: 'dizzy' }); break;
      case 'whoa': express('surprised', 700); audio.sfx('chirp'); break;
      case 'impact': express('squint', 600); talk('impact', { sub: 0.6, mood: 'annoyed' }); break;
      case 'curious': express('curious', 1200); audio.sfx('chirp'); break;
      case 'attention': gesture('approach'); loop.after(900, () => gesture('hop')); talk('attention', { force: true, sub: 0.7, mood: 'curious' }); break;
      case 'play': gesture(pick(['wiggle', 'spin', 'hop', 'laugh'])); audio.sing('happy'); break;
      case 'explore': gesture('wander'); if (Math.random() < 0.25) talk('travel', { sub: 0.5 }); break;
      case 'idle': gesture(pick(['lookAround', 'lookAround', 'doubleTake', 'lift', 'wink'])); break;
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
    const onFace = Math.hypot(p.x - f.x, p.y - f.y) < 85 * zs();
    S.press = { t0: loop.now, x: p.x, y: p.y, onFace, offX: A.body.get('x') - p.x, offY: A.body.get('y') - p.y, petted: 0 };
    S.hist = [{ t: loop.now, x: p.x, y: p.y }]; S.petTalk = false;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  }
  function onMove(e) {
    const p = toUnits(e), P = S.press;
    if (P) {
      S.hist.push({ t: loop.now, x: p.x, y: p.y }); if (S.hist.length > 6) S.hist.shift();
      if (!S.drag && P.onFace && Math.hypot(p.x - P.x, p.y - P.y) > 10 && P.petted < 0.3) {
        S.drag = true; mind.event('drag'); express('awe'); body.kick(1, 0.6); audio.sfx('chirp'); A.body.job = null;
      }
      if (S.drag) {
        const B = bounds();
        for (const k of ['x', 'y']) { const s = A.body.s[k]; s.goal = clamp((k === 'x' ? p.x + P.offX : p.y + P.offY), -B[k], B[k]); s.f = 9; s.z = 0.7; }
        return;
      }
    }
    S.hover = true; S.lastHover = loop.now;
    if (loop.now - S.lastLook > 220) {
      const f = faceScreen(), gx = p.x - f.x, gy = p.y - f.y;
      if (Math.hypot(gx * 0.5 - eyes.gaze.goal('x') / 0.55, gy * 0.45 - eyes.gaze.goal('y') / 0.5) > 8) {
        S.lastLook = loop.now; look(clamp(gx * 0.5, -70, 70), clamp(gy * 0.45, -40, 40));
      }
      mind.event('hover');
    }
  }
  function onUp(e) {
    const P = S.press; S.press = null;
    if (!P) return;
    if (S.drag) {
      S.drag = false;
      const h = S.hist, a = h[0], b = h[h.length - 1], dt = Math.max(16, b.t - a.t) / 1000;
      const vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt, sp = Math.hypot(vx, vy), B = bounds();
      A.body.s.x.v = vx * 0.8; A.body.s.y.v = vy * 0.8;
      A.body.s.x.goal = clamp(A.body.get('x') + vx * 0.25, -B.x, B.x); A.body.s.y.goal = clamp(A.body.get('y') + vy * 0.25, -B.y, B.y);
      A.body.s.x.f = A.body.s.y.f = 2.2; A.body.s.x.z = A.body.s.y.z = 0.95;
      loop.after(900, () => { for (const k of ['x', 'y']) { A.body.s[k].f = 3.2; A.body.s[k].z = 0.8; } });
      react(mind.event('fling', clamp(sp / 2500, 0, 1)));
      if (sp > 300) audio.sfx('whoosh');
      return;
    }
    if (P.onFace) { if (P.petted > 0.3) { express(mind.expr(), 0); } else react(mind.event('poke')); }
    else { react(mind.event('tap')); travel(P.x, P.y); }
  }
  const onLeave = () => { S.hover = false; };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', onLeave);

  // ---- simulation --------------------------------------------------------------------------
  const POSTURE = { // head offset goals by mood (continuous body language)
    angry: (t) => [Math.sin(t * 0.04) * 1.5, 10], annoyed: () => [S.side * 10, 4], sad: () => [0, 14],
    happy: (t) => [0, -Math.abs(Math.sin(t * 0.011)) * 4], sleepy: (t) => [Math.sin(t * 0.0013) * 7, 9],
    bored: (t) => [Math.sin(t * 0.0009) * 5, 6], curious: () => [0, -2], neutral: () => [0, 0],
  };

  function step(dt, now) {
    for (const k in A) A[k].step(dt);
    eyes.step(dt);

    // pet: press-and-hold on the face without dragging
    const P = S.press;
    if (P && P.onFace && !S.drag && now - P.t0 > 450) {
      P.petted += dt; mind.event('pet', dt);
      if (P.petted < dt * 1.5) { express(mind.s.energy < 0.5 ? 'sleepy' : 'happy'); audio.sfx('confirm'); }
      if (!S.petTalk && P.petted > 1.2) { S.petTalk = true; talk('pet', { force: true, sub: 0.7, mood: 'happy' }); audio.sing('happy'); }
    }

    const M = mind.tick(dt);
    if (M.changed && !S.exprUntil && !(P && P.petted > 0)) {
      express(mind.expr());
      if (Math.random() < 0.4 && ['happy', 'bored', 'curious', 'sleepy', 'sad'].includes(M.mood)) talk(M.mood === 'sad' ? 'bored' : M.mood === 'sleepy' ? 'sleepy' : M.mood);
    }
    if (M.drive && !S.drag && !P) react(M.drive);
    if (S.exprUntil && now > S.exprUntil) { S.exprUntil = 0; eyes.setExpression(mind.expr()); }
    eyes.squash = Math.max(A.head.sq, A.body.sq) * 0.6;

    // dizzy sway decays
    S.dizzy = Math.max(0, S.dizzy - dt * 0.3); eyes.dizzy = S.dizzy;
    const [pgx, pgy] = (POSTURE[mind.mood] || POSTURE.neutral)(now);
    const kk = Math.min(1, dt * 4);
    post.x += (pgx + Math.sin(now * 0.012) * S.dizzy * 16 - post.x) * kk; post.y += (pgy - post.y) * kk;

    // walls: clamp + bounce + impact
    const B = bounds();
    for (const k of ['x', 'y']) {
      const s = A.body.s[k], lim = B[k];
      if (Math.abs(s.x) > lim) {
        const hit = Math.abs(s.v);
        s.x = clamp(s.x, -lim, lim); s.goal = clamp(s.goal, -lim, lim);
        if (hit > 350) { s.v = -s.v * 0.45; audio.sfx('thud'); body.kick(Math.sign(s.v) || 1, 0.8); A.lift.act({ l: -0.6 }, { windup: 0, f: 9 }); loop.after(150, () => A.lift.act({ l: 0 }, { overshoot: 0.3 })); react(mind.event('impact')); }
        else s.v = 0;
      }
    }

    const fx = A.body.get('x') + A.head.get('x') + post.x, fy = A.body.get('y') + A.head.get('y') + post.y;
    face.vx = (fx - face.x) / dt; face.vy = (fy - face.y) / dt; face.x = fx; face.y = fy;
    body.step(dt, face, { x: A.body.get('x'), y: A.body.get('y') }, A.head.s.x.v + A.body.s.x.v * 0.3, mind.mood, mind.s.energy);
    audio.servo(A.body.speed() + A.head.speed() * 0.4 + Math.abs(A.depth.s.z.v) * 300, now);
  }

  function drawScene(g) {
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
    eyes.draw(g, colors.eye, (A.head.get('x') + post.x) / 36, (A.head.get('y') + post.y) / 24);
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
    say: (text) => { const w = text.split(/\s+/); subtitle.say(text, (x, i) => audio.babble(sylls(x), mind.mood, i === w.length - 1)); },
    setVfx: (on) => renderer.setVfx(on),
    setSound: (k, on) => audio.set(k, on),
    setSize(v) { cfg.size = clamp(+v || 1, 0.5, 1.6); resize(); },
    setBody(m) { if (BODY_MODES.includes(m)) cfg.mode = m; },
    setLang(l) { cfg.lang = LINES[l] ? l : 'en'; },
    on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
    hud: () => ({
      x: A.body.get('x'), y: A.body.get('y'), z: A.depth.get('z'), tilt: A.tilt.get('a'), lift: A.lift.get('l'),
      rpm: body.rpm(), fps: 1000 / renderer.frameMs, vfx: renderer.level, expr: eyes.expression,
      mood: mind.mood + (mind.sulking ? ' (sulk)' : ''), phase: A.body.phase, audio: audio.ready,
    }),
    _pump: (ms) => loop.pump(ms),
    destroy() { loop.destroy(); ro.disconnect(); subtitle.stop(); canvas.remove(); },
  };
}
