/* exit-app.js (Final Version) */
/* สคริปต์นี้จะทำงานเฉพาะหน้าหลัก เพื่อดักจับการกดย้อนกลับ 2 ครั้งเพื่อออกจากแอป */
document.addEventListener('DOMContentLoaded', () => {
    // สร้างกล่องข้อความ (Toast) ขึ้นมาเอง ถ้ายังไม่มี
    let toast = document.getElementById('exitToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'exitToast';
        toast.className = 'exit-toast';
        toast.textContent = 'กดอีกครั้งเพื่อออกจากแอป';
        document.body.appendChild(toast);
    }

    let backPressTimer = null;

    // 1. "วางกับดัก" ใน history ของเบราว์เซอร์เมื่อหน้าเว็บโหลดเสร็จ
    history.pushState({ isTrap: true }, null, "");

    window.addEventListener('popstate', function(e) {
        // 2. เมื่อผู้ใช้กดย้อนกลับครั้งแรก
        if (backPressTimer) {
            // ถ้ากดครั้งที่ 2 ภายในเวลาที่กำหนด ให้ปล่อยแอปปิดไปตามปกติ
            clearTimeout(backPressTimer);
            return; // ไม่ต้องทำอะไร ปล่อยให้ browser ทำงาน
        }

        // 3. แสดงข้อความเตือน
        toast.classList.add('show');

        // 4. "วางกับดัก" กลับเข้าไปใน history อีกครั้งทันที!
        //    ขั้นตอนนี้สำคัญมาก เพราะมันจะ "ยกเลิก" การย้อนกลับครั้งแรก
        //    และ "ล็อก" ให้ผู้ใช้ยังคงอยู่ในหน้าแอปเหมือนเดิม
        history.pushState({ isTrap: true }, null, "");

        // 5. ตั้งเวลา 2 วินาที ถ้าไม่กดซ้ำ สถานะจะถูกรีเซ็ต
        backPressTimer = setTimeout(() => {
            toast.classList.remove('show');
            backPressTimer = null;
        }, 2000);
    });
});