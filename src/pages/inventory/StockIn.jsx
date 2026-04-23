import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { toast } from 'react-toastify';
import { Plus, Trash2, ArrowDownToLine, Save, Search } from 'lucide-react';
import { formatCurrency, createStockTransaction, getCategoryLabel } from '../../utils/inventoryUtils';

const StockIn = () => {
  const { inventoryItems } = useInventory();
  const [entries, setEntries] = useState([createEmptyEntry()]);
  const [searchText, setSearchText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function createEmptyEntry() {
    return { id: Date.now() + Math.random(), inventoryItemId: '', quantity: '', unitCost: '', reason: 'Nhập hàng' };
  }

  const addEntry = () => {
    setEntries(prev => [...prev, createEmptyEntry()]);
  };

  const removeEntry = (id) => {
    if (entries.length <= 1) return;
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const updateEntry = (id, field, value) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const getItem = (itemId) => inventoryItems.find(i => i.id === itemId);

  const totalCost = entries.reduce((sum, e) => {
    const qty = parseFloat(e.quantity) || 0;
    const cost = parseFloat(e.unitCost) || 0;
    return sum + qty * cost;
  }, 0);

  const handleSubmit = async () => {
    // Validate
    const validEntries = entries.filter(e => e.inventoryItemId && parseFloat(e.quantity) > 0);
    if (validEntries.length === 0) {
      toast.warning('Vui lòng nhập ít nhất 1 mặt hàng');
      return;
    }

    setIsSubmitting(true);
    try {
      for (const entry of validEntries) {
        const item = getItem(entry.inventoryItemId);
        const qty = parseFloat(entry.quantity);
        const unitCost = parseFloat(entry.unitCost) || 0;

        await createStockTransaction({
          inventoryItemId: entry.inventoryItemId,
          inventoryItemName: item?.name || '',
          type: 'in',
          quantity: qty,
          unitCost,
          totalCost: qty * unitCost,
          reason: entry.reason || 'Nhập hàng'
        });
      }

      toast.success(`Nhập kho thành công ${validEntries.length} mặt hàng!`);
      setEntries([createEmptyEntry()]);
    } catch (error) {
      console.error('Error stock in:', error);
      toast.error('Có lỗi xảy ra khi nhập kho');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter items for dropdown
  const filteredInventoryItems = searchText
    ? inventoryItems.filter(i => i.name.toLowerCase().includes(searchText.toLowerCase()))
    : inventoryItems;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <ArrowDownToLine size={24} className="text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nhập kho</h1>
            <p className="text-sm text-gray-500">Thêm hàng hóa vào kho</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border">
        {/* Header */}
        <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 border-b text-xs font-medium text-gray-600">
          <div className="col-span-4">Hàng hóa</div>
          <div className="col-span-2">Số lượng</div>
          <div className="col-span-2">Đơn giá nhập</div>
          <div className="col-span-2">Thành tiền</div>
          <div className="col-span-1">Lý do</div>
          <div className="col-span-1"></div>
        </div>

        {/* Entries */}
        <div className="divide-y">
          {entries.map((entry) => {
            const item = getItem(entry.inventoryItemId);
            const qty = parseFloat(entry.quantity) || 0;
            const cost = parseFloat(entry.unitCost) || 0;
            const lineTotal = qty * cost;

            return (
              <div key={entry.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
                <div className="col-span-4">
                  <select
                    value={entry.inventoryItemId}
                    onChange={(e) => {
                      updateEntry(entry.id, 'inventoryItemId', e.target.value);
                      const selected = inventoryItems.find(i => i.id === e.target.value);
                      if (selected?.costPerUnit) {
                        updateEntry(entry.id, 'unitCost', selected.costPerUnit.toString());
                      }
                    }}
                    className="w-full px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="">-- Chọn hàng hóa --</option>
                    {inventoryItems.map(i => (
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
                      placeholder="0"
                      value={entry.quantity}
                      onChange={(e) => updateEntry(entry.id, 'quantity', e.target.value)}
                      className="w-full px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                    {item && <span className="text-xs text-gray-400 whitespace-nowrap">{item.unit}</span>}
                  </div>
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="0"
                    value={entry.unitCost}
                    onChange={(e) => updateEntry(entry.id, 'unitCost', e.target.value)}
                    className="w-full px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div className="col-span-2 text-sm font-medium text-gray-900">
                  {formatCurrency(lineTotal)}
                </div>
                <div className="col-span-1">
                  <input
                    type="text"
                    placeholder="Nhập hàng"
                    value={entry.reason}
                    onChange={(e) => updateEntry(entry.id, 'reason', e.target.value)}
                    className="w-full px-2 py-1.5 border rounded text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
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
          <button onClick={addEntry} className="flex items-center text-sm text-emerald-600 hover:text-emerald-700 font-medium">
            <Plus size={16} className="mr-1" />
            Thêm dòng
          </button>
        </div>
      </div>

      {/* Summary & Submit */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-gray-500">Tổng tiền nhập:</span>
            <span className="ml-2 text-xl font-bold text-green-600">{formatCurrency(totalCost)}</span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <Save size={18} className="mr-2" />
            {isSubmitting ? 'Đang xử lý...' : 'Xác nhận nhập kho'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StockIn;
