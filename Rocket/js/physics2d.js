// うちゅうモードの 飛び方（2D）。たかさモードと ちがい、1こまずつ 進める（とちゅうで エンジンを止める・中止 ができる）
//  - 位置・速度は「いま いる重力圏の天体」から見た値（パッチドコニック）。重力は その天体だけ（距離の2乗に反比例）
//  - エンジンを使っている間・くうきの中：小さな きざみで 数値積分
//  - 惰性で うちゅうを飛ぶ間：ケプラー軌道の式で 位置を出す（レール上）。早送りしても 軌道が くずれない
//  - 段・ブースター・宇宙用エンジン・はね は たかさモード（physics.js）と同じ きまり
//  - 液体エンジン（地上用・宇宙用）は 止めて また つけられる。ブースター（固体）は 止められない
//  - v0.10：向き（sim.dir）。'auto'＝打ち上げの 自動／'pro'＝すすむ向き（前へ）／'retro'＝反対（うしろへ・ブレーキ）
//           えらべるのは くうきの外だけ。うちゅうで いちど エンジンを とめたら、つぎからは 'pro'
//  - v0.11：月着陸。月の 地面に ふれた ときの 速さで 着陸／衝突。月の 地面ちかく（LAND.NEAR）では エンジンを 月の重力の TWR 倍まで 自動で しぼる
//           「うしろへ」で ほぼ とまったら、真上に むけて 浮く（ホバー）。エンジンを とめると おちる
//           着陸脚（leg）が のこっていると ゆるされる 速さが LEG_K 倍
//           snapshot()／restore()：ここからやり直し
//  - v0.12：地球にも 着陸（いちど エンジンを とめた あとは くうきの中でも 向きを えらべる）。地面に たいする 速さで はんてい
//           パラシュート（deployChute）。空中から 始める（opt.start）。スローモーションの 作り直し（slowWarp）
//  - v0.13：月往還。月に 着陸しても 液体燃料が のこれば おわらず 月面で まつ（sim.surface。時間は とまる）
//           月面で エンジン → 自動で 月を まわる ところまで 離陸（dir 'ascent'）。✂️ 手で 切りはなす（separate）
//           月面に 着陸 した あと 地球に 着陸 ＝ 往還（done.returned）。最大G（sim.maxG）
RL.Orbit = (function () {
  const SP = RL.Space, D2R = Math.PI / 180;
  const sum = (arr, f) => arr.reduce((z, x) => z + f(x), 0);
  function create(a, opt) {
    opt = opt || {};
    const P = RL.CFG.PHYS, O = RL.CFG.ORBIT, W = SP.makeBodies(), earth = W.earth, moon = W.moon;
    const prof = O.PROFILES[opt.profile || 'side'] || O.PROFILES.side;
    const TbOf = seg => P.BOOST_THRUST * Math.pow(seg, P.BOOST_SEG_POW || 0);
    const S = a.stages.map(s => ({ ...s, ignT: null, sepT: null }));
    const st = a.stacks.map(s => ({ ...s, ignT: null, sepT: null, withStage: false }));
    const last = S.length - 1;
    const ev = [];                                   // 演出用の できごと（flight2d が 取り出す）
    const emit = (type, d) => ev.push({ type, t: sim.t, ...(d || {}) });
    const ignite = (i, t) => { S[i].ignT = t; st.forEach(s => { if (s.stage === i) s.ignT = t; }); };
    const attached = s => s.sepT === null && s.stage >= sim.si;
    const fins = () => { const f = { L: 0, R: 0, M: 0 };
      S.slice(sim.si).forEach(x => { f.L += x.coreFin.L; f.R += x.coreFin.R; f.M += x.coreFin.M; });
      st.filter(attached).forEach(s => s.fins.forEach(sd => sd === 'left' ? f.L++ : sd === 'right' ? f.R++ : f.M++));
      f.n = f.L + f.R + f.M; return f; };
    const devTarget = f => (f.n === 0 ? P.TILT_NOFIN : 0.08 * Math.abs(f.L - f.R) / f.n) + Math.min(0.4, a.asym * P.TILT_ASYM / (1 + f.n));
    const site = O.SITE;
    const sim = {
      t: 0, body: earth, bodies: W, x: earth.R * Math.cos(site), y: earth.R * Math.sin(site), vx: 0, vy: 0,
      landed: true, lifted: false, si: 0, engineOn: true, dev: 0, devDir: 1, el: null, rails: false,
      maxAlt: 0, maxV: 0, done: null, cls: null, coastT: 0, stableT: 0, inSpace: false,
      thrust: 0, mass: 0, weight: 0, pitch: 90, point: Math.PI / 2, rho: 1, vpow: P.VAIR, burnC: false, boost: false,
      profile: opt.profile || 'side', dir: 'auto', stages: S, stacks: st, a,
      dvUsed: 0, throttle: 1, near: false, hover: false, legsOut: false, fuelBase: 0,
      chute: null, chuteOpen: 0, encLock: false, kAir: 0, chuteW: 0, hoverW: 0,
      surface: false, moonLanded: false, leftStages: [], maxG: 0, surfJ: null,
        station: opt.station ? SP.makeStation(earth) : null, docked: false, dockArm: true   // v0.20 ⛽（opt.station のときだけ。ミッションでは つかわない）
    };
    sim.vx = -earth.rot * sim.y; sim.vy = earth.rot * sim.x;    // 地面と いっしょに まわっている
    ignite(0, 0);
    { const f = fins(); sim.dev = devTarget(f); sim.devDir = Math.sign(f.L - f.R) || 1; }
    function coreFuel0() { return S.slice(sim.si).reduce((z, y) => z + y.fuel, 0); }
    // v0.12：空中から 始める（ミッション用）。{ h, vDown, vSide, fuel }：さいごの 段だけ、燃料は 割合
    //   v0.14：{ orbit: { pe, ap, at: 'pe'|'ap' }, stages, fuel }：地球を まわる 軌道の 上から（ミッション用）。stages＝上から いくつの 段を のこすか
    if (opt.start) {
      const o = opt.start, keep = Math.max(1, Math.min(last + 1, o.stages || 1)), s0 = last - keep + 1;
      sim.si = s0; S.forEach((x, i) => { if (i < s0) { x.sepT = 0; x.fuel = 0; } else x.fuel *= o.fuels ? (o.fuels[i - s0] == null ? 1 : o.fuels[i - s0]) : o.fuel == null ? 1 : o.fuel; });   // v0.19 fuels：段ごとの 燃料（下から）
        st.forEach(x => { x.sepT = 0; x.withStage = true; x.fuel = 0; });   // v0.20：v0.19 で コメントに 入って きえていた
      S[s0].ignT = 0;
        if (o.moon) {   // v0.17 5章：月の まわりから。{ pe, ap }＝月を まわる 軌道（▼の ところ）、{ h, vDown, vSide }＝月の 上から おちる
          const mo = o.moon, ang = mo.ang != null ? mo.ang : Math.PI / 2;
          let r0, vr = 0, vt;
          if (mo.pe != null) { const rp = moon.R + mo.pe, ra = moon.R + mo.ap, sma = (rp + ra) / 2; r0 = rp; vt = Math.sqrt(moon.mu * (2 / rp - 1 / sma)); }
          else { r0 = moon.R + (mo.h || 0); vr = -(mo.vDown || 0); vt = mo.vSide || 0; }
          const ux = Math.cos(ang), uy = Math.sin(ang);
          Object.assign(sim, { body: moon, x: r0 * ux, y: r0 * uy, vx: vr * ux - vt * uy, vy: vr * uy + vt * ux, landed: false, lifted: true, engineOn: false, dir: 'pro', maxAlt: 1000, inSpace: true });
          // v0.19 6章：月面から（surface）。月に 着陸した あとの ように（月面で まつ）。been＝月に 着陸した ことに する（かえれる 線・往還）
          if (mo.surface) { Object.assign(sim, { landed: true, surface: true, near: true, legsOut: true, vx: 0, vy: 0 });
            sim.surfJ = { vDown: 0, vSide: 0, tilt: 0, legs: 1, k: 1, type: 'landed', hard: false, soft: true }; sim.surfAng = ang; sim.onMoon = { ang }; }
          if (mo.surface || mo.been) sim.moonLanded = true;
        } else if (o.orbit) {        // v0.15：ap: 'moon' ＝ 月の 高さまで。ang ＝ はじめの 位置（rad）。lead（rad）＝ 月へ むかう とちゅう：
        //   月の 高さに つく ときに 月が ちょうど そこに いる 位置から はじめる（lead だけ ずらすと 月の 前／うしろを とおる）
        //   burnIn（秒）＝ ひくい 軌道で、この 時間 あとに「ここで ふかす」ところに つく 位置から はじめる（4-1・4-2）
        const D = moon.orbitR, apH = o.orbit.ap === 'moon' ? D - earth.R : o.orbit.ap;
        const rp = earth.R + o.orbit.pe, ra = earth.R + apH, sma = (rp + ra) / 2; let r0 = o.orbit.at === 'ap' ? ra : rp, v = Math.sqrt(earth.mu * (2 / r0 - 1 / sma));
        let ang = o.orbit.ang != null ? o.orbit.ang : site;
        if (o.orbit.lead != null) ang = moon.ph0 + moon.w * Math.PI * Math.sqrt(sma * sma * sma / earth.mu) - Math.PI + o.orbit.lead;
        if (o.orbit.burnIn != null) { const th = Math.PI * Math.sqrt(Math.pow((rp + D) / 2, 3) / earth.mu), n = Math.sqrt(earth.mu / (rp * rp * rp));
          ang = moon.ph0 + moon.w * (o.orbit.burnIn + th) - Math.PI - n * o.orbit.burnIn; }
        const ux = Math.cos(ang), uy = Math.sin(ang);
        Object.assign(sim, { x: r0 * ux, y: r0 * uy, vx: -v * uy, vy: v * ux, landed: false, lifted: true, engineOn: false, dir: 'pro', maxAlt: r0 - earth.R, inSpace: true });
        // v0.19 6章：nu（rad）＝ 軌道の 上の 位置（近い ところから の 角度。マイナス＝近い ところの 手前＝おりてくる とちゅう）。ang は その 位置の 向き
        if (o.orbit.nu != null) { const e = (ra - rp) / (ra + rp), p = sma * (1 - e * e), nu = o.orbit.nu, k = Math.sqrt(earth.mu / p);
          r0 = p / (1 + e * Math.cos(nu)); const vr = k * e * Math.sin(nu), vt = k * (1 + e * Math.cos(nu));
          Object.assign(sim, { x: r0 * ux, y: r0 * uy, vx: vr * ux - vt * uy, vy: vr * uy + vt * ux, maxAlt: Math.max(1000, r0 - earth.R) }); }
        if (o.been || o.orbit.been) sim.moonLanded = true;
      } else {
        const r0 = earth.R + o.h, ux = Math.cos(site), uy = Math.sin(site);
        const vt = earth.rot * r0 + (o.vSide || 0), vr = -(o.vDown || 0);
        Object.assign(sim, { x: r0 * ux, y: r0 * uy, vx: vr * ux - vt * uy, vy: vr * uy + vt * ux, landed: false, lifted: true, engineOn: false, dir: 'pro', maxAlt: o.h, inSpace: o.h > earth.atmo });
      }
      sim.dev = 0; sim.point = Math.PI / 2; sim.pitch = 90; sim.fuelBase = coreFuel0();
        if (sim.lifted && !sim.surface) sim.cls = clsOf(SP.toElements(sim.x, sim.y, sim.vx, sim.vy, sim.body.mu, sim.t));   // v0.19：はじめから 軌道の 種類（とめて 話す 間も 地図の しるしが でる）
    }
    const hasProp = S.some(s => s.eng + s.veng > 0) || st.length || (opt.start && opt.noPropOk);
    if (!hasProp) sim.done = { type: 'noEngine' };
    const mass = () => Math.max(0.1, sum(S.slice(sim.si), x => x.dry + x.fuel) + sum(st.filter(attached), x => x.dry + x.fuel));
    const alt = () => Math.hypot(sim.x, sim.y) - sim.body.R;
    const rhoAt = h => sim.body.atmo ? Math.max(0, 1 - h / sim.body.atmo) : 0;
    const coreFuel = () => sum(S.slice(sim.si), y => y.fuel);
      const podLive = s => s.pod && s.sepT === null && s.stage >= sim.si && s.fuel > 0 && s.eng + s.veng > 0;   // v0.16 よこの 段
      const liquidLeft = () => { const c = S[sim.si]; return (c.fuel > 0 && c.eng + c.veng > 0) || st.some(podLive); };
      const canBurnCore = () => { const c = S[sim.si]; return (c.fuel > 0 && c.eng + c.veng > 0 && sim.t >= c.ignT) || st.some(s => podLive(s) && s.ignT !== null && sim.t >= s.ignT); };
      const boosting = () => st.some(s => !s.pod && s.sepT === null && s.ignT !== null && sim.t >= s.ignT && s.fuel > 0);
    const inAirNow = () => !!sim.body.atmo && Math.hypot(sim.x, sim.y) - sim.body.R < sim.body.atmo;
    const LDof = b => O.LAND[b.id] || O.LAND.moon;   // v0.12：天体ごとの 着陸の きまり
    // 着陸脚（いまも のこっている 段の 脚。1こ ＝ 左右1組）・パラシュートの 数
    const legs = () => { const n = sum(S.slice(sim.si), x => x.legs || 0); return { n, L: n, R: n }; };
    const chutes = () => sum(S.slice(sim.si), x => x.chutes || 0);
    sim.legs = legs; sim.chutes = chutes;
    // 地面（まわっている）に たいする 上むき・よこの 速さ
    const relVel = () => { const b = sim.body, r = Math.hypot(sim.x, sim.y), ux = sim.x / r, uy = sim.y / r;
      return { r, ux, uy, vr: sim.vx * ux + sim.vy * uy, vt: sim.vx * -uy + sim.vy * ux - b.rot * r }; };
    sim.relVel = relVel;
    // v0.20 ⛽ ステーションと くらべた きょり・はやさ（地球の まわり だけ）
    const DK = O.DOCK || { DIST: 500, V_REL: 12, REARM: 1.5 };
    const stRel = () => { if (sim.body !== earth || !sim.station) return null; const q = SP.stationState(sim.station, sim.t);
      return { d: Math.hypot(sim.x - q.x, sim.y - q.y), v: Math.hypot(sim.vx - q.vx, sim.vy - q.vy), q }; };
    sim.stRel = stRel;
    function dock(q) { const s = q.q; Object.assign(sim, { docked: true, dockedEver: true, dockArm: false, x: s.x, y: s.y, vx: s.vx, vy: s.vy, el: null, dir: 'pro', engineOn: false });
      emit('dock', { d: q.d, v: q.v }); }
    const fullFuel = () => S.slice(sim.si).every(x => x.fuel >= (a.stages[x.i].fuel || 0) - 1e-6) && st.filter(s => s.pod && attached(s)).every(s => s.fuel >= (a.stacks.find(y => y.id === s.id) || {}).fuel - 1e-6);
    sim.fullFuel = fullFuel;
    // v0.11：いまの 段の 液体エンジンの 全力（しぼる 前）
      const coreFull = rho => { const c = S[sim.si], vpow = P.VAIR + (1 - P.VAIR) * (1 - rho), on = c.fuel > 0 ? 1 : 0;
        return (c.eng * P.THRUST + c.veng * P.VTHRUST * vpow) * on + st.filter(s => podLive(s) && s.ignT !== null && sim.t >= s.ignT).reduce((z, s) => z + s.eng * P.THRUST + s.veng * P.VTHRUST * vpow, 0); };
    sim.fuelBase = coreFuel() || 1;   // v0.11.1：燃料メーターの 100%（切りはなしの たびに その ときの のこりを 100% に）
    sim.isPowered = () => (sim.engineOn && canBurnCore()) || boosting() || (S[sim.si].ignT > sim.t);
    // ---- ピッチ（地平線からの角度）を自動で きめる ----
    function guidance(h, r, vr, vt, aT, g) {
      if (h < O.TURN_START || prof.pitch >= 90) return 90;
      const top = sim.body.atmo, k = Math.min(1, (h - O.TURN_START) / Math.max(1, prof.turnH - O.TURN_START));
      if (!prof.hold) return 90 - (90 - prof.pitch) * Math.sqrt(k);
      // よこ：上下の速さが めあてに なるように 角度を えらぶ（力が よわいほど 上むきに）
      //   上むきに 要る加速 ＝ 重力 − 横の速さによる 遠心力 ＋ めあての上下の速さとの差
      const inAir = top && h < top, gain = inAir ? 0.5 : O.HOLD_GAIN;
      const vrT = inAir ? O.CLIMB_V : Math.max(-10, Math.min(25, 0.2 * (top * O.HOLD_H - h)));   // くうきの外：少し上の高さを たもつ
      const need = g - vt * vt / r + gain * (vrT - vr);
      const th = aT > 0 ? Math.asin(Math.max(0, Math.min(1, need / aT))) / D2R : 90;
      return inAir ? Math.max(th, 90 - (90 - prof.pitch) * k) : th;
    }
    // v0.10：「前へ／うしろへ」の ときの おす向き（地平線からの 角度。いまの 天体から 見た 速さの 向き）
    function aimAngle() {
      const r = Math.hypot(sim.x, sim.y), ux = sim.x / r, uy = sim.y / r, ex = -uy, ey = ux;
      // くうきの中は まわる 空気（地面）に たいする 速さ、そとは 天体に たいする 速さ（v0.12）
      const b = sim.body, inA = b.atmo && r - b.R < b.atmo, wx = sim.vx + (inA ? b.rot * sim.y : 0), wy = sim.vy - (inA ? b.rot * sim.x : 0);
      const k = sim.dir === 'retro' ? -1 : 1, vx = wx * k, vy = wy * k;
      if (Math.hypot(vx, vy) < 1e-6) return sim.point;
      return Math.atan2(vx * ux + vy * uy, vx * ex + vy * ey);
    }
    // ---- 推力・燃料（dt 秒ぶん）。thr：液体エンジンの しぼり（0〜1、v0.11） ----
    // v0.18.1 クロスフィード（アスパラガス）：同じ 段の エンジン（まんなか＋よこの 段）は みんな、そとがわの よこの 段の 燃料から じゅんに つかう
    //   いちばん そとの 列（tier）が からに なったら その 列が はずれ、つぎの 列へ。まんなかの 燃料は さいご
    //   同じ 列（左右）は 燃料の 割合で わけて つかう ＝ 同時に はずれる
    //   v0.18.2：せん（valve）を つけた よこの 段は クロスフィード しない（じぶんの エンジンで じぶんの 燃料だけ）
    const xf = () => O.CROSSFEED !== false;
    const feeds = s => xf() && !s.noXF;
    const feedPods = () => st.filter(s => s.pod && feeds(s) && s.sepT === null && s.stage === sim.si && s.ignT !== null && sim.t >= s.ignT && s.fuel > 0);
    function drawFuel(use) {   // 燃料 use を とる。とれなかった ぶんを かえす
      let pods = feedPods();
      while (use > 1e-12 && pods.length) {
        const tMax = Math.max(...pods.map(s => s.tier || 0)), tier = pods.filter(s => (s.tier || 0) === tMax), have = tier.reduce((z, s) => z + s.fuel, 0);
        const k = Math.min(use, have); tier.forEach(s => { s.fuel = Math.max(0, s.fuel - k * s.fuel / have); if (s.fuel < 1e-9) s.fuel = 0; }); use -= k;
        pods = pods.filter(s => s.fuel > 0);
      }
      const cur = S[sim.si], k = Math.min(use, cur.fuel); cur.fuel -= k; return use - k;
    }
    // v0.20.1：そとがわに まだ よこの 段が ついている（同じ 段・同じ がわ）あいだは、うちがわの よこの 段は からでも はずれない（そとの 段を ささえている）
    //   まえは「そとだけ せん」で うちがわが さきに からに なり、そとの 列が 宙に うかんだ まま もえていた
    const held = s => st.some(o => o !== s && o.pod && o.sepT === null && o.stage === s.stage && (o.side || 0) === (s.side || 0) && (o.tier || 0) > (s.tier || 0));
    sim.podHeld = held;
    function burn(dt, rho, thr) {
      if (thr == null) thr = 1;
      const cur = S[sim.si], on = sim.t >= cur.ignT;
      const vpow = P.VAIR + (1 - P.VAIR) * (1 - rho); sim.vpow = vpow; const VK = rho > 0 ? 1 : (O.VAC_VBURN_K || 1);
      const flow = x => (x.eng * P.BURN + x.veng * P.VBURN * VK) * thr * dt, push = x => (x.eng * P.THRUST + x.veng * P.VTHRUST * vpow) * thr;
      let thrustC = 0, podOn = false, use = 0;
      const hasFuel = cur.fuel > 0 || feedPods().length > 0;
      const burnC = sim.engineOn && on && hasFuel && cur.eng + cur.veng > 0;
      if (burnC) { thrustC = push(cur); use += flow(cur); }
      const live = st.filter(s => s.pod && s.sepT === null && s.ignT !== null && sim.t >= s.ignT && s.eng + s.veng > 0);
      if (sim.engineOn) live.forEach(s => {
        const shared = feeds(s) && s.stage === sim.si;
        if (shared ? (s.fuel > 0 || feedPods().length || cur.fuel > 0) : s.fuel > 0) { thrustC += push(s); podOn = true;   // v0.20.1：から で のこっている（held）よこの エンジンは まんなかの 燃料で もえる
          if (shared) use += flow(s); else s.fuel = Math.max(0, s.fuel - flow(s)); } });
      if (use > 0) { const miss = drawFuel(use); if (miss > 0) thrustC *= 1 - miss / use; }
      let thrustB = 0, boost = false; const gone = [];
      st.forEach(s => {
        if (s.sepT !== null || s.ignT === null || sim.t < s.ignT) return;
        if (s.pod) { if (s.fuel <= 1e-9 && s.stage === sim.si && !held(s)) { s.sepT = sim.t; gone.push(s.id); } return; }
        if (s.fuel > 0) { s.fuel = Math.max(0, s.fuel - P.BOOST_BURN * Math.pow(s.seg, P.BOOST_SEG_POW || 0) * dt); thrustB += TbOf(s.seg); boost = true; }
        if (s.fuel <= 0) { s.sepT = sim.t; emit('booster-sep', { id: s.id }); }
      });
      if (gone.length) emit('booster-sep', { id: gone[0], ids: gone, pod: true, n: gone.length });   // v0.18.1：同時に はずれた よこの 段は 1つの できごと（声は 1回）
      if (sim.si < last && on && !(cur.fuel > 0 && cur.eng + cur.veng > 0) && !st.some(s => s.stage === sim.si && s.sepT === null && s.fuel > 0 && (!s.pod || s.eng + s.veng > 0))) doSep(rho, false);
      sim.burnC = burnC || podOn; sim.boost = boost;
      return thrustC + thrustB;
    }
    // 段を 切りはなす（自動・v0.13 ✂️ 手で）。manual：燃料が のこっていても。月面なら その段は 月に のこる
    function doSep(rho, manual) {
      const cur = S[sim.si];
      cur.sepT = sim.t;
      st.forEach(s => { if (s.stage === sim.si && s.sepT === null) { s.sepT = sim.t; s.withStage = true; } });
      if (sim.surface) sim.leftStages.push(sim.si);
      emit('stage-sep', { i: sim.si, manual: !!manual, surface: sim.surface });
      sim.si++; ignite(sim.si, sim.t + (sim.surface ? 0 : P.IGN_DELAY));
      sim.fuelBase = coreFuel() || 1;   // v0.11.1：のこりの 燃料を 100% に
      const f = fins(); sim.dev = Math.min(sim.dev, 1.2);
      if (f.n === 0 && rho > 0) sim.devDir = sim.devDir || 1;
    }
    // v0.13 ✂️：エンジンを とめている／月面に いる、かつ 上に 段が ある
    const canSep = () => !sim.done && sim.lifted && sim.si < last && (sim.surface || !sim.isPowered());
    const CH = O.CHUTE;
    // ---- v0.12 パラシュートを ひらく：'noChute' / 'noAir' / 'torn' / 'opening' ----
    function deployChute() {
      if (sim.chute === 'opening' || sim.chute === 'open') return sim.chute;
      if (!chutes()) return 'noChute';
      if (sim.chute === 'torn') return 'torn';
      const b = sim.body, r = Math.hypot(sim.x, sim.y);
      if (!b.atmo || r - b.R >= b.atmo) { emit('chute-noair'); return 'noAir'; }
      const wv = Math.hypot(sim.vx + b.rot * sim.y, sim.vy - b.rot * sim.x);
      if (wv > CH.V_TEAR) { sim.chute = 'torn'; emit('chute-torn', { v: wv }); return 'torn'; }
      sim.chute = 'opening'; sim.chuteOpen = 0; sim.el = null; emit('chute-deploy'); return 'opening';
    }
    // ---- v0.12 いま エンジンを とめたら 何秒で 地面か・その ときの 下むきの 速さ（ひらいている パラシュートは ひらききった として） ----
    function fallInfo() {
      const b = sim.body, rv = relVel(), g = b.mu / (rv.r * rv.r); let h = rv.r - b.R, v = -rv.vr, t = 0;
      if (!b.atmo) {
        if (rv.vt * rv.vt / rv.r > g * 0.98 && rv.vr >= -0.5) return null;   // よこに はやく まわれる なら つかない
        const vd = Math.sqrt(Math.max(0, v * v + 2 * g * Math.max(0, h))); return { t: (vd - v) / g, vDown: vd, vSide: Math.abs(rv.vt) };
      }
      const on = sim.chute === 'opening' || sim.chute === 'open', k = (sim.kAir0 || 0) + (on ? sim.kAirC || 0 : 0);
      for (let i = 0; i < 4000 && h > 0; i++) {
        const dt = Math.max(0.02, Math.min(0.5, h / Math.max(1, Math.abs(v)) / 20)), rho = Math.max(0, 1 - h / b.atmo);
        v += (g - k * rho * v * Math.abs(v)) * dt; h -= v * dt; t += dt;
      }
      return h > 0 ? null : { t, vDown: Math.max(0, v), vSide: Math.abs(rv.vt) };
    }
    // ---- 1きざみ（数値積分） ----
    function numStep(dt) {
      const b = sim.body, r = Math.hypot(sim.x, sim.y), ux = sim.x / r, uy = sim.y / r, ex = -uy, ey = ux;   // 上・横（反時計まわり＝東）
      const h = r - b.R, rho = rhoAt(h); sim.rho = rho;
      const g = b.mu / (r * r);
      const vr = sim.vx * ux + sim.vy * uy, vt = sim.vx * ex + sim.vy * ey;
      // v0.11：地面ちかく。全力は 重力の TWR 倍まで。うしろへ ＆ ほぼ とまった ＝ ホバー（真上に 浮く）
      //  v0.12：地球でも（いちど エンジンを とめて 向きを えらべる ように なってから）。よこの 速さは 地面に たいして
      const LD = LDof(b), m0 = mass(), near = sim.near && sim.lifted && (b !== earth || sim.dir !== 'auto') && sim.dir !== 'ascent';
      const vtg = vt - b.rot * r;
      let thr = 1, aimL = null; sim.hover = false;
      if (near) {
        const full = coreFull(rho);
        if (full > 0) {
          thr = Math.min(1, LD.TWR * m0 * g / full);
          // v0.14.6：HOVER_VD＞0（地球）は「ういて とまる」でなく「その 速さで ゆっくり おりる」。脚が あれば その まま 着陸できる
          // v0.17：HOVER_K（月）＝たかい ところでは はやく（高さ×HOVER_K、HOVER_MAX まで）、地面の ちかくで HOVER_VD まで ゆっくり（重力の むだを へらす）
          const vdT = LD.HOVER_K ? Math.max(LD.HOVER_VD, Math.min(LD.HOVER_MAX || 30, (r - b.R) * LD.HOVER_K)) : (LD.HOVER_VD || 0);
          if (sim.dir === 'retro' && (vdT > 0 ? -vr < vdT + LD.V_HOVER && Math.abs(vtg) < LD.V_HOVER : Math.hypot(vr, vtg) < LD.V_HOVER)) {
            const ar = g - LD.HOVER_GAIN * (vr + vdT), at = -LD.HOVER_GAIN * vtg;
            thr = Math.min(thr, Math.hypot(Math.max(0, ar), at) * m0 / full); aimL = Math.atan2(Math.max(0, ar), at); sim.hover = true;
          }
        }
      }
      // v0.20 ⛽ ステーションの ちかく（SHOW より ちかい）で うしろむきの 🔥：ステーションに あわせて ちかづく（自動）
      let apPt = null; sim.approach = false;
      if (!near && sim.dir === 'retro' && b === earth && sim.lifted && !sim.docked && sim.engineOn) { const q = stRel();
        if (q && q.d < (DK.SHOW || 4000) && q.v < (DK.V_APP_MAX || 60)) { const px = (q.q.x - sim.x) / q.d, py = (q.q.y - sim.y) / q.d, vd = Math.max(0, Math.min(DK.VAPP, DK.KAPP * (q.d - DK.DIST / 2)));
          const ax = (px * vd - (sim.vx - q.q.vx)) * DK.GAIN, ay = (py * vd - (sim.vy - q.q.vy)) * DK.GAIN, full = coreFull(rho);
          if (full > 0) { thr = Math.min(1, Math.hypot(ax, ay) * m0 / full); apPt = Math.atan2(ax * ux + ay * uy, ax * ex + ay * ey); sim.approach = true; } } }
      // v0.13 月からの 離陸：加速を 月の重力の MOON_UP.ACC 倍まで
      const MU = O.MOON_UP, ascent = sim.dir === 'ascent';
      if (ascent) { const full = coreFull(rho); if (full > 0) thr = Math.min(1, MU.ACC * m0 * g / full); }
      sim.throttle = thr;
      const T = burn(dt, rho, thr), m = mass();
      // v0.8.2：角度は 急に かえない（切りはなし・点火まち・エンジン停止で 力が 0 のときは いまの角度を たもつ）
      //   くうきの中では 起き上がらない（一度 たおしたら 真上に もどさない）。くうきの外は 1秒に PITCH_RATE 度まで
      if (T > 0) {
        let want = guidance(h, r, vr, vt, T / m, g);
        if (rho > 0 && sim.lifted && h >= O.TURN_START) want = Math.min(want, sim.pitch);
        const dmax = (O.PITCH_RATE || 15) * dt;
        sim.pitch += Math.max(-dmax, Math.min(dmax, want - sim.pitch));
      }
      // はねが たりないと かたむく（くうきの中だけ）
      const f = fins();
      if (sim.lifted) sim.dev = Math.min(1.2, sim.dev + devTarget(f) * P.TILT_GROW * rho * dt);
      // v0.10：向きを えらんで いるときは（くうきの外だけ）、すすむ向き／その反対へ まっすぐ おす
      const manual = sim.dir !== 'auto' && sim.lifted;   // v0.12：くうきの中でも（いちど とめた あと）
      // v0.12：パラシュートで ぶらさがって いる（エンジン なし）ときは 真上を むく
      const hang = (sim.chute === 'opening' || sim.chute === 'open') && !(sim.engineOn && sim.isPowered());
      let ascPt = null;
      if (ascent) {   // v0.13：月からの 離陸。まっすぐ → HOLD の 高さを たもって 月の まわる 向き（反時計まわり）へ
        const aT = T / m; ascPt = Math.PI / 2;
        if (h >= MU.TURN_H && aT > 0) { const vrT = Math.max(-5, Math.min(MU.VR_MAX, 0.15 * (MU.HOLD - h))), need = g - vt * vt / r + (vrT - vr);
          ascPt = Math.asin(Math.max(-0.5, Math.min(1, need / aT))); }
      }
      const pt = hang ? Math.PI / 2 : apPt != null ? apPt : ascPt != null ? ascPt : aimL != null && sim.engineOn ? aimL : manual ? aimAngle() : sim.pitch * D2R - sim.dev * sim.devDir; sim.point = pt;
      if (manual) sim.pitch = Math.max(-90, Math.min(90, pt / D2R));   // 自動に もどったときに とばないように
      const tx = Math.cos(pt) * ex + Math.sin(pt) * ux, ty = Math.cos(pt) * ey + Math.sin(pt) * uy;
      sim.tdx = tx; sim.tdy = ty;   // おす向き（スローモーションの判定に つかう）
      // 空気のじゃま（地面といっしょに まわる 空気に対して）
      const ax0 = -b.rot * sim.y, ay0 = b.rot * sim.x, wx = sim.vx - ax0, wy = sim.vy - ay0, wv = Math.hypot(wx, wy);
      const dg = a.drag[sim.si];
      // v0.12 パラシュート：ふくらむ（OPEN_T 秒）。ひらいた ぶんだけ 空気の じゃまが ふえる
      if (sim.chute === 'opening') { sim.chuteOpen = Math.min(1, sim.chuteOpen + dt / CH.OPEN_T); if (sim.chuteOpen >= 1) { sim.chute = 'open'; emit('chute-open'); } }
      const nCh = (sim.chute === 'opening' || sim.chute === 'open') ? chutes() : 0;
      if ((sim.chute === 'opening' || sim.chute === 'open') && !nCh) { sim.chute = null; sim.chuteOpen = 0; }   // パラシュートの 段を すてた
      const cd0 = P.DRAG * Math.max(1, dg.cols) * (1 - (1 - P.NOSE_DRAG) * dg.noseCover) + P.DRAG * P.BOOST_DRAG * st.filter(attached).length;
      const cdC = CH.CD * nCh * sim.chuteOpen;
      sim.kAir0 = cd0 / Math.max(0.1, mass()); sim.kAirC = CH.CD * chutes() / Math.max(0.1, mass());   // 落ちる 時間の 見つもり用
      const cd = (cd0 + cdC) * rho;
      let accx = T * tx / m - g * ux - cd * wv * wx / m, accy = T * ty / m - g * uy - cd * wv * wy / m;
      sim.thrust = T; sim.mass = m; sim.weight = m * g;
      if (m0 > m && T > 0) sim.dvUsed += T / m * dt;
      if (sim.landed) {
        // 発射台の上：上むきの力が 重さに かつまで うごかない（地面と いっしょに まわる）
        const up = accx * ux + accy * uy + (b.rot * b.rot) * r;
        if (up <= 0) {
          sim.t += dt; const ph = Math.atan2(sim.y, sim.x) + b.rot * dt;
          sim.x = b.R * Math.cos(ph); sim.y = b.R * Math.sin(ph); sim.vx = -b.rot * sim.y; sim.vy = b.rot * sim.x;
          if (!sim.isPowered() && sim.t > 0.5 && !sim.surface) sim.done = { type: 'heavy' };
          return;
        }
        sim.landed = false; sim.lifted = true; if (sim.surface) { sim.surface = false; emit('moon-liftoff'); } else emit('liftoff');
      }
      // v0.13 最大G（重力を のぞいた 加速。地上の 重力 10 ＝ 1G）
      { const ng = Math.hypot(accx + g * ux, accy + g * uy) / (O.G0 || 10); if (ng > sim.maxG) sim.maxG = ng; }
      // 中点法
      sim.vx += accx * dt; sim.vy += accy * dt;
      sim.x += (sim.vx - accx * dt / 2) * dt; sim.y += (sim.vy - accy * dt / 2) * dt;
      sim.t += dt;
    }
    // ---- 惰性（レール上）：t まで すすめる ----
    function railTo(t1) {
      if (!sim.el) sim.el = SP.toElements(sim.x, sim.y, sim.vx, sim.vy, sim.body.mu, sim.t);
      const s1 = SP.stateAt(sim.el, t1);
      Object.assign(sim, { x: s1.x, y: s1.y, vx: s1.vx, vy: s1.vy, t: t1 });
    }
    function rk4(dt) {
      const mu = sim.body.mu, f = (x, y) => { const r3 = Math.pow(x * x + y * y, 1.5); return [-mu * x / r3, -mu * y / r3]; };
      const { x, y, vx, vy } = sim;
      const a1 = f(x, y), a2 = f(x + vx * dt / 2, y + vy * dt / 2);
      const v2x = vx + a1[0] * dt / 2, v2y = vy + a1[1] * dt / 2, a3 = f(x + v2x * dt / 2, y + v2y * dt / 2);
      const v3x = vx + a2[0] * dt / 2, v3y = vy + a2[1] * dt / 2, a4 = f(x + v3x * dt, y + v3y * dt);
      const v4x = vx + a3[0] * dt, v4y = vy + a3[1] * dt;
      sim.x += dt / 6 * (vx + 2 * v2x + 2 * v3x + v4x); sim.y += dt / 6 * (vy + 2 * v2y + 2 * v3y + v4y);
      sim.vx += dt / 6 * (a1[0] + 2 * a2[0] + 2 * a3[0] + a4[0]); sim.vy += dt / 6 * (a1[1] + 2 * a2[1] + 2 * a3[1] + a4[1]);
      sim.t += dt;
    }
    // 重力圏の いれかわり
    function changeBody(nb) {
      const ob = sim.body;
      if (nb.parent === ob) {   // 子の天体（月）へ 入る
        const bs = SP.bodyState(nb, sim.t);
        sim.x -= bs.x; sim.y -= bs.y; sim.vx -= bs.vx; sim.vy -= bs.vy;
      } else {                  // 親の天体へ もどる
        const bs = SP.bodyState(ob, sim.t);
        sim.x += bs.x; sim.y += bs.y; sim.vx += bs.vx; sim.vy += bs.vy;
      }
      sim.body = nb; sim.el = null; sim.stableT = 0; emit('soi', { body: nb.id });
    }
    function checkSOI() {
      const b = sim.body, r = Math.hypot(sim.x, sim.y);
      if (b.parent && r > b.soi) { changeBody(b.parent); return true; }
      for (const c of b.children) {
        const cs = SP.bodyState(c, sim.t);
        if (Math.hypot(sim.x - cs.x, sim.y - cs.y) < c.soi) { changeBody(c); return true; }
      }
      if (!b.parent && r > b.soi) { finish({ type: 'escape' }); return true; }
      return false;
    }
    // v0.11：月の 地面に ふれた。速さで 着陸／衝突 を きめる
    function landJudge() {
      const LD = LDof(sim.body), rv = relVel(), vDown = Math.max(0, -rv.vr), vSide = Math.abs(rv.vt);
      const l = legs(), k = l.n ? LD.LEG_K : 1, tilt = Math.abs(Math.atan2(Math.sin(sim.point - Math.PI / 2), Math.cos(sim.point - Math.PI / 2))) / D2R;
      const okV = vDown <= LD.V_DOWN * k && vSide <= LD.V_SIDE * k, hardV = vDown <= LD.V_DOWN * k * LD.HARD_K && vSide <= LD.V_SIDE * k * LD.HARD_K;
      const tiltOk = tilt <= (l.L && l.R ? LD.TILT_MAX_LEG : LD.TILT_MAX);
      return { vDown, vSide, tilt, legs: l.n, k, type: okV || hardV ? 'landed' : 'hit', hard: !okV || !tiltOk, soft: okV && vDown <= LD.SOFT && l.n > 0 };
    }
    // v0.12：地面に ふれた（月・地球）。地球は MIN_ALT より たかく とんだ あとだけ 着陸に なる
    function touchGround() {
      const b = sim.body, j = landJudge(), r = Math.hypot(sim.x, sim.y), ang = Math.atan2(sim.y, sim.x);
      if (b === earth && (j.type !== 'landed' || sim.maxAlt < LDof(b).MIN_ALT)) j.type = 'ground';
      sim.x = b.R * sim.x / r; sim.y = b.R * sim.y / r;
      sim.burnC = false; sim.boost = false; sim.thrust = 0;
      const chute = sim.chute === 'open' || sim.chute === 'opening';
      if (j.type === 'landed') { sim.vx = -b.rot * sim.y; sim.vy = b.rot * sim.x; sim.engineOn = false; sim.onMoon = b === earth ? null : { ang }; }
      // v0.13：月に 着陸して、液体燃料が のこっている（いまの 段から 上の どこかに エンジン＋燃料）なら 月面で まつ
      if (j.type === 'landed' && b !== earth) {
        sim.moonLanded = true;
        if (S.slice(sim.si).some(x => x.eng + x.veng > 0 && x.fuel > 0) && !opt.noSurface) {
          Object.assign(sim, { surface: true, landed: true, el: null, near: true, hover: false, dir: 'pro', chute: null });
          sim.surfJ = j; sim.surfAng = ang; emit('surface', j); return;
        }
      }
      if (j.type === 'landed' && b === earth && sim.moonLanded) j.returned = true;
      finish(Object.assign({ speed: Math.hypot(j.vDown, j.vSide), range: b === earth ? downrange() : 0, ang, chute }, j));
    }
    function finish(d) {
      if (sim.done) return;
      sim.done = Object.assign({ maxAlt: sim.maxAlt, maxV: sim.maxV, t: sim.t, body: sim.body.id, cls: sim.cls, maxG: sim.maxG, left: sim.leftStages.length }, d);
      emit('done', sim.done);
    }
    // ---- 外から呼ぶ：dt 秒（ゲームの時間）すすめる ----
    function advance(dtAll) {
      // v0.20 ⛽ ドッキング中：ステーションと いっしょに まわる
      if (sim.docked && !sim.done) { sim.t += dtAll; const s = SP.stationState(sim.station, sim.t); Object.assign(sim, { x: s.x, y: s.y, vx: s.vx, vy: s.vy, el: null }); return; }
      if (sim.surface && !sim.engineOn) return;   // v0.13：月面で まつ 間は 時間が とまる
      let left = dtAll, guard = 0;
      while (left > 1e-9 && !sim.done && guard++ < 20000) {
        const b = sim.body, r = Math.hypot(sim.x, sim.y), h = r - b.R;
        const powered = sim.isPowered(), inAir = b.atmo && h < b.atmo;
        if (powered || inAir || sim.landed || !sim.lifted) {
          sim.rails = false; sim.el = null;
          const dt = Math.min(left, O.SUB_DT); numStep(dt); left -= dt;
        } else {
          if (!sim.el) sim.el = SP.toElements(sim.x, sim.y, sim.vx, sim.vy, b.mu, sim.t);
          const v = Math.hypot(sim.vx, sim.vy), top = b.R + (b.atmo || 0);
          if (!sim.el.good) {
            // 細長すぎる軌道（ほぼ真上に うったとき）：重力だけの 数値積分（RK4・きざみは 自動）
            sim.rails = false;
            const dt = Math.min(left, Math.max(1e-3, 0.004 * Math.min(r / Math.max(v, 1e-6), Math.sqrt(r * r * r / b.mu))));
            rk4(dt); left -= dt; sim.el = null;
          } else {
            // レール上：きざみは 動く距離が 小さくなるように（重力圏の出入り・地面・くうきを 見のがさない）
            sim.rails = true;
            let lim = 0.02 * Math.min(r, ...b.children.map(c => c.soi), b.parent ? b.soi : Infinity) / Math.max(v, 1e-6);
            if (sim.el.e < 1) lim = Math.min(lim, sim.el.T / 300);
            const dt = Math.max(Math.min(left, lim), 1e-4);
            const save = { x: sim.x, y: sim.y, vx: sim.vx, vy: sim.vy, t: sim.t };
            railTo(sim.t + dt);
            if (Math.hypot(sim.x, sim.y) < top) {
              // くうき／地面に 入った：二分法で その瞬間を さがして、そこから 数値積分に きりかえ
              let lo = 0, hi = dt; for (let i = 0; i < 30; i++) { const md = (lo + hi) / 2, s1 = SP.stateAt(sim.el, save.t + md); if (Math.hypot(s1.x, s1.y) < top) hi = md; else lo = md; }
              Object.assign(sim, save); railTo(save.t + hi); sim.el = null; sim.rails = false; left -= hi;
            } else left -= dt;
          }
        }
        // 記録・地面・重力圏
        const r2 = Math.hypot(sim.x, sim.y), h2 = r2 - sim.body.R, sp = Math.hypot(sim.vx, sim.vy);
        if (sim.body === earth) sim.maxAlt = Math.max(sim.maxAlt, h2);
        sim.maxV = Math.max(sim.maxV, sp);
        if (sim.lifted && !sim.landed && h2 <= 1e-6) { touchGround(); break; }
        // v0.13：月からの 離陸。月を まわる 軌道（近い ところが PE_MIN より 上）に なったら 自動で とめる
        if (sim.dir === 'ascent' && sim.engineOn && !sim.landed) { const ea = SP.toElements(sim.x, sim.y, sim.vx, sim.vy, sim.body.mu, sim.t);
          if (ea.e < 1 && ea.rp > sim.body.R + O.MOON_UP.PE_MIN) { sim.setEngine(false); emit('ascent-done'); } }
        // v0.11：地面ちかくに 入った／出た（v0.12：地球は たかく とんで おりて くる とき）
        const LD = LDof(sim.body), vr2 = (sim.vx * sim.x + sim.vy * sim.y) / r2;
        //  地球は「このまま だと 地面に つく」（近地点が くうきの 中）ときだけ。まわって いる ときは ちがう
        const fallE = () => { const e2 = SP.toElements(sim.x, sim.y, sim.vx, sim.vy, sim.body.mu, sim.t); return e2.e < 1 && e2.rp < sim.body.R + sim.body.atmo * 0.5; };
        const nearNow = sim.body !== earth ? h2 < LD.NEAR * (sim.near ? 1.15 : 1)
          : sim.near ? h2 < LD.NEAR * 1.15 && fallE()
          : h2 < LD.NEAR && sim.maxAlt > LD.MIN_ALT && vr2 < 0 && (sim.dir !== 'auto' || !sim.isPowered()) && fallE();
        if (nearNow !== sim.near) { sim.near = nearNow; emit(nearNow ? 'near' : 'far'); if (nearNow && !sim.legsOut && legs().n) { sim.legsOut = true; emit('legs'); } }
        if (!sim.inSpace && sim.body.atmo && h2 > sim.body.atmo) { sim.inSpace = true; emit('space'); }
        checkSOI();
        // v0.20 ⛽ ステーションに ちかく ゆっくり なったら アームで キャッチ
        if (!sim.done && sim.body === earth && sim.lifted && !sim.landed && !sim.near && (!sim.isPowered() || sim.approach)) { const q = stRel();
          if (q && !sim.dockArm && q.d > DK.DIST * (DK.REARM || 1.5)) sim.dockArm = true;
          if (q && sim.dockArm && q.d < DK.DIST && q.v < DK.V_REL) { dock(q); break; } }
      }
      // 軌道の種類と「安定して まわった」の判定
      //  v0.8.3：燃料が のこっている間は すぐには おわらない（🏁 で おわる。再点火・月を まつ ことが できる。IDLE_TURNS 周で おしまい）
      //          燃料が もう ないとき：ORBIT_DONE 周で おわる。月まで とどく軌道は 月と であうのを MOON_WAIT 周 まつ
      if (!sim.done && sim.lifted) {
        const el = sim.el || SP.toElements(sim.x, sim.y, sim.vx, sim.vy, sim.body.mu, sim.t);
        const cls = clsOf(el);
        if (cls !== sim.cls) { const old = sim.cls; sim.cls = cls; emit('class', { cls, old }); }
        const stable = ['low', 'high', 'toMoon', 'moonOrbit'].includes(cls) && !sim.isPowered() && el.e < 1;
        if (stable) {
          sim.stableT += dtAll;
          const turns = liquidLeft() && !opt.autoEnd ? (O.IDLE_TURNS || 8) : cls === 'toMoon' ? (O.MOON_WAIT || 4) : O.ORBIT_DONE;
          if (sim.stableT > el.T * turns) finish({ type: 'orbit', el });
        } else sim.stableT = 0;
      }
      if (!sim.done && sim.t > 400000) finish({ type: 'timeout' });
    }
    // 地面に そって どれだけ遠くへ行ったか（地面の まわる分を ひく）
    function downrange() {
      const ph = Math.atan2(sim.y, sim.x) - (O.SITE + earth.rot * sim.t);
      const d = Math.atan2(Math.sin(ph), Math.cos(ph));
      return Math.abs(d) * earth.R;
    }
    // 軌道の種類（地球のまわり／月のまわり）
    //  v0.10：月を まわる ＝ 月に ぶつからず、月の重力圏の 中に おさまる だ円（はみだすなら 通りぬける）
    function clsOf(el) {
      if (sim.body === earth) return SP.classify(el, earth, moon.orbitR);
      return el.e < 1 && el.rp < sim.body.R ? 'moonFall' : el.e < 1 && el.ra < sim.body.soi ? 'moonOrbit' : 'moonPass';
    }
    // v0.8.2：このまま あと すこし（SLOW.LOOK）おすと 軌道の種類が かわるか（＝だいじな ところ）
    function critical() {
      const L = RL.CFG.ORBIT.SLOW.LOOK, mu = sim.body.mu, tx = sim.tdx || 0, ty = sim.tdy || 0;
      const a0 = SP.toElements(sim.x, sim.y, sim.vx, sim.vy, mu, sim.t), a1 = SP.toElements(sim.x, sim.y, sim.vx + tx * L, sim.vy + ty * L, mu, sim.t);
      return clsOf(a0) !== clsOf(a1);
    }
    // ---- v0.12 スローモーション：つぎの できごとまで あと 何の 速さが 要るか（いまの おす向きに 0〜LOOK）----
    //  できごと ＝ 軌道の 種類が かわる、月と であう 予測に なる／ならなく なる
    function eventKey(L) {
      const b = sim.body, vx = sim.vx + (sim.tdx || 0) * L, vy = sim.vy + (sim.tdy || 0) * L;
      const el = SP.toElements(sim.x, sim.y, vx, vy, b.mu, sim.t); let k = clsOf(el);
      if (b === earth && sim.station && el.e < 1 && el.ra > sim.station.r && el.rp < sim.station.r) k += '+st';   // v0.20 ⛽ ステーションの 高さに とどく
      if (b === earth && (el.e >= 1 || el.ra > moon.orbitR * 0.5) && RL.Predict) k += RL.Predict.trace({ x: sim.x, y: sim.y, vx, vy }, b, sim.t, 80, 300).end.type === 'enc' ? '+enc' : '';
      // v0.13：月から 地球の くうきに 入る（かえれる）
      if (b === moon && sim.moonLanded && RL.Predict && (el.e >= 1 || el.ra > b.soi)) k += RL.Predict.homeFrom({ x: sim.x, y: sim.y, vx, vy }, sim.t, sim.bodies) ? '+home' : '';
      return k;
    }
    function nextEventDv() {
      const SL = O.SLOW, k0 = eventKey(0), grid = [1, 3, 6, 12, 24, 48, 96, SL.LOOK];
      if (/\+enc|\+home/.test(k0)) return { dv: 0, enc: true };
      let lo = 0, hi = null;
      for (const L of grid) { if (eventKey(L) !== k0) { hi = L; break; } lo = L; }
      if (hi === null) return { dv: Infinity };
      for (let i = 0; i < 6; i++) { const md = (lo + hi) / 2; if (eventKey(md) !== k0) hi = md; else lo = md; }
      return { dv: hi };
    }
    function slowWarp() {
      const SL = O.SLOW, acc = sim.thrust / Math.max(0.1, sim.mass);
      if (!SL || acc <= 0) return 1;
      if (sim.dvRate) return Math.min(1, sim.dvRate / acc);   // v0.14.6：ミッションで きめた はやさ（実時間1秒に ふえる 速さ）
      const wMin = Math.min(1, SL.DV_MIN / acc);
      if (sim.encLock) return wMin;                         // 月と であう 予測：とめるまで ゆっくり
      const ev = nextEventDv();
      if (ev.enc) { sim.encLock = true; return wMin; }
      const base = Math.min(1, SL.DV / acc), evW = ev.dv / (acc * SL.AHEAD_SEC);
      return Math.max(wMin, Math.min(base, evW));
    }
    // のこりの Δv（くうきの外。ツール・表示用）
      // v0.17.1：いまの 段から 上へ じゅんに（段ごとに よこの 段 → まんなか）。上の 段の よこの 段も その 段で かぞえる
      // v0.18.1：クロスフィード：よこの 段の 列（そとから）ごとに、のこっている エンジン ぜんぶで もやす → 列を すてる → まんなか。せんの ある よこの 段は じぶんだけ
      function dvRest() { let dv = 0, m = sum(S.slice(sim.si), y => y.dry + y.fuel) + sum(st.filter(s => s.pod && attached(s)), y => y.dry + y.fuel);
        const KV = O.VAC_VBURN_K || 1, Tq = x => x.eng * P.THRUST + x.veng * P.VTHRUST, Fq = x => x.eng * P.BURN + x.veng * P.VBURN * KV;
        for (let i = sim.si; i <= last; i++) { const x = S[i];
          const pods = st.filter(s => s.pod && attached(s) && s.stage === i);
          pods.filter(s => !feeds(s)).forEach(s => { if (s.fuel > 0 && Fq(s)) dv += Tq(s) / Fq(s) * Math.log(m / (m - s.fuel)); m -= s.fuel + s.dry; });
          let fp = pods.filter(feeds);
          while (fp.length) { const tMax = Math.max(...fp.map(s => s.tier || 0)), grp = fp.filter(s => (s.tier || 0) === tMax), all = [x, ...fp];
            const f = sum(grp, s => s.fuel), T = sum(all, Tq), F = sum(all, Fq);
            if (f > 0 && F > 0) dv += T / F * Math.log(m / (m - f)); m -= f + sum(grp, s => s.dry); fp = fp.filter(s => !grp.includes(s)); }
          if (x.eng + x.veng && x.fuel > 0) dv += Tq(x) / Fq(x) * Math.log(m / (m - x.fuel));
          m -= x.fuel + x.dry; }
        return dv; }
    function elements() { return sim.el || (sim.lifted ? SP.toElements(sim.x, sim.y, sim.vx, sim.vy, sim.body.mu, sim.t) : null); }
    // 早送りの おすすめ倍率
    //  - くうきの中で 燃えている間・発射台の上は 実時間
    //  - v0.8.2：うちゅうで 燃えている間は スローモーション。1秒（実時間）に ふえる速さを SLOW.DV までに おさえる
    //    軌道の種類が かわる すぐ手前（月に とどく／にげる／まわりはじめる 等）は SLOW.DV_NEAR まで ゆっくり
    //  - v0.10：月と であう 予測に かわる すぐ手前（flight2d が sim.moonNear を たてる）は SLOW.DV_MOON まで もっと ゆっくり
    //  - v0.11：月の 地面ちかくは、地面に つくまでの 時間が 実時間で LAND.SLOW_SEC 秒より みじかく ならないように
    function autoWarp() {
      if (sim.done) return 1;
      const r = Math.hypot(sim.x, sim.y), v = Math.max(1, Math.hypot(sim.vx, sim.vy)), h = r - sim.body.R;
      if (sim.landed) return 1;
      if (sim.near) {
        const LD = LDof(sim.body), fi = fallInfo(), tg = fi ? fi.t : 60;   // 落ちるだけ なら 何秒で 地面か（くうき・パラシュートも）
        // v0.14.6：パラシュートで おりる ときは さくっと（スローに しない）
        //  v0.14.7：ひらききった ときに 早送りを きめて、地面まで その まま（だんだん おそく ならない）
        if (sim.chute === 'opening' && !sim.isPowered()) return 1;
        if (sim.chute === 'open' && !sim.isPowered()) {
          if (!sim.chuteW) sim.chuteW = Math.max(1, Math.min(LD.WARP_MAX, alt() / Math.max(1, -relVel().vr) / (CH.SEC || 3)));
          return sim.chuteW; }
        // v0.14.7：地球で エンジンで ゆっくり おりる（HOVER_VD）ときも さくっと
        if (sim.hover && LD.HOVER_VD && sim.isPowered()) { if (!sim.hoverW) { const h = alt(), h0 = LD.HOVER_K ? LD.HOVER_VD / LD.HOVER_K : h;   // v0.17：HOVER_K の とき 地面までの 時間 ＝ log の ぶん ＋ さいごの ぶん
              const tg = LD.HOVER_K && h > h0 ? Math.log(h / h0) / LD.HOVER_K + h0 / LD.HOVER_VD : h / LD.HOVER_VD;
              sim.hoverW = Math.max(1, Math.min(LD.WARP_MAX, tg / (LD.HOVER_SEC || 4))); } return sim.hoverW; }
        // v0.15 noSlow（4-4 月に ぶつかる）も 同じ
        // v0.14.7：地球で おちている（エンジン なし）ときは 高さ ÷ 下むきの 速さ（くうきで よこに すべる 間も はやく）
        if (sim.noSlow && !sim.isPowered()) { if (!sim.noSlowW) sim.noSlowW = Math.max(1, Math.min(LD.WARP_MAX, tg / 4)); return sim.noSlowW; }
        if (sim.body === earth && !sim.isPowered()) return Math.max(1, Math.min(LD.WARP_MAX, alt() / Math.max(1, -relVel().vr) / LD.SLOW_SEC));
        // v0.17：うしろむきで ブレーキ中、まにあう（とまる きょりが 高さの 7わり より みじかい）なら BRAKE_WARP まで はやく
        if (sim.isPowered() && LD.BRAKE_WARP && sim.dir === 'retro') { const v = Math.max(0, -relVel().vr), a = sim.brakeAcc ? sim.brakeAcc() : 0;
          if (a > 0.1 && v * v / (2 * a) < alt() * 0.7) return LD.BRAKE_WARP; }
        return Math.max(LD.WARP_MIN, Math.min(sim.isPowered() ? 1 : LD.WARP_MAX, tg / LD.SLOW_SEC));
      }
      if (sim.isPowered()) {
        if (!sim.lifted || (sim.body.atmo && h < sim.body.atmo)) return 1;
        return sim.approach ? (DK.WARP || 3) : slowWarp();   // v0.20 ⛽ ちかづく 間は 3倍
      }
      sim.encLock = false;
      if (sim.body.atmo && h < sim.body.atmo) return Math.max(1, Math.min(8, h / 60));
      let wmax = r / v / (sim.body.parent ? (O.MOON_WARP_K || 6) : 1.6);   // v0.15 MOON_WARP_K：月の 重力圏の 中の 早送り（小さい ほど はやい）
      // 月に ちかづいたら ゆっくりに（であいを 見のがさない・見せる）
      sim.body.children.forEach(c => { const cs = SP.bodyState(c, sim.t), d = Math.hypot(sim.x - cs.x, sim.y - cs.y) - c.soi, rv = Math.max(1, Math.hypot(sim.vx - cs.vx, sim.vy - cs.vy));
        if (d > 0) wmax = Math.min(wmax, Math.max(20, d / rv / 1.2)); });
      if (sim.coastK) wmax *= sim.coastK;
      // v0.20 ⛽ ステーションに ちかい ときは ゆっくり（ちかづくのが みえる）
      if (sim.body === earth && !sim.docked && sim.station) { const q = stRel(); if (q.d < (DK.SHOW || 4000)) wmax = Math.min(wmax, Math.max(1, (q.d - DK.DIST * 0.8) / Math.max(1, q.v) / 2)); }   // v0.18：ミッションの とぶ だけの ところ（4-4・4-5）
      return Math.max(1, Math.min(O.WARP_MAX, wmax));
    }
    return Object.assign(sim, {
      advance, elements, autoWarp, downrange, events: ev, alt, coreFuel, critical, aimAngle, landJudge, deployChute, fallInfo, nextEventDv,
      setEngine(on) {
        if (sim.engineOn === on) return; sim.engineOn = on; sim.el = null;
        // v0.10：うちゅうで いちど とめたら、つぎからは「前へ」（自動の 打ち上げは おしまい）
        //  v0.12：くうきの中で とめても 同じ（そのあと くうきの中でも 向きを えらべる）
        if (!on && (sim.dir === 'auto' || sim.dir === 'ascent') && sim.lifted) sim.dir = 'pro';
        if (on && sim.surface) { sim.dir = 'ascent'; sim.pitch = 90; }
        if (on && sim.docked) { sim.docked = false; emit('undock'); }   // v0.20 ⛽ 🔥 で はなれる   // v0.13：月面から 離陸
        if (!on) sim.encLock = false;
        emit(on ? 'engine-on' : 'engine-off');
      },
      // v0.10：向きを えらぶ（くうきの外だけ）。'pro' ⇄ 'retro'
      setDir(d) { if (!sim.canDir() || !['pro', 'retro'].includes(d) || sim.dir === d) return false; sim.dir = d; sim.el = null; emit('dir', { dir: d }); return true; },
      canDir: () => sim.lifted && !sim.done && !sim.surface && sim.dir !== 'ascent' && (sim.dir !== 'auto' || !inAirNow()),
      // v0.13 ✂️ 手で 切りはなす／月面で おわる
      canSep, separate() { if (!canSep()) return false; doSep(sim.rho || 0, true); sim.el = null; return true; },
      endSurface() { if (!sim.surface || sim.done) return; finish(Object.assign({ speed: Math.hypot(sim.surfJ.vDown, sim.surfJ.vSide), range: 0, ang: sim.onMoon ? sim.onMoon.ang : 0, chute: false }, sim.surfJ)); },
      // v0.11：ここからやり直し。うごく 値を ぜんぶ コピー／もどす
      snapshot() {
        const o = {};
        Object.keys(sim).forEach(k => { const v = sim[k]; if (typeof v === 'function' || SNAP_SKIP[k]) return; o[k] = v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; });
        o.bodyId = sim.body.id; o.S = S.map(x => ({ ...x })); o.st = st.map(x => ({ ...x, fins: x.fins.slice() }));
        return o;
      },
      restore(o) {
        Object.keys(o).forEach(k => { if (k === 'S' || k === 'st' || k === 'bodyId') return; sim[k] = o[k] && typeof o[k] === 'object' ? JSON.parse(JSON.stringify(o[k])) : o[k]; });
        sim.body = W[o.bodyId]; sim.done = null; sim.el = null;
        o.S.forEach((x, i) => Object.assign(S[i], x)); o.st.forEach((x, i) => Object.assign(st[i], x, { fins: x.fins.slice() }));
        sim.stages = S; sim.stacks = st; ev.length = 0;
      },
      abort() { finish({ type: 'abort' }); },
      // v0.20 ⛽ 補給：のこっている 段（と よこの 段）を ぜんぶ 満タン
      refuel() { if (!sim.docked || fullFuel()) return false;
        S.slice(sim.si).forEach(x => { x.fuel = a.stages[x.i].fuel; }); st.forEach(s => { if (s.pod && attached(s)) s.fuel = (a.stacks.find(y => y.id === s.id) || {}).fuel || 0; });
        sim.fuelBase = coreFuel() || 1; sim.refueled = true; emit('refuel'); return true; },
      // v0.14.6：いま エンジンで ブレーキ できる 加速（地面ちかくの しぼりも ふくむ。重力を ひいた もの）
      brakeAcc() { const b = sim.body, r = Math.hypot(sim.x, sim.y), g = b.mu / (r * r), m = mass(), full = coreFull(rhoAt(r - b.R)) / m;
        return (sim.near ? Math.min(full, LDof(b).TWR * g) : full) - g; },
      forceEnd(type) { finish({ type, forced: true }); },   // v0.14.6：ミッションの あんないで おわらせる（2-1 の とびだし）
      missionEnd() { finish({ type: 'mission', el: sim.lifted ? elements() : null }); },   // v0.14：ミッションの クリア（とちゅうで おわる）
      finishNow() { if (sim.cls && ['low', 'high', 'toMoon', 'moonOrbit'].includes(sim.cls) && !sim.isPowered()) finish({ type: 'orbit', el: elements() }); },
      liquidLeft,
      // v0.11.1：燃料メーター（いまの 段から 上の のこり ÷ さいごに 切りはなした ときの のこり）。fuelAll＝ロケット ぜんぶ との 割合（ツール用）
      fuelRatio: () => (sim.fuelBase > 0 ? Math.min(1, coreFuel() / sim.fuelBase) : 0),
      fuelAll: () => (a.fuel ? coreFuel() / a.fuel : 0),
      dvLeftV() { return dvRest(); }
    });
  }
  // ツール用：最後まで 一気に計算する（エンジンは 自動のまま。燃料が のこっていても 安定した軌道なら おわる）
  function runToEnd(a, opt) {
    opt = Object.assign({ autoEnd: true }, opt || {});
    const s = create(a, opt), cap = opt.maxT || 200000;
    while (!s.done && s.t < cap) {
      s.advance(Math.max(0.02, s.autoWarp() * 0.05));
      // autoCut：予測の線が 地球を ひとまわり したら（近地点が くうきの外）エンジンを止める ＝ 子どもが ちょうどよく止めた場合
      if (opt.autoCut && s.engineOn && s.lifted && s.body === s.bodies.earth) {
        const el = s.elements(); if (el && el.e < 1 && el.rp > s.body.R + s.body.atmo + 20) { s.setEngine(false); s.cutFuel = s.fuelAll(); }
      }
    }
    return s;
  }
  // snapshot に ふくめない もの（天体・部品の 表・できごと・たどった 軌道 など）
  const SNAP_SKIP = { body: 1, bodies: 1, a: 1, stages: 1, stacks: 1, events: 1, el: 1, done: 1 };
  return { create, runToEnd };
})();
