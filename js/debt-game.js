/* =============================================================
 *  เกมปลดหนี้ — สอนหลัก "โปะหนี้ดอกเบี้ยสูงสุดก่อน" (วิธี Avalanche)
 *  มีหนี้หลายก้อน (ยอด+ดอกเบี้ยต่างกัน) + เงินโปะต่อเดือนคงที่
 *  ผู้เล่นเลือกโปะก้อนไหนในแต่ละเดือน ดอกเบี้ยเดินทุกเดือน
 *  จบแล้วเทียบดอกเบี้ยรวมที่จ่ายกับวิธี Avalanche ที่ดีที่สุด
 *  ใช้ระบบ XP กลาง (js/xp-system.js)
 * ============================================================= */
import { auth, onAuthStateChanged, signInAnonymously } from './firebase-init.js';
import { loadUserXp, addXp, getExpToNextLevel } from './xp-system.js';
import { markDailyMission } from './progress.js';

// ---------- สถานการณ์ (ออกแบบให้ชนะได้ไม่ยาก แต่เห็นผลต่างของกลยุทธ์) ----------
const SCENARIOS = [
  {
    extraPerMonth: 3000,
    debts: [
      { name: 'บัตรเครดิต', balance: 9000, annualRate: 0.18, icon: '💳' },
      { name: 'สินเชื่อส่วนบุคคล', balance: 15000, annualRate: 0.12, icon: '🏦' },
      { name: 'ผ่อนมือถือ', balance: 6000, annualRate: 0.05, icon: '📱' },
    ],
  },
  {
    extraPerMonth: 2500,
    debts: [
      { name: 'บัตรกดเงินสด', balance: 8000, annualRate: 0.24, icon: '💸' },
      { name: 'ผ่อนรถ', balance: 20000, annualRate: 0.07, icon: '🚗' },
      { name: 'ยืมเพื่อน', balance: 4000, annualRate: 0.02, icon: '🤝' },
    ],
  },
];

// ---------- สถานะ ----------
let userId = null;
let cfg = null;
let debts = [];        // สำเนาที่กำลังเล่น
let month = 0;
let totalInterest = 0;

// ---------- Auth ----------
onAuthStateChanged(auth, async (user) => {
  if (user) {
    userId = user.uid;
  } else {
    try { userId = (await signInAnonymously(auth)).user.uid; }
    catch (e) { console.warn('ล็อกอินไม่ระบุตัวตนไม่สำเร็จ (เล่นได้แต่ไม่บันทึก XP):', e.code || e.message); }
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
function monthlyRate(annual) { return annual / 12; }

// จำลองกลยุทธ์อัตโนมัติ (ไม่ยุ่งกับ state) เพื่อหา baseline ไว้เทียบ
function simulate(strategy) {
  let ds = cfg.debts.map((d) => ({ ...d }));
  let interest = 0, m = 0;
  while (ds.some((d) => d.balance > 0) && m < 600) {
    for (const d of ds) {
      if (d.balance > 0) {
        const it = Math.round(d.balance * monthlyRate(d.annualRate));
        d.balance += it; interest += it;
      }
    }
    const cand = ds.filter((d) => d.balance > 0);
    let target;
    if (strategy === 'avalanche') target = cand.sort((a, b) => b.annualRate - a.annualRate)[0];
    else target = cand.sort((a, b) => a.balance - b.balance)[0]; // snowball
    const pay = Math.min(cfg.extraPerMonth, target.balance);
    target.balance -= pay;
    m++;
  }
  return { interest, months: m };
}

// ---------- เริ่มเกม ----------
function startGame() {
  cfg = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
  debts = cfg.debts.map((d) => ({ ...d, original: d.balance }));
  month = 0;
  totalInterest = 0;
  hideModal();
  const be = document.getElementById('extraPerMonth');
  if (be) be.textContent = baht(cfg.extraPerMonth);
  updateHud();
  renderDebts();
}

function updateHud() {
  const mEl = document.getElementById('monthCount');
  const iEl = document.getElementById('interestPaid');
  if (mEl) mEl.textContent = month;
  if (iEl) iEl.textContent = baht(totalInterest);
}

function renderDebts() {
  const box = document.getElementById('debtList');
  if (!box) return;
  box.innerHTML = debts.map((d, i) => {
    const cleared = d.balance <= 0;
    const pct = Math.min(100, d.balance / d.original * 100);
    return (
      '<div class="debt-card' + (cleared ? ' cleared' : '') + '">' +
        '<div class="debt-head">' +
          '<span class="debt-icon">' + d.icon + '</span>' +
          '<span class="debt-name">' + d.name + '</span>' +
          '<span class="debt-rate">ดอกเบี้ย ' + Math.round(d.annualRate * 100) + '%/ปี</span>' +
        '</div>' +
        '<div class="debt-bal">' + (cleared ? '✅ ปลดหนี้แล้ว!' : 'ยอดคงเหลือ ' + baht(d.balance)) + '</div>' +
        '<div class="debt-bar-track"><div class="debt-bar" style="width:' + pct + '%"></div></div>' +
        (cleared ? '' :
          '<button class="pay-btn" onclick="payDebt(' + i + ')">โปะก้อนนี้ ' + baht(cfg.extraPerMonth) + '</button>') +
      '</div>'
    );
  }).join('');
}

// ผู้เล่นเลือกโปะหนี้ก้อน i (= เดินไป 1 เดือน)
window.payDebt = function (i) {
  if (!debts[i] || debts[i].balance <= 0) return;
  // 1) ดอกเบี้ยเดินทุกก้อน
  for (const d of debts) {
    if (d.balance > 0) {
      const it = Math.round(d.balance * monthlyRate(d.annualRate));
      d.balance += it; totalInterest += it;
    }
  }
  // 2) โปะก้อนที่เลือก
  const pay = Math.min(cfg.extraPerMonth, debts[i].balance);
  debts[i].balance -= pay;
  month++;
  updateHud();
  renderDebts();
  if (debts.every((d) => d.balance <= 0)) endGame();
};

async function endGame() {
  const ava = simulate('avalanche');
  const sno = simulate('snowball');
  // ยิ่งจ่ายดอกเบี้ยใกล้วิธี Avalanche ยิ่งดี
  const ratio = totalInterest / Math.max(1, ava.interest);
  let grade, xpGain;
  if (ratio <= 1.03) { grade = '🏆 ยอดเยี่ยม! คุณใช้หลัก Avalanche ได้เป๊ะ'; xpGain = 100; }
  else if (ratio <= 1.15) { grade = '👍 เก่งมาก! จ่ายดอกเบี้ยน้อยใกล้เคียงวิธีที่ดีที่สุด'; xpGain = 70; }
  else if (ratio <= 1.35) { grade = '🙂 ใช้ได้ แต่ยังเสียดอกเบี้ยเกินจำเป็นนิดหน่อย'; xpGain = 45; }
  else { grade = '💪 ลองใหม่! คราวนี้โปะก้อนดอกเบี้ยสูงสุดก่อนนะ'; xpGain = 25; }

  const result = userId ? await addXp(userId, xpGain) : { gained: 0, levelUp: false };
  if (userId) markDailyMission('debt');   // ภารกิจประจำวัน: เล่นเกมปลดหนี้
  refreshXpDisplay();

  // 🎉 ฉลองเมื่อจ่ายดอกเบี้ยได้ดี (ใกล้เคียง/เท่าวิธีที่ดีที่สุด)
  if (ratio <= 1.15 && window.mskConfetti) {
    window.mskConfetti({ count: ratio <= 1.03 ? 150 : 100 });
  }

  let msg =
    '<h2 style="margin:0 0 6px;color:#1F8F4E;">' + grade + '</h2>' +
    '<div class="sum-box">' +
      '<div class="sum-row"><span>ปลดหนี้ใน</span><span><b>' + month + '</b> เดือน</span></div>' +
      '<div class="sum-row"><span>ดอกเบี้ยที่คุณจ่าย</span><span><b>' + baht(totalInterest) + '</b></span></div>' +
      '<div class="sum-row"><span>ถ้าใช้ Avalanche (ดีสุด)</span><span>' + baht(ava.interest) + '</span></div>' +
      '<div class="sum-row"><span>ถ้าใช้ Snowball</span><span>' + baht(sno.interest) + '</span></div>' +
    '</div>';
  if (result.gained > 0) msg += '<div class="exp-gain">+' + result.gained + ' XP</div>';
  if (result.levelUp) msg += '<div class="level-up">🎊 Level Up! Level ' + result.newLevel + '</div>';
  msg += '<p class="tip">💡 วิธี Avalanche: โปะหนี้ที่ <b>ดอกเบี้ยสูงสุด</b> ก่อนเสมอ ช่วยประหยัดดอกเบี้ยรวมมากที่สุด</p>';

  showModal(msg,
    '<button class="modal-btn" onclick="startDebtGame()">เล่นอีกครั้ง</button>' +
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

// ---------- expose ----------
window.startDebtGame = startGame;
window.goToGameMenu = function () { location.href = 'game.html'; };

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startGame);
else startGame();
