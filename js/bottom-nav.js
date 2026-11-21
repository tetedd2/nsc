/* =============================================================
 *  Bottom Nav ร่วม 5 แท็บ ของ MoneySkillz
 *  วิธีใช้: ใส่บรรทัดนี้ก่อน </body> ของหน้าหลัก
 *      <script src="js/bottom-nav.js" defer></script>
 *  component จะฉีดทั้ง CSS + เมนู + กำหนดแท็บ active ให้เอง
 * ============================================================= */
(function () {
  'use strict';

  var path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

  // ----- นิยาม 5 แท็บ พร้อมเงื่อนไขว่าหน้าไหนนับเป็นแท็บนี้ -----
  var TABS = [
    {
      id: 'home', label: 'หน้าหลัก', icon: 'home', href: 'dashboard.html',
      active: function (p) { return p === 'dashboard.html' || p === 'index.html' || p === ''; },
    },
    {
      id: 'learn', label: 'เรียนรู้', icon: 'menu_book', href: 'lesson.html',
      active: function (p) { return p.indexOf('lesson') === 0 || p === 'pre-test.html' || p === 'post-test.html'; },
    },
    {
      id: 'play', label: 'เล่น', icon: 'sports_esports', href: 'game-mode.html',
      active: function (p) {
        return p.indexOf('match-') === 0 ||
          ['game-mode.html', 'game.html', 'money-quiz.html', 'timed-score.html', 'leaderboard.html', 'test-result.html'].indexOf(p) !== -1;
      },
    },
    {
      id: 'finance', label: 'การเงิน', icon: 'account_balance_wallet', href: 'graph.html',
      active: function (p) {
        return ['graph.html', 'add-transaction.html', 'history.html', 'add-goal.html', 'goals.html'].indexOf(p) !== -1;
      },
    },
    {
      id: 'profile', label: 'โปรไฟล์', icon: 'person', href: 'settings.html',
      active: function (p) { return ['settings.html', 'shop.html'].indexOf(p) !== -1; },
    },
  ];

  // ----- โหลดฟอนต์ไอคอน Material Symbols ถ้าหน้ายังไม่มี -----
  if (!document.querySelector('link[href*="Material+Symbols"]')) {
    var fl = document.createElement('link');
    fl.rel = 'stylesheet';
    fl.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,1,0';
    document.head.appendChild(fl);
  }

  // ----- ฉีด CSS (รองรับโหมดมืดผ่าน body.dark-mode) -----
  var css = '' +
    ':root{--msk-nav-accent:#1F8F4E;}' +
    'body{padding-bottom:100px!important;}' +
    /* แถบลอย liquid glass (frosted) แบบ iOS */
    '.msk-bottom-nav{position:fixed;left:14px;right:14px;bottom:calc(14px + env(safe-area-inset-bottom,0));z-index:900;display:flex;' +
      'border-radius:30px;padding:9px 8px;font-family:"Kanit","Segoe UI",sans-serif;' +
      'background:rgba(255,255,255,.55);-webkit-backdrop-filter:blur(22px) saturate(180%);backdrop-filter:blur(22px) saturate(180%);' +
      'border:1px solid rgba(255,255,255,.65);' +
      'box-shadow:0 12px 34px rgba(16,42,40,.22), 0 2px 8px rgba(16,42,40,.10), inset 0 1px 0 rgba(255,255,255,.75);}' +
    '.msk-nav-item{flex:1;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;' +
      'text-decoration:none;color:#5f7369;font-size:.70rem;padding:6px 0;border:0;background:none;cursor:pointer;border-radius:16px;' +
      'transition:color .15s ease,transform .12s ease,background .18s ease;}' +
    '.msk-nav-item:active{transform:scale(.9);}' +
    '.msk-nav-item .material-symbols-rounded{font-size:25px;line-height:1;}' +
    '.msk-nav-item.active{color:var(--msk-nav-accent);font-weight:700;background:rgba(31,143,78,.12);}' +
    '.msk-nav-item.active .material-symbols-rounded{font-variation-settings:"FILL" 1;}' +
    /* fallback: เบราว์เซอร์ที่ไม่รองรับ backdrop-filter ให้ทึบขึ้น */
    '@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.msk-bottom-nav{background:rgba(255,255,255,.95);}}' +
    'body.dark-mode .msk-bottom-nav{background:rgba(18,32,24,.58);border-color:rgba(255,255,255,.14);' +
      'box-shadow:0 12px 34px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.14);}' +
    'body.dark-mode .msk-nav-item{color:#9fbbab;}' +
    'body.dark-mode .msk-nav-item.active{color:#5fe39a;background:rgba(95,227,154,.16);}';
  var style = document.createElement('style');
  style.setAttribute('data-msk-nav', '');
  style.textContent = css;
  document.head.appendChild(style);

  // ----- สร้างเมนู -----
  function build() {
    if (document.querySelector('.msk-bottom-nav')) return; // กันซ้ำ
    var nav = document.createElement('nav');
    nav.className = 'msk-bottom-nav';
    nav.setAttribute('aria-label', 'เมนูหลัก');

    TABS.forEach(function (t) {
      var a = document.createElement('a');
      a.className = 'msk-nav-item' + (t.active(path) ? ' active' : '');
      a.href = t.href;
      a.setAttribute('aria-label', t.label);
      if (t.active(path)) a.setAttribute('aria-current', 'page');
      a.innerHTML = '<span class="material-symbols-rounded">' + t.icon + '</span><span>' + t.label + '</span>';
      nav.appendChild(a);
    });

    document.body.appendChild(nav);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
