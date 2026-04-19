import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useApp } from '../context/AppContext';
import { Users } from 'lucide-react';

const TableIllustration = ({ isActive, seats }) => {
  const mainColor = isActive ? '#f97316' : '#6366f1';
  const lightColor = isActive ? '#fb923c' : '#818cf8';
  const chairColor = isActive ? '#fdba74' : '#a5b4fc';

  // Chair positions based on seats count
  const topChairs = Math.ceil(seats / 2);
  const bottomChairs = Math.floor(seats / 2);

  return (
    <svg viewBox="0 0 80 80" className="w-14 h-14" fill="none">
      {/* Top chairs */}
      {Array.from({ length: Math.min(topChairs, 3) }).map((_, i) => {
        const total = Math.min(topChairs, 3);
        const spacing = 60 / (total + 1);
        const x = 10 + spacing * (i + 1) - 8;
        return (
          <rect key={`top-${i}`} x={x} y={4} width={16} height={9} rx={3} fill={chairColor} />
        );
      })}

      {/* Table surface */}
      <rect x={8} y={18} width={64} height={14} rx={4} fill={lightColor} />

      {/* Table legs */}
      <rect x={16} y={32} width={7} height={22} rx={3} fill={mainColor} />
      <rect x={57} y={32} width={7} height={22} rx={3} fill={mainColor} />

      {/* Bottom chairs */}
      {Array.from({ length: Math.min(bottomChairs, 3) }).map((_, i) => {
        const total = Math.min(bottomChairs, 3);
        const spacing = 60 / (total + 1);
        const x = 10 + spacing * (i + 1) - 8;
        return (
          <rect key={`bot-${i}`} x={x} y={55} width={16} height={9} rx={3} fill={chairColor} />
        );
      })}
    </svg>
  );
};

const TableSelection = () => {
  const { tables } = useApp();
  const [pendingBillsMap, setPendingBillsMap] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const q = query(
      collection(db, 'bills'),
      where('date', '==', today)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const map = {};
      snapshot.docs.forEach(doc => {
        const bill = doc.data();
        if (bill.status === 'pending' && !bill.isTakeaway && bill.tableNumber) {
          if (!map[bill.tableNumber]) map[bill.tableNumber] = 0;
          map[bill.tableNumber]++;
        }
      });
      setPendingBillsMap(map);
    });

    return () => unsubscribe();
  }, []);

  const handleTableClick = (table) => {
    navigate(`/create/${table.number}`);
  };

  if (tables.length === 0) {
    return (
      <div className="max-w-5xl mx-auto p-6 text-center">
        <div className="bg-white rounded-xl shadow-sm border p-10">
          <div className="text-6xl mb-4">🪑</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Chưa có bàn nào</h2>
          <p className="text-gray-500">Vui lòng thêm bàn trong phần quản lý menu</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 pb-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Chọn bàn</h1>
        <p className="text-sm text-gray-500 mt-1">Chọn bàn để tạo hoặc thêm đơn hàng</p>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mb-5 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <span className="inline-block w-4 h-4 rounded-full bg-indigo-200 border border-indigo-300"></span>
          <span>Bàn trống</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-4 h-4 rounded-full bg-orange-400 border border-orange-500"></span>
          <span>Đang có đơn</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {tables.map((table) => {
          const billCount = pendingBillsMap[table.number] || 0;
          const isActive = billCount > 0;

          return (
            <button
              key={table.id}
              onClick={() => handleTableClick(table)}
              className={`relative flex flex-col items-center py-5 px-3 rounded-2xl border-2 transition-all duration-150 hover:shadow-lg active:scale-95 select-none ${
                isActive
                  ? 'border-orange-400 bg-orange-50 shadow-orange-100 shadow-md'
                  : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50'
              }`}
            >
              {/* Active indicator badge */}
              {isActive && (
                <span className="absolute top-2.5 right-2.5 min-w-[22px] h-[22px] bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold px-1">
                  {billCount}
                </span>
              )}

              {/* Table illustration */}
              <div
                className={`w-[72px] h-[72px] flex items-center justify-center mb-3 rounded-xl ${
                  isActive ? 'bg-orange-100' : 'bg-indigo-50'
                }`}
              >
                <TableIllustration isActive={isActive} seats={table.seats || 4} />
              </div>

              {/* Table number */}
              <span
                className={`font-bold text-xl leading-tight ${
                  isActive ? 'text-orange-700' : 'text-gray-800'
                }`}
              >
                Bàn {table.number}
              </span>

              {/* Seats */}
              <span className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                <Users size={10} />
                {table.seats || '?'} chỗ
              </span>

              {/* Status text */}
              {isActive ? (
                <span className="mt-2 text-xs font-medium text-orange-600 bg-orange-100 rounded-full px-2 py-0.5">
                  Đang phục vụ
                </span>
              ) : (
                <span className="mt-2 text-xs text-gray-400">Trống</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TableSelection;
