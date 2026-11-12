// Lab page wiring: toggles, size, HUD, live stats, motion lab. Pure DOM hooks so the UI skin can be swapped.
import { mount, motion, EXPRESSIONS, VERSION } from '../morc.js';
import { store } from '../util.js';

const $ = (s) => document.querySelector(s);
const settings = Object.assign({ sfx: true, voice: true, ai: false, vfx: true, id: false, body: 'target', size: 1, exg: 1 }, store.get('morc2.settings', {}));
const save = () => store.set('morc2.settings', settings);

const morc = mount($('[data-morc="stage"]'), { subtitle: $('[data-morc="subtitle"]'), size: settings.size, body: settings.body, lang: settings.id ? 'id' : 'en' });
window.morc = morc; // F12 access: morc.express('angry'), morc.gesture('hop'), morc._pump(500)
const statusEl = $('[data-morc="status"]');
morc.on('status', (s) => { statusEl.textContent = s; });

const apply = (k) => {
  if (k === 'vfx') morc.setVfx(settings.vfx);
  else if (k === 'sfx' || k === 'voice') morc.setSound(k, settings[k]);
  else if (k === 'id') morc.setLang(settings.id ? 'id' : 'en');
};
document.querySelectorAll('[data-toggle]').forEach((b) => {
  const k = b.dataset.toggle, sync = () => b.setAttribute('aria-pressed', String(!!settings[k]));
  sync(); apply(k);
  b.addEventListener('click', () => { settings[k] = !settings[k]; sync(); save(); apply(k); statusEl.textContent = k.toUpperCase() + ' ' + (settings[k] ? 'ON' : 'OFF'); });
});

const bodySel = $('[data-control="body"]');
bodySel.value = settings.body;
bodySel.addEventListener('change', () => { settings.body = bodySel.value; morc.setBody(settings.body); save(); });

const size = $('[data-control="size"]');
size.value = settings.size;
size.addEventListener('input', () => { settings.size = +size.value; morc.setSize(settings.size); save(); });

// motion lab
const exg = $('[data-control="exg"]'), exgOut = $('[data-out="exg"]');
const setExg = (v) => { motion.exaggeration = settings.exg = +v; exg.value = v; exgOut.textContent = (+v).toFixed(2); save(); };
exg.addEventListener('input', () => setExg(exg.value));
setExg(settings.exg);

const exprSel = $('[data-control="expr"]');
exprSel.innerHTML = EXPRESSIONS.map((e) => `<option>${e}</option>`).join('');
exprSel.addEventListener('change', () => morc.express(exprSel.value, 4000));

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
    ['RPM', h.rpm.join(':')], ['FPS', f(h.fps)], ['VFX', ['FLAT', 'SCAN', 'GLOW', 'FULL'][h.vfx]], ['MOOD', h.mood.toUpperCase()],
    ['EXPR', h.expr.toUpperCase()], ['BODY', settings.body.toUpperCase()], ['AUDIO', h.audio ? 'ON' : 'TAP TO START'],
  ].map(([k, v]) => `<span>${k} <b>${v}</b></span>`).join('');
  st.innerHTML = Object.entries(morc.stats).map(([k, v]) => `<span>${k.toUpperCase()}<i><i style="width:${Math.round(v * 100)}%"></i></i></span>`).join('');
}, 200);
