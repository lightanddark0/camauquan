import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { toast } from 'react-toastify';
import { Plus, Minus, ChevronDown, ChevronUp, MessageSquare, X, ShoppingCart, Search } from 'lucide-react';
import { submitCustomerOrder, testFirestoreConnection, getActiveBillForTable } from '../utils/customerOrder';
import { calculateOrderItemTotals } from '../utils/billCalculations';
import { printKitchenTickets } from '../utils/kitchenPrint';

const CATEGORIES = [
  { value: 'oc', label: 'Ốc' },
  { value: 'hai_san', label: 'Hải sản' },
  { value: 'mon_ca', label: 'Món cá' },
  { value: 'khai_vi', label: 'Khai vị' },
  { value: 'com_mi', label: 'Cơm - Mì' },
  { value: 'mon_thit', label: 'Món thịt' },
  { value: 'lau', label: 'Lẩu' },
  { value: 'mon_them', label: 'Món thêm' },
  { value: 'giai_khat', label: 'Giải khát' },
];

const formatCurrency = (amount) =>
  new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';

// ── Skeleton ──────────────────────────────────
const SkeletonCard = () => (
  <div className="space-y-5 animate-pulse">
    <div className="h-4 w-1/4 bg-white/50 rounded" />
    <div className="grid grid-cols-2 gap-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="space-y-2">
          <div className="aspect-square bg-white/50 rounded-2xl" />
          <div className="h-3 w-3/4 bg-white/50 rounded" />
          <div className="h-3 w-1/2 bg-white/50 rounded" />
        </div>
      ))}
    </div>
  </div>
);

// ── Confirm modal (bottom sheet, swipe-down to close) ──
const SWIPE_CLOSE_THRESHOLD = 80;

const ConfirmModal = ({ items, customItems, note, totalRevenue, onConfirm, onCancel, isSubmitting }) => {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(null);

  const handleTouchStart = (e) => {
    startYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (startYRef.current === null) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta > 0) setDragY(delta); // chỉ cho kéo xuống
  };

  const handleTouchEnd = () => {
    if (dragY >= SWIPE_CLOSE_THRESHOLD && !isSubmitting) {
      onCancel();
    } else {
      setDragY(0);
    }
    setIsDragging(false);
    startYRef.current = null;
  };

  const opacity = Math.max(0.15, 0.4 - (dragY / 400));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" style={{ opacity: opacity / 0.4 }} />
      <div
        className="relative bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[80vh] flex flex-col"
        style={{
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? 'none' : 'transform 300ms cubic-bezier(0.32,0.72,0,1)',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className={`w-10 h-1 rounded-full transition-colors ${dragY > 40 ? 'bg-indigo-400' : 'bg-gray-300'}`} />
        </div>

        <div className="px-5 pt-3 pb-2 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900">Xác nhận đặt món</h2>
          <button onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-2 flex-1">
          <ul className="divide-y divide-gray-100">
            {items.map((item) => (
              <li key={item.orderItemId} className="py-2.5 flex justify-between items-center text-sm">
                <span className="text-gray-800 font-medium">
                  {item.name}
                  <span className="ml-1 text-gray-400 font-normal">×{item.quantity}</span>
                </span>
                <span className="text-indigo-600 font-semibold">{formatCurrency(item.revenue)}</span>
              </li>
            ))}
            {customItems?.map((item) => (
              <li key={item.id} className="py-2.5 flex justify-between items-center text-sm">
                <span className="text-gray-800 font-medium">
                  {item.customDescription}
                  <span className="ml-1 text-gray-400 font-normal">×1</span>
                </span>
                <span className="text-amber-600 font-semibold">{formatCurrency(item.customAmount)}</span>
              </li>
            ))}
          </ul>
          {note?.trim() && (
            <div className="mt-3 bg-amber-50 rounded-xl p-3 text-sm text-amber-800">
              <span className="font-medium">Ghi chú: </span>{note}
            </div>
          )}
        </div>

        <div className="px-5 pt-3 pb-6 border-t border-gray-100 space-y-3">
          <div className="flex justify-between text-base font-bold text-gray-900">
            <span>Tổng cộng</span>
            <span className="text-indigo-600">{formatCurrency(totalRevenue)}</span>
          </div>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> Đang gửi...</>
            ) : 'Xác nhận đặt món'}
          </button>
          <button onClick={onCancel} disabled={isSubmitting} className="w-full text-gray-500 text-sm font-medium py-1.5">
            Hủy, sửa lại
          </button>
        </div>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────
const CustomerOrder = () => {
  const { tableNumber } = useParams();
  const navigate = useNavigate();

  // Bàn ảo cho mang về: tableNumber >= 9000
  const isTakeawayTable = Number(tableNumber) >= 9000;

  const [orderItems, setOrderItems] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [customItems, setCustomItems] = useState([]); // { id, customDescription, customAmount }
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [loadingOrderItems, setLoadingOrderItems] = useState(true);
  const [loadingMenuItems, setLoadingMenuItems] = useState(true);
  const [loadingExistingBill, setLoadingExistingBill] = useState(true);

  const [existingBill, setExistingBill] = useState(null);

  const [note, setNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [cartOpen, setCartOpen] = useState(false);

  // ── Khoá scroll body khi modal mở ──
  useEffect(() => {
    document.body.style.overflow = showConfirmModal ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showConfirmModal]);

  // ── Scrollspy refs ──
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].value);
  const headerRef = useRef(null);
  const tabsContainerRef = useRef(null);
  const sectionRefs = useRef({});
  const isSearching = searchText.trim().length > 0;

  const isLoading = loadingOrderItems || loadingMenuItems;

  // ── Load orderItems ──
  useEffect(() => {
    const q = query(collection(db, 'orderItems'), orderBy('category'), orderBy('name'));
    const unsub = onSnapshot(
      q,
      (snap) => { setOrderItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoadingOrderItems(false); },
      (err) => { console.error(err); toast.error('Không thể tải menu. Vui lòng thử lại!'); setLoadingOrderItems(false); }
    );
    return () => unsub();
  }, []);

  // ── Load menuItems ──
  useEffect(() => {
    const q = query(collection(db, 'menuItems'), orderBy('category'), orderBy('name'));
    const unsub = onSnapshot(
      q,
      (snap) => { setMenuItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoadingMenuItems(false); },
      (err) => { console.error(err); toast.error('Không thể tải thông tin giá. Vui lòng thử lại!'); setLoadingMenuItems(false); }
    );
    return () => unsub();
  }, []);

  // ── Load đơn hiện tại của bàn ──
  useEffect(() => {
    if (!tableNumber) { setLoadingExistingBill(false); return; }
    getActiveBillForTable(tableNumber)
      .then((bill) => { setExistingBill(bill); })
      .catch((err) => console.error(err))
      .finally(() => setLoadingExistingBill(false));
  }, [tableNumber]);

  // ── Scrollspy ──
  useEffect(() => {
    if (isSearching) return;
    const hasSections = CATEGORIES.some((cat) => sectionRefs.current[cat.value]);
    if (!hasSections) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (intersecting.length > 0) {
          const cat = intersecting[0].target.getAttribute('data-category');
          if (cat) setActiveCategory(cat);
        }
      },
      {
        rootMargin: '-130px 0px -55% 0px',
        threshold: 0,
      }
    );

    CATEGORIES.forEach((cat) => {
      const el = sectionRefs.current[cat.value];
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [orderItems, isLoading]);

  // ── Auto-scroll tab đang active vào vùng nhìn thấy ──
  useEffect(() => {
    const container = tabsContainerRef.current;
    if (!container) return;
    const activeTab = container.querySelector(`[data-tab="${activeCategory}"]`);
    if (!activeTab) return;
    const cRect = container.getBoundingClientRect();
    const tRect = activeTab.getBoundingClientRect();
    const scrollLeft = container.scrollLeft + tRect.left - cRect.left - cRect.width / 2 + tRect.width / 2;
    container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
  }, [activeCategory]);

  // ── Click tab → cuộn tới section ──
  const scrollToCategory = useCallback((catValue) => {
    const el = sectionRefs.current[catValue];
    if (!el) return;
    const headerHeight = headerRef.current?.offsetHeight ?? 120;
    const top = el.getBoundingClientRect().top + window.scrollY - headerHeight - 8;
    window.scrollTo({ top, behavior: 'smooth' });
  }, []);

  // ── Tính summary ──
  const summary = useMemo(() => {
    let totalRevenue = 0,
      totalProfit = 0,
      totalCost = 0,
      totalFixedCost = 0,
      totalItems = 0;
    const items = [],
      invalidItems = [];

    Object.entries(quantities).forEach(([orderItemId, qty]) => {
      if (qty <= 0) return;
      const oi = orderItems.find((i) => i.id === orderItemId);
      if (!oi) return;
      const pm = menuItems.find((m) => m.id === oi.parentMenuItemId);
      const totals = calculateOrderItemTotals(oi, pm, qty);
      if (totals.valid) {
        totalRevenue += totals.revenue;
        totalProfit += totals.profit;
        totalCost += totals.cost;
        totalFixedCost += totals.fixedCost;
        totalItems += qty;
        items.push({ orderItemId, quantity: qty, name: oi.name, price: totals.price, revenue: totals.revenue });
      } else {
        invalidItems.push(oi.name);
      }
    });
    return {
      items,
      totalRevenue,
      totalProfit,
      totalCost,
      totalFixedCost,
      totalItems,
      invalidItems,
    };
  }, [quantities, orderItems, menuItems]);

  const handleQuantityChange = useCallback((orderItemId, change) => {
    setQuantities((prev) => {
      const next = Math.max(0, (prev[orderItemId] || 0) + change);
      if (next === 0) { const { [orderItemId]: _, ...rest } = prev; return rest; }
      return { ...prev, [orderItemId]: next };
    });
  }, []);

  const customTotal = useMemo(() =>
    customItems.reduce((s, i) => s + i.customAmount, 0), [customItems]);

  const grandTotal = summary.totalRevenue + customTotal;
  const grandItems = summary.totalItems + customItems.length;

  const handleAddCustom = () => {
    const name = searchText.trim();
    const price = parseFloat(customItemPrice);
    if (!name || isNaN(price) || price < 0) return;
    setCustomItems((prev) => [...prev, { id: `c_${Date.now()}`, customDescription: name, customAmount: price }]);
    setSearchText('');
    setCustomItemPrice('');
    toast.success(`Đã thêm "${name}"`);
  };

  const handleSubmitClick = () => {
    if (grandItems === 0) {
      if (!isTakeawayTable) { navigate(`/bill/${tableNumber}`); }
      return;
    }
    if (summary.invalidItems.length > 0)
      toast.warn(`Một số món chưa có giá: ${summary.invalidItems.join(', ')}. Vui lòng liên hệ nhân viên.`);
    setCartOpen(false);
    setShowConfirmModal(true);
  };

  const handleConfirmOrder = async () => {
    setIsSubmitting(true);
    try {
      const billItems = [
        ...summary.items.map(({ orderItemId, quantity, name }) => ({ orderItemId, quantity, name })),
        ...customItems.map(({ customDescription, customAmount }) => ({ customDescription, customAmount })),
      ];
      const ok = await testFirestoreConnection();
      if (!ok) throw new Error('Firestore connection failed');
      await submitCustomerOrder(
        tableNumber,
        billItems,
        grandTotal,
        summary.totalProfit + customTotal,
        note,
        summary.totalCost,
        summary.totalFixedCost
      );

      printKitchenTickets(
        isTakeawayTable ? 'Mang về' : `Bàn ${tableNumber}`,
        [
          ...summary.items,
          ...customItems.map(c => ({ name: c.customDescription, quantity: 1 })),
        ]
      );

      if (isTakeawayTable && existingBill?.takeawayNumber) {
        navigate(`/order-success/MV-${existingBill.takeawayNumber}`);
      } else {
        navigate(`/order-success/${tableNumber}`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Có lỗi xảy ra. Vui lòng thử lại!');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Gom items theo category → sub-group theo parentMenuItemId ──
  const groupedByCategory = useMemo(() => {
    return CATEGORIES.map((cat) => {
      // isAvailable mặc định là true nếu chưa set; ẩn khi isAvailable === false
      // Sort theo sortOrder nếu có (layout do admin cấu hình)
      const catItems = orderItems
        .filter((oi) => oi.category === cat.value && oi.isAvailable !== false)
        .sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
      const grouped = {};
      const standalones = [];

      catItems.forEach((oi) => {
        if (!oi.parentMenuItemId) { standalones.push(oi); return; }
        if (!grouped[oi.parentMenuItemId]) {
          const parent = menuItems.find((m) => m.id === oi.parentMenuItemId);
          grouped[oi.parentMenuItemId] = { parent, items: [] };
        }
        grouped[oi.parentMenuItemId].items.push(oi);
      });

      const groups = Object.values(grouped).filter((g) => g.parent);
      standalones.forEach((oi) =>
        groups.push({ parent: { id: `standalone-${oi.id}`, name: oi.name, isStandalone: true }, items: [oi] })
      );

      return { cat, groups, count: catItems.length };
    }).filter((s) => s.count > 0);
  }, [orderItems, menuItems]);

  // ── Existing bill items display ──
  const existingBillItems = useMemo(() => {
    if (!existingBill?.items) return [];
    return existingBill.items.map((item) => {
      if (item.orderItemId) {
        const oi = orderItems.find((o) => o.id === item.orderItemId);
        const pm = oi ? menuItems.find((m) => m.id === oi?.parentMenuItemId) : null;
        const t = oi ? calculateOrderItemTotals(oi, pm, item.quantity) : null;
        return { key: item.orderItemId, name: oi?.name || 'Món không xác định', quantity: item.quantity, price: t?.price ?? 0 };
      }
      if (item.menuItemId) {
        const mi = menuItems.find((m) => m.id === item.menuItemId);
        return { key: item.menuItemId, name: mi?.name || 'Món không xác định', quantity: item.quantity, price: mi?.price ?? 0 };
      }
      if (item.customDescription)
        return { key: `c-${item.customDescription}`, name: item.customDescription, quantity: 1, price: item.customAmount ?? 0 };
      return null;
    }).filter(Boolean);
  }, [existingBill, orderItems, menuItems]);

  // ── Chỉ hiển thị tabs của categories có dữ liệu ──
  const visibleCats = useMemo(
    () => CATEGORIES.filter((cat) => groupedByCategory.some((s) => s.cat.value === cat.value)),
    [groupedByCategory]
  );

  // ── Search results (flat list) ──
  const searchResults = useMemo(() => {
    const t = searchText.trim().toLowerCase();
    if (!t) return [];
    return orderItems.filter((oi) => oi.isAvailable !== false && oi.name?.toLowerCase().includes(t));
  }, [orderItems, searchText]);

  // ════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-100 via-purple-50 to-indigo-100 pb-16">

      {/* ── Sticky header ── */}
      <div ref={headerRef} className="bg-white/80 backdrop-blur-md sticky top-0 z-10 shadow-sm">

        {/* Title row */}
        <div className="px-4 pt-3 pb-2 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider leading-none mb-0.5">Ốc đây nè</p>
            <p className="text-xl font-extrabold text-gray-900 leading-tight truncate">
              {isTakeawayTable
                ? `🥡 Mang về${existingBill?.takeawayNumber ? ` ${existingBill.takeawayNumber}` : ''}`
                : `Bàn ${tableNumber}`}
            </p>
          </div>
          {existingBill && !loadingExistingBill && (
            <span className="flex-shrink-0 px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
              Đã có đơn
            </span>
          )}
        </div>

        {/* Search bar */}
        <div className="px-4 pb-2.5">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Tìm kiếm món ăn..."
              className="w-full pl-9 pr-9 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-colors"
            />
            {searchText && (
              <button
                onClick={() => { setSearchText(''); setCustomItemPrice(''); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Category tabs — only when not searching */}
        {!isSearching && (
          <div ref={tabsContainerRef} className="overflow-x-auto scrollbar-hide border-t border-gray-100/60">
            <div className="flex min-w-max px-2">
              {(isLoading ? CATEGORIES : visibleCats).map((cat) => (
                <button
                  key={cat.value}
                  data-tab={cat.value}
                  onClick={() => scrollToCategory(cat.value)}
                  className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-all duration-150 ${
                    activeCategory === cat.value
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div className="px-4 pt-4 space-y-2">

        {/* Skeleton */}
        {isLoading && (
          <div className="space-y-4">
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
        )}

        {/* ── SEARCH MODE: flat list + custom item ── */}
        {!isLoading && isSearching && (
          <div className="space-y-2">
            {searchResults.length === 0 ? (
              <p className="text-center text-gray-400 py-4 text-sm">
                Không tìm thấy "<span className="font-semibold">{searchText.trim()}</span>"
              </p>
            ) : (
              searchResults.map((oi) => {
                const qty = quantities[oi.id] || 0;
                const pm = menuItems.find((m) => m.id === oi.parentMenuItemId);
                const totals = calculateOrderItemTotals(oi, pm, 1);
                return (
                  <div
                    key={oi.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                      qty > 0 ? 'border-indigo-300 bg-indigo-50' : 'border-gray-100 bg-white/70'
                    }`}
                  >
                    {oi.imageUrl
                      ? <img src={oi.imageUrl} alt={oi.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
                      : <div className="w-12 h-12 rounded-xl bg-white/40 flex items-center justify-center text-xl flex-shrink-0">🍽️</div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{oi.name}</p>
                      {totals.valid
                        ? <p className="text-xs text-gray-400">{formatCurrency(totals.price)}</p>
                        : <p className="text-amber-500 text-xs">Liên hệ nhân viên</p>
                      }
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {qty > 0 && (
                        <>
                          <button
                            onClick={() => handleQuantityChange(oi.id, -1)}
                            className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center active:scale-90 transition-all"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-6 text-center text-sm font-bold text-indigo-600">{qty}</span>
                        </>
                      )}
                      <button
                        onClick={() => handleQuantityChange(oi.id, 1)}
                        className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center active:scale-90 transition-all shadow-sm"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}

            {/* Add as custom item */}
            <div className="mt-2 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-sm font-semibold text-amber-800 mb-2.5">
                Thêm "<span className="font-bold">{searchText.trim()}</span>" làm món tự chọn
              </p>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={customItemPrice}
                  onChange={(e) => setCustomItemPrice(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()}
                  placeholder="Giá tiền (₫)"
                  className="flex-1 px-3 py-2.5 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                />
                <button
                  onClick={handleAddCustom}
                  disabled={!customItemPrice || isNaN(parseFloat(customItemPrice))}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  Thêm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── BROWSE MODE: category sections ── */}
        {!isLoading && !isSearching && groupedByCategory.map(({ cat, groups }, sectionIndex) => (
          <section
            key={cat.value}
            ref={(el) => { sectionRefs.current[cat.value] = el; }}
            data-category={cat.value}
            className="pt-4 animate-fade-slide-up"
            style={{ animationDelay: `${sectionIndex * 60}ms` }}
          >
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-base font-bold text-gray-800/90">{cat.label}</h2>
              <div className="flex-1 h-px bg-white/60" />
            </div>
            <div className="space-y-4">
              {groups.map((group) => (
                <div key={group.parent.id}>
                  {!group.parent.isStandalone && (
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-0.5">
                      {group.parent.name}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {group.items.map((oi) => {
                      const qty = quantities[oi.id] || 0;
                      const pm = menuItems.find((m) => m.id === oi.parentMenuItemId);
                      const totals = calculateOrderItemTotals(oi, pm, 1);
                      return (
                        <div
                          key={oi.id}
                          onClick={() => handleQuantityChange(oi.id, 1)}
                          className={`relative bg-white/75 backdrop-blur-sm rounded-2xl overflow-hidden shadow-sm border border-white/60 cursor-pointer select-none active:scale-[0.96] transition-transform duration-100
                            ${qty > 0 ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}
                            ${oi.fullWidth ? 'col-span-2' : ''}
                            ${oi.breakBefore ? 'col-start-1' : ''}`}
                        >
                          <div className="relative">
                            {oi.imageUrl
                              ? <img src={oi.imageUrl} alt={oi.name} className="w-full aspect-square object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                              : <div className="w-full aspect-square bg-white/40 flex items-center justify-center text-3xl">🍽️</div>
                            }
                            {qty > 0 && (
                              <span key={qty} className="absolute top-2 left-2 bg-indigo-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center animate-badge-pop shadow-md z-10">
                                {qty}
                              </span>
                            )}
                            <div className="absolute bottom-2 right-2 flex items-center gap-1 z-10" onClick={(e) => e.stopPropagation()}>
                              {qty > 0 && (
                                <button
                                  onClick={() => handleQuantityChange(oi.id, -1)}
                                  className="w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm shadow-md flex items-center justify-center animate-slide-in-right active:scale-90 transition-colors hover:bg-gray-50"
                                >
                                  <Minus size={12} />
                                </button>
                              )}
                              <button
                                onClick={() => handleQuantityChange(oi.id, 1)}
                                className="w-7 h-7 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-md active:scale-90 transition-colors"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          </div>
                          <div className="p-2.5">
                            <p className="font-bold text-gray-900 text-sm leading-snug line-clamp-2">{oi.name}</p>
                            {totals.valid
                              ? <p className="text-xs text-gray-400 mt-0.5">{formatCurrency(totals.price)}</p>
                              : <p className="text-amber-500 text-xs mt-0.5">Liên hệ nhân viên</p>
                            }
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        <div className="h-4" />
      </div>

      {/* ════════════════════════════════════════════
          BOTTOM CART DRAWER
          ════════════════════════════════════════════ */}

      {cartOpen && (
        <div className="fixed inset-0 z-20 bg-black/20" onClick={() => setCartOpen(false)} />
      )}

      <div className="fixed inset-x-0 bottom-0 z-30">
        {/* Collapsed bar — always 56px visible */}
        <div
          className={`px-4 cursor-pointer select-none transition-colors ${
            grandItems > 0 ? 'bg-indigo-600' : 'bg-white border-t border-gray-200'
          }`}
          style={{ height: 56 }}
          onClick={() => setCartOpen((v) => !v)}
        >
          <div className="flex items-center justify-between h-full gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <ShoppingCart size={18} className={grandItems > 0 ? 'text-white flex-shrink-0' : 'text-indigo-600 flex-shrink-0'} />
              {grandItems === 0 ? (
                <span className={`text-sm font-semibold ${isTakeawayTable ? 'text-gray-400' : 'text-indigo-600'}`}>
                  {isTakeawayTable ? 'Chọn món để thêm vào đơn' : 'Xem hóa đơn'}
                </span>
              ) : (
                <span className="text-white font-bold text-sm truncate">
                  {grandItems} món · {formatCurrency(grandTotal)}
                </span>
              )}
            </div>
            <ChevronUp
              size={18}
              className={`flex-shrink-0 transition-transform duration-300 ${cartOpen ? 'rotate-180' : ''} ${grandItems > 0 ? 'text-white' : 'text-gray-400'}`}
            />
          </div>
        </div>

        {/* Expanded panel — slides up with max-h transition */}
        <div className={`bg-white overflow-hidden transition-all duration-300 ease-in-out ${cartOpen ? 'max-h-[68vh]' : 'max-h-0'}`}>
          <div className="overflow-y-auto" style={{ maxHeight: '68vh' }}>
            <div className="px-4 pt-4 pb-6 space-y-4">

              {/* Previously ordered */}
              {existingBillItems.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">Đã gọi trước đó</p>
                  <div className="bg-amber-50 rounded-xl overflow-hidden divide-y divide-amber-100">
                    {existingBillItems.map((item) => (
                      <div key={item.key} className="flex justify-between items-center px-3 py-2.5 text-sm">
                        <span className="text-gray-700">{item.name}<span className="ml-1 text-gray-400">×{item.quantity}</span></span>
                        <span className="text-gray-600 font-medium">{formatCurrency(item.price * item.quantity)}</span>
                      </div>
                    ))}
                    {existingBill?.note && (
                      <div className="px-3 py-2 text-xs text-amber-600 italic">Ghi chú: {existingBill.note}</div>
                    )}
                  </div>
                </div>
              )}

              {/* New items being selected */}
              {(summary.items.length > 0 || customItems.length > 0) ? (
                <div>
                  <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-2">Đang chọn</p>
                  <div className="bg-indigo-50 rounded-xl overflow-hidden divide-y divide-indigo-100">
                    {summary.items.map((item) => (
                      <div key={item.orderItemId} className="flex items-center gap-2 px-3 py-2.5">
                        <span className="flex-1 text-sm text-gray-800 min-w-0 truncate">{item.name}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleQuantityChange(item.orderItemId, -1)}
                            className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center active:scale-90 transition-all"
                          >
                            <Minus size={11} />
                          </button>
                          <span className="w-5 text-center text-sm font-bold text-indigo-600">{item.quantity}</span>
                          <button
                            onClick={() => handleQuantityChange(item.orderItemId, 1)}
                            className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center active:scale-90 transition-all"
                          >
                            <Plus size={11} />
                          </button>
                        </div>
                        <span className="text-xs font-semibold text-indigo-600 w-20 text-right flex-shrink-0">
                          {formatCurrency(item.revenue)}
                        </span>
                      </div>
                    ))}
                    {customItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 px-3 py-2.5">
                        <span className="flex-1 text-sm text-gray-800 min-w-0 truncate">{item.customDescription}</span>
                        <button
                          onClick={() => setCustomItems((prev) => prev.filter((c) => c.id !== item.id))}
                          className="text-gray-300 hover:text-red-500 transition-colors p-0.5 flex-shrink-0"
                        >
                          <X size={14} />
                        </button>
                        <span className="text-xs font-semibold text-amber-600 w-20 text-right flex-shrink-0">
                          {formatCurrency(item.customAmount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-5 text-gray-400 text-sm">
                  Chưa chọn món — bấm vào món để thêm
                </div>
              )}

              {/* Grand total */}
              {grandItems > 0 && (
                <div className="flex justify-between items-center py-1 border-t border-gray-100">
                  <span className="font-bold text-gray-900">Tổng cộng</span>
                  <span className="font-bold text-indigo-600 text-lg">{formatCurrency(grandTotal)}</span>
                </div>
              )}

              {/* Note */}
              <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                <button
                  onClick={() => setShowNoteInput((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-2 text-gray-600">
                    <MessageSquare size={15} />
                    <span className="text-sm font-medium">
                      {note.trim() ? 'Ghi chú đã thêm' : 'Thêm ghi chú (ít cay, không hành...)'}
                    </span>
                  </div>
                  {showNoteInput ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
                </button>
                {showNoteInput && (
                  <div className="border-t border-gray-100 px-4 pb-4">
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="VD: ít cay, không hành, ít đá..."
                      rows={2}
                      className="w-full mt-3 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Order button */}
              <button
                onClick={handleSubmitClick}
                disabled={grandItems === 0 && isTakeawayTable}
                className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md"
              >
                {grandItems === 0 && !isTakeawayTable
                  ? <><ShoppingCart size={17} />Xem hóa đơn</>
                  : grandItems === 0
                    ? 'Chọn món để đặt'
                    : <><ShoppingCart size={17} />Đặt {grandItems} món · {formatCurrency(grandTotal)}</>
                }
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Confirm Modal ── */}
      {showConfirmModal && (
        <ConfirmModal
          items={summary.items}
          customItems={customItems}
          note={note}
          totalRevenue={grandTotal}
          onConfirm={handleConfirmOrder}
          onCancel={() => !isSubmitting && setShowConfirmModal(false)}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
};

export default CustomerOrder;
