import React, { useState, useMemo } from 'react';
import { X, Tag, CheckSquare, Square } from 'lucide-react';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('vi-VN').format(Math.round(amount)) + 'đ';

/**
 * DiscountModal
 * Props:
 *   bill    — raw Firestore bill document
 *   items   — array of { name, quantity, price }  (built by buildItemsForPrint)
 *   onConfirm(data) — data: { discountPercent, discountAmount, finalTotal }
 *   onClose — đóng modal không làm gì
 */
const DiscountModal = ({ bill, items, onConfirm, onClose }) => {
  const [percent, setPercent] = useState('');
  // Set index của những món BỊ LOẠI (mặc định rỗng = tất cả được giảm)
  const [excluded, setExcluded] = useState(new Set());

  const pct = Math.min(100, Math.max(0, Number(percent) || 0));

  const billLabel = bill?.isTakeaway
    ? `Mang về #${bill.takeawayNumber}`
    : `Bàn ${bill.tableNumber}`;

  // Tổng tiền của các món được tích giảm
  const includedSubtotal = useMemo(() =>
    items.reduce((sum, item, idx) => {
      if (excluded.has(idx)) return sum;
      return sum + (item.price || 0) * (item.quantity || 1);
    }, 0),
    [items, excluded]
  );

  const discountAmount = Math.round(includedSubtotal * pct / 100);
  const finalTotal = (bill?.totalRevenue || 0) - discountAmount;

  const toggleItem = (idx) => {
    setExcluded(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (excluded.size === 0) {
      // Bỏ tích tất cả
      setExcluded(new Set(items.map((_, i) => i)));
    } else {
      // Tích tất cả
      setExcluded(new Set());
    }
  };

  const handleConfirm = () => {
    onConfirm({ discountPercent: pct, discountAmount, finalTotal });
  };

  const PRESETS = [5, 10, 15, 20];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2 text-green-700">
            <Tag size={20} />
            <span className="font-semibold text-lg">Giảm giá — {billLabel}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* Nhập % giảm giá */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phần trăm giảm giá
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={percent}
                  onChange={e => setPercent(e.target.value)}
                  placeholder="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-8 text-lg font-semibold text-center focus:outline-none focus:ring-2 focus:ring-green-400"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">%</span>
              </div>
            </div>
            {/* Preset buttons */}
            <div className="flex gap-2 mt-2">
              {PRESETS.map(p => (
                <button
                  key={p}
                  onClick={() => setPercent(String(p))}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    pct === p
                      ? 'bg-green-600 text-white border-green-600'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {p}%
                </button>
              ))}
            </div>
          </div>

          {/* Danh sách món */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Áp dụng cho món
              </span>
              <button
                onClick={toggleAll}
                className="text-xs text-green-600 hover:text-green-800 font-medium"
              >
                {excluded.size === 0 ? 'Bỏ tất cả' : 'Chọn tất cả'}
              </button>
            </div>

            <div className="space-y-1 rounded-lg border border-gray-100 overflow-hidden">
              {items.map((item, idx) => {
                const isIncluded = !excluded.has(idx);
                const lineTotal = (item.price || 0) * (item.quantity || 1);
                return (
                  <button
                    key={idx}
                    onClick={() => toggleItem(idx)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                      isIncluded ? 'bg-green-50 hover:bg-green-100' : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    {isIncluded
                      ? <CheckSquare size={17} className="text-green-600 shrink-0" />
                      : <Square size={17} className="text-gray-300 shrink-0" />
                    }
                    <span className={`flex-1 text-sm ${isIncluded ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                      {idx + 1}. {item.name}
                    </span>
                    <span className={`text-xs whitespace-nowrap ${isIncluded ? 'text-gray-600' : 'text-gray-300'}`}>
                      x{item.quantity} = {formatCurrency(lineTotal)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer — tóm tắt + nút */}
        <div className="border-t px-5 py-4 space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Tiền hàng</span>
            <span>{formatCurrency(bill?.totalRevenue || 0)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-sm text-red-600">
              <span>Giảm giá {pct}%</span>
              <span>- {formatCurrency(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-gray-900 pt-1 border-t">
            <span>Thành tiền</span>
            <span className="text-green-700">{formatCurrency(finalTotal)}</span>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={handleConfirm}
              className="flex-2 flex-[2] py-2.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors"
            >
              {discountAmount > 0
                ? `Xác nhận — ${formatCurrency(finalTotal)}`
                : 'Xác nhận thanh toán'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiscountModal;
