// 全体設定。数値の調整はここだけで行う
window.RL = window.RL || {};
RL.CFG = {
  COLS: 5, ROWS: 7, VERSION: 'v0.5',
  // 物理（時間ごとに計算する。値はゲーム用に調整したもの）
  PHYS: {
    G: 10,            // 重力
    THRUST: 188,      // エンジン1つの力
    MASS: { engine: 1, tank: 0.26, win: 0.22, nose: 0.11, fin: 0, booster: 0.2 }, // 部品の重さ（燃料ぬき）
    FUEL_ENGINE: 0.6, // エンジンにはじめから入っている燃料
    FUEL_TANK: 2.3,   // 燃料タンク1つの燃料
    BURN: 0.93,       // エンジン1つが1秒で使う燃料
    DRAG: 0.05,       // 空気のじゃま（胴体の列の数に比例）
    NOSE_DRAG: 0.55,  // 先っぽがあると、じゃまがこの割合になる
    TILT_NOFIN: 0.5,  // はねがないときの かたむき
    TILT_ASYM: 0.5,   // 左右の重さがずれているときの かたむき
    TILT_GROW: 0.15,  // かたむきが時間でふえる速さ
    // 固体ロケットブースター：力が強く、すぐ燃えつきて勝手に切りはなされる
    BOOST_THRUST: 130, BOOST_FUEL: 0.7, BOOST_BURN: 0.45, BOOST_MASS: 0.2, BOOST_DRAG: 0.4,
    TIME_STRETCH: 1.3, // 全体の動きをゆっくりにする（高さは変わらない）
    DT: 0.02,         // 計算の きざみ（秒）
    MAX_T: 60
  },
  PLAY: { MAX_SEC: 24 },   // 再生は実時間。これより長いときだけ早送り
  // 高さの目印。土星は2段ロケット（将来）で届く想定
  ZONES: [
    { h: 0,   icon: '🏠', sky: '#8fd3ff' },
    { h: 40,  icon: '☁️', sky: '#6cb8f5' },
    { h: 120, icon: '✈️', sky: '#3a6fd8' },
    { h: 220, icon: '🌌', sky: '#1a0f4a' },
    { h: 380, icon: '🛰️', sky: '#090820' },
    { h: 560, icon: '🌙', sky: '#000000' },
    { h: 760, icon: '☄️', sky: '#000000' },
    { h: 950, icon: '🪐', sky: '#000000' }
  ],
  SPEED_SCALE: 40,  // （TIME_STRETCH の分は自動でもどす）  // メーターの数字 ＝ はやさ × この値
  SPEED_MAX: 5000,  // メーターの最大
  TOP: 1000
};
