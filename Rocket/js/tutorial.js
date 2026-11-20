// チュートリアル：声で あんない。文字は 使わない。
// 1ステップ ＝ { say:[話すこと], icon:[絵], preset:列の配置, allow:[使える部品], hl:どこを光らせるか,
//               wait:{type, ...}, after:(結果)=>[話すこと] }
// wait.type: speech（話しおわったら次）/ select（部品をえらぶ）/ grid（組み立てが条件をみたす）/
//            remove（ぶひんを けす）/ clear（ぜんぶけす）/ launchFail（とばない）/ result（とんだ結果）
RL.Tutorial = (function () {
  const $ = id => document.getElementById(id), A = RL.Audio, B = () => RL.Builder;
  const T = n => Array(n).fill('tank'), BS = n => Array(n).fill('booster');
  const an = () => RL.analyze(B().grid);
  const fins = a => a.coreFin.L + a.coreFin.R + a.coreFin.M;
  let results = [];               // チュートリアルで飛ばした結果（くらべるため）
  const last = (n = 1) => results[results.length - n];

  const STEPS = [
    // ---- 0 そうさ
    { say: ['ロケットラボへ ようこそ！', 'いっしょに ロケットを つくって、うちゅうを めざそう！', 'わからなく なったら、この みみの ボタンを おしてね。 もういちど おはなし するよ。'],
      icon: ['🚀'], preset: [], hl: { el: 'tutEar' }, wait: { type: 'speech' } },
    { say: ['うえに ならんでいるのが、ロケットの ぶひん だよ。', 'まどを タップして えらんでみよう。'],
      icon: ['win'], allow: ['win'], deselect: true, hl: { pal: 'win' }, wait: { type: 'select', part: 'win' } },
    { say: ['いいね！ つぎは、したの マスを タップしてね。 ぶひんが おけるよ。'],
      icon: ['win'], allow: ['win'], hl: { cell: [6, 2] }, wait: { type: 'grid', test: a => a.n.win >= 1 } },
    { say: ['じょうず！ おいた ぶひんを もういちど タップすると、けせるよ。 けしてみよう。'],
      icon: ['win', '👆'], allow: ['win'], hl: { cell: [6, 2] }, wait: { type: 'remove' } },
    { say: ['ぶひんは、したから じゅんばんに つみかさなるよ。', 'まどを みっつ、たてに つんでみよう。'],
      icon: ['win', 'win', 'win'], allow: ['win'], hl: { cell: [6, 2] }, wait: { type: 'grid', test: a => a.n.win >= 3 } },
    // ---- 1 ぶひんの いみ
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
      icon: ['fin', 'engine', 'fin'], allow: ['fin'], deselect: true, hl: { cell: [6, 1] }, wait: { type: 'grid', test: a => a.coreFin.L >= 1 && a.coreFin.R >= 1 } },
    { say: ['はっしゃ！'], icon: ['fin', 'engine', 'fin'], allow: [], hl: { el: 'launch' }, wait: { type: 'result' },
      after: s => [s.h > (last(2) ? last(2).h : 0) ? 'まっすぐ とんで、もっと たかく なったね！' : 'まっすぐ とんだね！'] },
    { say: ['さいごは、あかい さきっぽ。 いちばん うえに のせてね。', 'とがっていると、くうきを きりさいて、はやく とべるよ。'],
      icon: ['nose'], allow: ['nose'], deselect: true, hl: { pal: 'nose' }, wait: { type: 'grid', test: a => a.noseCover > 0 } },
    { say: ['はっしゃ！'], icon: ['nose', 'tank', 'engine'], allow: [], hl: { el: 'launch' }, wait: { type: 'result' },
      after: s => [s.h >= RL.CFG.PHYS.ATMO_H ? 'すごい！ てんせんを こえて、うちゅうに でたよ！' : 'もうすこしで うちゅう だね！', 'これで、りっぱな ロケットの かんせいだ！'] },
    // ---- 2 ねんりょうを ふやす
    { say: ['つぎは、ねんりょうを ふやすと どうなるか、しらべよう。', 'タンクを あと ふたつ つんで、ぜんぶで みっつに してね。'],
      icon: ['tank', 'tank', 'tank'], preset: [[], ['fin'], ['engine', 'tank'], ['fin'], []], allow: ['tank'], deselect: true, hl: { pal: 'tank' },
      wait: { type: 'grid', test: a => a.n.tank >= 3 } },
    { say: ['こんどは、ひだりしたの スピードメーターを よく みててね。 はっしゃ！'], icon: ['⏱️'], allow: [], hl: { el: 'launch' }, wait: { type: 'result' },
      after: () => ['ぐーんと たかく なったね！', 'でだしは ゆっくり だったけど、だんだん はやく なったでしょう？', 'ねんりょうは おもいんだ。 もえて かるく なると、どんどん はやく なるんだよ。'] },
    { say: ['もっと ふやしたら、もっと たかく とべるかな？', 'タンクを ぜんぶで むっつに してみよう。'],
      icon: ['tank', '✖️', '6️⃣'], allow: ['tank'], deselect: true, hl: { pal: 'tank' }, wait: { type: 'grid', test: a => a.n.tank >= 6 } },
    { say: ['はっしゃ！ でだしを よく みてね。'], icon: ['🐢'], allow: [], hl: { el: 'launch' }, wait: { type: 'result' },
      after: s => ['でだしが、とっても ゆっくり だったね。', s.h > (last(2) ? last(2).h : 0) * 1.15 ? 'たかくは なったけど、ねんりょうが おおいほど、ロケットは おもく なるんだ。' : 'あまり たかく ならなかったね。 ねんりょうが おおいと、そのぶん おもく なるんだ。'] },
    { say: ['もっと つんじゃおう！ はねの うえに、タンクを ひとつずつ おいてね。 りょうがわ だよ。'],
      icon: ['tank', 'tank'], allow: ['tank'], deselect: true, hl: { cell: [5, 1] }, wait: { type: 'grid', test: a => a.n.tank >= 8 } },
    { say: ['はっしゃ！ オレンジの やじるしと、あおい やじるしを みててね。'], icon: ['🏋️'], allow: [], hl: { el: 'launch' }, wait: { type: 'result' },
      after: s => ['オレンジは エンジンが おす ちから。 あおは ロケットの おもさ だよ。',
        s.lift ? 'さいしょは あおの ほうが ながくて、うごけなかったね。 ねんりょうが もえて かるく なったら、やっと とびはじめた！' : 'あおの ほうが ずっと ながくて、さいごまで うごけなかった！',
        'おもすぎると、とぶまえに ねんりょうを むだに つかっちゃうんだ。'] },
    // ---- 3 エンジンを ふやす
    { say: ['じゃあ、エンジンを ふやしたら どうなるかな？', 'ひかっている ところに、エンジンを おいてみよう。'],
      icon: ['engine', '➕', 'engine'], preset: [['fin'], [], ['engine', ...T(6)], ['tank', 'tank'], ['fin']], allow: ['engine'], deselect: true,
      hl: { cell: [6, 1] }, wait: { type: 'grid', test: a => a.n.engine >= 2 } },
    { say: ['はっしゃ！'], icon: ['engine', 'engine'], allow: [], hl: { el: 'launch' }, wait: { type: 'result' },
      after: () => ['すぐに とんだ！ オレンジの やじるしが ながく なったでしょう？ エンジンが ふたつ だと、おす ちからも ふたつぶん。 おもい ロケットも もちあげられるんだ。', 'でも、エンジンも おもいし、ねんりょうも はやく つかっちゃう。 ちからと おもさの バランスが だいじ なんだよ。'] },
    // ---- 4 ブースターと だん
    { say: ['こんどは、しろくて ほそい ブースター。', 'つよい ちからで いっきに もえる、とくべつな ロケットだよ。 ながく つむほど、つよく、ながく もえるよ。', 'はねの うえに、ブースターを ふたつずつ つもう。 りょうがわ だよ。'],
      icon: ['booster', 'booster'], preset: [[], ['fin'], ['engine', ...T(5), 'nose'], ['fin'], []], allow: ['booster'], deselect: true,
      hl: { cell: [5, 1] }, wait: { type: 'grid', test: a => a.stacks.length >= 2 && a.stacks.every(s => s.seg >= 2) } },
    { say: ['はっしゃ！ ブースターが どうなるか、みててね。'], icon: ['booster', '👀'], allow: [], hl: { el: 'launch' }, wait: { type: 'result' },
      after: () => ['ブースターは もえつきると、かってに はずれたね！ オレンジの やじるしが みじかく なって、あおい やじるしも みじかく なったよ。', 'からっぽの いれものを すてると、かるく なって、もっと たかく いけるんだ。', 'これが、ロケットを だんに わける ひみつ だよ。'] },
    { say: ['ところで、はねは くうきの なかで まっすぐ とぶための もの。', 'てんせんの うえは、くうきの ない うちゅう。 うちゅうでは、はねは ただの おもりに なっちゃうんだ。'],
      icon: ['fin', '🌌', '🪨'], allow: [], wait: { type: 'speech' } },
    { say: ['それなら、はねを ブースターに つけて、いっしょに すてちゃおう！', 'ブースターを ながく したよ。 そとがわに はねを つけてね。'],
      icon: ['fin', 'booster'], preset: [[], BS(4), ['engine', ...T(5), 'nose'], BS(4), []], allow: ['fin'], deselect: true,
      hl: { cell: [6, 0] }, wait: { type: 'grid', test: a => a.boosterFins >= 2 && a.stacks.every(s => s.fins.length >= 1) } },
    { say: ['はっしゃ！ くうきが なくなる ころに、はねも いっしょに はずれるよ。'], icon: ['fin', '👋'], allow: [], hl: { el: 'launch' }, wait: { type: 'result' },
      after: s => [s.h > (last(2) ? last(2).h : 0) ? 'いらなく なった はねも すてたら、さっきより たかく とべたね！' : 'はねも いっしょに すてられたね！'] },
    // ---- おわり
    { say: ['これで きみも、ロケット はかせ！', 'どせいは とおくて、まだ とどかない。 いつか、もっと すごい ロケットで いこうね。', 'さあ、じゆうに つくって みよう！'],
      icon: ['🎓', '🪐'], allow: [], wait: { type: 'speech' } }
  ];

  let i = -1, step = null, active = false, spoken = false, met = false, finished = false, canLaunch = false, canClear = false, metData = null, token = 0;

  function toGrid(cols) { const R = RL.CFG.ROWS, g = Array.from({ length: R }, () => Array(RL.CFG.COLS).fill(null)); cols.forEach((s, c) => s.forEach((k, j) => g[R - 1 - j][c] = k)); return g; }
  function iconHTML(list) { return (list || []).map(k => RL.PART_ORDER.includes(k) ? RL.paletteIcon(k) : `<span class="em">${k}</span>`).join(''); }

  function clearHL() { document.querySelectorAll('.hl').forEach(e => { if (!e.classList.contains('cell')) e.classList.remove('hl'); }); $('tutHand').style.display = 'none'; }
  function target() {
    const h = step && step.hl; if (!h) return null;
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
    B().highlightCell(step.hl && step.hl.cell ? step.hl.cell : null);
    canLaunch = ['result', 'launchFail'].includes(step.wait.type); canClear = step.wait.type === 'clear';
    $('launch').classList.toggle('off', !canLaunch); $('clear').classList.toggle('off', !canClear);
    $('tutIcon').innerHTML = iconHTML(step.icon); $('tutBubble').style.display = 'flex';
    setTimeout(placeHand, 50);
    if (step.wait.type === 'grid' && step.wait.test(an())) met = true;   // はじめから できていたら
    talk(step.say, () => { spoken = true; if (step.wait.type === 'speech') met = true; proceed(); });
  }
  function complete(data) {
    if (!active || met) return;
    met = true; metData = data; canLaunch = false; $('launch').classList.add('off'); placeHand();
    B().highlightCell(null);
    if (step.wait.type === 'result') results.push(data);
    proceed();
  }
  function proceed() {
    if (!met || !spoken) return;
    const cur = i, after = step.after ? step.after(metData) : null;
    const next = () => { if (cur === i) go(i + 1); };
    if (step.wait.type === 'result') {   // けっかを すこし 見せてから
      setTimeout(() => { RL.closeResult(); after ? talk(after, next) : next(); }, 2300);
    } else if (after) setTimeout(() => talk(after, next), 300);
    else setTimeout(next, 250);
  }

  RL.on('select', k => { if (step && step.wait.type === 'select' && k === step.wait.part) complete(); });
  RL.on('change', d => {
    if (!step) return;
    if (step.wait.type === 'grid' && step.wait.test(an())) complete();
    if (step.wait.type === 'remove' && d.action === 'remove') complete();
    if (step.wait.type === 'clear' && d.action === 'clear') complete();
  });
  RL.on('launch-fail', r => { if (step && step.wait.type === 'launchFail') complete(r); });
  RL.on('result', s => { if (step && step.wait.type === 'result') complete(s); });
  RL.on('rendered', () => setTimeout(placeHand, 0));
  addEventListener('resize', () => setTimeout(placeHand, 50));
  document.getElementById('tutEar').addEventListener('click', () => { if (active && step) talk(step.say, () => { spoken = true; proceed(); }); });

  function start() { active = true; finished = false; results = []; B().resetRecords(); go(0); }
  function hideUI() { $('tutBubble').style.display = 'none'; clearHL(); B().highlightCell(null); $('launch').classList.remove('off'); $('clear').classList.remove('off'); }
  function finish() { active = false; finished = true; step = null; hideUI(); RL.startFree(); }
  function stop() { if (!active) return; active = false; step = null; token++; hideUI(); }

  return { start, stop, get active() { return active; }, get canLaunch() { return canLaunch; }, get canClear() { return canClear; }, get step() { return i; }, STEPS, _go: go };
})();
