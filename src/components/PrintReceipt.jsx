import React, { useRef, useEffect } from 'react';
import { Printer } from 'lucide-react';

const SHOP_NAME = 'Cà Mau Quán';
const SHOP_TAGLINE = '~ Đặc sản biển Cà Mau ~';
const SHOP_ADDRESS = '130 đường 9A, Long Bình, Hồ Chí Minh';
const SHOP_PHONE = '0902434074';
const SHOP_WIFI_NAME = 'Xin Cam On';
const SHOP_WIFI_PASS = '79797979';

// IP cua PC tai quan chay print-server.py (may in hoa don khach)
const _receiptIp = import.meta.env.VITE_PRINT_SERVER_IP || '192.168.123.100';
const RECEIPT_SERVER_URL = `http://${_receiptIp}:3001/print`;

const formatCurrency = (amount) =>
  new Intl.NumberFormat('vi-VN').format(amount) + 'đ';

const formatTime = (ts) => {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

/**
 * items: array of { name, quantity, price }
 * bill: raw bill document from Firestore
 */
const PrintReceipt = ({ bill, items, trigger = 'button', onPrinted }) => {
  const printRef = useRef(null);

  const billLabel = bill?.isTakeaway
    ? `Mang về #${bill.takeawayNumber}`
    : `Bàn ${bill.tableNumber}`;

  const handlePrint = async () => {
    const printTime = new Date().toLocaleString('vi-VN', {
      hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit',
    });
    const openTime = bill?.createdAt ? formatTime(bill.createdAt) : printTime;
    const tableLabel = bill?.isTakeaway
      ? `Mang về #${bill.takeawayNumber}`
      : `Bàn ${bill.tableNumber}`;

    // Thử in trực tiếp qua print server (PC tại quán)
    const discountPercent = bill?.discountPercent || 0;
    const discountAmount  = bill?.discountAmount  || 0;
    const finalTotal      = bill?.finalTotal      ?? bill?.totalRevenue ?? 0;
    try {
      const res = await fetch(RECEIPT_SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(3000),
        body: JSON.stringify({
          shopName: SHOP_NAME, tagline: SHOP_TAGLINE,
          address: SHOP_ADDRESS, phone: SHOP_PHONE,
          wifiName: SHOP_WIFI_NAME, wifiPass: SHOP_WIFI_PASS,
          tableLabel, openTime, printTime,
          items, total: bill?.totalRevenue || 0,
          discountPercent, discountAmount, finalTotal,
        }),
      });
      if (res.ok) { if (onPrinted) onPrinted(); return; }
    } catch { /* fallback to browser */ }

    // Fallback: browser print dialog

    const style = `
      @page { size: 80mm auto; margin: 0 0 25mm 0; }
      * { box-sizing: border-box; }
      body {
        margin: 0; padding: 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 13px;
        color: #000;
        line-height: 1.4;
      }
      .receipt {
        width: 76mm;
        padding: 3mm 3mm 8mm;
        page-break-after: always;
        break-after: page;
      }
      .shop-name {
        font-size: 18px;
        font-weight: 900;
        text-align: center;
        letter-spacing: 0.5px;
        margin-bottom: 2px;
        text-transform: uppercase;
      }
      .tagline { font-size: 12px; text-align: center; margin-bottom: 1px; }
      .info { font-size: 12px; text-align: center; margin-bottom: 1px; }
      .receipt-title {
        font-size: 16px;
        font-weight: 900;
        text-align: center;
        margin: 5px 0 3px;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .divider-solid { border: none; border-top: 2px solid #000; margin: 4px 0; }
      .divider-dot   { border: none; border-top: 1px dotted #000; margin: 3px 0; }
      .meta-row { display: flex; justify-content: space-between; font-size: 12px; margin: 1px 0; }
      table { width: 100%; border-collapse: collapse; margin-top: 2px; }
      thead tr { border-top: 1px solid #000; border-bottom: 1px solid #000; }
      thead th {
        font-size: 12px;
        font-weight: 700;
        padding: 3px 2px;
      }
      thead th.c-name  { text-align: left; }
      thead th.c-price { text-align: right; width: 52px; }
      thead th.c-qty   { text-align: center; width: 28px; }
      thead th.c-total { text-align: right; width: 56px; }
      tbody td {
        font-size: 13px;
        font-weight: 600;
        padding: 3px 2px 2px;
        vertical-align: top;
      }
      tbody td.c-name  { text-align: left; word-break: break-word; }
      tbody td.c-price { text-align: right; width: 52px; white-space: nowrap; font-weight: 400; font-size: 12px; }
      tbody td.c-qty   { text-align: center; width: 28px; }
      tbody td.c-total { text-align: right; width: 56px; white-space: nowrap; }
      .subtotal-row {
        display: flex; justify-content: space-between;
        font-size: 13px; font-weight: 600;
        padding: 3px 2px;
      }
      .grand-total-label {
        font-size: 18px; font-weight: 900;
        text-transform: uppercase;
      }
      .grand-total-value {
        font-size: 18px; font-weight: 900;
      }
      .grand-total-row {
        display: flex; justify-content: space-between;
        align-items: baseline;
        padding: 4px 2px 2px;
      }
      .payment-row {
        display: flex; justify-content: space-between;
        font-size: 13px; padding: 1px 2px 3px;
      }
      .footer-bold {
        font-size: 13px; font-weight: 700;
        text-align: center; margin-top: 6px;
      }
      .footer-center { font-size: 12px; text-align: center; margin-top: 1px; }
    `;

    const itemRows = items.map((item, idx) => {
      const qty = typeof item.quantity === 'number' && item.quantity % 1 !== 0
        ? item.quantity.toFixed(2) : item.quantity;
      const total = (item.price || 0) * item.quantity;
      return `
        <tr>
          <td class="c-name">${idx + 1}. ${item.name || 'Món khác'}</td>
          <td class="c-price">${item.price ? new Intl.NumberFormat('vi-VN').format(item.price) : '-'}</td>
          <td class="c-qty">${qty}</td>
          <td class="c-total">${new Intl.NumberFormat('vi-VN').format(total)}</td>
        </tr>
      `;
    }).join('');

    const totalItems = items.reduce((s, it) => s + (it.quantity || 0), 0);

    const receiptHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>${style}</style>
</head>
<body>
<div class="receipt">
  <div class="shop-name">${SHOP_NAME}</div>
  ${SHOP_TAGLINE ? `<div class="tagline">${SHOP_TAGLINE}</div>` : ''}
  ${SHOP_ADDRESS ? `<div class="info">${SHOP_ADDRESS}</div>` : ''}
  ${SHOP_PHONE ? `<div class="info">Điện thoại ${SHOP_PHONE}</div>` : ''}
  <div class="receipt-title">Hóa Đơn Thanh Toán</div>
  <hr class="divider-solid"/>
  <div class="meta-row">
    <span>Tại bàn</span>
    <span><b>${tableLabel}</b></span>
  </div>
  <div class="meta-row">
    <span>Giờ vào: ${openTime}</span>
    <span>Giờ in: ${printTime}</span>
  </div>
  <table>
    <thead>
      <tr>
        <th class="c-name">Mặt hàng</th>
        <th class="c-price">Đ.Giá</th>
        <th class="c-qty">SL/TL</th>
        <th class="c-total">T.Tiền</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <hr class="divider-dot"/>
  <div class="subtotal-row">
    <span>Tiền hàng (${totalItems})</span>
    <span>${new Intl.NumberFormat('vi-VN').format(bill?.totalRevenue || 0)}</span>
  </div>
  ${discountAmount > 0 ? `
  <div class="subtotal-row" style="color:#c00">
    <span>Giảm giá ${discountPercent}%</span>
    <span>- ${new Intl.NumberFormat('vi-VN').format(discountAmount)}</span>
  </div>` : ''}
  <hr class="divider-solid"/>
  <div class="grand-total-row">
    <span class="grand-total-label">Thanh Toán</span>
    <span class="grand-total-value">${new Intl.NumberFormat('vi-VN').format(finalTotal)} đ</span>
  </div>
  <div class="payment-row">
    <span>Tiền mặt</span>
    <span>${new Intl.NumberFormat('vi-VN').format(finalTotal)}</span>
  </div>
  <hr class="divider-dot"/>
  <div class="footer-bold">Cảm ơn quý khách và hẹn gặp lại</div>
  <div class="footer-center">Wifi: ${SHOP_WIFI_NAME} &nbsp;&nbsp; Pass: ${SHOP_WIFI_PASS}</div>
  <div style="height:4mm;"></div>
</div>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
      alert('Trình duyệt chặn popup. Vui lòng cho phép popup để in.');
      return;
    }
    printWindow.document.write(receiptHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.onafterprint = () => {
      printWindow.close();
      if (onPrinted) onPrinted();
    };
    setTimeout(() => {
      if (!printWindow.closed) printWindow.close();
      if (onPrinted) onPrinted();
    }, 5000);
  };

  // Auto-print on mount when trigger === 'auto'
  useEffect(() => {
    if (trigger === 'auto') {
      handlePrint();
    }
  }, []);

  if (trigger === 'auto') return null;

  return (
    <button
      onClick={handlePrint}
      className="flex items-center gap-1 px-3 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md border border-gray-300 transition-colors"
      title="In hóa đơn"
    >
      <Printer size={16} />
      <span className="hidden sm:inline">In hóa đơn</span>
    </button>
  );
};

export default PrintReceipt;
