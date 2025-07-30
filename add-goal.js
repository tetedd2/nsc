// ================== Firebase SDK v9 Imports ==================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { 
    getFirestore, collection, doc, onSnapshot, query, orderBy, addDoc, deleteDoc, updateDoc, 
    serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

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

// ================== Firebase Initialization ==================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ================== DOM Elements ==================
const goalsGrid = document.getElementById('goalsGrid');
const addGoalFab = document.getElementById('addGoalFab');
const goalModal = document.getElementById('goalModal');
const addGoalForm = document.getElementById('addGoalForm');
const modalTitle = document.getElementById('modalTitle');
const goalNameInput = document.getElementById('goalName');
const goalAmountInput = document.getElementById('goalAmount');
const currentAmountInput = document.getElementById('currentAmount');
const goalDateInput = document.getElementById('goalDate');
const planTypeSelect = document.getElementById('planType');
const planPreviewDiv = document.getElementById('planPreview');

const addSavingsModal = document.getElementById('addSavingsModal');
const addSavingsForm = document.getElementById('addSavingsForm');
const savingsModalTitle = document.getElementById('savingsModalTitle');
const savingsGoalName = document.getElementById('savingsGoalName');
const savingsGoalId = document.getElementById('savingsGoalId');
const savingsInstallmentIndex = document.getElementById('savingsInstallmentIndex');
const savingsAmountInput = document.getElementById('savingsAmount');

let currentUser = null;
let unsubscribeGoals = null;

// ================== Dark Mode Logic ==================
(function() {
  const enableDark = localStorage.getItem("moneySkillzDarkMode") === "true";
  if (enableDark) document.body.classList.add("dark-mode");
})();

// ================== Authentication Observer ==================
onAuthStateChanged(auth, user => {
    if (user) {
        currentUser = user;
        fetchGoals();
    } else {
        currentUser = null;
        if (unsubscribeGoals) unsubscribeGoals();
        goalsGrid.innerHTML = `<div class="placeholder-card"><p>กรุณาเข้าสู่ระบบเพื่อดูและจัดการเป้าหมายของคุณ</p></div>`;
    }
});

// ================== Fetch and Render Goals ==================
function fetchGoals() {
    if (!currentUser) return;
    const goalsRef = collection(db, 'users', currentUser.uid, 'goals');
    const q = query(goalsRef, orderBy('dueDate', 'asc'));

    unsubscribeGoals = onSnapshot(q, snapshot => {
        if (snapshot.empty) {
            goalsGrid.innerHTML = `<div class="placeholder-card"><h3>ยังไม่มีเป้าหมาย</h3><p>คลิกปุ่ม '+' เพื่อสร้างเป้าหมายแรกของคุณ!</p></div>`;
            return;
        }
        goalsGrid.innerHTML = '';
        snapshot.forEach(doc => {
            const goal = { id: doc.id, ...doc.data() };
            goalsGrid.appendChild(createGoalCard(goal));
        });
    }, error => {
        console.error("Error fetching goals: ", error);
        goalsGrid.innerHTML = `<div class="placeholder-card"><p>เกิดข้อผิดพลาดในการโหลดเป้าหมาย</p></div>`;
    });
}

// ================== Create HTML for a Goal Card ==================
function createGoalCard(goal) {
    const card = document.createElement('div');
    card.className = 'goal-card';
    const targetAmount = parseFloat(goal.targetAmount || 0);
    const currentSavings = parseFloat(goal.currentSavings || 0);
    const progress = targetAmount > 0 ? (currentSavings / targetAmount) * 100 : 0;
    const dueDate = goal.dueDate ? new Date(goal.dueDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : 'ไม่มีกำหนด';

    let planHtml = '';
    if (goal.plan && goal.plan.length > 0) {
        planHtml = `
        <div class="goal-plan-details">
            ${goal.plan.map((installment, index) => createInstallmentRow(installment, index, goal)).join('')}
        </div>`;
    }

    card.innerHTML = `
        <div class="goal-card-header">
            <h3>${goal.name}</h3>
            <button class="delete-goal-btn" title="ลบเป้าหมาย"><i class="fas fa-trash-alt"></i></button>
        </div>
        <div class="goal-card-body">
            <p class="due-date"><i class="fas fa-calendar-alt"></i> กำหนด: ${dueDate}</p>
            <div class="progress-info">
                <span class="current">${currentSavings.toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ฿</span>
                <span class="target">${targetAmount.toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ฿</span>
            </div>
            <div class="progress-bar-container">
                <div class="progress-bar" style="width: ${Math.min(progress, 100)}%;"></div>
            </div>
        </div>
        ${planHtml}
    `;

    card.querySelector('.delete-goal-btn').addEventListener('click', () => {
        if (confirm(`คุณแน่ใจหรือไม่ที่จะลบเป้าหมาย "${goal.name}"?`)) deleteGoal(goal.id);
    });
    
    // Add event listeners for each "Add Savings" button in the plan
    card.querySelectorAll('.add-installment-savings-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const installmentIndex = e.currentTarget.dataset.index;
            const installment = goal.plan[installmentIndex];
            openAddSavingsModal(goal, installment, installmentIndex);
        });
    });

    return card;
}

function createInstallmentRow(installment, index, goal) {
    const instAmount = parseFloat(installment.amount || 0);
    const instSaved = parseFloat(installment.saved || 0);
    const instProgress = instAmount > 0 ? (instSaved / instAmount) * 100 : 0;
    const isPaid = instSaved >= instAmount;

    return `
    <div class="installment-row ${isPaid ? 'paid' : ''}">
        <div class="installment-header">
            <span>งวดที่ ${installment.round} (${installment.date})</span>
            <span class="installment-progress-info">${instSaved.toLocaleString('th-TH', {minimumFractionDigits: 2})} / ${instAmount.toLocaleString('th-TH', {minimumFractionDigits: 2})} ฿</span>
        </div>
        <div class="installment-progress-bar-container">
            <div class="installment-progress-bar" style="width: ${Math.min(instProgress, 100)}%;"></div>
        </div>
        <div class="add-installment-savings-group">
            <button class="add-installment-savings-btn" data-index="${index}" data-goal-id="${goal.id}" ${isPaid ? 'disabled' : ''}>
                ${isPaid ? '<i class="fas fa-check"></i> ชำระแล้ว' : '+ เพิ่มเงินออม'}
            </button>
        </div>
    </div>
    `;
}

// ================== Modal Handling ==================
function openGoalModal() {
    addGoalForm.reset();
    currentAmountInput.value = 0;
    planPreviewDiv.style.display = 'none';
    goalModal.style.display = 'flex';
}
function closeGoalModal() { goalModal.style.display = 'none'; }

function openAddSavingsModal(goal, installment, index) {
    addSavingsForm.reset();
    savingsGoalName.textContent = goal.name;
    savingsModalTitle.textContent = `💰 เพิ่มเงินออม (งวดที่ ${installment.round})`;
    savingsGoalId.value = goal.id;
    savingsInstallmentIndex.value = index;

    const remaining = (installment.amount || 0) - (installment.saved || 0);
    savingsAmountInput.placeholder = `เหลืออีก ${remaining.toLocaleString('th-TH', {maximumFractionDigits: 2})} บาท`;
    savingsAmountInput.max = remaining.toFixed(2);

    addSavingsModal.style.display = 'flex';
}
function closeAddSavingsModal() { addSavingsModal.style.display = 'none'; }

addGoalFab.addEventListener('click', openGoalModal);
goalModal.querySelector('.close-button').addEventListener('click', closeGoalModal);
addSavingsModal.querySelector('.close-button').addEventListener('click', closeAddSavingsModal);
window.addEventListener('click', (e) => {
    if (e.target === goalModal) closeGoalModal();
    if (e.target === addSavingsModal) closeAddSavingsModal();
});

// ================== Plan Calculation & Preview ==================
function previewPlan() {
    const amount = parseFloat(goalAmountInput.value);
    const dateStr = goalDateInput.value;
    const planType = planTypeSelect.value;
    
    if (!amount || !dateStr || !planType || amount <= 0) {
        planPreviewDiv.style.display = 'none';
        return;
    }

    const { text, isValid } = calculatePlanPreview(amount, dateStr, planType);
    planPreviewDiv.innerHTML = text;
    planPreviewDiv.className = isValid ? 'plan-preview' : 'plan-preview warning';
    planPreviewDiv.style.display = 'block';
    addGoalForm.querySelector('button[type="submit"]').disabled = !isValid;
}

['input', 'change'].forEach(evt => {
    goalAmountInput.addEventListener(evt, previewPlan);
    goalDateInput.addEventListener(evt, previewPlan);
    planTypeSelect.addEventListener(evt, previewPlan);
});

function calculatePlanPreview(amount, dateStr, planType) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const endDate = new Date(dateStr);
    if (endDate < today) return { text: 'กรุณาเลือกวันที่ในอนาคต', isValid: false };

    const diffTime = endDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    let installments = 0;
    let periodText = '';
    
    switch (planType) {
        case 'daily':
            installments = diffDays;
            periodText = 'วัน';
            break;
        case 'weekly':
            installments = Math.ceil(diffDays / 7);
            periodText = 'สัปดาห์';
            break;
        case 'monthly':
            installments = (endDate.getFullYear() - today.getFullYear()) * 12 + (endDate.getMonth() - today.getMonth()) + 1;
            periodText = 'เดือน';
            break;
        case 'yearly':
            installments = (endDate.getFullYear() - today.getFullYear()) + 1;
            periodText = 'ปี';
            break;
    }
    
    if (installments <= 0) installments = 1;
    const amountPer = amount / installments;
    return { 
        text: `ออม <b>${amountPer.toLocaleString('th-TH', {maximumFractionDigits: 2})}</b> บาท/${periodText} (ทั้งหมด ${installments} งวด)`,
        isValid: true
    };
}

// ================== CRUD Operations ==================
addGoalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const goalData = {
        name: goalNameInput.value,
        targetAmount: parseFloat(goalAmountInput.value),
        currentSavings: parseFloat(currentAmountInput.value),
        dueDate: goalDateInput.value,
        planType: planTypeSelect.value,
        createdAt: serverTimestamp(),
        plan: calculatePlan(
            planTypeSelect.value,
            parseFloat(goalAmountInput.value) - parseFloat(currentAmountInput.value),
            goalDateInput.value
        )
    };

    try {
        const goalsRef = collection(db, 'users', currentUser.uid, 'goals');
        await addDoc(goalsRef, goalData);
        closeGoalModal();
    } catch (error) {
        console.error("Error saving goal: ", error);
        alert("เกิดข้อผิดพลาดในการบันทึกเป้าหมาย");
    }
});

function calculatePlan(planType, amountToSave, dateStr) {
    const plan = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const endDate = new Date(dateStr);
    const diffTime = endDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    let installments = 0;
    if (planType === 'daily') installments = diffDays;
    if (planType === 'weekly') installments = Math.ceil(diffDays / 7);
    if (planType === 'monthly') installments = (endDate.getFullYear() - today.getFullYear()) * 12 + (endDate.getMonth() - today.getMonth()) + 1;
    if (planType === 'yearly') installments = (endDate.getFullYear() - today.getFullYear()) + 1;
    
    if (installments <= 0) installments = 1;
    const amountPer = amountToSave / installments;

    for (let i = 0; i < installments; i++) {
        let d = new Date(today);
        if (planType === 'daily') d.setDate(d.getDate() + i);
        if (planType === 'weekly') d.setDate(d.getDate() + i * 7);
        if (planType === 'monthly') d.setMonth(d.getMonth() + i);
        if (planType === 'yearly') d.setFullYear(d.getFullYear() + i);
        
        plan.push({
            round: i + 1,
            date: d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit'}),
            amount: amountPer,
            saved: 0
        });
    }
    return plan;
}

async function deleteGoal(id) {
    if (!currentUser) return;
    try {
        await deleteDoc(doc(db, 'users', currentUser.uid, 'goals', id));
    } catch (error) {
        console.error("Error deleting goal: ", error);
        alert("เกิดข้อผิดพลาดในการลบเป้าหมาย");
    }
}

addSavingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const goalId = savingsGoalId.value;
    const index = parseInt(savingsInstallmentIndex.value);
    const amountToAdd = parseFloat(savingsAmountInput.value);

    if (isNaN(amountToAdd) || amountToAdd <= 0) {
        alert("กรุณาใส่จำนวนเงินที่ถูกต้อง");
        return;
    }

    const goalRef = doc(db, 'users', currentUser.uid, 'goals', goalId);
    try {
        await runTransaction(db, async (transaction) => {
            const goalDoc = await transaction.get(goalRef);
            if (!goalDoc.exists()) throw "Goal does not exist!";

            const goalData = goalDoc.data();
            const plan = [...goalData.plan];
            const installment = plan[index];

            const alreadySaved = installment.saved || 0;
            const installmentTarget = installment.amount;
            const remainingNeeded = installmentTarget - alreadySaved;

            if (remainingNeeded <= 0) {
                alert("งวดนี้ชำระเงินครบแล้ว");
                throw new Error("Installment already paid.");
            }

            const actualAmountToSave = Math.min(amountToAdd, remainingNeeded);

            installment.saved = alreadySaved + actualAmountToSave;

            const newTotalSavings = (goalData.currentSavings || 0) + actualAmountToSave;
            
            transaction.update(goalRef, { 
                plan: plan,
                currentSavings: newTotalSavings
            });

            if (amountToAdd > remainingNeeded) {
                 setTimeout(() => alert(`คุณใส่จำนวนเงินเกินกว่าที่ต้องชำระในงวดนี้ ระบบได้ปรับลดเงินออมเป็น ${actualAmountToSave.toLocaleString('th-TH', {maximumFractionDigits: 2})} บาท`), 100);
            }
        });
        closeAddSavingsModal();
    } catch (error) {
        if (error.message !== "Installment already paid.") {
            console.error("Error adding savings: ", error);
            alert("เกิดข้อผิดพลาดในการเพิ่มเงินออม: " + error);
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    goalDateInput.setAttribute('min', today);
});
