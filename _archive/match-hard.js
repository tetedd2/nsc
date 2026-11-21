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

// EXP System variables
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

// Update the EXP bar and text on the screen
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

// Add EXP and handle level ups
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


// Hard level financial terms
const pairs = [
  {q:"ภาษีมูลค่าเพิ่ม (VAT)", a:"ภาษีที่เก็บเมื่อซื้อขายสินค้า/บริการ"},
  {q:"เงินเฟ้อ", a:"ราคาสินค้าบริการปรับสูงขึ้น"},
  {q:"เงินฝืด", a:"ราคาสินค้าบริการลดลงต่อเนื่อง"},
  {q:"กองทุนรวม", a:"ลงทุนรวมกับผู้อื่นผ่านมืออาชีพ"},
  {q:"หุ้นสามัญ", a:"หลักทรัพย์ที่ให้สิทธิเป็นเจ้าของบริษัท"},
  {q:"พันธบัตรรัฐบาล", a:"การกู้ยืมเงินของรัฐจากประชาชน"},
  {q:"กู้ยืมเพื่อซื้อบ้าน", a:"ขอสินเชื่อเพื่อซื้ออสังหาริมทรัพย์"},
  {q:"เงินฝากประจำ", a:"เงินฝากที่ถอนได้เมื่อครบกำหนด"},
  {q:"ค่าธรรมเนียม", a:"ค่าใช้จ่ายในการทำธุรกรรมต่าง ๆ"},
  {q:"เงินประกันสังคม", a:"ระบบเงินสะสมเพื่อดูแลสุขภาพ/ชราภาพ"},
  {q:"การออมแบบ DCA", a:"ลงทุนเป็นงวด ๆ ในจำนวนเงินเท่ากัน"},
  {q:"การกระจายความเสี่ยง", a:"ลงทุนหลายสินทรัพย์เพื่อลดความเสี่ยง"},
  {q:"หลักประกันเงินกู้", a:"ทรัพย์สินที่ใช้ค้ำประกันการกู้ยืม"},
  {q:"อัตราดอกเบี้ยลอยตัว", a:"ดอกเบี้ยที่ปรับเปลี่ยนตามตลาด"},
  {q:"รีไฟแนนซ์", a:"เปลี่ยนเจ้าหนี้ใหม่เพื่อลดดอกเบี้ย"},
  {q:"ตลาดหลักทรัพย์", a:"สถานที่ซื้อขายหุ้นและตราสาร"},
  {q:"ตราสารหนี้", a:"เอกสารแสดงสิทธิในการเป็นเจ้าหนี้"},
  {q:"กำไรต่อหุ้น (EPS)", a:"ผลกำไรสุทธิต่อหุ้นสามัญ"},
  {q:"มูลค่าตามบัญชี", a:"มูลค่าทางบัญชีของบริษัท"},
  {q:"หุ้นกู้", a:"ตราสารหนี้ที่บริษัทเอกชนออกให้ผู้ลงทุน"}
];

// Game state variables
let score=0, timeLeft=60, timerInterval=null; // <-- แก้ไขเวลาตรงนี้
let cards=[], selected=[], matchedCount=0, locked=false, triedWrong={};
let lastUsedIdxs = [];

// Function to shuffle an array
function shuffle(arr) {
    for(let i=arr.length-1;i>0;i--) {
        const j = Math.floor(Math.random()*(i+1));
        [arr[i],arr[j]] = [arr[j],arr[i]];
    }
    return arr;
}

// Get a new set of 14 random pairs for the game board
function getNewQuestionSet() {
    let idxs = shuffle([...Array(pairs.length).keys()]);
    if (lastUsedIdxs.length > 0 && JSON.stringify(idxs.slice(0, 14)) === JSON.stringify(lastUsedIdxs)) {
        idxs = shuffle(idxs);
    }
    lastUsedIdxs = idxs.slice(0, 14);
    return lastUsedIdxs;
}

// Initialize or restart the game
function startGame() {
    score=0; matchedCount=0; selected=[]; locked=false; timeLeft=60; triedWrong={}; // <-- แก้ไขเวลาตรงนี้
    document.getElementById("score").textContent = score;
    document.getElementById("resultBox").textContent = '';
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

// Render cards to the DOM
function renderCards() {
    document.getElementById("gameBoard").innerHTML =
        cards.map((c,idx)=>
            `<div class="card${c.correct?' correct':''}${isSelected(idx)?' flipped':''}${c.justReleased?' released':''}" onclick="selectCard(${idx})" id="card${idx}">${!c.correct ? c.text : ""}</div>`
        ).join('');
}

// Check if a card at a given index is selected
function isSelected(idx) {
    return selected.includes(idx);
}

// Handle card click event
window.selectCard = function(idx){
    if(locked || cards[idx].correct || selected.includes(idx)) return;
    selected.push(idx);
    renderCards();
    setTimeout(() => {
        const cardEl = document.getElementById("card"+idx);
        if(cardEl) {
            cardEl.classList.add("released");
            setTimeout(()=> cardEl.classList.remove("released"), 190);
        }
    }, 90);

    if(selected.length===2){
        locked=true;
        const [i1,i2]=selected;
        if(cards[i1].id===cards[i2].id && cards[i1].pair!==cards[i2].pair){
            score += triedWrong[cards[i1].id] ? 10 : 20;
            cards[i1].correct=true; cards[i2].correct=true;
            matchedCount++;
            setTimeout(()=>{
                selected=[];
                renderCards();
                document.getElementById("score").textContent = score;
                locked=false;
                if(matchedCount===14) endGame(true);
            },410);
        }else{
            score = Math.max(0, score - 7);
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

// Handle end of the game
async function endGame(win){ // ทำฟังก์ชัน endGame เป็น async
    clearInterval(timerInterval);
    
    let expGained = 0;
    const perfectScore = 14 * 20;
    if (win) {
        const expPercentage = Math.min(score / perfectScore, 1);
        expGained = Math.floor(300 * expPercentage);
    } else {
        expGained = Math.floor(score * 1.0);
    }
    
    expGained = Math.max(expGained, 0);
    const expResult = await addExp(expGained); // เรียก addExp และรอผลลัพธ์
    
    let message = win
        ? `🎉 ยอดเยี่ยม!<br>จับคู่ครบ <br><span style='color:#159988;font-size:1.3em;font-weight:700;'>${score} คะแนน</span><br>`
        : `หมดเวลา! <br><span style='color:#b71c1c;font-size:1.2em;font-weight:700;'>${score} คะแนน</span><br>`;
    
    if (expResult.gained > 0) {
        message += `<div class="exp-gain">+${expResult.gained} EXP</div>`;
    }
    
    if (expResult.levelUp) {
        message += `<div class="level-up">🎊 Level Up! Level ${expResult.newLevel}</div>`;
    }
    
    showModal(
        message,
        `<button class="modal-btn" onclick="goToGameMenu()">กลับเมนูเกม</button>
         <button class="modal-btn" onclick="startGame()">เล่นใหม่อีกครั้ง</button>`
    );
}

// Show the result modal
function showModal(msg, btns) {
    document.getElementById('modalContent').innerHTML = msg + (btns || '');
    document.getElementById('modalOverlay').style.display = "flex";
}

// Hide the result modal
function hideModal() {
    document.getElementById('modalOverlay').style.display = "none";
}

// Function to go back to the main game menu
function goToGameMenu() {
    window.location.href = 'game.html';
}

// Initial game load
loadPlayerData();
startGame();
