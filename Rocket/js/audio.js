// 効果音と声。声は順番に話し、話しおわったら cb を呼ぶ
RL.Audio = (function () {
  let ac = null, muted = false, jaVoice = null;
  const ctx = () => (ac = ac || new (window.AudioContext || window.webkitAudioContext)());
  function tone(f, d, type = 'sine', v = 0.2) {
    if (muted) return; try {
      const a = ctx(), o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(v, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + d);
      o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + d);
    } catch (e) {}
  }
  function rumble(sec) {
    if (muted) return; try {
      const a = ctx(), n = a.sampleRate * sec, b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
      f.type = 'lowpass'; f.frequency.value = 400; g.gain.value = 0.5; s.buffer = b; s.connect(f).connect(g).connect(a.destination); s.start();
    } catch (e) {}
  }
  function pickVoice() { try { jaVoice = speechSynthesis.getVoices().find(v => /ja/i.test(v.lang)) || null; } catch (e) {} }
  if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  let talkId = 0;
  // v0.14.6：よみあげ用に なおす（▼▲ は「くろさんかく」と よまれる、「はた」は「わた」と よまれる）  //  v0.14.7：ことばの はじめの「は」が「わ」と よまれる（はいる → わいる）。は で はじまる ことばを 漢字に
  const YOMI = [['はいる', '入る'], ['はいっ', '入っ'], ['はいれ', '入れ'], ['はさみ', 'ハサミ'], ['はやすぎ', '速すぎ'], ['はやく', '速く'], ['はやさ', '速さ'],
    ['はやおくり', '早送り'], ['はんたいがわ', '反対側'], ['はっしゃ', '発射'], ['はずれ', '外れ'], ['はしが', '端が'], ['はね', '羽'], ['はじめ', '始め'], ['はこ', '箱'], ['はたを', '旗を'], ['はたで', '旗で'], ['はた', '旗']];
  const speak = t => { t = String(t).replace(/▼/g, 'みどりの さんかく').replace(/▲/g, 'きいろの さんかく');
    YOMI.forEach(([a, b]) => { t = t.replace(new RegExp('(^|[\\s、。！？])' + a, 'g'), '$1' + b); }); return t; };
  function say(t, cb, opt = {}) {
    t = speak(t);
    const id = ++talkId, done = () => { if (id === talkId && cb) { const f = cb; cb = null; f(); } };
    const est = (900 + t.length * 170) / RL.CFG.VOICE_RATE;
    if (muted || !window.speechSynthesis) { setTimeout(done, muted ? est * 0.6 : est); return; }
    try {
      if (opt.interrupt !== false) speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(t); u.lang = 'ja-JP'; u.rate = opt.rate || RL.CFG.VOICE_RATE; u.pitch = 1.15;
      if (jaVoice) u.voice = jaVoice;
      u.onend = done; u.onerror = done; speechSynthesis.speak(u);
      setTimeout(done, est * 2.5);
    } catch (e) { setTimeout(done, est); }
  }
  function stop() { talkId++; try { speechSynthesis.cancel(); } catch (e) {} }
  return { tone, rumble, say, stop, speak, get muted() { return muted; }, toggle() { muted = !muted; if (muted) stop(); return muted; } };
})();
