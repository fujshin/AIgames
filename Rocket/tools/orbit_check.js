// うちゅうモードの確かめ：代表的な構成 × 打ち上げ方（まっすぐ／ななめ／よこ）
// 使い方: node tools/orbit_check.js [R=4000]
const { RL, fly } = require('./lib2d.js');
if (process.argv[2]) RL.CFG.ORBIT.R = +process.argv[2];
const O = RL.CFG.ORBIT, v1 = Math.sqrt(O.G0 * O.R);
const T = n => Array(n).fill('tank'), B = n => Array(n).fill('booster');
const C1 = (eng, t, nose = true) => [eng, ...T(t), ...(nose ? ['nose'] : [])];
const cases = {
  '1段 E+2T+N': [[], ['fin'], C1('engine', 2), ['fin'], []],
  '1段 E+5T+N': [[], ['fin'], C1('engine', 5), ['fin'], []],
  '1段 E+5T+N B4 はね外': [['fin'], B(4), C1('engine', 5), B(4), ['fin']],
  '2段 E3T｜E2T+N': [[], ['fin'], ['engine', ...T(3), 'ring', 'engine', ...T(2), 'nose'], ['fin'], []],
  '2段 E3T｜V2T+N': [[], ['fin'], ['engine', ...T(3), 'ring', 'vengine', ...T(2), 'nose'], ['fin'], []],
  '2段 E3T｜V2T+N B3 はねB': [['fin'], B(3), ['engine', ...T(3), 'ring', 'vengine', ...T(2), 'nose'], B(3), ['fin']],
  '2段 E3T｜V3T+N B5 はねB': [['fin'], B(5), ['engine', ...T(3), 'ring', 'vengine', ...T(3), 'nose'], B(5), ['fin']],
  '2段 E4T｜V1T+N B9 はねB': [['fin'], B(9), ['engine', ...T(4), 'ring', 'vengine', 'tank', 'nose'], B(9), ['fin']],
  '3段 E2T｜E1T｜V1T+N': [[], ['fin'], ['engine', ...T(2), 'ring', 'engine', 'tank', 'ring', 'vengine', 'tank', 'nose'], ['fin'], []],
};
const NAME = { ground: '落下', orbit: '周回', escape: '脱出', heavy: '飛べず', hit: '月に衝突', timeout: '時間切れ' };
const dv = require('./dv.js');
console.log(`R=${O.R}  第1宇宙速度 v1=${v1.toFixed(0)}  第2=${(v1 * Math.SQRT2).toFixed(0)}  低軌道1周=${(2 * Math.PI * Math.sqrt(O.R / O.G0)).toFixed(0)}秒`);
for (const k in cases) {
  const row = ['up', 'tilt', 'side', 'side+'].map(p => {
    const s = fly(cases[k], p.replace('+', ''), { autoCut: p.endsWith('+') }), d = s.done || {};
    let t = (NAME[d.type] || d.type) + (d.cls && d.type === 'orbit' ? ':' + d.cls : '');
    if (d.type === 'ground') t += ` 高${Math.round(d.maxAlt)} 距${Math.round(d.range)}`;
    if (d.type === 'orbit') { const el = d.el; t += ` 近${Math.round(el.rp - O.R)} 遠${Math.round(el.ra - O.R)}`; }
    if (s.cutFuel != null) t += ` 残${Math.round(s.cutFuel * 100)}%`;
    return (p + ':' + t).padEnd(p === 'side+' ? 34 : 24);
  });
  console.log(k.padEnd(24), ('Δv' + Math.round(dv(cases[k]).dv)).padEnd(6), row.join(' '));
}
