// v0.14 ミッションの 確かめ：ミッションごとに 子どもと 同じ 操作を する 自動パイロットで、クリア と ⭐ を しらべる
// 使い方: node tools/mission_check.js
const { RL, toGrid } = require('./lib2d.js');
(0, eval)(require('fs').readFileSync(__dirname + '/../js/missions.js', 'utf8'));
RL.CFG.ROWS = RL.CFG.ROWS_ORBIT;
const M = RL.Missions, LD = RL.CFG.ORBIT.LAND.earth, T = n => Array(n).fill('tank');
const wind = s => Math.hypot(s.vx + s.bodies.earth.rot * s.y, s.vy - s.bodies.earth.rot * s.x);
const pe = s => s.elements().rp - s.body.R, ap = s => { const e = s.elements(); return e.e < 1 ? e.ra - s.body.R : 1e9; };
const vr = s => (s.vx * s.x + s.vy * s.y) / Math.hypot(s.x, s.y);
const press = (id, f) => { M.ui(id); return f && f(); };
// 自動パイロット（ミッションごと）：毎こま よばれる。st＝その ミッションの メモ
const P = {
  '1-2': (s) => {}, '1-3': () => {}, '1-5': () => {}, '2-1': () => {}, '1-1': () => {},
  '1-4': (s, c, st) => { if (s.maxAlt > 100 && !st.a) { st.a = 1; press('btnMap'); press('btnZin'); press('btnMap'); } },
  '2-2': (s, c, st) => cut(s, st), '2-4': (s, c, st) => { cut(s, st); if (st.cut && !st.d) { st.d = 1; press('btnDone', () => s.finishNow()); } },
  '2-8': (s, c, st) => { cut(s, st); if (st.cut) s.finishNow(); },
  '2-3': (s, c, st) => { cut(s, st); if (!st.cut) return;
    if (!st.b && s.alt() >= ap(s) - 30 && !s.engineOn) { st.b = 1; press('btnEng', () => s.setEngine(true)); }
    else if (st.b === 1 && s.engineOn && pe(s) >= 850) { st.b = 2; press('btnEng', () => s.setEngine(false)); }
    else if (st.b === 2) s.finishNow(); },
  '2-5': (s, c, st) => { if (!st.a) { st.a = 1; press('btnEng', () => s.setEngine(true)); } else if (st.a === 1 && ap(s) > 3800) { st.a = 2; press('btnEng', () => s.setEngine(false)); } },
  '2-6': (s, c, st) => { if (!st.a) { st.a = 1; press('btnDir', () => s.setDir('retro')); press('btnEng', () => s.setEngine(true)); } else if (st.a === 1 && ap(s) <= 1400) { st.a = 2; press('btnEng', () => s.setEngine(false)); } },
  '2-7': (s, c, st) => { st.fine = s.alt() > 2800; if (!st.a && s.alt() > 2500 && vr(s) <= 0) { st.a = 1; press('btnEng', () => s.setEngine(true)); } else if (st.a === 1 && (ap(s) - pe(s) <= 60 || ap(s) - pe(s) > (st.m = Math.min(st.m || 1e9, ap(s) - pe(s))) + 1)) { st.a = 2; press('btnEng', () => s.setEngine(false)); } },
  '3-1': (s, c, st) => chute(s, st, vr(s) < 0),
  '3-2': (s, c, st) => { if (!st.c && s.alt() < 100) { st.c = 1; press('btnChute', () => s.deployChute()); } },
  '3-3': (s, c, st) => deorbit(s, st, false), '3-5': (s, c, st) => deorbit(s, st, true),
  '3-4': (s, c, st) => { if (!st.a) { st.a = 1; press('btnDir', () => s.setDir('retro')); }
    const rv = s.relVel(), h = s.alt(), vd = Math.max(0, -rv.vr), aAv = s.near ? (LD.TWR - 1) * 10 : 20, td = s.fallInfo(), allow = LD.V_DOWN * (s.legs().n ? LD.LEG_K : 1) * 0.4;
    if (s.engineOn && s.hover) press('btnEng', () => s.setEngine(false));
    else if (!s.engineOn && s.liquidLeft() && vd * vd / (2 * aAv) > h * 0.85 - 3 && !(td && td.vDown <= allow)) press('btnEng', () => s.setEngine(true)); }
};
function cut(s, st) { const el = s.elements(); if (!st.cut && s.engineOn && s.lifted && el && el.e < 1 && el.rp > s.body.R + s.body.atmo + 20) { st.cut = 1; press('btnEng', () => s.setEngine(false)); } }
function chute(s, st, ok) { if (!st.c && ok && s.alt() < 300 && s.chutes() && wind(s) < 76) { st.c = 1; press('btnChute', () => s.deployChute()); } }
function deorbit(s, st, sep) {
  if (!st.a) { st.a = 1; press('btnDir', () => s.setDir('retro')); press('btnEng', () => s.setEngine(true)); }
  else if (st.a === 1 && pe(s) < (sep ? 250 : 150)) { st.a = 2; press('btnEng', () => s.setEngine(false)); }
  else if (st.a === 2 && sep && s.canSep()) { press('btnSep'); press('btnSep', () => s.separate()); st.a = 3; }
  chute(s, st, st.a >= 2);
}
const extraGrid = { '1-1': [['fin'], B => 0, ['engine', ...T(12), 'win', 'nose'], [], ['fin']], '1-2': [['fin'], [], ['engine', 'tank', 'tank', 'win', 'nose'], [], ['fin']],
  '3-1': [['fin'], [], ['engine', 'tank', 'win+chute', 'nose'], [], ['fin']], '2-8': M.ROCKETS.ORBIT };
const prof = { '1-2': 'up', '1-3': 'side', '1-5': 'tilt', '3-1': 'up' };
let ok = 0;
for (const m of M.LIST) {
  const c = M.begin(m), cols = extraGrid[m.id] ? extraGrid[m.id].map(x => (Array.isArray(x) ? x : [])) : M.ROCKETS[m.rocket || m.preset];
  const grid = toGrid(cols), pf = prof[m.id] || m.need || 'side';
  if (m.id === '1-3') c.profs.add('tilt');   // まえに ななめ でも とんだ
  if (m.id === '1-5') c.aborts = 1;
  M.onLaunch(grid, pf);
  const s = RL.Orbit.create(RL.analyze(grid), m.start ? { start: m.start } : { profile: pf });
  if (m.id === '1-5') s.rewinds = 1;
  const st = {}, said = [];
  while (!s.done && s.t < 60000) {
    s.advance(s.isPowered() || s.alt() < 1500 || st.fine ? 0.02 : Math.max(0.02, Math.min(s.autoWarp(), 100) * 0.05));
    if (P[m.id]) P[m.id](s, c, st);
    M.tick(s).forEach(h => { if (h.clear) s.missionEnd(); else said.push(h.say.slice(0, 10)); });
    s.events.splice(0).forEach(e => M.event(e, s));
  }
  const d = s.done || {}, j = M.judge(s, d);
  if (j.clear) ok++;
  const el = d.el && d.body === 'earth' ? ` ▼${Math.round(d.el.rp - 12000)} ▲${d.el.e < 1 ? Math.round(d.el.ra - 12000) : '∞'}` : '';
  console.log(`${m.id} ${j.clear ? 'クリア' : '×    '} ${'⭐'.repeat(j.stars).padEnd(3, '・')}  ${d.type}${d.chute ? '🪂' : ''}${d.vDown != null ? ' ↓' + d.vDown.toFixed(1) : ''}${el}` +
    ` 高さ${Math.round(d.maxAlt || s.maxAlt)} ➡${Math.round(d.range || 0)} G${Math.round(d.maxG || 0)} 燃料(段)${Math.round(s.fuelRatio() * 100)}% cut${Math.round(c.cutFuel * 100)}%  声${said.length}`);
}
console.log(`クリア ${ok}/${M.LIST.length}`);
