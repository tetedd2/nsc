/* =============================================================
 *  เกมจับคู่การเงิน — Engine เดียว รองรับ 3 ระดับ (easy/medium/hard)
 *  เลือกระดับผ่าน query: match.html?level=easy | medium | hard
 *  ใช้ Firebase modular ผ่าน js/firebase-init.js (เวอร์ชันเดียวทั้งแอป)
 *  ระบบ XP/Level ใช้ LEVEL_CONFIG ชุดเดียวกับ dashboard.js
 * ============================================================= */
import {
  auth, db,
  onAuthStateChanged, signInAnonymously,
  doc, getDoc, setDoc, runTransaction, increment,
} from './firebase-init.js';

// ---------- ระบบเลเวล (ชุดเดียวกับ dashboard.js) ----------
const LEVEL_CONFIG = [
  { level: 1, name: 'ผู้เริ่มต้น', xpToNext: 100 },
  { level: 2, name: 'นักออมฝึกหัด', xpToNext: 250 },
  { level: 3, name: 'นักสะสมเหรียญ', xpToNext: 500 },
  { level: 4, name: 'ผู้เชี่ยวชาญการเงิน', xpToNext: 1000 },
  { level: 5, name: 'เศรษฐีหน้าใหม่', xpToNext: Infinity },
];
function getExpToNextLevel(level) {
  var info = LEVEL_CONFIG.find(function (l) { return l.level === level; });
  return info ? info.xpToNext : Infinity;
}

// ---------- คำศัพท์การเงินแยกตามระดับ ----------
var WORDS = {
  easy: [
    { q: 'เงินออม', a: 'เงินที่เก็บไว้ใช้ในอนาคต' },
    { q: 'รายรับ', a: 'เงินที่ได้เข้ามา' },
    { q: 'รายจ่าย', a: 'เงินที่ต้องจ่ายออก' },
    { q: 'สินทรัพย์', a: 'ของมีค่า/เงินฝาก' },
    { q: 'หนี้สิน', a: 'เงินที่ต้องใช้คืน' },
    { q: 'งบประมาณ', a: 'แผนการใช้เงิน' },
    { q: 'การลงทุน', a: 'นำเงินไปต่อยอด' },
    { q: 'บัตรเครดิต', a: 'บัตรใช้จ่ายแทนเงินสด' },
    { q: 'ดอกเบี้ย', a: 'เงินเพิ่มที่จ่าย/รับจากการยืม' },
    { q: 'ประกันชีวิต', a: 'คุ้มครองเงิน/ชีวิต' },
    { q: 'เงินปันผล', a: 'ส่วนแบ่งกำไรจากหุ้น' },
    { q: 'ค่าครองชีพ', a: 'ค่าใช้จ่ายในการดำรงชีวิต' },
    { q: 'อสังหาริมทรัพย์', a: 'ที่ดินและสิ่งปลูกสร้าง' },
    { q: 'สภาพคล่อง', a: 'ความง่ายในการเปลี่ยนเป็นเงินสด' },
    { q: 'เครดิตบูโร', a: 'ประวัติการชำระหนี้' },
    { q: 'เงินกู้', a: 'เงินที่ยืมและต้องคืน' },
    { q: 'งบดุล', a: 'สรุปสินทรัพย์และหนี้สิน' },
    { q: 'เงินเดือน', a: 'รายได้จากการทำงานประจำ' },
    { q: 'ผลตอบแทน', a: 'กำไรที่ได้รับจากการลงทุน' },
    { q: 'เบี้ยประกัน', a: 'ค่าใช้จ่ายในการซื้อประกัน' },
  ],
  medium: [
    { q: 'ดอกเบี้ยทบต้น', a: 'ดอกเบี้ยที่คำนวณบนเงินต้นและดอกเบี้ยสะสม' },
    { q: 'งบกระแสเงินสด', a: 'บันทึกการรับจ่ายเงินสดของธุรกิจ' },
    { q: 'ลงทุนในกองทุนรวม', a: 'ฝากเงินรวมกับคนอื่นเพื่อกระจายความเสี่ยง' },
    { q: 'หนี้ดี', a: 'หนี้ที่ใช้เพิ่มรายได้ เช่น กู้เพื่อการศึกษา' },
    { q: 'บัตรกดเงินสด', a: 'บัตรที่ใช้เบิกถอนเงินสดได้' },
    { q: 'กองทุนสำรองเลี้ยงชีพ', a: 'เงินสะสมเพื่อใช้หลังเกษียณ' },
    { q: 'เงินฉุกเฉิน', a: 'เงินสำรองที่ใช้จ่ายเมื่อเกิดเหตุการณ์ไม่คาดคิด' },
    { q: 'สัญญากู้ยืมเงิน', a: 'เอกสารยืนยันการยืมเงิน' },
    { q: 'ประกันสุขภาพ', a: 'ความคุ้มครองค่ารักษาพยาบาล' },
    { q: 'วางแผนเกษียณ', a: 'เตรียมเงินไว้ใช้หลังหยุดทำงาน' },
    { q: 'สลากออมทรัพย์', a: 'ฝากเงินพร้อมลุ้นรางวัล' },
    { q: 'การจัดพอร์ต', a: 'แบ่งสัดส่วนเงินลงทุนในสินทรัพย์ต่าง ๆ' },
  ],
  hard: [
    { q: 'ภาษีมูลค่าเพิ่ม (VAT)', a: 'ภาษีที่เก็บเมื่อซื้อขายสินค้า/บริการ' },
    { q: 'เงินเฟ้อ', a: 'ราคาสินค้าบริการปรับสูงขึ้น' },
    { q: 'เงินฝืด', a: 'ราคาสินค้าบริการลดลงต่อเนื่อง' },
    { q: 'กองทุนรวม', a: 'ลงทุนรวมกับผู้อื่นผ่านมืออาชีพ' },
    { q: 'หุ้นสามัญ', a: 'หลักทรัพย์ที่ให้สิทธิเป็นเจ้าของบริษัท' },
    { q: 'พันธบัตรรัฐบาล', a: 'การกู้ยืมเงินของรัฐจากประชาชน' },
    { q: 'กู้ยืมเพื่อซื้อบ้าน', a: 'ขอสินเชื่อเพื่อซื้ออสังหาริมทรัพย์' },
    { q: 'เงินฝากประจำ', a: 'เงินฝากที่ถอนได้เมื่อครบกำหนด' },
    { q: 'ค่าธรรมเนียม', a: 'ค่าใช้จ่ายในการทำธุรกรรมต่าง ๆ' },
    { q: 'เงินประกันสังคม', a: 'ระบบเงินสะสมเพื่อดูแลสุขภาพ/ชราภาพ' },
    { q: 'การออมแบบ DCA', a: 'ลงทุนเป็นงวด ๆ ในจำนวนเงินเท่ากัน' },
    { q: 'การกระจายความเสี่ยง', a: 'ลงทุนหลายสินทรัพย์เพื่อลดความเสี่ยง' },
    { q: 'หลักประกันเงินกู้', a: 'ทรัพย์สินที่ใช้ค้ำประกันการกู้ยืม' },
    { q: 'อัตราดอกเบี้ยลอยตัว', a: 'ดอกเบี้ยที่ปรับเปลี่ยนตามตลาด' },
    { q: 'รีไฟแนนซ์', a: 'เปลี่ยนเจ้าหนี้ใหม่เพื่อลดดอกเบี้ย' },
    { q: 'ตลาดหลักทรัพย์', a: 'สถานที่ซื้อขายหุ้นและตราสาร' },
    { q: 'ตราสารหนี้', a: 'เอกสารแสดงสิทธิในการเป็นเจ้าหนี้' },
    { q: 'กำไรต่อหุ้น (EPS)', a: 'ผลกำไรสุทธิต่อหุ้นสามัญ' },
    { q: 'มูลค่าตามบัญชี', a: 'มูลค่าทางบัญชีของบริษัท' },
    { q: 'หุ้นกู้', a: 'ตราสารหนี้ที่บริษัทเอกชนออกให้ผู้ลงทุน' },
  ],
};

// ---------- config แต่ละระดับ ----------
var LEVELS = {
  easy: {
    title: 'ระดับง่าย', subtitle: 'จับคู่คำกับความหมายให้ไว!',
    time: 120, pairCount: 10, correctPts: 15, wrongPenalty: 5, firstTryBonus: false,
    expCap: 100, loseMult: 0.5, next: 'medium',
  },
  medium: {
    title: 'ระดับปานกลาง', subtitle: 'จับคู่ศัพท์-ความหมาย-สถานการณ์การเงิน',
    time: 90, pairCount: 12, correctPts: 15, wrongPenalty: 5, firstTryBonus: false,
    expCap: 200, loseMult: 0.75, next: 'hard',
  },
  hard: {
    title: 'ระดับยาก', subtitle: 'จับคู่คำศัพท์การเงินขั้นสูงให้ถูกต้อง!',
    time: 60, pairCount: 14, correctPts: 20, wrongPenalty: 7, firstTryBonus: true,
    expCap: 300, loseMult: 1.0, next: null,
  },
};

// ---------- อ่านระดับจาก URL ----------
var levelKey = (new URLSearchParams(location.search).get('level') || 'easy').toLowerCase();
if (!LEVELS[levelKey]) levelKey = 'easy';
var CFG = LEVELS[levelKey];
var pairs = WORDS[levelKey];

// ---------- สถานะผู้เล่น & เกม ----------
var userId = null;
var playerData = { level: 1, exp: 0, xp: 0 };
var score = 0, timeLeft = CFG.time, timerInterval = null;
var cards = [], selected = [], matchedCount = 0, locked = false, triedWrong = {};
var lastUsedIdxs = [];

// ---------- Auth ----------
onAuthStateChanged(auth, async function (user) {
  if (user) {
    userId = user.uid;
  } else {
    try {
      var anon = await signInAnonymously(auth);
      userId = anon.user.uid;
    } catch (e) {
      console.warn('ล็อกอินแบบไม่ระบุตัวตนไม่สำเร็จ (เล่นได้แต่ไม่บันทึก XP):', e.code || e.message);
    }
  }
  loadPlayerData();
});

// ---------- โหลด/บันทึกข้อมูลผู้เล่น ----------
async function loadPlayerData() {
  if (!userId) return;
  try {
    var userRef = doc(db, 'users', userId);
    var snap = await getDoc(userRef);
    if (snap.exists()) {
      var data = snap.data();
      playerData.xp = data.xp || 0;
      playerData.level = data.level || 1;
    } else {
      // ผู้เล่นใหม่ (เช่น anonymous) สร้างเอกสารเริ่มต้น
      await setDoc(userRef, {
        xp: 0, level: 1, nextLevelXP: LEVEL_CONFIG[0].xpToNext,
        displayName: (auth.currentUser && auth.currentUser.displayName) || 'ผู้เล่นใหม่',
        coins: 0, badges: [], inventory: [],
      }, { merge: true });
      playerData.xp = 0;
      playerData.level = 1;
    }
    updateExpDisplay();
  } catch (e) {
    console.error('โหลดข้อมูลผู้เล่นไม่สำเร็จ:', e);
  }
}

function updateExpDisplay() {
  var lv = document.getElementById('playerLevel');
  var ex = document.getElementById('playerExp');
  var nx = document.getElementById('expToNext');
  var fill = document.getElementById('expFill');
  if (!(lv && ex && nx && fill)) return;
  var expToNext = getExpToNextLevel(playerData.level);
  var progress = (expToNext > 0 && expToNext !== Infinity) ? (playerData.xp / expToNext * 100) : 100;
  lv.textContent = playerData.level;
  ex.textContent = playerData.xp;
  nx.textContent = expToNext === Infinity ? 'MAX' : expToNext;
  fill.style.width = Math.min(100, progress) + '%';
}

// ---------- เพิ่ม XP + เลเวลอัพ (ชุดเดียวกับ dashboard) ----------
async function addExp(expAmount) {
  if (!userId || expAmount <= 0) return { gained: 0, levelUp: false, newLevel: playerData.level };

  var levelUpOccurred = false;
  var newCalculatedLevel = playerData.level;
  var leveledUpMessages = [];

  try {
    var userRef = doc(db, 'users', userId);
    await runTransaction(db, async function (transaction) {
      var userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) throw new Error('ไม่พบเอกสารผู้ใช้ระหว่างทำรายการ');

      var userData = userSnap.data();
      var xp = userData.xp || 0;
      var level = userData.level || 1;
      var nextLevelXP = userData.nextLevelXP || LEVEL_CONFIG[0].xpToNext;
      var totalCoinReward = 0;
      leveledUpMessages = [];

      xp += expAmount;

      while (xp >= nextLevelXP && nextLevelXP !== Infinity) {
        var idx = LEVEL_CONFIG.findIndex(function (l) { return l.level === level; });
        if (idx < LEVEL_CONFIG.length - 1) {
          var nextInfo = LEVEL_CONFIG[idx + 1];
          var reward = 100 + (nextInfo.level * 25);
          totalCoinReward += reward;
          xp -= nextLevelXP;
          level = nextInfo.level;
          nextLevelXP = nextInfo.xpToNext;
          leveledUpMessages.push({ level: nextInfo.level, name: nextInfo.name, reward: reward });
        } else {
          break;
        }
      }

      if (level > newCalculatedLevel) {
        levelUpOccurred = true;
        newCalculatedLevel = level;
      }

      var finalUpdate = { xp: xp, level: level, nextLevelXP: nextLevelXP };
      if (totalCoinReward > 0) finalUpdate.coins = increment(totalCoinReward);
      transaction.update(userRef, finalUpdate);

      playerData.xp = xp;
      playerData.level = level;
    });

    updateExpDisplay();
    return { gained: expAmount, levelUp: levelUpOccurred, newLevel: newCalculatedLevel, levelUps: leveledUpMessages };
  } catch (e) {
    console.error('addExp ผิดพลาด:', e);
    return { gained: 0, levelUp: false, newLevel: playerData.level };
  }
}

// ---------- logic เกม ----------
function shuffle(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

function getNewQuestionSet() {
  var idxs = shuffle(Array.from(Array(pairs.length).keys()));
  if (lastUsedIdxs.length > 0 &&
      JSON.stringify(idxs.slice(0, CFG.pairCount)) === JSON.stringify(lastUsedIdxs)) {
    idxs = shuffle(idxs);
  }
  lastUsedIdxs = idxs.slice(0, CFG.pairCount);
  return lastUsedIdxs;
}

function startGame() {
  score = 0; matchedCount = 0; selected = []; locked = false; triedWrong = {};
  timeLeft = CFG.time;
  document.getElementById('score').textContent = score;
  var rb = document.getElementById('resultBox');
  if (rb) rb.innerHTML = '';
  hideModal();

  var used = getNewQuestionSet();
  var all = [];
  used.forEach(function (i) {
    all.push({ id: i, text: pairs[i].q, pair: 'q', correct: false });
    all.push({ id: i, text: pairs[i].a, pair: 'a', correct: false });
  });
  cards = shuffle(all);
  renderCards();

  clearInterval(timerInterval);
  document.getElementById('timer').textContent = timeLeft;
  timerInterval = setInterval(function () {
    timeLeft--;
    document.getElementById('timer').textContent = timeLeft;
    if (timeLeft <= 0) endGame(false);
  }, 1000);
}

function renderCards() {
  var board = document.getElementById('gameBoard');
  if (!board) return;
  board.innerHTML = cards.map(function (c, idx) {
    var cls = 'card' + (c.correct ? ' correct' : '') + (selected.includes(idx) ? ' flipped' : '');
    var text = c.correct ? '' : c.text;
    return '<div class="' + cls + '" id="card' + idx + '" onclick="selectCard(' + idx + ')">' + text + '</div>';
  }).join('');
}

window.selectCard = function (idx) {
  if (locked || cards[idx].correct || selected.includes(idx)) return;
  selected.push(idx);
  renderCards();
  // เอฟเฟกต์เด้งเล็กน้อยตอนเลือก
  setTimeout(function () {
    var el = document.getElementById('card' + idx);
    if (el) { el.classList.add('released'); setTimeout(function () { el.classList.remove('released'); }, 190); }
  }, 90);

  if (selected.length === 2) {
    locked = true;
    var i1 = selected[0], i2 = selected[1];
    var c1 = cards[i1], c2 = cards[i2];
    if (c1.id === c2.id && c1.pair !== c2.pair) {
      // จับคู่ถูก
      var pts = CFG.correctPts;
      if (CFG.firstTryBonus && triedWrong[c1.id]) pts = Math.floor(CFG.correctPts / 2);
      score += pts;
      cards[i1].correct = true; cards[i2].correct = true;
      matchedCount++;
      setTimeout(function () {
        selected = [];
        renderCards();
        document.getElementById('score').textContent = score;
        locked = false;
        if (matchedCount === CFG.pairCount) endGame(true);
      }, 410);
    } else {
      // จับคู่ผิด
      score = Math.max(0, score - CFG.wrongPenalty);
      triedWrong[c1.id] = true; triedWrong[c2.id] = true;
      var e1 = document.getElementById('card' + i1);
      var e2 = document.getElementById('card' + i2);
      if (e1) e1.classList.add('wrong');
      if (e2) e2.classList.add('wrong');
      setTimeout(function () {
        selected = [];
        renderCards();
        document.getElementById('score').textContent = score;
        locked = false;
      }, 340);
    }
  }
};

async function endGame(win) {
  clearInterval(timerInterval);

  var perfectScore = CFG.pairCount * CFG.correctPts;
  var expGained;
  if (win) {
    expGained = Math.floor(CFG.expCap * Math.min(score / perfectScore, 1));
  } else {
    expGained = Math.floor(score * CFG.loseMult);
  }
  expGained = Math.max(expGained, 0);

  var result = await addExp(expGained);

  var message = win
    ? '🎉 เก่งมาก!<br>จับคู่ครบ <br><span style="color:#1F8F4E;font-size:1.3em;font-weight:700;">' + score + ' คะแนน</span><br>'
    : 'หมดเวลา! <br><span style="color:#b71c1c;font-size:1.2em;font-weight:700;">' + score + ' คะแนน</span><br>';
  if (result.gained > 0) message += '<div class="exp-gain">+' + result.gained + ' EXP</div>';
  if (result.levelUp) message += '<div class="level-up">🎊 Level Up! Level ' + result.newLevel + '</div>';

  // 🎉 ฉลองเมื่อจับคู่ครบทุกคู่
  if (win && window.mskConfetti) {
    window.mskConfetti({ count: (score >= perfectScore * 0.8) ? 150 : 100 });
  }

  var btns;
  if (CFG.next) {
    btns = '<button class="modal-btn" onclick="nextLevel()">ด่านต่อไป (' + LEVELS[CFG.next].title + ')</button>' +
           '<button class="modal-btn" onclick="startMatchGame()">เล่นใหม่</button>';
  } else {
    btns = '<button class="modal-btn" onclick="goToGameMenu()">กลับเมนูเกม</button>' +
           '<button class="modal-btn" onclick="startMatchGame()">เล่นใหม่อีกครั้ง</button>';
  }
  showModal(message, btns);
}

function showModal(msg, btns) {
  var content = document.getElementById('modalContent');
  var overlay = document.getElementById('modalOverlay');
  if (content && overlay) {
    content.innerHTML = msg + '<div class="modal-btn-container">' + (btns || '') + '</div>';
    overlay.style.display = 'flex';
  }
}
function hideModal() {
  var overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.style.display = 'none';
}

// ---------- ปุ่มต่าง ๆ (inline onclick ต้องเป็น global เพราะไฟล์นี้เป็น module) ----------
window.startMatchGame = startGame;
window.nextLevel = function () { location.href = 'match.html?level=' + CFG.next; };
window.goToGameMenu = function () { location.href = 'game.html'; };

// ---------- ตั้งค่าหน้าจอตามระดับ + เริ่มเกม ----------
function initUI() {
  var titleEl = document.getElementById('gameTitle');
  var subEl = document.getElementById('gameSubtitle');
  if (titleEl) titleEl.innerHTML = 'จับคู่การเงิน<br>' + CFG.title;
  if (subEl) subEl.textContent = CFG.subtitle;
  document.title = 'จับคู่การเงิน – ' + CFG.title;
  startGame();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUI);
} else {
  initUI();
}
