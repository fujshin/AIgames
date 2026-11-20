// 変な積み方も含めて最大の高さを探す（焼きなまし法）。何回か別々に実行すること
// 使い方: PROGRESS=1 node tools/search_max.js [回数]
const { RL, R, C, H, run } = require('./lib.js');
const K = ['engine', 'tank', 'booster', 'fin', 'win', 'nose'], rnd = a => a[Math.floor(Math.random() * a.length)];
function mutate(cols) { const n = cols.map(s => s.slice()), s = n[Math.floor(Math.random() * C)], r = Math.random();
  if (r < .35 && s.length < R) s.push(rnd(K)); else if (r < .5 && s.length) s.pop(); else if (s.length) s[Math.floor(Math.random() * s.length)] = rnd(K); else s.push(rnd(K)); return n; }
const N = +process.argv[2] || 30; let best = { h: 0 };
for (let run_ = 0; run_ < N; run_++) {
  let cur = Array.from({ length: C }, () => []), hc = 0, T = 200;
  for (let i = 0; i < 2500; i++) { const nx = mutate(cur), hn = H(nx); if (hn >= hc || Math.random() < Math.exp((hn - hc) / T)) { cur = nx; hc = hn; } T *= 0.998;
    if (hc > best.h) best = { h: hc, cols: cur.map(s => s.slice()) }; }
  if (process.env.PROGRESS) console.log('run', run_, Math.round(best.h), JSON.stringify(best.cols));
}
if (process.env.FAST) { RL.CFG.PHYS.DT = 0.02; best.h = H(best.cols); }
console.log('最大', Math.round(best.h), RL.CFG.ZONES[RL.zoneOf(best.h)].icon, JSON.stringify(best.cols));
