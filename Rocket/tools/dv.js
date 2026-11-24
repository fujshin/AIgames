// 理想のΔv（真空・重力なし）を 段ごとに 足し合わせる。ブースターは 1段目と いっしょに もえる（近似）
const { RL, toGrid } = require('./lib2d.js');
const P = RL.CFG.PHYS;
function dv(cols) {
  const a = RL.analyze(toGrid(cols)); let tot = 0;
  const stg = a.stages.map(s => ({ ...s })), stk = a.stacks.map(s => ({ ...s }));
  for (let i = 0; i < stg.length; i++) {
    const upper = stg.slice(i + 1).reduce((z, s) => z + s.dry + s.fuel, 0);
    const S = stg[i], bs = stk.filter(b => b.stage === i);
    // ブースター：同時に もえる。ブースター分の燃料が なくなるまでを 1区間
    let m = upper + S.dry + S.fuel + bs.reduce((z, b) => z + b.dry + b.fuel, 0);
    const Te = S.eng * P.THRUST + S.veng * P.VTHRUST, mdE = S.eng * P.BURN + S.veng * P.VBURN;
    let fuel = S.fuel;
    if (bs.length) {
      const tb = Math.min(...bs.map(b => b.fuel / (P.BOOST_BURN * Math.sqrt(b.seg))));
      const Tb = bs.reduce((z, b) => z + P.BOOST_THRUST * Math.sqrt(b.seg), 0), mdB = bs.reduce((z, b) => z + P.BOOST_BURN * Math.sqrt(b.seg), 0);
      const burnE = Math.min(fuel, mdE * tb), m1 = m - burnE - mdB * tb, ve = (Te + Tb) / (mdE + mdB);
      tot += ve * Math.log(m / m1); fuel -= burnE; m = m1 - bs.reduce((z, b) => z + b.dry + Math.max(0, b.fuel - P.BOOST_BURN * Math.sqrt(b.seg) * tb), 0);
    }
    if (mdE > 0 && fuel > 0) tot += Te / mdE * Math.log(m / (m - fuel));
  }
  return { dv: tot, m0: a.stages.reduce((z, s) => z + s.dry + s.fuel, 0) + a.stacks.reduce((z, b) => z + b.dry + b.fuel, 0) };
}
module.exports = dv;
if (require.main === module) {
  const T = n => Array(n).fill('tank'), B = n => Array(n).fill('booster');
  const cases = {
    '1段 E+2T+N': [[], ['fin'], ['engine', ...T(2), 'nose'], ['fin'], []],
    '1段 E+5T+N': [[], ['fin'], ['engine', ...T(5), 'nose'], ['fin'], []],
    '1段 V+3T+N': [[], ['fin'], ['vengine', ...T(3), 'nose'], ['fin'], []],
    '1段 E+5T B4': [['fin'], B(4), ['engine', ...T(5), 'nose'], B(4), ['fin']],
    '2段 E3T｜E2T': [[], ['fin'], ['engine', ...T(3), 'ring', 'engine', ...T(2), 'nose'], ['fin'], []],
    '2段 E3T｜V2T': [[], ['fin'], ['engine', ...T(3), 'ring', 'vengine', ...T(2), 'nose'], ['fin'], []],
    '2段 E4T｜V1T': [[], ['fin'], ['engine', ...T(4), 'ring', 'vengine', ...T(1), 'nose'], ['fin'], []],
    '2段 E3T｜V2T B3': [['fin'], B(3), ['engine', ...T(3), 'ring', 'vengine', ...T(2), 'nose'], B(3), ['fin']],
    '2段 E3T｜V3T B5': [['fin'], B(5), ['engine', ...T(3), 'ring', 'vengine', ...T(3), 'nose'], B(5), ['fin']],
    '2段 E4T｜V1T B9': [['fin'], B(9), ['engine', ...T(4), 'ring', 'vengine', 'tank', 'nose'], B(9), ['fin']],
    '3段 E2T｜E1T｜V1T': [[], ['fin'], ['engine', ...T(2), 'ring', 'engine', 'tank', 'ring', 'vengine', 'tank', 'nose'], ['fin'], []],
    '3段 E3T｜V2T｜V1T B5': [['fin'], B(5), ['engine', ...T(2), 'ring', 'vengine', 'tank', 'ring', 'vengine', 'tank', 'nose'], B(5), ['fin']],
  };
  for (const k in cases) { const r = dv(cases[k]); console.log(k.padEnd(22), 'Δv', Math.round(r.dv), ' 重さ', r.m0.toFixed(1)); }
}
