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
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// EXP System variables
let playerData = {
    level: 1,
    exp: 0,
    totalExp: 0
};

// Load player data from Firebase
function loadPlayerData() {
    const playerId = getPlayerId();
    database.ref('players/' + playerId).once('value', (snapshot) => {
        if (snapshot.exists()) {
            playerData = snapshot.val();
        }
        updateExpDisplay();
    });
}

// Get or create a unique player ID
function getPlayerId() {
    let playerId = localStorage.getItem('playerId');
    if (!playerId) {
        playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('playerId', playerId);
    }
    return playerId;
}

// Calculate EXP needed for the next level
function getExpToNextLevel(level) {
    return level * 100;
}

// Update the EXP bar and text on the screen
function updateExpDisplay() {
    const expToNext = getExpToNextLevel(playerData.level);
    const expProgress = (playerData.exp / expToNext) * 100;
    
    document.getElementById('playerLevel').textContent = playerData.level;
    document.getElementById('playerExp').textContent = playerData.exp;
    document.getElementById('expToNext').textContent = expToNext;
    document.getElementById('expFill').style.width = expProgress + '%';
}

// Add EXP and handle level ups
function addExp(amount) {
    if (amount <= 0) return { gained: 0, levelUp: false };
    
    playerData.exp += amount;
    playerData.totalExp += amount;
    
    let levelUp = false;
    while (playerData.exp >= getExpToNextLevel(playerData.level)) {
        playerData.exp -= getExpToNextLevel(playerData.level);
        playerData.level++;
        levelUp = true;
    }
    
    const playerId = getPlayerId();
    database.ref('players/' + playerId).set(playerData);
    
    updateExpDisplay();
    
    return { gained: amount, levelUp: levelUp, newLevel: playerData.level };
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
function endGame(win){
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
    const expResult = addExp(expGained);
    
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
