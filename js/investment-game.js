/* =============================================================
 *  เกมจำลองลงทุน — แบ่งเงิน ฿10,000 ลงสินทรัพย์ 4 แบบ แล้วจำลองผล 5 ปี
 *  สอน: ความเสี่ยง-ผลตอบแทน, การกระจายความเสี่ยง (diversification),
 *       ทองคำช่วย hedge, ลงทุนระยะยาว
 *  ใช้ระบบ XP กลาง (js/xp-system.js) — ตรงกับ dashboard
 * ============================================================= */
import { auth, onAuthStateChanged, signInAnonymously } from './firebase-init.js';
import { loadUserXp, addXp, getExpToNextLevel } from './xp-system.js';
import { markDailyMission } from './progress.js';

// ---------- สินทรัพย์ (ผลตอบแทนเฉลี่ย/ความผันผวน/ความสัมพันธ์กับตลาด) ----------
const ASSETS = [
  { key: 'deposit', name: 'เงินฝาก/พันธบัตร', icon: '🏦', risk: 'เสี่ยงต่ำ',  riskCls: 'low',  mean: 0.02, vol: 0.01, corr: 0.0,  desc: 'มั่นคง แทบไม่ขาดทุน ผลตอบแทนต่ำ ~2%/ปี' },
  { key: 'fund',    name: 'กองทุนรวมดัชนี',   icon: '📊', risk: 'เสี่ยงกลาง', riskCls: 'mid',  mean: 0.07, vol: 0.15, corr: 0.9,  desc: 'กระจายอัตโนมัติ ผลตอบแทน ~7%/ปี' },
  { key: 'stock',   name: 'หุ้นรายตัว',       icon: '📈', risk: 'เสี่ยงสูง',  riskCls: 'high', mean: 0.11, vol: 0.28, corr: 0.95, desc: 'โตเร็วแต่ผันผวนมาก ~11%/ปี' },
  { key: 'gold',    name: 'ทองคำ',           icon: '🪙', risk: 'เสี่ยงกลาง', riskCls: 'gold', mean: 0.04, vol: 0.12, corr: -0.3, desc: 'ช่วยกันความผันผวน (hedge) ~4%/ปี' },
];
const INIT_CAPITAL = 10000;
const YEARS = 5;
const STEP = 5;

// ---------- สถานะ ----------
let userId = null;
const alloc = { deposit: 0, fund: 0, stock: 0, gold: 0 };

// ---------- Auth ----------
onAuthStateChanged(auth, async (user) => {
  if (user) {
    userId = user.uid;
  } else {
    try { userId = (await signInAnonymously(auth)).user.uid; }
    catch (e) { console.warn('ล็อกอินแบบไม่ระบุตัวตนไม่สำเร็จ (เล่นได้แต่ไม่บันทึก XP):', e.code || e.message); }
  }
  refreshXpDisplay();
});

async function refreshXpDisplay() {
  if (!userId) return;
  const { xp, level } = await loadUserXp(userId, auth.currentUser && auth.currentUser.displayName);
  const lv = document.getElementById('playerLevel');
  const ex = document.getElementById('playerExp');
  const nx = document.getElementById('expToNext');
  const fill = document.getElementById('expFill');
  if (!(lv && ex && nx && fill)) return;
  const toNext = getExpToNextLevel(level);
  lv.textContent = level;
  ex.textContent = xp;
  nx.textContent = toNext === Infinity ? 'MAX' : toNext;
  fill.style.width = Math.min(100, (toNext && toNext !== Infinity) ? (xp / toNext * 100) : 100) + '%';
}

// ---------- utility ----------
function baht(n) { return '฿' + Math.round(n).toLocaleString('th-TH'); }
function total() { return ASSETS.reduce((s, a) => s + alloc[a.key], 0); }
function gaussian() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ---------- สร้างแถวสินทรัพย์ ----------
function buildRows() {
  const list = document.getElementById('assetList');
  if (!list) return;
  list.innerHTML = ASSETS.map((a) =>
    '<div class="asset-row" data-key="' + a.key + '">' +
      '<div class="asset-ico">' + a.icon + '</div>' +
      '<div class="asset-info">' +
        '<div class="asset-name">' + a.name + ' <span class="risk ' + a.riskCls + '">' + a.risk + '</span></div>' +
        '<div class="asset-desc">' + a.desc + '</div>' +
        '<div class="asset-bar-track"><div class="asset-bar" id="bar-' + a.key + '"></div></div>' +
      '</div>' +
      '<div class="asset-ctrl">' +
        '<button class="step" data-key="' + a.key + '" data-d="-' + STEP + '" aria-label="ลด">−</button>' +
        '<span class="asset-pct" id="pct-' + a.key + '">0%</span>' +
        '<button class="step" data-key="' + a.key + '" data-d="' + STEP + '" aria-label="เพิ่ม">+</button>' +
      '</div>' +
    '</div>'
  ).join('');

  list.querySelectorAll('.step').forEach((btn) => {
    btn.addEventListener('click', () => step(btn.dataset.key, parseInt(btn.dataset.d, 10)));
  });
}

function step(key, d) {
  const used = total();
  let next = alloc[key] + d;
  next = Math.max(0, next);
  const maxForThis = 100 - (used - alloc[key]);   // กันไม่ให้รวมเกิน 100%
  next = Math.min(next, maxForThis);
  alloc[key] = next;
  render();
}

function render() {
  const used = total();
  const remain = 100 - used;
  ASSETS.forEach((a) => {
    const pctEl = document.getElementById('pct-' + a.key);
    const barEl = document.getElementById('bar-' + a.key);
    if (pctEl) pctEl.textContent = alloc[a.key] + '%';
    if (barEl) barEl.style.width = alloc[a.key] + '%';
  });
  const remainEl = document.getElementById('remain');
  const hint = document.getElementById('allocHint');
  const btn = document.getElementById('investBtn');
  if (remainEl) remainEl.textContent = remain + '%';
  if (hint) {
    hint.classList.toggle('ready', remain === 0);
    hint.innerHTML = remain === 0
      ? 'จัดสรรครบ 100% แล้ว — พร้อมลงทุน! <b>✓</b>'
      : 'แบ่งเงินให้ครบ 100% — เหลือจัดสรร <b id="remain">' + remain + '%</b>';
  }
  if (btn) btn.disabled = remain !== 0;
}

// ---------- จำลองผล 5 ปี ----------
function simulate() {
  const caps = {};
  ASSETS.forEach((a) => { caps[a.key] = INIT_CAPITAL * alloc[a.key] / 100; });
  const yearly = [];
  for (let y = 0; y < YEARS; y++) {
    const market = gaussian();                 // ปัจจัยตลาดรวม (ปีนั้นดี/แย่)
    ASSETS.forEach((a) => {
      const idio = gaussian();
      const shock = a.corr * market + Math.sqrt(Math.max(0, 1 - a.corr * a.corr)) * idio;
      let r = a.mean + a.vol * shock;
      r = Math.max(-0.6, r);                    // กันขาดทุนเกิน 60% ต่อปี
      caps[a.key] *= (1 + r);
    });
    yearly.push(ASSETS.reduce((s, a) => s + caps[a.key], 0));
  }
  return { caps, yearly, final: yearly[yearly.length - 1] };
}

async function invest() {
  if (total() !== 100) return;
  const btn = document.getElementById('investBtn');
  if (btn) btn.disabled = true;

  const sim = simulate();
  const profit = (sim.final - INIT_CAPITAL) / INIT_CAPITAL * 100;
  const divCount = ASSETS.filter((a) => alloc[a.key] >= 15).length;
  const concentrated = ASSETS.some((a) => alloc[a.key] >= 90);

  // ---- XP: ให้รางวัลกับ "กลยุทธ์ที่ดี" มากกว่าโชค ----
  let xpGain = 25;                              // เล่นจบ
  if (divCount >= 3) xpGain += 35;
  else if (divCount === 2) xpGain += 15;
  if (profit > 0) xpGain += Math.min(40, Math.round(profit));
  xpGain = Math.min(100, xpGain);

  const result = userId ? await addXp(userId, xpGain) : { gained: 0, levelUp: false };
  if (userId) markDailyMission('invest');   // ภารกิจประจำวัน: เล่นเกมจำลองลงทุน
  refreshXpDisplay();

  // ---- headline + tip ----
  let headline, tip;
  if (concentrated) {
    headline = '⚠️ ทุ่มหมดหน้าตักในสินทรัพย์เดียว';
    tip = '💡 การใส่เงินเกือบทั้งหมดในที่เดียวเสี่ยงมาก — ปีที่ดีกำไรพุ่ง แต่ปีที่แย่ก็เจ็บหนัก การกระจายความเสี่ยงช่วยให้พอร์ตนิ่งขึ้น';
  } else if (profit > 0 && divCount >= 3) {
    headline = '🎉 เยี่ยมมาก! พอร์ตกระจายดีและเติบโต';
    tip = '💡 "อย่าใส่ไข่ทุกฟองในตะกร้าเดียว" — กระจายในหลายสินทรัพย์ช่วยลดความผันผวน และการลงทุนระยะยาวช่วยให้ผลตอบแทนเฉลี่ยดีขึ้น';
  } else if (profit > 0) {
    headline = '👍 ได้กำไร! ลองกระจายให้มากขึ้นอีกนิด';
    tip = '💡 ถ้ากระจายในสินทรัพย์เสี่ยงต่ำ-กลาง-สูง ให้สมดุล จะช่วยลดโอกาสขาดทุนหนักในปีที่ตลาดแย่';
  } else {
    headline = '💪 ปีนี้ตลาดไม่เป็นใจ';
    tip = '💡 ขาดทุนระยะสั้นเป็นเรื่องปกติของการลงทุน — การกระจายความเสี่ยง (มีเงินฝาก/ทองคำปนด้วย) และถือระยะยาวช่วยให้ผ่านช่วงตลาดแย่ไปได้';
  }

  const rows = ASSETS.filter((a) => alloc[a.key] > 0).map((a) =>
    '<div class="sum-row"><span>' + a.icon + ' ' + a.name + ' (' + alloc[a.key] + '%)</span>' +
    '<span>' + baht(sim.caps[a.key]) + '</span></div>'
  ).join('');

  const yearsRow = sim.yearly.map((v, i) => 'ปี' + (i + 1) + ' ' + baht(v)).join(' → ');

  const profitCls = profit >= 0 ? 'up' : 'down';
  const profitTxt = (profit >= 0 ? '▲ กำไร ' : '▼ ขาดทุน ') + Math.abs(profit).toFixed(1) + '%';

  let msg =
    '<h2 style="margin:0 0 4px;color:#1F8F4E;">' + headline + '</h2>' +
    '<div class="res-value" style="color:#13311f;">' + baht(sim.final) + '</div>' +
    '<div class="res-profit ' + profitCls + '">' + profitTxt + ' จาก ' + baht(INIT_CAPITAL) + '</div>' +
    '<div class="sum-box">' + rows + '</div>' +
    '<div class="years-row">' + yearsRow + '</div>';
  if (result.gained > 0) msg += '<div class="exp-gain">+' + result.gained + ' XP</div>';
  if (result.levelUp) msg += '<div class="level-up">🎊 Level Up! Level ' + result.newLevel + '</div>';
  msg += '<p class="tip">' + tip + '</p>';

  // 🎉 ฉลองเมื่อได้กำไร
  if (profit > 0 && window.mskConfetti) {
    window.mskConfetti({ count: (!concentrated && divCount >= 3) ? 150 : 100 });
  }

  showModal(msg,
    '<button class="modal-btn" onclick="startInvestGame()">เล่นอีกครั้ง</button>' +
    '<button class="modal-btn" onclick="goToGameMenu()">กลับเมนูเกม</button>');
}

function showModal(html, btns) {
  const content = document.getElementById('modalContent');
  const overlay = document.getElementById('modalOverlay');
  if (content && overlay) {
    content.innerHTML = html + '<div class="modal-btn-container">' + (btns || '') + '</div>';
    overlay.style.display = 'flex';
  }
}
function hideModal() {
  const overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.style.display = 'none';
}

function startGame() {
  ASSETS.forEach((a) => { alloc[a.key] = 0; });
  hideModal();
  buildRows();
  render();
}

// ---------- expose + ปุ่ม ----------
window.startInvestGame = startGame;
window.goToGameMenu = function () { location.href = 'game.html'; };

function wireButtons() {
  const invBtn = document.getElementById('investBtn');
  const evenBtn = document.getElementById('evenBtn');
  if (invBtn) invBtn.addEventListener('click', invest);
  if (evenBtn) evenBtn.addEventListener('click', () => {
    ASSETS.forEach((a) => { alloc[a.key] = 25; });   // 4 สินทรัพย์ = 25% เท่ากัน
    render();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { wireButtons(); startGame(); });
} else {
  wireButtons();
  startGame();
}
