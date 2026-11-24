// 予測の線と 実際の飛び方が そろうかの確かめ
//  低い軌道で止める → いろいろな時刻に 再点火（燃料を使いきる）→ 燃え終わった時点の 予測 と、その後の 実際の結果を くらべる
const { RL, toGrid } = require('./lib2d.js');
const T = n => Array(n).fill('tank'), B = n => Array(n).fill('booster');
const cols = [['fin'], B(5), ['engine', ...T(3), 'ring', 'vengine', ...T(3), 'nose'], B(5), ['fin']];
const actualKind = s => { const d = s.done; if (!d) return '?';
  if (s.wentMoon) return d.type === 'hit' ? 'moonHit' : d.body === 'moon' && d.type === 'orbit' ? 'moonOrbit' : 'moonPass';
  return d.type === 'ground' ? 'hit' : d.type === 'escape' ? 'escape' : d.type === 'orbit' ? 'orbit' : d.type; };
let ok = 0, n = 0, encErr = [];
for (let tr = 0; tr < 230; tr += 5) {
  const s = RL.Orbit.create(RL.analyze(toGrid(cols)), { profile: 'side' });
  let cut = null, re = false, pred = null, tSoi = null;
  while (!s.done && s.t < 60000) {
    s.advance(s.isPowered() ? 0.05 : Math.max(0.05, s.autoWarp() * 0.05));
    const el = s.elements();
    if (cut === null && el && el.e < 1 && el.rp > s.body.R + s.body.atmo + 20) { s.setEngine(false); cut = s.t; }
    if (cut !== null && !re && s.t > cut + tr) { s.setEngine(true); re = true; }
    if (re && !pred && !s.isPowered()) pred = RL.Predict.fromSim(s);
    s.events.splice(0).forEach(e => { if (e.type === 'soi' && e.body === 'moon' && tSoi === null) { tSoi = e.t; s.wentMoon = true; } });
  }
  if (!pred) continue;
  const a = actualKind(s), p = pred.kind === 'moon' ? '?' : pred.kind; n++;
  const same = p === a; if (same) ok++;
  if (pred.enc && tSoi) encErr.push(Math.abs(pred.enc.t - tSoi));
  console.log(String(tr).padStart(4) + '秒後に再点火  予測:' + p.padEnd(10) + ' 実際:' + a.padEnd(10) + (same ? ' ○' : ' ×') + (pred.enc ? `  月とであう 予測${Math.round(pred.enc.t)} 実際${tSoi == null ? '-' : Math.round(tSoi)}` : ''));
}
console.log(`\n一致 ${ok}/${n}` + (encErr.length ? `  月にであう時刻の ずれ 最大 ${Math.max(...encErr).toFixed(1)}秒` : ''));

// 2) 代表的な構成 × 打ち上げ方：燃え終わって くうきの外に出た 時点の 予測と 実際
const C1 = (eng, t) => [eng, ...T(t), 'nose'];
const cases = [
  [[], ['fin'], C1('engine', 5), ['fin'], []],
  [['fin'], B(4), C1('engine', 5), B(4), ['fin']],
  [[], ['fin'], ['engine', ...T(3), 'ring', 'vengine', ...T(2), 'nose'], ['fin'], []],
  [['fin'], B(3), ['engine', ...T(3), 'ring', 'vengine', ...T(2), 'nose'], B(3), ['fin']],
  [['fin'], B(9), ['engine', ...T(4), 'ring', 'vengine', 'tank', 'nose'], B(9), ['fin']]];
let ok2 = 0, n2 = 0;
for (const c of cases) for (const prof of ['up', 'tilt', 'side']) for (const cutOn of [false, true]) {
  const s = RL.Orbit.create(RL.analyze(toGrid(c)), { profile: prof }); let pred = null, tSoi = null;
  while (!s.done && s.t < 60000) {
    s.advance(s.isPowered() ? 0.05 : Math.max(0.05, s.autoWarp() * 0.05));
    if (cutOn && s.engineOn && s.lifted) { const el = s.elements(); if (el && el.e < 1 && el.rp > s.body.R + s.body.atmo + 20) s.setEngine(false); }
    if (!pred && s.lifted && !s.isPowered() && s.alt() > s.body.atmo) pred = RL.Predict.fromSim(s);
    s.events.splice(0).forEach(e => { if (e.type === 'soi' && e.body === 'moon') s.wentMoon = true; });
  }
  if (!pred) continue; n2++;
  const a = actualKind(s), p = pred.kind; if (p === a) ok2++; else console.log('×', prof, cutOn, '予測', p, '実際', a);
}
console.log(`代表構成 一致 ${ok2}/${n2}`);
