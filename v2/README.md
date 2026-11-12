# MORC v2.0 — Phase 1 (skeleton)

Run: serve the repo root (`python3 -m http.server 8000`) and open `/v2/` (ES modules need http).
On the phone over LAN: `http://<pc-ip>:8000/v2/`.

| Module | Role |
|---|---|
| `src/core/loop.js` | 120 Hz fixed-step physics, rAF render, sim-time timers, pauses when hidden |
| `src/physics/spring.js` | `Spring`, `Actor.act()` (anticipation → action → overshoot → settle), global `motion.exaggeration` |
| `src/eyes/eyes.js` | v1 eye renderer port: presets, lid masks, one-unit gaze, micro-saccades, blinks, macros |
| `src/body/target.js` | Target body: neck-ring chain + lag deformation + ring spin |
| `src/render/vfx.js` | trail (motion blur) → glow (downsample) → scanlines; auto-drop when frame > 20 ms |
| `src/ui/subtitle.js` | subtitle typer (word beats, phase 3 syncs babble to it) |
| `src/morc.js` | `mount(host, {subtitle})` → api: `look`, `express`, `gesture`, `say`, `setVfx`, `on`, `hud` |
| `src/ui/lab.js` | lab page wiring (toggles, HUD, stats, motion lab) |

UI skin: replace `style.css`. Engine needs only the `data-morc` / `data-toggle` / `data-control`
hooks and the `--morc-*` colour variables (read once at mount; call `api.theme()` after a change).

## p1.1 additions
`src/mind/` (stats, mood, drives, lines EN/ID) · `src/audio/` (SFX, servo whirr, babble, sung vowels) · body modes in `src/body/target.js`.
F12: `morc.express('angry')`, `morc.gesture('hop')`, `morc.travel(200,0)`, `morc.stats`, `morc._pump(500)` (advance while hidden).
Audio starts on the first tap (browser rule).
