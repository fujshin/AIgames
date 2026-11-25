// v0.14 ミッション（うちゅうモードの チュートリアル）。docs/DESIGN_v0.14.md
//  1つの ミッション ＝ 宇宙モードで はじめて 出てくる もの 1つを おしえる
//  { id, ch, icon:[カードの 絵], say:[はじめの 声], rocket（きまった ロケット。なければ じぶんで つくる）, preset（さいしょの くみたて）,
//    allow（つかえる 部品。null＝ぜんぶ）, lock（くみたてを かえられない）, profile（はじめの 打ち上げかた）, need（この 打ち上げかたで ないと 発射 できない）,
//    start（とちゅうから：RL.Orbit の opt.start）, goal:{ tick(s,c)／done(d,s,c) }, star3(d,s,c), rewOk（⏪ を つかっても ⭐⭐）, hints:[{ t(s,c), say, hl }], help（3回 しっぱいで）, hl（くみたての 画面で 光らせる もの） }
//  c（ctx）＝ ミッション中の きろく：ui（ボタンを おした 回数）, dirs（つかった 向き）, profs（つかった 打ち上げかた）, prof, topRow, manualSep, aborts, fails
RL.Missions = (function () {
  const T = n => Array(n).fill('tank'), B = n => Array(n).fill('booster');
  const ROCKETS = {
    ORBIT: [['fin'], B(6), ['engine', ...T(4), 'ring', 'vengine+leg', ...T(3), 'win+chute', 'nose'], B(6), ['fin']],   // v0.12 の 見本（地球を まわれる）
    SMALL: [[], ['fin'], ['engine', 'tank', 'win', 'nose'], ['fin'], []],                     // ぎりぎり 宇宙（まっすぐ で 高さ 約330）
    SUB: [['fin'], B(3), ['engine', ...T(3), 'win', 'nose'], B(3), ['fin']],                  // 宇宙まで、でも まわれない
    UP: [[], [], ['vengine', ...T(3), 'win+chute', 'nose'], [], []],                          // 軌道の 上の 1段
    CAP: [[], [], ['vengine', 'tank', 'win+chute', 'nose'], [], []],                          // かるい カプセル
    LEGE: [[], [], ['engine+leg', ...T(3), 'win', 'nose'], [], []],                           // 脚つき（パラシュート なし）
    NOLEG: [[], [], ['engine', ...T(3), 'win', 'nose'], [], []],                              // v0.14.6 3-4：脚なし（あとで 脚を つける）
    SEP: [[], [], ['vengine', ...T(2), 'ring', 'win+chute', 'nose'], [], []],                 // 下の段（エンジン）＋ カプセル
    // v0.14.1：よこ なら ちきゅうを まわれる、まっすぐ だと おちてくる（tools/mission_check.js）
    FIRST: [[], ['fin'], ['engine', ...T(2), 'ring', 'vengine', 'tank', 'win', 'nose'], ['fin'], []],
    // v0.14.1：ねんりょうが たりない（タンクを 1つ のせると まわれる）
    SHORT: [[], ['fin'], ['engine', ...T(2), 'ring', 'vengine'], ['fin'], []]
  };
  const ORB = ['low', 'high'];
  const E = s => s.bodies.earth;
  const pe = s => { const el = s.elements(); return el ? el.rp - s.body.R : -1e9; };
  const ap = s => { const el = s.elements(); return el ? (el.e < 1 ? el.ra - s.body.R : 1e9) : -1e9; };
  const off = s => !s.isPowered();
  const vr = s => (s.vx * s.x + s.vy * s.y) / Math.hypot(s.x, s.y);
  const onEarth = d => d.body === 'earth';
  const ROWS = () => RL.CFG.ROWS_ORBIT;
  const sats = () => (RL.World && RL.Save && RL.Save.cur ? RL.World.counts(RL.Save.cur).sats : 0);

  const LIST = [
    // ===== 1章 うちゅうモードの きほん（v0.14.1：わざと しっぱい → なおして クリア）=====
    //  steps：じゅんばんに すすむ あんない。at＝どこで（build くみたて／fly 飛行中／result 結果）、when＝すすむ 条件、say＝声、hl＝光らせる もの
    //         need＝この 打ち上げかたで ないと 発射 しない、block＝この あんないの 間は 発射 しない、fail＝しっぱいして ほしい 結果（しっぱいに かぞえない）、rew＝結果の ⏪ を 出す
    { id: '1-1', ch: 1, quiet: true, icon: ['\u{1F30D}', '\u{1F6F0}\uFE0F'], rocket: 'FIRST', lock: true, profile: 'up', goal: { tick: s => ORB.includes(s.cls) && off(s) },
      steps: [
        { at: 'build', need: 'up', hl: 'launch', say: ['ミッション！ この ロケットで、ちきゅうの まわりを ぐるぐる まわる、じんこうえいせいを つくろう。', 'まずは、まっすぐ うえに うちあげて みよう。 あかい はっしゃ ボタンを おしてね。'] },
        { at: 'fly', when: s => s.maxAlt >= 300, say: ['てんせんを こえた！ ここから うちゅう だよ。 どこまで いくかな？'] },
        { at: 'fly', when: s => s.maxAlt > 1000 && vr(s) < 0, say: ['あれれ？ おちてきちゃう！'] },
        { at: 'result', fail: d => d.type === 'ground', hl: 'again',
          say: ['まっすぐ うえに とぶと、たかく いっても、ちきゅうに ひっぱられて おちてきちゃうんだ。', 'ちきゅうを まわるには、よこに うんと はやく とばないと いけない。', 'みどりの ボタンで もどって、やりなおそう。'] },
        { at: 'build', need: 'side', block: true, hl: 'prof', say: ['したの この ボタンで、うちあげかたを かえられるよ。 なんかいか おして、よこに たおれた ロケットの え に しよう。'] },
        { at: 'build', when: x => x.profile === 'side', hl: 'launch', say: ['それで いい！ よこに たおして とぶよ。 はっしゃ！'] },
        { at: 'fly', when: s => s.inSpace, hl: 'btnMap', say: ['うちゅうに でたら、よこに どんどん はやく なっていくよ。 ちずの せんを みてね。'] },
        { at: 'fly', when: s => ORB.includes(s.cls), say: ['せんが ちきゅうを ぐるっと かこんだ！ もう おちてこないよ。'] }
      ] },
    { id: '1-2', ch: 1, quiet: true, icon: ['\u26FD', '\u{1F6E2}\uFE0F'], rocket: 'SHORT', allow: ['tank'], profile: 'side', goal: { tick: s => ORB.includes(s.cls) && off(s) },
      steps: [
        { at: 'build', need: 'side', hl: 'launch', say: ['つぎの ミッションも、ちきゅうを まわる こと。 こんどは、よこで うちあげて みよう。 はっしゃ！'] },
        { at: 'fly', when: s => !s.isPowered() && s.maxAlt > 200, say: ['あっ、ねんりょうが なくなっちゃった！ メーターが からっぽ だ。'] },
        { at: 'result', fail: d => d.type === 'ground', hl: 'again', say: ['ねんりょうが たりなくて、ちきゅうを まわる はやさに なれなかったね。', 'タンクを ふやそう。 みどりの ボタンで もどってね。'] },
        { at: 'build', block: true, hl: 'pal:tank', cells: 'top', say: ['タンクを ひとつ、ロケットの いちばん うえに のせよう。 タンクを えらんで、ひかっている ところを タップ してね。'] },
        { at: 'build', when: (x, c) => x.tanks > c.tanks0, hl: 'launch', say: ['タンクが ふえた！ ちょっと おもく なるけど、ねんりょうが ふえるよ。 はっしゃ！'] },
        { at: 'fly', when: s => ORB.includes(s.cls), say: ['こんどは まわれた！ ねんりょうが たりない ときは、タンクを たそう。 たかく つみたい ときは、みぎの やじるしで うえを みられるよ。'] }
      ] },
    { id: '1-3', ch: 1, quiet: true, icon: ['\u{1F5FA}\uFE0F', '\u{1F50D}'], rocket: 'ORBIT', lock: true, profile: 'side',
      goal: { tick: (s, c) => (c.ui.btnMap || 0) >= 2 && ((c.ui.btnZin || 0) + (c.ui.btnZout || 0)) >= 1 }, star3: (s, c) => c.mapT0 && performance.now() - c.mapT0 <= 10000,
      steps: [
        { at: 'build', hl: 'launch', say: ['とんでいる あいだ、ちずで ロケットが どこに いるか みられるよ。 はっしゃ して、ちずを みてみよう。'] },
        { at: 'fly', when: s => s.maxAlt > 100, hl: 'btnMap', say: ['この ちずの ボタンを おしてみて。'] },
        { at: 'fly', when: (s, c) => (c.ui.btnMap || 0) >= 1, hl: 'btnZout', say: ['ちきゅうと ロケットが みえるね。 ひだりの むしめがねで、とおくを みてみよう。'] },
        { at: 'fly', when: (s, c) => (c.ui.btnZin || 0) + (c.ui.btnZout || 0) >= 1, hl: 'btnMap', say: ['ひろく みえた！ もういちど ちずの ボタンを おすと、ロケットの ちかくに もどるよ。'] }
      ] },
    // v0.14.3：⏪ で もどった あとは ✋ で ちゅうし しても クリア（abortClear）
    // v0.14.6：もどったら とめて（pause）、✋ の せつめいが おわるまで まつ。✋ を ながおし するまで うごかない（声が かさならない）
    { id: '1-4', ch: 1, quiet: true, icon: ['\u23EA', '\u270B'], rocket: 'SUB', lock: true, profile: 'tilt', rewOk: true, abortClear: true,
      goal: { done: (d, s) => (s.rewinds || 0) >= 1 }, star3: (d, s, c) => c.aborts >= 1,
      steps: [
        { at: 'build', hl: 'launch', say: ['この ロケットは、ちきゅうを まわれない ロケット。 どうなるか みてみよう。 はっしゃ！'] },
        { at: 'result', fail: (d, s) => d.type === 'ground' && !s.rewinds, hl: 'resRew', rew: true,
          say: ['おちちゃったね。 でも だいじょうぶ。', 'この くるくる もどる ボタンを おすと、おちる まえの ところから やりなおせるよ。 おしてみて！'] },
        { at: 'fly', when: s => s.rewinds >= 1, hl: 'btnAbort', pause: 'btnAbort',
          say: ['もどった！ とちゅうから つづきが できるよ。 こまったら つかってね。', 'いまは とまっているよ。 さいごに、ひかっている あかい てのひらの ボタンを みて。 これは ちゅうしの ボタン。 ながーく おすと、とぶのを やめて つくりなおせるよ。', 'ながーく おしてみよう！'] }
      ] },
    // ===== 2章 ちきゅうを まわる（v0.14.4：5こに 見なおし。1つに 1つ）=====
    //  2-1 エンジンを とめる・🏁／2-2 まえへ・▲／2-3 うしろへ／2-4 ▲で まえへ・▼・まんまる／2-5 まとめ
    //  v0.14.6：pause＝とめて 話す（'speech' 声が おわるまで／ボタンの id おすまで）、end＝声の あとで 飛行を おわらせる
    //           ▼▲ は 声では「みどりの さんかく」「きいろの さんかく」（audio.js）
    { id: '2-1', ch: 2, quiet: true, icon: ['\u{1F525}', '\u{1F3C1}'], rocket: 'ORBIT', lock: true, profile: 'side', dvRate: 25,
      goal: { done: (d, s, c) => d.type === 'orbit' && onEarth(d) && (c.ui.btnEng || 0) >= 1 }, star3: (d, s, c) => (c.cutFuel || 0) >= 0.35,
      steps: [
        { at: 'build', hl: 'launch', say: ['ちきゅうを まわったら、エンジンは どうすれば いいかな？', 'まずは なにも おさずに、ずっと とばして みよう。 はっしゃ！'] },
        { at: 'fly', when: s => ORB.includes(s.cls), say: ['ちきゅうを まわる みどりの せんに なったよ。 でも、エンジンは もえた まま…'] },
        { at: 'fly', when: s => s.cls === 'toMoon' || s.cls === 'escape', pause: 'speech',
          say: ['ここで いったん ストップ。 みどりの せんが ぐーんと のびて、つきの きどうまで とどいたよ！', 'このまま もやしつづけると、どうなるかな？'] },
        { at: 'fly', when: s => s.cls === 'escape', pause: 'speech', end: 'escape',
          say: ['むらさきの せんに なった！ ちきゅうから とびだしちゃう はやさ だよ。'] },
        { at: 'result', fail: (d, s, c) => !(c.ui.btnEng >= 1) && d.type !== 'abort', hl: 'again',
          say: ['エンジンを つけっぱなし だと、どんどん はやく なって、ちきゅうから とびだしちゃうんだ。', 'みどりの せんに なったら、ほのおの ボタンで エンジンを とめよう。 みどりの ボタンで もういちど。'] },
        { at: 'build', hl: 'launch', say: ['こんどは、みどりの せんに なったら とめるよ。 はっしゃ！'] },
        { at: 'fly', when: s => ORB.includes(s.cls) && s.isPowered(), hl: 'btnEng', pause: 'btnEng', say: ['みどりに なった！ いったん ストップ。 いまだ、ひかっている ほのおの ボタンで とめよう！'] },
        { at: 'fly', when: s => ORB.includes(s.cls) && off(s), hl: 'btnDone', say: ['とまった！ もう ずっと まわりつづけるよ。', 'ゴールの はたで おわると、ロケットは えいせいに なって、ワールドに のこるよ。'] }
      ], help: 'みどりの せんに なったら、すぐ とめると ねんりょうが のこるよ。' },
    { id: '2-2', ch: 2, quiet: true, icon: ['\u23E9', '\u25B2'], rocket: 'UP', start: { orbit: { pe: 500, ap: 600 } },
      goal: { tick: (s, c) => off(s) && (c.ui.btnEng || 0) >= 2 && ap(s) >= 2000 }, star3: s => s.cls === 'high',
      steps: [
        { at: 'fly', hl: 'btnEng', pause: 'btnEng',
          say: ['いま、ちきゅうを まわっているよ。 ロケットが いるのは、ちきゅうに いちばん ちかい ▼ の ところ。', 'ちきゅうの ちょうど はんたいがわに ある ▲ は、いちばん とおい ところ だよ。',
            'すすむ むきに エンジンを つけると、ロケットの はんたいがわ、▲ の たかさが あがるんだ。 ほのおの ボタンを おしてみて。'] },
        { at: 'fly', when: s => s.isPowered() && ap(s) >= 900, pause: 'speech',
          say: ['ちょっと ストップ。 みて！ ロケットの はんたいがわの ▲ が、とおく なってきたね。', '▲ の かずが 2000 を こえたら とめよう。'] },
        { at: 'fly', when: s => s.isPowered() && ap(s) >= 2000, hl: 'btnEng', say: ['2000 を こえた！ とめよう！'] }
      ], help: 'もっと ながく つけると、たかい きどうに なるよ。' },
    { id: '2-3', ch: 2, quiet: true, icon: ['\u23EA', '\u25B2'], rocket: 'UP', start: { orbit: { pe: 500, ap: 6000 } },
      goal: { tick: (s, c) => off(s) && c.dirs.has('retro') && ap(s) <= 3000 && pe(s) >= 300 }, star3: s => ap(s) <= 1500,
      steps: [
        { at: 'fly', hl: 'btnDir', pause: 'btnDir',
          say: ['こんどは ▲ が とおすぎる。 ▲ を ちかく したいね。', 'ロケットが いるのは ▼ の ところ。 ▲ の ちょうど はんたいがわ だよ。',
            'ここで うしろむきに ふかすと、はんたいがわの ▲ が さがるんだ。 むきの ボタンを おして、ロケットを うしろむき に しよう。'] },
        { at: 'fly', when: (s, c) => c.dirs.has('retro'), hl: 'btnEng', pause: 'btnEng', say: ['うしろむき に なった。 エンジンを つけると ブレーキに なるよ。 はんたいがわの ▲ を みててね。 ほのおの ボタン！'] },
        { at: 'fly', when: s => s.isPowered() && ap(s) <= 2000, hl: 'btnEng', pause: 'btnEng', say: ['ストップ！ ▲ が ちかく なった。 ほのおの ボタンで とめよう。'] }
      ], help: 'ながく つけすぎると、ちきゅうに おちちゃうよ。' },
    { id: '2-4', ch: 2, quiet: true, icon: ['\u25BC', '\u2B55'], rocket: 'UP', start: { orbit: { pe: 500, ap: 3000 } },
      goal: { tick: (s, c) => off(s) && (c.ui.btnEng || 0) >= 2 && ap(s) - pe(s) <= 300 && pe(s) >= 300 }, star3: s => ap(s) - pe(s) <= 100,
      steps: [
        { at: 'fly', pause: 'speech',
          say: ['▼ は ちきゅうに いちばん ちかい ところ。 いまは たまごがた の きどう だね。', 'こんどは ▼ を もちあげて、まんまるに したい。',
            '▼ の ちょうど はんたいがわ、▲ の ところで まえに ふかすと、▼ が あがるよ。 ロケットが ▲ に つくまで まとう。'] },
        // v0.14.7：▲ を すぎた ところ（上むきの 速さが 0）で とめる。▲ の 手前だと 上むきの 速さが のこって まんまるに ならない
        { at: 'fly', when: s => vr(s) <= 0 && Math.hypot(s.x, s.y) - 12000 > ap(s) - 100, hl: 'btnEng', pause: 'btnEng',
          say: ['▲ に ついた！ いったん ストップ。 ここで ふかすと、はんたいがわの ▼ が あがるよ。 ほのおの ボタンを おそう！'] },
        { at: 'fly', when: s => s.isPowered() && ap(s) - pe(s) <= 80, hl: 'btnEng', pause: 'btnEng', say: ['ストップ！ ▼ と ▲ が おなじ くらいに なった。 まんまるだ！ ほのおの ボタンで とめよう！'] }
      ], help: 'はやおくりで ▲ まで まって、そこで エンジンを つけよう。' },
    { id: '2-5', ch: 2, icon: ['\u{1F6E0}\uFE0F', '\u{1F6F0}\uFE0F'], preset: null, allow: null, hl: 'launch',
      say: ['さいごは、じぶんで ロケットを つくって、ちきゅうを まわろう！', 'ゴールの はたで おわったら クリア だよ。'],
      goal: { done: d => d.type === 'orbit' && onEarth(d) }, star3: (d, s) => s.fuelAll() >= 0.15,
      help: 'ブースターと、2だんの ロケットが おすすめ だよ。' },
    // ===== 3章 ちきゅうに かえる =====
    // v0.14.4：パラシュートなしで わざと しっぱい → まどに つけて もういちど
    // v0.14.6：パラシュートが ひらいたら とめて、ひだりの 着陸メーター（あか・きいろ・みどり）を せつめい
    { id: '3-1', ch: 3, quiet: true, icon: ['\u{1F9F7}', '\u{1FA82}'], preset: 'SMALL', allow: ['chute'], profile: 'up', need: 'up',
      goal: { done: d => d.type === 'landed' && onEarth(d) && d.chute },
      steps: [
        { at: 'build', hl: 'launch', say: ['ちいさな ロケットで、うちゅうの いりぐちまで いって、ちきゅうに かえって こよう。', 'まっすぐ うえに はっしゃ！'] },
        { at: 'fly', when: s => s.maxAlt > 100 && vr(s) < 0, say: ['おちてきた！ だいじょうぶ かな？'] },
        { at: 'result', fail: d => d.type === 'ground', hl: 'again',
          say: ['どーん！ はやすぎて、じめんに ぶつかっちゃった。', 'ゆっくり おりるには、どうしたら いいかな？ そう、パラシュート！ みどりの ボタンで もどろう。'] },
        { at: 'build', block: true, hl: 'pal:chute', cells: 'win', say: ['パラシュートは、まどに つける ぶひん。 パラシュートを えらんで、ひかっている まどを タップ してね。'] },
        { at: 'build', when: x => x.grid.some(r => r.some(k => RL.has(k, 'chute'))), hl: 'launch', say: ['まどに パラシュートが ついた！ もういちど まっすぐ うえに はっしゃ！'] },
        { at: 'fly', when: s => s.maxAlt > 100 && vr(s) < 0 && s.chutes() && s.alt() < 250, hl: 'btnChute', say: ['おちてきた！ いまだ、ひかっている パラシュートの ボタンを おそう！'] },
        { at: 'fly', when: s => !!s.chute, pause: 'speech',
          say: ['ひらいた！ ここで ちょっと ストップ。 ひだりの いろの メーターを みてね。', 'しろい さんかくは、いま じめんに ついたら どのくらいの はやさか を おしえてくれるよ。',
            'みどりは ふんわり、きいろは あぶない、あかは どーん！ いまは みどりの ところ だね。 ふわふわ おりていくよ。'] }
      ], help: 'おちて きたら、パラシュートの ボタンを おしてね。' },
    // v0.14.6：たかい ところ（2000）から はじめて、はじめに とめて せつめい。ふだんの「じめんが ちかいよ」は ださない（quiet）
    { id: '3-2', ch: 3, quiet: true, icon: ['\u{1F4A8}', '\u{1FA82}'], rocket: 'CAP', start: { h: 2000, vDown: 0, fuel: 0 },
      say: ['いま、たかい ところから おちていく ところ だよ。 パラシュートで ちきゅうに おりよう。', 'でも、はやすぎる ときに ひらくと、やぶれちゃう。', 'てんせんの したの くうきで、ゆっくりに なるまで まって ひらこう。'],
      goal: { done: d => d.type === 'landed' && onEarth(d) && d.chute }, star3: (d, s, c) => (c.ui.btnChute || 0) === 1,        // v0.14.7：メーターが でたら（地面ちかく）とめて せつめい。ひらく ときも とめて まつ
        hints: [{ t: s => s.near, pause: 'speech', say: 'ストップ。 ひだりに メーターが でたよ。 いまは しろい さんかくが あかい ところ。 はやすぎて、いま ひらくと やぶれちゃう。 てんせんの したの くうきで、だんだん ゆっくりに なるよ。' },
                { t: s => s.alt() < 110, pause: 'btnChute', say: 'いまだ！ ゆっくりに なった。 パラシュートの ボタンを おそう！', hl: 'btnChute' }],
      help: 'じめんの ちかくまで まってから おそう。' },
    { id: '3-3', ch: 3, quiet: true, icon: ['\u{1F6F0}\uFE0F', '\u{1F3E0}'], rocket: 'CAP', start: { orbit: { pe: 400, ap: 500 } },
      say: ['ちきゅうを まわっている ところから、かえろう。', 'うしろむき に して エンジンを つけると、▼ が さがるよ。 ▼ が くうきに はいったら、エンジンを とめて まとう。', 'さいごは パラシュート！'],
      goal: { done: d => d.type === 'landed' && onEarth(d) }, star3: d => (d.maxG || 99) <= 20,
      hints: [{ t: () => true, say: 'むきの ボタンで うしろむき に しよう。', hl: 'btnDir' },
              { t: (s, c) => c.dirs.has('retro'), say: 'エンジンを つけよう。', hl: 'btnEng' },                { t: (s, c) => (c.ui.btnEng || 0) >= 1 && pe(s) < (s.isPowered() ? 200 : 300), pause: s => (s.isPowered() ? 'btnEng' : null), say: 'ストップ！ ▼ が くうきに はいった！ エンジンは とめて おこう。', hl: 'btnEng' },
                { t: s => s.near, pause: 'speech', say: 'くうきに はいったよ！ ひだりに メーターが でたね。 しろい さんかくが みどりの ところに くれば、ふんわり おりられるよ。 いまは あか。 くうきで ゆっくりに なるのを まとう。' },
                { t: s => s.alt() < 300 && s.chutes() && !s.chute && Math.hypot(s.vx + E(s).rot * s.y, s.vy - E(s).rot * s.x) < 76, pause: 'btnChute', say: 'ゆっくりに なった！ いまだ、パラシュート！', hl: 'btnChute' }],
        help: 'うしろむき で すこし ふかして、▼ を くうきの なかに いれよう。' },
    // v0.14.6：はじめて 着陸脚。脚なしで エンジン着陸（たいてい こわれる）→ 脚を エンジンに つけて もういちど（メーターの みどりが ひろがる）
    //   startBuild：とちゅうから はじまるが、しっぱいの あとは くみたて画面で 脚を つけられる
    { id: '3-4', ch: 3, quiet: true, icon: ['\u{1F9B5}', '\u{1F525}'], rocket: 'NOLEG', allow: ['leg'], startBuild: true, start: { h: 1500, vDown: 20, fuel: 1 },
      goal: { done: d => d.type === 'landed' && onEarth(d) && !d.chute },
      steps: [
        { at: 'fly', pause: 'speech',          say: ['こんどは パラシュートが ない ロケット。 エンジンで ブレーキを かけて、ゆっくり おりよう。'] },
        { at: 'fly', hl: 'btnDir', pause: 'btnDir', say: ['まず、むきの ボタンで うしろむき に しよう。'] },
        // v0.14.7：メーターが でてから（地面ちかく）せつめい
        { at: 'fly', when: s => s.near, pause: 'speech',
          say: ['ストップ。 ひだりに メーターが でたよ。 しろい さんかくが みどりの ところで じめんに つけば、ぶじに おりられる。', 'みどりの ところが せまいね。 あしが ない ロケットは、すこし はやいだけで こわれちゃうんだ。'] },
        { at: 'fly', when: s => s.alt() < 520, hl: 'btnEng', pause: s => (s.isPowered() ? null : 'btnEng'), say: ['ストップ！ いまだ、ほのおの ボタンで ブレーキ！ つけた ままに しておいてね。'] },
        { at: 'result', fail: (d, s) => d.type === 'ground' && !s.legs().n, hl: 'again',
          say: ['どーん！ エンジンで ゆっくりに なったけど、あしが ないと、それでも はやすぎて こわれちゃうんだ。', 'ロケットに あしを つけてみよう。 みどりの ボタンで もどってね。'] },
        { at: 'build', block: true, hl: 'pal:leg', cells: 'engine', say: ['あしを えらんで、ひかっている エンジンを タップ してね。 あしは エンジンに つける ぶひん だよ。'] },
        { at: 'build', when: x => x.grid.some(r => r.some(k => RL.has(k, 'leg'))), hl: 'launch', say: ['あしが ついた！ はっしゃ ボタンで、さっきと おなじ ところから はじめるよ。'] },        { at: 'fly', hl: 'btnDir', pause: 'btnDir', say: ['あしの ついた ロケットで もういちど。 うしろむき に しよう。'] },
        { at: 'fly', when: s => s.near, pause: 'speech',
          say: ['メーターが でた！ みて、あしが あると、みどりの ところが ひろく なったね。', 'あしは じめんの ちかくで ひらいて、ふんわり うけとめて くれるよ。 すこし はやくても だいじょうぶ。'] },
        { at: 'fly', when: s => s.alt() < 520, hl: 'btnEng', pause: s => (s.isPowered() ? null : 'btnEng'), say: ['いまだ！ ほのおの ボタンで ブレーキ！ さっきと おなじ ように つけた まま だよ。'] }
      ], help: 'はやく おちる まえに、すこし はやめに エンジンを つけよう。' },
    // v0.14.6：はじめに パラシュートの 話は しない。きりはなした あとに せつめい
    { id: '3-5', ch: 3, quiet: true, icon: ['\u2702\uFE0F', '\u{1FA82}'], rocket: 'SEP', start: { orbit: { pe: 400, ap: 450 }, stages: 2 },
      say: ['エンジンを とめている ときは、はさみの ボタンで いらない だんを すてられるよ。 2かい おしてね。', 'うしろむき で ふかして ▼ を くうきに いれたら、したの だんを すてよう。', 'くうきに はいる まえに すてられたら ほしみっつ。'],
      goal: { done: (d, s, c) => d.type === 'landed' && onEarth(d) && d.chute && c.manualSep >= 1 }, star3: (d, s, c) => c.sepAlt > 300,
      hints: [{ t: () => true, say: 'むきの ボタンで うしろむき に しよう。', hl: 'btnDir' },
              { t: (s, c) => c.dirs.has('retro'), say: 'エンジンを つけよう。', hl: 'btnEng' },                { t: (s, c) => (c.ui.btnEng || 0) >= 1 && pe(s) < (s.isPowered() ? 200 : 300), pause: s => (s.isPowered() ? 'btnEng' : null), say: 'ストップ！ ▼ が くうきに はいった！ エンジンは とめて おこう。', hl: 'btnEng' },
                { t: (s, c) => off(s) && pe(s) < 250 && (s.canSep() || c.manualSep >= 1), say: 'はさみを 2かい おして、したの だんを すてよう！', hl: 'btnSep' },                { t: (s, c) => c.manualSep >= 1, pause: 'speech', say: 'したの だんを すてたね！ まど だけ だと、はやすぎて じめんに ぶつかっちゃう。 くうきで ゆっくりに なったら、パラシュートを ひらこう。' },
                { t: s => s.near, pause: 'speech', say: 'くうきに はいったよ！ ひだりに メーターが でたね。 しろい さんかくが みどりの ところに くれば、ふんわり おりられるよ。 いまは あか。 くうきで ゆっくりに なるのを まとう。' },
                { t: s => s.alt() < 300 && s.chutes() && !s.chute && Math.hypot(s.vx + E(s).rot * s.y, s.vy - E(s).rot * s.x) < 76, pause: 'btnChute', say: 'ゆっくりに なった！ いまだ、パラシュート！', hl: 'btnChute' }],
      help: 'エンジンを とめてから、はさみを 2かい つづけて おしてね。' }
  ];
  const CHAPTERS = [
    { ch: 1, icon: '\u{1F680}', medal: 'mis1' }, { ch: 2, icon: '\u{1F6F0}\uFE0F', medal: 'mis2' }, { ch: 3, icon: '\u{1FA82}', medal: 'mis3' }
  ];
  const byId = id => LIST.find(m => m.id === id);
  const toGrid = cols => { const R = RL.CFG.ROWS_ORBIT, C = RL.CFG.COLS, g = Array.from({ length: R }, () => Array(C).fill(null)); (cols || []).forEach((s, c) => s.slice(0, R).forEach((k, i) => { g[R - 1 - i][c] = k; })); return g; };
  const gridOf = m => toGrid(ROCKETS[m.rocket || m.preset] || []);
  // ⭐：クリア ⭐1、⏪ なし（rewOk なら いつでも）⭐2、star3 も ⭐3（star3 が なければ ⭐2 で ⭐3）
  function stars(m, ok2, ok3) { return 1 + (ok2 ? 1 : 0) + (ok2 && (!m.star3 || ok3) ? 1 : 0); }
  // ---- ミッション中の きろく ----
  const newCtx = () => ({ ui: {}, dirs: new Set(), profs: new Set(), prof: null, topRow: 99, manualSep: 0, sepAlt: 0, aborts: 0, fails: 0, cleared: null, mapT0: 0, cutFuel: 0,
    si: 0, siLaunch: 0, cur: null, tanks0: 0 });
  const M = { LIST, CHAPTERS, ROCKETS, byId, gridOf, toGrid, stars, active: null, ctx: null };
  const countTanks = g => g.reduce((z, r) => z + r.filter(k => RL.base(k) === 'tank').length, 0);
  // steps が ない ミッション（2・3章）：はじめの 声 ＋ hints を じゅんばんの あんないに する
  function stepsOf(m) {
    if (m.steps) return m.steps;
    const st = [{ at: m.start ? 'fly' : 'build', say: m.say, hl: m.start ? null : (m.hl || 'launch'), pause: m.start ? 'speech' : undefined }];   // v0.14.6：とちゅうから はじまる ときは とめて せつめい
    if (m.build) m.build.forEach(b => st.push(b));
    (m.hints || []).forEach(h => st.push({ at: 'fly', when: h.t, say: [h.say], hl: h.hl, pause: h.pause, end: h.end }));
    return (m.steps = st);
  }
  // ---- 光らせる（つぎの あんないまで ずっと）----
  let hlEls = [];
  M.setHl = (spec, m) => {
    if (typeof document === 'undefined') return;
    hlEls.forEach(e => e.classList.remove('mhint')); hlEls = [];
    if (RL.Builder && RL.Builder.highlightCell) RL.Builder.highlightCell(null);
    if (!spec) return;
    const els = spec.startsWith('pal:') ? [document.querySelector(`.pal[data-k="${spec.slice(4)}"]`)] : [document.getElementById(spec)];
    els.filter(Boolean).forEach(e => { e.classList.add('mhint'); hlEls.push(e); });
  };
  // くみたての 画面で 光らせる マス（cells: 'top' ＝ まんなかの 列の いちばん うえの 上）
  function hlCells(st) {
    if (!st || !st.cells || !RL.Builder) return;
    const g = RL.Builder.grid; let top = g.length; g.forEach((r, i) => { if (r[2] && i < top) top = i; });
    if (st.cells === 'engine') { const w = []; g.forEach((r, i) => r.forEach((k, j) => { if (RL.ENGINES[k]) w.push([i, j]); })); if (w.length) RL.Builder.highlightCell(w); return; }   // v0.14.6
    if (st.cells === 'win') { const w = []; g.forEach((r, i) => r.forEach((k, j) => { if (RL.base(k) === 'win') w.push([i, j]); })); if (w.length) RL.Builder.highlightCell(w); return; }
    if (top > 0) RL.Builder.highlightCell([top - 1, 2]);
  }
  M.begin = m => { M.active = m; M.ctx = newCtx(); stepsOf(m); return M.ctx; };
  M.end = () => { M.setHl(null); M.active = null; M.ctx = null; };
  M.current = () => (M.ctx ? M.ctx.cur : null);
  // つぎの あんないに すすむか しらべる。すすんだら その あんないを かえす（1回に 1つ）
  M.poll = (at, x) => {
    const m = M.active, c = M.ctx; if (!m || !c) return null;
    const st = m.steps[c.si]; if (!st || st.at !== at) return null;
    if (at === 'result') { if (!(st.fail && st.fail(x.d, x.sim, c))) return null; }
    else if (st.when && !st.when(x, c)) return null;
    c.si++; c.cur = st; M.setHl(st.hl, m); hlCells(st);
    return st;
  };
  M.pollAll = (at, x) => { const out = []; let st; while ((st = M.poll(at, x))) { out.push(st); if (st.pause) break; } return out; };   // v0.14.6：とめる あんないで いったん おわり
  // いま もとめている 打ち上げかた（さいごに すすんだ あんないの need）
  M.need = () => { const m = M.active, c = M.ctx; if (!m) return null; for (let i = c.si - 1; i >= 0; i--) if (m.steps[i].need) return m.steps[i].need; return m.need || null; };
  // 発射の とき：true か、だめな わけ（{ say, hl }）
  M.onLaunch = (grid, profile) => {
    const m = M.active, c = M.ctx; if (!m) return true;
    const need = M.need(), cur = c.cur;
    if (cur && cur.block && cur.at === 'build') return { say: cur.say, hl: cur.hl };
    if (need && profile !== need) return { need };
    c.prof = profile; c.profs.add(profile);
    c.topRow = 99; grid.forEach((row, r) => { if (row.some(Boolean)) c.topRow = Math.min(c.topRow, r); });
    c.ui = {}; c.aborts = 0; c.dirs = new Set(['pro']); c.cleared = null; c.manualSep = 0; c.sepAlt = 0; c.mapT0 = 0; c.cutFuel = 0; c.siLaunch = c.si;
    return true;
  };
  M.buildInfo = (grid, profile) => ({ grid, profile, tanks: countTanks(grid) });
  M.ui = id => { const c = M.ctx; if (!c) return; c.ui[id] = (c.ui[id] || 0) + 1; if (id === 'btnMap' && !c.mapT0) c.mapT0 = performance.now(); };
  M.event = (e, s) => {
    const c = M.ctx; if (!c) return;
    if (e.type === 'dir') c.dirs.add(e.dir);
    if (e.type === 'stage-sep' && e.manual) { c.manualSep++; if (!c.sepAlt) c.sepAlt = Math.hypot(s.x, s.y) - s.body.R; }
  };
  // 毎こま：あんない と、とちゅうで クリア（tick）。もどり値：あんない の ならび、クリアは { clear: true }
  M.tick = s => {
    const m = M.active, c = M.ctx; if (!m || !c || s.done) return [];
    if (!c.cutFuel && ORB.includes(s.cls) && !s.isPowered() && (c.ui.btnEng || 0) >= 1) c.cutFuel = s.fuelRatio();
    const out = M.pollAll('fly', s);
    if (!c.cleared && m.goal.tick && m.goal.tick(s, c)) { c.cleared = { s3: !!(m.star3 && m.star3(s, c)) }; out.push({ clear: true }); }
    return out;
  };
  // しっぱいの あと：その 飛行の はじめの あんないに もどす
  M.retry = () => { const c = M.ctx; if (!c) return; c.si = c.siLaunch; const m = M.active; c.cur = c.si > 0 ? m.steps[c.si - 1] : null; if (c.cur) { M.setHl(c.cur.hl, m); hlCells(c.cur); } };
  // 結果：{ clear, stars }
  M.judge = (s, d) => {
    const m = M.active, c = M.ctx; if (!m) return null;
    let clear = false, s3 = false;
    if (c.cleared) { clear = true; s3 = c.cleared.s3; }
    else if (m.goal.done && d && m.goal.done(d, s, c)) { clear = true; s3 = !!(m.star3 && m.star3(d, s, c)); }
    const ok2 = m.rewOk || !(s.rewinds > 0);
    if (!clear) c.fails++;
    return { clear, stars: clear ? stars(m, ok2, s3) : 0 };
  };
  M.countTanks = countTanks;
  // ひらいているか（ひとつ まえの ミッションが ⭐1 いじょう）
  M.unlocked = (rec, id) => { const i = LIST.findIndex(m => m.id === id); return i <= 0 || (rec[LIST[i - 1].id] || 0) >= 1; };
  M.chapterDone = (rec, ch) => LIST.filter(m => m.ch === ch).every(m => (rec[m.id] || 0) >= 1);
  return M;
})();
