// はっしゃの演出：空・けむり・メーター・力の矢印は canvas、ロケットは SVG部品をそのまま動かす
RL.Flight = (function () {
  const $ = id => document.getElementById(id);
  let raf = null;
  const hex = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
  const STAGE_NAME = ['だいいち', 'だいに', 'だいさん', 'だいよん', 'だいご'], IGN_NAME = ['', 'にだんめ', 'さんだんめ', 'よんだんめ', 'ごだんめ'];
  function skyAt(h) {
    const Z = RL.CFG.ZONES; let a = Z[0], b = Z[Z.length - 1];
    for (let i = 0; i < Z.length - 1; i++) if (h >= Z[i].h && h < Z[i + 1].h) { a = Z[i]; b = Z[i + 1]; }
    const t = b.h > a.h ? Math.min(1, (h - a.h) / (b.h - a.h)) : 0, x = hex(a.sky), y = hex(b.sky);
    return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`;
  }

  function buildRocket(a, cs) {
    const el = $('flyRocket'); el.innerHTML = ''; el.className = '';
    el.style.width = RL.CFG.COLS * cs + 'px'; el.style.height = RL.CFG.ROWS * cs + 'px';
    a.cells.forEach(q => {
      if (q.ctx.loose) return;                      // くっついていない ブースターは のせない
      const d = document.createElement('div'); d.className = 'p'; d.dataset.stage = q.stage;
      Object.assign(d.style, { left: q.c * cs + 'px', top: q.r * cs + 'px', width: cs + 'px', height: cs + 'px' });
      d.innerHTML = RL.drawPart(q.k, q.ctx); el.appendChild(d);
      if (q.stackId) {
        const s = q.stack; d.dataset.stack = q.stackId;
        d.dataset.side = s.c < (RL.CFG.COLS - 1) / 2 ? -1 : 1;
        d.style.transformOrigin = `${(s.c - q.c + 0.5) * cs}px ${((s.r0 + s.r1 + 1) / 2 - q.r) * cs}px`;
      }
      const isEng = RL.ENGINES[q.k], isB = q.k === 'booster' && !q.ctx.down;
      if (isEng || isB) {
        const f = document.createElement('div'); f.className = 'flame'; f.innerHTML = q.k === 'vengine' ? RL.VFLAME : RL.FLAME;
        f.dataset.kind = isB ? 'b' : q.k === 'vengine' ? 'v' : 'e'; f.dataset.stage = q.stage; if (isB) f.dataset.stackFlame = q.stackId;
        const fw = q.k === 'vengine' ? 0.95 : 0.76;
        Object.assign(f.style, { left: q.c * cs + cs * (1 - fw) / 2 + 'px', top: (q.r + 1) * cs - 4 + 'px', width: cs * fw + 'px', height: cs * 1.1 + 'px' });
        f.dataset.l = q.c * cs + cs * (1 - fw) / 2; f.dataset.w = cs * fw; f.dataset.h = cs * 1.1;
        el.appendChild(f);
      }
    });
    return el;
  }

  // メーター：針（緑→黄→赤）＋ デジタル数字。右上に高さと時計、右はしに高さのはしご。u＝画面の大きさの倍率
  let shownSpeed = 0;
  function drawMeters(g, W, H, spd, h, sec, best, u) {
    const MAX = RL.CFG.SPEED_MAX, R = 90 * u, cx = R + 30 * u, cy = H - 120 * u;
    shownSpeed += (spd - shownSpeed) * 0.35;
    g.save();
    g.fillStyle = 'rgba(0,0,20,.55)'; g.beginPath(); g.arc(cx, cy, R + 14 * u, Math.PI, 0); g.lineTo(cx + R + 14 * u, cy + 78 * u); g.lineTo(cx - R - 14 * u, cy + 78 * u); g.closePath(); g.fill();
    [['#3ecf5a', 0, .5], ['#ffd54a', .5, .8], ['#ff5a5a', .8, 1]].forEach(([c, a0, a1]) => { g.lineWidth = 16 * u; g.strokeStyle = c; g.beginPath(); g.arc(cx, cy, R, Math.PI + Math.PI * a0, Math.PI + Math.PI * a1); g.stroke(); });
    g.strokeStyle = '#fff'; g.lineWidth = 3 * u;
    for (let i = 0; i <= 10; i++) { const an = Math.PI + Math.PI * i / 10, l = (i % 5 ? 20 : 28) * u; g.beginPath(); g.moveTo(cx + Math.cos(an) * (R - 12 * u), cy + Math.sin(an) * (R - 12 * u)); g.lineTo(cx + Math.cos(an) * (R - l), cy + Math.sin(an) * (R - l)); g.stroke(); }
    const r = Math.min(1, shownSpeed / MAX), an = Math.PI + Math.PI * r;
    g.strokeStyle = '#ff3b3b'; g.lineWidth = 6 * u; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(an) * (R - 16 * u), cy + Math.sin(an) * (R - 16 * u)); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, 9 * u, 0, 7); g.fill();
    g.fillStyle = '#071a0b'; g.fillRect(cx - 82 * u, cy + 16 * u, 164 * u, 54 * u);
    g.font = `bold ${40 * u}px "Courier New",monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(80,255,120,.15)'; g.fillText('88888', cx, cy + 44 * u);
    g.fillStyle = r > .8 ? '#ff6b6b' : r > .5 ? '#ffd54a' : '#5aff7a'; g.fillText(String(Math.round(shownSpeed)).padStart(5, '0'), cx, cy + 44 * u);
    g.textAlign = 'right'; g.font = `bold ${30 * u}px "Courier New",monospace`;
    const bx = W - 70 * u;
    g.fillStyle = 'rgba(0,0,20,.55)'; g.fillRect(bx - 180 * u, 12, 172 * u, 82 * u);
    g.fillStyle = '#fff'; g.fillText('⬆' + String(Math.round(h)).padStart(5, '0'), bx - 8 * u, 12 + 26 * u);
    g.fillStyle = '#9fd8ff'; g.fillText('⏱' + sec.toFixed(1).padStart(4, '0'), bx - 8 * u, 12 + 62 * u);
    const mx = W - 22 * u, top = 20 + 100 * u, bot = H - 40 * u, yOf = v => bot - RL.hPos(v) * (bot - top);
    g.textBaseline = 'alphabetic'; g.textAlign = 'center';
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(mx - 4, top, 8, bot - top);
    g.strokeStyle = '#9fd8ff'; g.lineWidth = 2; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(mx - 14, yOf(RL.CFG.PHYS.ATMO_H)); g.lineTo(mx + 14, yOf(RL.CFG.PHYS.ATMO_H)); g.stroke(); g.setLineDash([]);
    g.font = `${20 * u}px sans-serif`; g.fillStyle = '#fff'; RL.CFG.ZONES.forEach(z => g.fillText(z.icon, mx - 20 * u, yOf(z.h) + 7 * u));
    g.font = `${26 * u}px sans-serif`; g.fillText('🚀', mx, yOf(h) + 9 * u);
    if (best) g.fillText('🏆', mx + 2, yOf(best) + 9 * u);
    g.restore();
  }
  // ちからの やじるし：上むき（オレンジ）＝ おす ちから、下むき（青）＝ おもさ
  function arrow(g, x, y0, len, up, color, u) {
    if (len < 4) return; const w = 18 * u, hd = Math.min(len, 22 * u), dir = up ? -1 : 1, y1 = y0 + dir * len;
    g.fillStyle = color; g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x - w / 2, y0); g.lineTo(x - w / 2, y1 - dir * hd); g.lineTo(x - w, y1 - dir * hd); g.lineTo(x, y1); g.lineTo(x + w, y1 - dir * hd); g.lineTo(x + w / 2, y1 - dir * hd); g.lineTo(x + w / 2, y0); g.closePath(); g.fill(); g.stroke();
  }
  function forceIcon(g, x, y, kind, u) {
    g.save(); g.translate(x, y); g.scale(u, u);
    if (kind === 'push') { g.fillStyle = '#ffd54a'; g.beginPath(); g.moveTo(-8, -10); g.quadraticCurveTo(0, 14, 0, 16); g.quadraticCurveTo(0, 14, 8, -10); g.closePath(); g.fill(); g.fillStyle = '#ff7a1a'; g.beginPath(); g.moveTo(-4, -10); g.quadraticCurveTo(0, 6, 0, 8); g.quadraticCurveTo(0, 6, 4, -10); g.fill(); }
    else { g.fillStyle = '#3a4a8a'; g.fillRect(-12, -6, 24, 16); g.fillStyle = '#fff'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('kg', 0, 2); g.fillStyle = '#3a4a8a'; g.beginPath(); g.arc(0, -8, 5, 0, 7); g.fill(); }
    g.restore();
  }

  function run(a, s, onDone) {
    shownSpeed = 0;
    const fly = $('fly'), cv = $('cv'), g = cv.getContext('2d'), A = RL.Audio, dpr = devicePixelRatio || 1;
    fly.style.display = 'block'; document.body.classList.add('flying');
    const W = innerWidth, H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const u = Math.max(0.5, Math.min(1, Math.min(W, H * 0.75) / 700));   // スマホでは小さく
    $('count').style.fontSize = (130 * u) + 'px';
    const S0 = s.samples[0] || { thrust: 0, weight: 1 }, Fref = Math.max(S0.thrust, S0.weight, 1), Lmax = H * 0.22;
    const cs = Math.min(36, W / 12, H / 20), rocket = buildRocket(a, cs), RW = RL.CFG.COLS * cs;
    let lowest = 0, topRow = RL.CFG.ROWS; a.cells.forEach(q => { if (q.ctx.loose) return; lowest = Math.max(lowest, q.r + 1); topRow = Math.min(topRow, q.r); });
    const px = H / 180, L = 150, Y = hh => px * L * Math.log(1 + Math.max(0, hh) / L);
    const ground = H * 0.82, startY = ground - 10 - lowest * cs, room = startY - H * 0.3;
    const pre = 2100, PL = RL.CFG.PLAY;
    // 燃えている間は実時間（長すぎるときだけ早める）。燃料が なくなったら 早送り
    const tb = Math.min(s.tTotal, (s.tBurnEnd || 0) + 0.3), sp1 = Math.max(1, tb / PL.MAX_SEC), r1 = tb / sp1;
    const coast = s.tTotal - tb, sp2 = coast > 0.5 ? Math.max(PL.FF_MIN, coast / PL.COAST_SEC) : 1;
    const toSim = r => r < r1 ? r * sp1 : tb + (r - r1) * sp2;
    const flightMs = (r1 + coast / sp2) * 1000 + 600;
    let ffOn = false;
    const VK = RL.CFG.SPEED_SCALE * (s.k || 1);
    const stars = Array.from({ length: 140 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.8 + 0.3 }));
    const smoke = []; let t0 = null, sepDone = {}, saidSep = false, sepFlash = 0, saidSpace = false, saidHeavy = false, stDone = {}, ignDone = {};
    const sepOf = {}; (s.seps || []).forEach(sp => sepOf[sp.id] = sp);
    const SI = s.stageInfo || [];

    A.say('さん、に、いち、はっしゃ！', null, { rate: 1.1 });
    [0, 700, 1400].forEach(d => setTimeout(() => A.tone(880, 0.15), d));
    setTimeout(() => { A.tone(1320, 0.4); A.rumble(3); }, pre);

    function frame(ts) {
      if (!t0) t0 = ts; const el = ts - t0;
      let h = 0, burn = false, boost = false, wob = 0, tilt = 0, xd = 0, fuelNow = 1, vNow = 0, stNow = 0, accNow = 0, thrNow = S0.thrust, wNow = S0.weight, si = 0, vpow = 1;
      $('count').textContent = el < pre ? String(3 - Math.floor(el / 700)) : '';
      if (el > pre) {
        const p = Math.min(1, (el - pre) / flightMs);
        stNow = toSim((el - pre) / 1000); const SS = s.samples, sm = SS[Math.min(SS.length - 1, Math.floor(stNow / RL.CFG.PHYS.DT))];
        h = sm.h; burn = sm.burn; boost = sm.boost; tilt = sm.tilt; xd = sm.x; fuelNow = sm.fuel; vNow = sm.v; accNow = sm.acc * s.k * s.k;
        thrNow = sm.thrust; wNow = sm.weight; si = sm.si; vpow = sm.vpow;
        if (h <= 0 && (burn || boost)) { wob = Math.sin(el / 30) * 4; if (!saidHeavy && stNow > 0.6) { saidHeavy = true; A.say('うーん、おもい！', null, { interrupt: false }); } }
        if (p >= 1) { s.shownVmax = (s.vMax || 0) * VK; cancelAnimationFrame(raf); fly.style.display = 'none'; document.body.classList.remove('flying'); onDone(); return; }
      } else if (el > pre - 400) { burn = SI[0] && SI[0].eng + SI[0].veng > 0; boost = (s.seps || []).some(x => x.stage === 0); vpow = RL.CFG.PHYS.VAIR; }

      const cam = Math.max(0, Y(h) - room), gy = ground + cam;
      g.fillStyle = skyAt(h); g.fillRect(0, 0, W, H);
      const sa = Math.min(1, Math.max(0, (h - 150) / 200));
      if (sa > 0) { g.fillStyle = `rgba(255,255,255,${sa})`; stars.forEach(st => { g.beginPath(); g.arc(st.x, (st.y + cam * 0.3) % H, st.r, 0, 7); g.fill(); }); }
      const ay = gy - Y(RL.CFG.PHYS.ATMO_H);
      if (ay > -10 && ay < H + 10) { g.strokeStyle = 'rgba(160,220,255,.8)'; g.lineWidth = 4; g.setLineDash([16, 12]); g.beginPath(); g.moveTo(0, ay); g.lineTo(W, ay); g.stroke(); g.setLineDash([]); }
      if (!saidSpace && s.tAtmo != null && stNow >= s.tAtmo) { saidSpace = true; [784, 1175].forEach((f, i) => setTimeout(() => A.tone(f, 0.3, 'sine', 0.15), i * 150)); RL.emit('space'); }
      g.textAlign = 'center'; g.font = `${54 * u}px sans-serif`;
      RL.CFG.ZONES.forEach((z, i) => { if (!z.h) return; const y = gy - Y(z.h); if (y > -60 && y < H + 60) g.fillText(z.icon, W * (i % 2 ? 0.2 : 0.78), y); });
      if (gy < H + 50) { g.fillStyle = '#3c8f3c'; g.fillRect(0, gy, W, H); g.fillStyle = '#ffcc00'; g.fillRect(W / 2 - RW / 2 - 20, gy - 10, RW + 40, 10); }
      // ロケット
      const ry = startY - Math.min(Y(h), room);
      const drift = Math.max(-W * 0.3, Math.min(W * 0.3, xd * px));
      const shake = (burn || boost) ? Math.min(6, 1 + Math.max(0, accNow) / 10) : 0;
      const rx = W / 2 - RW / 2 + drift + wob + (Math.random() - 0.5) * shake;
      rocket.style.transformOrigin = `${RW / 2}px ${lowest * cs}px`;
      rocket.style.transform = `translate(${rx}px,${ry}px) rotate(${tilt * 0.6}rad)`;
      // ほのお：いまの段の エンジンだけ。宇宙用は くうきの中で 小さい
      rocket.querySelectorAll('.flame').forEach(f => {
        let on;
        if (f.dataset.kind === 'b') { const sp = sepOf[f.dataset.stackFlame];
          on = el <= pre ? (el > pre - 400 && !!sp && sp.stage === 0) : (!!sp && sp.ignT != null && stNow >= sp.ignT && !(sp.t != null && stNow > sp.t)); }
        else on = el <= pre ? (el > pre - 400 && +f.dataset.stage === 0) : (+f.dataset.stage === si && burn);
        f.style.display = on ? 'block' : 'none';
        if (on && f.dataset.kind === 'v') { const w0 = +f.dataset.w, h0 = +f.dataset.h, kx = 0.5 + 0.5 * vpow, ky = 0.35 + 0.9 * vpow;   // くうきの中では 小さい
          f.style.width = w0 * kx + 'px'; f.style.left = (+f.dataset.l + w0 * (1 - kx) / 2) + 'px'; f.style.height = h0 * ky + 'px'; }
      });
      // ブースターの切りはなし（はね ごと、燃えつきた順に）
      rocket.querySelectorAll('[data-stack]').forEach(b => {
        const sp = sepOf[b.dataset.stack]; if (!sp || sp.t == null || sp.withStage) return;
        const ds = stNow - sp.t;
        if (ds > 0) { const sd = +b.dataset.side, tt = ds / (s.k || 1) * 1.2;
          b.style.transform = `translate(${sd * (12 + tt * 60)}px,${tt * tt * 180 + tt * 40}px) rotate(${sd * tt * 200}deg)`; b.style.opacity = Math.max(0, 1 - tt / 2.5);
          if (!sepDone[sp.id]) { sepDone[sp.id] = true; A.tone(180, 0.25, 'square', 0.15); setTimeout(() => A.tone(120, 0.3, 'square', 0.1), 120); sepFlash = 30;
            if (!saidSep) { saidSep = true; A.say('ブースター、きりはなし！', null, { interrupt: false }); } RL.emit('separate', sp); }
        } else { b.style.transform = ''; b.style.opacity = 1; }
      });
      // 段の切りはなし：まっすぐ下へ おちていく
      SI.forEach(info => {
        if (info.sepT == null) return;
        const ds = stNow - info.sepT;
        rocket.querySelectorAll(`.p[data-stage="${info.i}"]`).forEach(b => {
          const sp = b.dataset.stack && sepOf[b.dataset.stack];
          if (sp && !sp.withStage) return;
          if (ds > 0) { const tt = ds / (s.k || 1) * 1.2; b.style.transform = `translateY(${tt * tt * 160 + tt * 30}px) rotate(${(info.i % 2 ? -1 : 1) * tt * 25}deg)`; b.style.opacity = Math.max(0, 1 - tt / 3); }
          else { b.style.transform = ''; b.style.opacity = 1; }
        });
        if (ds > 0 && !stDone[info.i]) { stDone[info.i] = true; sepFlash = 40; A.tone(220, 0.3, 'square', 0.18); setTimeout(() => A.tone(140, 0.4, 'square', 0.12), 140);
          A.say((STAGE_NAME[info.i] || '') + 'だん、きりはなし！', null, { interrupt: false }); RL.emit('stage-sep', info); }
      });
      SI.forEach(info => {
        if (info.i === 0 || info.ignT == null || stNow < info.ignT || ignDone[info.i]) return;
        ignDone[info.i] = true; [523, 784].forEach((f, k2) => setTimeout(() => A.tone(f, 0.18, 'triangle', 0.15), k2 * 90));
        if (info.eng + info.veng > 0) A.say((IGN_NAME[info.i] || '') + '、てんか！', null, { interrupt: false });
        RL.emit('ignite', info);
      });
      // ちからの やじるし
      if (el > pre - 400) {
        const ax = rx - 24 * u, wx = rx + RW + 24 * u, mid = ry + (topRow + lowest) / 2 * cs;
        arrow(g, ax, mid, Lmax * thrNow / Fref, true, '#ff8a1e', u); forceIcon(g, ax, mid + 18 * u, 'push', u);
        arrow(g, wx, mid, Lmax * wNow / Fref, false, '#4fb3ff', u); forceIcon(g, wx, mid - 16 * u, 'weight', u);
      }
      // けむり（いま ほのおが出ている ところから。うちゅうでは うすい）
      const rhoNow = el > pre && s.samples.length ? s.samples[Math.min(s.samples.length - 1, Math.floor(stNow / RL.CFG.PHYS.DT))].rho : 1;
      rocket.querySelectorAll('.flame').forEach(f => {
        if (f.style.display !== 'block') return;
        const L0 = +f.dataset.l + +f.dataset.w / 2, T0 = parseFloat(f.style.top) + cs;
        for (let i = 0; i < 2; i++) smoke.push({ x: rx + L0, y: ry + T0, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3, l: Math.max(0.15, rhoNow) });
      });
      for (let i = smoke.length - 1; i >= 0; i--) { const p = smoke[i]; p.x += p.vx; p.y += p.vy; p.l -= 0.02; if (p.l <= 0) { smoke.splice(i, 1); continue; }
        g.fillStyle = `rgba(235,235,235,${p.l * 0.6})`; g.beginPath(); g.arc(p.x, p.y, (1.3 - p.l) * 18, 0, 7); g.fill(); }
      // メーター
      drawMeters(g, W, H, Math.max(0, vNow) * VK, h, stNow, RL.Builder.state.best, u);
      // 早送り中の しるし
      const rNow = (el - pre) / 1000;
      if (el > pre && sp2 > 1 && rNow >= r1) {
        if (!ffOn) { ffOn = true; [600, 900, 1200].forEach((f, i) => setTimeout(() => A.tone(f, 0.08, 'triangle', 0.12), i * 70)); RL.emit('fastforward'); }
        g.save(); g.globalAlpha = 0.65 + 0.35 * Math.sin(el / 120); g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = 'rgba(0,0,30,.55)'; g.beginPath(); g.arc(W / 2, 70 * u + 40, 46 * u, 0, 7); g.fill();
        g.fillStyle = '#fff'; g.font = `${52 * u}px sans-serif`; g.fillText('⏩', W / 2, 62 * u + 40);
        g.font = `bold ${22 * u}px "Courier New",monospace`; g.fillStyle = '#ffd54a'; g.fillText('×' + Math.round(sp2), W / 2, 98 * u + 40);
        g.restore();
      }
      if (sepFlash > 0) { g.fillStyle = `rgba(255,255,255,${sepFlash / 60})`; g.fillRect(0, 0, W, H); sepFlash--; }
      if (a.fuel > 0) {
        const gx = 14 * u, gw = 34 * u, gh = 150 * u, gy2 = H - 230 * u - gh;
        g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(gx, gy2, gw, gh);
        g.fillStyle = fuelNow > 0.25 ? '#e5383b' : '#ffb02e'; g.fillRect(gx, gy2 + gh * (1 - fuelNow), gw, gh * fuelNow);
        g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(gx, gy2, gw, gh);
        g.font = `${26 * u}px sans-serif`; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText('⛽', gx + gw / 2, gy2 - 10);
      }
      if (vNow > 15) { g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; const Ln = Math.min(160, vNow * 1.2);
        for (let i = 0; i < 8; i++) { const lx = (i * 97 + el * 0.3) % W, ly = (i * 233 + el * vNow * 0.02) % H; g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx, ly - Ln); g.stroke(); } }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
  }
  return { run };
})();
