// 月へ行けるかの確かめ：低い軌道で エンジンを止め、いろいろな時刻に 再点火して 月の重力圏に入るか
const { RL, toGrid } = require('./lib2d.js');
const T = n => Array(n).fill('tank'), B = n => Array(n).fill('booster');
const cols = [['fin'], B(5), ['engine', ...T(3), 'ring', 'vengine', ...T(3), 'nose'], B(5), ['fin']];
let found = 0;
for (let tr = 20; tr < 260 && found < 3; tr += 4) {
  const s = RL.Orbit.create(RL.analyze(toGrid(cols)), { profile: 'side' });
  let cut = false, re = false, soi = false;
  while (!s.done && s.t < 30000) {
    s.advance(s.isPowered() ? 0.05 : Math.max(0.05, s.autoWarp() * 0.05));
    const el = s.elements();
    if (!cut && el && el.e < 1 && el.rp > s.body.R + s.body.atmo + 20) { s.setEngine(false); cut = s.t; }
    if (cut && !re && s.t > cut + tr) { s.setEngine(true); re = true; }
    if (s.body.id === 'moon') soi = true;
  }
  if (soi) { found++; console.log('再点火', tr, '秒後 → 月の重力圏に入った。結果', s.done && s.done.type, s.done && s.done.cls, '時刻', Math.round(s.t)); }
}
if (!found) console.log('月に届く 再点火時刻は 見つからなかった');
