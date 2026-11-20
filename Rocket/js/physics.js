// 飛び方の計算：0.02秒ずつ時間を進める
//  - 燃料がへるほど軽くなり、加速がどんどん大きくなる
//  - 燃料がなくなると力がなくなり、重力と空気で減速して最高点へ
RL.analyze = function (grid) {
  const cfg = RL.CFG, P = cfg.PHYS, cells = RL.layout(grid);
  const n = { engine: 0, tank: 0, fin: 0, win: 0, nose: 0, booster: 0 };
  let dry = 0, mx = 0, finL = 0, finR = 0, finMid = 0;
  const bodyCols = new Set(), noseCols = new Set();
  cells.forEach(q => {
    n[q.k]++; const w = P.MASS[q.k] + (q.k === 'tank' ? P.FUEL_TANK : q.k === 'engine' ? P.FUEL_ENGINE : q.k === 'booster' ? P.BOOST_FUEL : 0);
    dry += P.MASS[q.k]; mx += w * (q.c - (cfg.COLS - 1) / 2);
    if (RL.BODY[q.k]) bodyCols.add(q.c);
    if (q.k === 'fin') { if (q.ctx.side === 'left') finL++; else if (q.ctx.side === 'right') finR++; else finMid++; }
  });
  bodyCols.forEach(c => { for (let r = 0; r < cfg.ROWS; r++) { const k = grid[r][c]; if (k && RL.BODY[k]) { if (k === 'nose') noseCols.add(c); break; } } });
  // ブースター：縦につながったものを1本とみなす。1本につきノズル1つ（力は本数、燃える時間は長さ）
  const stacks = [];
  for (let c = 0; c < cfg.COLS; c++) {
    let r = cfg.ROWS - 1;
    while (r >= 0) {
      if (grid[r][c] === 'booster') { let r1 = r; while (r >= 0 && grid[r][c] === 'booster') r--; stacks.push({ c, r0: r + 1, r1, seg: r1 - r }); }
      else r--;
    }
  }
  const fuel = n.engine * P.FUEL_ENGINE + n.tank * P.FUEL_TANK, bfuel = n.booster * P.BOOST_FUEL, total = dry + fuel + bfuel;
  return { n, dry, fuel, bfuel, stacks, asym: total ? Math.abs(mx / total) : 0, finL, finR, finMid, cols: bodyCols.size, noseCover: bodyCols.size ? noseCols.size / bodyCols.size : 0, cells };
};

// 時間をのばす係数 k：高さは同じまま、すべての動きが k 倍ゆっくりになる
RL.simulate = function (a) {
  const P = RL.CFG.PHYS, n = a.n, k = P.TIME_STRETCH || 1, k2 = k * k;
  const G = P.G / k2, DT = P.DT;
  if (!n.engine && !a.stacks.length) return { lift: false, h: 0, reason: 'noEngine', samples: [] };
  const fins = a.finL + a.finR + a.finMid;
  const tilt0 = (fins === 0 ? P.TILT_NOFIN : 0.08 * Math.abs(a.finL - a.finR) / fins) + Math.min(0.4, a.asym * P.TILT_ASYM / (1 + fins));
  const dir = (a.finL - a.finR) || 1;
  const cd = P.DRAG * Math.max(1, a.cols) * (1 - (1 - P.NOSE_DRAG) * a.noseCover);
  const Tc = P.THRUST * n.engine / k2, Tb1 = P.BOOST_THRUST / k2;
  const st = a.stacks.map(s => ({ ...s, fuel: s.seg * P.BOOST_FUEL, sepT: null }));
  let fuel = a.fuel, dry = a.dry;
  const mass = () => dry + fuel + st.reduce((z, s) => z + (s.sepT === null ? s.fuel : 0), 0);
  const twr0 = (Tc + Tb1 * st.length) * Math.cos(tilt0) / (mass() * G);
  if (twr0 <= 1) return { lift: false, h: 0, reason: 'heavy', twr0, samples: [] };

  let v = 0, h = 0, x = 0, t = 0, tBurnEnd = 0, vMax = 0;
  const samples = [];
  while (t < P.MAX_T * k) {
    const burnC = fuel > 0 && n.engine > 0;
    if (burnC) fuel = Math.max(0, fuel - n.engine * P.BURN / k * DT);
    let thrustB = 0, boost = false;
    st.forEach(s => {
      if (s.sepT !== null) return;
      if (s.fuel > 0) { s.fuel = Math.max(0, s.fuel - P.BOOST_BURN / k * DT); thrustB += Tb1; boost = true; }
      if (s.fuel <= 0) { s.sepT = t; dry -= s.seg * P.MASS.booster; }        // 燃えつきたら勝手に切りはなし
    });
    if (burnC || boost) tBurnEnd = t;
    const m = Math.max(0.1, mass());
    const tilt = Math.min(1.2, tilt0 * (1 + t / k * P.TILT_GROW));
    const cdNow = cd + P.DRAG * P.BOOST_DRAG * st.filter(s => s.sepT === null).length;   // ついているブースターも空気のじゃま
    const acc = ((burnC ? Tc : 0) + thrustB) * Math.cos(tilt) / m - G - cdNow * v * Math.abs(v) / m;
    v += acc * DT; h += v * DT; t += DT; vMax = Math.max(vMax, v);
    x += Math.sin(tilt) * Math.sign(dir) * Math.max(0, v) * DT * 0.3;
    samples.push({ t, h: Math.max(0, h), v, acc, burn: burnC, boost, fuel: a.fuel ? fuel / a.fuel : 0, tilt: tilt * Math.sign(dir), x });
    if (!burnC && !boost && v <= 0) break;
    if (h < 0) { h = 0; break; }
  }
  const top = Math.max(0, ...samples.map(s => s.h));
  return { lift: top >= 5, h: top, twr0, tBurnEnd, tTotal: t, seps: st.map(s => ({ c: s.c, r0: s.r0, r1: s.r1, t: s.sepT })), vMax, k, samples };
};

RL.zoneOf = function (h) {
  let idx = 0; RL.CFG.ZONES.forEach((z, i) => { if (h >= z.h) idx = i; });
  return idx;
};
