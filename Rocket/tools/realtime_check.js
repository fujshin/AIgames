// v0.14.7 実時間の 確かめ（3章）：flight2d と 同じ 早送りで 60fps を まねて、子どもと 同じ 操作（とまったら すぐ ボタン）。
//  声で とめる 時間は ふくめない。はかる もの：くうき（高さ 600）に 入ってから 地面まで の 実時間
// 使い方: node tools/realtime_check.js
const { RL } = require('./lib2d.js');
(0, eval)(require('fs').readFileSync(__dirname + '/../js/missions.js', 'utf8'));
RL.CFG.ROWS = RL.CFG.ROWS_ORBIT; const M = RL.Missions;
const pe = s => s.elements().rp - s.body.R;
const act = { btnEng: s => s.setEngine(!s.engineOn), btnDir: s => s.setDir('retro'), btnChute: s => s.deployChute(), btnSep: s => s.separate(), btnAbort: () => {} };
function run(id, mod, extra) {
  const m = M.byId(id), c = M.begin(m); let g = M.gridOf(m); if (mod) g = mod(g);
  M.pollAll('build', M.buildInfo(g, m.profile || 'side')); M.onLaunch(g, m.profile || 'side');
  const s = RL.Orbit.create(RL.analyze(g), m.start ? { start: m.start } : { profile: m.profile || 'side' });
  if (m.dvRate) s.dvRate = m.dvRate;
  let warp = 1, real = 0, tIn = null, minW = 9, hl = null, st = {};
  while (!s.done && real < 900) {
    const tg = s.autoWarp(); warp = tg > warp ? Math.min(tg, s.isPowered() ? warp * 1.02 + 0.003 : warp * 1.06 + 0.05) : tg;
    s.advance(warp / 60); real += 1 / 60;
    if (tIn === null && s.lifted && s.alt() < 600 && (s.vx * s.x + s.vy * s.y) < 0 && s.maxAlt > 100) tIn = real;
    if (tIn !== null) minW = Math.min(minW, warp);
    M.tick(s).forEach(h => { if (h.clear) { s.missionEnd(); return; } hl = h.hl; const pz = typeof h.pause === 'function' ? h.pause(s) : h.pause;
      const b = pz && pz !== 'speech' ? pz : h.hl; if (b && act[b] && !(b === 'btnEng' && h.hl === 'btnEng' && !pz && s.engineOn === false && id === '3-4')) { M.ui(b); act[b](s); if (b === 'btnSep') { M.ui(b); act[b](s); } } });
    if (extra) extra(s, st);
    s.events.splice(0).forEach(e => M.event(e, s));
  }
  const d = s.done || {}, j = M.judge(s, d);
  console.log(id.padEnd(5), (d.type + (d.chute ? '🪂' : '')).padEnd(10), ('↓' + (d.vDown || 0).toFixed(1)).padEnd(7), 'くうき→地面 実時間', tIn === null ? '-' : (real - tIn).toFixed(1) + '秒', ' いちばん おそい 早送り×' + minW.toFixed(2), j.clear ? 'クリア' : '');
}
run('3-1', g => g.map(r => r.map(k => (k === 'win' ? 'win+chute' : k))));
run('3-2'); run('3-3'); run('3-4', g => g.map(r => r.map(k => (k === 'engine' ? 'engine+leg' : k)))); run('3-4');
run('3-5', null, (s, st) => {});
