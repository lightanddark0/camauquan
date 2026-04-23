import React, { useState, useMemo } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { toast } from 'react-toastify';
import { Plus, Edit, Trash2, X, Save, Search, Wallet, Calendar, Filter } from 'lucide-react';
import {
  EXPENSE_CATEGORIES, EXPENSE_SUBCATEGORIES,
  getExpenseCategoryLabel, getExpenseCategoryColor,
  formatCurrency, getDateString,
  addExpense, updateExpense, deleteExpense
} from '../../utils/expenseUtils';

const schema = yup.object({
  category: yup.string().required('Danh mục là bắt buộc'),
  subcategory: yup.string().default(''),
  description: yup.string().default(''),
  amount: yup.number().required('Số tiền là bắt buộc').min(1, 'Số tiền phải lớn hơn 0').transform(v => isNaN(v) ? 0 : v),
  date: yup.string().required('Ngày là bắt buộc'),
  note: yup.string().default('')
});

const ExpenseList = () => {
  const { expenses } = useInventory();
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      category: 'nhap_hang',
      subcategory: '',
      description: '',
      amount: '',
      date: getDateString(),
      note: ''
    }
  });

  const watchCategory = watch('category');

  const openModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      reset({
        category: item.category,
        subcategory: item.subcategory || '',
        description: item.description || '',
        amount: item.amount,
        date: item.date,
        note: item.note || ''
      });
    } else {
      setEditingItem(null);
      reset({
        category: 'nhap_hang',
        subcategory: '',
        description: '',
        amount: '',
        date: getDateString(),
        note: ''
      });
    }
    setShowModal(true);
  };

  const onSubmit = async (data) => {
    try {
      if (editingItem) {
        await updateExpense(editingItem.id, data);
        toast.success('Cập nhật chi tiêu thành công!');
      } else {
        await addExpense(data);
        toast.success('Thêm chi tiêu thành công!');
      }
      setShowModal(false);
      reset();
    } catch (error) {
      console.error('Error saving expense:', error);
      toast.error('Có lỗi xảy ra');
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Xóa khoản chi "${item.description || getExpenseCategoryLabel(item.category)}" - ${formatCurrency(item.amount)}?`)) return;
    try {
      await deleteExpense(item.id);
      toast.success('Đã xóa!');
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Có lỗi xảy ra');
    }
  };

  // Filter & search
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      if (filterCategory !== 'all' && exp.category !== filterCategory) return false;
      if (filterMonth && !exp.date?.startsWith(filterMonth)) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        const matchDesc = exp.description?.toLowerCase().includes(q);
        const matchSub = exp.subcategory?.toLowerCase().includes(q);
        const matchNote = exp.note?.toLowerCase().includes(q);
        if (!matchDesc && !matchSub && !matchNote) return false;
      }
      return true;
    });
  }, [expenses, filterCategory, filterMonth, searchText]);

  const totalFiltered = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  // Monthly quick stats
  const monthExpenses = useMemo(() => {
    return expenses.filter(e => e.date?.startsWith(filterMonth));
  }, [expenses, filterMonth]);

  const monthTotal = monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const categoryTotals = useMemo(() => {
    const totals = {};
    monthExpenses.forEach(e => {
      totals[e.category] = (totals[e.category] || 0) + (e.amount || 0);
    });
    return totals;
  }, [monthExpenses]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Quản lý chi tiêu</h1>
        <button
          onClick={() => openModal()}
          className="flex items-center px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} className="mr-1" />
          Thêm chi tiêu
        </button>
      </div>

      {/* Month summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white rounded-lg shadow-sm border p-4 col-span-2 lg:col-span-1">
          <p className="text-xs text-gray-500 mb-1">Tổng tháng</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(monthTotal)}</p>
          <p className="text-xs text-gray-400 mt-1">{monthExpenses.length} khoản</p>
        </div>
        {EXPENSE_CATEGORIES.map(cat => (
          <div key={cat.value} className="bg-white rounded-lg shadow-sm border p-4">
            <p className="text-xs text-gray-500 mb-1">{cat.label}</p>
            <p className="text-lg font-bold" style={{ color: cat.color }}>
              {formatCurrency(categoryTotals[cat.value] || 0)}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm theo mô tả, ghi chú..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
          >
            <option value="all">Tất cả danh mục</option>
            {EXPENSE_CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
          />
        </div>
      </div>

      {/* Summary for filtered */}
      {(filterCategory !== 'all' || searchText) && (
        <div className="bg-violet-50 border border-violet-200 rounded-lg px-4 py-2 text-sm">
          <span className="text-violet-700">Kết quả lọc: <strong>{filteredExpenses.length}</strong> khoản — Tổng: <strong>{formatCurrency(totalFiltered)}</strong></span>
        </div>
      )}

      {/* Expenses list */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {filteredExpenses.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Wallet size={48} className="mx-auto mb-3 text-gray-300" />
            <p>Chưa có khoản chi tiêu nào</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Ngày</th>
                  <th className="px-4 py-3 text-left font-medium">Danh mục</th>
                  <th className="px-4 py-3 text-left font-medium">Mô tả</th>
                  <th className="px-4 py-3 text-right font-medium">Số tiền</th>
                  <th className="px-4 py-3 text-left font-medium">Ghi chú</th>
                  <th className="px-4 py-3 text-center font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredExpenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{exp.date}</td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: getExpenseCategoryColor(exp.category) }}
                      >
                        {getExpenseCategoryLabel(exp.category)}
                      </span>
                      {exp.subcategory && (
                        <span className="block text-xs text-gray-400 mt-0.5">{exp.subcategory}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-900">{exp.description || '-'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(exp.amount)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[150px] truncate">{exp.note || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openModal(exp)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded">
                          <Edit size={14} />
                        </button>
                        <button onClick={() => handleDelete(exp)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-sm font-medium text-gray-600 text-right">Tổng cộng:</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(totalFiltered)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">{editingItem ? 'Sửa chi tiêu' : 'Thêm chi tiêu mới'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Danh mục *</label>
                  <select {...register('category')} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500">
                    {EXPENSE_CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                  {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phân loại</label>
                  <select {...register('subcategory')} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500">
                    <option value="">-- Chọn --</option>
                    {(EXPENSE_SUBCATEGORIES[watchCategory] || []).map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                <input {...register('description')} placeholder="VD: Mua thịt heo, trả tiền điện..." className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Số tiền (₫) *</label>
                  <input type="number" step="1000" min="0" {...register('amount')} placeholder="0" className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500" />
                  {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày *</label>
                  <input type="date" {...register('date')} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500" />
                  {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date.message}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                <textarea {...register('note')} rows={2} placeholder="Ghi chú thêm..." className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500" />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">
                  Hủy
                </button>
                <button type="submit" className="flex items-center px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg">
                  <Save size={16} className="mr-1" />
                  {editingItem ? 'Cập nhật' : 'Thêm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseList;
