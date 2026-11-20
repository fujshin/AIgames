// くみたて画面
RL.Builder = (function () {
  const $ = id => document.getElementById(id);
  let grid, sel = 'engine';
  const S = { best: 0, last: null };

  function empty() { return Array.from({ length: RL.CFG.ROWS }, () => Array(RL.CFG.COLS).fill(null)); }

  function palette() {
    const p = $('palette'); p.innerHTML = '';
    RL.PART_ORDER.forEach(k => {
      const b = document.createElement('div'); b.className = 'pal' + (k === sel ? ' sel' : ''); b.dataset.k = k;
      b.innerHTML = RL.paletteIcon(k);
      b.addEventListener('click', () => { sel = k; RL.Audio.tone(660, 0.08); palette(); });
      p.appendChild(b);
    });
  }
  function cellSize() {
    const s = $('stage');
    return Math.floor(Math.min((s.clientWidth - 16) / RL.CFG.COLS, (s.clientHeight - 40) / RL.CFG.ROWS));
  }
  function render() {
    const g = $('grid'), cs = cellSize(), C = RL.CFG.COLS, R = RL.CFG.ROWS;
    g.style.gridTemplateColumns = `repeat(${C},${cs}px)`; g.innerHTML = '';
    const map = {}; RL.layout(grid).forEach(q => map[q.r + ',' + q.c] = q);
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const d = document.createElement('div'); d.className = 'cell'; d.style.width = d.style.height = cs + 'px';
      const q = map[r + ',' + c]; if (q) d.innerHTML = RL.drawPart(q.k, q.ctx);
      d.addEventListener('click', () => tap(r, c)); g.appendChild(d);
    }
  }
  // レゴのように下からつむ。タップでけすと上がおちてくる
  function tap(r, c) {
    if (grid[r][c]) {
      for (let i = r; i > 0; i--) grid[i][c] = grid[i - 1][c];
      grid[0][c] = null; RL.Audio.tone(300, 0.1, 'square', 0.1);
    } else {
      let t = -1; for (let i = RL.CFG.ROWS - 1; i >= 0; i--) if (!grid[i][c]) { t = i; break; }
      if (t < 0) { RL.Audio.tone(150, 0.2, 'square', 0.1); return; }
      grid[t][c] = sel; RL.Audio.tone(520 + Math.random() * 200, 0.09, 'triangle');
    }
    render();
  }
  function ladder() {
    const l = $('ladder'), T = RL.CFG.TOP; l.innerHTML = '';
    const pos = h => (Math.min(h, T) / T * 92 + 3) + '%';
    RL.CFG.ZONES.forEach(z => { const d = document.createElement('div'); d.className = 'zone'; d.style.bottom = pos(z.h); d.textContent = z.icon; l.appendChild(d); });
    if (S.last !== null) { const f = document.createElement('div'); f.className = 'flag'; f.textContent = '🚩'; f.style.bottom = pos(S.last); l.appendChild(f); }
    if (S.best > 0) { const f = document.createElement('div'); f.className = 'flag best'; f.textContent = '🏆'; f.style.bottom = pos(S.best); l.appendChild(f); }
  }
  function hint(k) {
    const p = document.querySelector(`.pal[data-k="${k}"]`); if (!p) return;
    p.classList.add('hint'); setTimeout(() => p.classList.remove('hint'), 2000);
  }
  function init() { grid = empty(); palette(); ladder(); setTimeout(render, 0); addEventListener('resize', render); }

  return {
    init, render, ladder, hint, state: S,
    get grid() { return grid; },
    clear() { grid = empty(); RL.Audio.tone(250, 0.15, 'square', 0.1); render(); },
    setGrid(g) { grid = g; render(); }
  };
})();
