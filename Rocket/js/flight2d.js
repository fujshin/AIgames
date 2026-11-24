// うちゅうモードの 飛行画面
//  - ちかく（打ち上げ）：空・地面・雲。ロケットは SVG部品を そのまま かたむけて動かす。左上に 小さな地図
//  - 地図（くうきの外）：地球を まんなかに、月・とんできた あと・予測の線（地面に ぶつかる＝オレンジ、まわる＝みどり、にげる＝むらさき）
//  - 早送りは 自動（燃えている間は 実時間）
//  - ボタン：エンジン とめる／つける（液体だけ）、地図／ちかく、おわる（安定した軌道のとき）、中止（長おし）
RL.Flight2D = (function () {
  const $ = id => document.getElementById(id), SP = RL.Space, TAU = Math.PI * 2;
  const STAGE_NAME = ['だいいち', 'だいに', 'だいさん', 'だいよん', 'だいご'], IGN_NAME = ['', 'にだんめ', 'さんだんめ', 'よんだんめ', 'ごだんめ'];
  const COL = { hit: '#ff9a3d', orbit: '#5aff7a', escape: '#d58bff' };
  const ORBIT_CLS = ['low', 'high', 'toMoon', 'moonOrbit'];
  let raf = null, cur = null;
  const earthImg = new Image(); earthImg.src = 'img/earth.webp';

  // 予測の線の 色と、上に出す しるし（いまの まま とぶと どうなるか）
  const SEG_COL = { hit: '#ff9a3d', orbit: '#5aff7a', escape: '#d58bff', moonPass: '#7fd3ff', moonOrbit: '#5aff7a', moonHit: '#ff9a3d' };
  const BADGE = { hit: '💥', orbit: '🛰️', escape: '🚀', moonPass: '🌙➡️', moonOrbit: '🌙🛰️', moonHit: '🌙💥' };
  const FATE_ICON = { escape: '🚀', orbit: '🔄', hit: '💥' };
  const predict = sim => RL.Predict.fromSim(sim);

  // ---- 月の絵（キャンバスで） ----
  function drawMoon(g, x, y, r) {
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    gr.addColorStop(0, '#f2f2ee'); gr.addColorStop(1, '#9a9a96');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    if (r > 6) { g.fillStyle = 'rgba(90,90,100,.35)';
      [[-.3, -.2, .22], [.35, .1, .18], [-.05, .45, .14], [.2, -.45, .1], [-.5, .25, .09]].forEach(([a, b2, c]) => { g.beginPath(); g.arc(x + a * r, y + b2 * r, c * r, 0, TAU); g.fill(); }); }
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
  }
  function drawEarth(g, x, y, r, rot, atmoR) {
    g.fillStyle = 'rgba(120,200,255,.28)'; g.beginPath(); g.arc(x, y, Math.max(atmoR, r + 2.5), 0, TAU); g.fill();
    if (earthImg.complete && earthImg.naturalWidth) { g.save(); g.translate(x, y); g.rotate(-rot); g.drawImage(earthImg, -r, -r, r * 2, r * 2); g.restore(); }
    else { g.fillStyle = '#2f7bd9'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  }
  function drawShip(g, x, y, ang, burning, u) {
    g.save(); g.translate(x, y); g.rotate(ang); g.scale(u, u);
    if (burning) { g.fillStyle = '#ffb02e'; g.beginPath(); g.moveTo(-9, -4); g.lineTo(-20 - Math.random() * 6, 0); g.lineTo(-9, 4); g.fill(); }
    g.fillStyle = '#fff'; g.strokeStyle = '#2b3245'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(12, 0); g.lineTo(-9, -6); g.lineTo(-9, 6); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#e5383b'; g.beginPath(); g.moveTo(12, 0); g.lineTo(4, -3.3); g.lineTo(4, 3.3); g.closePath(); g.fill();
    g.restore();
  }

  // ---- 地図を描く（全画面 または 小窓） ----
  function drawMap(g, V, sim, pr, trail, box, small) {
    const W = sim.bodies, E = W.earth, M = W.moon, ms = SP.bodyState(M, sim.t);
    const { x0, y0, w, h } = box, cx = x0 + w / 2, cy = y0 + h / 2, sc = Math.min(w, h) / 2 / V.r;
    const X = x => cx + (x - V.cx) * sc, Y = y => cy - (y - V.cy) * sc;
    g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
    g.fillStyle = small ? 'rgba(0,0,25,.82)' : '#02030f'; g.fillRect(x0, y0, w, h);
    if (!small) { g.fillStyle = 'rgba(255,255,255,.7)'; V.stars.forEach(s => g.fillRect(x0 + s.x * w, y0 + s.y * h, s.r, s.r)); }
    // 月の通り道・月・月の重力圏
    g.setLineDash([4, 6]); g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1;
    g.beginPath(); g.arc(X(0), Y(0), M.orbitR * sc, 0, TAU); g.stroke();
    if (sim.body === M || V.r > M.orbitR * 0.3) { g.strokeStyle = 'rgba(200,200,255,.25)'; g.beginPath(); g.arc(X(ms.x), Y(ms.y), M.soi * sc, 0, TAU); g.stroke(); }
    g.setLineDash([]);
    drawMoon(g, X(ms.x), Y(ms.y), Math.max(small ? 3 : 5, M.R * sc));
    drawEarth(g, X(0), Y(0), Math.max(small ? 4 : 7, E.R * sc), E.rot * sim.t, (E.R + E.atmo) * sc);
    // 発射場
    if (E.R * sc > 25) { const ph = RL.CFG.ORBIT.SITE + E.rot * sim.t; g.font = `${small ? 12 : 18}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('🏠', X(Math.cos(ph) * E.R * 1.03), Y(Math.sin(ph) * E.R * 1.03)); }
    // とんできた あと
    if (trail.length > 1) { g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = small ? 1 : 1.5; g.beginPath();
      trail.forEach((p, i) => i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))); g.stroke(); }
    // 予測の線（月と であうなら、であう ときの 月＝うすい月 と その まわりの線も）
    if (pr) {
      const u = V.u, emo = (t, x, y, sz) => { g.font = `${sz}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, x, y); };
      if (pr.enc) {
        g.globalAlpha = 0.45; drawMoon(g, X(pr.enc.x), Y(pr.enc.y), Math.max(small ? 3 : 5, M.R * sc)); g.globalAlpha = 1;
        g.setLineDash([3, 5]); g.strokeStyle = 'rgba(127,211,255,.5)'; g.lineWidth = 1; g.beginPath(); g.arc(X(pr.enc.x), Y(pr.enc.y), M.soi * sc, 0, TAU); g.stroke(); g.setLineDash([]);
      }
      pr.segs.forEach(sg => {
        if (sg.pts.length < 2) return;
        g.strokeStyle = SEG_COL[sg.kind] || '#fff'; g.lineWidth = small ? 2 : 3; g.setLineDash(small ? [] : sg.moon ? [4, 5] : [10, 7]); g.beginPath();
        sg.pts.forEach((p, i) => i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))); g.stroke(); g.setLineDash([]);
        const e = sg.pts[sg.pts.length - 1];
        if (sg.kind === 'hit' || sg.kind === 'moonHit') emo('💥', X(e[0]), Y(e[1]), small ? 12 : 20);
      });
      // 月の そばを 通りぬけた あと どうなるか（にげる／もどる／おちる）
      const fate = pr.enc ? pr.enc.fate : pr.fate, fs = pr.segs[pr.segs.length - 1];
      if (fate && !small && fs.pts.length) { const e = fs.pts[fs.pts.length - 1]; emo(FATE_ICON[fate.kind], X(e[0]), Y(e[1]), 22 * u); }
      if (!small) {
        const dot = (x, y, c, label) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, 5 * u, 0, TAU); g.fill();
          g.font = `bold ${16 * u}px "Courier New",monospace`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(label, x + 8 * u, y); };
        // 近点・遠点（いちばん ひくい／たかい ところ）の 高さ：まわる 軌道のとき
        const el = pr.el, b = sim.body;
        if (el.e < 1 && (pr.kind === 'orbit' || pr.kind === 'moonOrbit') && !pr.enc) {
          [[1, el.rp, '#5aff7a', '▼'], [-1, el.ra, '#ffd54a', '▲']].forEach(([d, rr, c, m]) =>
            dot(X(pr.off.x + Math.cos(el.w) * rr * d), Y(pr.off.y + Math.sin(el.w) * rr * d), c, m + Math.round(rr - b.R)));
        }
        // 月に いちばん ちかづく ところ
        if (pr.enc && pr.kind !== 'moonHit') {
          const ms = pr.segs[pr.segs.length - 1].pts; let best = null, bd = Infinity;
          ms.forEach(p => { const d = Math.hypot(p[0] - pr.enc.x, p[1] - pr.enc.y); if (d < bd) { bd = d; best = p; } });
          if (best) dot(X(best[0]), Y(best[1]), '#7fd3ff', '▼' + Math.max(0, Math.round(bd - M.R)));
        }
      }
    }
    // ロケット
    const off = sim.body === M ? ms : { x: 0, y: 0 }, px = X(sim.x + off.x), py = Y(sim.y + off.y);
    const r = Math.hypot(sim.x, sim.y), ux = sim.x / r, uy = sim.y / r;
    let dx, dy;
    if (sim.isPowered() || !sim.lifted) { dx = Math.cos(sim.point) * -uy + Math.sin(sim.point) * ux; dy = Math.cos(sim.point) * ux + Math.sin(sim.point) * uy; }
    else { dx = sim.vx; dy = sim.vy; }
    drawShip(g, px, py, -Math.atan2(dy, dx), sim.isPowered() && sim.lifted, small ? 0.7 : V.u * 1.2);
    g.restore();
    if (small) { g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; g.strokeRect(x0, y0, w, h); }
  }

  // ---- 速さメーター：第1・第2宇宙速度の しるし つき ----
  function drawSpeed(g, W, H, sim, u) {
    const r = Math.hypot(sim.x, sim.y), mu = sim.body.mu, vc = Math.sqrt(mu / r), ve = vc * Math.SQRT2, v = Math.hypot(sim.vx, sim.vy);
    const bw = Math.min(W * 0.62, 520 * u), bh = 22 * u, bx = W / 2 - bw / 2, by = H - 64 * u, MAX = vc * 1.7, X = s => bx + bw * Math.min(1, s / MAX);
    g.save();
    g.fillStyle = 'rgba(0,0,20,.6)'; g.fillRect(bx - 12 * u, by - 40 * u, bw + 24 * u, bh + 74 * u);
    const gr = g.createLinearGradient(bx, 0, bx + bw, 0);
    gr.addColorStop(0, '#ff9a3d'); gr.addColorStop(0.58, '#ffd54a'); gr.addColorStop(0.6, '#5aff7a'); gr.addColorStop(0.82, '#5aff7a'); gr.addColorStop(0.84, '#d58bff'); gr.addColorStop(1, '#d58bff');
    g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(bx, by, bw, bh);
    g.fillStyle = gr; g.fillRect(bx, by, X(v) - bx, bh);
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(bx, by, bw, bh);
    g.textAlign = 'center'; g.textBaseline = 'bottom'; g.font = `${22 * u}px sans-serif`;
    [[vc, '🛰️', '1'], [ve, '🚀', '2']].forEach(([s, ic, n]) => {
      const x = X(s); g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, by - 4 * u); g.lineTo(x, by + bh + 4 * u); g.stroke();
      g.fillStyle = '#fff'; g.fillText(ic, x, by - 6 * u);
      g.font = `bold ${14 * u}px sans-serif`; g.fillStyle = '#ffd54a'; g.fillText(n, x + 14 * u, by - 22 * u); g.font = `${22 * u}px sans-serif`;
    });
    g.font = `bold ${24 * u}px "Courier New",monospace`; g.textBaseline = 'top'; g.fillStyle = '#5aff7a';
    g.fillText('🚀' + String(Math.round(v)).padStart(4, '0'), W / 2, by + bh + 6 * u);
    g.restore();
  }
  function drawFuel(g, H, sim, u) {
    const f = sim.fuelRatio(), gx = 14 * u, gw = 30 * u, gh = 130 * u, gy = H * 0.42;
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(gx, gy, gw, gh);
    g.fillStyle = f > 0.25 ? '#e5383b' : '#ffb02e'; g.fillRect(gx, gy + gh * (1 - f), gw, gh * f);
    g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(gx, gy, gw, gh);
    g.font = `${24 * u}px sans-serif`; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText('⛽', gx + gw / 2, gy - 8);
  }
  function drawTop(g, W, sim, warp, u) {
    const h = Math.hypot(sim.x, sim.y) - sim.body.R, bx = W - 16 * u;
    g.save(); g.textAlign = 'right'; g.textBaseline = 'top';
    g.fillStyle = 'rgba(0,0,20,.55)'; g.fillRect(bx - 200 * u, 10, 200 * u, (warp > 1.5 ? 100 : 70) * u);
    g.font = `bold ${28 * u}px "Courier New",monospace`; g.fillStyle = '#fff';
    g.fillText((sim.body.id === 'moon' ? '🌙' : '⬆') + String(Math.max(0, Math.round(h))).padStart(6, '0'), bx - 8 * u, 16 * u);
    g.fillStyle = '#9fd8ff'; g.font = `bold ${22 * u}px "Courier New",monospace`;
    const t = sim.t, mm = Math.floor(t / 60), ss = Math.floor(t % 60);
    g.fillText('⏱' + mm + ':' + String(ss).padStart(2, '0'), bx - 8 * u, 50 * u);
    if (warp > 1.5) { g.fillStyle = '#ffd54a'; g.fillText('⏩×' + Math.round(warp), bx - 8 * u, 78 * u); }
    g.restore();
  }

  // ---- いまの まま とぶと どうなるか の しるし（上の まんなか） ----
  function drawBadge(g, W, pr, u, big) {
    const t = BADGE[pr.kind]; if (!t) return;
    const x = W / 2, y = (big ? 40 : 46) * u + 30, w = (t.length > 2 ? 120 : 84) * u, h = 56 * u;
    g.save(); g.fillStyle = 'rgba(0,0,20,.7)'; g.strokeStyle = SEG_COL[pr.kind]; g.lineWidth = 4;
    g.beginPath(); g.roundRect ? g.roundRect(x - w / 2, y - h / 2, w, h, h / 2) : g.rect(x - w / 2, y - h / 2, w, h); g.fill(); g.stroke();
    g.font = `${34 * u}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(t, x, y + 2);
    g.restore();
  }
  // ---- 中止ボタン（長おし） ----
  function holdButton(el, ms, fn) {
    let t0 = null, rq = null; const ring = el.querySelector('.ring');
    const paint = p => { ring.style.background = p > 0 ? `conic-gradient(#ffd54a ${p * 360}deg, rgba(255,255,255,.15) 0)` : ''; };
    const tick = () => { const p = (performance.now() - t0) / ms; if (p >= 1) { stop(); RL.Audio.tone(200, 0.2, 'square', 0.1); fn(); return; } paint(p); rq = requestAnimationFrame(tick); };
    const start = e => { e.preventDefault(); if (t0 !== null) return; t0 = performance.now(); RL.Audio.tone(330, 0.06); tick(); };
    function stop() { t0 = null; cancelAnimationFrame(rq); paint(0); }
    el.addEventListener('pointerdown', start); ['pointerup', 'pointerleave', 'pointercancel'].forEach(n => el.addEventListener(n, stop));
  }
  let abortCb = null;
  $('btnAbort').insertAdjacentHTML('beforeend', RL.ICON.hand);
  holdButton($('btnAbort'), 900, () => { if (abortCb) abortCb(); else RL.Flight.abort(); });

  function run(a, profile, onDone, onAbort) {
    const fly = $('fly'), cv = $('cv'), g = cv.getContext('2d'), A = RL.Audio, dpr = devicePixelRatio || 1;
    fly.style.display = 'block'; fly.classList.add('orbit'); document.body.classList.add('flying');
    const W = innerWidth, H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const u = Math.max(0.5, Math.min(1, Math.min(W, H * 0.75) / 700));
    $('count').style.fontSize = (130 * u) + 'px';
    const sim = RL.Orbit.create(a, { profile }), O = RL.CFG.ORBIT, E = sim.bodies.earth;
    const cs = Math.min(36, W / 12, H / 20), rocket = RL.Flight.buildRocket(a, cs), RW = RL.CFG.COLS * cs;
    rocket.style.display = 'block';
    let lowest = 0; a.cells.forEach(q => { if (!q.ctx.loose) lowest = Math.max(lowest, q.r + 1); });
    const px = H / 180, L = 150, Yh = hh => px * L * Math.log(1 + Math.max(0, hh) / L);
    const ground = H * 0.82, startY = ground - 10 - lowest * cs, room = startY - H * 0.3;
    const stars = Array.from({ length: 140 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.8 + 0.3 }));
    const clouds = Array.from({ length: 14 }, (_, i) => ({ h: 25 + Math.random() * 160, x: Math.random() * 1.6, s: 0.6 + Math.random() * 0.8 }));
    const V = { r: E.R * 1.6, cx: 0, cy: 0, u, stars: Array.from({ length: 160 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.6 + 0.6 })) };
    const trail = []; const smoke = [];
    const sepReal = {}, stageReal = {};
    let prCache = null, prAt = 0, prKind = null, saidEnc = false;
    let t0 = null, prev = null, warp = 1, view = 'auto', sepFlash = 0, saidSep = false, ended = null, endAt = 0, saidOrbit = false;
    const pre = 2100;
    // ボタン
    const bEng = $('btnEng'), bMap = $('btnMap'), bDone = $('btnDone');
    let engShown = null;
    const engUI = () => { const ok = sim.liquidLeft() && !sim.done; bEng.classList.toggle('off', !ok); if (engShown !== sim.engineOn) { engShown = sim.engineOn; bEng.innerHTML = sim.engineOn ? RL.ICON.engStop : RL.ICON.engGo; } bEng.classList.toggle('on', sim.engineOn); };
    bEng.onclick = () => { RL._engClick = (RL._engClick || 0) + 1; if (!sim.lifted || !sim.liquidLeft() || sim.done) { A.tone(150, 0.15, 'square', 0.08); return; } sim.setEngine(!sim.engineOn); engUI(); };
    bMap.onclick = () => { view = (view === 'map' || (view === 'auto' && autoMap())) ? 'near' : 'map'; A.tone(660, 0.06); };
    bDone.onclick = () => { sim.finishNow(); };
    bDone.style.display = 'none'; engUI(); bMap.innerHTML = RL.ICON.map;
    const cleanup = () => { cancelAnimationFrame(raf); abortCb = null; fly.style.display = 'none'; fly.classList.remove('orbit'); document.body.classList.remove('flying'); rocket.style.display = ''; };
    abortCb = () => { if (ended) return; ended = 'abort'; cleanup(); A.stop(); A.tone(300, 0.15, 'square', 0.1); onAbort && onAbort(); };
    A.say('さん、に、いち、はっしゃ！', null, { rate: 1.1 });
    [0, 700, 1400].forEach(d => setTimeout(() => { if (!ended) A.tone(880, 0.15); }, d));
    setTimeout(() => { if (!ended) { A.tone(1320, 0.4); A.rumble(3); } }, pre);
    const autoMap = () => sim.body !== E || (Math.hypot(sim.x, sim.y) - E.R) > E.atmo * 1.15;

    function events() {
      sim.events.splice(0).forEach(e => {
        if (e.type === 'booster-sep') { sepReal[e.id] = performance.now(); sepFlash = 25; A.tone(180, 0.25, 'square', 0.15); if (!saidSep) { saidSep = true; A.say('ブースター、きりはなし！', null, { interrupt: false }); } }
        if (e.type === 'stage-sep') { stageReal[e.i] = performance.now(); sepFlash = 40; A.tone(220, 0.3, 'square', 0.18); setTimeout(() => A.tone(140, 0.4, 'square', 0.12), 140);
          A.say((STAGE_NAME[e.i] || '') + 'だん、きりはなし！', null, { interrupt: false });
          setTimeout(() => { if (!ended && sim.stages[e.i + 1] && sim.stages[e.i + 1].eng + sim.stages[e.i + 1].veng > 0) { [523, 784].forEach((f, k) => setTimeout(() => A.tone(f, 0.18, 'triangle', 0.15), k * 90)); A.say((IGN_NAME[e.i + 1] || '') + '、てんか！', null, { interrupt: false }); } }, 400); }
        if (e.type === 'space') { [784, 1175].forEach((f, i) => setTimeout(() => A.tone(f, 0.3, 'sine', 0.15), i * 150)); A.say('うちゅうに でたよ！', null, { interrupt: false }); }
        if (e.type === 'engine-off') { A.tone(400, 0.12, 'square', 0.1); setTimeout(() => A.tone(260, 0.2, 'square', 0.1), 110); }
        if (e.type === 'engine-on') { A.tone(523, 0.1, 'triangle'); setTimeout(() => A.tone(784, 0.15, 'triangle'), 90); }
        if (e.type === 'soi') A.say(e.body === 'moon' ? 'つきの じゅうりょくけんに はいったよ！' : 'ちきゅうの じゅうりょくけんに もどったよ。', null, { interrupt: false });
        if (e.type === 'class') {
          const wasOrbit = ORBIT_CLS.includes(e.old);
          if (['low', 'high'].includes(e.cls) && !wasOrbit && !saidOrbit) { saidOrbit = true; [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => A.tone(f, 0.2, 'triangle'), i * 110));
            A.say('やった！ ちきゅうを まわる きどうに のったよ！' + (sim.isPowered() && sim.liquidLeft() ? ' エンジンを とめると、ずっと まわりつづけるよ。' : ''), null, { interrupt: false });
            if (sim.isPowered()) { bEng.classList.add('hint'); setTimeout(() => bEng.classList.remove('hint'), 4000); } }
          if (e.cls === 'toMoon' && e.old !== 'toMoon' && !saidEnc) A.say('つきの たかさまで とどくよ！ つきに であえるかな？', null, { interrupt: false });
          if (e.cls === 'escape' && sim.body === E) A.say('ちきゅうから にげだせる はやさに なった！', null, { interrupt: false });
        }
      });
    }
    function nearView(h, rangeD) {
      const cam = Math.max(0, Yh(h) - room), gy = ground + cam;
      g.fillStyle = RL.Flight.skyAt(h); g.fillRect(0, 0, W, H);
      const sa = Math.min(1, Math.max(0, (h - 150) / 200));
      if (sa > 0) { g.fillStyle = `rgba(255,255,255,${sa})`; stars.forEach(st => { g.beginPath(); g.arc(st.x, (st.y + cam * 0.3) % H, st.r, 0, 7); g.fill(); }); }
      // 雲：横に すすんだ ぶん 左へ ながれる
      g.font = `${48 * u}px sans-serif`; g.textAlign = 'center';
      clouds.forEach(c => { const y = gy - Yh(c.h); if (y < -60 || y > H + 60) return; const x = (((c.x * W + rangeD * px * 1.4) % (W * 1.6)) + W * 1.6) % (W * 1.6) - W * 0.3;
        g.globalAlpha = 0.9; g.font = `${48 * u * c.s}px sans-serif`; g.fillText('☁️', x, y); g.globalAlpha = 1; });
      const ay = gy - Yh(E.atmo);
      if (ay > -10 && ay < H + 10) { g.strokeStyle = 'rgba(160,220,255,.8)'; g.lineWidth = 4; g.setLineDash([16, 12]); g.beginPath(); g.moveTo(0, ay); g.lineTo(W, ay); g.stroke(); g.setLineDash([]); }
      if (gy < H + 50) { g.fillStyle = '#3c8f3c'; g.fillRect(0, gy, W, H);
        const padX = W / 2 - RW / 2 - 20 + rangeD * px * 1.4; g.fillStyle = '#ffcc00'; g.fillRect(padX, gy - 10, RW + 40, 10); }
      return { ry: startY - Math.min(Yh(h), room) };
    }
    const cam = RL.Flight.rocketCam(cs); let box = null;
    function rocketDOM(ry, burnAny, dtR) {
      const tilt = -(Math.PI / 2 - sim.point);   // 東（地図で 左）へ かたむく
      const shake = burnAny ? 1.5 : 0;
      // のこっている部分の まんなかを 中心に かたむけ、画面の まんなかへ（切りはなしの あとも 全体が 見える）
      box = RL.Flight.remainBox(a.cells, q => {
        if (q.stackId) { const s = sim.stacks.find(x => x.id === q.stackId); if (s && !s.withStage) return s.sepT !== null; }
        return q.stage < sim.si; }, box);
      const natural = ry + box.cy * cs;
      cam.place(rocket, box, tilt, W / 2 + (Math.random() - 0.5) * shake, sim.lifted ? Math.max(natural, H * 0.45) : natural, dtR);
      const now = performance.now();
      rocket.querySelectorAll('.flame').forEach(f => {
        let on;
        if (f.dataset.kind === 'b') { const s = sim.stacks.find(x => x.id === f.dataset.stackFlame); on = !!s && s.sepT === null && s.ignT !== null && sim.t >= s.ignT && s.fuel > 0; }
        else on = +f.dataset.stage === sim.si && sim.burnC;
        if (!sim.lifted && sim.t < 0.01) on = false;
        f.style.display = on ? 'block' : 'none';
        if (on && f.dataset.kind === 'v') { const w0 = +f.dataset.w, h0 = +f.dataset.h, kx = 0.5 + 0.5 * sim.vpow, ky = 0.35 + 0.9 * sim.vpow;
          f.style.width = w0 * kx + 'px'; f.style.left = (+f.dataset.l + w0 * (1 - kx) / 2) + 'px'; f.style.height = h0 * ky + 'px'; }
      });
      rocket.querySelectorAll('[data-stack]').forEach(b => {
        const s = sim.stacks.find(x => x.id === b.dataset.stack); if (!s || s.sepT === null || s.withStage || !sepReal[s.id]) return;
        const sd = +b.dataset.side, tt = (now - sepReal[s.id]) / 1000 * 1.2;
        b.style.transform = `translate(${sd * (12 + tt * 60)}px,${tt * tt * 180 + tt * 40}px) rotate(${sd * tt * 200}deg)`; b.style.opacity = Math.max(0, 1 - tt / 2.5);
      });
      Object.keys(stageReal).forEach(i => {
        const tt = (now - stageReal[i]) / 1000 * 1.2;
        rocket.querySelectorAll(`.p[data-stage="${i}"]`).forEach(b => {
          const s = b.dataset.stack && sim.stacks.find(x => x.id === b.dataset.stack); if (s && !s.withStage) return;
          b.style.transform = `translateY(${tt * tt * 160 + tt * 30}px) rotate(${(i % 2 ? -1 : 1) * tt * 25}deg)`; b.style.opacity = Math.max(0, 1 - tt / 3);
        });
      });
      // けむり
      rocket.querySelectorAll('.flame').forEach(f => {
        if (f.style.display !== 'block') return;
        const L0 = +f.dataset.l + +f.dataset.w / 2, T0 = parseFloat(f.style.top) + cs;
        const [sx0, sy0] = cam.toScreen(L0, T0);
        for (let i = 0; i < 2; i++) smoke.push({ x: sx0, y: sy0, vx: (Math.random() - 0.5) * 2 + Math.cos(sim.point) * 2, vy: 2 + Math.random() * 3, l: Math.max(0.15, sim.rho) });
      });
      for (let i = smoke.length - 1; i >= 0; i--) { const p = smoke[i]; p.x += p.vx; p.y += p.vy; p.l -= 0.02; if (p.l <= 0) { smoke.splice(i, 1); continue; }
        g.fillStyle = `rgba(235,235,235,${p.l * 0.6})`; g.beginPath(); g.arc(p.x, p.y, (1.3 - p.l) * 18, 0, 7); g.fill(); }
    }
    function updateView(pr, dtR) {
      // 地図の大きさ：予測の線と いまの位置が おさまるように（なめらかに）
      const ms = SP.bodyState(sim.bodies.moon, sim.t);
      let cx = 0, cy = 0, need;
      if (sim.body !== E) { cx = ms.x; cy = ms.y; need = Math.max(Math.hypot(sim.x, sim.y) * 1.3, sim.body.R * 2.5);
        if (pr) pr.segs.forEach(sg => sg.pts.forEach(p => { need = Math.max(need, Math.min(Math.hypot(p[0] - ms.x, p[1] - ms.y) * 1.1, sim.body.soi * 1.2)); })); }
      else {
        const r = Math.hypot(sim.x, sim.y); need = Math.max(E.R * 1.35, r * 1.2);
        if (pr) { let m = 0; pr.segs.forEach(sg => sg.pts.forEach(p => { m = Math.max(m, Math.hypot(p[0], p[1])); })); if (pr.enc) m = Math.max(m, Math.hypot(pr.enc.x, pr.enc.y) + sim.bodies.moon.soi); need = Math.max(need, Math.min(m * 1.1, E.soi)); }
      }
      const k = Math.min(1, dtR * 2.5);
      V.r = Math.exp(Math.log(V.r) + (Math.log(need) - Math.log(V.r)) * k);
      V.cx += (cx - V.cx) * k; V.cy += (cy - V.cy) * k;
    }
    function frame(ts) {
      if (ended === 'abort') return;
      if (!t0) { t0 = ts; prev = ts; }
      const el = ts - t0, dtR = Math.min(0.05, (ts - prev) / 1000); prev = ts;
      $('count').textContent = el < pre ? String(3 - Math.floor(el / 700)) : '';
      if (el > pre && !sim.done) {
        const target = sim.autoWarp();
        warp = target > warp ? Math.min(target, warp * 1.06 + 0.05) : target;
        sim.advance(dtR * warp);
      }
      events(); engUI();
      // とんできた あと（地球から見た 位置）
      if (sim.lifted) { const ms = sim.body === E ? { x: 0, y: 0 } : SP.bodyState(sim.bodies.moon, sim.t), p = [sim.x + ms.x, sim.y + ms.y], lp = trail[trail.length - 1];
        if (!lp || Math.hypot(p[0] - lp[0], p[1] - lp[1]) > V.r * 0.006) { trail.push(p); if (trail.length > 3000) trail.splice(0, 500); } }
      // 予測：エンジンを使っている間は 毎こま、惰性の間は 0.1秒ごと
      if (sim.lifted && (sim.isPowered() || !prCache || ts - prAt > 100)) { prCache = predict(sim); prAt = ts; }
      const pr = sim.lifted ? prCache : null;
      if (pr && pr.kind !== prKind) {
        const moonNow = /^moon/.test(pr.kind), moonOld = /^moon/.test(prKind || '');
        if (moonNow && !moonOld && sim.body === E && !saidEnc) { saidEnc = true; [659, 880, 1175].forEach((f, i) => setTimeout(() => A.tone(f, 0.18, 'triangle'), i * 100)); A.say('つきに とどく きどうだ！', null, { interrupt: false }); }
        prKind = pr.kind;
      }
      updateView(pr, dtR);
      const h = Math.hypot(sim.x, sim.y) - sim.body.R, useMap = view === 'map' || (view === 'auto' && autoMap());
      bDone.style.display = (!sim.done && ORBIT_CLS.includes(sim.cls) && !sim.isPowered()) ? 'flex' : 'none';
      if (useMap) {
        rocket.style.display = 'none';
        drawMap(g, V, sim, pr, trail, { x0: 0, y0: 0, w: W, h: H }, false);
      } else {
        rocket.style.display = 'block';
        const ph = Math.atan2(sim.y, sim.x) - (O.SITE + E.rot * sim.t), rangeD = Math.atan2(Math.sin(ph), Math.cos(ph)) * E.R;
        const { ry } = nearView(sim.body === E ? h : 9999, rangeD);
        rocketDOM(ry, sim.burnC || sim.boost, dtR);
        // 小さな地図（予測の線が 地球を ひとまわり するのが 見える）
        const sz = Math.min(W, H) * 0.34, VV = { r: Math.max(E.R * 1.3, Math.min(V.r, E.R * 3)), cx: 0, cy: 0, u: u * 0.6, stars: [] };
        drawMap(g, VV, sim, pr, trail, { x0: 12, y0: 86, w: sz, h: sz }, true);
      }
      drawTop(g, W, sim, el > pre ? warp : 1, u);
      if (pr && !ended) drawBadge(g, W, pr, u, useMap);
      drawSpeed(g, W, H, sim, u);
      if (a.fuel > 0) drawFuel(g, H, sim, u);
      if (sepFlash > 0) { g.fillStyle = `rgba(255,255,255,${sepFlash / 60})`; g.fillRect(0, 0, W, H); sepFlash--; }
      // おわり
      if (sim.done && !ended) {
        ended = sim.done.type; endAt = ts;
        if (['ground', 'hit'].includes(ended)) { A.tone(120, 0.5, 'sawtooth', 0.15); A.rumble(1); }
      }
      if (ended && ended !== 'abort') {
        if (['ground', 'hit'].includes(ended)) { g.font = `${120 * u}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('💥', W / 2, H / 2); }
        if (ts - endAt > 1300) { cleanup(); onDone(sim); return; }
      }
      raf = requestAnimationFrame(frame);
    }
    cur = sim;
    raf = requestAnimationFrame(frame);
    return sim;
  }
  return { run, predict, get sim() { return cur; } };
})();
