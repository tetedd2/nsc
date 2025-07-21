/* exit-app.js */
/* Logic สำหรับการกดย้อนกลับสองครั้งเพื่อออกจากแอป */

document.addEventListener('DOMContentLoaded', () => {
    // สร้างกล่องข้อความ (Toast) ด้วย JavaScript และเพิ่มเข้าไปใน body
    // ทำให้ไม่ต้องแก้โค้ด HTML ทุกหน้า
    let toast = document.createElement('div');
    toast.id = 'exitToast';
    toast.className = 'exit-toast';
    toast.textContent = 'กดอีกครั้งเพื่อออกจากแอป';
    document.body.appendChild(toast);

    let backButtonPressedOnce = false;

    const handleBackButton = () => {
        // ถ้าเป็นการกดครั้งแรก
        if (!backButtonPressedOnce) {
            backButtonPressedOnce = true;
            toast.classList.add('show'); // แสดงกล่องข้อความ

            // หลังจาก 2 วินาที, รีเซ็ตสถานะและซ่อนกล่องข้อความ
            setTimeout(() => {
                backButtonPressedOnce = false;
                toast.classList.remove('show');
            }, 2000);

            // "ดัก" การย้อนกลับครั้งแรกไว้ โดยการเพิ่ม state เข้าไปใน history
            // ทำให้เบราว์เซอร์ไม่ย้อนกลับไปหน้าก่อนหน้าทันที
            history.pushState(null, '', null);
        } else {
            // ถ้ากดครั้งที่ 2 ภายใน 2 วินาที
            toast.classList.remove('show');
            // ปล่อยให้เบราว์เซอร์ทำงานตามปกติ (ย้อนกลับ)
            // ซึ่งถ้าไม่มีหน้าให้ย้อนแล้ว ก็จะเท่ากับเป็นการออกจากเว็บแอป
            history.back();
        }
    };

    // เพิ่ม state เริ่มต้นเข้าไปใน history ตอนโหลดหน้าเสร็จ
    // เพื่อให้เราสามารถดักจับการกด 'ย้อนกลับ' ครั้งแรกได้
    history.pushState(null, '', null);

    // lắng nghe event 'popstate' ซึ่งจะทำงานเมื่อผู้ใช้กดปุ่มย้อนกลับ
    window.addEventListener('popstate', handleBackButton);
});