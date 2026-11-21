/* =============================================================
 *  น้องซี — สมองของผู้ช่วยโค้ชการเงิน MoneySkillz
 *  ลำดับการทำงาน:
 *    1) guardrail ชั้นแรก (ปฏิเสธคำถามนอกเรื่อง/ผิดกฎหมายที่ชัดเจน)
 *    2) ถ้าตั้งค่า ENDPOINT ไว้ → เรียกโมเดลที่เราเทรน (OpenAI-compatible)
 *    3) ถ้าไม่มี endpoint หรือเรียกไม่สำเร็จ → ใช้บอตกฎ (fallback) แอปจะไม่มีวันเงียบ
 * ============================================================= */

// ---------- ⚙️ ตั้งค่า (แก้ตรงนี้หลัง deploy โมเดลใน Phase 4) ----------
// ใส่ URL ของ endpoint แบบ OpenAI chat-completions เช่น
//   - proxy.js ของเรา:            "http://localhost:3000/chat"
//   - vLLM / Ollama / LM Studio:  "http://localhost:11434/v1/chat/completions"
//   - Hugging Face Space (ฟรี):   "https://<user>-<space>.hf.space/v1/chat/completions"
// ถ้าเว้นว่าง ("") ระบบจะใช้บอตกฎ (fallback) อัตโนมัติ
export const NONG_SEE_CONFIG = {
  endpoint: '',                 // ← ใส่ URL โมเดลที่นี่
  model: 'nong-see',            // ชื่อโมเดล (บาง endpoint ต้องระบุ)
  temperature: 0.7,
  maxTokens: 300,
  timeoutMs: 20000,
};

// system prompt ต้องตรงกับที่ใช้เทรน (data/finance-qa-source.json)
export const SYSTEM_PROMPT =
  "คุณคือ 'น้องซี' ผู้ช่วยโค้ชการเงินในแอป MoneySkillz พูดจาเป็นกันเอง สุภาพ ให้กำลังใจ และอธิบายเรื่องการเงินให้เข้าใจง่ายสำหรับเยาวชนไทย คุณตอบเฉพาะเรื่องการเงินเท่านั้น เช่น การออม การลงทุน หนี้สิน ภาษี ประกัน งบประมาณ เป้าหมายการเงิน และการใช้งานแอป MoneySkillz ถ้าถูกถามเรื่องอื่นที่ไม่เกี่ยวกับการเงิน ให้ปฏิเสธอย่างสุภาพแล้วชวนกลับมาคุยเรื่องการเงิน คุณจะไม่ชี้นำให้ซื้อขายหลักทรัพย์รายตัว และเตือนเรื่องความเสี่ยงเสมอเมื่อพูดถึงการลงทุน";

// ---------- 1) guardrail ชั้นแรก (เฉพาะกรณีชัดเจน กันตอบผิด) ----------
function preCheckRefusal(msg) {
  const t = msg.toLowerCase();
  // ขอให้ทำสิ่งผิดกฎหมาย
  if (/(ช่วย.*ฟอกเงิน|ฟอกเงินยังไง|หนีภาษี|เลี่ยงภาษีแบบผิด|ทำบัตร.*ปลอม|โกงเงิน|แฮก)/.test(t)) {
    return "ขอโทษครับ เรื่องผิดกฎหมายแบบนี้ผมช่วยไม่ได้จริง ๆ 🙏 ผมอยากให้ทุกคนมั่งคั่งอย่างสุจริต ถ้าอยากมีเงินเก็บมากขึ้นแบบถูกต้อง ลองถามเรื่องการออม การลงทุน หรือวางแผนภาษีที่ถูกกฎหมายได้เลยครับ";
  }
  // ขอข้อมูลส่วนตัว/ความลับ
  if (/(ขอ.*(รหัสผ่าน|เลขบัตร|เลขบัญชี)|บอกรหัส|เลขหลังบัตร|otp)/.test(t)) {
    return "ผมไม่ขอและไม่เก็บข้อมูลส่วนตัวที่อ่อนไหว เช่น รหัสผ่านหรือเลขบัตรนะครับ และคุณก็ไม่ควรบอกข้อมูลพวกนี้กับใครเพื่อความปลอดภัย 😊 มีคำถามเรื่องการเงินทั่วไปถามได้เลยครับ";
  }
  // หวย/ดูดวง/เลขเด็ด
  if (/(เลขเด็ด|ใบ้หวย|หวยงวด|เลขมงคล|ดูดวง|ไพ่ยิปซี|ดวงชะตา)/.test(t)) {
    return "เรื่องหวยหรือดูดวงไม่ใช่ทางของผมครับ และการพึ่งดวงก็ไม่ใช่วิธีสร้างความมั่งคั่งที่ยั่งยืน 😊 ถ้าอยากให้การเงินดีขึ้นจริง ๆ เริ่มจากการออมและวางแผนอย่างมีวินัยดีกว่าครับ ให้ผมช่วยแนะนำไหม?";
  }
  // ให้เขียนโค้ด/ทำการบ้าน/งานนอกการเงิน
  if (/(เขียนโค้ด|เขียนโปรแกรม|\bcode\b|\bpython\b|ทำการบ้าน|แก้โจทย์เลข|แปลภาษา|เล่าเรื่องตลก|ร้องเพลง)/.test(t)) {
    return "ขอโทษครับ ผมเป็นโค้ชการเงิน เลยช่วยเรื่องนี้ไม่ได้ 😅 แต่ถ้าเป็นเรื่องเงิน ๆ ทอง ๆ อย่างการออม การลงทุน หรือวางแผนการเงิน ถามผมได้เต็มที่เลยครับ!";
  }
  return null;
}

// ---------- ตั้งค่าแบบ runtime (localStorage) — ต่อ endpoint ได้โดยไม่ต้องแก้โค้ด ----------
const LS_KEY = 'nong-see-config';

/** รวมค่าเริ่มต้น + ค่าที่ผู้ใช้ตั้งไว้ใน localStorage (endpoint/model/apiKey) */
export function getNongSeeConfig() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; } catch (e) {}
  return { ...NONG_SEE_CONFIG, ...saved };
}

/** ตั้งค่า endpoint/model/apiKey (บันทึกลง localStorage ใช้ได้ทันทีไม่ต้องรีโหลด) */
export function setNongSeeConfig(partial) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; } catch (e) {}
  const next = { ...saved, ...(partial || {}) };
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch (e) {}
  return getNongSeeConfig();
}

// ---------- 2) เรียกโมเดลผ่าน endpoint (OpenAI-compatible) ----------
async function callEndpoint(messages) {
  const cfg = getNongSeeConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (cfg.apiKey) headers['Authorization'] = 'Bearer ' + cfg.apiKey;   // เผื่อ endpoint ที่ต้องมีคีย์ (HF Space/OpenRouter ฯลฯ)
    const res = await fetch(cfg.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: cfg.temperature,
        max_tokens: cfg.maxTokens,
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const content = data && data.choices && data.choices[0] &&
      data.choices[0].message && data.choices[0].message.content;
    if (!content || !content.trim()) throw new Error('empty content');
    return content.trim();
  } finally {
    clearTimeout(timer);
  }
}

/** ทดสอบการเชื่อมต่อ endpoint — ส่งข้อความสั้นๆ แล้วบอกผล {ok, source, detail} */
export async function testNongSeeConnection() {
  const cfg = getNongSeeConfig();
  if (!cfg.endpoint) return { ok: false, source: 'fallback', detail: 'ยังไม่ได้ตั้ง endpoint — น้องซีใช้บอตกฎอยู่' };
  try {
    const text = await callEndpoint([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: 'สวัสดีครับ แนะนำตัวสั้นๆ' },
    ]);
    return { ok: true, source: 'model', detail: 'เชื่อมต่อโมเดลสำเร็จ: ' + text.slice(0, 60) + '…' };
  } catch (e) {
    return { ok: false, source: 'fallback', detail: 'เชื่อมต่อไม่สำเร็จ (' + e.message + ') — ใช้บอตกฎแทน' };
  }
}

// ---------- 3) บอตกฎ (fallback) — ครอบคลุมหัวข้อเดียวกับ dataset ----------
function ruleBasedReply(message) {
  const t = message.toLowerCase();
  let pool;

  if (/(สวัสดี|hello|\bhi\b|หวัดดี|ทัก)/.test(t)) {
    pool = ["สวัสดีครับ! ผมน้องซี เพื่อนซี้การเงินของคุณเองครับ 😊 อยากคุยเรื่องการออม การลงทุน หรือวางแผนการเงินเรื่องไหนดีครับ?"];
  } else if (/(คุณคือใคร|น้องซีคือใคร|ชื่ออะไร|ทำอะไรได้)/.test(t)) {
    pool = ["ผมคือน้องซี ผู้ช่วยโค้ชการเงินในแอป MoneySkillz ครับ ช่วยเรื่องการออม การลงทุน การจัดการหนี้ วางแผนงบประมาณ ภาษี ประกัน และแนะนำการใช้แอปได้ ลองถามมาได้เลยครับ!"];
  } else if (/(มิจฉาชีพ|คอลเซ็นเตอร์|หลอกลงทุน|แชร์ลูกโซ่|ลิงก์แปลก|โดนหลอก|สแกม|scam)/.test(t)) {
    pool = ["ระวังมิจฉาชีพนะครับ! จำไว้ว่า ธนาคารจะไม่โทรขอรหัส OTP หรือให้โอนเงินเพื่อ 'ตรวจสอบ' และการลงทุนที่ 'การันตีกำไรสูง' มักเป็นการหลอกลวง อย่ากดลิงก์แปลก อย่าบอกรหัส และถ้าสงสัยให้โทรกลับเบอร์ทางการของธนาคารเองครับ"];
  } else if (/(50\/30\/20|50 30 20|แบ่งเงินเดือน|สูตรแบ่งเงิน)/.test(t)) {
    pool = ["กฎ 50/30/20 คือแบ่งรายได้เป็น 50% ของจำเป็น, 30% ของอยากได้, และ 20% เงินออม/ลงทุนครับ เป็นจุดเริ่มคุมงบที่ดีมาก ลองเล่น 'เกมจัดงบ 50/30/20' ในแอปดูได้นะครับ!"];
  } else if (/(ออม|เก็บเงิน|เงินสำรอง|ฉุกเฉิน)/.test(t)) {
    pool = [
      "เริ่มจากตั้งเป้าเล็ก ๆ แล้วใช้เทคนิค 'ออมก่อนใช้' ครับ พอมีรายรับ ให้แบ่งเงินออมไปก่อนเลย ที่เหลือค่อยใช้ ความสม่ำเสมอสำคัญกว่าจำนวนครับ",
      "ลองตั้งเงินสำรองฉุกเฉินสัก 3-6 เท่าของค่าใช้จ่ายต่อเดือนก่อนครับ เก็บในที่ถอนง่าย จะได้อุ่นใจก่อนเริ่มลงทุน",
    ];
  } else if (/(ลงทุน|หุ้น|กองทุน|dca|ตลาดหุ้น)/.test(t)) {
    pool = [
      "มือใหม่แนะนำเริ่มจาก 'กองทุนรวมดัชนี' ครับ ความเสี่ยงไม่สูงและกระจายการลงทุนให้อัตโนมัติ และจำไว้ว่าการลงทุนมีความเสี่ยงเสมอนะครับ",
      "ลองใช้วิธี DCA คือทยอยลงทุนเป็นงวด ๆ ด้วยเงินเท่า ๆ กันครับ ช่วยเฉลี่ยต้นทุนและลดความเสี่ยงจากการจับจังหวะตลาด",
    ];
  } else if (/(หนี้|บัตรเครดิต|ผ่อน|กยศ)/.test(t)) {
    pool = [
      "จัดการหนี้เริ่มจากลิสต์หนี้ทั้งหมดพร้อมดอกเบี้ย จ่ายขั้นต่ำทุกก้อน แล้วทุ่มจ่ายก้อนดอกเบี้ยสูงสุดก่อน (วิธี Avalanche) จะประหยัดที่สุดครับ",
      "บัตรเครดิตใช้เหมือนเงินสดที่มีจริงครับ พยายามชำระเต็มจำนวนทุกเดือนเพื่อเลี่ยงดอกเบี้ย และจ่ายให้ตรงเวลาเสมอ",
    ];
  } else if (/(เครดิต|บูโร|credit score|สินเชื่อ)/.test(t)) {
    pool = ["คะแนนเครดิตสะท้อนความน่าเชื่อถือในการชำระหนี้ครับ หัวใจคือ 'จ่ายตรงเวลาเสมอ' ใช้วงเงินแต่พอดี และไม่ก่อหนี้เกินตัว เครดิตดีจะช่วยให้ขอสินเชื่อง่ายและดอกเบี้ยถูกลงครับ"];
  } else if (/(งบประมาณ|วางแผน|budget|จัดการเงิน|ลดรายจ่าย)/.test(t)) {
    pool = [
      "ทำงบประมาณเริ่มจากจดรายรับรายจ่าย 1 เดือนครับ จะเห็นว่าเงินไปไหนบ้าง แล้วตั้งงบแต่ละหมวด เช่นใช้กฎ 50/30/20 แอปช่วยบันทึกและดูสรุปได้ครับ",
      "อยากประหยัด ลองแยก 'จำเป็น' กับ 'อยากได้' แล้วตัดของอยากได้ที่ไม่คุ้ม และใช้กฎ 'รอ 24 ชั่วโมงก่อนซื้อของชิ้นใหญ่' ครับ",
    ];
  } else if (/(ภาษี|ลดหย่อน|ยื่นภาษี|rmf|ssf)/.test(t)) {
    pool = ["วางแผนภาษีลองใช้สิทธิลดหย่อนที่กฎหมายให้ครับ เช่น ประกัน RMF SSF เงินบริจาค ช่วยประหยัดภาษีได้อย่างถูกต้อง แต่ควรเลือกให้เหมาะกับเป้าหมายการเงิน ไม่ใช่ซื้อเพื่อลดภาษีอย่างเดียวนะครับ"];
  } else if (/(ประกัน|insurance)/.test(t)) {
    pool = ["ประกันช่วยป้องกันค่าใช้จ่ายก้อนใหญ่ที่ไม่คาดฝัน เช่น ค่ารักษาพยาบาลครับ เริ่มจากคุ้มครองความเสี่ยงใหญ่ ๆ ก่อน และเลือกเบี้ยที่จ่ายไหวโดยไม่กระทบเงินออมครับ"];
  } else if (/(เป้าหมาย|goal|ดาวน์บ้าน|เกษียณ)/.test(t)) {
    pool = ["ตั้งเป้าหมายแบบ SMART ครับ คือชัดเจน วัดได้ มีกำหนดเวลา เช่น 'เก็บ 12,000 บาทใน 12 เดือน' = เดือนละ 1,000 บาท แล้วใช้ฟีเจอร์ 'เป้าหมาย' ในแอปติดตามความคืบหน้าได้ครับ"];
  } else if (/(เกม|เหรียญ|ร้านค้า|level|แต้ม|xp|บันทึกรายจ่าย|กราฟ)/.test(t)) {
    pool = ["ในแอปได้ XP และเหรียญจากการล็อกอินรายวัน บันทึกรายรับรายจ่าย ตั้งเป้าหมาย และเล่นเกมอย่างเกมจับคู่การเงินหรือเกมจัดงบ 50/30/20 ครับ พอ XP ถึงเกณฑ์ก็เลเวลอัพและเอาเหรียญไปปลดล็อกของในร้านค้าได้!"];
  } else if (/(ขอบคุณ|thank)/.test(t)) {
    pool = ["ยินดีเสมอครับ! ขอให้สนุกกับการออมนะครับ 😊 มีอะไรให้ช่วยอีกไหมครับ"];
  } else {
    pool = [
      "ขอโทษครับ ผมอาจยังตอบคำถามนี้ได้ไม่ดีพอ ลองถามเจาะจงขึ้นเกี่ยวกับการออม การลงทุน หนี้ ภาษี หรือการใช้แอปดูนะครับ",
      "ผมถนัดเรื่องการเงินครับ ลองถามเช่น 'เริ่มออมเงินยังไง' หรือ 'กองทุนรวมคืออะไร' ดูได้เลยครับ",
    ];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

// ---------- ฟังก์ชันหลักที่หน้าแชตเรียกใช้ ----------
/**
 * @param {string} message - ข้อความจากผู้ใช้
 * @param {Array<{role,content}>} [history] - ประวัติสนทนาล่าสุด (ไม่บังคับ)
 * @returns {Promise<{text:string, source:'guardrail'|'model'|'fallback'}>}
 */
export async function getNongSeeReply(message, history = []) {
  const msg = (message || '').trim();
  if (!msg) return { text: 'พิมพ์คำถามเรื่องการเงินมาได้เลยครับ 😊', source: 'guardrail' };

  const refusal = preCheckRefusal(msg);
  if (refusal) return { text: refusal, source: 'guardrail' };

  if (getNongSeeConfig().endpoint) {
    try {
      const messages = [{ role: 'system', content: SYSTEM_PROMPT }]
        .concat((history || []).slice(-6))
        .concat([{ role: 'user', content: msg }]);
      const text = await callEndpoint(messages);
      return { text, source: 'model' };
    } catch (e) {
      console.warn('น้องซี: เรียกโมเดลไม่สำเร็จ ใช้บอตกฎแทน —', e.message);
    }
  }
  return { text: ruleBasedReply(msg), source: 'fallback' };
}

// ---------- เปิดให้ตั้งค่า/ทดสอบจาก console ได้ (ไม่ต้องแก้โค้ด) ----------
// ตัวอย่าง:  nongSee.connect('https://xxx.hf.space/v1/chat/completions', 'nong-see', 'API_KEY_ถ้ามี')
//           await nongSee.test()
if (typeof window !== 'undefined') {
  window.nongSee = {
    connect(endpoint, model, apiKey) {
      return setNongSeeConfig({ endpoint: endpoint || '', model: model || 'nong-see', apiKey: apiKey || '' });
    },
    disconnect() { return setNongSeeConfig({ endpoint: '', apiKey: '' }); },
    config: getNongSeeConfig,
    test: testNongSeeConnection,
  };
}
