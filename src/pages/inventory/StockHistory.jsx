import React, { useState, useMemo } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { History, ArrowDownToLine, ArrowUpFromLine, Sliders, Search } from 'lucide-react';
import { formatCurrency, formatNumber, getCategoryLabel } from '../../utils/inventoryUtils';

const StockHistory = () => {
  const { stockTransactions, inventoryItems } = useInventory();
  const [filterType, setFilterType] = useState('all'); // 'all' | 'in' | 'out' | 'adjust'
  const [filterItem, setFilterItem] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [searchText, setSearchText] = useState('');

  const filteredTransactions = useMemo(() => {
    return stockTransactions.filter(tx => {
      if (filterType !== 'all' && tx.type !== filterType) return false;
      if (filterItem !== 'all' && tx.inventoryItemId !== filterItem) return false;
      if (filterDate && tx.date !== filterDate) return false;
      if (searchText && !tx.inventoryItemName?.toLowerCase().includes(searchText.toLowerCase()) && !tx.reason?.toLowerCase().includes(searchText.toLowerCase())) return false;
      return true;
    });
  }, [stockTransactions, filterType, filterItem, filterDate, searchText]);

  const totalIn = filteredTransactions.filter(t => t.type === 'in').reduce((s, t) => s + (t.totalCost || 0), 0);
  const totalOut = filteredTransactions.filter(t => t.type === 'out').reduce((s, t) => s + (t.totalCost || 0), 0);

  const getTypeLabel = (type) => {
    switch (type) {
      case 'in': return 'Nhập kho';
      case 'out': return 'Xuất kho';
      case 'adjust': return 'Điều chỉnh';
      default: return type;
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'in':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium"><ArrowDownToLine size={10} />Nhập</span>;
      case 'out':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium"><ArrowUpFromLine size={10} />Xuất</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">Đ.chỉnh</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-100 rounded-lg">
          <History size={24} className="text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lịch sử nhập/xuất kho</h1>
          <p className="text-sm text-gray-500">{filteredTransactions.length} giao dịch</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm theo tên hoặc lý do..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="all">Tất cả loại</option>
            <option value="in">Nhập kho</option>
            <option value="out">Xuất kho</option>
            <option value="adjust">Điều chỉnh</option>
          </select>
          <select
            value={filterItem}
            onChange={(e) => setFilterItem(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="all">Tất cả hàng hóa</option>
            {inventoryItems.map(i => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm text-green-700 font-medium">Tổng nhập</span>
          <span className="text-lg font-bold text-green-700">{formatCurrency(totalIn)}</span>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm text-orange-700 font-medium">Tổng xuất</span>
          <span className="text-lg font-bold text-orange-700">{formatCurrency(totalOut)}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <History size={48} className="mx-auto mb-3 text-gray-300" />
            <p>Chưa có giao dịch nào</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Ngày</th>
                  <th className="px-4 py-3 text-left font-medium">Loại</th>
                  <th className="px-4 py-3 text-left font-medium">Hàng hóa</th>
                  <th className="px-4 py-3 text-right font-medium">Số lượng</th>
                  <th className="px-4 py-3 text-right font-medium">Đơn giá</th>
                  <th className="px-4 py-3 text-right font-medium">Thành tiền</th>
                  <th className="px-4 py-3 text-left font-medium">Lý do</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTransactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{tx.date}</td>
                    <td className="px-4 py-3">{getTypeBadge(tx.type)}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{tx.inventoryItemName}</td>
                    <td className={`px-4 py-3 text-right font-medium ${tx.type === 'in' ? 'text-green-600' : 'text-orange-600'}`}>
                      {tx.type === 'in' ? '+' : '-'}{formatNumber(tx.quantity)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(tx.unitCost || 0)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(tx.totalCost || 0)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{tx.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockHistory;
