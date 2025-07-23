// ================== Firebase Configuration ==================
const firebaseConfig = {
    apiKey: "AIzaSyBjLBl1sEGgQLyng51rW25b434bJ0opVc4",
    authDomain: "myapplication-bd04c034.firebaseapp.com",
    databaseURL: "https://myapplication-bd04c034-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "myapplication-bd04c034",
    storageBucket: "myapplication-bd04c034.firebasestorage.app",
    messagingSenderId: "49782830313",
    appId: "1:49782830313:web:c81b5d86a937f22d296c78"
};

// ==== Import Firebase SDK v9 ====
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';
import {
    getFirestore, collection, doc, setDoc, getDoc, updateDoc, onSnapshot,
    query, orderBy, addDoc, deleteDoc, serverTimestamp, arrayUnion, increment
} from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

let transactions = [];
let goals = [];
let currentGoalIndex = 0;
let unsubscribeListeners = [];

// ================== Authentication Observer ==================
onAuthStateChanged(auth, (user) => {
    if (user) {
        attachRealtimeListeners(user.uid);
        giveDailyLoginReward(user.uid); // แจกเหรียญทันทีที่ล็อกอิน (แค่วันละครั้ง)
        // ร้านค้าจะ sync ผ่าน onSnapshot อยู่แล้ว
        onSnapshot(doc(db, 'users', user.uid), snap => {
            const data = snap.data() || {};
            renderShop(data);
        });
    } else {
        detachRealtimeListeners();
        updateProfileUI({}, null);
        updateFinancialSummary();
        document.getElementById('transactionsContainer').innerHTML = '<p class="no-transactions-message">กรุณาเข้าสู่ระบบเพื่อดูรายการธุรกรรม</p>';
        document.getElementById('goalTitle').textContent = "- กรุณาเข้าสู่ระบบ -";
        document.getElementById('goalAmount').textContent = "เป้าหมาย: 0.00 ฿";
        document.getElementById('goalSavings').textContent = "ออมแล้ว: 0.00 ฿";
        document.getElementById('goalProgressBar').style.width = '0%';
        document.getElementById('goalProgressBar').textContent = '0%';
        document.getElementById('goalDueDate').textContent = "กำหนด: -";
        document.getElementById('prevGoal').style.display = 'none';
        document.getElementById('nextGoal').style.display = 'none';
    }
});

// ================== Real-time Data Listeners ==================
function attachRealtimeListeners(uid) {
    detachRealtimeListeners();

    // Profile listener
    const userProfileListener = onSnapshot(doc(db, 'users', uid), (docSnapshot) => {
        if (docSnapshot.exists()) {
            updateProfileUI(docSnapshot.data(), auth.currentUser);
        } else {
            setDoc(doc(db, 'users', uid), {
                displayName: auth.currentUser.displayName || "ผู้ใช้ใหม่",
                level: "Level 1 – ผู้เริ่มต้น",
                xp: 0,
                nextLevelXP: 100,
                quote: "เริ่มต้นเล็กๆ สร้างนิสัยยิ่งใหญ่!",
                badges: []
            });
        }
    }, console.error);

    // Transactions
    const transactionsQuery = query(collection(db, 'users', uid, 'transactions'), orderBy('date', 'desc'));
    const transactionsListener = onSnapshot(transactionsQuery, (snapshot) => {
        transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        displayTransactions();
        updateFinancialSummary();
    }, console.error);

    // Goals
    const goalsQuery = query(collection(db, 'users', uid, 'goals'), orderBy('createdAt', 'desc'));
    const goalsListener = onSnapshot(goalsQuery, (snapshot) => {
        goals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        currentGoalIndex = 0;
        displayGoals();
    }, console.error);

    unsubscribeListeners = [userProfileListener, transactionsListener, goalsListener];
}

function detachRealtimeListeners() {
    unsubscribeListeners.forEach(unsubscribe => unsubscribe());
    unsubscribeListeners = [];
}

// ============ ระบบร้านค้า & Daily Login Reward =============

// ================== รายการไอเทมร้านค้า ==================
const shopItems = [
    { id: 'bank', name: 'เหรียญนักออม', price: 100, icon: '🏦' },
    { id: 'invest', name: 'เหรียญนักลงทุน', price: 120, icon: '💹' },
    { id: 'planner', name: 'เหรียญวางแผน', price: 110, icon: '📝' },
    { id: 'debt', name: 'เหรียญปลอดหนี้', price: 90, icon: '💸' },
    { id: 'income', name: 'เหรียญรายรับหลายทาง', price: 80, icon: '🌐' },
    { id: 'entrepreneur', name: 'เหรียญผู้ประกอบการ', price: 150, icon: '💡' }
];

// ================== ฟังก์ชันแสดงร้านค้า ==================
function renderShop(user) {
    if (!document.getElementById('shopItemsRow')) return;
    document.getElementById('userCoins').textContent = user.coins || 0;
    const inventory = user.inventory || [];
    const row = document.getElementById('shopItemsRow');
    row.innerHTML = '';

    // แสดงเฉพาะเหรียญที่ผู้ใช้มี (ซื้อแล้วเท่านั้น)
    if (inventory.length === 0) {
        row.innerHTML = '<div style="text-align:center;width:100%;">ยังไม่มีเหรียญ</div>';
        return;
    }

    shopItems.forEach(item => {
        if (!inventory.includes(item.id)) return; // ข้ามถ้ายังไม่ซื้อ
        const el = document.createElement('div');
        el.className = 'shop-item unlocked';
        el.innerHTML = `
            <div class="item-icon">${item.icon}</div>
            <div class="item-name">${item.name}</div>
            <div class="item-price">${item.price} 🪙</div>
            <button disabled>ซื้อแล้ว</button>
        `;
        row.appendChild(el);
    });
}

// ================== ฟังก์ชันซื้อของ ==================
async function buyItem(uid, itemId, price) {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return alert('ไม่พบข้อมูลผู้ใช้');
    const user = userSnap.data();
    if ((user.coins || 0) < price) return alert('เหรียญไม่พอ');
    await updateDoc(userRef, {
        coins: (user.coins || 0) - price,
        inventory: arrayUnion(itemId)
    });
    alert('ซื้อสำเร็จ!');
}

// ---- ฟังก์ชันแจกเหรียญล็อกอินวันละครั้ง ----
async function giveDailyLoginReward(uid) {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;
    const user = userSnap.data();
    const todayStr = (new Date()).toISOString().slice(0, 10);
    if (user.lastLoginReward !== todayStr) {
        await updateDoc(userRef, {
            coins: increment(25),
            lastLoginReward: todayStr
        });
        alert('รับเหรียญล็อกอินประจำวัน +25 เหรียญ!');
    }
}

// ================== UI Update & ฟังก์ชันเดิม ==================
// ... (ส่วนที่เหลือของโค้ดเดิม เช่น updateProfileUI, updateFinancialSummary, displayTransactions, displayGoals, modal, chatbot ฯลฯ)
// (ไม่มี import Firestore ซ้ำในไฟล์อีก)


// -----------------------
// โหลดและแสดงร้านค้า+แจกเหรียญทันทีเมื่อล็อกอิน
auth.onAuthStateChanged(user => {
  if (!user) return;
  // แจกเหรียญล็อกอินวันละครั้ง
  giveDailyLoginReward(user.uid);
  // โหลดและอัปเดตร้านค้าแบบเรียลไทม์
  onSnapshot(doc(db, 'users', user.uid), snap => {
    const data = snap.data() || {};
    renderShop(data);
  });
});

function updateProfileUI(userData, user) {
    // Profile Picture
    document.getElementById('profilePicture').src = user ? user.photoURL || 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png' : 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png';
    // Username, Level, and Quote
    document.getElementById('usernameDisplay').textContent = userData.displayName || (user ? user.displayName : 'ผู้ใช้ใหม่');
    document.getElementById('userLevel').textContent = userData.level || "Level 1 – ผู้เริ่มต้น";
    document.getElementById('userQuote').textContent = `"${userData.quote || 'เริ่มต้นเล็กๆ สร้างนิสัยยิ่งใหญ่!'}"`;
    // XP Progress Bar
    const currentXP = userData.xp || 0;
    const nextLevelXP = userData.nextLevelXP || 100;
    const progressPercent = (currentXP / nextLevelXP) * 100;
    document.getElementById('userProgress').style.width = `${progressPercent}%`;
    document.getElementById('progressValue').textContent = `${Math.round(progressPercent)}%`;
    document.getElementById('currentXP').textContent = currentXP;
    document.getElementById('nextLevelXP').textContent = nextLevelXP;

    // Badges (Updated logic to use allBadges definition)
    const badgesContainer = document.getElementById('userBadges');
    badgesContainer.innerHTML = ''; // Clear existing badges

    const userUnlockedBadgeIds = userData.badges || []; // Assume userData.badges is an array of badge IDs

    if (allBadges.length > 0) {
        allBadges.forEach(badgeData => {
            const badgeDiv = document.createElement('div');
            badgeDiv.classList.add('badge');
            badgeDiv.dataset.badgeId = badgeData.id; // Set data-badge-id for specific styling

            const isUnlocked = userUnlockedBadgeIds.includes(badgeData.id);

            if (isUnlocked) {
                badgeDiv.classList.add('unlocked');
                badgeDiv.setAttribute('title', `${badgeData.name}: ${badgeData.description}`);
            } else {
                badgeDiv.classList.add('locked');
                badgeDiv.setAttribute('title', `ล็อค - ${badgeData.name}: ${badgeData.description}`);
            }
            badgeDiv.textContent = badgeData.icon;
            badgesContainer.appendChild(badgeDiv);
        });
    } else {
        badgesContainer.innerHTML = '<div class="badge placeholder" title="ยังไม่มีเหรียญตรา">❓</div>';
    }
}

function updateFinancialSummary() {
    let totalIncome = 0;
    let totalExpense = 0;
    transactions.forEach(tx => {
        const amount = parseFloat(tx.amount);
        if (tx.type === 'income') totalIncome += amount;
        else if (tx.type === 'expense') totalExpense += amount;
    });
    const balance = totalIncome - totalExpense;

    document.getElementById('income').textContent = `${totalIncome.toFixed(2)} ฿`;
    document.getElementById('expense').textContent = `${totalExpense.toFixed(2)} ฿`;
    document.getElementById('balance').textContent = `${balance.toFixed(2)} ฿`;
}

function displayTransactions() {
    const container = document.getElementById('transactionsContainer');
    container.innerHTML = '';
    if (transactions.length === 0) {
        container.innerHTML = '<p class="no-transactions-message">ไม่มีรายการธุรกรรมในขณะนี้</p>'; // Use specific class
        return;
    }
    transactions.forEach(tx => {
        const item = document.createElement('div');
        item.className = 'transaction-item';
        item.innerHTML = `
            <div class="transaction-details">
                <h3>${tx.description}</h3>
                <p>${new Date(tx.date).toLocaleDateString('th-TH')}</p>
            </div>
            <div class="transaction-amount ${tx.type}">
                ${tx.type === 'income' ? '+' : '-'} ${parseFloat(tx.amount).toFixed(2)} ฿
            </div>
            <button class="delete-btn" onclick="deleteTransaction('${tx.id}')">&times;</button>
        `;
        container.appendChild(item);
    });
}

function displayGoals() {
    const goalSection = document.getElementById('goalDisplay');
    const prevBtn = document.getElementById('prevGoal');
    const nextBtn = document.getElementById('nextGoal');
    
    if (goals.length === 0) {
        goalSection.style.display = 'block'; // Ensure section is visible even if no goals
        document.getElementById('goalTitle').textContent = "- ยังไม่มีเป้าหมายที่ตั้งไว้ -";
        document.getElementById('goalAmount').textContent = "เป้าหมาย: 0.00 ฿";
        document.getElementById('goalSavings').textContent = "ออมแล้ว: 0.00 ฿";
        document.getElementById('goalProgressBar').style.width = '0%';
        document.getElementById('goalProgressBar').textContent = '0%';
        document.getElementById('goalDueDate').textContent = "กำหนด: -";
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
        return;
    }

    prevBtn.style.display = goals.length > 1 ? 'block' : 'none';
    nextBtn.style.display = goals.length > 1 ? 'block' : 'none';

    // Ensure currentGoalIndex loops correctly (if needed, or just cap at min/max)
    if (currentGoalIndex < 0) currentGoalIndex = goals.length - 1;
    if (currentGoalIndex >= goals.length) currentGoalIndex = 0;

    const goal = goals[currentGoalIndex];
    const target = parseFloat(goal.targetAmount || 0);
    const saved = parseFloat(goal.savings || 0);
    const progress = target > 0 ? (saved / target) * 100 : 0;

    document.getElementById('goalTitle').textContent = goal.name;
    document.getElementById('goalAmount').textContent = `เป้าหมาย: ${target.toFixed(2)} ฿`;
    document.getElementById('goalSavings').textContent = `ออมแล้ว: ${saved.toFixed(2)} ฿`;
    document.getElementById('goalProgressBar').style.width = `${Math.min(100, progress).toFixed(0)}%`;
    document.getElementById('goalProgressBar').textContent = `${Math.min(100, progress).toFixed(0)}%`;
    document.getElementById('goalDueDate').textContent = goal.dueDate ? `กำหนด: ${new Date(goal.dueDate).toLocaleDateString('th-TH')}` : "กำหนด: -";
}

// ================== Data Manipulation Functions ==================

async function deleteTransaction(transactionId) {
    if (confirm("คุณแน่ใจหรือไม่ที่จะลบรายการนี้?") && auth.currentUser) {
        try {
            await deleteDoc(doc(db, "users", auth.currentUser.uid, "transactions", transactionId));
            alert("ลบรายการเรียบร้อยแล้ว");
        } catch (error) {
            console.error("Error removing transaction: ", error);
            alert("เกิดข้อผิดพลาดในการลบ: " + error.message);
        }
    }
}

// ================== DOM Event Listeners (DOMContentLoaded) ==================
document.addEventListener('DOMContentLoaded', () => {
    // Dark Mode Toggle - Assuming darkmode-toggle.js handles this separately
    const enableDark = localStorage.getItem("moneySkillzDarkMode") === "true";
    if (enableDark) document.body.classList.add("dark-mode");

    // Goal Form Submission (from goalModal)
    const goalForm = document.getElementById('goalForm');
    if (goalForm) {
        goalForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = auth.currentUser;
            if (!user) return alert("กรุณาเข้าสู่ระบบ");

            const name = document.getElementById('goalNameInput').value.trim();
            const targetAmount = parseFloat(document.getElementById('goalTargetAmount').value);
            const savings = parseFloat(document.getElementById('goalCurrentSavings').value || 0);
            const dueDate = document.getElementById('goalDueDateInput').value;
            const messageDiv = document.getElementById('goalMessage');

            if (!name || isNaN(targetAmount) || targetAmount <= 0) {
                messageDiv.textContent = "กรุณากรอกชื่อและจำนวนเงินเป้าหมายให้ถูกต้อง";
                messageDiv.style.color = "red"; // Use actual CSS var if available, otherwise direct color
                return;
            }

            try {
                await addDoc(collection(db, "users", user.uid, "goals"), {
                    name, targetAmount, savings, dueDate,
                    createdAt: serverTimestamp() // Use Firebase v9 serverTimestamp
                });
                messageDiv.textContent = "สร้างเป้าหมายสำเร็จ!";
                messageDiv.style.color = "green"; // Use actual CSS var if available, otherwise direct color
                document.getElementById('goalForm').reset();
                setTimeout(closeGoalModal, 1000);
            } catch (error) {
                messageDiv.textContent = "เกิดข้อผิดพลาด: " + error.message;
                messageDiv.style.color = "red"; // Use actual CSS var if available, otherwise direct color
                console.error("Error adding goal: ", error);
            }
        });
    }

    // Goal Navigation
    const prevGoalBtn = document.getElementById('prevGoal');
    const nextGoalBtn = document.getElementById('nextGoal');
    
    if (prevGoalBtn) prevGoalBtn.addEventListener('click', () => { currentGoalIndex--; displayGoals(); });
    if (nextGoalBtn) nextGoalBtn.addEventListener('click', () => { currentGoalIndex++; displayGoals(); });

    // AI Chat Form
    const aiChatForm = document.getElementById('aiChatForm');
    if (aiChatForm) {
        aiChatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('aiChatInput');
            const message = input.value.trim();
            if (message) {
                appendMsg('user', message);
                input.value = '';
                const aiResponse = await getAiResponse(message);
                appendMsg('ai', aiResponse);
            }
        });
    }
});

// ================== Modal Control Functions ==================
function openTransactionModal() { document.getElementById('transactionModal').style.display = 'flex'; }
function closeTransactionModal() { 
    document.getElementById('transactionModal').style.display = 'none';
    document.getElementById('transactionMessage').textContent = '';
    document.getElementById('transactionForm').reset();
}
function openGoalModal() { document.getElementById('goalModal').style.display = 'flex'; }
function closeGoalModal() {
    document.getElementById('goalModal').style.display = 'none';
    document.getElementById('goalMessage').textContent = '';
    document.getElementById('goalForm').reset();
}

// ================== AI Chatbot Logic ==================
function appendMsg(sender, msg) {
    const historyBox = document.getElementById('aiChatHistory');
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${sender}`;
    msgDiv.textContent = msg;
    historyBox.appendChild(msgDiv);
    historyBox.scrollTop = historyBox.scrollHeight;
}

async function getAiResponse(message) {
    return new Promise(resolve => {
        setTimeout(() => {
            const txt = message.toLowerCase();
            let responses = [];

            // ทักทาย / ปรึกษาทั่วไป
            if (txt.match(/(สวัสดี|hello|hi|หวัดดี|ทัก|ดี)/)) {
                responses = [
                    "สวัสดีครับ! ผมคือ AI ผู้ช่วยด้านการเงินและการเรียนรู้ มีอะไรอยากปรึกษาไหมครับ 😊",
                    "ยินดีต้อนรับ! อยากคุยเรื่องอะไรดีครับ ทั้งเรื่องเงิน การเรียน หรือเทคนิคการใช้ชีวิตก็ได้นะ"
                ];
            }
            // ออมเงิน-วิธีออม
            else if (txt.match(/(ออม|วิธีออม|เงินออม|เก็บเงิน)/)) {
                responses = [
                    "การออมเงินที่ดี ควรเริ่มต้นจากการตั้งเป้าหมายเล็กๆ เช่น ออมวันละ 20 บาท แล้วค่อยเพิ่มทีหลังครับ",
                    "บันทึกรายรับ-รายจ่ายทุกวัน จะช่วยให้เห็นว่าใช้เงินไปกับอะไรบ้าง ลองเริ่มจากจดในแอพดูไหมครับ?"
                ];
            }
            // คำถามเกม/ฟีเจอร์
            else if (txt.match(/(เกม|เควส|ภารกิจ|เหรียญ|ร้านค้า|ด่าน|ไอเทม|ผ่านด่าน|level|แต้ม|คะแนน)/)) {
                responses = [
                    "เล่นเกมในแอพนี้จะได้รับเหรียญและแต้ม แลกของรางวัลหรือไอเทมพิเศษได้ด้วยนะครับ ลองสะสมดู!",
                    "ผ่านภารกิจต่างๆ จะได้ทั้งความรู้ทางการเงินและคะแนนเก็บประสบการณ์ อยากรู้เคล็ดลับผ่านด่านไหนไหม?"
                ];
            }
            // ตั้งเป้าหมาย
            else if (txt.match(/(เป้าหมาย|goal|ตั้งเป้า|ออมเพื่ออะไร|ฝัน|ความฝัน|ตั้งใจ)/)) {
                responses = [
                    "เป้าหมายทางการเงินเช่น อยากซื้อโทรศัพท์ ออกทริป หรือเก็บเงินสำรองฉุกเฉิน ลองตั้งในแอพนี้ได้เลย!",
                    "การมีเป้าหมายทำให้การออมง่ายขึ้นมากๆ แนะนำให้เขียนเป้าหมายลงในระบบ จะได้เห็นความคืบหน้าครับ"
                ];
            }
            // ลงทุน/ดอกเบี้ย/เสี่ยง
            else if (txt.match(/(ลงทุน|ลงทุนอะไรดี|การลงทุน|เสี่ยง|หุ้น|ดอกเบี้ย|กองทุน|passive income)/)) {
                responses = [
                    "การลงทุนควรเริ่มศึกษากองทุนรวมก่อน เพราะเข้าใจง่ายและเหมาะกับมือใหม่ ถ้าสนใจถามผมเพิ่มเติมได้นะครับ",
                    "ทุกการลงทุนมีความเสี่ยง อย่าลืมหาข้อมูลเยอะๆ และแบ่งเงินลงทุนในหลายๆ ช่องทาง"
                ];
            }
            // งบประมาณ/วางแผนเงิน
            else if (txt.match(/(งบประมาณ|จัดสรรเงิน|วางแผน|budget|ใช้เงิน|รายจ่าย|รายรับ)/)) {
                responses = [
                    "สูตรง่ายๆ ในการวางงบ: 50% ใช้จ่ายจำเป็น, 30% ใช้ส่วนตัว, 20% ออม/ลงทุน (50/30/20)",
                    "ลองสร้างบันทึกรายรับ-รายจ่ายประจำวันในแอพ จะช่วยให้วางแผนการใช้เงินได้ดีขึ้นมากครับ"
                ];
            }
            // คำถามการเรียน/แนะแนว/กำลังใจ
            else if (txt.match(/(เรียน|การเรียน|สอบ|เทคนิคการเรียน|ตั้งใจเรียน|แรงบันดาลใจ|motivation|อ่านหนังสือ|วางแผนการเรียน|เครียด|เหนื่อย|ขี้เกียจ)/)) {
                responses = [
                    "แบ่งเวลาการเรียนเป็นช่วงสั้นๆ (เช่น 25 นาทีพัก 5 นาที) ช่วยให้จดจ่อได้มากขึ้น (เทคนิค Pomodoro!)",
                    "ถ้าเครียดหรือเบื่อ แนะนำให้ออกกำลังกายเล็กๆ หรือฟังเพลงโปรด แล้วกลับมาอ่านใหม่ จะสดชื่นขึ้นครับ",
                    "การตั้งเป้าหมายการเรียน (เช่น สอบติด, เกรดดีขึ้น) แล้วติดตามความคืบหน้า จะช่วยให้มีแรงบันดาลใจมากขึ้น!"
                ];
            }
            // แนะแนวทางการพัฒนาตนเอง/ตั้งคำถามชวนคิด
            else if (txt.match(/(พัฒนาตัวเอง|โต|อนาคต|เปลี่ยนแปลง|เริ่มใหม่|ท้อ|พลาด|ผิดหวัง|กำลังใจ|ขี้ลืม|ตั้งใจ)/)) {
                responses = [
                    "ทุกคนเคยผิดหวังหรือพลาดมาก่อน สำคัญคืออย่าหยุดเรียนรู้และลองทำใหม่ครับ ผมเชื่อว่าคุณทำได้!",
                    "ถ้าอยากเปลี่ยนแปลงตัวเอง ให้เริ่มจากเรื่องเล็กๆ เช่น นอนให้พอ อ่านหนังสือวันละหน้า หรือออมเงินวันละนิดก็ได้ครับ",
                    "พัฒนาตัวเองทีละนิด ดีขึ้นวันละ 1% เวลาผ่านไปคุณจะเก่งกว่าที่คิดแน่นอน!"
                ];
            }
            // ความรู้เบื้องต้น/ทั่วไป/คำถามชีวิต
            else if (txt.match(/(คืออะไร|ทำไม|ประโยชน์|ข้อดี|ข้อเสีย|ความหมาย|นิยาม|ช่วยอธิบาย|จำเป็นไหม|ดีไหม)/)) {
                responses = [
                    "การออมเงินคือการเก็บเงินส่วนหนึ่งไว้ใช้ในอนาคต เช่น สำรองยามฉุกเฉินหรือซื้อของที่อยากได้ในอนาคต",
                    "การลงทุนมีทั้งข้อดี (เงินงอกเงย) และข้อเสีย (เสี่ยงขาดทุน) ควรศึกษาให้ดีและเลือกที่เหมาะกับตัวเอง",
                    "ทุกเรื่องมีทั้งข้อดีและข้อเสีย อยู่ที่ว่าเหมาะกับเป้าหมายและนิสัยการเงินของเราหรือไม่"
                ];
            }
// ถามไอเดียกิจกรรม/challenge
else if (txt.match(/(ไอเดีย|challenge|ภารกิจใหม่|ท้าทาย|กิจกรรม|สูตร|trick|แนะนำหน่อย|อยากรู้)/)) {
    responses = [
        "Challenge วันนี้: ลดค่าใช้จ่ายฟุ่มเฟือย 1 อย่าง หรือออมเงินให้ได้ 30 บาท!",
        "ลองสร้างกิจกรรมแข่งออมเงินกับเพื่อนในแอพ ใครออมครบก่อนรับเหรียญรางวัลพิเศษ!",
        "ถ้าอยากได้เทคนิคอ่านหนังสือสอบ ลองอ่านทีละน้อย แต่ทำทุกวัน จะจำได้ดีกว่าครับ"
    ];
}
// เทคนิค/เคล็ดลับ/วิธีทำ
else if (txt.match(/(เทคนิค|trick|วิธีทำ|ทำยังไง|ช่วยแนะนำ|เคล็ดลับ|วิธีการ)/)) {
    responses = [
        "วิธีออมเงินที่ง่ายที่สุดคือ แบ่งเงินทันทีหลังได้รับ เช่น ออม 10% ทุกครั้ง แล้วจดบันทึกไว้ จะเห็นความก้าวหน้าเร็วขึ้นครับ",
        "แนะนำให้บันทึกรายจ่ายทุกวัน ลองดูว่ามีค่าใช้จ่ายอะไรที่ไม่จำเป็นบ้าง แล้วตัดออกอย่างน้อย 1 อย่างในสัปดาห์นี้",
        "วางแผนงบรายสัปดาห์ด้วยสูตร 50/30/20 คือ 50% สำหรับของจำเป็น, 30% ใช้ตามใจ, 20% ออมเงิน",
        "แบ่งเวลาอ่านหนังสือทีละน้อย เช่น 25 นาทีพัก 5 นาที และสลับทำกิจกรรมที่ชอบ จะช่วยให้จำได้ดีขึ้นครับ",
        "อยากรู้เทคนิคเรื่องไหนเป็นพิเศษไหมครับ เช่น เทคนิคผ่านด่านเกม เทคนิคลงทุน หรือวิธีวางแผนการเรียน?"
    ];
}
// ไม่เข้าใจ/ทั่วไป
else {
    responses = [
        "ขอโทษครับ ผมยังไม่เข้าใจคำถาม ลองถามเกี่ยวกับการเงิน เกม หรือการเรียนได้เลยครับ",
        "ผมพร้อมช่วยเหลือทุกเรื่องทั้งการเงิน การเรียน และแนะแนว ลองถามแบบเจาะจงดูครับ เช่น อยากออมเงิน เริ่มยังไงดี?",
        "ถ้าอยากได้ความรู้ใหม่ๆ หรือกำลังใจในการเรียน/ทำงานก็บอกผมได้เลยครับ!"
    ];
}

            // Randomize ตอบให้ดูฉลาด
            const reply = responses[Math.floor(Math.random() * responses.length)];
            resolve(reply);
        }, 500);
    });
}
