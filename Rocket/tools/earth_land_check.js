// v0.12 地球着陸の 確かめ：空中から 始めて（opt.start）、パラシュート／エンジンで おりる
//  1) パラシュート：ひらく 高さ × ロケット → 着陸／やぶれ／まにあわない
//  2) エンジン：うしろへ ブレーキ → ホバーで とめて おちる（子どもと 同じ 操作）
//  3) 宇宙から もどる：低い軌道で うしろへ ふかして おとし、くうきで パラシュート
// 使い方: node tools/earth_land_check.js
const { RL, toGrid } = require('./lib2d.js');
RL.CFG.ROWS = RL.CFG.ROWS_ORBIT;
const T = n => Array(n).fill('tank');
const LD = RL.CFG.ORBIT.LAND.earth;
const rockets = {
  'かるい  V+T+まど🪂+N':      [[], [], ['vengine', 'tank', 'win+chute', 'nose'], [], []],
  'ふつう  V+2T+まど🪂+N':     [[], [], ['vengine', ...T(2), 'win+chute', 'nose'], [], []],
  'おもい  E+3T+まど🪂+N':     [[], [], ['engine', ...T(3), 'win+chute', 'nose'], [], []],
  'おもい2 E+3T+まど🪂×2+N':   [[], [], ['engine', ...T(3), 'win+chute', 'win+chute', 'nose'], [], []],
  'おもい+脚 E脚+3T+まど🪂+N': [[], [], ['engine+leg', ...T(3), 'win+chute', 'nose'], [], []],
};
const NAME = { landed: '着陸', ground: '落下' };
const res = s => { const d = s.done || {}; return (NAME[d.type] || d.type || '?') + (d.hard ? '(あぶない)' : '') + ' ↓' + (d.vDown || 0).toFixed(1); };
console.log('1) パラシュート：高さ 1200、下むき 0 から おちて、この 高さで ひらく（X＝やぶれた）');
const H = [400, 250, 150, 80, 30];
console.log(''.padEnd(28), H.map(h => ('h' + h).padEnd(20)).join(''));
for (const k in rockets) {
  const row = H.map(hOpen => {
    const s = RL.Orbit.create(RL.analyze(toGrid(rockets[k])), { start: { h: 1200, vDown: 0, fuel: 0.3 } });
    let r = null, vAt = 0;
    while (!s.done && s.t < 3000) { s.advance(0.02); if (r === null && s.alt() < hOpen) { vAt = Math.hypot(s.vx + s.bodies.earth.rot * s.y, s.vy - s.bodies.earth.rot * s.x); r = s.deployChute(); } }
    return `${r === 'torn' ? 'やぶれ' : r === 'noAir' ? 'くうき×' : ''}${res(s)} v${Math.round(vAt)}`.padEnd(20);
  });
  console.log(k.padEnd(28), row.join(''));
}
console.log('\n2) エンジン：高さ 800、下むき 20 から（燃料 100%）。うしろへ → とまれない 高さで エンジン → ホバーで とめる');
for (const k in rockets) {
  const s = RL.Orbit.create(RL.analyze(toGrid(rockets[k])), { start: { h: 800, vDown: 20, fuel: 1 } });
  s.setDir('retro');
  while (!s.done && s.t < 3000) {
    s.advance(0.02);
    const rv = s.relVel(), h = s.alt(), g = 10, vd = Math.max(0, -rv.vr), aAv = s.near ? (LD.TWR - 1) * g : 20;
    const td = s.fallInfo(), allow = LD.V_DOWN * (s.legs().n ? LD.LEG_K : 1) * 0.7;
    if (s.engineOn && s.hover) s.setEngine(false);
    else if (!s.engineOn && s.liquidLeft() && vd * vd / (2 * aAv) > h * 0.85 - 3 && !(td && td.vDown <= allow)) s.setEngine(true);
  }
  console.log(k.padEnd(28), res(s), ` 燃料${Math.round(s.fuelRatio() * 100)}%`, s.near ? '' : '');
}
console.log('\n3) 宇宙から もどる：2段 E3T｜V2T+まど🪂+N。低い軌道 → うしろへ ふかして おとす → パラシュート（高さ 150 で）');
{
  const cols = [[], ['fin'], ['engine', ...T(3), 'ring', 'vengine', ...T(2), 'win+chute', 'nose'], ['fin'], []];
  const s = RL.Orbit.create(RL.analyze(toGrid(cols)), { profile: 'side' });
  let ph = 0, info = '';
  while (!s.done && s.t < 20000) {
    s.advance(s.isPowered() ? 0.02 : Math.max(0.02, Math.min(s.autoWarp(), 100) * 0.05));
    const el = s.elements(); if (!el) continue;
    if (ph === 0 && el.e < 1 && el.rp > s.body.R + s.body.atmo + 20) { s.setEngine(false); ph = 1; info += ` 軌道 燃料${Math.round(s.fuelRatio() * 100)}%`; }
    else if (ph === 1) { s.setDir('retro'); s.setEngine(true); ph = 2; }
    else if (ph === 2 && (el.rp < s.body.R + 100 || !s.liquidLeft())) { s.setEngine(false); ph = 3; info += ` 近地点${Math.round(el.rp - s.body.R)}`; }
    else if (ph === 3 && s.alt() < 150) { const v = Math.hypot(s.vx + s.bodies.earth.rot * s.y, s.vy - s.bodies.earth.rot * s.x); info += ` ひらく v${Math.round(v)}→${s.deployChute()}`; ph = 4; }
  }
  console.log(' ', res(s), info, ` 発射台から${Math.round((s.done || {}).range || 0)}`);
}
