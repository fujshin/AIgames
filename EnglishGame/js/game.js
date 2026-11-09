// =====================================================================
// えいたんクエスト  ゲーム本体
// - 学年 → 章（100語）→ ステージ（10語）＋ 章ボス
// - 出題：英→日 / 日→英 / リスニング / 例文の空所（4択）/ つづり並べ / 例文の空所（入力）
// - こたえたあとに 意味・型・例文を 表示（「つぎへ」を おすまで 進まない）
// - 間隔反復（SRS）：1→2→4→7→14→30日後に「おさらいの塔」へ
// - れんぞく記録：7日ごとに「おやすみ札」
// =====================================================================
const Game = (() => {
  const APP_VERSION = '1.7.0';
  const SAVE_KEY = 'eitanQuest_v1';
  const STAGE_SIZE = 10, CH_SIZE = 100;
  const INTERVAL_DAYS = [0, 1, 2, 4, 7, 14, 30];
  const MASTER_BOX = 4;
  const TIMER_SEC = 10, DAY = 86400000;
  const CRIT = { e2j: 3.5, j2e: 3.5, listen: 4, cloze: 6, spell: 9, clozeType: 10 };

  const $ = id => document.getElementById(id);
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = a => a[Math.random() * a.length | 0];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const todayStr = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  const dayIndex = s => { const [y, m, d] = s.split('-').map(Number); return Math.round(new Date(y, m - 1, d).getTime() / DAY); };
  const POS = { n: '名詞', v: '動詞', a: '形容詞', d: '副詞' };
  let toastT = null;
  function toast(msg, ms = 2400) { const el = $('toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), ms); }

  // ---------- 語形（例文の空所用） ----------
  const IRR = { go: 'went', come: 'came', get: 'got', see: 'saw', give: 'gave', find: 'found', tell: 'told', think: 'thought', make: 'made', take: 'took', know: 'knew', write: 'wrote', buy: 'bought', bring: 'brought', build: 'built', hear: 'heard', become: 'became', eat: 'ate', run: 'ran', begin: 'began', keep: 'kept', hold: 'held', pay: 'paid', spend: 'spent', catch: 'caught', teach: 'taught', sit: 'sat', stand: 'stood', read: 'read', put: 'put', meet: 'met', sell: 'sold', drive: 'drove', choose: 'chose', wear: 'wore', fight: 'fought', forget: 'forgot', drink: 'drank', sing: 'sang', fly: 'flew', throw: 'threw', ride: 'rode', feed: 'fed', hide: 'hid', wake: 'woke', swim: 'swam', leave: 'left', speak: 'spoke', lose: 'lost', grow: 'grew', draw: 'drew', win: 'won', break: 'broke', let: 'let', say: 'said', feel: 'felt', sleep: 'slept', send: 'sent', understand: 'understood', have: 'had', do: 'did', spell: 'spelled', fall: 'fell', lead: 'led', cut: 'cut', set: 'set', shut: 'shut', hit: 'hit', hurt: 'hurt', cost: 'cost', lend: 'lent', mean: 'meant', shake: 'shook', steal: 'stole', shoot: 'shot', lie: 'lay', lay: 'laid', rise: 'rose', bite: 'bit', blow: 'blew', freeze: 'froze', hang: 'hung', stick: 'stuck', strike: 'struck', tear: 'tore', bend: 'bent', bet: 'bet', deal: 'dealt', dig: 'dug', forgive: 'forgave', ring: 'rang', seek: 'sought', shine: 'shone', sink: 'sank', swing: 'swung', bear: 'bore', beat: 'beat', bind: 'bound', quit: 'quit', spread: 'spread', split: 'split', burst: 'burst', arise: 'arose', overcome: 'overcame', withdraw: 'withdrew', undergo: 'underwent', forbid: 'forbade', leap: 'leapt', bet: 'bet', burst: 'burst', broadcast: 'broadcast', forecast: 'forecast', rid: 'rid', slip: 'slipped', flee: 'fled', foresee: 'foresaw', overtake: 'overtook', overhear: 'overheard', mislead: 'misled', undertake: 'undertook', sweep: 'swept', spin: 'spun', found: 'founded', bind: 'bound', withdraw: 'withdrew', rebuild: 'rebuilt', mislead: 'misled', bleed: 'bled', forgive: 'forgave', light: 'lit', slide: 'slid', seek: 'sought', show: 'showed' };
  const IRR_PL = { child: 'children', tooth: 'teeth', leaf: 'leaves', man: 'men', woman: 'women', foot: 'feet', mouse: 'mice', knife: 'knives', shelf: 'shelves', person: 'people', sheep: 'sheep', life: 'lives', wife: 'wives', half: 'halves', thief: 'thieves', wolf: 'wolves', fish: 'fish', crisis: 'crises', analysis: 'analyses', mathematics: 'mathematics', glasses: 'glasses', aircraft: 'aircraft', headquarters: 'headquarters', outskirts: 'outskirts', earnings: 'earnings', species: 'species', data: 'data', series: 'series', means: 'means', news: 'news', jeans: 'jeans', clothes: 'clothes', trousers: 'trousers', pants: 'pants', politics: 'politics', economics: 'economics', basis: 'bases', phenomenon: 'phenomena', criterion: 'criteria' };
  function formOf(w) {
    const a = w.ans.toLowerCase(), b = w.en;
    if (a === b) return 'base';
    if (a.endsWith('ing') && !b.endsWith('ing')) return 'ing';
    if (w.pos === 'n') return 'pl';
    if (w.pos === 'v') {
      if (a === b + 's' || a === b + 'es' || (b.endsWith('y') && a === b.slice(0, -1) + 'ies')) return '3s';
      return 'past';
    }
    if (w.pos === 'a' && a.endsWith('er')) return 'er';
    if (w.pos === 'a' && a.endsWith('est')) return 'est';
    return 'other';
  }
  const FORM_LABEL = { ing: '-ing形', pl: '複数形', '3s': '3人称単数', past: '過去形・過去分詞', er: '比較級', est: '最上級' };
  const vowel = c => 'aeiou'.includes(c);
  function plural(b) {
    if (IRR_PL[b]) return IRR_PL[b];
    if (/(s|x|z|ch|sh)$/.test(b) || ['potato', 'tomato', 'hero', 'echo', 'volcano'].includes(b)) return b + 'es';
    if (b.endsWith('y') && !vowel(b[b.length - 2])) return b.slice(0, -1) + 'ies';
    return b + 's';
  }
  function third(b) {
    if (b === 'have') return 'has';
    if (/(s|x|z|ch|sh|o)$/.test(b)) return b + 'es';
    if (b.endsWith('y') && !vowel(b[b.length - 2])) return b.slice(0, -1) + 'ies';
    return b + 's';
  }
  // 子音字を 重ねる 動詞（hit → hitting, stop → stopped）
  const DOUBLE = new Set('hit fit run swim sit get put shop stop plan cut set begin win drop admit shut bet dig forget occur prefer refer regret permit commit control transfer slip stir rid trap plan chat nod knit ban clap equip'.split(' '));
  const dbl = b => DOUBLE.has(b) && !/(it|et|ut|at)$/.test(b) || ['hit', 'fit', 'sit', 'get', 'put', 'cut', 'set', 'bet', 'shut', 'admit', 'forget', 'permit', 'commit', 'regret', 'chat', 'pat', 'knit'].includes(b) ? b + b[b.length - 1] : b;
  function inflect(w, form) {
    const b = w.en;
    switch (form) {
      case 'pl': return plural(b);
      case '3s': return third(b);
      case 'ing': return b.endsWith('ie') ? b.slice(0, -2) + 'ying' : (b.endsWith('e') && !b.endsWith('ee')) ? b.slice(0, -1) + 'ing' : dbl(b) + 'ing';
      case 'past': return IRR[b] || (b.endsWith('e') ? b + 'd' : (b.endsWith('y') && !vowel(b[b.length - 2])) ? b.slice(0, -1) + 'ied' : dbl(b) + 'ed');
      case 'er': return b.endsWith('e') ? b + 'r' : (b.endsWith('y') && !vowel(b[b.length - 2])) ? b.slice(0, -1) + 'ier' : b + 'er';
      case 'est': return b.endsWith('e') ? b + 'st' : (b.endsWith('y') && !vowel(b[b.length - 2])) ? b.slice(0, -1) + 'iest' : b + 'est';
      default: return b;
    }
  }
  const capLike = (s, ref) => ref[0] === ref[0].toUpperCase() && ref[0] !== ref[0].toLowerCase() ? s[0].toUpperCase() + s.slice(1) : s;

  // ---------- 単語データの準備 ----------
  const ALL = [];
  for (const g of GRADES) {
    g.list = (WORDS[g.id] || []).map(([en, pos, ja, pat, ex, exj], i) => {
      const m = ex.match(/\[([^\]]+)\]/);
      const w = { en, pos, ja, pat, ex, exj, grade: g.id, i, ans: m ? m[1] : en, plain: ex.replace(/[\[\]]/g, '') };
      w.senses = ja.split(/[／・（）()]/).map(s => s.trim()).filter(Boolean);
      w.form = formOf(w);
      return w;
    });
    g.chapters = Math.ceil(g.list.length / CH_SIZE);
    ALL.push(...g.list);
  }
  const WMAP = Object.fromEntries(ALL.map(w => [w.grade + ':' + w.en, w]));
  const keyOf = w => w.grade + ':' + w.en;
  const gradeOf = id => GRADES.find(g => g.id === id);
  const chWords = (g, c) => g.list.slice(c * CH_SIZE, (c + 1) * CH_SIZE);
  const chStages = (g, c) => Math.ceil(chWords(g, c).length / STAGE_SIZE);
  const sameMeaning = (a, b) => a.senses.some(s => b.senses.includes(s));

  function iconHTML(path, emoji) {
    return `<img src="${path}" alt="" onerror="this.replaceWith(document.createTextNode('${emoji}'))">`;
  }

  // ---------- セーブ ----------
  let S = null;
  function defaultSave(name) {
    return {
      name, lv: 1, xp: 0, created: Date.now(), cleared: {}, words: {}, dex: {},
      streak: { last: null, count: 0, best: 0, freeze: 0 },
      settings: { sound: true, voice: true, think: false, rate: 0.9, exVoice: true, autoNext: false },
      tab: 'j1', open: {}, unlock: {}, placement: null
    };
  }
  function load() {
    try { S = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { S = null; }
    if (!S) return;
    for (const g of GRADES) { const c = S.cleared[g.id]; if (Array.isArray(c) || (c && !c.s)) S.cleared[g.id] = { s: [], b: [] }; }
    S.open = S.open || {};
    if (S.settings.exVoice === undefined) S.settings.exVoice = true;
    if (S.settings.autoNext === undefined) S.settings.autoNext = false;
    // v1.1 までは 単語のキーが 英単語だけ → 中1のキーに 移す
    const moved = {};
    const byEn = {};
    for (const w of ALL) if (!byEn[w.en]) byEn[w.en] = keyOf(w);
    for (const [k, v] of Object.entries(S.words)) {
      let key = k.includes(':') ? k : 'j1:' + k;
      if (!WMAP[key]) key = byEn[key.split(':')[1]] || key;   // 学年が かわった単語は 新しい学年へ
      moved[key] = v;
    }
    S.words = moved;
    S.unlock = S.unlock || {};
    // 単語の並びが かわった学年は、ステージの クリア記録だけ リセット（単語ごとの 記録は のこす）
    // 末尾に 単語を ふやしただけなら、リセットされません
    stampSig();
  }
  function stampSig() {
    S.sig = S.sig || {};
    for (const g of GRADES) {
      if (!g.list.length) continue;
      const sig = g.list.slice(0, 30).map(w => w.en).join(',');
      if (S.sig[g.id] && S.sig[g.id] !== sig) { S.cleared[g.id] = { s: [], b: [] }; S.open[g.id] = 0; if (S.unlock) delete S.unlock[g.id]; }
      S.sig[g.id] = sig;
    }
  }
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* noop */ } }
  const wst = w => S.words[keyOf(w)] || (S.words[keyOf(w)] = { b: 0, due: 0, c: 0, w: 0 });
  const wpeek = w => S.words[keyOf(w)];
  const prog = gid => S.cleared[gid] || (S.cleared[gid] = { s: [], b: [] });
  const xpNeed = lv => 60 + lv * 40;
  const maxHearts = () => Math.min(8, 5 + Math.floor((S.lv - 1) / 5));

  // ---------- 効果音 ----------
  let actx = null;
  function tone(f, d = 0.08, type = 'sine', v = 0.07, delay = 0) {
    if (!S || !S.settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + delay;
      o.type = type; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + d);
    } catch (e) { /* noop */ }
  }
  const sfx = {
    ok: () => { tone(660, .08, 'triangle'); tone(990, .1, 'triangle', .06, .07); },
    crit: () => { tone(880, .06, 'square', .05); tone(1320, .14, 'triangle', .07, .06); },
    ng: () => tone(160, .25, 'sawtooth', .07),
    kill: () => [523, 659, 784].forEach((f, i) => tone(f, .12, 'triangle', .07, i * .07)),
    win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .16, 'triangle', .08, i * .1)),
    lose: () => [392, 330, 262].forEach((f, i) => tone(f, .25, 'sine', .07, i * .15)),
    tap: () => tone(520, .04, 'sine', .04)
  };

  // ---------- 読み上げ（Chrome 対策込み）----------
  // ・cancel() の直後に speak() すると 消えることがある → 少し待ってから 話す
  // ・発話オブジェクトは 配列で 保持（消されると onend が 来ない）
  // ・2つ目以降は 前の文が 終わってから 次を 話す
  // ・onend が 来ないときの 保険として、文の長さから 終わる時間を 見積もる
  const canSpeak = typeof speechSynthesis !== 'undefined';
  let enVoice = null;
  function pickVoice() {
    const vs = speechSynthesis.getVoices();
    enVoice = vs.find(v => /en[-_]US/i.test(v.lang) && /Samantha|Google|Aria|Jenny/i.test(v.name)) || vs.find(v => /en[-_]US/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null;
  }
  if (canSpeak) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  let speechToken = 0;
  const liveUtter = [];
  function speakSeq(texts, onEnd) {
    const token = ++speechToken;
    if (!canSpeak || !S || !S.settings.voice) { if (onEnd) onEnd(); return; }
    try { speechSynthesis.cancel(); } catch (e) { /* noop */ }
    let idx = 0;
    const step = () => {
      if (token !== speechToken) return;
      if (idx >= texts.length) { if (onEnd) onEnd(); return; }
      const text = texts[idx], first = idx === 0; idx++;
      let done = false;
      const finish = () => { if (done) return; done = true; clearTimeout(guard); liveUtter.length = 0; setTimeout(step, first && texts.length > 1 ? 200 : 0); };
      const rate = (S.settings.rate || 0.9) * (first && texts.length > 1 ? 0.9 : 1);
      const guard = setTimeout(finish, 1500 + text.length * 110 / rate);
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-US'; u.rate = rate; if (enVoice) u.voice = enVoice;
        u.onend = finish; u.onerror = e => { if (!e || e.error !== 'interrupted') finish(); };
        liveUtter.push(u);
        if (speechSynthesis.paused) speechSynthesis.resume();
        speechSynthesis.speak(u);
      } catch (e) { finish(); }
    };
    setTimeout(step, 55);                              // cancel 直後を さける（短すぎると Chrome で 消える）
  }
  function speak(text, onEnd) { speakSeq([text], onEnd); }
  function stopSpeak() { speechToken++; try { if (canSpeak) speechSynthesis.cancel(); } catch (e) { /* noop */ } }
  const markEx = w => esc(w.ex).replace(/\[([^\]]+)\]/, '<mark>$1</mark>');

  function show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('show', s.id === id)); }

  // ================= タイトル =================
  function initTitle() {
    load();
    $('verTxt').textContent = 'バージョン ' + APP_VERSION;
    if (S) {
      $('titleNew').classList.add('hidden'); $('titleCont').classList.remove('hidden');
      $('titleWelcome').textContent = `おかえり、${S.name}！（Lv.${S.lv}）`;
    }
  }
  function newGame() {
    const name = ($('inpName').value || '').trim() || 'ゆうしゃ';
    S = defaultSave(name); stampSig(); save(); sfx.win();
    if (confirm('はじめに「レベル診断」（約5分）を しますか？\nあなたに ちょうどいい 地方と 章を おすすめします。')) startTest();
    else { toMap(); toast('自分の学年の 地方から 出発しよう！', 3000); }
  }
  function resetConfirm() {
    if (confirm('セーブデータを けして さいしょから はじめますか？')) { localStorage.removeItem(SAVE_KEY); location.reload(); }
  }

  // ================= マップ =================
  const dueWords = () => { const now = Date.now(); return Object.entries(S.words).filter(([k, st]) => st.c + st.w > 0 && st.due <= now && WMAP[k]).map(([k]) => WMAP[k]); };
  function renderHud() {
    $('hudHero').innerHTML = iconHTML('assets/hero.png', '🧙');
    $('hudName').textContent = S.name;
    $('hudLv').textContent = `Lv.${S.lv}  ❤️${maxHearts()}`;
    $('hudXpBar').style.width = Math.min(100, S.xp / xpNeed(S.lv) * 100) + '%';
    const st = S.streak, alive = st.last && dayIndex(todayStr()) - dayIndex(st.last) <= 1 + st.freeze;
    $('hudStreak').textContent = `🔥${alive ? st.count : 0}日` + (st.freeze ? ` 🛡️${st.freeze}` : '');
    const due = dueWords().length; $('dueBadge').textContent = due || '';
  }
  function toMap() {
    if (!S) { load(); if (!S) { show('scrTitle'); return; } }
    renderHud();
    const tabs = $('gradeTabs'); tabs.innerHTML = '';
    GRADES.forEach(g => {
      const b = document.createElement('button');
      b.textContent = g.name + (g.list.length ? '' : '（準備中）');
      b.className = (S.tab === g.id ? 'on' : '') + (g.list.length ? '' : ' soon');
      b.onclick = () => { S.tab = g.id; save(); toMap(); sfx.tap(); };
      tabs.appendChild(b);
    });
    renderRegion(gradeOf(S.tab) || GRADES[0]);
    show('scrMap');
  }
  const chUnlocked = (g, c) => c === 0 || c <= ((S.unlock || {})[g.id] || 0) || !!prog(g.id).b[c - 1];
  const stUnlocked = (g, c, k) => chUnlocked(g, c) && (k === 0 || !!prog(g.id).s[c * 10 + k - 1]);
  const bossUnlocked = (g, c) => { const p = prog(g.id); for (let k = 0; k < chStages(g, c); k++) if (!p.s[c * 10 + k]) return false; return chUnlocked(g, c); };
  function renderRegion(g) {
    const bg = `background-image:url(assets/bg/${g.id}.jpg), linear-gradient(135deg, ${g.color[0]}, ${g.color[1]})`;
    if (!g.list.length) {
      $('mapBody').innerHTML = `<div class="region" style="${bg}"><h2>${esc(g.region)}</h2><p>${g.name}</p></div>
        <div class="soon-box">🚧 この地方は じゅんび中です。<br>単語データが できたら 遊べるように なります。</div>`;
      return;
    }
    const p = prog(g.id);
    const learned = g.list.filter(w => (wpeek(w) || {}).b >= MASTER_BOX).length;
    const bossDone = p.b.filter(Boolean).length;
    let html = `<div class="region" style="${bg}"><h2>${esc(g.region)}</h2><p>${g.name}${g.level ? '（' + g.level + '）' : ''}・${g.list.length}語　おぼえた ${learned}語　ボス ${bossDone}/${g.chapters}</p>
      <div class="prog"><div style="width:${learned / g.list.length * 100}%"></div></div></div>`;
    let cur = 0; while (cur < g.chapters - 1 && p.b[cur]) cur++;
    const open = S.open[g.id] ?? cur;
    for (let c = 0; c < g.chapters; c++) {
      const unl = chUnlocked(g, c), ws = chWords(g, c);
      const doneSt = Array.from({ length: chStages(g, c) }, (_, k) => p.s[c * 10 + k]).filter(Boolean).length;
      html += `<div class="chapter"><div class="ch-head ${unl ? '' : 'locked'}" ${unl ? `onclick="Game.toggleCh('${g.id}',${c})"` : ''}>
        ${unl ? (p.b[c] ? '👑' : '📖') : '🔒'} 第${c + 1}章 <small>${ws[0].en} 〜 ${ws[ws.length - 1].en}　${doneSt}/${chStages(g, c)}</small></div>`;
      if (unl && open === c) {
        html += '<div class="stages">';
        for (let k = 0; k <= chStages(g, c); k++) {
          const isBoss = k === chStages(g, c);
          const unlocked = isBoss ? bossUnlocked(g, c) : stUnlocked(g, c, k);
          const cleared = isBoss ? p.b[c] : p.s[c * 10 + k];
          const mon = isBoss ? g.boss : g.monsters[(c + k) % g.monsters.length];
          const sw = isBoss ? `第${c + 1}章の 単語から 15問` : ws.slice(k * 10, k * 10 + 10).map(w => w.en).join(', ');
          html += `<div class="stage ${unlocked ? '' : 'locked'} ${unlocked && !cleared ? 'next' : ''} ${isBoss ? 'boss' : ''}" ${unlocked ? `onclick="Game.startStage('${g.id}',${c},${isBoss ? -1 : k})"` : ''}>
            <div class="s-ico">${unlocked ? iconHTML(`assets/monsters/${mon.id}.png`, mon.emoji) : '🔒'}</div>
            <div class="s-main"><b>${isBoss ? '👑 ボス：' + esc(mon.name) : `ステージ ${c + 1}-${k + 1}`}</b><small>${esc(sw)}</small></div>
            <div class="s-star">${cleared ? stars(isBoss ? ws : ws.slice(k * 10, k * 10 + 10)) : ''}</div></div>`;
        }
        html += '</div>';
      }
      html += '</div>';
    }
    $('mapBody').innerHTML = html;
  }
  function stars(ws) {
    const avg = ws.reduce((a, w) => a + Math.min(MASTER_BOX, (wpeek(w) || {}).b || 0), 0) / ws.length;
    const n = avg >= MASTER_BOX ? 3 : avg >= 2.5 ? 2 : 1;
    return '★'.repeat(n) + '☆'.repeat(3 - n);
  }
  function toggleCh(gid, c) { S.open[gid] = S.open[gid] === c ? -1 : c; save(); renderRegion(gradeOf(gid)); }

  // ================= 出題形式 =================
  function typesFor(mode, k) {
    if (mode === 'review') return null;
    if (mode === 'boss') return ['e2j', 'j2e', 'listen', 'cloze', 'spell', 'clozeType'];
    const t = [['e2j', 'listen'], ['e2j', 'j2e'], ['e2j', 'j2e', 'cloze'], ['listen', 'j2e', 'cloze'], ['e2j', 'cloze', 'spell'],
      ['j2e', 'cloze', 'spell', 'listen'], ['cloze', 'spell', 'clozeType', 'e2j']];
    return t[Math.min(k, t.length - 1)];
  }
  const clozeOK = w => /\[[^\]]+\]/.test(w.ex) && w.form !== 'other';
  function chooseType(w, allowed) {
    const b = wst(w).b;
    let pool = allowed || (b <= 1 ? ['e2j', 'listen', 'j2e'] : b <= 2 ? ['j2e', 'cloze', 'listen'] : ['cloze', 'spell', 'clozeType']);
    if (!canSpeak || !S.settings.voice) pool = pool.filter(t => t !== 'listen');
    if (!clozeOK(w)) pool = pool.filter(t => t !== 'cloze' && t !== 'clozeType');
    if (!pool.length) pool = ['e2j'];
    if (b >= 3) { const hard = pool.filter(t => ['cloze', 'spell', 'clozeType'].includes(t)); if (hard.length && Math.random() < 0.6) return pick(hard); }
    return pick(pool);
  }
  function distractors(w, n = 3) {
    const g = gradeOf(w.grade);
    const ok = x => x.en !== w.en && !sameMeaning(x, w);
    const near = shuffle(g.list.filter(x => ok(x) && x.pos === w.pos));
    const any = shuffle(g.list.filter(ok));
    const out = [];
    for (const x of near.concat(any)) {
      if (out.length >= n) break;
      if (!out.some(o => o.en === x.en || sameMeaning(o, x))) out.push(x);
    }
    return out;
  }
  // 数えられない名詞（複数形にしない）
  const UNC = new Set('homework garbage tea coffee milk water money information news music art science history weather rice bread butter cheese sugar juice soup salad meat beef chicken fish sheep peace pollution health luck fun work business snow rain ice smoke grass hair paper volleyball basketball baseball soccer tennis football shopping fishing grammar sunshine breakfast lunch dinner corn candy cloth mail technology culture advice furniture equipment knowledge traffic weather energy nature research progress evidence software electricity oil gas wood cash homework education safety freedom happiness attention trade blood air space trouble power value advice exercise walking cycling writing running skiing surfing singing climbing camping hiking sailing skating cooking training leisure wisdom creativity photography fiction seafood honey lifestyle fog friendship joy pride fortune imagination chess lemonade ambition vocabulary pronunciation mathematics politics literature justice democracy laughter unemployment assistance proof employment confidence presence existence concentration management finance insurance construction delivery protection leadership analysis content happiness chess poverty anger hunger satisfaction anxiety luxury poetry philosophy agriculture tourism transportation storage maintenance darkness excitement efficiency awareness accuracy affection admiration applause logic confusion destruction survival steel iron coal sand biology chemistry physics geography economics engineering ecology oxygen mud steam luggage nutrition courage patience honesty kindness wildlife privacy prosperity equality humanity abundance appreciation consumption discrimination exploration mankind guidance gratitude curiosity sorrow despair glory hatred guilt chaos caution certainty enthusiasm devotion fitness poison radiation moisture lightning thunder cotton silk rubber dirt ink powder rubbish sadness misery excellence copyright slavery oppression liberation recycling rainfall eyesight housework teamwork sportsmanship gymnastics genetics geology meditation cattle debris frost fur encouragement loyalty frustration citizenship usage data energy evolution innovation inflation welfare therapy cooperation participation attendance discipline clothing accommodation carbon stability recognition criticism faith relief ease compensation legislation retirement involvement creation addiction acid adversity agony amazement anticipation availability awe bankruptcy biotechnology bureaucracy commerce compassion competence comprehension consciousness consensus consent contempt corruption courtesy cruelty dedication deforestation dignity endurance exhaustion fame feedback flexibility fraud generosity grief hesitation hospitality hygiene ignorance loneliness mercy morality perseverance prevention psychology astronomy copper emergence heritage resistance completion'.split(' '));
  function clozeDistractors(w) {
    const pool = distractors(w, 12).filter(x => inflect(x, w.form).toLowerCase() !== w.ans.toLowerCase() && !(w.form === 'pl' && UNC.has(x.en)));
    return pool.sort((a, b) => (b.form === w.form) - (a.form === w.form)).slice(0, 3);
  }
  function balancedDistractors(w) {
    const pool = distractors(w, 8), k = w.senses.length;
    return pool.sort((a, b) => Math.abs(a.senses.length - k) - Math.abs(b.senses.length - k)).slice(0, 3);
  }

  // ================= ステージ開始 =================
  let B = null;
  function startStage(gid, c, k) {
    const g = gradeOf(gid), ws = chWords(g, c), isBoss = k < 0;
    const words = isBoss ? shuffle(ws).sort((a, b) => wst(a).b - wst(b).b).slice(0, 15) : ws.slice(k * 10, k * 10 + 10);
    const enemies = isBoss ? [{ ...g.boss, hp: 12, boss: true }] : [0, 1, 2].map(j => ({ ...g.monsters[(c + k + j) % g.monsters.length], hp: 4 }));
    beginBattle({ mode: isBoss ? 'boss' : 'stage', grade: gid, ch: c, st: k, words, enemies });
  }
  function startReview() {
    if (!S) return;
    const due = shuffle(dueWords()).sort((a, b) => wst(a).due - wst(b).due).slice(0, 12);
    if (!due.length) { toast(Object.keys(S.words).length ? 'いまは おさらいする単語が ないよ。また あとで 来てね！' : 'まずは ステージで 単語を おぼえよう！', 2800); return; }
    beginBattle({ mode: 'review', grade: null, ch: -1, st: -1, words: due, enemies: [{ ...REVIEW_ENEMY, hp: Math.max(4, Math.ceil(due.length * 0.8)), boss: true }] });
  }
  function beginBattle(cfg) {
    B = { ...cfg, ei: 0, hp: maxHearts(), combo: 0, maxCombo: 0, correct: 0, wrong: 0, crits: 0, queue: shuffle(cfg.words), missed: new Set(), seen: new Set(), xp: 0, kills: [], timer: null, locked: false };
    const fresh = cfg.mode === 'stage' ? cfg.words.filter(w => { const s = wpeek(w); return !s || s.c + s.w === 0; }) : [];
    if (fresh.length) startLearn(fresh); else enterArena();
  }

  // ================= 予習カード =================
  let L = null;
  function startLearn(list) { L = { list, i: 0 }; show('scrLearn'); showLearn(); }
  function showLearn() {
    const w = L.list[L.i];
    $('learnStep').textContent = `あたらしい単語 ${L.i + 1} / ${L.list.length}`;
    $('learnEn').textContent = w.en; $('learnPos').textContent = POS[w.pos] || '';
    $('learnJa').textContent = w.ja; $('learnPat').textContent = w.pat;
    $('learnEx').innerHTML = `<div class="ex-en">${markEx(w)}</div><div class="ex-ja">${esc(w.exj)}</div>`;
    $('learnNext').textContent = L.i === L.list.length - 1 ? 'たたかいへ ⚔️' : 'つぎへ ▶';
    const c = $('learnCard'); c.style.animation = 'none'; void c.offsetWidth; c.style.animation = '';
    speakSeq([w.en, w.plain]);
  }
  function nextLearn() { sfx.tap(); stopSpeak(); if (++L.i >= L.list.length) enterArena(); else showLearn(); }
  function speakCurrent() { if (!L) return; const w = L.list[L.i]; speakSeq([w.en, w.plain]); }

  // ================= バトル =================
  function enterArena() {
    stopSpeak();
    show('scrBattle');
    const g = gradeOf(B.grade);
    const grad = g ? `linear-gradient(180deg, ${g.color[0]}, ${g.color[1]})` : 'linear-gradient(180deg, #6b7280, #1f2937)';
    $('arena').style.backgroundImage = `url(assets/bg/${B.grade || 'review'}.jpg), ${grad}`;
    showEnemy(); nextQuestion();
  }
  const curEnemy = () => B.enemies[B.ei];
  function showEnemy() {
    const e = curEnemy(); e.maxHp = e.maxHp || e.hp;
    const el = $('enemy'); el.className = 'enemy' + (e.boss ? ' boss' : '');
    el.innerHTML = iconHTML(`assets/monsters/${e.id}.png`, e.emoji);
    $('enemyName').textContent = e.name;
    $('wave').textContent = B.enemies.length > 1 ? `${B.ei + 1} / ${B.enemies.length} ひき目` : 'BOSS';
    updateBars();
  }
  function updateBars() {
    const e = curEnemy();
    $('enemyHp').style.width = Math.max(0, e.hp / e.maxHp * 100) + '%';
    $('hearts').textContent = '❤️'.repeat(Math.max(0, B.hp)) + '🤍'.repeat(Math.max(0, maxHearts() - B.hp));
    $('combo').textContent = B.combo >= 2 ? `${B.combo} コンボ！` : '';
  }
  function nextQuestion() {
    if (!B.queue.length) B.queue = shuffle([...B.missed].map(k => WMAP[k]).concat(B.words)).slice(0, 5);
    const w = B.queue.shift();
    B.q = { word: w, type: chooseType(w, typesFor(B.mode, B.st)) };
    B.locked = false;
    $('explain').classList.add('hidden');
    renderQuestion(); startTimer();
  }
  function startTimer() {
    clearInterval(B.timer); B.qStart = performance.now();
    const bar = $('timerBar'), crit = CRIT[B.q.type], total = Math.max(TIMER_SEC, crit * 2);
    B.timer = setInterval(() => {
      const t = (performance.now() - B.qStart) / 1000, r = Math.max(0, 1 - t / total);
      bar.style.width = r * 100 + '%';
      bar.style.background = t < crit ? '#f59e0b' : r > 0.3 ? '#10b981' : '#ef4444';
      if (r <= 0) clearInterval(B.timer);
    }, 100);
  }
  const KIND = { e2j: '🗡️ 英語 → 日本語', j2e: '🪄 日本語 → 英語', listen: '👂 きいて こたえよう', cloze: '📜 例文の ___ に入る語は？', spell: '🔤 つづりを ならべよう', clozeType: '⌨️ 例文の ___ を 入力しよう' };
  function blankSentence(w) { return esc(w.ex).replace(/\[[^\]]+\]/, '<span class="blank">？</span>'); }
  function renderQuestion() {
    const { word: w, type } = B.q, main = $('qMain'), sub = $('qSub'), area = $('qArea');
    $('qKind').textContent = KIND[type]; main.className = 'q-main'; sub.textContent = ''; area.innerHTML = '';
    if (type === 'e2j') {
      main.innerHTML = `${esc(w.en)} <button class="speak-inline" onclick="Game.say()">🔊</button>`; speak(w.en);
      choicesUI(w, balancedDistractors(w), x => x.ja);
    } else if (type === 'listen') {
      main.innerHTML = `<button class="speak-big" onclick="Game.say()">🔊</button>`; speak(w.en);
      choicesUI(w, balancedDistractors(w), x => x.ja);
    } else if (type === 'j2e') {
      main.classList.add('ja'); main.textContent = w.ja;
      choicesUI(w, distractors(w), x => x.en);
    } else if (type === 'cloze') {
      main.classList.add('sent'); main.innerHTML = blankSentence(w); sub.textContent = w.exj;
      choicesUI(w, clozeDistractors(w), x => x === w ? w.ans : capLike(inflect(x, w.form), w.ans));
    } else if (type === 'spell') {
      main.classList.add('ja'); main.textContent = w.ja; spellUI(w);
    } else {
      main.classList.add('sent'); main.innerHTML = blankSentence(w);
      sub.textContent = w.exj + (FORM_LABEL[w.form] ? `（${FORM_LABEL[w.form]}）` : '');
      typeUI(w);
    }
  }
  function choicesUI(w, ds, label) {
    const opts = shuffle([w, ...ds]), area = $('qArea');
    const box = document.createElement('div'); box.className = 'choices';
    opts.forEach(o => {
      const b = document.createElement('button'); b.className = 'choice'; b.textContent = label(o);
      b.onclick = () => {
        if (B.locked) return;
        const ok = o === w; b.classList.add(ok ? 'ok' : 'ng');
        if (!ok) [...box.children].forEach((c, k) => { if (opts[k] === w) c.classList.add('ok'); });
        answer(ok);
      };
      box.appendChild(b);
    });
    if (S.settings.think && B.q.type !== 'listen') {
      box.classList.add('hidden');
      const t = document.createElement('button'); t.className = 'btn think-btn'; t.textContent = '💡 思い出した！ 選択肢を見る';
      t.onclick = () => { t.remove(); box.classList.remove('hidden'); sfx.tap(); };
      area.appendChild(t);
    }
    area.appendChild(box);
  }
  function spellUI(w) {
    const word = w.en.toLowerCase(), letters = word.split(''), area = $('qArea');
    const decoys = shuffle('aeioulnrstdmcbp'.split('').filter(c => !letters.includes(c))).slice(0, word.length > 8 ? 2 : 3);
    const tiles = shuffle(letters.concat(decoys)).map(ch => ({ ch, used: false })), typed = [];
    const slots = document.createElement('div'); slots.className = 'spell-slots';
    const tbox = document.createElement('div'); tbox.className = 'tiles';
    const draw = () => { slots.innerHTML = letters.map((_, k) => `<div class="slot">${typed[k] ? typed[k].ch : ''}</div>`).join(''); [...tbox.children].forEach((el, k) => el.classList.toggle('used', tiles[k].used)); };
    tiles.forEach(t => {
      const b = document.createElement('button'); b.className = 'tile'; b.textContent = t.ch;
      b.onclick = () => {
        if (B.locked || t.used) return;
        t.used = true; typed.push(t); sfx.tap(); draw();
        if (typed.length === letters.length) answer(typed.map(x => x.ch).join('') === word, typed.map(x => x.ch).join(''));
      };
      tbox.appendChild(b);
    });
    const btns = document.createElement('div'); btns.className = 'row-btns';
    const back = document.createElement('button'); back.className = 'btn ghost small'; back.textContent = '⌫ 1文字けす';
    back.onclick = () => { if (!B.locked && typed.length) { typed.pop().used = false; draw(); } };
    const give = document.createElement('button'); give.className = 'btn ghost small'; give.textContent = 'わからない';
    give.onclick = () => { if (!B.locked) answer(false); };
    btns.append(back, give); area.append(slots, tbox, btns); draw();
  }
  function typeUI(w) {
    const area = $('qArea'), target = w.ans;
    const inp = document.createElement('input');
    inp.className = 'type-in'; inp.autocomplete = 'off'; inp.autocapitalize = 'off'; inp.spellcheck = false;
    inp.placeholder = `${target[0]}${'＿'.repeat(Math.max(0, target.length - 1))}（${target.length}文字）`;
    const btns = document.createElement('div'); btns.className = 'row-btns';
    const go = document.createElement('button'); go.className = 'btn'; go.textContent = 'こうげき！';
    const give = document.createElement('button'); give.className = 'btn ghost small'; give.textContent = 'わからない';
    const submit = () => { if (B.locked) return; const v = inp.value.trim(); if (v) answer(v.toLowerCase() === target.toLowerCase(), v); };
    go.onclick = submit; inp.onkeydown = e => { if (e.key === 'Enter') submit(); };
    give.onclick = () => { if (!B.locked) answer(false); };
    btns.append(go, give); area.append(inp, btns);
    setTimeout(() => inp.focus(), 50);
  }

  // ---------- こたえあわせ ----------
  function answer(ok, yours) {
    B.locked = true; clearInterval(B.timer);
    const w = B.q.word, st = wst(w), sec = (performance.now() - B.qStart) / 1000, key = keyOf(w);
    const first = !B.seen.has(key); B.seen.add(key);
    if (ok) {
      B.correct++; B.combo++; B.maxCombo = Math.max(B.maxCombo, B.combo);
      const crit = sec <= CRIT[B.q.type];
      const dmg = 1 + (crit ? 1 : 0) + (B.combo >= 5 ? 1 : 0);
      if (crit) B.crits++;
      B.xp += 4 + (crit ? 2 : 0);
      if (first && !B.missed.has(key)) { st.b = Math.min(INTERVAL_DAYS.length - 1, st.b + 1); st.due = Date.now() + INTERVAL_DAYS[st.b] * DAY; }
      else if (st.due < Date.now()) st.due = Date.now() + 10 * 60000;
      st.c++;
      (crit ? sfx.crit : sfx.ok)();
      hitEnemy(dmg, crit);
    } else {
      B.wrong++; B.combo = 0; B.hp--;
      st.w++; st.b = Math.max(1, st.b - 2); st.due = Date.now();
      B.missed.add(key);
      B.queue.splice(Math.min(B.queue.length, 2 + (Math.random() * 3 | 0)), 0, w);
      sfx.ng(); enemyAttack();
    }
    save(); updateBars();
    showExplain(w, ok, yours);
  }
  // こたえたあとの 解説。「つぎへ」を おすまで 進まない（設定で 自動にできる）
  function showExplain(w, ok, yours) {
    const ex = $('explain');
    ex.className = 'explain ' + (ok ? 'ok' : 'ng');
    ex.innerHTML = `<div class="ex-res">${ok ? '⭕ せいかい！' : '❌ ざんねん…' + (yours ? `（${esc(yours)}）` : '')}</div>
      <div class="ex-head"><b>${esc(w.en)}</b><span>${esc(w.ja)}</span></div>
      ${w.pat ? `<div class="ex-pat">${esc(w.pat)}</div>` : ''}
      <div class="ex-en">${markEx(w)}</div><div class="ex-ja">${esc(w.exj)}</div>
      <button class="btn" onclick="Game.next()">${ok ? 'つぎへ ▶' : 'わかった！ つぎへ ▶'}</button>
      <button class="btn ghost small" onclick="Game.sayText(${JSON.stringify(w.plain).replace(/"/g, '&quot;')})">🔊 もう一度 きく</button>`;
    clearTimeout(B.autoT);
    const qid = B.qid = (B.qid || 0) + 1;
    const auto = ok && S.settings.autoNext;
    B.explainAt = performance.now();
    const goLater = auto ? () => { if (B && B.qid === qid) B.autoT = setTimeout(() => next(true), 1200); } : null;
    if (S.settings.exVoice) speak(w.plain, goLater);
    else if (ok) speak(w.en, goLater);
    else if (goLater) goLater();
  }
  function next(fromAuto) {
    if (!B || $('explain').classList.contains('hidden')) return;
    if (!fromAuto && performance.now() - (B.explainAt || 0) < 700) return;   // 答えた指が そのまま 当たるのを 防ぐ
    stopSpeak();
    clearTimeout(B.autoT); $('explain').classList.add('hidden');
    afterAnswer();
  }
  function hitEnemy(dmg, crit) {
    curEnemy().hp -= dmg;
    const el = $('enemy'); el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
    const d = document.createElement('div'); d.className = 'dmg' + (crit ? ' crit' : '');
    d.textContent = (crit ? 'クリティカル！ ' : '') + '-' + dmg; $('fx').appendChild(d); setTimeout(() => d.remove(), 800);
  }
  function enemyAttack() {
    const el = $('enemy'); el.classList.remove('atk'); void el.offsetWidth; el.classList.add('atk');
    const a = $('arena'); a.classList.remove('flash-bad'); void a.offsetWidth; a.classList.add('flash-bad');
    if (navigator.vibrate) navigator.vibrate(120);
  }
  function afterAnswer() {
    if (B.hp <= 0) return finish(false);
    const e = curEnemy();
    if (e.hp <= 0) {
      sfx.kill(); $('enemy').classList.add('die');
      B.kills.push(e); S.dex[e.id] = (S.dex[e.id] || 0) + 1; B.xp += e.boss ? 30 : 8;
      setTimeout(() => { if (++B.ei >= B.enemies.length) return finish(true); showEnemy(); nextQuestion(); }, 650);
      return;
    }
    nextQuestion();
  }
  function quitBattle() {
    if (!confirm('にげますか？（ここまでの 単語の記録は のこります）')) return;
    stopSpeak(); clearInterval(B.timer); clearTimeout(B.autoT); B = null; toMap();
  }

  // ================= けっか =================
  function finish(win) {
    clearInterval(B.timer);
    const prevLv = S.lv;
    if (win) {
      if (B.mode === 'stage') { prog(B.grade).s[B.ch * 10 + B.st] = true; B.xp += 15; }
      else if (B.mode === 'boss') { prog(B.grade).b[B.ch] = true; B.xp += 50; S.open[B.grade] = B.ch + 1; }
      else B.xp += 15;
      sfx.win();
    } else sfx.lose();
    const streakMsg = win ? touchStreak() : '';
    S.xp += B.xp; while (S.xp >= xpNeed(S.lv)) { S.xp -= xpNeed(S.lv); S.lv++; }
    save();
    $('resTitle').textContent = win ? (B.mode === 'boss' ? '👑 ボス げきは！' : B.mode === 'review' ? '🗼 おさらい クリア！' : '🎉 ステージ クリア！') : '💫 やられてしまった…';
    const last = B.kills[B.kills.length - 1] || curEnemy();
    $('resIcon').innerHTML = win ? iconHTML(`assets/monsters/${last.id}.png`, last.emoji) : '😵';
    const rate = B.correct + B.wrong ? Math.round(B.correct / (B.correct + B.wrong) * 100) : 0;
    $('resStats').innerHTML = [['正解率', rate + '%'], ['最大コンボ', B.maxCombo], ['クリティカル', B.crits], ['けいけんち', '+' + B.xp]].map(([k, v]) => `<div><small>${k}</small>${v}</div>`).join('')
      + (S.lv > prevLv ? `<div style="grid-column:1/-1;background:#fef3c7">⬆️ レベルアップ！ Lv.${S.lv}</div>` : '')
      + (streakMsg ? `<div style="grid-column:1/-1">${streakMsg}</div>` : '');
    const miss = [...B.missed].map(k => WMAP[k]);
    $('resMiss').innerHTML = miss.length
      ? `<h3>📝 まちがえた単語（おさらいの塔に 出てくるよ）</h3>` + miss.map(w => `<div class="miss-row"><div class="top"><b>${esc(w.en)}</b>${esc(w.ja)}<button onclick="Game.sayText(${JSON.stringify(w.plain).replace(/"/g, '&quot;')})">🔊</button></div><div class="ex">${markEx(w)}</div></div>`).join('')
      : `<h3>✨ ノーミス！ すばらしい！</h3>`;
    const btns = [];
    if (!win) btns.push(`<button class="btn big" onclick="Game.retry()">もう一度 ちょうせん</button>`);
    else if (B.mode === 'review') btns.push(`<button class="btn big" onclick="Game.startReview()">もう一度 おさらい</button>`);
    else {
      const nx = nextTarget();
      if (nx) btns.push(`<button class="btn big ${nx.boss ? 'gold' : ''}" onclick="Game.startStage('${B.grade}',${nx.c},${nx.k})">${nx.label} ▶</button>`);
    }
    btns.push(`<button class="btn ghost" onclick="Game.toMap()">マップへ もどる</button>`);
    $('resBtns').innerHTML = btns.join('');
    show('scrResult');
  }
  function nextTarget() {
    const g = gradeOf(B.grade);
    if (B.mode === 'stage') {
      if (B.st + 1 < chStages(g, B.ch)) return { c: B.ch, k: B.st + 1, label: 'つぎの ステージへ' };
      if (bossUnlocked(g, B.ch) && !prog(g.id).b[B.ch]) return { c: B.ch, k: -1, label: '👑 ボスに いどむ', boss: true };
      return null;
    }
    if (B.ch + 1 < g.chapters) return { c: B.ch + 1, k: 0, label: `第${B.ch + 2}章へ` };
    return null;
  }
  function retry() { if (!B) return toMap(); if (B.mode === 'review') startReview(); else startStage(B.grade, B.ch, B.mode === 'boss' ? -1 : B.st); }
  function touchStreak() {
    const st = S.streak, today = todayStr();
    if (st.last === today) return '';
    let msg; const gap = st.last ? dayIndex(today) - dayIndex(st.last) : 99;
    if (gap === 1) { st.count++; msg = `🔥 れんぞく ${st.count}日目！`; }
    else if (st.last && gap - 1 <= st.freeze) { st.freeze -= gap - 1; st.count++; msg = `🛡️ おやすみ札で 記録を まもった！ 🔥${st.count}日目`; }
    else { st.count = 1; msg = '🔥 きょうから れんぞく記録 スタート！'; }
    st.last = today; st.best = Math.max(st.best, st.count);
    if (st.count % 7 === 0 && st.freeze < 2) { st.freeze++; msg += '　🛡️おやすみ札を 1まい もらった！'; }
    return msg;
  }

  // ================= 図鑑・ノート・せってい =================
  function panel(title, html) { $('panelTitle').textContent = title; $('panelBody').innerHTML = html; show('scrPanel'); }
  function showDex() {
    let html = '', got = 0, total = 0;
    GRADES.forEach(g => {
      html += `<h3 class="section-title">${g.name}・${esc(g.region)}</h3><div class="dex-grid">`;
      g.monsters.concat([g.boss]).forEach(m => {
        const n = S.dex[m.id] || 0; total++; if (n) got++;
        html += `<div class="dex-cell ${n ? '' : 'none'}"><div class="dex-ico">${iconHTML(`assets/monsters/${m.id}.png`, m.emoji)}</div>${n ? esc(m.name) : '？？？'}<br><small>${n ? `${n}かい たおした` : 'まだ 会っていない'}</small></div>`;
      });
      html += '</div>';
    });
    panel(`📕 モンスター図鑑 ${got}/${total}`, html);
  }
  function showBook() {
    const colors = ['#9ca3af', '#f87171', '#fb923c', '#facc15', '#34d399', '#10b981', '#059669'];
    const label = b => ['未', '1', '2', '3', 'おぼえた', 'おぼえた', '完ぺき'][b];
    let html = '<p style="font-size:12px;color:#6b7280;margin-bottom:8px">単語を タップすると 型と 例文が 見られるよ。にがてな順に ならんでいます。</p>';
    let any = false;
    GRADES.forEach(g => {
      const seen = g.list.filter(w => wpeek(w));
      if (!seen.length) return; any = true;
      html += `<h3 class="section-title">${g.name}（${seen.length}/${g.list.length}語）</h3>`;
      seen.sort((a, b) => wst(a).b - wst(b).b).forEach(w => {
        const st = wst(w);
        html += `<div class="book-row" onclick="this.classList.toggle('open');Game.sayText(${JSON.stringify(w.en).replace(/"/g, '&quot;')})"><div class="top"><b>${esc(w.en)}</b><span>${esc(w.ja)}</span><i class="lvl" style="background:${colors[st.b]}">${label(st.b)}</i></div>
          <div class="more">${w.pat ? `📐 ${esc(w.pat)}<br>` : ''}${markEx(w)}<br><span style="color:#6b7280">${esc(w.exj)}</span></div></div>`;
      });
    });
    panel('📒 単語ノート', any ? html : '<p>まだ 出会った単語が ないよ。ステージに ちょうせんしよう！</p>');
  }
  function showSettings() {
    const s = S.settings;
    panel('⚙️ せってい', `
      <label class="set-row"><div>🔊 効果音</div><input type="checkbox" ${s.sound ? 'checked' : ''} onchange="Game.setOpt('sound',this.checked)"></label>
      <label class="set-row"><div>🗣️ 英語の 読み上げ<small>${canSpeak ? 'ブラウザの 音声で 発音します' : 'この ブラウザは 読み上げに 対応していません'}</small></div><input type="checkbox" ${s.voice ? 'checked' : ''} ${canSpeak ? '' : 'disabled'} onchange="Game.setOpt('voice',this.checked)"></label>
      <label class="set-row"><div>📜 こたえたあと 例文を 読み上げる</div><input type="checkbox" ${s.exVoice ? 'checked' : ''} onchange="Game.setOpt('exVoice',this.checked)"></label>
      <label class="set-row"><div>⏩ 正解したら 自動で つぎへ<small>例文の 読み上げが 終わってから 進みます（まちがえたときは いつも ボタンで 進みます）</small></div><input type="checkbox" ${s.autoNext ? 'checked' : ''} onchange="Game.setOpt('autoNext',this.checked)"></label>
      <label class="set-row"><div>🐢 読み上げを ゆっくりに</div><input type="checkbox" ${s.rate < 0.85 ? 'checked' : ''} onchange="Game.setOpt('rate',this.checked?0.7:0.9)"></label>
      <label class="set-row"><div>💡 思い出してから 選ぶ<small>4択の 選択肢を すぐに 見せません。頭の中で 答えを 思い出してから ボタンを おそう</small></div><input type="checkbox" ${s.think ? 'checked' : ''} onchange="Game.setOpt('think',this.checked)"></label>
      <div class="set-row"><div>🔥 れんぞく記録<small>さいこう ${S.streak.best}日・おやすみ札 ${S.streak.freeze}まい（7日つづけると 1まい。1日 休んでも 記録が きれません）</small></div></div>
      <button class="btn ghost" style="width:100%;margin-top:10px" onclick="Game.resetConfirm()">セーブデータを けす</button>
      <div class="credit">えいたんクエスト v${APP_VERSION}<br>
      単語の選定：CEFR-J Wordlist Version 1.6（東京外国語大学 投野由紀夫研究室）をもとに作成。<br>
      並び順：New General Service List 1.2（Browne, Culligan &amp; Phillips, CC BY-SA 4.0）の頻度順位を参照。<br>
      意味・型・例文・訳は 本プロジェクトの オリジナルです。</div>`);
  }
  function setOpt(k, v) { S.settings[k] = v; save(); if (k === 'voice' && v) speak('Hello!'); }

  // ================= キャッシュ対策 =================
  (function checkLatest() {
    try {
      if (!/^https?:$/.test(location.protocol)) return;
      fetch('index.html?_=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.text() : null).then(t => {
        const m = t && t.match(/name="app-version" content="([^"]+)"/);
        if (!m || m[1] === APP_VERSION) return;
        const key = 'eqReload_' + m[1]; if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, '1'); location.replace(location.pathname + '?v=' + encodeURIComponent(m[1]));
      }).catch(() => {});
    } catch (e) { /* noop */ }
  })();

  // ================= レベル診断 =================
  // 6つの帯（中1・中2・中3・高校基礎・標準・発展）から 6問ずつ、やさしい順に 出題（最大36問）。
  // 各帯の 6問は 帯の 中を 6等分した 位置から 1語ずつ えらぶ → 「どの章まで 知っているか」も わかる。
  // 「わからない」を えらべるので、当てずっぽうを へらせる。2つの帯で 続けて 2問以下なら そこで 終了。
  const BANDS = ['j1', 'j2', 'j3', 'h1', 'h2', 'h3'];
  const PER_BAND = 6, PASS = 5;
  let T = null;
  function startTest() {
    const qs = [];
    for (const gid of BANDS) {
      const g = gradeOf(gid);
      if (!g || !g.list.length) continue;
      const n = g.list.length;
      for (let k = 0; k < PER_BAND; k++) {
        const lo = Math.floor(n * k / PER_BAND), hi = Math.floor(n * (k + 1) / PER_BAND);
        const pool = g.list.slice(lo, hi).filter(w => w.senses.length <= 3);
        qs.push({ gid, k, word: pick(pool.length ? pool : g.list.slice(lo, hi)) });
      }
    }
    T = { qs, i: 0, res: {}, done: false };
    // 2回目以降は けっか画面が のこっているので、問題の わくを 作りなおす
    $('testBody').innerHTML = `<p class="t-intro">英単語の 意味を えらんでね。知らない ときは「わからない」を おそう（当てずっぽうより 正確に 判定できます）。</p>
      <div class="q-kind" id="testStep"></div><div class="q-main" id="testWord"></div><div class="choices" id="testChoices"></div>`;
    show('scrTest'); renderTest();
  }
  function renderTest() {
    const q = T.qs[T.i], g = gradeOf(q.gid);
    $('testBar').style.width = (T.i / T.qs.length * 100) + '%';
    $('testStep').textContent = `${T.i + 1} / ${T.qs.length}　（${g.name}レベル）`;
    $('testWord').innerHTML = `${esc(q.word.en)} <button class="speak-inline" onclick="Game.sayText('${q.word.en}')">🔊</button>`;
    const opts = shuffle([q.word, ...balancedDistractors(q.word)]);
    const box = $('testChoices'); box.innerHTML = '';
    opts.forEach(o => {
      const b = document.createElement('button'); b.className = 'choice'; b.textContent = o.ja;
      b.onclick = () => answerTest(o === q.word);
      box.appendChild(b);
    });
    const idk = document.createElement('button'); idk.className = 'choice idk'; idk.textContent = '🤔 わからない';
    idk.onclick = () => answerTest(false);
    box.appendChild(idk);
  }
  function answerTest(ok) {
    const q = T.qs[T.i];
    (T.res[q.gid] = T.res[q.gid] || []).push({ k: q.k, ok });
    sfx.tap();
    T.i++;
    // 続けて 2つの帯で ほとんど わからなければ 打ち切り
    const done = BANDS.filter(b => (T.res[b] || []).length === PER_BAND);
    const weak = done.slice(-2).filter(b => T.res[b].filter(x => x.ok).length <= 2).length;
    if (T.i >= T.qs.length || (done.length >= 2 && weak === 2 && T.i % PER_BAND === 0)) return finishTest();
    renderTest();
  }
  // 判定：
  //  ・帯の 正解数が 3以下 → その帯が おすすめ
  //  ・4問なら「つぎの帯も 3以下」のときだけ その帯（うっかりミス 1〜2問では 下げない）
  //  ・章は「その帯の 正解数 ÷ 6」の 位置から（どこで まちがえたかより、うっかりミスに 強い）
  function judgeTest() {
    const sc = gid => T.res[gid] ? T.res[gid].filter(x => x.ok).length : -1;
    let rec = null;
    for (let b = 0; b < BANDS.length; b++) {
      const gid = BANDS[b], n = sc(gid);
      if (n < 0) { rec = { gid, n: 0 }; break; }
      const next = b + 1 < BANDS.length ? sc(BANDS[b + 1]) : -1;
      if (n <= 3 || (n === 4 && next >= 0 && next <= 3)) { rec = { gid, n }; break; }
    }
    if (!rec) rec = { gid: BANDS[BANDS.length - 1], n: PER_BAND - 1 };
    const g = gradeOf(rec.gid);
    const ch = Math.min(g.chapters - 1, Math.floor(rec.n / PER_BAND * g.chapters));
    return { gid: rec.gid, ch };
  }
  function finishTest() {
    $('testBar').style.width = '100%';
    const r = judgeTest(), g = gradeOf(r.gid);
    S.placement = { gid: r.gid, ch: r.ch, at: Date.now(), res: T.res }; save();
    sfx.win();
    const rows = BANDS.filter(b => T.res[b]).map(b => {
      const n = T.res[b].filter(x => x.ok).length;
      return `<div class="t-row"><span>${gradeOf(b).name}</span><span class="t-dots">${T.res[b].map(x => x.ok ? '🟢' : '⚪').join('')}</span><b>${n}/${PER_BAND}</b></div>`;
    }).join('');
    $('testBody').innerHTML = `<h2>🔮 診断けっか</h2>
      <div class="t-rec">あなたに おすすめは<br><b>${g.name}・${esc(g.region)}</b><br>第${r.ch + 1}章 から</div>
      <div class="t-rows">${rows}</div>
      <p class="t-note">🟢＝正解　⚪＝まちがい・わからない（左ほど その学年の 前半の単語）</p>
      <button class="btn big" onclick="Game.applyTest()">ここから はじめる ▶</button>
      <button class="btn ghost" onclick="Game.toMap()">マップで 自分で えらぶ</button>`;
  }
  function applyTest() {
    const p = S.placement; if (!p) return toMap();
    // おすすめより やさしい学年と、おすすめの章の 手前までは 最初から ひらく
    for (const gid of BANDS) { const g = gradeOf(gid); if (!g) continue;
      if (gid === p.gid) { S.unlock[gid] = Math.max(S.unlock[gid] || 0, p.ch); break; }
      S.unlock[gid] = g.chapters - 1;
    }
    S.tab = p.gid; S.open[p.gid] = p.ch; save();
    toMap(); toast(`${gradeOf(p.gid).name} 第${p.ch + 1}章から スタート！`, 3000);
  }
  function openTest() {
    if (S.placement && !confirm('もう一度 レベル診断を しますか？')) return;
    startTest();
  }

  initTitle();
  return {
    startTest: openTest, applyTest,
    newGame, resetConfirm, toMap, toggleCh, startStage, startReview, nextLearn, skipLearn: () => enterArena(), speakCurrent,
    quitBattle, retry, next, showDex, showBook, showSettings, setOpt,
    say: () => B && B.q && speak(B.q.word.en), sayText: t => speak(t),
    _debug: () => ({ S, B, T, judgeTest, distractors, clozeDistractors, balancedDistractors, inflect, chooseType, ALL })
  };
})();
