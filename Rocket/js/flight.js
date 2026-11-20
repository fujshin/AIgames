// はっしゃの演出：空・けむり・メーターは canvas、ロケットは SVG部品をそのまま動かす
RL.Flight = (function () {
  const $ = id => document.getElementById(id);
  let raf = null;
  const hex = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
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
      const d = document.createElement('div'); d.className = 'p';
      Object.assign(d.style, { left: q.c * cs + 'px', top: q.r * cs + 'px', width: cs + 'px', height: cs + 'px' });
      d.innerHTML = RL.drawPart(q.k, q.ctx); el.appendChild(d);
      if (q.stackId) {               // ブースターと、それについた はね は いっしょに はなれる
        const s = q.stack; d.dataset.stack = q.stackId;
        d.dataset.side = s.c < (RL.CFG.COLS - 1) / 2 ? -1 : s.c > (RL.CFG.COLS - 1) / 2 ? 1 : 1;
        d.style.transformOrigin = `${(s.c - q.c + 0.5) * cs}px ${((s.r0 + s.r1 + 1) / 2 - q.r) * cs}px`;
      }
      if (q.k === 'engine' || (q.k === 'booster' && !q.ctx.down)) {
        const f = document.createElement('div'); f.className = 'flame' + (q.k === 'booster' ? ' bflame' : ''); f.innerHTML = RL.FLAME;
        if (q.stackId) f.dataset.stackFlame = q.stackId;
        Object.assign(f.style, { left: q.c * cs + cs * 0.12 + 'px', top: (q.r + 1) * cs - 4 + 'px', width: cs * 0.76 + 'px', height: cs * 1.1 + 'px' });
        el.appendChild(f);
      }
    });
    return el;
  }

  // メーター：針（緑→黄→赤）＋ デジタル数字。右上に高さと時計
  let shownSpeed = 0;
  function drawMeters(g, W, H, spd, h, sec, best) {
    const MAX = RL.CFG.SPEED_MAX, cx = 120, cy = H - 120, R = 90;
    shownSpeed += (spd - shownSpeed) * 0.35;
    g.save();
    g.fillStyle = 'rgba(0,0,20,.55)'; g.beginPath(); g.arc(cx, cy, R + 14, Math.PI, 0); g.lineTo(cx + R + 14, cy + 78); g.lineTo(cx - R - 14, cy + 78); g.closePath(); g.fill();
    [['#3ecf5a', 0, .5], ['#ffd54a', .5, .8], ['#ff5a5a', .8, 1]].forEach(([c, a0, a1]) => { g.lineWidth = 16; g.strokeStyle = c; g.beginPath(); g.arc(cx, cy, R, Math.PI + Math.PI * a0, Math.PI + Math.PI * a1); g.stroke(); });
    g.strokeStyle = '#fff'; g.lineWidth = 3;
    for (let i = 0; i <= 10; i++) { const an = Math.PI + Math.PI * i / 10, l = i % 5 ? 20 : 28; g.beginPath(); g.moveTo(cx + Math.cos(an) * (R - 12), cy + Math.sin(an) * (R - 12)); g.lineTo(cx + Math.cos(an) * (R - l), cy + Math.sin(an) * (R - l)); g.stroke(); }
    const r = Math.min(1, shownSpeed / MAX), an = Math.PI + Math.PI * r;
    g.strokeStyle = '#ff3b3b'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(an) * (R - 16), cy + Math.sin(an) * (R - 16)); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, 9, 0, 7); g.fill();
    g.fillStyle = '#071a0b'; g.fillRect(cx - 82, cy + 16, 164, 54);
    g.font = 'bold 40px "Courier New",monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(80,255,120,.15)'; g.fillText('88888', cx, cy + 44);
    g.fillStyle = r > .8 ? '#ff6b6b' : r > .5 ? '#ffd54a' : '#5aff7a'; g.fillText(String(Math.round(shownSpeed)).padStart(5, '0'), cx, cy + 44);
    g.textAlign = 'right'; g.font = 'bold 30px "Courier New",monospace';
    g.fillStyle = 'rgba(0,0,20,.55)'; g.fillRect(W - 250, 12, 180, 82);
    g.fillStyle = '#fff'; g.fillText('⬆' + String(Math.round(h)).padStart(5, '0'), W - 78, 36);
    g.fillStyle = '#9fd8ff'; g.fillText('⏱' + sec.toFixed(1).padStart(4, '0'), W - 78, 72);
    // 高さのはしご（右はし）
    const mx = W - 30, top = 110, bot = H - 40, yOf = v => bot - RL.hPos(v) * (bot - top);
    g.textBaseline = 'alphabetic'; g.textAlign = 'center';
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(mx - 4, top, 8, bot - top);
    g.strokeStyle = '#9fd8ff'; g.lineWidth = 2; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(mx - 14, yOf(RL.CFG.PHYS.ATMO_H)); g.lineTo(mx + 14, yOf(RL.CFG.PHYS.ATMO_H)); g.stroke(); g.setLineDash([]);
    g.font = '20px sans-serif'; g.fillStyle = '#fff'; RL.CFG.ZONES.forEach(z => g.fillText(z.icon, mx - 24, yOf(z.h) + 7));
    g.font = '26px sans-serif'; g.fillText('🚀', mx, yOf(h) + 9);
    if (best) g.fillText('🏆', mx + 2, yOf(best) + 9);
    g.restore();
  }

  function run(a, s, onDone) {
    shownSpeed = 0;
    const fly = $('fly'), cv = $('cv'), g = cv.getContext('2d'), A = RL.Audio, dpr = devicePixelRatio || 1;
    fly.style.display = 'block'; document.body.classList.add('flying');
    const W = innerWidth, H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cs = Math.min(40, W / 10), rocket = buildRocket(a, cs), RW = RL.CFG.COLS * cs;
    let lowest = 0; a.cells.forEach(q => lowest = Math.max(lowest, q.r + 1));
    // 高さ → 画面の長さ（上ほど ちぢめる。速くなっても目印が見えるように）
    const px = H / 180, L = 150, Y = hh => px * L * Math.log(1 + Math.max(0, hh) / L);
    const ground = H * 0.82, startY = ground - 10 - lowest * cs, room = startY - H * 0.3;
    const pre = 2100, PL = RL.CFG.PLAY;
    const speed = s.lift ? Math.max(1, s.tTotal / PL.MAX_SEC) : 1, toSim = r => r * speed;
    const flightMs = s.lift ? s.tTotal / speed * 1000 + 600 : 2600;
    const VK = RL.CFG.SPEED_SCALE * (s.k || 1);
    const stars = Array.from({ length: 140 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.8 + 0.3 }));
    const smoke = []; let t0 = null, sepDone = {}, saidSep = false, sepFlash = 0, saidSpace = false;
    const sepOf = {}; (s.seps || []).forEach(sp => sepOf[sp.id] = sp);

    A.say('さん、に、いち、はっしゃ！', null, { rate: 1.1 });
    [0, 700, 1400].forEach(d => setTimeout(() => A.tone(880, 0.15), d));
    setTimeout(() => { A.tone(1320, 0.4); A.rumble(s.lift ? 3 : 1.5); }, pre);

    function frame(ts) {
      if (!t0) t0 = ts; const el = ts - t0;
      let h = 0, burn = false, boost = false, wob = 0, tilt = 0, xd = 0, fuelNow = 1, vNow = 0, stNow = 0, accNow = 0;
      $('count').textContent = el < pre ? String(3 - Math.floor(el / 700)) : '';
      if (el > pre) {
        const p = Math.min(1, (el - pre) / flightMs);
        if (s.lift) {
          stNow = toSim((el - pre) / 1000); const S = s.samples, sm = S[Math.min(S.length - 1, Math.floor(stNow / RL.CFG.PHYS.DT))];
          h = sm.h; burn = sm.burn; boost = sm.boost; tilt = sm.tilt; xd = sm.x; fuelNow = sm.fuel; vNow = sm.v; accNow = sm.acc * s.k * s.k;
        } else { burn = p < 0.7; boost = burn && !!a.stacks.length; wob = Math.sin(el / 40) * 5; stNow = (el - pre) / 1000; }
        if (p >= 1) { s.shownVmax = (s.vMax || 0) * VK; cancelAnimationFrame(raf); fly.style.display = 'none'; document.body.classList.remove('flying'); onDone(); return; }
      } else if (el > pre - 400) { burn = !!a.n.engine; boost = !!a.stacks.length; }

      const cam = Math.max(0, Y(h) - room), gy = ground + cam;
      g.fillStyle = skyAt(h); g.fillRect(0, 0, W, H);
      const sa = Math.min(1, Math.max(0, (h - 150) / 200));
      if (sa > 0) { g.fillStyle = `rgba(255,255,255,${sa})`; stars.forEach(st => { g.beginPath(); g.arc(st.x, (st.y + cam * 0.3) % H, st.r, 0, 7); g.fill(); }); }
      // くうきの おわり（点線）
      const ay = gy - Y(RL.CFG.PHYS.ATMO_H);
      if (ay > -10 && ay < H + 10) { g.strokeStyle = 'rgba(160,220,255,.8)'; g.lineWidth = 4; g.setLineDash([16, 12]); g.beginPath(); g.moveTo(0, ay); g.lineTo(W, ay); g.stroke(); g.setLineDash([]); }
      if (!saidSpace && s.tAtmo != null && stNow >= s.tAtmo) { saidSpace = true; [784, 1175].forEach((f, i) => setTimeout(() => A.tone(f, 0.3, 'sine', 0.15), i * 150)); RL.emit('space'); }
      g.textAlign = 'center'; g.font = '54px sans-serif';
      RL.CFG.ZONES.forEach((z, i) => { if (!z.h) return; const y = gy - Y(z.h); if (y > -60 && y < H + 60) g.fillText(z.icon, W * (i % 2 ? 0.2 : 0.78), y); });
      if (gy < H + 50) { g.fillStyle = '#3c8f3c'; g.fillRect(0, gy, W, H); g.fillStyle = '#ffcc00'; g.fillRect(W / 2 - RW / 2 - 20, gy - 10, RW + 40, 10); }
      // ロケット
      const ry = startY - Math.min(Y(h), room);
      const drift = Math.max(-W * 0.3, Math.min(W * 0.3, xd * px));
      const shake = (burn || boost) ? Math.min(6, 1 + Math.max(0, accNow) / 10) : 0;
      const rx = W / 2 - RW / 2 + drift + wob + (Math.random() - 0.5) * shake;
      rocket.style.transformOrigin = `${RW / 2}px ${lowest * cs}px`;
      rocket.style.transform = `translate(${rx}px,${ry}px) rotate(${tilt * 0.6}rad)`;
      rocket.classList.toggle('burn', burn); rocket.classList.toggle('boost', boost);
      // ブースターの切りはなし（はね ごと、燃えつきた順に）
      rocket.querySelectorAll('[data-stack-flame]').forEach(f => { const sp = sepOf[f.dataset.stackFlame]; f.style.visibility = sp && sp.t != null && stNow > sp.t ? 'hidden' : ''; });
      rocket.querySelectorAll('[data-stack]').forEach(b => {
        const sp = sepOf[b.dataset.stack]; if (!sp || sp.t == null) return;
        const ds = stNow - sp.t;
        if (ds > 0) { const sd = +b.dataset.side, tt = ds / (s.k || 1) * 1.2;
          b.style.transform = `translate(${sd * (12 + tt * 60)}px,${tt * tt * 180 + tt * 40}px) rotate(${sd * tt * 200}deg)`; b.style.opacity = Math.max(0, 1 - tt / 2.5);
          if (!sepDone[sp.id]) { sepDone[sp.id] = true; A.tone(180, 0.25, 'square', 0.15); setTimeout(() => A.tone(120, 0.3, 'square', 0.1), 120); sepFlash = 30;
            if (!saidSep) { saidSep = true; A.say('ブースター、きりはなし！', null, { interrupt: false }); } RL.emit('separate', sp); }
        } else { b.style.transform = ''; b.style.opacity = 1; }
      });
      // けむり
      a.cells.filter(q => (burn && q.k === 'engine') || (boost && q.k === 'booster' && !q.ctx.down && !(sepOf[q.stackId] && sepOf[q.stackId].t != null && stNow > sepOf[q.stackId].t))).forEach(q => {
        const thin = Math.max(0.15, s.samples.length && s.lift ? (s.samples[Math.min(s.samples.length - 1, Math.floor(stNow / RL.CFG.PHYS.DT))].rho) : 1);
        for (let i = 0; i < 2; i++) smoke.push({ x: rx + (q.c + 0.5) * cs, y: ry + (q.r + 2) * cs, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3, l: thin });
      });
      for (let i = smoke.length - 1; i >= 0; i--) { const p = smoke[i]; p.x += p.vx; p.y += p.vy; p.l -= 0.02; if (p.l <= 0) { smoke.splice(i, 1); continue; }
        g.fillStyle = `rgba(235,235,235,${p.l * 0.6})`; g.beginPath(); g.arc(p.x, p.y, (1.3 - p.l) * 18, 0, 7); g.fill(); }
      // メーター
      drawMeters(g, W, H, Math.max(0, vNow) * VK, h, stNow, RL.Builder.state.best);
      if (sepFlash > 0) { g.fillStyle = `rgba(255,255,255,${sepFlash / 60})`; g.fillRect(0, 0, W, H); sepFlash--; }
      if (a.fuel > 0) {
        const gx = 20, gy2 = H - 380, gw = 34, gh = 150;
        g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(gx, gy2, gw, gh);
        g.fillStyle = fuelNow > 0.25 ? '#e5383b' : '#ffb02e'; g.fillRect(gx, gy2 + gh * (1 - fuelNow), gw, gh * fuelNow);
        g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(gx, gy2, gw, gh);
        g.font = '26px sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText('⛽', gx + gw / 2, gy2 - 10);
      }
      if (vNow > 15) { g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; const Ln = Math.min(160, vNow * 1.2);
        for (let i = 0; i < 8; i++) { const lx = (i * 97 + el * 0.3) % W, ly = (i * 233 + el * vNow * 0.02) % H; g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx, ly - Ln); g.stroke(); } }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
  }
  return { run };
})();
