function saveGoal(event) {
  event.preventDefault();
  const goalName = document.getElementById('goalName').value.trim();
  const goalAmount = parseFloat(document.getElementById('goalAmount').value);
  const goalDate = document.getElementById('goalDate').value;
  const planType = document.getElementById('planType').value;
  if (!goalName || !goalAmount || goalAmount <= 0 || !goalDate) {
    alert("กรุณากรอกข้อมูลให้ครบถ้วน");
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(goalDate);
  endDate.setHours(0, 0, 0, 0);
  let savingPlan = [];
  let numInstallments = 1;
  let perInstallment = goalAmount;

  if (planType === "daily") {
    numInstallments = 20;
    perInstallment = goalAmount * 0.05;
    if ((endDate - today) / (1000 * 60 * 60 * 24) < numInstallments - 1) {
      alert("ช่วงวันน้อยกว่า 20 วัน ไม่สามารถแบ่งแผนรายวัน 5% ได้ กรุณาเลือกวันใหม่");
      return;
    }
    for (let i = 0; i < numInstallments; i++) {
      let d = new Date(today);
      d.setDate(d.getDate() + i);
      savingPlan.push({
        round: i + 1,
        date: d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }),
        amount: perInstallment.toFixed(2),
        saved: 0
      });
    }
  } else if (planType === "weekly") {
    const daysDiff = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
    numInstallments = Math.ceil(daysDiff / 7);
    if (numInstallments < 1) numInstallments = 1;
    perInstallment = goalAmount / numInstallments;
    for (let i = 0; i < numInstallments; i++) {
      let d = new Date(today);
      d.setDate(d.getDate() + i * 7);
      savingPlan.push({
        round: i + 1,
        date: d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }),
        amount: perInstallment.toFixed(2),
        saved: 0
      });
    }
  } else if (planType === "monthly") {
    const monthDiff =
      (endDate.getFullYear() - today.getFullYear()) * 12 +
      (endDate.getMonth() - today.getMonth()) + 1;
    numInstallments = monthDiff;
    if (numInstallments < 1) numInstallments = 1;
    perInstallment = goalAmount / numInstallments;
    for (let i = 0; i < numInstallments; i++) {
      let d = new Date(today);
      d.setMonth(d.getMonth() + i);
      savingPlan.push({
        round: i + 1,
        date: d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short' }),
        amount: perInstallment.toFixed(2),
        saved: 0
      });
    }
  } else { // Handle "once" scenario, although not in the original prompt logic, good to have.
    savingPlan.push({
      round: 1,
      date: endDate.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }),
      amount: goalAmount.toFixed(2),
      saved: 0
    });
  }


  firebase.auth().onAuthStateChanged(function (user) {
    if (user) {
      const goal = {
        name: goalName,
        target: goalAmount,
        savings: 0, // Initial savings is 0
        date: goalDate,
        planType: planType,
        plan: savingPlan,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      db.collection("users").doc(user.uid).collection("goals").add(goal)
        .then(() => {
          alert("บันทึกเป้าหมายสำเร็จ!");
          window.history.back(); // ✅ ใช้ปุ่มย้อนกลับได้จริง
        })
        .catch(err => alert("เกิดข้อผิดพลาด: " + err.message));
    } else {
      alert("กรุณาเข้าสู่ระบบใหม่");
    }
  });
}

function updateGoalList() {
  firebase.auth().onAuthStateChanged(function (user) {
    if (!user) return;
    db.collection("users").doc(user.uid).collection("goals").orderBy("createdAt", "desc").get()
      .then(snapshot => {
        const goalListContainer = document.getElementById('goalContent');
        goalListContainer.innerHTML = "";
        if (snapshot.empty) {
          goalListContainer.innerHTML = `<div class="goal-title">- ยังไม่มีเป้าหมายที่ตั้งไว้ -</div>`;
          return;
        }
        snapshot.forEach(doc => {
          const goal = doc.data();
          goal.id = doc.id;
          // Calculate total savings from the plan
          goal.savings = goal.plan ? goal.plan.reduce((sum, p) => sum + (parseFloat(p.saved) || 0), 0) : 0;
          const percent = goal.target > 0 ? ((goal.savings / goal.target) * 100).toFixed(0) : 0;
          
          const goalBlock = document.createElement('div');
          goalBlock.classList.add('goal-block');
          goalBlock.innerHTML = `
            <button class="delete-btn" title="ลบเป้าหมายนี้" onclick="deleteGoal('${goal.id}')">✖</button>
            <div class="goal-title"><span class="goal-name">📌 ${goal.name}</span></div>
            <div class="goal-money">
              💰 ฿<span class="current-savings">${goal.savings.toFixed(2)}</span>
              / ฿<span class="total-amount">${goal.target.toFixed(2)}</span>
              <span class="progress-text">(${percent}%)</span>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar" style="width: ${percent}%"></div>
            </div>
            <div class="saving-plan-title">📅 แผนการออม (${planTypeText(goal.planType)})</div>
            <div class="saving-plan-list">
              ${goal.plan ? goal.plan.map((p, planIdx) => {
                const remainingToSave = parseFloat(p.amount) - parseFloat(p.saved || 0);
                return `
                <div class="saving-row">
                  <div style="font-size:0.97rem; color:#00796b;">
                    งวดที่ ${p.round}<br>(${p.date})<br><b>${parseFloat(p.amount).toFixed(2)}</b> บาท
                  </div>
                  <div class="bar-bg">
                    <div class="bar" style="width:${(p.saved/p.amount*100)||0}%"></div>
                  </div>
                  <span class="bar-label">ออมแล้ว: <b>${(parseFloat(p.saved)||0).toFixed(2)}</b> / ${parseFloat(p.amount).toFixed(2)} บาท</span>
                  <input type="number" class="saving-input" placeholder="ใส่จำนวนเงิน" min="0" step="0.01" value="${remainingToSave > 0 ? remainingToSave.toFixed(2) : ''}">
                  <button class="bar-btn" onclick="addSavingToPlan('${goal.id}',${planIdx}, this)">+ ออม</button>
                </div>
              `;
              }).join('') : '<i>ไม่มีแผน</i>'}
            </div>
          `;
          goalListContainer.appendChild(goalBlock);
        });
      });
  });
}

function planTypeText(type) {
  if (type === "daily") return "รายวัน";
  if (type === "weekly") return "รายสัปดาห์";
  if (type === "monthly") return "รายเดือน";
  if (type === "once") return "ครั้งเดียว"; // Added for completeness
  return "";
}

function addSavingToPlan(goalId, planIdx, buttonElement) { // รับ buttonElement เข้ามา
  firebase.auth().onAuthStateChanged(function (user) {
    if (!user) return;
    
    // หา input ที่อยู่ใกล้ปุ่มที่กด
    const savingInput = buttonElement.parentNode.querySelector('.saving-input');
    let saveAmount = parseFloat(savingInput.value); // ดึงค่าจาก input field

    if (isNaN(saveAmount) || saveAmount <= 0) {
      alert("กรุณาใส่จำนวนเงินที่ถูกต้องและมากกว่า 0");
      return;
    }

    db.collection("users").doc(user.uid).collection("goals").doc(goalId).get()
      .then(doc => {
        if (!doc.exists) {
            alert("เป้าหมายไม่พบ");
            return;
        }
        const goal = doc.data();
        let plan = goal.plan;

        if (!plan || !plan[planIdx]) {
            alert("ไม่พบแผนการออมสำหรับงวดนี้");
            return;
        }
        
        // ตรวจสอบและแปลงค่า saved เป็นตัวเลข
        plan[planIdx].saved = parseFloat(plan[planIdx].saved || 0); 
        const currentAmount = parseFloat(plan[planIdx].amount);

        // เพิ่มเงินออม
        plan[planIdx].saved += saveAmount;
        
        // ไม่ให้เกินยอดเป้าหมายของงวดนั้น
        if (plan[planIdx].saved > currentAmount) {
            plan[planIdx].saved = currentAmount;
            alert("คุณออมเงินเกินเป้าหมายงวดนี้แล้ว ส่วนที่เกินจะไม่ถูกนับรวมในงวดนี้");
        }

        // คำนวณยอดรวมที่ออมได้ของเป้าหมายทั้งหมด
        goal.savings = plan.reduce((sum, p) => sum + (parseFloat(p.saved) || 0), 0);

        db.collection("users").doc(user.uid).collection("goals").doc(goalId).update({
          plan: plan,
          savings: goal.savings
        }).then(() => {
            alert("ออมเงินสำหรับงวดนี้สำเร็จ!");
            savingInput.value = ''; // ล้างค่าในช่อง input หลังจากบันทึก
            updateGoalList(); // รีเฟรชรายการเป้าหมายเพื่อแสดงความคืบหน้า
        }).catch((error) => {
            console.error("Error updating goal: ", error);
            alert("เกิดข้อผิดพลาดในการบันทึกเงินออม: " + error.message);
        });
      })
      .catch((error) => {
        console.error("Error fetching goal: ", error);
        alert("เกิดข้อผิดพลาดในการดึงข้อมูลเป้าหมาย: " + error.message);
      });
  });
}

function deleteGoal(goalId) {
  if (!confirm("ต้องการลบเป้าหมายนี้จริงหรือไม่?")) return;
  firebase.auth().onAuthStateChanged(function (user) {
    if (!user) return;
    db.collection("users").doc(user.uid).collection("goals").doc(goalId).delete().then(updateGoalList);
  });
}

// โหลดเป้าหมายเมื่อเปิดหน้า
document.addEventListener('DOMContentLoaded', updateGoalList);