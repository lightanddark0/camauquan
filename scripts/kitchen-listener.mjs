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
const USE_ASCII    = false;   // doi thanh true neu may in in ky tu loi

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

function toAscii(str) {
  return str.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, s => s === 'đ' ? 'd' : 'D');
}

function enc(str) {
  if (USE_ASCII) str = toAscii(str);
  return [...Buffer.from(String(str), 'utf8')];
}

function fmtTime(ts) {
  if (!ts) return new Date().toLocaleString('vi-VN', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit' });
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts._seconds * 1000);
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
function sendToPrinter(buf) {
  return new Promise((resolve, reject) => {
    const sock = createConnection({ host: PRINTER_IP, port: PRINTER_PORT }, () => {
      sock.write(buf, err => {
        if (err) { sock.destroy(); reject(err); return; }
        sock.end();
        resolve();
      });
    });
    sock.on('error', reject);
    sock.setTimeout(5000, () => { sock.destroy(); reject(new Error('timeout')); });
  });
}

// ── Cache orderItems ──────────────────────────────────────────────────────────
const itemCache = {};
let db;

async function getItemName(orderItemId) {
  if (itemCache[orderItemId]) return itemCache[orderItemId];
  try {
    const doc = await db.collection('orderItems').doc(orderItemId).get();
    if (doc.exists) {
      itemCache[orderItemId] = doc.data().name || 'Mon khac';
      return itemCache[orderItemId];
    }
  } catch {}
  return 'Mon khac';
}

// ── Xu ly don moi ────────────────────────────────────────────────────────────
const printedBills = new Set();

async function handleNewBill(docSnap) {
  const billId = docSnap.id;
  if (printedBills.has(billId)) return;

  const data = docSnap.data();
  if (!data || data.status !== 'pending') return;

  // Chi in don moi (tao trong 30 giay gan day)
  if (data.createdAt) {
    try {
      const billedAt = data.createdAt.toDate();
      const ageSec   = (Date.now() - billedAt.getTime()) / 1000;
      if (ageSec > 30) { printedBills.add(billId); return; }
    } catch {}
  }

  printedBills.add(billId);

  const isTakeaway    = data.isTakeaway || false;
  const tableLabel    = isTakeaway
    ? `Mang ve #${data.takeawayNumber}`
    : `Ban ${data.tableNumber}`;
  const orderTime     = fmtTime(data.createdAt);
  const items         = data.items || [];

  log(`Don moi: ${tableLabel} - ${items.length} mon`);

  for (let i = 0; i < items.length; i++) {
    const item   = items[i];
    const qty    = item.quantity || 1;
    const name   = item.orderItemId
      ? await getItemName(item.orderItemId)
      : (item.customDescription || 'Mon khac');

    try {
      const buf = buildKitchenBuffer(tableLabel, orderTime, name, qty);
      await sendToPrinter(buf);
      log(`  [${i+1}] ${name} x${qty} - OK`);
    } catch (err) {
      log(`  [${i+1}] ${name} x${qty} - LOI: ${err.message}`);
    }
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

  // Load orderItems cache
  const snap = await db.collection('orderItems').get();
  snap.forEach(d => { itemCache[d.id] = d.data().name || 'Mon khac'; });
  log(`Da tai ${snap.size} mon an vao cache`);

  log(`May in bep: ${PRINTER_IP}:${PRINTER_PORT}`);
  log('=' .repeat(50));
  log('Dang lang nghe don hang moi...');

  // Lang nghe Firestore real-time
  db.collection('bills').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added') {
        handleNewBill(change.doc).catch(err => log(`Loi xu ly don: ${err.message}`));
      }
    });
  }, err => {
    log(`Loi Firestore: ${err.message}`);
  });
}

main();
