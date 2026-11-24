// 全体設定。数値の調整はここだけで行う
window.RL = window.RL || {};
RL.CFG = {
  COLS: 5, ROWS: 9, VERSION: 'v0.8.1',
  PHYS: {
    G: 10,
    THRUST: 188,      // 地上用エンジン1つの力
    VTHRUST: 120,     // 宇宙用エンジン1つの力（くうきの外で）
    VAIR: 0.3,        // 宇宙用エンジンは くうきの中では この割合の力しか出ない
    MASS: { engine: 1, vengine: 0.6, tank: 0.26, win: 0.22, nose: 0.11, fin: 0.15, booster: 0.2, ring: 0.3 }, // 燃料ぬきの重さ
    FUEL_ENGINE: 0.6, FUEL_TANK: 2.3,
    BURN: 0.93,       // 地上用エンジン1つが使う燃料
    VBURN: 0.45,      // 宇宙用エンジン1つが使う燃料（ながもち）
    DRAG: 0.05, NOSE_DRAG: 0.55,
    TILT_NOFIN: 0.5, TILT_ASYM: 0.5, TILT_GROW: 0.15,
    ATMO_H: 300,      // くうきの おわり
    BOOST_THRUST: 110, BOOST_FUEL: 0.7, BOOST_BURN: 0.45, BOOST_DRAG: 0.15,
    BOOST_SEG_POW: 0.5, // 長いブースターほど 力が強く、長く もえる（√長さ 倍）
    IGN_DELAY: 0.3,   // 切りはなしから つぎの段が 点火するまで（秒）
    TIME_STRETCH: 1.3, DT: 0.02, MAX_T: 120
  },
  PLAY: { MAX_SEC: 30, COAST_SEC: 4, FF_MIN: 3 },   // 燃えている間は実時間。燃料が なくなったら 早送り
  VOICE_RATE: 1.2,
  SPEED_SCALE: 40, SPEED_MAX: 20000,
  ZONES: [
    { h: 0,     icon: '🏠', sky: '#8fd3ff' },
    { h: 40,    icon: '☁️', sky: '#6cb8f5' },
    { h: 120,   icon: '✈️', sky: '#3a6fd8' },
    { h: 300,   icon: '🌌', sky: '#0d0a30' },
    { h: 700,   icon: '🛰️', sky: '#05051a' },
    { h: 1800,  icon: '🌙', sky: '#000000' },
    { h: 4000,  icon: '☄️', sky: '#000000' },
    { h: 12000, icon: '🪐', sky: '#000000' }
  ],
  TOP: 13000,
  // ---- うちゅうモード（v0.8）。長さ・時間の単位は たかさモードと同じ（地面の重力 10）
  ORBIT: {
    G0: 10,            // 地面での 重力
    R: 12000,          // 地球の半径（ほんものの 約530分の1。第1宇宙速度 = √(G0×R) ≒ 346、第2 ≒ 490）
    ROT: 0.06,         // 地球の自転（地面の速さ ÷ 第1宇宙速度。ほんものと だいたい同じ割合）
    ATMO_H: 300,       // くうきの おわり
    LEO_TOP: 0.3,      // 遠地点の高さが 半径×0.3 までなら「ひくい軌道」
    EARTH_SOI: 30,     // 地球の重力圏（半径の何倍）。ここを出たら「地球だっしゅつ」
    MOON: { DIST: 15, R: 0.27, MU: 1 / 81, PHASE: 0.9 },   // 月：距離（半径の何倍）、大きさ（半径の何倍）、重さの割合、はじめの位置（rad）
    SITE: Math.PI / 2, // 発射場の位置（rad。π/2 = 地図の上）。地球は 反時計まわり（北極の上から見た向き）なので、東＝地図の左
    SUB_DT: 0.02,      // エンジンを使う間・くうきの中の 計算のきざみ
    WARP_MAX: 3000,    // 早送りの上限
    ORBIT_DONE: 1.2,   // 安定した軌道を この周回ぶん まわったら おしまい
    TURN_START: 20,    // この高さから かたむけ はじめる
    PROFILES: {        // 自動で かたむける（pitch：地平線からの角度。turnH までに そこまで倒す）
      up:   { pitch: 90, turnH: 1 },
      tilt: { pitch: 45, turnH: 220 },
      side: { pitch: 10, turnH: 300, hold: true }   // くうきの外では 高さを保ちながら 横に加速
    },
    CLIMB_V: 50,       // よこ：くうきの中で めざす 上むきの速さ
    HOLD_H: 1.3,       // よこ：くうきの外で たもつ高さ（くうきの おわり の何倍）
    HOLD_GAIN: 0.25    // よこ：くうきの外で 上下の速さを 0 に近づける強さ
  },
  STAGE_COLORS: ['rgba(255,150,40,.16)', 'rgba(80,190,255,.16)', 'rgba(120,230,120,.16)', 'rgba(220,120,255,.16)']
};
RL.hPos = h => Math.log(1 + Math.max(0, h) / 40) / Math.log(1 + RL.CFG.TOP / 40);
RL._ev = {};
RL.on = (n, f) => (RL._ev[n] = RL._ev[n] || []).push(f);
RL.emit = (n, d) => (RL._ev[n] || []).slice().forEach(f => f(d));
