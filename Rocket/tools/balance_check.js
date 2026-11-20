// 代表的な構成の一覧 ＋ 左右対称な構成の総当たり
const { RL, run } = require('./lib.js');
const T = n => Array(n).fill('tank'), B = n => Array(n).fill('booster');
const core = (t, nose = true) => ['engine', ...T(t), ...(nose ? ['nose'] : [])];
const cases = {
  'E': [[], ['fin'], core(0, false), ['fin'], []],
  'E+T': [[], ['fin'], core(1, false), ['fin'], []],
  'E+T はねなし': [[], [], core(1, false), [], []],
  'E+2T': [[], ['fin'], core(2, false), ['fin'], []],
  'E+2T+N': [[], ['fin'], core(2), ['fin'], []],
  'E+2T はねなし': [[], [], core(2, false), [], []],
  'E+5T': [[], ['fin'], core(5, false), ['fin'], []],
  'E+5T+N': [[], ['fin'], core(5), ['fin'], []],
  'E+5T+N はねなし': [[], [], core(5), [], []],
  'E+6T': [[], ['fin'], core(6, false), ['fin'], []],
  'E+6T+タンク1(重すぎ)': [[], ['fin'], core(6, false), ['fin', 'tank'], []],
  '2E 6T': [['fin'], ['engine', ...T(3)], core(3, false), ['fin'], []],
  '2E 7T': [['fin'], ['engine', ...T(3)], core(3, false), ['tank'], ['fin']],
};
for (const L of [1, 2, 3, 4, 6]) cases['E+5T+N B' + L + '×2 はね本体'] = [[], ['fin', ...B(L)], core(5), ['fin', ...B(L)], []];
for (const L of [1, 2, 3, 4, 6]) cases['E+5T+N B' + L + '×2 はねB外'] = [['fin'], B(L), core(5), B(L), ['fin']];
cases['E+5T+N B3×4'] = [B(3), B(3), core(5), B(3), B(3)];
const fmt = (k, s) => k.padEnd(24) + String(Math.round(s.h)).padStart(5) + ' ' + RL.CFG.ZONES[RL.zoneOf(s.h)].icon + (s.lift ? '' : ' ' + s.reason) +
  '  出だし加速=' + (s.samples[0] ? (s.samples[0].acc * s.k * s.k).toFixed(1) : '-') +
  '  切離し=' + ((s.seps || []).filter(x => x.t != null).map(x => x.t.toFixed(1) + 's@' + Math.round(x.h)).join(',') || '-') +
  '  宇宙' + (s.tAtmo != null ? s.tAtmo.toFixed(1) + 's' : '-') + '  飛行' + ((s.tTotal || 0).toFixed(1)) + 's';
for (const k in cases) console.log(fmt(k, run(cases[k])));
if (process.argv[2] !== 'quick') {
  let best = { h: 0 };
  const sides = [[]]; for (let L = 1; L <= 7; L++) sides.push(B(L)); sides.push(['fin']); for (let L = 1; L <= 6; L++) sides.push(['fin', ...B(L)]);
  for (let t = 0; t <= 6; t++) for (const nose of [true, false]) for (const s1 of sides) for (const s2 of sides) {
    const cols = [s2, s1, core(t, nose), s1, s2], s = run(cols); if (s.lift && s.h > best.h) best = { h: s.h, cols };
  }
  console.log('\n左右対称の総当たり 最大:', Math.round(best.h), RL.CFG.ZONES[RL.zoneOf(best.h)].icon, JSON.stringify(best.cols));
}
