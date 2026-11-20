// 代表的な構成の一覧 ＋ 規則的な構成の総当たりで最大を確認
global.window=global;const fs=require('fs');const d=__dirname+'/../js/';
for(const f of ['config.js','parts.js','physics.js'])(0,eval)(fs.readFileSync(d+f,'utf8'));
const R=RL.CFG.ROWS,C=RL.CFG.COLS;
const toGrid=cols=>{const g=Array.from({length:R},()=>Array(C).fill(null));cols.forEach((s,c)=>s.slice(0,R).forEach((k,i)=>g[R-1-i][c]=k));return g;};
const run=cols=>RL.simulate(RL.analyze(toGrid(cols)));
const T=n=>Array(n).fill('tank'),B=n=>Array(n).fill('booster');
const core=(t,nose=true)=>['engine',...T(t),...(nose?['nose']:[])];
// 列: [左外, 左, 中央, 右, 右外]
const cases={
 'E':[[],['fin'],core(0,false),['fin'],[]],
 'E+T':[[],['fin'],core(1,false),['fin'],[]],
 'E+2T':[[],['fin'],core(2,false),['fin'],[]],
 'E+2T+N':[[],['fin'],core(2),['fin'],[]],
 'E+2T はねなし':[[],[],core(2,false),[],[]],
 'E+5T':[[],['fin'],core(5,false),['fin'],[]],
 'E+5T+N':[[],['fin'],core(5),['fin'],[]],
 'E+6T':[[],['fin'],core(6,false),['fin'],[]],
};
for(const L of [1,2,3,4,5,6]) cases['E+5T+N  B'+L+'段×2本 はね外']=[['fin'],B(L),core(5),B(L),['fin']];
cases['E+5T+N  B3段×2本 はねなし']=[[],B(3),core(5),B(3),[]];
for(const L of [1,3,6]) cases['E+2T+N  B'+L+'段×2本 はね外']=[['fin'],B(L),core(2),B(L),['fin']];
for(const L of [3,6]) cases['E+5T+N  B'+L+'段×4本']=[B(L),B(L),core(5),B(L),B(L)];
const fmt=(k,s)=>k.padEnd(26)+String(Math.round(s.h)).padStart(5)+' '+RL.CFG.ZONES[RL.zoneOf(s.h)].icon+(s.lift?'':' '+s.reason)+
 '  出だし加速='+(s.samples[0]?(s.samples[0].acc*s.k*s.k).toFixed(1):'-')+'  切離し='+((s.seps||[]).filter(x=>x.t!=null).map(x=>(x.t).toFixed(1)+'s').join(',')||'-')+'  飛行'+((s.tTotal||0).toFixed(1))+'s';
for(const k in cases) console.log(fmt(k,run(cases[k])));
// 総当たり：中央の列(エンジン+燃料0-6+先っぽ有無)×左右対称のブースター長さ(0-7)×外側(ブースター0-7/はね)
let best={h:0};
const sides=[[]];for(let L=1;L<=7;L++)sides.push(B(L));sides.push(['fin']);for(let L=1;L<=6;L++)sides.push(['fin',...B(L)]);
for(let t=0;t<=6;t++)for(const nose of [true,false])for(const s1 of sides)for(const s2 of sides){
 const cols=[s2,s1,core(t,nose),s1,s2],s=run(cols);if(s.lift&&s.h>best.h)best={h:s.h,cols};}
console.log('\n対称な構成の総当たり 最大:',Math.round(best.h),RL.CFG.ZONES[RL.zoneOf(best.h)].icon,JSON.stringify(best.cols));
