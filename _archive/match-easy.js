// --- Firebase Configuration ---
// ใช้ Firebase v9 compat mode เพื่อให้สอดคล้องกับ game.html
const firebaseConfig = {
    apiKey: "AIzaSyBjLBl1sEGgQLyng51rW25b434bJ0opVc4",
    authDomain: "myapplication-bd04c034.firebaseapp.com",
    databaseURL: "https://myapplication-bd04c034-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "myapplication-bd04c034",
    storageBucket: "myapplication-bd04c034.firebasestorage.app",
    messagingSenderId: "49782830313",
    appId: "1:49782830313:web:c81b5d86a937f22d296c78"
};

// --- Initialize Firebase ---
// ตรวจสอบว่า Firebase ถูก initialize แล้วหรือยัง
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const firestore = firebase.firestore();
const auth = firebase.auth();
let userId = null;

// --- Authentication ---
// ตรวจสอบสถานะการล็อกอินของผู้ใช้
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // หากผู้ใช้ล็อกอินอยู่ ให้กำหนด userId
        userId = user.uid;
    } else {
        try {
            // หากผู้ใช้ไม่ได้ล็อกอิน ให้ล็อกอินแบบไม่ระบุตัวตน (anonymous)
            const anonymousUser = await auth.signInAnonymously();
            userId = anonymousUser.user.uid;
        } catch (error) {
            console.error("Anonymous sign-in failed", error);
        }
    }
    // โหลดข้อมูลผู้เล่นหลังจากยืนยันตัวตนแล้ว
    loadPlayerData(); 
});

// --- Player Data & EXP Functions ---
// ข้อมูลผู้เล่นที่เก็บไว้ใน local
let playerData = { level: 1, exp: 0, xp: 0 }; // เปลี่ยน totalExp เป็น xp

// โหลดข้อมูลผู้เล่นจาก Firestore
async function loadPlayerData() {
    if (!userId) return; // หากไม่มี userId ไม่ต้องดำเนินการต่อ
    try {
        const userRef = firestore.collection('users').doc(userId); // อ้างอิงถึงเอกสารผู้ใช้ใน Firestore
        const doc = await userRef.get(); // ดึงข้อมูลเอกสาร
        if (doc.exists) {
            const data = doc.data();
            playerData.xp = data.xp || 0; // ดึง xp (จาก totalExp เดิม)
            // คำนวณ Level และ EXP ปัจจุบันจาก xp
            let tempExp = playerData.xp;
            let level = 1;
            let expToNext = getExpToNextLevel(level);
            while (tempExp >= expToNext) {
                tempExp -= expToNext;
                level++;
                expToNext = getExpToNextLevel(level);
            }
            playerData.level = level;
            playerData.exp = tempExp;
        }
        updateExpDisplay(); // อัปเดตการแสดงผล EXP
    } catch (error) {
        console.error("Error loading player data from Firestore:", error);
    }
}

// ฟังก์ชันสำหรับคำนวณ EXP ที่ต้องการสำหรับ Level ถัดไป
function getExpToNextLevel(level) { return level * 100; }

// ฟังก์ชันสำหรับอัปเดตการแสดงผล EXP และ Level บน UI
function updateExpDisplay() {
    const playerLevelEl = document.getElementById('playerLevel');
    const playerExpEl = document.getElementById('playerExp');
    const expToNextEl = document.getElementById('expToNext');
    const expFillEl = document.getElementById('expFill');

    if (playerLevelEl && playerExpEl && expToNextEl && expFillEl) {
        const expToNext = getExpToNextLevel(playerData.level);
        const expProgress = expToNext > 0 ? (playerData.exp / expToNext * 100) : 0;
        playerLevelEl.textContent = playerData.level;
        playerExpEl.textContent = playerData.exp;
        expToNextEl.textContent = expToNext;
        expFillEl.style.width = expProgress + '%';
    }
}

// ฟังก์ชันสำหรับเพิ่ม EXP ให้ผู้เล่นและจัดการการเลเวลอัพ
async function addExp(expAmount) {
    console.log("addExp: Function called with expAmount:", expAmount); // New log
    if (!userId || expAmount <= 0) {
        console.log("addExp: userId not available or expAmount is 0 or less. userId:", userId, "expAmount:", expAmount); // New log
        return { gained: 0, levelUp: false, newLevel: playerData.level };
    }

    let levelUpOccurred = false;
    let newCalculatedLevel = playerData.level; // เริ่มต้นด้วย Level ปัจจุบันของ local

    try {
        const userRef = firestore.collection('users').doc(userId);
        console.log("addExp: Attempting to update user document:", userId); // New log

        await firestore.runTransaction(async (transaction) => {
            const doc = await transaction.get(userRef);
            console.log("addExp: Document snapshot retrieved for user:", userId, "Exists:", doc.exists); // New log

            let currentXp = doc.data()?.xp || 0; // ดึง xp ปัจจุบัน (จาก totalExp เดิม)
            console.log("addExp: Current XP from Firestore before adding:", currentXp); // New log
            currentXp += expAmount; // เพิ่ม EXP
            console.log("addExp: New XP calculated:", currentXp); // New log

            // คำนวณ Level และ EXP ปัจจุบันจาก xp ใหม่ภายใน Transaction
            let tempExpForLevelCalc = currentXp;
            let levelForCalc = 1;
            let expToNextForCalc = getExpToNextLevel(levelForCalc);
            while (tempExpForLevelCalc >= expToNextForCalc) {
                tempExpForLevelCalc -= expToNextForCalc;
                levelForCalc++;
                expToNextForCalc = getExpToNextLevel(levelForCalc);
            }

            // ตรวจสอบว่ามีการเลเวลอัพเกิดขึ้นหรือไม่
            if (levelForCalc > playerData.level) { 
                levelUpOccurred = true;
                newCalculatedLevel = levelForCalc;
            }

            // อัปเดต xp ใน Firestore
            transaction.update(userRef, {
                xp: currentXp // อัปเดตฟิลด์ xp
            });
            console.log("addExp: Transaction update prepared for xp:", currentXp); // New log

            // อัปเดต playerData ใน local ด้วย xp ใหม่
            playerData.xp = currentXp; // อัปเดตฟิลด์ xp ใน local ด้วย
        });

        // หลังจาก Transaction เสร็จสิ้น ให้โหลดข้อมูลผู้เล่นใหม่จาก Firestore เพื่อให้ข้อมูล local อัปเดตตรงกับ Database และ UI
        await loadPlayerData(); 

        console.log(`Added ${expAmount} EXP to Firestore for user ${userId}. Level up: ${levelUpOccurred}, New Level: ${newCalculatedLevel}`);
        // คืนค่าผลลัพธ์ของการเพิ่ม EXP
        return { gained: expAmount, levelUp: levelUpOccurred, newLevel: newCalculatedLevel };

    } catch (error) {
        // จัดการกรณีที่เอกสารผู้ใช้ไม่พบ (อาจเป็นผู้ใช้ใหม่)
        if (error.code === 'not-found') {
            console.log("addExp: User document not found. Attempting to create a new one."); // New log
            try {
                // สร้างเอกสารผู้ใช้ใหม่พร้อม xp เริ่มต้น
                await firestore.collection('users').doc(userId).set({ xp: expAmount }); // สร้างฟิลด์ xp
                await loadPlayerData(); // โหลดข้อมูลผู้เล่นอีกครั้ง
                return { gained: expAmount, levelUp: false, newLevel: 1 }; // ผู้ใช้ใหม่เริ่มต้นที่ Level 1
            } catch (setError) {
                console.error("addExp: Error setting initial xp for new user:", setError);
                return { gained: 0, levelUp: false, newLevel: playerData.level };
            }
        } else {
            console.error("addExp: Error in addExp transaction:", error);
            return { gained: 0, levelUp: false, newLevel: playerData.level };
        }
    }
}


// --- Word Pairs ---
// คำศัพท์สำหรับเกม
const pairs = [
  {q:"เงินออม", a:"เงินที่เก็บไว้ใช้ในอนาคต"},
  {q:"รายรับ", a:"เงินที่ได้เข้ามา"},
  {q:"รายจ่าย", a:"เงินที่ต้องจ่ายออก"},
  {q:"สินทรัพย์", a:"ของมีค่า/เงินฝาก"},
  {q:"หนี้สิน", a:"เงินที่ต้องใช้คืน"},
  {q:"งบประมาณ", a:"แผนการใช้เงิน"},
  {q:"การลงทุน", a:"นำเงินไปต่อยอด"},
  {q:"บัตรเครดิต", a:"บัตรใช้จ่ายแทนเงินสด"},
  {q:"ดอกเบี้ย", a:"เงินเพิ่มที่จ่าย/รับจากการยืม"},
  {q:"ประกันชีวิต", a:"คุ้มครองเงิน/ชีวิต"},
  // เพิ่มเติมคู่คำศัพท์เพื่อให้มีจำนวนพอสำหรับ 10 คู่
  {q:"เงินปันผล", a:"ส่วนแบ่งกำไรจากหุ้น"},
  {q:"ค่าครองชีพ", a:"ค่าใช้จ่ายในการดำรงชีวิต"},
  {q:"อสังหาริมทรัพย์", a:"ที่ดินและสิ่งปลูกสร้าง"},
  {q:"สภาพคล่อง", a:"ความง่ายในการเปลี่ยนเป็นเงินสด"},
  {q:"เครดิตบูโร", a:"ประวัติการชำระหนี้"},
  {q:"เงินกู้", a:"เงินที่ยืมและต้องคืน"},
  {q:"งบดุล", a:"สรุปสินทรัพย์และหนี้สิน"},
  {q:"เงินเดือน", a:"รายได้จากการทำงานประจำ"},
  {q:"ผลตอบแทน", a:"กำไรที่ได้รับจากการลงทุน"}, // แก้ไขตรงนี้
  {q:"เบี้ยประกัน", a:"ค่าใช้จ่ายในการซื้อประกัน"}
];


// --- Game State & Stage Configuration ---
// การตั้งค่าด่านต่างๆ ของเกม
const STAGE_CONFIG = [
    { level: 1, time: 120, pairs: 10 } // ด่านแรกสำหรับระดับง่าย
];

let currentStage = 1;
let score = 0, timeLeft = 120, timerInterval = null;
let cards = [], selected = [], matchedCount = 0, locked = false;

// --- Game Logic Functions ---
// ฟังก์ชันสลับตำแหน่ง array
function shuffle(arr) {
    for(let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// เริ่มเกมใหม่
function startGame() {
    const config = STAGE_CONFIG[currentStage - 1];
    if (!config) {
        console.error("Invalid stage:", currentStage);
        return;
    }

    score = 0; matchedCount = 0; selected = []; locked = false;
    timeLeft = config.time;
    
    document.getElementById("score").textContent = score;
    document.getElementById("resultBox").textContent = '';
    hideModal(); // ซ่อน Modal หากมี
    
    // สุ่มคู่คำศัพท์
    let allIndexes = shuffle([...Array(pairs.length).keys()]);
    let usedIndexes = allIndexes.slice(0, config.pairs); 
    
    let allCards = [];
    usedIndexes.forEach(i => {
        allCards.push({ id: i, text: pairs[i].q, type: "q", correct: false });
        allCards.push({ id: i, text: pairs[i].a, type: "a", correct: false });
    });
    
    cards = shuffle(allCards);
    renderCards(); // แสดงการ์ด

    clearInterval(timerInterval); // เคลียร์ timer เก่า
    document.getElementById("timer").textContent = timeLeft; // อัปเดตเวลาบน UI
    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById("timer").textContent = timeLeft;
        if (timeLeft <= 0) endGame(false); // หากหมดเวลา จบเกม
    }, 1000);
}

// แสดงการ์ดบน UI
function renderCards() {
    const gameBoard = document.getElementById("gameBoard");
    if (!gameBoard) { console.error("gameBoard element not found!"); return; }
    
    gameBoard.innerHTML = cards.map((card, idx) => {
        const isSelected = selected.includes(idx);
        const content = card.text;
        
        let cardClasses = 'card';
        if (card.correct) {
            cardClasses += ' correct'; // สำหรับการ์ดที่จับคู่ถูก
        } else if (isSelected) {
            cardClasses += ' flipped'; // สำหรับการ์ดที่ถูกเลือก
        }

        return `<div id="card${idx}" class="${cardClasses}" onclick="selectCard(${idx})">${content}</div>`;
    }).join('');
}

// ฟังก์ชันเมื่อเลือกการ์ด
window.selectCard = function(idx) {
    if (locked || selected.includes(idx) || cards[idx].correct || selected.length >= 2) {
        return; // ไม่สามารถเลือกการ์ดได้
    }

    selected.push(idx); // เพิ่มการ์ดที่เลือก
    renderCards(); // แสดงการ์ดที่ถูกเลือก

    if (selected.length === 2) {
        locked = true; // ล็อกไม่ให้เลือกการ์ดเพิ่ม
        const [idx1, idx2] = selected;
        const card1 = cards[idx1];
        const card2 = cards[idx2];
        
        if (card1.id === card2.id && card1.type !== card2.type) {
            // หากจับคู่ถูก
            score += 15;
            matchedCount++;
            document.getElementById("score").textContent = score;

            cards[idx1].correct = true;
            cards[idx2].correct = true;

            setTimeout(() => {
                selected = []; 
                renderCards(); 
                locked = false;
                if (matchedCount === STAGE_CONFIG[currentStage - 1].pairs) {
                    endGame(true); // จบเกมหากจับคู่ครบ
                }
            }, 700); 
        } else {
            // หากจับคู่ผิด
            score = Math.max(0, score - 5);
            document.getElementById("score").textContent = score;
            
            document.getElementById(`card${idx1}`)?.classList.add('wrong');
            document.getElementById(`card${idx2}`)?.classList.add('wrong');
            
            setTimeout(() => {
                selected = []; 
                renderCards(); 
                locked = false;
            }, 1000); 
        }
    }
}

// จบเกม
async function endGame(win) {
    clearInterval(timerInterval); // หยุด timer
    
    let expGained = 0;
    const perfectScore = STAGE_CONFIG[currentStage - 1].pairs * 15; 
    if (win) {
        const expPercentage = Math.min(score / perfectScore, 1);
        expGained = Math.floor(100 * expPercentage); // ได้รับสูงสุด 100 EXP สำหรับระดับง่าย
    } else {
        expGained = Math.floor(score * 0.5); // ได้รับ EXP น้อยลงหากแพ้
    }
    
    expGained = Math.max(expGained, 0); // EXP ไม่ต่ำกว่า 0
    const expResult = await addExp(expGained); // เพิ่ม EXP และรอผลลัพธ์
    
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
        `<button class="modal-btn" onclick="nextQuestionSet()">ด่านต่อไป (ปานกลาง)</button>
         <button class="modal-btn" onclick="startGame()">เล่นใหม่</button>`
    );
}

// ไปยังด่านถัดไป (ปานกลาง)
window.nextQuestionSet = function() {
    window.location.href = 'match-medium.html'; // ไปยังระดับปานกลาง
}

// เริ่มเกมใหม่ตั้งแต่ด่านแรก
window.restartGame = function() {
    currentStage = 1;
    startGame();
}

// เริ่มด่านปัจจุบันใหม่
window.restartCurrentStage = function() {
    startGame();
}

// แสดง Modal
function showModal(msg, btns) {
    const modalContent = document.getElementById('modalContent');
    const modalOverlay = document.getElementById('modalOverlay');
    if(modalContent && modalOverlay) {
        modalContent.innerHTML = `${msg}<div class="modal-btn-container">${btns || ''}</div>`;
        modalOverlay.style.display = "flex";
    }
}

// ซ่อน Modal
function hideModal() {
    const modalOverlay = document.getElementById('modalOverlay');
    if(modalOverlay) {
        modalOverlay.style.display = "none";
    }
}

// เริ่มเกมเมื่อ DOM โหลดเสร็จ
document.addEventListener('DOMContentLoaded', startGame);
