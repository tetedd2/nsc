// โหลดค่าจากไฟล์ .env (ต้องมีไฟล์ .env อยู่ข้าง ๆ ไฟล์นี้ ดูตัวอย่างใน .env.example)
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const app = express();

// ===== อ่าน OpenAI API key จาก environment variable เท่านั้น =====
// ห้าม hardcode key ลงในโค้ดเด็ดขาด (จะหลุดเมื่อ push ขึ้น git/แชร์โค้ด)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PORT = process.env.PORT || 3000;

// ถ้าไม่มี key ให้หยุดทันที จะได้รู้ตัวตั้งแต่ตอนรัน ไม่ใช่ตอนเรียก API
if (!OPENAI_API_KEY) {
  console.error(
    "❌ ไม่พบ OPENAI_API_KEY\n" +
    "   สร้างไฟล์ .env แล้วใส่บรรทัด: OPENAI_API_KEY=sk-xxxxxx\n" +
    "   (ดูตัวอย่างในไฟล์ .env.example)"
  );
  process.exit(1);
}

// จำกัด CORS เฉพาะ origin ที่อนุญาต (ตั้งค่าใน .env ได้ เช่น ALLOWED_ORIGINS=http://localhost:8080,https://yoursite.web.app)
// ถ้าไม่ตั้งค่า จะ fallback เป็น localhost ที่ใช้พัฒนาปกติ
const allowedOrigins = (process.env.ALLOWED_ORIGINS ||
  "http://localhost:8080,http://127.0.0.1:8080,http://localhost:5500,http://127.0.0.1:5500")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // อนุญาต request ที่ไม่มี origin (เช่น curl, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS: " + origin));
    },
  })
);
app.use(express.json({ limit: "1mb" }));

app.post("/chat", async (req, res) => {
  try {
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });

    const data = await openaiRes.json();
    // ส่ง status code เดียวกับที่ OpenAI ตอบกลับมา
    res.status(openaiRes.status).json(data);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(502).json({ error: "Proxy request failed" });
  }
});

app.listen(PORT, () => console.log(`Proxy running on http://localhost:${PORT}`));
