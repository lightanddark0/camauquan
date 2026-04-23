import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Menu, X, LayoutDashboard, Package, ArrowDownToLine, ArrowUpFromLine, History, ArrowLeft, AlertTriangle, Wallet, BarChart3 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useInventory } from '../context/InventoryContext';

const InventoryLayout = ({ children }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { logout } = useApp();
  const { lowStockItems } = useInventory();
  const navigate = useNavigate();

  const navigationItems = [
    { path: '/inventory', label: 'Tổng quan kho', icon: LayoutDashboard },
    { path: '/inventory/items', label: 'Hàng hóa', icon: Package },
    { path: '/inventory/stock-in', label: 'Nhập kho', icon: ArrowDownToLine },
    { path: '/inventory/stock-out', label: 'Xuất kho', icon: ArrowUpFromLine },
    { path: '/inventory/history', label: 'Lịch sử kho', icon: History },
    { type: 'divider', label: 'Chi tiêu' },
    { path: '/inventory/expenses', label: 'Quản lý chi tiêu', icon: Wallet },
    { path: '/inventory/expense-report', label: 'Báo cáo chi tiêu', icon: BarChart3 }
  ];

  const handleLogout = () => {
    logout();
    setIsMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile header */}
      <header className="bg-white shadow-sm border-b lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/')} className="p-1 rounded text-gray-500 hover:text-gray-700">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-lg font-semibold text-gray-900">Quản lý kho</h1>
          </div>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          >
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile navigation */}
      {isMenuOpen && (
        <div className="lg:hidden bg-white border-b shadow-sm">
          <nav className="px-4 py-2">
            {navigationItems.map((item, idx) => {
              if (item.type === 'divider') {
                return (
                  <div key={`div-${idx}`} className="pt-2 mt-2 border-t border-gray-200">
                    <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase">{item.label}</p>
                  </div>
                );
              }
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/inventory'}
                  onClick={() => setIsMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`
                  }
                >
                  <Icon size={18} className="mr-3" />
                  {item.label}
                  {item.path === '/inventory' && lowStockItems.length > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{lowStockItems.length}</span>
                  )}
                </NavLink>
              );
            })}
            <hr className="my-2" />
            <NavLink
              to="/"
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-indigo-600 hover:bg-indigo-50"
            >
              <ArrowLeft size={18} className="mr-3" />
              Quay về quản lý đơn
            </NavLink>
            <button
              onClick={handleLogout}
              className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 w-full text-left"
            >
              <LogOut size={18} className="mr-3" />
              Đăng xuất
            </button>
          </nav>
        </div>
      )}

      <div className="lg:flex">
        {/* Desktop sidebar */}
        <div className="hidden lg:flex lg:flex-shrink-0">
          <div className="flex flex-col w-64">
            <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
              <div className="px-6 py-4 border-b">
                <h1 className="text-xl font-bold text-gray-900">Cà Mau Quán</h1>
                <p className="text-sm text-emerald-600 font-medium">Kho & Chi tiêu</p>
              </div>

              <nav className="flex-1 px-4 py-4 space-y-1">
                {navigationItems.map((item, idx) => {
                  if (item.type === 'divider') {
                    return (
                      <div key={`div-${idx}`} className="pt-3 mt-3 border-t border-gray-200">
                        <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase">{item.label}</p>
                      </div>
                    );
                  }
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === '/inventory'}
                      className={({ isActive }) =>
                        `flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`
                      }
                    >
                      <Icon size={18} className="mr-3" />
                      {item.label}
                      {item.path === '/inventory' && lowStockItems.length > 0 && (
                        <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{lowStockItems.length}</span>
                      )}
                    </NavLink>
                  );
                })}
              </nav>

              {/* Low stock warning */}
              {lowStockItems.length > 0 && (
                <div className="mx-4 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2 text-amber-700 text-sm font-medium mb-1">
                    <AlertTriangle size={16} />
                    Sắp hết hàng
                  </div>
                  <ul className="text-xs text-amber-600 space-y-0.5">
                    {lowStockItems.slice(0, 5).map(item => (
                      <li key={item.id}>• {item.name}: {item.currentStock} {item.unit}</li>
                    ))}
                    {lowStockItems.length > 5 && (
                      <li>... và {lowStockItems.length - 5} mặt hàng khác</li>
                    )}
                  </ul>
                </div>
              )}

              <div className="px-4 py-4 border-t space-y-1">
                <NavLink
                  to="/"
                  className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-indigo-600 hover:bg-indigo-50"
                >
                  <ArrowLeft size={18} className="mr-3" />
                  Quay về quản lý đơn
                </NavLink>
                <button
                  onClick={handleLogout}
                  className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 w-full text-left"
                >
                  <LogOut size={18} className="mr-3" />
                  Đăng xuất
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <main className="p-4 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

export default InventoryLayout;
