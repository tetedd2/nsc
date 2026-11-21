# 🧠 Dataset เทรน "น้องซี" — AI โค้ชการเงิน MoneySkillz

ชุดข้อมูลถาม-ตอบการเงินภาษาไทย สำหรับ fine-tune โมเดลภาษาให้เป็นผู้ช่วยการเงิน
ที่ **ตอบเฉพาะเรื่องการเงิน** (มี guardrail ปฏิเสธเรื่องนอกขอบเขต)

## 📁 ไฟล์ในโฟลเดอร์นี้

| ไฟล์ | คืออะไร |
|------|---------|
| `finance-qa-source.json` | **แหล่งข้อมูลหลัก** — แก้/เพิ่มที่นี่ที่เดียว |
| `build-dataset.cjs` | สคริปต์แปลง source → JSONL + validate + แบ่ง train/val |
| `finance_th.jsonl` | ชุดข้อมูลทั้งหมด (รูปแบบ chat) |
| `finance_th.train.jsonl` | ชุดเทรน (~90%) |
| `finance_th.val.jsonl` | ชุดตรวจสอบ (~10%) |

> ไฟล์ `.jsonl` เป็น **ผลลัพธ์ที่ generate** — อย่าแก้มือ ให้แก้ที่ `finance-qa-source.json` แล้วรัน build ใหม่

## 🔧 วิธีสร้าง/อัปเดต dataset

```bash
node data/build-dataset.cjs
```

## ➕ วิธีเพิ่มข้อมูล

เปิด `finance-qa-source.json` แล้วเพิ่ม item ใน `items`:

```json
{
  "category": "saving",
  "q": ["คำถามสำนวนที่ 1", "คำถามสำนวนที่ 2"],
  "a": "คำตอบของน้องซี..."
}
```

- `q` ใส่ได้หลายสำนวน → แต่ละสำนวนกลายเป็น 1 ตัวอย่างเทรน (data augmentation)
- `category` ใช้จัดกลุ่ม/ดูสถิติ (เช่น saving, investing, debt, guardrail ...)
- อยากให้น้องซี "ตอบเฉพาะการเงิน" ดีขึ้น ให้เพิ่มตัวอย่าง `category: "guardrail"` (คำถามนอกเรื่อง + คำปฏิเสธสุภาพ) เยอะ ๆ

## 📐 รูปแบบข้อมูล (chat / messages)

แต่ละบรรทัดใน `.jsonl` เป็น 1 ตัวอย่าง:

```json
{"messages":[
  {"role":"system","content":"<system prompt นิยามน้องซี + guardrail>"},
  {"role":"user","content":"<คำถาม>"},
  {"role":"assistant","content":"<คำตอบ>"}
]}
```

รูปแบบนี้รองรับโดยเครื่องมือ fine-tune ยอดนิยม (Unsloth, Axolotl, TRL/SFTTrainer)

## 🎯 system prompt (บุคลิก + guardrail)

กำหนดไว้ที่ฟิลด์ `system` ใน source — นิยามให้น้องซี:
- เป็นโค้ชการเงินเยาวชนไทย พูดเป็นกันเอง ให้กำลังใจ
- **ตอบเฉพาะเรื่องการเงิน** ถ้าถามนอกเรื่องให้ปฏิเสธสุภาพแล้วชวนกลับ
- ไม่ชี้นำซื้อขายหลักทรัพย์รายตัว และเตือนความเสี่ยงเสมอ

## 🚀 ขั้นตอน fine-tune (ภาพรวม — ทำบน Google Colab ฟรี)

1. เลือกโมเดลฐานที่เก่งภาษาไทยและเล็กพอ (เช่น Typhoon, Qwen2.5-1.5B/3B-Instruct, SeaLLM)
2. ติดตั้ง Unsloth (เทรน LoRA ได้เร็ว/ประหยัด VRAM บน GPU T4 ฟรี)
3. โหลด `finance_th.train.jsonl` ใช้ chat template ของโมเดล
4. เทรน LoRA ไม่กี่ epoch แล้วประเมินด้วย `finance_th.val.jsonl`
5. **ทดสอบ guardrail**: ถามเรื่องนอกการเงิน โมเดลต้องปฏิเสธสุภาพ
6. merge/quantize แล้วนำไปเสิร์ฟ (HF Space ฟรี หรือในเบราว์เซอร์ด้วย WebLLM) — ดู `ROADMAP.md`

## 📊 ปริมาณปัจจุบัน

รัน `node data/build-dataset.cjs` เพื่อดูสถิติล่าสุด (จำนวนตัวอย่าง + แยกตามหมวด)
ชุดเริ่มต้นนี้เป็น **ตัวตั้งต้น** — ยิ่งเพิ่มข้อมูลหลากหลายและ guardrail มากขึ้น โมเดลยิ่งตอบดีและอยู่ในขอบเขตการเงินได้แม่นขึ้น

> ⚠️ ข้อมูลนี้ใช้เพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน/ภาษีเฉพาะบุคคล
