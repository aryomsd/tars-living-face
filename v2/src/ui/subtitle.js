// Subtitle line under the canvas. Types word-by-word at babble pace (~7 syllables/s ≈ 2.4 words/s),
// holds, then fades. Phase 3 syncs the babble synth to the same `onWord` beats.
export function createSubtitle(el) {
  let timer = 0, words = [], i = 0, onWord = null;
  const clear = () => { clearTimeout(timer); timer = 0; };

  function tick() {
    if (i >= words.length) { timer = setTimeout(() => el && el.classList.remove('on'), 1600 + words.length * 120); return; }
    const w = words[i++];
    if (el) el.textContent = words.slice(0, i).join(' ');
    const d = onWord ? onWord(w, i - 1) : 0; // the voice returns how long the word takes (s)
    const syl = Math.max(1, (w.match(/[aeiouy]+/gi) || []).length);
    const pause = /[.,!?…]$/.test(w) ? 200 : 20;
    timer = setTimeout(tick, (d > 0 ? d * 1000 : syl * 140) + pause);
  }

  return {
    say(text, cb) {
      clear(); onWord = cb || null;
      words = String(text).trim().split(/\s+/).filter(Boolean); i = 0;
      if (el) { el.textContent = ''; el.classList.add('on'); }
      tick();
    },
    stop() { clear(); if (el) el.classList.remove('on'); },
  };
}
