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
        font-size: 14px;
        color: #000;
        line-height: 1.4;
      }
      .receipt { width: 78mm; padding: 5mm 3mm 8mm; }
      .center { text-align: center; }
      .shop-name {
        font-size: 22px;
        font-weight: bold;
        text-align: center;
        letter-spacing: 2px;
        margin-bottom: 2px;
      }
      .tagline { font-size: 12px; text-align: center; color: #333; margin-bottom: 3px; }
      .info { font-size: 12px; text-align: center; }
      .divider-solid { border-top: 2px solid #000; margin: 5px 0; }
      .divider { border-top: 1px dashed #000; margin: 5px 0; }
      .bill-label { font-size: 18px; font-weight: bold; text-align: center; margin: 4px 0 2px; }
      .bill-time { font-size: 12px; text-align: center; color: #333; margin-bottom: 2px; }
      .col-header {
        display: flex;
        font-size: 13px;
        font-weight: bold;
        padding: 3px 0;
        border-bottom: 1px solid #000;
        margin-bottom: 2px;
      }
      .col-header .h-name { flex: 1; }
      .col-header .h-qty { width: 28px; text-align: right; }
      .col-header .h-price { width: 76px; text-align: right; }
      .item-row { display: flex; align-items: flex-start; padding: 3px 0; }
      .item-row .i-name { flex: 1; font-size: 14px; word-break: break-word; padding-right: 4px; }
      .item-row .i-qty { width: 28px; text-align: right; font-size: 14px; }
      .item-row .i-price { width: 76px; text-align: right; font-size: 14px; }
      .unit-price { font-size: 11px; color: #555; text-align: right; padding-bottom: 2px; }
      .total-section { margin-top: 4px; }
      .total-row {
        display: flex;
        justify-content: space-between;
        font-size: 17px;
        font-weight: bold;
        padding: 4px 0;
      }
      .footer1 { font-size: 14px; font-weight: bold; text-align: center; margin-top: 6px; }
      .footer2 { font-size: 12px; text-align: center; margin-top: 2px; }
    `;

    const receiptHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8"/>
          <style>\${style}</style>
        </head>
        <body>
          <div class="receipt">
            <div class="shop-name">${SHOP_NAME}</div>
            ${SHOP_TAGLINE ? `<div class="tagline">${SHOP_TAGLINE}</div>` : ''}
            ${SHOP_ADDRESS ? `<div class="info">${SHOP_ADDRESS}</div>` : ''}
            ${SHOP_PHONE ? `<div class="info">SĐT: ${SHOP_PHONE}</div>` : ''}
            <div class="divider-solid"></div>
            <div class="bill-label">${billLabel}</div>
            <div class="bill-time">${formatTime(bill?.paidAt || bill?.createdAt)}</div>
            <div class="divider"></div>
            <div class="col-header">
              <span class="h-name">Tên món</span>
              <span class="h-qty">SL</span>
              <span class="h-price">Tiền</span>
            </div>
            ${items.map(item => {
              const qty = typeof item.quantity === 'number' && item.quantity % 1 !== 0
                ? item.quantity.toFixed(1)
                : item.quantity;
              const total = (item.price || 0) * item.quantity;
              return `
                <div class="item-row">
                  <span class="i-name">${item.name || 'Món khác'}</span>
                  <span class="i-qty">${qty}</span>
                  <span class="i-price">${formatCurrency(total)}</span>
                </div>
                ${item.price && item.quantity > 1 ? `<div class="unit-price">${formatCurrency(item.price)} × ${qty}</div>` : ''}
              `;
            }).join('')}
            <div class="divider-solid"></div>
            <div class="total-section">
              <div class="total-row">
                <span>TỔNG CỘNG</span>
                <span>${formatCurrency(bill?.totalRevenue || 0)}</span>
              </div>
            </div>
            <div class="divider"></div>
            <div class="footer1">Cảm ơn quý khách! 🙏</div>
            <div class="footer2">Hẹn gặp lại quý khách lần sau</div>
            <br/><br/><br/>
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
