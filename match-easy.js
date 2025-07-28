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

let playerData = { level: 1, exp: 0, totalExp: 0 };

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

function getExpToNextLevel(level) { return level * 100; }

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

const pairs = [
    {q:"เงินออม", a:"เงินที่เก็บไว้ใช้ในอนาคต"}, {q:"รายรับ", a:"เงินที่ได้เข้ามา"},
    {q:"รายจ่าย", a:"เงินที่ต้องจ่ายออก"}, {q:"สินทรัพย์", a:"ของมีค่า/เงินฝาก"},
    {q:"หนี้สิน", a:"เงินที่ต้องใช้คืน"}, {q:"งบประมาณ", a:"แผนการใช้เงิน"},
    {q:"การลงทุน", a:"นำเงินไปต่อยอด"}, {q:"บัตรเครดิต", a:"บัตรใช้จ่ายแทนเงินสด"},
    {q:"ดอกเบี้ย", a:"เงินเพิ่มที่จ่าย/รับจากการยืม"}, {q:"ประกันชีวิต", a:"คุ้มครองเงิน/ชีวิตจากเหตุการณ์ไม่คาดฝัน"},
];

let score=0, timeLeft=120, timerInterval=null;
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
    score=0; matchedCount=0; selected=[]; locked=false; timeLeft=120; triedWrong={};
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
            `<div class="card${c.correct?' correct':''}${isSelected(idx)?' flipped':''}" onclick="selectCard(${idx})">${!c.correct ? c.text : ""}</div>`
        ).join('');
}

function isSelected(idx) { return selected.includes(idx); }

window.selectCard = function(idx){
    if(locked || cards[idx].correct || selected.includes(idx)) return;
    selected.push(idx);
    renderCards();
    
    if(selected.length===2){
        locked=true;
        const [i1,i2]=selected;
        if(cards[i1].id===cards[i2].id && cards[i1].pair!==cards[i2].pair){
            score+= triedWrong[cards[i1].id] ? 5 : 15;
            cards[i1].correct=true; cards[i2].correct=true;
            matchedCount++;
            setTimeout(()=>{
                selected=[];
                renderCards();
                document.getElementById("score").textContent = score;
                locked=false;
                if(matchedCount===10) endGame(true);
            },410);
        } else {
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

function endGame(win){
    clearInterval(timerInterval);
    let expGained = Math.max(0, win ? Math.floor(100 * (score / (10 * 15))) : Math.floor(score * 0.5));
    const expResult = addExp(expGained);
    
    let message = win
        ? `🎉 เก่งมาก!<br>จับคู่ครบ <br><span style='color:#159988;font-size:1.3em;font-weight:700;'>${score} คะแนน</span><br>`
        : `หมดเวลา! <br><span style='color:#b71c1c;font-size:1.2em;font-weight:700;'>${score} คะแนน</span><br>`;
    
    if (expResult.gained > 0) message += `<div class="exp-gain">+${expResult.gained} EXP</div>`;
    if (expResult.levelUp) message += `<div class="level-up">🎊 Level Up! Level ${expResult.newLevel}</div>`;
    
    showModal(
        message,
        `<div class="modal-btn-container">
            <button class="modal-btn" onclick="nextQuestionSet()">ด่านต่อไป (กลาง)</button>
            <button class="modal-btn" onclick="startGame()">เล่นใหม่</button>
         </div>`
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
    window.location.href = 'match-medium.html'; 
}

loadPlayerData();
startGame();
