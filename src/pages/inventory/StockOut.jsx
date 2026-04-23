import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { toast } from 'react-toastify';
import { Plus, Trash2, ArrowUpFromLine, Save } from 'lucide-react';
import { formatCurrency, createStockTransaction } from '../../utils/inventoryUtils';

const REASONS = ['Hư hỏng', 'Hết hạn', 'Sử dụng nội bộ', 'Mất mát', 'Điều chỉnh', 'Khác'];

const StockOut = () => {
  const { inventoryItems } = useInventory();
  const [entries, setEntries] = useState([createEmptyEntry()]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function createEmptyEntry() {
    return { id: Date.now() + Math.random(), inventoryItemId: '', quantity: '', reason: 'Hư hỏng' };
  }

  const addEntry = () => setEntries(prev => [...prev, createEmptyEntry()]);

  const removeEntry = (id) => {
    if (entries.length <= 1) return;
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const updateEntry = (id, field, value) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const getItem = (itemId) => inventoryItems.find(i => i.id === itemId);

  const handleSubmit = async () => {
    const validEntries = entries.filter(e => e.inventoryItemId && parseFloat(e.quantity) > 0);
    if (validEntries.length === 0) {
      toast.warning('Vui lòng nhập ít nhất 1 mặt hàng');
      return;
    }

    // Check stock availability
    for (const entry of validEntries) {
      const item = getItem(entry.inventoryItemId);
      const qty = parseFloat(entry.quantity);
      if (item && qty > item.currentStock) {
        toast.warning(`"${item.name}" chỉ còn ${item.currentStock} ${item.unit} trong kho`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      for (const entry of validEntries) {
        const item = getItem(entry.inventoryItemId);
        const qty = parseFloat(entry.quantity);

        await createStockTransaction({
          inventoryItemId: entry.inventoryItemId,
          inventoryItemName: item?.name || '',
          type: 'out',
          quantity: qty,
          unitCost: item?.costPerUnit || 0,
          totalCost: qty * (item?.costPerUnit || 0),
          reason: entry.reason || 'Xuất kho'
        });
      }

      toast.success(`Xuất kho thành công ${validEntries.length} mặt hàng!`);
      setEntries([createEmptyEntry()]);
    } catch (error) {
      console.error('Error stock out:', error);
      toast.error('Có lỗi xảy ra khi xuất kho');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-orange-100 rounded-lg">
          <ArrowUpFromLine size={24} className="text-orange-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Xuất kho</h1>
          <p className="text-sm text-gray-500">Xuất hàng hóa ra khỏi kho (hư hỏng, sử dụng...)</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border">
        {/* Header */}
        <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 border-b text-xs font-medium text-gray-600">
          <div className="col-span-5">Hàng hóa</div>
          <div className="col-span-2">Số lượng</div>
          <div className="col-span-2">Tồn kho</div>
          <div className="col-span-2">Lý do</div>
          <div className="col-span-1"></div>
        </div>

        {/* Entries */}
        <div className="divide-y">
          {entries.map((entry) => {
            const item = getItem(entry.inventoryItemId);
            return (
              <div key={entry.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
                <div className="col-span-5">
                  <select
                    value={entry.inventoryItemId}
                    onChange={(e) => updateEntry(entry.id, 'inventoryItemId', e.target.value)}
                    className="w-full px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="">-- Chọn hàng hóa --</option>
                    {inventoryItems.filter(i => i.currentStock > 0).map(i => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.unit}) - Tồn: {i.currentStock}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={item?.currentStock || 9999}
                      placeholder="0"
                      value={entry.quantity}
                      onChange={(e) => updateEntry(entry.id, 'quantity', e.target.value)}
                      className="w-full px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                    {item && <span className="text-xs text-gray-400 whitespace-nowrap">{item.unit}</span>}
                  </div>
                </div>
                <div className="col-span-2 text-sm text-gray-600">
                  {item ? `${item.currentStock} ${item.unit}` : '-'}
                </div>
                <div className="col-span-2">
                  <select
                    value={entry.reason}
                    onChange={(e) => updateEntry(entry.id, 'reason', e.target.value)}
                    className="w-full px-2 py-1.5 border rounded text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    {REASONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-1 flex justify-center">
                  <button
                    onClick={() => removeEntry(entry.id)}
                    disabled={entries.length <= 1}
                    className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-30"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add row */}
        <div className="px-4 py-3 border-t">
          <button onClick={addEntry} className="flex items-center text-sm text-orange-600 hover:text-orange-700 font-medium">
            <Plus size={16} className="mr-1" />
            Thêm dòng
          </button>
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex items-center px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          <Save size={18} className="mr-2" />
          {isSubmitting ? 'Đang xử lý...' : 'Xác nhận xuất kho'}
        </button>
      </div>
    </div>
  );
};

export default StockOut;
