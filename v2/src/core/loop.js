// Fixed-step physics (120 Hz) + render on rAF. Sim-time timers. Pauses when the tab is hidden.
const H = 1 / 120;

export function createLoop(step, render) {
  let acc = 0, last = 0, raf = 0, now = 0, running = false;
  const timers = [];

  function frame(t) {
    raf = requestAnimationFrame(frame);
    const real = last ? (t - last) / 1000 : H;
    last = t;
    acc += Math.min(real, 0.05); // dt clamp: no spiral after a stall
    let n = 0;
    while (acc >= H && n < 8) {
      now += H * 1000;
      for (let i = timers.length - 1; i >= 0; i--) {
        if (timers[i].at <= now) { const fn = timers[i].fn; timers.splice(i, 1); fn(); }
      }
      step(H, now);
      acc -= H; n++;
    }
    render(now, real);
  }

  function start() { if (running) return; running = true; last = 0; raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  const onVis = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVis);

  return {
    start, stop,
    get now() { return now; },
    after(ms, fn) { timers.push({ at: now + ms, fn }); },
    destroy() { stop(); document.removeEventListener('visibilitychange', onVis); timers.length = 0; },
  };
}
