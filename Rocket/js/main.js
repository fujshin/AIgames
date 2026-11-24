// 画面のつなぎこみ（タイトル・じゆうモード・はっしゃ・けっか）
(function () {
  const $ = id => document.getElementById(id), A = RL.Audio, B = RL.Builder;
  const NAMES = ['じめん', 'くも', 'ひこうき', 'うちゅう', 'じんこうえいせい', 'つき', 'すいせい', 'どせい'];
  $('launch').innerHTML = RL.ICON.rocket; $('clear').innerHTML = RL.ICON.trash; $('home').innerHTML = RL.ICON.home;
  $('mute').innerHTML = RL.ICON.soundOn; $('again').innerHTML = RL.ICON.again; $('tutEar').innerHTML = RL.ICON.ear;
  $('btnTut').innerHTML = RL.ICON.learn; $('btnFree').innerHTML = RL.ICON.play; $('titleRocket').innerHTML = RL.ICON.rocket;
  $('btnOrbit').innerHTML = RL.ICON.orbit; $('btnMap').innerHTML = RL.ICON.map; $('btnDone').innerHTML = RL.ICON.flag;
  $('cfYes').innerHTML = RL.ICON.ok; $('cfNo').innerHTML = RL.ICON.ng;
  // ---- モード：'free'（たかさ）／ 'orbit'（うちゅう） ----
  let mode = 'free', profile = 'side';
  const PROF = ['up', 'tilt', 'side'], PROF_ICON = { up: RL.ICON.profUp, tilt: RL.ICON.profTilt, side: RL.ICON.profSide };
  const PROF_SAY = { up: 'まっすぐ うえに', tilt: 'ななめに', side: 'よこに たおして' };
  function setProfile(p) { profile = p; $('prof').innerHTML = PROF_ICON[p]; }
  setProfile('side');
  $('prof').addEventListener('click', () => { setProfile(PROF[(PROF.indexOf(profile) + 1) % 3]); A.tone(660, 0.08); A.say(PROF_SAY[profile] + ' とぶよ。'); });
  function setMode(m) { mode = m; document.body.classList.toggle('orbitMode', m === 'orbit'); }
  // ---- 確認ダイアログ（絵 ＋ ⭕／❌）。文字は 使わない ----
  let cfYes = null;
  function confirmBox(iconHTML, say, yes) {
    $('cfIcon').innerHTML = iconHTML; $('confirm').style.display = 'flex'; cfYes = yes; A.tone(500, 0.1); if (say) A.say(say);
  }
  RL.confirm = confirmBox;
  $('cfYes').addEventListener('click', () => { $('confirm').style.display = 'none'; const f = cfYes; cfYes = null; f && f(); });
  $('cfNo').addEventListener('click', () => { $('confirm').style.display = 'none'; cfYes = null; A.tone(300, 0.08); });
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
    if (mode === 'orbit') { RL.Flight2D.run(a, profile, sim => result2d(sim), aborted); return; }
    RL.Flight.run(a, s, () => result(s), aborted);
  }
  // 中止：結果は出さず、組み立てたロケットのまま もどる
  function aborted() { A.say('ちゅうし！ つくりなおそう。'); RL.emit('abort'); }
  // ---- うちゅうモードの結果 ----
  function result2d(sim) {
    const d = sim.done, O = RL.CFG.ORBIT, R = O.R, info = [];
    let icon = '😅', stars = 0, say = '';
    const alt = Math.round(d.maxAlt || 0);
    switch (d.type) {
      case 'ground': icon = '🎯'; stars = alt > 3000 ? 2 : alt > 300 ? 1 : 0;
        say = (alt > 300 ? 'うちゅうまで いったけど、' : '') + 'おちてきちゃった。 もっと よこに はやく とぶと、ちきゅうを まわれるよ。';
        info.push(`<span class="h">⬆${alt}</span>`, `<span class="h">➡${Math.round(d.range || 0)}</span>`); break;
      case 'orbit': {
        const el = d.el, pe = Math.round(el.rp - sim.bodies[d.body].R), ap = Math.round(el.ra - sim.bodies[d.body].R);
        if (d.body === 'moon') { icon = '🌙'; stars = 5; say = 'すごい！ つきを まわる きどうに のったよ！'; }
        else if (d.cls === 'toMoon') { icon = '🌙'; stars = 4; say = 'つきまで とどく きどうに のったよ！'; }
        else if (d.cls === 'high') { icon = '🛰️'; stars = 4; say = 'たかい きどうを まわったよ！'; }
        else { icon = '🛰️'; stars = 3; say = 'ちきゅうを まわったよ！ じんこうえいせい だ！'; }
        info.push(`<span>▼${pe}</span>`, `<span class="h">▲${ap}</span>`); break; }
      case 'escape': icon = '🚀'; stars = 5; say = 'ちきゅうの じゅうりょくから だっしゅつ したよ！'; info.push(`<span>🚀${Math.round(d.maxV)}</span>`); break;
      case 'hit': icon = '🌙'; stars = 5; say = 'つきに とうちゃく！ でも、ドーンと ぶつかっちゃった。'; break;
      case 'heavy': icon = '🏋️'; say = 'おもくて あがらなかった！'; break;
      default: icon = '⏱️'; say = 'じかん ぎれ！';
    }
    if (d.type !== 'heavy') info.push(`<span>🚀${Math.round(d.maxV || 0)}</span>`);
    $('resIcon').textContent = icon; $('resStars').textContent = stars ? '⭐'.repeat(stars) : '💨';
    $('resInfo').innerHTML = [...new Set(info)].join('');
    if (stars >= 3) [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => A.tone(f, 0.25, 'triangle'), i * 120)); else A.tone(523, 0.3, 'triangle');
    A.say(say); $('result').style.display = 'flex';
    RL.emit('result2d', sim);
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
  function startFree() { setMode('free'); document.body.classList.remove('tutorial'); $('title').style.display = 'none'; B.setAllowed(null); B.lockGrid(false); B.highlightCell(null); B.select('engine'); A.say('じゆうに ロケットを つくろう！'); }
  RL.startFree = startFree;
  function startOrbit() { startFree(); setMode('orbit'); A.say('うちゅうモード！ ちきゅうを まわる ロケットを つくろう！'); }

  $('launch').addEventListener('click', launch);
  $('clear').addEventListener('click', () => {
    if (RL.Tutorial.active) { if (!RL.Tutorial.canClear) { A.tone(150, 0.15, 'square', 0.08); return; } B.clear(); return; }
    if (!B.grid.some(row => row.some(Boolean))) { A.tone(200, 0.1, 'square', 0.08); return; }
    confirmBox(RL.ICON.trash + '<span>🚀❓</span>', 'ぜんぶ けしても いい？', () => B.clear());   // まちがえて けさないように
  });
  $('home').addEventListener('click', showTitle);
  $('mute').addEventListener('click', () => { $('mute').innerHTML = A.toggle() ? RL.ICON.soundOff : RL.ICON.soundOn; });
  $('again').addEventListener('click', () => { if (RL.Tutorial.active) return; closeResult(); A.tone(660, 0.08); });
  $('btnFree').addEventListener('click', startFree);
  $('btnOrbit').addEventListener('click', startOrbit);
  $('btnTut').addEventListener('click', () => { setMode('free'); $('title').style.display = 'none'; document.body.classList.add('tutorial'); RL.Tutorial.start(); });
  // バージョン表示を3回タップ：見本のロケット（2段式）
  let vt = 0; $('ver').addEventListener('click', () => {
    if (++vt < 3) return; vt = 0;
    const R = RL.CFG.ROWS, g = Array.from({ length: R }, () => Array(RL.CFG.COLS).fill(null)), b = R - 1;
    ['engine', 'tank', 'tank', 'tank', 'ring', 'vengine', 'tank', 'nose'].forEach((k, i) => g[b - i][2] = k);
    for (let r = b; r >= b - 4; r--) { g[r][1] = 'booster'; g[r][3] = 'booster'; } g[b][0] = 'fin'; g[b][4] = 'fin';
    B.setGrid(g);
  });
  B.init();
})();
