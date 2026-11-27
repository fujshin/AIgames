// v0.15 4章の 実時間（flight2d と 同じ 早送り。とまって 話す 時間は ふくまない。とまったら すぐ ボタン）
// 使い方: node tools/ch4_time.js（4・5章。6章は tools/ch6_check.js）
const { RL } = require('./lib2d.js');
(0, eval)(require('fs').readFileSync(__dirname + '/../js/predict.js', 'utf8'));
(0, eval)(require('fs').readFileSync(__dirname + '/../js/missions.js', 'utf8'));
RL.CFG.ROWS = RL.CFG.ROWS_ORBIT; const M = RL.Missions;
const act = { btnEng: s => s.setEngine(!s.engineOn), btnDir: s => s.setDir('retro'), btnFlag: s => { s.flagPlanted = true; }, btnDone: s => (s.surface ? s.endSurface() : s.finishNow()) };
for (const m of M.LIST.filter(x => x.ch >= 4 && x.ch <= 5 && x.start)) {
  const c = M.begin(m), g = M.gridOf(m); M.onLaunch(g, 'side');
  const s = RL.Orbit.create(RL.analyze(g), { start: m.start }); if (m.dvRate) s.dvRate = m.dvRate; if (m.noSlow) s.noSlow = true; if (m.coast) s.coastK = m.coast;
  let warp = 1, real = 0, marks = [], burn = 0;
  while (!s.done && !(s.surface && M.ctx.cleared) && real < 600) {
    const tg = s.autoWarp(); warp = tg > warp ? Math.min(tg, s.isPowered() ? warp * 1.02 + 0.003 : warp * 1.06 + 0.05) : tg;
    s.advance(warp / 60); real += 1 / 60; if (s.isPowered()) burn += 1 / 60;
    M.tick(s).forEach(h => { if (h.clear) { s.missionEnd(); return; } const pz = typeof h.pause === 'function' ? h.pause(s) : h.pause;
      marks.push(real.toFixed(1) + (pz && pz !== 'speech' ? '⏸' + pz.slice(3) : pz ? '⏸' : '')); if (act[pz]) { M.ui(pz); act[pz](s); } });
    s.events.splice(0).forEach(e => M.event(e, s));
  }
  const j = M.judge(s, s.done || {});
  console.log(m.id, j.clear ? 'クリア' : '×', '実時間', real.toFixed(1) + '秒', 'ふかした', burn.toFixed(1) + '秒', '燃料', Math.round(s.fuelRatio() * 100) + '%', ' あんない', marks.join(' '));
}
