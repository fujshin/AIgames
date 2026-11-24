// うちゅうモードの 飛び方（2D）。たかさモードと ちがい、1こまずつ 進める（とちゅうで エンジンを止める・中止 ができる）
//  - 位置・速度は「いま いる重力圏の天体」から見た値（パッチドコニック）。重力は その天体だけ（距離の2乗に反比例）
//  - エンジンを使っている間・くうきの中：小さな きざみで 数値積分
//  - 惰性で うちゅうを飛ぶ間：ケプラー軌道の式で 位置を出す（レール上）。早送りしても 軌道が くずれない
//  - 段・ブースター・宇宙用エンジン・はね は たかさモード（physics.js）と同じ きまり
//  - 液体エンジン（地上用・宇宙用）は 止めて また つけられる。ブースター（固体）は 止められない
//  - v0.10：向き（sim.dir）。'auto'＝打ち上げの 自動／'pro'＝すすむ向き（前へ）／'retro'＝反対（うしろへ・ブレーキ）
//           えらべるのは くうきの外だけ。うちゅうで いちど エンジンを とめたら、つぎからは 'pro'
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
      dvUsed: 0
    };
    sim.vx = -earth.rot * sim.y; sim.vy = earth.rot * sim.x;    // 地面と いっしょに まわっている
    ignite(0, 0);
    { const f = fins(); sim.dev = devTarget(f); sim.devDir = Math.sign(f.L - f.R) || 1; }
    const hasProp = S.some(s => s.eng + s.veng > 0) || st.length;
    if (!hasProp) sim.done = { type: 'noEngine' };
    const mass = () => Math.max(0.1, sum(S.slice(sim.si), x => x.dry + x.fuel) + sum(st.filter(attached), x => x.dry + x.fuel));
    const alt = () => Math.hypot(sim.x, sim.y) - sim.body.R;
    const rhoAt = h => sim.body.atmo ? Math.max(0, 1 - h / sim.body.atmo) : 0;
    const coreFuel = () => sum(S.slice(sim.si), y => y.fuel);
    const liquidLeft = () => { const c = S[sim.si]; return c.fuel > 0 && c.eng + c.veng > 0; };
    const canBurnCore = () => { const c = S[sim.si]; return c.fuel > 0 && c.eng + c.veng > 0 && sim.t >= c.ignT; };
    const boosting = () => st.some(s => s.sepT === null && s.ignT !== null && sim.t >= s.ignT && s.fuel > 0);
    const inAirNow = () => !!sim.body.atmo && Math.hypot(sim.x, sim.y) - sim.body.R < sim.body.atmo;
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
      const k = sim.dir === 'retro' ? -1 : 1, vx = sim.vx * k, vy = sim.vy * k;
      if (Math.hypot(vx, vy) < 1e-6) return sim.point;
      return Math.atan2(vx * ux + vy * uy, vx * ex + vy * ey);
    }
    // ---- 推力・燃料（dt 秒ぶん） ----
    function burn(dt, rho) {
      const cur = S[sim.si], on = sim.t >= cur.ignT;
      const vpow = P.VAIR + (1 - P.VAIR) * (1 - rho); sim.vpow = vpow;
      let thrustC = 0;
      const burnC = sim.engineOn && on && cur.fuel > 0 && cur.eng + cur.veng > 0;
      if (burnC) {
        thrustC = cur.eng * P.THRUST + cur.veng * P.VTHRUST * vpow;
        cur.fuel = Math.max(0, cur.fuel - (cur.eng * P.BURN + cur.veng * P.VBURN) * dt);
      }
      let thrustB = 0, boost = false;
      st.forEach(s => {
        if (s.sepT !== null || s.ignT === null || sim.t < s.ignT) return;
        if (s.fuel > 0) { s.fuel = Math.max(0, s.fuel - P.BOOST_BURN * Math.pow(s.seg, P.BOOST_SEG_POW || 0) * dt); thrustB += TbOf(s.seg); boost = true; }
        if (s.fuel <= 0) { s.sepT = sim.t; emit('booster-sep', { id: s.id }); }
      });
      // 段の切りはなし：いまの段で 燃えるものが なくなったら（エンジンを止めただけでは 切りはなさない）
      if (sim.si < last && on && !(cur.fuel > 0 && cur.eng + cur.veng > 0) && !st.some(s => s.stage === sim.si && s.sepT === null && s.fuel > 0)) {
        cur.sepT = sim.t;
        st.forEach(s => { if (s.stage === sim.si && s.sepT === null) { s.sepT = sim.t; s.withStage = true; } });
        emit('stage-sep', { i: sim.si });
        sim.si++; ignite(sim.si, sim.t + P.IGN_DELAY);
        const f = fins(); sim.dev = Math.min(sim.dev, 1.2);
        if (f.n === 0 && rho > 0) sim.devDir = sim.devDir || 1;
      }
      sim.burnC = burnC; sim.boost = boost;
      return thrustC + thrustB;
    }
    // ---- 1きざみ（数値積分） ----
    function numStep(dt) {
      const b = sim.body, r = Math.hypot(sim.x, sim.y), ux = sim.x / r, uy = sim.y / r, ex = -uy, ey = ux;   // 上・横（反時計まわり＝東）
      const h = r - b.R, rho = rhoAt(h); sim.rho = rho;
      const m0 = mass(), T = burn(dt, rho), m = mass();
      const g = b.mu / (r * r);
      const vr = sim.vx * ux + sim.vy * uy, vt = sim.vx * ex + sim.vy * ey;
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
      const manual = sim.dir !== 'auto' && !rho && sim.lifted;
      const pt = manual ? aimAngle() : sim.pitch * D2R - sim.dev * sim.devDir; sim.point = pt;
      if (manual) sim.pitch = Math.max(-90, Math.min(90, pt / D2R));   // 自動に もどったときに とばないように
      const tx = Math.cos(pt) * ex + Math.sin(pt) * ux, ty = Math.cos(pt) * ey + Math.sin(pt) * uy;
      sim.tdx = tx; sim.tdy = ty;   // おす向き（スローモーションの判定に つかう）
      // 空気のじゃま（地面といっしょに まわる 空気に対して）
      const ax0 = -b.rot * sim.y, ay0 = b.rot * sim.x, wx = sim.vx - ax0, wy = sim.vy - ay0, wv = Math.hypot(wx, wy);
      const dg = a.drag[sim.si];
      const cd = (P.DRAG * Math.max(1, dg.cols) * (1 - (1 - P.NOSE_DRAG) * dg.noseCover) + P.DRAG * P.BOOST_DRAG * st.filter(attached).length) * rho;
      let accx = T * tx / m - g * ux - cd * wv * wx / m, accy = T * ty / m - g * uy - cd * wv * wy / m;
      sim.thrust = T; sim.mass = m; sim.weight = m * g;
      if (m0 > m && T > 0) sim.dvUsed += T / m * dt;
      if (sim.landed) {
        // 発射台の上：上むきの力が 重さに かつまで うごかない（地面と いっしょに まわる）
        const up = accx * ux + accy * uy + (b.rot * b.rot) * r;
        if (up <= 0) {
          sim.t += dt; const ph = Math.atan2(sim.y, sim.x) + b.rot * dt;
          sim.x = b.R * Math.cos(ph); sim.y = b.R * Math.sin(ph); sim.vx = -b.rot * sim.y; sim.vy = b.rot * sim.x;
          if (!sim.isPowered() && sim.t > 0.5) sim.done = { type: 'heavy' };
          return;
        }
        sim.landed = false; sim.lifted = true; emit('liftoff');
      }
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
    function finish(d) {
      if (sim.done) return;
      sim.done = Object.assign({ maxAlt: sim.maxAlt, maxV: sim.maxV, t: sim.t, body: sim.body.id, cls: sim.cls }, d);
      emit('done', sim.done);
    }
    // ---- 外から呼ぶ：dt 秒（ゲームの時間）すすめる ----
    function advance(dtAll) {
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
        if (sim.lifted && h2 <= 1e-6) { finish({ type: sim.body === earth ? 'ground' : 'hit', speed: sp, range: sim.body === earth ? downrange() : 0 }); break; }
        if (!sim.inSpace && sim.body.atmo && h2 > sim.body.atmo) { sim.inSpace = true; emit('space'); }
        checkSOI();
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
    function elements() { return sim.el || (sim.lifted ? SP.toElements(sim.x, sim.y, sim.vx, sim.vy, sim.body.mu, sim.t) : null); }
    // 早送りの おすすめ倍率
    //  - くうきの中で 燃えている間・発射台の上は 実時間
    //  - v0.8.2：うちゅうで 燃えている間は スローモーション。1秒（実時間）に ふえる速さを SLOW.DV までに おさえる
    //    軌道の種類が かわる すぐ手前（月に とどく／にげる／まわりはじめる 等）は SLOW.DV_NEAR まで ゆっくり
    //  - v0.10：月と であう 予測に かわる すぐ手前（flight2d が sim.moonNear を たてる）は SLOW.DV_MOON まで もっと ゆっくり
    //           月の重力圏では 早送りを ひかえめに（いちばん ちかづく ところで ブレーキを かけやすく）
    function autoWarp() {
      if (sim.done) return 1;
      const r = Math.hypot(sim.x, sim.y), v = Math.max(1, Math.hypot(sim.vx, sim.vy)), h = r - sim.body.R;
      if (sim.landed) return 1;
      if (sim.isPowered()) {
        if (!sim.lifted || (sim.body.atmo && h < sim.body.atmo)) return 1;
        const acc = sim.thrust / Math.max(0.1, sim.mass), SL = O.SLOW;
        if (!SL || acc <= 0) return 1;
        if (sim.moonNear && SL.DV_MOON) return Math.max(SL.MIN_MOON || 0.004, Math.min(1, SL.DV_MOON / acc));
        return Math.max(SL.MIN, Math.min(1, (critical() ? SL.DV_NEAR : SL.DV) / acc));
      }
      if (sim.body.atmo && h < sim.body.atmo) return Math.max(1, Math.min(8, h / 60));
      let wmax = r / v / (sim.body.parent ? 6 : 1.6);
      // 月に ちかづいたら ゆっくりに（であいを 見のがさない・見せる）
      sim.body.children.forEach(c => { const cs = SP.bodyState(c, sim.t), d = Math.hypot(sim.x - cs.x, sim.y - cs.y) - c.soi, rv = Math.max(1, Math.hypot(sim.vx - cs.vx, sim.vy - cs.vy));
        if (d > 0) wmax = Math.min(wmax, Math.max(20, d / rv / 1.2)); });
      return Math.max(1, Math.min(O.WARP_MAX, wmax));
    }
    return Object.assign(sim, {
      advance, elements, autoWarp, downrange, events: ev, alt, coreFuel, critical, aimAngle,
      setEngine(on) {
        if (sim.engineOn === on) return; sim.engineOn = on; sim.el = null;
        // v0.10：うちゅうで いちど とめたら、つぎからは「前へ」（自動の 打ち上げは おしまい）
        if (!on && sim.dir === 'auto' && sim.lifted && !inAirNow()) sim.dir = 'pro';
        emit(on ? 'engine-on' : 'engine-off');
      },
      // v0.10：向きを えらぶ（くうきの外だけ）。'pro' ⇄ 'retro'
      setDir(d) { if (!sim.lifted || inAirNow() || !['pro', 'retro'].includes(d) || sim.dir === d) return false; sim.dir = d; sim.el = null; emit('dir', { dir: d }); return true; },
      canDir: () => sim.lifted && !sim.done && !inAirNow(),
      abort() { finish({ type: 'abort' }); },
      finishNow() { if (sim.cls && ['low', 'high', 'toMoon', 'moonOrbit'].includes(sim.cls) && !sim.isPowered()) finish({ type: 'orbit', el: elements() }); },
      liquidLeft,
      fuelRatio: () => (a.fuel ? coreFuel() / a.fuel : 0)
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
        const el = s.elements(); if (el && el.e < 1 && el.rp > s.body.R + s.body.atmo + 20) { s.setEngine(false); s.cutFuel = s.fuelRatio(); }
      }
    }
    return s;
  }
  return { create, runToEnd };
})();
