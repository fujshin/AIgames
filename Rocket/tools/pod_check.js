// v0.18.1／v0.18.2 よこの 段（アスパラガス）・クロスフィード・せん（valve）の 確かめ
//  横の段が はずれる 時刻・まんなかの 段が はずれる 時刻・低い軌道での のこり Δv
// 使い方: node tools/pod_check.js（XF=0 で クロスフィード なし）
const { RL, toGrid } = require('./lib2d.js');
RL.CFG.ROWS = RL.CFG.ROWS_ORBIT;
if (process.env.XF === '0') RL.CFG.ORBIT.CROSSFEED = false;
const T = n => Array(n).fill('tank');
const CORE = n => ['engine', ...T(n), 'ring', 'vengine', ...T(3), 'win+chute', 'nose'];
const P = (n, v) => ['fin', 'engine' + (v ? '+valve' : ''), ...T(n)];
const D = {
  'まんなか E+T4、よこ E+T5（せん なし）': [[], P(5), CORE(4), P(5), []],
  'まんなか E+T4、よこ E+T5（せん あり）': [[], P(5, 1), CORE(4), P(5, 1), []],
  'まんなか E+T3、よこ E+T3': [[], P(3), CORE(3), P(3), []],
  '二重 そと E+T2（せん）、うち E+T4': [P(2, 1), P(4), CORE(3), P(4), P(2, 1)],
  '4-2 POD0＋よこ E+T2': [[], P(2), ['engine', ...T(2), 'ring', 'vengine', 'tank', 'win+chute', 'nose'], P(2), []],
  // v0.20.1：5れつ ぜんぶ E+T2（そとの 列の 下に はね）。そとだけ せん は うちが さきに からに なっても はずれない
  '5れつ E+T2 せん なし': [P(2), ['engine', ...T(2)], ['engine', ...T(2), 'ring', 'vengine', ...T(3), 'win+chute', 'nose'], ['engine', ...T(2)], P(2)],
  '5れつ E+T2 そとだけ せん': [P(2, 1), ['engine', ...T(2)], ['engine', ...T(2), 'ring', 'vengine', ...T(3), 'win+chute', 'nose'], ['engine', ...T(2)], P(2, 1)],
  '5れつ E+T2 ぜんぶ せん': [P(2, 1), ['engine+valve', ...T(2)], ['engine', ...T(2), 'ring', 'vengine', ...T(3), 'win+chute', 'nose'], ['engine+valve', ...T(2)], P(2, 1)]
};
const S0 = s => Math.round(s.stages[s.si].fuel / (s.a.stages[s.si].fuel || 1) * 100) + '%';
function run(cols) {
  const a = RL.analyze(toGrid(cols)), s = RL.Orbit.create(a, { profile: 'side' }), dv0 = s.dvLeftV(), log = [];
  let dvLEO = null;
  while (!s.done && s.t < 3000) {
    s.advance(0.02);
    s.events.splice(0).forEach(e => {
      if (e.type === 'booster-sep' && e.pod) log.push(`よこ×${e.n || 1}@${s.t.toFixed(1)}s(まんなか${S0(s)})`);
      if (e.type === 'stage-sep') log.push(`${e.i + 1}段目@${s.t.toFixed(1)}s`);
    });
    const el = s.elements();
    if (s.engineOn && s.lifted && el && el.e < 1 && el.rp > s.body.R + s.body.atmo + 20) { s.setEngine(false); dvLEO = s.dvLeftV(); break; }
  }
  return { log, dv0, dvLEO, why: (s.done && s.done.type) + ' 高さ' + Math.round(s.maxAlt), pods: a.stacks.filter(x => x.pod).map(x => x.noXF ? 'せん' : 'XF').join(',') };
}
for (const k in D) { const r = run(D[k]); console.log(k); console.log('   Δv', Math.round(r.dv0), ' よこ[' + r.pods + ']', r.log.join('  '), '→', r.dvLEO != null ? '低い軌道 のこり Δv ' + Math.round(r.dvLEO) : 'のれない ' + r.why); }
