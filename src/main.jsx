import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { AppProvider, useApp } from './context/AppContext';
import { InventoryProvider } from './context/InventoryContext';
import Layout from './components/Layout';
import InventoryLayout from './components/InventoryLayout';
import PasswordGate from './components/PasswordGate';
import CreateBill from './pages/CreateBill';
import TableSelection from './pages/TableSelection';
import MenuManagement from './pages/MenuManagement';
import BillManagement from './pages/BillManagement';
import Reports from './pages/Reports';
import DishAnalysis from './pages/DishAnalysis';
import QRCodeManager from './pages/QRCodeManager';
import PublicBill from './pages/PublicBill';
import CustomerOrder from './pages/CustomerOrder';
import OrderSuccess from './pages/OrderSuccess';
import TakeawayOrder from './pages/TakeawayOrder';
import InventoryDashboard from './pages/inventory/InventoryDashboard';
import InventoryItems from './pages/inventory/InventoryItems';
import StockIn from './pages/inventory/StockIn';
import StockOut from './pages/inventory/StockOut';
import StockHistory from './pages/inventory/StockHistory';
import ExpenseList from './pages/inventory/ExpenseList';
import ExpenseReport from './pages/inventory/ExpenseReport';
import { initVoiceOrderMetrics } from './utils/voiceOrderMetrics';

import './index.css';

// Init OTLP metrics nếu có env (fire-and-forget)
initVoiceOrderMetrics().catch(() => {});

// Public Routes (không cần authentication)
const PublicRoutes = () => {
  return (
    <Routes>
      <Route path="/bill/:tableNumber" element={<PublicBill />} />
      <Route path="/order/:tableNumber" element={<CustomerOrder />} />
      <Route path="/order-success/:tableNumber" element={<OrderSuccess />} />
      <Route path="/takeaway" element={<TakeawayOrder />} />
    </Routes>
  );
};

// Protected Routes (cần authentication)
const ProtectedRoutes = () => {
  const { isAuthenticated } = useApp();

  if (!isAuthenticated) {
    return <PasswordGate />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<TableSelection />} />
        <Route path="/create/:tableNumber" element={<CreateBill />} />
        <Route path="/menu" element={<MenuManagement />} />
        <Route path="/bills" element={<BillManagement />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/dish-analysis" element={<DishAnalysis />} />
        <Route path="/qr" element={<QRCodeManager />} />
      </Routes>
    </Layout>
  );
};

// Inventory Routes (layout riêng, cần authentication)
const InventoryRoutes = () => {
  const { isAuthenticated } = useApp();

  if (!isAuthenticated) {
    return <PasswordGate />;
  }

  return (
    <InventoryProvider>
      <InventoryLayout>
        <Routes>
          <Route path="/inventory" element={<InventoryDashboard />} />
          <Route path="/inventory/items" element={<InventoryItems />} />
          <Route path="/inventory/stock-in" element={<StockIn />} />
          <Route path="/inventory/stock-out" element={<StockOut />} />
          <Route path="/inventory/history" element={<StockHistory />} />
          <Route path="/inventory/expenses" element={<ExpenseList />} />
          <Route path="/inventory/expense-report" element={<ExpenseReport />} />
        </Routes>
      </InventoryLayout>
    </InventoryProvider>
  );
};

// Main App component with route handling
const App = () => {
  const currentPath = window.location.pathname;
  
  // Check if current path is a public route
  if (currentPath.startsWith('/bill/') || 
      currentPath.startsWith('/order') ||
      currentPath.startsWith('/takeaway')) {
    return <PublicRoutes />;
  }

  // Check if current path is inventory route
  if (currentPath.startsWith('/inventory')) {
    return <InventoryRoutes />;
  }

  // Otherwise, render protected routes
  return <ProtectedRoutes />;
};

// Root component with providers
const Root = () => {
  return (
    <Router>
      <AppProvider>
        <App />
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
      </AppProvider>
    </Router>
  );
};

// Create root and render
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
); 