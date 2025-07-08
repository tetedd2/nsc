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
  today.setHours(0,0,0,0);
  const endDate = new Date(goalDate);
  endDate.setHours(0,0,0,0);
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
  }

  // -- เปลี่ยนเป็น Firestore + Auth --
  firebase.auth().onAuthStateChanged(function(user) {
    if (user) {
      const goal = {
        name: goalName,
        target: goalAmount,
        savings: 0,
        date: goalDate,
        planType: planType,
        plan: savingPlan,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      db.collection("users").doc(user.uid).collection("goals").add(goal)
        .then(() => {
          alert("บันทึกเป้าหมายสำเร็จ!");
          updateGoalList();
        })
        .catch(err => alert("เกิดข้อผิดพลาด: " + err.message));
    } else {
      alert("กรุณาเข้าสู่ระบบใหม่");
    }
  });
}

// โหลด + แสดงผลรายการ goal ทั้งหมดจาก Firestore
function updateGoalList() {
  firebase.auth().onAuthStateChanged(function(user) {
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
          // รวมยอดออมจริงใหม่จากทุกงวด
          goal.savings = goal.plan.reduce((sum, p) => sum + (p.saved || 0), 0);
          const percent = ((goal.savings / goal.target) * 100).toFixed(0);
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
              ${goal.plan ? goal.plan.map((p, planIdx) => `
                <div class="saving-row">
                  <div style="font-size:0.97rem; color:#00796b;">
                    งวดที่ ${p.round}<br>(${p.date})<br><b>${p.amount}</b> บาท
                  </div>
                  <div class="bar-bg">
                    <div class="bar" style="width:${(p.saved/p.amount*100)||0}%"></div>
                  </div>
                  <span class="bar-label">ออมแล้ว: <b>${(p.saved||0).toFixed(2)}</b> / ${p.amount} บาท</span>
                  <button class="bar-btn" onclick="addSavingToPlan('${goal.id}',${planIdx})">+ ออม</button>
                </div>
              `).join('') : '<i>ไม่มีแผน</i>'}
            </div>
          `;
          goalListContainer.appendChild(goalBlock);
        });
      });
  });
}

function planTypeText(type) {
  if(type === "daily") return "รายวัน";
  if(type === "weekly") return "รายสัปดาห์";
  if(type === "monthly") return "รายเดือน";
  return "";
}

// เพิ่มเงินออมแต่ละงวด
function addSavingToPlan(goalId, planIdx) {
  firebase.auth().onAuthStateChanged(function(user) {
    if (!user) return;
    db.collection("users").doc(user.uid).collection("goals").doc(goalId).get()
      .then(doc => {
        if (!doc.exists) return;
        const goal = doc.data();
        let plan = goal.plan;
        let left = parseFloat(plan[planIdx].amount) - parseFloat(plan[planIdx].saved || 0);
        let save = parseFloat(prompt("กรุณาใส่จำนวนเงินที่จะออม (สำหรับงวดนี้):", left > 0 ? left : '0'));
        if (!Number.isFinite(save) || save <= 0) {
          alert("จำนวนเงินไม่ถูกต้อง");
          return;
        }
        if (!plan[planIdx].saved) plan[planIdx].saved = 0;
        plan[planIdx].saved += save;
        if (plan[planIdx].saved > plan[planIdx].amount) plan[planIdx].saved = parseFloat(plan[planIdx].amount);
        goal.savings = plan.reduce((sum, p) => sum + (p.saved || 0), 0);
        db.collection("users").doc(user.uid).collection("goals").doc(goalId).update({
          plan: plan,
          savings: goal.savings
        }).then(updateGoalList);
      });
  });
}

// ลบเป้าหมาย
function deleteGoal(goalId) {
  if (!confirm("ต้องการลบเป้าหมายนี้จริงหรือไม่?")) return;
  firebase.auth().onAuthStateChanged(function(user) {
    if (!user) return;
    db.collection("users").doc(user.uid).collection("goals").doc(goalId).delete().then(updateGoalList);
  });
}

// โหลด goal list ทันทีเมื่อเปิดหน้า
updateGoalList();
