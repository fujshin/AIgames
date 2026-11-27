// v0.9 ワールド保存（改修4）
//  - こどもごとの セーブ（わく SAVE.SLOTS こ）。名前の かわりに どうぶつの 絵で えらぶ
//  - 1人ぶん：勲章、たかさモードの きろく（🏆🚩）、さいごに つくった ロケット、打ち上げ方、ワールド（衛星・月の はた）
//  - ワールド：うちゅうモードで 軌道に のせた ロケットは 衛星として のこる（軌道要素を しまう ＝ いつでも 位置が 出せる）
//              月に ぶつかったら そこに 🚩。ワールドの 時計は 飛んだ時間だけ すすむ
//  - しまう場所：ブラウザの localStorage（つかえないときは 画面を とじるまで だけ おぼえる）
RL.MEDALS = [
  { key: 'space',     icon: '🌌' },   // くうきの そとへ（高さ 300）
  { key: 'moonH',     icon: '🌙' },   // たかさモードで 月の高さ（1,800）
  { key: 'saturn',    icon: '🪐' },   // たかさモードで 土星の高さ（12,000）
  { key: 'tut',       icon: '🎓' },   // れんしゅうを さいごまで
  { key: 'orbit',     icon: '🛰️' },   // ちきゅうを まわる
  { key: 'high',      icon: '📡' },   // たかい きどう
  { key: 'toMoon',    icon: '🌓' },   // 月まで とどく きどう
  { key: 'moonOrbit', icon: '🌕' },   // 月を まわる
  { key: 'moonFlag',  icon: '🚩' },   // 月に とうちゃく
  { key: 'escape',    icon: '🌠' },   // ちきゅうから だっしゅつ
  { key: 'fleet',     icon: '🌐' },   // 衛星を SAVE.FLEET こ
  { key: 'moonLand',  icon: '\u{1F9D1}\u200D\u{1F680}' },   // v0.11 月に 着陸
  { key: 'softLeg',   icon: '\u{1F9B5}' },   // v0.11 着陸脚で ふんわり（下むき SOFT 以下）
  { key: 'earthLand', icon: '\u{1F3E0}' },   // v0.12 地球に 着陸（エンジン）
  { key: 'chuteLand', icon: '\u{1FA82}' },   // v0.12 パラシュートで 着陸
  { key: 'moonRock',  icon: '\u{1FAA8}' },   // v0.13 月から かえってきた（つきの いし）
  { key: 'mis1',      icon: '\u{1F530}' },   // v0.14 ミッション 1章（うちゅうモードの きほん）
  { key: 'mis2',      icon: '\u{1F4AB}' },   // v0.14 ミッション 2章（ちきゅうを まわる）
  { key: 'mis3',      icon: '\u{1F3C5}' },   // v0.14 ミッション 3章（ちきゅうに かえる）
  { key: 'mis4',      icon: '\u{1F396}\uFE0F' },   // v0.15 ミッション 4章（つきへ）
  { key: 'mis5',      icon: '\u{1F947}' }   // v0.17 ミッション 5章（つきに おりる）
];
RL.Save = (function () {
  const C = RL.CFG.SAVE;
  let mem = null, ok = true;
  const blank = () => ({ cur: -1, slots: Array(C.SLOTS).fill(null) });
  const newProfile = avatar => ({ avatar, medals: {}, best: 0, last: null, grid: null, profile: 'side', world: { clock: 0, objs: [] }, flights: 0, created: Date.now(), misV18: 1, misV181: 1 });
  function load() {
    let s = null;
    try { s = localStorage.getItem(C.KEY); } catch (e) { ok = false; }           // ブラウザが しまわせて くれない
    try { mem = s ? JSON.parse(s) : blank(); } catch (e) { mem = blank(); }       // こわれていたら あたらしく
    if (!mem || !Array.isArray(mem.slots)) mem = blank();
    while (mem.slots.length < C.SLOTS) mem.slots.push(null);
    mem.slots.forEach(p => { if (!p) return; p.medals = p.medals || {}; p.world = p.world || { clock: 0, objs: [] }; p.world.objs = p.world.objs || [];
      // v0.18：4章の ならびを かえた（よこに ならべよう 4-7 → 4-2、4-2〜4-6 → 4-3〜4-7）。まえの ⭐ を あたらしい 番号へ
      if (p.missions && !p.misV18) { const m = p.missions, MAP = { '4-2': '4-3', '4-3': '4-4', '4-4': '4-5', '4-5': '4-6', '4-6': '4-7', '4-7': '4-2' }, n = {};
        Object.keys(m).forEach(k => { n[MAP[k] || k] = m[k]; }); p.missions = n; }
      p.misV18 = 1;
      // v0.18.1：5章を 5こ → 4こ（5-2〜5-5 → 5-1〜5-4。まえの 5-1 は 5-3 に まとめた ので けす）
      if (p.missions && !p.misV181) { const m = p.missions, MAP = { '5-2': '5-1', '5-3': '5-2', '5-4': '5-3', '5-5': '5-4' }, n = {};
        Object.keys(m).forEach(k => { if (k === '5-1') return; n[MAP[k] || k] = m[k]; }); p.missions = n; }
      p.misV181 = 1; });
    if (!mem.slots[mem.cur]) mem.cur = mem.slots.findIndex(Boolean);
    return mem;
  }
  function persist() { if (!ok) return; try { localStorage.setItem(C.KEY, JSON.stringify(mem)); } catch (e) { ok = false; } }
  const cur = () => (mem && mem.slots[mem.cur]) || null;
  function create(i, avatar) { mem.slots[i] = newProfile(avatar); mem.cur = i; persist(); return mem.slots[i]; }
  function select(i) { if (!mem.slots[i]) return null; mem.cur = i; persist(); return mem.slots[i]; }
  function remove(i) { mem.slots[i] = null; if (mem.cur === i) mem.cur = mem.slots.findIndex(Boolean); persist(); }
  // 勲章：はじめて とったら true
  function medal(key) { const p = cur(); if (!p || p.medals[key]) return false; p.medals[key] = Date.now(); persist(); return true; }
  // ワールドに のこす（衛星・はた）。数が おおすぎたら ふるい ものから けす
  function addObj(o) { const p = cur(); if (!p) return; p.world.objs.push(o); while (p.world.objs.length > C.MAX_OBJS) p.world.objs.shift(); persist(); }
  function advanceClock(dt) { const p = cur(); if (!p || !(dt > 0)) return; p.world.clock += dt; persist(); }
  function update(fn) { const p = cur(); if (!p) return; fn(p); persist(); }
  load();
  return { load, persist, create, select, remove, medal, addObj, advanceClock, update,
    get cur() { return cur(); }, get index() { return mem.cur; }, get slots() { return mem.slots; }, get ok() { return ok; } };
})();
// ワールドの 衛星・はた の 位置（flight2d の 地図 と タイトルの ワールド図 で つかう）
RL.World = (function () {
  const SP = RL.Space, TAU = Math.PI * 2;
  // 軌道要素（しまう ぶん だけ）
  const pack = el => ({ mu: el.mu, a: el.a, e: el.e, w: el.w, s: el.s, p: el.p, n: el.n, tp: el.tp, T: el.T, rp: el.rp, ra: el.ra });
  // 衛星 o の、ワールドの 時刻 abs での 位置（まわっている 天体から 見た）
  const localT = (o, abs) => o.t + (abs - o.abs);
  const posAt = (o, abs) => SP.stateAt(o.el, localT(o, abs));
  // 軌道 1しゅうぶんの 点（天体から 見た）
  function orbitPts(o, n) { n = n || 96; const out = []; for (let i = 0; i <= n; i++) { const s = SP.stateAtNu(o.el, TAU * i / n); out.push([s.x, s.y]); } return out; }
  function counts(p) { const objs = (p && p.world.objs) || []; return { sats: objs.filter(o => o.kind === 'sat').length, flags: objs.filter(o => o.kind === 'flag').length, landers: objs.filter(o => o.kind === 'lander').length }; }
  return { pack, posAt, orbitPts, counts, localT };
})();
