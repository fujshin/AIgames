// 部品の定義と、SVGでの描き方
RL.PART_ORDER = ['engine', 'vengine', 'tank', 'ring', 'booster', 'fin', 'win', 'nose'];
RL.BODY = { engine: 1, vengine: 1, tank: 1, win: 1, nose: 1, ring: 1 };   // 胴体としてつながる部品
RL.ENGINES = { engine: 1, vengine: 1 };

(function () {
  const OL = '#2b3245', W = 5;
  function body(x, w, up, down, rt, rb) {
    const y0 = up ? 0 : 4, y1 = down ? 100 : 96;
    rt = up ? 0 : rt; rb = down ? 0 : rb;
    return `M${x + rt} ${y0} H${x + w - rt} Q${x + w} ${y0} ${x + w} ${y0 + rt} V${y1 - rb} Q${x + w} ${y1} ${x + w - rb} ${y1} H${x + rb} Q${x} ${y1} ${x} ${y1 - rb} V${y0 + rt} Q${x} ${y0} ${x + rt} ${y0}Z`;
  }
  const svg = inner => `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${inner}</svg>`;

  RL.drawPart = function (kind, ctx) {
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
    }
    return '';
  };
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
      const k = grid[r][c]; if (!k) continue;
      const ctx = { up: !!isBody(r - 1, c) && !!RL.BODY[k] && k !== 'nose', down: !!isBody(r + 1, c) && !!RL.BODY[k] && grid[r + 1][c] !== 'nose' };
      if (k === 'fin') {
        const L = att(r, c - 1), Rt = att(r, c + 1);
        ctx.side = (Rt && !L) ? 'left' : (L && !Rt) ? 'right' : 'both';
        ctx.attC = ctx.side === 'left' ? c + 1 : ctx.side === 'right' ? c - 1 : (L ? c - 1 : Rt ? c + 1 : null);
      }
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
