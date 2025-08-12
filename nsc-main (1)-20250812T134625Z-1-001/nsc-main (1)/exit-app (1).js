/* exit-app.js (เวอร์ชันแก้ไขล่าสุด) */
document.addEventListener('DOMContentLoaded', () => {
    // สร้างกล่องข้อความ (Toast) ถ้ายังไม่มี
    let toast = document.getElementById('exitToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'exitToast';
        toast.className = 'exit-toast';
        toast.textContent = 'กดอีกครั้งเพื่อออกจากแอป';
        document.body.appendChild(toast);
    }

    let readyToExit = false;

    // ฟังก์ชันสำหรับจัดการการกดย้อนกลับ
    const handlePopState = () => {
        // **เงื่อนไขสำคัญ:** จะทำงานก็ต่อเมื่อหน้านี้กำลังแสดงผลอยู่เท่านั้น
        // ป้องกันไม่ให้โค้ดนี้ไปรบกวนหน้าอื่น
        if (document.visibilityState !== 'visible') {
            return;
        }

        if (readyToExit) {
            // ถ้ากดครั้งที่ 2 จริงๆ ให้ย้อนกลับ (ออกจากแอป)
            // เราไม่ต้องทำอะไร ปล่อยให้เบราว์เซอร์ทำงานไป
            window.history.back();
            return;
        }

        // เมื่อกดครั้งแรก: แสดงข้อความ และ "ดัก" ไม่ให้แอปปิด
        readyToExit = true;
        toast.classList.add('show');

        // "วางกับดัก" กลับเข้าไปใน history เพื่อยกเลิกการย้อนกลับครั้งแรก
        history.pushState(null, '', location.href);

        // หลังจาก 2 วินาที, รีเซ็ตสถานะ
        setTimeout(() => {
            readyToExit = false;
            toast.classList.remove('show');
        }, 2000);
    };

    window.addEventListener('popstate', handlePopState);
});