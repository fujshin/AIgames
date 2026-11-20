// はっしゃの演出：空と煙はcanvas、ロケットはSVG部品をそのまま動かす
RL.Flight = (function () {
  const $ = id => document.getElementById(id);
  let raf = null;

  function hex(s) { return [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)); }
  function skyAt(h) {
    const Z = RL.CFG.ZONES; let a = Z[0], b = Z[Z.length - 1];
    for (let i = 0; i < Z.length - 1; i++) if (h >= Z[i].h && h < Z[i + 1].h) { a = Z[i]; b = Z[i + 1]; }
    const t = b.h > a.h ? Math.min(1, (h - a.h) / (b.h - a.h)) : 0, x = hex(a.sky), y = hex(b.sky);
    return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`;
  }

  // ロケットのDOMを作る（くみたて画面と同じ絵）
  function buildRocket(a, cs) {
    const el = $('flyRocket'); el.innerHTML = ''; el.className = '';
    const C = RL.CFG.COLS, R = RL.CFG.ROWS;
    el.style.width = C * cs + 'px'; el.style.height = R * cs + 'px';
    a.cells.forEach(q => {
      const d = document.createElement('div'); d.className = 'p';
      Object.assign(d.style, { left: q.c * cs + 'px', top: q.r * cs + 'px', width: cs + 'px', height: cs + 'px' });
      d.innerHTML = RL.drawPart(q.k, q.ctx); el.appendChild(d);
      if (q.k === 'booster') { // 同じ列でつながったブースターは1本として回す
        d.classList.add('bst'); d.dataset.side = q.c < RL.CFG.COLS / 2 ? -1 : q.c > (RL.CFG.COLS - 1) / 2 ? 1 : (Math.random() < .5 ? -1 : 1);
        let r0 = q.r, r1 = q.r; const G = RL.Builder.grid;
        while (r0 > 0 && G[r0 - 1][q.c] === 'booster') r0--; while (r1 < RL.CFG.ROWS - 1 && G[r1 + 1][q.c] === 'booster') r1++;
        d.dataset.stack = q.c + ':' + r0;
        d.style.transformOrigin = `50% ${((r0 + r1 + 1) / 2 - q.r) * cs}px`;
      }
      if (q.k === 'engine' || (q.k === 'booster' && !q.ctx.down)) {
        const f = document.createElement('div'); f.className = 'flame' + (q.k === 'booster' ? ' bflame' : '');
        if (q.k === 'booster') { let r0 = q.r; while (r0 > 0 && RL.Builder.grid[r0 - 1][q.c] === 'booster') r0--; f.dataset.stack = q.c + ':' + r0; } f.innerHTML = RL.FLAME;
        Object.assign(f.style, { left: q.c * cs + cs * 0.12 + 'px', top: (q.r + 1) * cs - 4 + 'px', width: cs * 0.76 + 'px', height: cs * 1.1 + 'px' });
        el.appendChild(f);
      }
    });
    return el;
  }

  // 針のメーター（緑→黄→赤）＋ 7セグ風の数字。数字はかぞえあげて「ふえていく」を見せる
  let shownSpeed = 0;
  function drawSpeedo(g, W, H, spd, h, sec) {
    const MAX = RL.CFG.SPEED_MAX, cx = 120, cy = H - 120, R = 90;
    shownSpeed += (spd - shownSpeed) * 0.35;
    g.save();
    g.fillStyle = 'rgba(0,0,20,.55)'; g.beginPath(); g.arc(cx, cy, R + 14, Math.PI, 0); g.lineTo(cx + R + 14, cy + 78); g.lineTo(cx - R - 14, cy + 78); g.closePath(); g.fill();
    const seg = [['#3ecf5a', 0, .5], ['#ffd54a', .5, .8], ['#ff5a5a', .8, 1]];
    g.lineWidth = 16; seg.forEach(([c, a0, a1]) => { g.strokeStyle = c; g.beginPath(); g.arc(cx, cy, R, Math.PI + Math.PI * a0, Math.PI + Math.PI * a1); g.stroke(); });
    g.strokeStyle = '#fff'; g.lineWidth = 3;
    for (let i = 0; i <= 10; i++) { const an = Math.PI + Math.PI * i / 10; g.beginPath(); g.moveTo(cx + Math.cos(an) * (R - 12), cy + Math.sin(an) * (R - 12)); g.lineTo(cx + Math.cos(an) * (R - (i % 5 ? 20 : 28)), cy + Math.sin(an) * (R - (i % 5 ? 20 : 28))); g.stroke(); }
    const r = Math.min(1, shownSpeed / MAX), an = Math.PI + Math.PI * r;
    g.strokeStyle = '#ff3b3b'; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(an) * (R - 16), cy + Math.sin(an) * (R - 16)); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, 9, 0, 7); g.fill();
    // デジタル数字
    const txt = String(Math.round(shownSpeed)).padStart(4, '0');
    g.fillStyle = '#071a0b'; g.fillRect(cx - 78, cy + 16, 156, 54);
    g.font = 'bold 44px "Courier New",monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(80,255,120,.15)'; g.fillText('8888', cx, cy + 44);
    g.fillStyle = r > .8 ? '#ff6b6b' : r > .5 ? '#ffd54a' : '#5aff7a'; g.fillText(txt, cx, cy + 44);
    // 高さの数字と時計（右上）
    g.textAlign = 'right'; g.font = 'bold 30px "Courier New",monospace';
    g.fillStyle = 'rgba(0,0,20,.55)'; g.fillRect(W - 230, 12, 160, 82);
    g.fillStyle = '#fff'; g.fillText('⬆' + String(Math.round(h * 10)).padStart(5, '0'), W - 78, 36);
    g.fillStyle = '#9fd8ff'; g.fillText('⏱' + sec.toFixed(1).padStart(4, '0'), W - 78, 72);
    g.restore(); g.textBaseline = 'alphabetic';
  }

  function run(a, s, onDone) {
    shownSpeed = 0;
    const fly = $('fly'), cv = $('cv'), g = cv.getContext('2d'), A = RL.Audio, dpr = devicePixelRatio || 1;
    fly.style.display = 'block';
    const W = innerWidth, H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cs = Math.min(40, W / 10), rocket = buildRocket(a, cs), RW = RL.CFG.COLS * cs;
    // ロケットの一番下（エンジンの下）
    let lowest = 0; a.cells.forEach(q => lowest = Math.max(lowest, q.r + 1));
    const ground = H * 0.82, scale = H / 180, startY = ground - 10 - lowest * cs, room = startY - H * 0.3;
    const pre = 2100, PL = RL.CFG.PLAY;
    // 長い飛行は早送り（出だしのゆっくりは見せる）
    const speed = s.lift ? Math.max(1, s.tTotal / PL.MAX_SEC) : 1;     // ふつうは実時間（1倍）
    const toSim = r => r * speed;
    const flightMs = s.lift ? s.tTotal / speed * 1000 + 600 : 2600;
    const VK = RL.CFG.SPEED_SCALE * (s.k || 1);                        // メーターの数字は時間をのばす前と同じにする
    const stars = Array.from({ length: 140 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.8 + 0.3 }));
    const smoke = []; let t0 = null, sepDone = {}, saidSep = false, sepFlash = 0;

    A.say('さん、に、いち、はっしゃ！');
    [0, 700, 1400].forEach(d => setTimeout(() => A.tone(880, 0.15), d));
    setTimeout(() => { A.tone(1320, 0.4); A.rumble(s.lift ? 3 : 1.5); }, pre);

    function frame(ts) {
      if (!t0) t0 = ts; const el = ts - t0;
      let h = 0, burn = false, boost = false, wob = 0, tiltNow = 0, xNow = 0, fuelNow = 1, vNow = 0, stNow = 0, accNow = 0;
      $('count').textContent = el < pre ? String(3 - Math.floor(el / 700)) : '';
      if (el > pre) {
        const p = Math.min(1, (el - pre) / flightMs);
        if (s.lift) {
          const st = toSim((el - pre) / 1000), S = s.samples;
          const smp = S[Math.min(S.length - 1, Math.floor(st / RL.CFG.PHYS.DT))];
          h = smp.h; burn = smp.burn; boost = smp.boost; tiltNow = smp.tilt; xNow = smp.x; fuelNow = smp.fuel; vNow = smp.v; stNow = st; accNow = smp.acc;
        }
        else { burn = p < 0.7; wob = Math.sin(el / 40) * 5; }
        if (p >= 1) { s.shownVmax = (s.vMax || 0) * VK; cancelAnimationFrame(raf); fly.style.display = 'none'; onDone(); return; }
      } else if (el > pre - 400) { burn = true; boost = !!a.n.booster; }

      const cam = Math.max(0, h * scale - room), gy = ground + cam;
      // 空・星
      g.fillStyle = skyAt(h); g.fillRect(0, 0, W, H);
      const sa = Math.min(1, Math.max(0, (h - 150) / 200));
      if (sa > 0) { g.fillStyle = `rgba(255,255,255,${sa})`; stars.forEach(st => { g.beginPath(); g.arc(st.x, (st.y + cam * 0.3) % H, st.r, 0, 7); g.fill(); }); }
      // 高さの目印
      g.textAlign = 'center'; g.font = '54px sans-serif';
      RL.CFG.ZONES.forEach((z, i) => { if (!z.h) return; const y = gy - z.h * scale; if (y > -60 && y < H + 60) g.fillText(z.icon, W * (i % 2 ? 0.2 : 0.8), y); });
      // 地面と発射台
      if (gy < H + 50) { g.fillStyle = '#3c8f3c'; g.fillRect(0, gy, W, H); g.fillStyle = '#ffcc00'; g.fillRect(W / 2 - RW / 2 - 20, gy - 10, RW + 40, 10); }
      // ロケット
      const ry = startY - Math.min(h * scale, room);
      const drift = Math.max(-W * 0.3, Math.min(W * 0.3, xNow * scale));
      const shake = (burn || boost) ? Math.min(6, 1 + Math.max(0, accNow) / 10) : 0;
      const rx = W / 2 - RW / 2 + drift + wob + (Math.random() - 0.5) * shake;
      rocket.style.transform = `translate(${rx}px,${ry}px) rotate(${tiltNow * 0.6}rad)`;
      rocket.style.transformOrigin = `${RW / 2}px ${lowest * cs}px`;
      rocket.classList.toggle('burn', burn);
      rocket.classList.toggle('boost', boost);
      // ブースターの切りはなし：1本ずつ、燃えつきた順に横へはなれて落ちる
      (s.seps || []).forEach(sp => {
        if (sp.t == null) return;
        const id = sp.c + ':' + sp.r0, ds = stNow - sp.t;
        rocket.querySelectorAll(`[data-stack="${id}"]`).forEach(b => {
          if (b.classList.contains('flame')) { b.style.visibility = ds > 0 ? 'hidden' : ''; return; }
          if (ds > 0) { const sd = +b.dataset.side, tt = ds / (s.k || 1) * 1.2;
            b.style.transform = `translate(${sd * (12 + tt * 60)}px,${tt * tt * 180 + tt * 40}px) rotate(${sd * tt * 200}deg)`; b.style.opacity = Math.max(0, 1 - tt / 2.5);
          } else { b.style.transform = ''; b.style.opacity = 1; }
        });
        if (ds > 0 && !sepDone[id]) { sepDone[id] = true; A.tone(180, 0.25, 'square', 0.15); setTimeout(() => A.tone(120, 0.3, 'square', 0.1), 120); if (!saidSep) { saidSep = true; A.say('ブースター、きりはなし！'); } sepFlash = 30; }
      });
      // けむり
      a.cells.filter(q => (burn && q.k === 'engine') || (boost && q.k === 'booster' && !q.ctx.down && !(s.seps || []).some(sp => sp.t != null && sp.t < stNow && sp.c === q.c && sp.r0 <= q.r && q.r <= sp.r1))).forEach(q => {
        for (let i = 0; i < 2; i++) smoke.push({ x: rx + (q.c + 0.5) * cs, y: ry + (q.r + 2) * cs, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3, l: 1 });
      });
      for (let i = smoke.length - 1; i >= 0; i--) {
        const p = smoke[i]; p.x += p.vx; p.y += p.vy; p.l -= 0.02;
        if (p.l <= 0) { smoke.splice(i, 1); continue; }
        g.fillStyle = `rgba(235,235,235,${p.l * 0.6})`; g.beginPath(); g.arc(p.x, p.y, (1.3 - p.l) * 18, 0, 7); g.fill();
      }
      // 高さメーター
      const mx = W - 30, top = 40, bot = H - 40, T = RL.CFG.TOP, yOf = v => bot - (Math.min(v, T) / T) * (bot - top);
      g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(mx - 4, top, 8, bot - top);
      g.font = '20px sans-serif'; g.fillStyle = '#fff'; RL.CFG.ZONES.forEach(z => g.fillText(z.icon, mx - 24, yOf(z.h) + 7));
      g.font = '26px sans-serif'; g.fillText('🚀', mx, yOf(h) + 9);
      if (RL.Builder.state.best) g.fillText('🏆', mx + 2, yOf(RL.Builder.state.best) + 9);
      // スピードメーター（針）とデジタル表示
      drawSpeedo(g, W, H, Math.max(0, vNow) * VK, h, el > pre ? (s.lift ? toSim((el - pre) / 1000) : (el - pre) / 1000) : 0);
      if (sepFlash > 0) { g.fillStyle = `rgba(255,255,255,${sepFlash / 60})`; g.fillRect(0, 0, W, H); sepFlash--; }
      // ねんりょうメーター（へっていく）
      if (a.fuel > 0) {
        const gx = 20, gy2 = H - 380, gw = 34, gh = 150;
        g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(gx, gy2, gw, gh);
        g.fillStyle = fuelNow > 0.25 ? '#e5383b' : '#ffb02e'; g.fillRect(gx, gy2 + gh * (1 - fuelNow), gw, gh * fuelNow);
        g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(gx, gy2, gw, gh);
        g.font = '26px sans-serif'; g.fillStyle = '#fff'; g.fillText('⛽', gx + gw / 2, gy2 - 10);
      }
      // はやさの線（速いほど長い）
      if (vNow > 15) {
        g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2;
        const L = Math.min(160, vNow * 1.2);
        for (let i = 0; i < 8; i++) { const lx = (i * 97 + el * 0.3) % W, ly = (i * 233 + el * vNow * 0.02) % H; g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx, ly - L); g.stroke(); }
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
  }
  return { run };
})();
