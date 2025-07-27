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

// ================== Firebase Initialization ==================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ================== Global State ==================
let transactions = [];
let goals = [];
let currentGoalIndex = 0;
let unsubscribeListeners = [];
const allBadges = [ // Define all available badges for the application
    { id: 'first_transaction', name: 'นักบันทึกมือใหม่', description: 'บันทึกธุรกรรมแรกของคุณ', icon: '✍️' },
    { id: 'first_goal', name: 'ผู้ตั้งเป้าหมาย', description: 'สร้างเป้าหมายการออมแรก', icon: '🎯' },
    { id: 'saving_streak_3', name: 'ออมต่อเนื่อง 3 วัน', description: 'บันทึกรายรับหรือการออม 3 วันติด', icon: '🔥' },
    // Add other badges here
];


// ================== Authentication Observer ==================
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in
        console.log("User logged in:", user.uid);
        attachRealtimeListeners(user.uid);
        giveDailyLoginReward(user.uid);
    } else {
        // User is signed out
        console.log("User logged out.");
        detachRealtimeListeners();
        resetUIToLoggedOutState();
    }
});


// ================== Real-time Data Listeners ==================
function attachRealtimeListeners(uid) {
    detachRealtimeListeners(); // Ensure no lingering listeners

    // --- Profile Listener ---
    const userProfileListener = onSnapshot(doc(db, 'users', uid), (docSnapshot) => {
        if (docSnapshot.exists()) {
            const userData = docSnapshot.data();
            updateProfileUI(userData, auth.currentUser);
            renderShop(userData); // Update shop based on user data
        } else {
            // Create a new user profile if it doesn't exist
            const newUserProfile = {
                displayName: auth.currentUser.displayName || "ผู้ใช้ใหม่",
                level: "Level 1 – ผู้เริ่มต้น",
                xp: 0,
                nextLevelXP: 100,
                quote: "เริ่มต้นเล็กๆ สร้างนิสัยยิ่งใหญ่!",
                badges: [],
                coins: 0,
                inventory: [],
                lastLoginReward: ''
            };
            setDoc(doc(db, 'users', uid), newUserProfile);
        }
    }, (error) => console.error("Error listening to user profile:", error));

    // --- Transactions Listener ---
    const transactionsQuery = query(collection(db, 'users', uid, 'transactions'), orderBy('date', 'desc'));
    const transactionsListener = onSnapshot(transactionsQuery, (snapshot) => {
        transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        displayTransactions();
        updateFinancialSummary();
    }, (error) => console.error("Error listening to transactions:", error));

    // --- Goals Listener ---
    const goalsQuery = query(collection(db, 'users', uid, 'goals'), orderBy('createdAt', 'desc'));
    const goalsListener = onSnapshot(goalsQuery, (snapshot) => {
        goals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        currentGoalIndex = 0;
        displayGoals();
    }, (error) => console.error("Error listening to goals:", error));

    unsubscribeListeners = [userProfileListener, transactionsListener, goalsListener];
}

function detachRealtimeListeners() {
    unsubscribeListeners.forEach(unsubscribe => unsubscribe());
    unsubscribeListeners = [];
    console.log("Detached all real-time listeners.");
}

// ================== Shop & Daily Reward System ==================
const shopItems = [
    { id: 'bank', name: 'เหรียญนักออม', price: 100, icon: '🏦' },
    { id: 'invest', name: 'เหรียญนักลงทุน', price: 120, icon: '💹' },
    { id: 'planner', name: 'เหรียญวางแผน', price: 110, icon: '📝' },
    { id: 'debt', name: 'เหรียญปลอดหนี้', price: 90, icon: '💸' },
    { id: 'income', name: 'เหรียญรายรับหลายทาง', price: 80, icon: '🌐' },
    { id: 'entrepreneur', name: 'เหรียญผู้ประกอบการ', price: 150, icon: '💡' }
];

function renderShop(user) {
    const shopContainer = document.getElementById('shopItemsRow');
    if (!shopContainer) return;

    document.getElementById('userCoins').textContent = user.coins || 0;
    const inventory = user.inventory || [];
    shopContainer.innerHTML = '';

    // This version shows ALL items, but purchased ones are disabled
    shopItems.forEach(item => {
        const isPurchased = inventory.includes(item.id);
        const userCoins = user.coins || 0;
        const canAfford = userCoins >= item.price;

        const el = document.createElement('div');
        el.className = `shop-item ${isPurchased ? 'unlocked' : ''}`;
        el.innerHTML = `
            <div class="item-icon">${item.icon}</div>
            <div class="item-name">${item.name}</div>
            <div class="item-price">${item.price} 🪙</div>
            <button
                onclick="buyItem('${user.uid}', '${item.id}', ${item.price})"
                ${isPurchased ? 'disabled' : ''}
                ${!isPurchased && !canAfford ? 'disabled' : ''}
                class="${!isPurchased && !canAfford ? 'cannot-afford' : ''}"
            >
                ${isPurchased ? 'ซื้อแล้ว' : 'ซื้อ'}
            </button>
        `;
        shopContainer.appendChild(el);
    });
}

async function buyItem(uid, itemId, price) {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) return alert('Error: ไม่พบข้อมูลผู้ใช้');

    const user = userSnap.data();
    if ((user.coins || 0) < price) return alert('เหรียญไม่พอสำหรับซื้อไอเทมนี้');
    if ((user.inventory || []).includes(itemId)) return alert('คุณมีไอเทมนี้อยู่แล้ว');

    try {
        await updateDoc(userRef, {
            coins: increment(-price),
            inventory: arrayUnion(itemId)
        });
        alert('ซื้อไอเทมสำเร็จ!');
    } catch (error) {
        console.error("Error buying item:", error);
        alert('เกิดข้อผิดพลาดในการซื้อ: ' + error.message);
    }
}


async function giveDailyLoginReward(uid) {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) return;

    const user = userSnap.data();
    const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD format

    if (user.lastLoginReward !== todayStr) {
        try {
            await updateDoc(userRef, {
                coins: increment(25),
                lastLoginReward: todayStr
            });
            alert('รับเหรียญล็อกอินประจำวัน +25 เหรียญ!');
        } catch (error) {
            console.error("Error giving daily reward:", error);
        }
    }
}

// ================== UI Update Functions ==================
function resetUIToLoggedOutState() {
    updateProfileUI({}, null);
    updateFinancialSummary(); // Will clear summaries as transactions array is empty
    document.getElementById('transactionsContainer').innerHTML = '<p class="no-transactions-message">กรุณาเข้าสู่ระบบเพื่อดูรายการธุรกรรม</p>';
    document.getElementById('goalTitle').textContent = "- กรุณาเข้าสู่ระบบ -";
    document.getElementById('goalAmount').textContent = "เป้าหมาย: 0.00 ฿";
    document.getElementById('goalSavings').textContent = "ออมแล้ว: 0.00 ฿";
    document.getElementById('goalProgressBar').style.width = '0%';
    document.getElementById('goalProgressBar').textContent = '0%';
    document.getElementById('goalDueDate').textContent = "กำหนด: -";
    document.getElementById('prevGoal').style.display = 'none';
    document.getElementById('nextGoal').style.display = 'none';
    // Clear shop as well
    const shopContainer = document.getElementById('shopItemsRow');
    if (shopContainer) shopContainer.innerHTML = '<p class="no-transactions-message">กรุณาเข้าสู่ระบบเพื่อดูร้านค้า</p>';
    document.getElementById('userCoins').textContent = '0';
}

function updateProfileUI(userData, user) {
    const defaultAvatar = 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png';
    document.getElementById('profilePicture').src = user?.photoURL || defaultAvatar;
    document.getElementById('usernameDisplay').textContent = userData?.displayName || user?.displayName || 'ผู้ใช้ใหม่';
    document.getElementById('userLevel').textContent = userData?.level || "Level 1 – ผู้เริ่มต้น";
    document.getElementById('userQuote').textContent = `"${userData?.quote || 'เริ่มต้นเล็กๆ สร้างนิสัยยิ่งใหญ่!'}"`;

    const currentXP = userData?.xp || 0;
    const nextLevelXP = userData?.nextLevelXP || 100;
    const progressPercent = nextLevelXP > 0 ? (currentXP / nextLevelXP) * 100 : 0;
    document.getElementById('userProgress').style.width = `${progressPercent}%`;
    document.getElementById('progressValue').textContent = `${Math.round(progressPercent)}%`;
    document.getElementById('currentXP').textContent = currentXP;
    document.getElementById('nextLevelXP').textContent = nextLevelXP;

    const badgesContainer = document.getElementById('userBadges');
    badgesContainer.innerHTML = '';
    const userUnlockedBadgeIds = userData?.badges || [];
    if (allBadges.length > 0) {
        allBadges.forEach(badgeData => {
            const badgeDiv = document.createElement('div');
            badgeDiv.classList.add('badge');
            const isUnlocked = userUnlockedBadgeIds.includes(badgeData.id);
            badgeDiv.classList.toggle('unlocked', isUnlocked);
            badgeDiv.classList.toggle('locked', !isUnlocked);
            badgeDiv.setAttribute('title', `${isUnlocked ? '' : 'ล็อค - '}${badgeData.name}: ${badgeData.description}`);
            badgeDiv.textContent = badgeData.icon;
            badgesContainer.appendChild(badgeDiv);
        });
    } else {
        badgesContainer.innerHTML = '<div class="badge placeholder" title="ยังไม่มีเหรียญตรา">❓</div>';
    }
}

function updateFinancialSummary() {
    const totalIncome = transactions.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    const totalExpense = transactions.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    const balance = totalIncome - totalExpense;

    document.getElementById('income').textContent = `${totalIncome.toFixed(2)} ฿`;
    document.getElementById('expense').textContent = `${totalExpense.toFixed(2)} ฿`;
    document.getElementById('balance').textContent = `${balance.toFixed(2)} ฿`;
}

function displayTransactions() {
    const container = document.getElementById('transactionsContainer');
    container.innerHTML = '';
    if (transactions.length === 0) {
        container.innerHTML = '<p class="no-transactions-message">ไม่มีรายการธุรกรรมในขณะนี้</p>';
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
            <button class="delete-btn" onclick="window.deleteTransaction('${tx.id}')">&times;</button>
        `;
        container.appendChild(item);
    });
}

function displayGoals() {
    const prevBtn = document.getElementById('prevGoal');
    const nextBtn = document.getElementById('nextGoal');

    if (goals.length === 0) {
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
window.deleteTransaction = async function(transactionId) {
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

// ================== DOM Event Listeners ==================
document.addEventListener('DOMContentLoaded', () => {
    // Goal Form Submission
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
                messageDiv.style.color = "red";
                return;
            }

            try {
                await addDoc(collection(db, "users", user.uid, "goals"), {
                    name, targetAmount, savings, dueDate,
                    createdAt: serverTimestamp()
                });
                messageDiv.textContent = "สร้างเป้าหมายสำเร็จ!";
                messageDiv.style.color = "green";
                goalForm.reset();
                setTimeout(closeGoalModal, 1000);
            } catch (error) {
                messageDiv.textContent = "เกิดข้อผิดพลาด: " + error.message;
                messageDiv.style.color = "red";
                console.error("Error adding goal: ", error);
            }
        });
    }

    // Goal Navigation
    document.getElementById('prevGoal')?.addEventListener('click', () => { currentGoalIndex--; displayGoals(); });
    document.getElementById('nextGoal')?.addEventListener('click', () => { currentGoalIndex++; displayGoals(); });

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

// ================== AI Chatbot Logic (Unchanged) ==================
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

            if (txt.match(/(สวัสดี|hello|hi|หวัดดี|ทัก|ดี)/)) {
                responses = ["สวัสดีครับ! ผมคือ AI ผู้ช่วยด้านการเงิน มีอะไรให้ช่วยไหมครับ 😊", "ยินดีต้อนรับ! อยากคุยเรื่องการออมหรือการลงทุนไหมครับ"];
            } else if (txt.match(/(ออม|วิธีออม|เก็บเงิน)/)) {
                responses = ["เริ่มต้นด้วยการตั้งเป้าหมายเล็กๆ แล้วบันทึกรายจ่ายทุกวันครับ", "ลองใช้สูตร 50/30/20 ดูสิครับ: 50% ใช้จ่ายจำเป็น, 30% ส่วนตัว, 20% ออม/ลงทุน"];
            } else if (txt.match(/(เกม|เควส|เหรียญ|ร้านค้า|level|แต้ม)/)) {
                responses = ["สะสมเหรียญจากการล็อกอินและทำภารกิจเพื่อแลกไอเทมในร้านค้าได้เลยครับ!", "การทำธุรกรรมและการตั้งเป้าหมายจะช่วยเพิ่ม XP ให้อัพเลเวลได้ครับ"];
            } else if (txt.match(/(ลงทุน|หุ้น|กองทุน)/)) {
                responses = ["การลงทุนมีความเสี่ยง ควรเริ่มศึกษาจากกองทุนรวมก่อนนะครับ", "อย่าลืมกระจายความเสี่ยงโดยลงทุนในสินทรัพย์หลากหลายประเภทครับ"];
            } else if (txt.match(/(เทคนิค|trick|เคล็ดลับ)/)) {
                responses = ["วิธีออมที่ง่ายที่สุดคือ 'ออมก่อนใช้' ครับ เมื่อมีรายรับเข้ามา ให้หักส่วนหนึ่งไปออมทันที", "ลองท้าทายตัวเองด้วยการ 'งดใช้จ่ายฟุ่มเฟือย' หนึ่งวันในสัปดาห์ดูสิครับ"];
            } else {
                responses = ["ขออภัยครับ ผมยังไม่เข้าใจ ลองถามเกี่ยวกับการออมเงิน การลงทุน หรือการใช้งานแอปได้เลยครับ", "ผมพร้อมให้คำแนะนำด้านการเงิน ลองถามคำถามอื่นดูนะครับ"];
            }

            const reply = responses[Math.floor(Math.random() * responses.length)];
            resolve(reply);
        }, 500);
    });
}