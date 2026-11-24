// 画面のつなぎこみ（タイトル・じゆうモード・はっしゃ・けっか）
// v0.9：こどもごとの セーブ（えらぶ・つくる・けす）、勲章、ワールド（衛星・月の はた）
(function () {
  const $ = id => document.getElementById(id), A = RL.Audio, B = RL.Builder, SV = RL.Save, SC = RL.CFG.SAVE;
  const NAMES = ['じめん', 'くも', 'ひこうき', 'うちゅう', 'じんこうえいせい', 'つき', 'すいせい', 'どせい'];
  $('launch').innerHTML = RL.ICON.rocket; $('clear').innerHTML = RL.ICON.trash; $('home').innerHTML = RL.ICON.home;
  $('mute').innerHTML = RL.ICON.soundOn; $('again').innerHTML = RL.ICON.again; $('tutEar').innerHTML = RL.ICON.ear;
  $('btnTut').innerHTML = RL.ICON.learn; $('btnFree').innerHTML = RL.ICON.play; $('titleRocket').innerHTML = RL.ICON.rocket;
  $('btnOrbit').innerHTML = RL.ICON.orbit; $('btnMap').innerHTML = RL.ICON.map; $('btnDone').innerHTML = RL.ICON.flag;
  $('cfYes').innerHTML = RL.ICON.ok; $('cfNo').innerHTML = RL.ICON.ng; $('pkClose').innerHTML = RL.ICON.ng; $('mdClose').innerHTML = RL.ICON.ng;
  // ---- モード：'free'（たかさ）／ 'orbit'（うちゅう） ----
  let mode = 'free', profile = 'side';
  const PROF = ['up', 'tilt', 'side'], PROF_ICON = { up: RL.ICON.profUp, tilt: RL.ICON.profTilt, side: RL.ICON.profSide };
  const PROF_SAY = { up: 'まっすぐ うえに', tilt: 'ななめに', side: 'よこに たおして' };
  function setProfile(p) { profile = PROF.includes(p) ? p : 'side'; $('prof').innerHTML = PROF_ICON[profile]; }
  setProfile('side');
  $('prof').addEventListener('click', () => { setProfile(PROF[(PROF.indexOf(profile) + 1) % 3]); SV.update(p => { p.profile = profile; }); A.tone(660, 0.08); A.say(PROF_SAY[profile] + ' とぶよ。'); });
  function setMode(m) { mode = m; document.body.classList.toggle('orbitMode', m === 'orbit'); }
  // ---- 確認ダイアログ（絵 ＋ ⭕／❌）。文字は 使わない ----
  let cfYes = null;
  function confirmBox(iconHTML, say, yes, danger) {
    $('cfIcon').innerHTML = iconHTML; $('confirm').style.display = 'flex'; $('confirm').classList.toggle('danger', !!danger); cfYes = yes; A.tone(danger ? 300 : 500, 0.12); if (say) A.say(say);
  }
  RL.confirm = confirmBox;
  $('cfYes').addEventListener('click', () => { $('confirm').style.display = 'none'; const f = cfYes; cfYes = null; f && f(); });
  $('cfNo').addEventListener('click', () => { $('confirm').style.display = 'none'; cfYes = null; A.tone(300, 0.08); });
  $('ver').textContent = 'Rocket Lab ' + RL.CFG.VERSION;
  // =====================================================================
  // v0.9 セーブ：こどもを えらぶ
  // =====================================================================
  const emptyGrid = () => Array.from({ length: RL.CFG.ROWS }, () => Array(RL.CFG.COLS).fill(null));
  const clone = g => g.map(r => r.slice());
  const medalCount = p => (p ? Object.keys(p.medals).length : 0);
  // いまの こどもの きろくを 画面に もどす
  function applyProfile() {
    const p = SV.cur; if (!p) return;
    B.state.best = p.best || 0; B.state.last = p.last == null ? null : p.last; B.ladder();
    const ok = Array.isArray(p.grid) && p.grid.length === RL.CFG.ROWS && p.grid.every(r => Array.isArray(r) && r.length === RL.CFG.COLS);
    B.setGrid(ok ? clone(p.grid) : emptyGrid());
    setProfile(p.profile || 'side');
    renderWho();
  }
  function renderWho() {
    const p = SV.cur;
    $('who').innerHTML = p ? `<span class="av">${p.avatar}</span>` : '<span class="av">👤</span><span class="plus">＋</span>';
    $('medBtn').innerHTML = `<span>🏅</span><b>${medalCount(p)}</b>`;
    $('medBtn').style.visibility = p ? 'visible' : 'hidden';
    $('badge').textContent = p ? p.avatar : '';
  }
  // こどもの わく（4つ）
  function renderPicker(forced) {
    const box = $('slots'); box.innerHTML = '';
    $('avatars').style.display = 'none'; box.style.display = 'flex';
    $('pkClose').style.visibility = forced || !SV.cur ? 'hidden' : 'visible';
    SV.slots.forEach((p, i) => {
      const d = document.createElement('div'); d.className = 'slot' + (p ? '' : ' empty') + (p && i === SV.index ? ' cur' : '');
      if (p) {
        const c = RL.World.counts(p);
        d.innerHTML = `<button type="button" class="pick" aria-label="えらぶ"><span class="av">${p.avatar}</span><span class="sm">🏅${medalCount(p)}　🛰️${c.sats}</span></button>` +
          `<button type="button" class="del" aria-label="けす">${RL.ICON.trash}</button>`;
        d.querySelector('.pick').addEventListener('click', () => { SV.select(i); applyProfile(); closePicker(); A.tone(784, 0.1); A.say('おかえり！'); });
        d.querySelector('.del').addEventListener('click', () => askRemove(i));
      } else {
        d.innerHTML = '<button type="button" class="pick" aria-label="あたらしく つくる"><span class="av">＋</span></button>';
        d.querySelector('.pick').addEventListener('click', () => chooseAvatar(i));
      }
      box.appendChild(d);
    });
  }
  // どうぶつを えらぶ（ほかの こどもが つかっている どうぶつは えらべない）
  function chooseAvatar(i) {
    const used = SV.slots.filter(Boolean).map(p => p.avatar), box = $('avatars'); box.innerHTML = '';
    SC.AVATARS.forEach(av => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'avb' + (used.includes(av) ? ' off' : ''); b.textContent = av;
      b.addEventListener('click', () => {
        if (used.includes(av)) { A.tone(150, 0.15, 'square', 0.08); return; }
        SV.create(i, av); applyProfile(); closePicker();
        [523, 659, 784].forEach((f, k) => setTimeout(() => A.tone(f, 0.15, 'triangle'), k * 90)); A.say('よろしくね！ いっしょに うちゅうを めざそう！');
      });
      box.appendChild(b);
    });
    $('slots').style.display = 'none'; box.style.display = 'flex'; $('pkClose').style.visibility = 'visible';
    A.say('すきな どうぶつを えらんでね。');
  }
  // けす：2かい きく（まちがえて けさないように）
  function askRemove(i) {
    const p = SV.slots[i]; if (!p) return;
    confirmBox(`${RL.ICON.trash}<span>${p.avatar}❓</span>`, 'この こどもの きろくを けしても いい？', () => {
      setTimeout(() => confirmBox(`<span>⚠️</span>${RL.ICON.trash}<span>${p.avatar}‼️</span>`, 'ほんとうに けすよ？ くんしょうも えいせいも、ぜんぶ なくなって、もう もどせないよ。', () => {
        SV.remove(i); A.tone(200, 0.3, 'sawtooth', 0.1);
        if (SV.cur) applyProfile(); else { B.state.best = 0; B.state.last = null; B.ladder(); B.setGrid(emptyGrid()); renderWho(); }
        renderPicker(!SV.cur);
      }, true), 150);
    });
  }
  function openPicker(forced) { renderPicker(forced); $('picker').style.display = 'flex'; if (forced) A.say('だれが あそぶ？ ＋を おして、どうぶつを えらんでね。'); }
  function closePicker() { if (!SV.cur) return; $('picker').style.display = 'none'; renderWho(); }
  $('who').addEventListener('click', () => { A.tone(660, 0.06); openPicker(!SV.cur); });
  $('pkClose').addEventListener('click', () => { if ($('avatars').style.display !== 'none') { renderPicker(!SV.cur); return; } closePicker(); });
  // ---- 勲章 ----
  const MEDAL_SVG = (icon, got) => `<svg viewBox="0 0 100 120"><path d="M30 0 H48 L40 46 H22Z" fill="${got ? '#e5383b' : '#556'}"/><path d="M52 0 H70 L78 46 H60Z" fill="${got ? '#3d7bd9' : '#667'}"/>` +
    `<circle cx="50" cy="78" r="38" fill="${got ? '#ffd54a' : '#8a8f9e'}" stroke="${got ? '#c98a00' : '#5c6070'}" stroke-width="6"/>` +
    `<text x="50" y="92" font-size="40" text-anchor="middle">${icon}</text></svg>`;
  let toastT = null;
  function award(keys) {
    const got = keys.filter(k => SV.medal(k)); if (!got.length) return [];
    const t = $('toast');
    t.innerHTML = got.map(k => MEDAL_SVG(RL.MEDALS.find(m => m.key === k).icon, true)).join('');
    clearTimeout(toastT);
    setTimeout(() => { t.style.display = 'flex'; t.classList.remove('pop'); void t.offsetWidth; t.classList.add('pop');
      [784, 988, 1175, 1568].forEach((f, i) => setTimeout(() => A.tone(f, 0.22, 'triangle', 0.15), i * 110));
      A.say('くんしょう ゲット！', null, { interrupt: false });
      toastT = setTimeout(() => { t.style.display = 'none'; }, 3800); }, 900);
    renderWho();
    return got;
  }
  // ---- 勲章と ワールドを 見る ----
  let mdRaf = null;
  function openMedals() {
    const p = SV.cur; if (!p) return;
    $('medGrid').innerHTML = RL.MEDALS.map(m => `<div class="medal${p.medals[m.key] ? ' got' : ''}">${MEDAL_SVG(m.icon, !!p.medals[m.key])}</div>`).join('');
    const c = RL.World.counts(p);
    $('wCount').innerHTML = `<span>🛰️×${c.sats}</span><span>🚩×${c.flags}</span>`;
    $('medals').style.display = 'flex'; A.tone(660, 0.06);
    A.say(`くんしょうは ${medalCount(p)}こ。` + (c.sats ? ` えいせいが ${c.sats}こ、うちゅうを まわっているよ。` : ''));
    drawWorld(p);
  }
  function closeMedals() { $('medals').style.display = 'none'; cancelAnimationFrame(mdRaf); }
  $('medBtn').addEventListener('click', openMedals);
  $('mdClose').addEventListener('click', closeMedals);
  // タイトルの ワールド図：地球・月・衛星（ゆっくり うごく）
  function drawWorld(p) {
    const cv = $('worldCv'), g = cv.getContext('2d'), dpr = devicePixelRatio || 1, SP = RL.Space, Wb = SP.makeBodies(), E = Wb.earth, M = Wb.moon;
    const size = cv.clientWidth || 260; cv.width = size * dpr; cv.height = size * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const items = p.world.objs.map(o => ({ o, pts: o.kind === 'sat' ? RL.World.orbitPts(o, 72) : null }));
    const far = items.some(it => it.o.body === 'moon' || it.o.kind === 'flag' || (it.o.el && it.o.el.ra > M.orbitR * 0.5));
    let rMax = E.R * 1.6; items.forEach(it => { if (it.o.kind === 'sat' && it.o.body === 'earth') rMax = Math.max(rMax, Math.min(it.o.el.ra, E.soi) * 1.15); });
    if (far) rMax = Math.max(rMax, (M.orbitR + M.soi) * 1.05);
    const sc = size / 2 / rMax, X = x => size / 2 + x * sc, Y = y => size / 2 - y * sc, t0 = performance.now();
    function frame() {
      const abs = p.world.clock + (performance.now() - t0) / 1000 * 40, ms = SP.bodyState(M, 0);
      g.fillStyle = '#02030f'; g.fillRect(0, 0, size, size);
      g.setLineDash([3, 5]); g.strokeStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(X(0), Y(0), M.orbitR * sc, 0, 7); g.stroke(); g.setLineDash([]);
      g.fillStyle = 'rgba(120,200,255,.3)'; g.beginPath(); g.arc(X(0), Y(0), Math.max(5, (E.R + E.atmo) * sc) + 1, 0, 7); g.fill();
      g.fillStyle = '#2f7bd9'; g.beginPath(); g.arc(X(0), Y(0), Math.max(4, E.R * sc), 0, 7); g.fill();
      // 月は 小さすぎるので 大きめに かく。月の まわりの 衛星・はた も 同じ わりあいで ひろげる
      const mR = Math.max(9, M.R * sc), mk = mR / (M.R * sc); RL.Flight2D.drawMoon(g, X(ms.x), Y(ms.y), mR);
      const P = (q, moonish) => moonish ? [X(ms.x) + q[0] * sc * mk, Y(ms.y) - q[1] * sc * mk] : [X(q[0]), Y(q[1])];
      items.forEach(it => {
        const o = it.o;
        if (o.kind === 'flag') { g.font = '14px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText('🚩', X(ms.x) + Math.cos(o.ang) * (mR + 7), Y(ms.y) - Math.sin(o.ang) * (mR + 7)); return; }
        const mo = o.body === 'moon';
        g.strokeStyle = 'rgba(255,213,74,.35)'; g.lineWidth = 1; g.beginPath();
        it.pts.forEach((q, i) => { const [x, y] = P(q, mo); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
        const s = RL.World.posAt(o, abs), [x, y] = P([s.x, s.y], mo); RL.Flight2D.drawSat(g, x, y, 0.8);
      });
      mdRaf = requestAnimationFrame(frame);
    }
    cancelAnimationFrame(mdRaf); frame();
  }
  // =====================================================================
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
  // 中止：結果は出さず、組み立てたロケットのまま もどる（うちゅうモードは ワールドの 時計だけ すすむ）
  function aborted(sim) { if (sim && sim.t) SV.advanceClock(sim.t); A.say('ちゅうし！ つくりなおそう。'); RL.emit('abort'); }
  // ---- うちゅうモードの結果 ----
  function result2d(sim) {
    const d = sim.done, info = [], medals = [];
    let icon = '😅', stars = 0, say = '';
    const alt = Math.round(d.maxAlt || 0), W0 = sim.worldStart || 0;
    if (alt >= RL.CFG.ORBIT.ATMO_H) medals.push('space');
    switch (d.type) {
      case 'ground': icon = '🎯'; stars = alt > 3000 ? 2 : alt > 300 ? 1 : 0;
        say = (alt > 300 ? 'うちゅうまで いったけど、' : '') + 'おちてきちゃった。 もっと よこに はやく とぶと、ちきゅうを まわれるよ。';
        info.push(`<span class="h">⬆${alt}</span>`, `<span class="h">➡${Math.round(d.range || 0)}</span>`); break;
      case 'orbit': {
        const el = d.el, pe = Math.round(el.rp - sim.bodies[d.body].R), ap = Math.round(el.ra - sim.bodies[d.body].R);
        if (d.body === 'moon') { icon = '🌙'; stars = 5; say = 'すごい！ つきを まわる きどうに のったよ！'; medals.push('moonOrbit'); }
        else if (d.cls === 'toMoon') { icon = '🌙'; stars = 4; say = 'つきまで とどく きどうに のったよ！'; medals.push('orbit', 'toMoon'); }
        else if (d.cls === 'high') { icon = '🛰️'; stars = 4; say = 'たかい きどうを まわったよ！'; medals.push('orbit', 'high'); }
        else { icon = '🛰️'; stars = 3; say = 'ちきゅうを まわったよ！ じんこうえいせい だ！'; medals.push('orbit'); }
        // ワールドに のこす：衛星（軌道要素を しまう）
        SV.addObj({ kind: 'sat', body: d.body, cls: d.body === 'moon' ? 'moonOrbit' : d.cls, el: RL.World.pack(el), t: sim.t, abs: W0 + sim.t });
        say += ' えいせいは、これからも ずっと まわりつづけるよ。';
        info.push(`<span>▼${pe}</span>`, `<span class="h">▲${ap}</span>`); break; }
      case 'escape': icon = '🚀'; stars = 5; say = 'ちきゅうの じゅうりょくから だっしゅつ したよ！'; medals.push('escape'); info.push(`<span>🚀${Math.round(d.maxV)}</span>`); break;
      case 'hit': icon = '🌙'; stars = 5; say = 'つきに とうちゃく！ でも、ドーンと ぶつかっちゃった。 つきに はたを たてたよ。'; medals.push('moonFlag');
        SV.addObj({ kind: 'flag', ang: Math.atan2(sim.y, sim.x), abs: W0 + sim.t }); break;
      case 'heavy': icon = '🏋️'; say = 'おもくて あがらなかった！'; break;
      default: icon = '⏱️'; say = 'じかん ぎれ！';
    }
    SV.advanceClock(sim.t); SV.update(p => { p.flights = (p.flights || 0) + 1; });
    if (RL.World.counts(SV.cur).sats >= SC.FLEET) medals.push('fleet');
    if (d.type !== 'heavy') info.push(`<span>🚀${Math.round(d.maxV || 0)}</span>`);
    $('resIcon').textContent = icon; $('resStars').textContent = stars ? '⭐'.repeat(stars) : '💨';
    $('resInfo').innerHTML = [...new Set(info)].join('');
    if (stars >= 3) [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => A.tone(f, 0.25, 'triangle'), i * 120)); else A.tone(523, 0.3, 'triangle');
    A.say(say); $('result').style.display = 'flex';
    award(medals);
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
    // v0.9：きろくを しまう（れんしゅう中の きろくは しまわない）。勲章は れんしゅう中でも もらえる
    if (!RL.Tutorial.active) SV.update(p => { p.best = S.best; p.last = S.last; p.flights = (p.flights || 0) + 1; });
    if (s.lift) award([s.h >= RL.CFG.PHYS.ATMO_H && 'space', s.h >= 1800 && 'moonH', s.h >= 12000 && 'saturn'].filter(Boolean));
    RL.emit('result', s);
  }
  // 組み立てを しまう（れんしゅう中は しまわない）
  RL.on('change', d => { if (RL.Tutorial.active || !SV.cur) return; SV.update(p => { p.grid = clone(d.grid); }); });
  function closeResult() { $('result').style.display = 'none'; }
  RL.closeResult = closeResult;
  let tutRun = false;
  function showTitle() { RL.Tutorial.stop(); A.stop(); closeResult(); $('title').style.display = 'flex'; renderWho(); }
  function needWho() { if (SV.cur) return false; openPicker(true); return true; }
  function startFree() {
    // れんしゅうを さいごまで やったら 勲章
    if (tutRun && RL.Tutorial.step >= RL.Tutorial.STEPS.length) { tutRun = false; applyProfile(); award(['tut']); }
    else applyProfile();
    setMode('free'); document.body.classList.remove('tutorial'); $('title').style.display = 'none'; B.setAllowed(null); B.lockGrid(false); B.highlightCell(null); B.select('engine'); A.say('じゆうに ロケットを つくろう！');
  }
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
  $('btnFree').addEventListener('click', () => { if (!needWho()) startFree(); });
  $('btnOrbit').addEventListener('click', () => { if (!needWho()) startOrbit(); });
  $('btnTut').addEventListener('click', () => { if (needWho()) return; tutRun = true; setMode('free'); $('title').style.display = 'none'; document.body.classList.add('tutorial'); RL.Tutorial.start(); });
  // バージョン表示を3回タップ：見本のロケット（2段式）
  let vt = 0; $('ver').addEventListener('click', () => {
    if (++vt < 3) return; vt = 0;
    const R = RL.CFG.ROWS, g = Array.from({ length: R }, () => Array(RL.CFG.COLS).fill(null)), b = R - 1;
    ['engine', 'tank', 'tank', 'tank', 'ring', 'vengine', 'tank', 'nose'].forEach((k, i) => g[b - i][2] = k);
    for (let r = b; r >= b - 4; r--) { g[r][1] = 'booster'; g[r][3] = 'booster'; } g[b][0] = 'fin'; g[b][4] = 'fin';
    B.setGrid(g); RL.emit('change', { action: 'sample', grid: g });
  });
  B.init();
  // はじめ：セーブを よみこむ。こどもが いなければ えらぶ 画面
  setTimeout(() => { if (SV.cur) applyProfile(); renderWho(); if (!SV.cur) openPicker(true); }, 0);
})();
