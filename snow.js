// Новогодний вайб: снежинки и снеговики падают на фоне. Выключается в «Ещё → ❄️ Снег».
(function () {
  function snowOff() { try { return localStorage.getItem('pitosha-snow') === 'off'; } catch (e) { return false; } }
  let cv, ctx, flakes = [], raf = 0, W = 0, H = 0;
  const BIG = ['☃️', '⛄', '🎄', '🎁', '⭐', '🔔']; // снеговики, ёлки, подарки — пореже и покрупнее
  function make(fromTop) {
    const big = Math.random() < 0.1;
    return {
      x: Math.random() * W,
      y: fromTop ? -20 : Math.random() * H,
      r: (big ? 20 : 7) + Math.random() * (big ? 12 : 9),
      spd: (big ? 0.5 : 0.9) + Math.random() * 1.3,
      sway: Math.random() * Math.PI * 2,
      swaySpd: 0.008 + Math.random() * 0.02,
      emo: big ? BIG[Math.floor(Math.random() * BIG.length)] : '❄',
      op: 0.55 + Math.random() * 0.45,
    };
  }
  function resize() { W = cv.width = window.innerWidth; H = cv.height = window.innerHeight; }
  function tick() {
    ctx.clearRect(0, 0, W, H);
    for (const f of flakes) {
      f.y += f.spd;
      f.sway += f.swaySpd;
      f.x += Math.sin(f.sway) * 0.6;
      if (f.y > H + 24) Object.assign(f, make(true));
      ctx.globalAlpha = f.op;
      ctx.font = f.r + 'px serif';
      ctx.fillText(f.emo, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(tick);
  }
  function start() {
    if (cv || snowOff()) return;
    cv = document.createElement('canvas');
    cv.id = 'snow-cv';
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9998';
    document.body.appendChild(cv);
    ctx = cv.getContext('2d');
    ctx.textAlign = 'center';
    resize();
    window.addEventListener('resize', resize);
    const n = Math.max(24, Math.min(70, Math.floor(window.innerWidth / 9)));
    flakes = Array.from({ length: n }, () => make(false));
    tick();
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf), raf = 0;
    if (cv) cv.remove(), cv = null;
  }
  // Переключатель для приложения: window.SNOW.toggle() вкл/выкл и запоминает выбор
  window.SNOW = {
    on: () => !snowOff(),
    toggle() {
      const off = !snowOff();
      try { localStorage.setItem('pitosha-snow', off ? 'off' : 'on'); } catch (e) { /* приватный режим */ }
      if (off) stop(); else start();
      return !off;
    },
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
