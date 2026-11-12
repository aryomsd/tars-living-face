// Renderer: one canvas at device resolution (crisp). VFX levels:
// 2 = eye glow + scanlines, 1 = scanlines, 0 = flat. Auto-drops a level if frames stay > 20 ms.
export function createRenderer(canvas, onDrop) {
  const ctx = canvas.getContext('2d');
  let W = 1, H = 1, dpr = 1, scan = null, user = 2, auto = 2, ema = 16, slowFor = 0;

  function resize(w, h) {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, Math.round(w * dpr)); H = Math.max(1, Math.round(h * dpr));
    canvas.width = W; canvas.height = H;
    const p = document.createElement('canvas'); p.width = 1; p.height = Math.round(4 * dpr);
    const px = p.getContext('2d'); px.fillStyle = 'rgba(0,0,0,.13)'; px.fillRect(0, 0, 1, Math.max(1, Math.round(dpr)));
    scan = ctx.createPattern(p, 'repeat');
  }

  // draw(ctx, level) paints in CSS px (transform pre-set to dpr)
  function frame(draw, bg, realDt) {
    perf(realDt);
    const L = Math.min(user, auto);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, L);
    if (L >= 1 && scan) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = scan; ctx.fillRect(0, 0, W, H); }
  }

  function perf(dt) {
    if (!(dt > 0) || dt > 0.1) return;
    ema += (dt * 1000 - ema) * 0.05;
    if (ema > 20 && auto > 0) { slowFor += dt; if (slowFor > 1.5) { auto--; slowFor = 0; ema = 16; onDrop && onDrop(auto); } }
    else slowFor = 0;
  }

  return {
    resize, frame,
    get level() { return Math.min(user, auto); },
    get frameMs() { return ema; },
    setVfx(on) { user = on ? 2 : 0; if (on) auto = 2; },
  };
}
