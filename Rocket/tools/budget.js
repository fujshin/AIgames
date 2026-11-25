// v0.16 月往還の 燃料（Δv）：組み立てを 低い軌道（よこ＋ちょうど止め）まで とばし、のこりの Δv（くうきの外）を はかる
// 使い方: node tools/budget.js（OLD=1 で 埋もれた エンジンも もえる まえの きまり）
const { RL, toGrid } = require('./lib2d.js');
RL.CFG.ROWS = RL.CFG.ROWS_ORBIT;
if (process.env.OLD === '1') RL.CFG.PHYS.BURIED_ENGINE = 'on';
const T = n => Array(n).fill('tank'), B = n => Array(n).fill('booster');
function toLEO(cols) {
  const a = RL.analyze(toGrid(cols)), s = RL.Orbit.create(a, { profile: 'side', autoEnd: true });
  while (!s.done && s.t < 3000) { s.advance(s.isPowered() ? 0.02 : 0.2);
    const el = s.elements(); if (s.engineOn && s.lifted && el && el.e < 1 && el.rp > s.body.R + s.body.atmo + 20) { s.setEngine(false); return { ok: true, dv: s.dvLeftV() }; } }
  return { ok: false, dv: 0, why: s.done ? s.done.type : 'timeout' };
}
module.exports = { toLEO };
if (require.main === module) {
  const D = {
    '見本 3段3列（往還）': [[...B(4), 'fin'], ['engine', ...T(4), 'ring', 'vengine', ...T(2)], ['engine', ...T(4), 'ring', 'vengine', ...T(2), 'ring', 'vengine+leg', ...T(3), 'win+chute'], ['engine', ...T(4), 'ring', 'vengine', ...T(2)], [...B(4), 'fin']],
    '4章の 見本 ORBIT': [['fin'], B(6), ['engine', ...T(4), 'ring', 'vengine+leg', ...T(3), 'win+chute', 'nose'], B(6), ['fin']],
    '5章の 見本 MOONSHIP': [['fin'], B(5), ['engine', ...T(3), 'ring', 'vengine+leg', ...T(2), 'win', 'nose'], B(5), ['fin']] };
  for (const k in D) { const r = toLEO(D[k]); console.log(k.padEnd(20), r.ok ? '低い軌道で のこり Δv ' + Math.round(r.dv) : 'のれない ' + r.why); }
}
