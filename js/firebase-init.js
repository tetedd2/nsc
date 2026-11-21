// ============================================================
//  Firebase — จุดรวมเดียวของทั้งแอป (MoneySkillz)
//  ใช้ Firebase modular SDK v10 ทุกหน้า import จากไฟล์นี้ไฟล์เดียว
//  เวลาอัปเดตเวอร์ชัน/คอนฟิก แก้ที่นี่ที่เดียว
//
//  วิธีใช้ในหน้าอื่น (เป็น ES module):
//    <script type="module">
//      import { auth, db, onAuthStateChanged, doc, getDoc } from './js/firebase-init.js';
//      // ... ใช้งานได้เลย
//    </script>
//
//  หมายเหตุ: firebaseConfig ฝั่ง client เปิดเผยได้ตามปกติ
//  ความปลอดภัยจริงอยู่ที่ Firestore Security Rules (ดู firestore.rules)
// ============================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithCustomToken,
  updateProfile,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

import {
  getFirestore,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment,
  runTransaction,
  writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

// ---------- config (ที่เดียวของทั้งแอป) ----------
const firebaseConfig = {
  apiKey: 'AIzaSyBjLBl1sEGgQLyng51rW25b434bJ0opVc4',
  authDomain: 'myapplication-bd04c034.firebaseapp.com',
  databaseURL: 'https://myapplication-bd04c034-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'myapplication-bd04c034',
  storageBucket: 'myapplication-bd04c034.firebasestorage.app',
  messagingSenderId: '49782830313',
  appId: '1:49782830313:web:c81b5d86a937f22d296c78',
  measurementId: 'G-Z2ZBWGB245',
};

// ---------- initialize (ครั้งเดียว) ----------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ---------- export instances + ฟังก์ชันที่ใช้บ่อย ----------
// หน้าอื่น import ได้จากที่นี่ที่เดียว ไม่ต้องอ้าง CDN เองให้เวอร์ชันหลุด
export {
  app,
  auth,
  db,
  storage,
  // auth
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithCustomToken,
  updateProfile,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  // firestore
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment,
  runTransaction,
  writeBatch,
  // storage
  ref,
  uploadBytes,
  getDownloadURL,
};
