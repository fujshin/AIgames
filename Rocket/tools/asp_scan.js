// v0.20.1 アスパラガスの しらべ：5れつ（E+T2）× 上の 段 × せんの つけ方 で 低い軌道に のれるか。PROF=tilt などで 打ち上げかた

const { RL, toGrid } = require('./lib2d.js');
RL.CFG.ROWS = RL.CFG.ROWS_ORBIT;
const T = n => Array(n).fill('tank');
const E = v => 'engine' + (v ? '+valve' : '');
function fly(cols, prof, detail){
  const a = RL.analyze(toGrid(cols)), s = RL.Orbit.create(a, { profile: prof, autoEnd:true });
  const ev=[];
  while (!s.done && s.t < 20000) {
    s.advance(s.isPowered()?0.02:Math.max(0.02,Math.min(s.autoWarp(),200)*0.05));
    s.events.splice(0).forEach(e=>{ if(e.type==='booster-sep'&&e.pod) ev.push(`よこ@${s.t.toFixed(1)}h${Math.round(s.alt())}`); if(e.type==='stage-sep') ev.push(`段@${s.t.toFixed(1)}h${Math.round(s.alt())}`); if(e.type==='space') ev.push(`宇宙@${s.t.toFixed(1)}`); });
    const el = s.elements();
    if (s.engineOn && s.lifted && el && el.e < 1 && el.rp > s.body.R + s.body.atmo + 20) { s.setEngine(false); return `★軌道 残Δv${Math.round(s.dvLeftV())} ▼${Math.round(el.rp-12000)}▲${Math.round(el.ra-12000)}`+(detail?' '+ev.join(' '):''); }
    if (!s.liquidLeft() && !s.isPowered() && s.lifted) { const e=s.elements(); return `燃尽 ${s.cls} ▼${Math.round(e.rp-12000)}▲${e.e<1?Math.round(e.ra-12000):'∞'} 最高${Math.round(s.maxAlt)}`+(detail?' '+ev.join(' '):''); }
  }
  return 'end '+(s.done&&s.done.type)+' 最高'+Math.round(s.maxAlt)+(detail?' '+ev.join(' '):'');
}
module.exports={fly};
if(require.main===module){
const UPS = { 'V3': ['ring','vengine',...T(3),'win+chute','nose'], 'V4': ['ring','vengine',...T(4),'win+chute','nose'], 'V2|V2':['ring','vengine',...T(2),'ring','vengine',...T(2),'win+chute'] };
for (const u in UPS) for (const [nm,v] of [['せんなし',[0,0]],['せん全部',[1,1]],['そとだけ',[1,0]]]) {
  const core=['engine',...T(2),...UPS[u]];
  const cols=[['fin',E(v[0]),...T(2)],[E(v[1]),...T(2)],core,[E(v[1]),...T(2)],['fin',E(v[0]),...T(2)]];
  console.log(u.padEnd(6), nm.padEnd(5), fly(cols,process.env.PROF||'side',1));
}}
