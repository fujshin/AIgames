// v0.8.3 おわり方の確かめ：低い軌道 → 再点火して「月まで とどく軌道」に なったら エンジンを止め、そのまま まつ
//  燃料が のこっている → 自動では おわらない（月と であう／🏁 まで つづく）
//  燃料を つかいきった → 月と であうのを MOON_WAIT 周 まつ
const { RL, toGrid } = require('./lib2d.js');
const T = n => Array(n).fill('tank'), B = n => Array(n).fill('booster');
const cols = [['fin'], B(5), ['engine', ...T(3), 'ring', 'vengine', ...T(3), 'nose'], B(5), ['fin']];
for (const burnAll of [false, true]) for (const wait of [10, 40, 80, 120]) {
  const s = RL.Orbit.create(RL.analyze(toGrid(cols)), { profile: 'side' });
  let cut = null, re = null, stop = null, moon = false, turns = 0;
  while (!s.done && s.t < 60000) {
    s.advance(s.isPowered() ? 0.05 : Math.max(0.05, s.autoWarp() * 0.05));
    const el = s.elements(); if (!el) continue;
    if (cut === null && el.e < 1 && el.rp > s.body.R + s.body.atmo + 20) { s.setEngine(false); cut = s.t; }
    if (cut !== null && re === null && s.t > cut + wait) { s.setEngine(true); re = s.t; }
    if (re !== null && stop === null && s.cls === 'toMoon') { if (burnAll) { if (!s.liquidLeft()) stop = s.t; } else { s.setEngine(false); stop = s.t; } }
    if (stop !== null && !burnAll && s.cls === 'escape') break;
    s.events.splice(0).forEach(e => { if (e.type === 'soi' && e.body === 'moon') moon = true; });
  }
  const d = s.done || {};
  console.log((burnAll ? '燃料0 ' : '燃料あり') + ` 再点火${wait}秒後 →`, s.cls === 'escape' && !d.type ? '（使いきって脱出軌道）' : (d.type || 'つづく') + (d.cls ? ':' + d.cls : ''),
    moon ? '／月と であった' : '', `周期${Math.round((s.elements() || {}).T || 0)}`, `時刻${Math.round(s.t)}`, `燃料${Math.round(s.fuelRatio() * 100)}%`);
}
