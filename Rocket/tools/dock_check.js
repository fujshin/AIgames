// v0.20 ⛽ ステーション・ドッキング・補給の 確かめ
//  打ち上げ（よこ）→ 低い軌道で とめる → ふかす しるし（RL.Predict.stationBurn）まで まつ → まえへ。▲ が ステーションの 高さ に なったら とめる
//  → ちかづく（アームで キャッチ）→ ⛽ 補給 → のこりの Δv。flight2d と 同じ 早送りで 60fps を まねて 実時間も はかる
//  STOP=…：▲ を ステーションの 高さ ＋ この 数で とめる（子どもの ずれ）。LAG=…：しるしから この 秒（ゲームの 時間）おくれて ふかす
// 使い方: node tools/dock_check.js
const { RL, toGrid } = require('./lib2d.js');
RL.CFG.ROWS = RL.CFG.ROWS_ORBIT;
const T = n => Array(n).fill('tank'), B = n => Array(n).fill('booster');
const D = {
  'MOONSHIP（5章の 見本）': [['fin'], B(5), ['engine', ...T(3), 'ring', 'vengine+leg', ...T(2), 'win', 'nose'], B(5), ['fin']],
  'ORBIT（4章の 見本）': [['fin'], B(6), ['engine', ...T(4), 'ring', 'vengine+leg', ...T(3), 'win+chute', 'nose'], B(6), ['fin']],
  '2段 E3T｜V2T（ちいさい）': [[], ['fin'], ['engine', ...T(3), 'ring', 'vengine', ...T(2), 'win', 'nose'], ['fin'], []]
};
function run(cols, opt) {
  opt = opt || {};
  const s = RL.Orbit.create(RL.analyze(toGrid(cols)), { profile: 'side', station: true });
  let warp = 1, real = 0, ph = 0, info = {}, minD = 1e9, vAt = null, lagT = null;
  while (!s.done && real < 900) {
    const tg = s.autoWarp(); warp = tg > warp ? Math.min(tg, s.isPowered() ? warp * 1.02 + 0.003 : warp * 1.06 + 0.05) : tg;
    s.advance(warp / 60); real += 1 / 60;
    const el = s.elements();
    if (ph === 0 && s.engineOn && s.lifted && el && el.e < 1 && el.rp > s.body.R + s.body.atmo + 20) { s.setEngine(false); ph = 1; info.leo = real; info.leoT = s.t; info.dvLeo = s.dvLeftV();
      const b = RL.Predict.stationBurn(s); info.wait = b ? b.dt : null; }
    else if (ph === 1) { const b = RL.Predict.stationBurn(s);
      if (!b) { info.why = 'しるし なし（▲ が たかい ' + Math.round(el.ra - s.body.R) + '）'; break; }
      if (lagT == null && b.dt * Math.sqrt(s.body.mu / Math.pow(b.r, 3)) < 0.03) lagT = s.t + (opt.lag || 0);
      if (lagT != null && s.t >= lagT) { s.setDir('pro'); s.setEngine(true); ph = 2; info.burnReal = real; } }
    else if (ph === 2 && el.ra >= s.station.r + (opt.stop || 0)) { s.setEngine(false); ph = 3; const c = RL.Predict.stationClose(s); info.pred = c ? Math.round(c.d) + '/' + c.v.toFixed(1) : '-'; }
    else if (ph === 3) { const q = s.stRel(); if (q.d < minD) { minD = q.d; vAt = q.v; }
      if (q.d < (opt.go || 4000) && (opt.far || q.d > minD + 1 || q.d < 1200)) { s.setDir('retro'); s.setEngine(true); ph = 5; info.goD = Math.round(q.d); info.goV = q.v.toFixed(0); info.goReal = real; info.f0 = s.fuelRatio(); }
      if (s.t > info.leoT + 4000) { info.why = 'あえない'; break; } }
    else if (ph === 5) { if (s.docked) { ph = 4; info.dockReal = real; info.fUse = Math.round((info.f0 - s.fuelRatio()) * 100); s.refuel(); info.dvFull = s.dvLeftV(); break; } if (!s.liquidLeft()) { info.why = 'ねんりょうぎれ'; break; } }
    s.events.splice(0);
  }
  return Object.assign(info, { minD: Math.round(minD), vAt, ph, real });
}
if (require.main === module) {
  for (const k in D) {
    const r = run(D[k]);
    console.log(k.padEnd(22), r.ph === 4 ? `ドッキング ✔ 低い軌道まで 実時間${r.leo.toFixed(0)}秒 しるしまで ゲーム${Math.round(r.wait)}秒 → ふかす(実${r.burnReal.toFixed(0)}) → キャッチ(実${r.dockReal.toFixed(0)}) 予測${r.pred}（きょり/くらべた はやさ）→ ちかづく 開始 ${r.goD}/${r.goV}(実${r.goReal.toFixed(0)}) 燃料${r.fUse}%｜Δv 低い軌道 ${Math.round(r.dvLeo)} → 満タン ${Math.round(r.dvFull)}`
      : `× ${r.why || ''} いちばん ちかい ${r.minD} はやさ ${r.vAt && r.vAt.toFixed(1)} 予測${r.pred}`);
  }
  console.log('\nずれ（MOONSHIP）：おくれ LAG 秒 × ▲ の とめ方 STOP');
  for (const lag of [0, 2, 5, 10, 20]) console.log(' LAG' + lag, [0, 80, 300, -200].map(stop => { const r = run(D['MOONSHIP（5章の 見本）'], { lag, stop }); return 'STOP' + stop + ':' + (r.ph === 4 ? '✔' + r.fUse + '%' : '×' + (r.why || '') + r.minD); }).join('  '));
  console.log(' はやく ちかづく（きょり 4000 で すぐ）：', Object.keys(D).map(k => { const r = run(D[k], { go: 4000, far: 1 }); return r.ph === 4 ? '✔' + r.fUse + '%' : '×'; }).join(' '));
}
module.exports = { run };
// ---- 補給の あと 月往還（MOONSHIP）：はなれる → しるし（月）で まえへ → 月に 着陸 → 離陸 → かえる しるし → 🪂／エンジンで 地球
function trip(cols, w, noRef) {
  (0, eval)(require('fs').readFileSync(__dirname + '/../js/missions.js', 'utf8'));
  const M = RL.Missions, LD = RL.CFG.ORBIT.LAND.moon;
  const s = RL.Orbit.create(RL.analyze(toGrid(cols)), { profile: 'side', station: true });
  let ph = 0, t0 = 0, info = '', lagT = null;
  const wind = () => Math.hypot(s.vx + s.bodies.earth.rot * s.y, s.vy - s.bodies.earth.rot * s.x);
  while (!s.done && s.t < 200000) {
    s.advance(s.isPowered() || s.alt() < 1500 ? 0.02 : Math.max(0.02, Math.min(s.autoWarp(), 200) * 0.05));
    const el = s.elements(); if (!el) continue;
    const r = Math.hypot(s.x, s.y), h = r - s.body.R, vr = (s.vx * s.x + s.vy * s.y) / r, vt = (s.vx * -s.y + s.vy * s.x) / r;
    if (ph === 0 && s.engineOn && s.lifted && el.e < 1 && el.rp > s.body.R + s.body.atmo + 20) { s.setEngine(false); ph = 1; }
    else if (ph === 1) { const b = RL.Predict.stationBurn(s); if (b && b.dt * Math.sqrt(s.body.mu / Math.pow(b.r, 3)) < 0.03) { s.setDir('pro'); s.setEngine(true); ph = 2; } }
    else if (ph === 2 && el.ra >= s.station.r) { s.setEngine(false); ph = 3; }
    else if (ph === 3) { const q = s.stRel(); if (q.d < 1200) { s.setDir('retro'); s.setEngine(true); ph = 4; } }
    else if (ph === 4 && s.docked) { if (!noRef) { s.refuel(); info += ' 補給'; } else info += ' 補給なし'; s.setEngine(true); ph = 5; t0 = s.t; }
    else if (ph === 5 && s.t > t0 + 2) { s.setEngine(false); ph = 6; t0 = s.t; }
    else if (ph === 6 && s.t > t0 + w) { s.setDir('pro'); s.setEngine(true); ph = 7; }
    else if (ph === 7) { const p = RL.Predict.fromSim(s); if (p && p.enc && p.enc.peAlt > 300 && p.enc.peAlt < 4000) { s.setEngine(false); ph = 8; info += ' 月へ'; } else if (el.e >= 1 || el.ra > s.bodies.moon.orbitR * 1.3 || !s.liquidLeft()) return { info: info + ' ×月へ', s }; }
    else if (ph === 8 && s.body.id === 'moon' && vr < 0 && r < el.rp * 1.03 + 50) { s.setDir('retro'); s.setEngine(true); ph = 9; }
    else if (ph === 9 && ((s.cls === 'moonOrbit' && el.ra < Math.max(s.body.R * 2, r * 1.25)) || !s.liquidLeft())) { s.setEngine(false); ph = 10; }
    else if (ph === 10) { s.setEngine(true); ph = 11; }
    else if (ph === 11 && (Math.abs(vt) < 3 || !s.liquidLeft())) { s.setEngine(false); ph = 12; }
    else if (ph === 12) { if (s.surface) { info += ' 着陸'; s.setEngine(true); ph = 13; continue; }
      const g = s.body.mu / (r * r), vd = Math.max(0, -vr), aAv = s.near ? (LD.TWR - 1) * g : 20;
      if (!s.engineOn && vd * vd / (2 * aAv) > h * 0.85 - 3) s.setEngine(true); }
    else if (ph === 13 && !s.engineOn && !s.surface) { ph = 14; info += ' 離陸'; }
    else if (ph === 14) { const hh = M.homeAng(s); if (hh && hh.dt < 3) { s.setDir('pro'); s.setEngine(true); ph = 15; } }
    else if (ph === 15) { const p = RL.Predict.fromSim(s); if (p && p.home) { s.setEngine(false); ph = 16; info += ' 🏠 燃料' + Math.round(s.fuelRatio() * 100) + '%'; } else if (!s.liquidLeft()) return { info: info + ' ×燃料ぎれ', s }; }
    else if (ph === 16 && s.body === s.bodies.earth && h < 300 && s.chutes() && !s.chute && wind() < 76) s.deployChute();
    else if (ph === 16 && s.body === s.bodies.earth && s.near && !s.chutes() && s.liquidLeft()) { s.setDir('retro'); s.setEngine(true); }
  }
  return { info, s };
}
if (require.main === module) {
  const cols = [['fin'], B(5), ['engine', ...T(3), 'ring', 'vengine+leg', ...T(2), 'win+chute', 'nose'], B(5), ['fin']];
  let out = null; for (let w = 0; w <= 600 && !(out && out.s.done && out.s.done.returned); w += 20) out = Object.assign(trip(cols, w), { w });
  const d = out.s.done || {};
  console.log('\n補給して 月往還（MOONSHIP＋🪂）：', out.info, '→', d.type || '-', d.returned ? '🪨 往還' : '', d.vDown != null ? '↓' + d.vDown.toFixed(1) : '', ' w=' + out.w);
  let o2 = null; for (let w = 0; w <= 600 && !(o2 && o2.s.done && o2.s.done.returned); w += 20) o2 = Object.assign(trip(cols, w, true), { w });
  const d2 = o2.s.done || {}; console.log('くらべ：補給 しない：', o2.info, '→', d2.type || '-', d2.returned ? '🪨' : '', d2.body || '');
}
