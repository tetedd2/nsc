# 🌐 Phase 4 — เสิร์ฟน้องซี + เชื่อมเข้าแอป

หน้าแชต "น้องซี" ในแอปเรียกใช้ [`js/nong-see.js`](../js/nong-see.js) ซึ่งทำงาน 3 ชั้น:

1. **Guardrail** — ปฏิเสธคำถามนอกเรื่อง/ผิดกฎหมายที่ชัดเจนทันที
2. **โมเดลที่เทรน** — ถ้าตั้งค่า endpoint ไว้ จะเรียกโมเดล (รูปแบบ OpenAI chat-completions)
3. **Fallback บอตกฎ** — ถ้าไม่มี endpoint หรือเรียกไม่สำเร็จ ใช้บอตกฎแทน **แอปจึงไม่มีวันเงียบ**

> ตอนนี้ยังไม่ได้ตั้ง endpoint → แอปใช้ **บอตกฎ (fallback)** อยู่ ใช้งานได้ทันที

## 🔌 วิธีเปิดใช้โมเดลที่เทรนเอง

**วิธีแนะนำ (ไม่ต้องแก้โค้ด):** เปิดแชตน้องซีในแอป → กดปุ่มเฟือง ⚙ ที่หัวหน้าต่าง →
วาง **Endpoint** (+ API Key ถ้ามี) → กด **ทดสอบ** → ถ้าเขียว (🟢 โมเดล AI) = ต่อสำเร็จ
ค่าถูกเก็บใน localStorage ใช้ได้ทุกหน้า และถอยไปบอตกฎอัตโนมัติถ้าเซิร์ฟเวอร์ล่ม

ตั้งจาก console ก็ได้:
```js
nongSee.connect('https://<your-endpoint>/v1/chat/completions', 'nong-see', 'API_KEY_ถ้ามี')
await nongSee.test()
```

**หรือ** กำหนดค่าเริ่มต้นถาวรในโค้ดที่ [`js/nong-see.js`](../js/nong-see.js) → `NONG_SEE_CONFIG.endpoint`

endpoint ต้องรับ request รูปแบบ OpenAI:
```json
POST { "model": "...", "messages": [ {"role":"system",...}, {"role":"user",...} ] }
→ { "choices": [ { "message": { "content": "คำตอบ" } } ] }
```

## 🖥️ ตัวเลือกเสิร์ฟ (เลือกอันใดอันหนึ่ง)

| วิธี | ฟรี? | หมายเหตุ |
|------|------|---------|
| **Ollama** (เครื่องตัวเอง) | ✅ | นำเข้า GGUF จากโน้ตบุ๊ก → `ollama run` → endpoint `http://localhost:11434/v1/chat/completions` |
| **LM Studio** (เครื่องตัวเอง) | ✅ | โหลด GGUF → เปิด Local Server → endpoint `http://localhost:1234/v1/chat/completions` |
| **Hugging Face Space** | ✅ (CPU) | อัปโมเดล + เปิด API (เช่น vLLM/TGI OpenAI-compat) — ช้าหน่อยแต่ออนไลน์ |
| **proxy.js ของเรา** | — | ตอนนี้ต่อ OpenAI แต่ดัดแปลงให้ forward ไปเซิร์ฟเวอร์โมเดลก็ได้ |
| **ในเบราว์เซอร์ (WebLLM)** | ✅ | ไม่มีเซิร์ฟเวอร์ แต่ต้องแปลงโมเดลเป็นรูปแบบ WebLLM และโหลดหนัก |

## ⚠️ เรื่อง CORS

เบราว์เซอร์จะบล็อกการเรียก endpoint ข้ามโดเมนถ้าเซิร์ฟเวอร์ไม่อนุญาต CORS:
- **Ollama**: ตั้ง env `OLLAMA_ORIGINS=*` (หรือระบุโดเมนแอป) ก่อนรัน
- **HF Space / เซิร์ฟเวอร์เอง**: เปิด CORS header `Access-Control-Allow-Origin` ให้โดเมนแอป
- **proxy.js**: จัดการ CORS ให้แล้ว (ปรับ `ALLOWED_ORIGINS` ใน `.env`)

## 🧪 ทดสอบ

1. ไม่ตั้ง endpoint → แชตต้องตอบด้วยบอตกฎได้ (เช่น "เริ่มออมเงินยังไง")
2. ถาม guardrail ("ขอเลขเด็ด", "เขียนโค้ดให้หน่อย") → ต้องปฏิเสธสุภาพ
3. ตั้ง endpoint โมเดล → ถามแล้วดูว่าคำตอบมาจากโมเดล (ดู console: `source: 'model'`) และถ้าปิดเซิร์ฟเวอร์ ต้อง fallback เป็นบอตกฎอัตโนมัติ

## 🔒 ความปลอดภัย
- อย่าใส่ API key ลงใน `nong-see.js` (เป็นไฟล์ฝั่ง client ที่ใครก็อ่านได้) — ถ้า endpoint ต้องใช้ key ให้ผ่าน proxy ฝั่งเซิร์ฟเวอร์เหมือน `proxy.js`
- โมเดลใช้เพื่อการศึกษา ควรเตือนผู้ใช้ว่าไม่ใช่คำแนะนำการลงทุน/ภาษีเฉพาะบุคคล
