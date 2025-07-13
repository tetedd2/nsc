window.addEventListener('DOMContentLoaded', function () {
  const dateInput = document.getElementById('date');
  if (dateInput) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    dateInput.value = `${yyyy}-${mm}-${dd}`;
  }
});

// ฟังก์ชันบันทึกรายการลง Firestore
function saveTransaction(event) {
  event.preventDefault();

  const type = document.getElementById('type').value;
  const name = document.getElementById('name').value.trim();
  const amount = parseFloat(document.getElementById('amount').value);
  const date = document.getElementById('date').value;

  if (!type || !name || !amount || amount <= 0 || !date) {
    alert("กรุณากรอกข้อมูลให้ครบถ้วน");
    return;
  }

  firebase.auth().onAuthStateChanged(function(user) {
    if (user) {
      const transaction = {
        type, name, amount, date,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      db.collection("users").doc(user.uid).collection("transactions").add(transaction)
        .then(() => {
          alert("บันทึกรายการสำเร็จ!");
          window.location.href = "dashboard.html";
        })
        .catch(err => {
          alert("เกิดข้อผิดพลาด: " + err.message);
        });
    } else {
      alert("กรุณาเข้าสู่ระบบใหม่");
      window.location.href = "login.html";
    }
  });
}
