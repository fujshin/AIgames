// v0.10 月を まわる 確かめ（画面と 同じ 手順）：
//  低い軌道 → wait 秒後 前へ ふかす →「月と であう」予測で とめる → 月の重力圏で「いまだ！」の ところで うしろへ ふかす → 月を まわったら とめる
// 使い方: node tools/capture_check.js
const { RL, toGrid } = require('./lib2d.js');
const T = n => Array(n).fill('tank'), B = n => Array(n).fill('booster');
const cfgs = {
  'B5 E3T｜V3T+N': [['fin'], B(5), ['engine', ...T(3), 'ring', 'vengine', ...T(3), 'nose'], B(5), ['fin']],
  'B5 E2T｜V4T+N': [['fin'], B(5), ['engine', ...T(2), 'ring', 'vengine', ...T(4), 'nose'], B(5), ['fin']],
  'B9 E3T｜V3T+N': [['fin'], B(9), ['engine', ...T(3), 'ring', 'vengine', ...T(3), 'nose'], B(9), ['fin']],
  'B9 E2T｜V5T+N': [['fin'], B(9), ['engine', ...T(2), 'ring', 'vengine', ...T(5), 'nose'], B(9), ['fin']],
};
const NAME = { orbit: '周回', ground: '落下', hit: '月に衝突', escape: '脱出', timeout: '時間切れ' };
const SL = RL.CFG.ORBIT.SLOW, PK = +(process.env.PK || 1.05);
for (const k in cfgs) {
  const out = [];
  for (const wait of [2, 20, 40, 60]) {
    const s = RL.Orbit.create(RL.analyze(toGrid(cfgs[k])), { profile: 'side', autoEnd: true });
    let ph = 0, cut, f3 = null, vrel = null;
    while (!s.done && s.t < 80000) {
      s.moonNear = s.isPowered() && s.inSpace && s.body.id === 'earth' && RL.Predict.moonNear(s, SL.LOOK_MOON);
      s.advance(Math.min(0.05, s.autoWarp() * 0.05) || 0.05);
      const el = s.elements(); if (!el) continue;
      if (ph === 0 && el.e < 1 && el.rp > s.body.R + s.body.atmo + 20) { s.setEngine(false); cut = s.t; ph = 1; }
      else if (ph === 1 && s.t > cut + wait) { s.setEngine(true); ph = 2; }
      else if (ph === 2 && /^moon/.test((RL.Predict.fromSim(s) || {}).kind || '')) { s.setEngine(false); ph = 3; f3 = s.fuelRatio(); }
      else if (ph === 2 && s.cls === 'escape') break;
      else if (ph === 3 && s.body.id === 'moon') {
        const r = Math.hypot(s.x, s.y), vr = (s.x * s.vx + s.y * s.vy) / r;
        if (r < el.rp * PK + 1) { vrel = Math.hypot(s.vx, s.vy); s.setDir('retro'); s.setEngine(true); ph = 4; }
      }
      else if (ph === 4 && (s.cls === 'moonOrbit' || !s.liquidLeft())) { s.setEngine(false); s.finishNow(); ph = 5; }
      if (ph < 4 && s.t > 30000) break;
    }
    const d = s.done || {};
    out.push(`${wait}s:` + (ph < 3 ? '月に とどかず' : ph < 4 ? '月に であわず' : (NAME[d.type] || d.type || '?') + (d.body === 'moon' ? '@月' : '') + ` 燃${Math.round(f3 * 100)}→${Math.round(s.fuelRatio() * 100)}% v${Math.round(vrel)}`));
  }
  console.log(k.padEnd(16), out.join('  '));
}
