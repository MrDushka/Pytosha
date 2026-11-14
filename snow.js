// Новогодний вайб: снежинки и снеговики падают на фоне. Выключается в «Ещё → ❄️ Снег».
(function () {
  function snowOff() { try { return localStorage.getItem('pitosha-snow') === 'off'; } catch (e) { return false; } }
  let cv, ctx, flakes = [], raf = 0, W = 0, H = 0;
  // Красивые белые снежинки: круги разного размера с мягким свечением
  function make(fromTop) {
    return {
      x: Math.random() * W,
      y: fromTop ? -10 : Math.random() * H,
      r: 1.3 + Math.random() * 3.2,
      spd: 0.5 + Math.random() * 1.3,
      sway: Math.random() * Math.PI * 2,
      swaySpd: 0.008 + Math.random() * 0.02,
      op: 0.45 + Math.random() * 0.55,
    };
  }
  function resize() { W = cv.width = window.innerWidth; H = cv.height = window.innerHeight; }
  function tick() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(255,255,255,0.8)';
    ctx.shadowBlur = 4;
    for (const f of flakes) {
      f.y += f.spd;
      f.sway += f.swaySpd;
      f.x += Math.sin(f.sway) * 0.6;
      if (f.y > H + 12) Object.assign(f, make(true));
      ctx.globalAlpha = f.op;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
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
    const n = Math.max(40, Math.min(110, Math.floor(window.innerWidth / 7)));
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
