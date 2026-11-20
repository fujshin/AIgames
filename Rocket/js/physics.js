// 飛び方の計算：時間を少しずつ進める
//  - 燃料がへると軽くなり、加速がどんどん大きくなる
//  - ブースターは縦につながった1本ごと：本数＝力、長さ＝燃える時間。燃えつきると、ついている はねごと 切りはなし
//  - くうき（ATMO_H まで、上ほどうすい）：空気のじゃま と はねの効果は くうきの中だけ。うちゅうでは はねは ただの おもり
RL.analyze = function (grid) {
  const cfg = RL.CFG, P = cfg.PHYS, cells = RL.layout(grid);
  const n = { engine: 0, tank: 0, fin: 0, win: 0, nose: 0, booster: 0 };
  let dry = 0, mx = 0;
  const bodyCols = new Set(), noseCols = new Set(), stacks = [], stackAt = {};
  for (let c = 0; c < cfg.COLS; c++) {
    let r = cfg.ROWS - 1;
    while (r >= 0) {
      if (grid[r][c] === 'booster') { const r1 = r; while (r >= 0 && grid[r][c] === 'booster') r--; stacks.push({ c, r0: r + 1, r1, seg: r1 - r, fins: [] }); }
      else r--;
    }
  }
  stacks.forEach((s, i) => { s.id = s.c + ':' + s.r0; for (let r = s.r0; r <= s.r1; r++) stackAt[r + ',' + s.c] = i; });
  const coreFin = { L: 0, R: 0, M: 0 };
  cells.forEach(q => {
    n[q.k]++;
    const w = P.MASS[q.k] + (q.k === 'tank' ? P.FUEL_TANK : q.k === 'engine' ? P.FUEL_ENGINE : q.k === 'booster' ? P.BOOST_FUEL : 0);
    dry += P.MASS[q.k]; mx += w * (q.c - (cfg.COLS - 1) / 2);
    if (RL.BODY[q.k]) bodyCols.add(q.c);
    if (q.k === 'booster') { const s = stacks[stackAt[q.r + ',' + q.c]]; q.stackId = s.id; q.stack = s; }
    if (q.k === 'fin') {
      const si = q.ctx.attC == null ? undefined : stackAt[q.r + ',' + q.ctx.attC];
      if (si !== undefined) { stacks[si].fins.push(q.ctx.side); q.stackId = stacks[si].id; q.stack = stacks[si]; }
      else if (q.ctx.side === 'left') coreFin.L++; else if (q.ctx.side === 'right') coreFin.R++; else coreFin.M++;
    }
  });
  bodyCols.forEach(c => { for (let r = 0; r < cfg.ROWS; r++) { const k = grid[r][c]; if (k && RL.BODY[k]) { if (k === 'nose') noseCols.add(c); break; } } });
  const fuel = n.engine * P.FUEL_ENGINE + n.tank * P.FUEL_TANK, bfuel = n.booster * P.BOOST_FUEL, total = dry + fuel + bfuel;
  const boosterFins = stacks.reduce((z, s) => z + s.fins.length, 0);
  return { n, dry, fuel, bfuel, stacks, coreFin, boosterFins, asym: total ? Math.abs(mx / total) : 0,
    cols: bodyCols.size, noseCover: bodyCols.size ? noseCols.size / bodyCols.size : 0, cells };
};

RL.simulate = function (a) {
  const P = RL.CFG.PHYS, n = a.n, k = P.TIME_STRETCH || 1, k2 = k * k, G = P.G / k2, DT = P.DT;
  if (!n.engine && !a.stacks.length) return { lift: false, h: 0, reason: 'noEngine', samples: [] };
  const cdBase = P.DRAG * Math.max(1, a.cols) * (1 - (1 - P.NOSE_DRAG) * a.noseCover);
  const Tc = P.THRUST * n.engine / k2, TbOf = seg => P.BOOST_THRUST * Math.pow(seg, P.BOOST_SEG_POW || 0) / k2;
  const st = a.stacks.map(s => ({ id: s.id, c: s.c, r0: s.r0, r1: s.r1, seg: s.seg, fins: s.fins, fuel: s.seg * P.BOOST_FUEL, sepT: null, sepH: null }));
  let fuel = a.fuel, dry = a.dry;
  const mass = () => dry + fuel + st.reduce((z, s) => z + (s.sepT === null ? s.fuel : 0), 0);
  const finsNow = () => { const f = { L: a.coreFin.L, R: a.coreFin.R, M: a.coreFin.M };
    st.forEach(s => { if (s.sepT === null) s.fins.forEach(sd => sd === 'left' ? f.L++ : sd === 'right' ? f.R++ : f.M++); });
    f.n = f.L + f.R + f.M; return f; };
  const tiltTarget = f => (f.n === 0 ? P.TILT_NOFIN : 0.08 * Math.abs(f.L - f.R) / f.n) + Math.min(0.4, a.asym * P.TILT_ASYM / (1 + f.n));
  let tilt = tiltTarget(finsNow());
  const twr0 = (Tc + st.reduce((z, s) => z + TbOf(s.seg), 0)) * Math.cos(tilt) / (mass() * G);
  let liftT = null;   // じめんを はなれた時間（重すぎるときは 燃料がへって かるくなるまで まつ）

  let v = 0, h = 0, x = 0, t = 0, tBurnEnd = 0, vMax = 0, tAtmo = null;
  const samples = [];
  while (t < P.MAX_T * k) {
    const rho = Math.max(0, 1 - h / P.ATMO_H);
    if (rho === 0 && tAtmo === null) tAtmo = t;
    const burnC = fuel > 0 && n.engine > 0;
    if (burnC) fuel = Math.max(0, fuel - n.engine * P.BURN / k * DT);
    let thrustB = 0, boost = false;
    st.forEach(s => {
      if (s.sepT !== null) return;
      if (s.fuel > 0) { s.fuel = Math.max(0, s.fuel - P.BOOST_BURN * Math.pow(s.seg, P.BOOST_SEG_POW || 0) / k * DT); thrustB += TbOf(s.seg); boost = true; }
      if (s.fuel <= 0) { s.sepT = t; s.sepH = h; dry -= s.seg * P.MASS.booster + s.fins.length * P.MASS.fin; }
    });
    if (burnC || boost) tBurnEnd = t;
    const m = Math.max(0.1, mass()), f = finsNow(), dir = Math.sign(f.L - f.R) || 1;
    if (h > 0) tilt = Math.min(1.2, tilt + tiltTarget(f) * P.TILT_GROW / k * rho * DT);   // ぐらぐらが ふえるのは とんでいて くうきの中だけ
    const cdNow = (cdBase + P.DRAG * P.BOOST_DRAG * st.filter(s => s.sepT === null).length) * rho;
    const thrust = (burnC ? Tc : 0) + thrustB;
    let acc = thrust * Math.cos(tilt) / m - G - cdNow * v * Math.abs(v) / m;
    if (h <= 0 && v <= 0 && acc < 0) acc = 0;            // じめんの上では しずまない
    v += acc * DT; h += v * DT; t += DT; vMax = Math.max(vMax, v);
    if (h <= 0 && v <= 0) { h = 0; v = 0; } else if (liftT === null) liftT = t;
    x += Math.sin(tilt) * dir * Math.max(0, v) * DT * 0.3;
    samples.push({ t, h: Math.max(0, h), v, acc, rho, burn: burnC, boost, thrust: thrust * k2, weight: m * G * k2, fuel: a.fuel ? fuel / a.fuel : 0, tilt: tilt * dir, x });
    if (!burnC && !boost && v <= 0) break;
  }
  const top = Math.max(0, ...samples.map(s => s.h));
  return { lift: top >= 5, h: top, reason: top >= 5 ? null : 'heavy', liftT, twr0, tBurnEnd, tTotal: t, tAtmo, vMax, k, samples,
    seps: st.map(s => ({ id: s.id, c: s.c, r0: s.r0, r1: s.r1, t: s.sepT, h: s.sepH })) };
};

RL.zoneOf = function (h) { let i = 0; RL.CFG.ZONES.forEach((z, j) => { if (h >= z.h) i = j; }); return i; };
