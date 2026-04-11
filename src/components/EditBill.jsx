import React, { useState, useEffect, useMemo, useRef } from 'react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useApp } from '../context/AppContext';
import { X, Plus, Minus, Save, Trash2, ShoppingCart, ChevronDown, UtensilsCrossed } from 'lucide-react';
import { toast } from 'react-toastify';
import CustomItemForm from './CustomItemForm';

const CATEGORIES = [
  { id: 'oc', name: 'Ốc', emoji: '🐚' },
  { id: 'hai_san', name: 'Hải sản', emoji: '🦐' },
  { id: 'mon_ca', name: 'Món cá', emoji: '🐟' },
  { id: 'khai_vi', name: 'Khai vị', emoji: '🥟' },
  { id: 'com_mi', name: 'Cơm - Mì', emoji: '🍜' },
  { id: 'mon_thit', name: 'Món thịt', emoji: '🥩' },
  { id: 'lau', name: 'Lẩu', emoji: '🍲' },
  { id: 'mon_them', name: 'Món thêm', emoji: '🥬' },
  { id: 'giai_khat', name: 'Giải khát', emoji: '🍺' },
];

const EditBill = ({ bill, onClose, onUpdated }) => {
  const { menuItems, orderItems: allOrderItems } = useApp();

  // cart: { [orderItemId]: { qty: number, _orig: object|null } }
  // _orig = raw bill item từ Firestore, dùng để giữ nguyên kitchenStatus/completedCount/addedAt khi save
  const [cart, setCart] = useState({});
  // legacyItems: bills tạo bởi staff qua CreateBill (dùng menuItemId, không có orderItemId)
  const [legacyItems, setLegacyItems] = useState([]);
  // customItems: món tự nhập
  const [customItems, setCustomItems] = useState([]);

  const [selectedCategory, setSelectedCategory] = useState('oc');
  const [showMenuSection, setShowMenuSection] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Track các item đã có sẵn trong đơn gốc (để phân biệt với món mới thêm)
  const originalCartIds = useRef(new Set());
  const originalLegacyIds = useRef(new Set());

  // --- Load bill vào state ---
  useEffect(() => {
    if (!bill?.items) return;
    const newCart = {};
    const newLegacy = [];
    const newCustom = [];

    originalCartIds.current = new Set();
    originalLegacyIds.current = new Set();

    bill.items.forEach(item => {
      if (item.orderItemId) {
        newCart[item.orderItemId] = { qty: item.quantity || 1, _orig: item };
        originalCartIds.current.add(item.orderItemId);
      } else if (item.menuItemId) {
        const menuItem = menuItems.find(m => m.id === item.menuItemId);
        newLegacy.push({
          menuItemId: item.menuItemId,
          name: menuItem?.name ?? item.menuItemId,
          quantity: item.quantity || 1,
          menuItem: menuItem ?? null,
        });
        originalLegacyIds.current.add(item.menuItemId);
      } else if (item.customDescription) {
        newCustom.push({
          id: `custom_${Math.random()}`,
          customDescription: item.customDescription,
          customAmount: item.customAmount,
        });
      }
    });

    setCart(newCart);
    setLegacyItems(newLegacy);
    setCustomItems(newCustom);
  }, [bill, menuItems]);

  // --- Group menuItems theo category (thay cho orderItems) ---
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter(m => m.category === selectedCategory);
  }, [menuItems, selectedCategory]);

  // --- Badge count cho category tab ---
  const getCategoryCount = (catId) => {
    const fromLegacy = legacyItems.filter(
      li => li.menuItem?.category === catId && li.quantity > 0
    ).length;
    return fromLegacy;
  };

  // --- Thêm menuItem vào legacyItems ---
  const addMenuItem = (m) => {
    const step = DECIMAL_CATEGORIES.includes(m.category) ? 0.1 : 1;
    setLegacyItems(prev => {
      const existing = prev.find(li => li.menuItemId === m.id);
      if (existing) {
        return prev.map(li =>
          li.menuItemId === m.id
            ? { ...li, quantity: parseFloat((li.quantity + step).toFixed(1)) }
            : li
        );
      }
      return [...prev, { menuItemId: m.id, name: m.name, quantity: step, menuItem: m }];
    });
  };

  // --- Cart handlers ---
  const addToCart = (oi) => {
    setCart(prev => {
      const existing = prev[oi.id];
      return {
        ...prev,
        [oi.id]: { qty: (existing?.qty ?? 0) + 1, _orig: existing?._orig ?? null },
      };
    });
  };

  const updateCartQty = (orderItemId, newQty) => {
    if (newQty <= 0) {
      setCart(prev => { const { [orderItemId]: _, ...rest } = prev; return rest; });
    } else {
      setCart(prev => ({ ...prev, [orderItemId]: { ...prev[orderItemId], qty: newQty } }));
    }
  };

  const DECIMAL_CATEGORIES = ['mon_ca', 'hai_san'];
  const getLegacyStep = (menuItemId) => {
    const item = menuItems.find(m => m.id === menuItemId);
    return item && DECIMAL_CATEGORIES.includes(item.category) ? 0.1 : 1;
  };

  const updateLegacyQty = (menuItemId, newQty, menuItemRef) => {
    const rounded = parseFloat(Math.max(0, newQty).toFixed(1));
    if (rounded <= 0) {
      setLegacyItems(prev => prev.filter(li => li.menuItemId !== menuItemId));
    } else {
      setLegacyItems(prev => {
        const exists = prev.find(li => li.menuItemId === menuItemId);
        if (exists) {
          return prev.map(li => li.menuItemId === menuItemId ? { ...li, quantity: rounded } : li);
        }
        // Item chưa có trong legacyItems → thêm mới
        const m = menuItemRef ?? menuItems.find(mi => mi.id === menuItemId);
        return [...prev, { menuItemId, name: m?.name ?? menuItemId, quantity: rounded, menuItem: m ?? null }];
      });
    }
  };

  const removeCustomItem = (id) =>
    setCustomItems(prev => prev.filter(ci => ci.id !== id));

  const handleAddCustomItem = ({ customDescription, customAmount }) => {
    setCustomItems(prev => [
      ...prev,
      { id: `custom_${Date.now()}_${Math.random()}`, customDescription, customAmount },
    ]);
    toast.success('Đã thêm món khác');
  };

  // --- Tính tổng ---
  const calculateTotals = () => {
    let totalRevenue = 0, totalProfit = 0, totalCost = 0, totalFixedCost = 0;

    // orderItemId items
    Object.entries(cart).forEach(([id, { qty }]) => {
      const oi = allOrderItems.find(o => o.id === id);
      if (!oi) return;
      const parent = oi.parentMenuItemId
        ? menuItems.find(m => m.id === oi.parentMenuItemId)
        : null;
      const price = parent?.price ?? oi.price ?? 0;
      const costPrice = parent?.costPrice ?? 0;
      const fixedCost = parent?.fixedCost ?? 0;
      const tax = parent?.tax ?? 0;
      const revenue = price * qty;
      const taxAmt = revenue * (tax / 100);
      totalRevenue += revenue;
      totalCost += costPrice * qty;
      totalFixedCost += fixedCost * qty;
      totalProfit += (price - costPrice - fixedCost - taxAmt) * qty;
    });

    // legacy menuItemId items
    legacyItems.forEach(({ menuItem, quantity }) => {
      if (!menuItem) return;
      const price = menuItem.price ?? 0;
      const costPrice = menuItem.costPrice ?? 0;
      const fixedCost = menuItem.fixedCost ?? 0;
      const tax = menuItem.tax ?? 0;
      const revenue = price * quantity;
      const taxAmt = revenue * (tax / 100);
      totalRevenue += revenue;
      totalCost += costPrice * quantity;
      totalFixedCost += fixedCost * quantity;
      totalProfit += (price - costPrice - fixedCost - taxAmt) * quantity;
    });

    // custom items
    customItems.forEach(({ customAmount }) => {
      totalRevenue += customAmount;
      totalProfit += customAmount;
    });

    return { totalRevenue, totalProfit, totalCost, totalFixedCost };
  };

  const { totalRevenue, totalProfit, totalCost, totalFixedCost } = calculateTotals();

  const totalItems =
    Object.values(cart).reduce((s, { qty }) => s + qty, 0) +
    legacyItems.reduce((s, li) => s + li.quantity, 0) +
    customItems.length;

  // --- Save ---
  const handleUpdateBill = async () => {
    if (totalItems === 0) {
      toast.error('Vui lòng thêm ít nhất một món vào đơn hàng');
      return;
    }
    setIsSubmitting(true);
    try {
      const addedAt = new Date().toISOString();
      const items = [
        // orderItemId items: spread _orig để giữ nguyên kitchenStatus/completedCount/addedAt
        // Chỉ override quantity theo thay đổi của admin
        // Món mới thêm (không có _orig) → đánh dấu addedAt để kitchen-listener nhận biết và in
        ...Object.entries(cart).map(([id, { qty, _orig }]) =>
          _orig ? { ..._orig, quantity: qty } : { orderItemId: id, quantity: qty, addedAt }
        ),
        // legacy menuItemId items: giữ nguyên format
        // Món mới thêm (không có trong đơn gốc) → đánh dấu addedAt
        ...legacyItems.map(({ menuItemId, quantity }) =>
          originalLegacyIds.current.has(menuItemId)
            ? { menuItemId, quantity }
            : { menuItemId, quantity, addedAt }
        ),
        // custom items
        ...customItems.map(({ customDescription, customAmount }) => ({
          customDescription,
          customAmount,
        })),
      ];

      await updateDoc(doc(db, 'bills', bill.id), {
        items,
        totalRevenue,
        totalProfit,
        totalCost,
        totalFixedCost,
        updatedAt: new Date(),
      });

      toast.success('Cập nhật đơn hàng thành công!');
      onUpdated();
      onClose();
    } catch (error) {
      console.error('Error updating bill:', error);
      toast.error('Có lỗi xảy ra khi cập nhật đơn hàng');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBill = async () => {
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, 'bills', bill.id));
      toast.success('Xóa đơn hàng thành công!');
      onUpdated();
      onClose();
    } catch (error) {
      console.error('Error deleting bill:', error);
      toast.error('Có lỗi xảy ra khi xóa đơn hàng');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('vi-VN');
  };

  // --- Render card cho 1 orderItem trong grid ---
  const renderOrderItemCard = (oi) => {
    const qty = cart[oi.id]?.qty ?? 0;
    const parent = oi.parentMenuItemId
      ? menuItems.find(m => m.id === oi.parentMenuItemId)
      : null;
    const price = parent?.price ?? oi.price ?? 0;
    return (
      <div
        key={oi.id}
        className={`border rounded-lg p-3 transition-shadow hover:shadow-md ${
          qty > 0 ? 'ring-2 ring-indigo-200 bg-indigo-50' : 'bg-white'
        }`}
      >
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <h4 className="font-medium text-gray-900 text-sm">{oi.name}</h4>
            {price > 0 && (
              <p className="text-base font-bold text-indigo-600">{formatCurrency(price)}</p>
            )}
          </div>
          {qty > 0 && (
            <span className="bg-indigo-600 text-white text-xs px-2 py-1 rounded-full ml-2">
              {qty}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {qty > 0 && (
              <button
                onClick={() => updateCartQty(oi.id, qty - 1)}
                className="p-1 hover:bg-gray-200 rounded"
              >
                <Minus size={14} />
              </button>
            )}
            <button
              onClick={() => addToCart(oi)}
              className="bg-indigo-600 text-white px-2 py-1 rounded-md hover:bg-indigo-700 text-xs"
            >
              <Plus size={14} />
            </button>
          </div>
          {qty > 0 && (
            <button
              onClick={() => updateCartQty(oi.id, 0)}
              className="text-red-600 hover:text-red-800 text-xs"
            >
              Xóa
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl my-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">
              Chỉnh sửa đơn hàng #{bill.id.slice(-6)}
            </h2>
            <p className="text-xs sm:text-sm text-gray-600">
              Tạo lúc: {formatTime(bill.createdAt)}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X size={20} />
          </button>
        </div>

        {/* Main Content */}
        <div className="p-4 sm:p-6 max-h-[80vh] overflow-y-auto">

          {/* Menu Section */}
          <div className="mb-8">
            <button
              onClick={() => setShowMenuSection(prev => !prev)}
              className="w-full flex items-center justify-between p-3 rounded-lg border border-dashed border-indigo-300 hover:bg-indigo-50 transition-colors group"
            >
              <span className="flex items-center gap-2 text-indigo-700 font-semibold text-base">
                <UtensilsCrossed size={18} />
                Thêm / Sửa món từ thực đơn
              </span>
              <ChevronDown
                size={18}
                className={`text-indigo-500 transition-transform duration-200 ${showMenuSection ? 'rotate-180' : ''}`}
              />
            </button>

            {showMenuSection && (
            <div className="mt-4">

            {/* Category Tabs */}
            <div className="border-b border-gray-200 mb-6">
              <nav className="-mb-px flex space-x-8 overflow-x-auto">
                {CATEGORIES.map(cat => {
                  const count = getCategoryCount(cat.id);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                        selectedCategory === cat.id
                          ? 'border-indigo-500 text-indigo-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <span>{cat.emoji}</span>
                      <span>{cat.name}</span>
                      {count > 0 && (
                        <span className={`inline-flex items-center justify-center w-5 h-5 text-xs rounded-full ${
                          selectedCategory === cat.id
                            ? 'bg-indigo-100 text-indigo-600'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* MenuItem List */}
            {filteredMenuItems.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-base font-medium text-gray-900">Không có món ăn nào</p>
                <p className="text-sm text-gray-600">Danh mục này chưa có món ăn nào</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredMenuItems.map(m => {
                  const legacyItem = legacyItems.find(li => li.menuItemId === m.id);
                  const qty = legacyItem?.quantity ?? 0;
                  const step = DECIMAL_CATEGORIES.includes(m.category) ? 0.1 : 1;
                  const isDecimal = step < 1;
                  const displayValue = isDecimal ? Number(qty).toFixed(1) : qty;
                  return (
                    <div key={m.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{m.name}</h3>
                        {m.price > 0 && <p className="text-indigo-600 font-medium">{formatCurrency(m.price)}</p>}
                      </div>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => updateLegacyQty(m.id, qty - step, m)}
                          disabled={qty === 0}
                          className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                        >
                          <Minus size={16} />
                        </button>
                        <input
                          type="number"
                          value={displayValue}
                          step={step}
                          min="0"
                          onChange={(e) => {
                            const raw = isDecimal ? parseFloat(e.target.value) : parseInt(e.target.value);
                            updateLegacyQty(m.id, parseFloat(Math.max(0, raw || 0).toFixed(1)), m);
                          }}
                          className="w-16 text-center border rounded-md py-1 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        <button
                          onClick={() => updateLegacyQty(m.id, qty + step, m)}
                          className="w-8 h-8 rounded-full bg-indigo-100 hover:bg-indigo-200 flex items-center justify-center transition-colors"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-6">
              <CustomItemForm onAdd={handleAddCustomItem} />
            </div>

            </div>
            )}
          </div>

          {/* Order Summary */}
          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base sm:text-lg font-semibold">Đơn hàng</h3>
              <ShoppingCart size={18} />
            </div>

            {totalItems === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Chưa có món nào</p>
              </div>
            ) : (
              <div className="space-y-4 mb-6">
                {/* orderItemId items */}
                {Object.entries(cart).map(([id, { qty }]) => {
                  const oi = allOrderItems.find(o => o.id === id);
                  const parent = oi?.parentMenuItemId
                    ? menuItems.find(m => m.id === oi.parentMenuItemId)
                    : null;
                  const price = parent?.price ?? oi?.price ?? 0;
                  const name = oi?.name ?? `Món ID: ${id}`;
                  return (
                    <div key={id} className="bg-gray-50 rounded-lg p-5 border">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-semibold text-gray-900 text-lg">{name}</h4>
                        <button
                          onClick={() => updateCartQty(id, 0)}
                          className="text-red-600 hover:text-red-800 ml-3 p-1 hover:bg-red-50 rounded-full"
                        >
                          <X size={20} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <button
                            onClick={() => updateCartQty(id, qty - 1)}
                            className="p-3 hover:bg-gray-200 rounded-full bg-white border"
                          >
                            <Minus size={20} />
                          </button>
                          <span className="w-16 text-center text-xl font-bold">{qty}</span>
                          <button
                            onClick={() => updateCartQty(id, qty + 1)}
                            className="p-3 hover:bg-gray-200 rounded-full bg-white border"
                          >
                            <Plus size={20} />
                          </button>
                        </div>
                        <div className="text-right">
                          <div className="text-base text-gray-600">
                            {formatCurrency(price)} x {qty}
                          </div>
                          <div className="font-bold text-xl text-green-600">
                            {formatCurrency(price * qty)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Legacy menuItemId items (thêm bởi nhân viên qua CreateBill) */}
                {legacyItems.map(({ menuItemId, name, quantity, menuItem }) => (
                  <div key={menuItemId} className="bg-yellow-50 rounded-lg p-5 border border-yellow-200">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-semibold text-gray-900 text-lg">{name}</h4>
                        <span className="inline-block mt-1 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                          Thêm bởi nhân viên
                        </span>
                      </div>
                      <button
                        onClick={() => updateLegacyQty(menuItemId, 0)}
                        className="text-red-600 hover:text-red-800 ml-3 p-1 hover:bg-red-50 rounded-full"
                      >
                        <X size={20} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <button
                          onClick={() => updateLegacyQty(menuItemId, quantity - getLegacyStep(menuItemId))}
                          className="p-3 hover:bg-gray-200 rounded-full bg-white border"
                        >
                          <Minus size={20} />
                        </button>
                        <span className="w-16 text-center text-xl font-bold">
                          {DECIMAL_CATEGORIES.includes(menuItem?.category) ? Number(quantity).toFixed(1) : quantity}
                        </span>
                        <button
                          onClick={() => updateLegacyQty(menuItemId, quantity + getLegacyStep(menuItemId))}
                          className="p-3 hover:bg-gray-200 rounded-full bg-white border"
                        >
                          <Plus size={20} />
                        </button>
                      </div>
                      <div className="text-right">
                        <div className="text-base text-gray-600">
                          {formatCurrency(menuItem?.price ?? 0)} x {DECIMAL_CATEGORIES.includes(menuItem?.category) ? Number(quantity).toFixed(1) : quantity}
                        </div>
                        <div className="font-bold text-xl text-green-600">
                          {formatCurrency((menuItem?.price ?? 0) * quantity)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Custom items */}
                {customItems.map(({ id, customDescription, customAmount }) => (
                  <div key={id} className="bg-blue-50 rounded-lg p-5 border border-blue-200">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-semibold text-gray-900 text-lg">{customDescription}</h4>
                        <span className="inline-block mt-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                          Món khác
                        </span>
                      </div>
                      <button
                        onClick={() => removeCustomItem(id)}
                        className="text-red-600 hover:text-red-800 ml-3 p-1 hover:bg-red-50 rounded-full"
                      >
                        <X size={20} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">Không thể thay đổi số lượng</div>
                      <div
                        className={`font-bold text-xl ${
                          customAmount >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {customAmount >= 0 ? '+' : ''}{formatCurrency(customAmount)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Summary */}
            <div className="border-t pt-6 mb-8 bg-white rounded-lg p-6 border">
              <div className="flex justify-between items-center">
                <span className="text-2xl font-semibold text-gray-900">Tổng cộng:</span>
                <span className="text-3xl font-bold text-green-600">
                  {formatCurrency(totalRevenue)}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-4">
              <button
                onClick={handleUpdateBill}
                disabled={isSubmitting || totalItems === 0}
                className="w-full bg-indigo-600 text-white py-5 px-6 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 font-semibold text-xl"
              >
                {isSubmitting ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                ) : (
                  <Save size={24} />
                )}
                {isSubmitting ? 'Đang cập nhật...' : 'Cập nhật đơn hàng'}
              </button>

              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full bg-red-600 text-white py-4 px-6 rounded-lg hover:bg-red-700 flex items-center justify-center gap-3 font-semibold text-lg"
              >
                <Trash2 size={20} />
                Xóa đơn hàng
              </button>
            </div>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">Xác nhận xóa</h3>
              <p className="text-gray-600 mb-6">
                Bạn có chắc chắn muốn xóa đơn hàng này? Hành động này không thể hoàn tác.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleDeleteBill}
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300"
                >
                  {isSubmitting ? 'Đang xóa...' : 'Xóa'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EditBill;
