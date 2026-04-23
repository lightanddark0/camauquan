import { collection, addDoc, updateDoc, doc, serverTimestamp, getDocs, query, where, increment } from 'firebase/firestore';
import { db } from '../config/firebase';

// Danh mục hàng hóa trong kho
export const INVENTORY_CATEGORIES = [
  { value: 'nguyen_lieu', label: 'Nguyên liệu' },
  { value: 'do_uong', label: 'Đồ uống' },
  { value: 'vat_dung', label: 'Vật dụng' }
];

// Đơn vị tính mặc định
export const DEFAULT_UNITS = ['kg', 'g', 'lít', 'ml', 'cái', 'hộp', 'chai', 'gói', 'lon', 'bó', 'con', 'quả', 'tấm', 'cuộn', 'thùng'];

export const getCategoryLabel = (value) => {
  return INVENTORY_CATEGORIES.find(c => c.value === value)?.label || value;
};

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
};

export const formatNumber = (num) => {
  if (num === null || num === undefined) return '0';
  return new Intl.NumberFormat('vi-VN').format(num);
};

// ── CRUD Inventory Items ──

export const addInventoryItem = async (data) => {
  const docRef = await addDoc(collection(db, 'inventoryItems'), {
    ...data,
    currentStock: data.currentStock || 0,
    minStock: data.minStock || 0,
    costPerUnit: data.costPerUnit || 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
};

export const updateInventoryItem = async (id, data) => {
  await updateDoc(doc(db, 'inventoryItems', id), {
    ...data,
    updatedAt: serverTimestamp()
  });
};

export const deleteInventoryItem = async (id) => {
  const { deleteDoc: delDoc } = await import('firebase/firestore');
  await delDoc(doc(db, 'inventoryItems', id));
};

// ── Stock Transactions ──

export const createStockTransaction = async (data) => {
  const today = new Date();
  const dateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const transaction = {
    inventoryItemId: data.inventoryItemId,
    inventoryItemName: data.inventoryItemName,
    type: data.type, // 'in' | 'out' | 'adjust'
    quantity: data.quantity,
    unitCost: data.unitCost || 0,
    totalCost: data.totalCost || 0,
    reason: data.reason || '',
    billId: data.billId || null,
    date: dateString,
    createdAt: serverTimestamp()
  };

  const docRef = await addDoc(collection(db, 'stockTransactions'), transaction);

  // Cập nhật currentStock
  const stockChange = data.type === 'in' ? data.quantity : -data.quantity;
  await updateDoc(doc(db, 'inventoryItems', data.inventoryItemId), {
    currentStock: increment(stockChange),
    updatedAt: serverTimestamp()
  });

  return docRef.id;
};

// ── Batch stock in (nhập nhiều item 1 lần) ──

export const batchStockIn = async (items) => {
  const results = [];
  for (const item of items) {
    const id = await createStockTransaction({
      ...item,
      type: 'in',
      totalCost: (item.quantity || 0) * (item.unitCost || 0)
    });
    results.push(id);
  }
  return results;
};

// ── Recipes ──

export const addRecipe = async (data) => {
  const docRef = await addDoc(collection(db, 'recipes'), {
    menuItemId: data.menuItemId,
    menuItemName: data.menuItemName,
    ingredients: data.ingredients || [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
};

export const updateRecipe = async (id, data) => {
  await updateDoc(doc(db, 'recipes', id), {
    ...data,
    updatedAt: serverTimestamp()
  });
};

export const deleteRecipe = async (id) => {
  const { deleteDoc: delDoc } = await import('firebase/firestore');
  await delDoc(doc(db, 'recipes', id));
};

// ── Custom Units ──

export const addCustomUnit = async (name) => {
  const docRef = await addDoc(collection(db, 'customUnits'), {
    name,
    createdAt: serverTimestamp()
  });
  return docRef.id;
};

export const deleteCustomUnit = async (id) => {
  const { deleteDoc: delDoc } = await import('firebase/firestore');
  await delDoc(doc(db, 'customUnits', id));
};

// ── Auto-deduct stock khi bán món ──

export const deductStockForBill = async (billId, menuItems, recipes) => {
  // menuItems: array of { menuItemId, quantity } từ bill
  // recipes: array of recipe docs from Firestore
  const deductions = [];

  for (const billItem of menuItems) {
    const itemId = billItem.menuItemId;
    if (!itemId) continue;

    const recipe = recipes.find(r => r.menuItemId === itemId);
    if (!recipe || !recipe.ingredients?.length) continue;

    for (const ingredient of recipe.ingredients) {
      const qty = ingredient.quantity * billItem.quantity;
      deductions.push({
        inventoryItemId: ingredient.inventoryItemId,
        inventoryItemName: ingredient.inventoryItemName,
        type: 'out',
        quantity: qty,
        reason: `Bán món (Bill #${billId})`,
        billId
      });
    }
  }

  for (const d of deductions) {
    await createStockTransaction(d);
  }

  return deductions.length;
};

// ── Deduct stock cho customer order (orderItems → menuItems via parentMenuItemId) ──

export const deductStockForCustomerOrder = async (billId, orderItemsList, allOrderItems, recipes) => {
  // orderItemsList: array of { orderItemId, quantity } từ bill
  // allOrderItems: tất cả orderItems docs (có parentMenuItemId)
  // recipes: tất cả recipe docs
  const deductions = [];

  for (const billItem of orderItemsList) {
    const orderItemDoc = allOrderItems.find(oi => oi.id === billItem.orderItemId);
    if (!orderItemDoc) continue;

    const menuItemId = orderItemDoc.parentMenuItemId;
    if (!menuItemId) continue;

    const recipe = recipes.find(r => r.menuItemId === menuItemId);
    if (!recipe || !recipe.ingredients?.length) continue;

    for (const ingredient of recipe.ingredients) {
      const qty = ingredient.quantity * billItem.quantity;
      deductions.push({
        inventoryItemId: ingredient.inventoryItemId,
        inventoryItemName: ingredient.inventoryItemName,
        type: 'out',
        quantity: qty,
        reason: `Khách đặt món (Bill #${billId})`,
        billId
      });
    }
  }

  for (const d of deductions) {
    await createStockTransaction(d);
  }

  return deductions.length;
};
