// 部品の定義と、SVGでの描き方
// ctx = {up, down, side}  up/down: 上下に胴体がつながっているか / side: はねの向き
RL.PART_ORDER = ['engine', 'tank', 'booster', 'fin', 'win', 'nose'];
RL.BODY = { engine: 1, tank: 1, win: 1, nose: 1 };   // 胴体としてつながる部品

(function () {
  const OL = '#2b3245', W = 5;             // ふちの色と太さ
  function body(x, w, up, down, rt, rb) {   // 角丸を上下別に指定できる胴体
    const y0 = up ? 0 : 4, y1 = down ? 100 : 96;
    rt = up ? 0 : rt; rb = down ? 0 : rb;
    return `M${x + rt} ${y0} H${x + w - rt} Q${x + w} ${y0} ${x + w} ${y0 + rt} V${y1 - rb} Q${x + w} ${y1} ${x + w - rb} ${y1} H${x + rb} Q${x} ${y1} ${x} ${y1 - rb} V${y0 + rt} Q${x} ${y0} ${x + rt} ${y0}Z`;
  }
  const svg = (inner) => `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${inner}</svg>`;

  RL.drawPart = function (kind, ctx) {
    ctx = ctx || {};
    const up = !!ctx.up, down = !!ctx.down;
    switch (kind) {
      case 'engine':   // ラッパ型のノズル
        return svg(
          `<rect x="26" y="${up ? 0 : 6}" width="48" height="${up ? 30 : 24}" fill="#cfd5e2" stroke="${OL}" stroke-width="${W}"/>` +
          `<path d="M30 30 H70 L90 96 H10Z" fill="#7a849a" stroke="${OL}" stroke-width="${W}" stroke-linejoin="round"/>` +
          `<path d="M24 66 H76" stroke="#ff9a3d" stroke-width="7"/><path d="M36 38 L28 88" stroke="#a7b0c4" stroke-width="5" stroke-linecap="round"/>`);
      case 'tank':     // 白と赤のしましまの胴体
        return svg(
          `<path d="${body(14, 72, up, down, 22, 10)}" fill="#f4f6fb" stroke="${OL}" stroke-width="${W}"/>` +
          `<rect x="16" y="40" width="68" height="20" fill="#e5383b"/>` +
          `<path d="M28 ${up ? 6 : 16} V${down ? 94 : 84}" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".8"/>`);
      case 'win':      // まど：中で宇宙飛行士が手をふる
        return svg(
          `<path d="${body(14, 72, up, down, 22, 10)}" fill="#f4f6fb" stroke="${OL}" stroke-width="${W}"/>` +
          `<circle cx="50" cy="50" r="27" fill="#bfe6ff" stroke="#e5383b" stroke-width="7"/>` +
          `<g class="face"><circle cx="50" cy="52" r="15" fill="#ffd9b0"/><circle cx="44" cy="49" r="2.6" fill="${OL}"/><circle cx="56" cy="49" r="2.6" fill="${OL}"/>` +
          `<path d="M43 57 Q50 63 57 57" stroke="${OL}" stroke-width="2.6" fill="none" stroke-linecap="round"/>` +
          `<path d="M35 44 Q50 28 65 44" stroke="#fff" stroke-width="5" fill="none"/></g>`);
      case 'nose':     // とがった先っぽ
        return svg(
          `<path d="M50 4 Q86 46 86 ${down ? 100 : 94} H14 Q14 46 50 4Z" fill="#e5383b" stroke="${OL}" stroke-width="${W}" stroke-linejoin="round"/>` +
          `<path d="M40 30 Q30 50 28 80" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" opacity=".6"/>`);
      case 'booster': { // ほそい白いブースター。上がなければ丸い頭、下がなければノズル
        const top = up ? 0 : 22, bot = down ? 100 : 74;
        let g = `<rect x="28" y="${top}" width="44" height="${bot - top}" fill="#f4f6fb" stroke="${OL}" stroke-width="${W}"/>`;
        if (!up) g += `<path d="M28 24 Q50 -6 72 24Z" fill="#ffb02e" stroke="${OL}" stroke-width="${W}" stroke-linejoin="round"/>`;
        if (!down) g += `<path d="M34 74 H66 L76 98 H24Z" fill="#7a849a" stroke="${OL}" stroke-width="${W}" stroke-linejoin="round"/>`;
        g += `<rect x="30" y="${up ? 40 : 46}" width="40" height="10" fill="#ffb02e"/>`;
        return svg(g);
      }
      case 'fin': {    // はね：つく場所で向きが変わる
        const s = ctx.side || 'both';
        if (s === 'left')   // 右どなりの胴体にくっつく → 左向き
          return svg(`<path d="M100 18 L100 96 L8 96 Q22 60 100 18Z" fill="#ffd54a" stroke="${OL}" stroke-width="${W}" stroke-linejoin="round"/>`);
        if (s === 'right')
          return svg(`<path d="M0 18 L0 96 L92 96 Q78 60 0 18Z" fill="#ffd54a" stroke="${OL}" stroke-width="${W}" stroke-linejoin="round"/>`);
        return svg(`<path d="M50 10 L88 96 H12Z" fill="#ffd54a" stroke="${OL}" stroke-width="${W}" stroke-linejoin="round"/>`);
      }
    }
    return '';
  };

  // パレットに出す見本（はねは右向き、ほかは単体）
  RL.paletteIcon = function (kind) {
    return RL.drawPart(kind, kind === 'fin' ? { side: 'left' } : {});
  };

  // ほのお（エンジンの下に出す）
  RL.FLAME = '<svg viewBox="0 0 100 140"><path d="M20 0 H80 Q90 60 50 140 Q10 60 20 0Z" fill="#ff7a1a"/><path d="M34 0 H66 Q72 45 50 100 Q28 45 34 0Z" fill="#ffd54a"/><path d="M44 0 H56 Q58 25 50 55 Q42 25 44 0Z" fill="#fff"/></svg>';

  // グリッドの各マスの描き方（つながり・はねの向き）を決める
  RL.layout = function (grid) {
    const R = grid.length, C = grid[0].length, out = [];
    const isBody = (r, c) => r >= 0 && r < R && c >= 0 && c < C && RL.BODY[grid[r][c]];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const k = grid[r][c]; if (!k) continue;
      const ctx = { up: !!isBody(r - 1, c) && RL.BODY[k] && k !== 'nose', down: !!isBody(r + 1, c) && RL.BODY[k] && grid[r + 1][c] !== 'nose' };
      if (k === 'fin') {
        const att = (rr, cc) => isBody(rr, cc) || (cc >= 0 && cc < C && grid[rr][cc] === 'booster'); // ブースターにもつく
        const L = att(r, c - 1), Rt = att(r, c + 1);
        ctx.side = (Rt && !L) ? 'left' : (L && !Rt) ? 'right' : 'both';
      }
      if (k === 'engine') ctx.down = false;
      if (k === 'booster') { ctx.up = r > 0 && grid[r - 1][c] === 'booster'; ctx.down = r < R - 1 && grid[r + 1][c] === 'booster'; }
      out.push({ r, c, k, ctx });
    }
    return out;
  };
})();
