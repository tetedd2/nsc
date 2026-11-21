/* =============================================================
 *  build-dataset.cjs — แปลง finance-qa-source.json เป็น JSONL พร้อมเทรน
 *  รูปแบบ chat (messages: system/user/assistant) มาตรฐานสำหรับ fine-tune
 *  วิธีรัน:  node data/build-dataset.cjs
 *  ผลลัพธ์:  data/finance_th.jsonl (ทั้งหมด) + train/val split + สถิติ
 * ============================================================= */
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const SRC = path.join(DIR, 'finance-qa-source.json');

function die(msg) { console.error('❌ ' + msg); process.exit(1); }

// ---------- โหลด + ตรวจความถูกต้อง ----------
let src;
try {
  src = JSON.parse(fs.readFileSync(SRC, 'utf8'));
} catch (e) {
  die('อ่าน/parse finance-qa-source.json ไม่ได้: ' + e.message);
}
if (!src.system || typeof src.system !== 'string') die('ขาดฟิลด์ system (string)');
if (!Array.isArray(src.items) || src.items.length === 0) die('ขาด items (array)');

const system = src.system.trim();
const examples = [];
const seenQ = new Set();
const byCat = {};
let warnings = 0;

src.items.forEach((item, i) => {
  const where = 'items[' + i + ']' + (item.category ? ' (' + item.category + ')' : '');
  if (!Array.isArray(item.q) || item.q.length === 0) die(where + ': ขาด q (array ไม่ว่าง)');
  if (!item.a || typeof item.a !== 'string' || !item.a.trim()) die(where + ': ขาด a (string ไม่ว่าง)');
  const cat = item.category || 'uncategorized';

  item.q.forEach((q) => {
    const question = String(q).trim();
    if (!question) { console.warn('⚠ ' + where + ': พบคำถามว่าง ข้าม'); warnings++; return; }
    const key = question.toLowerCase();
    if (seenQ.has(key)) { console.warn('⚠ คำถามซ้ำ ข้าม: "' + question + '"'); warnings++; return; }
    seenQ.add(key);

    examples.push({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: question },
        { role: 'assistant', content: item.a.trim() },
      ],
    });
    byCat[cat] = (byCat[cat] || 0) + 1;
  });
});

if (examples.length === 0) die('ไม่มีตัวอย่างที่ใช้ได้เลย');

// ---------- เขียน JSONL ----------
function writeJSONL(file, rows) {
  fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
}

// สุ่มลำดับแบบคงที่ (seed ง่าย ๆ) เพื่อให้ split ซ้ำได้
function shuffle(arr) {
  const a = arr.slice();
  let s = 42;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const all = shuffle(examples);
const valCount = Math.max(1, Math.round(all.length * 0.1));
const val = all.slice(0, valCount);
const train = all.slice(valCount);

writeJSONL(path.join(DIR, 'finance_th.jsonl'), all);
writeJSONL(path.join(DIR, 'finance_th.train.jsonl'), train);
writeJSONL(path.join(DIR, 'finance_th.val.jsonl'), val);

// ---------- สถิติ ----------
const avgAnsLen = Math.round(
  examples.reduce((s, e) => s + e.messages[2].content.length, 0) / examples.length,
);

console.log('✅ สร้าง dataset สำเร็จ');
console.log('—'.repeat(40));
console.log('ตัวอย่างทั้งหมด : ' + examples.length + ' (train ' + train.length + ' / val ' + val.length + ')');
console.log('หมวดหมู่        : ' + Object.keys(byCat).length);
console.log('คำตอบเฉลี่ย     : ~' + avgAnsLen + ' ตัวอักษร');
if (warnings) console.log('คำเตือน         : ' + warnings + ' (ดูด้านบน)');
console.log('—'.repeat(40));
Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]).forEach((c) => {
  console.log('  ' + c.padEnd(14) + ' ' + byCat[c]);
});
console.log('—'.repeat(40));
console.log('ไฟล์: finance_th.jsonl, finance_th.train.jsonl, finance_th.val.jsonl');
