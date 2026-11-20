// 全体設定。数値の調整はここだけで行う
window.RL = window.RL || {};
RL.CFG = {
  COLS: 5, ROWS: 7, VERSION: 'v0.6.3',
  PHYS: {
    G: 10,
    THRUST: 188,      // エンジン1つの力
    MASS: { engine: 1, tank: 0.26, win: 0.22, nose: 0.11, fin: 0.15, booster: 0.2 }, // 燃料ぬきの重さ
    FUEL_ENGINE: 0.6, FUEL_TANK: 2.3, BURN: 0.93,
    DRAG: 0.05,       // 空気のじゃま（胴体の列の数に比例）
    NOSE_DRAG: 0.55,  // 先っぽがあると、じゃまがこの割合に
    TILT_NOFIN: 0.5, TILT_ASYM: 0.5, TILT_GROW: 0.15,
    ATMO_H: 300,      // くうきの おわり。ここまで だんだん うすくなり、上は くうきなし
    // 固体ロケットブースター（縦につながった1本ごと）
    BOOST_THRUST: 110, BOOST_FUEL: 0.7, BOOST_BURN: 0.45, BOOST_DRAG: 0.15,
    BOOST_SEG_POW: 0.5, // 長いブースターほど 力が強く、長く もえる（力も燃える時間も √長さ 倍）
    TIME_STRETCH: 1.3, // 全体をゆっくりにする（高さは変わらない）
    DT: 0.02, MAX_T: 60
  },
  PLAY: { MAX_SEC: 30, COAST_SEC: 4, FF_MIN: 3 },   // 燃えている間は実時間。燃料が なくなったら 早送り（のこりを約4秒・最低3倍）
  VOICE_RATE: 1.50,   // 声の はやさ（1＝ふつう）
  SPEED_SCALE: 40, SPEED_MAX: 12000,
  // 高さの目印（上ほど間かくが広い）。🌌 は くうきの おわり（ATMO_H）と同じ高さ
  ZONES: [
    { h: 0,    icon: '🏠', sky: '#8fd3ff' },
    { h: 40,   icon: '☁️', sky: '#6cb8f5' },
    { h: 120,  icon: '✈️', sky: '#3a6fd8' },
    { h: 300,  icon: '🌌', sky: '#0d0a30' },
    { h: 700,  icon: '🛰️', sky: '#05051a' },
    { h: 1800, icon: '🌙', sky: '#000000' },
    { h: 4000, icon: '☄️', sky: '#000000' },
    { h: 12000, icon: '🪐', sky: '#000000' }
  ],
  TOP: 13000
};
// かんたんな イベントのしくみ（チュートリアルが画面の動きを見はる）
RL._ev = {};
RL.on = (n, f) => (RL._ev[n] = RL._ev[n] || []).push(f);
RL.emit = (n, d) => (RL._ev[n] || []).slice().forEach(f => f(d));
// 高さ → はしご・メーター上の位置（0〜1）。上ほど ちぢめて 見せる
RL.hPos = h => Math.log(1 + Math.max(0, h) / 40) / Math.log(1 + RL.CFG.TOP / 40);
