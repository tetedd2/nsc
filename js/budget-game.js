/* =============================================================
 *  เกมจัดงบ 50/30/20 — สอนหลักแบ่งเงิน จำเป็น 50% / อยากได้ 30% / ออม 20%
 *  ของแต่ละชิ้นโผล่ทีละชิ้น ผู้เล่นเลือกหมวด ถังทั้ง 3 เติมเทียบเป้า
 *  ใช้ระบบ XP กลาง (js/xp-system.js) — ตรงกับ dashboard
 * ============================================================= */
import { auth, onAuthStateChanged, signInAnonymously } from './firebase-init.js';
import { loadUserXp, addXp, getExpToNextLevel } from './xp-system.js';
import { markDailyMission } from './progress.js';

// ---------- สถานการณ์ (ออกแบบให้จัดถูก = 50/30/20 พอดี) ----------
// need = จำเป็น (50%), want = อยากได้ (30%), save = ออม (20%)
const SCENARIOS = [
  {
    income: 10000,
    items: [
      { name: 'ค่าหอพัก', amount: 2500, cat: 'need', icon: '🏠' },
      { name: 'ค่าอาหาร 3 มื้อ', amount: 1500, cat: 'need', icon: '🍚' },
      { name: 'ค่าเดินทาง', amount: 700, cat: 'need', icon: '🚌' },
      { name: 'ค่าเน็ต/มือถือ', amount: 300, cat: 'need', icon: '📶' },
      { name: 'ดูหนัง/เที่ยว', amount: 1000, cat: 'want', icon: '🎬' },
      { name: 'เสื้อผ้าแฟชั่น', amount: 800, cat: 'want', icon: '👕' },
      { name: 'เกม/ไอเทมในเกม', amount: 600, cat: 'want', icon: '🎮' },
      { name: 'ชา/กาแฟ/ขนม', amount: 600, cat: 'want', icon: '🧋' },
      { name: 'เงินออมเผื่อฉุกเฉิน', amount: 1200, cat: 'save', icon: '🏦' },
      { name: 'ลงทุน/กองทุนรวม', amount: 800, cat: 'save', icon: '📈' },
    ],
  },
  {
    income: 8000,
    items: [
      { name: 'ค่าหอพัก', amount: 2000, cat: 'need', icon: '🏠' },
      { name: 'ค่าอาหาร', amount: 1200, cat: 'need', icon: '🍚' },
      { name: 'ค่าเดินทาง', amount: 500, cat: 'need', icon: '🚌' },
      { name: 'ค่าน้ำ-ไฟ', amount: 300, cat: 'need', icon: '💡' },
      { name: 'สตรีมมิ่ง/หนัง', amount: 700, cat: 'want', icon: '📺' },
      { name: 'เสื้อผ้า', amount: 700, cat: 'want', icon: '👟' },
      { name: 'สังสรรค์กับเพื่อน', amount: 600, cat: 'want', icon: '🎉' },
      { name: 'ขนม/เครื่องดื่ม', amount: 400, cat: 'want', icon: '🍰' },
      { name: 'เงินสำรองฉุกเฉิน', amount: 1000, cat: 'save', icon: '🏦' },
      { name: 'ลงทุนระยะยาว', amount: 600, cat: 'save', icon: '📈' },
    ],
  },
];

const CATS = {
  need: { label: 'จำเป็น', ratio: 0.5, color: '#2e7d32' },
  want: { label: 'อยากได้', ratio: 0.3, color: '#f57c00' },
  save: { label: 'ออม', ratio: 0.2, color: '#1565c0' },
};

// ---------- สถานะ ----------
let userId = null;
let scenario = null;
let items = [];
let index = 0;
let buckets = { need: 0, want: 0, save: 0 };
let correctCount = 0;

// ---------- Auth ----------
onAuthStateChanged(auth, async (user) => {
  if (user) {
    userId = user.uid;
  } else {
    try {
      const anon = await signInAnonymously(auth);
      userId = anon.user.uid;
    } catch (e) {
      console.warn('ล็อกอินแบบไม่ระบุตัวตนไม่สำเร็จ (เล่นได้แต่ไม่บันทึก XP):', e.code || e.message);
    }
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
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function baht(n) { return '฿' + Number(n).toLocaleString('th-TH'); }
function target(cat) { return scenario.income * CATS[cat].ratio; }

// ---------- เริ่มเกม ----------
function startGame() {
  scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
  items = shuffle(scenario.items.slice());
  index = 0;
  buckets = { need: 0, want: 0, save: 0 };
  correctCount = 0;
  hideModal();

  const incomeEl = document.getElementById('income');
  if (incomeEl) incomeEl.textContent = baht(scenario.income);

  ['need', 'want', 'save'].forEach((c) => {
    const tEl = document.getElementById(c + 'Target');
    if (tEl) tEl.textContent = baht(target(c));
  });

  updateBuckets();
  showItem();
}

function showItem() {
  const nameEl = document.getElementById('itemName');
  const amtEl = document.getElementById('itemAmount');
  const iconEl = document.getElementById('itemIcon');
  const progEl = document.getElementById('progressText');
  const btnRow = document.getElementById('catButtons');

  if (index >= items.length) {
    endGame();
    return;
  }
  const it = items[index];
  if (iconEl) iconEl.textContent = it.icon || '💸';
  if (nameEl) nameEl.textContent = it.name;
  if (amtEl) amtEl.textContent = baht(it.amount);
  if (progEl) progEl.textContent = 'รายการ ' + (index + 1) + '/' + items.length;
  if (btnRow) btnRow.style.visibility = 'visible';
}

function updateBuckets() {
  ['need', 'want', 'save'].forEach((c) => {
    const totEl = document.getElementById(c + 'Total');
    const barEl = document.getElementById(c + 'Bar');
    if (totEl) totEl.textContent = baht(buckets[c]);
    if (barEl) {
      const pct = Math.min(100, buckets[c] / target(c) * 100);
      barEl.style.width = pct + '%';
    }
  });
}

// เลือกหมวดให้รายการปัจจุบัน (เรียกจากปุ่ม inline)
window.assign = function (cat) {
  if (index >= items.length) return;
  const it = items[index];
  buckets[cat] += it.amount;
  if (cat === it.cat) correctCount++;
  index++;
  updateBuckets();
  showItem();
};

async function endGame() {
  const btnRow = document.getElementById('catButtons');
  if (btnRow) btnRow.style.visibility = 'hidden';

  const total = items.length;
  const allCorrect = correctCount === total;
  const score = correctCount * 10 + (allCorrect ? 50 : 0);
  let xpGain = Math.floor(80 * (correctCount / total)) + (allCorrect ? 20 : 0);

  const result = userId ? await addXp(userId, xpGain) : { gained: 0, levelUp: false };
  if (userId) markDailyMission('budget');   // ภารกิจประจำวัน: เล่นเกมจัดงบ
  refreshXpDisplay();

  // สรุปแต่ละถังเทียบเป้า
  let rows = ['need', 'want', 'save'].map((c) => {
    const hit = Math.abs(buckets[c] - target(c)) < 1;
    return '<div class="sum-row">' +
      '<span>' + CATS[c].label + ' (' + (CATS[c].ratio * 100) + '%)</span>' +
      '<span>' + baht(buckets[c]) + ' / ' + baht(target(c)) + ' ' + (hit ? '✅' : '❌') + '</span>' +
      '</div>';
  }).join('');

  const headline = allCorrect
    ? '🎉 เยี่ยมมาก! จัดงบ 50/30/20 ได้เป๊ะ!'
    : (correctCount >= total * 0.7 ? '👍 เก่งมาก! ใกล้เคียงแล้ว' : '💪 ลองใหม่นะ ค่อย ๆ ฝึก');

  let msg = '<h2 style="margin:0 0 6px;color:#1F8F4E;">' + headline + '</h2>' +
    '<p style="margin:4px 0;">จัดถูก <b>' + correctCount + '/' + total + '</b> รายการ · คะแนน <b>' + score + '</b></p>' +
    '<div class="sum-box">' + rows + '</div>';
  if (result.gained > 0) msg += '<div class="exp-gain">+' + result.gained + ' XP</div>';
  if (result.levelUp) msg += '<div class="level-up">🎊 Level Up! Level ' + result.newLevel + '</div>';
  msg += '<p class="tip">💡 กฎ 50/30/20: ใช้จ่ายจำเป็นไม่เกินครึ่ง เหลือออมอย่างน้อย 20%</p>';

  // 🎉 ฉลองเมื่อทำได้ดี
  if (correctCount >= total * 0.7 && window.mskConfetti) {
    window.mskConfetti({ count: allCorrect ? 150 : 100 });
  }

  showModal(msg,
    '<button class="modal-btn" onclick="startBudgetGame()">เล่นอีกครั้ง</button>' +
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

// ---------- expose (module scope) ----------
window.startBudgetGame = startGame;
window.goToGameMenu = function () { location.href = 'game.html'; };

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startGame);
} else {
  startGame();
}
