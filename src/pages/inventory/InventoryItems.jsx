import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { toast } from 'react-toastify';
import { Plus, Edit, Trash2, X, Save, Search, Package, AlertTriangle, Settings } from 'lucide-react';
import {
  INVENTORY_CATEGORIES, DEFAULT_UNITS, getCategoryLabel,
  formatCurrency, formatNumber,
  addInventoryItem, updateInventoryItem, deleteInventoryItem,
  addCustomUnit, deleteCustomUnit
} from '../../utils/inventoryUtils';

const schema = yup.object({
  name: yup.string().required('Tên hàng hóa là bắt buộc'),
  category: yup.string().required('Danh mục là bắt buộc'),
  unit: yup.string().required('Đơn vị tính là bắt buộc'),
  currentStock: yup.number().min(0, 'Không được âm').required('Bắt buộc').transform(v => isNaN(v) ? 0 : v),
  minStock: yup.number().min(0, 'Không được âm').required('Bắt buộc').transform(v => isNaN(v) ? 0 : v),
  costPerUnit: yup.number().min(0, 'Không được âm').required('Bắt buộc').transform(v => isNaN(v) ? 0 : v)
});

const InventoryItems = () => {
  const { inventoryItems, customUnits } = useInventory();
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showUnitsModal, setShowUnitsModal] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');

  const allUnits = [...DEFAULT_UNITS, ...customUnits.map(u => u.name)];

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { name: '', category: 'nguyen_lieu', unit: 'kg', currentStock: 0, minStock: 0, costPerUnit: 0 }
  });

  const openModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      reset({
        name: item.name,
        category: item.category,
        unit: item.unit,
        currentStock: item.currentStock,
        minStock: item.minStock,
        costPerUnit: item.costPerUnit
      });
    } else {
      setEditingItem(null);
      reset({ name: '', category: 'nguyen_lieu', unit: 'kg', currentStock: 0, minStock: 0, costPerUnit: 0 });
    }
    setShowModal(true);
  };

  const onSubmit = async (data) => {
    try {
      if (editingItem) {
        await updateInventoryItem(editingItem.id, data);
        toast.success('Cập nhật thành công!');
      } else {
        await addInventoryItem(data);
        toast.success('Thêm hàng hóa thành công!');
      }
      setShowModal(false);
      reset();
    } catch (error) {
      console.error('Error saving inventory item:', error);
      toast.error('Có lỗi xảy ra');
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Xóa "${item.name}" khỏi kho?`)) return;
    try {
      await deleteInventoryItem(item.id);
      toast.success('Đã xóa!');
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Có lỗi xảy ra');
    }
  };

  const handleAddUnit = async () => {
    const name = newUnitName.trim();
    if (!name) return;
    if (allUnits.includes(name)) {
      toast.warning('Đơn vị tính đã tồn tại');
      return;
    }
    try {
      await addCustomUnit(name);
      setNewUnitName('');
      toast.success('Đã thêm đơn vị tính!');
    } catch (error) {
      toast.error('Có lỗi xảy ra');
    }
  };

  const handleDeleteUnit = async (unit) => {
    if (!window.confirm(`Xóa đơn vị "${unit.name}"?`)) return;
    try {
      await deleteCustomUnit(unit.id);
      toast.success('Đã xóa!');
    } catch (error) {
      toast.error('Có lỗi xảy ra');
    }
  };

  // Filter & search
  const filteredItems = inventoryItems.filter(item => {
    const matchSearch = !searchText || item.name.toLowerCase().includes(searchText.toLowerCase());
    const matchCategory = filterCategory === 'all' || item.category === filterCategory;
    return matchSearch && matchCategory;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Hàng hóa trong kho</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowUnitsModal(true)}
            className="flex items-center px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            <Settings size={16} className="mr-1" />
            Đơn vị tính
          </button>
          <button
            onClick={() => openModal()}
            className="flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} className="mr-1" />
            Thêm hàng
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm hàng hóa..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="all">Tất cả danh mục</option>
            {INVENTORY_CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Items list */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Package size={48} className="mx-auto mb-3 text-gray-300" />
            <p>Chưa có hàng hóa nào</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Tên hàng hóa</th>
                  <th className="px-4 py-3 text-left font-medium">Danh mục</th>
                  <th className="px-4 py-3 text-right font-medium">Tồn kho</th>
                  <th className="px-4 py-3 text-right font-medium">Tối thiểu</th>
                  <th className="px-4 py-3 text-right font-medium">Đơn giá</th>
                  <th className="px-4 py-3 text-right font-medium">Giá trị</th>
                  <th className="px-4 py-3 text-center font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredItems.map(item => {
                  const isLow = item.minStock > 0 && item.currentStock <= item.minStock;
                  const value = (item.currentStock || 0) * (item.costPerUnit || 0);
                  return (
                    <tr key={item.id} className={`hover:bg-gray-50 ${isLow ? 'bg-amber-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isLow && <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />}
                          <span className="font-medium text-gray-900">{item.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{getCategoryLabel(item.category)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${isLow ? 'text-amber-600' : item.currentStock <= 0 ? 'text-red-600' : 'text-gray-900'}`}>
                        {formatNumber(item.currentStock)} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">{formatNumber(item.minStock)} {item.unit}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(item.costPerUnit)}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(value)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openModal(item)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded">
                            <Edit size={14} />
                          </button>
                          <button onClick={() => handleDelete(item)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">{editingItem ? 'Sửa hàng hóa' : 'Thêm hàng hóa mới'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên hàng hóa *</label>
                <input {...register('name')} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Danh mục *</label>
                  <select {...register('category')} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
                    {INVENTORY_CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                  {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Đơn vị tính *</label>
                  <select {...register('unit')} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
                    {allUnits.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                  {errors.unit && <p className="text-red-500 text-xs mt-1">{errors.unit.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tồn kho</label>
                  <input type="number" step="0.01" {...register('currentStock')} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
                  {errors.currentStock && <p className="text-red-500 text-xs mt-1">{errors.currentStock.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tối thiểu</label>
                  <input type="number" step="0.01" {...register('minStock')} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
                  {errors.minStock && <p className="text-red-500 text-xs mt-1">{errors.minStock.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Đơn giá</label>
                  <input type="number" step="1" {...register('costPerUnit')} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
                  {errors.costPerUnit && <p className="text-red-500 text-xs mt-1">{errors.costPerUnit.message}</p>}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">
                  Hủy
                </button>
                <button type="submit" className="flex items-center px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg">
                  <Save size={16} className="mr-1" />
                  {editingItem ? 'Cập nhật' : 'Thêm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Units Modal */}
      {showUnitsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Quản lý đơn vị tính</h2>
              <button onClick={() => setShowUnitsModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Add new unit */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Tên đơn vị mới..."
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddUnit()}
                  className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <button onClick={handleAddUnit} className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
                  <Plus size={16} />
                </button>
              </div>

              {/* Default units */}
              <div>
                <p className="text-xs text-gray-500 font-medium mb-2">Đơn vị mặc định</p>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_UNITS.map(u => (
                    <span key={u} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">{u}</span>
                  ))}
                </div>
              </div>

              {/* Custom units */}
              {customUnits.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-2">Đơn vị tùy chỉnh</p>
                  <div className="flex flex-wrap gap-2">
                    {customUnits.map(u => (
                      <span key={u.id} className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-xs">
                        {u.name}
                        <button onClick={() => handleDeleteUnit(u)} className="text-emerald-400 hover:text-red-500">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryItems;
