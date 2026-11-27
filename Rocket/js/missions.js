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
    SHORT: [[], ['fin'], ['engine', ...T(2), 'ring', 'vengine'], ['fin'], []],
      // v0.16 4-7：まんなか だけでは つきの たかさに とどかない（よこに エンジン＋タンク2 を ならべると とどく。tools/mission_check.js）
    // v0.17 5章：月着陸の 1段（宇宙用＋脚）、地上から 月に おりる 見本（landing_check の 見本）
    LANDER: [[], [], ['vengine+leg', ...T(3), 'win', 'nose'], [], []],
    MOONSHIP: [['fin'], B(5), ['engine', ...T(3), 'ring', 'vengine+leg', ...T(2), 'win', 'nose'], B(5), ['fin']],
    POD0: [[], ['fin'], ['engine', ...T(2), 'ring', 'vengine', 'tank', 'win+chute', 'nose'], ['fin'], []],
      // v0.19 6章：月に おりる 段（脚）＋ かえる 段（まど🪂）／かえる とちゅうの 段＋カプセル／月往還の 見本（3段3列。tools/return_check.js）
      ASC: [[], [], ['vengine+leg', ...T(2), 'ring', 'vengine', 'tank', 'win+chute'], [], []],
      RET: [[], [], ['vengine', 'tank', 'ring', 'win+chute', 'nose'], [], []],
      TRIP: [[...B(4), 'fin'], ['engine', ...T(4), 'ring', 'vengine', ...T(2)], ['engine', ...T(4), 'ring', 'vengine', ...T(2), 'ring', 'vengine+leg', ...T(3), 'win+chute'], ['engine', ...T(4), 'ring', 'vengine', ...T(2)], [...B(4), 'fin']]
  };
  const ORB = ['low', 'high'];  const E = s => s.bodies.earth, TAU = Math.PI * 2;
const pe = s => { const el = s.elements(); return el ? el.rp - s.body.R : -1e9; };
  const ap = s => { const el = s.elements(); return el ? (el.e < 1 ? el.ra - s.body.R : 1e9) : -1e9; };
  const off = s => !s.isPowered();
  const vr = s => (s.vx * s.x + s.vy * s.y) / Math.hypot(s.x, s.y);
  const onEarth = d => d.body === 'earth';
  const ROWS = () => RL.CFG.ROWS_ORBIT;  // v0.15：4章の 下しらべ（予測は おもい ので 6こまに 1回）
  const LEAD = 0.06;   // ふかす しるしの すこし 手前で とめる（ふかす 間に すすむ ぶん）
  const encNow = (s, c) => { c.encK = (c.encK || 0) + 1; if (c.encK % 6) return !!c.encLast; const e = M.encInfo(s); c.encLast = e.enc && !e.hit; if (c.encLast) c.enc = true; return c.encLast; };
  const hitNow = s => M.encInfo(s).hit;
    // v0.19 6章：かえれる せん（予測の 🏠）。予測は おもい ので 6こまに 1回
    const homeNow = (s, c) => { c.homeK = (c.homeK || 0) + 1; if (c.homeK % 6 && c.homeLast != null) return c.homeLast; const p = RL.Predict.fromSim(s); return (c.homeLast = !!(p && p.home)); };
    const wind = s => Math.hypot(s.vx + E(s).rot * s.y, s.vy - E(s).rot * s.x);
  // v0.17：いまから エンジンで とまれる ぎりぎりの すこし 手前（月の 地面ちかく）
  const brakeNow = s => { if (!s.near || s.surface) return false; const v = Math.max(0, -s.relVel().vr), a = Math.max(0.1, s.brakeAcc()); return v > 1 && v * v / (2 * a) > s.alt() * 0.85; };
  // v0.16：よこの 段の 数（seg＝たての ながさ 以上）
  const podCount = (g, seg) => { try { return RL.analyze(g).stacks.filter(x => x.pod && x.seg >= seg).length; } catch (e) { return 0; } };
  const sats = () => (RL.World && RL.Save && RL.Save.cur ? RL.World.counts(RL.Save.cur).sats : 0);

  const LIST = [
    // ===== 1章 うちゅうモードの きほん（v0.14.1：わざと しっぱい → なおして クリア）=====
    //  steps：じゅんばんに すすむ あんない。at＝どこで（build くみたて／fly 飛行中／result 結果）、when＝すすむ 条件、say＝声、hl＝光らせる もの
    //         need＝この 打ち上げかたで ないと 発射 しない、block＝この あんないの 間は 発射 しない、fail＝しっぱいして ほしい 結果（しっぱいに かぞえない）、rew＝結果の ⏪ を 出す
    { id: '1-1', ch: 1, quiet: true, icon: ['\u{1F30D}', '\u{1F6F0}\uFE0F'], rocket: 'FIRST', lock: true, profile: 'up', goal: { tick: s => ORB.includes(s.cls) && off(s) },
      steps: [
        { at: 'build', need: 'up', hl: 'launch', say: ['ミッション！ この ロケットで、ちきゅうの まわりを ぐるぐる まわる、じんこうえいせいを つくろう。', 'まずは、まっすぐ うえに うちあげて みよう。 あかい はっしゃ ボタンを おしてね。'] },
        // v0.18：てんせん（くうきの おわり）と、ちずの てんせん（これから とぶ みち。オレンジ＝おちる、みどり＝まわる）を せつめい
        { at: 'fly', when: s => s.maxAlt >= 300, pause: 'speech',
          say: ['ストップ。 みずいろの てんせんを こえたね。 この てんせんは、くうきの おわり。 ここから うえが うちゅう だよ。'] },
        { at: 'fly', when: s => s.maxAlt >= 450, pause: 'speech',
          say: ['ちずに なったよ。 ロケットから のびている てんせんは、これから ロケットが とんでいく みち だよ。',
            'オレンジの てんせんは、ちきゅうに おちてくる みち。 みどりの てんせんに なると、ちきゅうを ぐるぐる まわれるんだ。', 'いまは オレンジ だね。 どうなるかな？'] },
        { at: 'fly', when: s => s.maxAlt > 1000 && vr(s) < 0, say: ['あれれ？ オレンジの みちの とおり、おちてきちゃう！'] },
        { at: 'result', fail: d => d.type === 'ground', hl: 'again',
          say: ['まっすぐ うえに とぶと、たかく いっても、ちきゅうに ひっぱられて おちてきちゃうんだ。', 'ちきゅうを まわるには、よこに うんと はやく とんで、てんせんを みどりに しないと いけない。', 'みどりの ボタンで もどって、やりなおそう。'] },
        { at: 'build', need: 'side', block: true, hl: 'prof', say: ['したの この ボタンで、うちあげかたを かえられるよ。 なんかいか おして、よこに たおれた ロケットの え に しよう。'] },
        { at: 'build', when: x => x.profile === 'side', hl: 'launch', say: ['それで いい！ よこに たおして とぶよ。 はっしゃ！'] },
        { at: 'fly', when: s => s.inSpace, hl: 'btnMap', say: ['うちゅうに でたら、よこに どんどん はやく なっていくよ。 ちずの オレンジの てんせんが、のびていくのを みてね。 みどりに なるかな？'] },
        { at: 'fly', when: s => ORB.includes(s.cls), say: ['てんせんが みどりに なって、ちきゅうを ぐるっと かこんだ！ もう おちてこないよ。'] }
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
        { at: 'fly', when: s => ORB.includes(s.cls) && off(s), hl: 'btnDone', say: ['とまった！ もう ずっと まわりつづけるよ。', 'ひだりうえの ゴールの はたで おわると、ロケットは えいせいに なって、ワールドに のこるよ。'] }
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
      say: ['さいごは、じぶんで ロケットを つくって、ちきゅうを まわろう！', 'ひだりうえの ゴールの はたで おわったら クリア だよ。'],
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
              { t: (s, c) => c.dirs.has('retro'), say: 'エンジンを つけよう。', hl: 'btnEng' },
                { t: (s, c) => (c.ui.btnEng || 0) >= 1 && pe(s) < (s.isPowered() ? 200 : 300), pause: s => (s.isPowered() ? 'btnEng' : null), say: 'ストップ！ ▼ が くうきに はいった！ エンジンは とめて おこう。', hl: 'btnEng' },
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
        { at: 'build', when: x => x.grid.some(r => r.some(k => RL.has(k, 'leg'))), hl: 'launch', say: ['あしが ついた！ はっしゃ ボタンで、さっきと おなじ ところから はじめるよ。'] },
                { at: 'fly', hl: 'btnDir', pause: 'btnDir', say: ['あしの ついた ロケットで もういちど。 うしろむき に しよう。'] },
        { at: 'fly', when: s => s.near, pause: 'speech',
          say: ['メーターが でた！ みて、あしが あると、みどりの ところが ひろく なったね。', 'あしは じめんの ちかくで ひらいて、ふんわり うけとめて くれるよ。 すこし はやくても だいじょうぶ。'] },
        { at: 'fly', when: s => s.alt() < 520, hl: 'btnEng', pause: s => (s.isPowered() ? null : 'btnEng'), say: ['いまだ！ ほのおの ボタンで ブレーキ！ さっきと おなじ ように つけた まま だよ。'] }
      ], help: 'はやく おちる まえに、すこし はやめに エンジンを つけよう。' },
    // v0.14.6：はじめに パラシュートの 話は しない。きりはなした あとに せつめい
    { id: '3-5', ch: 3, quiet: true, icon: ['\u2702\uFE0F', '\u{1FA82}'], rocket: 'SEP', start: { orbit: { pe: 400, ap: 450 }, stages: 2 },
      say: ['エンジンを とめている ときは、はさみの ボタンで いらない だんを すてられるよ。 2かい おしてね。', 'うしろむき で ふかして ▼ を くうきに いれたら、したの だんを すてよう。', 'くうきに はいる まえに すてられたら ほしみっつ。'],
      goal: { done: (d, s, c) => d.type === 'landed' && onEarth(d) && d.chute && c.manualSep >= 1 }, star3: (d, s, c) => c.sepAlt > 300,
      hints: [{ t: () => true, say: 'むきの ボタンで うしろむき に しよう。', hl: 'btnDir' },
              { t: (s, c) => c.dirs.has('retro'), say: 'エンジンを つけよう。', hl: 'btnEng' },
                { t: (s, c) => (c.ui.btnEng || 0) >= 1 && pe(s) < (s.isPowered() ? 200 : 300), pause: s => (s.isPowered() ? 'btnEng' : null), say: 'ストップ！ ▼ が くうきに はいった！ エンジンは とめて おこう。', hl: 'btnEng' },
                { t: (s, c) => off(s) && pe(s) < 250 && (s.canSep() || c.manualSep >= 1), say: 'はさみを 2かい おして、したの だんを すてよう！', hl: 'btnSep' },
                { t: (s, c) => c.manualSep >= 1, pause: 'speech', say: 'したの だんを すてたね！ まど だけ だと、はやすぎて じめんに ぶつかっちゃう。 くうきで ゆっくりに なったら、パラシュートを ひらこう。' },
                { t: s => s.near, pause: 'speech', say: 'くうきに はいったよ！ ひだりに メーターが でたね。 しろい さんかくが みどりの ところに くれば、ふんわり おりられるよ。 いまは あか。 くうきで ゆっくりに なるのを まとう。' },
                { t: s => s.alt() < 300 && s.chutes() && !s.chute && Math.hypot(s.vx + E(s).rot * s.y, s.vy - E(s).rot * s.x) < 76, pause: 'btnChute', say: 'ゆっくりに なった！ いまだ、パラシュート！', hl: 'btnChute' }],      help: 'エンジンを とめてから、はさみを 2かい つづけて おしてね。' },
    // ===== 4章 つきへ（v0.15。v0.18 で ならびを 見なおし）=====
    //  ひくい 軌道（または 月へ むかう とちゅう）から はじめる。地図で みる（map）。だいじな ところで とめて まつ（pause）
    //  4-1 月の 高さまで（🌓）／4-2 よこに ならべる（じぶんで 月の 高さまで とどく ロケット）／4-3 ふかす ところ・であい（うすい月）／4-4 じゅうりょくけん（点線の まる）
    //  ／4-5 月に とどけ（💥）／4-6 月を まわる（▼で うしろへ）／4-7 ぜんぶ じぶんで
    //  v0.18：よこに ならべよう を 4-7 → 4-2 に（4-1 の「月の 高さまで」の すぐ あと。さいごの 4-7 で じぶんの ロケットを つくる まえに おしえる）
    //         v0.20.2：絵の ファイル名を いまの 番号に そろえた（img/mis/<id>.webp。img は つかわない）
    { id: '4-1', ch: 4, quiet: true, map: true, icon: ['\u{1F313}', '\u{1F525}'], rocket: 'UP', start: { orbit: { pe: 400, ap: 450 } }, dvRate: 25,
      goal: { tick: s => s.cls === 'toMoon' && off(s) },
      steps: [
        { at: 'fly', pause: 'speech', say: ['こんどは つきへ いこう！ ちずの まんなかが ちきゅう、とおくに いるのが つき だよ。', 'まずは、つきの たかさまで とどく せんを つくろう。'] },
        { at: 'fly', hl: 'btnEng', pause: 'btnEng', say: ['すすむ むきに ふかすと、はんたいがわが どんどん たかく なるよ。 ほのおの ボタンを おして、つけた ままに してね。'] },
        { at: 'fly', when: s => s.isPowered() && ap(s) > 20000, say: ['せんが のびて いくよ。 つきの たかさまで、もう すこし！'] },
        { at: 'fly', when: s => s.cls === 'toMoon', hl: 'btnEng', pause: s => (s.isPowered() ? 'btnEng' : null), say: ['ストップ！ せんの はしが、つきの たかさまで とどいた！ ほのおの ボタンで とめよう。'] }
      ], help: 'せんの はしが つきの まるい みちに とどいたら とめよう。' },
    // v0.16 よこに ならべよう：まんなか だけで つきの たかさを めざす → ねんりょうが たりない → よこに エンジン＋タンクを ならべる（よこの だん）→ からに なったら はずれて とどく
    { id: '4-2', ch: 4, quiet: true, map: false, icon: ['\u{1F680}', '\u2194\uFE0F'], rocket: 'POD0', allow: ['engine', 'tank'], profile: 'side', need: 'side',
      goal: { tick: (s, c) => s.cls === 'toMoon' && off(s) && c.podSep >= 1 }, star3: s => s.fuelRatio() >= 0.1,
      steps: [
        { at: 'build', hl: 'launch', say: ['よんの いち では、ちきゅうを まわっている ところから、つきの たかさまで ふかしたね。', 'こんどは じめんから はっしゃして、つきの たかさまで とどく せんを つくろう。 はっしゃ！'] },
        { at: 'fly', when: s => ORB.includes(s.cls) && s.isPowered(), hl: 'btnEng', pause: 'btnEng', say: ['みどりの せんに なった！ ほのおの ボタンで いったん とめよう。'] },
        { at: 'fly', when: s => ORB.includes(s.cls) && off(s), hl: 'btnEng', pause: 'btnEng', say: ['こんどは つきの たかさまで ふかそう。 ほのおの ボタンを おして、つけた まま だよ。'] },
        { at: 'fly', when: (s, c) => (c.ui.btnEng || 0) >= 2 && !s.liquidLeft() && s.cls !== 'toMoon', pause: 'speech', end: 'nofuel',
          say: ['あっ、ねんりょうが なくなっちゃった。 つきの たかさまで とどかないね。'] },
        { at: 'result', fail: d => d.type === 'nofuel', hl: 'again',
          say: ['タンクを うえに つむと おもすぎる。 そんな ときは、よこに ならべよう！', 'みどりの ボタンで もどってね。'] },
        { at: 'build', block: true, hl: 'pal:engine', cells: 'podEng', say: ['エンジンを、まんなかの ロケットの よこに おこう。 ひかっている ところ、りょうがわ だよ。'] },
        { at: 'build', block: true, when: x => podCount(x.grid, 1) >= 2, hl: 'pal:tank', cells: 'podTank', say: ['よこの エンジンの うえに、タンクを ふたつずつ のせよう。 ひかっている ところ、りょうがわ だよ。'] },
        { at: 'build', when: x => podCount(x.grid, 3) >= 2, hl: 'launch', say: ['よこに ならんだ！ よこの だんは、まんなかの ロケットと いっしょに もえるよ。', 'まんなかの エンジンも、さきに よこの だんの ねんりょうを つかうんだ。 からっぽに なったら はずれるよ。 はっしゃ！'] },
        { at: 'fly', when: (s, c) => c.podSep >= 1, pause: 'speech', say: ['よこの だんが からっぽに なって、はずれたよ！ ひだりの ねんりょうの メーターを みて。 よこの れつは はいいろに なったけど、まんなかの メーターは まだ まんたん。', 'からっぽの いれものを すてて かるく なったから、まんなかの ロケットが もっと とおくへ いけるんだ。'] },
        { at: 'fly', when: s => ORB.includes(s.cls) && s.isPowered(), hl: 'btnEng', pause: 'btnEng', say: ['みどりの せんだ！ いったん とめよう。'] },
        { at: 'fly', when: s => ORB.includes(s.cls) && off(s), hl: 'btnEng', pause: 'btnEng', say: ['つきの たかさまで ふかそう！ つけた まま だよ。'] },
        { at: 'fly', when: s => s.cls === 'toMoon', hl: 'btnEng', pause: s => (s.isPowered() ? 'btnEng' : null), say: ['とどいた！ ほのおの ボタンで とめよう。'] }
      ], help: 'まんなかの ロケットの よこに、エンジンと タンクを ならべよう。' },
    { id: '4-3', ch: 4, quiet: true, map: true, mark: true, icon: ['\u{1F3AF}', '\u{1F319}'], rocket: 'UP', start: { orbit: { pe: 400, ap: 450, burnIn: 120 } }, dvRate: 25,
      goal: { tick: (s, c) => c.enc && off(s) },
      steps: [
        { at: 'fly', pause: 'speech', say: ['つきは うごいているから、いつ ふかしても あえる わけじゃ ないんだ。', 'ちずの ひかっている ほのおの しるしが、ふかす ところ。 ロケットが しるしに つくまで まとう。'] },
        { at: 'fly', when: s => { const b = M.burnAng(s); return !!b && b.dt * Math.sqrt(E(s).mu / Math.pow(b.r, 3)) < LEAD; }, hl: 'btnEng', pause: 'btnEng',
          say: ['しるしに ついた！ いったん ストップ。 ほのおの ボタンで ふかそう。 つけた まま だよ。'] },
        { at: 'fly', when: (s, c) => s.isPowered() && encNow(s, c), hl: 'btnEng', pause: 'btnEng',
          say: ['ストップ！ うすい つきが でたよ。 つきと であえる せんに なった！', 'ほのおの ボタンで とめよう。'] }
      ], help: 'ひかっている しるしで ふかして、うすい つきが でたら とめよう。' },
    { id: '4-4', ch: 4, quiet: true, map: true, watch: true, coast: 2.5, icon: ['\u2B55', '\u{1F319}'], rocket: 'UP', start: { orbit: { pe: 400, ap: 'moon', lead: -0.3 } },
      goal: { tick: (s, c) => c.inMoon && s.body === E(s) },
      steps: [
        { at: 'fly', pause: 'speech', say: ['いま、つきへ むかって とんでいる ところ。 うすい つきの まわりの てんせんの まるを みてね。', 'あの まるの なかは、つきに ひっぱられる ところ。 じゅうりょくけん って いうんだ。', 'こんどは みている だけで いいよ。 まるに はいって、また そとに でたら ミッション クリア！'] },
        { at: 'fly', when: s => s.body === s.bodies.moon, pause: 'speech',
          say: ['まるの なかに はいった！ ここからは つきに ひっぱられて、せんが まがるよ。', 'この せんは、つきの よこを とおりぬける せん。 みていてね。'] },
        { at: 'fly', when: (s, c) => c.inMoon && s.body === E(s), pause: 'speech', say: ['まるの そとに でた！ つきの よこを とおりぬけたね。'] }
      ] },
    { id: '4-5', ch: 4, quiet: true, map: true, noSlow: true, coast: 2.5, icon: ['\u{1F4A5}', '\u{1F319}'], rocket: 'UP', start: { orbit: { pe: 400, ap: 'moon', lead: -0.3 } }, dvRate: 3,
      goal: { done: d => d.body === 'moon' && ['hit', 'landed', 'crash'].includes(d.type) },
      steps: [
        { at: 'fly', pause: 'speech', say: ['こんどは つきに とどけよう！ いまの せんは、つきの よこを とおりすぎちゃう。', 'すこし とんで、とちゅうで せんを なおすよ。'] },
        { at: 'fly', when: s => s.t > 700, hl: 'btnEng', pause: 'btnEng',
          say: ['ここで ストップ。 すすむ むきに すこし ふかすと、せんが つきに ちかづくよ。', 'ほのおの ボタンを おして、せんを みていてね。'] },
        { at: 'fly', when: s => s.isPowered() && hitNow(s), hl: 'btnEng', pause: 'btnEng',
          say: ['ストップ！ どーんの しるしが でた。 つきに とどく せんだ！ ほのおの ボタンで とめよう。'] },
        { at: 'fly', when: (s, c) => !s.isPowered() && (c.ui.btnEng || 0) >= 2, say: ['あとは つきまで まっすぐ。 はやおくり するよ。'] },
        { at: 'fly', when: s => s.body === s.bodies.moon, say: ['つきの じゅうりょくけんに はいった。 つきが ちかづいて くるよ！'] },
        { at: 'fly', when: s => s.body === s.bodies.moon && s.alt() < 600, pause: 'speech',
          say: ['ストップ！ みて、すごい はやさで つきに むかっているよ。', 'ちきゅうから まっすぐ つきに むかうと、はやすぎて、ブレーキが まにあわずに ぶつかっちゃうんだ。 どうなるか みてみよう。'] }
      ], clearSay: 'ちきゅうから まっすぐ つきに むかうと、はやすぎて ぶつかっちゃうんだね。 つぎの ミッションで、ぶつからない ほうほうを ためそう。',
      help: 'まえむきに すこし ふかすと、つきに ちかづくよ。' },
    { id: '4-6', ch: 4, quiet: true, map: true, icon: ['\u{1F504}', '\u{1F319}'], rocket: 'UP', start: { orbit: { pe: 400, ap: 'moon', lead: -0.21 } }, dvRate: 6,
      goal: { tick: s => s.body === s.bodies.moon && s.cls === 'moonOrbit' && off(s) },
      steps: [
        { at: 'fly', pause: 'speech', say: ['こんどは つきを ぐるぐる まわろう。', 'よんの ご で みたように、まっすぐ つきに むかうと、はやすぎて ぶつかっちゃう。 だから まず、つきの まわりを まわる ひつようが あるんだ。', 'いまの せんは、つきの すぐ よこを とおる せん だよ。'] },
        { at: 'fly', when: s => s.body === s.bodies.moon, hl: 'btnDir', pause: 'btnDir',
          say: ['じゅうりょくけんに はいった！ でも このままじゃ、よんの よん と おなじで、とおりすぎちゃうね。', 'つきに いちばん ちかい ところで うしろむきに ふかすと、ブレーキが かかって、つきに つかまって まわれる ように なるよ。', 'いまの うちに、むきの ボタンで うしろむき に しよう。'] },
        { at: 'fly', when: s => s.body === s.bodies.moon && vr(s) >= 0, hl: 'btnEng', pause: 'btnEng',
          say: ['いまだ！ つきに いちばん ちかい ところ。 ここが いちばん はやい から、ここで ブレーキを かけるのが いちばん きくんだ。', 'ほのおの ボタンで ブレーキ！ つけた まま だよ。'] },
        { at: 'fly', when: s => s.body === s.bodies.moon && s.cls === 'moonOrbit', hl: 'btnEng', pause: s => (s.isPowered() ? 'btnEng' : null),
          say: ['ストップ！ せんが つきを ぐるっと かこんだ！ ほのおの ボタンで とめよう。'] }
      ], help: 'つきに いちばん ちかい ところで、うしろむきに ふかそう。' },
    { id: '4-7', ch: 4, map: false, mark: true, icon: ['\u{1F6E0}\uFE0F', '\u{1F319}'], preset: 'ORBIT', allow: null, hl: 'launch',
      say: ['さいごは、じぶんで つくった ロケットで、つきを まわろう！ まずは おさらい だよ。',
        'ひとつ。 ちきゅうを まわったら エンジンを とめる。 ふたつ。 ちずの ひかる しるしで、まえに ふかす。 みっつ。 うすい つきが でたら とめる。',
        'よっつ。 じゅうりょくけんに はいったら うしろむき。 いつつ。 つきに いちばん ちかい ところで ブレーキ。',
        'わからなく なったら、ミッションの ちずで もどって みよう。 ロケットづくりは よんの に、しるしは よんの さん、ブレーキは よんの ろく だよ。'],
      goal: { tick: s => s.body === s.bodies.moon && s.cls === 'moonOrbit' && off(s) },
      //  とぶ ときの あんないは 4-3・4-6 と おなじ（とめて まつ）
      hints: [{ t: s => ORB.includes(s.cls) && off(s) && !!M.burnAng(s), say: 'ちきゅうを まわれた！ ちずの ひかる しるしまで まとう。', hl: 'btnMap' },
              { t: s => { const b = M.burnAng(s); return off(s) && !!b && b.dt * Math.sqrt(E(s).mu / Math.pow(b.r, 3)) < LEAD; }, pause: 'btnEng', hl: 'btnEng', say: 'しるしに ついた！ ほのおの ボタンで ふかそう。' },
              { t: (s, c) => s.isPowered() && encNow(s, c), pause: 'btnEng', hl: 'btnEng', say: 'うすい つきが でた！ とめよう。' },
              { t: s => s.body === s.bodies.moon, pause: 'btnDir', hl: 'btnDir', say: 'じゅうりょくけんに はいった！ うしろむき に しよう。' },
              { t: s => s.body === s.bodies.moon && vr(s) >= 0, pause: 'btnEng', hl: 'btnEng', say: 'いまだ！ ブレーキ！ つけた まま だよ。' },
              { t: s => s.body === s.bodies.moon && s.cls === 'moonOrbit', pause: s => (s.isPowered() ? 'btnEng' : null), hl: 'btnEng', say: 'つきを かこんだ！ とめよう。' }],
      help: 'まず ちきゅうを まわって、しるしで ふかそう。 つきに ちかづいたら うしろむき で ブレーキ。' },
    // ===== 5章 つきに おりる（v0.17。v0.18.1 で 5こ → 4こ）=====
    //  月の まわり（または 月の 上）から はじめる。月の 地面ちかくは メーター（みどり＝ふんわり）。うしろむきの エンジンを つけた ままなら ゆっくり おりる（LAND.moon.HOVER_VD）
    //  ブレーキの タイミングは とめて まつ（brakeNow：いまから エンジンで とまれる ぎりぎりの すこし 手前）
    //  5-1 メーターと ブレーキ／5-2 🚩 と 🏁／5-3 まわっている ところから（▼を さげる → よこの はやさを けす → ブレーキ）／5-4 ぜんぶ じぶんで
    //  v0.18.1：まえの 5-1（▼を さげる）と 5-4（よこの はやさ）を 1つに（5-3）
    { id: '5-1', ch: 5, quiet: true, icon: ['\u{1F7E2}', '\u{1F525}'], rocket: 'LANDER', start: { moon: { h: 1500, vDown: 12 } },
      goal: { tick: s => s.surface },
      steps: [
        { at: 'fly', pause: 'speech', say: ['いま、つきの うえから おちていく ところ。 つきには くうきが ないから、パラシュートは つかえないよ。', 'エンジンで ブレーキを かけて おりよう。'] },
        { at: 'fly', hl: 'btnDir', pause: 'btnDir', say: ['まず、むきの ボタンで うしろむき に しよう。'] },
        { at: 'fly', when: s => s.near, pause: 'speech',
          say: ['ひだりの メーターを みてね。 ちきゅうと おなじ、しろい さんかくが みどりの ところで つけば ふんわり。', 'いまは あか。 このままだと どーん、だね。 でも まだ ブレーキは はやいよ。 ぎりぎりまで まとう。'] },
        { at: 'fly', when: s => brakeNow(s), hl: 'btnEng', pause: s => (s.isPowered() ? null : 'btnEng'),
          say: ['いまだ！ ほのおの ボタンで ブレーキ！ つけた まま だよ。 さんかくが みどりに うごくのを みてね。'] },
        { at: 'fly', when: s => s.hover, say: ['みどりに なった！ そのまま ゆっくり おりていくよ。'] }
      ], help: 'うしろむき に して、「いまだ」で エンジンを つけた まま に しよう。' },
    { id: '5-2', ch: 5, quiet: true, icon: ['\u{1F6A9}', '\u{1F3C1}'], rocket: 'LANDER', start: { moon: { h: 400, vDown: 4 } },
      goal: { done: (d, s) => d.type === 'landed' && d.body === 'moon' && s.flagPlanted }, star3: d => !!d.soft,
      steps: [
        { at: 'fly', pause: 'speech', say: ['つきに おりて、はたを たてよう！'] },
        { at: 'fly', hl: 'btnDir', pause: 'btnDir', say: ['うしろむき に しよう。'] },
        { at: 'fly', when: s => brakeNow(s), hl: 'btnEng', pause: s => (s.isPowered() ? null : 'btnEng'), say: ['いまだ！ ブレーキ！ つけた まま だよ。'] },
        { at: 'fly', when: s => s.surface, hl: 'btnFlag', pause: 'btnFlag', say: ['ちゃくりく！ あたらしい ボタンが でたよ。 はたの ボタンで、つきに はたを たてよう！'] },
        { at: 'fly', when: s => s.surface && s.flagPlanted, hl: 'btnDone', pause: 'btnDone', say: ['はたが たった！ たてた はたは、ワールドの つきに ずっと のこるよ。', 'ひだりうえの ゴールの はたで おわろう。'] }
      ], help: 'おりたら、はたの ボタン、ひだりうえの ゴールの はた の じゅんばんで おそう。' },
    { id: '5-3', ch: 5, quiet: true, map: true, icon: ['\u25BC', '\u2B07\uFE0F'], rocket: 'LANDER', start: { moon: { pe: 2500, ap: 2700 } }, dvRate: 8,
      goal: { tick: s => s.surface }, star3: s => s.surfJ && s.surfJ.vDown <= RL.CFG.ORBIT.LAND.moon.SOFT * 2,
      steps: [
        { at: 'fly', pause: 'speech', say: ['こんどは、つきを まわっている ところから おりよう。 3つの じゅんばん だよ。',
          'ひとつめ、▼ を さげて つきに ちかづく。 ふたつめ、よこの はやさを けす。 みっつめ、さいごの ブレーキ。'] },
        { at: 'fly', hl: 'btnDir', pause: 'btnDir', say: ['ひとつめ。 むきの ボタンで、うしろむき に しよう。'] },
        { at: 'fly', hl: 'btnEng', pause: 'btnEng', say: ['ちきゅうと おなじ。 うしろむきに ふかすと、はんたいがわの ▼ が さがるよ。 ほのおの ボタンを おして、▼ の かずを みててね。 つけた まま だよ。'] },
        { at: 'fly', when: s => s.isPowered() && pe(s) <= 150, hl: 'btnEng', pause: 'btnEng', say: ['ストップ！ ▼ が つきの すぐ ちかくまで さがった。 ほのおの ボタンで とめよう。'] },
        { at: 'fly', when: (s, c) => off(s) && (c.ui.btnEng || 0) >= 2, pause: 'speech',
          say: ['これで ▼ に むかって おりていくよ。 でも、まわっている ときは、よこに すごく はやく うごいているんだ。', 'そのまま おりると、よこに すべって ころんじゃう。 じめんに ちかづくまで はやおくり するよ。'] },
        { at: 'fly', when: s => s.alt() < 2300 && vr(s) < 0, hl: 'btnEng', pause: 'btnEng',
          say: ['ストップ！ じめんに ちかづいてきた。 ふたつめ。 うしろむきの まま ほのおの ボタンで、よこの はやさを けそう。 したの スピードメーターが へっていくよ。 つけた まま だよ。'] },
        { at: 'fly', when: s => s.isPowered() && Math.abs(s.relVel().vt) < 2, hl: 'btnEng', pause: 'btnEng',
          say: ['ストップ！ よこの はやさが ほとんど なくなった。 ほのおの ボタンで とめよう。 こんどは まっすぐ したに おちていくよ。'] },
        { at: 'fly', when: s => s.near, pause: 'speech', say: ['メーターが でた。 みっつめ。 ごの いち と おなじ、ぎりぎりまで まって ブレーキ だよ。'] },
        { at: 'fly', when: s => brakeNow(s), hl: 'btnEng', pause: s => (s.isPowered() ? null : 'btnEng'), say: ['いまだ！ ブレーキ！ つけた まま だよ。'] }
      ], help: 'まず ▼ を さげて、じめんの ちかくで よこの はやさを けしてから、さいごに ブレーキ。' },
    { id: '5-4', ch: 5, mark: true, icon: ['\u{1F6E0}\uFE0F', '\u{1F9D1}\u200D\u{1F680}'], preset: 'MOONSHIP', allow: null, hl: 'launch',
      say: ['さいごは、じぶんの ロケットで ちきゅうから つきに おりよう！', 'つきを まわったら、ごの さん と おなじ。 うしろむき で よこの はやさを けして、さいごの ブレーキで ふんわり。'],
      goal: { tick: s => s.surface, done: d => d.type === 'landed' && d.body === 'moon' }, star3: (d, s) => !!(s.surfJ ? s.surfJ.soft : d && d.soft),
      hints: [{ t: s => ORB.includes(s.cls) && off(s) && !!M.burnAng(s), say: 'ちきゅうを まわれた！ ちずの ひかる しるしまで まとう。', hl: 'btnMap' },
              { t: s => { const b = M.burnAng(s); return off(s) && !!b && b.dt * Math.sqrt(E(s).mu / Math.pow(b.r, 3)) < LEAD; }, pause: 'btnEng', hl: 'btnEng', say: 'しるしに ついた！ ほのおの ボタンで ふかそう。' },
              { t: (s, c) => s.isPowered() && encNow(s, c), pause: 'btnEng', hl: 'btnEng', say: 'うすい つきが でた！ とめよう。' },
              { t: s => s.body === s.bodies.moon, pause: 'btnDir', hl: 'btnDir', say: 'じゅうりょくけんに はいった！ うしろむき に しよう。' },
              { t: s => s.body === s.bodies.moon && vr(s) >= 0, pause: 'btnEng', hl: 'btnEng', say: 'いまだ！ ブレーキ！ つけた まま だよ。' },
              { t: s => s.body === s.bodies.moon && s.cls === 'moonOrbit', pause: 'speech', say: 'つきを まわる せんに なった。 このまま つけて、よこの はやさを けすよ。' },
              { t: s => s.body === s.bodies.moon && s.isPowered() && Math.abs(s.relVel().vt) < 2, pause: 'btnEng', hl: 'btnEng', say: 'よこの はやさが なくなった！ とめよう。' },
              { t: s => s.near && off(s) && brakeNow(s), pause: 'btnEng', hl: 'btnEng', say: 'いまだ！ さいごの ブレーキ！ つけた まま だよ。' }],
      help: 'しるしで ふかして、うすい つきが でたら とめる。 つきに ちかづいたら うしろむきで ブレーキ。 よこの はやさを けしてから、さいごの ブレーキ。' },
    // ===== 6章 つきから かえる（v0.19）=====
    //  6-1 つきから りりく（✂️ で したの だんを おいていく → 🔥）／6-2 かえる せん（ひかる しるしで まえへ → 🏠 の せんで とめる）
    //  ／6-3 あつい！（月から かえる はやさで くうきに はいる → ✂️ → 🪂）／6-4 だいぼうけん（じめんから 月に おりて かえる）
    //  かえる しるし（homeMark）：つきを まわる きどうで、ここで まえに ふかすと ちきゅうに かえる せんに なる ところ（M.homeAng）
    { id: '6-1', ch: 6, quiet: true, icon: ['\u2702\uFE0F', '\u{1F680}'], rocket: 'ASC', start: { stages: 2, fuels: [0, 1], moon: { surface: true } },
      goal: { tick: (s, c) => c.manualSep >= 1 && s.body === s.bodies.moon && !s.surface && s.cls === 'moonOrbit' && off(s) }, star3: s => !!s.flagPlanted,
      steps: [
        { at: 'fly', pause: 'speech', say: ['つきに ついたね！ こんどは ちきゅうに かえる ばん だよ。', 'したの だんは、つきに おりる ための だん。 ねんりょうは もう からっぽ。 おもい だけ だね。',
          'はたを たててから でも いいよ。 たてると ほし みっつ！'] },
        { at: 'fly', hl: 'btnSep', say: ['はさみを 2かい おして、したの だんを つきに おいていこう。'] },
        { at: 'fly', when: (s, c) => c.manualSep >= 1, pause: 'speech', say: ['おいていった だんは、つきに ずっと のこるよ。 かるく なったね！'] },
        { at: 'fly', hl: 'btnEng', pause: 'btnEng', say: ['ほのおの ボタンを おすと、つきを まわる ところまで、じどうで とんでいくよ。 おしてみて！'] },
        { at: 'fly', when: s => !s.surface && s.body === s.bodies.moon && s.cls === 'moonOrbit' && off(s), pause: 'speech',
          say: ['つきを まわる きどうに のったよ！ これで ちきゅうに かえる じゅんびが できた。'] }
      ], help: 'まず はさみを 2かい。 それから ほのおの ボタン だよ。' },
    { id: '6-2', ch: 6, quiet: true, map: true, homeMark: true, icon: ['\u{1F3E0}', '\u{1F319}'], rocket: 'ASC', start: { stages: 1, moon: { pe: 100, ap: 300, ang: 1.57, been: true } }, dvRate: 8,   // ang：しるしまで 実時間 約9秒
      goal: { tick: (s, c) => off(s) && (c.ui.btnEng || 0) >= 2 && homeNow(s, c) }, star3: s => s.fuelRatio() >= 0.8,
      steps: [
        { at: 'fly', pause: 'speech', say: ['いま、つきを まわっている ところ。 ちきゅうに かえるには、つきから はなれて、ちきゅうに もどる せんを つくるよ。',
          'ちずの ひかっている ほのおの しるしが、ふかす ところ。 よんの さん と おなじ だね。 しるしに つくまで まとう。'] },
        { at: 'fly', when: s => { const h = M.homeAng(s); return !!h && h.dt < 3; }, hl: 'btnEng', pause: 'btnEng',
          say: ['しるしに ついた！ いったん ストップ。 まえむきに ふかすよ。 ほのおの ボタンを おして、つけた まま だよ。'] },
        { at: 'fly', when: (s, c) => s.isPowered() && homeNow(s, c), hl: 'btnEng', pause: 'btnEng',
          say: ['ストップ！ いえの しるしが でた。 ちきゅうに かえれる せんだ！ ほのおの ボタンで とめよう。'] }
      ], clearSay: 'このまま まつと、ちきゅうに かえって くるよ。',
      help: 'ひかる しるしで ふかして、いえの しるしが でたら とめよう。' },
    { id: '6-3', ch: 6, quiet: true, icon: ['\u{1F525}', '\u{1FA82}'], rocket: 'RET', start: { stages: 2, fuels: [0.3, 1], orbit: { pe: 100, ap: 'moon', nu: -1.5, ang: 2.2 } },
      goal: { done: d => d.type === 'landed' && onEarth(d) && d.chute }, star3: (d, s, c) => c.sepAlt > 300,
      steps: [
        { at: 'fly', pause: 'speech', say: ['ちきゅうに かえって きたよ！ つきから おちてきたから、ものすごい はやさ だよ。',
          'くうきに はいる まえに、いらない だんを すてて、まどの だん だけに しよう。'] },
        { at: 'fly', hl: 'btnSep', say: ['はさみを 2かい おしてね。'] },
        { at: 'fly', when: s => s.alt() < 300 && wind(s) > 150, pause: 'speech',
          say: ['あつい！ すごい はやさで くうきに ぶつかって、まわりが まっかに なっているね。', 'くうきが ブレーキに なって、ゆっくりに してくれるんだ。 パラシュートは まだ だよ。 いま ひらくと やぶれちゃう。 ゆっくりに なるのを まとう。'] },
        { at: 'fly', when: s => s.alt() < 300 && s.chutes() && !s.chute && wind(s) < 76, hl: 'btnChute', pause: 'btnChute', say: ['ゆっくりに なった！ いまだ、パラシュート！'] }
      ], help: 'くうきの まえで はさみ。 あつく なっても まって、ゆっくりに なったら パラシュート。' },
    { id: '6-4', ch: 6, mark: true, homeMark: true, icon: ['\u{1F30D}', '\u{1FAA8}'], preset: 'TRIP', allow: null, hl: 'launch',
      say: ['さいごは だいぼうけん！ じめんから つきに おりて、ちきゅうに かえって こよう。',
        'つきまでは ごの よん と おなじ。 つきに ついたら はたを たてて、ほのおの ボタンで りりく。',
        'つきを まわったら、ひかる しるしで まえむきに ふかして、いえの しるしで とめる。 さいごは パラシュート！',
        'わからなく なったら、ミッションの ちずで もどってね。 おりかたは ごの さん、かえりかたは ろくの に だよ。'],
      goal: { done: d => d.type === 'landed' && onEarth(d) && d.returned }, star3: (d, s) => !!s.flagPlanted,
      hints: [{ t: s => ORB.includes(s.cls) && off(s) && !!M.burnAng(s), say: 'ちきゅうを まわれた！ ちずの ひかる しるしまで まとう。', hl: 'btnMap' },
              { t: s => { const b = M.burnAng(s); return off(s) && !!b && b.dt * Math.sqrt(E(s).mu / Math.pow(b.r, 3)) < LEAD; }, pause: 'btnEng', hl: 'btnEng', say: 'しるしに ついた！ ほのおの ボタンで ふかそう。' },
              { t: (s, c) => s.isPowered() && encNow(s, c), pause: 'btnEng', hl: 'btnEng', say: 'うすい つきが でた！ とめよう。' },
              { t: s => s.body === s.bodies.moon, pause: 'btnDir', hl: 'btnDir', say: 'じゅうりょくけんに はいった！ うしろむき に しよう。' },
              { t: s => s.body === s.bodies.moon && vr(s) >= 0, pause: 'btnEng', hl: 'btnEng', say: 'いまだ！ ブレーキ！ つけた まま だよ。' },
              { t: s => s.body === s.bodies.moon && s.cls === 'moonOrbit', pause: 'speech', say: 'つきを まわる せんに なった。 このまま つけて、よこの はやさを けすよ。' },
              { t: s => s.body === s.bodies.moon && s.isPowered() && Math.abs(s.relVel().vt) < 2, pause: 'btnEng', hl: 'btnEng', say: 'よこの はやさが なくなった！ とめよう。' },
              { t: s => s.near && off(s) && brakeNow(s), pause: 'btnEng', hl: 'btnEng', say: 'いまだ！ さいごの ブレーキ！ つけた まま だよ。' },
              { t: s => s.surface, pause: 'btnFlag', hl: 'btnFlag', say: 'ちゃくりく！ まず、はたを たてよう。' },
              { t: s => s.surface && s.flagPlanted, pause: 'btnEng', hl: 'btnEng', say: 'ほのおの ボタンで りりく！ つきを まわる ところまで じどうで とぶよ。' },
              { t: s => !s.surface && s.body === s.bodies.moon && s.cls === 'moonOrbit' && off(s) && s.moonLanded, say: 'つきを まわった！ ひかる しるしまで まとう。', hl: 'btnMap' },
              { t: s => { const h = M.homeAng(s); return off(s) && !!h && h.dt < 3; }, pause: 'btnEng', hl: 'btnEng', say: 'しるしに ついた！ まえむきで ほのおの ボタン！' },
              { t: (s, c) => s.isPowered() && homeNow(s, c), pause: 'btnEng', hl: 'btnEng', say: 'いえの しるしが でた！ とめよう。' },
              { t: s => s.body === E(s) && s.alt() < 1500 && s.canSep() && s.chutes() === 0, hl: 'btnSep', say: 'くうきに はいる まえに、まど いがいの だんを はさみで すてよう。' },
              { t: s => s.alt() < 300 && s.chutes() && !s.chute && wind(s) < 76, pause: 'btnChute', hl: 'btnChute', say: 'ゆっくりに なった！ パラシュート！' }],
      help: 'つきでは はたを たててから りりく。 かえりは ひかる しるしで ふかして、いえの しるしで とめよう。' }
  ];
  const CHAPTERS = [
    { ch: 1, icon: '\u{1F680}', medal: 'mis1' }, { ch: 2, icon: '\u{1F6F0}\uFE0F', medal: 'mis2' }, { ch: 3, icon: '\u{1FA82}', medal: 'mis3' }, { ch: 4, icon: '\u{1F319}', medal: 'mis4' }, { ch: 5, icon: '\u{1F9D1}\u200D\u{1F680}', medal: 'mis5' }, { ch: 6, icon: '\u{1FAA8}', medal: 'mis6' }
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
    // v0.18：よこの 列ごとに、まだ たりない ところ だけ 光らせる（podEng＝エンジンが まだ／podTank＝エンジンの うえの タンクが 2つ まで）
    if (st.cells === 'podEng' || st.cells === 'podTank') { const w = [];
      [1, 3].forEach(cc => { const col = g.map(r => r[cc]), eng = col.some(k => RL.ENGINES[k]), tk = col.filter(k => RL.base(k) === 'tank').length;
        if (st.cells === 'podEng' ? eng : (!eng || tk >= 2)) return;
        for (let i = g.length - 1; i >= 0; i--) if (!g[i][cc]) { w.push([i, cc]); break; } });
      RL.Builder.highlightCell(w.length ? w : null); return; }
    if (st.cells === 'pod') { const w = []; [1, 3].forEach(cc => { for (let i = g.length - 1; i >= 0; i--) if (!g[i][cc]) { w.push([i, cc]); break; } }); if (w.length) RL.Builder.highlightCell(w); return; }   // v0.16
    if (st.cells === 'engine') { const w = []; g.forEach((r, i) => r.forEach((k, j) => { if (RL.ENGINES[k]) w.push([i, j]); })); if (w.length) RL.Builder.highlightCell(w); return; }   // v0.14.6
    if (st.cells === 'win') { const w = []; g.forEach((r, i) => r.forEach((k, j) => { if (RL.base(k) === 'win') w.push([i, j]); })); if (w.length) RL.Builder.highlightCell(w); return; }
    if (top > 0) RL.Builder.highlightCell([top - 1, 2]);
  }
  // v0.18：くみたての あいだ、光らせる マスを いまの くみたてに あわせて うごかす（タンクを 1つ おいたら つぎの マスへ）
  M.refreshCells = () => { const c = M.ctx; if (c && c.cur && c.cur.at === 'build' && c.cur.cells) hlCells(c.cur); };
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
  M.onLaunch = (grid, profile) => {   // v0.19：homeLast も もどす
    const m = M.active, c = M.ctx; if (!m) return true;
    const need = M.need(), cur = c.cur;
    if (cur && cur.block && cur.at === 'build') return { say: cur.say, hl: cur.hl };
    if (need && profile !== need) return { need };
    c.prof = profile; c.profs.add(profile);
    c.topRow = 99; grid.forEach((row, r) => { if (row.some(Boolean)) c.topRow = Math.min(c.topRow, r); });
    c.ui = {}; c.homeK = 0; c.homeLast = null; c.podSep = 0; c.enc = false; c.encLast = false; c.inMoon = false; c.aborts = 0; c.dirs = new Set(['pro']); c.cleared = null; c.manualSep = 0; c.sepAlt = 0; c.mapT0 = 0; c.cutFuel = 0; c.siLaunch = c.si;
    return true;
  };
  M.buildInfo = (grid, profile) => ({ grid, profile, tanks: countTanks(grid) });
  M.ui = id => { const c = M.ctx; if (!c) return; c.ui[id] = (c.ui[id] || 0) + 1; if (id === 'btnMap' && !c.mapT0) c.mapT0 = performance.now(); };
  M.event = (e, s) => {
    const c = M.ctx; if (!c) return;
    if (e.type === 'dir') c.dirs.add(e.dir);
    if (e.type === 'booster-sep' && e.pod) c.podSep = (c.podSep || 0) + 1;   // v0.16
    if (e.type === 'stage-sep' && e.manual) { c.manualSep++; if (!c.sepAlt) c.sepAlt = Math.hypot(s.x, s.y) - s.body.R; }
  };
  // 毎こま：あんない と、とちゅうで クリア（tick）。もどり値：あんない の ならび、クリアは { clear: true }
  M.tick = s => {
    const m = M.active, c = M.ctx; if (!m || !c || s.done) return [];
    if (s.body === s.bodies.moon) c.inMoon = true;
    if (!c.cutFuel && ORB.includes(s.cls) && !s.isPowered() && (c.ui.btnEng || 0) >= 1) c.cutFuel = s.fuelRatio();
    const out = M.pollAll('fly', s);
    const held = out.some(h => h.pause && (typeof h.pause !== 'function' || h.pause(s)));   // v0.15：とめて 話す あんないの こまでは クリアに しない（声が かさならない）
    if (!held && !c.cleared && m.goal.tick && m.goal.tick(s, c)) { c.cleared = { s3: !!(m.star3 && m.star3(s, c)) }; out.push({ clear: true }); }
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
  };  M.countTanks = countTanks;
  // ---- v0.15 4章：月へ ----
  //  ふかす ところ（ちきゅうを まわる 軌道の 上の 角度）：ここで まえに ふかすと、月の 高さに つく ときに 月が そこに いる
  M.burnAng = s => {
    if (!s || s.body !== E(s) || !s.lifted) return null;
    const el = s.elements(); if (!el || el.e >= 0.3) return null;
    const Mo = s.bodies.moon, mu = E(s).mu, r = Math.hypot(s.x, s.y), D = Mo.orbitR;
    const th = Math.PI * Math.sqrt(Math.pow((r + D) / 2, 3) / mu), n = Math.sqrt(mu / (r * r * r)) * el.s, a0 = Math.atan2(s.y, s.x);
    let tb = 0, phi = 0;
    for (let i = 0; i < 8; i++) { phi = Mo.ph0 + Mo.w * (s.t + tb + th) - Math.PI; const d = ((phi - a0) * el.s % TAU + TAU) % TAU; tb = d / Math.abs(n); }
    return { ang: phi, dt: tb, r };
  };
  //  地図の しるし（ここで ふかす）：ちきゅうの まわりで、エンジンが とまっている ときだけ
  // v0.19 6章：かえる ところ（月を まわる 軌道で ここで まえに ふかすと ちきゅうに かえる せん）。
    //   月から みて ちきゅうと 反対がわ より HOME_OFF だけ 手前（tools/ch6_check.js の OFF しらべ：-1.2〜0 で どれも かえれた）
    const HOME_OFF = -0.6, wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
    M.homeAng = s => {
      if (!s || s.body !== s.bodies.moon || s.surface || !s.lifted) return null;
      const el = s.elements(); if (!el || el.e >= 1 || el.ra > s.body.soi) return null;
      const SP = RL.Space, Mo = s.bodies.moon, f = t => { const p = SP.stateAt(el, t), m = SP.bodyState(Mo, t); return wrapA(Math.atan2(p.y, p.x) - (Math.atan2(m.y, m.x) + Math.PI + HOME_OFF)); };
      let prev = f(s.t); if (Math.abs(prev) < 0.03) return { dt: 0, p: s };
      const N = 240, h = el.T / N;
      for (let i = 1; i <= N; i++) { const v = f(s.t + i * h); if (prev < 0 && v >= 0 && v - prev < Math.PI) return { dt: i * h, p: SP.stateAt(el, s.t + i * h) }; prev = v; }
      return null;
    };
    M.mark = s => { const m = M.active; if (!m) return null;
      if (m.homeMark && s.body === s.bodies.moon) { if (s.isPowered() || s.cls !== 'moonOrbit') return null; const h = M.homeAng(s); if (!h) return null;
        const ms = RL.Space.bodyState(s.bodies.moon, s.t); return { x: ms.x + h.p.x, y: ms.y + h.p.y, dt: h.dt, moon: true }; }
      if (!m.mark || s.isPowered() || !ORB.includes(s.cls)) return null;
    const b = M.burnAng(s); return b ? { x: Math.cos(b.ang) * b.r, y: Math.sin(b.ang) * b.r, dt: b.dt } : null; };
  //  月との であい（予測）：{ enc, close（月の 地面からの いちばん ちかい 高さ）, hit }
  M.encInfo = s => {
    const pr = RL.Predict.fromSim(s); if (!pr || !pr.enc) return { enc: false };
    const R = s.bodies.moon.R; return { enc: true, hit: !!pr.enc.hitPt, close: pr.enc.peAlt };
  };
// ひらいているか（ひとつ まえの ミッションが ⭐1 いじょう）
  M.unlocked = (rec, id) => { const i = LIST.findIndex(m => m.id === id); return i <= 0 || (rec[LIST[i - 1].id] || 0) >= 1; };
  M.chapterDone = (rec, ch) => LIST.filter(m => m.ch === ch).every(m => (rec[m.id] || 0) >= 1);
  return M;
})();
