// v0.12 スローモーションの 確かめ：flight2d と 同じ 早送りの きまり（下げるのは すぐ、上げるのは 1こま 1.02倍（燃やす間））で 60fps を まねる
//  低い軌道 → WAIT 秒後に 前へ → 月と であう 予測が 出たら 2秒後に とめる（子どもの 反応）。早送りの うごきを 0.25秒ごとに 出す
//  見るところ：急に 上がる ところが ない／月と であう 手前が 実時間 2〜4秒 ある／であったら とめるまで ゆっくり
// 使い方: node tools/slow_check.js [WAIT=125]
const { RL, toGrid } = require('./lib2d.js');
const T = n => Array(n).fill('tank'), B = n => Array(n).fill('booster');
const cols = [['fin'], B(5), ['engine', ...T(3), 'ring', 'vengine+leg', ...T(2), 'nose'], B(5), ['fin']];
const WAIT = +(process.argv[2] || 125);
const s = RL.Orbit.create(RL.analyze(toGrid(cols)), { profile: 'side' });
let warp = 1, real = 0, ph = 0, cut, re = null, encAt = null, stopAt = null, last = '', out = [], maxJump = 0, prevW = null;
while (!s.done && real < 600) {
  const tg = s.autoWarp(); warp = tg > warp ? Math.min(tg, s.isPowered() ? warp * 1.02 + 0.003 : warp * 1.06 + 0.05) : tg;
  s.advance(warp / 60); real += 1 / 60;
  const el = s.elements(); if (!el) continue;
  if (ph === 0 && el.e < 1 && el.rp > s.body.R + s.body.atmo + 20) { s.setEngine(false); cut = s.t; ph = 1; }
  else if (ph === 1 && s.t > cut + WAIT) { s.setEngine(true); ph = 2; re = real; }
  else if (ph === 2) {
    const p = RL.Predict.fromSim(s), enc = !!(p && p.enc);
    if (enc && encAt === null) encAt = real;
    if (encAt !== null && real > encAt + 2) { s.setEngine(false); stopAt = real; ph = 3; }
    if (!s.liquidLeft()) ph = 3;
    const dvps = warp * s.thrust / s.mass;
    if (prevW !== null) maxJump = Math.max(maxJump, dvps - prevW); prevW = dvps;
    if (Math.round((real - re) * 60) % 15 === 0) out.push(`${(real - re).toFixed(2).padStart(6)}秒  早送り×${warp.toFixed(3)}  1秒に ふえる速さ ${dvps.toFixed(1).padStart(5)}  ${s.cls}${enc ? ' 月とであう' : ''}`);
  }
  if (ph === 3) break;
}
console.log(out.join('\n'));
console.log(`\n再点火→月と であう 予測：実時間 ${encAt ? (encAt - re).toFixed(1) : '-'}秒。1こまで ふえた「1秒に ふえる速さ」の 最大 ${maxJump.toFixed(2)}`);
