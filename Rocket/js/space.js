// うちゅうの しくみ（2D）：天体と ケプラー軌道の計算
//  - すべての天体は 同じ平面。公転は 円軌道で固定（反時計回り）
//  - 天体は 木の形（地球 → 月 …）。乗り物は いつも「いま いる重力圏の天体」から見た 位置・速度で持つ（パッチドコニック）
//  - 軌道要素 { mu, a, e, w, s, n, tp } … w=近点の向き、s=回る向き(+1 反時計 / -1 時計)、tp=近点を通る時刻
//  - 打ち上げた衛星などは 将来、この軌道要素だけを保存すれば いつでも位置が出せる（レール上）
RL.Space = (function () {
  const TAU = Math.PI * 2;
  const len = (x, y) => Math.hypot(x, y);

  // ---- 天体 ----
  function makeBodies() {
    const O = RL.CFG.ORBIT, R = O.R, mu = O.G0 * R * R;
    const earth = { id: 'earth', icon: '🌍', R, mu, atmo: O.ATMO_H, rot: O.ROT * Math.sqrt(mu / R) / R, soi: O.EARTH_SOI * R, parent: null };
    const M = O.MOON, D = M.DIST * R, mmu = mu * M.MU;
    const moon = { id: 'moon', icon: '🌙', R: M.R * R, mu: mmu, atmo: 0, rot: 0, parent: earth, orbitR: D,
      w: Math.sqrt(mu / (D * D * D)), ph0: M.PHASE, soi: D * Math.pow(M.MU, 0.4) };
    earth.children = [moon]; moon.children = [];
    return { earth, moon, list: [earth, moon] };
  }
  // 親から見た 天体の位置・速度（時刻 t）
  function bodyState(b, t) {
    if (!b.parent) return { x: 0, y: 0, vx: 0, vy: 0 };
    const a = b.ph0 + b.w * t, r = b.orbitR, v = b.w * r;
    return { x: r * Math.cos(a), y: r * Math.sin(a), vx: -v * Math.sin(a), vy: v * Math.cos(a) };
  }

  // ---- 状態 → 軌道要素 ----
  function toElements(x, y, vx, vy, mu, t) {
    const r = len(x, y), v2 = vx * vx + vy * vy, h = x * vy - y * vx, rv = x * vx + y * vy;
    const en = v2 / 2 - mu / r;
    let ex = ((v2 - mu / r) * x - rv * vx) / mu, ey = ((v2 - mu / r) * y - rv * vy) / mu, e = len(ex, ey);
    const s = h >= 0 ? 1 : -1, p = h * h / mu;
    if (Math.abs(e - 1) < 1e-7) { e = e < 1 ? 1 - 1e-7 : 1 + 1e-7; }   // ぴったり放物線は さける
    const w = e > 1e-9 ? Math.atan2(ey, ex) : 0;
    const a = -mu / (2 * en);
    const nu = Math.atan2(s * ((Math.cos(w) * y - Math.sin(w) * x)), Math.cos(w) * x + Math.sin(w) * y);
    const el = { mu, a, e, w, s, p, en, h };
    if (e < 1) {
      const E = 2 * Math.atan(Math.sqrt((1 - e) / (1 + e)) * Math.tan(nu / 2)), M = E - e * Math.sin(E);
      el.n = Math.sqrt(mu / (a * a * a)); el.tp = t - M / el.n; el.T = TAU / el.n;
      el.rp = a * (1 - e); el.ra = a * (1 + e);
    } else {
      const H = 2 * Math.atanh(Math.sqrt((e - 1) / (e + 1)) * Math.tan(nu / 2)), M = e * Math.sinh(H) - H;
      el.n = Math.sqrt(mu / (-a * -a * -a)); el.tp = t - M / el.n; el.T = Infinity;
      el.rp = a * (1 - e); el.ra = Infinity; el.nuMax = Math.acos(-1 / e);
    }
    el.nu = nu;
    // ほぼ真上・真下に とぶ軌道（放物線に ちかい細長い軌道）は 式が ふあんてい → 数値積分にまかせる
    el.good = Math.abs(e - 1) > 2e-3 && p > 2e-3 * r && isFinite(el.tp);
    return el;
  }
  // ケプラー方程式
  function solveE(M, e) {
    M = ((M + Math.PI) % TAU + TAU) % TAU - Math.PI;
    let E = e < 0.8 ? M : Math.PI * Math.sign(M || 1);
    for (let i = 0; i < 50; i++) { const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); E -= d; if (Math.abs(d) < 1e-12) break; }
    return E;
  }
  function solveH(M, e) {
    let H = Math.asinh(M / e);
    for (let i = 0; i < 60; i++) { const d = (e * Math.sinh(H) - H - M) / (e * Math.cosh(H) - 1); H -= d; if (Math.abs(d) < 1e-12) break; }
    return H;
  }
  // 真近点角 nu での 位置・速度
  function stateAtNu(el, nu) {
    const { mu, e, w, s, p } = el, r = p / (1 + e * Math.cos(nu)), ph = w + s * nu;
    const k = Math.sqrt(mu / p), vr = k * e * Math.sin(nu), vt = k * (1 + e * Math.cos(nu));
    const c = Math.cos(ph), sn = Math.sin(ph);
    return { x: r * c, y: r * sn, vx: vr * c - s * vt * sn, vy: vr * sn + s * vt * c, r, nu };
  }
  // ---- 軌道要素 → 時刻 t の 位置・速度（レール上） ----
  function nuAt(el, t) {
    const M = el.n * (t - el.tp);
    if (el.e < 1) { const E = solveE(M, el.e); return 2 * Math.atan2(Math.sqrt(1 + el.e) * Math.sin(E / 2), Math.sqrt(1 - el.e) * Math.cos(E / 2)); }
    const H = solveH(M, el.e); return 2 * Math.atan(Math.sqrt((el.e + 1) / (el.e - 1)) * Math.tanh(H / 2));
  }
  const stateAt = (el, t) => stateAtNu(el, nuAt(el, t));
  // 真近点角 → 近点からの 時間
  function timeFromPeri(el, nu) {
    const e = el.e;
    if (e < 1) { const E = 2 * Math.atan(Math.sqrt((1 - e) / (1 + e)) * Math.tan(nu / 2)); return (E - e * Math.sin(E)) / el.n; }
    const H = 2 * Math.atanh(Math.sqrt((e - 1) / (e + 1)) * Math.tan(nu / 2)); return (e * Math.sinh(H) - H) / el.n;
  }
  // 半径 r になる 真近点角（なければ null）
  function nuAtR(el, r) { const c = (el.p / r - 1) / el.e; return Math.abs(c) <= 1 ? Math.acos(c) : null; }

  // 軌道の種類（地球の まわり）。結果画面と ことばで 使う
  function classify(el, body, moonR) {
    const top = body.R + body.atmo;
    if (el.e >= 1 || el.en >= 0) return 'escape';
    if (el.rp < top) return el.ra < top ? 'air' : 'ballistic';
    if (!body.parent && moonR && el.ra >= moonR * 0.9) return 'toMoon';
    return el.ra < body.R * (1 + RL.CFG.ORBIT.LEO_TOP) ? 'low' : 'high';
  }
  // v0.20 ⛽ ステーション（まんまるの 軌道。天体では ない ので 重力は ない）
  function makeStation(earth) { const O = RL.CFG.ORBIT, S = O.STATION || { H: 600, PHASE: 0 }, r = earth.R + S.H;
    return { r, w: Math.sqrt(earth.mu / (r * r * r)), ph0: O.SITE + S.PHASE }; }
  function stationState(S, t) { const a = S.ph0 + S.w * t, v = S.w * S.r; return { x: S.r * Math.cos(a), y: S.r * Math.sin(a), vx: -v * Math.sin(a), vy: v * Math.cos(a), a }; }
  return { makeStation, stationState, makeBodies, bodyState, toElements, stateAt, stateAtNu, nuAt, timeFromPeri, nuAtR, classify, TAU };
})();
