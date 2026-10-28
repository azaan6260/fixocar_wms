import React, { useState } from 'react';
import { JobCard, UserRole, TaskRequisition, ProposedAdditionalTask, TaskCategory } from '../types';
import {
  respondToRequisition,
  markRequisitionStatus,
  reviewAdditionalWorkAndAddTasks,
  approveAdditionalWorkAndAllot,
  getAllEmployees,
  getStandardJobs
} from '../lib/storage';
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
  User, 
  Calendar, 
  Check,
  X,
  Wrench,
  Plus,
  Trash2,
  Camera,
  Video,
  BellRing,
  UserCheck
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
  const [filterTab, setFilterTab] = useState<'PENDING' | 'AWAITING_APPROVAL' | 'IN_TRANSIT' | 'CONSUMED' | 'REJECTED' | 'ALL'>('PENDING');
  const [searchTerm, setSearchTerm] = useState('');

  const employees = getAllEmployees();
  const standardJobs = getStandardJobs();

  // Per-item approval inputs state: { [requisitionId]: { price: number | '', notes: string } }
  const [approvalInputs, setApprovalInputs] = useState<{
    [reqId: string]: { price: number | ''; notes: string };
  }>({});

  // Per-item Manager Proposed Tasks state for ADDITIONAL_WORK requisitions
  const [proposedTasksMap, setProposedTasksMap] = useState<{
    [reqId: string]: ProposedAdditionalTask[];
  }>({});

  // Lightbox image preview
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Toast feedback state
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Helper to get or initialize proposed tasks for an ADDITIONAL_WORK requisition
  const getProposedTasksForReq = (req: TaskRequisition, defaultCategory: TaskCategory = 'MECHANICAL'): ProposedAdditionalTask[] => {
    if (proposedTasksMap[req.id]) {
      return proposedTasksMap[req.id];
    }
    if (req.proposedTasks && req.proposedTasks.length > 0) {
      return req.proposedTasks;
    }
    const cleanTitle = req.title.replace(/^\[.*?\]\s*/, '');
    return [
      {
        id: `pt-${req.id}-1`,
        title: cleanTitle,
        category: defaultCategory,
        partPrice: req.partPrice || 0,
        labourPrice: req.labourPrice || (req.suggestedPrice || 850),
        customerPrice: req.customerPrice || req.suggestedPrice || 850,
        contractorPayout: req.contractorPayout || 0,
        isContractBasis: Boolean(req.contractorPayout && req.contractorPayout > 0),
        assignedToId: req.requestedByEmployeeId,
        assignedToName: req.requestedByEmployeeName,
        notes: req.reason
      }
    ];
  };

  const updateProposedTaskField = (
    req: TaskRequisition,
    defaultCategory: TaskCategory,
    index: number,
    patch: Partial<ProposedAdditionalTask>
  ) => {
    const currentList = [...getProposedTasksForReq(req, defaultCategory)];
    const updatedItem = { ...currentList[index], ...patch };
    if (patch.partPrice !== undefined || patch.labourPrice !== undefined) {
      updatedItem.customerPrice = (Number(updatedItem.partPrice) || 0) + (Number(updatedItem.labourPrice) || 0);
    }
    if (patch.assignedToId !== undefined) {
      const emp = employees.find(e => e.id === patch.assignedToId);
      updatedItem.assignedToName = emp ? emp.name : req.requestedByEmployeeName;
    }
    currentList[index] = updatedItem;
    setProposedTasksMap(prev => ({ ...prev, [req.id]: currentList }));
  };

  const addAnotherProposedTask = (req: TaskRequisition, defaultCategory: TaskCategory) => {
    const currentList = [...getProposedTasksForReq(req, defaultCategory)];
    currentList.push({
      id: `pt-${req.id}-${Date.now()}`,
      title: '',
      category: defaultCategory,
      partPrice: 0,
      labourPrice: 500,
      customerPrice: 500,
      contractorPayout: 0,
      isContractBasis: false,
      assignedToId: req.requestedByEmployeeId,
      assignedToName: req.requestedByEmployeeName,
      notes: ''
    });
    setProposedTasksMap(prev => ({ ...prev, [req.id]: currentList }));
  };

  const removeProposedTask = (req: TaskRequisition, defaultCategory: TaskCategory, index: number) => {
    const currentList = [...getProposedTasksForReq(req, defaultCategory)];
    if (currentList.length <= 1) return;
    currentList.splice(index, 1);
    setProposedTasksMap(prev => ({ ...prev, [req.id]: currentList }));
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

    // Sort by pending/awaiting approval first, then by date newest
    return list.sort((a, b) => {
      const aActive = a.requisition.status === 'PENDING_APPROVAL' || a.requisition.status === 'AWAITING_CUSTOMER_APPROVAL';
      const bActive = b.requisition.status === 'PENDING_APPROVAL' || b.requisition.status === 'AWAITING_CUSTOMER_APPROVAL';
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      return new Date(b.requisition.createdAt).getTime() - new Date(a.requisition.createdAt).getTime();
    });
  }, [jobCards]);

  // Counts
  const pendingCount = allRequisitionItems.filter(i => i.requisition.status === 'PENDING_APPROVAL').length;
  const awaitingApprovalCount = allRequisitionItems.filter(i => i.requisition.status === 'AWAITING_CUSTOMER_APPROVAL').length;
  const inTransitCount = allRequisitionItems.filter(i => i.requisition.status === 'APPROVED' || i.requisition.status === 'ORDERED' || i.requisition.status === 'RECEIVED').length;
  const consumedCount = allRequisitionItems.filter(i => i.requisition.status === 'CONSUMED').length;
  const rejectedCount = allRequisitionItems.filter(i => i.requisition.status === 'REJECTED').length;

  // Filtered items based on active tab and search query
  const filteredItems = allRequisitionItems.filter(({ card, requisition: req }) => {
    if (filterTab === 'PENDING' && !(req.status === 'PENDING_APPROVAL' || req.status === 'AWAITING_CUSTOMER_APPROVAL')) return false;
    if (filterTab === 'AWAITING_APPROVAL' && req.status !== 'AWAITING_CUSTOMER_APPROVAL') return false;
    if (filterTab === 'IN_TRANSIT' && !(req.status === 'APPROVED' || req.status === 'ORDERED' || req.status === 'RECEIVED')) return false;
    if (filterTab === 'CONSUMED' && req.status !== 'CONSUMED') return false;
    if (filterTab === 'REJECTED' && req.status !== 'REJECTED') return false;

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

  // Manager Step 1 for Additional Work: Review & Add Tasks Needed (Status -> AWAITING_CUSTOMER_APPROVAL)
  const handleReviewAndAddTasksForApproval = (cardId: string, taskId: string, req: TaskRequisition, defaultCat: TaskCategory) => {
    const tasksToSave = getProposedTasksForReq(req, defaultCat).filter(t => t.title.trim() !== '');
    if (tasksToSave.length === 0) {
      showToast('error', 'Please enter at least one task title to resolve the issue.');
      return;
    }
    const notes = approvalInputs[req.id]?.notes || 'Manager reviewed discovery and added tasks for approval';
    reviewAdditionalWorkAndAddTasks(cardId, taskId, req.id, tasksToSave, notes);
    showToast('success', `Saved ${tasksToSave.length} task(s) on Job Card (Status: Needs Approval). Mark Approved when ready to allot!`);
  };

  // Manager Step 2 for Additional Work: Mark Approved & Allot to Mechanic (Notifies Mechanic with Sound to Proceed!)
  const handleMarkApprovedAndAllot = (cardId: string, taskId: string, req: TaskRequisition, defaultCat: TaskCategory) => {
    const tasksToAllot = getProposedTasksForReq(req, defaultCat).filter(t => t.title.trim() !== '');
    if (tasksToAllot.length === 0) {
      showToast('error', 'Please enter at least one task title before approving & allotting.');
      return;
    }
    const notes = approvalInputs[req.id]?.notes || 'Approved by Manager — Proceed with repair';
    approveAdditionalWorkAndAllot(cardId, taskId, req.id, tasksToAllot, notes);
    const mechanicNames = Array.from(new Set(tasksToAllot.map(t => t.assignedToName || req.requestedByEmployeeName))).join(', ');
    showToast('success', `✅ Approved & Allotted ${tasksToAllot.length} task(s) to ${mechanicNames}! Employee notified to proceed.`);
  };

  // Approve Standard Part Requisition
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
      
      {/* Lightbox Image Modal */}
      {previewImageUrl && (
        <div
          onClick={() => setPreviewImageUrl(null)}
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-3xl w-full">
            <button
              type="button"
              onClick={() => setPreviewImageUrl(null)}
              className="absolute -top-10 right-0 p-2 rounded-full bg-slate-800 text-white hover:bg-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewImageUrl}
              alt="Employee Discovery Evidence"
              className="w-full max-h-[82vh] object-contain rounded-2xl border border-slate-700"
            />
          </div>
        </div>
      )}

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
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2 flex-wrap">
              <span>Additional Work & Part Requisitions Review Queue</span>
              {(pendingCount + awaitingApprovalCount) > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500 text-slate-950 animate-pulse">
                  {pendingCount + awaitingApprovalCount} Action Needed
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Inspect employee discovery photos & videos, add tasks required to resolve the issue, and mark approved to allot & notify the mechanic.
            </p>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search issue, vehicle, mechanic..."
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
          className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
            filterTab === 'PENDING'
              ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Pending Review & Approval</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/20 text-slate-900 dark:text-slate-100 font-extrabold">
            {pendingCount + awaitingApprovalCount}
          </span>
        </button>

        <button
          onClick={() => setFilterTab('AWAITING_APPROVAL')}
          className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
            filterTab === 'AWAITING_APPROVAL'
              ? 'bg-orange-500 text-white shadow-sm font-black'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Tasks Added (Awaiting Approval)</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-extrabold">
            {awaitingApprovalCount}
          </span>
        </button>

        <button
          onClick={() => setFilterTab('IN_TRANSIT')}
          className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
            filterTab === 'IN_TRANSIT'
              ? 'bg-emerald-600 text-white shadow-sm font-black'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>Approved & Allotted</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-extrabold">
            {inTransitCount}
          </span>
        </button>

        <button
          onClick={() => setFilterTab('CONSUMED')}
          className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
            filterTab === 'CONSUMED'
              ? 'bg-blue-600 text-white shadow-sm font-black'
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
          className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
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
          className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
            filterTab === 'ALL'
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm font-black'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          <span>All</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-500/20 font-extrabold">
            {allRequisitionItems.length}
          </span>
        </button>
      </div>

      {/* Requisition Cards Grid */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
          <Package className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <p className="text-xs text-slate-500 font-bold">No additional work requests or part requisitions in this view.</p>
          <p className="text-[11px] text-slate-400">
            {filterTab === 'PENDING' 
              ? 'All employee discovery requests and part requisitions have been reviewed!' 
              : 'Try selecting a different filter tab or clearing search term.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map(({ card, task, requisition: req }) => {
            const isPending = req.status === 'PENDING_APPROVAL';
            const isAwaitingCustomerApproval = req.status === 'AWAITING_CUSTOMER_APPROVAL';
            const isApproved = req.status === 'APPROVED';
            const isOrdered = req.status === 'ORDERED';
            const isReceived = req.status === 'RECEIVED';
            const isConsumed = req.status === 'CONSUMED';
            const isRejected = req.status === 'REJECTED';
            const isAdditionalWork = req.itemType === 'ADDITIONAL_WORK';

            const currentPriceInput = approvalInputs[req.id]?.price ?? (req.suggestedPrice || '');
            const currentNotesInput = approvalInputs[req.id]?.notes ?? (req.managerNotes || '');

            const proposedTasks = isAdditionalWork ? getProposedTasksForReq(req, task.category) : [];
            const totalProposedAmount = proposedTasks.reduce((sum, pt) => sum + (Number(pt.customerPrice) || 0), 0);

            return (
              <div
                key={`${card.id}-${task.id}-${req.id}`}
                className={`p-4 sm:p-5 rounded-2xl border-2 transition-all space-y-4 ${
                  isPending
                    ? 'bg-amber-500/5 border-amber-500/40 shadow-sm'
                    : isAwaitingCustomerApproval
                    ? 'bg-orange-500/5 border-orange-500/50 shadow-sm'
                    : isReceived || isApproved
                    ? 'bg-emerald-500/5 border-emerald-500/40'
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
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      isAdditionalWork
                        ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30'
                        : 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                    }`}>
                      {isAdditionalWork ? '🔧 Additional Work Discovery' : '📦 Part Requisition'}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      Raised by: {req.requestedByEmployeeName}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      ({req.createdAt})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-black uppercase flex items-center gap-1 ${
                      isPending ? 'bg-amber-500 text-slate-950' :
                      isAwaitingCustomerApproval ? 'bg-orange-500 text-white' :
                      isApproved ? 'bg-emerald-600 text-white' :
                      isRejected ? 'bg-rose-600 text-white' :
                      'bg-blue-600 text-white'
                    }`}>
                      {isPending ? '1. Needs Manager Review' :
                       isAwaitingCustomerApproval ? '2. Tasks Added — Awaiting Approval' :
                       isApproved ? '3. Approved & Allotted to Mechanic' :
                       req.status}
                    </span>
                    <button
                      onClick={() => onOpenJobCard(card.id)}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Open Job Card</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* ADDITIONAL WORK DISCOVERY FULL WORKFLOW */}
                {isAdditionalWork ? (
                  <div className="space-y-4">
                    {/* Employee Discovery Summary + Photo & Video Evidence */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                      <div className="lg:col-span-6 space-y-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                            {req.title}
                          </h3>
                          {req.urgency && (
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                              req.urgency === 'CRITICAL' ? 'bg-rose-600 text-white' :
                              req.urgency === 'HIGH' ? 'bg-amber-500 text-slate-950' :
                              'bg-slate-200 text-slate-700'
                            }`}>
                              {req.urgency} Priority
                            </span>
                          )}
                        </div>

                        <div className="p-3 rounded-xl bg-slate-100/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-1">
                          <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                            What Employee Found After Opening Up:
                          </span>
                          <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                            "{req.reason || 'Additional work discovered during inspection/opening up.'}"
                          </p>
                        </div>

                        {/* Photo & Video Evidence Display */}
                        {(req.photoUrl || req.videoUrl) ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            {req.photoUrl && (
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                  <Camera className="w-3.5 h-3.5" /> Employee Photo Proof (Click to Enlarge)
                                </span>
                                <div
                                  onClick={() => setPreviewImageUrl(req.photoUrl!)}
                                  className="h-36 w-full rounded-xl overflow-hidden border-2 border-blue-500/40 bg-slate-950 cursor-pointer hover:opacity-95 transition-opacity"
                                >
                                  <img
                                    src={req.photoUrl}
                                    alt="Discovered issue photo"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              </div>
                            )}

                            {req.videoUrl && (
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                                  <Video className="w-3.5 h-3.5" /> Employee Video Explanation
                                </span>
                                <div className="h-36 w-full rounded-xl overflow-hidden border-2 border-purple-500/40 bg-slate-950">
                                  <video
                                    src={req.videoUrl}
                                    controls
                                    playsInline
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700 text-[11px] text-slate-400">
                            No photo/video attached with this request.
                          </div>
                        )}
                      </div>

                      {/* Right Side: Manager Task Builder & Approval Allotment */}
                      <div className="lg:col-span-6 bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                          <div>
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                              <Wrench className="w-3.5 h-3.5 text-amber-500" />
                              <span>Manager Review: Tasks to Resolve Issue</span>
                            </h4>
                            <p className="text-[10.5px] text-slate-500">
                              Add the task(s) & allot the mechanic. Mark Approved when customer/manager approval is received.
                            </p>
                          </div>

                          {(isPending || isAwaitingCustomerApproval) && (
                            <button
                              type="button"
                              onClick={() => addAnotherProposedTask(req, task.category)}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10.5px] font-black flex items-center gap-1 shrink-0 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add Task</span>
                            </button>
                          )}
                        </div>

                        {/* List of Proposed Tasks */}
                        <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                          {proposedTasks.map((pt, idx) => (
                            <div
                              key={pt.id || idx}
                              className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
                                  Task #{idx + 1}
                                </span>
                                {(isPending || isAwaitingCustomerApproval) && proposedTasks.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeProposedTask(req, task.category, idx)}
                                    className="text-rose-500 hover:text-rose-600 p-0.5 cursor-pointer"
                                    title="Remove task"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>

                              {/* Task Title + Preset Selector */}
                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                                <div className="sm:col-span-8">
                                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                                    Task Title / Work Required *
                                  </label>
                                  <input
                                    type="text"
                                    disabled={isApproved || isRejected}
                                    value={pt.title}
                                    onChange={(e) => updateProposedTaskField(req, task.category, idx, { title: e.target.value })}
                                    placeholder="e.g. Replace Front Brake Pads & Skim Disc"
                                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                                  />
                                </div>
                                <div className="sm:col-span-4">
                                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                                    Category
                                  </label>
                                  <select
                                    disabled={isApproved || isRejected}
                                    value={pt.category}
                                    onChange={(e) => updateProposedTaskField(req, task.category, idx, { category: e.target.value as TaskCategory })}
                                    className="w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                                  >
                                    <option value="MECHANICAL">MECHANICAL</option>
                                    <option value="DENTING">DENTING</option>
                                    <option value="PAINT">PAINT</option>
                                    <option value="ACCESSORIES">ELECTRICAL</option>
                                    <option value="LATHE_WORK">LATHE WORK</option>
                                    <option value="WASHING">WASHING</option>
                                    <option value="SUBLET_VENDOR">SUBLET</option>
                                  </select>
                                </div>
                              </div>

                              {/* Pricing & Mechanic Allotment */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <div>
                                  <label className="block text-[9.5px] font-bold text-blue-600 dark:text-blue-400">
                                    Part (₹)
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    disabled={isApproved || isRejected}
                                    value={pt.partPrice}
                                    onChange={(e) => updateProposedTaskField(req, task.category, idx, { partPrice: Number(e.target.value) || 0 })}
                                    className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9.5px] font-bold text-indigo-600 dark:text-indigo-400">
                                    Labour (₹)
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    disabled={isApproved || isRejected}
                                    value={pt.labourPrice}
                                    onChange={(e) => updateProposedTaskField(req, task.category, idx, { labourPrice: Number(e.target.value) || 0 })}
                                    className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400">
                                    Total Bill (₹)
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    disabled={isApproved || isRejected}
                                    value={pt.customerPrice}
                                    onChange={(e) => updateProposedTaskField(req, task.category, idx, { customerPrice: Number(e.target.value) || 0 })}
                                    className="w-full px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs font-mono font-black"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9.5px] font-bold text-amber-600 dark:text-amber-400">
                                    Allot Mechanic
                                  </label>
                                  <select
                                    disabled={isApproved || isRejected}
                                    value={pt.assignedToId || ''}
                                    onChange={(e) => updateProposedTaskField(req, task.category, idx, { assignedToId: e.target.value })}
                                    className="w-full px-1.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-amber-500/40 text-[11px] font-bold text-slate-900 dark:text-white"
                                  >
                                    <option value={req.requestedByEmployeeId}>
                                      👷 {req.requestedByEmployeeName} (Requester)
                                    </option>
                                    {employees
                                      .filter(emp => emp.id !== req.requestedByEmployeeId)
                                      .map(emp => (
                                        <option key={emp.id} value={emp.id}>
                                          👷 {emp.name} ({emp.role})
                                        </option>
                                      ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Manager Notes & Action Buttons */}
                        {(isPending || isAwaitingCustomerApproval) ? (
                          <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-500">
                                Total Additional Estimate ({proposedTasks.length} Task{proposedTasks.length > 1 ? 's' : ''}):
                              </span>
                              <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                                ₹{totalProposedAmount.toLocaleString('en-IN')}
                              </span>
                            </div>

                            <input
                              type="text"
                              placeholder="Manager notes / instructions for mechanic (optional)..."
                              value={currentNotesInput}
                              onChange={(e) => handleInputChange(req.id, 'notes', e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                            />

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                              {/* Step 1: Save Tasks (Awaiting Customer/Final Approval) */}
                              <button
                                type="button"
                                onClick={() => handleReviewAndAddTasksForApproval(card.id, task.id, req, task.category)}
                                className="flex-1 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Clock className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>
                                  {isAwaitingCustomerApproval ? 'Update Tasks (Awaiting Approval)' : '1. Add Tasks (Needs Approval)'}
                                </span>
                              </button>

                              {/* Step 2: Mark Approved & Allot to Mechanic (Notifies Mechanic to Proceed) */}
                              <button
                                type="button"
                                onClick={() => handleMarkApprovedAndAllot(card.id, task.id, req, task.category)}
                                className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <BellRing className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>2. Mark Approved & Allot (Notify to Proceed)</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleReject(card.id, task.id, req)}
                                className="px-3 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <X className="w-4 h-4 stroke-[3]" />
                                <span>Reject</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Approved & Allotted to Mechanic — Employee Notified to Proceed!</span>
                            </span>
                            <span className="font-mono font-black text-slate-800 dark:text-slate-200">
                              ₹{(req.approvedPrice || totalProposedAmount).toLocaleString('en-IN')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* STANDARD PART REQUISITION WORKFLOW */
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
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

                    <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
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
                              className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Check className="w-4 h-4 stroke-[3]" />
                              <span>Approve Requisition</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReject(card.id, task.id, req)}
                              className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <X className="w-4 h-4 stroke-[3]" />
                              <span>Reject</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {(isApproved || isOrdered || isReceived) && (
                        <div className="space-y-2">
                          <p className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            Approved Cost: ₹{(req.approvedPrice || req.suggestedPrice || 0).toLocaleString('en-IN')}
                          </p>
                          <div className="flex items-center gap-2 pt-1">
                            {isApproved && (
                              <button
                                type="button"
                                onClick={() => handleMarkOrdered(card.id, task.id, req.id)}
                                className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                              >
                                <Truck className="w-3.5 h-3.5" />
                                <span>Mark as Ordered</span>
                              </button>
                            )}
                            {!isReceived && (
                              <button
                                type="button"
                                onClick={() => handleMarkReceived(card.id, task.id, req.id)}
                                className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                              >
                                <Package className="w-3.5 h-3.5" />
                                <span>Mark Received at Store</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
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
