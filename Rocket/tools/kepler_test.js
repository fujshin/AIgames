// ケプラー計算の確かめ：状態→要素→状態 の往復、数値積分との一致
const { RL } = require('./lib2d.js'); const SP = RL.Space;
let worst = 0, notGood = 0;
const mu = 10 * 4000 * 4000;
for (let i = 0; i < 2000; i++) {
  const r = 4000 + Math.random() * 60000, ang = Math.random() * 6.283, vc = Math.sqrt(mu / r) * (0.05 + Math.random() * 1.7);
  const dir = Math.random() * 6.283, x = r * Math.cos(ang), y = r * Math.sin(ang), vx = vc * Math.cos(dir), vy = vc * Math.sin(dir);
  const el = SP.toElements(x, y, vx, vy, mu, 100);
  if (!el.good) { notGood++; continue; }
  const s = SP.stateAt(el, 100);
  const err = Math.hypot(s.x - x, s.y - y) / r + Math.hypot(s.vx - vx, s.vy - vy) / vc;
  if (err > worst) worst = err;
}
console.log('往復の最大誤差', worst.toExponential(2), ' （ほぼ真上の軌道で 数値積分に まかせた数', notGood, '/ 2000）');
// 数値積分（細かい RK4）と レール上の比較
function rk4(st, dt, n) { let [x, y, vx, vy] = st; const f = (x, y) => { const r3 = Math.pow(x * x + y * y, 1.5); return [-mu * x / r3, -mu * y / r3]; };
  for (let i = 0; i < n; i++) { const a1 = f(x, y), k1 = [vx, vy, ...a1]; const a2 = f(x + k1[0] * dt / 2, y + k1[1] * dt / 2), k2 = [vx + k1[2] * dt / 2, vy + k1[3] * dt / 2, ...a2];
    const a3 = f(x + k2[0] * dt / 2, y + k2[1] * dt / 2), k3 = [vx + k2[2] * dt / 2, vy + k2[3] * dt / 2, ...a3]; const a4 = f(x + k3[0] * dt, y + k3[1] * dt), k4 = [vx + k3[2] * dt, vy + k3[3] * dt, ...a4];
    x += dt / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]); y += dt / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]); vx += dt / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]); vy += dt / 6 * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]); }
  return [x, y, vx, vy]; }
for (const [nm, v] of [['円', 1], ['だ円', 1.25], ['双曲線', 1.6], ['ほぼ真上', 0.02]]) {
  const r = 4400, st = [r, 0, 0, Math.sqrt(mu / r) * v]; if (nm === 'ほぼ真上') { st[2] = 300; }
  const el = SP.toElements(...st, mu, 0), T = 300, a = SP.stateAt(el, T), b = rk4(st, 0.01, T / 0.01);
  console.log(nm.padEnd(6), 'e=' + el.e.toFixed(4), '300秒後のずれ', Math.hypot(a.x - b[0], a.y - b[1]).toFixed(4));
}
