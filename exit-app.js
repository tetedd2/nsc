/* exit-app.js (ฉบับแก้ไข) */
/* Logic สำหรับการกดย้อนกลับสองครั้งเพื่อออกจากแอป */

document.addEventListener('DOMContentLoaded', () => {
    // สร้างกล่องข้อความ (Toast) ด้วย JavaScript
    let toast = document.getElementById('exitToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'exitToast';
        toast.className = 'exit-toast';
        toast.textContent = 'กดอีกครั้งเพื่อออกจากแอป';
        document.body.appendChild(toast);
    }

    // --- เริ่ม Logic ใหม่ที่เสถียรกว่า ---

    // 1. "วางกับดัก" ใน history เมื่อหน้าเว็บโหลดเสร็จ
    // ทำให้ history stack เป็น [..., หน้าปัจจุบัน, กับดัก]
    history.pushState(null, '', null);

    let allowExit = false;

    window.addEventListener('popstate', function(event) {
        // 2. เมื่อผู้ใช้กดย้อนกลับครั้งแรก browser จะ pop "กับดัก" ออก
        // แต่ตัว event listener ของเราจะทำงานก่อนที่หน้าจะเปลี่ยน
        if (allowExit) {
            // ถ้ากดครั้งที่ 2 ภายใน 2 วินาที (allowExit เป็น true)
            // เราจะไม่ทำอะไรเลย ปล่อยให้ browser ทำงานย้อนกลับตามปกติ (ซึ่งก็คือการออกจากแอป)
            return;
        }

        // ถ้าเป็นการกดครั้งแรก (allowExit เป็น false)
        allowExit = true; // ตั้งค่าสถานะว่ากดครั้งแรกแล้ว
        toast.classList.add('show'); // แสดงข้อความ

        // ถ้าไม่กดครั้งที่ 2 ภายใน 2 วินาที ให้รีเซ็ตสถานะ
        setTimeout(() => {
            allowExit = false;
            toast.classList.remove('show');
        }, 2000);

        // 3. "วางกับดัก" กลับเข้าไปใน history อีกครั้ง
        // เพื่อดักการกดครั้งต่อไป และป้องกันไม่ให้แอปปิดในครั้งแรก
        history.pushState(null, '', null);
    });
});
