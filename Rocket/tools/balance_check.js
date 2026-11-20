// 代表的な構成の一覧 ＋ 左右対称な構成の総当たり（1段・2段）
// 使い方: FAST=1 node tools/balance_check.js [quick]   （FAST=1 で きざみを粗くして速く。数分かかる）
const { RL, R, run, H } = require('./lib.js');
const T = n => Array(n).fill('tank'), B = n => Array(n).fill('booster');
const fmt = (k, s) => k.padEnd(28) + String(Math.round(s.h)).padStart(6) + ' ' + RL.CFG.ZONES[RL.zoneOf(s.h)].icon + (s.lift ? '' : ' ' + s.reason) +
  '  段の切離し=' + ((s.stageInfo || []).filter(x => x.sepT != null).map(x => x.sepT.toFixed(1) + 's@' + Math.round(x.sepH)).join(',') || '-') +
  '  宇宙' + (s.tAtmo != null ? s.tAtmo.toFixed(1) + 's' : '-') + '  飛行' + (s.tTotal || 0).toFixed(1) + 's';
const C1 = (eng, t, nose = true) => [eng, ...T(t), ...(nose ? ['nose'] : [])];
const cases = {
  '1段 E': [[], ['fin'], C1('engine', 0, false), ['fin'], []],
  '1段 E+T': [[], ['fin'], C1('engine', 1, false), ['fin'], []],
  '1段 E+2T+N': [[], ['fin'], C1('engine', 2), ['fin'], []],
  '1段 E+5T+N': [[], ['fin'], C1('engine', 5), ['fin'], []],
  '1段 V+2T+N（宇宙用だけ）': [[], ['fin'], C1('vengine', 2), ['fin'], []],
  '1段 E+5T+N B4×2 はね外': [['fin'], B(4), C1('engine', 5), B(4), ['fin']],
  '2段 E3T｜E2T+N': [[], ['fin'], ['engine', ...T(3), 'ring', 'engine', ...T(2), 'nose'], ['fin'], []],
  '2段 E3T｜V2T+N': [[], ['fin'], ['engine', ...T(3), 'ring', 'vengine', ...T(2), 'nose'], ['fin'], []],
  '2段 V3T｜E2T+N（逆）': [[], ['fin'], ['vengine', ...T(3), 'ring', 'engine', ...T(2), 'nose'], ['fin'], []],
  '2段 V3T｜V2T+N': [[], ['fin'], ['vengine', ...T(3), 'ring', 'vengine', ...T(2), 'nose'], ['fin'], []],
  '2段 E3T｜V2T+N B3 はねB': [['fin'], B(3), ['engine', ...T(3), 'ring', 'vengine', ...T(2), 'nose'], B(3), ['fin']],
  '2段 E4T｜V3T+N B4 はねB': [['fin'], B(4), ['engine', ...T(3), 'ring', 'vengine', ...T(2), 'nose'], B(4), ['fin']],
  '3段 E2T｜E1T｜V1T+N': [[], ['fin'], ['engine', ...T(2), 'ring', 'engine', 'tank', 'ring', 'vengine', 'tank', 'nose'], ['fin'], []],
};
for (const k in cases) console.log(fmt(k, run(cases[k])));
if (process.argv[2] === 'quick') process.exit(0);
// 左右対称の総当たり
// ブースターは 胴体の となりで 胴体の高さまで（それ以上は くっつかない）なので、胴体の高さまでを しらべる
const sidesFor = hc => { const s = [[], ['fin']]; for (let L = 1; L <= hc; L++) { s.push(B(L)); if (L < hc) s.push(['fin', ...B(L)]); } return s; };
const cores1 = []; for (const e of ['engine', 'vengine']) for (let t = 0; t <= R - 2; t++) for (const nose of [1, 0]) cores1.push(C1(e, t, nose));
const cores2 = []; for (const e1 of ['engine', 'vengine']) for (const e2 of ['engine', 'vengine']) for (let t1 = 0; t1 <= R - 4; t1++) for (let t2 = 0; t1 + t2 <= R - 4; t2++) cores2.push([e1, ...T(t1), 'ring', e2, ...T(t2), 'nose']);
function sweep(cores) { let best = { h: 0 }, cnt = 0, sat = 0;
  for (const c of cores) for (const s1 of sidesFor(c.length)) for (const s2 of [[], ['fin']]) { const cols = [s2, s1, c, s1, s2], h = H(cols); cnt++; if (h >= 12000) sat++; if (h > best.h) best = { h, cols }; }
  return { best, cnt, sat }; }
const r1 = sweep(cores1), r2 = sweep(cores2);
console.log('\n1段・左右対称の総当たり 最大:', Math.round(r1.best.h), RL.CFG.ZONES[RL.zoneOf(r1.best.h)].icon, JSON.stringify(r1.best.cols));
console.log('2段・左右対称の総当たり 最大:', Math.round(r2.best.h), RL.CFG.ZONES[RL.zoneOf(r2.best.h)].icon, '  土星に届く', r2.sat, '/', r2.cnt, JSON.stringify(r2.best.cols));
