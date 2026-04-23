import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useInventory } from '../../context/InventoryContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Calendar, TrendingUp, TrendingDown, DollarSign, ArrowDownToLine, ArrowUpFromLine, BarChart3 } from 'lucide-react';
import {
  EXPENSE_CATEGORIES,
  getExpenseCategoryLabel, getExpenseCategoryColor,
  formatCurrency, getDateString, getWeekKey, getMonthKey,
  aggregateExpensesByCategory, aggregateByPeriod, buildProfitLossData
} from '../../utils/expenseUtils';

const PIE_COLORS = EXPENSE_CATEGORIES.map(c => c.color);

const ExpenseReport = () => {
  const { expenses } = useInventory();
  const [periodType, setPeriodType] = useState('day'); // day | week | month
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [bills, setBills] = useState([]);
  const [loadingBills, setLoadingBills] = useState(false);

  // Set default date range
  useEffect(() => {
    const today = new Date();
    let start;
    switch (periodType) {
      case 'day':
        start = new Date(today);
        start.setDate(start.getDate() - 13); // 14 ngày
        break;
      case 'week':
        start = new Date(today);
        start.setDate(start.getDate() - 55); // ~8 tuần
        break;
      case 'month':
        start = new Date(today);
        start.setMonth(start.getMonth() - 5); // 6 tháng
        break;
      default:
        start = new Date(today);
        start.setDate(start.getDate() - 13);
    }
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  }, [periodType]);

  // Load bills (revenue) for comparison
  useEffect(() => {
    if (!startDate || !endDate) return;
    const loadBills = async () => {
      setLoadingBills(true);
      try {
        const q = query(
          collection(db, 'bills'),
          where('date', '>=', startDate),
          where('date', '<=', endDate),
          where('status', '==', 'paid'),
          orderBy('date', 'asc')
        );
        const snap = await getDocs(q);
        setBills(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error('Error loading bills:', error);
      } finally {
        setLoadingBills(false);
      }
    };
    loadBills();
  }, [startDate, endDate]);

  // Filter expenses by date range
  const filteredExpenses = useMemo(() => {
    if (!startDate || !endDate) return [];
    return expenses.filter(e => e.date >= startDate && e.date <= endDate);
  }, [expenses, startDate, endDate]);

  // Period function
  const periodFn = useMemo(() => {
    switch (periodType) {
      case 'day': return (d) => d;
      case 'week': return getWeekKey;
      case 'month': return getMonthKey;
      default: return (d) => d;
    }
  }, [periodType]);

  // Aggregated data
  const categoryData = useMemo(() => aggregateExpensesByCategory(filteredExpenses), [filteredExpenses]);
  const periodData = useMemo(() => aggregateByPeriod(filteredExpenses, periodFn), [filteredExpenses, periodFn]);
  const profitLossData = useMemo(() => buildProfitLossData(bills, filteredExpenses, periodFn), [bills, filteredExpenses, periodFn]);

  // Totals
  const totalExpense = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalRevenue = bills.reduce((s, b) => s + (b.finalTotal || b.totalRevenue || 0), 0);
  const totalProfit = totalRevenue - totalExpense;

  const formatTooltip = (value) => formatCurrency(value);
  const formatAxis = (value) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value;
  };

  const formatPeriodLabel = (label) => {
    if (periodType === 'day') {
      // "2026-04-23" → "23/04"
      const parts = label.split('-');
      return parts.length === 3 ? `${parts[2]}/${parts[1]}` : label;
    }
    if (periodType === 'week') {
      return label.replace('-', ' ');
    }
    if (periodType === 'month') {
      // "2026-04" → "T4/2026"
      const parts = label.split('-');
      return parts.length === 2 ? `T${parseInt(parts[1])}/${parts[0]}` : label;
    }
    return label;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-violet-100 rounded-lg">
          <BarChart3 size={24} className="text-violet-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Báo cáo chi tiêu</h1>
          <p className="text-sm text-gray-500">So sánh doanh thu & chi phí</p>
        </div>
      </div>

      {/* Period selector */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {[
              { value: 'day', label: 'Theo ngày' },
              { value: 'week', label: 'Theo tuần' },
              { value: 'month', label: 'Theo tháng' }
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setPeriodType(opt.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  periodType === opt.value
                    ? 'bg-white text-violet-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Calendar size={16} className="text-gray-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            />
            <span className="text-gray-400">→</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            />
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingUp size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Doanh thu</p>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalRevenue)}</p>
              <p className="text-xs text-gray-400">{bills.length} đơn đã thanh toán</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <TrendingDown size={20} className="text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Chi tiêu</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpense)}</p>
              <p className="text-xs text-gray-400">{filteredExpenses.length} khoản chi</p>
            </div>
          </div>
        </div>

        <div className={`bg-white rounded-lg shadow-sm border p-5 ${totalProfit >= 0 ? 'ring-1 ring-emerald-200' : 'ring-1 ring-red-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${totalProfit >= 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
              <DollarSign size={20} className={totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Lợi nhuận</p>
              <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {totalProfit >= 0 ? '+' : ''}{formatCurrency(totalProfit)}
              </p>
              <p className="text-xs text-gray-400">
                {totalRevenue > 0 ? `${((totalProfit / totalRevenue) * 100).toFixed(1)}% biên lợi nhuận` : '-'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue vs Expense bar chart */}
        <div className="bg-white rounded-lg shadow-sm border p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Doanh thu vs Chi tiêu ({periodType === 'day' ? 'theo ngày' : periodType === 'week' ? 'theo tuần' : 'theo tháng'})</h2>
          {profitLossData.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Chưa có dữ liệu</p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={profitLossData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} tickFormatter={formatPeriodLabel} />
                <YAxis tickFormatter={formatAxis} tick={{ fontSize: 11 }} />
                <Tooltip formatter={formatTooltip} labelFormatter={formatPeriodLabel} />
                <Legend />
                <Bar dataKey="revenue" name="Doanh thu" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Chi tiêu" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Profit/Loss line chart */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Lợi nhuận ròng</h2>
          {profitLossData.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Chưa có dữ liệu</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={profitLossData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} tickFormatter={formatPeriodLabel} />
                <YAxis tickFormatter={formatAxis} tick={{ fontSize: 11 }} />
                <Tooltip formatter={formatTooltip} labelFormatter={formatPeriodLabel} />
                <Line type="monotone" dataKey="profit" name="Lợi nhuận" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Category pie chart */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Chi tiêu theo danh mục</h2>
          {filteredExpenses.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Chưa có dữ liệu</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="60%" height={240}>
                <PieChart>
                  <Pie
                    data={categoryData.filter(c => c.total > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="total"
                    nameKey="label"
                  >
                    {categoryData.filter(c => c.total > 0).map((entry, idx) => (
                      <Cell key={entry.value} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={formatTooltip} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {categoryData.map(cat => (
                  <div key={cat.value} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="text-gray-700">{cat.label}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium text-gray-900">{formatCurrency(cat.total)}</span>
                      {totalExpense > 0 && (
                        <span className="text-xs text-gray-400 ml-1">
                          ({((cat.total / totalExpense) * 100).toFixed(0)}%)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Expense trend by period */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Chi tiêu theo thời gian</h2>
        {periodData.length === 0 ? (
          <p className="text-gray-400 text-center py-8">Chưa có dữ liệu</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Thời gian</th>
                  <th className="px-4 py-2 text-right font-medium">Số khoản</th>
                  <th className="px-4 py-2 text-right font-medium">Tổng chi</th>
                  <th className="px-4 py-2 text-left font-medium" style={{width: '40%'}}>Biểu đồ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {periodData.map(row => {
                  const maxTotal = Math.max(...periodData.map(r => r.total));
                  const widthPct = maxTotal > 0 ? (row.total / maxTotal) * 100 : 0;
                  return (
                    <tr key={row.period} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-900">{formatPeriodLabel(row.period)}</td>
                      <td className="px-4 py-2 text-right text-gray-600">{row.count}</td>
                      <td className="px-4 py-2 text-right font-semibold text-gray-900">{formatCurrency(row.total)}</td>
                      <td className="px-4 py-2">
                        <div className="w-full bg-gray-100 rounded-full h-3">
                          <div
                            className="bg-violet-500 rounded-full h-3 transition-all"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpenseReport;
