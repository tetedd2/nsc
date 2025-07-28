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
    const expProgress = (playerData.exp / expToNext) * 100;
    
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

function endGame(win){
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