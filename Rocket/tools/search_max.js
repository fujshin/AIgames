// 届く高さの最大を探す（レイアウトをランダムに変えて山登り。何度もやり直す）
// 使い方: node tools/search_max.js [回数]
global.window=global;const fs=require('fs');const d=__dirname+'/../js/';
for(const f of ['config.js','parts.js','physics.js'])(0,eval)(fs.readFileSync(d+f,'utf8'));
const R=RL.CFG.ROWS,C=RL.CFG.COLS,K=['engine','tank','booster','fin','win','nose'];
const toGrid=cols=>{const g=Array.from({length:R},()=>Array(C).fill(null));cols.forEach((s,c)=>s.forEach((k,i)=>g[R-1-i][c]=k));return g;};
const H=cols=>{const s=RL.simulate(RL.analyze(toGrid(cols)));return s.lift?s.h:0;};
const rnd=a=>a[Math.floor(Math.random()*a.length)];
function mutate(cols){const n=cols.map(s=>s.slice()),c=Math.floor(Math.random()*C),s=n[c],r=Math.random();
 if(r<.35&&s.length<R)s.push(rnd(K));else if(r<.5&&s.length)s.pop();else if(s.length){s[Math.floor(Math.random()*s.length)]=rnd(K);}
 else s.push(rnd(K));return n;}
const N=+process.argv[2]||300;let best={h:0};
for(let run=0;run<N;run++){let cur=Array.from({length:C},()=>[]),hc=0,T=200;
 for(let i=0;i<2500;i++){const nx=mutate(cur),hn=H(nx);if(hn>=hc||Math.random()<Math.exp((hn-hc)/T)){cur=nx;hc=hn;}T*=0.998;
  if(hc>best.h)best={h:hc,cols:cur.map(s=>s.slice())};}
 if(process.env.PROGRESS)console.log('run',run,Math.round(best.h),JSON.stringify(best.cols));}
console.log('最大の高さ',Math.round(best.h),RL.CFG.ZONES[RL.zoneOf(best.h)].icon);
console.log('そのときの列（左から、下→上）');best.cols.forEach((s,c)=>console.log(' 列'+c+':',s.join(' / ')||'-'));
const s=RL.simulate(RL.analyze(toGrid(best.cols)));console.log('飛行時間',s.tTotal.toFixed(1)+'s');
