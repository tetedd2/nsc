// --- INITIALIZATION & EVENT LISTENERS ---

document.addEventListener('DOMContentLoaded', () => {
  // Set the minimum selectable date to today
  const today = new Date().toISOString().split('T')[0];
  const goalDateElement = document.getElementById('goalDate');
  if (goalDateElement) {
    goalDateElement.setAttribute('min', today);
  }

  // Add event listeners to form inputs for real-time preview
  const formInputs = ['goalName', 'goalAmount', 'goalDate', 'planType'];
  formInputs.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('input', previewPlan);
    }
  });

  // Fetch and display existing goals when the page loads
  displayCurrentGoals();
});


// --- GOAL DISPLAY & MANAGEMENT ---

/**
 * Fetches goals from Firebase and displays them on the page using a real-time listener.
 */
function displayCurrentGoals() {
  firebase.auth().onAuthStateChanged(function(user) {
    const goalListContainer = document.getElementById('currentGoalsList');
    // Ensure the container element exists before proceeding
    if (!goalListContainer) {
      console.error("Error: The element with id 'currentGoalsList' was not found in the DOM.");
      return;
    }

    if (!user) {
      goalListContainer.innerHTML = '<div class="no-goals-message">กรุณาเข้าสู่ระบบเพื่อดูเป้าหมายของคุณ</div>';
      return;
    }

    goalListContainer.innerHTML = '<div class="loading-message">กำลังโหลดข้อมูลเป้าหมาย...</div>';

    // Use onSnapshot for real-time updates
    db.collection("users").doc(user.uid).collection("goals").orderBy("createdAt", "desc").onSnapshot(snapshot => {
      goalListContainer.innerHTML = ""; // Clear previous list
      if (snapshot.empty) {
        goalListContainer.innerHTML = `<div class="no-goals-message">- ยังไม่มีเป้าหมายที่ตั้งไว้ -</div>`;
        return;
      }
      snapshot.forEach(doc => {
        const goal = doc.data();
        goal.id = doc.id;
        
        goal.savings = goal.plan ? goal.plan.reduce((sum, p) => sum + (parseFloat(p.saved) || 0), 0) : 0;
        const percent = goal.targetAmount > 0 ? ((goal.savings / goal.targetAmount) * 100) : 0;
        
        const goalBlock = document.createElement('div');
        goalBlock.classList.add('goal-block');
        goalBlock.innerHTML = `
          <button class="delete-btn" title="ลบเป้าหมายนี้" onclick="deleteGoal('${goal.id}', '${goal.name.replace(/'/g, "\\'")}')">✖</button>
          <div class="goal-title">${goal.name}</div>
          <div class="goal-money">
            ออมแล้ว: <span class="current-savings">฿${goal.savings.toLocaleString('th-TH', {maximumFractionDigits: 2})}</span> / 
            <span class="total-amount">฿${goal.targetAmount.toLocaleString('th-TH', {maximumFractionDigits: 2})}</span>
            <span class="progress-text">(${percent.toFixed(0)}%)</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar" style="width: ${percent}%"></div>
          </div>
          <div class="saving-plan-title">📅 แผนการออม (${planTypeText(goal.planType)})</div>
          <div class="saving-plan-list">
            ${goal.plan ? goal.plan.map((p, planIdx) => `
              <div class="saving-row">
                <div class="saving-row-info">
                  <b>งวดที่ ${p.round}</b> (${p.date})<br>
                  เป้าหมาย: <b>${parseFloat(p.amount).toLocaleString('th-TH', {maximumFractionDigits: 2})}</b> บาท
                </div>
                <div class="saving-row-action">
                  <div class="bar-bg">
                    <div class="bar" style="width:${((parseFloat(p.saved) || 0)/parseFloat(p.amount)*100)||0}%"></div>
                  </div>
                  <span class="bar-label">ออมแล้ว: <b>${(parseFloat(p.saved)||0).toLocaleString('th-TH', {maximumFractionDigits: 2})}</b> บาท</span>
                  <div class="saving-input-group">
                      <input type="number" class="saving-input" placeholder="ใส่จำนวนเงิน" min="0" step="0.01">
                      <button class="add-saving-btn" onclick="addSavingToPlan('${goal.id}', ${planIdx}, this)">+ ออม</button>
                  </div>
                </div>
              </div>
            `).join('') : '<i>ไม่มีแผนการออม</i>'}
          </div>
        `;
        goalListContainer.appendChild(goalBlock);
      });
    }, error => {
        console.error("Error fetching goals: ", error);
        goalListContainer.innerHTML = `<div class="no-goals-message">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>`;
    });
  });
}

/**
 * Adds a specified amount to a saving plan installment using a secure transaction.
 */
function addSavingToPlan(goalId, planIdx, buttonElement) {
  const user = firebase.auth().currentUser;
  if (!user) { return alert("กรุณาเข้าสู่ระบบก่อน"); }

  const inputElement = buttonElement.closest('.saving-input-group').querySelector('.saving-input');
  const saveAmount = parseFloat(inputElement.value);

  if (isNaN(saveAmount) || saveAmount <= 0) { return alert("กรุณาใส่จำนวนเงินที่ถูกต้องและมากกว่า 0"); }
  
  const goalRef = db.collection("users").doc(user.uid).collection("goals").doc(goalId);

  db.runTransaction(transaction => {
    return transaction.get(goalRef).then(doc => {
      if (!doc.exists) { throw "เป้าหมายไม่พบ"; }
      
      const goal = doc.data();
      const plan = goal.plan || [];
      if (!plan[planIdx]) { throw "ไม่พบแผนการออมสำหรับงวดนี้"; }
      
      const currentSaved = parseFloat(plan[planIdx].saved) || 0;
      const targetAmountForInstallment = parseFloat(plan[planIdx].amount);
      let newSavedAmount = currentSaved + saveAmount;

      if (newSavedAmount > targetAmountForInstallment) {
        alert(`คุณออมเงินเกินเป้าหมายงวดนี้ (${(newSavedAmount - targetAmountForInstallment).toFixed(2)} บาท) ระบบจะบันทึกให้เท่ากับยอดเป้าหมายของงวดนี้เท่านั้น`);
        newSavedAmount = targetAmountForInstallment;
      }
      
      plan[planIdx].saved = newSavedAmount;
      const totalSavings = plan.reduce((sum, p) => sum + (parseFloat(p.saved) || 0), 0);

      transaction.update(goalRef, { plan: plan, savings: totalSavings });
    });
  }).then(() => {
    console.log(`Transaction successfully committed for goal ${goalId}!`);
    inputElement.value = ''; // Clear input on success
  }).catch(error => {
    console.error("Transaction failed: ", error);
    alert("เกิดข้อผิดพลาดในการบันทึกเงินออม: " + error);
  });
}


/**
 * Deletes a goal from Firebase after user confirmation.
 */
function deleteGoal(goalId, goalName) {
  if (!confirm(`คุณต้องการลบเป้าหมาย "${goalName}" จริงหรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้`)) return;
  
  const user = firebase.auth().currentUser;
  if (user) {
    db.collection("users").doc(user.uid).collection("goals").doc(goalId).delete()
      .catch(error => {
        console.error("Error removing goal: ", error);
        alert("เกิดข้อผิดพลาดในการลบเป้าหมาย");
      });
  }
}

/**
 * Converts plan type key to readable Thai text.
 */
function planTypeText(type) {
  const types = {
    daily_divide: "รายวัน (หารตามวัน)",
    daily_fixed: "รายวัน (สูตร 20 งวด)",
    weekly: "รายสัปดาห์",
    monthly: "รายเดือน",
    once: "ครั้งเดียว"
  };
  return types[type] || "ไม่ระบุ";
}


// --- FORM INTERACTIVITY & PREVIEW ---

/**
 * Displays a real-time preview of the savings plan.
 */
function previewPlan() {
  const goalAmount = parseFloat(document.getElementById('goalAmount').value);
  const goalDateStr = document.getElementById('goalDate').value;
  const planType = document.getElementById('planType').value;
  const previewBox = document.getElementById('planPreview');
  const submitButton = document.querySelector('.primary-button');

  if (!goalAmount || !goalDateStr || goalAmount <= 0) {
    previewBox.style.display = 'none';
    submitButton.disabled = true;
    return;
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const endDate = new Date(goalDateStr); endDate.setHours(0, 0, 0, 0);

  let text = "";
  let isValid = true;
  previewBox.classList.remove('warning');

  if (endDate < today) {
    text = 'กรุณาเลือกวันที่ในอนาคต';
    isValid = false;
    previewBox.classList.add('warning');
  } else {
    const daysDiff = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
    switch (planType) {
      case 'monthly':
        const monthDiff = (endDate.getFullYear() - today.getFullYear()) * 12 + (endDate.getMonth() - today.getMonth()) + 1;
        const numMonths = monthDiff > 0 ? monthDiff : 1;
        text = `ออม <b>${(goalAmount / numMonths).toLocaleString('th-TH', {maximumFractionDigits: 2})}</b> บาท/เดือน (${numMonths} เดือน)`;
        break;
      case 'weekly':
        const numWeeks = Math.ceil(daysDiff / 7) || 1;
        text = `ออม <b>${(goalAmount / numWeeks).toLocaleString('th-TH', {maximumFractionDigits: 2})}</b> บาท/สัปดาห์ (${numWeeks} สัปดาห์)`;
        break;
      case 'daily_divide':
        const numDays = daysDiff >= 0 ? daysDiff + 1 : 1;
        text = `ออม <b>${(goalAmount / numDays).toLocaleString('th-TH', {maximumFractionDigits: 2})}</b> บาท/วัน (${numDays} วัน)`;
        break;
      case 'daily_fixed':
        if (daysDiff < 19) {
          text = '<b>ข้อควรระวัง:</b> แผนนี้ต้องใช้เวลาอย่างน้อย 20 วัน';
          previewBox.classList.add('warning');
        } else {
          text = `ออม <b>${(goalAmount * 0.05).toLocaleString('th-TH', {maximumFractionDigits: 2})}</b> บาท/วัน (20 งวด)`;
        }
        break;
      case 'once':
        text = `บันทึกเป้าหมาย <b>${goalAmount.toLocaleString('th-TH')}</b> บาท`;
        break;
    }
  }
  previewBox.innerHTML = text;
  previewBox.style.display = 'block';
  submitButton.disabled = !isValid;
}


// --- SAVING NEW GOAL ---

/**
 * Calculates the saving plan installments.
 * @returns {Array} An array of plan installment objects.
 */
function calculateSavingPlan(planType, goalAmount, today, endDate) {
    let savingPlan = [];
    switch (planType) {
        case 'monthly': {
            const monthDiff = (endDate.getFullYear() - today.getFullYear()) * 12 + (endDate.getMonth() - today.getMonth()) + 1;
            const numInstallments = monthDiff > 0 ? monthDiff : 1;
            const perInstallment = goalAmount / numInstallments;
            for (let i = 0; i < numInstallments; i++) {
                let d = new Date(today); d.setMonth(d.getMonth() + i);
                savingPlan.push({ round: i + 1, date: d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short' }), amount: perInstallment.toFixed(2), saved: 0 });
            } break;
        }
        case 'weekly': {
            const daysDiff = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
            const numInstallments = Math.ceil(daysDiff / 7) || 1;
            const perInstallment = goalAmount / numInstallments;
            for (let i = 0; i < numInstallments; i++) {
                let d = new Date(today); d.setDate(d.getDate() + i * 7);
                savingPlan.push({ round: i + 1, date: d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }), amount: perInstallment.toFixed(2), saved: 0 });
            } break;
        }
        case 'daily_divide': {
            const daysDiff = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24)) + 1;
            const numInstallments = daysDiff > 0 ? daysDiff : 1;
            const perInstallment = goalAmount / numInstallments;
            for (let i = 0; i < numInstallments; i++) {
                let d = new Date(today); d.setDate(d.getDate() + i);
                savingPlan.push({ round: i + 1, date: d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }), amount: perInstallment.toFixed(2), saved: 0 });
            } break;
        }
        case 'daily_fixed': {
            const numInstallments = 20; const perInstallment = goalAmount * 0.05;
            for (let i = 0; i < numInstallments; i++) {
                let d = new Date(today); d.setDate(d.getDate() + i);
                savingPlan.push({ round: i + 1, date: d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }), amount: perInstallment.toFixed(2), saved: 0 });
            } break;
        }
        case 'once': {
            savingPlan.push({ round: 1, date: endDate.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }), amount: goalAmount.toFixed(2), saved: 0 });
            break;
        }
    }
    return savingPlan;
}

/**
 * Saves the new goal to Firebase.
 */
function saveGoal(event) {
  event.preventDefault();
  const form = document.getElementById('addGoalForm');
  const goalName = document.getElementById('goalName').value.trim();
  const goalAmount = parseFloat(document.getElementById('goalAmount').value);
  const goalDate = document.getElementById('goalDate').value;
  const planType = document.getElementById('planType').value;

  if (!goalName || !goalAmount || !goalAmount || !goalDate) { return alert("กรุณากรอกข้อมูลให้ครบถ้วน"); }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const endDate = new Date(goalDate); endDate.setHours(0, 0, 0, 0);

  if (endDate < today) { return alert("ไม่สามารถเลือกวันที่ในอดีตได้"); }
  if (planType === 'daily_fixed' && (endDate - today) / (1000 * 60 * 60 * 24) < 19) {
      return alert("สำหรับแผน 'ออมรายวัน (20 งวด x 5%)' ต้องมีระยะเวลาอย่างน้อย 20 วัน");
  }

  const savingPlan = calculateSavingPlan(planType, goalAmount, today, endDate);
  const user = firebase.auth().currentUser;

  if (user) {
    const goal = {
      name: goalName,
      targetAmount: goalAmount,
      savings: 0,
      dueDate: goalDate,
      planType: planType,
      plan: savingPlan,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'active'
    };

    db.collection("users").doc(user.uid).collection("goals").add(goal)
      .then(() => {
        alert("บันทึกเป้าหมายใหม่สำเร็จ!");
        form.reset();
        previewPlan();
      })
      .catch(err => {
          console.error("Error adding document: ", err);
          alert("เกิดข้อผิดพลาดในการบันทึก: " + err.message);
      });
  } else {
    alert("เกิดข้อผิดพลาด: ไม่พบข้อมูลผู้ใช้ กรุณาลองเข้าสู่ระบบใหม่อีกครั้ง");
  }
}
