// 効果音と声
RL.Audio = (function () {
  let ac = null, muted = false;
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
  function say(t) {
    if (muted || !window.speechSynthesis) return;
    try { const u = new SpeechSynthesisUtterance(t); u.lang = 'ja-JP'; u.rate = 1.1; speechSynthesis.speak(u); } catch (e) {}
  }
  return { tone, rumble, say, get muted() { return muted; }, toggle() { muted = !muted; return muted; } };
})();
