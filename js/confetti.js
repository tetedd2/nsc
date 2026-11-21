/* MoneySkillz — lightweight confetti (no deps, respects reduced-motion)
 * Usage: window.mskConfetti()  or  window.mskConfetti({ count: 140 })
 */
(function () {
  const COLORS = ['#1F8F4E', '#2BC46A', '#37C06A', '#FFC107', '#E6A200', '#E2483B', '#4FC3F7', '#AB47BC'];
  let injected = false;

  function injectCSS() {
    if (injected) return;
    injected = true;
    const s = document.createElement('style');
    s.textContent =
      '.msk-confetti-wrap{position:fixed;inset:0;pointer-events:none;z-index:99999;overflow:hidden;}' +
      '.msk-confetti-piece{position:absolute;top:-18px;will-change:transform,opacity;}' +
      '@keyframes msk-confetti-fall{' +
      '0%{opacity:1;transform:translate3d(0,0,0) rotateZ(0deg);}' +
      '85%{opacity:1;}' +
      '100%{opacity:0;transform:translate3d(var(--dx),108vh,0) rotateZ(var(--rot));}}';
    document.head.appendChild(s);
  }

  window.mskConfetti = function (opts) {
    opts = opts || {};
    // honor reduced-motion
    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    } catch (e) {}

    injectCSS();
    const count = opts.count || 100;
    const wrap = document.createElement('div');
    wrap.className = 'msk-confetti-wrap';
    document.body.appendChild(wrap);

    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'msk-confetti-piece';
      const size = 6 + Math.random() * 7;
      p.style.left = (Math.random() * 100) + 'vw';
      p.style.width = size + 'px';
      p.style.height = (size * 1.4) + 'px';
      p.style.background = COLORS[(Math.random() * COLORS.length) | 0];
      p.style.borderRadius = Math.random() < 0.5 ? '50%' : '2px';
      p.style.setProperty('--dx', ((Math.random() * 2 - 1) * 140) + 'px');
      p.style.setProperty('--rot', ((Math.random() * 720 - 360)) + 'deg');
      const dur = 2.2 + Math.random() * 1.8;
      const delay = Math.random() * 0.5;
      p.style.animation = 'msk-confetti-fall ' + dur + 's cubic-bezier(.18,.7,.5,1) ' + delay + 's forwards';
      wrap.appendChild(p);
    }

    setTimeout(function () { wrap.remove(); }, opts.duration || 4600);
  };
})();
