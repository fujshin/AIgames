// ツール共通（うちゅうモード）：ブラウザ用のコードを Node で読む
global.window = global; const fs = require('fs'), d = __dirname + '/../js/';
for (const f of ['config.js', 'parts.js', 'physics.js', 'space.js', 'physics2d.js', 'predict.js']) (0, eval)(fs.readFileSync(d + f, 'utf8'));
const R = RL.CFG.ROWS, C = RL.CFG.COLS;
const toGrid = cols => { const R = RL.CFG.ROWS, g = Array.from({ length: R }, () => Array(C).fill(null)); cols.forEach((s, c) => s.slice(0, R).forEach((k, i) => g[R - 1 - i][c] = k)); return g; };   // v0.12：行数は その時の RL.CFG.ROWS
const fly = (cols, profile, opt) => RL.Orbit.runToEnd(RL.analyze(toGrid(cols)), Object.assign({ profile }, opt || {}));
module.exports = { RL, R, C, toGrid, fly };
