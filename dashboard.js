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
    query, orderBy, addDoc, deleteDoc, serverTimestamp, arrayUnion, increment, runTransaction
} from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js';

// ================== Firebase Initialization ==================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ================== Game Mechanics (XP & Levels) ==================

// Configuration for levels, names, and XP requirements
const LEVEL_CONFIG = [
    { level: 1, name: "ผู้เริ่มต้น", xpToNext: 100 },
    { level: 2, name: "นักออมฝึกหัด", xpToNext: 250 },
    { level: 3, name: "นักสะสมเหรียญ", xpToNext: 500 },
    { level: 4, name: "ผู้เชี่ยวชาญการเงิน", xpToNext: 1000 },
    { level: 5, name: "เศรษฐีหน้าใหม่", xpToNext: Infinity }, // Max level
];

/**
 * Adds XP to the user and checks for level-ups using a transaction.
 * This function handles single and multiple level-ups correctly.
 * @param {string} uid - The user's ID.
 * @param {number} amount - The amount of XP to add.
 */
async function addXP(uid, amount) {
    if (!uid || !amount || amount <= 0) return;
    
    const userRef = doc(db, 'users', uid);
    try {
        await runTransaction(db, async (transaction) => {
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists()) {
                throw "Document does not exist!";
            }

            // Get current user data from the transaction
            const userData = userSnap.data();
            let xp = userData.xp || 0;
            let level = userData.level || 1;
            let nextLevelXP = userData.nextLevelXP || LEVEL_CONFIG[0].xpToNext;
            
            let totalCoinReward = 0;
            
            // Add new XP
            xp += amount;

            // Loop to handle potential multiple level-ups
            while (xp >= nextLevelXP && nextLevelXP !== Infinity) {
                const currentLevelIndex = LEVEL_CONFIG.findIndex(l => l.level === level);
                
                if (currentLevelIndex < LEVEL_CONFIG.length - 1) {
                    const nextLevelInfo = LEVEL_CONFIG[currentLevelIndex + 1];
                    const rewardForThisLevel = 100 + (nextLevelInfo.level * 25);
                    
                    totalCoinReward += rewardForThisLevel;
                    xp -= nextLevelXP; // Carry over remaining XP to the next level
                    level = nextLevelInfo.level;
                    nextLevelXP = nextLevelInfo.xpToNext;

                    // Show level up alert (outside the transaction logic)
                    setTimeout(() => {
                       alert(`🎉 ยินดีด้วย! คุณเลเวลอัพเป็น Level ${nextLevelInfo.level} – ${nextLevelInfo.name}!\nได้รับ ${rewardForThisLevel} เหรียญ!`);
                    }, 100);
                } else {
                    // Reached max level, break the loop
                    break;
                }
            }
            
            // Prepare the final data object for a single atomic update
            const finalUpdateData = {
                xp: xp,
                level: level,
                nextLevelXP: nextLevelXP,
            };
            if (totalCoinReward > 0) {
                finalUpdateData.coins = increment(totalCoinReward);
            }
            
            // Perform a single, combined update at the end of the transaction
            transaction.update(userRef, finalUpdateData);
        });
    } catch (error) {
        console.error("Error adding XP and leveling up: ", error);
        alert("เกิดข้อผิดพลาดในการเพิ่ม XP และอัปเดตเลเวล");
    }
}


// ================== Global State ==================
let transactions = [];
let goals = [];
let currentGoalIndex = 0;
let unsubscribeListeners = [];
const allBadges = [ // Define all available badges for the application
    { id: 'first_transaction', name: 'นักบันทึกมือใหม่', description: 'บันทึกธุรกรรมแรกของคุณ', icon: '✍️' },
    { id: 'first_goal', name: 'ผู้ตั้งเป้าหมาย', description: 'สร้างเป้าหมายการออมแรก', icon: '🎯' },
    { id: 'saving_streak_3', name: 'ออมต่อเนื่อง 3 วัน', description: 'บันทึกรายรับหรือการออม 3 วันติด', icon: '🔥' },
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
    detachRealtimeListeners(); 

    // --- Profile Listener ---
    const userProfileListener = onSnapshot(doc(db, 'users', uid), (docSnapshot) => {
        if (docSnapshot.exists()) {
            const userData = docSnapshot.data();
            updateProfileUI(userData, auth.currentUser);
            renderShop(userData); 
        } else {
            // Create a new user profile if it doesn't exist
            const newUserProfile = {
                displayName: auth.currentUser.displayName || "ผู้ใช้ใหม่",
                level: 1, // Store level number instead of string
                xp: 0,
                nextLevelXP: LEVEL_CONFIG[0].xpToNext, // Get initial XP requirement from config
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
    { id: 'entrepreneur', name: 'เหรียญผู้ประกอบการ', price: 150, icon: '💡' },
    { id: 'dreamer', name: 'เหรียญนักฝัน', price: 70, icon: '💭' },
    { id: 'superstar', name: 'เหรียญดาวรุ่ง', price: 200, icon: '🌟' },
    { id: 'gold', name: 'เหรียญทองคำ', price: 300, icon: '🪙' }
];

/**
 * Renders the shop and purchased items into two separate containers.
 * @param {object} user - The user data object from Firestore.
 */
function renderShop(user) {
    const shopContainer = document.getElementById('shopItemsRow');
    const purchasedContainer = document.getElementById('purchasedItemsContainer');
    const userCoinsEl = document.getElementById('userCoins');

    if (!purchasedContainer || !userCoinsEl) {
        console.warn("Could not find 'purchasedItemsContainer' or 'userCoins'. Shop rendering skipped.");
        return;
    }
    
    userCoinsEl.textContent = user.coins || 0;
    const inventory = user.inventory || [];

    purchasedContainer.innerHTML = '';
    if (shopContainer) {
        shopContainer.innerHTML = '';
    }

    let hasPurchasedItems = false;
    let hasShopItems = false;
    const userCoins = user.coins || 0;

    shopItems.forEach(item => {
        const isPurchased = inventory.includes(item.id);

        if (isPurchased) {
            hasPurchasedItems = true;
            const purchasedEl = document.createElement('div');
            purchasedEl.className = 'purchased-item';
            purchasedEl.innerHTML = `
                <span class="purchased-icon">${item.icon}</span>
                <span class="purchased-name">${item.name}</span>
            `;
            purchasedContainer.appendChild(purchasedEl);
        } else if (shopContainer) { 
            hasShopItems = true;
            const canAfford = userCoins >= item.price;
            const shopEl = document.createElement('div');
            shopEl.className = 'shop-item';
            shopEl.innerHTML = `
                <div class="item-icon">${item.icon}</div>
                <div class="item-name">${item.name}</div>
                <div class="item-price">${item.price} 🪙</div>
                <button
                    onclick="buyItem('${auth.currentUser.uid}', '${item.id}', ${item.price})"
                    ${!canAfford ? 'disabled' : ''}
                    class="${!canAfford ? 'cannot-afford' : ''}"
                >
                    ซื้อ
                </button>
            `;
            shopContainer.appendChild(shopEl);
        }
    });

    if (!hasPurchasedItems) {
        purchasedContainer.innerHTML = '<p class="placeholder-message">ยังไม่มีเหรียญรางวัล</p>';
    }
    if (shopContainer && !hasShopItems) {
        shopContainer.innerHTML = '<p class="placeholder-message">คุณซื้อเหรียญรางวัลทั้งหมดแล้ว!</p>';
    }
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
                lastLoginReward: todayStr
            });
            await addXP(uid, 15); // Grant 15 XP for daily login
            alert('รับรางวัลล็อกอินประจำวัน +15 XP!');
        } catch (error) {
            console.error("Error giving daily reward:", error);
        }
    }
}

// ================== UI Update Functions ==================
function resetUIToLoggedOutState() {
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

    // Clear shop and purchased items on logout
    const shopContainer = document.getElementById('shopItemsRow');
    const purchasedContainer = document.getElementById('purchasedItemsContainer');
    if (shopContainer) shopContainer.innerHTML = '<p class="placeholder-message">กรุณาเข้าสู่ระบบเพื่อดูร้านค้า</p>';
    if (purchasedContainer) purchasedContainer.innerHTML = '<p class="placeholder-message">กรุณาเข้าสู่ระบบเพื่อดูเหรียญรางวัล</p>';
    document.getElementById('userCoins').textContent = '0';
}

function updateProfileUI(userData, user) {
    const defaultAvatar = 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png';
    document.getElementById('profilePicture').src = user?.photoURL || defaultAvatar;
    document.getElementById('usernameDisplay').textContent = userData?.displayName || user?.displayName || 'ผู้ใช้ใหม่';
    document.getElementById('userQuote').textContent = `"${userData?.quote || 'เริ่มต้นเล็กๆ สร้างนิสัยยิ่งใหญ่!'}"`;
    
    const userLevelNum = userData?.level || 1;
    const levelInfo = LEVEL_CONFIG.find(l => l.level === userLevelNum) || LEVEL_CONFIG[0];
    document.getElementById('userLevel').textContent = `Level ${levelInfo.level} – ${levelInfo.name}`;

    const currentXP = userData?.xp || 0;
    const nextLevelXP = userData?.nextLevelXP === Infinity ? 'MAX' : (userData?.nextLevelXP || levelInfo.xpToNext);
    const progressPercent = nextLevelXP !== 'MAX' && nextLevelXP > 0 ? (currentXP / nextLevelXP) * 100 : 100;
    
    document.getElementById('userProgress').style.width = `${progressPercent}%`;
    document.getElementById('progressValue').textContent = `${Math.round(progressPercent)}%`;
    document.getElementById('currentXP').textContent = currentXP;
    document.getElementById('nextLevelXP').textContent = nextLevelXP;

    const badgesContainer = document.getElementById('userBadges');
    if (badgesContainer) {
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
        document.getElementById('goalTitle').style.display = 'none';
        document.getElementById('goalAmount').style.display = 'none';
        document.getElementById('goalSavings').style.display = 'none';
        document.getElementById('goalProgressBar').parentElement.style.display = 'none';
        document.getElementById('goalDueDate').style.display = 'none';
        document.getElementById('noGoalMsg').style.display = 'block';
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
        return;
    }
    
    document.getElementById('noGoalMsg').style.display = 'none';
    document.getElementById('goalTitle').style.display = 'block';
    document.getElementById('goalAmount').style.display = 'block';
    document.getElementById('goalSavings').style.display = 'block';
    document.getElementById('goalProgressBar').parentElement.style.display = 'flex';
    document.getElementById('goalDueDate').style.display = 'block';
    prevBtn.style.display = goals.length > 1 ? 'block' : 'none';
    nextBtn.style.display = goals.length > 1 ? 'block' : 'none';

    if (currentGoalIndex < 0) currentGoalIndex = goals.length - 1;
    if (currentGoalIndex >= goals.length) currentGoalIndex = 0;

    const goal = goals[currentGoalIndex];
    
    // ✅✅✅ This is the corrected part. It checks for 'targetAmount' first, then falls back to 'target'.
    const target = parseFloat(goal.targetAmount || goal.target || 0);
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
                
                await addXP(user.uid, 50); 
                
                messageDiv.textContent = "สร้างเป้าหมายสำเร็จ! (+50 XP)";
                messageDiv.style.color = "green";
                goalForm.reset();
                setTimeout(closeGoalModal, 1500);
            } catch (error) {
                messageDiv.textContent = "เกิดข้อผิดพลาด: " + error.message;
                messageDiv.style.color = "red";
                console.error("Error adding goal: ", error);
            }
        });
    }

    document.getElementById('prevGoal')?.addEventListener('click', () => { currentGoalIndex--; displayGoals(); });
    document.getElementById('nextGoal')?.addEventListener('click', () => { currentGoalIndex++; displayGoals(); });

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
function openGoalModal() { document.getElementById('goalModal').style.display = 'flex'; }
window.closeGoalModal = function() {
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

/**
 * ฟังก์ชันจำลองการตอบกลับของ AI
 * @param {string} message - ข้อความจากผู้ใช้
 * @returns {Promise<string>} - คำตอบของ AI
 */
async function getAiResponse(message) {
    return new Promise(resolve => {
        // จำลองการหน่วงเวลาเพื่อความสมจริง
        setTimeout(() => {
            const txt = message.toLowerCase();
            let responses = [];

            // ตรวจจับ Keyword และเลือกชุดคำตอบที่เหมาะสม
            if (txt.match(/(สวัสดี|hello|hi|หวัดดี|ทัก|ดี)/)) {
                responses = ["สวัสดีครับ! ผมคือ 'เพื่อนซี้การเงิน' มีอะไรให้ช่วยไหมครับ 😊", "ยินดีต้อนรับ! อยากคุยเรื่องการออมหรือการลงทุนไหมครับ"];
            } else if (txt.match(/(คุณคือใคร|ชื่ออะไร|ทำอะไรได้บ้าง)/)) {
                responses = [
                    "ผมคือ 'เพื่อนซี้การเงิน' ครับ! เป็น AI ที่จะช่วยให้คุณวางแผนการเงิน, ออมเงิน, และลงทุนได้อย่างสนุกและง่ายขึ้นครับ",
                    "ผมสามารถให้คำแนะนำเรื่องการออม, การลงทุน, การจัดการหนี้, และการวางแผนงบประมาณได้ครับ ลองถามผมได้เลย!"
                ];
            } else if (txt.match(/(สงสัย|สอบถาม|ถาม|คำถาม|อยากรู้)/)) {
                responses = [
                    "แน่นอนครับ! ถามเรื่องการเงินมาได้เลยครับ",
                    "สงสัยเรื่องอะไรถามได้เลยครับ ผมพร้อมช่วยเต็มที่!",
                    "ได้เลยครับ มีคำถามอะไรให้ผมช่วยไหมครับ?"
                ];
            } else if (txt.match(/(ออม|วิธีออม|เก็บเงิน|อยากออมเงิน)/)) {
                responses = [
                    "เริ่มต้นด้วยการตั้งเป้าหมายเล็กๆ แล้วบันทึกรายจ่ายทุกวันครับ การเห็นภาพรวมจะช่วยให้วางแผนง่ายขึ้น",
                    "ลองใช้สูตร 50/30/20 ดูสิครับ: 50% สำหรับรายจ่ายจำเป็น, 30% สำหรับความต้องการส่วนตัว, และ 20% สำหรับการออมและการลงทุนครับ",
                    "เทคนิค 'ออมก่อนใช้' คือวิธีที่ได้ผลดีมากครับ เมื่อมีรายรับเข้ามา ให้รีบโอนเงินส่วนหนึ่งไปเก็บในบัญชีเงินออมทันที"
                ];
            } else if (txt.match(/(เกม|เควส|เหรียญ|ร้านค้า|level|แต้ม|xp)/)) {
                responses = [
                    "คุณจะได้รับ XP และเหรียญจากการทำกิจกรรมต่างๆ เช่น ล็อกอินรายวัน, บันทึกรายรับ-รายจ่าย, และสร้างเป้าหมายการออมครับ",
                    "XP ใช้สำหรับเพิ่มเลเวล ส่วนเหรียญสามารถนำไปซื้อไอเทมตกแต่งโปรไฟล์ในร้านค้าได้ครับ ลองเข้าไปดูสิ!",
                    "ยิ่งเลเวลสูงขึ้น ก็จะปลดล็อครางวัลและคำคมใหม่ๆ ด้วยนะครับ พยายามเข้า!"
                ];
            } else if (txt.match(/(ลงทุน|หุ้น|กองทุน|ตลาดหุ้น)/)) {
                responses = [
                    "การลงทุนมีความเสี่ยง แต่ก็เป็นหนทางสร้างความมั่งคั่งในระยะยาวครับ สำหรับมือใหม่ แนะนำให้เริ่มศึกษาจาก 'กองทุนรวมดัชนี' (Index Fund) เพราะมีความเสี่ยงต่ำและกระจายการลงทุนที่ดี",
                    "อย่าลืมหลักการ 'DCA' (Dollar-Cost Averaging) นะครับ คือการทยอยลงทุนเป็นงวดๆ ด้วยจำนวนเงินเท่าๆ กัน จะช่วยลดความเสี่ยงจากความผันผวนของตลาดได้ดี",
                    "ก่อนลงทุน ควรมี 'เงินสำรองฉุกเฉิน' ประมาณ 3-6 เท่าของค่าใช้จ่ายต่อเดือนก่อนนะครับ จะได้อุ่นใจ"
                ];
            } else if (txt.match(/(หนี้|หนี้สิน|บัตรเครดิต|ผ่อน)/)) {
                responses = [
                    "การจัดการหนี้ที่ดีคือหัวใจของสุขภาพการเงินครับ ควรลิสต์รายการหนี้ทั้งหมดแล้วเริ่มชำระจากตัวที่มีดอกเบี้ยสูงสุดก่อน หรือที่เรียกว่าวิธี 'Avalanche'",
                    "บัตรเครดิตมีประโยชน์ถ้าใช้อย่างชาญฉลาด พยายามชำระเต็มจำนวนทุกเดือนเพื่อหลีกเลี่ยงดอกเบี้ยนะครับ",
                    "หากมีหนี้หลายก้อน ลองพิจารณา 'การรวมหนี้' (Debt Consolidation) เพื่อให้จัดการง่ายขึ้นและอาจได้ดอกเบี้ยที่ถูกลง"
                ];
            } else if (txt.match(/(งบประมาณ|วางแผน|budget|จัดการเงิน)/)) {
                 responses = [
                    "การทำงบประมาณไม่ยากเลยครับ แค่ลองจดบันทึกรายรับและรายจ่ายทั้งหมดใน 1 เดือน คุณจะเห็นเลยว่าเงินของคุณหายไปไหนบ้าง",
                    "แอปของเราช่วยคุณได้! แค่บันทึกทุกรายการในหน้า 'บันทึกรายจ่าย' แล้วไปดูสรุปในหน้า 'กราฟการเงิน' ได้เลยครับ",
                    "เมื่อรู้พฤติกรรมการใช้เงินแล้ว ลองตั้งงบในแต่ละหมวดหมู่ดูสิครับ เช่น ค่าอาหาร, ค่าเดินทาง แล้วพยายามใช้ไม่ให้เกินงบ"
                 ];
            } else if (txt.match(/(ภาษี|ลดหย่อน|ยื่นภาษี)/)) {
                responses = [
                    "การวางแผนภาษีเป็นสิ่งสำคัญนะครับ ลองศึกษาเรื่องค่าลดหย่อนต่างๆ เช่น ประกันชีวิต, RMF, SSF จะช่วยให้คุณประหยัดภาษีได้เยอะเลย",
                    "อย่าลืมยื่นภาษีภายในเวลาที่กำหนดนะครับ การยื่นออนไลน์สมัยนี้สะดวกและรวดเร็วมากครับ"
                ];
            } else if (txt.match(/(ประกัน|insurance)/)) {
                responses = [
                    "การทำประกันเหมือนมีร่มไว้กันฝนครับ ช่วยป้องกันความเสี่ยงเรื่องค่าใช้จ่ายที่ไม่คาดฝัน เช่น ค่ารักษาพยาบาล",
                    "ประกันมีหลายแบบครับ ทั้งประกันชีวิต, ประกันสุขภาพ, ประกันอุบัติเหตุ ควรเลือกให้เหมาะกับความต้องการและไลฟ์สไตล์ของเรานะครับ"
                ];
            } else if (txt.match(/(เป้าหมาย|goal)/)) {
                responses = [
                    "การตั้งเป้าหมายการเงินที่ชัดเจนจะทำให้เรามีแรงบันดาลใจครับ ลองตั้งเป้าหมายระยะสั้น (เช่น เก็บเงินเที่ยว) และระยะยาว (เช่น เก็บเงินดาวน์บ้าน) ดูสิครับ",
                    "ลองใช้ฟีเจอร์ 'เป้าหมายของฉัน' ในแอปดูสิครับ จะช่วยให้คุณติดตามความคืบหน้าได้ง่ายขึ้นเยอะเลย!"
                ];
            } else if (txt.match(/(เครดิต|บูโร|credit score)/)) {
                responses = [
                    "เครดิตบูโร หรือ ข้อมูลเครดิตแห่งชาติ คือประวัติการชำระหนี้ของเราครับ การมีประวัติที่ดีจะช่วยให้ขอสินเชื่อในอนาคตได้ง่ายขึ้น",
                    "พยายามชำระหนี้ให้ตรงเวลาเสมอ และไม่สร้างหนี้เกินตัว จะช่วยรักษาเครดิตสกอร์ให้ดีได้ครับ"
                ];
            } else if (txt.match(/(ขอบคุณ|thank)/)) {
                responses = ["ยินดีเสมอครับ! มีอะไรให้ช่วยอีกไหมครับ 😊", "ด้วยความยินดีครับ! ขอให้สนุกกับการออมนะครับ"];
            } else {
                // คำตอบสำหรับกรณีที่ไม่พบ Keyword ที่ตรงกัน
                responses = [
                    "ขออภัยครับ ผมยังไม่เข้าใจคำถามนี้ ลองถามเกี่ยวกับการออมเงิน, การลงทุน, ภาษี, หรือการใช้งานแอปดูนะครับ",
                    "ผมกำลังเรียนรู้เพิ่มเติมครับ ลองถามคำถามอื่นเกี่ยวกับการเงินดูได้เลย",
                    "เรื่องนี้อาจจะซับซ้อนเกินไปสำหรับผม ลองถามคำถามที่เฉพาะเจาะจงมากขึ้นได้ไหมครับ เช่น 'วิธีลดหย่อนภาษี' หรือ 'กองทุนรวมคืออะไร'"
                ];
            }

            // สุ่มเลือกคำตอบจากรายการ
            const reply = responses[Math.floor(Math.random() * responses.length)];
            resolve(reply);
        }, 500); // หน่วงเวลา 0.5 วินาที
    });
}
