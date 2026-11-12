// Lab page wiring: toggles, HUD, stats, motion lab. Pure DOM hooks so the UI skin can be swapped.
import { mount, motion, EXPRESSIONS, VERSION } from '../morc.js';
import { store } from '../util.js';

const $ = (s) => document.querySelector(s);
const settings = Object.assign({ sfx: true, voice: true, ai: false, vfx: true, body: 'target', exg: 1 }, store.get('morc2.settings', {}));
const save = () => store.set('morc2.settings', settings);

const morc = mount($('[data-morc="stage"]'), { subtitle: $('[data-morc="subtitle"]') });
const statusEl = $('[data-morc="status"]');
morc.on('status', (s) => { statusEl.textContent = s; });

// toggles
document.querySelectorAll('[data-toggle]').forEach((b) => {
  const k = b.dataset.toggle;
  const sync = () => b.setAttribute('aria-pressed', String(!!settings[k]));
  sync();
  b.addEventListener('click', () => {
    settings[k] = !settings[k]; sync(); save();
    if (k === 'vfx') morc.setVfx(settings.vfx);
    statusEl.textContent = k.toUpperCase() + ' ' + (settings[k] ? 'ON' : 'OFF') + (k === 'sfx' || k === 'voice' ? ' / AUDIO ARRIVES P3' : '');
  });
});
morc.setVfx(settings.vfx);
$('[data-control="body"]').value = settings.body;

// motion lab
const exg = $('[data-control="exg"]'), exgOut = $('[data-out="exg"]');
const setExg = (v) => { motion.exaggeration = settings.exg = +v; exg.value = v; exgOut.textContent = (+v).toFixed(2); save(); };
exg.addEventListener('input', () => setExg(exg.value));
setExg(settings.exg);

const exprSel = $('[data-control="expr"]');
exprSel.innerHTML = EXPRESSIONS.map((e) => `<option>${e}</option>`).join('');
exprSel.addEventListener('change', () => morc.express(exprSel.value));

$('[data-morc="gestures"]').innerHTML = morc.gestures.map((g) => `<button type="button" data-g="${g}">${g}</button>`).join('');
$('[data-morc="gestures"]').addEventListener('click', (e) => { const g = e.target.dataset && e.target.dataset.g; if (g) morc.gesture(g); });

$('[data-control="say"]').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.value.trim()) { morc.say(e.target.value); e.target.value = ''; } });

// HUD (5 Hz — never every frame)
const ro = $('[data-morc="readouts"]'), st = $('[data-morc="stats"]');
const f = (n, d = 0) => (Math.round(n * 10 ** d) / 10 ** d).toFixed(d);
setInterval(() => {
  const h = morc.hud();
  ro.innerHTML = [
    ['VER', VERSION], ['XYZ', `${f(h.x)},${f(h.y)},${f(h.z, 2)}`], ['TILT', f(h.tilt, 2)], ['LIFT', f(h.lift, 2)],
    ['RPM', h.rpm.join(':')], ['FPS', f(h.fps)], ['VFX', ['FLAT', 'SCAN', 'GLOW', 'FULL'][h.vfx]], ['EXPR', h.expr.toUpperCase()],
    ['ACT', h.phase.toUpperCase()], ['BODY', settings.body.toUpperCase()],
  ].map(([k, v]) => `<span>${k} <b>${v}</b></span>`).join('');
  st.innerHTML = Object.entries(morc.stats).map(([k, v]) => `<span>${k.toUpperCase()}<i><i style="width:${Math.round(v * 100)}%"></i></i></span>`).join('');
}, 200);
