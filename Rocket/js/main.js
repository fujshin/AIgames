// 画面のつなぎこみ（タイトル・じゆうモード・はっしゃ・けっか）
// v0.9：こどもごとの セーブ（えらぶ・つくる・けす）、勲章、ワールド（衛星・月の はた）
(function () {
  const $ = id => document.getElementById(id), A = RL.Audio, B = RL.Builder, SV = RL.Save, SC = RL.CFG.SAVE;
  const NAMES = ['じめん', 'くも', 'ひこうき', 'うちゅう', 'じんこうえいせい', 'つき', 'すいせい', 'どせい'];
  $('launch').innerHTML = RL.ICON.rocket; $('clear').innerHTML = RL.ICON.trash; $('home').innerHTML = RL.ICON.home;
  $('mute').innerHTML = RL.ICON.soundOn; $('again').innerHTML = RL.ICON.again; $('resRew').innerHTML = RL.ICON.rewind; $('scrUp').innerHTML = RL.ICON.up; $('scrDown').innerHTML = RL.ICON.down; $('btnChute').innerHTML = RL.ICON.chute; $('tutEar').innerHTML = RL.ICON.ear;
  $('btnTut').innerHTML = RL.ICON.learn; $('btnFree').innerHTML = RL.ICON.play; $('titleRocket').innerHTML = RL.ICON.rocket;
  $('btnOrbit').insertAdjacentHTML('afterbegin', RL.ICON.orbit); $('btnMap').innerHTML = RL.ICON.map; $('btnDone').innerHTML = RL.ICON.flag;
  $('cfYes').innerHTML = RL.ICON.ok; $('cfNo').innerHTML = RL.ICON.ng; $('pkClose').innerHTML = RL.ICON.ng; $('mdClose').innerHTML = RL.ICON.ng;
  // ---- モード：'free'（たかさ）／ 'orbit'（うちゅう） ----
  let mode = 'free', profile = 'side';
  const PROF = ['up', 'tilt', 'side'], PROF_ICON = { up: RL.ICON.profUp, tilt: RL.ICON.profTilt, side: RL.ICON.profSide };
  const PROF_SAY = { up: 'まっすぐ うえに', tilt: 'ななめに', side: 'よこに たおして' };
  function setProfile(p) { profile = PROF.includes(p) ? p : 'side'; $('prof').innerHTML = PROF_ICON[profile]; }
  setProfile('side');
  $('prof').addEventListener('click', () => { setProfile(PROF[(PROF.indexOf(profile) + 1) % 3]); SV.update(p => { p.profile = profile; }); A.tone(660, 0.08); A.say(PROF_SAY[profile] + ' とぶよ。'); if (RL.Missions.active) setTimeout(() => missionBuild(), 0); });
  // v0.12：モードごとに 行数と 組み立てを きりかえる（たかさ 9行＝p.grid／うちゅう 14行＝p.gridOrbit）
  function setMode(m) { mode = m; document.body.classList.toggle('orbitMode', m === 'orbit'); loadModeGrid(); }
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
  // v0.14.5：うちゅうモードの かぎ（ミッション 2-5）
  const ORBIT_KEY = '2-5';
  const orbitOpen = () => !!(SV.cur && SV.cur.missions && SV.cur.missions[ORBIT_KEY] >= 1);
  function renderOrbitLock() { $('btnOrbit').classList.toggle('locked', !!SV.cur && !orbitOpen()); }
  let misFlashT = 0;
  function flashMis() { const b = $('btnMis'); b.classList.add('mhint'); clearTimeout(misFlashT); misFlashT = setTimeout(() => b.classList.remove('mhint'), 5000); }
  // いまの こどもの きろくを 画面に もどす
  const rowsOf = m => (m === 'orbit' ? RL.CFG.ROWS_ORBIT : RL.CFG.ROWS_FREE);
  const gridKey = () => (mode === 'orbit' ? 'gridOrbit' : 'grid');
  const validGrid = (g, n) => Array.isArray(g) && g.length === n && g.every(r => Array.isArray(r) && r.length === RL.CFG.COLS);
  function loadModeGrid() {
    const n = rowsOf(mode), p = SV.cur, blank = () => Array.from({ length: n }, () => Array(RL.CFG.COLS).fill(null));
    let g = null;
    if (p && validGrid(p[gridKey()], n)) g = clone(p[gridKey()]);
    else if (p && mode === 'orbit' && Array.isArray(p.gridOrbit) && p.gridOrbit.length < n && validGrid(p.gridOrbit, p.gridOrbit.length)) g = [...blank().slice(0, n - p.gridOrbit.length), ...clone(p.gridOrbit)];   // v0.13：14行 → 18行（上に 足す）
    else if (p && mode === 'orbit' && validGrid(p.grid, RL.CFG.ROWS_FREE)) g = [...blank().slice(0, n - RL.CFG.ROWS_FREE), ...clone(p.grid)];   // 9行の 組み立てを 下に つめて つかう
    g = g ? RL.migrateLegs(g) : blank();   // 前の セーブの「胴体の よこの 脚」は エンジンへ
    B.setRows(n, g);
  }
  function applyProfile() {
    const p = SV.cur; if (!p) return;
    B.state.best = p.best || 0; B.state.last = p.last == null ? null : p.last; B.ladder();
    loadModeGrid();
    setProfile(p.profile || 'side');
    renderWho();
  }
  function renderWho() {
    const p = SV.cur;
    $('who').innerHTML = p ? `<span class="av">${p.avatar}</span>` : '<span class="av">👤</span><span class="plus">＋</span>';
    $('medBtn').innerHTML = `<span>🏅</span><b>${medalCount(p)}</b>`;
    $('medBtn').style.visibility = p ? 'visible' : 'hidden';
    $('badge').textContent = p ? p.avatar : '';
    renderOrbitLock();
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
    $('wCount').innerHTML = `<span>🛰️×${c.sats}</span><span>🚩×${c.flags}</span>` + (c.landers ? `<span>\u{1F680}×${c.landers}</span>` : '');
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
    const far = items.some(it => it.o.body === 'moon' || it.o.kind === 'flag' || it.o.kind === 'lander' || (it.o.el && it.o.el.ra > M.orbitR * 0.5));
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
        if (o.kind === 'lander') { g.font = '14px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';   // v0.11 着陸した ロケット
          g.fillText('\u{1F680}', X(ms.x) + Math.cos(o.ang) * (mR + 7), Y(ms.y) - Math.sin(o.ang) * (mR + 7)); return; }
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
    // v0.14 ミッション：きまった 打ち上げかたで ないと 発射しない
    if (MS.active && mode === 'orbit') { const ok = MS.onLaunch(B.grid, profile);
      if (ok !== true) { A.tone(150, 0.15, 'square', 0.08);
        if (ok.need) { A.say(ok.need === 'up' ? 'まずは、まっすぐ うえに うちあげて みよう。' : PROF_SAY[ok.need] + ' とぶ うちあげかたに しよう。 したの ひかっている ボタンだよ。'); MS.setHl('prof'); }
        else { A.say(ok.say.join(' ')); MS.setHl(ok.hl); } return; } }
    RL.emit('launch', s);
    if (mode === 'orbit') { lastA = a; lastProf = profile; RL.Flight2D.run(a, profile, sim => result2d(sim), aborted, null, MS.active && MS.active.start); return; }   // v0.14.6：とちゅうから の ミッション（3-4）は くみたての あとも とちゅうから
    RL.Flight.run(a, s, () => result(s), aborted);
  }
  // 中止：結果は出さず、組み立てたロケットのまま もどる（うちゅうモードは ワールドの 時計だけ すすむ）
  // v0.11 ⏪：結果画面から 最後に おぼえた ところへ もどって つづける（さっきの 結果で ふえた ものは もどす）
  let lastA = null, lastProf = 'side', lastRec = null;
  $('resRew').addEventListener('click', () => {
    const lr = RL.Flight2D.lastRun; if (!lr || !lr.cp || !lastA) return;
    if (lastRec) SV.update(p => { p.world.clock -= lastRec.clock; p.flights = Math.max(0, (p.flights || 1) - 1); if (lastRec.obj) p.world.objs.pop(); });
    lastRec = null; closeResult(); A.tone(660, 0.08);
    RL.Flight2D.run(lastA, lastProf, sim => result2d(sim), aborted, lr);
  });
  function aborted(sim) {
    // v0.14.3：⏪ で もどった あとの ちゅうしで クリア できる ミッション（1-4）
    if (MS.active && MS.active.abortClear && sim && (sim.rewinds || 0) >= 1) { MS.ctx.aborts++; sim.done = { type: 'mission', maxAlt: sim.maxAlt, t: sim.t, body: 'earth' }; result2d(sim); return; }
    if (MS.ctx) { MS.ctx.aborts++; MS.retry(); } if (sim && sim.t) SV.advanceClock(sim.t); A.say('ちゅうし！ つくりなおそう。'); RL.emit('abort'); }
  // ---- うちゅうモードの結果 ----
  function result2d(sim) {
    const d = sim.done, info = [], medals = [];
    let icon = '😅', stars = 0, say = '';
    const alt = Math.round(d.maxAlt || 0), W0 = sim.worldStart || 0; let objAdded = false;
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
        objAdded = true; SV.addObj({ kind: 'sat', body: d.body, cls: d.body === 'moon' ? 'moonOrbit' : d.cls, el: RL.World.pack(el), t: sim.t, abs: W0 + sim.t });
        say += ' えいせいは、これからも ずっと まわりつづけるよ。';
        info.push(`<span>▼${pe}</span>`, `<span class="h">▲${ap}</span>`); break; }
      case 'escape': icon = '🚀'; stars = 5; say = 'ちきゅうの じゅうりょくから だっしゅつ したよ！'; if (!d.forced) medals.push('escape'); info.push(`<span>🚀${Math.round(d.maxV)}</span>`); break;
      case 'landed': if (d.body === 'earth' && d.returned) {   // v0.13 月から かえってきた
        icon = '\u{1FAA8}'; stars = d.hard ? 4 : 5; say = 'おかえりなさい！ つきから ちきゅうに かえってきたよ！ つきの いしを もちかえった！';
        medals.push('moonRock', 'moonLand', d.chute ? 'chuteLand' : 'earthLand');
        info.push(`<span>\u2B07${(d.vDown || 0).toFixed(1)}</span>`, `<span class="h">${Math.round(d.maxG || 0)}G</span>`); break;
      } else if (d.body === 'earth') {   // v0.12 地球に 着陸
        icon = d.chute ? '\u{1FA82}' : '\u{1F3E0}'; stars = d.hard ? 4 : 5;
        say = d.chute ? 'パラシュートで ちきゅうに ちゃくりく！ ふんわり おりられたね！' : 'ちきゅうに ちゃくりく！ エンジンで ゆっくり おりられたね！';
        if (d.hard) say = 'ちきゅうに ちゃくりく！ ちょっと あぶなかったけど、やったね！';
        medals.push(d.chute ? 'chuteLand' : 'earthLand'); if (d.soft) medals.push('softLeg');
        info.push(`<span>\u2B07${(d.vDown || 0).toFixed(1)}</span>`, `<span class="h">\u{1F3E0}\u27A1${Math.round(d.range || 0)}</span>`); break;
      } else {   // v0.11 月着陸
        icon = '\u{1F9D1}\u200D\u{1F680}'; stars = d.hard ? 4 : 5;
        say = d.hard ? 'つきに ちゃくりく！ ちょっと あぶなかったけど、やったね！' : 'つきに ちゃくりく！ やったね！ うちゅうひこうしが つきに たったよ！';
        medals.push('moonLand'); if (d.soft) { medals.push('softLeg'); say += ' あしで ふんわり おりられたね。'; }
        SV.addObj({ kind: 'lander', ang: d.ang, abs: W0 + sim.t }); objAdded = true;
        info.push(`<span>\u2B07${(d.vDown || 0).toFixed(1)}</span>`); break; }
      case 'hit': icon = '🌙'; stars = 5; say = 'つきに とうちゃく！ でも、ドーンと ぶつかっちゃった。 つきに はたを たてたよ。'; medals.push('moonFlag');
        if (d.vDown != null) { say += ' はやさ ' + Math.round(d.vDown) + '。' + (d.vDown < 40 ? 'もうすこし ゆっくり おりれば ちゃくりく できるよ！' : 'つきの ちかくで うしろむきに エンジンを つかうと、ゆっくり おりられるよ。'); }
        SV.addObj({ kind: 'flag', ang: Math.atan2(sim.y, sim.x), abs: W0 + sim.t }); objAdded = true; break;
      case 'heavy': icon = '🏋️'; say = 'おもくて あがらなかった！'; break;
      case 'mission': icon = '\u{1F389}'; stars = 3; break;   // v0.14：とちゅうで ミッション クリア
      default: icon = '⏱️'; say = 'じかん ぎれ！';
    }
    // v0.13：月面に のこした もの（✂️ した 段＝着陸機、🚩）。月面で おわった ときの 着陸機は 上で のこしている
    if (sim.surfAng != null && !(d.type === 'landed' && d.body === 'moon')) {
      if (sim.leftStages && sim.leftStages.length) { SV.addObj({ kind: 'lander', ang: sim.surfAng, abs: W0 + sim.t }); objAdded = true; } }
    if (sim.flagPlanted) { SV.addObj({ kind: 'flag', ang: sim.surfAng, abs: W0 + sim.t }); objAdded = true; medals.push('moonFlag'); }
    SV.advanceClock(sim.t); SV.update(p => { p.flights = (p.flights || 0) + 1; });
    lastRec = { clock: sim.t, obj: objAdded };
    // v0.11 ⏪ の 回数で 星を へらす（さいてい 1）。⏪ は 落ちた・ぶつかった・にげた・時間ぎれ のとき
    const rw = sim.rewinds || 0, pen = RL.CFG.ORBIT.CHECKPOINT.STAR_PENALTY;
    if (stars && rw) stars = Math.max(1, stars - pen[Math.min(rw, pen.length - 1)]);
    const lr = RL.Flight2D.lastRun, canRew = !!(lr && lr.cp) && ['ground', 'hit', 'escape', 'timeout'].includes(d.type);
    $('resRew').style.display = canRew ? 'flex' : 'none';
    if (canRew) say += ' ⏪ を おすと、さっきの ところから やりなおせるよ。';
    if (RL.World.counts(SV.cur).sats >= SC.FLEET) medals.push('fleet');
    if (d.type !== 'heavy') info.push(`<span>🚀${Math.round(d.maxV || 0)}</span>`);
    $('resIcon').textContent = icon; $('resStars').textContent = stars ? '⭐'.repeat(stars) : '💨';
    $('resInfo').innerHTML = [...new Set(info)].join('');
    if (stars >= 3) [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => A.tone(f, 0.25, 'triangle'), i * 120)); else A.tone(523, 0.3, 'triangle');
    // v0.14 ミッションの けっか（ほしは ミッションの ⭐）
    $('resMap').style.display = MS.active ? 'flex' : 'none'; $('resNext').style.display = 'none'; nextMis = null;
    const expFail = MS.active ? MS.poll('result', { d, sim }) : null;   // v0.14.1：わざと しっぱい（あんないの とおり）
    if (expFail) {
      $('resStars').textContent = '\u{1F4A1}'; say = expFail.say.join(' ');
      if (!expFail.rew) $('resRew').style.display = 'none';
    } else if (MS.active) {
      const m = MS.active, j = MS.judge(sim, d);
      if (j.clear) {
        $('resIcon').textContent = '\u{1F389}'; $('resStars').textContent = '⭐'.repeat(j.stars) + '☆'.repeat(3 - j.stars);
        say = 'ミッション クリア！' + (j.stars < 3 ? (j.stars < 2 && !m.rewOk ? ' くるくる もどる ボタンを つかわないと、ほしが ふえるよ。' : m.help ? ' ' + m.help : '') : ' ほし みっつ！ すごい！');
        const wasOpen = orbitOpen();
        let rec = null; SV.update(p => { p.missions = p.missions || {}; p.missions[m.id] = Math.max(p.missions[m.id] || 0, j.stars); rec = p.missions; });
        if (!wasOpen && orbitOpen()) say += ' うちゅうモードが ひらいたよ！ タイトルの ちきゅうの ボタンで、じゆうに あそべるよ。';
        const ch = MS.CHAPTERS.find(c => c.ch === m.ch); if (ch && rec && MS.chapterDone(rec, m.ch)) medals.push(ch.medal);
        $('resRew').style.display = 'none'; MS.setHl(null);
        // v0.14.2：つぎの ミッションへ（クリアで ひらいた もの）
        const i = MS.LIST.indexOf(m); nextMis = MS.LIST[i + 1] || null;
        if (nextMis) { $('resNext').style.display = 'flex'; MS.setHl('resNext'); say += ' つぎの ミッションに すすもう！'; }
      } else {
        $('resStars').textContent = '\u{1F4A8}';
        say = (d.type === 'mission' ? '' : say + ' ') + 'もういちど ちょうせん しよう！' + (MS.ctx.fails >= 3 && m.help ? ' ヒント：' + m.help : '');
        MS.retry(); MS.setHl('again');
      }
    }
    A.say(say); $('result').style.display = 'flex';
    award(medals);
    RL.emit('result2d', sim);
  }
  function result(s) {
    $('resRew').style.display = 'none';
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
  RL.on('change', d => { if (RL.Tutorial.active || !SV.cur || MS.active) return; const k = gridKey(); SV.update(p => { p[k] = clone(d.grid); }); });
  function closeResult() { $('result').style.display = 'none'; }
  RL.closeResult = closeResult;
  let tutRun = false;
  function showTitle() { endMission(); RL.Tutorial.stop(); A.stop(); closeResult(); $('title').style.display = 'flex'; renderWho(); }
  function needWho() { if (SV.cur) return false; openPicker(true); return true; }
  function startFree() {
    // れんしゅうを さいごまで やったら 勲章
    if (tutRun && RL.Tutorial.step >= RL.Tutorial.STEPS.length) { tutRun = false; applyProfile(); award(['tut']); }
    else applyProfile();
    setMode('free'); document.body.classList.remove('tutorial'); $('title').style.display = 'none'; B.setAllowed(null); B.lockGrid(false); B.highlightCell(null); B.select('engine'); A.say('じゆうに ロケットを つくろう！');
  }
  RL.startFree = startFree;
  function startOrbit() { startFree(); setMode('orbit'); A.say('うちゅうモード！ つきに ちゃくりく して、ちきゅうに かえって こられるかな？'); }
  $('launch').addEventListener('click', launch);
  $('clear').addEventListener('click', () => {
    if (RL.Tutorial.active) { if (!RL.Tutorial.canClear) { A.tone(150, 0.15, 'square', 0.08); return; } B.clear(); return; }
    if (MS.active && (MS.active.lock || MS.active.start)) { A.tone(150, 0.15, 'square', 0.08); return; }   // v0.14：きまった ロケットの ミッション
    if (!B.grid.some(row => row.some(Boolean))) { A.tone(200, 0.1, 'square', 0.08); return; }
    confirmBox(RL.ICON.trash + '<span>🚀❓</span>', 'ぜんぶ けしても いい？', () => B.clear());   // まちがえて けさないように
  });
  $('home').addEventListener('click', showTitle);
  $('mute').addEventListener('click', () => { $('mute').innerHTML = A.toggle() ? RL.ICON.soundOff : RL.ICON.soundOn; });
  $('again').addEventListener('click', () => { if (RL.Tutorial.active) return; closeResult(); A.tone(660, 0.08);
    // v0.14.6：つぎの あんないが くみたて なら くみたて画面（3-4 で 脚を つける）、そうでなければ とちゅうから の ミッションは すぐ もういちど
    const nx = MS.active && MS.active.steps[MS.ctx.si];
    if (MS.active && MS.active.start && !(nx && nx.at === 'build')) missionFly(MS.active); else if (MS.active) { MS.retryBuild && MS.retryBuild(); missionBuild(true); } });   // v0.14：とちゅうから の ミッションは すぐ もういちど
  $('resMap').addEventListener('click', () => { closeResult(); A.tone(660, 0.08); openMissionMap(); });
  let nextMis = null;
  $('resNext').addEventListener('click', () => { const m = nextMis; if (!m) return; nextMis = null; A.tone(784, 0.1); startMission(m); });
  $('btnFree').addEventListener('click', () => { if (!needWho()) startFree(); });
  // v0.14.5：うちゅうモードは ミッション 2-5 を クリア（⭐1 いじょう）すると ひらく
  $('btnOrbit').addEventListener('click', () => {
    if (needWho()) return;
    if (!orbitOpen()) { A.tone(150, 0.15, 'square', 0.08); A.say('さきに ミッションを クリア しよう！ ひかっている ちずの ボタンだよ。', null, { interrupt: true }); flashMis(); return; }
    startOrbit(); });
  // =====================================================================
  // v0.14 ミッション
  // =====================================================================
  const MS = RL.Missions;
    // v0.14.6：ミッションの 絵（img/mis/1-1.webp など。Microsoft Copilot で 生成）。よめない ときは 絵文字
    const misImg = m => `<img class="misImg" src="img/mis/${m.id}.webp" alt="" draggable="false" onerror="this.replaceWith(document.createTextNode('${m.icon.join('')}'))">`;
  function flash(el, ms) { if (!el) return; el.classList.add('mhint'); setTimeout(() => el.classList.remove('mhint'), ms || 4000); }
  // 飛行中の ボタンを おした 回数（ミッションの はんてい用）
  $('fly').addEventListener('click', e => { const b = e.target.closest('button'); if (b && MS.active) { MS.ui(b.id); RL.Flight2D.unpause(b.id); } }, true);
  function endMission() { if (!MS.active) return; MS.end(); document.body.classList.remove('mission'); B.lockGrid(false); B.setAllowed(null); }
  function openMissionMap() {
    const p = SV.cur; if (!p) return; const rec = p.missions || {}, box = $('misRows'); box.innerHTML = '';
    let nextSet = false;
    MS.CHAPTERS.forEach(ch => {
      const row = document.createElement('div'); row.className = 'misRow';
      row.innerHTML = `<div class="misCh${MS.chapterDone(rec, ch.ch) ? ' done' : ''}">${ch.icon}</div>`;
      MS.LIST.filter(m => m.ch === ch.ch).forEach(m => {
        const st = rec[m.id] || 0, open = MS.unlocked(rec, m.id), b = document.createElement('button'); b.type = 'button';
        b.className = 'misCard' + (open ? '' : ' lock') + (open && !st && !nextSet ? ' next' : ''); if (open && !st) nextSet = true;
        b.setAttribute('aria-label', 'ミッション ' + m.id);
        b.innerHTML = `<span class="ic">${open ? misImg(m) : '\u{1F512}'}</span><span class="st">${st ? '⭐'.repeat(st) : ''}</span>`;
        b.addEventListener('click', () => { if (!open) { A.tone(150, 0.15, 'square', 0.08); A.say('まえの ミッションを クリア すると ひらくよ。'); return; } startMission(m); });
        row.appendChild(b);
      });
      box.appendChild(row);
    });
    $('misMap').style.display = 'flex'; A.say('ミッションを えらんでね。');
  }
  $('misClose').addEventListener('click', () => { $('misMap').style.display = 'none'; A.tone(300, 0.08); });
  $('btnMis').addEventListener('click', () => { if (!needWho()) openMissionMap(); });
  function startMission(m) {
    $('misMap').style.display = 'none'; closeResult(); RL.Tutorial.stop();
    endMission(); startFree(); setMode('orbit');
    const c = MS.begin(m); document.body.classList.add('mission'); $('misBadge').innerHTML = '\u{1F50A} ' + m.id + ' ' + misImg(m);
    if (m.rocket || m.preset) B.setGrid(MS.gridOf(m));
    if ((m.lock || m.start) && !m.startBuild) { B.setAllowed([]); B.lockGrid(true); } else B.setAllowed(m.allow || null);   // v0.14.6 startBuild：あとで くみたて できる
    if (m.profile) setProfile(m.profile);
    c.tanks0 = MS.countTanks(B.grid);
    A.stop();
    // v0.14.1：はじめに ミッションの めあて（大きな 絵）。タップで とじる
    $('mgIcon').innerHTML = misImg(m); $('misGoal').style.display = 'flex'; A.tone(523, 0.12); setTimeout(() => A.tone(784, 0.18), 120);
    goalNext = () => { if (m.start) missionFly(m); else missionBuild(); };
    A.say('ミッション ' + m.id.replace('-', 'の ') + '。', null, { interrupt: true });
    clearTimeout(goalT); goalT = setTimeout(closeGoal, 2200);
  }
  let goalNext = null, goalT = 0;
  function closeGoal() { clearTimeout(goalT); if ($('misGoal').style.display !== 'flex') return; $('misGoal').style.display = 'none'; const f = goalNext; goalNext = null; f && f(); }
  $('misGoal').addEventListener('click', closeGoal);
  // くみたての 画面の あんない（すすんだら 声）。again＝もういちど（いまの あんないを もういちど いう）
  function missionBuild(again) {
    if (!MS.active) return;
    const got = MS.pollAll('build', MS.buildInfo(B.grid, profile));
    if (got.length) A.say(got.map(x => x.say.join(' ')).join(' '), null, { interrupt: true });
    else if (again && MS.current() && MS.current().at === 'build') { A.say(MS.current().say.join(' '), null, { interrupt: true }); MS.setHl(MS.current().hl); }
  }
  RL.on('change', () => { if (MS.active) missionBuild(); });
  // バッジを おすと いまの あんないを もういちど
  $('misBadge').addEventListener('click', () => { const c = MS.current(); if (c) { A.say(c.say.join(' '), null, { interrupt: true }); MS.setHl(c.hl); } });
  function missionFly(m) {
    const g = B.grid, a = RL.analyze(g); MS.onLaunch(g, 'side'); lastA = a; lastProf = 'side';
    RL.Flight2D.run(a, 'side', sim => result2d(sim), aborted, null, m.start);
  }
  $('btnTut').addEventListener('click', () => { if (needWho()) return; tutRun = true; setMode('free'); $('title').style.display = 'none'; document.body.classList.add('tutorial'); RL.Tutorial.start(); });
  // バージョン表示を3回タップ：見本のロケット（2段式）
  let vt = 0; $('ver').addEventListener('click', () => {
    if (++vt < 3) return; vt = 0;
    const R = RL.CFG.ROWS, g = Array.from({ length: R }, () => Array(RL.CFG.COLS).fill(null)), b = R - 1;
    // v0.12：月に 着陸 できる 見本（2段＋ブースター＋着陸脚。tools/landing_check.js で 確かめた）。うちゅうモード（14行）は 大きく、まどと パラシュートつき
    const big = R >= 14, core = big ? ['engine', 'tank', 'tank', 'tank', 'tank', 'ring', 'vengine+leg', 'tank', 'tank', 'tank', 'win+chute', 'nose'] : ['engine', 'tank', 'tank', 'tank', 'ring', 'vengine+leg', 'tank', 'tank', 'nose'];
    core.forEach((k, i) => g[b - i][2] = k);
    for (let r = b; r >= b - (big ? 5 : 4); r--) { g[r][1] = 'booster'; g[r][3] = 'booster'; } g[b][0] = 'fin'; g[b][4] = 'fin';
    // v0.13：うちゅうモード（18行）は 月往還 できる 見本（3段3列。tools/return_check.js で 確かめた）
    if (R >= 18) { g.forEach(r => r.fill(null)); const T = n => Array(n).fill('tank'), side = ['engine', ...T(4), 'ring', 'vengine', ...T(2)];
      [['booster', 'booster', 'booster', 'booster', 'fin'], side, ['engine', ...T(4), 'ring', 'vengine', ...T(2), 'ring', 'vengine+leg', ...T(3), 'win+chute'], side, ['booster', 'booster', 'booster', 'booster', 'fin']]
        .forEach((col, c) => col.forEach((k, i) => { g[b - i][c] = k; })); }
    B.setGrid(g); RL.emit('change', { action: 'sample', grid: g });
  });
  B.init();
  // はじめ：セーブを よみこむ。こどもが いなければ えらぶ 画面
  setTimeout(() => { if (SV.cur) applyProfile(); renderWho(); if (!SV.cur) openPicker(true); }, 0);
})();
