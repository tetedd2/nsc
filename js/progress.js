/* =============================================================
 *  progress.js — ตัวช่วยร่วม: ภารกิจประจำวัน (daily missions)
 *  เก็บใน users/{uid}.dailyMissions = { date: "YYYY-MM-DD", done: ["quiz",...] }
 *  รีเซ็ตเองเมื่อข้ามวัน (เช็คจาก date)
 * ============================================================= */
import { auth, db, doc, getDoc, updateDoc } from './firebase-init.js';

/** คีย์วันที่แบบ local (YYYY-MM-DD) */
export function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

/** อ่านรายการภารกิจที่ทำแล้ว "วันนี้" จาก userData (ไม่ยิง network ซ้ำ) */
export function missionsDoneToday(userData) {
  const dm = userData && userData.dailyMissions;
  if (dm && dm.date === todayKey() && Array.isArray(dm.done)) return dm.done.slice();
  return [];
}

/** ทำเครื่องหมายว่าทำภารกิจ key วันนี้แล้ว (เช่น 'quiz' | 'budget' | 'debt' | 'record') */
export async function markDailyMission(key) {
  try {
    const user = auth.currentUser;
    if (!user) return;
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const dm = snap.data().dailyMissions || {};
    const t = todayKey();
    let done = (dm.date === t && Array.isArray(dm.done)) ? dm.done.slice() : [];
    if (done.includes(key)) return;              // ทำไปแล้ววันนี้ ไม่เขียนซ้ำ
    done.push(key);
    await updateDoc(ref, { dailyMissions: { date: t, done } });
    console.log('[progress] marked daily mission:', key);
  } catch (e) {
    console.warn('[progress] markDailyMission failed:', e);
  }
}
