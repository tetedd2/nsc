// Firebase Configuration (ใช้ค่าจาก match-easy.js ที่ให้มา)
const firebaseConfig = {
    apiKey: "AIzaSyBjLBl1sEGgQLyng51rW25b434bJ0opVc4",
    authDomain: "myapplication-bd04c034.firebaseapp.com",
    databaseURL: "https://myapplication-bd04c034-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "myapplication-bd04c034",
    storageBucket: "myapplication-bd04c034.firebasestorage.app",
    messagingSenderId: "49782830313",
    appId: "1:49782830313:web:c81b5d86a937f22d296c78"
};

// Flag เพื่อตรวจสอบว่าเกมเริ่มต้นครั้งแรกแล้วหรือยัง
let isGameStartedInitially = false;

// Initialize Firebase if not already initialized
// ตรวจสอบว่า Firebase ถูกเริ่มต้นแล้วหรือไม่ ถ้ายัง ให้โหลด SDK และเริ่มต้น
if (typeof firebase === 'undefined' || firebase.apps.length === 0) {
    // Load Firebase SDKs from CDN
    const appScript = document.createElement('script');
    appScript.src = "https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js";
    document.head.appendChild(appScript);

    appScript.onload = () => {
        const databaseScript = document.createElement('script');
        databaseScript.src = "https://www.gstatic.com/firebasejs/9.0.0/firebase-database-compat.js";
        document.head.appendChild(databaseScript);

        databaseScript.onload = () => {
            firebase.initializeApp(firebaseConfig);
            window.database = firebase.database(); // ทำให้ database เข้าถึงได้ทั่วโลก
            loadPlayerData(); // โหลดข้อมูลผู้เล่นหลังจาก Firebase เริ่มต้นแล้ว
        };
    };
} else {
    // If Firebase is already initialized (e.g., from another script), just get the database instance
    // ถ้า Firebase เริ่มต้นแล้ว (เช่น จากสคริปต์อื่น) ให้เรียกใช้งาน database instance ได้เลย
    window.database = firebase.database();
    loadPlayerData();
}


// EXP System
// ระบบ EXP
let playerData = {
    level: 1,
    exp: 0,
    totalExp: 0
};

// Load player data from Firebase
// โหลดข้อมูลผู้เล่นจาก Firebase
function loadPlayerData() {
    // Ensure database is initialized before trying to use it
    // ตรวจสอบให้แน่ใจว่า database เริ่มต้นแล้วก่อนที่จะใช้งาน
    if (!window.database) {
        console.error("Firebase database not initialized yet. Retrying...");
        // Retry loading after a short delay or handle error
        // ลองโหลดใหม่หลังจากหน่วงเวลาสั้นๆ หรือจัดการข้อผิดพลาด
        setTimeout(loadPlayerData, 100); 
        return;
    }

    const playerId = getPlayerId();
    window.database.ref('players/' + playerId).once('value', (snapshot) => {
        if (snapshot.exists()) {
            playerData = snapshot.val();
        }
        updateExpDisplay();
        // เรียก startGame() ครั้งแรกหลังจากโหลดข้อมูลผู้เล่น
        if (!isGameStartedInitially) {
            startGame();
            isGameStartedInitially = true;
        }
    }).catch(error => {
        console.error("Error loading player data:", error);
        // หากโหลดข้อมูลล้มเหลว ก็ยังคงพยายามเริ่มเกมเพื่อให้เล่นได้
        if (!isGameStartedInitially) {
            startGame();
            isGameStartedInitially = true;
        }
    });
}

// Get unique player ID from localStorage or generate a new one
// รับ ID ผู้เล่นที่ไม่ซ้ำกันจาก localStorage หรือสร้างใหม่
function getPlayerId() {
    let playerId = localStorage.getItem('playerId');
    if (!playerId) {
        playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('playerId', playerId);
    }
    return playerId;
}

// Calculate EXP needed for the next level (up to 200 EXP per level as per request)
// คำนวณ EXP ที่ต้องการสำหรับเลเวลถัดไป (สูงสุด 200 EXP ต่อเลเวลตามที่ร้องขอ)
function getExpToNextLevel(level) {
    // Maximum 200 EXP per level (สำหรับระดับปานกลาง)
    // หากต้องการให้ระดับง่ายมี EXP สูงสุด 100 EXP และระดับปานกลาง 200 EXP
    // จะต้องแยกฟังก์ชันนี้ออกไปตามแต่ละระดับ หรือส่งค่า maxExp เข้ามา
    // แต่ในที่นี้จะใช้ 200 เป็นค่าสูงสุดสำหรับระดับปานกลางตามคำขอ
    return Math.min(level * 100, 200); 
}

// Update EXP display on the UI
// อัปเดตการแสดงผล EXP บน UI
function updateExpDisplay() {
    const expToNext = getExpToNextLevel(playerData.level);
    const expProgress = (playerData.exp / expToNext) * 100;
    
    document.getElementById('playerLevel').textContent = playerData.level;
    document.getElementById('playerExp').textContent = playerData.exp;
    document.getElementById('expToNext').textContent = expToNext;
    document.getElementById('expFill').style.width = expProgress + '%';
}

// Add EXP to player data and check for level up
// เพิ่ม EXP ให้ข้อมูลผู้เล่นและตรวจสอบการเลเวลอัพ
function addExp(amount) {
    if (amount <= 0) return { gained: 0, levelUp: false };
    
    const oldLevel = playerData.level;
    playerData.exp += amount;
    playerData.totalExp += amount;
    
    let levelUp = false;
    // Loop to handle multiple level-ups if enough EXP is gained
    // วนลูปเพื่อจัดการการเลเวลอัพหลายครั้งหากได้รับ EXP เพียงพอ
    while (playerData.exp >= getExpToNextLevel(playerData.level)) {
        playerData.exp -= getExpToNextLevel(playerData.level);
        playerData.level++;
        levelUp = true;
    }
    
    // Save updated player data to Firebase
    // บันทึกข้อมูลผู้เล่นที่อัปเดตแล้วลงใน Firebase
    const playerId = getPlayerId();
    window.database.ref('players/' + playerId).set(playerData);
    
    updateExpDisplay();
    
    return { gained: amount, levelUp: levelUp, newLevel: playerData.level };
}

// Game pairs for medium level (จากโค้ด script_medium_js_final)
// คู่คำศัพท์สำหรับเกมระดับปานกลาง
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

let score=0, timeLeft=90, timerInterval=null;
let cards=[], selected=[], matchedCount=0, locked=false, triedWrong={};
let lastUsedIdxs = [];

// Shuffle array function
// ฟังก์ชันสุ่มอาร์เรย์
function shuffle(arr) {
  for(let i=arr.length-1;i>0;i--) {
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]] = [arr[j],arr[i]];
  }
  return arr;
}

// Get a new set of questions, ensuring it's not the same as the last one
// รับชุดคำถามใหม่ ตรวจสอบให้แน่ใจว่าไม่ใช่ชุดเดียวกับครั้งล่าสุด
function getNewQuestionSet() {
  let idxs = shuffle([...Array(pairs.length).keys()]);
  // Prevent using the exact same set of 12 questions consecutively
  // ป้องกันการใช้ชุดคำถาม 12 ข้อเดิมซ้ำกัน
  if (lastUsedIdxs.length > 0 && JSON.stringify(idxs.slice(0, 12)) === JSON.stringify(lastUsedIdxs)) {
    idxs = shuffle(idxs); // Shuffle again if it's the same
  }
  lastUsedIdxs = idxs.slice(0, 12); // Select 12 pairs for the game
  return lastUsedIdxs;
}

// Start the game
// เริ่มเกม
function startGame() {
  score=0; matchedCount=0; selected=[]; locked=false; timeLeft=90; triedWrong={};
  document.getElementById("score").textContent = score;
  document.getElementById("resultBox").textContent = '';
  hideModal(); // Hide modal if it's open
  cards = [];
  let used = getNewQuestionSet();
  let all = [];
  used.forEach(i=>{
    all.push({id:i, text:pairs[i].q, pair:"q", correct:false});
    all.push({id:i, text:pairs[i].a, pair:"a", correct:false});
  });
  cards = shuffle(all); // Shuffle all cards (questions and answers)
  renderCards();
  clearInterval(timerInterval); // Clear any existing timer
  document.getElementById("timer").textContent = timeLeft;
  // Start new timer
  // เริ่มตัวจับเวลาใหม่
  timerInterval = setInterval(()=>{
    timeLeft--;
    document.getElementById("timer").textContent = timeLeft;
    if(timeLeft<=0) endGame(false); // End game if time runs out
  },1000);
}

// Render cards on the game board
// แสดงการ์ดบนกระดานเกม
function renderCards() {
  document.getElementById("gameBoard").innerHTML =
    cards.map((c,idx)=>
      `<div class="card${c.correct?' correct':''}${isSelected(idx)?' flipped':''}${c.justReleased?' released':''}" onclick="selectCard(${idx})" id="card${idx}">${!c.correct ? c.text : ""}</div>`
    ).join('');
}

// Check if a card is currently selected
// ตรวจสอบว่ามีการ์ดถูกเลือกอยู่หรือไม่
function isSelected(idx) {
  return selected.includes(idx);
}

// Handle card selection logic
// จัดการตรรกะการเลือกการ์ด
window.selectCard = function(idx){
  if(locked) return; // Prevent interaction if board is locked
  if(cards[idx].correct || selected.includes(idx)) return; // Prevent selecting already matched or same card
  selected.push(idx);
  renderCards(); // Re-render to show flipped card
  setTimeout(() => {
    if(selected.length === 1) { // Apply 'released' animation only for the first selected card
      document.getElementById("card"+idx).classList.add("released");
      setTimeout(()=>{
        if(document.getElementById("card"+idx)) document.getElementById("card"+idx).classList.remove("released");
      }, 190);
    }
  }, 90);

  if(selected.length===2){ // Two cards are selected, check for match
    locked=true; // Lock board
    const [i1,i2]=selected;
    if(cards[i1].id===cards[i2].id && cards[i1].pair!==cards[i2].pair){ // Match found
      if(triedWrong[cards[i1].id]) {
        // No score deduction if already tried wrong for this pair
        // ไม่มีการหักคะแนนหากเคยจับคู่ผิดสำหรับคู่นี้แล้ว
      } else {
        score+=15; // Add score for correct match
      }
      cards[i1].correct=true; cards[i2].correct=true; // Mark cards as correct
      matchedCount++; // Increment matched pairs count
      setTimeout(()=>{
        selected=[]; // Clear selected cards
        renderCards(); // Re-render to hide matched cards
        document.getElementById("score").textContent = score; // Update score display
        locked=false; // Unlock board
        if(matchedCount===12) endGame(true); // End game if all 12 pairs are matched
      },410);
    }else{ // No match
      score-=5; // Deduct score
      triedWrong[cards[i1].id]=true; // Mark pair as tried wrong
      triedWrong[cards[i2].id]=true;
      document.getElementById("card"+i1).classList.add('wrong'); // Add 'wrong' class for visual feedback
      document.getElementById("card"+i2).classList.add('wrong');
      setTimeout(()=>{
        selected=[]; // Clear selected cards
        renderCards(); // Re-render to flip cards back
        document.getElementById("score").textContent = score; // Update score display
        locked=false; // Unlock board
      },340);
    }
  }
}

// End game function
// ฟังก์ชันจบเกม
function endGame(win){
  clearInterval(timerInterval); // Stop the timer
  
  // Calculate EXP based on game outcome and score
  // คำนวณ EXP ตามผลลัพธ์ของเกมและคะแนน
  let expGained = 0;
  if (win) {
    // Perfect score for 12 pairs * 15 points/pair = 180
    const perfectScore = 12 * 15; 
    const expPercentage = Math.min(score / perfectScore, 1); // Cap at 100%
    expGained = Math.floor(200 * expPercentage); // Max 200 EXP for medium level
  } else {
    // Partial EXP based on score for a loss
    // EXP บางส่วนตามคะแนนสำหรับกรณีแพ้
    expGained = Math.floor(score * 0.75); // Adjust multiplier for medium difficulty
  }
  
  expGained = Math.max(expGained, 0); // Ensure EXP gained is not negative
  
  // Add EXP to player data and check for level up
  // เพิ่ม EXP ให้ข้อมูลผู้เล่นและตรวจสอบการเลเวลอัพ
  const expResult = addExp(expGained);
  
  // Construct end game message with score and EXP details
  // สร้างข้อความจบเกมพร้อมรายละเอียดคะแนนและ EXP
  let message = win
    ? `🎉 เก่งมาก!<br>จับคู่ครบ <br><span style='color:#159988;font-size:1.3em;font-weight:700;'>${score} คะแนน</span><br>`
    : `หมดเวลา! <br><span style='color:#b71c1c;font-size:1.2em;font-weight:700;'>${score} คะแนน</span><br>`;
  
  if (expResult.gained > 0) {
    message += `<div class="exp-gain">+${expResult.gained} EXP</div>`;
  }
  
  if (expResult.levelUp) {
    message += `<div class="level-up">🎊 Level Up! Level ${expResult.newLevel}</div>`;
  }
  
  // Show modal with end game message and buttons
  // แสดง Modal พร้อมข้อความจบเกมและปุ่ม
  showModal(
    message,
    `<button class="modal-btn" onclick="nextQuestionSet()">ข้อถัดไป</button>
     <button class="modal-btn" onclick="startGame()">เล่นใหม่</button>`
  );
}

// Show modal function
// ฟังก์ชันแสดง Modal
function showModal(msg, btns) {
    document.getElementById('modalContent').innerHTML = msg + (btns||'');
    document.getElementById('modalOverlay').style.display = "flex";
}

// Hide modal function
// ฟังก์ชันซ่อน Modal
function hideModal() {
    document.getElementById('modalOverlay').style.display = "none";
}

// Function to navigate to the next level (match-hard.html)
// ฟังก์ชันสำหรับนำทางไปยังระดับถัดไป (match-hard.html)
function nextQuestionSet() {
  window.location.href = 'match-hard.html';
}

