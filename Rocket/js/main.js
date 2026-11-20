// 画面のつなぎこみ
(function () {
  const $ = id => document.getElementById(id), A = RL.Audio, B = RL.Builder;
  $('launch').innerHTML = RL.ICON.rocket;
  $('clear').innerHTML = RL.ICON.trash;
  $('mute').innerHTML = RL.ICON.soundOn;
  $('again').innerHTML = RL.ICON.again;
  $('ver').textContent = 'Rocket Lab ' + RL.CFG.VERSION;

  function launch() {
    const a = RL.analyze(B.grid);
    if (!a.cells.length) { A.tone(200, 0.2, 'square', 0.1); return; }
    const s = RL.simulate(a);
    if (s.reason === 'noEngine') {   // エンジンがない → エンジンのボタンが光る
      A.tone(200, 0.15, 'square', 0.1); setTimeout(() => A.tone(160, 0.25, 'square', 0.1), 150); B.hint('engine'); return;
    }
    RL.Flight.run(a, s, () => result(s));
  }
  function result(s) {
    const S = B.state, z = RL.zoneOf(s.h), Z = RL.CFG.ZONES;
    const newBest = s.lift && s.h > S.best;
    $('resIcon').textContent = s.lift ? Z[z].icon : (s.reason === 'heavy' ? '🏋️' : '😅');
    $('resStars').textContent = s.lift ? '⭐'.repeat(z) + (newBest && S.best > 0 ? ' 🏆' : '') : '💨';
    if (s.lift) {
      if (newBest) [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => A.tone(f, 0.25, 'triangle'), i * 120));
      else A.tone(523, 0.3, 'triangle');
    } else { A.tone(300, 0.2, 'sawtooth', 0.08); setTimeout(() => A.tone(220, 0.35, 'sawtooth', 0.08), 180); }
    if (newBest) S.best = s.h;
    $('resInfo').innerHTML = s.lift ? `<span class="h">⬆${Math.round(s.h * 10)}</span><span>🚀${Math.round(s.shownVmax || 0)}</span>` : '';
    S.last = s.h; $('result').style.display = 'flex'; B.ladder();
  }

  $('launch').addEventListener('click', launch);
  $('clear').addEventListener('click', () => B.clear());
  $('mute').addEventListener('click', () => { $('mute').innerHTML = A.toggle() ? RL.ICON.soundOff : RL.ICON.soundOn; });
  $('again').addEventListener('click', () => { $('result').style.display = 'none'; A.tone(660, 0.08); });
  // バージョン表示を3回タップ：見本のロケット
  let vt = 0; $('ver').addEventListener('click', () => {
    if (++vt < 3) return; vt = 0;
    const R = RL.CFG.ROWS, g = Array.from({ length: R }, () => Array(RL.CFG.COLS).fill(null)), b = R - 1;
    [[b, 1, 'engine'], [b, 2, 'engine'], [b, 3, 'engine'], [b, 0, 'fin'], [b, 4, 'fin'],
     [b - 1, 1, 'tank'], [b - 1, 2, 'tank'], [b - 1, 3, 'tank'], [b - 2, 1, 'tank'], [b - 2, 2, 'win'], [b - 2, 3, 'tank'],
     [b - 3, 1, 'nose'], [b - 3, 2, 'tank'], [b - 3, 3, 'nose'], [b - 4, 2, 'nose']].forEach(([r, c, k]) => g[r][c] = k);
    B.setGrid(g);
  });
  B.init();
})();
