// 予測の線（v0.8.1 改修3）：このまま エンジンを使わずに 飛ぶと どうなるか
//  - いまの重力圏の 軌道を たどり、地面にぶつかる／重力圏を出る／月の重力圏に入る（であい）を さがす
//  - 月との であいが あれば、月から見た 軌道に のりかえて 続きを たどる（月に ぶつかる／月を まわる／月の そばを 通りぬける）
//  - 月の線は「であう ときの 月の位置」（うすい月）を 中心に 描く
//  - 物理（physics2d）と 同じ 式・同じ天体を つかうので、予測と 実際が そろう（tools/predict_test.js）
RL.Predict = (function () {
  const SP = RL.Space, TAU = Math.PI * 2;
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

  // 近点からの 時間（だ円は 周回ぶんも つなげて 単調にする）
  function tOfNu(el, nu) {
    if (el.e < 1) { const w = wrap(nu); return SP.timeFromPeri(el, w) + (nu - w) / el.n; }
    return SP.timeFromPeri(el, nu);
  }
  // 重力だけの 数値積分（ほぼ真上に とぶ 細長い軌道用）
  function rk4Path(st, mu, t0, stop, maxT) {
    let { x, y, vx, vy } = st, t = t0; const out = [{ t, x, y, vx, vy }];
    const f = (x, y) => { const r3 = Math.pow(x * x + y * y, 1.5); return [-mu * x / r3, -mu * y / r3]; };
    for (let i = 0; i < 4000 && t < t0 + maxT; i++) {
      const r = Math.hypot(x, y), v = Math.max(1e-6, Math.hypot(vx, vy)), dt = Math.max(1e-3, 0.01 * Math.min(r / v, Math.sqrt(r * r * r / mu)));
      const a1 = f(x, y), a2 = f(x + vx * dt / 2, y + vy * dt / 2);
      const v2x = vx + a1[0] * dt / 2, v2y = vy + a1[1] * dt / 2, a3 = f(x + v2x * dt / 2, y + v2y * dt / 2);
      const v3x = vx + a2[0] * dt / 2, v3y = vy + a2[1] * dt / 2, a4 = f(x + v3x * dt, y + v3y * dt);
      const v4x = vx + a3[0] * dt, v4y = vy + a3[1] * dt;
      x += dt / 6 * (vx + 2 * v2x + 2 * v3x + v4x); y += dt / 6 * (vy + 2 * v2y + 2 * v3y + v4y);
      vx += dt / 6 * (a1[0] + 2 * a2[0] + 2 * a3[0] + a4[0]); vy += dt / 6 * (a1[1] + 2 * a2[1] + 2 * a3[1] + a4[1]); t += dt;
      out.push({ t, x, y, vx, vy });
      if (stop(out[out.length - 1])) break;
    }
    return out;
  }

  // 1つの重力圏の中を たどる
  //  返す: { pts:[[x,y]], el, end:{ type:'hit'|'exit'|'enc'|'loop', t, st } }
  function trace(st, body, t0, N, MS) {
    N = N || 240;
    const el = SP.toElements(st.x, st.y, st.vx, st.vy, body.mu, t0), soi = body.soi;
    const child = (body.children || [])[0];
    let samp = [], end = { type: 'loop' }, at;
    if (el.good) {
      let nuEnd = el.nu + TAU;
      if (el.e >= 1 || el.ra > soi) { const n2 = SP.nuAtR(el, soi); nuEnd = n2 == null ? el.nu + TAU : Math.max(el.nu, n2); end = { type: 'exit' }; }
      const tn0 = tOfNu(el, el.nu);
      for (let i = 0; i <= N; i++) { const nu = el.nu + (nuEnd - el.nu) * i / N, s = SP.stateAtNu(el, nu); s.t = t0 + tOfNu(el, nu) - tn0; samp.push(s); }
      at = t => SP.stateAt(el, t);
    } else {
      samp = rk4Path(st, body.mu, t0, s => Math.hypot(s.x, s.y) < body.R || Math.hypot(s.x, s.y) > soi, 4 * Math.PI * Math.sqrt(Math.pow(Math.hypot(st.x, st.y) * 2, 3) / body.mu));
      const last = samp[samp.length - 1]; end = { type: Math.hypot(last.x, last.y) > soi ? 'exit' : 'loop' };
      at = t => { let i = samp.findIndex(s => s.t >= t); if (i <= 0) return samp[Math.max(0, i)]; const a = samp[i - 1], b = samp[i], k = (t - a.t) / (b.t - a.t);
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, vx: a.vx + (b.vx - a.vx) * k, vy: a.vy + (b.vy - a.vy) * k }; };
    }
    const tEnd0 = samp[samp.length - 1].t;
    if (end.type === 'exit') { end.t = tEnd0; end.st = samp[samp.length - 1]; }
    // 地面に ぶつかる 時刻
    let tHit = Infinity;
    for (let i = 1; i < samp.length; i++) if (Math.hypot(samp[i].x, samp[i].y) < body.R) {
      let lo = samp[i - 1].t, hi = samp[i].t; for (let k = 0; k < 40; k++) { const md = (lo + hi) / 2, s = at(md); if (Math.hypot(s.x, s.y) < body.R) hi = md; else lo = md; }
      tHit = hi; break; }
    // 月（子の天体）との であい：月の重力圏に入る 最初の時刻（時間で こまかく しらべる）
    let tEnc = Infinity;
    if (child && el.rp < child.orbitR + child.soi && (el.e >= 1 || el.ra > child.orbitR - child.soi)) {
      const tA = t0, tB = Math.min(tEnd0, tHit), M = MS || 900, inSoi = t => { const s = at(t), c = SP.bodyState(child, t); return Math.hypot(s.x - c.x, s.y - c.y) < child.soi; };
      let prevT = tA;
      for (let i = 1; i <= M; i++) { const t = tA + (tB - tA) * i / M;
        if (inSoi(t)) { let lo = prevT, hi = t; for (let k = 0; k < 40; k++) { const md = (lo + hi) / 2; if (inSoi(md)) hi = md; else lo = md; } tEnc = hi; break; }
        prevT = t; }
    }
    if (tHit < Infinity || tEnc < Infinity) {
      const t = Math.min(tHit, tEnc); end = { type: tEnc < tHit ? 'enc' : 'hit', t, st: at(t) };
      samp = samp.filter(s => s.t < t); samp.push(Object.assign({ t }, end.st));
    }
    return { pts: samp.map(s => [s.x, s.y]), el, end };
  }

  // sim（physics2d）から 予測をつくる
  function fromSim(sim) {
    if (!sim || !sim.lifted) return null;
    const W = sim.bodies, E = W.earth, M = W.moon, b = sim.body;
    const off = b.parent ? SP.bodyState(b, sim.t) : { x: 0, y: 0 };
    const tr = trace(sim, b, sim.t);
    const segs = [], res = { segs, el: tr.el, off, body: b.id, enc: null };
    const shift = (pts, o) => pts.map(p => [p[0] + o.x, p[1] + o.y]);
    let kind;
    if (b === E) {
      kind = tr.end.type === 'hit' ? 'hit' : tr.end.type === 'exit' ? 'escape' : (tr.el.rp < E.R + E.atmo ? 'hit' : 'orbit');
      if (tr.end.type === 'enc') kind = 'moon';
    } else kind = tr.end.type === 'hit' ? 'moonHit' : tr.end.type === 'exit' ? 'moonPass' : 'moonOrbit';
    segs.push({ pts: shift(tr.pts, off), kind: b === E ? (kind === 'moon' ? 'orbit' : kind) : kind });
    if (tr.end.type === 'enc') {
      // 月から見た 続き（であう ときの 月の位置を 中心に）
      const tE = tr.end.t, ms = SP.bodyState(M, tE), s = tr.end.st;
      const rel = { x: s.x - ms.x, y: s.y - ms.y, vx: s.vx - ms.vx, vy: s.vy - ms.vy };
      const tm = trace(rel, M, tE, 200);
      kind = tm.end.type === 'hit' ? 'moonHit' : tm.end.type === 'exit' ? 'moonPass' : 'moonOrbit';
      segs.push({ pts: shift(tm.pts, ms), kind, moon: true });
      res.enc = { t: tE, x: ms.x, y: ms.y, el: tm.el, peAlt: tm.el.rp - M.R, hitPt: tm.end.type === 'hit' ? tm.pts[tm.pts.length - 1] : null };
      if (tm.end.type === 'exit') res.enc.fate = fateAfter(tm.end.st, tm.end.t, M, E);
    } else if (b === M && tr.end.type === 'exit') {
      res.fate = fateAfter(tr.end.st, tr.end.t, M, E);
      // v0.13：月から はなれた あとの 線（地球から 見た）。くうきに 入る なら かえれる（home）
      const f = res.fate, ms = SP.bodyState(M, tr.end.t), s = tr.end.st, ge = { x: s.x + ms.x, y: s.y + ms.y, vx: s.vx + ms.vx, vy: s.vy + ms.vy };
      const tg = trace(ge, E, tr.end.t, 160, 200), home = homeEl(tg.el, E);
      segs.push({ pts: tg.pts, kind: home ? 'home' : f.kind === 'hit' ? 'hit' : f.kind === 'escape' ? 'escape' : 'orbit', after: true });
      if (home) { res.home = true; f.kind = 'home'; }
    }
    // v0.13：月に 着陸した あと 地球に もどって くうきに 入る 線
    if (b === E && sim.moonLanded && kind === 'hit' && homeEl(tr.el, E)) { segs[0].kind = 'home'; kind = 'home'; res.home = true; }
    res.kind = kind;
    return res;
  }
  // 月の重力圏を出た あと、地球から見て どうなるか（スイングバイの 結果）
  function fateAfter(st, t, M, E) {
    const ms = SP.bodyState(M, t), x = st.x + ms.x, y = st.y + ms.y, vx = st.vx + ms.vx, vy = st.vy + ms.vy;
    const el = SP.toElements(x, y, vx, vy, E.mu, t);
    return { at: [x, y], kind: el.e >= 1 || el.ra > E.soi ? 'escape' : el.rp < E.R + E.atmo ? 'hit' : 'orbit' };
  }
  // v0.10：いま 燃やしている 向きに あと L まで 速さを 足したら（いまも ふくむ）月と であうか
  //  （月と であう 予測に かわる すぐ手前で、スローモーションを もっと ゆっくりに する）
  function moonNear(sim, L) {
    if (!sim.lifted || sim.body !== sim.bodies.earth) return false;
    const tx = sim.tdx || 0, ty = sim.tdy || 0;
    for (const k of [0, 0.5, 1]) {
      const st = { x: sim.x, y: sim.y, vx: sim.vx + tx * L * k, vy: sim.vy + ty * L * k };
      if (trace(st, sim.body, sim.t, 120).end.type === 'enc') return true;
    }
    return false;
  }
  // v0.11：いま エンジンを とめたら、地面に つく ときの 下むき・よこの 速さ（つかない なら null）
  //  v0.12：地球でも（くうき・パラシュートを ふくめる。physics2d の fallInfo）
  function touchdown(sim) {
    const b = sim.body; if (!sim.lifted) return null;
    const r = Math.hypot(sim.x, sim.y), h = r - b.R;
    if (b.atmo || h < b.R * 0.2) return sim.fallInfo();
    const tr = trace(sim, b, sim.t, 120);
    if (tr.end.type !== 'hit') return null;
    const e = tr.end.st, rr = Math.hypot(e.x, e.y), eu = [e.x / rr, e.y / rr];
    return { vDown: Math.max(0, -(e.vx * eu[0] + e.vy * eu[1])), vSide: Math.abs(e.vx * -eu[1] + e.vy * eu[0]), t: tr.end.t - sim.t };
  }
  // v0.13：くうきに 入る（近い ところが くうきの 中、地面より 上も ふくむ）
  function homeEl(el, E) { return el && el.rp < E.R + E.atmo && el.e < 1.2; }
  // v0.13：月から見た 状態 st から、月を はなれて 地球の くうきに 入るか
  function homeFrom(st, t, W) {
    const M = W.moon, E = W.earth, tr = trace(st, M, t, 80);
    if (tr.end.type !== 'exit') return false;
    const ms = SP.bodyState(M, tr.end.t), s = tr.end.st, el = SP.toElements(s.x + ms.x, s.y + ms.y, s.vx + ms.vx, s.vy + ms.vy, E.mu, tr.end.t);
    return homeEl(el, E);
  }
  // v0.20 ⛽ このまま とぶと ステーションに いちばん ちかづく ところ（1周 ぶん）。{ t, d（きょり）, v（くらべた はやさ）, sx, sy（その ときの ステーション）, rx, ry }
  function stationClose(sim) {
    if (!sim || !sim.lifted || sim.docked || sim.body !== sim.bodies.earth || !sim.station) return null;
    const el = SP.toElements(sim.x, sim.y, sim.vx, sim.vy, sim.body.mu, sim.t); if (!el.good || el.e >= 1) return null;
    const S = sim.station, E = sim.bodies.earth, T = Math.min(el.T, 2 * Math.PI / S.w) * 1.05, N = 180;
    const at = t => { const p = SP.stateAt(el, t), q = SP.stationState(S, t); return { p, q, d: Math.hypot(p.x - q.x, p.y - q.y) }; };
    let best = null;
    for (let i = 0; i <= N; i++) { const t = sim.t + T * i / N, z = at(t); if (Math.hypot(z.p.x, z.p.y) < E.R + E.atmo) break; if (!best || z.d < best.d) best = { t, d: z.d }; }
    if (!best) return null;
    let lo = best.t - T / N, hi = best.t + T / N;   // 三分探索で こまかく
    for (let k = 0; k < 40; k++) { const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3; if (at(m1).d < at(m2).d) hi = m2; else lo = m1; }
    const z = at((lo + hi) / 2);
    return { t: (lo + hi) / 2, d: z.d, v: Math.hypot(z.p.vx - z.q.vx, z.p.vy - z.q.vy), sx: z.q.x, sy: z.q.y, rx: z.p.x, ry: z.p.y };
  }
  // v0.20 ⛽ ふかす ところ：ここで まえに ふかして ▲ を ステーションの 高さに すると、▲ で ステーションに あう（4章の ふかす しるしと おなじ かんがえ）
  function stationBurn(sim) {
    if (!sim || !sim.lifted || sim.docked || sim.body !== sim.bodies.earth || !sim.station) return null;
    const el = SP.toElements(sim.x, sim.y, sim.vx, sim.vy, sim.body.mu, sim.t); if (el.e >= 0.3) return null;
    const S = sim.station, mu = sim.body.mu, r = Math.hypot(sim.x, sim.y), R = S.r; if (r > R - 30 || el.ra > R - 30) return null;
    const th = Math.PI * Math.sqrt(Math.pow((r + R) / 2, 3) / mu), n = Math.sqrt(mu / (r * r * r)), a0 = Math.atan2(sim.y, sim.x), phS = SP.stationState(S, sim.t).a;
    const d = ((phS + S.w * th - Math.PI - a0) % TAU + TAU) % TAU, tb = d / (n - S.w);
    return { ang: a0 + n * tb, dt: tb, r };
  }
  return { fromSim, trace, moonNear, touchdown, homeFrom, stationClose, stationBurn };
})();
