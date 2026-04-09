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

// Tax = 0%, costPrice = 60% of price, fixedCost = 5% of price
function makeItem(name, category, priceThousand) {
  const price = priceThousand * 1000;
  return {
    name,
    category,
    price,
    tax: 0,
    costPrice: Math.round(price * 0.6),
    fixedCost: Math.round(price * 0.05),
  };
}

// 0 = Theo thời giá (market price - user updates later)
const menuData = [
  // ===== ỐC (Ốc hương, Ốc bươu, Hàu, Nghêu sò) =====
  makeItem('Ốc hương cháy tỏi', 'oc', 99),
  makeItem('Ốc hương trứng muối', 'oc', 109),
  makeItem('Ốc hương nướng mọi', 'oc', 99),
  makeItem('Ốc hương hấp sả', 'oc', 99),
  makeItem('Hàu phô mai', 'oc', 25),
  makeItem('Hàu mỡ hành', 'oc', 20),
  makeItem('Hàu wasabi', 'oc', 20),
  makeItem('Sò huyết cháy tỏi', 'oc', 89),
  makeItem('Sò huyết xào me', 'oc', 89),
  makeItem('Sò huyết la cốt', 'oc', 89),
  makeItem('Sò lông mỡ hành', 'oc', 69),
  makeItem('Sò lông xào me', 'oc', 69),
  makeItem('Sò lông hấp thái', 'oc', 79),
  makeItem('Nghêu hấp xả', 'oc', 69),
  makeItem('Nghêu hấp thái', 'oc', 69),
  makeItem('Nghêu xào lá quế', 'oc', 69),
  makeItem('Ốc bươu tiêu xanh', 'oc', 69),
  makeItem('Ốc bươu hấp sả', 'oc', 79),
  makeItem('Ốc bươu hấp thái', 'oc', 69),

  // ===== HẢI SẢN (Tôm, Cua, Càng ghẹ, Mực, Bạch tuộc) =====
  makeItem('Tôm sú sốt thái', 'hai_san', 0),
  makeItem('Tôm sú wasabi', 'hai_san', 0),
  makeItem('Tôm sú nướng', 'hai_san', 0),
  makeItem('Tôm sú rang muối', 'hai_san', 0),
  makeItem('Tôm sú hấp', 'hai_san', 0),
  makeItem('Cua hấp', 'hai_san', 0),
  makeItem('Cua rang me', 'hai_san', 0),
  makeItem('Cua sốt trứng muối', 'hai_san', 0),
  makeItem('Tôm càng hấp', 'hai_san', 0),
  makeItem('Tôm càng nướng', 'hai_san', 0),
  makeItem('Tôm càng cháy tỏi', 'hai_san', 0),
  makeItem('Càng ghẹ rang muối', 'hai_san', 79),
  makeItem('Càng ghẹ rang me', 'hai_san', 79),
  makeItem('Mực trứng chiên mắm', 'hai_san', 99),
  makeItem('Mực trứng hấp gừng', 'hai_san', 99),
  makeItem('Mực trứng chiên giòn', 'hai_san', 99),
  makeItem('Mực lá muối ớt', 'hai_san', 99),
  makeItem('Mực lá xào hành cần', 'hai_san', 99),
  makeItem('Mực lá xào sa tế', 'hai_san', 99),
  makeItem('Bạch tuộc muối ớt', 'hai_san', 89),
  makeItem('Bạch tuộc xào lá quế', 'hai_san', 89),
  makeItem('Bạch tuộc xào hành cần', 'hai_san', 89),

  // ===== MÓN CÁ =====
  makeItem('Cá nâu nướng muối ớt', 'mon_ca', 169),
  makeItem('Cá nâu canh khế', 'mon_ca', 169),
  makeItem('Cá nâu kho lạc', 'mon_ca', 169),
  makeItem('Cá tầm um dưa', 'mon_ca', 0),
  makeItem('Cá tầm măng chua', 'mon_ca', 0),
  makeItem('Cá tầm muối ớt', 'mon_ca', 0),
  makeItem('Cá chim muối ớt', 'mon_ca', 0),
  makeItem('Cá chim nấu ngót', 'mon_ca', 0),
  makeItem('Cá chim hấp HongKong', 'mon_ca', 0),
  makeItem('Cá bớp muối ớt', 'mon_ca', 159),
  makeItem('Cá bớp lúc lắc', 'mon_ca', 219),
  makeItem('Cá lăng muối ớt', 'mon_ca', 319),
  makeItem('Cá lăng măng chua', 'mon_ca', 319),
  makeItem('Cá lăng kho tộ', 'mon_ca', 319),
  makeItem('Cá đuối hấp mỡ hành', 'mon_ca', 149),
  makeItem('Cá đuối xào sả ớt', 'mon_ca', 149),
  makeItem('Cá mú hấp HongKong', 'mon_ca', 0),
  makeItem('Cá mú wasabi', 'mon_ca', 0),
  makeItem('Cá mú chiên tương', 'mon_ca', 0),
  makeItem('Cá mú nướng', 'mon_ca', 0),

  // ===== KHAI VỊ (Khai vị + Gỏi) =====
  makeItem('Khoai môn chiên', 'khai_vi', 69),
  makeItem('Khoai tây chiên', 'khai_vi', 59),
  makeItem('Chả giò hải sản', 'khai_vi', 89),
  makeItem('Đậu hủ chiên sả', 'khai_vi', 59),
  makeItem('Đậu tắm hành', 'khai_vi', 59),
  makeItem('Khổ qua chà bông', 'khai_vi', 89),
  makeItem('Gỏi mực khoai môn', 'khai_vi', 89),
  makeItem('Gỏi bò tai chanh', 'khai_vi', 99),
  makeItem('Ngó sen tôm thịt', 'khai_vi', 99),
  makeItem('Gỏi bò bóp thấu', 'khai_vi', 99),

  // ===== CƠM - MÌ =====
  makeItem('Cơm chiên hải sản', 'com_mi', 89),
  makeItem('Cơm chiên cá mặn', 'com_mi', 89),
  makeItem('Cơm chiên phủ trứng', 'com_mi', 79),
  makeItem('Mì xào hải sản', 'com_mi', 89),
  makeItem('Mì xào bò', 'com_mi', 89),

  // ===== MÓN THỊT (Heo, Bò, Gà, Ếch) =====
  makeItem('Bao tử heo xào cải chua', 'mon_thit', 99),
  makeItem('Ba chỉ luộc', 'mon_thit', 99),
  makeItem('Heo chua ngọt', 'mon_thit', 99),
  makeItem('Heo hầm tiêu xanh', 'mon_thit', 179),
  makeItem('Sườn heo chiên mắm', 'mon_thit', 99),
  makeItem('Sườn heo chua ngọt', 'mon_thit', 99),
  makeItem('Sườn heo nướng', 'mon_thit', 99),
  makeItem('Bò nướng tản', 'mon_thit', 99),
  makeItem('Bò xào hành cần', 'mon_thit', 99),
  makeItem('Bò lúc lắc', 'mon_thit', 119),
  makeItem('Cánh gà chiên mắm', 'mon_thit', 89),
  makeItem('Cánh gà rang muối', 'mon_thit', 89),
  makeItem('Chân gà hấp hành', 'mon_thit', 89),
  makeItem('Chân gà muối ớt', 'mon_thit', 89),
  makeItem('Sụn gà chiên mắm', 'mon_thit', 69),
  makeItem('Sụn gà cháy tỏi', 'mon_thit', 69),
  makeItem('Sụn gà rang muối', 'mon_thit', 69),
  makeItem('Gà ta (nguyên con)', 'mon_thit', 399),
  makeItem('Gà tre (nguyên con)', 'mon_thit', 279),
  makeItem('Ếch chiên mắm', 'mon_thit', 89),
  makeItem('Ếch núp lùm', 'mon_thit', 99),
  makeItem('Ếch xào măng', 'mon_thit', 99),
  makeItem('Ếch sốt', 'mon_thit', 99),

  // ===== LẨU =====
  makeItem('Lẩu thái', 'lau', 179),
  makeItem('Lẩu nấm hải sản', 'lau', 199),
  makeItem('Lẩu tomyum', 'lau', 219),
  makeItem('Lẩu cá đuối', 'lau', 219),
  makeItem('Lẩu ếch măng cay', 'lau', 179),
  makeItem('Lẩu cá bớp măng cay', 'lau', 219),
  makeItem('Lẩu lươn nấu chuối đậu', 'lau', 219),
  makeItem('Lẩu cá mú', 'lau', 0),
  makeItem('Lẩu riêu cua', 'lau', 0),

  // ===== MÓN THÊM (Rau + Khô) =====
  makeItem('Rau lang xào bò', 'mon_them', 79),
  makeItem('Rau muống xào', 'mon_them', 59),
  makeItem('Cần nước xào', 'mon_them', 59),
  makeItem('Rau luộc + kho quẹt', 'mon_them', 99),
  makeItem('Khô mực chiên mắm', 'mon_them', 139),
  makeItem('Khô mực nướng mọi', 'mon_them', 139),
  makeItem('Khô mực gỏi xoài', 'mon_them', 145),
  makeItem('Khô cá sặc chiên', 'mon_them', 0),
  makeItem('Khô cá lóc gỏi xoài', 'mon_them', 0),

  // ===== GIẢI KHÁT (Bia tươi, Bia, Nước ngọt) =====
  makeItem('Bia tươi (công nghệ Đức)', 'giai_khat', 49),
  makeItem('Heineken lon cao', 'giai_khat', 24),
  makeItem('Heineken lon lùn', 'giai_khat', 22),
  makeItem('Tiger bạc cao', 'giai_khat', 23),
  makeItem('Tiger bạc lùn', 'giai_khat', 21),
  makeItem('Tiger nâu cao', 'giai_khat', 22),
  makeItem('Tiger nâu lùn', 'giai_khat', 20),
  makeItem('Saigon', 'giai_khat', 17),
  makeItem('7 Up', 'giai_khat', 15),
  makeItem('Pepsi', 'giai_khat', 15),
  makeItem('Coca Cola', 'giai_khat', 15),
  makeItem('Nước suối', 'giai_khat', 10),
];

async function deleteCollection(collectionName) {
  const snapshot = await getDocs(collection(db, collectionName));
  console.log(`🗑️  Xóa ${snapshot.size} documents trong ${collectionName}...`);
  for (const d of snapshot.docs) {
    await deleteDoc(doc(db, collectionName, d.id));
  }
  console.log(`✅ Đã xóa xong ${collectionName}`);
}

async function seedMenu() {
  console.log('🚀 Bắt đầu seed menu v3...\n');

  // 1. Xóa dữ liệu cũ
  await deleteCollection('menuItems');

  // 2. Thêm dữ liệu mới
  console.log(`\n📝 Thêm ${menuData.length} món mới...`);
  let count = 0;
  for (const item of menuData) {
    await addDoc(collection(db, 'menuItems'), item);
    count++;
    if (count % 10 === 0) console.log(`   ... ${count}/${menuData.length}`);
  }

  console.log(`\n✅ Hoàn tất! Đã thêm ${count} món vào menuItems.`);
  console.log(`📌 Các món "Theo thời giá" có giá = 0, cần cập nhật thủ công.`);
  process.exit(0);
}

seedMenu().catch((err) => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
