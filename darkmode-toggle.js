/* โหมดมืด — ปลอดภัยแม้สคริปต์ถูกโหลดซ้ำ (ห่อ IIFE ให้ตัวแปรอยู่ใน scope ตัวเอง) */
(function () {
  // เปิดโหมดมืดตอนโหลด ถ้าผู้ใช้เคยเลือกไว้
  const enableDark = localStorage.getItem("moneySkillzDarkMode") === "true";
  if (enableDark) document.body.classList.add("dark-mode");

  // ผูก event เฉพาะหน้าที่มีปุ่มสลับ (กัน error ในหน้าที่ไม่มี #dark-mode-toggle)
  const darkToggle = document.getElementById('dark-mode-toggle');
  if (darkToggle) {
    darkToggle.checked = (localStorage.getItem("moneySkillzDarkMode") === "true");
    darkToggle.addEventListener('change', function () {
      if (this.checked) {
        document.body.classList.add('dark-mode');
        localStorage.setItem("moneySkillzDarkMode", "true");
      } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem("moneySkillzDarkMode", "false");
      }
    });
  }
})();
