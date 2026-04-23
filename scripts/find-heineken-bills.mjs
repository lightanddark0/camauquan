/**
 * Truy xuất tất cả hóa đơn có chứa "Heineken lon cao"
 *
 * Chạy: node scripts/find-heineken-bills.mjs
 * Tuỳ chọn: node scripts/find-heineken-bills.mjs "Tên món khác"
 */

import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Tên món cần tìm (có thể override qua argument)
const TARGET_NAME = process.argv[2] || 'Heineken lon cao';

// Khởi tạo Firebase Admin
const serviceAccountPath = join(__dirname, 'serviceAccountKey.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function main() {
  console.log(`\nTìm kiếm hóa đơn chứa: "${TARGET_NAME}"\n`);

  // 1. Tìm menuItem khớp tên (không phân biệt hoa thường)
  const menuSnap = await db.collection('menuItems').get();
  const matchedMenuIds = new Set();
  const menuNameMap = {}; // id -> name

  for (const doc of menuSnap.docs) {
    const data = doc.data();
    if (data.name?.toLowerCase().includes(TARGET_NAME.toLowerCase())) {
      matchedMenuIds.add(doc.id);
      menuNameMap[doc.id] = data.name;
      console.log(`  [menuItem] id=${doc.id}  name="${data.name}"  giá=${data.price ?? 'N/A'}`);
    }
  }

  // 2. Tìm orderItem khớp tên (biến thể / topping)
  const orderItemSnap = await db.collection('orderItems').get();
  const matchedOrderIds = new Set();
  const orderItemMap = {}; // id -> { name, parentMenuItemId }

  for (const doc of orderItemSnap.docs) {
    const data = doc.data();
    if (data.name?.toLowerCase().includes(TARGET_NAME.toLowerCase())) {
      matchedOrderIds.add(doc.id);
      orderItemMap[doc.id] = { name: data.name, parentId: data.parentMenuItemId };
      console.log(`  [orderItem] id=${doc.id}  name="${data.name}"  parent=${data.parentMenuItemId ?? '-'}`);
    }
  }

  if (matchedMenuIds.size === 0 && matchedOrderIds.size === 0) {
    console.log('  => Không tìm thấy món nào khớp tên trong menu.\n');
    console.log('Gợi ý: chạy lại với tên khác, ví dụ:');
    console.log('  node scripts/find-heineken-bills.mjs "heineken"\n');
    process.exit(0);
  }

  console.log(`\n  Tổng: ${matchedMenuIds.size} menuItem, ${matchedOrderIds.size} orderItem khớp.\n`);

  // 3. Lấy toàn bộ bills và lọc
  console.log('Đang tải tất cả hóa đơn từ Firestore...');
  const billsSnap = await db.collection('bills').orderBy('date', 'asc').get();
  console.log(`  Tổng số hóa đơn: ${billsSnap.size}\n`);

  const results = [];

  for (const billDoc of billsSnap.docs) {
    const bill = { id: billDoc.id, ...billDoc.data() };
    const items = bill.items ?? [];

    const matchedLines = [];

    for (const item of items) {
      // Khớp theo menuItemId
      if (item.menuItemId && matchedMenuIds.has(item.menuItemId)) {
        matchedLines.push({
          type: 'menu',
          name: menuNameMap[item.menuItemId],
          quantity: item.quantity ?? 1,
          menuItemId: item.menuItemId,
        });
      }
      // Khớp theo orderItemId
      if (item.orderItemId && matchedOrderIds.has(item.orderItemId)) {
        const oi = orderItemMap[item.orderItemId];
        matchedLines.push({
          type: 'order',
          name: oi.name,
          quantity: item.quantity ?? 1,
          orderItemId: item.orderItemId,
        });
      }
      // Khớp theo customDescription (món tự nhập)
      if (
        item.customDescription &&
        item.customDescription.toLowerCase().includes(TARGET_NAME.toLowerCase())
      ) {
        matchedLines.push({
          type: 'custom',
          name: item.customDescription,
          quantity: item.quantity ?? 1,
          price: item.customAmount ?? 0,
        });
      }
    }

    if (matchedLines.length > 0) {
      results.push({ bill, matchedLines });
    }
  }

  // 4. In kết quả
  if (results.length === 0) {
    console.log(`Không có hóa đơn nào chứa "${TARGET_NAME}".\n`);
    process.exit(0);
  }

  console.log(`=== Tìm thấy ${results.length} hóa đơn có "${TARGET_NAME}" ===\n`);

  let totalQty = 0;
  let totalRevenue = 0;

  for (const { bill, matchedLines } of results) {
    const label = bill.isTakeaway
      ? `Mang về #${bill.takeawayNumber ?? '-'}`
      : `Bàn ${bill.tableNumber ?? '-'}`;
    const status = bill.status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán';
    const createdAt = bill.createdAt?.toDate?.()
      ? bill.createdAt.toDate().toLocaleString('vi-VN')
      : bill.createdAt ?? '-';

    console.log(`─────────────────────────────────────────`);
    console.log(`  Hóa đơn ID : ${bill.id}`);
    console.log(`  Ngày       : ${bill.date ?? '-'}  |  Thời gian: ${createdAt}`);
    console.log(`  ${label}  |  ${status}  |  Tổng: ${(bill.totalAmount ?? 0).toLocaleString('vi-VN')} ₫`);
    console.log(`  Món khớp:`);

    for (const line of matchedLines) {
      console.log(`    - "${line.name}"  x${line.quantity}`);
      totalQty += line.quantity;
    }

    // Cộng doanh thu nếu đã thanh toán
    if (bill.status === 'paid') totalRevenue += bill.totalAmount ?? 0;
  }

  console.log(`\n=========================================`);
  console.log(`  Tổng hóa đơn  : ${results.length}`);
  console.log(`  Tổng số lượng : ${totalQty} phần/lon`);
  console.log(`  Doanh thu (đã TT): ${totalRevenue.toLocaleString('vi-VN')} ₫`);
  console.log(`=========================================\n`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Lỗi:', err);
  process.exit(1);
});
