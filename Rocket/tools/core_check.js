const { RL, toGrid } = require('./lib2d.js'); RL.CFG.ROWS = RL.CFG.ROWS_ORBIT;
const T=n=>Array(n).fill('tank');
const core=n=>[...T(n),'ring','vengine',...T(2),'win+chute','nose'];
const D={
 'A まんなかT4・よこE+T3 せんなし':[[],['fin','engine',...T(3)],core(4),['fin','engine',...T(3)],[]],
 'B 二重 そとE+T2(せん) うちE+T2 まんなかT4':[['fin','engine+valve',...T(2)],['engine',...T(2)],core(4),['engine',...T(2)],['fin','engine+valve',...T(2)]],
 'C 二重 そとE+T2 うちE+T2 せんなし まんなかT4':[['fin','engine',...T(2)],['engine',...T(2)],core(4),['engine',...T(2)],['fin','engine',...T(2)]],
};
for(const k in D){const a=RL.analyze(toGrid(D[k])),s=RL.Orbit.create(a,{profile:'side'});
 const c0=s.stages[0].fuel,log=[];
 while(!s.done&&s.t<300&&s.si===0){s.advance(0.02);s.events.splice(0).forEach(e=>{if(e.type==='booster-sep'&&e.pod)log.push(`よこ×${e.n}@${s.t.toFixed(1)} まんなか${(s.stages[0].fuel/c0*100).toFixed(0)}%`);if(e.type==='stage-sep')log.push(`段@${s.t.toFixed(1)} すてた まんなか${(s.stages[0].fuel/c0*100).toFixed(0)}%`);});}
 console.log(k,'| pods',a.stacks.filter(x=>x.pod).map(x=>x.c+(x.noXF?'v':'')).join(','),'| T/W',(s.thrust/s.weight).toFixed(2),'| 高さ',Math.round(s.maxAlt),'|',(s.done&&s.done.type)||'',log.join(' / '));}
