// ================== Firebase Configuration ==================

// ==== Import Firebase SDK v9 ====
    import { onAuthStateChanged, collection, doc, setDoc, getDoc, updateDoc, onSnapshot, query, orderBy, addDoc, deleteDoc, serverTimestamp, arrayUnion, increment, runTransaction, auth, db, storage } from './js/firebase-init.js';
    // ผูกข้อมูลจริง: ภารกิจประจำวัน + ความคืบหน้าบทเรียน
    import { todayKey, missionsDoneToday } from './js/progress.js';

const LESSONS = [
  { id: 1, title: 'เงินคืออะไร?',                      href: 'lesson-detail.html'  },
  { id: 2, title: 'วิธีออมเงิน',                        href: 'lesson-detail2.html' },
  { id: 3, title: 'ความอยาก vs จำเป็น',                 href: 'lesson-detail3.html' },
  { id: 4, title: 'การวางแผนการเงินส่วนบุคคล',          href: 'lesson-detail4.html' },
  { id: 5, title: 'การสร้างรายได้เสริม',                href: 'lesson-detail5.html' },
  { id: 6, title: 'การบริหารความเสี่ยงทางการเงิน',      href: 'lesson-detail6.html' },
];
let latestUserData = null;

// ================== Firebase Initialization ==================

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
        renderMissions();
        checkBadges();
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
        checkBadges();
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
    const todayStr = todayKey();
    if (user.lastLoginReward === todayStr) return;   // รับรางวัลไปแล้ววันนี้

    // ---- streak: นับวันล็อกอินต่อเนื่อง ----
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yesterdayStr = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
    const streak = (user.lastStreakDate === yesterdayStr) ? ((user.streak || 0) + 1) : 1;
    const bonus = 15 + Math.min(streak - 1, 6) * 5;   // 15,20,...,45 XP (ยิ่งต่อเนื่องยิ่งเยอะ สูงสุด 7 วัน)

    try {
        await updateDoc(userRef, { lastLoginReward: todayStr, streak: streak, lastStreakDate: todayStr });
        await addXP(uid, bonus);
        showNotificationModal('รางวัลล็อกอินรายวัน', `🔥 ล็อกอินต่อเนื่อง ${streak} วัน!\nรับ +${bonus} XP`);
    } catch (error) {
        console.error("Error giving daily reward:", error);
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
    latestUserData = userData || {};
    // MODIFIED: Changed the default avatar URL to a black user icon
    const defaultAvatar = 'assets/avatar.png';
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

    // ผูกข้อมูลจริง: อัปเดตการ์ดบทเรียน + สถานะภารกิจประจำวัน + สตรีค
    renderLessonCard(userData);
    renderMissions();
    renderStreak(userData);
    checkBadges();
}

// ========== สตรีค: ล็อกอินต่อเนื่องกี่วัน ==========
function renderStreak(userData) {
    const el = document.getElementById('homeStreak');
    if (!el) return;
    const s = (userData && userData.streak) ? userData.streak : 0;
    if (s >= 1) { el.style.display = 'inline-flex'; el.textContent = '🔥 ล็อกอินต่อเนื่อง ' + s + ' วัน'; }
    else { el.style.display = 'none'; }
}

// ========== เหรียญตรา (badges): ปลดล็อกจริงเมื่อทำสำเร็จ ==========
const BADGE_REWARD_COINS = 20;
const awardingNow = new Set();   // กันปลดล็อกซ้ำระหว่างรอ snapshot อัปเดต

async function awardBadge(uid, badgeId) {
    const have = (latestUserData && latestUserData.badges) || [];
    if (have.includes(badgeId) || awardingNow.has(badgeId)) return;
    const badge = allBadges.find(b => b.id === badgeId);
    if (!badge) return;
    awardingNow.add(badgeId);
    try {
        await updateDoc(doc(db, 'users', uid), {
            badges: arrayUnion(badgeId),
            coins: increment(BADGE_REWARD_COINS),
        });
        showNotificationModal('🏅 ปลดล็อกเหรียญตรา!',
            `${badge.icon} ${badge.name}\n${badge.description}\n+${BADGE_REWARD_COINS} เหรียญ`);
    } catch (e) {
        console.error('awardBadge error:', e);
        awardingNow.delete(badgeId);   // เขียนไม่สำเร็จ ให้ลองใหม่รอบหน้าได้
    }
}

function checkBadges() {
    const user = auth.currentUser;
    if (!user || !latestUserData) return;
    const uid = user.uid;
    if (transactions.length >= 1) awardBadge(uid, 'first_transaction');          // บันทึกธุรกรรมแรก
    if (goals.length >= 1) awardBadge(uid, 'first_goal');                         // ตั้งเป้าหมายแรก
    if ((latestUserData.streak || 0) >= 3) awardBadge(uid, 'saving_streak_3');    // ล็อกอินต่อเนื่อง 3 วัน
}

// ========== ความคืบหน้าบทเรียน (จาก completedLessons) ==========
function renderLessonCard(userData) {
    const completed = Array.isArray(userData?.completedLessons) ? userData.completedLessons : [];
    const doneCount = LESSONS.filter(l => completed.includes(l.id)).length;
    const pct = Math.round((doneCount / LESSONS.length) * 100);

    const fill  = document.getElementById('lessonFill');
    const cap   = document.getElementById('lessonCap');
    const title = document.getElementById('lessonTitle');
    const btn   = document.getElementById('lessonBtn');
    if (fill) fill.style.width = pct + '%';
    if (cap)  cap.textContent = `ความคืบหน้า ${doneCount}/${LESSONS.length} บท`;

    const next = LESSONS.find(l => !completed.includes(l.id));
    if (next) {
        if (title) title.textContent = `บทที่ ${next.id}: ${next.title}`;
        if (btn) { btn.setAttribute('href', next.href); btn.textContent = doneCount > 0 ? 'เรียนต่อ' : 'เริ่มบทเรียน'; }
    } else {
        if (title) title.textContent = 'เรียนครบทุกบทแล้ว 🎉';
        if (btn) { btn.setAttribute('href', 'lesson.html'); btn.textContent = 'ทบทวนบทเรียน'; }
    }
}

// ========== ภารกิจประจำวัน (dailyMissions + ตรวจบันทึกวันนี้) ==========
function hasTransactionToday() {
    const t = todayKey();
    return transactions.some(tx => {
        if (!tx.date) return false;
        const d = new Date(tx.date);
        if (isNaN(d)) return false;
        const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        return k === t;
    });
}

function renderMissions() {
    const done = new Set(missionsDoneToday(latestUserData || {}));
    if (hasTransactionToday()) done.add('record');   // ตรวจจากธุรกรรมวันนี้โดยตรง
    document.querySelectorAll('.mission-card[data-mission]').forEach(card => {
        card.classList.toggle('done', done.has(card.dataset.mission));
    });
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
// (เอา checkTransactionQuota ที่ไม่ถูกใช้ออกแล้ว)

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

    // น้องซี: ย้ายไปเป็น widget ลอยร่วมทุกหน้า (js/nong-see-widget.js) แล้ว
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

// ================== น้องซี ==================
// แชตน้องซีย้ายไปเป็น widget ลอยร่วมทุกหน้า (js/nong-see-widget.js)
// สมอง (บอตกฎ + guardrail + เรียกโมเดล) อยู่ที่ js/nong-see.js
