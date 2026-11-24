// くみたて画面
RL.Builder = (function () {
  const $ = id => document.getElementById(id);
  let grid, sel = 'engine', allowed = null, gridLocked = false, hlCells = [];
  const S = { best: 0, last: null };
  const empty = () => Array.from({ length: RL.CFG.ROWS }, () => Array(RL.CFG.COLS).fill(null));

  function palette() {
    const p = $('palette'); p.innerHTML = '';
    RL.PART_ORDER.forEach(k => {
      const off = allowed && !allowed.includes(k);
      const b = document.createElement('div'); b.className = 'pal' + (k === sel ? ' sel' : '') + (off ? ' off' : ''); b.dataset.k = k;
      b.innerHTML = RL.paletteIcon(k);
      b.addEventListener('click', () => {
        if (off) { RL.Audio.tone(150, 0.15, 'square', 0.08); return; }
        sel = k; RL.Audio.tone(660, 0.08); palette(); RL.emit('select', k);
      });
      p.appendChild(b);
    });
  }
  function cellSize() { const s = $('stage'); return Math.floor(Math.min((s.clientWidth - 16) / RL.CFG.COLS, (s.clientHeight - 40) / RL.CFG.ROWS)); }
  function render() {
    const g = $('grid'), cs = cellSize(), C = RL.CFG.COLS, R = RL.CFG.ROWS;
    g.style.gridTemplateColumns = `repeat(${C},${cs}px)`; g.innerHTML = '';
    const map = {}; RL.layout(grid).forEach(q => map[q.r + ',' + q.c] = q);
    const SR = RL.stageRows(grid);
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const d = document.createElement('div'); d.className = 'cell'; d.style.width = d.style.height = cs + 'px';
      d.dataset.r = r; d.dataset.c = c;
      if (SR.n > 1) d.style.background = RL.CFG.STAGE_COLORS[SR.of(r) % RL.CFG.STAGE_COLORS.length];   // 段ごとの 色の帯
      if (hlCells.some(h => h[0] === r && h[1] === c)) d.classList.add('hl');
      const q = map[r + ',' + c]; if (q) { d.innerHTML = RL.drawPart(q.k, q.ctx);
        // v0.11：着陸脚は さいごの 段に ついて いないと やくに たたない（切りはなしで すてられる）ので うすく
        if (q.ctx.loose || (q.k === 'leg' && SR.of(r) !== SR.n - 1)) d.classList.add('loose'); }
      d.addEventListener('click', () => tap(r, c)); g.appendChild(d);
    }
    RL.emit('rendered');
  }
  function buzz() { RL.Audio.tone(150, 0.2, 'square', 0.1); }
  // レゴのように下からつむ。タップでけすと上がおちてくる
  function tap(r, c) {
    if (gridLocked) return;
    let action;
    if (grid[r][c]) {
      for (let i = r; i > 0; i--) grid[i][c] = grid[i - 1][c];
      grid[0][c] = null; RL.Audio.tone(300, 0.1, 'square', 0.1); action = 'remove';
    } else {
      if (allowed && !allowed.includes(sel)) return;
      let t = -1; for (let i = RL.CFG.ROWS - 1; i >= 0; i--) if (!grid[i][c]) { t = i; break; }
      if (t < 0) { buzz(); return; }
      // ブースターは 胴体の すぐ となりにだけ つけられる
      if (sel === 'booster') {
        const B = cc => cc >= 0 && cc < RL.CFG.COLS && RL.BODY[grid[t][cc]];
        if (!B(c - 1) && !B(c + 1)) {
          buzz(); const near = document.querySelectorAll(`.cell[data-r="${t}"]`);
          near.forEach(e => { if (RL.BODY[grid[t][+e.dataset.c]]) { e.classList.add('flash'); setTimeout(() => e.classList.remove('flash'), 900); } });
          if (!(RL.Tutorial && RL.Tutorial.active)) RL.Audio.say('ブースターは、どうたいの となりに つけてね。');
          RL.emit('booster-reject'); return;
        }
      }
      grid[t][c] = sel; RL.Audio.tone(520 + Math.random() * 200, 0.09, 'triangle'); action = 'place';
    }
    render(); RL.emit('change', { action, grid });
  }
  function ladder() {
    const l = $('ladder'); l.innerHTML = '';
    const pos = h => (RL.hPos(h) * 92 + 3) + '%';
    const at = document.createElement('div'); at.className = 'atmo'; at.style.bottom = pos(RL.CFG.PHYS.ATMO_H); l.appendChild(at);
    RL.CFG.ZONES.forEach(z => { const d = document.createElement('div'); d.className = 'zone'; d.style.bottom = pos(z.h); d.textContent = z.icon; l.appendChild(d); });
    if (S.last !== null) { const f = document.createElement('div'); f.className = 'flag'; f.textContent = '🚩'; f.style.bottom = pos(S.last); l.appendChild(f); }
    if (S.best > 0) { const f = document.createElement('div'); f.className = 'flag best'; f.textContent = '🏆'; f.style.bottom = pos(S.best); l.appendChild(f); }
  }
  function hint(k) { const p = document.querySelector(`.pal[data-k="${k}"]`); if (!p) return; p.classList.add('hint'); setTimeout(() => p.classList.remove('hint'), 2000); }
  function init() { grid = empty(); palette(); ladder(); setTimeout(render, 0); addEventListener('resize', render); }

  return {
    init, render, ladder, hint, state: S,
    get grid() { return grid; }, get selected() { return sel; },
    clear() { grid = empty(); RL.Audio.tone(250, 0.15, 'square', 0.1); render(); RL.emit('change', { action: 'clear', grid }); },
    setGrid(g) { grid = g; render(); },
    setAllowed(list) { allowed = list; if (allowed && !allowed.includes(sel)) sel = allowed[0]; palette(); },
    select(k) { sel = k; palette(); },
    lockGrid(b) { gridLocked = b; },
    highlightCell(rc) { hlCells = !rc ? [] : Array.isArray(rc[0]) ? rc : [rc]; render(); },
    resetRecords() { S.best = 0; S.last = null; ladder(); }
  };
})();
