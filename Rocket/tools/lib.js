// ツール共通：ブラウザ用のコードを Node で読む
global.window = global; const fs = require('fs'), d = __dirname + '/../js/';
for (const f of ['config.js', 'parts.js', 'physics.js']) (0, eval)(fs.readFileSync(d + f, 'utf8'));
const R = RL.CFG.ROWS, C = RL.CFG.COLS;
// cols: 列ごとの配列（左から、下→上）
const toGrid = cols => { const g = Array.from({ length: R }, () => Array(C).fill(null)); cols.forEach((s, c) => s.slice(0, R).forEach((k, i) => g[R - 1 - i][c] = k)); return g; };
const run = cols => RL.simulate(RL.analyze(toGrid(cols)));
const H = cols => { const s = run(cols); return s.lift ? s.h : 0; };
module.exports = { RL, R, C, toGrid, run, H };
// 探索を速くするとき：FAST=1 で計算のきざみを粗くする（最後に細かいきざみで確かめる）
if (process.env.FAST) RL.CFG.PHYS.DT = 0.06;
