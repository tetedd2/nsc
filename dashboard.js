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

// Initialize Firebase (Modular SDK v9)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';
import { 
    getFirestore, collection, doc, setDoc, 
    onSnapshot, query, orderBy, addDoc, deleteDoc,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); // Get storage instance if you use it

// Global state variables
let transactions = [];
let goals = [];
let currentGoalIndex = 0;
let unsubscribeListeners = []; // Array to store unsubscribe functions for real-time listeners

// ================== Authentication Observer ==================
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in, load data and set up UI
        attachRealtimeListeners(user.uid);
    } else {
        // No user is signed in, detach listeners and redirect to login
        // window.location.href = "login.html"; // Uncomment if you have a login page
        detachRealtimeListeners();
        // Clear UI data when logged out
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
    detachRealtimeListeners(); // Ensure no duplicate listeners

    // Listener for User Profile (Level, XP, Badges, etc.)
    const userProfileListener = onSnapshot(doc(db, 'users', uid), (docSnapshot) => {
        if (docSnapshot.exists()) {
            updateProfileUI(docSnapshot.data(), auth.currentUser);
        } else {
            // Create a default profile if one doesn't exist
            setDoc(doc(db, 'users', uid), {
                displayName: auth.currentUser.displayName || "ผู้ใช้ใหม่",
                level: "Level 1 – ผู้เริ่มต้น",
                xp: 0,
                nextLevelXP: 100,
                quote: "เริ่มต้นเล็กๆ สร้างนิสัยยิ่งใหญ่!",
                badges: [] // Initialize with an empty array of badges
            });
        }
    }, console.error);

    // Listener for Transactions
    const transactionsQuery = query(collection(db, 'users', uid, 'transactions'), orderBy('date', 'desc'));
    const transactionsListener = onSnapshot(transactionsQuery, (snapshot) => {
        transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        displayTransactions();
        updateFinancialSummary();
    }, console.error);

    // Listener for Goals
    const goalsQuery = query(collection(db, 'users', uid, 'goals'), orderBy('createdAt', 'desc'));
    const goalsListener = onSnapshot(goalsQuery, (snapshot) => {
        goals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        currentGoalIndex = 0; // Reset index to first goal on update
        displayGoals();
    }, console.error);

    unsubscribeListeners = [userProfileListener, transactionsListener, goalsListener];
}

function detachRealtimeListeners() {
    unsubscribeListeners.forEach(unsubscribe => unsubscribe());
    unsubscribeListeners = [];
}

// ================== UI Update Functions ==================

// Define all possible badges with their details (from previous conversation)
const allBadges = [
    {
        id: 'savings-champion',
        icon: '🏦',
        name: 'นักออมตัวยง',
        description: 'ได้รับเมื่อมีการออมเงินอย่างสม่ำเสมอเป็นระยะเวลาหนึ่ง หรือสามารถบรรลุเป้าหมายการออมที่กำหนดไว้',
    },
    {
        id: 'investment-master',
        icon: '💹',
        name: 'ผู้เชี่ยวชาญการลงทุน',
        description: 'ได้รับเมื่อมีการลงทุนในสินทรัพย์ต่างๆ และสามารถสร้างผลตอบแทนได้ตามเป้าหมาย หรือมีการศึกษาและเข้าใจหลักการลงทุนขั้นพื้นฐาน',
    },
    {
        id: 'financial-planner',
        icon: '📝',
        name: 'นักวางแผนการเงิน',
        description: 'ได้รับเมื่อมีการจัดทำงบประมาณส่วนบุคคลอย่างสม่ำเสมอ สามารถติดตามและควบคุมค่าใช้จ่ายได้ดี หรือมีการวางแผนทางการเงินระยะยาว',
    },
    {
        id: 'debt-free-hero',
        icon: '💸',
        name: 'ปลอดหนี้ดีเด่น',
        description: 'ได้รับเมื่อสามารถชำระหนี้บางประเภทได้หมด หรือมีการจัดการหนี้สินอย่างมีประสิทธิภาพจนลดภาระลงได้มาก',
    },
    {
        id: 'multiple-income-streams',
        icon: '🌐',
        name: 'เศรษฐีรายรับหลายทาง',
        description: 'ได้รับเมื่อสามารถสร้างรายได้จากช่องทางอื่นนอกเหนือจากรายได้หลัก เช่น การลงทุน การทำธุรกิจเสริม หรือค่าเช่า',
    },
    {
        id: 'young-entrepreneur',
        icon: '💡',
        name: 'ผู้ประกอบการรุ่นใหม่',
        description: 'ได้รับเมื่อมีการริเริ่มสร้างธุรกิจของตนเอง หรือมีส่วนร่วมในการสร้างรายได้จากการทำธุรกิจ',
    },
];

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
            const lowerCaseMessage = message.toLowerCase();
            if (lowerCaseMessage.includes('สวัสดี')) {
                resolve('สวัสดีครับ! มีอะไรให้ผมช่วยเรื่องการเงินไหมครับ?');
            } else if (lowerCaseMessage.includes('เงินออม') || lowerCaseMessage.includes('ออมเงิน')) {
                resolve('การออมเป็นสิ่งสำคัญมากครับ คุณสามารถเริ่มต้นด้วยการตั้งเป้าหมายและบันทึกรายรับรายจ่ายอย่างสม่ำเสมอครับ');
            } else if (lowerCaseMessage.includes('เป้าหมาย')) {
                resolve('การตั้งเป้าหมายที่ชัดเจนช่วยให้คุณมีแรงจูงใจในการออมและลงทุนครับ คุณมีเป้าหมายอะไรในใจบ้างไหมครับ?');
            } else if (lowerCaseMessage.includes('ลงทุน')) {
                resolve('การลงทุนมีความเสี่ยง ควรศึกษาข้อมูลให้รอบคอบก่อนตัดสินใจนะครับ สนใจเรื่องการลงทุนประเภทไหนเป็นพิเศษไหมครับ?');
            } else {
                resolve('ผมไม่แน่ใจว่าเข้าใจคำถามของคุณ ลองถามเกี่ยวกับการออมเงิน การลงทุน หรือการตั้งเป้าหมายดูนะครับ');
            }
        }, 800);
    });
}