import React, { useRef, useEffect } from 'react';
import { Printer } from 'lucide-react';

const SHOP_NAME = 'QUÁN ỐC';
const SHOP_ADDRESS = 'Cà Mau';
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
      body { margin: 0; padding: 0; font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #000; }
      .receipt { width: 76mm; padding: 4mm 2mm; }
      .center { text-align: center; }
      .bold { font-weight: bold; }
      .big { font-size: 16px; }
      .medium { font-size: 13px; }
      .divider { border-top: 1px dashed #000; margin: 4px 0; }
      .row { display: flex; justify-content: space-between; padding: 1px 0; }
      .row .name { flex: 1; padding-right: 4px; word-break: break-word; }
      .row .qty { text-align: right; min-width: 28px; }
      .row .price { text-align: right; min-width: 70px; }
      .total-row { display: flex; justify-content: space-between; padding: 2px 0; font-weight: bold; font-size: 14px; }
      .footer { text-align: center; margin-top: 6px; font-size: 11px; }
    `;

    const receiptHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8"/>
          <style>${style}</style>
        </head>
        <body>
          <div class="receipt">
            <div class="center bold big">${SHOP_NAME}</div>
            ${SHOP_ADDRESS ? `<div class="center">${SHOP_ADDRESS}</div>` : ''}
            ${SHOP_PHONE ? `<div class="center">SĐT: ${SHOP_PHONE}</div>` : ''}
            <div class="divider"></div>
            <div class="center bold medium">${billLabel}</div>
            <div class="center">${formatTime(bill?.paidAt || bill?.createdAt)}</div>
            <div class="divider"></div>
            <div class="row bold">
              <span class="name">Tên món</span>
              <span class="qty">SL</span>
              <span class="price">Thành tiền</span>
            </div>
            <div class="divider"></div>
            ${items.map(item => {
              const qty = typeof item.quantity === 'number' && item.quantity % 1 !== 0
                ? item.quantity.toFixed(1)
                : item.quantity;
              const total = (item.price || 0) * item.quantity;
              return `
                <div class="row">
                  <span class="name">${item.name || 'Món khác'}</span>
                  <span class="qty">${qty}</span>
                  <span class="price">${formatCurrency(total)}</span>
                </div>
                ${item.price ? `<div style="text-align:right;font-size:11px;color:#555;">${formatCurrency(item.price)} x ${qty}</div>` : ''}
              `;
            }).join('')}
            <div class="divider"></div>
            <div class="total-row">
              <span>TỔNG CỘNG</span>
              <span>${formatCurrency(bill?.totalRevenue || 0)}</span>
            </div>
            <div class="divider"></div>
            <div class="footer">Cảm ơn quý khách!</div>
            <div class="footer">Hẹn gặp lại ^^</div>
            <br/><br/>
          </div>
        </body>
      </html>
    `;

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
    // Fallback nếu onafterprint không trigger
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
