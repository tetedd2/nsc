const firebaseConfig = {
    apiKey: "AIzaSyBjLBl1sEGgQLyng51rW25b434bJ0opVc4",
    authDomain: "myapplication-bd04c034.firebaseapp.com",
    databaseURL: "https://myapplication-bd04c034-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "myapplication-bd04c034",
    storageBucket: "myapplication-bd04c034.firebasestorage.app",
    messagingSenderId: "49782830313",
    appId: "1:49782830313:web:c81b5d86a937f22d296c78"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// EXP System
let playerData = {
    level: 1,
    exp: 0,
    totalExp: 0
};

// Load player data
function loadPlayerData() {
    const playerId = getPlayerId();
    database.ref('players/' + playerId).once('value', (snapshot) => {
        if (snapshot.exists()) {
            playerData = snapshot.val();
        }
        updateExpDisplay();
    });
}

function getPlayerId() {
    let playerId = localStorage.getItem('playerId');
    if (!playerId) {
        playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('playerId', playerId);
    }
    return playerId;
}

function getExpToNextLevel(level) {
    return level * 100;
}

function updateExpDisplay() {
    const expToNext = getExpToNextLevel(playerData.level);
    const expProgress = playerData.exp / expToNext * 100;
    
    document.getElementById('playerLevel').textContent = playerData.level;
    document.getElementById('playerExp').textContent = playerData.exp;
    document.getElementById('expToNext').textContent = expToNext;
    document.getElementById('expFill').style.width = expProgress + '%';
}

function addExp(amount) {
    if (amount <= 0) return { gained: 0, levelUp: false };
    
    const oldLevel = playerData.level;
    playerData.exp += amount;
    playerData.totalExp += amount;
    
    // Check for level up
    let levelUp = false;
    while (playerData.exp >= getExpToNextLevel(playerData.level)) {
        playerData.exp -= getExpToNextLevel(playerData.level);
        playerData.level++;
        levelUp = true;
    }
    
    // Save to Firebase
    const playerId = getPlayerId();
    database.ref('players/' + playerId).set(playerData);
    
    updateExpDisplay();
    
    return { gained: amount, levelUp: levelUp, newLevel: playerData.level };
}

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
    {q:"ประกันชีวิต", a:"คุ้มครองเงิน/ชีวิตจากเหตุการณ์ไม่คาดฝัน"},
];

let score=0, timeLeft=60, timerInterval=null;
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
    if (lastUsedIdxs.length > 0 && JSON.stringify(idxs.slice(0, 10)) === JSON.stringify(lastUsedIdxs)) {
        idxs = shuffle(idxs);
    }
    lastUsedIdxs = idxs.slice(0, 10);
    return lastUsedIdxs;
}

function startGame() {
    score=0; matchedCount=0; selected=[]; locked=false; timeLeft=60; triedWrong={};
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

function renderCards() {
    document.getElementById("gameBoard").innerHTML =
        cards.map((c,idx)=>
            `<div class="card${c.correct?' correct':''}${isSelected(idx)?' flipped':''}${c.justReleased?' released':''}" onclick="selectCard(${idx})" id="card${idx}">${!c.correct ? c.text : ""}</div>`
        ).join('');
}

function isSelected(idx) {
    return selected.includes(idx);
}

window.selectCard = function(idx){
    if(locked) return;
    if(cards[idx].correct || selected.includes(idx)) return;
    selected.push(idx);
    renderCards();
    setTimeout(() => {
        if(document.getElementById("card"+idx)) document.getElementById("card"+idx).classList.add("released");
        setTimeout(()=>{
            if(document.getElementById("card"+idx)) document.getElementById("card"+idx).classList.remove("released");
        }, 190);
    }, 90);

    if(selected.length===2){
        locked=true;
        const [i1,i2]=selected;
        if(cards[i1].id===cards[i2].id && cards[i1].pair!==cards[i2].pair){
            if(triedWrong[cards[i1].id]) {
                // ไม่มีคะแนน
            } else {
                score+=15;
            }
            cards[i1].correct=true; cards[i2].correct=true;
            matchedCount++;
            setTimeout(()=>{
                selected=[];
                renderCards();
                document.getElementById("score").textContent = score;
                locked=false;
                if(matchedCount===10) endGame(true);
            },410);
        }else{
            score-=5;
            triedWrong[cards[i1].id]=true;
            triedWrong[cards[i2].id]=true;
            document.getElementById("card"+i1).classList.add('wrong');
            document.getElementById("card"+i2).classList.add('wrong');
            setTimeout(()=>{
                selected=[];
                renderCards();
                document.getElementById("score").textContent = score;
                locked=false;
            },340);
        }
    }
}

function endGame(win){
    clearInterval(timerInterval);
    
    // Calculate EXP
    let expGained = 0;
    if (win) {
        // Perfect score calculation
        const perfectScore = 10 * 15; // 10 pairs * 15 points each
        const expPercentage = Math.min(score / perfectScore, 1);
        expGained = Math.floor(100 * expPercentage); // Max 100 EXP for easy level
    } else {
        // Partial EXP based on score
        expGained = Math.floor(score * 0.5);
    }
    
    expGained = Math.max(expGained, 0);
    
    // Add EXP and check for level up
    const expResult = addExp(expGained);
    
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
        `<button class="modal-btn" onclick="nextQuestionSet()">ข้อถัดไป</button>
         <button class="modal-btn" onclick="startGame()">เล่นใหม่</button>`
    );
}

function showModal(msg, btns) {
    document.getElementById('modalContent').innerHTML = msg + (btns||'');
    document.getElementById('modalOverlay').style.display = "flex";
}

function hideModal() {
    document.getElementById('modalOverlay').style.display = "none";
}

function nextQuestionSet() {
    // Redirect to match-medium.html
    window.location.href = 'match-medium.html'; 
}

// Initialize
loadPlayerData();
startGame();
