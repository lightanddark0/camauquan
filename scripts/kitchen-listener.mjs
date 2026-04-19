#!/usr/bin/env node
/**
 * Kitchen Listener - Node.js version (khong can Python)
 * Lang nghe Firestore, tu dong in phieu bep khi co don moi.
 *
 * Can cai 1 lan: npm install firebase-admin
 * Can file:      scripts/serviceAccountKey.json
 * Chay:          node scripts/kitchen-listener.mjs
 */

import { createConnection } from 'net';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Cau hinh ─────────────────────────────────────────────────────────────────
const PRINTER_IP   = '192.168.1.234';
const PRINTER_PORT = 9100;
const KEY_FILE     = join(__dirname, 'serviceAccountKey.json');
const USE_ASCII    = true;    // ASCII khong dau - tranh ky tu loi tren may in nhiet

// ── ESC/POS constants ─────────────────────────────────────────────────────────
const ESC = 0x1B;
const GS  = 0x1D;
const LF  = 0x0A;
const LINE_WIDTH = 48;

// ── Helper ────────────────────────────────────────────────────────────────────
function log(msg) {
  const t = new Date().toLocaleTimeString('vi-VN');
  console.log(`[${t}] ${msg}`);
}

const VI_MAP = {
  à:'a',á:'a',ả:'a',ã:'a',ạ:'a',
  ă:'a',ằ:'a',ắ:'a',ẳ:'a',ẵ:'a',ặ:'a',
  â:'a',ầ:'a',ấ:'a',ẩ:'a',ẫ:'a',ậ:'a',
  è:'e',é:'e',ẻ:'e',ẽ:'e',ẹ:'e',
  ê:'e',ề:'e',ế:'e',ể:'e',ễ:'e',ệ:'e',
  ì:'i',í:'i',ỉ:'i',ĩ:'i',ị:'i',
  ò:'o',ó:'o',ỏ:'o',õ:'o',ọ:'o',
  ô:'o',ồ:'o',ố:'o',ổ:'o',ỗ:'o',ộ:'o',
  ơ:'o',ờ:'o',ớ:'o',ở:'o',ỡ:'o',ợ:'o',
  ù:'u',ú:'u',ủ:'u',ũ:'u',ụ:'u',
  ư:'u',ừ:'u',ứ:'u',ử:'u',ữ:'u',ự:'u',
  ỳ:'y',ý:'y',ỷ:'y',ỹ:'y',ỵ:'y',đ:'d',
  À:'A',Á:'A',Ả:'A',Ã:'A',Ạ:'A',
  Ă:'A',Ằ:'A',Ắ:'A',Ẳ:'A',Ẵ:'A',Ặ:'A',
  Â:'A',Ầ:'A',Ấ:'A',Ẩ:'A',Ẫ:'A',Ậ:'A',
  È:'E',É:'E',Ẻ:'E',Ẽ:'E',Ẹ:'E',
  Ê:'E',Ề:'E',Ế:'E',Ể:'E',Ễ:'E',Ệ:'E',
  Ì:'I',Í:'I',Ỉ:'I',Ĩ:'I',Ị:'I',
  Ò:'O',Ó:'O',Ỏ:'O',Õ:'O',Ọ:'O',
  Ô:'O',Ồ:'O',Ố:'O',Ổ:'O',Ỗ:'O',Ộ:'O',
  Ơ:'O',Ờ:'O',Ớ:'O',Ở:'O',Ỡ:'O',Ợ:'O',
  Ù:'U',Ú:'U',Ủ:'U',Ũ:'U',Ụ:'U',
  Ư:'U',Ừ:'U',Ứ:'U',Ử:'U',Ữ:'U',Ự:'U',
  Ỳ:'Y',Ý:'Y',Ỷ:'Y',Ỹ:'Y',Ỵ:'Y',Đ:'D',
};
function toAscii(str) {
  return String(str).split('').map(c => VI_MAP[c] ?? c).join('');
}

function enc(str) {
  if (USE_ASCII) str = toAscii(str);
  return [...Buffer.from(String(str), 'utf8')];
}

function fmtTime(ts) {
  if (!ts) return new Date().toLocaleString('vi-VN', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit' });
  try {
    let d;
    if (ts.toDate) d = ts.toDate();                        // Firestore Timestamp
    else if (ts._seconds) d = new Date(ts._seconds * 1000); // Firestore Timestamp plain
    else d = new Date(ts);                                   // ISO string hoac so ms
    return d.toLocaleString('vi-VN', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit' });
  } catch { return ''; }
}

// ── ESC/POS: tao buffer phieu bep 1 mon ──────────────────────────────────────
function buildKitchenBuffer(tableLabel, time, itemName, qty) {
  const b = [];
  const add  = (...bytes) => b.push(...bytes);
  const str  = s => b.push(...enc(s));
  const line = (s = '') => { str(s); add(LF); };
  const div  = (c = '=') => line(c.repeat(LINE_WIDTH));

  add(ESC, 0x40);                // reset
  add(ESC, 0x61, 0x00);          // can trai

  div();

  // Thoi gian - can giua
  add(ESC, 0x61, 0x01);
  line(time);

  // Ten ban - chu to 2x
  add(GS,  0x21, 0x11);
  add(ESC, 0x45, 0x01);
  line(tableLabel);
  add(GS,  0x21, 0x00);
  add(ESC, 0x45, 0x00);

  add(ESC, 0x61, 0x00);
  line('-'.repeat(LINE_WIDTH));

  // Ten mon - chu cao 2x
  add(GS,  0x21, 0x01);
  add(ESC, 0x45, 0x01);
  line(itemName);
  add(GS,  0x21, 0x00);
  add(ESC, 0x45, 0x00);

  // So luong - can phai, chu to 2x
  add(ESC, 0x61, 0x02);
  add(GS,  0x21, 0x11);
  add(ESC, 0x45, 0x01);
  line(`SL: ${qty}`);
  add(GS,  0x21, 0x00);
  add(ESC, 0x45, 0x00);

  add(ESC, 0x61, 0x00);
  div();

  add(LF, LF);
  add(GS, 0x56, 0x42, 0x00);    // partial cut

  return Buffer.from(b);
}

// ── Gui lenh in qua TCP ───────────────────────────────────────────────────────
function sendToPrinterOnce(buf, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const sock = createConnection({ host: PRINTER_IP, port: PRINTER_PORT }, () => {
      sock.write(buf, err => {
        if (err) { sock.destroy(); reject(err); return; }
        sock.end();
        resolve();
      });
    });
    sock.on('error', reject);
    sock.setTimeout(timeoutMs, () => { sock.destroy(); reject(new Error('timeout')); });
  });
}

async function sendToPrinter(buf) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await sendToPrinterOnce(buf);
      return;
    } catch (err) {
      if (attempt === 3) throw err;
      log(`  [RETRY ${attempt}] ${err.message} — thu lai sau 2s...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

// ── Cache ten mon (ca orderItems lan menuItems) ───────────────────────────────
const nameCache = {};  // id -> ten mon
let db;

async function lookupName(id, collections = ['orderItems', 'menuItems']) {
  if (!id) return null;
  if (nameCache[id]) return nameCache[id];
  for (const col of collections) {
    try {
      const snap = await db.collection(col).doc(id).get();
      if (snap.exists && snap.data().name) {
        nameCache[id] = snap.data().name;
        return nameCache[id];
      }
    } catch {}
  }
  return null;
}

// ── Track items da in ────────────────────────────────────────────────────────
// Key cho mon moi:        "billId:orderItemId"          (in 1 lan)
// Key cho tang so luong:  "billId:orderItemId:delta:addedAt"  (moi lan tang = key moi)
// Key cho custom item moi: "billId:custom:addedAt"      (moi addedAt = key moi)
const printedItems = new Set();

function buildItemKey(billId, item, index) {
  // Custom item moi: dung addedAt lam key de tranh trung voi custom item cu (cung index)
  if (item.customDescription) {
    if (item.addedAt) return `${billId}:custom:${item.addedAt}`;
    return `${billId}:custom:${index}`;
  }
  const id = item.orderItemId || item.menuItemId || index;
  if (item.addedQty > 0 && item.addedAt) {
    return `${billId}:${id}:delta:${item.addedAt}`;
  }
  return `${billId}:${id}`;
}

// ── Xu ly thay doi don hang (ca added lan modified) ──────────────────────────
async function handleBillChange(docSnap, changeType) {
  const billId = docSnap.id;
  const data   = docSnap.data();
  if (!data || data.status !== 'pending') return;

  const isTakeaway = data.isTakeaway || false;
  const tableLabel = isTakeaway
    ? `Mang ve #${data.takeawayNumber}`
    : `Ban ${data.tableNumber}`;
  const items = data.items || [];
  const now   = Date.now();

  let printedCount = 0;
  for (let i = 0; i < items.length; i++) {
    const item    = items[i];

    // Phan biet 3 truong hop:
    //   1. Don moi (added)           : tat ca item, dung createdAt
    //   2. Mon hoan toan moi (modified + addedAt, khong co addedQty)
    //   3. Tang so luong (modified + addedQty + addedAt): key rieng theo addedAt
    const isDelta = changeType !== 'added' && item.addedQty > 0 && item.addedAt;
    const itemKey = buildItemKey(billId, item, i);

    if (printedItems.has(itemKey)) continue;

    // Xac dinh thoi gian de kiem tra "mon cu" (truoc khi listener chay)
    let ts;
    if (changeType === 'added') {
      ts = data.createdAt
        ? (data.createdAt.toDate ? data.createdAt.toDate().getTime() : new Date(data.createdAt).getTime())
        : now;
    } else {
      // ca mon moi lan tang SL deu co addedAt; mon khong doi thi addedAt = undefined -> ts = 0
      ts = item.addedAt ? new Date(item.addedAt).getTime() : 0;
    }

    const ageSec = (now - ts) / 1000;
    if (ageSec > 60) {
      // Mon cu (co truoc khi listener khoi dong) - bo qua, danh dau da xu ly
      printedItems.add(itemKey);
      continue;
    }

    printedItems.add(itemKey);

    // So luong can in:
    // - Tang SL: chi in phan tang them (addedQty), khong in lai ca mon
    // - Mon moi / don moi: in toan bo quantity
    const qty  = isDelta ? item.addedQty : (item.quantity || 1);
    const name = item.name
      || await lookupName(item.orderItemId)
      || await lookupName(item.menuItemId)
      || item.customDescription
      || 'Mon khac';
    const time = changeType === 'added'
      ? fmtTime(data.createdAt)
      : fmtTime(item.addedAt);

    try {
      const buf = buildKitchenBuffer(tableLabel, time, name, qty);
      await sendToPrinter(buf);
      printedCount++;
      log(`  [OK] ${tableLabel} - ${name} x${qty}${isDelta ? ` (them ${qty})` : ''}`);
    } catch (err) {
      log(`  [LOI] ${tableLabel} - ${name} x${qty}: ${err.message}`);
      // Xoa key khoi Set de lan sau thu lai neu dung lai listener
      printedItems.delete(itemKey);
    }
  }

  if (printedCount > 0) {
    log(`Don ${changeType === 'added' ? 'moi' : 'them mon'}: ${tableLabel} - da in ${printedCount} mon`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!existsSync(KEY_FILE)) {
    console.log(`
[LOI] Khong tim thay: ${KEY_FILE}

Huong dan:
  1. Firebase Console -> Project Settings -> Service accounts
  2. Nhan "Generate new private key" -> tai file JSON
  3. Doi ten thanh serviceAccountKey.json
  4. Dat vao thu muc: ${__dirname}
`);
    process.exit(1);
  }

  // Import firebase-admin (kiem tra da cai chua)
  let admin;
  try {
    admin = (await import('firebase-admin')).default;
  } catch {
    console.log('[LOI] Chua cai firebase-admin. Chay: npm install firebase-admin');
    process.exit(1);
  }

  log('Dang ket noi Firebase...');
  const serviceAccount = JSON.parse(readFileSync(KEY_FILE, 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  db = admin.firestore();
  log('Ket noi Firebase thanh cong');

  // Load cache ten mon tu ca orderItems lan menuItems
  const [snapOI, snapMI] = await Promise.all([
    db.collection('orderItems').get(),
    db.collection('menuItems').get(),
  ]);
  snapOI.forEach(d => { if (d.data().name) nameCache[d.id] = d.data().name; });
  snapMI.forEach(d => { if (d.data().name) nameCache[d.id] = d.data().name; });
  log(`Da tai ${snapOI.size} orderItems + ${snapMI.size} menuItems vao cache`);

  log(`May in bep: ${PRINTER_IP}:${PRINTER_PORT}`);
  log('=' .repeat(50));
  log('Dang lang nghe don hang moi...');

  // Lang nghe Firestore real-time (ca don moi lan them mon vao don cu)
  db.collection('bills').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added' || change.type === 'modified') {
        handleBillChange(change.doc, change.type).catch(err => log(`Loi xu ly don: ${err.message}`));
      }
    });
  }, err => {
    log(`Loi Firestore: ${err.message}`);
  });
}

main();
