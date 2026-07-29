import React, { useState } from 'react';
import { TaskRequisition, UserRole, InventoryItem } from '../types';
import { 
  addRequisitionToTask, 
  respondToRequisition, 
  markRequisitionStatus, 
  consumeRequisitionPart, 
  getInventoryItems 
} from '../lib/storage';
import { 
  Package, 
  Plus, 
  CheckCircle2, 
  Clock, 
  Truck, 
  AlertCircle, 
  Bell, 
  Zap, 
  X, 
  DollarSign, 
  FileText, 
  ShieldCheck, 
  ChevronRight,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface PartRequisitionTrackerProps {
  jobCardId: string;
  taskId: string;
  taskTitle: string;
  requisitions?: TaskRequisition[];
  currentRole: UserRole;
  currentEmployeeName?: string;
  onUpdate?: () => void;
}

export function PartRequisitionTracker({
  jobCardId,
  taskId,
  taskTitle,
  requisitions = [],
  currentRole,
  currentEmployeeName,
  onUpdate
}: PartRequisitionTrackerProps) {
  const isManager = currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN' || currentRole === 'FLOOR_MANAGER';
  const inventoryItems = getInventoryItems();

  // New Requisition Form state
  const [showForm, setShowForm] = useState(false);
  const [selectedInvId, setSelectedInvId] = useState('');
  const [partTitle, setPartTitle] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [urgency, setUrgency] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');
  const [reason, setReason] = useState('');
  const [suggestedPrice, setSuggestedPrice] = useState<number | ''>('');

  // Manager Approval State
  const [approvingReqId, setApprovingReqId] = useState<string | null>(null);
  const [approvedPrice, setApprovedPrice] = useState<number>(0);
  const [managerNotes, setManagerNotes] = useState('');

  // Feedback Toast State
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 3500);
  };

  // When selecting an inventory item from dropdown
  const handleSelectInventoryItem = (invId: string) => {
    setSelectedInvId(invId);
    if (!invId) {
      setPartTitle('');
      setPartNumber('');
      setSuggestedPrice('');
      return;
    }
    const item = inventoryItems.find(i => i.id === invId);
    if (item) {
      setPartTitle(item.name);
      setPartNumber(item.partNumber || '');
      setSuggestedPrice(item.unitCost || item.sellingPrice || 0);
    }
  };

  const handleRaiseRequisition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partTitle.trim()) {
      showToast('error', 'Please enter a required part name or select from inventory');
      return;
    }

    addRequisitionToTask(jobCardId, taskId, {
      requestedByEmployeeId: currentRole,
      requestedByEmployeeName: currentEmployeeName || `${currentRole} Staff`,
      title: partTitle.trim(),
      itemType: 'PART',
      quantity: Number(quantity) || 1,
      urgency,
      reason: reason.trim() || 'Part not available in stock. Requisition raised.',
      suggestedPrice: Number(suggestedPrice) || 0,
      partNumber: partNumber.trim() || undefined,
      inventoryItemId: selectedInvId || undefined,
    });

    showToast('success', `Requisition raised for "${partTitle}". Awaiting Manager Approval.`);
    setPartTitle('');
    setPartNumber('');
    setSelectedInvId('');
    setReason('');
    setQuantity(1);
    setSuggestedPrice('');
    setShowForm(false);
    if (onUpdate) onUpdate();
  };

  const handleApproveRequisition = (reqId: string) => {
    respondToRequisition(jobCardId, taskId, reqId, true, Number(approvedPrice) || 0, managerNotes);
    showToast('success', 'Requisition approved by manager!');
    setApprovingReqId(null);
    setApprovedPrice(0);
    setManagerNotes('');
    if (onUpdate) onUpdate();
  };

  const handleRejectRequisition = (reqId: string) => {
    respondToRequisition(jobCardId, taskId, reqId, false, 0, 'Rejected by manager');
    showToast('error', 'Requisition rejected.');
    if (onUpdate) onUpdate();
  };

  const handleMarkOrdered = (reqId: string) => {
    markRequisitionStatus(jobCardId, taskId, reqId, 'ORDERED');
    showToast('success', 'Part marked as ORDERED from supplier!');
    if (onUpdate) onUpdate();
  };

  const handleMarkReceived = (reqId: string) => {
    markRequisitionStatus(jobCardId, taskId, reqId, 'RECEIVED');
    showToast('success', 'Part RECEIVED at workshop! Mechanic has been notified.');
    if (onUpdate) onUpdate();
  };

  const handleConsumePart = (reqId: string) => {
    const res = consumeRequisitionPart(
      jobCardId,
      taskId,
      reqId,
      currentRole,
      currentEmployeeName || `${currentRole} Mechanic`
    );

    if (res.success) {
      showToast('success', res.message);
      if (onUpdate) onUpdate();
    } else {
      showToast('error', res.message);
    }
  };

  const pendingCount = requisitions.filter(r => r.status === 'PENDING_APPROVAL').length;
  const receivedCount = requisitions.filter(r => r.status === 'RECEIVED').length;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 p-4 space-y-4 text-xs">
      
      {/* Toast Notification */}
      {toastMsg && (
        <div className={`p-3 rounded-xl border flex items-center justify-between gap-2 shadow-lg animate-in fade-in slide-in-from-top-2 ${
          toastMsg.type === 'success' 
            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-900 dark:text-emerald-200' 
            : 'bg-rose-500/15 border-rose-500/40 text-rose-900 dark:text-rose-200'
        }`}>
          <div className="flex items-center gap-2 font-bold">
            {toastMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-rose-500" />}
            <span>{toastMsg.text}</span>
          </div>
          <button onClick={() => setToastMsg(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Received Alert Banner for Mechanic */}
      {receivedCount > 0 && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/40 text-emerald-900 dark:text-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <p className="font-extrabold text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <span>Part Received at Store! Ready for Installation</span>
                <span className="bg-emerald-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                  {receivedCount} Ready
                </span>
              </p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                The requested spare part has arrived at workshop store. Click <strong className="underline">"Consume Part"</strong> below to install and attach to job card.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Component Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Part Requisition Tracker</span>
              {requisitions.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {requisitions.length}
                </span>
              )}
            </h4>
            <p className="text-[11px] text-slate-500">
              Flag missing parts &rarr; Manager Approval &rarr; Store Receipt &rarr; One-Click Consumption
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>{showForm ? 'Cancel Request' : 'Raise Part Requisition'}</span>
        </button>
      </div>

      {/* Form to Raise Requisition */}
      {showForm && (
        <form onSubmit={handleRaiseRequisition} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-amber-500/30 space-y-3.5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <span className="font-extrabold text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 uppercase tracking-wide">
              <Zap className="w-3.5 h-3.5" /> Raise Part Requisition (Out of Stock Item)
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Task: {taskTitle}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Quick Select from Inventory */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Select from Workshop Inventory (Optional)
              </label>
              <select
                value={selectedInvId}
                onChange={(e) => handleSelectInventoryItem(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium text-slate-900 dark:text-slate-100"
              >
                <option value="">-- Custom Required Part --</option>
                {inventoryItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.partNumber}) - Stock: {item.stockQuantity} {item.unit} (₹{item.unitCost})
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Part Title */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Part / Spare Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Front Brake Pad Set / Oil Filter"
                value={partTitle}
                onChange={(e) => setPartTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-bold"
              />
            </div>

            {/* Part Number */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Part Number / OEM Code
              </label>
              <input
                type="text"
                placeholder="e.g. OEM-04465-0K280"
                value={partNumber}
                onChange={(e) => setPartNumber(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Required Quantity
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Urgency */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Urgency Level
              </label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-slate-100"
              >
                <option value="LOW">Low - General Stockup</option>
                <option value="MEDIUM">Medium - Normal Repair</option>
                <option value="HIGH">High - Vehicle Blocked</option>
                <option value="CRITICAL">Critical - Urgent Delivery Today</option>
              </select>
            </div>

            {/* Estimated Unit Price */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Estimated Cost / Price (₹)
              </label>
              <input
                type="number"
                placeholder="e.g. 1250"
                value={suggestedPrice}
                onChange={(e) => setSuggestedPrice(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              Reason / Stocking Notes
            </label>
            <input
              type="text"
              placeholder="e.g. Out of stock in bay 3, required for front assembly repair."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Submit Requisition Request</span>
            </button>
          </div>
        </form>
      )}

      {/* List of Requisitions */}
      {requisitions.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-1">
          <Package className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
          <p className="text-slate-500 font-medium">No part requisitions flagged for this task.</p>
          <p className="text-[11px] text-slate-400">
            If a required part is out of stock, click <strong className="text-amber-600 dark:text-amber-400">"Raise Part Requisition"</strong> above.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requisitions.map((req) => {
            const isPending = req.status === 'PENDING_APPROVAL';
            const isApproved = req.status === 'APPROVED';
            const isOrdered = req.status === 'ORDERED';
            const isReceived = req.status === 'RECEIVED';
            const isConsumed = req.status === 'CONSUMED';
            const isRejected = req.status === 'REJECTED';

            return (
              <div
                key={req.id}
                className={`p-4 rounded-2xl border transition-all space-y-3 ${
                  isReceived
                    ? 'bg-emerald-500/10 border-emerald-500/50 shadow-md'
                    : isConsumed
                    ? 'bg-slate-100 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 opacity-90'
                    : isApproved || isOrdered
                    ? 'bg-blue-500/10 border-blue-500/30'
                    : isRejected
                    ? 'bg-rose-500/10 border-rose-500/30'
                    : 'bg-white dark:bg-slate-900 border-amber-500/30 shadow-xs'
                }`}
              >
                {/* Requisition Card Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                        {req.title}
                      </span>
                      {req.partNumber && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          OEM: {req.partNumber}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                        Qty: {req.quantity}
                      </span>
                      {req.urgency && (
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                          req.urgency === 'CRITICAL' ? 'bg-rose-600 text-white' :
                          req.urgency === 'HIGH' ? 'bg-amber-500 text-slate-950 font-bold' :
                          'bg-slate-200 text-slate-700'
                        }`}>
                          {req.urgency} Urgency
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-3 flex-wrap pt-0.5">
                      <span>Requested by: <strong>{req.requestedByEmployeeName}</strong></span>
                      <span>•</span>
                      <span>Created: {req.createdAt}</span>
                    </div>
                  </div>

                  {/* Status Pill Badge */}
                  <div className="shrink-0">
                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase flex items-center gap-1.5 ${
                      isConsumed ? 'bg-slate-700 text-white' :
                      isReceived ? 'bg-emerald-500 text-slate-950 font-black animate-bounce shadow-sm' :
                      isOrdered ? 'bg-indigo-600 text-white' :
                      isApproved ? 'bg-blue-600 text-white' :
                      isRejected ? 'bg-rose-600 text-white' :
                      'bg-amber-500 text-slate-950'
                    }`}>
                      {isConsumed && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {isReceived && <Bell className="w-3.5 h-3.5" />}
                      {isOrdered && <Truck className="w-3.5 h-3.5" />}
                      {isApproved && <ShieldCheck className="w-3.5 h-3.5" />}
                      {isPending && <Clock className="w-3.5 h-3.5" />}
                      <span>
                        {isPending ? 'Pending Approval' :
                         isApproved ? 'Approved by Manager' :
                         isOrdered ? 'Ordered from Supplier' :
                         isReceived ? 'Received at Store' :
                         isConsumed ? 'Consumed' : 'Rejected'}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Reason & Notes */}
                {req.reason && (
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-200 dark:border-slate-800">
                    <strong className="text-slate-700 dark:text-slate-200">Mechanic Note:</strong> {req.reason}
                  </p>
                )}

                {/* Approved Price & Timestamps */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 flex-wrap gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    {req.approvedPrice ? (
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-xs font-mono">
                        Approved Price: ₹{req.approvedPrice.toLocaleString('en-IN')}
                      </span>
                    ) : req.suggestedPrice ? (
                      <span className="font-medium text-slate-500 font-mono">
                        Est. Price: ₹{req.suggestedPrice.toLocaleString('en-IN')}
                      </span>
                    ) : null}

                    {req.approvedAt && <span className="text-[10px] text-slate-400">Approved: {req.approvedAt}</span>}
                    {req.receivedAt && <span className="text-[10px] text-emerald-600 font-bold">Received: {req.receivedAt}</span>}
                    {req.consumedAt && <span className="text-[10px] text-slate-500 font-bold">Consumed: {req.consumedAt}</span>}
                  </div>
                </div>

                {/* 1. MANAGER APPROVAL CONTROLS */}
                {isManager && isPending && (
                  <div className="pt-2 border-t border-amber-500/20 flex items-center justify-between gap-3 flex-wrap">
                    {approvingReqId === req.id ? (
                      <div className="w-full flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700">
                        <input
                          type="number"
                          placeholder="Approved Price ₹"
                          value={approvedPrice}
                          onChange={(e) => setApprovedPrice(Number(e.target.value))}
                          className="w-36 px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                        />
                        <button
                          type="button"
                          onClick={() => handleApproveRequisition(req.id)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black shadow-xs"
                        >
                          Confirm Approval
                        </button>
                        <button
                          type="button"
                          onClick={() => setApprovingReqId(null)}
                          className="px-2.5 py-1.5 bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-amber-700 dark:text-amber-300 font-bold text-[11px]">
                          Manager Action Required:
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setApprovingReqId(req.id);
                              setApprovedPrice(req.suggestedPrice || 0);
                            }}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold shadow-sm flex items-center gap-1"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Approve Requisition</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectRequisition(req.id)}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold"
                          >
                            Reject
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* 2. MANAGER / STORE ORDER & RECEIPT ACTIONS */}
                {isManager && (isApproved || isOrdered) && (
                  <div className="pt-2 border-t border-blue-500/20 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-blue-700 dark:text-blue-300 font-bold text-[11px]">
                      Workshop Inventory Logistics:
                    </span>
                    <div className="flex items-center gap-2">
                      {isApproved && (
                        <button
                          type="button"
                          onClick={() => handleMarkOrdered(req.id)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>Mark as Ordered</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleMarkReceived(req.id)}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-sm flex items-center gap-1.5"
                      >
                        <Package className="w-3.5 h-3.5" />
                        <span>Mark Received at Store</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. MECHANIC ONE-CLICK CONSUME BUTTON */}
                {isReceived && (
                  <div className="pt-2 border-t border-emerald-500/30 flex items-center justify-between gap-3 bg-emerald-500/10 p-3 rounded-xl">
                    <div className="space-y-0.5">
                      <p className="font-black text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        Ready for Installation!
                      </p>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                        Clicking consume will issue this part to the task & log stock deduction.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleConsumePart(req.id)}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 shrink-0"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Consume Part Now</span>
                    </button>
                  </div>
                )}

                {/* 4. CONSUMED CONFIRMATION FOOTER */}
                {isConsumed && (
                  <div className="pt-2 border-t border-slate-300 dark:border-slate-700 flex items-center justify-between text-slate-600 dark:text-slate-400 text-[11px]">
                    <span className="font-bold flex items-center gap-1 text-slate-700 dark:text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      Part consumed and attached to Job Card billing.
                    </span>
                    <span className="font-mono text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded">
                      Status: CONSUMED
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
