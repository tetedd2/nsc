/* =============================================================
 *  น้องซี Widget — ปุ่มลอย + หน้าต่างแชต ใช้ร่วมได้ทุกหน้า
 *  วิธีใช้: ใส่ก่อน </body>
 *      <script type="module" src="js/nong-see-widget.js"></script>
 *  ฉีด CSS + ปุ่ม + แชต + แผงตั้งค่าโมเดล และต่อกับ nong-see.js
 * ============================================================= */
import { getNongSeeReply, getNongSeeConfig, setNongSeeConfig, testNongSeeConnection } from './nong-see.js';

(function () {
  'use strict';
  if (window.__nongSeeWidgetLoaded) return;      // กันโหลดซ้ำ
  window.__nongSeeWidgetLoaded = true;

  const history = [];                            // เก็บบริบทสนทนาส่งให้โมเดล

  // ---------- นกฮูกแห่งความรู้ (ไอคอน SVG ของน้องซี แทนอิโมจิ) ----------
  const OWL_SVG =
    '<svg class="ns-owl" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" aria-hidden="true" focusable="false">' +
      '<defs>' +
        '<linearGradient id="nsOwlBody" x1="32" y1="17" x2="32" y2="60" gradientUnits="userSpaceOnUse">' +
          '<stop stop-color="#FFF6DF"/><stop offset="1" stop-color="#F3D28F"/>' +
        '</linearGradient>' +
        '<linearGradient id="nsOwlCap" x1="32" y1="5" x2="32" y2="27" gradientUnits="userSpaceOnUse">' +
          '<stop stop-color="#16422B"/><stop offset="1" stop-color="#0A2416"/>' +
        '</linearGradient>' +
      '</defs>' +
      // ลำตัว
      '<path d="M32 17c13 0 20 9 20 21 0 13-8 21-20 21s-20-8-20-21c0-12 7-21 20-21Z" fill="url(#nsOwlBody)"/>' +
      // ปีก
      '<path d="M15 36c-1 7 1 12 5 15-3-6-3-11-1-16z" fill="#E9BE74" opacity=".85"/>' +
      '<path d="M49 36c1 7-1 12-5 15 3-6 3-11 1-16z" fill="#E9BE74" opacity=".85"/>' +
      // ท้อง
      '<path d="M32 33c7 0 11 5 11 13 0 7-5 11-11 11s-11-4-11-11c0-8 4-13 11-13Z" fill="#FFFDF4" opacity=".65"/>' +
      // แว่นนักปราชญ์ (ดวงตา)
      '<circle cx="24" cy="34" r="9" fill="#fff"/>' +
      '<circle cx="40" cy="34" r="9" fill="#fff"/>' +
      '<circle cx="24" cy="34" r="9" fill="none" stroke="#E79A1E" stroke-width="2.4"/>' +
      '<circle cx="40" cy="34" r="9" fill="none" stroke="#E79A1E" stroke-width="2.4"/>' +
      '<path d="M31 33.5h2" stroke="#E79A1E" stroke-width="2.4" stroke-linecap="round"/>' +
      '<g class="ns-owl-eyes">' +
        '<circle cx="25" cy="35" r="4.3" fill="#123A25"/>' +
        '<circle cx="39" cy="35" r="4.3" fill="#123A25"/>' +
      '</g>' +
      '<circle cx="26.6" cy="33.4" r="1.4" fill="#fff"/>' +
      '<circle cx="40.6" cy="33.4" r="1.4" fill="#fff"/>' +
      // จะงอยปาก
      '<path d="M32 39l3.3 4.1h-6.6z" fill="#E79A1E"/>' +
      // เท้า
      '<path d="M26.5 58.4h4M33.5 58.4h4" stroke="#E79A1E" stroke-width="2.6" stroke-linecap="round"/>' +
      // หมวกครุย (บัณฑิต) = แห่งความรู้
      '<path d="M18 16.5v5.5c0 3 6 4.8 14 4.8s14-1.8 14-4.8v-5.5l-14 4.3z" fill="#0E2E1D"/>' +
      '<path d="M32 6 54.5 13 32 20 9.5 13Z" fill="url(#nsOwlCap)"/>' +
      '<path d="M32 6 54.5 13 32 20 9.5 13Z" fill="none" stroke="#1C5636" stroke-width="1"/>' +
      '<path d="M54.5 13v8.4" stroke="#E79A1E" stroke-width="1.6" stroke-linecap="round"/>' +
      '<circle cx="54.5" cy="12.4" r="1.7" fill="#E79A1E"/>' +
      '<circle class="ns-owl-tassel" cx="54.5" cy="22.4" r="2.3" fill="#F3B63F"/>' +
    '</svg>';

  // ---------- CSS (โทนเขียวเข้าชุดกับแอป) ----------
  const css = `
  .ns-fab{position:fixed;right:16px;bottom:calc(72px + 16px);z-index:950;width:56px;height:56px;border:none;border-radius:50%;
    background:linear-gradient(135deg,#1F8F4E,#0E4D2C);color:#fff;font-size:26px;cursor:pointer;
    box-shadow:0 6px 18px rgba(14,77,44,.4);display:flex;align-items:center;justify-content:center;transition:transform .15s;}
  .ns-fab:hover{transform:scale(1.08);} .ns-fab:active{transform:scale(.94);}
  .ns-owl{display:block;}
  .ns-fab .ns-owl{width:38px;height:38px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.28));animation:ns-owl-bob 3.2s ease-in-out infinite;transform-origin:center;}
  .ns-fab::after{content:"";position:absolute;inset:-4px;border-radius:50%;box-shadow:0 0 0 0 rgba(43,196,106,.55);animation:ns-owl-ring 2.6s ease-out infinite;pointer-events:none;}
  .ns-head .ns-owl{width:30px;height:30px;flex:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,.25));}
  .ns-owl-eyes{transform-box:fill-box;transform-origin:center;animation:ns-owl-blink 5s infinite;}
  .ns-owl-tassel{transform-box:fill-box;transform-origin:54.5px 12.4px;animation:ns-owl-swing 3.2s ease-in-out infinite;}
  @keyframes ns-owl-bob{0%,100%{transform:translateY(0) rotate(0);}50%{transform:translateY(-2.5px) rotate(-2deg);}}
  @keyframes ns-owl-blink{0%,93%,100%{transform:scaleY(1);}96%{transform:scaleY(.12);}}
  @keyframes ns-owl-swing{0%,100%{transform:rotate(-7deg);}50%{transform:rotate(7deg);}}
  @keyframes ns-owl-ring{0%{box-shadow:0 0 0 0 rgba(43,196,106,.5);}70%,100%{box-shadow:0 0 0 12px rgba(43,196,106,0);}}
  @media (prefers-reduced-motion:reduce){.ns-fab .ns-owl,.ns-owl-eyes,.ns-owl-tassel,.ns-fab::after{animation:none;}}
  .ns-panel{position:fixed;right:16px;bottom:calc(72px + 80px);z-index:951;width:340px;max-width:calc(100vw - 32px);
    height:480px;max-height:calc(100vh - 180px);background:#fff;border-radius:18px;overflow:hidden;
    box-shadow:0 12px 40px rgba(0,0,0,.22);display:none;flex-direction:column;font-family:'Kanit','Segoe UI',sans-serif;}
  .ns-panel.open{display:flex;animation:ns-pop .2s ease-out;}
  @keyframes ns-pop{from{transform:translateY(12px) scale(.96);opacity:0;}to{transform:none;opacity:1;}}
  .ns-head{background:linear-gradient(135deg,#1F8F4E,#0E4D2C);color:#fff;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;}
  .ns-head-left{display:flex;align-items:center;gap:8px;min-width:0;} .ns-head-left b{font-size:1em;white-space:nowrap;}
  .ns-head-right{display:flex;align-items:center;gap:12px;flex:none;}
  .ns-mode{font-size:.66em;background:rgba(255,255,255,.22);padding:2px 9px;border-radius:999px;white-space:nowrap;}
  .ns-gear,.ns-close{cursor:pointer;line-height:1;opacity:.92;}
  .ns-gear{font-size:17px;} .ns-close{font-size:20px;}
  .ns-gear:hover,.ns-close:hover{opacity:1;}
  /* แผงตั้งค่าโมเดล */
  .ns-settings{display:none;flex-direction:column;gap:7px;padding:12px 14px;background:#eef7f1;border-bottom:1px solid #d9e8e0;}
  .ns-settings.open{display:flex;animation:ns-pop .18s ease-out;}
  .ns-settings .ns-title{font-weight:700;color:#14673A;font-size:.9em;margin-bottom:2px;}
  .ns-settings label{font-weight:600;color:#3f5a4d;font-size:.78em;}
  .ns-settings input{border:1.5px solid #d4e3da;border-radius:10px;padding:8px 10px;font-family:inherit;font-size:.86em;outline:none;background:#fff;color:#12301F;}
  .ns-settings input:focus{border-color:#1F8F4E;box-shadow:0 0 0 3px rgba(31,143,78,.12);}
  .ns-set-row{display:flex;gap:8px;margin-top:4px;}
  .ns-set-row button{flex:1;border:none;border-radius:10px;padding:9px;font-weight:700;font-family:inherit;font-size:.86em;cursor:pointer;transition:transform .1s,filter .15s;}
  .ns-set-row button:active{transform:scale(.97);}
  .ns-btn-save{background:#1F8F4E;color:#fff;}
  .ns-btn-test{background:#fff;color:#1F8F4E;border:1.5px solid #1F8F4E;}
  .ns-status{font-size:.8em;color:#5B7A68;min-height:15px;line-height:1.35;}
  .ns-status.ok{color:#1F8F4E;} .ns-status.err{color:#E2483B;}
  .ns-help{font-size:.72em;color:#88a295;line-height:1.4;}
  .ns-body{flex:1;overflow-y:auto;padding:12px;background:#f3f7f5;display:flex;flex-direction:column;gap:8px;}
  .ns-msg{max-width:82%;padding:9px 12px;border-radius:14px;font-size:.92em;line-height:1.5;white-space:pre-wrap;word-wrap:break-word;}
  .ns-msg.ai{background:#fff;color:#0f2f2c;align-self:flex-start;border-bottom-left-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,.08);}
  .ns-msg.user{background:#1F8F4E;color:#fff;align-self:flex-end;border-bottom-right-radius:4px;}
  .ns-form{display:flex;gap:8px;padding:10px;border-top:1px solid #e6e8eb;background:#fff;}
  .ns-form input{flex:1;border:1px solid #cfd8dc;border-radius:20px;padding:9px 14px;font-family:inherit;font-size:.92em;outline:none;}
  .ns-form input:focus{border-color:#1F8F4E;}
  .ns-form button{border:none;border-radius:50%;width:40px;height:40px;background:#1F8F4E;color:#fff;font-size:17px;cursor:pointer;flex:none;}
  .ns-form button:disabled{opacity:.5;cursor:not-allowed;}
  body.dark-mode .ns-panel{background:#1f232a;}
  body.dark-mode .ns-settings{background:#15241b;border-bottom-color:#26402f;}
  body.dark-mode .ns-settings input{background:#2a2f37;border-color:#3a414b;color:#e5e7eb;}
  body.dark-mode .ns-body{background:#181b20;}
  body.dark-mode .ns-msg.ai{background:#2a2f37;color:#e5e7eb;}
  body.dark-mode .ns-form{background:#1f232a;border-top-color:#333a44;}
  body.dark-mode .ns-form input{background:#2a2f37;border-color:#3a414b;color:#e5e7eb;}
  @media (max-width:480px){.ns-panel{height:64vh;bottom:calc(72px + 72px);} .ns-fab{bottom:calc(72px + 12px);}}
  `;
  const style = document.createElement('style');
  style.setAttribute('data-ns-widget', '');
  style.textContent = css;
  document.head.appendChild(style);

  // ---------- โครงสร้าง ----------
  const fab = document.createElement('button');
  fab.className = 'ns-fab';
  fab.setAttribute('aria-label', 'เปิดแชตน้องซี นกฮูกแห่งความรู้');
  fab.innerHTML = OWL_SVG;

  const panel = document.createElement('div');
  panel.className = 'ns-panel';
  panel.innerHTML =
    '<div class="ns-head">' +
      '<div class="ns-head-left">' + OWL_SVG + '<b>น้องซี</b><span class="ns-mode" id="nsMode">บอตกฎ</span></div>' +
      '<div class="ns-head-right">' +
        '<span class="ns-gear" id="nsGear" role="button" aria-label="ตั้งค่าโมเดล" title="ตั้งค่าโมเดล">⚙</span>' +
        '<span class="ns-close" role="button" aria-label="ปิด">✕</span>' +
      '</div>' +
    '</div>' +
    '<div class="ns-settings" id="nsSettings">' +
      '<div class="ns-title">⚙ ตั้งค่าโมเดล AI</div>' +
      '<label>Endpoint (OpenAI-compatible)</label>' +
      '<input id="nsEndpoint" placeholder="https://.../v1/chat/completions" />' +
      '<label>ชื่อโมเดล</label>' +
      '<input id="nsModel" placeholder="nong-see" />' +
      '<label>API Key (ถ้ามี)</label>' +
      '<input id="nsKey" type="password" placeholder="เว้นว่างได้" autocomplete="off" />' +
      '<div class="ns-set-row">' +
        '<button type="button" class="ns-btn-save" id="nsSave">บันทึก</button>' +
        '<button type="button" class="ns-btn-test" id="nsTest">ทดสอบ</button>' +
      '</div>' +
      '<div class="ns-status" id="nsStatus"></div>' +
      '<div class="ns-help">ถ้าเว้น Endpoint ว่าง น้องซีจะใช้บอตกฎ (ตอบได้เสมอ) · ใส่ URL จากโมเดลที่คุณโฮสต์ (HF Space / Ollama / proxy) แล้วกด “ทดสอบ”</div>' +
    '</div>' +
    '<div class="ns-body" id="nsBody"></div>' +
    '<form class="ns-form" id="nsForm" autocomplete="off">' +
      '<input id="nsInput" placeholder="พิมพ์คำถามการเงิน..." aria-label="ข้อความ" />' +
      '<button type="submit" aria-label="ส่ง">➤</button>' +
    '</form>';

  function mount() {
    document.body.appendChild(fab);
    document.body.appendChild(panel);
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);

  const body = panel.querySelector('#nsBody');
  const form = panel.querySelector('#nsForm');
  const input = panel.querySelector('#nsInput');

  // ----- แผงตั้งค่า -----
  const settings = panel.querySelector('#nsSettings');
  const modeChip = panel.querySelector('#nsMode');
  const gear = panel.querySelector('#nsGear');
  const epInput = panel.querySelector('#nsEndpoint');
  const modelInput = panel.querySelector('#nsModel');
  const keyInput = panel.querySelector('#nsKey');
  const saveBtn = panel.querySelector('#nsSave');
  const testBtn = panel.querySelector('#nsTest');
  const statusDiv = panel.querySelector('#nsStatus');

  function refreshMode() {
    const c = getNongSeeConfig();
    modeChip.textContent = c.endpoint ? '🟢 โมเดล AI' : 'บอตกฎ';
  }
  function fillSettings() {
    const c = getNongSeeConfig();
    epInput.value = c.endpoint || '';
    modelInput.value = c.model || 'nong-see';
    keyInput.value = c.apiKey || '';
  }
  function applyInputs() {
    return setNongSeeConfig({
      endpoint: epInput.value.trim(),
      model: modelInput.value.trim() || 'nong-see',
      apiKey: keyInput.value.trim(),
    });
  }
  gear.addEventListener('click', () => {
    settings.classList.toggle('open');
    if (settings.classList.contains('open')) { fillSettings(); statusDiv.textContent = ''; statusDiv.className = 'ns-status'; }
  });
  saveBtn.addEventListener('click', () => {
    applyInputs();
    refreshMode();
    statusDiv.className = 'ns-status ok';
    statusDiv.textContent = 'บันทึกแล้ว ✓';
  });
  testBtn.addEventListener('click', async () => {
    applyInputs();
    statusDiv.className = 'ns-status';
    statusDiv.textContent = 'กำลังทดสอบการเชื่อมต่อ...';
    testBtn.disabled = true;
    try {
      const r = await testNongSeeConnection();
      statusDiv.className = 'ns-status ' + (r.ok ? 'ok' : 'err');
      statusDiv.textContent = r.detail;
    } catch (e) {
      statusDiv.className = 'ns-status err';
      statusDiv.textContent = 'ทดสอบไม่สำเร็จ: ' + e.message;
    } finally {
      testBtn.disabled = false;
      refreshMode();
    }
  });
  refreshMode();

  function addMsg(sender, text) {
    const el = document.createElement('div');
    el.className = 'ns-msg ' + sender;
    el.textContent = text;
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
    return el;
  }

  let greeted = false;
  function openPanel() {
    panel.classList.add('open');
    if (!greeted) {
      addMsg('ai', 'สวัสดีครับ! ผมน้องซี โค้ชการเงินของคุณเองครับ 😊 ถามเรื่องการออม การลงทุน หรือวางแผนการเงินได้เลยครับ');
      greeted = true;
    }
    setTimeout(() => input.focus(), 50);
  }
  function closePanel() { panel.classList.remove('open'); }

  fab.addEventListener('click', () => (panel.classList.contains('open') ? closePanel() : openPanel()));
  panel.querySelector('.ns-close').addEventListener('click', closePanel);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = input.value.trim();
    if (!message) return;
    addMsg('user', message);
    input.value = '';
    history.push({ role: 'user', content: message });

    const typing = addMsg('ai', 'น้องซีกำลังพิมพ์...');
    try {
      const { text } = await getNongSeeReply(message, history);
      typing.textContent = text;
      history.push({ role: 'assistant', content: text });
      if (history.length > 12) history.splice(0, history.length - 12);
    } catch (err) {
      console.error('nong-see-widget:', err);
      typing.textContent = 'ขออภัยครับ เกิดข้อผิดพลาด ลองใหม่อีกครั้งนะครับ';
    }
    body.scrollTop = body.scrollHeight;
  });
})();
