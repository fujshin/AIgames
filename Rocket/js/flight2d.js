// うちゅうモードの 飛行画面
//  - ちかく（打ち上げ）：空・地面・雲。ロケットは SVG部品を そのまま かたむけて動かす。左上に 小さな地図
//  - 地図（くうきの外）：地球を まんなかに、月・とんできた あと・予測の線（地面に ぶつかる＝オレンジ、まわる＝みどり、にげる＝むらさき）
//  - 早送りは 自動（燃えている間は 実時間）。v0.8.2：うちゅうで 燃やす間は スローモーション（🐢）
//  - ボタン：エンジン とめる／つける（液体だけ）、地図／ちかく、おわる（安定した軌道のとき）、中止（長おし）
//    v0.8.3：ボタンは いつも 同じ位置（🏁 は 出ていない間も 場所を とっておく）
//  - v0.8.2：地図の ズーム（＋／－ボタン・ピンチ・ホイール）。画面の外の 月／地球は はしに 🌙 の しるし
//  - v0.8.3：上の まんなかの「このまま とぶと どうなるか」の しるしは やめた。予測の線の 色で わかるため
//  - v0.8.4：地図のときは 右上に ロケットの 小窓。ちかくの画面の 小さな地図は 軌道ぜんたいが 入る 大きさ
//  - v0.9：まえに うちあげた 衛星（うすい 線と 小さな 衛星）と 月の 🚩 を 地図に 出す（js/save.js の ワールド）
//  - v0.10：向きボタン（前へ／うしろへ＝ブレーキ）。くうきの外で つかえる。月で うしろへ ふかすと 月を まわれる
//  - v0.11：月着陸（月の ちかくの画面・着陸メーター・着陸脚・ホバー）と ⏪ ここからやり直し
//  - v0.11.1：月の ちかくの画面で ロケットの 下はしを 地面に あわせる。⏪ は 着陸の とちゅうでは「まにあう」ときだけ おぼえる。燃料メーターは 段ごとに 100%
//  - v0.12：地球にも 着陸（地面ちかくでは 地面に ロケットの 下はしを あわせる）、🪂 パラシュート、14行の ロケット、スローモーションは physics2d へ
RL.Flight2D = (function () {
  const $ = id => document.getElementById(id), SP = RL.Space, TAU = Math.PI * 2;
  const STAGE_NAME = ['だいいち', 'だいに', 'だいさん', 'だいよん', 'だいご'], IGN_NAME = ['', 'にだんめ', 'さんだんめ', 'よんだんめ', 'ごだんめ'];
  const ORBIT_CLS = ['low', 'high', 'toMoon', 'moonOrbit'];
  let raf = null, cur = null, pause = null;
  const earthImg = new Image(); earthImg.src = 'img/earth.webp';
  // 予測の線の 色
  const SEG_COL = { hit: '#ff9a3d', orbit: '#5aff7a', escape: '#d58bff', moonPass: '#7fd3ff', moonOrbit: '#5aff7a', moonHit: '#ff9a3d', home: '#00ffb0' };   // v0.13 home＝ちきゅうに かえれる
  const FATE_ICON = { escape: '🚀', orbit: '🔄', hit: '💥', home: '🏠' };
  const predict = sim => RL.Predict.fromSim(sim);
  // ---- ズームの ボタンの絵（v0.8.2） ----
  const ZICON = {
    zin: '<svg viewBox="0 0 100 100"><circle cx="42" cy="42" r="26" fill="none" stroke="#fff" stroke-width="9"/><path d="M62 62 L86 86" stroke="#fff" stroke-width="12" stroke-linecap="round"/><path d="M30 42 H54 M42 30 V54" stroke="#ffd54a" stroke-width="8" stroke-linecap="round"/></svg>',
    zout: '<svg viewBox="0 0 100 100"><circle cx="42" cy="42" r="26" fill="none" stroke="#fff" stroke-width="9"/><path d="M62 62 L86 86" stroke="#fff" stroke-width="12" stroke-linecap="round"/><path d="M30 42 H54" stroke="#ffd54a" stroke-width="8" stroke-linecap="round"/></svg>'
  };
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
  // ---- まえに うちあげた 衛星（v0.9）：まんなかの 箱 と 青い はね ----
  function drawSat(g, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.fillStyle = '#3d7bd9'; g.strokeStyle = '#fff'; g.lineWidth = 1;
    g.fillRect(-11, -3, 7, 6); g.strokeRect(-11, -3, 7, 6); g.fillRect(4, -3, 7, 6); g.strokeRect(4, -3, 7, 6);
    g.fillStyle = '#ffd54a'; g.fillRect(-3.5, -3.5, 7, 7); g.restore();
  }
  // ---- 画面の外にある 天体の しるし（はしに 絵と 向きの 三角）（v0.8.2） ----
  function offscreenMark(g, x, y, box, icon, u) {
    const { x0, y0, w, h } = box, m = 34 * u;
    if (x > x0 + m && x < x0 + w - m && y > y0 + m && y < y0 + h - m) return;
    const cx = x0 + w / 2, cy = y0 + h / 2, dx = x - cx, dy = y - cy;
    const k = Math.min((w / 2 - m) / Math.max(1e-6, Math.abs(dx)), (h / 2 - m) / Math.max(1e-6, Math.abs(dy)));
    const px = cx + dx * k, py = cy + dy * k, an = Math.atan2(dy, dx);
    g.save();
    g.fillStyle = 'rgba(0,0,30,.7)'; g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2;
    g.beginPath(); g.arc(px, py, 22 * u, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#ffd54a'; g.translate(px, py); g.rotate(an);
    g.beginPath(); g.moveTo(32 * u, 0); g.lineTo(22 * u, -8 * u); g.lineTo(22 * u, 8 * u); g.closePath(); g.fill();
    g.rotate(-an); g.font = `${24 * u}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(icon, 0, 1);
    g.restore();
  }
  // ---- 地図を描く（全画面 または 小窓） ----
  function drawMap(g, V, sim, pr, trail, box, small, WD) {
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
    const mR = Math.max(small ? 3 : 5, M.R * sc);
    drawMoon(g, X(ms.x), Y(ms.y), mR);
    drawEarth(g, X(0), Y(0), Math.max(small ? 4 : 7, E.R * sc), E.rot * sim.t, (E.R + E.atmo) * sc);
    // v0.9 ワールド：まえの 衛星（うすい 線）と 月の はた
    if (WD) {
      const abs = WD.W0 + sim.t;
      WD.items.forEach(it => {
        const o = it.o;
        if (o.kind === 'lander') { if (mR < 6) return; const fx = ms.x + Math.cos(o.ang) * M.R * 1.12, fy = ms.y + Math.sin(o.ang) * M.R * 1.12;   // v0.11 着陸した ロケット
          g.font = `${small ? 10 : Math.min(22, Math.max(12, mR * 0.35))}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('\u{1F680}', X(fx), Y(fy)); return; }
        if (o.kind === 'flag') { if (mR < 6) return; const fx = ms.x + Math.cos(o.ang) * M.R * 1.12, fy = ms.y + Math.sin(o.ang) * M.R * 1.12;
          g.font = `${small ? 10 : Math.min(22, Math.max(12, mR * 0.35))}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🚩', X(fx), Y(fy)); return; }
        const off = o.body === 'moon' ? ms : { x: 0, y: 0 };
        if (!small) { g.strokeStyle = 'rgba(255,213,74,.22)'; g.lineWidth = 1; g.beginPath();
          it.pts.forEach((p, i) => i ? g.lineTo(X(p[0] + off.x), Y(p[1] + off.y)) : g.moveTo(X(p[0] + off.x), Y(p[1] + off.y))); g.stroke(); }
        const s = RL.World.posAt(o, abs);
        drawSat(g, X(s.x + off.x), Y(s.y + off.y), small ? 0.5 : V.u * 0.9);
      });
    }
    // 発射場
    if (E.R * sc > 25) { const ph = RL.CFG.ORBIT.SITE + E.rot * sim.t; g.font = `${small ? 12 : 18}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('🏠', X(Math.cos(ph) * E.R * 1.03), Y(Math.sin(ph) * E.R * 1.03)); }
    // v0.15 4章：ふかす しるし（ひかる ほのお）
    const mk = RL.Missions && RL.Missions.mark(sim);   // v0.19：月を まわる ときの かえる しるし（mk.moon）も
    if (mk) { const a = Math.atan2(mk.y, mk.x) - 0.06, rr = Math.hypot(mk.x, mk.y), mx = mk.moon ? X(mk.x) : X(Math.cos(a) * rr), my = mk.moon ? Y(mk.y) : Y(Math.sin(a) * rr), pu = 0.5 + 0.5 * Math.sin(performance.now() / 180);
      g.save(); g.strokeStyle = `rgba(90,255,122,${0.5 + 0.5 * pu})`; g.lineWidth = small ? 2 : 4; g.beginPath(); g.arc(mx, my, (small ? 6 : 14 + 6 * pu) * (small ? 1 : V.u), 0, TAU); g.stroke();
      if (!small) { g.font = `${22 * V.u}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('\u{1F525}', mx, my - 30 * V.u); } g.restore(); }
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
        if (sg.kind === 'home' && !sg.after) emo('\u{1F3E0}', X(e[0]), Y(e[1]), small ? 12 : 22);
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
    const vp = sim.visPt != null ? sim.visPt : sim.point;   // v0.10：見た目の 向き（なめらかに まわる）
    if (sim.isPowered() || !sim.lifted || sim.near) { dx = Math.cos(vp) * -uy + Math.sin(vp) * ux; dy = Math.cos(vp) * ux + Math.sin(vp) * uy; }
    else { dx = sim.vx; dy = sim.vy; }
    drawShip(g, px, py, -Math.atan2(dy, dx), sim.isPowered() && sim.lifted, small ? 0.7 : V.u * 1.2);
    // 画面の外の 月・地球（v0.8.2）
    if (!small) { offscreenMark(g, X(ms.x), Y(ms.y), box, '🌙', V.u); offscreenMark(g, X(0), Y(0), box, '🌍', V.u); }
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
    // v0.11.1：のこりの 段（エンジンの ある 段）の 数を 下に ●。切りはなすと 1つ へって メーターは 100% に もどる
    const left = sim.stages.slice(sim.si).filter(x => x.eng + x.veng > 0).length;
    for (let k = 0; k < left; k++) { g.fillStyle = k === 0 ? '#ffd54a' : 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(gx + gw / 2, gy + gh + 14 * u + k * 16 * u, 5.5 * u, 0, 7); g.fill(); }
  }
  function drawTop(g, W, sim, warp, u) {
    const h = Math.hypot(sim.x, sim.y) - sim.body.R, bx = W - 16 * u, ff = warp > 1.5, slow = warp < 0.9;
    g.save(); g.textAlign = 'right'; g.textBaseline = 'top';
    g.fillStyle = 'rgba(0,0,20,.55)'; g.fillRect(bx - 200 * u, 10, 200 * u, (ff || slow ? 100 : 70) * u);
    g.font = `bold ${28 * u}px "Courier New",monospace`; g.fillStyle = '#fff';
    g.fillText((sim.body.id === 'moon' ? '🌙' : '⬆') + String(Math.max(0, Math.round(h))).padStart(6, '0'), bx - 8 * u, 16 * u);
    g.fillStyle = '#9fd8ff'; g.font = `bold ${22 * u}px "Courier New",monospace`;
    const t = sim.t, mm = Math.floor(t / 60), ss = Math.floor(t % 60);
    g.fillText('⏱' + mm + ':' + String(ss).padStart(2, '0'), bx - 8 * u, 50 * u);
    if (ff) { g.fillStyle = '#ffd54a'; g.fillText('⏩×' + Math.round(warp), bx - 8 * u, 78 * u); }
    if (slow) { g.fillStyle = '#7fd3ff'; g.fillText('🐢×1/' + Math.max(2, Math.round(1 / warp)), bx - 8 * u, 78 * u); }   // v0.8.2：スローモーション
    g.restore();
  }
  // ---- v0.11 着陸メーター（燃料メーターの となり）：いま エンジンを とめたら 地面に つく 速さ（▶）と、いまの 下むきの 速さ（白い 線）
  //   みどり＝着陸できる／きいろ＝あぶない／赤＝ぶつかる。着陸脚が あると みどりが ひろい
  function drawLandMeter(g, H, sim, u) {
    const LD = RL.CFG.ORBIT.LAND[sim.body.id] || RL.CFG.ORBIT.LAND.moon, l = sim.legs(), ok = LD.V_DOWN * (l.n ? LD.LEG_K : 1), hard = ok * LD.HARD_K, MAX = LD.V_DOWN * LD.LEG_K * LD.HARD_K * 1.3;   // v0.14.6：目もりは いつも 同じ（脚で みどりが ひろがる）
    const gx = 54 * u, gw = 26 * u, gh = 130 * u, gy = H * 0.42, Yv = v => gy + gh * Math.min(1, Math.max(0, v) / MAX);   // 上が 0（おそい）
    g.save();
    [[0, ok, '#3bd65a'], [ok, hard, '#ffd54a'], [hard, MAX, '#ff4d4d']].forEach(([a, b, c]) => { g.fillStyle = c; g.fillRect(gx, Yv(a), gw, Yv(b) - Yv(a)); });
    g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(gx, gy, gw, gh);
    const r = Math.hypot(sim.x, sim.y), vd = Math.max(0, -(sim.vx * sim.x + sim.vy * sim.y) / r);
    g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(gx - 4 * u, Yv(vd)); g.lineTo(gx + gw + 4 * u, Yv(vd)); g.stroke();
    const td = RL.Predict.touchdown(sim);
    if (td) { const y = Yv(td.vDown); g.fillStyle = '#fff'; g.strokeStyle = '#2b3245'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(gx + gw + 2 * u, y); g.lineTo(gx + gw + 16 * u, y - 9 * u); g.lineTo(gx + gw + 16 * u, y + 9 * u); g.closePath(); g.fill(); g.stroke(); }
    g.font = `${22 * u}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = '#fff';
    g.fillText(l.n ? '\u{1F9B5}' : '\u2B07', gx + gw / 2, gy - 8);
    g.restore();
    return td;
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
  // v0.11 ⏪ ここからやり直し（長おし）
  let rewCb = null, lastRun = null;
  $('btnRew').insertAdjacentHTML('beforeend', RL.ICON.rewind);
  holdButton($('btnRew'), 700, () => { if (rewCb) rewCb(); });
  // ---- ズーム（v0.8.2）：自動の大きさに かける倍率（log）。＋で ちかく、－で とおく ----
  const ZSTEP = Math.log(2.5), Z_IN = -2 * ZSTEP, Z_OUT = 4 * ZSTEP;
  const Z = { log: 0, on: false, pins: new Map(), pinD: 0 };
  const zoomBy = d => { if (!Z.on) return; Z.log = Math.max(Z_IN, Math.min(Z_OUT, Z.log + d)); if (Math.abs(Z.log) < 0.12) Z.log = 0; };
  $('btnZin').innerHTML = ZICON.zin; $('btnZout').innerHTML = ZICON.zout;
  $('btnZin').addEventListener('click', () => { zoomBy(-ZSTEP); RL.Audio.tone(760, 0.06); });
  $('btnZout').addEventListener('click', () => { zoomBy(ZSTEP); RL.Audio.tone(520, 0.06); });
  { // ピンチ（2本ゆび）と ホイール：地図のとき だけ
    const cv = $('cv'), dist = () => { const p = [...Z.pins.values()]; return p.length < 2 ? 0 : Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); };
    cv.addEventListener('wheel', e => { e.preventDefault(); zoomBy(Math.sign(e.deltaY) * ZSTEP * 0.25); }, { passive: false });
    cv.addEventListener('pointerdown', e => { Z.pins.set(e.pointerId, { x: e.clientX, y: e.clientY }); Z.pinD = dist(); });
    cv.addEventListener('pointermove', e => { if (!Z.pins.has(e.pointerId)) return; Z.pins.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const d = dist(); if (d > 0 && Z.pinD > 0) zoomBy(Math.log(Z.pinD / d)); Z.pinD = d; });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => cv.addEventListener(n, e => { Z.pins.delete(e.pointerId); Z.pinD = dist(); }));
  }
  // resume（v0.11）：{ cp, trail, rewinds } ＝ 結果画面の ⏪ から つづける
  // start（v0.14 ミッション）：とちゅうから はじめる（RL.Orbit の opt.start）。カウントダウン なし
  function run(a, profile, onDone, onAbort, resume, start) {
    const fly = $('fly'), cv = $('cv'), g = cv.getContext('2d'), A = RL.Audio, dpr = devicePixelRatio || 1;
    fly.style.display = 'block'; fly.classList.add('orbit'); document.body.classList.add('flying');
    const W = innerWidth, H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const u = Math.max(0.5, Math.min(1, Math.min(W, H * 0.75) / 700));
    $('count').style.fontSize = (130 * u) + 'px';
    const sim = RL.Orbit.create(a, start && !resume ? { profile, start } : { profile }), O = RL.CFG.ORBIT, E = sim.bodies.earth, LDb = () => O.LAND[sim.body.id] || O.LAND.moon;
    // v0.9 ワールド：この 飛行が はじまった ときの ワールドの 時計と、まえに のこした もの
    const pf = RL.Save && RL.Save.cur, WD = pf ? { W0: pf.world.clock, items: pf.world.objs.map(o => ({ o, pts: o.kind === 'sat' ? RL.World.orbitPts(o) : null })) } : null;
    sim.worldStart = WD ? WD.W0 : 0;
    if (RL.Missions && RL.Missions.active && RL.Missions.active.dvRate) sim.dvRate = RL.Missions.active.dvRate;   // v0.14.6
    if (RL.Missions && RL.Missions.active && RL.Missions.active.noSlow) sim.noSlow = true;   // v0.15
    if (RL.Missions && RL.Missions.active && RL.Missions.active.coast) sim.coastK = RL.Missions.active.coast;   // v0.18：とぶ だけの ところを はやく（4-4・4-5）
    // v0.14.6 ミッションの いちじ停止：{ until: 'speech'（声が おわるまで）／ボタンの id（おすまで）, end }
    pause = null;
    const speechDone = () => { const p = pause; pause = null; if (p && p.end && !sim.done) sim.forceEnd(p.end); };
    const cs = Math.min(36, W / 12, H / (RL.CFG.ROWS + 11)), rocket = RL.Flight.buildRocket(a, cs), RW = RL.CFG.COLS * cs;
    rocket.style.display = 'block';
    let lowest = 0; a.cells.forEach(q => { if (!q.ctx.loose) lowest = Math.max(lowest, q.r + 1); });
    const px = H / 180, L = 150, Yh = hh => px * L * Math.log(1 + Math.max(0, hh) / L);
    const ground = H * 0.82, startY = ground - 10 - lowest * cs, room = startY - H * 0.3;
    const stars = Array.from({ length: 140 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.8 + 0.3 }));
    const clouds = Array.from({ length: 14 }, (_, i) => ({ h: 25 + Math.random() * 160, x: Math.random() * 1.6, s: 0.6 + Math.random() * 0.8 }));
    const V = { r: E.R * 1.6, ra: E.R * 1.6, cx: 0, cy: 0, u, stars: Array.from({ length: 160 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.6 + 0.6 })) };
    const trail = []; const smoke = [];
    const sepReal = {}, stageReal = {};
    let prCache = null, prAt = 0, prKind = null, saidEnc = false;
    let t0 = null, prev = null, warp = 1, view = RL.Missions && RL.Missions.active && RL.Missions.active.map ? 'map' : 'auto',   // v0.15：4章は 地図から
      sepFlash = 0, saidSep = false, ended = null, endAt = 0, saidOrbit = false, saidSlow = false;
    const pre = resume || start ? 0 : 2100;
    // v0.10／v0.11 の おしえ（いちど だけ）
    let saidPeri = true, saidNear = false, saidHover = false, warnAt = 0, boomY = null;
    let heavyAt = 0, saidHeavyPod = false;   // v0.18.1：よこの 段を すてたら まんなか だけでは おもくて あがれない ときに 1回 いう
    // v0.11 ここからやり直し
    let lastCp = resume ? resume.cp : null, rewinds = resume ? resume.rewinds + 1 : 0;
    if (resume) { sim.restore(resume.cp.snap); resume.trail.slice(0, resume.cp.trailLen).forEach(p => trail.push(p)); }
    sim.rewinds = rewinds;
    // v0.11.1：月の 地面ちかくでは「いまから エンジンで まにあう」ときだけ おぼえる（ぶつかる 直前を おぼえると、もどっても すぐ ぶつかる）
    const canSave = () => {
      if (!sim.near) return true;
      const r = Math.hypot(sim.x, sim.y), h = r - sim.body.R, g2 = sim.body.mu / (r * r), vd = Math.max(0, -(sim.vx * sim.x + sim.vy * sim.y) / r);
      return (sim.liquidLeft() || (sim.chutes() && !sim.chute)) && h > 60 && vd * vd / (2 * (LDb().TWR - 1) * g2) < h * 0.6;
    };
    const saveCp = (tag, force) => { if (!sim.lifted || sim.done || (!force && !canSave())) return; lastCp = { snap: sim.snapshot(), trailLen: trail.length, tag }; };
    Z.log = 0; Z.pins.clear();
    // ボタン（v0.8.3：🏁 は visibility で 出し入れ ＝ ほかの ボタンが うごかない）
    const bEng = $('btnEng'), bMap = $('btnMap'), bDone = $('btnDone'), zctl = $('zctl'), bDir = $('btnDir'), bRew = $('btnRew'), bChute = $('btnChute');
    // ---- v0.13 ✂️ 切りはなし（3秒 以内に 2回 おす）・🚩 旗（月面で 1回）----
    const bSep = $('btnSep'), bFlag = $('btnFlag'); let sepArm = 0, idleAt = 0, saidIdle = false, saidHot = false, saidOpen = false, savedAtmo = false, homeSaid = false;
    const sepUI = () => { const ok = !ended && sim.canSep(); bSep.style.visibility = ok ? 'visible' : 'hidden'; if (!ok || performance.now() - sepArm > 3000) { sepArm = 0; bSep.classList.remove('arm'); }
      bFlag.style.visibility = sim.surface && !ended && !sim.flagPlanted ? 'visible' : 'hidden'; };
    bSep.onclick = () => {
      if (bSep.style.visibility === 'hidden') return; const now = performance.now();
      if (!sepArm || now - sepArm > 3000) { sepArm = now; bSep.classList.add('arm'); A.tone(600, 0.08); A.say('きりはなす？ もういちど おしてね。'); return; }
      sepArm = 0; bSep.classList.remove('arm'); idleAt = now;
      if (sim.surface) saveCp('surface', true);
      sim.separate();
    };
    bFlag.onclick = () => { if (bFlag.style.visibility === 'hidden') return; sim.flagPlanted = true; idleAt = performance.now();
      [523, 659, 784].forEach((f, i) => setTimeout(() => A.tone(f, 0.18, 'triangle'), i * 110)); A.say('はたを たてたよ！'); };
    bSep.style.visibility = 'hidden'; bFlag.style.visibility = 'hidden';
    // ---- v0.12 🪂 パラシュート：ある ときだけ 出る（出ていない 間も 場所は とっておく） ----
    const chuteUI = () => { const has = sim.chutes() > 0 && sim.lifted && !ended; bChute.style.visibility = has ? 'visible' : 'hidden';
      bChute.classList.toggle('used', sim.chute === 'opening' || sim.chute === 'open'); bChute.classList.toggle('torn', sim.chute === 'torn'); };
    bChute.onclick = () => {
      if (bChute.style.visibility === 'hidden' || sim.done) return;
      const r = sim.deployChute();
      if (r === 'torn' && sim.chute === 'torn' && !bChute._said) { bChute._said = true; }
      if (r === 'opening' || r === 'open') return;
      if (r === 'torn') A.tone(150, 0.15, 'square', 0.08);
    };
    bChute.style.visibility = 'hidden'; bChute._said = false;
    let engShown = null;
    const watch = () => !!(RL.Missions && RL.Missions.active && RL.Missions.active.watch);   // v0.17.1：みている だけの ミッション（4-3）は エンジン・向きを つかわない
    const engUI = () => { const ok = sim.liquidLeft() && !sim.done && !watch(); bEng.classList.toggle('off', !ok); if (engShown !== sim.engineOn) { engShown = sim.engineOn; bEng.innerHTML = sim.engineOn ? RL.ICON.engStop : RL.ICON.engGo; } bEng.classList.toggle('on', sim.engineOn); };
    bEng.onclick = () => { RL._engClick = (RL._engClick || 0) + 1; idleAt = performance.now();
      if (watch()) { A.tone(150, 0.15, 'square', 0.08); A.say('この ミッションは、みている だけで いいよ。', null, { interrupt: true }); return; }
      if (sim.surface && !sim.liquidLeft() && sim.canSep()) { A.tone(150, 0.15, 'square', 0.08); A.say('この だんには ねんりょうが ないよ。 はさみで きりはなそう。'); bSep.classList.add('hint'); setTimeout(() => bSep.classList.remove('hint'), 3000); return; }
      if (!sim.lifted || !sim.liquidLeft() || sim.done) { A.tone(150, 0.15, 'square', 0.08); return; }
      if (sim.surface) saveCp('surface', true);   // v0.13：月面（離陸の 前）を おぼえる
      if (!sim.engineOn && sim.canDir()) saveCp('eng');   // v0.11：うちゅうで つける 直前を おぼえる（月の 地面ちかくは まにあう ときだけ）
      sim.setEngine(!sim.engineOn); engUI(); };
    // ---- v0.10 向きボタン：前へ ⇄ うしろへ（くうきの外だけ。いつも 同じ場所。つかえない ときは かくす） ----
    let dirShown = null;
    const dirUI = () => { const ok = sim.canDir() && sim.liquidLeft() && !ended && !watch(); bDir.style.visibility = ok ? 'visible' : 'hidden';
      const d = sim.dir === 'retro' ? 'retro' : 'pro'; if (dirShown !== d) { dirShown = d; bDir.innerHTML = d === 'retro' ? RL.ICON.dirRetro : RL.ICON.dirPro; bDir.classList.toggle('retro', d === 'retro'); } };
    bDir.onclick = () => { if (bDir.style.visibility === 'hidden') return; sim.setDir(sim.dir === 'retro' ? 'pro' : 'retro'); dirUI(); };
    bDir.style.visibility = 'hidden';
    // ---- v0.11 ⏪：最後に おぼえた ところへ もどる ----
    function syncParts() {   // 段・ブースターの 見た目を いまの sim に あわせる
      const now = performance.now();
      Object.keys(stageReal).forEach(i => { if (+i >= sim.si) delete stageReal[i]; });
      for (let i = 0; i < sim.si; i++) if (!stageReal[i] && !sim.leftStages.includes(i)) stageReal[i] = now - 10000;
      sim.stacks.forEach(st => { if (st.sepT === null) delete sepReal[st.id]; else if (!st.withStage && !sepReal[st.id]) sepReal[st.id] = now - 10000; });
      rocket.querySelectorAll('.p').forEach(b => { b.style.transform = ''; b.style.opacity = ''; });
      rocket.classList.toggle('legsOut', !!sim.legsOut); rocket.classList.remove('landedOk');
      rocket.classList.toggle('chuteOut', !!sim.chute); hideRocket = false;
    }
    rewCb = () => {
      if (!lastCp || ended) return;
      pause = null;
      sim.restore(lastCp.snap); trail.length = Math.min(trail.length, lastCp.trailLen); prCache = null; prKind = null;
      rewinds++; sim.rewinds = rewinds; saidPeri = lastCp.tag !== 'soi' || quiet(); saidHover = false; warnAt = 0;
      syncParts(); engShown = null; dirShown = null; sepFlash = 30;
      [784, 659, 523].forEach((f, i) => setTimeout(() => A.tone(f, 0.12, 'triangle'), i * 80)); A.say('もどったよ！ もういちど やってみよう。');
    };
    bRew.style.visibility = 'hidden';
    bMap.onclick = () => { view = (view === 'map' || (view === 'auto' && autoMap())) ? 'near' : 'map'; A.tone(660, 0.06); };
    bDone.onclick = () => { if (bDone.style.visibility === 'hidden') return; if (sim.surface) sim.endSurface(); else sim.finishNow(); };
    bDone.style.visibility = 'hidden'; engUI(); bMap.innerHTML = RL.ICON.map;
    // ---- v0.8.4 ロケットの 小窓（地図のとき）：ロケットの 入れ物（#rkWrap）を 小さくして 右上へ ----
    //  ロケットは いつもどおり 画面の (W/2, PIP_Y) に おき、まわりの L×L だけ 切りぬいて 縮める
    const wrap = $('rkWrap'), bPip = $('btnPip'), PIP_Y = H * 0.45, PIP_L = cs * RL.CFG.ROWS * 1.15;
    const pipBox = () => { const s = Math.min(W, H) * 0.3; return { s, x: W - 12 - s, y: 10 + 110 * u }; };
    function pipOn(P) {
      const k = P.s / PIP_L, cx = W / 2, cy = PIP_Y, hL = PIP_L / 2;
      wrap.style.transformOrigin = '0 0';
      wrap.style.transform = `translate(${P.x + P.s / 2 - k * cx}px,${P.y + P.s / 2 - k * cy}px) scale(${k})`;
      wrap.style.clipPath = `inset(${cy - hL}px ${W - cx - hL}px ${H - cy - hL}px ${cx - hL}px)`;
    }
    function pipOff() { wrap.style.transform = ''; wrap.style.clipPath = ''; bPip.style.display = 'none'; }
    bPip.onclick = () => { view = 'near'; A.tone(660, 0.06); };
    const cleanup = () => { pipOff(); cancelAnimationFrame(raf); abortCb = null; rewCb = null; bDir.style.visibility = 'hidden'; bRew.style.visibility = 'hidden'; bChute.style.visibility = 'hidden'; bSep.style.visibility = 'hidden'; bFlag.style.visibility = 'hidden';
      lastRun = { cp: lastCp, trail: trail.slice(), rewinds }; Z.on = false; zctl.style.display = 'none'; fly.style.display = 'none'; fly.classList.remove('orbit'); document.body.classList.remove('flying'); rocket.style.display = ''; };
    abortCb = () => { if (ended) return; ended = 'abort'; cleanup(); A.stop(); A.tone(300, 0.15, 'square', 0.1); onAbort && onAbort(sim); };
    if (start && !resume) { lastCp = { snap: sim.snapshot(), trailLen: 0, tag: 'start' }; }   // v0.14：はじめの ところに ⏪ で もどれる
    else if (!resume) {
      A.say('さん、に、いち、はっしゃ！', null, { rate: 1.1 });
      [0, 700, 1400].forEach(d => setTimeout(() => { if (!ended) A.tone(880, 0.15); }, d));
      setTimeout(() => { if (!ended) { A.tone(1320, 0.4); A.rumble(3); } }, pre);
    } else { A.say('もどったよ！ もういちど やってみよう。'); }
    // v0.11：月の 地面ちかくでは ちかくの画面
    const autoMap = () => !sim.near && !(sim.done && sim.done.type === 'landed') && (sim.body !== E || (Math.hypot(sim.x, sim.y) - E.R) > E.atmo * 1.15);
    function events() {
      sim.events.splice(0).forEach(e => {
        if (RL.Missions && RL.Missions.active) RL.Missions.event(e, sim);   // v0.14
        if (e.type === 'booster-sep') { (e.ids || [e.id]).forEach(id => { sepReal[id] = performance.now(); }); if (e.pod && !saidHeavyPod) heavyAt = performance.now() + 1500;   // v0.18.1：左右 いっしょに はずれた よこの 段は 1つの できごと
           sepFlash = 25; A.tone(180, 0.25, 'square', 0.15); if (e.pod) A.say('よこの だん、きりはなし！', null, { interrupt: false }); else if (!saidSep) { saidSep = true; A.say('ブースター、きりはなし！', null, { interrupt: false }); } }
        if (e.type === 'stage-sep' && e.surface) { sepFlash = 20; A.tone(220, 0.3, 'square', 0.18); A.say('きりはなし！ したの だんは つきに のこるよ。', null, { interrupt: true }); fuelFlash = 1; }
        else if (e.type === 'stage-sep') { stageReal[e.i] = performance.now(); sepFlash = 40; A.tone(220, 0.3, 'square', 0.18); setTimeout(() => A.tone(140, 0.4, 'square', 0.12), 140);
          A.say((STAGE_NAME[e.i] || '') + 'だん、きりはなし！', null, { interrupt: false });
          setTimeout(() => { if (!ended && sim.stages[e.i + 1] && sim.stages[e.i + 1].eng + sim.stages[e.i + 1].veng > 0) { [523, 784].forEach((f, k) => setTimeout(() => A.tone(f, 0.18, 'triangle', 0.15), k * 90)); A.say((IGN_NAME[e.i + 1] || '') + '、てんか！', null, { interrupt: false }); } }, 400); }
        if (e.type === 'space' && !lastCp) saveCp('space', true);   // v0.14.1：うちゅうに でた ところも ⏪ で もどれる（あとで もっと いい ところが あれば うわがき）
        if (e.type === 'space') { [784, 1175].forEach((f, i) => setTimeout(() => A.tone(f, 0.3, 'sine', 0.15), i * 150)); A.say('うちゅうに でたよ！', null, { interrupt: false }); }
        if (e.type === 'engine-off') { A.tone(400, 0.12, 'square', 0.1); setTimeout(() => A.tone(260, 0.2, 'square', 0.1), 110); }
        if (e.type === 'engine-on') { A.tone(523, 0.1, 'triangle'); setTimeout(() => A.tone(784, 0.15, 'triangle'), 90); }
        if (e.type === 'soi') {
          // v0.17.1：ミッション（quiet）では ブレーキの おしえを ださない（4-3・4-4 で ブレーキすると 月を まわって おわらなくなる）
          if (e.body === 'moon' && sim.liquidLeft()) {   // v0.10：ブレーキの おしえ
            saidPeri = quiet(); saveCp('soi');
            if (!quiet()) A.say('つきの じゅうりょくけんに はいったよ！ つきに いちばん ちかづいたら、うしろむきに ふかすと、つきを まわれるよ。', null, { interrupt: false });
          } else if (!quiet()) A.say(e.body === 'moon' ? 'つきの じゅうりょくけんに はいったよ！' : 'ちきゅうの じゅうりょくけんに もどったよ。', null, { interrupt: false });
        }
        if (e.type === 'dir') { A.tone(e.dir === 'retro' ? 440 : 660, 0.1, 'triangle'); if (!quiet()) A.say(e.dir === 'retro' ? 'うしろむき。ブレーキ！' : 'まえむき。かそく！'); }   // v0.18：ミッションでは いわない（「ブレーキ！」で ほのおの ボタンを おしてしまう）
        // v0.11 月着陸
        if (e.type === 'near') { saveCp('near'); view = 'auto';
          if (!saidNear) { saidNear = true;
            const ch = sim.chutes() && !sim.chute && sim.body === E;
            if (!quiet()) A.say(ch ? 'じめんが ちかいよ！ パラシュートを ひらこう。 エンジンで おりても いいよ。' : 'じめんが ちかいよ！ うしろむきで エンジン。ゆっくり おりよう。', null, { interrupt: true });
            if (ch) { bChute.classList.add('hint'); setTimeout(() => bChute.classList.remove('hint'), 4000); } } }
        // v0.12 パラシュート
        if (e.type === 'chute-deploy') { rocket.classList.add('chuteOut'); A.tone(500, 0.1, 'triangle'); setTimeout(() => A.tone(380, 0.25, 'sine', 0.15), 100); A.say('パラシュート、ひらけ！', null, { interrupt: true }); }
        if (e.type === 'chute-open') { [523, 784].forEach((f, k) => setTimeout(() => A.tone(f, 0.15, 'triangle'), k * 90)); A.say('ひらいた！ ふんわり おりていくよ。', null, { interrupt: false }); }
        if (e.type === 'chute-torn') { tornAt = performance.now(); rocket.classList.add('chuteOut'); A.tone(160, 0.35, 'sawtooth', 0.15); A.say('はやすぎて、パラシュートが やぶれちゃった！ もっと ゆっくりに なってから ひらこう。', null, { interrupt: true }); }
        if (e.type === 'chute-noair') { A.tone(150, 0.15, 'square', 0.08); A.say(sim.body === E ? 'ここは くうきが ないから、パラシュートは ひらかないよ。 てんせんの したまで まってね。' : 'つきには くうきが ないから、パラシュートは ひらかないよ。 エンジンで おりよう。', null, { interrupt: true }); }
        // v0.13 月面・離陸
        if (e.type === 'surface') { idleAt = performance.now(); rocket.classList.add('legsOut', 'landedOk'); saveCp('surface', true);
          [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => A.tone(f, 0.22, 'triangle'), i * 120));
          if (!quiet()) A.say('つきに ちゃくりく！ はたを たてたり、ほのおの ボタンで ちきゅうに かえったり できるよ。 おわるときは ひだりうえの ゴールの はた。', null, { interrupt: true });   // v0.19：ミッション（quiet）では あんないに まかせる
          bEng.classList.add('hint'); setTimeout(() => bEng.classList.remove('hint'), 4000); }
        if (e.type === 'moon-liftoff') { rocket.classList.remove('landedOk'); A.rumble(1.5); A.say('つきから りりく！', null, { interrupt: true }); }
        if (e.type === 'ascent-done') { [659, 880, 1047].forEach((f, i) => setTimeout(() => A.tone(f, 0.2, 'triangle'), i * 110));
          if (!quiet()) A.say('つきを まわったよ！ まえむきで エンジンを つけて、みどりの せんが でたら とめよう。 ちきゅうに かえれるよ。', null, { interrupt: true }); }
        if (e.type === 'legs') { rocket.classList.add('legsOut'); [330, 440].forEach((f, i) => setTimeout(() => A.tone(f, 0.12, 'square', 0.08), i * 120)); }
        if (e.type === 'stage-sep') { fuelFlash = 1; }
        if (e.type === 'class' && e.cls === 'moonOrbit' && e.old !== 'moonOrbit' && !sim.moonLanded) { [659, 880, 1047, 1319].forEach((f, i) => setTimeout(() => A.tone(f, 0.2, 'triangle'), i * 110));
          A.say('やった！ つきを まわる きどうに のったよ！' + (sim.isPowered() ? ' エンジンを とめよう。' : ''), null, { interrupt: true }); }
        if (e.type === 'class') {
          const wasOrbit = ORBIT_CLS.includes(e.old);
          if (['low', 'high'].includes(e.cls) && !wasOrbit && !saidOrbit && !quiet()) { saidOrbit = true; [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => A.tone(f, 0.2, 'triangle'), i * 110));
            A.say('やった！ ちきゅうを まわる きどうに のったよ！' + (sim.isPowered() && sim.liquidLeft() ? ' エンジンを とめると、ずっと まわりつづけるよ。' : ''), null, { interrupt: false });
            if (sim.isPowered()) { bEng.classList.add('hint'); setTimeout(() => bEng.classList.remove('hint'), 4000); } }
          if (e.cls === 'toMoon' && e.old !== 'toMoon' && !saidEnc && !quiet()) A.say('つきの たかさまで とどくよ！ つきに であえるかな？', null, { interrupt: false });
          if (e.cls === 'escape' && sim.body === E) A.say('ちきゅうから にげだせる はやさに なった！', null, { interrupt: false });
        }
      });
    }
    // v0.12：anchor＝地面ちかく（着陸）。ロケットを ANCH_Y に おき、のこっている 部分の 下はしから 高さぶん 下に 地面
    function nearView(h, rangeD, anchor) {
      const gy = anchor ? ANCH_Y + bottomOff() + Yh(h) : ground + Math.max(0, Yh(h) - room), cam = gy - ground;
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
      if (anchor) { boomY = gy; return { ty: ANCH_Y }; }
      return { ry: startY - Math.min(Yh(h), room) };
    }
    // ---- v0.11 月の ちかくの画面：くろい 空・灰色の 地面・クレーター・とおくに 地球 ----
    //  v0.11.1：ロケットの まんなかを MOON_Y に おき、のこっている 部分の 下はしから 高さぶん 下に 地面（高さ 0 で ぴったり つく）
    const craters = Array.from({ length: 12 }, (_, i) => ({ x: Math.random() * 1.6, y: 0.15 + Math.random() * 0.7, r: 8 + Math.random() * 26 }));
    const MOON_Y = H * 0.45, ANCH_Y = MOON_Y;
    const bottomOff = () => box ? (box.r1 - box.cy) * cs : RL.CFG.ROWS * cs / 2;
    function moonView(h, rangeD) {
      const gy = MOON_Y + bottomOff() + Yh(h);
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#fff'; stars.forEach(st => { g.beginPath(); g.arc(st.x, st.y, st.r, 0, 7); g.fill(); });
      drawEarth(g, W * 0.78, H * 0.2, 26 * u, E.rot * sim.t, 29 * u);
      if (gy < H + 50) {
        const gr = g.createLinearGradient(0, gy, 0, H); gr.addColorStop(0, '#b9b9b4'); gr.addColorStop(1, '#6d6d6a');
        g.fillStyle = gr; g.fillRect(0, gy, W, Math.max(0, H - gy));
        craters.forEach(c => { const x = (((c.x * W + rangeD * px * 1.4) % (W * 1.6)) + W * 1.6) % (W * 1.6) - W * 0.3, y = gy + 12 + c.y * Math.max(40, H - gy);
          if (y > H + 40) return; g.fillStyle = 'rgba(70,70,70,.45)'; g.beginPath(); g.ellipse(x, y, c.r * u * 1.6, c.r * u * 0.5, 0, 0, 7); g.fill();
          g.strokeStyle = 'rgba(230,230,225,.6)'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y + 2, c.r * u * 1.6, c.r * u * 0.5, 0, 0.1, 3); g.stroke(); });
        g.strokeStyle = '#dcdcd6'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, gy); g.lineTo(W, gy); g.stroke();
      }
      boomY = gy;
      return { ty: MOON_Y };
    }
    const quiet = () => !!(RL.Missions && RL.Missions.active && RL.Missions.active.quiet);   // v0.14.1：ミッションの あんないと ちがう 声を ださない
    const cam = RL.Flight.rocketCam(cs); let box = null, fuelFlash = 0, hideRocket = false, tornAt = 0;
    // ---- v0.12 パラシュートの 絵（のこっている ロケットの 上） ----
    function drawChute() {
      if (!box || hideRocket) return;
      const [tx, ty] = cam.toScreen(box.cx * cs, box.r0 * cs), k = sim.chute === 'open' ? 1 : sim.chute === 'opening' ? sim.chuteOpen : 0;
      if (k > 0) {
        const R = cs * (0.9 + 1.4 * k), cy = ty - cs * (1.2 + 2.2 * k), sw = Math.sin(performance.now() / 500) * 3;
        g.save(); g.strokeStyle = '#2b3245'; g.lineWidth = 1.5;
        [-1, -0.45, 0.45, 1].forEach(f => { g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx + f * R + sw, cy); g.stroke(); });
        g.fillStyle = '#ff7a1a'; g.beginPath(); g.moveTo(tx - R + sw, cy); g.quadraticCurveTo(tx + sw, cy - R * 1.25, tx + R + sw, cy); g.closePath(); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.moveTo(tx - R * 0.35 + sw, cy); g.quadraticCurveTo(tx + sw, cy - R * 1.2, tx + R * 0.35 + sw, cy); g.closePath(); g.fill();
        g.strokeStyle = '#2b3245'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(tx - R + sw, cy); g.quadraticCurveTo(tx + sw, cy - R * 1.25, tx + R + sw, cy); g.stroke();
        g.restore();
      } else if (tornAt && performance.now() - tornAt < 1500) {   // やぶれた きれはし
        const q = (performance.now() - tornAt) / 1500;
        g.save(); g.globalAlpha = 1 - q; g.fillStyle = '#ff7a1a';
        [[-1, 0.3], [0.6, 0.5], [-0.2, 0.9], [1.1, 0.2]].forEach(([a, b2]) => { g.save(); g.translate(tx + a * cs * (1 + q * 2), ty - cs * (1 + b2) + q * q * 80); g.rotate(q * 6 * a); g.fillRect(-8, -5, 16, 10); g.restore(); });
        g.restore();
      }
    }
    function rocketDOM(ry, burnAny, dtR, pip, ty) {
      const tilt = -(Math.PI / 2 - (sim.visPt != null ? sim.visPt : sim.point));   // 東（地図で 左）へ かたむく（v0.10：見た目の 向き）
      const shake = burnAny ? 1.5 : 0;
      // のこっている部分の まんなかを 中心に かたむけ、画面の まんなかへ（切りはなしの あとも 全体が 見える）
      box = RL.Flight.remainBox(a.cells, q => {
        if (q.stackId) { const s = sim.stacks.find(x => x.id === q.stackId); if (s && !s.withStage) return s.sepT !== null; }
        return q.stage < sim.si && !(sim.surface && sim.leftStages.includes(q.stage)); }, box);
      const natural = ry + box.cy * cs;
      cam.place(rocket, box, tilt, W / 2 + (pip ? 0 : (Math.random() - 0.5) * shake), pip ? PIP_Y : ty != null ? ty : sim.lifted ? Math.max(natural, H * 0.45) : natural, dtR);
      const now = performance.now();
      rocket.querySelectorAll('.flame').forEach(f => {
        let on;
        if (f.dataset.stackFlame) { const s = sim.stacks.find(x => x.id === f.dataset.stackFlame); on = !!s && s.sepT === null && s.ignT !== null && sim.t >= s.ignT && s.fuel > 0 && (!s.pod || (sim.engineOn && sim.burnC)); }
        else on = +f.dataset.stage === sim.si && sim.burnC;
        if (!sim.lifted && sim.t < 0.01) on = false;
        f.style.display = on ? 'block' : 'none';
        const th = f.dataset.kind === 'b' ? 1 : 0.3 + 0.7 * Math.sqrt(sim.throttle == null ? 1 : sim.throttle);   // v0.11：しぼると ほのおが 小さい
        if (on && f.dataset.kind === 'v') { const w0 = +f.dataset.w, h0 = +f.dataset.h, kx = (0.5 + 0.5 * sim.vpow) * (0.6 + 0.4 * th), ky = (0.35 + 0.9 * sim.vpow) * th;
          f.style.width = w0 * kx + 'px'; f.style.left = (+f.dataset.l + w0 * (1 - kx) / 2) + 'px'; f.style.height = h0 * ky + 'px'; }
        else if (on && f.dataset.kind === 'e') f.style.height = (+f.dataset.h) * th + 'px';
      });
      rocket.querySelectorAll('[data-stack]').forEach(b => {
        const s = sim.stacks.find(x => x.id === b.dataset.stack); if (!s || s.sepT === null || s.withStage || !sepReal[s.id]) return;
        const sd = +b.dataset.side, tt = (now - sepReal[s.id]) / 1000 * 1.2;
        b.style.transform = `translate(${sd * (12 + tt * 60)}px,${tt * tt * 180 + tt * 40}px) rotate(${sd * tt * 200}deg)`; b.style.opacity = Math.max(0, 1 - tt / 2.5);
      });
      // v0.13：月に のこした 段（✂️）。月の 地面ちかくの 画面では 地面に のこる（ロケットと いっしょに うごかない）
      if (sim.leftStages.length) {  
        sim.leftStages.forEach(i => rocket.querySelectorAll(`.p[data-stage="${i}"]`).forEach(b => { b.style.transform = ''; b.style.opacity = sim.surface ? '' : '0'; })); }
      Object.keys(stageReal).forEach(i => {
        const tt = (now - stageReal[i]) / 1000 * 1.2;
        rocket.querySelectorAll(`.p[data-stage="${i}"]`).forEach(b => {
          const s = b.dataset.stack && sim.stacks.find(x => x.id === b.dataset.stack); if (s && !s.withStage) return;
          b.style.transform = `translateY(${tt * tt * 160 + tt * 30}px) rotate(${(i % 2 ? -1 : 1) * tt * 25}deg)`; b.style.opacity = Math.max(0, 1 - tt / 3);
        });
      });
      // けむり（小窓のときは 出さない）
      if (pip) return;
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
      if (sim.body !== E && pr && pr.home) { cx = ms.x / 2; cy = ms.y / 2; need = sim.bodies.moon.orbitR * 0.62; }   // v0.13：かえれる 線 ＝ 地球と 月が 両方 見える
      else if (sim.body !== E) { cx = ms.x; cy = ms.y; need = Math.max(Math.hypot(sim.x, sim.y) * 1.3, sim.body.R * 2.5);
        if (pr) pr.segs.forEach(sg => { if (!sg.after) sg.pts.forEach(p => { need = Math.max(need, Math.min(Math.hypot(p[0] - ms.x, p[1] - ms.y) * 1.1, sim.body.soi * 1.2)); }); }); }
      else {
        const r = Math.hypot(sim.x, sim.y); need = Math.max(E.R * 1.35, r * 1.2);
        if (pr) { let m = 0; pr.segs.forEach(sg => sg.pts.forEach(p => { m = Math.max(m, Math.hypot(p[0], p[1])); })); if (pr.enc) m = Math.max(m, Math.hypot(pr.enc.x, pr.enc.y) + sim.bodies.moon.soi); need = Math.max(need, Math.min(m * 1.1, E.soi)); }
      }
      // v0.8.4：ちかくの画面の 小さな地図は ズームなしの 自動の大きさ（軌道ぜんたいが 見える）
      const kA = Math.min(1, dtR * 2.5), needA = Math.max(sim.body.R * 1.15, Math.min(E.soi * 1.1, need));
      V.ra = Math.exp(Math.log(V.ra) + (Math.log(needA) - Math.log(V.ra)) * kA);
      // v0.8.2：ズーム（自動の大きさ × 倍率）。ちかすぎ・とおすぎは とめる
      need = Math.max(sim.body.R * 1.15, Math.min(E.soi * 1.1, need * Math.exp(Z.log)));
      const k = Math.min(1, dtR * (Z.pins.size > 1 ? 8 : 2.5));
      V.r = Math.exp(Math.log(V.r) + (Math.log(need) - Math.log(V.r)) * k);
      V.cx += (cx - V.cx) * k; V.cy += (cy - V.cy) * k;
    }
    function frame(ts) {
      if (ended === 'abort') return;
      if (!t0) { t0 = ts; prev = ts; }
      const el = ts - t0, dtR = Math.min(0.05, (ts - prev) / 1000); prev = ts;
      $('count').textContent = el < pre ? String(3 - Math.floor(el / 700)) : '';
      if (pause && pause.until === 'speech' && ts > pause.at) speechDone();
      if (el > pre && !sim.done && !pause) {
        const target = sim.autoWarp();
        // 上げるのは ゆっくり（v0.12：燃やしている 間は もっと ゆっくり ＝ 急に 速く ならない）
        warp = target > warp ? Math.min(target, sim.isPowered() ? warp * 1.02 + 0.003 : warp * 1.06 + 0.05) : target;
        // v0.10：月と であう 予測に かわる すぐ手前は とても ゆっくり（とめる タイミングが 2秒くらい ある）
        if (warp < 0.9 && !saidSlow) { saidSlow = true; [700, 520].forEach((f, i) => setTimeout(() => A.tone(f, 0.12, 'sine', 0.1), i * 120)); }   // はじめて 🐢 に なった
        sim.advance(dtR * warp);
      }
      events(); engUI(); dirUI(); chuteUI(); sepUI();
      // v0.14 ミッション：ヒント（声・ボタンの 点滅）と とちゅうで クリア
      //  v0.14.6：pause の ある あんないは とめて 話す（声が おわるまで／ボタンを おすまで）。とめている 間は つぎの あんないを しらべない
      if (RL.Missions && RL.Missions.active && !ended && el >= pre && !pause) RL.Missions.tick(sim).forEach(h => {
        if (h.clear) { [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => A.tone(f, 0.2, 'triangle'), i * 100)); A.say('ミッション クリア！', null, { interrupt: true }); sim.missionEnd(); return; }
        const txt = h.say.join(' '), pz = typeof h.pause === 'function' ? h.pause(sim) : h.pause, my = { until: pz, end: h.end, at: ts + (1500 + txt.length * 190) / RL.CFG.VOICE_RATE };   // at：声が とちゅうで きれても ここで すすむ
        if (pz) { pause = my; A.tone(440, 0.08, 'triangle'); }
        A.say(txt, () => { if (pause === my && my.until === 'speech') speechDone(); }, { interrupt: true, lock: !!pz });   // v0.18 lock：とめて 話す ときは はなし おわるまで ボタンを おせない（とめない あんないは うごいている ので ロックしない）   // 光らせるのは missions.js（つぎの あんないまで ずっと）
      });
      if (heavyAt && ts > heavyAt && !ended) { heavyAt = 0;
        if (!saidHeavyPod && !quiet() && sim.body === E && sim.isPowered() && sim.rho > 0 && sim.weight > 0 && sim.thrust / sim.weight < 0.95) { saidHeavyPod = true;
          A.say('よこの だんを すてたら、まんなかの エンジン だけでは おもすぎて、あがれない！ まんなかを かるく するか、よこの エンジンに せんを つけてみよう。', null, { interrupt: false }); } }
      // v0.13 月面で なにも しない とき：1回だけ さそう
      if (sim.surface && !ended && !saidIdle && idleAt && ts - idleAt > (O.MOON_IDLE_SEC || 60) * 1000) { saidIdle = true; A.say('ほのおの ボタンで ちきゅうに かえろう。 おわるときは ひだりうえの ゴールの はた。'); }
      // v0.13 くうきに 入る（🔥 の 光・声）。月から かえる ときは くうきの 手前を ⏪ に おぼえる
      let hot = 0;
      if (sim.body === E && sim.lifted && !sim.done) { const hh = Math.hypot(sim.x, sim.y) - E.R, wv = Math.hypot(sim.vx + E.rot * sim.y, sim.vy - E.rot * sim.x);
        if (hh < E.atmo) { hot = Math.max(0, Math.min(1, (wv - O.REENTRY.HOT) / 150)) * Math.min(1, (E.atmo - hh) / 40);
          if (hot > 0.2 && !saidHot) { saidHot = true; A.tone(200, 0.4, 'sawtooth', 0.08); if (!quiet()) A.say('くうきに はいった！ あつい！', null, { interrupt: true }); }
          if (saidHot && !saidOpen && sim.chutes() && !sim.chute && wv < O.CHUTE.V_TEAR * 0.95 && !quiet()) { saidOpen = true; A.say('いまだ！ パラシュートを ひらいて！', null, { interrupt: true }); bChute.classList.add('hint'); setTimeout(() => bChute.classList.remove('hint'), 4000); } }
        else if (sim.moonLanded && !savedAtmo && hh < E.atmo * 1.6 && (sim.vx * sim.x + sim.vy * sim.y) < 0) { savedAtmo = true; saveCp('atmo', true); } }
      sim.hot = hot;
      bRew.style.visibility = lastCp && sim.lifted && !ended ? 'visible' : 'hidden';
      // v0.10：見た目の 向きは 1秒に 4ラジアンまで（くるっと まわる）
      if (sim.visPt == null || !sim.lifted || sim.done) sim.visPt = sim.point;
      else { const dd = Math.atan2(Math.sin(sim.point - sim.visPt), Math.cos(sim.point - sim.visPt)), mx = 4 * dtR; sim.visPt += Math.max(-mx, Math.min(mx, dd)); }
      // v0.10：月に いちばん ちかづく 少し前に「いまだ！」（ブレーキの タイミング）
      if (!saidPeri && sim.body.id === 'moon' && !sim.isPowered() && sim.liquidLeft() && !sim.done && !sim.near) {
        const el = sim.elements(), rr = Math.hypot(sim.x, sim.y), vr = (sim.vx * sim.x + sim.vy * sim.y) / rr;
        if (el && vr < 0 && rr < Math.max(el.rp, sim.body.R) * 1.08 + 150) { saidPeri = true; bDir.classList.add('hint'); bEng.classList.add('hint');
          setTimeout(() => { bDir.classList.remove('hint'); bEng.classList.remove('hint'); }, 4000);
          A.say(el.rp > sim.body.R ? 'いまだ！ うしろむきに して、エンジン！' : 'このままだと つきに ぶつかるよ！ うしろむきに して、エンジン！', null, { interrupt: true }); }
      }
      // v0.11：月の 地面ちかくの おしえ（はやすぎる／ういてる）
      //  v0.12：地球でも。パラシュートが ひらいて いる ときは いわない
      if (sim.near && !sim.done && !(sim.chute === 'open' || sim.chute === 'opening')) {
        const LD = LDb(), rr = Math.hypot(sim.x, sim.y), hh = rr - sim.body.R, gg = sim.body.mu / (rr * rr), vd = Math.max(0, -(sim.vx * sim.x + sim.vy * sim.y) / rr);
        if (!sim.isPowered() && sim.liquidLeft() && !(RL.Missions && RL.Missions.active && RL.Missions.active.noSlow) && vd * vd / (2 * (LD.TWR - 1) * gg) > hh * 0.8 && ts - warnAt > 4000) {   // v0.17.1：4-4（ぶつけて よい）では いわない
          const td = RL.Predict.touchdown(sim), ok = LD.V_DOWN * (sim.legs().n ? LD.LEG_K : 1);
          if (!td || td.vDown > ok) { warnAt = ts; A.say(sim.dir === 'retro' ? 'はやすぎる！ エンジン！' : 'はやすぎる！ うしろむきで エンジン！', null, { interrupt: true });
            bEng.classList.add('hint'); setTimeout(() => bEng.classList.remove('hint'), 2500); }
        }
        if (sim.hover && !saidHover && LDb().HOVER_VD) { saidHover = true; if (!quiet()) A.say('ゆっくり おりているよ。 エンジンは つけた まま。 あしが あれば ふんわり おりられるよ。', null, { interrupt: true }); }
      else if (sim.hover && !saidHover) { saidHover = true; A.say('ういてるよ！ エンジンを とめると おちるよ。メーターの さんかくが みどりの ときに とめると、ふんわり おりられるよ。', null, { interrupt: true }); }
      }
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
      // v0.13 ちきゅうに かえれる 線
      if (pr && pr.home && sim.body !== E && sim.isPowered() && !homeSaid && !quiet()) { homeSaid = true; [523, 784, 1047].forEach((f, i) => setTimeout(() => A.tone(f, 0.18, 'triangle'), i * 100)); A.say('ちきゅうに かえれる せんだ！ とめよう！', null, { interrupt: true }); bEng.classList.add('hint'); setTimeout(() => bEng.classList.remove('hint'), 3000); }
      if (pr && !pr.home) homeSaid = false;
      updateView(pr, dtR);
      const h = Math.hypot(sim.x, sim.y) - sim.body.R, useMap = view === 'map' || (view === 'auto' && autoMap());
      bDone.style.visibility = (!sim.done && (sim.surface || (ORBIT_CLS.includes(sim.cls) && !sim.isPowered()))) ? 'visible' : 'hidden';
      // ズームの ボタン：地図のときだけ（ちかくの画面では 左上に 小さな地図が あるため）
      Z.on = useMap && !ended; zctl.style.display = Z.on ? 'flex' : 'none';
      if (Z.on) { $('btnZin').classList.toggle('off', Z.log <= Z_IN + 1e-6); $('btnZout').classList.toggle('off', Z.log >= Z_OUT - 1e-6); }
      if (useMap) {
        drawMap(g, V, sim, pr, trail, { x0: 0, y0: 0, w: W, h: H }, false, WD);
        // v0.8.4：右上に ロケットの 小窓（ほのお・切りはなし・かたむき が 見える）。おすと ちかくの画面へ
        if (sim.lifted && !ended) {
          const P = pipBox();
          g.fillStyle = RL.Flight.skyAt(sim.body === E ? h : 9999); g.fillRect(P.x, P.y, P.s, P.s);
          rocket.style.display = 'block'; pipOn(P);
          rocketDOM(0, false, dtR, true);
          g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.strokeRect(P.x, P.y, P.s, P.s);
          Object.assign(bPip.style, { display: 'block', left: P.x + 'px', top: P.y + 'px', width: P.s + 'px', height: P.s + 'px' });
        } else { rocket.style.display = 'none'; pipOff(); }
      } else {
        pipOff();
        rocket.style.display = hideRocket ? 'none' : 'block';   // v0.11.1：月で ぶつかったら ロケットは けして 💥 だけ
        const ph = Math.atan2(sim.y, sim.x) - (O.SITE + E.rot * sim.t), rangeD = Math.atan2(Math.sin(ph), Math.cos(ph)) * E.R;
        const onLand = sim.near || (sim.done && ['landed', 'hit', 'ground'].includes(sim.done.type) && boomY != null) || (sim.done && sim.done.type === 'landed');
        boomY = null;
        const { ry, ty } = onLand && sim.body !== E ? moonView(Math.max(0, h), Math.atan2(sim.y, sim.x) * sim.body.R)
          : nearView(sim.body === E ? Math.max(0, h) : 9999, rangeD, onLand && sim.body === E);
        rocketDOM(ry, sim.burnC || sim.boost, dtR, false, ty);
        drawChute();
        // v0.13 くうきに 入る ときの 🔥 の 光（ロケットの 下はし）／月面の 🚩
        if (sim.hot > 0 && box && !hideRocket) { const [hx, hy] = cam.toScreen(box.cx * cs, box.cy * cs), R0 = cs * (2 + 2 * sim.hot);   // ロケット ぜんたいを つつむ
          const gr = g.createRadialGradient(hx, hy, 0, hx, hy, R0 * 1.6); gr.addColorStop(0, `rgba(255,240,180,${0.9 * sim.hot})`); gr.addColorStop(0.4, `rgba(255,120,20,${0.7 * sim.hot})`); gr.addColorStop(1, 'rgba(255,60,0,0)');
          g.fillStyle = gr; g.beginPath(); g.arc(hx, hy, R0 * 1.6, 0, TAU); g.fill(); }
        // 月面に のこした もの：地面に そって うごく（クレーターと 同じ）
        if (sim.body !== E && boomY != null && sim.surfAng != null) {
          const gx = W / 2 + (Math.atan2(sim.y, sim.x) - sim.surfAng) * sim.body.R * px * 1.4;
          if (sim.flagPlanted) { g.font = `${40 * u}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText('\u{1F6A9}', gx + RW * 0.9 + 30 * u, boomY + 4); }
          if (sim.leftStages.length && !sim.surface) {   // ✂️ で のこした 段（かんたんな 着陸機の 絵）
            const w2 = cs * 1.4, h2 = cs * 1.6, y0 = boomY - h2 - cs * 0.5;
            g.strokeStyle = '#2b3245'; g.lineWidth = 3; g.fillStyle = '#ffd54a';
            g.beginPath(); g.moveTo(gx - w2 * 0.4, y0 + h2); g.lineTo(gx - w2 * 0.9, boomY); g.moveTo(gx + w2 * 0.4, y0 + h2); g.lineTo(gx + w2 * 0.9, boomY); g.stroke();
            g.fillRect(gx - w2 / 2, y0, w2, h2); g.strokeRect(gx - w2 / 2, y0, w2, h2);
            g.fillStyle = '#7a849a'; g.beginPath(); g.moveTo(gx - w2 * 0.25, y0 + h2); g.lineTo(gx + w2 * 0.25, y0 + h2); g.lineTo(gx + w2 * 0.4, boomY - 2); g.lineTo(gx - w2 * 0.4, boomY - 2); g.closePath(); g.fill(); g.stroke(); } }
        // 小さな地図（予測の線が 地球を ひとまわり するのが 見える）
        const sz = Math.min(W, H) * 0.34, VV = { r: Math.max(E.R * 1.3, V.ra), cx: V.cx, cy: V.cy, u: u * 0.6, stars: [] };
        drawMap(g, VV, sim, pr, trail, { x0: 12, y0: 86, w: sz, h: sz }, true, WD);
      }
      drawTop(g, W, sim, el > pre ? warp : 1, u);
      if (pause && !ended) { g.save(); g.globalAlpha = 0.7 + 0.3 * Math.sin(ts / 200); g.fillStyle = 'rgba(0,0,30,.6)'; g.beginPath(); g.arc(W / 2, 64 * u, 40 * u, 0, TAU); g.fill();
        g.fillStyle = '#fff'; g.fillRect(W / 2 - 16 * u, 46 * u, 11 * u, 36 * u); g.fillRect(W / 2 + 5 * u, 46 * u, 11 * u, 36 * u); g.restore(); }   // v0.14.6 いちじ停止の しるし
      drawSpeed(g, W, H, sim, u);
      if (a.fuel > 0) { drawFuel(g, H, sim, u);
        if (fuelFlash > 0) { g.fillStyle = `rgba(255,255,255,${fuelFlash * 0.7})`; g.fillRect(14 * u, H * 0.42, 30 * u, 130 * u); fuelFlash = Math.max(0, fuelFlash - dtR * 1.5); } }   // v0.11.1：満タンに もどる ぴかっ
      if (sim.near && !sim.done) drawLandMeter(g, H, sim, u);
      if (sepFlash > 0) { g.fillStyle = `rgba(255,255,255,${sepFlash / 60})`; g.fillRect(0, 0, W, H); sepFlash--; }
      // おわり
      if (sim.done && !ended) {
        ended = sim.done.type; endAt = ts;
        if (['ground', 'hit'].includes(ended)) { A.tone(120, 0.5, 'sawtooth', 0.15); A.rumble(1); if (boomY != null) { hideRocket = true; rocket.style.display = 'none'; } }
        if (ended === 'landed') { rocket.classList.add('legsOut', 'landedOk'); [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => A.tone(f, 0.22, 'triangle'), i * 120)); }
      }
      if (ended && ended !== 'abort') {
        if (['ground', 'hit'].includes(ended)) { g.font = `${120 * u}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('💥', W / 2, boomY != null ? boomY - 40 * u : H / 2); }   // v0.11.1：月の 地面では 地面の ところで
        if (ended === 'landed') { g.font = `${90 * u}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('\u{1F9D1}\u200D\u{1F680}', W / 2, H * 0.15); }
        if (ts - endAt > (ended === 'landed' ? 3000 : 1300)) { cleanup(); onDone(sim); return; }
      }
      raf = requestAnimationFrame(frame);
    }
    cur = sim;
    if (resume) syncParts();
    if (sim.surface && !resume) { rocket.classList.add('legsOut', 'landedOk'); idleAt = performance.now(); }   // v0.19 6-1：月面から はじまる
    raf = requestAnimationFrame(frame);
    return sim;
  }
  // lastRun（v0.11）：さいごの 飛行の ⏪ の 情報（結果画面から つづける ため）
  // v0.14.6：ボタンを おしたら いちじ停止を とく（main.js の 飛行画面の クリックから）
  function unpause(id) { if (pause && pause.until === id) pause = null; }
  return { run, predict, drawSat, drawMoon, unpause, get paused() { return !!pause; }, get sim() { return cur; }, get lastRun() { return lastRun; } };
})();
