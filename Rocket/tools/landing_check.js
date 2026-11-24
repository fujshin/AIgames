// v0.11 月着陸の 確かめ：自動の パイロットで 打ち上げ → 低い軌道 → 月へ → 月を まわる → 着陸
//  1. よこ で 打ち上げ、低い軌道で とめる  2. wait 秒後 前へ、月と であう 予測で とめる
//  3. 月の重力圏で 月に いちばん ちかづく ところで うしろへ、月を まわったら とめる
//  4. うしろへ で よこの 速さを けす  5. おちる。とまりきれない 高さに なったら うしろへ（地面ちかくは 自動で しぼる・ホバー）
//     ホバー中、いま とめても 着陸できる 速さ なら とめる
// 使い方: node tools/landing_check.js          （LOG=1 で 1つずつ くわしく）
const { RL, toGrid } = require('./lib2d.js');
const T = n => Array(n).fill('tank'), B = n => Array(n).fill('booster');
const LD = RL.CFG.ORBIT.LAND, SL = RL.CFG.ORBIT.SLOW;
const cfgs = {
  '2段 B5 E3T｜V2T+N 脚':   [['fin'], [...B(5), 'leg'], ['engine', ...T(3), 'ring', 'vengine', ...T(2), 'nose'], [...B(5), 'leg'], ['fin']],
  '2段 B5 E3T｜V2T+N':      [['fin'], B(5), ['engine', ...T(3), 'ring', 'vengine', ...T(2), 'nose'], B(5), ['fin']],
  '2段 B4 E3T｜V2T+N 脚':   [['fin'], [...B(4), 'fin', 'leg'], ['engine', ...T(3), 'ring', 'vengine', ...T(2), 'nose'], [...B(4), 'fin', 'leg'], ['fin']],
  '2段 B4 E2T｜V3T+N 脚':   [['fin'], [...B(4), 'leg'], ['engine', ...T(2), 'ring', 'vengine', ...T(3), 'nose'], [...B(4), 'leg'], ['fin']],
  '2段 B5 E3T｜V3T+N（v0.10の見本）': [['fin'], B(5), ['engine', ...T(3), 'ring', 'vengine', ...T(3), 'nose'], B(5), ['fin']],
  '2段 E3T｜V2T+N（ブースターなし）': [[], ['fin'], ['engine', ...T(3), 'ring', 'vengine', ...T(2), 'nose'], ['fin'], []],
};
const P = RL.CFG.PHYS;
// のこりの Δv（いまの 段から 上。くうきの外）
function dvLeft(s) { let dv = 0; const S = s.stages; for (let i = S.length - 1; i >= s.si; i--) {
  const st = S[i]; if (!(st.eng + st.veng)) continue; const ve = (st.eng * P.THRUST + st.veng * P.VTHRUST) / (st.eng * P.BURN + st.veng * P.VBURN * (RL.CFG.ORBIT.VAC_VBURN_K || 1));
  const above = S.slice(i + 1).reduce((z, x) => z + x.dry + x.fuel, 0); dv += ve * Math.log((above + st.dry + st.fuel) / (above + st.dry)); } return dv; }
function pilot(cols, wait, log) {
  const s = RL.Orbit.create(RL.analyze(toGrid(cols)), { profile: 'side', autoEnd: true });
  let ph = 0, cut = null, info = { fuelMoon: null };
  const L = (...a) => log && console.log(' ', Math.round(s.t), ...a);
  while (!s.done && s.t < 120000) {
    s.moonNear = s.isPowered() && s.inSpace && s.body.id === 'earth' && ph === 2 && RL.Predict.moonNear(s, SL.LOOK_MOON);
    s.advance(s.isPowered() ? 0.02 : Math.max(0.02, Math.min(s.autoWarp(), 200) * 0.05));
    const el = s.elements(); if (!el) continue;
    const r = Math.hypot(s.x, s.y), h = r - s.body.R, ux = s.x / r, uy = s.y / r, vr = s.vx * ux + s.vy * uy, vt = s.vx * -uy + s.vy * ux;
    if (ph === 0 && el.e < 1 && el.rp > s.body.R + s.body.atmo + 20) { s.setEngine(false); cut = s.t; ph = 1; L('LEO', Math.round(s.fuelRatio() * 100) + '%'); }
    else if (ph === 1 && s.t > cut + wait) { s.setEngine(true); ph = 2; }
    else if (ph === 2) { const p = RL.Predict.fromSim(s); if (p && p.enc && p.enc.peAlt > 300 && p.enc.peAlt < 4000) { s.setEngine(false); ph = 3; L('enc', Math.round(p.enc.peAlt), Math.round(s.fuelRatio() * 100) + '%', 'dv', Math.round(dvLeft(s))); }
      else if (el.e >= 1 || el.ra > s.bodies.moon.orbitR * 1.3) return { s, why: 'miss' };
      else if (!s.liquidLeft()) return { s, why: 'nofuel-tli' }; }
    else if (ph === 3 && s.body.id === 'moon') { if (vr < 0 && r < el.rp * 1.03 + 50) { s.setDir('retro'); s.setEngine(true); ph = 4; info.fuelMoon = s.fuelRatio(); info.dvMoon = dvLeft(s); L('capture', Math.round(s.fuelRatio() * 100) + '%'); } }
    else if (ph === 4) { if ((s.cls === 'moonOrbit' && el.ra < Math.max(s.body.R * 2, r * 1.25)) || !s.liquidLeft()) { s.setEngine(false); ph = 5; L('orbit', Math.round(el.rp - s.body.R), Math.round(el.ra - s.body.R), Math.round(s.fuelRatio() * 100) + '%'); } }
    else if (ph === 5) { s.setEngine(true); ph = 6; }
    else if (ph === 6) { if (Math.abs(vt) < 3 || !s.liquidLeft()) { s.setEngine(false); ph = 7; L('deorbit h', Math.round(h), Math.round(s.fuelRatio() * 100) + '%'); } }
    else if (ph === 7) {
      const g = s.body.mu / (r * r), vd = Math.max(0, -vr), aAv = s.near ? (LD.TWR - 1) * g : 20;
      const td = RL.Predict.touchdown(s), allow = LD.V_DOWN * (s.legs().n ? LD.LEG_K : 1) * 0.7;
      if (s.engineOn && s.hover) { s.setEngine(false); L('drop at h', h.toFixed(1), td && td.vDown <= allow ? 'OK' : ''); }
      else if (!s.engineOn && vd * vd / (2 * aAv) > h * 0.85 - 3 && !(td && td.vDown <= allow)) { s.setEngine(true); L('burn h', h.toFixed(0), 'vd', vd.toFixed(1), 'fuel', Math.round(s.fuelRatio() * 1000) / 10); }
      if (log > 1 && Math.round(s.t * 50) % 100 === 0) L('  h', h.toFixed(0), 'vr', vr.toFixed(1), 'vt', vt.toFixed(1), s.engineOn ? 'ON' : 'off', 'thr', s.throttle.toFixed(2), 'hov', s.hover, 'f', Math.round(s.fuelRatio() * 1000) / 10);
    }
  }
  return { s, info };
}
if (require.main === module && !process.env.ONE) {
  for (const k in cfgs) {
    const a = RL.analyze(toGrid(cfgs[k]));
    // 月と であえる 待ち時間を さがす（0〜220秒、5秒きざみ）。であえた 最初の 2つを しらべる
    const hits = [];
    for (let w = 0; w <= 220 && hits.length < 2; w += 5) { const res = pilot(cfgs[k], w, false); if (!res.why) hits.push(w); }
    if (!hits.length) { console.log(k.padEnd(26), '月と であえない（燃料が たりない）'); continue; }
    const row = hits.map(w => {
      const { s, why, info } = pilot(cfgs[k], w, process.env.LOG); const d = s.done || {};
      if (why) return `w${w}:${why}`;
      return `w${w}:${d.type || '?'}${d.hard ? '(あぶない)' : ''}${d.type === 'landed' || d.type === 'hit' ? ` ↓${(d.vDown || 0).toFixed(1)}` : ''} 月でΔv${info && info.dvMoon != null ? Math.round(info.dvMoon) : '-'}→${Math.round(dvLeft(s))}`;
    });
    console.log(k.padEnd(26), `脚${a.stages[a.stages.length - 1].legL + a.stages[a.stages.length - 1].legR}`, row.join('   '));
  }
}
module.exports.pilot = pilot;
if (require.main === module && process.env.ONE) { const k = Object.keys(cfgs)[+process.env.ONE - 1]; const r = pilot(cfgs[k], +process.env.W, +(process.env.LOG || 1)); console.log(r.why || r.s.done); }
