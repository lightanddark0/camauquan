import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc, addDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyC_pJMKhbsMPjOrI2BJpMmkYIjJcX-M_b4",
  authDomain: "camauquan-7a706.firebaseapp.com",
  projectId: "camauquan-7a706",
  storageBucket: "camauquan-7a706.appspot.com",
  messagingSenderId: "62383368818",
  appId: "1:62383368818:web:875e37343f16f6eeefb0eb"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seedTables() {
  console.log('🚀 Bắt đầu seed tables...\n');

  // Xóa bàn cũ
  const snapshot = await getDocs(collection(db, 'tables'));
  console.log(`🗑️  Xóa ${snapshot.size} bàn cũ...`);
  for (const d of snapshot.docs) {
    await deleteDoc(doc(db, 'tables', d.id));
  }
  console.log('✅ Đã xóa xong\n');

  // Thêm bàn 1-40
  console.log('📝 Tạo 40 bàn...');
  for (let i = 1; i <= 40; i++) {
    await addDoc(collection(db, 'tables'), {
      number: i,
      seats: 4,
      description: ''
    });
    if (i % 10 === 0) console.log(`   ... ${i}/40`);
  }

  console.log('\n✅ Hoàn tất! Đã tạo 40 bàn (1-40), mỗi bàn 4 ghế.');
  process.exit(0);
}

seedTables().catch((err) => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
