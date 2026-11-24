// 部品の定義と、SVGでの描き方
// v0.12：leg（着陸脚）と chute（パラシュート）は「つける部品」。マスを つかわず、ほかの 部品に つける
//   grid の 値は 'engine+leg' のように「部品＋つけたもの」。RL.base(k) で 部品、RL.has(k, 'leg') で つけたもの
RL.PART_ORDER = ['engine', 'vengine', 'tank', 'ring', 'booster', 'fin', 'leg', 'chute', 'win', 'nose'];
RL.ATTACH = { leg: ['engine', 'vengine'], chute: ['win'] };   // つける部品 → つけられる 部品
RL.base = k => (typeof k === 'string' ? k.split('+')[0] : k);
RL.has = (k, a) => typeof k === 'string' && k.split('+').slice(1).includes(a);
RL.atts = k => (typeof k === 'string' ? k.split('+').slice(1) : []);
// 'engine+leg' のままでも 部品の 種類で しらべられるように（RL.BODY['engine+leg'] → 1）
const byBase = o => new Proxy(o, { get: (t, k) => (typeof k === 'string' ? t[k.split('+')[0]] : t[k]) });
RL.BODY = byBase({ engine: 1, vengine: 1, tank: 1, win: 1, nose: 1, ring: 1 });   // 胴体としてつながる部品
RL.ENGINES = byBase({ engine: 1, vengine: 1 });
// v0.12：前の セーブの「胴体の よこの 脚」を、同じ 行の となりの エンジンに うつす（なければ けす）
RL.migrateLegs = function (g) {
  const R = g.length, C = g[0].length;
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    if (g[r][c] !== 'leg') continue;
    for (const cc of [c - 1, c + 1]) if (cc >= 0 && cc < C && RL.ENGINES[g[r][cc]] && !RL.has(g[r][cc], 'leg')) { g[r][cc] = RL.base(g[r][cc]) + '+leg'; break; }
    for (let i = r; i > 0; i--) g[i][c] = g[i - 1][c];   // けした ところへ 上を おとす
    g[0][c] = null;
  }
  return g;
};

(function () {
  const OL = '#2b3245', W = 5;
  function body(x, w, up, down, rt, rb) {
    const y0 = up ? 0 : 4, y1 = down ? 100 : 96;
    rt = up ? 0 : rt; rb = down ? 0 : rb;
    return `M${x + rt} ${y0} H${x + w - rt} Q${x + w} ${y0} ${x + w} ${y0 + rt} V${y1 - rb} Q${x + w} ${y1} ${x + w - rb} ${y1} H${x + rb} Q${x} ${y1} ${x} ${y1 - rb} V${y0 + rt} Q${x} ${y0} ${x + rt} ${y0}Z`;
  }
  const PLUS = `<circle cx="84" cy="16" r="14" fill="#1f9a32" stroke="#fff" stroke-width="3"/><path d="M84 8 V24 M76 16 H92" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`;
  const svg = inner => `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${inner}</svg>`;

  // v0.12 つける部品の 絵（部品の 絵に かさねる。マスの 外に はみだして よい）
  //   脚：.legd＝ひらいた 足、.legf＝たたんだ 足（飛行中は たたんで おき、地面ちかくで ひらく）
  const LEG_OV = `<g class="legd"><path d="M28 36 L-14 92 M72 36 L114 92" stroke="${OL}" stroke-width="12" stroke-linecap="round"/>` +
    `<path d="M28 36 L-14 92 M72 36 L114 92" stroke="#ffd54a" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M20 62 L8 62 M80 62 L92 62" stroke="${OL}" stroke-width="5" stroke-linecap="round"/>` +
    `<rect x="-30" y="88" width="30" height="10" rx="5" fill="#cfd5e2" stroke="${OL}" stroke-width="4"/><rect x="100" y="88" width="30" height="10" rx="5" fill="#cfd5e2" stroke="${OL}" stroke-width="4"/></g>` +
    `<g class="legf"><path d="M14 30 V90 M86 30 V90" stroke="${OL}" stroke-width="11" stroke-linecap="round"/><path d="M14 30 V90 M86 30 V90" stroke="#ffd54a" stroke-width="5" stroke-linecap="round"/></g>`;
  const CHUTE_OV = `<g class="chutePack"><rect x="30" y="-2" width="40" height="16" rx="6" fill="#ff7a1a" stroke="${OL}" stroke-width="4"/>` +
    `<path d="M38 2 V10 M50 2 V10 M62 2 V10" stroke="#fff" stroke-width="3"/></g>`;
  RL.drawPart = function (kind, ctx) {
    ctx = ctx || {};
    let s = drawBase(kind, ctx);
    const at = ctx.att || [];
    if (!s || !at.length) return s;
    const ov = (at.includes('leg') ? LEG_OV : '') + (at.includes('chute') ? CHUTE_OV : '');
    return s.replace('<svg ', '<svg style="overflow:visible" ').replace(/<\/svg>$/, ov + '</svg>');
  };
  function drawBase(kind, ctx) {
    ctx = ctx || {};
    const up = !!ctx.up, down = !!ctx.down;
    switch (kind) {
      case 'engine':   // 地上用：太くて短い 灰色のノズル
        return svg(`<rect x="26" y="${up ? 0 : 6}" width="48" height="${up ? 30 : 24}" fill="#cfd5e2" stroke="${OL}" stroke-width="${W}"/>` +
          `<path d="M30 30 H70 L90 96 H10Z" fill="#7a849a" stroke="${OL}" stroke-width="${W}" stroke-linejoin="round"/>` +
          `<path d="M24 66 H76" stroke="#ff9a3d" stroke-width="7"/><path d="M36 38 L28 88" stroke="#a7b0c4" stroke-width="5" stroke-linecap="round"/>`);
      case 'vengine':  // 宇宙用：細い首と 大きく広がる 青いノズル
        return svg(`<rect x="36" y="${up ? 0 : 6}" width="28" height="${up ? 22 : 16}" fill="#cfd5e2" stroke="${OL}" stroke-width="${W}"/>` +
          `<path d="M40 22 H60 Q62 60 96 96 H4 Q38 60 40 22Z" fill="#3d7bd9" stroke="${OL}" stroke-width="${W}" stroke-linejoin="round"/>` +
          `<path d="M22 80 Q50 72 78 80" stroke="#9fd8ff" stroke-width="6" fill="none"/><path d="M44 32 Q40 64 20 88" stroke="#8fb8f0" stroke-width="4" fill="none" stroke-linecap="round"/>`);
      case 'tank':
        return svg(`<path d="${body(14, 72, up, down, 22, 10)}" fill="#f4f6fb" stroke="${OL}" stroke-width="${W}"/>` +
          `<rect x="16" y="40" width="68" height="20" fill="#e5383b"/>` +
          `<path d="M28 ${up ? 6 : 16} V${down ? 94 : 84}" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".8"/>`);
      case 'ring': {   // 切りはなしリング：黒と黄の しましまの うすい輪
        let g = `<rect x="18" y="0" width="64" height="100" fill="${up || down ? '#f4f6fb' : 'none'}" stroke="none"/>`;
        if (up) g += `<path d="M14 0 V30 M86 0 V30" stroke="${OL}" stroke-width="${W}"/>`;
        if (down) g += `<path d="M14 70 V100 M86 70 V100" stroke="${OL}" stroke-width="${W}"/>`;
        g += `<rect x="6" y="30" width="88" height="40" rx="6" fill="#ffd54a" stroke="${OL}" stroke-width="${W}"/>`;
        g += `<path d="M20 32 L8 48 M38 32 L18 68 M56 32 L36 68 M74 32 L54 68 M92 34 L72 68 M92 56 L84 68" stroke="#222" stroke-width="7"/>`;
        g += `<rect x="6" y="30" width="88" height="40" rx="6" fill="none" stroke="${OL}" stroke-width="${W}"/>`;
        return svg(g);
      }
      case 'win':
        return svg(`<path d="${body(14, 72, up, down, 22, 10)}" fill="#f4f6fb" stroke="${OL}" stroke-width="${W}"/>` +
          `<circle cx="50" cy="50" r="27" fill="#bfe6ff" stroke="#e5383b" stroke-width="7"/>` +
          `<g class="face"><circle cx="50" cy="52" r="15" fill="#ffd9b0"/><circle cx="44" cy="49" r="2.6" fill="${OL}"/><circle cx="56" cy="49" r="2.6" fill="${OL}"/>` +
          `<path d="M43 57 Q50 63 57 57" stroke="${OL}" stroke-width="2.6" fill="none" stroke-linecap="round"/>` +
          `<path d="M35 44 Q50 28 65 44" stroke="#fff" stroke-width="5" fill="none"/></g>`);
      case 'nose':
        return svg(`<path d="M50 4 Q86 46 86 ${down ? 100 : 94} H14 Q14 46 50 4Z" fill="#e5383b" stroke="${OL}" stroke-width="${W}" stroke-linejoin="round"/>` +
          `<path d="M40 30 Q30 50 28 80" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" opacity=".6"/>`);
      case 'booster': {
        const top = up ? 0 : 22, bot = down ? 100 : 74;
        let g = `<rect x="28" y="${top}" width="44" height="${bot - top}" fill="#f4f6fb" stroke="${OL}" stroke-width="${W}"/>`;
        if (!up) g += `<path d="M28 24 Q50 -6 72 24Z" fill="#ffb02e" stroke="${OL}" stroke-width="${W}" stroke-linejoin="round"/>`;
        if (!down) g += `<path d="M34 74 H66 L76 98 H24Z" fill="#7a849a" stroke="${OL}" stroke-width="${W}" stroke-linejoin="round"/>`;
        g += `<rect x="30" y="${up ? 40 : 46}" width="40" height="10" fill="#ffb02e"/>`;
        return svg(g);
      }
      case 'fin': {
        const s = ctx.side || 'both';
        if (s === 'left') return svg(`<path d="M100 18 L100 96 L8 96 Q22 60 100 18Z" fill="#ffd54a" stroke="${OL}" stroke-width="${W}" stroke-linejoin="round"/>`);
        if (s === 'right') return svg(`<path d="M0 18 L0 96 L92 96 Q78 60 0 18Z" fill="#ffd54a" stroke="${OL}" stroke-width="${W}" stroke-linejoin="round"/>`);
        return svg(`<path d="M50 10 L88 96 H12Z" fill="#ffd54a" stroke="${OL}" stroke-width="${W}" stroke-linejoin="round"/>`);
      }
      case 'leg':     // v0.12 パレットの 絵：着陸脚（＋＝つける部品）
        return svg(`<path d="M50 20 L14 84 M50 20 L86 84" stroke="${OL}" stroke-width="12" stroke-linecap="round"/><path d="M50 20 L14 84 M50 20 L86 84" stroke="#ffd54a" stroke-width="6" stroke-linecap="round"/>` +
          `<rect x="0" y="80" width="30" height="10" rx="5" fill="#cfd5e2" stroke="${OL}" stroke-width="4"/><rect x="70" y="80" width="30" height="10" rx="5" fill="#cfd5e2" stroke="${OL}" stroke-width="4"/>` + PLUS);
      case 'chute':   // v0.12 パレットの 絵：パラシュート
        return svg(`<path d="M8 44 Q50 -6 92 44 Q78 36 64 44 Q50 36 36 44 Q22 36 8 44Z" fill="#ff7a1a" stroke="${OL}" stroke-width="4" stroke-linejoin="round"/>` +
          `<path d="M36 44 Q50 10 64 44" fill="#fff" opacity=".85"/><path d="M8 44 L46 84 M36 44 L48 84 M64 44 L52 84 M92 44 L54 84" stroke="${OL}" stroke-width="3"/>` +
          `<rect x="42" y="80" width="16" height="12" rx="3" fill="#bfe6ff" stroke="${OL}" stroke-width="3"/>` + PLUS);
    }
    return '';
  }
  RL.paletteIcon = kind => RL.drawPart(kind, kind === 'fin' ? { side: 'left' } : kind === 'ring' ? { up: true, down: true } : {});
  RL.FLAME = '<svg viewBox="0 0 100 140"><path d="M20 0 H80 Q90 60 50 140 Q10 60 20 0Z" fill="#ff7a1a"/><path d="M34 0 H66 Q72 45 50 100 Q28 45 34 0Z" fill="#ffd54a"/><path d="M44 0 H56 Q58 25 50 55 Q42 25 44 0Z" fill="#fff"/></svg>';
  RL.VFLAME = '<svg viewBox="0 0 100 140"><path d="M8 0 H92 Q90 70 50 140 Q10 70 8 0Z" fill="#3d8bff" opacity=".85"/><path d="M28 0 H72 Q72 50 50 105 Q28 50 28 0Z" fill="#9fd8ff"/><path d="M42 0 H58 Q58 25 50 60 Q42 25 42 0Z" fill="#fff"/></svg>';

  // 各マスの描き方（上下のつながり・はねの向きと、どこにくっつくか）
  RL.layout = function (grid) {
    const R = grid.length, C = grid[0].length, out = [];
    const isBody = (r, c) => r >= 0 && r < R && c >= 0 && c < C && RL.BODY[grid[r][c]];
    const okB = (r, c) => r >= 0 && r < R && c >= 0 && c < C && grid[r][c] === 'booster' && !RL.isLooseBooster(grid, r, c);
    const att = (r, c) => isBody(r, c) || okB(r, c);
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const raw = grid[r][c]; if (!raw) continue;
      const k = RL.base(raw);
      const ctx = { up: !!isBody(r - 1, c) && !!RL.BODY[k] && k !== 'nose', down: !!isBody(r + 1, c) && !!RL.BODY[k] && grid[r + 1][c] !== 'nose' };
      if (k === 'fin') {
        const L = att(r, c - 1), Rt = att(r, c + 1);
        ctx.side = (Rt && !L) ? 'left' : (L && !Rt) ? 'right' : 'both';
        ctx.attC = ctx.side === 'left' ? c + 1 : ctx.side === 'right' ? c - 1 : (L ? c - 1 : Rt ? c + 1 : null);
      }
      ctx.att = RL.atts(raw).filter(a => (RL.ATTACH[a] || []).includes(k));   // v0.12 つけたもの
      if (RL.ATTACH[k]) ctx.loose = true;   // つける部品が マスに だけ ある（前の セーブ）は ロケットに ふくめない
      if (RL.ENGINES[k]) ctx.down = false;
      if (k === 'booster') { ctx.loose = RL.isLooseBooster(grid, r, c); ctx.up = !ctx.loose && okB(r - 1, c); ctx.down = !ctx.loose && okB(r + 1, c); }
      out.push({ r, c, k, ctx });
    }
    return out;
  };
  // 胴体の となりに ないブースター（くっついていない）
  RL.isLooseBooster = function (grid, r, c) {
    if (grid[r][c] !== 'booster') return false;
    const C = grid[0].length, b = cc => cc >= 0 && cc < C && RL.BODY[grid[r][cc]];
    return !b(c - 1) && !b(c + 1);
  };
  // 行 → 何段目か（リングの行は その下の段に ふくむ）
  RL.stageRows = function (grid) {
    const rr = [...new Set(grid.flatMap((row, r) => row.includes('ring') ? [r] : []))];
    return { ringRows: rr, n: rr.length + 1, of: r => rr.filter(x => x > r).length };
  };
})();
