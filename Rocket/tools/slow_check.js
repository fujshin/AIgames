// v0.8.2 スローモーションの確かめ：flight2d と同じ 早送りの きまり（下げるのは すぐ、上げるのは 1こま 1.06倍）で 60fps を まねて、
//   低い軌道 → 30秒後に 再点火 したとき「月に とどく」から「にげる」まで 何秒（実時間）見えるか を しらべる
// 使い方: node tools/slow_check.js     （NOSLOW=1 で v0.8.1 と同じ＝スローなし）
const { RL, toGrid } = require('./lib2d.js');
if (process.env.NOSLOW) RL.CFG.ORBIT.SLOW = null;
const T = n => Array(n).fill('tank'), B = n => Array(n).fill('booster');
const cfgs = { 'B5 E3T｜V3T': [['fin'], B(5), ['engine', ...T(3), 'ring', 'vengine', ...T(3), 'nose'], B(5), ['fin']],
               'B3 E3T｜V2T': [['fin'], B(3), ['engine', ...T(3), 'ring', 'vengine', ...T(2), 'nose'], B(3), ['fin']] };
const moonR = RL.CFG.ORBIT.MOON.DIST * RL.CFG.ORBIT.R;
for (const k in cfgs) {
  const s = RL.Orbit.create(RL.analyze(toGrid(cfgs[k])), { profile: 'side' });
  let warp = 1, real = 0, cut = null, re = null, realRe = null, win = {}, sp0 = null, sp1 = null;
  while (!s.done && real < 400) {
    const tg = s.autoWarp(); warp = tg > warp ? Math.min(tg, warp * 1.06 + 0.05) : tg;
    s.advance(warp / 60); real += 1 / 60;
    const el = s.elements(); if (!el) continue;
    if (s.isPowered() && s.inSpace && sp0 === null && cut === null) sp0 = real;
    if (cut === null && el.e < 1 && el.rp > s.body.R + s.body.atmo + 20) { s.setEngine(false); cut = s.t; sp1 = real; }
    if (cut !== null && re === null && s.t > cut + 30) { s.setEngine(true); re = s.t; realRe = real; }
    if (re !== null && s.isPowered()) { if (el.e < 1 && el.ra >= moonR * 0.9 && win.a == null) win.a = real; if (el.e >= 1 && win.b == null) win.b = real; }
    if (re !== null && !s.isPowered()) break;
  }
  const f = v => (v == null || isNaN(v) ? '-' : v.toFixed(1) + '秒');
  console.log(k.padEnd(14), '上昇：うちゅうで燃やした', f(sp1 - sp0), ' 再点火→月にとどく', f(win.a - realRe), ' 月にとどく→にげる', f(win.b - win.a));
}
