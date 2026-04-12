#!/usr/bin/env node
/**
 * Local ESC/POS print server
 * Nhận lệnh in từ React app và gửi trực tiếp đến máy in nhiệt qua TCP
 *
 * Chạy: node scripts/print-server.mjs
 *        hoặc: npm run print-server
 */

import { createServer } from 'http';
import { createConnection } from 'net';
import { networkInterfaces } from 'os';

// ── Cấu hình ──────────────────────────────────────────────────────────────────
const PRINTER_IP   = '192.168.1.234';
const PRINTER_PORT = 9100;
const HTTP_PORT    = 3001;

/**
 * Đặt true nếu máy in hiện thị sai tiếng Việt (ký tự lỗi).
 * Khi true sẽ chuyển về ASCII không dấu cho toàn bộ văn bản.
 */
const USE_ASCII_FALLBACK = true;

// ── ESC/POS constants ────────────────────────────────────────────────────────
const ESC = 0x1B;
const GS  = 0x1D;
const LF  = 0x0A;

const LINE_WIDTH = 48; // FontA của máy in 80mm = 48 ký tự/dòng

// ── Helper functions ─────────────────────────────────────────────────────────

/** Chuyen tieng Viet sang ASCII khong dau */
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

function encode(str) {
  if (USE_ASCII_FALLBACK) str = toAscii(str);
  return [...Buffer.from(str, 'utf8')];
}

/** Định dạng số kiểu Việt Nam: 62000 → "62.000" */
function fmtNum(n) {
  return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Căn trái + căn phải trong 1 dòng có độ rộng cố định */
function padRow(left, right, width = LINE_WIDTH) {
  const gap = width - left.length - right.length;
  return left + ' '.repeat(Math.max(1, gap)) + right;
}

// ── ESC/POS builder ──────────────────────────────────────────────────────────

function buildBuffer({
  shopName, tagline, address, phone,
  wifiName, wifiPass,
  tableLabel, openTime, printTime,
  items, total,
  discountPercent = 0, discountAmount = 0, finalTotal,
}) {
  const payTotal = (discountAmount > 0 && finalTotal != null) ? finalTotal : total;
  const b = [];
  const add  = (...bytes) => b.push(...bytes);
  const str  = s => b.push(...encode(s));
  const line = (s = '') => { str(s); add(LF); };
  const div  = (c = '-') => line(c.repeat(LINE_WIDTH));

  // ── Khởi tạo máy in ──
  add(ESC, 0x40);

  // ── Header: tên quán ──
  add(ESC, 0x61, 0x01); // căn giữa
  add(GS,  0x21, 0x11); // chữ 2x
  add(ESC, 0x45, 0x01); // bold
  line(shopName);
  add(ESC, 0x45, 0x00);
  add(GS,  0x21, 0x00);

  if (tagline) line(tagline);
  if (address) line(address);
  if (phone)   line('Tel: ' + phone);
  add(LF);

  // Tiêu đề hóa đơn
  add(GS,  0x21, 0x01); // chữ cao 2x
  add(ESC, 0x45, 0x01);
  line('HÓA ĐƠN THANH TOÁN');
  add(GS,  0x21, 0x00);
  add(ESC, 0x45, 0x00);

  // ── Thông tin bàn / giờ ──
  add(ESC, 0x61, 0x00); // căn trái
  div();
  line(padRow('Tại bàn:', tableLabel));
  line(padRow('Giờ vào: ' + openTime, 'In: ' + printTime));

  // ── Bảng món ──
  const C_NAME  = 22;
  const C_PRICE =  9;
  const C_QTY   =  4;
  const C_TOTAL = LINE_WIDTH - C_NAME - C_PRICE - C_QTY; // 13

  const tableRow = (nameRaw, priceStr, qtyStr, totalStr) => {
    const n = nameRaw.substring(0, C_NAME).padEnd(C_NAME);
    line(n + priceStr.padStart(C_PRICE) + qtyStr.padStart(C_QTY) + totalStr.padStart(C_TOTAL));
  };

  div();
  tableRow('Mặt hàng', 'Đ.Giá', 'SL', 'T.Tiền');
  div();

  items.forEach((item, i) => {
    const name  = `${i + 1}. ${item.name || 'Món khác'}`;
    const price = item.price ? fmtNum(item.price) : '-';
    const qty   = String(item.quantity);
    const tot   = fmtNum((item.price || 0) * item.quantity);
    tableRow(name, price, qty, tot);
  });

  div();

  // Tổng số lượng món
  const totalItems = items.reduce((s, it) => s + (it.quantity || 0), 0);
  line(padRow(`Tiền hàng (${totalItems})`, fmtNum(total)));

  if (discountAmount > 0) {
    line(padRow(`Giam gia ${discountPercent}%`, '- ' + fmtNum(discountAmount)));
  }

  div('=');

  // Tổng tiền – chữ to
  add(GS,  0x21, 0x11);
  add(ESC, 0x45, 0x01);
  line(padRow('THANH TOÁN', fmtNum(payTotal) + 'đ'));
  add(GS,  0x21, 0x00);
  add(ESC, 0x45, 0x00);

  line(padRow('Tiền mặt', fmtNum(payTotal)));
  div();

  // ── Footer ──
  add(ESC, 0x61, 0x01); // căn giữa
  add(ESC, 0x45, 0x01);
  line('Cảm ơn quý khách và hẹn gặp lại');
  add(ESC, 0x45, 0x00);
  line(`Wifi: ${wifiName}    Pass: ${wifiPass}`);

  // Đẩy giấy và cắt
  add(LF, LF, LF);
  add(GS, 0x56, 0x42, 0x00); // partial cut

  return Buffer.from(b);
}

// ── ESC/POS builder: phiếu bếp ───────────────────────────────────────────────
// Mỗi món được in thành 1 phếu riêng, tự cắt giấy
function buildKitchenBuffers({ tableLabel, time, items }) {
  return items.map(item => {
    const b = [];
    const add  = (...bytes) => b.push(...bytes);
    const str  = s => b.push(...encode(s));
    const line = (s = '') => { str(s); add(LF); };
    const div  = (c = '=') => line(c.repeat(LINE_WIDTH));

    // Khởi tạo
    add(ESC, 0x40);

    // Dòng phân cách
    add(ESC, 0x61, 0x00); // căn trái
    div();

    // Thời gian — căn giữa
    add(ESC, 0x61, 0x01);
    line(time);

    // Tên bàn — chữ to
    add(GS,  0x21, 0x11); // 2x cả 2 chiều
    add(ESC, 0x45, 0x01); // bold
    line(tableLabel);
    add(GS,  0x21, 0x00);
    add(ESC, 0x45, 0x00);

    // Đường kẻ
    add(ESC, 0x61, 0x00);
    line('-'.repeat(LINE_WIDTH));

    // Tên món — chữ cao 2x
    add(GS,  0x21, 0x01); // chỉ double height
    add(ESC, 0x45, 0x01);
    line(item.name || 'Mon khac');
    add(GS,  0x21, 0x00);
    add(ESC, 0x45, 0x00);

    // Số lượng — căn phải, chữ to
    add(ESC, 0x61, 0x02); // căn phải
    add(GS,  0x21, 0x11);
    add(ESC, 0x45, 0x01);
    line(`SL: ${item.quantity}`);
    add(GS,  0x21, 0x00);
    add(ESC, 0x45, 0x00);

    // Ghi chú (nếu có)
    if (item.note) {
      add(ESC, 0x61, 0x00);
      line('-'.repeat(LINE_WIDTH));
      line('Ghi chu: ' + item.note);
    }

    add(ESC, 0x61, 0x00);
    div();

    // Đẩy giấy và cắt
    add(LF, LF);
    add(GS, 0x56, 0x42, 0x00);

    return Buffer.from(b);
  });
}

// ── TCP sender ───────────────────────────────────────────────────────────────

function sendToRawPrinter(data) {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: PRINTER_IP, port: PRINTER_PORT }, () => {
      socket.write(data, err => {
        if (err) { socket.destroy(); reject(err); return; }
        socket.end();
        resolve();
      });
    });
    socket.on('error', reject);
    socket.setTimeout(5000, () => {
      socket.destroy();
      reject(new Error(`Không kết nối được máy in tại ${PRINTER_IP}:${PRINTER_PORT}`));
    });
  });
}

// ── HTTP server ──────────────────────────────────────────────────────────────

const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, printer: `${PRINTER_IP}:${PRINTER_PORT}` }));
    return;
  }

  // Print endpoint
  if (req.method === 'POST' && req.url === '/print') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const buf  = buildBuffer(data);
        await sendToRawPrinter(buf);
        const t = new Date().toLocaleTimeString('vi-VN');
        console.log(`[${t}] ✓ In thành công: ${data.tableLabel}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        const t = new Date().toLocaleTimeString('vi-VN');
        console.error(`[${t}] ✗ Lỗi in:`, err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // Kitchen ticket endpoint
  if (req.method === 'POST' && req.url === '/print-kitchen') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const buffers = buildKitchenBuffers(data);
        for (const buf of buffers) {
          await sendToRawPrinter(buf);
        }
        const t = new Date().toLocaleTimeString('vi-VN');
        console.log(`[${t}] 🍳 Bếp: ${data.tableLabel} — ${buffers.length} phiếu`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, printed: buffers.length }));
      } catch (err) {
        const t = new Date().toLocaleTimeString('vi-VN');
        console.error(`[${t}] ✗ Lỗi in bếp:`, err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(HTTP_PORT, '0.0.0.0', () => {
  const nets = networkInterfaces();
  const localIPs = Object.values(nets).flat()
    .filter(n => n.family === 'IPv4' && !n.internal)
    .map(n => n.address);
  console.log('─'.repeat(50));
  console.log(`🖨️  Print server đang chạy tại:`);
  console.log(`   http://localhost:${HTTP_PORT}  (PC này)`);
  localIPs.forEach(ip => console.log(`   http://${ip}:${HTTP_PORT}  (điện thoại/máy khác trên WiFi)`));
  console.log(`📍 Máy in: ${PRINTER_IP}:${PRINTER_PORT}`);
  console.log(`📝 Tiếng Việt: ${USE_ASCII_FALLBACK ? 'ASCII (không dấu)' : 'UTF-8 (có dấu)'}`);
  console.log('─'.repeat(50));
  console.log('Đang chờ lệnh in...\n');
});
