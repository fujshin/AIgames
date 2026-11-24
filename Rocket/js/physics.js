// 飛び方の計算：時間を少しずつ進める
//  - 燃料がへると軽くなり、加速がどんどん大きくなる
//  - ブースターは縦につながった1本ごと：長いほど力も燃える時間も √長さ 倍。燃えつきると ついている はねごと 切りはなし
//  - 段：リングより下が1段目。いまの段の エンジンと ブースターが ぜんぶ燃えつきたら リングごと切りはなし、少しおいて つぎの段が点火
//  - 宇宙用エンジン：くうきの中では VAIR の割合の力。くうきの外で 本来の力
//  - くうき（ATMO_H まで、上ほどうすい）：空気のじゃま と はねの効果は くうきの中だけ
RL.analyze = function (grid) {
  const cfg = RL.CFG, P = cfg.PHYS, cells = RL.layout(grid), SR = RL.stageRows(grid);
  const n = { engine: 0, vengine: 0, tank: 0, fin: 0, win: 0, nose: 0, booster: 0, ring: 0, leg: 0 };
  const stages = Array.from({ length: SR.n }, (_, i) => ({ i, dry: 0, fuel: 0, eng: 0, veng: 0, legL: 0, legR: 0, coreFin: { L: 0, R: 0, M: 0 } }));
  let mx = 0, total = 0;
  const stacks = [], stackAt = {};
  for (let c = 0; c < cfg.COLS; c++) {
    let r = cfg.ROWS - 1;
    while (r >= 0) {
      const ok = rr => rr >= 0 && grid[rr][c] === 'booster' && !RL.isLooseBooster(grid, rr, c);
      if (ok(r)) { const r1 = r; while (ok(r)) r--; stacks.push({ c, r0: r + 1, r1, seg: r1 - r, fins: [], stage: SR.of(r1) }); }
      else r--;
    }
  }
  stacks.forEach((s, i) => { s.id = s.c + ':' + s.r0; s.dry = s.seg * P.MASS.booster; s.fuel = s.seg * P.BOOST_FUEL; for (let r = s.r0; r <= s.r1; r++) stackAt[r + ',' + s.c] = i; });
  cells.forEach(q => {
    if (q.ctx.loose) return;            // くっついていない ブースターは ロケットに ふくめない
    n[q.k]++; q.stage = SR.of(q.r);
    const fuel = RL.ENGINES[q.k] ? P.FUEL_ENGINE : q.k === 'tank' ? P.FUEL_TANK : q.k === 'booster' ? P.BOOST_FUEL : 0, w = P.MASS[q.k] + fuel;
    mx += w * (q.c - (cfg.COLS - 1) / 2); total += w;
    if (q.k === 'booster') { const s = stacks[stackAt[q.r + ',' + q.c]]; q.stackId = s.id; q.stack = s; return; }
    if (q.k === 'fin') {
      const si = q.ctx.attC == null ? undefined : stackAt[q.r + ',' + q.ctx.attC];
      if (si !== undefined) { const s = stacks[si]; s.fins.push(q.ctx.side); s.dry += P.MASS.fin; q.stackId = s.id; q.stack = s; return; }
      const f = stages[q.stage].coreFin; if (q.ctx.side === 'left') f.L++; else if (q.ctx.side === 'right') f.R++; else f.M++;
    }
    const S = stages[q.stage]; S.dry += P.MASS[q.k]; S.fuel += fuel;
    if (q.k === 'engine') S.eng++; if (q.k === 'vengine') S.veng++;
    if (q.k === 'leg') { if (q.ctx.side === 'left') S.legL++; else S.legR++; }   // v0.11 着陸脚（その段に つく。空気の じゃまは なし）
  });
  // 段ごとの 空気のじゃま（のこっている段の 胴体の列の数と 先っぽ）
  const drag = stages.map((_, s) => {
    const cols = new Set(), noseCols = new Set();
    for (let c = 0; c < cfg.COLS; c++) {
      let top = null; for (let r = 0; r < cfg.ROWS; r++) if (RL.BODY[grid[r][c]] && SR.of(r) >= s) { top = top || grid[r][c]; cols.add(c); }
      if (top === 'nose') noseCols.add(c);
    }
    return { cols: cols.size, noseCover: cols.size ? noseCols.size / cols.size : 0 };
  });
  const sum = (arr, f) => arr.reduce((z, x) => z + f(x), 0);
  const coreFin = { L: sum(stages, s => s.coreFin.L), R: sum(stages, s => s.coreFin.R), M: sum(stages, s => s.coreFin.M) };
  return { n, stages, stacks, drag, coreFin, cells, nStages: SR.n,
    fuel: sum(stages, s => s.fuel), bfuel: sum(stacks, s => s.fuel), dry: sum(stages, s => s.dry) + sum(stacks, s => s.dry),
    boosterFins: sum(stacks, s => s.fins.length), asym: total ? Math.abs(mx / total) : 0, cols: drag[0].cols, noseCover: drag[0].noseCover };
};

RL.simulate = function (a) {
  const P = RL.CFG.PHYS, k = P.TIME_STRETCH || 1, k2 = k * k, G = P.G / k2, DT = P.DT;
  const hasProp = a.stages.some(s => s.eng + s.veng > 0) || a.stacks.length;
  if (!hasProp) return { lift: false, h: 0, reason: 'noEngine', samples: [] };
  const TE = P.THRUST / k2, TV = P.VTHRUST / k2, TbOf = seg => P.BOOST_THRUST * Math.pow(seg, P.BOOST_SEG_POW || 0) / k2;
  const S = a.stages.map(s => ({ ...s, ignT: null, sepT: null, sepH: null }));
  const st = a.stacks.map(s => ({ ...s, ignT: null, sepT: null, sepH: null, withStage: false }));
  const last = S.length - 1;
  let si = 0;
  const ignite = (i, t) => { S[i].ignT = t; st.forEach(s => { if (s.stage === i) s.ignT = t; }); };
  ignite(0, 0);
  const attached = s => s.sepT === null && s.stage >= si;
  const mass = () => sum(S.slice(si), x => x.dry + x.fuel) + sum(st.filter(attached), x => x.dry + x.fuel);
  const sum = (arr, f) => arr.reduce((z, x) => z + f(x), 0);
  const finsNow = () => { const f = { L: 0, R: 0, M: 0 };
    S.slice(si).forEach(x => { f.L += x.coreFin.L; f.R += x.coreFin.R; f.M += x.coreFin.M; });
    st.filter(attached).forEach(s => s.fins.forEach(sd => sd === 'left' ? f.L++ : sd === 'right' ? f.R++ : f.M++));
    f.n = f.L + f.R + f.M; return f; };
  const tiltTarget = f => (f.n === 0 ? P.TILT_NOFIN : 0.08 * Math.abs(f.L - f.R) / f.n) + Math.min(0.4, a.asym * P.TILT_ASYM / (1 + f.n));
  let tilt = tiltTarget(finsNow());
  const s0 = S[0];
  const twr0 = (s0.eng * TE + s0.veng * TV * P.VAIR + sum(st.filter(s => s.stage === 0), s => TbOf(s.seg))) * Math.cos(tilt) / (mass() * G);

  let v = 0, h = 0, x = 0, t = 0, tBurnEnd = 0, vMax = 0, tAtmo = null, liftT = null;
  const samples = [];
  while (t < P.MAX_T * k) {
    const rho = Math.max(0, 1 - h / P.ATMO_H);
    if (rho === 0 && tAtmo === null) tAtmo = t;
    const cur = S[si], on = t >= cur.ignT;
    const vpow = P.VAIR + (1 - P.VAIR) * (1 - rho);
    const burnC = on && cur.fuel > 0 && cur.eng + cur.veng > 0;
    let thrustC = 0;
    if (burnC) { thrustC = cur.eng * TE + cur.veng * TV * vpow; cur.fuel = Math.max(0, cur.fuel - (cur.eng * P.BURN + cur.veng * P.VBURN) / k * DT); }
    let thrustB = 0, boost = false;
    st.forEach(s => {
      if (s.sepT !== null || s.ignT === null || t < s.ignT) return;
      if (s.fuel > 0) { s.fuel = Math.max(0, s.fuel - P.BOOST_BURN * Math.pow(s.seg, P.BOOST_SEG_POW || 0) / k * DT); thrustB += TbOf(s.seg); boost = true; }
      if (s.fuel <= 0) { s.sepT = t; s.sepH = h; }
    });
    if (burnC || boost) tBurnEnd = t;
    // 段の切りはなし：いまの段で 燃えるものが なくなったら
    let stageSep = null;
    if (si < last && on && !(cur.fuel > 0 && cur.eng + cur.veng > 0) && !st.some(s => s.stage === si && s.sepT === null && s.fuel > 0)) {
      cur.sepT = t; cur.sepH = h; stageSep = si;
      st.forEach(s => { if (s.stage === si && s.sepT === null) { s.sepT = t; s.sepH = h; s.withStage = true; } });
      si++; ignite(si, t + P.IGN_DELAY * k);
    }
    const m = Math.max(0.1, mass()), f = finsNow(), dir = Math.sign(f.L - f.R) || 1;
    if (h > 0) tilt = Math.min(1.2, tilt + tiltTarget(f) * P.TILT_GROW / k * rho * DT);
    const dg = a.drag[si];
    const cd = (P.DRAG * Math.max(1, dg.cols) * (1 - (1 - P.NOSE_DRAG) * dg.noseCover) + P.DRAG * P.BOOST_DRAG * st.filter(attached).length) * rho;
    const thrust = thrustC + thrustB;
    let acc = thrust * Math.cos(tilt) / m - G - cd * v * Math.abs(v) / m;
    if (h <= 0 && v <= 0 && acc < 0) acc = 0;
    v += acc * DT; h += v * DT; t += DT; vMax = Math.max(vMax, v);
    if (h <= 0 && v <= 0) { h = 0; v = 0; } else if (liftT === null) liftT = t;
    x += Math.sin(tilt) * dir * Math.max(0, v) * DT * 0.3;
    samples.push({ t, h: Math.max(0, h), v, acc, rho, si, burn: burnC, vpow, boost, thrust: thrust * k2, weight: m * G * k2,
      fuel: a.fuel ? sum(S.slice(si), y => y.fuel) / a.fuel : 0, tilt: tilt * dir, x, sep: stageSep });
    if (!burnC && !boost && v <= 0 && on && stageSep === null) break;
  }
  const top = Math.max(0, ...samples.map(s => s.h));
  return { lift: top >= 5, h: top, reason: top >= 5 ? null : 'heavy', liftT, twr0, tBurnEnd, tTotal: t, tAtmo, vMax, k, samples,
    stageInfo: S.map(s => ({ i: s.i, ignT: s.ignT, sepT: s.sepT, sepH: s.sepH, eng: s.eng, veng: s.veng })),
    seps: st.map(s => ({ id: s.id, c: s.c, r0: s.r0, r1: s.r1, stage: s.stage, t: s.sepT, h: s.sepH, ignT: s.ignT, withStage: s.withStage })) };
};

RL.zoneOf = function (h) { let i = 0; RL.CFG.ZONES.forEach((z, j) => { if (h >= z.h) i = j; }); return i; };
