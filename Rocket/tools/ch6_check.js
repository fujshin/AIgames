// v0.19 6章 つきから かえる の 確かめ
//  6-1〜6-3：flight2d と 同じ 早送りで 60fps を まねる。とまったら すぐ その ボタン、光った はさみは すぐ 2かい（声で とめる 時間は ふくまない）
//  6-4：landing_check の 自動パイロットで 月に 着陸 → 🚩 → 🔥 → かえる しるしで まえへ → 🏠 で とめる → くうきの まえで ✂️ → 🪂
//  OFF=1：かえる しるしの ずらし（HOME_OFF）を かえて しらべる
// 使い方: node tools/ch6_check.js
const { RL, toGrid } = require('./lib2d.js');
(0, eval)(require('fs').readFileSync(__dirname + '/../js/missions.js', 'utf8'));
RL.CFG.ROWS = RL.CFG.ROWS_ORBIT; const M = RL.Missions;
const act = { btnEng: s => s.setEngine(!s.engineOn), btnDir: s => s.setDir('retro'), btnFlag: s => { s.flagPlanted = true; }, btnDone: s => (s.surface ? s.endSurface() : s.finishNow()),
  btnChute: s => s.deployChute(), btnSep: s => s.separate() };
const wind = s => Math.hypot(s.vx + s.bodies.earth.rot * s.y, s.vy - s.bodies.earth.rot * s.x);
for (const m of M.LIST.filter(x => x.ch === 6 && x.start)) {
  const c = M.begin(m), g = M.gridOf(m); M.onLaunch(g, 'side');
  const s = RL.Orbit.create(RL.analyze(g), { start: m.start }); if (m.dvRate) s.dvRate = m.dvRate;
  let warp = 1, real = 0, marks = [], burn = 0, maxW = 0;
  while (!s.done && real < 600) {
    const tg = s.autoWarp(); warp = tg > warp ? Math.min(tg, s.isPowered() ? warp * 1.02 + 0.003 : warp * 1.06 + 0.05) : tg;
    if (!(s.surface && !s.engineOn)) { s.advance(warp / 60); }
    real += 1 / 60; if (s.isPowered()) burn += 1 / 60; if (s.body === s.bodies.earth && s.alt() < 300) maxW = Math.max(maxW, wind(s));
    M.tick(s).forEach(h => { if (h.clear) { s.missionEnd(); return; } const pz = typeof h.pause === 'function' ? h.pause(s) : h.pause, b = pz && pz !== 'speech' ? pz : h.hl === 'btnSep' ? 'btnSep' : null;
      marks.push(real.toFixed(1) + (b ? '⏸' + b.slice(3) : pz ? '⏸' : '')); if (b && act[b]) { M.ui(b); act[b](s); } });
    s.events.splice(0).forEach(e => M.event(e, s));
  }
  const d = s.done || {}, j = M.judge(s, d);
  console.log(m.id, j.clear ? 'クリア' : '×', '⭐'.repeat(j.stars), d.type, d.chute ? '🪂' : '', d.vDown != null ? '↓' + d.vDown.toFixed(1) : '', 'G' + Math.round(d.maxG || 0),
    '実時間', real.toFixed(1) + '秒', '燃料', Math.round(s.fuelRatio() * 100) + '%', ' あんない', marks.join(' '));
}
// 6-4
{
  const { pilot } = require('./landing_check.js');
  const m = M.byId('6-4'), cols = M.ROCKETS.TRIP;
  let w1 = null; for (let w = 0; w <= 220; w += 5) { if (pilot(cols, w, false, true).s.surface) { w1 = w; break; } }
  if (w1 === null) console.log('6-4 × 月に 着陸 できない');
  else {
    const c = M.begin(m), s = pilot(cols, w1, false, true).s;
    c.ui = {};
    s.flagPlanted = true; s.setEngine(true); let ph = 0, info = '';
    while (!s.done && s.t < 400000) {
      s.advance(s.isPowered() || s.alt() < 1500 ? 0.02 : Math.max(0.02, Math.min(s.autoWarp(), 200) * 0.05));
      if (ph === 0 && !s.engineOn) { ph = 1; info += ' 月を まわる'; }
      else if (ph === 1) { const h = M.homeAng(s); if (h && h.dt < 3) { s.setEngine(true); ph = 2; info += ' しるしで ふかす'; } }
      else if (ph === 2) { const p = RL.Predict.fromSim(s); if (p && p.home) { s.setEngine(false); ph = 3; info += ' 🏠 燃料' + Math.round(s.fuelRatio() * 100) + '%'; } else if (!s.liquidLeft()) { info += ' 燃料ぎれ'; break; } }
      else if (ph === 3 && s.body === s.bodies.earth && s.alt() < 1500) { while (s.canSep() && !s.chutes()) s.separate(); if (s.alt() < 300 && s.chutes() && !s.chute && wind(s) < 76) { s.deployChute(); ph = 4; info += ' 🪂@' + Math.round(s.alt()); } }
    }
    const d = s.done || {}, j = M.judge(s, d);
    console.log('6-4', j.clear ? 'クリア' : '×', '⭐'.repeat(j.stars), d.type, d.returned ? '🪨' : '', d.vDown != null ? '↓' + d.vDown.toFixed(1) : '', 'G' + Math.round(d.maxG || 0), ' w1=' + w1, info);
  }
}
