import React, { useState, useEffect } from 'react';
import { InventoryItem, InventoryCategory, UserRole, Vendor } from '../types';
import { 
  getInventoryItems, 
  addInventoryItem, 
  updateInventoryItem, 
  restockInventoryItem, 
  deleteInventoryItem,
  getInventoryConsumptionRecords,
  getVendors,
  subscribeToStore
} from '../lib/storage';
import { 
  Package, 
  Plus, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  TrendingDown, 
  DollarSign, 
  Edit3, 
  Trash2, 
  Layers, 
  RotateCcw,
  Clock,
  Building2,
  Tag,
  Boxes,
  X
} from 'lucide-react';

interface InventoryViewProps {
  currentRole: UserRole;
  vendors?: Vendor[];
}

export function InventoryView({ currentRole, vendors = [] }: InventoryViewProps) {
  const isManager = currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN' || currentRole === 'FLOOR_MANAGER';
  const allVendors = vendors.length > 0 ? vendors : getVendors();

  const [items, setItems] = useState<InventoryItem[]>(() => getInventoryItems());
  const [consumptionLogs, setConsumptionLogs] = useState(() => getInventoryConsumptionRecords());

  useEffect(() => {
    const refreshData = () => {
      setItems(getInventoryItems());
      setConsumptionLogs(getInventoryConsumptionRecords());
    };
    refreshData();
    const unsubscribe = subscribeToStore(refreshData);
    return () => { unsubscribe(); };
  }, []);
  const [activeTab, setActiveTab] = useState<'STOCK' | 'LOGS'>('STOCK');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState<string>('ALL');

  // Add / Edit Modal state
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Form Fields
  const [formData, setFormData] = useState({
    name: '',
    partNumber: '',
    category: 'SPARES' as InventoryCategory,
    stockQuantity: 10,
    unit: 'Pcs' as any,
    minStockAlert: 5,
    unitCost: 100,
    sellingPrice: 180,
    supplierVendorId: '',
    shelfLocation: 'Rack A-1',
  });

  // Restock Modal
  const [restockItemId, setRestockItemId] = useState<string | null>(null);
  const [restockQty, setRestockQty] = useState(10);

  const refreshItems = () => {
    setItems(getInventoryItems());
    setConsumptionLogs(getInventoryConsumptionRecords());
  };

  const handleOpenAddModal = () => {
    setEditingItemId(null);
    setFormData({
      name: '',
      partNumber: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      category: 'SPARES',
      stockQuantity: 10,
      unit: 'Pcs',
      minStockAlert: 5,
      unitCost: 100,
      sellingPrice: 180,
      supplierVendorId: allVendors[0]?.id || '',
      shelfLocation: 'Rack A-1',
    });
    setShowItemModal(true);
  };

  const handleOpenEditModal = (item: InventoryItem) => {
    setEditingItemId(item.id);
    setFormData({
      name: item.name,
      partNumber: item.partNumber,
      category: item.category,
      stockQuantity: item.stockQuantity,
      unit: item.unit,
      minStockAlert: item.minStockAlert,
      unitCost: item.unitCost,
      sellingPrice: item.sellingPrice,
      supplierVendorId: item.supplierVendorId || '',
      shelfLocation: item.shelfLocation || '',
    });
    setShowItemModal(true);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    const matchedVendor = allVendors.find(v => v.id === formData.supplierVendorId);

    if (editingItemId) {
      updateInventoryItem(editingItemId, {
        ...formData,
        supplierVendorName: matchedVendor ? matchedVendor.name : undefined
      });
    } else {
      addInventoryItem({
        ...formData,
        supplierVendorName: matchedVendor ? matchedVendor.name : undefined
      });
    }

    setShowItemModal(false);
    refreshItems();
  };

  const handleRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (restockItemId && restockQty > 0) {
      restockInventoryItem(restockItemId, Number(restockQty));
      setRestockItemId(null);
      setRestockQty(10);
      refreshItems();
    }
  };

  const handleDeleteItem = (id: string) => {
    if (confirm('Are you sure you want to remove this item from workshop inventory?')) {
      deleteInventoryItem(id);
      refreshItems();
    }
  };

  // Metrics
  const totalItemsCount = items.length;
  const totalStockValue = items.reduce((acc, i) => acc + (i.stockQuantity * i.unitCost), 0);
  const totalSellingVal = items.reduce((acc, i) => acc + (i.stockQuantity * i.sellingPrice), 0);
  const lowStockItems = items.filter(i => i.stockQuantity > 0 && i.stockQuantity <= i.minStockAlert);
  const outOfStockItems = items.filter(i => i.stockQuantity === 0);

  // Filtered List
  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.partNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.shelfLocation && item.shelfLocation.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;

    let matchesStatus = true;
    if (stockStatusFilter === 'IN_STOCK') matchesStatus = item.stockQuantity > item.minStockAlert;
    if (stockStatusFilter === 'LOW_STOCK') matchesStatus = item.stockQuantity > 0 && item.stockQuantity <= item.minStockAlert;
    if (stockStatusFilter === 'OUT_OF_STOCK') matchesStatus = item.stockQuantity === 0;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="space-y-6">
      
      {/* Top Title & Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Boxes className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            Spare Parts & Inventory Store
          </h1>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Track workshop spare parts, consumables, stock levels, and real-time job card issuance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Tab Switcher: Stock vs Consumption Logs */}
          <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center">
            <button
              onClick={() => setActiveTab('STOCK')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                activeTab === 'STOCK'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              📦 Inventory Stock ({totalItemsCount})
            </button>
            <button
              onClick={() => setActiveTab('LOGS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                activeTab === 'LOGS'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              📜 Consumption History ({consumptionLogs.length})
            </button>
          </div>

          {/* Add Item Button for Managers */}
          {isManager && (
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-md shadow-blue-600/20 transition-all shrink-0"
            >
              <Plus className="w-4 h-4" /> Add Inventory Item
            </button>
          )}
        </div>
      </div>

      {/* METRICS CARDS OVERVIEW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Stock Items */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total SKUs Listed</p>
            <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{totalItemsCount}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Across 7 Categories</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Inventory Valuation */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Stock Valuation (Cost)</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">₹{totalStockValue.toLocaleString('en-IN')}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Retail: ₹{totalSellingVal.toLocaleString('en-IN')}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Low Stock Warning */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Low Stock Warnings</p>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{lowStockItems.length}</p>
            <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">Needs restock soon</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Out of Stock */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">Out of Stock</p>
            <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{outOfStockItems.length}</p>
            <p className="text-[10px] text-rose-600/80 dark:text-rose-400/80 mt-0.5">Requisition needed on jobs</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <XCircle className="w-6 h-6" />
          </div>
        </div>

      </div>

      {activeTab === 'STOCK' ? (
        <>
          {/* SEARCH & FILTERS BAR */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            
            {/* Search Box */}
            <div className="relative grow max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search part name, SKU number, shelf rack..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                <option value="ALL">All Categories</option>
                <option value="SPARES">Spare Parts</option>
                <option value="CONSUMABLES">Consumables</option>
                <option value="OILS_LUBRICANTS">Oils & Lubricants</option>
                <option value="TYRES_BATTERIES">Tyres & Batteries</option>
                <option value="ELECTRICAL">Electricals</option>
                <option value="DETAILING_WASH">Detailing & Wash</option>
                <option value="TOOLS_EQUIPMENT">Tools & Equipment</option>
              </select>

              {/* Stock Status Filter */}
              <select
                value={stockStatusFilter}
                onChange={(e) => setStockStatusFilter(e.target.value)}
                className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                <option value="ALL">All Stock Levels</option>
                <option value="IN_STOCK">In Stock</option>
                <option value="LOW_STOCK">⚠️ Low Stock Alerts</option>
                <option value="OUT_OF_STOCK">🚨 Out of Stock</option>
              </select>
            </div>
          </div>

          {/* INVENTORY TABLE */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            {filteredItems.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <Package className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
                <p className="text-sm font-bold text-slate-600 dark:text-slate-400">No inventory items matched your filter.</p>
                <button
                  onClick={() => { setSearchQuery(''); setCategoryFilter('ALL'); setStockStatusFilter('ALL'); }}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-black tracking-wider text-[10px]">
                      <th className="py-3 px-4">Item & SKU</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Stock Level</th>
                      <th className="py-3 px-4">Purchase / Retail Price</th>
                      <th className="py-3 px-4">Shelf / Vendor</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {filteredItems.map((item) => {
                      const isLow = item.stockQuantity > 0 && item.stockQuantity <= item.minStockAlert;
                      const isOut = item.stockQuantity === 0;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                          
                          {/* Item Name & SKU */}
                          <td className="py-3 px-4">
                            <div className="space-y-0.5">
                              <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100 block">
                                {item.name}
                              </span>
                              <span className="font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                SKU: {item.partNumber}
                              </span>
                            </div>
                          </td>

                          {/* Category Badge */}
                          <td className="py-3 px-4">
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {item.category.replace('_', ' ')}
                            </span>
                          </td>

                          {/* Stock Level */}
                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-base font-black font-mono ${
                                  isOut ? 'text-rose-600 dark:text-rose-400' :
                                  isLow ? 'text-amber-600 dark:text-amber-400' :
                                  'text-emerald-600 dark:text-emerald-400'
                                }`}>
                                  {item.stockQuantity} {item.unit}
                                </span>

                                {isOut ? (
                                  <span className="px-2 py-0.2 rounded text-[9px] font-black bg-rose-500/10 text-rose-600 dark:text-rose-400 uppercase">
                                    OUT OF STOCK
                                  </span>
                                ) : isLow ? (
                                  <span className="px-2 py-0.2 rounded text-[9px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 uppercase">
                                    LOW STOCK
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.2 rounded text-[9px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 uppercase">
                                    IN STOCK
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400">Min Alert: {item.minStockAlert} {item.unit}</p>
                            </div>
                          </td>

                          {/* Pricing */}
                          <td className="py-3 px-4 font-mono">
                            <div className="space-y-0.5">
                              <span className="font-bold text-slate-900 dark:text-slate-100 block">
                                Retail: ₹{item.sellingPrice.toLocaleString('en-IN')}
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                Cost: ₹{item.unitCost.toLocaleString('en-IN')}
                              </span>
                            </div>
                          </td>

                          {/* Shelf Location & Vendor */}
                          <td className="py-3 px-4">
                            <div className="space-y-0.5">
                              <span className="font-bold text-slate-800 dark:text-slate-200 block">
                                📍 {item.shelfLocation || 'Main Store'}
                              </span>
                              <span className="text-[10px] text-slate-400 truncate max-w-[150px] block">
                                {item.supplierVendorName || 'Standard Supplier'}
                              </span>
                            </div>
                          </td>

                          {/* Action Buttons */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Restock Button */}
                              {isManager && (
                                <button
                                  onClick={() => { setRestockItemId(item.id); setRestockQty(10); }}
                                  className="px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                >
                                  <RotateCcw className="w-3 h-3" /> Restock
                                </button>
                              )}

                              {isManager && (
                                <button
                                  onClick={() => handleOpenEditModal(item)}
                                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                              )}

                              {currentRole === 'SUPER_ADMIN' && (
                                <button
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="p-1.5 text-rose-400 hover:text-rose-600 rounded-lg"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
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
        </>
      ) : (
        /* CONSUMPTION LOGS VIEW */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              Real-Time Stock Consumption Audit Log
            </h2>
            <span className="text-xs text-slate-500">
              {consumptionLogs.length} Stock Issuance Events
            </span>
          </div>

          {consumptionLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs italic">
              No parts have been consumed directly from stock on job cards yet.
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              {consumptionLogs.map((log) => (
                <div key={log.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900 dark:text-slate-100">{log.itemName}</span>
                      <span className="px-2 py-0.2 rounded font-mono font-bold text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        Qty Consumed: {log.quantityConsumed}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Job Card ID: <strong className="text-slate-800 dark:text-slate-200">{log.jobCardId}</strong> • Task ID: {log.taskId}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Issued to Mechanic: {log.consumedByEmployeeName || 'Staff'} • Time: {log.consumedAt}
                    </p>
                  </div>

                  <div className="text-right font-mono font-bold text-slate-900 dark:text-slate-100 shrink-0">
                    Total Value: ₹{log.totalCost.toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ADD / EDIT ITEM MODAL */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 max-w-lg w-full space-y-4 shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-slate-100">
                {editingItemId ? 'Edit Inventory Item' : 'Add New Inventory Stock Item'}
              </h3>
              <button onClick={() => setShowItemModal(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Part / Item Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Synthetic Engine Oil 5W30 (1L)"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Part / SKU Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. OIL-5W30-SYN"
                    value={formData.partNumber}
                    onChange={(e) => setFormData({ ...formData, partNumber: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as InventoryCategory })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                  >
                    <option value="SPARES">Spare Parts</option>
                    <option value="CONSUMABLES">Consumables</option>
                    <option value="OILS_LUBRICANTS">Oils & Lubricants</option>
                    <option value="TYRES_BATTERIES">Tyres & Batteries</option>
                    <option value="ELECTRICAL">Electricals</option>
                    <option value="DETAILING_WASH">Detailing & Wash</option>
                    <option value="TOOLS_EQUIPMENT">Tools & Equipment</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Initial Stock Qty</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.stockQuantity}
                    onChange={(e) => setFormData({ ...formData, stockQuantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Unit Type</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                  >
                    <option value="Pcs">Pcs</option>
                    <option value="Liters">Liters</option>
                    <option value="Bottles">Bottles</option>
                    <option value="Cans">Cans</option>
                    <option value="Sets">Sets</option>
                    <option value="Packs">Packs</option>
                    <option value="Kgs">Kgs</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Purchase Cost (₹)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.unitCost}
                    onChange={(e) => setFormData({ ...formData, unitCost: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Selling Retail Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Low Stock Alert Level</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.minStockAlert}
                    onChange={(e) => setFormData({ ...formData, minStockAlert: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Shelf / Rack Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Rack A-2"
                    value={formData.shelfLocation}
                    onChange={(e) => setFormData({ ...formData, shelfLocation: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-extrabold shadow-md"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK RESTOCK MODAL */}
      {restockItemId && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 max-w-sm w-full space-y-4 shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
              Restock Item Quantity
            </h3>
            <form onSubmit={handleRestockSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Quantity to Add (+)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={restockQty}
                  onChange={(e) => setRestockQty(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-base"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRestockItemId(null)}
                  className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-extrabold"
                >
                  Confirm Restock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
