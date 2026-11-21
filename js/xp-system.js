/* =============================================================
 *  ระบบ XP/Level กลางของ MoneySkillz (ใช้ร่วมได้ทุกเกม/หน้า)
 *  ใช้ชุดเลเวลเดียวกับ dashboard.js และอัปเดตฟิลด์เดียวกัน
 *  (xp, level, nextLevelXP, coins) เพื่อให้ข้อมูลตรงกันทั้งแอป
 * ============================================================= */
import {
  db, doc, getDoc, setDoc, runTransaction, increment,
} from './firebase-init.js';

export const LEVEL_CONFIG = [
  { level: 1, name: 'ผู้เริ่มต้น', xpToNext: 100 },
  { level: 2, name: 'นักออมฝึกหัด', xpToNext: 250 },
  { level: 3, name: 'นักสะสมเหรียญ', xpToNext: 500 },
  { level: 4, name: 'ผู้เชี่ยวชาญการเงิน', xpToNext: 1000 },
  { level: 5, name: 'เศรษฐีหน้าใหม่', xpToNext: Infinity },
];

export function getExpToNextLevel(level) {
  const info = LEVEL_CONFIG.find((l) => l.level === level);
  return info ? info.xpToNext : Infinity;
}

/**
 * โหลด (หรือสร้าง) ข้อมูล xp/level ของผู้ใช้
 * @returns {Promise<{xp:number, level:number}>}
 */
export async function loadUserXp(uid, displayName) {
  const fallback = { xp: 0, level: 1 };
  if (!uid) return fallback;
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      return { xp: data.xp || 0, level: data.level || 1 };
    }
    // ผู้ใช้ใหม่ (เช่น anonymous) — สร้างเอกสารเริ่มต้น
    await setDoc(userRef, {
      xp: 0, level: 1, nextLevelXP: LEVEL_CONFIG[0].xpToNext,
      displayName: displayName || 'ผู้เล่นใหม่',
      coins: 0, badges: [], inventory: [],
    }, { merge: true });
    return fallback;
  } catch (e) {
    console.error('loadUserXp ผิดพลาด:', e);
    return fallback;
  }
}

/**
 * เพิ่ม XP ให้ผู้ใช้ พร้อมจัดการเลเวลอัพและรางวัลเหรียญ (แบบ atomic)
 * @returns {Promise<{gained:number, levelUp:boolean, newLevel:number, levelUps:Array}>}
 */
export async function addXp(uid, amount) {
  if (!uid || amount <= 0) return { gained: 0, levelUp: false, newLevel: 1, levelUps: [] };

  let levelUpOccurred = false;
  let newLevel = 1;
  let levelUps = [];

  try {
    const userRef = doc(db, 'users', uid);
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(userRef);
      if (!snap.exists()) throw new Error('ไม่พบเอกสารผู้ใช้ระหว่างทำรายการ');

      const data = snap.data();
      let xp = data.xp || 0;
      let level = data.level || 1;
      let nextLevelXP = data.nextLevelXP || LEVEL_CONFIG[0].xpToNext;
      let totalCoinReward = 0;
      newLevel = level;
      levelUps = [];

      xp += amount;

      while (xp >= nextLevelXP && nextLevelXP !== Infinity) {
        const idx = LEVEL_CONFIG.findIndex((l) => l.level === level);
        if (idx < LEVEL_CONFIG.length - 1) {
          const nextInfo = LEVEL_CONFIG[idx + 1];
          const reward = 100 + nextInfo.level * 25;
          totalCoinReward += reward;
          xp -= nextLevelXP;
          level = nextInfo.level;
          nextLevelXP = nextInfo.xpToNext;
          levelUps.push({ level: nextInfo.level, name: nextInfo.name, reward });
        } else {
          break;
        }
      }

      if (level > newLevel) { levelUpOccurred = true; newLevel = level; }

      const update = { xp, level, nextLevelXP };
      if (totalCoinReward > 0) update.coins = increment(totalCoinReward);
      transaction.update(userRef, update);
    });

    return { gained: amount, levelUp: levelUpOccurred, newLevel, levelUps };
  } catch (e) {
    console.error('addXp ผิดพลาด:', e);
    return { gained: 0, levelUp: false, newLevel: 1, levelUps: [] };
  }
}
