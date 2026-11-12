// Renderer: scene → motion-blur trail → glow (cheap downsample) → scanlines.
// VFX levels: 3 = blur+glow+scan, 2 = glow+scan, 1 = scan, 0 = flat.
// Auto-drop one level when frame time stays > 20 ms (blur first, then glow, then scanlines).
export function createRenderer(canvas, onDrop) {
  const ctx = canvas.getContext('2d');
  const mk = () => { const c = document.createElement('canvas'); return [c, c.getContext('2d')]; };
  const [scene, sctx] = mk(), [trail, tctx] = mk(), [g1, g1x] = mk(), [g2, g2x] = mk();
  let W = 1, H = 1, dpr = 1, scan = null;
  let user = 3, auto = 3, ema = 16, slowFor = 0;

  function resize(w, h) {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, Math.round(w * dpr)); H = Math.max(1, Math.round(h * dpr));
    for (const c of [canvas, scene, trail]) { c.width = W; c.height = H; }
    g1.width = Math.ceil(W / 4); g1.height = Math.ceil(H / 4);
    g2.width = Math.ceil(W / 8); g2.height = Math.ceil(H / 8);
    const p = document.createElement('canvas'); p.width = 1; p.height = Math.round(4 * dpr);
    const px = p.getContext('2d'); px.fillStyle = 'rgba(0,0,0,.16)'; px.fillRect(0, 0, 1, Math.max(1, Math.round(dpr)));
    scan = ctx.createPattern(p, 'repeat');
  }

  // draw(sctx, dpr) paints the scene in CSS px (transform pre-set to dpr).
  function frame(draw, bg, realDt) {
    perf(realDt);
    const L = Math.min(user, auto);
    sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.clearRect(0, 0, W, H);
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw(sctx);

    let src = scene;
    if (L >= 3) { // trail: fade old copy, lay the new scene over it
      tctx.globalCompositeOperation = 'destination-out'; tctx.globalAlpha = 0.5; tctx.fillRect(0, 0, W, H);
      tctx.globalCompositeOperation = 'source-over'; tctx.globalAlpha = 1; tctx.drawImage(scene, 0, 0);
      src = trail;
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(src, 0, 0);
    if (L >= 2) {
      g1x.clearRect(0, 0, g1.width, g1.height); g1x.drawImage(src, 0, 0, g1.width, g1.height);
      g2x.clearRect(0, 0, g2.width, g2.height); g2x.drawImage(g1, 0, 0, g2.width, g2.height);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5; ctx.drawImage(g2, 0, 0, W, H);
      ctx.globalAlpha = 0.35; ctx.drawImage(g1, 0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    if (L >= 1 && scan) { ctx.fillStyle = scan; ctx.fillRect(0, 0, W, H); }
  }

  function perf(dt) {
    if (!(dt > 0) || dt > 0.1) return; // ignore stalls / tab switches
    ema += (dt * 1000 - ema) * 0.05;
    if (ema > 20 && auto > 0) {
      slowFor += dt;
      if (slowFor > 1.5) { auto--; slowFor = 0; ema = 16; onDrop && onDrop(auto); }
    } else slowFor = 0;
  }

  return {
    resize, frame,
    get level() { return Math.min(user, auto); },
    get frameMs() { return ema; },
    setVfx(on) { user = on ? 3 : 0; if (on) auto = 3; },
  };
}
