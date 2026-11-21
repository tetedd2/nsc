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

  // ---------- CSS (โทนเขียวเข้าชุดกับแอป) ----------
  const css = `
  .ns-fab{position:fixed;right:16px;bottom:calc(72px + 16px);z-index:950;width:56px;height:56px;border:none;border-radius:50%;
    background:linear-gradient(135deg,#1F8F4E,#0E4D2C);color:#fff;font-size:26px;cursor:pointer;
    box-shadow:0 6px 18px rgba(14,77,44,.4);display:flex;align-items:center;justify-content:center;transition:transform .15s;}
  .ns-fab:hover{transform:scale(1.08);} .ns-fab:active{transform:scale(.94);}
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
  fab.setAttribute('aria-label', 'เปิดแชตน้องซี');
  fab.textContent = '🤖';

  const panel = document.createElement('div');
  panel.className = 'ns-panel';
  panel.innerHTML =
    '<div class="ns-head">' +
      '<div class="ns-head-left"><b>🤖 น้องซี</b><span class="ns-mode" id="nsMode">บอตกฎ</span></div>' +
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
