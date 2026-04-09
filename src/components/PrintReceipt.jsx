import React, { useRef, useEffect } from 'react';
import { Printer } from 'lucide-react';

const SHOP_NAME = 'CÀ MAU QUÁN';
const SHOP_TAGLINE = '~ Đặc sản biển Cà Mau ~';
const SHOP_ADDRESS = '';
const SHOP_PHONE = '';

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

  const handlePrint = () => {
    const style = `
      @page { size: 80mm auto; margin: 0; }
      * { box-sizing: border-box; }
      body {
        margin: 0; padding: 0;
        font-family: 'Courier New', Courier, monospace;
        font-size: 15px;
        color: #000;
        line-height: 1.5;
      }
      .receipt { width: 76mm; padding: 4mm 3mm 10mm; }
      .shop-name {
        font-size: 20px;
        font-weight: bold;
        text-align: center;
        letter-spacing: 1px;
        margin-bottom: 1px;
      }
      .tagline { font-size: 13px; text-align: center; margin-bottom: 2px; }
      .info { font-size: 13px; text-align: center; }
      .bill-label { font-size: 16px; font-weight: bold; text-align: center; margin: 3px 0 1px; }
      .bill-time { font-size: 13px; text-align: center; margin-bottom: 2px; }
      .divider-solid { border: none; border-top: 2px solid #000; margin: 4px 0; }
      .divider { border: none; border-top: 1px dashed #000; margin: 4px 0; }
      table { width: 100%; border-collapse: collapse; }
      thead th {
        font-size: 14px;
        font-weight: bold;
        padding: 3px 2px;
        border-bottom: 1px solid #000;
      }
      thead th.c-name { text-align: left; }
      thead th.c-qty  { text-align: right; width: 24px; }
      thead th.c-price{ text-align: right; width: 72px; }
      tbody td { font-size: 15px; padding: 3px 2px 1px; vertical-align: top; }
      tbody td.c-name { text-align: left; word-break: break-word; }
      tbody td.c-qty  { text-align: right; width: 24px; }
      tbody td.c-price{ text-align: right; width: 72px; white-space: nowrap; }
      .unit-price { font-size: 12px; color: #444; text-align: right; padding: 0 2px 3px; }
      .total-row td {
        font-size: 17px;
        font-weight: bold;
        padding: 4px 2px;
        border-top: 2px solid #000;
      }
      .footer1 { font-size: 15px; font-weight: bold; text-align: center; margin-top: 8px; }
      .footer2 { font-size: 13px; text-align: center; margin-top: 2px; }
    `;

    const itemRows = items.map(item => {
      const qty = typeof item.quantity === 'number' && item.quantity % 1 !== 0
        ? item.quantity.toFixed(1) : item.quantity;
      const total = (item.price || 0) * item.quantity;
      const unitLine = item.price && item.quantity > 1
        ? `<tr><td colspan="3" class="unit-price">${formatCurrency(item.price)} × ${qty}</td></tr>`
        : '';
      return `
        <tr>
          <td class="c-name">${item.name || 'Món khác'}</td>
          <td class="c-qty">${qty}</td>
          <td class="c-price">${formatCurrency(total)}</td>
        </tr>
        ${unitLine}
      `;
    }).join('');

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
  ${SHOP_PHONE ? `<div class="info">SĐT: ${SHOP_PHONE}</div>` : ''}
  <hr class="divider-solid"/>
  <div class="bill-label">${billLabel}</div>
  <hr class="divider"/>
  <table>
    <thead>
      <tr>
        <th class="c-name">Tên món</th>
        <th class="c-qty">SL</th>
        <th class="c-price">Tiền</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      <tr class="total-row">
        <td class="c-name" colspan="2">TỔNG CỘNG</td>
        <td class="c-price">${formatCurrency(bill?.totalRevenue || 0)}</td>
      </tr>
    </tbody>
  </table>
  <hr class="divider"/>
  <div class="footer1">Cảm ơn quý khách! 🙏</div>
  <div class="footer2">Hẹn gặp lại quý khách lần sau
  </br>
  </br>
  </br>
  </br>
  </div>
  <div style="height:40mm;"></div>
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
