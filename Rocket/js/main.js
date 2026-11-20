// 画面のつなぎこみ（タイトル・じゆうモード・はっしゃ・けっか）
(function () {
  const $ = id => document.getElementById(id), A = RL.Audio, B = RL.Builder;
  const NAMES = ['じめん', 'くも', 'ひこうき', 'うちゅう', 'じんこうえいせい', 'つき', 'すいせい', 'どせい'];
  $('launch').innerHTML = RL.ICON.rocket; $('clear').innerHTML = RL.ICON.trash; $('home').innerHTML = RL.ICON.home;
  $('mute').innerHTML = RL.ICON.soundOn; $('again').innerHTML = RL.ICON.again; $('tutEar').innerHTML = RL.ICON.ear;
  $('btnTut').innerHTML = RL.ICON.learn; $('btnFree').innerHTML = RL.ICON.play; $('titleRocket').innerHTML = RL.ICON.rocket;
  $('ver').textContent = 'Rocket Lab ' + RL.CFG.VERSION;

  function launch() {
    if (RL.Tutorial.active && !RL.Tutorial.canLaunch) { A.tone(150, 0.15, 'square', 0.08); return; }
    const a = RL.analyze(B.grid);
    if (!a.cells.length) { A.tone(200, 0.2, 'square', 0.1); return; }
    const s = RL.simulate(a);
    if (s.reason === 'noEngine') {
      A.tone(200, 0.15, 'square', 0.1); setTimeout(() => A.tone(160, 0.25, 'square', 0.1), 150);
      if (!RL.Tutorial.active) B.hint('engine');
      RL.emit('launch-fail', 'noEngine'); return;
    }
    RL.emit('launch', s);
    RL.Flight.run(a, s, () => result(s));
  }
  function result(s) {
    const S = B.state, z = RL.zoneOf(s.h), Z = RL.CFG.ZONES, newBest = s.lift && s.h > S.best;
    $('resIcon').textContent = s.lift ? Z[z].icon : (s.reason === 'heavy' ? '🏋️' : '😅');
    $('resStars').textContent = s.lift ? '⭐'.repeat(z) + (newBest && S.best > 0 ? ' 🏆' : '') : '💨';
    $('resInfo').innerHTML = s.lift ? `<span class="h">⬆${Math.round(s.h)}</span><span>🚀${Math.round(s.shownVmax || 0)}</span>` : '';
    if (s.lift) {
      if (newBest) [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => A.tone(f, 0.25, 'triangle'), i * 120)); else A.tone(523, 0.3, 'triangle');
      A.say((s.liftT > 1.5 ? 'おもくて なかなか とべなかったけど、' : '') + NAMES[z] + 'まで とどいた！' + (newBest && S.best > 0 ? ' しんきろく！' : ''));
    } else { A.tone(300, 0.2, 'sawtooth', 0.08); setTimeout(() => A.tone(220, 0.35, 'sawtooth', 0.08), 180); A.say(s.reason === 'heavy' ? 'おもくて あがらなかった！ ねんりょうが なくなっちゃった。' : 'あれれ？'); }
    s.prevBest = S.best;
    if (newBest) S.best = s.h;
    S.last = s.h; $('result').style.display = 'flex'; B.ladder();
    RL.emit('result', s);
  }
  function closeResult() { $('result').style.display = 'none'; }
  RL.closeResult = closeResult;

  function showTitle() { RL.Tutorial.stop(); A.stop(); closeResult(); $('title').style.display = 'flex'; }
  function startFree() { $('title').style.display = 'none'; B.setAllowed(null); B.lockGrid(false); B.highlightCell(null); B.select('engine'); A.say('じゆうに ロケットを つくろう！'); }
  RL.startFree = startFree;

  $('launch').addEventListener('click', launch);
  $('clear').addEventListener('click', () => { if (RL.Tutorial.active && !RL.Tutorial.canClear) { A.tone(150, 0.15, 'square', 0.08); return; } B.clear(); });
  $('home').addEventListener('click', showTitle);
  $('mute').addEventListener('click', () => { $('mute').innerHTML = A.toggle() ? RL.ICON.soundOff : RL.ICON.soundOn; });
  $('again').addEventListener('click', () => { if (RL.Tutorial.active) return; closeResult(); A.tone(660, 0.08); });
  $('btnFree').addEventListener('click', startFree);
  $('btnTut').addEventListener('click', () => { $('title').style.display = 'none'; RL.Tutorial.start(); });
  // バージョン表示を3回タップ：見本のロケット
  let vt = 0; $('ver').addEventListener('click', () => {
    if (++vt < 3) return; vt = 0;
    const R = RL.CFG.ROWS, g = Array.from({ length: R }, () => Array(RL.CFG.COLS).fill(null)), b = R - 1;
    g[b][2] = 'engine'; for (let r = b - 1; r >= 1; r--) g[r][2] = 'tank'; g[0][2] = 'nose';
    for (let r = b; r >= b - 3; r--) { g[r][1] = 'booster'; g[r][3] = 'booster'; } g[b][0] = 'fin'; g[b][4] = 'fin';
    B.setGrid(g);
  });
  B.init();
})();
