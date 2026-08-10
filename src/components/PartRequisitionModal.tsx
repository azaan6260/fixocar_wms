import React, { useState } from 'react';
import { JobCard, TaskRequisition, InventoryItem } from '../types';
import { 
  addRequisitionToTask, 
  getInventoryItems, 
  consumeRequisitionPart, 
  updateJobCard,
  saveInventoryItems 
} from '../lib/storage';
import { 
  X, 
  PackageCheck, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Boxes, 
  Search, 
  Wrench, 
  User, 
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Tag
} from 'lucide-react';

interface PartRequisitionModalProps {
  card: JobCard;
  isOpen: boolean;
  onClose: () => void;
  currentEmployeeName?: string;
  currentEmployeeId?: string;
  onSuccess?: () => void;
}

export function PartRequisitionModal({
  card,
  isOpen,
  onClose,
  currentEmployeeName = 'Workshop Specialist',
  currentEmployeeId = 'emp-101',
  onSuccess,
}: PartRequisitionModalProps) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'request' | 'inventory' | 'history'>('request');
  
  // Request Form State
  const [selectedTaskId, setSelectedTaskId] = useState<string>(
    card.tasks[0]?.id || ''
  );
  const [title, setTitle] = useState('');
  const [itemType, setItemType] = useState<'PART' | 'CONSUMABLE' | 'ADDITIONAL_WORK'>('PART');
  const [quantity, setQuantity] = useState(1);
  const [urgency, setUrgency] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');
  const [partNumber, setPartNumber] = useState('');
  const [suggestedPrice, setSuggestedPrice] = useState<number | ''>('');
  const [reason, setReason] = useState('');

  // Direct Inventory Consumption State
  const [inventorySearch, setInventorySearch] = useState('');
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null);
  const [inventoryQty, setInventoryQty] = useState(1);
  const [inventoryTaskId, setInventoryTaskId] = useState<string>(
    card.tasks[0]?.id || ''
  );

  const inventoryItems = getInventoryItems();
  const filteredInventory = inventoryItems.filter(item => 
    item.name.toLowerCase().includes(inventorySearch.toLowerCase()) ||
    item.partNumber.toLowerCase().includes(inventorySearch.toLowerCase()) ||
    item.category.toLowerCase().includes(inventorySearch.toLowerCase())
  );

  // Compile all existing requisitions for this card
  const allRequisitions = React.useMemo(() => {
    const list: { taskTitle: string; req: TaskRequisition }[] = [];
    card.tasks.forEach(t => {
      if (t.requisitions) {
        t.requisitions.forEach(r => {
          list.push({ taskTitle: t.title, req: r });
        });
      }
    });
    return list;
  }, [card]);

  const handleCreateRequisition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    let targetTask = card.tasks.find(t => t.id === selectedTaskId);
    let targetTaskId = selectedTaskId;

    // If no task exists, create a default task or use the first task
    if (!targetTask) {
      if (card.tasks.length > 0) {
        targetTask = card.tasks[0];
        targetTaskId = targetTask.id;
      } else {
        alert('Please create at least one task on the job card first.');
        return;
      }
    }

    addRequisitionToTask(card.id, targetTaskId, {
      requestedByEmployeeId: currentEmployeeId,
      requestedByEmployeeName: currentEmployeeName,
      title: title.trim(),
      itemType,
      quantity: Number(quantity) || 1,
      urgency,
      reason: reason.trim() || undefined,
      suggestedPrice: suggestedPrice !== '' ? Number(suggestedPrice) : undefined,
      partNumber: partNumber.trim() || undefined,
      inventoryItemId: selectedInventoryItem?.id
    });

    // Reset fields
    setTitle('');
    setPartNumber('');
    setSuggestedPrice('');
    setReason('');
    alert('Part Requisition submitted successfully! Sent to Floor Manager for approval.');
    if (onSuccess) onSuccess();
    setActiveTab('history');
  };

  const handleDirectInventoryConsume = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInventoryItem) return;

    if (selectedInventoryItem.stockQuantity < inventoryQty) {
      alert(`Insufficient stock! Only ${selectedInventoryItem.stockQuantity} ${selectedInventoryItem.unit} available in inventory.`);
      return;
    }

    let targetTaskId = inventoryTaskId || card.tasks[0]?.id;
    if (!targetTaskId && card.tasks.length > 0) {
      targetTaskId = card.tasks[0].id;
    }

    if (!targetTaskId) {
      alert('Please create at least one task on the job card first.');
      return;
    }

    // 1. Add requisition as already APPROVED & CONSUMED
    const req = addRequisitionToTask(card.id, targetTaskId, {
      requestedByEmployeeId: currentEmployeeId,
      requestedByEmployeeName: currentEmployeeName,
      title: selectedInventoryItem.name,
      itemType: selectedInventoryItem.category === 'CONSUMABLES' || selectedInventoryItem.category === 'OILS_LUBRICANTS' ? 'CONSUMABLE' : 'PART',
      quantity: Number(inventoryQty),
      urgency: 'HIGH',
      suggestedPrice: selectedInventoryItem.sellingPrice * inventoryQty,
      partNumber: selectedInventoryItem.partNumber,
      inventoryItemId: selectedInventoryItem.id,
      reason: 'Direct Stock Consumption from Mobile App'
    });

    // 2. Mark consumed
    consumeRequisitionPart(card.id, targetTaskId, req.id, currentEmployeeId, currentEmployeeName);

    alert(`Successfully fitted & consumed ${inventoryQty}x ${selectedInventoryItem.name}!`);
    setSelectedInventoryItem(null);
    setInventoryQty(1);
    if (onSuccess) onSuccess();
    setActiveTab('history');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh]">
        
        {/* Header Bar */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-md">
              <PackageCheck className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-amber-400">{card.id}</span>
                <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-mono">
                  {card.vehicle.registrationNumber}
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-extrabold tracking-tight">
                Part Requisition & Consumption
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile Tab Pills Switcher */}
        <div className="p-2 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1 shrink-0 overflow-x-auto">
          {[
            { id: 'request', label: '+ Raise Requisition', icon: Plus },
            { id: 'inventory', label: 'Direct Stock Issue', icon: Boxes },
            { id: 'history', label: `History (${allRequisitions.length})`, icon: Clock },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto grow space-y-4">
          
          {/* TAB 1: RAISE REQUISITION FORM */}
          {activeTab === 'request' && (
            <form onSubmit={handleCreateRequisition} className="space-y-4 text-xs">
              
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-300 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px]">
                  Request spare parts or consumables needed for this vehicle. Floor Manager will review and approve stock allocation or market purchase.
                </p>
              </div>

              {/* Task Selection */}
              <div>
                <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">
                  Assign to Job Card Task *
                </label>
                <select
                  value={selectedTaskId}
                  onChange={(e) => setSelectedTaskId(e.target.value)}
                  className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500"
                >
                  {card.tasks.map(task => (
                    <option key={task.id} value={task.id}>
                      [{task.category}] {task.title} ({task.assignedToName || 'Unassigned'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Item Name & Part Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">
                    Part / Item Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Front Brake Pad Set / Syntium 5W30 Oil"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">
                    Part Number (OEM / Aftermarket)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 55810M79M00"
                    value={partNumber}
                    onChange={(e) => setPartNumber(e.target.value)}
                    className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Type, Quantity, Urgency */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">Category</label>
                  <select
                    value={itemType}
                    onChange={(e) => setItemType(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold text-slate-900 dark:text-slate-100 text-[11px]"
                  >
                    <option value="PART">Spare Part</option>
                    <option value="CONSUMABLE">Consumable</option>
                    <option value="ADDITIONAL_WORK">Extra Labor</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-black font-mono text-slate-900 dark:text-slate-100 text-center"
                  />
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">Urgency</label>
                  <select
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold text-slate-900 dark:text-slate-100 text-[11px]"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High 🔥</option>
                    <option value="CRITICAL">Critical ⚡</option>
                  </select>
                </div>
              </div>

              {/* Suggested Price & Reason */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">
                    Est. Unit Cost (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 1450"
                    value={suggestedPrice}
                    onChange={(e) => setSuggestedPrice(e.target.value ? Number(e.target.value) : '')}
                    className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">
                    Reason / Diagnostics Note
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Pads worn below 2mm limit"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-medium text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all"
                >
                  <PackageCheck className="w-5 h-5 stroke-[2.5]" />
                  <span>Submit Part Requisition</span>
                </button>
              </div>

            </form>
          )}

          {/* TAB 2: DIRECT INVENTORY STOCK ISSUE */}
          {activeTab === 'inventory' && (
            <form onSubmit={handleDirectInventoryConsume} className="space-y-4 text-xs">
              
              <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-900 dark:text-blue-300 flex items-start gap-2">
                <Boxes className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[11px]">
                  Directly consume spare parts or lubricants available in workshop inventory stock and log them instantly to this Job Card.
                </p>
              </div>

              {/* Search Inventory */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search inventory by part name, OEM code, category..."
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-medium text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Inventory Items Grid / List */}
              <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-2xl p-2 bg-slate-50/50 dark:bg-slate-900/50">
                {filteredInventory.length === 0 ? (
                  <p className="text-center text-slate-400 py-6 text-xs">No matching inventory items found.</p>
                ) : (
                  filteredInventory.map(item => {
                    const isSelected = selectedInventoryItem?.id === item.id;
                    const inStock = item.stockQuantity > 0;
                    return (
                      <div
                        key={item.id}
                        onClick={() => inStock && setSelectedInventoryItem(item)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500 text-amber-950 dark:text-amber-300 font-bold'
                            : inStock
                            ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                            : 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 dark:text-white">{item.name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                              PN: {item.partNumber}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">{item.category} • Selling Price: ₹{item.sellingPrice}</p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className={`text-xs font-black font-mono px-2 py-0.5 rounded-full ${
                            inStock ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-500'
                          }`}>
                            {item.stockQuantity} {item.unit}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Selected Item Stock Consume Details */}
              {selectedInventoryItem && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-800 dark:text-amber-300">Selected: {selectedInventoryItem.name}</span>
                    <span className="font-mono font-black text-amber-600">₹{selectedInventoryItem.sellingPrice * inventoryQty}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">Task Assignment</label>
                      <select
                        value={inventoryTaskId}
                        onChange={(e) => setInventoryTaskId(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold"
                      >
                        {card.tasks.map(t => (
                          <option key={t.id} value={t.id}>{t.title}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">Quantity to Fit</label>
                      <input
                        type="number"
                        min="1"
                        max={selectedInventoryItem.stockQuantity}
                        value={inventoryQty}
                        onChange={(e) => setInventoryQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-black font-mono text-center"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Fit Part & Deduct Inventory Stock</span>
                  </button>
                </div>
              )}

            </form>
          )}

          {/* TAB 3: REQUISITION & CONSUMPTION HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-3 text-xs">
              {allRequisitions.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
                  <PackageCheck className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                  <p className="font-bold text-slate-700 dark:text-slate-300">No Requisitions Raised Yet</p>
                  <p className="text-slate-400 text-[11px]">Use the tabs above to raise a part requisition or consume inventory.</p>
                </div>
              ) : (
                allRequisitions.map(({ taskTitle, req }) => {
                  const isConsumed = req.status === 'CONSUMED' || req.consumedAt;
                  const isApproved = req.status === 'APPROVED' || req.status === 'RECEIVED' || req.status === 'ORDERED';
                  const isPending = req.status === 'PENDING_APPROVAL';

                  return (
                    <div
                      key={req.id}
                      className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-amber-600 dark:text-amber-400">{req.id}</span>
                            <span className="font-bold text-slate-900 dark:text-white">{req.title}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Task: {taskTitle} • Qty: {req.quantity}
                          </p>
                        </div>

                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${
                          isConsumed
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : isApproved
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                            : isPending
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 animate-pulse'
                            : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                        }`}>
                          {req.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-700/60">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          Requested by {req.requestedByEmployeeName}
                        </span>
                        <span className="font-mono text-slate-500">{req.createdAt}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
