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
  function say(t, cb, opt = {}) {
    const id = ++talkId, done = () => { if (id === talkId && cb) { const f = cb; cb = null; f(); } };
    const est = (900 + t.length * 170) / RL.CFG.VOICE_RATE;           // 声が使えないときの目安時間
    if (muted || !window.speechSynthesis) { setTimeout(done, muted ? est * 0.6 : est); return; }
    try {
      if (opt.interrupt !== false) speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(t); u.lang = 'ja-JP'; u.rate = opt.rate || RL.CFG.VOICE_RATE; u.pitch = 1.15;
      if (jaVoice) u.voice = jaVoice;
      u.onend = done; u.onerror = done; speechSynthesis.speak(u);
      setTimeout(done, est * 2.5);              // 終わりが来ないブラウザ対策
    } catch (e) { setTimeout(done, est); }
  }
  function stop() { talkId++; try { speechSynthesis.cancel(); } catch (e) {} }
  return { tone, rumble, say, stop, get muted() { return muted; }, toggle() { muted = !muted; if (muted) stop(); return muted; } };
})();
