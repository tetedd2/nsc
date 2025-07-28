// ================== Firebase Configuration (Re-defined for this file's scope) ==================
// ตรวจสอบให้แน่ใจว่าการตั้งค่าเหล่านี้ตรงกับการตั้งค่าโปรเจกต์ Firebase ของคุณ
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
// นำเข้าโมดูล Firebase ที่จำเป็น
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';
import {
    getFirestore, collection, doc, setDoc, getDoc, updateDoc, onSnapshot,
    query, orderBy, addDoc, deleteDoc, serverTimestamp, arrayUnion, increment
} from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js';

// ================== Firebase Initialization ==================
// เริ่มต้นใช้งาน Firebase services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); // ไม่ได้ใช้ในไฟล์นี้โดยตรง แต่คงไว้ได้

// ================== Global Data for Badges (Needed for checkAndAwardBadge) ==================
// กำหนดข้อมูลเหรียญตราทั้งหมดสำหรับแอปพลิเคชัน
const allBadges = [
    { id: 'first_transaction', name: 'นักบันทึกมือใหม่', description: 'บันทึกธุรกรรมแรกของคุณ', icon: '✍️' },
    { id: 'first_goal', name: 'ผู้ตั้งเป้าหมาย', description: 'สร้างเป้าหมายการออมแรก', icon: '🎯' },
    { id: 'saving_streak_3', name: 'ออมต่อเนื่อง 3 วัน', description: 'บันทึกรายรับหรือการออม 3 วันติด', icon: '🔥' },
    { id: 'first_level_up', name: 'ก้าวแรกสู่ความเชี่ยวชาญ', description: 'เลื่อนระดับเป็นครั้งแรก', icon: '🌟' },
    // เพิ่มเหรียญตราอื่นๆ ที่คุณมี
];

// ================== Global Message Box Function ==================
// ฟังก์ชันสำหรับแสดงกล่องข้อความแจ้งเตือน (MessageBox)
window.showMessageBox = function(message, type = "info", onConfirm = null) {
    const box = document.getElementById("messageBox");
    const content = document.getElementById("messageBoxContent");
    const text = document.getElementById("messageText");
    const closeBtn = document.getElementById("messageCloseBtn");

    if (!box || !content || !text || !closeBtn) {
        console.error("Message box elements not found. Cannot display message.");
        alert(message); // แสดง alert ของเบราว์เซอร์หากหา element ไม่เจอ
        if (onConfirm) onConfirm();
        return;
    }

    text.textContent = message;
    content.className = 'message-box-content'; // รีเซ็ตคลาส
    content.classList.add(type); // เพิ่มคลาสตามประเภทข้อความ (success, error, info)
    box.style.display = "flex";
    setTimeout(() => box.classList.add("show"), 10); // แสดงกล่องข้อความพร้อม animation

    const closeHandler = () => {
        box.classList.remove("show");
        setTimeout(() => {
            box.style.display = "none";
            if (onConfirm) onConfirm(); // เรียก callback function เมื่อปิดกล่องข้อความ
        }, 300);
    };

    closeBtn.onclick = closeHandler; // กำหนด event handler สำหรับปุ่มปิด
    box.onclick = (e) => { // ปิดกล่องข้อความเมื่อคลิกนอกพื้นที่ content
        if (e.target === box) {
            closeHandler();
        }
    };
}


// ตั้งค่าวันที่ปัจจุบันในช่อง input วันที่เมื่อ DOM โหลดเสร็จ
window.addEventListener('DOMContentLoaded', function () {
  const dateInput = document.getElementById('date');
  if (dateInput) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0'); // เดือนเป็น 0-indexed
    const dd = String(today.getDate()).padStart(2, '0');
    dateInput.value = `${yyyy}-${mm}-${dd}`;
  }
});

// ฟังก์ชันสำหรับบันทึกข้อมูลธุรกรรมลง Firestore
async function saveTransaction(event) {
  event.preventDefault(); // ป้องกันพฤติกรรมเริ่มต้นของการ submit form
  console.log("saveTransaction function called."); // Log: ฟังก์ชันเริ่มต้นทำงาน

  // ดึงค่าจาก input form
  const type = document.getElementById('type').value;
  const description = document.getElementById('description').value.trim(); // ใช้ 'description' เป็นชื่อรายการ
  const amount = parseFloat(document.getElementById('amount').value);
  const date = document.getElementById('date').value;

  console.log("Form data:", { type, description, amount, date }); // Log: ข้อมูลที่ได้จาก Form

  // ตรวจสอบความถูกต้องของข้อมูล
  if (!type || !amount || amount <= 0 || !date) {
    window.showMessageBox("กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง", "error"); // แสดงข้อความ error
    console.log("Input validation failed."); // Log: การตรวจสอบข้อมูลไม่ผ่าน
    return; // หยุดการทำงานของฟังก์ชัน
  }
  console.log("Input validation passed."); // Log: การตรวจสอบข้อมูลผ่าน

  // ตรวจสอบสถานะการยืนยันตัวตนของผู้ใช้ด้วย Firebase onAuthStateChanged
  // เพื่อให้แน่ใจว่ามีผู้ใช้ (แม้จะเป็น anonymous) ก่อนที่จะพยายามทำธุรกรรมกับ Firestore
  if (typeof auth === 'undefined' || typeof onAuthStateChanged === 'undefined') {
      console.error("Firebase Auth or onAuthStateChanged is not defined. Ensure Firebase is initialized correctly.");
      window.showMessageBox("ไม่สามารถเชื่อมต่อกับระบบยืนยันตัวตนได้ กรุณาลองใหม่ภายหลัง", "error");
      return;
  }

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      console.log("User authenticated:", user.uid); // Log: ผู้ใช้ล็อกอินแล้ว
      // สร้าง object ของธุรกรรมพร้อมข้อมูลและ server timestamp
      const transaction = {
        type,
        name: description, // ใช้ description เป็นชื่อรายการธุรกรรม
        amount,
        date,
        createdAt: serverTimestamp() // ใช้ timestamp จากเซิร์ฟเวอร์ Firebase
      };
      console.log("Transaction object to save:", transaction); // Log: ข้อมูลธุรกรรมที่จะบันทึก

      try {
        console.log("Attempting to add document to Firestore..."); // Log: กำลังพยายามเขียนข้อมูลลง Firestore
        // ตรวจสอบว่า db, collection, addDoc, appId ถูกกำหนดไว้แล้ว
        if (typeof db === 'undefined' || typeof collection === 'undefined' || typeof addDoc === 'undefined' || typeof firebaseConfig.appId === 'undefined') {
            console.error("Firebase Firestore components or appId are not defined. Ensure Firebase is initialized correctly.");
            window.showMessageBox("ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่ภายหลัง", "error");
            return;
        }

        // เพิ่มเอกสารธุรกรรมลงใน collection เฉพาะของผู้ใช้ใน Firestore
        const transactionsCollectionRef = collection(db, `users/${user.uid}/transactions`);
        await addDoc(transactionsCollectionRef, transaction);

        console.log("Document successfully added to Firestore!"); // Log: เขียนข้อมูลลง Firestore สำเร็จ

        // ================== เพิ่ม XP และตรวจสอบเหรียญตราที่นี่ ==================
        const userRef = doc(db, 'users', user.uid);
        // เพิ่ม XP จำนวน 10 คะแนนไปยังฟิลด์ 'xp' ของผู้ใช้
        // `increment(10)` จะบวก 10 เข้าไปในค่าปัจจุบันของ field 'xp'
        await updateDoc(userRef, {
            xp: increment(10) 
        });
        console.log("User XP incremented by 10.");

        // ตรวจสอบและมอบเหรียญตรา "นักบันทึกมือใหม่" (first_transaction)
        await checkAndAwardBadge(user.uid, 'first_transaction');
        // =======================================================================

        // แสดงข้อความสำเร็จและเปลี่ยนเส้นทางไปยัง dashboard.html หลังจากยืนยัน
        window.showMessageBox("บันทึกรายการสำเร็จ! ได้รับ 10 XP!", "success", () => {
          console.log("Redirecting to dashboard.html..."); // Log: กำลังเปลี่ยนเส้นทาง
          window.location.href = "dashboard.html"; // เปลี่ยนเส้นทางไปยังหน้า Dashboard
        });
      } catch (err) {
        console.error("Error adding document to Firestore: ", err); // Log: ข้อผิดพลาดในการเขียน Firestore
        // แสดงข้อความ error ทั่วไปหากการบันทึกล้มเหลว
        window.showMessageBox("ไม่สามารถทำรายการได้ในขณะนี้", "error");
      }
    } else {
      console.log("User not authenticated."); // Log: ผู้ใช้ไม่ได้ล็อกอิน
      // หากผู้ใช้ไม่ได้ล็อกอิน ให้แจ้งเตือนให้ล็อกอิน
      window.showMessageBox("กรุณาเข้าสู่ระบบเพื่อบันทึกรายการ", "info", () => {
        // (ตัวเลือก) สามารถเปลี่ยนเส้นทางไปยังหน้า login ได้ที่นี่
        // window.location.href = "login.html";
        console.log("User not authenticated. Please implement login redirection if needed.");
      });
    }
  });
}

// ================== Badge System (Copied from dashboard.js) ==================
// ฟังก์ชันสำหรับตรวจสอบและมอบเหรียญตราให้ผู้ใช้
async function checkAndAwardBadge(uid, badgeId) {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
        const userData = userSnap.data();
        // ตรวจสอบว่าผู้ใช้ยังไม่ได้รับเหรียญตรานี้
        if (!(userData.badges || []).includes(badgeId)) {
            try {
                // อัปเดตข้อมูลผู้ใช้เพื่อเพิ่มเหรียญตรา, XP และเหรียญรางวัล
                await updateDoc(userRef, {
                    badges: arrayUnion(badgeId), // เพิ่ม ID เหรียญตราลงใน array
                    xp: increment(20), // ให้รางวัล 20 XP สำหรับเหรียญตรา (สามารถปรับได้)
                    coins: increment(30) // ให้รางวัล 30 เหรียญสำหรับเหรียญตรา (สามารถปรับได้)
                });
                const awardedBadge = allBadges.find(b => b.id === badgeId);
                if (awardedBadge) {
                    alert(`ได้รับเหรียญตราใหม่: ${awardedBadge.name}!`); // ใช้ alert เพื่อแจ้งผู้ใช้
                }
            } catch (error) {
                console.error(`Error awarding badge ${badgeId}:`, error);
            }
        }
    }
}

// ทำให้ฟังก์ชัน saveTransaction สามารถเรียกใช้ได้จาก form HTML
window.saveTransaction = saveTransaction;
