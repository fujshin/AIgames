// 全体設定。数値の調整はここだけで行う
window.RL = window.RL || {};
RL.CFG = {
  COLS: 5, ROWS: 9, VERSION: 'v0.14.1',
  ROWS_FREE: 9, ROWS_ORBIT: 18, VIS_ROWS: 9,   // v0.12：うちゅうモードは 縦14行（見えるのは 9行。上下に うごかす）。ROWS は いまの モードの 行数
  PHYS: {
    G: 10,
    THRUST: 188,      // 地上用エンジン1つの力
    VTHRUST: 120,     // 宇宙用エンジン1つの力（くうきの外で）
    VAIR: 0.3,        // 宇宙用エンジンは くうきの中では この割合の力しか出ない
    MASS: { engine: 1, vengine: 0.6, tank: 0.26, win: 0.22, nose: 0.11, fin: 0.15, booster: 0.2, ring: 0.3, leg: 0.12, chute: 0.05 }, // 燃料ぬきの重さ
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
    // v0.12：うちゅうで 燃やす間の スローモーション。DV＝ふだん 実時間1秒に ふえる速さの 上限
    //   つぎの できごと（軌道の種類が かわる／月と であう）まで あと 何の 速さが 要るかを はかり（LOOK まで）、それが 実時間 AHEAD_SEC 秒で くるように する
    //   いちばん おそくて 実時間1秒に DV_MIN。月と であう 予測が 出たら、エンジンを とめるまで DV_MIN の まま
    SLOW: { DV: 60, AHEAD_SEC: 3, LOOK: 200, DV_MIN: 1.5, LOOK_MOON: 10 },
    ORBIT_DONE: 1.2,   // 燃料が もう ないとき：安定した軌道を この周回ぶん まわったら おしまい
    IDLE_TURNS: 12,    // v0.8.3：燃料が のこっていても、エンジンを つかわずに この周回ぶん まわったら おしまい（ずっと おわらない のを ふせぐ）
    MOON_WAIT: 4,      // v0.8.3：燃料が もう ないとき、月まで とどく軌道は 月と であうのを この周回ぶん まつ
    // v0.11 月着陸：下むき V_DOWN・よこ V_SIDE 以下で 着陸（HARD_K 倍までは「あぶなかった」）。着陸脚で LEG_K 倍
    //   NEAR：月の 地面ちかく（エンジンを 月の重力の TWR 倍まで しぼる・ちかくの画面・着陸メーター）
    //   V_HOVER：うしろへ で この速さより おそく なったら 真上に 浮く（ホバー）。SOFT：🦵 の 勲章
    //   v0.12：天体ごと（moon／earth）。地球は 地面に たいする 速さ（地面は まわっている）。MIN_ALT より たかく とんだ あとだけ 着陸に なる
    LAND: {
      moon:  { V_DOWN: 4, V_SIDE: 3, HARD_K: 1.5, LEG_K: 2.5, TILT_MAX: 35, TILT_MAX_LEG: 50, NEAR: 2000, TWR: 3,
               V_HOVER: 1.5, HOVER_GAIN: 0.8, SLOW_SEC: 6, WARP_MIN: 0.3, WARP_MAX: 30, SOFT: 1.5 },
      earth: { V_DOWN: 5, V_SIDE: 3, HARD_K: 1.2, LEG_K: 2.5, TILT_MAX: 35, TILT_MAX_LEG: 50, NEAR: 600, TWR: 3,
               V_HOVER: 1.5, HOVER_GAIN: 0.8, SLOW_SEC: 6, WARP_MIN: 0.3, WARP_MAX: 30, SOFT: 1.5, MIN_ALT: 100 }
    },
    // v0.12 パラシュート：くうきの中で ひらく（OPEN_T 秒で ふくらむ）。くうきに たいする 速さが V_TEAR より はやいと やぶれる
    //   空気の じゃまに CD × こ数 × ひらき具合 × 空気の こさ を たす
    CHUTE: { CD: 2.2, V_TEAR: 80, OPEN_T: 1 },
    // v0.13 月往還：月からの 離陸（自動）。TURN_H まで まっすぐ、上むきの 速さ VR_MAX までで HOLD の 高さを たもって よこへ、近い ところが PE_MIN より 上で とめる。ACC＝加速の 上限（月の 重力の 何倍）
    MOON_UP: { TURN_H: 15, HOLD: 150, PE_MIN: 50, ACC: 5, VR_MAX: 10 },
    // v0.13 くうきに 入る：くうきに たいする 速さが HOT より はやい 間は 🔥 の 光（演出だけ）
    REENTRY: { HOT: 150 },
    MOON_IDLE_SEC: 60,  // v0.13：月面で なにも しないと この 秒数（実時間）で 声で さそう
    VAC_VBURN_K: 0.7,  // v0.11：うちゅうモードだけ、宇宙用エンジンは くうきの外で 燃料の へりが この割合（燃費が よい）。月着陸に 燃料が とどくように
    CHECKPOINT: { STAR_PENALTY: [0, 1, 1, 2] },   // ⏪ の 回数（0,1,2,3回〜）で へらす 星
    TURN_START: 20,    // この高さから かたむけ はじめる
    PITCH_RATE: 15,    // v0.8.2：自動で かたむける速さの上限（度／秒）。切りはなしで 急に 真上へ もどらない
    PROFILES: {        // 自動で かたむける（pitch：地平線からの角度。turnH までに そこまで倒す）
      up:   { pitch: 90, turnH: 1 },
      tilt: { pitch: 45, turnH: 220 },
      side: { pitch: 10, turnH: 300, hold: true }   // くうきの外では 高さを保ちながら 横に加速
    },
    CLIMB_V: 50,       // よこ：くうきの中で めざす 上むきの速さ
    HOLD_H: 1.3,       // よこ：くうきの外で たもつ高さ（くうきの おわり の何倍）
    HOLD_GAIN: 0.25    // よこ：くうきの外で 上下の速さを 0 に近づける強さ
  },
  // ---- v0.9 ワールド保存（改修4）
  SAVE: {
    KEY: 'rocketlab.save.v1',   // ブラウザ（localStorage）に しまう 名前
    SLOTS: 4,                   // こどもの 人数（セーブの わく）
    AVATARS: ['🐶', '🐱', '🐰', '🐼', '🦊', '🐸', '🐯', '🐨'],
    MAX_OBJS: 24,               // ワールドに のこす 衛星・はた の 数（こえたら ふるい ものから けす）
    FLEET: 3                    // 衛星を この数 うちあげたら 勲章
  },
  STAGE_COLORS: ['rgba(255,150,40,.16)', 'rgba(80,190,255,.16)', 'rgba(120,230,120,.16)', 'rgba(220,120,255,.16)']
};
RL.hPos = h => Math.log(1 + Math.max(0, h) / 40) / Math.log(1 + RL.CFG.TOP / 40);
RL._ev = {};
RL.on = (n, f) => (RL._ev[n] = RL._ev[n] || []).push(f);
RL.emit = (n, d) => (RL._ev[n] || []).slice().forEach(f => f(d));
