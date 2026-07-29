import React, { useState } from 'react';
import { JobCard, UserRole, TaskRequisition } from '../types';
import { respondToRequisition, markRequisitionStatus } from '../lib/storage';
import { 
  Package, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Truck, 
  AlertCircle, 
  ChevronRight, 
  ShieldCheck, 
  Sparkles, 
  Search, 
  DollarSign, 
  User, 
  Calendar, 
  FileText,
  Filter,
  Check,
  X
} from 'lucide-react';

interface ManagerRequisitionApprovalViewProps {
  jobCards: JobCard[];
  onOpenJobCard: (id: string) => void;
  currentRole: UserRole;
}

export function ManagerRequisitionApprovalView({
  jobCards,
  onOpenJobCard,
  currentRole
}: ManagerRequisitionApprovalViewProps) {
  const [filterTab, setFilterTab] = useState<'PENDING' | 'IN_TRANSIT' | 'CONSUMED' | 'REJECTED' | 'ALL'>('PENDING');
  const [searchTerm, setSearchTerm] = useState('');

  // Per-item approval inputs state: { [requisitionId]: { price: number | '', notes: string } }
  const [approvalInputs, setApprovalInputs] = useState<{
    [reqId: string]: { price: number | ''; notes: string };
  }>({});

  // Toast feedback state
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Collect all requisitions with card & task context
  const allRequisitionItems = React.useMemo(() => {
    const list: {
      card: JobCard;
      task: JobCard['tasks'][0];
      requisition: TaskRequisition;
    }[] = [];

    jobCards.forEach((card) => {
      if (card.status !== 'CLOSED' && card.status !== 'DELIVERED') {
        card.tasks.forEach((task) => {
          (task.requisitions || []).forEach((req) => {
            list.push({ card, task, requisition: req });
          });
        });
      }
    });

    // Sort by pending first, then by date newest
    return list.sort((a, b) => {
      if (a.requisition.status === 'PENDING_APPROVAL' && b.requisition.status !== 'PENDING_APPROVAL') return -1;
      if (a.requisition.status !== 'PENDING_APPROVAL' && b.requisition.status === 'PENDING_APPROVAL') return 1;
      return new Date(b.requisition.createdAt).getTime() - new Date(a.requisition.createdAt).getTime();
    });
  }, [jobCards]);

  // Counts
  const pendingCount = allRequisitionItems.filter(i => i.requisition.status === 'PENDING_APPROVAL').length;
  const inTransitCount = allRequisitionItems.filter(i => i.requisition.status === 'APPROVED' || i.requisition.status === 'ORDERED' || i.requisition.status === 'RECEIVED').length;
  const consumedCount = allRequisitionItems.filter(i => i.requisition.status === 'CONSUMED').length;
  const rejectedCount = allRequisitionItems.filter(i => i.requisition.status === 'REJECTED').length;

  // Filtered items based on active tab and search query
  const filteredItems = allRequisitionItems.filter(({ card, task, requisition: req }) => {
    // Tab filter
    if (filterTab === 'PENDING' && req.status !== 'PENDING_APPROVAL') return false;
    if (filterTab === 'IN_TRANSIT' && !(req.status === 'APPROVED' || req.status === 'ORDERED' || req.status === 'RECEIVED')) return false;
    if (filterTab === 'CONSUMED' && req.status !== 'CONSUMED') return false;
    if (filterTab === 'REJECTED' && req.status !== 'REJECTED') return false;

    // Search query filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchTitle = req.title.toLowerCase().includes(q);
      const matchPartNo = (req.partNumber || '').toLowerCase().includes(q);
      const matchReg = card.vehicle.registrationNumber.toLowerCase().includes(q);
      const matchCardId = card.id.toLowerCase().includes(q);
      const matchRequestedBy = (req.requestedByEmployeeName || '').toLowerCase().includes(q);
      return matchTitle || matchPartNo || matchReg || matchCardId || matchRequestedBy;
    }

    return true;
  });

  // Handle Input Changes for specific requisition
  const handleInputChange = (reqId: string, field: 'price' | 'notes', value: any) => {
    setApprovalInputs(prev => ({
      ...prev,
      [reqId]: {
        price: field === 'price' ? value : (prev[reqId]?.price ?? ''),
        notes: field === 'notes' ? value : (prev[reqId]?.notes ?? '')
      }
    }));
  };

  // Approve Requisition
  const handleApprove = (cardId: string, taskId: string, req: TaskRequisition) => {
    const inputs = approvalInputs[req.id];
    const finalPrice = inputs?.price !== undefined && inputs.price !== '' 
      ? Number(inputs.price) 
      : (req.suggestedPrice || 0);

    const notes = inputs?.notes || 'Approved by Manager';

    respondToRequisition(cardId, taskId, req.id, true, finalPrice, notes);
    showToast('success', `Approved requisition for "${req.title}" (₹${finalPrice.toLocaleString('en-IN')})`);
  };

  // Reject Requisition
  const handleReject = (cardId: string, taskId: string, req: TaskRequisition) => {
    const inputs = approvalInputs[req.id];
    const notes = inputs?.notes || 'Rejected by Manager';

    respondToRequisition(cardId, taskId, req.id, false, 0, notes);
    showToast('error', `Rejected requisition for "${req.title}"`);
  };

  // Mark Ordered
  const handleMarkOrdered = (cardId: string, taskId: string, reqId: string) => {
    markRequisitionStatus(cardId, taskId, reqId, 'ORDERED');
    showToast('success', 'Part marked as ORDERED from supplier!');
  };

  // Mark Received
  const handleMarkReceived = (cardId: string, taskId: string, reqId: string) => {
    markRequisitionStatus(cardId, taskId, reqId, 'RECEIVED');
    showToast('success', 'Part RECEIVED at store! Mechanic notified.');
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-5 shadow-xs">
      
      {/* Toast Notification */}
      {toastMsg && (
        <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-2 shadow-lg animate-in fade-in slide-in-from-top-2 ${
          toastMsg.type === 'success' 
            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-900 dark:text-emerald-200' 
            : 'bg-rose-500/15 border-rose-500/40 text-rose-900 dark:text-rose-200'
        }`}>
          <div className="flex items-center gap-2 font-bold text-xs">
            {toastMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-rose-500" />}
            <span>{toastMsg.text}</span>
          </div>
          <button onClick={() => setToastMsg(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Manager Part Requisitions Queue</span>
              {pendingCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500 text-slate-950 animate-pulse">
                  {pendingCount} Pending
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Review mechanics' requests for out-of-stock parts, set approved pricing, & track store arrivals.
            </p>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search part, vehicle, OEM..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
        <button
          onClick={() => setFilterTab('PENDING')}
          className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all shrink-0 ${
            filterTab === 'PENDING'
              ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Pending Approvals</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/20 text-slate-900 dark:text-slate-100 font-extrabold">
            {pendingCount}
          </span>
        </button>

        <button
          onClick={() => setFilterTab('IN_TRANSIT')}
          className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all shrink-0 ${
            filterTab === 'IN_TRANSIT'
              ? 'bg-blue-600 text-white shadow-sm font-black'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          <span>Approved & Store Transit</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-extrabold">
            {inTransitCount}
          </span>
        </button>

        <button
          onClick={() => setFilterTab('CONSUMED')}
          className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all shrink-0 ${
            filterTab === 'CONSUMED'
              ? 'bg-emerald-600 text-white shadow-sm font-black'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Consumed</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-extrabold">
            {consumedCount}
          </span>
        </button>

        <button
          onClick={() => setFilterTab('REJECTED')}
          className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all shrink-0 ${
            filterTab === 'REJECTED'
              ? 'bg-rose-600 text-white shadow-sm font-black'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          <XCircle className="w-3.5 h-3.5" />
          <span>Rejected</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-extrabold">
            {rejectedCount}
          </span>
        </button>

        <button
          onClick={() => setFilterTab('ALL')}
          className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all shrink-0 ${
            filterTab === 'ALL'
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm font-black'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          <span>All Requisitions</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-500/20 font-extrabold">
            {allRequisitionItems.length}
          </span>
        </button>
      </div>

      {/* Requisition Cards Grid */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
          <Package className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <p className="text-xs text-slate-500 font-bold">No part requisitions found in this view.</p>
          <p className="text-[11px] text-slate-400">
            {filterTab === 'PENDING' 
              ? 'All mechanic part requests have been reviewed and approved!' 
              : 'Try selecting a different filter tab or clearing search term.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map(({ card, task, requisition: req }) => {
            const isPending = req.status === 'PENDING_APPROVAL';
            const isApproved = req.status === 'APPROVED';
            const isOrdered = req.status === 'ORDERED';
            const isReceived = req.status === 'RECEIVED';
            const isConsumed = req.status === 'CONSUMED';
            const isRejected = req.status === 'REJECTED';

            const currentPriceInput = approvalInputs[req.id]?.price ?? (req.suggestedPrice || '');
            const currentNotesInput = approvalInputs[req.id]?.notes ?? '';

            return (
              <div
                key={`${card.id}-${task.id}-${req.id}`}
                className={`p-4 sm:p-5 rounded-2xl border transition-all space-y-4 ${
                  isPending
                    ? 'bg-amber-500/5 border-amber-500/40 shadow-sm'
                    : isReceived
                    ? 'bg-emerald-500/10 border-emerald-500/40'
                    : isConsumed
                    ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-80'
                    : isRejected
                    ? 'bg-rose-500/5 border-rose-500/30'
                    : 'bg-white dark:bg-slate-900 border-blue-500/30'
                }`}
              >
                {/* Header Context Bar: Vehicle & Task Info */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-mono font-extrabold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                      🚘 {card.vehicle.registrationNumber} — {card.vehicle.make} {card.vehicle.model}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      Task: {task.title}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-[10px] font-mono text-slate-400">
                      Job Card ID: {card.id}
                    </span>
                  </div>

                  <button
                    onClick={() => onOpenJobCard(card.id)}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 self-start sm:self-auto"
                  >
                    <span>View Job Card</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Main Body: Requisition Info & Action Controls */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                  
                  {/* Left Column: Requisition Details */}
                  <div className="lg:col-span-7 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                        {req.title}
                      </h3>
                      {req.partNumber && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
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

                    <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-100/70 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                      <strong className="text-slate-800 dark:text-slate-200">Mechanic Reason:</strong> {req.reason || 'Out of stock in workshop, requisition raised.'}
                    </p>

                    <div className="flex items-center gap-4 text-[11px] text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        Requested by: <strong>{req.requestedByEmployeeName}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Time: {req.createdAt}
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Pricing & Approval Actions */}
                  <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                    
                    {/* Status Badge */}
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                      <span className="text-[11px] font-bold text-slate-500">Current Status</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase flex items-center gap-1 ${
                        isConsumed ? 'bg-slate-700 text-white' :
                        isReceived ? 'bg-emerald-500 text-slate-950' :
                        isOrdered ? 'bg-indigo-600 text-white' :
                        isApproved ? 'bg-blue-600 text-white' :
                        isRejected ? 'bg-rose-600 text-white' :
                        'bg-amber-500 text-slate-950'
                      }`}>
                        {isPending && <Clock className="w-3 h-3" />}
                        {isApproved && <ShieldCheck className="w-3 h-3" />}
                        {isOrdered && <Truck className="w-3 h-3" />}
                        {isReceived && <Package className="w-3 h-3" />}
                        {isConsumed && <CheckCircle2 className="w-3 h-3" />}
                        <span>
                          {isPending ? 'Pending Approval' :
                           isApproved ? 'Approved' :
                           isOrdered ? 'Ordered' :
                           isReceived ? 'Received at Store' :
                           isConsumed ? 'Consumed' : 'Rejected'}
                        </span>
                      </span>
                    </div>

                    {/* Pending Approval Controls */}
                    {isPending && (
                      <div className="space-y-2.5">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                              Estimated Cost
                            </label>
                            <p className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 py-1.5 px-2.5 bg-slate-200/50 dark:bg-slate-900 rounded-lg">
                              ₹{(req.suggestedPrice || 0).toLocaleString('en-IN')}
                            </p>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-amber-700 dark:text-amber-400 mb-1">
                              Approved Price (₹) *
                            </label>
                            <input
                              type="number"
                              value={currentPriceInput}
                              onChange={(e) => handleInputChange(req.id, 'price', e.target.value ? Number(e.target.value) : '')}
                              className="w-full px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-900 border border-amber-500/50 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500"
                              placeholder="0"
                            />
                          </div>
                        </div>

                        <div>
                          <input
                            type="text"
                            placeholder="Manager approval notes (optional)..."
                            value={currentNotesInput}
                            onChange={(e) => handleInputChange(req.id, 'notes', e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                          />
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleApprove(card.id, task.id, req)}
                            className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                          >
                            <Check className="w-4 h-4 stroke-[3]" />
                            <span>Approve Requisition</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(card.id, task.id, req)}
                            className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-xs transition-all flex items-center justify-center gap-1"
                          >
                            <X className="w-4 h-4 stroke-[3]" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Approved / In-Transit Logistics Controls */}
                    {(isApproved || isOrdered || isReceived) && (
                      <div className="space-y-2">
                        <p className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          Approved Cost: ₹{(req.approvedPrice || req.suggestedPrice || 0).toLocaleString('en-IN')}
                        </p>
                        {req.managerNotes && (
                          <p className="text-[11px] text-slate-500 italic">Note: {req.managerNotes}</p>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                          {isApproved && (
                            <button
                              type="button"
                              onClick={() => handleMarkOrdered(card.id, task.id, req.id)}
                              className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              <span>Mark as Ordered</span>
                            </button>
                          )}
                          {!isReceived && (
                            <button
                              type="button"
                              onClick={() => handleMarkReceived(card.id, task.id, req.id)}
                              className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              <Package className="w-3.5 h-3.5" />
                              <span>Mark Received at Store</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Consumed / Rejected Display */}
                    {(isConsumed || isRejected) && (
                      <div className="text-xs space-y-1">
                        {isConsumed && (
                          <p className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Consumed by mechanic & billed.
                          </p>
                        )}
                        {isRejected && (
                          <p className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" /> Requisition rejected.
                          </p>
                        )}
                        {req.approvedPrice ? (
                          <p className="text-slate-500 font-mono">Value: ₹{req.approvedPrice.toLocaleString('en-IN')}</p>
                        ) : null}
                      </div>
                    )}

                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
