import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useApp } from './AppContext';

const InventoryContext = createContext();

const initialState = {
  inventoryItems: [],
  stockTransactions: [],
  recipes: [],
  customUnits: [],
  expenses: [],
  loading: true
};

const inventoryReducer = (state, action) => {
  switch (action.type) {
    case 'SET_INVENTORY_ITEMS':
      return { ...state, inventoryItems: action.payload };
    case 'SET_STOCK_TRANSACTIONS':
      return { ...state, stockTransactions: action.payload };
    case 'SET_RECIPES':
      return { ...state, recipes: action.payload };
    case 'SET_CUSTOM_UNITS':
      return { ...state, customUnits: action.payload };
    case 'SET_EXPENSES':
      return { ...state, expenses: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    default:
      return state;
  }
};

export const InventoryProvider = ({ children }) => {
  const [state, dispatch] = useReducer(inventoryReducer, initialState);
  const { isAuthenticated } = useApp();

  // Realtime listener: inventoryItems
  useEffect(() => {
    if (!isAuthenticated) return;
    const unsub = onSnapshot(collection(db, 'inventoryItems'), (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => (a.category || '').localeCompare(b.category || '') || (a.name || '').localeCompare(b.name || ''));
      dispatch({ type: 'SET_INVENTORY_ITEMS', payload: items });
    });
    return () => unsub();
  }, [isAuthenticated]);

  // Realtime listener: recipes
  useEffect(() => {
    if (!isAuthenticated) return;
    const unsub = onSnapshot(collection(db, 'recipes'), (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      dispatch({ type: 'SET_RECIPES', payload: items });
    });
    return () => unsub();
  }, [isAuthenticated]);

  // Realtime listener: customUnits
  useEffect(() => {
    if (!isAuthenticated) return;
    const unsub = onSnapshot(collection(db, 'customUnits'), (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      dispatch({ type: 'SET_CUSTOM_UNITS', payload: items });
    });
    return () => unsub();
  }, [isAuthenticated]);

  // Realtime listener: stockTransactions (chỉ load 500 gần nhất)
  useEffect(() => {
    if (!isAuthenticated) return;
    const unsub = onSnapshot(collection(db, 'stockTransactions'), (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB - dateA;
      });
      dispatch({ type: 'SET_STOCK_TRANSACTIONS', payload: items });
    });
    return () => unsub();
  }, [isAuthenticated]);

  // Realtime listener: expenses
  useEffect(() => {
    if (!isAuthenticated) return;
    const unsub = onSnapshot(collection(db, 'expenses'), (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      dispatch({ type: 'SET_EXPENSES', payload: items });
    });
    return () => unsub();
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      // Data sẽ tự loaded qua onSnapshot, chỉ cần tắt loading sau 1s
      const timer = setTimeout(() => dispatch({ type: 'SET_LOADING', payload: false }), 1000);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated]);

  // Computed: low stock items
  const lowStockItems = state.inventoryItems.filter(
    item => item.currentStock <= item.minStock && item.minStock > 0
  );

  const value = {
    ...state,
    lowStockItems,
    dispatch
  };

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};
