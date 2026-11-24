// v0.13 月往還の 確かめ：自動の パイロットで 打ち上げ → 月着陸（landing_check と 同じ）→ 月面 → 離陸 → 地球へ → 🪂 着陸
//  6. 月面で 🔥（自動で 月を まわる ところまで）  7. 月を まわりながら w2 秒 まって 前へ。「かえれる 線」（home）が 出たら とめる
//  8. 地球へ。くうきに 入ったら ✂️ で のこりの 段を すてる（まど🪂 の 段まで）→ 速さ 75 より おそく なったら 🪂
// 使い方: node tools/return_check.js（ROWS は うちゅうモードの 18）
const { RL, toGrid } = require('./lib2d.js');
RL.CFG.ROWS = +process.env.ROWS || RL.CFG.ROWS_ORBIT;
const { pilot, dvLeft } = require('./landing_check.js');
const T = n => Array(n).fill('tank'), B = n => Array(n).fill('booster');
const cfgs = {
  '見本 3段3列 B4は E3×T4｜V3×T2｜V脚T3 まど🪂（15）': [[...B(4), 'fin'], ['engine', ...T(4), 'ring', 'vengine', ...T(2)], ['engine', ...T(4), 'ring', 'vengine', ...T(2), 'ring', 'vengine+leg', ...T(3), 'win+chute'], ['engine', ...T(4), 'ring', 'vengine', ...T(2)], [...B(4), 'fin']],
  '3段1列 B6 E4T｜V2T｜V脚2T まど🪂（14・v0.12で とどかない）': [['fin'], B(6), ['engine', ...T(4), 'ring', 'vengine', ...T(2), 'ring', 'vengine+leg', ...T(2), 'win+chute'], B(6), ['fin']]
};
function home(cols, w1, w2) {
  const r = pilot(cols, w1, false, true), s = r.s;
  if (!s.surface) return { why: 'land:' + (r.why || (s.done && s.done.type)) };
  const out = { dvSurf: s.dvLeftV() };
  s.setEngine(true); let ph = 6, t0 = 0, minH = 1e9, chuteAt = null;
  while (!s.done && s.t < 400000) {
    s.advance(s.isPowered() ? 0.02 : Math.max(0.02, Math.min(s.autoWarp(), 200) * 0.05));
    const rr = Math.hypot(s.x, s.y), h = rr - s.body.R;
    if (ph === 6 && !s.engineOn) { ph = 7; t0 = s.t; out.dvOrbit = s.dvLeftV(); const el = s.elements(); out.lmo = [Math.round(el.rp - s.body.R), Math.round(el.ra - s.body.R)]; }
    else if (ph === 7 && s.t > t0 + w2) { if (!s.liquidLeft()) return Object.assign(out, { why: 'nofuel' }); s.setEngine(true); ph = 8; }
    else if (ph === 8) { const p = RL.Predict.fromSim(s);
      if (p && p.home) { s.setEngine(false); ph = 9; out.dvHome = s.dvLeftV(); }
      else if (!s.liquidLeft()) return Object.assign(out, { why: 'nofuel-tei' });
      else if (p && p.fate && p.fate.kind !== 'home' && s.elements().e >= 1 && Math.hypot(s.x, s.y) > s.body.soi * 0.7) return Object.assign(out, { why: 'miss:' + p.fate.kind }); }
    else if (ph === 9 && s.body.id === 'earth' && h < s.body.atmo) {
      minH = Math.min(minH, h);
      while (s.canSep() && !s.chutes() || (s.canSep() && s.stages.slice(s.si + 1).some(x => x.chutes))) s.separate();
      const wv = Math.hypot(s.vx + s.bodies.earth.rot * s.y, s.vy - s.bodies.earth.rot * s.x);
      if (!s.chute && s.chutes() && wv < 75) { s.deployChute(); chuteAt = Math.round(h); }
    }
  }
  return Object.assign(out, { s, chuteAt });
}
if (require.main === module) for (const k in cfgs) {
  const cols = cfgs[k]; let w1 = null;
  for (let w = 0; w <= 220; w += 5) { const r = pilot(cols, w, false, true); if (r.s.surface) { w1 = w; break; } }
  if (w1 === null) { console.log(k, '→ 月に 着陸 できない'); continue; }
  let best = null, tried = 0;
  for (let w2 = 0; w2 <= 400 && !(best && best.s && best.s.done && best.s.done.returned); w2 += 10) { best = home(cols, w1, w2); best.w2 = w2; tried++; }
  const d = best.s && best.s.done || {};
  console.log(k);
  console.log(`  月面で Δv ${Math.round(best.dvSurf)} → 月を まわる ${best.dvOrbit != null ? Math.round(best.dvOrbit) : '-'}（高さ ${best.lmo || '-'}）→ かえる 線 ${best.dvHome != null ? Math.round(best.dvHome) : '-'}` +
    `｜離陸 Δv ${best.dvOrbit != null ? Math.round(best.dvSurf - best.dvOrbit) : '-'}・かえる Δv ${best.dvHome != null ? Math.round(best.dvOrbit - best.dvHome) : '-'}`);
  console.log(`  結果：${best.why || d.type}${d.returned ? '（往還 🪨）' : ''} ↓${d.vDown != null ? d.vDown.toFixed(1) : '-'} 🪂${best.chuteAt != null ? best.chuteAt : '-'} 最大G ${d.maxG != null ? d.maxG.toFixed(0) : '-'}  w1=${w1} w2=${best.w2}（${tried}回目）`);
}
module.exports = { home, cfgs };
