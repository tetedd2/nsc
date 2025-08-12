// forgetpassword.js

// Config ใหม่ของโปรเจกต์
const firebaseConfig = {
  apiKey: "AIzaSyBjLBl1sEGgQLyng51rW25b434bJ0opVc4",
  authDomain: "myapplication-bd04c034.firebaseapp.com",
  projectId: "myapplication-bd04c034",
  storageBucket: "myapplication-bd04c034.appspot.com",
  messagingSenderId: "49782830313",
  appId: "1:49782830313:web:c81b5d86a937f22d296c78"
};
// เริ่มต้น Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

document.getElementById('resetForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const messageDiv = document.getElementById('message');

  if (!email) {
    messageDiv.textContent = "กรุณากรอกอีเมลที่ถูกต้อง";
    messageDiv.style.color = "#c62828";
    return;
  }

  messageDiv.textContent = "กำลังส่งลิงก์รีเซ็ตรหัสผ่าน...";
  messageDiv.style.color = "#1565c0";

  try {
    await auth.sendPasswordResetEmail(email);
    messageDiv.textContent = "ลิงก์รีเซ็ตรหัสผ่านถูกส่งไปยังอีเมลของคุณแล้ว!";
    messageDiv.style.color = "#388e3c";
  } catch (error) {
    messageDiv.textContent = "เกิดข้อผิดพลาด: " + error.message;
    messageDiv.style.color = "#c62828";
  }
});
