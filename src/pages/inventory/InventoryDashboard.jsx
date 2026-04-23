import React from 'react';
import { useInventory } from '../../context/InventoryContext';
import { useNavigate } from 'react-router-dom';
import { Package, ArrowDownToLine, ArrowUpFromLine, AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';
import { INVENTORY_CATEGORIES, getCategoryLabel, formatCurrency, formatNumber } from '../../utils/inventoryUtils';

const InventoryDashboard = () => {
  const { inventoryItems, stockTransactions, lowStockItems, loading } = useInventory();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  // Thống kê
  const totalItems = inventoryItems.length;
  const totalValue = inventoryItems.reduce((sum, item) => sum + (item.currentStock || 0) * (item.costPerUnit || 0), 0);

  // Thống kê theo danh mục
  const categoryStats = INVENTORY_CATEGORIES.map(cat => {
    const items = inventoryItems.filter(i => i.category === cat.value);
    return {
      ...cat,
      count: items.length,
      totalValue: items.reduce((sum, i) => sum + (i.currentStock || 0) * (i.costPerUnit || 0), 0)
    };
  });

  // Giao dịch gần đây
  const recentTransactions = stockTransactions.slice(0, 10);

  // Thống kê nhập/xuất hôm nay
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const todayTransactions = stockTransactions.filter(t => t.date === todayStr);
  const todayIn = todayTransactions.filter(t => t.type === 'in').reduce((sum, t) => sum + (t.totalCost || 0), 0);
  const todayOut = todayTransactions.filter(t => t.type === 'out').reduce((sum, t) => sum + (t.totalCost || 0), 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Tổng quan kho</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Package size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Mặt hàng</p>
              <p className="text-xl font-bold text-gray-900">{totalItems}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingUp size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Giá trị kho</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(totalValue)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <ArrowDownToLine size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Nhập hôm nay</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(todayIn)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <ArrowUpFromLine size={20} className="text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Xuất hôm nay</p>
              <p className="text-xl font-bold text-orange-600">{formatCurrency(todayOut)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Low stock warning */}
      {lowStockItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={20} className="text-amber-600" />
            <h2 className="text-lg font-semibold text-amber-800">Cảnh báo sắp hết hàng ({lowStockItems.length})</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {lowStockItems.map(item => (
              <div key={item.id} className="flex items-center justify-between bg-white rounded-md px-3 py-2 border border-amber-200">
                <div>
                  <span className="font-medium text-gray-900">{item.name}</span>
                  <span className="text-xs text-gray-500 ml-2">{getCategoryLabel(item.category)}</span>
                </div>
                <div className="text-right">
                  <span className={`font-bold ${item.currentStock <= 0 ? 'text-red-600' : 'text-amber-600'}`}>
                    {formatNumber(item.currentStock)}
                  </span>
                  <span className="text-xs text-gray-500 ml-1">/ {formatNumber(item.minStock)} {item.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category breakdown */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Theo danh mục</h2>
          <div className="space-y-3">
            {categoryStats.map(cat => (
              <div key={cat.value} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    cat.value === 'nguyen_lieu' ? 'bg-emerald-500' :
                    cat.value === 'do_uong' ? 'bg-blue-500' : 'bg-purple-500'
                  }`} />
                  <span className="text-sm text-gray-700">{cat.label}</span>
                  <span className="text-xs text-gray-400">({cat.count})</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{formatCurrency(cat.totalValue)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent transactions */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Giao dịch gần đây</h2>
            <button
              onClick={() => navigate('/inventory/history')}
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Xem tất cả →
            </button>
          </div>
          {recentTransactions.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">Chưa có giao dịch nào</p>
          ) : (
            <div className="space-y-2">
              {recentTransactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    {tx.type === 'in' ? (
                      <ArrowDownToLine size={14} className="text-green-500" />
                    ) : (
                      <ArrowUpFromLine size={14} className="text-orange-500" />
                    )}
                    <div>
                      <span className="text-sm text-gray-900">{tx.inventoryItemName}</span>
                      <span className="text-xs text-gray-400 ml-2">{tx.reason}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-medium ${tx.type === 'in' ? 'text-green-600' : 'text-orange-600'}`}>
                      {tx.type === 'in' ? '+' : '-'}{formatNumber(tx.quantity)}
                    </span>
                    <div className="text-xs text-gray-400">{tx.date}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InventoryDashboard;
