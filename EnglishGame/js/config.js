// =====================================================================
// えいたんクエスト 地方・モンスターの設定
// 単語データは js/words_学年.js に入っています（まだの学年は「準備中」になります）
// =====================================================================
const WORDS = {};
const GRADES = [
  { id: 'j1', name: '中1', region: 'はじまりの草原', color: ['#a7f3d0', '#059669'],
    monsters: [{ id: 'j1_1', name: 'ぷるスライム', emoji: '🐌' }, { id: 'j1_2', name: 'けろガエル', emoji: '🐸' }, { id: 'j1_3', name: 'ちょろネズミ', emoji: '🐭' }, { id: 'j1_4', name: 'とげハリネズミ', emoji: '🦔' }],
    boss: { id: 'j1_boss', name: '草原のおおかみ王', emoji: '🐺' } },
  { id: 'j2', name: '中2', region: 'ささやきの森', color: ['#bbf7d0', '#15803d'],
    monsters: [{ id: 'j2_1', name: 'まよいキノコ', emoji: '🍄' }, { id: 'j2_2', name: 'もりフクロウ', emoji: '🦉' }, { id: 'j2_3', name: 'くねくねヘビ', emoji: '🐍' }, { id: 'j2_4', name: 'いたずらギツネ', emoji: '🦊' }],
    boss: { id: 'j2_boss', name: '森のぬし ビッグベア', emoji: '🐻' } },
  { id: 'j3', name: '中3', region: 'かぜの山道', color: ['#fde68a', '#b45309'],
    monsters: [{ id: 'j3_1', name: 'やまコウモリ', emoji: '🦇' }, { id: 'j3_2', name: 'いのしし番兵', emoji: '🐗' }, { id: 'j3_3', name: 'いわサソリ', emoji: '🦂' }, { id: 'j3_4', name: 'こけカメ', emoji: '🐢' }],
    boss: { id: 'j3_boss', name: '峠の獅子王', emoji: '🦁' } },
  { id: 'h1', name: '高校 基礎', level: 'レベル1・共通テストの土台', region: 'みずうみの城下町', color: ['#bae6fd', '#0369a1'],
    monsters: [{ id: 'h1_1', name: 'みずタコ', emoji: '🐙' }, { id: 'h1_2', name: 'よろいガニ', emoji: '🦀' }, { id: 'h1_3', name: 'ぷくフグ', emoji: '🐡' }, { id: 'h1_4', name: 'すみイカ', emoji: '🦑' }],
    boss: { id: 'h1_boss', name: 'みずうみのワニ将軍', emoji: '🐊' } },
  { id: 'h2', name: '高校 標準', level: 'レベル2・共通テスト〜中堅大', region: 'ほのおの砂漠', color: ['#fecaca', '#b91c1c'],
    monsters: [{ id: 'h2_1', name: 'すなトカゲ', emoji: '🦎' }, { id: 'h2_2', name: 'さばくラクダ', emoji: '🐪' }, { id: 'h2_3', name: 'とげサボテン', emoji: '🌵' }, { id: 'h2_4', name: 'しんきろうゴースト', emoji: '👻' }],
    boss: { id: 'h2_boss', name: '砂漠の炎竜', emoji: '🐉' } },
  { id: 'h3', name: '高校 発展', level: 'レベル3・難関大', region: 'ほしの神殿', color: ['#ddd6fe', '#4c1d95'],
    monsters: [{ id: 'h3_1', name: 'ほしくずインベーダー', emoji: '👾' }, { id: 'h3_2', name: 'しんでんゴーレム', emoji: '🤖' }, { id: 'h3_3', name: 'まよいオニ', emoji: '👹' }, { id: 'h3_4', name: 'ねむりミイラ', emoji: '🧟' }],
    boss: { id: 'h3_boss', name: '星詠みの神竜', emoji: '🐲' } }
];
const TEST_ENEMY = { id: 'test', name: 'ためしの水晶', emoji: '🔮' };
const REVIEW_ENEMY = { id: 'review', name: 'わすれんぼうの影', emoji: '🌫️' };
