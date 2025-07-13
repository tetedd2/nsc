const express = require("express");
const cors = require("cors");
const app = express();

// ต้องเรียงแบบนี้!
app.use(cors());             // เปิด cors ให้ทุก path ทุก method ทุก domain
app.use(express.json());

// ===== ใส่ OPENAI API KEY ของคุณตรงนี้ =====
const OPENAI_API_KEY = "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"; // ← อย่าแชร์ key นี้กับคนอื่น

app.post("/chat", async (req, res) => {
  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(req.body)
  });
  const data = await openaiRes.json();
  res.json(data);
});

// ไม่ต้องเพิ่มอะไรเกี่ยวกับ OPTIONS! Express + cors จะจัดการให้เอง
app.listen(3000, () => console.log("Proxy running on http://localhost:3000"));
