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
    { level: 1, name: "ผู้เริ่มต้น", xpToNext: 100, quote: "เริ่มต้นเล็กๆ สร้างนิสัยยิ่งใหญ่!" },
    { level: 2, name: "นักออมฝึกหัด", xpToNext: 250, quote: "ทุกการออมเล็กๆ สร้างความมั่งคั่งที่ยิ่งใหญ่!" },
    { level: 3, name: "นักสะสมเหรียญ", xpToNext: 500, quote: "ความสม่ำเสมอคือกุญแจสู่ความสำเร็จทางการเงิน!" },
    { level: 4, name: "ผู้เชี่ยวชาญการเงิน", xpToNext: 1000, quote: "เงินทำงานให้คุณ ไม่ใช่คุณทำงานให้เงิน!" },
    { level: 5, name: "เศรษฐีหน้าใหม่", xpToNext: Infinity, quote: "อิสรภาพทางการเงินรอคุณอยู่!" }, // Max level
];

/**
 * Gets level information from LEVEL_CONFIG based on level number.
 * @param {number} level - The level number.
 * @returns {object} The level configuration object.
 */
function getLevelInfo(level) {
    // Ensure we don't go out of bounds for LEVEL_CONFIG
    const foundLevel = LEVEL_CONFIG.find(l => l.level === level);
    return foundLevel || LEVEL_CONFIG[0]; // Fallback to Level 1 if not found
}

/**
 * Adds XP to the user and checks for level-ups using a transaction.
 * This function handles single and multiple level-ups correctly.
 * @param {string} uid - The user's ID.
 * @param {number} amount - The amount of XP to add.
 */
async function addXP(uid, amount) {
    if (!uid) {
        console.warn("addXP: UID is missing.");
        return;
    }
    // Allow amount 0 for explicit level-up checks, but warn if it's explicitly < 0
    if (amount < 0) {
        console.warn("addXP: Invalid amount. Amount:", amount);
        return;
    }


    const userRef = doc(db, 'users', uid);
    let leveledUpMessages = []; // To store messages for modals after transaction

    try {
        await runTransaction(db, async (transaction) => {
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists()) {
                console.error("addXP: User document does not exist for UID:", uid);
                // Throw error to rollback transaction if user document is missing
                throw new Error("User document does not exist!");
            }

            // Get current user data from the transaction
            const userData = userSnap.data();
            let xp = userData.xp || 0;
            let level = userData.level || 1;
            // Ensure nextLevelXPThreshold is always based on the current level config
            let nextLevelXPThreshold = getLevelInfo(level).xpToNext;

            console.log(`addXP: Before update - XP: ${xp}, Level: ${level}, Next Level XP Threshold: ${nextLevelXPThreshold}`);

            let totalCoinReward = 0;
            leveledUpMessages = []; // Reset for each transaction attempt

            // Add new XP
            xp += amount;

            // Loop to handle potential multiple level-ups
            while (xp >= nextLevelXPThreshold && nextLevelXPThreshold !== Infinity) {
                const currentLevelInfo = getLevelInfo(level);
                const currentLevelIndex = LEVEL_CONFIG.findIndex(l => l.level === currentLevelInfo.level);

                if (currentLevelIndex < LEVEL_CONFIG.length - 1) { // Check if it's not the last level
                    const nextLevelInfo = LEVEL_CONFIG[currentLevelIndex + 1];
                    const rewardForThisLevel = 100 + (nextLevelInfo.level * 25); // Reward based on reaching *this* next level

                    totalCoinReward += rewardForThisLevel;
                    xp -= nextLevelXPThreshold; // Deduct XP required for the level just passed
                    level = nextLevelInfo.level; // Update level
                    nextLevelXPThreshold = nextLevelInfo.xpToNext; // Update threshold for the newly reached level

                    leveledUpMessages.push({
                        level: nextLevelInfo.level,
                        name: nextLevelInfo.name,
                        reward: rewardForThisLevel
                    });
                    console.log(`addXP: Leveled up! New Level: ${level}, Remaining XP: ${xp}, Next Level XP Threshold: ${nextLevelXPThreshold}`);
                } else {
                    // Reached max level
                    xp = Math.max(xp, nextLevelXPThreshold); // Cap XP at the max level's threshold if already at max
                    nextLevelXPThreshold = Infinity; // Set threshold to Infinity
                    console.log("addXP: Reached max level.");
                    break;
                }
            }

            // Also update the user's quote based on the new level
            const newQuote = getLevelInfo(level).quote;

            // Prepare the final data object for a single atomic update
            const finalUpdateData = {
                xp: xp,
                level: level,
                nextLevelXP: nextLevelXPThreshold, // Use the updated threshold
                quote: newQuote // Update quote based on new level
            };
            if (totalCoinReward > 0) {
                finalUpdateData.coins = increment(totalCoinReward);
            }

            transaction.update(userRef, finalUpdateData);
            console.log("addXP: Transaction update prepared with data:", finalUpdateData);
        });

        console.log("addXP: Transaction completed successfully.");

        // Display level-up modals sequentially AFTER the transaction commits
        for (const msg of leveledUpMessages) {
            showLevelUpModal(msg.level, msg.name, msg.reward);
            // Add a slight delay between multiple level-up modals if they happen
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

    } catch (error) {
        console.error("Error adding XP and leveling up:", error);
        // Using a custom modal for errors as well, instead of alert()
        showNotificationModal("เกิดข้อผิดพลาด", "เกิดข้อผิดพลาดในการเพิ่ม XP และอัปเดตเลเวล กรุณาลองใหม่อีกครั้ง: " + error.message);
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
    const userProfileListener = onSnapshot(doc(db, 'users', uid), async (docSnapshot) => { // Added async here
        if (docSnapshot.exists()) {
            const userData = docSnapshot.data();
            updateProfileUI(userData, auth.currentUser);
            renderShop(userData);
        } else {
            // Create a new user profile if it doesn't exist
            console.log("Creating new user profile for UID:", uid);
            const newUserProfile = {
                displayName: auth.currentUser.displayName || "ผู้ใช้ใหม่",
                level: 1, // Store level number instead of string
                xp: 0,
                nextLevelXP: LEVEL_CONFIG[0].xpToNext, // Get initial XP requirement from config
                quote: LEVEL_CONFIG[0].quote, // Use quote from LEVEL_CONFIG
                badges: [],
                coins: 0,
                inventory: [],
                lastLoginReward: ''
            };
            // Added await here to ensure the profile is written before potentially other operations
            try {
                await setDoc(doc(db, 'users', uid), newUserProfile);
                console.log("New user profile created successfully.");
            } catch (error) {
                console.error("Error creating new user profile:", error);
            }
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
        console.log("Goals onSnapshot triggered.");
        const oldCurrentGoalId = goals[currentGoalIndex] ? goals[currentGoalIndex].id : null; // Get ID of currently displayed goal

        goals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("Updated goals array:", goals);

        // Try to maintain the current goal if its ID still exists
        let newCurrentGoalIndex = 0; // Default to first goal
        if (oldCurrentGoalId) {
            const foundIndex = goals.findIndex(g => g.id === oldCurrentGoalId);
            if (foundIndex !== -1) {
                newCurrentGoalIndex = foundIndex;
            }
        }
        currentGoalIndex = newCurrentGoalIndex; // Update global currentGoalIndex

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
                    onclick="window.buyItem('${auth.currentUser.uid}', '${item.id}', ${item.price})"
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


window.buyItem = async function(uid, itemId, price) {
    const userRef = doc(db, 'users', uid);
    try {
        await runTransaction(db, async (transaction) => {
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists()) {
                // Using custom modal for error
                showNotificationModal("ข้อผิดพลาด", "ไม่พบข้อมูลผู้ใช้");
                return;
            }

            const user = userSnap.data();
            if ((user.coins || 0) < price) {
                // Using custom modal for error
                showNotificationModal("ไม่เพียงพอ", "เหรียญไม่พอสำหรับซื้อไอเทมนี้");
                return;
            }
            if ((user.inventory || []).includes(itemId)) {
                // Using custom modal for error
                showNotificationModal("มีอยู่แล้ว", "คุณมีไอเทมนี้อยู่แล้ว");
                return;
            }

            transaction.update(userRef, {
                coins: increment(-price),
                inventory: arrayUnion(itemId)
            });
            // Using custom modal for success
            showNotificationModal("ซื้อสำเร็จ!", "ซื้อไอเทมสำเร็จ!");
        });
    } catch (error) {
        console.error("Error buying item:", error);
        // Using custom modal for error
        showNotificationModal("เกิดข้อผิดพลาด", 'เกิดข้อผิดพลาดในการซื้อ: ' + error.message);
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
            showNotificationModal("รางวัลรายวัน", 'รับรางวัลล็อกอินประจำวัน +15 XP!');
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
    console.log("updateProfileUI triggered. UserData:", userData);
    // MODIFIED: Changed the default avatar URL to a black user icon
    const defaultAvatar = 'https://cdn-icons-png.flaticon.com/512/1144/1144760.png';
    document.getElementById('profilePicture').src = user?.photoURL || defaultAvatar;
    document.getElementById('usernameDisplay').textContent = userData?.displayName || user?.displayName || 'ผู้ใช้ใหม่';

    const userLevelNum = userData?.level || 1;
    console.log("Current userLevelNum from userData:", userLevelNum);

    const levelInfo = getLevelInfo(userLevelNum);
    console.log("LevelInfo based on userLevelNum:", levelInfo);

    document.getElementById('userQuote').textContent = `"${userData?.quote || levelInfo.quote}"`;

    document.getElementById('userLevel').textContent = `Level ${levelInfo.level} – ${levelInfo.name}`;

    const currentXP = userData?.xp || 0;
    console.log("XP from userData:", currentXP);

    // Determine the XP needed for the *next* level based on the current level's configuration.
    // This is the most reliable source for checking level-up conditions.
    const xpRequiredForNextLevel = levelInfo.xpToNext;

    // For display purposes, handle 'MAX' level differently
    const displayNextLevelXP = (xpRequiredForNextLevel === Infinity) ? 'MAX' : xpRequiredForNextLevel;

    console.log("Calculated displayNextLevelXP (from LEVEL_CONFIG):", displayNextLevelXP);
    console.log("XP required for next level (for check):", xpRequiredForNextLevel);


    const progressPercent = (displayNextLevelXP !== 'MAX' && displayNextLevelXP > 0) ? (currentXP / displayNextLevelXP) * 100 : 100;

    console.log("Calculated progressPercent:", progressPercent);

    document.getElementById('userProgress').style.width = `${Math.min(100, progressPercent)}%`;
    document.getElementById('progressValue').textContent = `${Math.round(Math.min(100, progressPercent))}%`;
    document.getElementById('currentXP').textContent = currentXP;
    document.getElementById('nextLevelXP').textContent = displayNextLevelXP;

    // ===== แก้ไขปัญหา XP เกินแต่ไม่อัปเลเวล =====
    // ใช้ xpRequiredForNextLevel สำหรับการตรวจสอบการเลเวลอัพจริง
    if (xpRequiredForNextLevel !== Infinity && currentXP >= xpRequiredForNextLevel) {
        if (auth.currentUser && !window.isLevelingUp) {
            window.isLevelingUp = true;
            console.log("XP exceeded required for next level. Attempting to trigger level up via addXP(0).");
            addXP(auth.currentUser.uid, 0).finally(() => {
                window.isLevelingUp = false;
                console.log("addXP(0) call finished. isLevelingUp reset.");
            });
        } else {
            console.log(`Level up condition met, but not triggering: isLevelingUp=${window.isLevelingUp}, auth.currentUser=${!!auth.currentUser}`);
        }
    }
    // ==========================================

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

    // Financial alert logic
    const alertElement = document.getElementById('financial-alert');
    if (!alertElement) return;

    if (totalIncome > 0) {
        const balancePercentage = (balance / totalIncome) * 100;

        if (balancePercentage < 30) {
            alertElement.textContent = '🚨 เงินคงเหลือน้อยกว่า 30%! ระบบจะจำกัดการสร้างรายจ่ายเพื่อช่วยคุณออม';
            alertElement.className = 'financial-alert danger';
            alertElement.style.display = 'block';
            localStorage.setItem('isSpendingBlocked', 'true'); // Use localStorage
        } else if (balancePercentage < 40) {
            alertElement.textContent = '⚠️ ระวัง! เงินคงเหลือของคุณน้อยกว่า 40% ของรายรับทั้งหมด ลองลดรายจ่ายที่ไม่จำเป็นดูนะ';
            alertElement.className = 'financial-alert warning';
            alertElement.style.display = 'block';
            localStorage.setItem('isSpendingBlocked', 'false'); // Use localStorage
        } else {
            alertElement.style.display = 'none';
            localStorage.setItem('isSpendingBlocked', 'false'); // Use localStorage
        }
    } else {
        alertElement.style.display = 'none';
        localStorage.setItem('isSpendingBlocked', 'false'); // Use localStorage
    }
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
            <button class="delete-btn" onclick="window.confirmDeleteTransaction('${tx.id}')">&times;</button>
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
    console.log("Displaying goal:", goal); // Log the goal being displayed

    const target = parseFloat(goal.targetAmount || goal.target || 0);
    // MODIFIED: Read 'currentSavings' (from add-goal.js) with a fallback to 'savings' for compatibility.
    const saved = parseFloat(goal.currentSavings || goal.savings || 0);
    const progress = target > 0 ? (saved / target) * 100 : 0;

    console.log(`Goal: ${goal.name}, Target: ${target}, Saved: ${saved}, Progress: ${progress}%`); // Log calculated values

    document.getElementById('goalTitle').textContent = goal.name;
    document.getElementById('goalAmount').textContent = `เป้าหมาย: ${target.toFixed(2)} ฿`;
    document.getElementById('goalSavings').textContent = `ออมแล้ว: ${saved.toFixed(2)} ฿`;
    document.getElementById('goalProgressBar').style.width = `${Math.min(100, progress).toFixed(0)}%`;
    document.getElementById('goalProgressBar').textContent = `${Math.min(100, progress).toFixed(0)}%`;
    document.getElementById('goalDueDate').textContent = goal.dueDate ? `กำหนด: ${new Date(goal.dueDate).toLocaleDateString('th-TH')}` : "กำหนด: -";
}

// ================== Data Manipulation Functions ==================
window.confirmDeleteTransaction = function(transactionId) {
    showConfirmationModal("ยืนยันการลบ", "คุณแน่ใจหรือไม่ที่จะลบรายการนี้?", () => {
        if (auth.currentUser) {
            window.deleteTransaction(transactionId);
        } else {
            showNotificationModal("ข้อผิดพลาด", "กรุณาเข้าสู่ระบบเพื่อดำเนินการลบ");
        }
    });
};

window.deleteTransaction = async function(transactionId) {
    if (!auth.currentUser) return; // Should be checked by confirmDeleteTransaction

    try {
        await deleteDoc(doc(db, "users", auth.currentUser.uid, "transactions", transactionId));
        showNotificationModal("ลบสำเร็จ", "ลบรายการเรียบร้อยแล้ว");
    } catch (error) {
        console.error("Error removing transaction: ", error);
        showNotificationModal("เกิดข้อผิดพลาด", "เกิดข้อผิดพลาดในการลบ: " + error.message);
    }
}

// REMOVED: addSavingsToGoal function is removed to avoid data conflicts.
// Goal management is now centralized in add-goal.html.

// ================== DOM Event Listeners ==================
document.addEventListener('DOMContentLoaded', () => {
    // REMOVED: Goal Form Submission logic is not on this page.

    document.getElementById('prevGoal')?.addEventListener('click', () => { currentGoalIndex--; displayGoals(); });
    document.getElementById('nextGoal')?.addEventListener('click', () => { currentGoalIndex++; displayGoals(); });

    // REMOVED: Add Savings Form listener is removed.

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

// REMOVED: Goal Creation Modal functions are not on this page.

// Custom Notification Modal
window.showNotificationModal = function(title, message) {
    const modal = document.getElementById('notificationModal');
    // Check if modal elements exist before trying to access them
    const modalTitle = document.getElementById('notificationModalTitle');
    const modalMessage = document.getElementById('notificationModalMessage');

    if (!modal || !modalTitle || !modalMessage) {
        console.error("Notification modal elements not found. Cannot display custom notification.");
        // Fallback to native alert if elements are missing
        alert(`${title}: ${message}`);
        return;
    }

    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modal.style.display = 'flex';
}

window.closeNotificationModal = function() {
    document.getElementById('notificationModal').style.display = 'none';
}

// Custom Confirmation Modal
window.showConfirmationModal = function(title, message, onConfirmCallback) {
    const modal = document.getElementById('confirmationModal');
    // Check if modal elements exist
    const modalTitle = document.getElementById('confirmationModalTitle');
    const modalMessage = document.getElementById('confirmationModalMessage');
    const confirmBtn = document.getElementById('confirmModalConfirmBtn');

    if (!modal || !modalTitle || !modalMessage || !confirmBtn) {
        console.error("Confirmation modal elements not found. Cannot display custom confirmation.");
        // Fallback to native confirm if elements are missing
        if (confirm(`${title}: ${message}`)) {
            onConfirmCallback();
        }
        return;
    }

    modalTitle.textContent = title;
    modalMessage.textContent = message;

    confirmBtn.onclick = () => {
        onConfirmCallback();
        closeConfirmationModal();
    };

    modal.style.display = 'flex';
}

window.closeConfirmationModal = function() {
    document.getElementById('confirmationModal').style.display = 'none';
}


// Custom Level-Up Modal
window.showLevelUpModal = function(level, name, reward) {
    const modal = document.getElementById('levelUpModal');
    const modalLevel = document.getElementById('levelUpModalLevel');
    const modalName = document.getElementById('levelUpModalName');
    const modalReward = document.getElementById('levelUpModalReward');

    if (!modal || !modalLevel || !modalName || !modalReward) {
        console.error("Level-up modal elements not found. Cannot display custom level-up notification.");
        alert(`🎉 ยินดีด้วย! คุณเลเวลอัพเป็น Level ${level} – ${name}!\nได้รับ ${reward} เหรียญ!`);
        return;
    }

    modalLevel.textContent = `Level ${level}`;
    modalName.textContent = name;
    modalReward.textContent = `ได้รับ ${reward} เหรียญ!`;
    modal.style.display = 'flex';
}

window.closeLevelUpModal = function() {
    document.getElementById('levelUpModal').style.display = 'none';
}

// REMOVED: Add Savings Modal functions are removed.

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
