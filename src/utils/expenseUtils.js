import { collection, addDoc, updateDoc, doc, serverTimestamp, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';

// ── Danh mục chi tiêu ──

export const EXPENSE_CATEGORIES = [
  { value: 'nhap_hang', label: 'Nhập hàng / Nguyên liệu', color: '#10b981', icon: 'Package' },
  { value: 'van_hanh', label: 'Vận hành', color: '#3b82f6', icon: 'Settings' },
  { value: 'nhan_su', label: 'Nhân sự', color: '#8b5cf6', icon: 'Users' },
  { value: 'khac', label: 'Khác', color: '#f59e0b', icon: 'MoreHorizontal' }
];

// Chi tiết sub-categories gợi ý
export const EXPENSE_SUBCATEGORIES = {
  nhap_hang: ['Nguyên liệu nấu ăn', 'Đồ uống', 'Gia vị', 'Vật dụng nhà bếp', 'Khác'],
  van_hanh: ['Tiền điện', 'Tiền nước', 'Thuê mặt bằng', 'Internet', 'Gas', 'Bảo trì thiết bị', 'Khác'],
  nhan_su: ['Lương nhân viên', 'Thưởng', 'Bảo hiểm', 'Ăn ca', 'Khác'],
  khac: ['Sửa chữa', 'Marketing', 'Giấy phép', 'Vận chuyển', 'Thuế', 'Khác']
};

export const getExpenseCategoryLabel = (value) => {
  return EXPENSE_CATEGORIES.find(c => c.value === value)?.label || value;
};

export const getExpenseCategoryColor = (value) => {
  return EXPENSE_CATEGORIES.find(c => c.value === value)?.color || '#6b7280';
};

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
};

// ── Helpers ngày tháng ──

export const getDateString = (date = new Date()) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const getWeekKey = (dateStr) => {
  const d = new Date(dateStr);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

export const getMonthKey = (dateStr) => {
  return dateStr.substring(0, 7); // "YYYY-MM"
};

// ── CRUD Expenses ──

export const addExpense = async (data) => {
  const dateStr = data.date || getDateString();
  const docRef = await addDoc(collection(db, 'expenses'), {
    category: data.category,
    subcategory: data.subcategory || '',
    description: data.description || '',
    amount: data.amount,
    date: dateStr,
    note: data.note || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
};

export const updateExpense = async (id, data) => {
  await updateDoc(doc(db, 'expenses', id), {
    ...data,
    updatedAt: serverTimestamp()
  });
};

export const deleteExpense = async (id) => {
  const { deleteDoc: delDoc } = await import('firebase/firestore');
  await delDoc(doc(db, 'expenses', id));
};

// ── Query helpers ──

export const getExpensesByDateRange = async (startDate, endDate) => {
  const q = query(
    collection(db, 'expenses'),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const getRevenueByDateRange = async (startDate, endDate) => {
  const q = query(
    collection(db, 'bills'),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    where('status', '==', 'paid'),
    orderBy('date', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// ── Aggregate functions ──

export const aggregateExpensesByCategory = (expenses) => {
  const result = {};
  EXPENSE_CATEGORIES.forEach(cat => {
    result[cat.value] = { ...cat, total: 0, count: 0 };
  });
  expenses.forEach(exp => {
    if (result[exp.category]) {
      result[exp.category].total += exp.amount || 0;
      result[exp.category].count += 1;
    }
  });
  return Object.values(result);
};

export const aggregateByPeriod = (expenses, periodFn) => {
  const groups = {};
  expenses.forEach(exp => {
    const key = periodFn(exp.date);
    if (!groups[key]) groups[key] = { period: key, total: 0, count: 0 };
    groups[key].total += exp.amount || 0;
    groups[key].count += 1;
  });
  return Object.values(groups).sort((a, b) => a.period.localeCompare(b.period));
};

export const buildProfitLossData = (bills, expenses, periodFn) => {
  const groups = {};

  bills.forEach(bill => {
    const key = periodFn(bill.date);
    if (!groups[key]) groups[key] = { period: key, revenue: 0, expense: 0, profit: 0 };
    groups[key].revenue += bill.finalTotal || bill.totalRevenue || 0;
  });

  expenses.forEach(exp => {
    const key = periodFn(exp.date);
    if (!groups[key]) groups[key] = { period: key, revenue: 0, expense: 0, profit: 0 };
    groups[key].expense += exp.amount || 0;
  });

  return Object.values(groups)
    .map(g => ({ ...g, profit: g.revenue - g.expense }))
    .sort((a, b) => a.period.localeCompare(b.period));
};
