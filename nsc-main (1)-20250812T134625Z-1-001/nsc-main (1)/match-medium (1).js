// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBjLBl1sEGgQLyng51rW25b434bJ0opVc4",
    authDomain: "myapplication-bd04c034.firebaseapp.com",
    databaseURL: "https://myapplication-bd04c034-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "myapplication-bd04c034",
    storageBucket: "myapplication-bd04c034.firebasestorage.app",
    messagingSenderId: "49782830313",
    appId: "1:49782830313:web:c81b5d86a937f22d296c78"
};

// Initialize Firebase
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const firestore = firebase.firestore(); // ใช้ Firestore
const auth = firebase.auth();
let userId = null;

// Authentication
auth.onAuthStateChanged(async (user) => {
    if (user) {
        userId = user.uid;
    } else {
        try {
            const anonymousUser = await auth.signInAnonymously();
            userId = anonymousUser.user.uid;
        } catch (error) {
            console.error("Anonymous sign-in failed", error);
        }
    }
    loadPlayerData();
});

// EXP System
let playerData = {
    level: 1,
    exp: 0,
    xp: 0 // รวมเป็น xp
};

// Configuration for levels, names, and XP requirements (จาก dashboard.js)
const LEVEL_CONFIG = [
    { level: 1, name: "ผู้เริ่มต้น", xpToNext: 100 },
    { level: 2, name: "นักออมฝึกหัด", xpToNext: 250 },
    { level: 3, name: "นักสะสมเหรียญ", xpToNext: 500 },
    { level: 4, name: "ผู้เชี่ยวชาญการเงิน", xpToNext: 1000 },
    { level: 5, name: "เศรษฐีหน้าใหม่", xpToNext: Infinity }, // Max level
];

// Load player data from Firestore
async function loadPlayerData() {
    if (!userId) return;
    try {
        const userRef = firestore.collection('users').doc(userId);
        const doc = await userRef.get();
        if (doc.exists) {
            const data = doc.data();
            playerData.xp = data.xp || 0;
            playerData.level = data.level || 1;
        } else {
            await userRef.set({
                xp: 0,
                level: 1,
                nextLevelXP: LEVEL_CONFIG[0].xpToNext,
                displayName: auth.currentUser.displayName || "ผู้เล่นใหม่",
                coins: 0,
                badges: [],
                inventory: []
            }, { merge: true });
            playerData.xp = 0;
            playerData.level = 1;
        }
        updateExpDisplay();
    } catch (error) {
        console.error("Error loading player data from Firestore:", error);
    }
}

function getExpToNextLevel(level) {
    const levelInfo = LEVEL_CONFIG.find(l => l.level === level);
    return levelInfo ? levelInfo.xpToNext : Infinity;
}

function updateExpDisplay() {
    const playerLevelEl = document.getElementById('playerLevel');
    const playerExpEl = document.getElementById('playerExp');
    const expToNextEl = document.getElementById('expToNext');
    const expFillEl = document.getElementById('expFill');
    if (playerLevelEl && playerExpEl && expToNextEl && expFillEl) {
        const expToNext = getExpToNextLevel(playerData.level);
        const expProgress = expToNext > 0 && expToNext !== Infinity ? (playerData.xp / expToNext * 100) : 100;
        playerLevelEl.textContent = playerData.level;
        playerExpEl.textContent = playerData.xp;
        expToNextEl.textContent = expToNext === Infinity ? 'MAX' : expToNext;
        expFillEl.style.width = expProgress + '%';
    }
}

async function addExp(expAmount) {
    if (!userId || expAmount <= 0) return { gained: 0, levelUp: false, newLevel: playerData.level };

    let levelUpOccurred = false;
    let newCalculatedLevel = playerData.level;

    try {
        const userRef = firestore.collection('users').doc(userId);
        await firestore.runTransaction(async (transaction) => {
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists()) throw new Error("User document not found during transaction.");
            
            const userData = userSnap.data();
            let xp = userData.xp || 0;
            let level = userData.level || 1;
            let nextLevelXP = userData.nextLevelXP || LEVEL_CONFIG[0].xpToNext;
            let totalCoinReward = 0;
            let leveledUpMessages = [];

            xp += expAmount;

            while (xp >= nextLevelXP && nextLevelXP !== Infinity) {
                const currentLevelIndex = LEVEL_CONFIG.findIndex(l => l.level === level);
                if (currentLevelIndex < LEVEL_CONFIG.length - 1) {
                    const nextLevelInfo = LEVEL_CONFIG[currentLevelIndex + 1];
                    const rewardForThisLevel = 100 + (nextLevelInfo.level * 25);
                    totalCoinReward += rewardForThisLevel;
                    xp -= nextLevelXP;
                    level = nextLevelInfo.level;
                    nextLevelXP = nextLevelInfo.xpToNext;
                    leveledUpMessages.push({
                        level: nextLevelInfo.level,
                        name: nextLevelInfo.name,
                        reward: rewardForThisLevel
                    });
                } else {
                    break;
                }
            }
            
            if (level > newCalculatedLevel) {
                levelUpOccurred = true;
                newCalculatedLevel = level;
            }

            const finalUpdateData = {
                xp: xp,
                level: level,
                nextLevelXP: nextLevelXP,
            };
            if (totalCoinReward > 0) {
                finalUpdateData.coins = firebase.firestore.FieldValue.increment(totalCoinReward);
            }
            
            transaction.update(userRef, finalUpdateData);

            playerData.xp = xp;
            playerData.level = level;

            for (const msg of leveledUpMessages) {
                showModal(`🎉 ยินดีด้วย! คุณเลเวลอัพเป็น Level ${msg.level} – ${msg.name}!\nได้รับ ${msg.reward} เหรียญ!`);
                await new Promise(resolve => setTimeout(resolve, 500)); 
            }
        });

        updateExpDisplay();
        return { gained: expAmount, levelUp: levelUpOccurred, newLevel: newCalculatedLevel };

    } catch (error) {
        console.error("addExp: Error in Firestore transaction:", error);
        return { gained: 0, levelUp: false, newLevel: playerData.level };
    }
}

// Medium level financial terms
const pairs = [
  {q:"ดอกเบี้ยทบต้น", a:"ดอกเบี้ยที่คำนวณบนเงินต้นและดอกเบี้ยสะสม"},
  {q:"งบกระแสเงินสด", a:"บันทึกการรับจ่ายเงินสดของธุรกิจ"},
  {q:"ลงทุนในกองทุนรวม", a:"ฝากเงินรวมกับคนอื่นเพื่อกระจายความเสี่ยง"},
  {q:"หนี้ดี", a:"หนี้ที่ใช้เพิ่มรายได้ เช่น กู้เพื่อการศึกษา"},
  {q:"บัตรกดเงินสด", a:"บัตรที่ใช้เบิกถอนเงินสดได้"},
  {q:"กองทุนสำรองเลี้ยงชีพ", a:"เงินสะสมเพื่อใช้หลังเกษียณ"},
  {q:"เงินฉุกเฉิน", a:"เงินสำรองที่ใช้จ่ายเมื่อเกิดเหตุการณ์ไม่คาดคิด"},
  {q:"สัญญากู้ยืมเงิน", a:"เอกสารยืนยันการยืมเงิน"},
  {q:"ประกันสุขภาพ", a:"ความคุ้มครองค่ารักษาพยาบาล"},
  {q:"วางแผนเกษียณ", a:"เตรียมเงินไว้ใช้หลังหยุดทำงาน"},
  {q:"สลากออมทรัพย์", a:"ฝากเงินพร้อมลุ้นรางวัล"},
  {q:"การจัดพอร์ต", a:"แบ่งสัดส่วนเงินลงทุนในสินทรัพย์ต่าง ๆ"}
];

// Game state variables
let score=0, timeLeft=90, timerInterval=null;
let cards=[], selected=[], matchedCount=0, locked=false, triedWrong={};
let lastUsedIdxs = [];

function shuffle(arr) {
  for(let i=arr.length-1;i>0;i--) {
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]] = [arr[j],arr[i]];
  }
  return arr;
}

function getNewQuestionSet() {
  let idxs = shuffle([...Array(pairs.length).keys()]);
  if (lastUsedIdxs.length > 0 && JSON.stringify(idxs.slice(0, 12)) === JSON.stringify(lastUsedIdxs)) {
    idxs = shuffle(idxs);
  }
  lastUsedIdxs = idxs.slice(0, 12); // 12 pairs for medium
  return lastUsedIdxs;
}

function startGame() {
  score=0; matchedCount=0; selected=[]; locked=false; timeLeft=90; triedWrong={};
  document.getElementById("score").textContent = score;
  document.getElementById("resultBox").innerHTML = '';
  hideModal();
  cards = [];
  let used = getNewQuestionSet();
  let all = [];
  used.forEach(i=>{
    all.push({id:i, text:pairs[i].q, pair:"q", correct:false});
    all.push({id:i, text:pairs[i].a, pair:"a", correct:false});
  });
  cards = shuffle(all);
  renderCards();
  clearInterval(timerInterval);
  document.getElementById("timer").textContent = timeLeft;
  timerInterval = setInterval(()=>{
    timeLeft--;
    document.getElementById("timer").textContent = timeLeft;
    if(timeLeft<=0) endGame(false);
  },1000);
}

function renderCards() {
  const gameBoard = document.getElementById("gameBoard");
  gameBoard.innerHTML =
    cards.map((c,idx)=>
      `<div class="card${c.correct?' correct':''}${isSelected(idx)?' flipped':''}${c.justReleased?' released':''}" onclick="selectCard(${idx})" id="card${idx}">${!c.correct ? c.text : ""}</div>`
    ).join('');
    // Removed JavaScript logic for setting gridTemplateColumns
    // This is now handled by CSS classes (card-board-easy, card-board-medium, card-board-hard)
}

function isSelected(idx) {
  return selected.includes(idx);
}

window.selectCard = function(idx){
  if(locked || cards[idx].correct || selected.includes(idx)) return;
  selected.push(idx);
  renderCards();
  setTimeout(() => {
    const cardEl = document.getElementById("card"+idx);
    if(cardEl){
      cardEl.classList.add("released");
      setTimeout(()=> cardEl.classList.remove("released"), 190);
    }
  }, 90);

  if(selected.length===2){
    locked=true;
    const [i1,i2]=selected;
    if(cards[i1].id===cards[i2].id && cards[i1].pair!==cards[i2].pair){
      score+=15;
      cards[i1].correct=true; cards[i2].correct=true;
      matchedCount++;
      setTimeout(()=>{
        selected=[];
        renderCards();
        document.getElementById("score").textContent = score;
        locked=false;
        if(matchedCount===12) endGame(true);
      },410);
    }else{
      score = Math.max(0, score - 5);
      triedWrong[cards[i1].id]=true;
      triedWrong[cards[i2].id]=true;
      const card1El = document.getElementById("card"+i1);
      const card2El = document.getElementById("card"+i2);
      if(card1El) card1El.classList.add('wrong');
      if(card2El) card2El.classList.add('wrong');
      setTimeout(()=>{
        selected=[];
        renderCards();
        document.getElementById("score").textContent = score;
        locked=false;
      },340);
    }
  }
}

async function endGame(win){ // ทำฟังก์ชัน endGame เป็น async
  clearInterval(timerInterval);
  
  let expGained = 0;
  const perfectScore = 12 * 15;
  if (win) {
    const expPercentage = Math.min(score / perfectScore, 1);
    expGained = Math.floor(200 * expPercentage); // Max 200 EXP for medium
  } else {
    expGained = Math.floor(score * 0.75);
  }
  
  expGained = Math.max(expGained, 0);
  const expResult = await addExp(expGained); // เรียก addExp และรอผลลัพธ์
  
  let message = win
    ? `🎉 เก่งมาก!<br>จับคู่ครบ <br><span style='color:#159988;font-size:1.3em;font-weight:700;'>${score} คะแนน</span><br>`
    : `หมดเวลา! <br><span style='color:#b71c1c;font-size:1.2em;font-weight:700;'>${score} คะแนน</span><br>`;
  
  if (expResult.gained > 0) {
    message += `<div class="exp-gain">+${expResult.gained} EXP</div>`;
  }
  
  if (expResult.levelUp) {
    message += `<div class="level-up">🎊 Level Up! Level ${expResult.newLevel}</div>`;
  }
  
  showModal(
    message,
    `<button class="modal-btn" onclick="nextQuestionSet()">ด่านต่อไป (ยาก)</button>
     <button class="modal-btn" onclick="startGame()">เล่นใหม่</button>`
  );
}

function showModal(msg, btns) {
    document.getElementById('modalContent').innerHTML = msg + (btns || '');
    document.getElementById('modalOverlay').style.display = "flex";
}

function hideModal() {
    document.getElementById('modalOverlay').style.display = "none";
}

function nextQuestionSet() {
  window.location.href = 'match-hard.html';
}

// Initial game load
loadPlayerData();
startGame();
