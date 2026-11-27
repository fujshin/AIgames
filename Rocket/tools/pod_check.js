// v0.18.1 よこの 段（アスパラガス）と クロスフィードの 確かめ
//  横の段が はずれる 時刻・まんなかの 段が はずれる 時刻・のこりの 燃料・低い軌道での のこり Δv
// 使い方: node tools/pod_check.js（XF=0 で クロスフィード なし）
const { RL, toGrid } = require('./lib2d.js');
RL.CFG.ROWS = RL.CFG.ROWS_ORBIT;
if (process.env.XF === '0') RL.CFG.ORBIT.CROSSFEED = false;
const T = n => Array(n).fill('tank');
const CORE = n => ['engine', ...T(n), 'ring', 'vengine', ...T(3), 'win+chute', 'nose'];
const D = {
  'ユーザー例 まんなか E+T4｜V+T3、よこ E+T5×2': [[], ['fin', 'engine', ...T(5)], CORE(4), ['fin', 'engine', ...T(5)], []],
  'まんなか E+T3｜V+T3、よこ E+T3×2': [[], ['fin', 'engine', ...T(3)], CORE(3), ['fin', 'engine', ...T(3)], []],
  '二重 まんなか E+T3、よこ E+T4×2、そと E+T2×2': [['fin', 'engine', ...T(2)], ['fin', 'engine', ...T(4)], CORE(3), ['fin', 'engine', ...T(4)], ['fin', 'engine', ...T(2)]],
  '4-2 POD0＋よこ E+T2×2': [[], ['fin', 'engine', ...T(2)], ['engine', ...T(2), 'ring', 'vengine', 'tank', 'win+chute', 'nose'], ['fin', 'engine', ...T(2)], []],
  'よこ なし E+T3｜V+T3（くらべる）': [[], ['fin'], CORE(3), ['fin'], []]
};
function run(cols) {
  const a = RL.analyze(toGrid(cols)), s = RL.Orbit.create(a, { profile: 'side' }), dv0 = s.dvLeftV();
  const log = []; let cut = null, dvLEO = null;
  const pf = () => s.stacks.filter(x => x.pod && x.sepT === null).map(x => x.fuel.toFixed(1)).join('/');
  while (!s.done && s.t < 3000) {
    s.advance(0.02);
    s.events.splice(0).forEach(e => {
      if (e.type === 'booster-sep' && e.pod) log.push(`よこ${e.id}@${s.t.toFixed(1)}s(まんなか${S0(s)})`);
      if (e.type === 'stage-sep') log.push(`${e.i + 1}段目@${s.t.toFixed(1)}s`);
    });
    const el = s.elements();
    if (cut === null && s.engineOn && s.lifted && el && el.e < 1 && el.rp > s.body.R + s.body.atmo + 20) { s.setEngine(false); cut = s.t; dvLEO = s.dvLeftV(); break; }
  }
  return { log, ok: cut !== null, dvLEO, dv0, why: (s.done && s.done.type) + ' 高さ' + Math.round(s.maxAlt), pods: a.stacks.filter(x => x.pod).length };
}
const S0 = s => Math.round(s.stages[s.si].fuel / (s.a.stages[s.si].fuel || 1) * 100) + '%';
for (const k in D) { const r = run(D[k]); console.log(k); console.log('   Δv(真空・発射時)', Math.round(r.dv0), ' よこの 段', r.pods, ' ', r.log.join('  '), ' →', r.ok ? '低い軌道 のこり Δv ' + Math.round(r.dvLEO) : 'のれない ' + r.why); }
