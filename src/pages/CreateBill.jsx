import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useApp } from '../context/AppContext';
import { toast } from 'react-toastify';
import CustomerPageModal from '../components/CustomerPageModal';
import { Plus, Minus, ShoppingCart, Calculator, ExternalLink, Search, ArrowLeft, X } from 'lucide-react';
import { VoiceOrderButton } from '../components/VoiceOrderButton';
import { getVoiceOrderMetrics } from '../utils/voiceOrderMetrics';

const CreateBill = () => {
  const { menuItems, tables } = useApp();
  const { tableNumber } = useParams();
  const navigate = useNavigate();
  const [quantities, setQuantities] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [showCustomerOrderModal, setShowCustomerOrderModal] = useState(false);
  const [bills, setBills] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const searchInputRef = useRef(null);

  // Custom items (món khác) cho CreateBill
  const [customItems, setCustomItems] = useState([]);

  // Set menuItemId vừa thêm từ voice – dùng để emit metric 7 khi user gỡ món
  const voiceAddedIdsRef = useRef(new Set());

  // Tính toán tổng bill
  const billSummary = useMemo(() => {
    let totalRevenue = 0;
    let totalProfit = 0;
    let totalCost = 0;
    let totalFixedCost = 0;
    let totalItems = 0;

    const items = [];

    Object.entries(quantities).forEach(([menuItemId, quantity]) => {
      if (quantity > 0) {
        const menuItem = menuItems.find(item => item.id === menuItemId);
        if (menuItem) {
          const itemRevenue = menuItem.price * quantity;
          const taxAmount = itemRevenue * (menuItem.tax / 100);
          const profitPerItem = menuItem.price - menuItem.costPrice - menuItem.fixedCost - (menuItem.price * menuItem.tax / 100);
          const itemProfit = profitPerItem * quantity;

          totalRevenue += itemRevenue;
          totalProfit += itemProfit;
          totalCost += (menuItem.costPrice || 0) * quantity;
          totalFixedCost += (menuItem.fixedCost || 0) * quantity;
          totalItems += quantity;

          items.push({
            menuItemId,
            quantity,
            name: menuItem.name,
            price: menuItem.price,
            revenue: itemRevenue,
            profit: itemProfit
          });
        }
      }
    });

    return {
      items,
      totalRevenue,
      totalProfit,
      totalCost,
      totalFixedCost,
      totalItems
    };
  }, [quantities, menuItems]);

  // Tổng tiền cho custom items
  const customTotals = useMemo(() => {
    let totalRevenue = 0;
    let totalProfit = 0;

    customItems.forEach(item => {
      totalRevenue += item.customAmount;
      totalProfit += item.customAmount;
    });

    return { totalRevenue, totalProfit, totalCost: 0, totalFixedCost: 0 };
  }, [customItems]);

  const totalRevenueWithCustom = billSummary.totalRevenue + customTotals.totalRevenue;
  const totalProfitWithCustom = billSummary.totalProfit + customTotals.totalProfit;
  const totalCostWithCustom = billSummary.totalCost + customTotals.totalCost;
  const totalFixedCostWithCustom = billSummary.totalFixedCost + customTotals.totalFixedCost;

  const DECIMAL_CATEGORIES = ['mon_ca', 'hai_san'];
  const getStep = (category) => DECIMAL_CATEGORIES.includes(category) ? 0.05 : 1;

  const handleQuantityChange = (menuItemId, change, step = 1) => {
    const currentQuantity = quantities[menuItemId] || 0;
    const newQuantity = parseFloat(Math.max(0, currentQuantity + change).toFixed(2));
    if (newQuantity === 0 && voiceAddedIdsRef.current.has(menuItemId)) {
      getVoiceOrderMetrics().recordUserRemovedVoiceItem(menuItemId);
      voiceAddedIdsRef.current.delete(menuItemId);
    }
    setQuantities(prev => {
      if (newQuantity === 0) {
        const { [menuItemId]: removed, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [menuItemId]: newQuantity
      };
    });
  };

  const setQuantityDirectly = (menuItemId, value, isDecimal = false) => {
    const raw = isDecimal ? parseFloat(value) : parseInt(value);
    const quantity = parseFloat(Math.max(0, raw || 0).toFixed(2));
    if (quantity === 0 && voiceAddedIdsRef.current.has(menuItemId)) {
      getVoiceOrderMetrics().recordUserRemovedVoiceItem(menuItemId);
      voiceAddedIdsRef.current.delete(menuItemId);
    }
    if (quantity === 0) {
      setQuantities(prev => {
        const { [menuItemId]: removed, ...rest } = prev;
        return rest;
      });
    } else {
      setQuantities(prev => ({
        ...prev,
        [menuItemId]: quantity
      }));
    }
  };

  const handleSubmit = async () => {
    if (billSummary.totalItems === 0 && customItems.length === 0) {
      toast.error('Vui lòng chọn ít nhất một món');
      return;
    }

    if (!tableNumber) {
      toast.error('Không xác định được số bàn');
      return;
    }

    setIsSubmitting(true);

    try {
      const today = new Date();
      const dateString = today.toISOString().split('T')[0];

      const newMenuItems = billSummary.items.map(item => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity
      }));
      const newCustomItems = customItems.map(item => ({
        customDescription: item.customDescription,
        customAmount: item.customAmount
      }));

      // Tìm đơn pending đang mở cho bàn này hôm nay
      const existingBill = bills.find(
        b => b.status === 'pending' && !b.isTakeaway && b.tableNumber === parseInt(tableNumber)
      );

      if (existingBill) {
        // Merge items vào đơn cũ
        // addedAt phải được gắn để kitchen-listener nhận ra món mới và in
        const addedAt = new Date().toISOString();
        const mergedItems = [...(existingBill.items || [])];

        newMenuItems.forEach(newItem => {
          const idx = mergedItems.findIndex(
            ex => ex.menuItemId && ex.menuItemId === newItem.menuItemId
          );
          if (idx >= 0) {
            const addedQty = newItem.quantity;
            mergedItems[idx] = {
              ...mergedItems[idx],
              quantity: parseFloat((mergedItems[idx].quantity + addedQty).toFixed(2)),
              addedQty,      // delta — kitchen-listener dùng để in đúng số lượng
              addedAt,       // timestamp — kitchen-listener dùng để phân biệt mới/cũ
              kitchenStatus: 'cooking',
            };
          } else {
            mergedItems.push({ ...newItem, addedAt });
          }
        });

        // Custom items luôn append
        newCustomItems.forEach(c => mergedItems.push({ ...c, addedAt }));

        // Tính lại tổng từ merged items
        let totalRevenue = existingBill.totalRevenue || 0;
        let totalProfit = existingBill.totalProfit || 0;
        let totalCost = existingBill.totalCost || 0;
        let totalFixedCost = existingBill.totalFixedCost || 0;

        totalRevenue += totalRevenueWithCustom;
        totalProfit += totalProfitWithCustom;
        totalCost += totalCostWithCustom;
        totalFixedCost += totalFixedCostWithCustom;

        await updateDoc(doc(db, 'bills', existingBill.id), {
          items: mergedItems,
          totalRevenue,
          totalProfit,
          totalCost,
          totalFixedCost
        });

        toast.success('Đã thêm món vào đơn hiện tại!');
      } else {
        // Tạo đơn mới
        await addDoc(collection(db, 'bills'), {
          createdAt: serverTimestamp(),
          date: dateString,
          tableNumber: parseInt(tableNumber),
          status: 'pending',
          items: [...newMenuItems, ...newCustomItems],
          totalRevenue: totalRevenueWithCustom,
          totalProfit: totalProfitWithCustom,
          totalCost: totalCostWithCustom,
          totalFixedCost: totalFixedCostWithCustom
        });

        toast.success('Tạo đơn hàng thành công!');
      }

      // Reset form
      setQuantities({});
      setCustomItems([]);
      setSearchText('');
      setCustomItemPrice('');
      navigate('/');
    } catch (error) {
      console.error('Error creating/updating bill:', error);
      toast.error('Có lỗi xảy ra khi lưu đơn hàng');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
  };

  // Load bills from Firestore
  useEffect(() => {
    const q = query(
      collection(db, 'bills'),
      where('date', '==', selectedDate),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const billsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sắp xếp: đơn chưa thanh toán lên đầu, giữ nguyên logic thời gian trong mỗi nhóm
      const sortedBills = billsData.sort((a, b) => {
        // Kiểm tra trạng thái thanh toán
        const aIsPending = !a.status || a.status === 'pending';
        const bIsPending = !b.status || b.status === 'pending';
        
        // Nếu một đơn pending và một đơn đã thanh toán, đưa pending lên đầu
        if (aIsPending && !bIsPending) return -1;
        if (!aIsPending && bIsPending) return 1;
        
        // Nếu cùng trạng thái, sắp xếp theo thời gian (mới nhất lên đầu)
        const timeA = a.createdAt?.toDate?.() || new Date(a.createdAt);
        const timeB = b.createdAt?.toDate?.() || new Date(b.createdAt);
        return timeB - timeA;
      });
      
      setBills(sortedBills);
    }, (error) => {
      console.error('Error loading bills:', error);
    });

    return () => unsubscribe();
  }, [selectedDate]);

  const handleOpenPublicBill = (billTableNumber) => {
    window.open(`/bill/${billTableNumber}`, '_blank');
    setShowCustomerOrderModal(false);
  };

  const handleVoiceItemsMatched = (matchedItems) => {
    matchedItems.forEach(item => voiceAddedIdsRef.current.add(item.menuItemId));
    // Ghi đè (không cộng dồn) - theo yêu cầu
    setQuantities(prev => {
      const newQuantities = { ...prev };
      matchedItems.forEach(item => {
        // Ghi đè số lượng mới (không cộng với số cũ)
        newQuantities[item.menuItemId] = item.quantity;
      });
      return newQuantities;
    });
  };

  const getActiveTables = () => {
    // Chỉ lấy bàn thật trong stat card (loại ảo 9000+)
    const activeTables = new Set();
    bills.filter(bill => bill.status === 'pending' && !bill.isTakeaway).forEach(bill => {
      if (bill.tableNumber) activeTables.add(bill.tableNumber);
    });
    
    return Array.from(activeTables).sort((a, b) => a - b);
  };

  const getActiveBills = () =>
    bills
      .filter(bill => bill.status === 'pending')
      .sort((a, b) => {
        if (a.isTakeaway !== b.isTakeaway) return a.isTakeaway ? 1 : -1;
        return (a.isTakeaway ? a.takeawayNumber : a.tableNumber) -
               (b.isTakeaway ? b.takeawayNumber : b.tableNumber);
      });

  // Filter menu items by search text
  const filteredMenuItems = useMemo(() => {
    const trimmed = searchText.trim().toLowerCase();
    if (!trimmed) return menuItems;
    return menuItems.filter(item =>
      item.name?.toLowerCase().includes(trimmed)
    );
  }, [menuItems, searchText]);

  // Handle adding custom item from search bar
  const handleAddCustomFromSearch = () => {
    const name = searchText.trim();
    const price = parseFloat(customItemPrice);
    if (!name || isNaN(price)) return;

    const newCustomItem = {
      id: `custom_${Date.now()}_${Math.random()}`,
      customDescription: name,
      customAmount: price
    };
    setCustomItems(prev => [...prev, newCustomItem]);
    setCustomItemPrice('');
    setSearchText('');
    toast.success(`Đã thêm "${name}"`);
  };

  if (menuItems.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Chưa có món nào trong menu
          </h2>
          <p className="text-gray-600 mb-4">
            Vui lòng thêm các món ăn vào menu trước khi tạo đơn hàng
          </p>
          <a
            href="/menu"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Quản lý menu
          </a>
        </div>
      </div>
    );
  }

  const hasCart = billSummary.totalItems > 0 || customItems.length > 0;
  const searchTrimmed = searchText.trim();

  return (
    <div className="max-w-2xl mx-auto pb-10">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border mb-4 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
              title="Quay lại chọn bàn"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Bàn {tableNumber}</h1>
              <p className="text-xs text-gray-400">Thêm món vào đơn hàng</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Voice Order Button */}
            <VoiceOrderButton
              menuItems={menuItems}
              currentCategory="all"
              onItemsMatched={handleVoiceItemsMatched}
            />
            <button
              onClick={() => setShowCustomerOrderModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
              title="Mở trang khách hàng"
            >
              <ExternalLink size={15} />
              <span className="hidden sm:inline">Trang khách</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-sm border mb-4 p-4">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="Tìm kiếm món ăn..."
            className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent text-base"
          />
          {searchText && (
            <button
              onClick={() => { setSearchText(''); setCustomItemPrice(''); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Menu items list */}
        <div className="mt-3 space-y-2 max-h-[60vh] overflow-y-auto">
          {filteredMenuItems.length === 0 && !searchTrimmed && (
            <p className="text-center text-gray-400 py-6 text-sm">Không có món nào</p>
          )}

          {filteredMenuItems.length === 0 && searchTrimmed && (
            <p className="text-center text-gray-400 py-4 text-sm">
              Không tìm thấy "{searchTrimmed}"
            </p>
          )}

          {filteredMenuItems.map((item) => {
            const quantity = quantities[item.id] || 0;
            const step = getStep(item.category);
            const isDecimal = step < 1;
            const displayValue = isDecimal ? (quantity > 0 ? quantity.toFixed(2) : '0.00') : quantity;

            return (
              <div
                key={item.id}
                className={`flex items-center justify-between px-3 py-3 rounded-lg border transition-colors ${
                  quantity > 0
                    ? 'border-indigo-200 bg-indigo-50'
                    : 'border-gray-100 bg-gray-50'
                }`}
              >
                <div className="flex-1 min-w-0 mr-3">
                  <p className="font-medium text-gray-900 text-sm truncate">{item.name}</p>
                  <p className="text-indigo-600 text-sm font-semibold">{formatCurrency(item.price)}</p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleQuantityChange(item.id, -step, step)}
                    disabled={quantity === 0}
                    className="w-8 h-8 rounded-full bg-white border border-gray-200 hover:bg-gray-100 flex items-center justify-center transition-colors disabled:opacity-30"
                  >
                    <Minus size={14} />
                  </button>

                  <input
                    type="number"
                    value={displayValue}
                    onChange={e => setQuantityDirectly(item.id, e.target.value, isDecimal)}
                    className="w-12 text-center border border-gray-200 rounded-md py-1 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                    min="0"
                    step={step}
                  />

                  <button
                    onClick={() => handleQuantityChange(item.id, step, step)}
                    className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Inline custom item from search */}
        {searchTrimmed && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm font-medium text-amber-800 mb-2">
              Thêm "<span className="font-bold">{searchTrimmed}</span>" làm món mới
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                value={customItemPrice}
                onChange={e => setCustomItemPrice(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddCustomFromSearch()}
                placeholder="Giá tiền (VND)"
                className="flex-1 px-3 py-2 border border-amber-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
              />
              <button
                onClick={handleAddCustomFromSearch}
                disabled={!customItemPrice || isNaN(parseFloat(customItemPrice))}
                className="px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium flex items-center gap-1 transition-colors"
              >
                <Plus size={14} />
                Thêm
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cart / Bill Summary */}
      {hasCart && (
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-2 mb-4">
            <Calculator className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-gray-900">Đơn hàng</h2>
            <span className="ml-auto text-xs text-gray-400">
              {billSummary.totalItems > 0 && `${billSummary.totalItems} món`}
              {billSummary.totalItems > 0 && customItems.length > 0 && ' + '}
              {customItems.length > 0 && `${customItems.length} món khác`}
            </span>
          </div>

          <div className="space-y-2 mb-4">
            {billSummary.items.map(item => (
              <div key={item.menuItemId} className="flex justify-between text-sm">
                <span className="text-gray-600 truncate mr-2">
                  {item.name} ×{item.quantity}
                </span>
                <span className="font-medium flex-shrink-0">{formatCurrency(item.revenue)}</span>
              </div>
            ))}

            {customItems.map(item => (
              <div key={item.id} className="flex justify-between text-sm items-center">
                <span className="text-gray-600 truncate mr-2">{item.customDescription}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`font-medium ${item.customAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {item.customAmount >= 0 ? '+' : ''}{formatCurrency(item.customAmount)}
                  </span>
                  <button
                    onClick={() => setCustomItems(prev => prev.filter(c => c.id !== item.id))}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t pt-3 space-y-1 mb-4">
            <div className="flex justify-between font-bold text-base">
              <span>Tổng cộng:</span>
              <span className="text-indigo-600">{formatCurrency(totalRevenueWithCustom)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Lợi nhuận dự kiến:</span>
              <span className="text-green-600 font-medium">{formatCurrency(totalProfitWithCustom)}</span>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Đang xử lý...
              </>
            ) : (
              <>
                <ShoppingCart size={18} />
                Tạo đơn — Bàn {tableNumber}
              </>
            )}
          </button>
        </div>
      )}

      {/* Customer Order Modal */}
      {showCustomerOrderModal && (
        <CustomerPageModal
          activeBills={getActiveBills()}
          tables={tables || []}
          onClose={() => setShowCustomerOrderModal(false)}
          onSelect={handleOpenPublicBill}
        />
      )}
    </div>
  );
};

export default CreateBill;
