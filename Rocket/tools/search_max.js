// 変な積み方も含めて最大の高さを探す（焼きなまし法）。何回か別々に実行すること
// 使い方: PROGRESS=1 FAST=1 [NORING=1] node tools/search_max.js [回数]
//   NORING=1 … リングを使わない（1段の最大をしらべる）
const { RL, R, C, H } = require('./lib.js');
const K = ['engine', 'vengine', 'tank', 'booster', 'fin', 'win', 'nose', ...(process.env.NORING ? [] : ['ring'])];
const rnd = a => a[Math.floor(Math.random() * a.length)];
function mutate(cols) { const n = cols.map(s => s.slice()), s = n[Math.floor(Math.random() * C)], r = Math.random();
  if (r < .35 && s.length < R) s.push(rnd(K)); else if (r < .5 && s.length) s.pop();
  else if (r < .6 && s.length) s.splice(Math.floor(Math.random() * s.length), 0, rnd(K)), s.length > R && s.pop();
  else if (s.length) s[Math.floor(Math.random() * s.length)] = rnd(K); else s.push(rnd(K)); return n; }
const N = +process.argv[2] || 30; let best = { h: 0 };
for (let i0 = 0; i0 < N; i0++) {
  let cur = Array.from({ length: C }, () => []), hc = 0, T = 400;
  for (let i = 0; i < 2500; i++) { const nx = mutate(cur), hn = H(nx); if (hn >= hc || Math.random() < Math.exp((hn - hc) / T)) { cur = nx; hc = hn; } T *= 0.998;
    if (hc > best.h) best = { h: hc, cols: cur.map(s => s.slice()) }; }
  if (process.env.PROGRESS) console.log('run', i0, Math.round(best.h), JSON.stringify(best.cols));
}
if (process.env.FAST) { RL.CFG.PHYS.DT = 0.02; best.h = H(best.cols); }
console.log('最大', Math.round(best.h), RL.CFG.ZONES[RL.zoneOf(best.h)].icon, JSON.stringify(best.cols));
