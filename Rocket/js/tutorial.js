// チュートリアル：声で あんない。文字は 使わない。
// 1ステップ ＝ { say:[話すこと], icon:[絵], preset:列の配置（左から、下→上）, allow:[使える部品],
//               hl:どこを光らせるか（pal / cell:[行,列] / cols:[列,…]（各列の いちばん下の あき）/ el:ボタンのid）,
//               wait:{type, ...}, after:(結果)=>[話すこと] }
// wait.type: speech / select / grid（test が みたされたら）/ remove / clear / launchFail / result
RL.Tutorial = (function () {
  const $ = id => document.getElementById(id), A = RL.Audio, B = () => RL.Builder;
  const T = n => Array(n).fill('tank'), BS = n => Array(n).fill('booster');
  const RB = RL.CFG.ROWS - 1;                     // いちばん下の行
  const an = () => RL.analyze(B().grid);
  const inStage = (a, i, k) => a.cells.filter(q => q.k === k && q.stage === i && !q.ctx.loose).length;
  let results = [];
  const last = (n = 1) => results[results.length - n];
  const prevH = () => (last(2) ? last(2).h : 0);

  const STEPS = [
    // ---- 1 そうさ
    { say: ['ロケットラボへ ようこそ！', 'いっしょに ロケットを つくって、うちゅうを めざそう！', 'わからなく なったら、みみの ボタンを おしてね。 もういちど おはなし するよ。'],
      icon: ['🚀'], preset: [], wait: { type: 'speech' } },
    { say: ['うえに ならんでいるのが、ロケットの ぶひん だよ。', 'まどを タップして えらんでみよう。'],
      icon: ['win'], allow: ['win'], deselect: true, hl: { pal: 'win' }, wait: { type: 'select', part: 'win' } },
    { say: ['いいね！ つぎは、したの マスを タップしてね。 ぶひんが おけるよ。'],
      icon: ['win'], allow: ['win'], hl: { cell: [RB, 2] }, wait: { type: 'grid', test: a => a.n.win >= 1 } },
    { say: ['じょうず！ おいた ぶひんを もういちど タップすると、けせるよ。 けしてみよう。'],
      icon: ['win', '👆'], allow: ['win'], hl: { cell: [RB, 2] }, wait: { type: 'remove' } },
    { say: ['ぶひんは、したから じゅんばんに つみかさなるよ。', 'まどを みっつ、たてに つんでみよう。'],
      icon: ['win', 'win', 'win'], allow: ['win'], hl: { cols: [2] }, wait: { type: 'grid', test: a => a.n.win >= 3 } },
    // ---- 2 ぶひんの いみ
    { say: ['かっこいい！ でも、まど だけで とべるかな？', 'あかい ボタンを おして、はっしゃ してみよう！'],
      icon: ['win', '❓'], allow: [], hl: { el: 'launch' }, wait: { type: 'launchFail' },
      after: () => ['あれれ？ とばないね。', 'ロケットを おしあげる、エンジンが ないからだよ。'] },
    { say: ['ゴミばこの ボタンを おすと、ぜんぶ けせるよ。 おしてみて。'],
      icon: ['🗑️'], allow: [], hl: { el: 'clear' }, wait: { type: 'clear' } },
    { say: ['これが エンジン。 ほのおを だして、ロケットを おしあげるよ。', 'エンジンを えらんで、いちばん したに おいてね。'],
      icon: ['engine'], allow: ['engine'], deselect: true, hl: { pal: 'engine' }, wait: { type: 'grid', test: a => a.n.engine >= 1 } },
    { say: ['エンジンの うえに、まどを のせよう。 うちゅうひこうしが のるよ。'],
      icon: ['engine', 'win'], allow: ['win'], deselect: true, hl: { pal: 'win' }, wait: { type: 'grid', test: a => a.n.engine >= 1 && a.n.win >= 1 } },
    { say: ['さあ、はっしゃ！'], icon: ['🚀'], allow: [], hl: { el: 'launch' }, wait: { type: 'result' },
      after: () => ['とんだね！ でも、すぐに おちちゃった。', 'エンジンの なかには、ねんりょうが すこし しか ないんだ。'] },
    { say: ['しろと あかの タンクは、ねんりょうの いれもの だよ。', 'エンジンの うえに、タンクを ひとつ のせてね。'],
      icon: ['tank'], preset: [[], [], ['engine'], [], []], allow: ['tank'], deselect: true, hl: { pal: 'tank' }, wait: { type: 'grid', test: a => a.n.tank >= 1 } },
    { say: ['はっしゃ してみよう！'], icon: ['engine', 'tank'], allow: [], hl: { el: 'launch' }, wait: { type: 'result' },
      after: () => ['さっきより たかく とんだね！ ねんりょうが あると、エンジンが ながく もえるんだ。', 'でも ロケットが かたむいて、ぐらぐら してたの、きづいた？'] },
    { say: ['きいろい はねを、エンジンの りょうがわに つけよう。', 'はねが あると、くうきの なかで まっすぐ とべるよ。'],
      icon: ['fin', 'engine', 'fin'], allow: ['fin'], deselect: true, hl: { cols: [1, 3] }, wait: { type: 'grid', test: a => a.coreFin.L >= 1 && a.coreFin.R >= 1 } },
    { say: ['はっしゃ！'], icon: ['fin', 'engine', 'fin'], allow: [], hl: { el: 'launch' }, wait: { type: 'result' },
      after: s => [s.h > prevH() ? 'まっすぐ とんで、もっと たかく なったね！' : 'まっすぐ とんだね！'] },
    { say: ['あかい さきっぽを、いちばん うえに のせてね。', 'とがっていると、くうきを きりさいて、はやく とべるよ。'],
      icon: ['nose'], allow: ['nose'], deselect: true, hl: { pal: 'nose' }, wait: { type: 'grid', test: a => a.noseCover > 0 } },
    { say: ['はっしゃ！'], icon: ['nose', 'tank', 'engine'], allow: [], hl: { el: 'launch' }, wait: { type: 'result' },
      after: s => [s.h >= RL.CFG.PHYS.ATMO_H ? 'すごい！ てんせんを こえて、うちゅうに でたよ！' : 'もうすこしで うちゅう だね！', 'これで、りっぱな ロケットの かんせいだ！'] },
    // ---- 3 ねんりょうを ふやす
    { say: ['つぎは、ねんりょうを ふやすと どうなるか、しらべよう。', 'タンクを あと ふたつ つんで、ぜんぶで みっつに してね。'],
      icon: ['tank', 'tank', 'tank'], preset: [[], ['fin'], ['engine', 'tank'], ['fin'], []], allow: ['tank'], deselect: true, hl: { pal: 'tank' },
      wait: { type: 'grid', test: a => a.n.tank >= 3 } },
    { say: ['こんどは、ひだりしたの スピードメーターを よく みててね。 はっしゃ！'], icon: ['⏱️'], allow: [], hl: { el: 'launch' }, wait: { type: 'result' },
      after: () => ['ぐーんと たかく なったね！', 'でだしは ゆっくり だったけど、だんだん はやく なったでしょう？', 'ねんりょうは おもいんだ。 もえて かるく なると、どんどん はやく なるんだよ。'] },
    { say: ['もっと ふやしたら、もっと たかく とべるかな？', 'タンクを ぜんぶで むっつに してみよう。'],
      icon: ['tank', '✖️', '6️⃣'], allow: ['tank'], deselect: true, hl: { pal: 'tank' }, wait: { type: 'grid', test: a => a.n.tank >= 6 } },
    { say: ['はっしゃ！ でだしを よく みてね。'], icon: ['🐢'], allow: [], hl: { el: 'launch' }, wait: { type: 'result' },
      after: s => ['でだしが、とっても ゆっくり だったね。', s.h > prevH() * 1.15 ? 'たかくは なったけど、ねんりょうが おおいほど、ロケットは おもく なるんだ。' : 'あまり たかく ならなかったね。 ねんりょうが おおいと、そのぶん おもく なるんだ。'] },
    { say: ['もっと つんじゃおう！ はねの うえに、タンクを ひとつずつ おいてね。 りょうがわ だよ。'],
      icon: ['tank', 'tank'], allow: ['tank'], deselect: true, hl: { cols: [1, 3] }, wait: { type: 'grid', test: a => a.n.tank >= 8 } },
    { say: ['はっしゃ！ オレンジの やじるしと、あおい やじるしを みててね。'], icon: ['🏋️'], allow: [], hl: { el: 'launch' }, wait: { type: 'result' },
      after: s => ['オレンジは エンジンが おす ちから。 あおは ロケットの おもさ だよ。',
        s.lift ? 'さいしょは あおの ほうが ながくて、うごけなかったね。 ねんりょうが もえて かるく なったら、やっと とびはじめた！' : 'あおの ほうが ずっと ながくて、さいごまで うごけなかった！',
        'おもすぎると、とぶまえに ねんりょうを むだに つかっちゃうんだ。'] },
    // ---- 4 エンジンを ふやす
    { say: ['じゃあ、エンジンを ふやしたら どうなるかな？', 'ひかっている ところに、エンジンを おいてみよう。'],
      icon: ['engine', '➕', 'engine'], preset: [['fin'], [], ['engine', ...T(6)], ['tank', 'tank'], ['fin']], allow: ['engine'], deselect: true,
      hl: { cell: [RB, 1] }, wait: { type: 'grid', test: a => a.n.engine >= 2 } },
    { say: ['はっしゃ！'], icon: ['engine', 'engine'], allow: [], hl: { el: 'launch' }, wait: { type: 'result' },
      after: () => ['すぐに とんだ！ オレンジの やじるしが ながく なったでしょう？ エンジンが ふたつ だと、おす ちからも ふたつぶん。 おもい ロケットも もちあげられるんだ。', 'でも、エンジンも おもいし、ねんりょうも はやく つかっちゃう。 ちからと おもさの バランスが だいじ なんだよ。'] },
    // ---- 5 ブースター
    { say: ['こんどは、しろくて ほそい ブースター。', 'つよい ちからで いっきに もえる、とくべつな ロケットだよ。 ながく つむほど、つよく、ながく もえるよ。', 'ブースターは、どうたいの となりに つけるよ。 はねの うえに、ふたつずつ つもう。 りょうがわ だよ。'],
      icon: ['booster', 'booster'], preset: [[], ['fin'], ['engine', ...T(5), 'nose'], ['fin'], []], allow: ['booster'], deselect: true,
      hl: { cols: [1, 3] }, wait: { type: 'grid', test: a => a.stacks.length >= 2 && a.stacks.every(s => s.seg >= 2) } },
    { say: ['はっしゃ！ ブースターが どうなるか、みててね。'], icon: ['booster', '👀'], allow: [], hl: { el: 'launch' }, wait: { type: 'result' },
      after: () => ['ブースターは もえつきると、かってに はずれたね！ オレンジの やじるしが みじかく なって、あおい やじるしも みじかく なったよ。', 'からっぽの いれものを すてると、かるく なって、もっと たかく いけるんだ。'] },
    { say: ['ところで、はねは くうきの なかで まっすぐ とぶための もの。', 'てんせんの うえは、くうきの ない うちゅう。 うちゅうでは、はねは ただの おもりに なっちゃうんだ。'],
      icon: ['fin', '🌌', '🪨'], allow: [], wait: { type: 'speech' } },
    { say: ['それなら、はねを ブースターに つけて、いっしょに すてちゃおう！', 'ブースターを ながく したよ。 そとがわに はねを つけてね。'],
      icon: ['fin', 'booster'], preset: [[], BS(4), ['engine', ...T(5), 'nose'], BS(4), []], allow: ['fin'], deselect: true,
      hl: { cols: [0, 4] }, wait: { type: 'grid', test: a => a.boosterFins >= 2 && a.stacks.every(s => s.fins.length >= 1) } },
    { say: ['はっしゃ！ くうきが なくなる ころに、はねも いっしょに はずれるよ。'], icon: ['fin', '👋'], allow: [], hl: { el: 'launch' }, wait: { type: 'result' },
      after: s => [s.h > prevH() ? 'いらなく なった はねも すてたら、さっきより たかく とべたね！' : 'はねも いっしょに すてられたね！'] },
    // ---- 6 だんに わける
    { say: ['ブースターは かってに はずれたね。 こんどは、はずれる ばしょを じぶんで きめよう！', 'くろと きいろの リングで、ロケットを ふたつの だんに わけられるよ。', 'ねんりょうの うえに、リングを のせてね。'],
      icon: ['ring'], preset: [[], ['fin'], ['engine', ...T(3)], ['fin'], []], allow: ['ring'], deselect: true, hl: { cols: [2] },
      wait: { type: 'grid', test: a => a.n.ring >= 1 && a.nStages >= 2 } },
    { say: ['いろが かわったね。 オレンジが いちだんめ、みずいろが にだんめ だよ。', 'リングの うえに、エンジンを のせよう。'],
      icon: ['ring', 'engine'], allow: ['engine'], deselect: true, hl: { cols: [2] }, wait: { type: 'grid', test: a => a.nStages >= 2 && inStage(a, 1, 'engine') >= 1 } },
    { say: ['エンジンの うえに、タンクを ふたつ のせてね。'],
      icon: ['tank', 'tank'], allow: ['tank'], deselect: true, hl: { cols: [2] }, wait: { type: 'grid', test: a => a.nStages >= 2 && inStage(a, 1, 'tank') >= 2 } },
    { say: ['はっしゃ！ いちだんめが はずれるところを みててね。'], icon: ['ring', '👀'], allow: [], hl: { el: 'launch' }, wait: { type: 'result' },
      after: () => ['いちだんめは もえつきると、リングごと はずれたね！', 'からっぽの いれものと エンジンを すてて、かるく なった にだんめが とんでいったんだ。'] },
    { say: ['あたらしい エンジンを しょうかい するよ。 あおい エンジンは、うちゅうよう エンジン。', 'くうきの なかでは よわいけど、うちゅうでは つよくて、ねんりょうが ながもち するんだ。', 'にだんめを、うちゅうよう エンジンで つくろう。 リングの うえに おいてね。'],
      icon: ['vengine'], preset: [[], ['fin'], ['engine', ...T(3), 'ring'], ['fin'], []], allow: ['vengine'], deselect: true, hl: { cols: [2] },
      wait: { type: 'grid', test: a => a.nStages >= 2 && inStage(a, 1, 'vengine') >= 1 } },
    { say: ['うえに タンクを ふたつ のせてね。'],
      icon: ['tank', 'tank'], allow: ['tank'], deselect: true, hl: { cols: [2] }, wait: { type: 'grid', test: a => a.nStages >= 2 && inStage(a, 1, 'tank') >= 2 } },
    { say: ['はっしゃ！ あおい ほのおを よく みててね。'], icon: ['vengine', '👀'], allow: [], hl: { el: 'launch' }, wait: { type: 'result' },
      after: s => [s.h > prevH() ? 'さっきより ずっと たかく とんだ！' : 'とんだね！', 'うちゅうに でたら、あおい ほのおが おおきく なって、オレンジの やじるしも のびたでしょう？'] },
    { say: ['ぎゃくに したら どうなるかな？', 'したの だんを うちゅうよう、うえの だんを ちじょうよう エンジンに したよ。 はっしゃ！'],
      icon: ['vengine', '❓', 'engine'], preset: [[], ['fin'], ['vengine', 'tank', 'ring', 'engine', ...T(2)], ['fin'], []], allow: [], hl: { el: 'launch' }, wait: { type: 'result' },
      after: () => ['いちだんめは、ぜんぜん うごけなかったね。 うちゅうよう エンジンは、くうきの なかでは よわいんだ。', 'したの だんは ちから もち、うえの だんは ながもち。 これが ロケットの ひみつ だよ。'] },
    // ---- おわり
    { say: ['これで きみも、ロケット はかせ！', 'さいごの ヒント。 したの だんに ブースターを つけて、うえに うちゅうよう の だんを のせると…', 'どせいまで、とどく かも！ さあ、じゆうに つくって みよう！', 'つぎは、ちずの ボタンの ミッションで、うちゅうに ちょうせん しよう！'],
      icon: ['🎓', '🪐'], allow: [], wait: { type: 'speech' } }
  ];

  let i = -1, step = null, active = false, spoken = false, met = false, canLaunch = false, canClear = false, metData = null, token = 0;

  function toGrid(cols) { const R = RL.CFG.ROWS, g = Array.from({ length: R }, () => Array(RL.CFG.COLS).fill(null)); cols.forEach((s, c) => s.forEach((k, j) => g[R - 1 - j][c] = k)); return g; }
  function iconHTML(list) { return (list || []).map(k => RL.PART_ORDER.includes(k) ? RL.paletteIcon(k) : `<span class="em">${k}</span>`).join(''); }

  function colCells() {
    const g = B().grid, R = RL.CFG.ROWS, part = (step.allow || [])[0];
    return step.hl.cols.map(c => { let r = -1; for (let x = R - 1; x >= 0; x--) if (!g[x][c]) { r = x; break; }
      return { c, r, n: g.reduce((z, row) => z + (row[c] === part ? 1 : 0), 0) }; }).filter(x => x.r >= 0);
  }
  function updateHL() {
    if (!step || !step.hl) { B().highlightCell(null); return; }
    if (step.hl.cols) B().highlightCell(met ? null : colCells().map(x => [x.r, x.c]));
    else B().highlightCell(step.hl.cell && !met ? step.hl.cell : null);
  }
  function placeBubble() {
    const l = $('ladder').getBoundingClientRect(), bb = $('tutBubble');
    bb.style.left = (l.left + l.width / 2 - 32) + 'px'; bb.style.top = (l.top + 4) + 'px'; bb.style.maxHeight = (l.height - 8) + 'px';
  }
  function clearHL() { document.querySelectorAll('.hl').forEach(e => { if (!e.classList.contains('cell')) e.classList.remove('hl'); }); $('tutHand').style.display = 'none'; }
  function target() {
    const h = step && step.hl; if (!h) return null;
    if (h.cols) { const cs = colCells(); if (!cs.length) return null; const m = cs.reduce((a, b) => b.n < a.n ? b : a); return document.querySelector(`.cell[data-r="${m.r}"][data-c="${m.c}"]`); }
    if (h.pal) return document.querySelector(`.pal[data-k="${h.pal}"]`);
    if (h.cell) return document.querySelector(`.cell[data-r="${h.cell[0]}"][data-c="${h.cell[1]}"]`);
    if (h.el) return $(h.el);
  }
  function placeHand() {
    if (!active || !step || met) { $('tutHand').style.display = 'none'; return; }
    clearHL(); const el = target(); if (!el) return;
    if (!el.classList.contains('cell')) el.classList.add('hl');
    const r = el.getBoundingClientRect(), hd = $('tutHand');
    hd.style.display = 'block'; hd.style.left = (r.left + r.width / 2) + 'px'; hd.style.top = (r.top + r.height * 0.55) + 'px';
  }
  function talk(lines, cb) {
    const my = ++token; $('tutBubble').classList.add('talk');
    let n = 0; const nx = () => { if (my !== token) return; if (n >= lines.length) { $('tutBubble').classList.remove('talk'); cb && cb(); return; } A.say(lines[n++], nx, { interrupt: n === 1 }); };
    nx();
  }

  function go(n) {
    i = n; step = STEPS[i];
    if (!step) return finish();
    spoken = false; met = false; metData = null;
    if (step.preset) B().setGrid(toGrid(step.preset));
    B().setAllowed(step.allow || []); if (step.deselect) B().select(null);
    B().lockGrid(!(step.allow && step.allow.length));
    canLaunch = ['result', 'launchFail'].includes(step.wait.type); canClear = step.wait.type === 'clear';
    $('launch').classList.toggle('off', !canLaunch); $('clear').classList.toggle('off', !canClear);
    $('tutIcon').innerHTML = iconHTML(step.icon); $('tutBubble').style.display = 'flex'; placeBubble();
    if (step.wait.type === 'grid' && step.wait.test(an())) met = true;
    updateHL();
    setTimeout(placeHand, 50);
    talk(step.say, afterSpeech);
  }
  function afterSpeech() { if (!step) return; spoken = true; if (step.wait.type === 'speech') met = true; proceed(); }
  function complete(data) {
    if (!active || met) return;
    met = true; metData = data; canLaunch = false; $('launch').classList.add('off'); placeHand();
    // 発射の声が 説明を とめるので、発射した時点で「話しおわった」とみなす
    if (['result', 'launchFail'].includes(step.wait.type)) { spoken = true; token++; $('tutBubble').classList.remove('talk'); }
    updateHL();
    if (step.wait.type === 'result') results.push(data);
    proceed();
  }
  function proceed() {
    if (!met || !spoken) return;
    const cur = i, after = step.after ? step.after(metData) : null;
    const next = () => { if (cur === i) go(i + 1); };
    if (step.wait.type === 'result') setTimeout(() => { RL.closeResult(); after ? talk(after, next) : next(); }, 2300);
    else if (after) setTimeout(() => talk(after, next), 300);
    else setTimeout(next, 250);
  }

  RL.on('select', k => { if (step && step.wait.type === 'select' && k === step.wait.part) complete(); });
  RL.on('change', d => {
    if (!step) return;
    if (step.wait.type === 'grid') { if (step.wait.test(an())) complete(); else updateHL(); }
    if (step.wait.type === 'remove' && d.action === 'remove') complete();
    if (step.wait.type === 'clear' && d.action === 'clear') complete();
  });
  RL.on('launch-fail', r => { if (step && step.wait.type === 'launchFail') complete(r); });
  RL.on('result', s => { if (step && step.wait.type === 'result') complete(s); });
  RL.on('rendered', () => setTimeout(placeHand, 0));
  addEventListener('resize', () => setTimeout(() => { placeHand(); if (active) placeBubble(); }, 50));
  // みみボタン：話しなおしても、おわったら 次へ すすむ
  $('tutEar').addEventListener('click', () => { if (active && step && !(met && spoken)) talk(step.say, afterSpeech); });

  function start() { active = true; results = []; B().resetRecords(); go(0); }
  function hideUI() { $('tutBubble').style.display = 'none'; clearHL(); B().highlightCell(null); $('launch').classList.remove('off'); $('clear').classList.remove('off'); }
  function finish() { active = false; step = null; hideUI(); RL.startFree(); }
  function stop() { if (!active) return; active = false; step = null; token++; hideUI(); }

  return { start, stop, get active() { return active; }, get canLaunch() { return canLaunch; }, get canClear() { return canClear; }, get step() { return i; }, STEPS, _go: go };
})();
