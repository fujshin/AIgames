// くみたて画面
//  v0.12：つける部品（脚→エンジン、パラシュート→まど）。うちゅうモードは 縦14行で、見えるのは 9行（▲▼・指で 上下に うごかす）
RL.Builder = (function () {
  const $ = id => document.getElementById(id);
  let grid, sel = 'engine', allowed = null, gridLocked = false, hlCells = [], cs0 = 30;
  const S = { best: 0, last: null };
  const empty = () => Array.from({ length: RL.CFG.ROWS }, () => Array(RL.CFG.COLS).fill(null));
  const VIS = () => Math.min(RL.CFG.ROWS, RL.CFG.VIS_ROWS || 9);
  const scrolls = () => RL.CFG.ROWS > VIS();
  function palette() {
    const p = $('palette'); p.innerHTML = '';
    RL.PART_ORDER.forEach(k => {
      const off = allowed && !allowed.includes(k);
      const b = document.createElement('div'); b.className = 'pal' + (k === sel ? ' sel' : '') + (off ? ' off' : '') + (RL.ATTACH[k] ? ' att' : ''); b.dataset.k = k;
      b.innerHTML = RL.paletteIcon(k);
      b.addEventListener('click', () => {
        if (off) { RL.Audio.tone(150, 0.15, 'square', 0.08); return; }
        sel = k; RL.Audio.tone(660, 0.08); palette(); RL.emit('select', k);
        if (RL.ATTACH[k] && !(RL.Tutorial && RL.Tutorial.active)) RL.Audio.say(k === 'leg' ? 'あしは、エンジンを おして つけてね。' : 'パラシュートは、まどを おして つけてね。');
      });
      p.appendChild(b);
    });
  }
  function cellSize() { const s = $('stage'); return Math.floor(Math.min((s.clientWidth - 16 - (scrolls() ? 46 : 0)) / RL.CFG.COLS, (s.clientHeight - 40) / VIS())); }
  function render() {
    const g = $('grid'), cs = cellSize(), C = RL.CFG.COLS, R = RL.CFG.ROWS; cs0 = cs;
    g.style.gridTemplateColumns = `repeat(${C},${cs}px)`; g.innerHTML = '';
    $('gridView').style.height = VIS() * cs + 'px'; $('gridView').style.width = C * cs + 'px';
    $('scrollBtns').style.display = scrolls() ? 'flex' : 'none';
    const map = {}; RL.layout(grid).forEach(q => map[q.r + ',' + q.c] = q);
    const SR = RL.stageRows(grid);
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const d = document.createElement('div'); d.className = 'cell'; d.style.width = d.style.height = cs + 'px';
      d.dataset.r = r; d.dataset.c = c;
      if (SR.n > 1) d.style.background = RL.CFG.STAGE_COLORS[SR.of(r) % RL.CFG.STAGE_COLORS.length];   // 段ごとの 色の帯
      if (hlCells.some(h => h[0] === r && h[1] === c)) d.classList.add('hl');
      const q = map[r + ',' + c]; if (q) { d.innerHTML = RL.drawPart(q.k, q.ctx);
        if (q.ctx.loose) d.classList.add('loose');
        // v0.12：つけたものは さいごの 段に ついて いないと やくに たたない（切りはなしで すてられる）ので うすく
        if (q.ctx.att && q.ctx.att.length && SR.of(r) !== SR.n - 1) d.classList.add('attLoose'); }
      d.addEventListener('click', () => tap(r, c)); g.appendChild(d);
    }
    ladder();
    RL.emit('rendered');
  }
  function buzz() { RL.Audio.tone(150, 0.2, 'square', 0.1); }
  const flash = test => document.querySelectorAll('.cell').forEach(e => { if (test(grid[+e.dataset.r][+e.dataset.c])) { e.classList.add('flash'); setTimeout(() => e.classList.remove('flash'), 900); } });
  // v0.12：つける部品（脚・パラシュート）。つけられる 部品を おすと つく／もういちど おすと はずれる
  function attach(r, c) {
    const k = grid[r][c], ok = RL.ATTACH[sel];
    if (!k || !ok.includes(RL.base(k))) {
      buzz(); flash(v => v && ok.includes(RL.base(v)));
      if (!(RL.Tutorial && RL.Tutorial.active)) RL.Audio.say(sel === 'leg' ? 'あしは、エンジンに つけてね。' : 'パラシュートは、まどに つけてね。');
      RL.emit('attach-reject'); return;
    }
    const at = RL.atts(k), on = at.includes(sel);
    grid[r][c] = [RL.base(k), ...(on ? at.filter(x => x !== sel) : [...at, sel])].join('+');
    if (on) RL.Audio.tone(300, 0.1, 'square', 0.1); else { RL.Audio.tone(880, 0.06, 'square', 0.08); setTimeout(() => RL.Audio.tone(1320, 0.08, 'triangle'), 60); }
    render(); RL.emit('change', { action: on ? 'detach' : 'attach', grid });
  }
  // レゴのように下からつむ。タップでけすと上がおちてくる
  function tap(r, c) {
    if (gridLocked) return;
    if (RL.ATTACH[sel] && !(allowed && !allowed.includes(sel))) { attach(r, c); return; }
    let action, placedRow = null;
    if (grid[r][c]) {
      if (allowed && !allowed.includes(RL.base(grid[r][c]))) { buzz(); return; }   // v0.14.6：つかえない 部品は けせない（ミッション）
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
      grid[t][c] = sel; RL.Audio.tone(520 + Math.random() * 200, 0.09, 'triangle'); action = 'place'; placedRow = t;
    }
    render(); RL.emit('change', { action, grid });
    if (placedRow !== null) showRow(placedRow);
  }
  // ---- v0.12 上下に うごかす ----
  const gv = () => $('gridView');
  function showRow(r) {   // r 行目と その 上 1行が 見える ように
    if (!scrolls()) return; const v = gv(), top = Math.max(0, (r - 1) * cs0);
    if (top < v.scrollTop) v.scrollTo({ top, behavior: 'smooth' });
    else if ((r + 1) * cs0 > v.scrollTop + v.clientHeight) v.scrollTo({ top: (r + 1) * cs0 - v.clientHeight, behavior: 'smooth' });
  }
  function toBottom() { const v = gv(); v.scrollTop = v.scrollHeight; }
  function scrollBy(rows) { gv().scrollBy({ top: rows * cs0, behavior: 'smooth' }); RL.Audio.tone(600, 0.05); }
  // 左の はしご：たかさモードは 高さの 目もり、うちゅうモード（14行）は ロケット全体の 小さな 絵と 見ている わく
  function ladder() {
    const l = $('ladder'); l.innerHTML = '';
    l.classList.toggle('overview', scrolls());
    if (scrolls()) return overview(l);
    const pos = h => (RL.hPos(h) * 92 + 3) + '%';
    const at = document.createElement('div'); at.className = 'atmo'; at.style.bottom = pos(RL.CFG.PHYS.ATMO_H); l.appendChild(at);
    RL.CFG.ZONES.forEach(z => { const d = document.createElement('div'); d.className = 'zone'; d.style.bottom = pos(z.h); d.textContent = z.icon; l.appendChild(d); });
    if (S.last !== null) { const f = document.createElement('div'); f.className = 'flag'; f.textContent = '🚩'; f.style.bottom = pos(S.last); l.appendChild(f); }
    if (S.best > 0) { const f = document.createElement('div'); f.className = 'flag best'; f.textContent = '🏆'; f.style.bottom = pos(S.best); l.appendChild(f); }
  }
  const OV_COL = { engine: '#7a849a', vengine: '#3d7bd9', tank: '#f4f6fb', ring: '#ffd54a', booster: '#dfe3ec', fin: '#ffd54a', win: '#bfe6ff', nose: '#e5383b' };
  function overview(l) {
    const R = RL.CFG.ROWS, C = RL.CFG.COLS, W = l.clientWidth - 8, Hh = l.clientHeight - 8, u = Math.max(2, Math.floor(Math.min(W / C, Hh / R)));
    const box = document.createElement('div'); box.className = 'ovBox'; box.style.width = C * u + 'px'; box.style.height = R * u + 'px';
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { const k = grid[r][c]; if (!k) continue;
      const d = document.createElement('div'); d.className = 'ovCell'; Object.assign(d.style, { left: c * u + 'px', top: r * u + 'px', width: u + 'px', height: u + 'px', background: OV_COL[RL.base(k)] || '#888' }); box.appendChild(d); }
    const fr = document.createElement('div'); fr.className = 'ovFrame'; fr.style.height = VIS() * u + 'px'; box.appendChild(fr);
    const sync = () => { const v = gv(); fr.style.top = (v.scrollTop / Math.max(1, cs0)) * u + 'px'; };
    box.addEventListener('click', e => { const y = e.clientY - box.getBoundingClientRect().top; gv().scrollTo({ top: (y / u - VIS() / 2) * cs0, behavior: 'smooth' }); });
    l.appendChild(box); sync(); l._sync = sync;
  }
  function hint(k) { const p = document.querySelector(`.pal[data-k="${k}"]`); if (!p) return; p.classList.add('hint'); setTimeout(() => p.classList.remove('hint'), 2000); }
  function init() {
    grid = empty(); palette(); setTimeout(() => { render(); toBottom(); }, 0); addEventListener('resize', render);
    gv().addEventListener('scroll', () => { const l = $('ladder'); if (l._sync && scrolls()) l._sync(); });
    $('scrUp').addEventListener('click', () => scrollBy(-3)); $('scrDown').addEventListener('click', () => scrollBy(3));
  }
  return {
    init, render, ladder, hint, state: S,
    get grid() { return grid; }, get selected() { return sel; },
    clear() { grid = empty(); RL.Audio.tone(250, 0.15, 'square', 0.1); render(); RL.emit('change', { action: 'clear', grid }); },
    setGrid(g) { grid = g; render(); toBottom(); },
    // v0.12：行数を かえる（たかさモード 9／うちゅうモード 14）
    setRows(n, g) { RL.CFG.ROWS = n; grid = g && g.length === n ? g : empty(); render(); toBottom(); },
    setAllowed(list) { allowed = list; if (allowed && !allowed.includes(sel)) sel = allowed[0]; palette(); },
    select(k) { sel = k; palette(); },
    lockGrid(b) { gridLocked = b; },
    highlightCell(rc) { hlCells = !rc ? [] : Array.isArray(rc[0]) ? rc : [rc]; render(); },
    resetRecords() { S.best = 0; S.last = null; ladder(); }
  };
})();
