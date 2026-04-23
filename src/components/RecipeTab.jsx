import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useApp } from '../context/AppContext';
import { toast } from 'react-toastify';
import { Plus, Edit, Trash2, X, Save, BookOpen, Search, ChefHat } from 'lucide-react';
import { DEFAULT_UNITS } from '../utils/inventoryUtils';

const RecipeTab = () => {
  const { menuItems } = useApp();
  const [recipes, setRecipes] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [customUnits, setCustomUnits] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [searchText, setSearchText] = useState('');

  // Form state
  const [selectedMenuItemId, setSelectedMenuItemId] = useState('');
  const [ingredients, setIngredients] = useState([]);

  // Load data
  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, 'recipes'), (snap) => {
      setRecipes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsub2 = onSnapshot(collection(db, 'inventoryItems'), (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setInventoryItems(items);
    });
    const unsub3 = onSnapshot(collection(db, 'customUnits'), (snap) => {
      setCustomUnits(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  const allUnits = [...DEFAULT_UNITS, ...customUnits.map(u => u.name)];

  // Menu items chưa có recipe
  const menuItemsWithoutRecipe = menuItems.filter(
    mi => !recipes.some(r => r.menuItemId === mi.id)
  );

  const openModal = (recipe = null) => {
    if (recipe) {
      setEditingRecipe(recipe);
      setSelectedMenuItemId(recipe.menuItemId);
      setIngredients(recipe.ingredients?.map((ing, i) => ({ ...ing, _id: i })) || []);
    } else {
      setEditingRecipe(null);
      setSelectedMenuItemId('');
      setIngredients([]);
    }
    setShowModal(true);
  };

  const addIngredient = () => {
    setIngredients(prev => [...prev, {
      _id: Date.now(),
      inventoryItemId: '',
      inventoryItemName: '',
      quantity: '',
      unit: ''
    }]);
  };

  const removeIngredient = (idx) => {
    setIngredients(prev => prev.filter((_, i) => i !== idx));
  };

  const updateIngredient = (idx, field, value) => {
    setIngredients(prev => prev.map((ing, i) => {
      if (i !== idx) return ing;
      const updated = { ...ing, [field]: value };

      // Auto-fill name and unit when selecting inventory item
      if (field === 'inventoryItemId') {
        const invItem = inventoryItems.find(ii => ii.id === value);
        if (invItem) {
          updated.inventoryItemName = invItem.name;
          updated.unit = invItem.unit;
        }
      }
      return updated;
    }));
  };

  const handleSave = async () => {
    if (!selectedMenuItemId) {
      toast.warning('Vui lòng chọn món ăn');
      return;
    }

    const validIngredients = ingredients
      .filter(ing => ing.inventoryItemId && parseFloat(ing.quantity) > 0)
      .map(ing => ({
        inventoryItemId: ing.inventoryItemId,
        inventoryItemName: ing.inventoryItemName,
        quantity: parseFloat(ing.quantity),
        unit: ing.unit
      }));

    if (validIngredients.length === 0) {
      toast.warning('Vui lòng thêm ít nhất 1 nguyên liệu');
      return;
    }

    const menuItem = menuItems.find(mi => mi.id === selectedMenuItemId);

    try {
      if (editingRecipe) {
        await updateDoc(doc(db, 'recipes', editingRecipe.id), {
          menuItemId: selectedMenuItemId,
          menuItemName: menuItem?.name || '',
          ingredients: validIngredients,
          updatedAt: serverTimestamp()
        });
        toast.success('Cập nhật công thức thành công!');
      } else {
        await addDoc(collection(db, 'recipes'), {
          menuItemId: selectedMenuItemId,
          menuItemName: menuItem?.name || '',
          ingredients: validIngredients,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        toast.success('Thêm công thức thành công!');
      }
      setShowModal(false);
    } catch (error) {
      console.error('Error saving recipe:', error);
      toast.error('Có lỗi xảy ra');
    }
  };

  const handleDelete = async (recipe) => {
    if (!window.confirm(`Xóa công thức "${recipe.menuItemName}"?`)) return;
    try {
      await deleteDoc(doc(db, 'recipes', recipe.id));
      toast.success('Đã xóa công thức!');
    } catch (error) {
      toast.error('Có lỗi xảy ra');
    }
  };

  const filteredRecipes = recipes.filter(r =>
    !searchText || r.menuItemName?.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Search & Add */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm công thức..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} className="mr-1" />
          Thêm công thức
        </button>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
        <BookOpen size={16} className="inline mr-1" />
        Công thức liên kết nguyên liệu trong kho với từng món ăn. Khi bán món, hệ thống sẽ tự động trừ kho theo công thức.
      </div>

      {/* Recipes list */}
      {filteredRecipes.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <ChefHat size={48} className="mx-auto mb-3 text-gray-300" />
          <p>Chưa có công thức nào</p>
          <p className="text-xs mt-1">Thêm công thức để tự động trừ kho khi bán món</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRecipes.map(recipe => (
            <div key={recipe.id} className="bg-white border rounded-lg p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ChefHat size={18} className="text-indigo-500" />
                  <h3 className="font-semibold text-gray-900">{recipe.menuItemName}</h3>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openModal(recipe)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded">
                    <Edit size={14} />
                  </button>
                  <button onClick={() => handleDelete(recipe)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                {recipe.ingredients?.map((ing, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                    <span className="text-gray-700">{ing.inventoryItemName}</span>
                    <span className="text-gray-500 font-medium">{ing.quantity} {ing.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
              <h2 className="text-lg font-semibold">{editingRecipe ? 'Sửa công thức' : 'Thêm công thức mới'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Menu item selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Món ăn *</label>
                <select
                  value={selectedMenuItemId}
                  onChange={(e) => setSelectedMenuItemId(e.target.value)}
                  disabled={!!editingRecipe}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                >
                  <option value="">-- Chọn món ăn --</option>
                  {editingRecipe ? (
                    <option value={editingRecipe.menuItemId}>{editingRecipe.menuItemName}</option>
                  ) : (
                    menuItemsWithoutRecipe.map(mi => (
                      <option key={mi.id} value={mi.id}>{mi.name}</option>
                    ))
                  )}
                </select>
              </div>

              {/* Ingredients */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Nguyên liệu</label>
                  <button
                    onClick={addIngredient}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center"
                  >
                    <Plus size={14} className="mr-0.5" />
                    Thêm
                  </button>
                </div>

                {ingredients.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Chưa có nguyên liệu nào</p>
                ) : (
                  <div className="space-y-2">
                    {ingredients.map((ing, idx) => (
                      <div key={ing._id || idx} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                        <select
                          value={ing.inventoryItemId}
                          onChange={(e) => updateIngredient(idx, 'inventoryItemId', e.target.value)}
                          className="flex-1 px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="">-- Chọn --</option>
                          {inventoryItems.map(ii => (
                            <option key={ii.id} value={ii.id}>{ii.name} ({ii.unit})</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="SL"
                          value={ing.quantity}
                          onChange={(e) => updateIngredient(idx, 'quantity', e.target.value)}
                          className="w-20 px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <span className="text-xs text-gray-500 w-8">{ing.unit}</span>
                        <button
                          onClick={() => removeIngredient(idx)}
                          className="p-1 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t sticky bottom-0 bg-white">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">
                Hủy
              </button>
              <button onClick={handleSave} className="flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">
                <Save size={16} className="mr-1" />
                {editingRecipe ? 'Cập nhật' : 'Lưu công thức'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecipeTab;
