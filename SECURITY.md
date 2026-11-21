# หมายเหตุด้านความปลอดภัย (MoneySkillz)

สรุปการแก้ไขด้านความปลอดภัย และสิ่งที่ต้องทำต่อ

## ⚠️ ต้องทำทันที (สำคัญที่สุด)

**ยกเลิก (revoke) OpenAI API key ตัวเดิม**
ก่อนหน้านี้มี key จริงฝังอยู่ในไฟล์ `proxy.js` และถูกแชร์/commit ไปแล้ว ถือว่า "หลุด" อย่างถาวร
ใครก็ตามที่เคยเห็นไฟล์สามารถนำไปใช้จนเกิดค่าใช้จ่ายกับบัญชีได้

1. เข้า https://platform.openai.com/api-keys
2. ลบ (revoke) key ตัวเดิมที่ขึ้นต้นด้วย `sk-proj-Bl6FR...`
3. สร้าง key ใหม่ แล้วนำไปใส่ในไฟล์ `.env` (ดูข้างล่าง) — **ห้ามใส่กลับลงในโค้ด**

> การแก้โค้ดอย่างเดียวไม่พอ เพราะ key เดิมยังอยู่ในประวัติ git / ไฟล์ที่แชร์ไปแล้ว ต้อง revoke เท่านั้น

## สิ่งที่แก้ไปแล้วในโค้ด

| ไฟล์ | เดิม | แก้เป็น |
|------|------|---------|
| `proxy.js` | ฝัง OpenAI key ไว้ในโค้ด, CORS เปิดทุก origin, ไม่มี error handling | อ่าน key จาก `process.env.OPENAI_API_KEY`, จำกัด CORS, มี try/catch |
| `firestore.rules` | กฎเริ่มต้นที่หมดอายุ 6 ส.ค. 2025 (ตอนนี้ปฏิเสธทุก request) | กฎแบบ "เจ้าของเข้าถึงข้อมูลตัวเอง" รองรับเพื่อน/แชต/leaderboard |
| `.gitignore` | ไม่มี | เพิ่ม เพื่อกัน `.env` และ `node_modules` หลุด |
| `.env.example` | ไม่มี | เพิ่ม เป็นแม่แบบตั้งค่า |
| `package.json` | ไม่มี | เพิ่ม สำหรับติดตั้ง/รัน proxy |

## วิธีรัน proxy หลังแก้

```powershell
Copy-Item .env.example .env   # แล้วเปิด .env ใส่ OPENAI_API_KEY ตัวใหม่
npm install
npm start
```

## หมายเหตุเพิ่มเติม

- **Firebase web config** (apiKey ใน `login.html`, `dashboard.js` ฯลฯ) — อันนี้ **ปกติ** ที่เปิดเผยได้ เพราะเป็นตัวระบุโปรเจกต์ฝั่ง client ความปลอดภัยจริงมาจาก **Firestore Security Rules** (ที่เพิ่งแก้) ไม่ใช่การซ่อน config
- **`database.rules.json`** ตั้ง `read/write: false` อยู่แล้ว ปลอดภัยดี เพราะแอปใช้ Firestore ไม่ได้ใช้ Realtime Database
- อย่าลืม **deploy กฎใหม่** ขึ้น Firebase:

```bash
firebase deploy --only firestore:rules
```

- แชตบอตในหน้า dashboard ปัจจุบันใช้คำตอบสำเร็จรูป (ฟังก์ชัน `getAiResponse`) ยังไม่ได้ต่อกับ `proxy.js` จริง ถ้าจะใช้ AI จริงต้องเชื่อมภายหลัง
