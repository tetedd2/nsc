// 1. เช็กสถานะล็อกอิน
firebase.auth().onAuthStateChanged(function(user) {
  if (user) {
    const uid = user.uid;

    // 2. ดึงข้อมูลรายการรับจ่าย และเป้าหมาย จาก Firestore
    Promise.all([
      db.collection("users").doc(uid).collection("transactions").get(),
      db.collection("users").doc(uid).collection("goals").get()
    ]).then(([txSnap, goalsSnap]) => {
      let transactions = [];
      let goals = [];

      txSnap.forEach(doc => transactions.push(doc.data()));
      goalsSnap.forEach(doc => goals.push(doc.data()));

      // 3. คำนวณสรุปเหมือนโค้ดเดิม
      let totalIncome = 0;
      let totalExpense = 0;
      transactions.forEach(tx => {
        const amount = parseFloat(tx.amount);
        if (!isNaN(amount) && amount >= 0) {
          if (tx.type === 'income') totalIncome += amount;
          else if (tx.type === 'expense') totalExpense += amount;
        }
      });

      const spendable = totalIncome * 0.7;
      let totalGoalSavings = 0;
      goals.forEach(goal => {
        totalGoalSavings += goal.savings || 0;
      });

      const netSpendable = Math.max(0, spendable - totalGoalSavings);

      // 4. อัปเดตแสดงผลหน้าเว็บ
      document.getElementById('income').textContent = totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 });
      document.getElementById('savings').textContent = totalIncome ? (totalIncome * 0.3).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00';

      const netExpenseRealRow = document.getElementById('net-expense-real-row');
      if (totalIncome) {
        const realLeft = netSpendable - totalExpense;
        netExpenseRealRow.innerHTML = `คงเหลือจากควรใช้จ่ายสุทธิ: <b>${realLeft.toLocaleString(undefined, { minimumFractionDigits: 2 })}</b> บาท`;
      } else {
        netExpenseRealRow.textContent = '';
      }

      // 5. บันทึก "Summary" ไปยัง Firestore
      const summary = {
        totalIncome,
        totalExpense,
        totalSavings: totalIncome * 0.3,
        netSpendable: netSpendable - totalExpense,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      db.collection("users").doc(uid).collection("summary").doc("main").set(summary);

      // 6. โค้ดแสดงผลเป้าหมาย (เหมือนเดิม)
      let currentGoalIndex = goals.length ? goals.length - 1 : 0;
      function renderGoal(idx) {
        let goalInfoText = '- ยังไม่มีเป้าหมายที่ตั้งไว้ -';
        if (goals.length) {
          const goal = goals[idx];
          const percent = Math.min(goal.savings / goal.target * 100, 100);
          goalInfoText = `${goal.name} – ออมแล้ว ${goal.savings.toLocaleString()} / ${goal.target.toLocaleString()} บาท (${percent.toFixed(0)}%)`;
        }
        document.getElementById('goalName').textContent = goalInfoText;
      }
      renderGoal(currentGoalIndex);
      document.getElementById('prevGoal').onclick = function () {
        if (!goals.length) return;
        currentGoalIndex = (currentGoalIndex - 1 + goals.length) % goals.length;
        renderGoal(currentGoalIndex);
      };
      document.getElementById('nextGoal').onclick = function () {
        if (!goals.length) return;
        currentGoalIndex = (currentGoalIndex + 1) % goals.length;
        renderGoal(currentGoalIndex);
      };

    }); // End Promise.all
  } else {
    // ถ้าไม่ล็อกอิน ให้ redirect ไปหน้า login
    window.location.href = "login.html";
  }
});
