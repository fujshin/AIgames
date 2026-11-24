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
  '1-1': () => {}, '1-2': () => {}, '1-4': () => {},
  '1-3': (s, c, st) => { if (s.maxAlt > 100 && !st.a) { st.a = 1; press('btnMap'); press('btnZout'); press('btnMap'); } },
  '2-1': (s, c, st) => { if (st.second) cut(s, st); if (st.cut && (st.d = (st.d || 0) + 1) === 3) press('btnDone', () => s.finishNow()); },
  '2-5': (s, c, st) => { cut(s, st); if (st.cut) s.finishNow(); },
  '2-2': (s, c, st) => { if (!st.a) { st.a = 1; press('btnEng', () => s.setEngine(true)); } else if (st.a === 1 && ap(s) > 3800) { st.a = 2; press('btnEng', () => s.setEngine(false)); } },
  '2-3': (s, c, st) => { if (!st.a) { st.a = 1; press('btnDir', () => s.setDir('retro')); press('btnEng', () => s.setEngine(true)); } else if (st.a === 1 && ap(s) <= 1400) { st.a = 2; press('btnEng', () => s.setEngine(false)); } },
  '2-4': (s, c, st) => { st.fine = s.alt() > 2800; if (!st.a && s.alt() > 2500 && vr(s) <= 0) { st.a = 1; press('btnEng', () => s.setEngine(true)); } else if (st.a === 1 && (ap(s) - pe(s) <= 60 || ap(s) - pe(s) > (st.m = Math.min(st.m || 1e9, ap(s) - pe(s))) + 1)) { st.a = 2; press('btnEng', () => s.setEngine(false)); } },
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
const addTop = g => { g = g.map(r => r.slice()); let top = g.length; g.forEach((r, i) => { if (r[2] && i < top) top = i; }); g[top - 1][2] = 'tank'; return g; };
const PLAN = { '2-1': [{}, { second: true }], '3-1': [{ grid: M.ROCKETS.SMALL }, { mod: g => g.map(r => r.map(k => (k === 'win' ? 'win+chute' : k))) }], '1-1': [{ prof: 'up' }, { prof: 'side' }], '1-2': [{ prof: 'side' }, { mod: addTop }], '1-4': [{ prof: 'tilt' }, { rew: true }] };
const extraGrid = { '2-5': M.ROCKETS.ORBIT };
const prof0 = {};
const info = (g, p) => M.buildInfo(g, p);
let ok = 0;
for (const m of M.LIST) {
  const c = M.begin(m); let grid = toGrid(extraGrid[m.id] || M.ROCKETS[m.rocket || m.preset] || []), pf = prof0[m.id] || m.profile || 'side';
  c.tanks0 = M.countTanks(grid);
  const log = []; M.pollAll('build', info(grid, pf)).forEach(x => log.push('🗣' + x.say[0].slice(0, 12)));
  if (m.id === '1-1') log.push('よこ で 発射→' + JSON.stringify(M.onLaunch(grid, 'side')).slice(0, 20));
  let s, d, j = null;
  for (const fl of PLAN[m.id] || [{}]) {
    if (fl.mod) grid = fl.mod(grid); if (fl.prof) pf = fl.prof;
    M.pollAll('build', info(grid, pf)).forEach(x => log.push('🗣' + x.say[0].slice(0, 12)));
    const L = M.onLaunch(grid, pf); if (L !== true) { log.push('発射できない ' + JSON.stringify(L).slice(0, 30)); break; }
    
    s = RL.Orbit.create(RL.analyze(grid), m.start ? { start: m.start } : { profile: pf });
    if (fl.rew) { s.rewinds = 1; if (m.id === '1-4') c.aborts = 1; }
    const st = { second: !!fl.second };
    while (!s.done && s.t < 60000) {
      s.advance(s.isPowered() || s.alt() < 1500 || st.fine ? 0.02 : Math.max(0.02, Math.min(s.autoWarp(), 100) * 0.05));
      if (P[m.id]) P[m.id](s, c, st);
      M.tick(s).forEach(h => { if (h.clear) s.missionEnd(); else log.push('🗣' + h.say[0].slice(0, 10) + (h.hl ? '[' + h.hl + ']' : '')); });
      s.events.splice(0).forEach(e => M.event(e, s));
    }
    d = s.done || {};
    const exp = M.poll('result', { d, sim: s });
    if (exp) { log.push(`(${d.type} → わざと しっぱい)`); continue; }
    j = M.judge(s, d); break;
  }
  if (!j) j = { clear: false, stars: 0 };
  if (j.clear) ok++;
  const el = d.el && d.body === 'earth' ? ` ▼${Math.round(d.el.rp - 12000)} ▲${d.el.e < 1 ? Math.round(d.el.ra - 12000) : '∞'}` : '';
  console.log(`${m.id} ${j.clear ? 'クリア' : '×    '} ${'⭐'.repeat(j.stars).padEnd(3, '・')}  ${d.type}${d.chute ? '🪂' : ''}${d.vDown != null ? ' ↓' + d.vDown.toFixed(1) : ''}${el}` +
    ` 高さ${Math.round(d.maxAlt || s.maxAlt)} G${Math.round(d.maxG || 0)} cut${Math.round(c.cutFuel * 100)}%`);
  if (process.env.V || m.ch === 1) console.log('     ' + log.join(' '));
}
console.log(`クリア ${ok}/${M.LIST.length}`);
