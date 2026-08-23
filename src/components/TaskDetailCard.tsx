import React, { useState } from 'react';
import { JobCard, JobTask, Employee, Vendor, UserRole, TaskStatus, TaskCategory } from '../types';
import { PartRequisitionTracker } from './PartRequisitionTracker';
import { 
  reallotTask, 
  addRequisitionToTask, 
  respondToRequisition, 
  addConcernToTask, 
  resolveConcern, 
  addPartToTask,
  getInventoryItems,
  consumeInventoryItemForTask,
  updateJobCardTask,
  deleteJobCardTask,
  reassignAllPaintTasksForJobCard
} from '../lib/storage';
import { 
  User, 
  UserCheck, 
  Wrench, 
  AlertTriangle, 
  Plus, 
  CheckCircle2, 
  X, 
  Package, 
  AlertCircle, 
  MessageSquare, 
  ChevronDown, 
  ChevronUp,
  Tag, 
  ShieldAlert,
  ArrowRight,
  Edit,
  Trash2,
  Save,
  DollarSign,
  Hammer,
  Paintbrush,
  ExternalLink,
  Truck
} from 'lucide-react';

interface TaskDetailCardProps {
  key?: string;
  card: JobCard;
  task: JobTask;
  employees: Employee[];
  vendors: Vendor[];
  currentRole: UserRole;
  onTaskStatusChange?: (taskId: string, status: TaskStatus) => void;
}

export function TaskDetailCard({
  card,
  task,
  employees,
  vendors,
  currentRole,
  onTaskStatusChange
}: TaskDetailCardProps) {
  const isManager = currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN' || currentRole === 'FLOOR_MANAGER';

  // Re-allot state
  const [isReallotting, setIsReallotting] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState(task.assignedToId || '');

  // Requisition form state
  const [showReqForm, setShowReqForm] = useState(false);
  const [showRequisitionTracker, setShowRequisitionTracker] = useState(false);
  const [reqTitle, setReqTitle] = useState('');
  const [reqType, setReqType] = useState<'PART' | 'CONSUMABLE' | 'ADDITIONAL_WORK'>('PART');
  const [reqQty, setReqQty] = useState(1);
  const [reqUrgency, setReqUrgency] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [reqReason, setReqReason] = useState('');

  // Stock Inventory Consume state
  const [showInventoryConsumeForm, setShowInventoryConsumeForm] = useState(false);
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState('');
  const [consumeQty, setConsumeQty] = useState(1);
  const [consumeMsg, setConsumeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const inventoryItems = getInventoryItems();

  // Manager Requisition approval state
  const [approvingReqId, setApprovingReqId] = useState<string | null>(null);
  const [reqApprovedPrice, setReqApprovedPrice] = useState<number>(0);
  const [managerNotes, setManagerNotes] = useState('');

  // Concern form state
  const [showConcernForm, setShowConcernForm] = useState(false);
  const [concernIssue, setConcernIssue] = useState('');
  const [concernUrgency, setConcernUrgency] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');

  // Direct Part form state
  const [showDirectPartForm, setShowDirectPartForm] = useState(false);
  const [partName, setPartName] = useState('');
  const [partQty, setPartQty] = useState(1);
  const [partUnitPrice, setPartUnitPrice] = useState(0);
  const [partType, setPartType] = useState<'PART' | 'CONSUMABLE' | 'LABOR'>('PART');

  // Edit Job & Payouts state
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editCategory, setEditCategory] = useState<TaskCategory>(task.category);
  const [editCustomerPrice, setEditCustomerPrice] = useState(task.customerPrice || 0);
  const [editContractorPayout, setEditContractorPayout] = useState(task.contractorPayout || task.estimatedCost || 0);
  const [editPainterPayout, setEditPainterPayout] = useState(task.painterPayout || 0);
  const [editDenterPayout, setEditDenterPayout] = useState(task.denterPayout || 0);
  const [editAssignedId, setEditAssignedId] = useState(task.assignedToId || '');
  const [editPairedDenterId, setEditPairedDenterId] = useState(task.pairedDenterId || '');
  const [applyToAllPaintPanels, setApplyToAllPaintPanels] = useState(true);

  // Handlers
  const handleSaveTaskEdits = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) return;

    const matchedEmp = employees.find(e => e.id === editAssignedId);
    const matchedVendor = vendors.find(v => v.id === editAssignedId);
    const matchedDenter = employees.find(e => e.id === editPairedDenterId);

    const painter = Number(editPainterPayout) || 0;
    const denter = Number(editDenterPayout) || 0;
    const totalContractor = Number(editContractorPayout) || (painter + denter);

    updateJobCardTask(card.id, task.id, {
      title: editTitle.trim(),
      category: editCategory,
      customerPrice: Number(editCustomerPrice) || 0,
      contractorPayout: totalContractor,
      estimatedCost: totalContractor,
      painterPayout: painter,
      denterPayout: denter,
      assignedToId: editAssignedId,
      assignedToName: matchedEmp ? matchedEmp.name : matchedVendor ? matchedVendor.name : (editAssignedId ? 'Assigned Staff' : 'Unassigned'),
      assignedType: matchedVendor ? 'VENDOR' : 'EMPLOYEE',
      pairedDenterId: editPairedDenterId || undefined,
      pairedDenterName: matchedDenter ? matchedDenter.name : undefined
    });

    // If editing a paint task and user opted to apply to all paint panels on this vehicle together
    if (editCategory === 'PAINT' && applyToAllPaintPanels) {
      reassignAllPaintTasksForJobCard(
        card.id,
        editAssignedId || undefined,
        matchedEmp ? matchedEmp.name : matchedVendor ? matchedVendor.name : undefined,
        editPairedDenterId || undefined,
        matchedDenter ? matchedDenter.name : undefined
      );
    }

    setIsEditingTask(false);
  };

  const handleDeleteTaskSubmit = () => {
    if (window.confirm(`Are you sure you want to remove "${task.title}" from this job card?`)) {
      deleteJobCardTask(card.id, task.id);
    }
  };
  const handleReallotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignee) return;

    const matchedEmp = employees.find(e => e.id === selectedAssignee);
    const matchedVendor = vendors.find(v => v.id === selectedAssignee);

    const name = matchedEmp ? matchedEmp.name : matchedVendor ? matchedVendor.name : 'Staff Member';
    const type = matchedVendor ? 'VENDOR' : 'EMPLOYEE';

    reallotTask(card.id, task.id, selectedAssignee, name, type);
    setIsReallotting(false);
  };

  const handleCreateRequisition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqTitle.trim()) return;

    addRequisitionToTask(card.id, task.id, {
      requestedByEmployeeId: currentRole,
      requestedByEmployeeName: `${currentRole} Staff`,
      title: reqTitle.trim(),
      itemType: reqType,
      quantity: Number(reqQty) || 1,
      urgency: reqUrgency,
      reason: reqReason.trim()
    });

    setReqTitle('');
    setReqReason('');
    setReqQty(1);
    setReqUrgency('MEDIUM');
    setShowReqForm(false);
    setShowRequisitionTracker(true);
  };

  const handleConsumeInventoryItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInventoryItemId) return;

    const res = consumeInventoryItemForTask(
      card.id,
      task.id,
      selectedInventoryItemId,
      Number(consumeQty) || 1,
      currentRole,
      `${currentRole} Staff`
    );

    if (res.success) {
      setConsumeMsg({ type: 'success', text: res.message });
      setSelectedInventoryItemId('');
      setConsumeQty(1);
      setTimeout(() => {
        setConsumeMsg(null);
        setShowInventoryConsumeForm(false);
      }, 2000);
    } else {
      setConsumeMsg({ type: 'error', text: res.message });
    }
  };

  const handleApproveRequisitionSubmit = (reqId: string) => {
    respondToRequisition(card.id, task.id, reqId, true, Number(reqApprovedPrice) || 0, managerNotes);
    setApprovingReqId(null);
    setReqApprovedPrice(0);
    setManagerNotes('');
  };

  const handleRejectRequisition = (reqId: string) => {
    respondToRequisition(card.id, task.id, reqId, false, 0, 'Rejected by manager');
  };

  const handleCreateConcern = (e: React.FormEvent) => {
    e.preventDefault();
    if (!concernIssue.trim()) return;

    addConcernToTask(card.id, task.id, {
      raisedByEmployeeId: currentRole,
      requestedByEmployeeName: `${currentRole} Staff`,
      issueDescription: concernIssue.trim(),
      urgency: concernUrgency
    } as any);

    setConcernIssue('');
    setShowConcernForm(false);
  };

  const handleResolveConcern = (concernId: string, status: 'ACKNOWLEDGED' | 'RESOLVED') => {
    resolveConcern(card.id, task.id, concernId, status, `Updated by ${currentRole}`);
  };

  const handleAddDirectPart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partName.trim()) return;

    addPartToTask(card.id, task.id, {
      name: partName.trim(),
      quantity: Number(partQty) || 1,
      unitPrice: Number(partUnitPrice) || 0,
      type: partType
    });

    setPartName('');
    setPartQty(1);
    setPartUnitPrice(0);
    setShowDirectPartForm(false);
  };

  const allReqs = task.requisitions || [];
  const openReqs = allReqs.filter(r => r.status === 'PENDING_APPROVAL');
  const receivedReqs = allReqs.filter(r => r.status === 'RECEIVED');
  const openConcerns = (task.concerns || []).filter(c => c.status !== 'RESOLVED');

  return (
    <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4 transition-all">
      
      {/* Top Main Task Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">{task.title}</h3>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase">
              {task.category}
            </span>
            {task.isAdditionalWork && (
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 uppercase">
                Add-on Work
              </span>
            )}
          </div>

          {/* Current Assignee Info & Re-allotment */}
          <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap pt-0.5">
            <div className="flex items-center gap-1.5 font-medium">
              <UserCheck className="w-3.5 h-3.5 text-blue-500" />
              <span>Assigned To:</span>
              <strong className="text-slate-900 dark:text-slate-100 font-bold">{task.assignedToName || 'Unassigned'}</strong>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase">
                {task.assignedType || 'EMPLOYEE'}
              </span>
            </div>

            {task.pairedDenterName && (
              <div className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800">
                <Hammer className="w-3.5 h-3.5 text-amber-500" />
                <span>Pre-Paint Denter:</span>
                <strong className="font-bold">{task.pairedDenterName}</strong>
              </div>
            )}

            {(task.isOutsourced || task.assignedType === 'VENDOR') && (
              <div className="flex items-center gap-1.5 font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
                <ExternalLink className="w-3.5 h-3.5 text-indigo-500" />
                <span>Outsourced Sublet Job</span>
                {task.outsourceStatus && (
                  <span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.2 rounded font-black uppercase">
                    {task.outsourceStatus.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            )}

            {/* Re-allot & Edit Job Buttons for Managers/Admin */}
            {isManager && (
              <>
                <button
                  onClick={() => { setIsReallotting(!isReallotting); setIsEditingTask(false); }}
                  className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <User className="w-3 h-3" />
                  {isReallotting ? 'Cancel Re-allotment' : 'Reassign'}
                </button>

                <button
                  onClick={() => {
                    setIsEditingTask(!isEditingTask);
                    setIsReallotting(false);
                    // refresh edit state from task
                    setEditTitle(task.title);
                    setEditCategory(task.category);
                    setEditCustomerPrice(task.customerPrice || 0);
                    setEditContractorPayout(task.contractorPayout || task.estimatedCost || 0);
                    setEditPainterPayout(task.painterPayout || 0);
                    setEditDenterPayout(task.denterPayout || 0);
                    setEditAssignedId(task.assignedToId || '');
                    setEditPairedDenterId(task.pairedDenterId || '');
                  }}
                  className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                >
                  <Edit className="w-3 h-3" />
                  {isEditingTask ? 'Cancel Edit' : 'Edit Job & Payouts'}
                </button>
              </>
            )}

            <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
              Billing: ₹{(task.customerPrice || 0).toLocaleString('en-IN')}
            </div>

            {(task.isContractBasis || (task.contractorPayout && task.contractorPayout > 0)) && (
              <div className="px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[11px] font-black flex items-center gap-1">
                <span>Contract Payout:</span>
                <span className="font-mono text-amber-600 dark:text-amber-400">₹{(task.contractorPayout || 0).toLocaleString('en-IN')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Status Toggles */}
        <div className="flex items-center gap-1.5 shrink-0">
          {(['PENDING', 'IN_PROGRESS', 'COMPLETED'] as TaskStatus[]).map((st) => (
            <button
              key={st}
              onClick={() => onTaskStatusChange && onTaskStatusChange(task.id, st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                task.status === st
                  ? st === 'COMPLETED' ? 'bg-emerald-600 text-white shadow-xs' :
                    st === 'IN_PROGRESS' ? 'bg-blue-600 text-white shadow-xs' :
                    'bg-slate-800 text-white'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {st === 'IN_PROGRESS' ? 'In Progress' : st === 'COMPLETED' ? 'Completed' : 'Pending'}
            </button>
          ))}
        </div>
      </div>

      {/* RE-ALLOTMENT SELECTION PANEL */}
      {isReallotting && (
        <form onSubmit={handleReallotSubmit} className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="grow space-y-1">
            <label className="block text-xs font-bold text-blue-900 dark:text-blue-200">
              Re-allot / Reassign Task to Employee or Sublet Vendor:
            </label>
            <select
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-800 text-slate-900 dark:text-slate-100"
            >
              <optgroup label="Workshop Employees & Mechanics">
                {employees.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.name} — {e.specializedTeam} ({e.activeJobsCount || 0} active jobs)
                  </option>
                ))}
              </optgroup>
              <optgroup label="Outsourced Sublet Vendors">
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name} — {v.category}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-xs"
            >
              Confirm Re-allotment
            </button>
            <button
              type="button"
              onClick={() => setIsReallotting(false)}
              className="px-3 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* EDIT TASK & PAYOUTS PANEL */}
      {isEditingTask && (
        <form onSubmit={handleSaveTaskEdits} className="p-4 rounded-xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 space-y-3 text-xs">
          <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
            <span className="font-extrabold text-amber-900 dark:text-amber-300 flex items-center gap-1.5 uppercase tracking-wide">
              <Edit className="w-4 h-4 text-amber-500" /> Edit Job Details & Contractor Payout Rates
            </span>
            <button
              type="button"
              onClick={handleDeleteTaskSubmit}
              className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 hover:bg-rose-500 hover:text-white font-bold text-xs flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Remove Job
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Job Title / Repair Description
              </label>
              <input
                type="text"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value as TaskCategory)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold"
              >
                <option value="MECHANICAL">MECHANICAL</option>
                <option value="DENTING">DENTING</option>
                <option value="PAINT">PAINT</option>
                <option value="SUBLET_VENDOR">SUBLET_VENDOR</option>
                <option value="WASHING">WASHING</option>
                <option value="LATHE_WORK">LATHE_WORK</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-emerald-800 dark:text-emerald-300 mb-1">
                Customer Billing Price (₹)
              </label>
              <input
                type="number"
                min="0"
                required
                value={editCustomerPrice}
                onChange={(e) => setEditCustomerPrice(Number(e.target.value) || 0)}
                className="w-full px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 font-mono font-extrabold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-purple-800 dark:text-purple-300 mb-1">
                Painter Payout Rate (₹)
              </label>
              <input
                type="number"
                min="0"
                value={editPainterPayout}
                onChange={(e) => {
                  const val = Number(e.target.value) || 0;
                  setEditPainterPayout(val);
                  setEditContractorPayout(val + editDenterPayout);
                }}
                className="w-full px-3 py-1.5 rounded-lg border border-purple-300 dark:border-purple-800 bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 font-mono font-extrabold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-orange-800 dark:text-orange-300 mb-1">
                Denter Payout Rate (₹)
              </label>
              <input
                type="number"
                min="0"
                value={editDenterPayout}
                onChange={(e) => {
                  const val = Number(e.target.value) || 0;
                  setEditDenterPayout(val);
                  setEditContractorPayout(editPainterPayout + val);
                }}
                className="w-full px-3 py-1.5 rounded-lg border border-orange-300 dark:border-orange-800 bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 font-mono font-extrabold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-amber-800 dark:text-amber-300 mb-1">
                Total Contractor Payout (₹)
              </label>
              <input
                type="number"
                min="0"
                value={editContractorPayout}
                onChange={(e) => setEditContractorPayout(Number(e.target.value) || 0)}
                className="w-full px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 font-mono font-black"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Assign Painter / Main Staff
              </label>
              <select
                value={editAssignedId}
                onChange={(e) => setEditAssignedId(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold"
              >
                <option value="">-- Unassigned --</option>
                <optgroup label="Workshop Employees">
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.specializedTeam})</option>
                  ))}
                </optgroup>
                <optgroup label="Sublet Vendors">
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name} ({v.category})</option>
                  ))}
                </optgroup>
              </select>
            </div>

            {(editCategory === 'PAINT' || editDenterPayout > 0) && (
              <div>
                <label className="block text-[11px] font-bold text-orange-800 dark:text-orange-300 mb-1">
                  Assign Pre-Paint Denter
                </label>
                <select
                  value={editPairedDenterId}
                  onChange={(e) => setEditPairedDenterId(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-orange-300 dark:border-orange-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold"
                >
                  <option value="">-- No Denter Assigned --</option>
                  {employees.filter(e => e.specializedTeam === 'Denting' || e.role === 'DENTER' || true).map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.specializedTeam})</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {editCategory === 'PAINT' && card.tasks.filter(t => t.category === 'PAINT').length > 1 && (
            <div className="p-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center gap-2">
              <input
                type="checkbox"
                id={`apply-all-paint-${task.id}`}
                checked={applyToAllPaintPanels}
                onChange={(e) => setApplyToAllPaintPanels(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
              />
              <label htmlFor={`apply-all-paint-${task.id}`} className="text-xs font-bold text-purple-900 dark:text-purple-200 cursor-pointer">
                Reassign Painter & Denter to ALL {card.tasks.filter(t => t.category === 'PAINT').length} paint panels on {card.vehicle.registrationNumber} together
              </label>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-500/20">
            <button
              type="button"
              onClick={() => setIsEditingTask(false)}
              className="px-3.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-xs"
            >
              <Save className="w-3.5 h-3.5" /> Save Changes
            </button>
          </div>
        </form>
      )}

      {/* PARTS & CONSUMABLES LISTED UNDER THIS JOB */}
      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-amber-500" />
            Parts & Consumables Listed ({task.partsList?.length || 0})
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowInventoryConsumeForm(!showInventoryConsumeForm); setShowDirectPartForm(false); }}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-extrabold flex items-center gap-1 shadow-xs transition-colors"
            >
              <Package className="w-3 h-3" /> Issue In-Stock Item
            </button>

            {isManager && (
              <button
                onClick={() => { setShowDirectPartForm(!showDirectPartForm); setShowInventoryConsumeForm(false); }}
                className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Custom
              </button>
            )}
          </div>
        </div>

        {/* INVENTORY CONSUMPTION FORM (ISSUE FROM STORE) */}
        {showInventoryConsumeForm && (
          <form onSubmit={handleConsumeInventoryItem} className="p-3.5 bg-emerald-50/80 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-900/60 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide flex items-center gap-1.5">
                ⚡ Workshop Inventory Store Issue Desk
              </span>
              <button type="button" onClick={() => setShowInventoryConsumeForm(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {consumeMsg && (
              <div className={`p-2 rounded-lg text-xs font-bold ${
                consumeMsg.type === 'success' ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
              }`}>
                {consumeMsg.text}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Select In-Stock Inventory Item *</label>
                <select
                  required
                  value={selectedInventoryItemId}
                  onChange={(e) => setSelectedInventoryItemId(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 font-bold"
                >
                  <option value="">-- Choose item from store --</option>
                  {inventoryItems.map(item => (
                    <option key={item.id} value={item.id} disabled={item.stockQuantity === 0}>
                      {item.name} ({item.partNumber}) — {item.stockQuantity > 0 ? `In Stock: ${item.stockQuantity} ${item.unit} @ ₹${item.sellingPrice}` : 'OUT OF STOCK (Raise Requisition)'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Qty to Issue</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={consumeQty}
                  onChange={(e) => setConsumeQty(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 font-bold text-center"
                />
              </div>
            </div>

            {/* Check if chosen item is out of stock */}
            {selectedInventoryItemId && inventoryItems.find(i => i.id === selectedInventoryItemId)?.stockQuantity === 0 && (
              <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between text-xs text-amber-700 dark:text-amber-300">
                <span>Selected item is OUT OF STOCK. Raise a Part Requisition instead.</span>
                <button
                  type="button"
                  onClick={() => {
                    const matched = inventoryItems.find(i => i.id === selectedInventoryItemId);
                    if (matched) {
                      setReqTitle(matched.name);
                      setReqType(matched.category === 'CONSUMABLES' || matched.category === 'OILS_LUBRICANTS' ? 'CONSUMABLE' : 'PART');
                      setReqQty(consumeQty);
                    }
                    setShowInventoryConsumeForm(false);
                    setShowReqForm(true);
                  }}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-extrabold rounded-lg shadow-xs"
                >
                  + Raise Requisition
                </button>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowInventoryConsumeForm(false)}
                className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!selectedInventoryItemId}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg font-extrabold shadow-xs"
              >
                Confirm Stock Issue
              </button>
            </div>
          </form>
        )}

        {/* Direct Part Form */}
        {showDirectPartForm && (
          <form onSubmit={handleAddDirectPart} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-900/60 space-y-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  required
                  placeholder="Part / Consumable Name (e.g. Synthetic Oil 5W30)"
                  value={partName}
                  onChange={(e) => setPartName(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                />
              </div>
              <div>
                <select
                  value={partType}
                  onChange={(e) => setPartType(e.target.value as any)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                >
                  <option value="PART">SPARES PART</option>
                  <option value="CONSUMABLE">CONSUMABLE</option>
                  <option value="LABOR">LABOR / EXTRA</option>
                </select>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="Qty"
                  value={partQty}
                  onChange={(e) => setPartQty(Number(e.target.value))}
                  className="w-16 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-center"
                />
                <input
                  type="number"
                  min="0"
                  required
                  placeholder="Unit ₹"
                  value={partUnitPrice}
                  onChange={(e) => setPartUnitPrice(Number(e.target.value))}
                  className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDirectPartForm(false)}
                className="px-2.5 py-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-[11px] font-bold"
              >
                Save Part
              </button>
            </div>
          </form>
        )}

        {/* Parts Table/List */}
        {(!task.partsList || task.partsList.length === 0) ? (
          <p className="text-[11px] text-slate-400 italic">No parts or consumables listed under this job task yet.</p>
        ) : (
          <div className="space-y-1 text-xs">
            {task.partsList.map((part) => (
              <div key={part.id} className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                    part.type === 'CONSUMABLE' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                  }`}>
                    {part.type}
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{part.name}</span>
                  <span className="text-slate-400 font-mono text-[11px]">x{part.quantity}</span>
                </div>
                <div className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  ₹{(part.totalPrice || 0).toLocaleString('en-IN')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* EMPLOYEE REQUISITIONS & CONCERNS ACTION BAR */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          {/* Button: Toggle Part Requisition Tracker */}
          <button
            type="button"
            onClick={() => setShowRequisitionTracker(!showRequisitionTracker)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 ${
              showRequisitionTracker
                ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                : allReqs.length > 0
                  ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>{showRequisitionTracker ? 'Hide Part Requisitions' : 'Part Requisition Tracker'}</span>
            {allReqs.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                showRequisitionTracker
                  ? 'bg-slate-950 text-amber-400'
                  : receivedReqs.length > 0
                    ? 'bg-emerald-500 text-white animate-pulse'
                    : openReqs.length > 0
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}>
                {allReqs.length}
                {receivedReqs.length > 0 ? ' Ready' : openReqs.length > 0 ? ' Pending' : ''}
              </span>
            )}
            {showRequisitionTracker ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {/* Button: Raise Requisition */}
          <button
            type="button"
            onClick={() => { setShowReqForm(!showReqForm); setShowConcernForm(false); setShowInventoryConsumeForm(false); }}
            className="px-3 py-1.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            + Raise Part/Consumable Requisition
          </button>

          {/* Button: Report Difficulty / Concern */}
          <button
            type="button"
            onClick={() => { setShowConcernForm(!showConcernForm); setShowReqForm(false); setShowInventoryConsumeForm(false); }}
            className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            ⚠️ Report Issue / Concern
            {openConcerns.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black">
                {openConcerns.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* REQUISITION FORM (EMPLOYEE CAN SUBMIT REQUISITION WITHOUT PRICE) */}
      {showReqForm && (
        <form onSubmit={handleCreateRequisition} className="p-4 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/60 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-orange-700 dark:text-orange-400 uppercase tracking-wide flex items-center gap-1.5">
              <Package className="w-4 h-4" />
              Employee Requisition Form (Parts / Consumables / Add-on Work)
            </span>
            <button type="button" onClick={() => setShowReqForm(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[11px] text-slate-600 dark:text-slate-300">
            Working mechanics can request out-of-stock parts or additional work. Requisitions will appear in the Manager Action Desk for review and approval.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Item / Work Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Brake Caliper Pin, 1L Brake Fluid DOT4, Steering Boot"
                value={reqTitle}
                onChange={(e) => setReqTitle(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-orange-200 dark:border-orange-800 bg-white dark:bg-slate-900 font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Category Type</label>
              <select
                value={reqType}
                onChange={(e) => setReqType(e.target.value as any)}
                className="w-full px-3 py-1.5 rounded-lg border border-orange-200 dark:border-orange-800 bg-white dark:bg-slate-900 font-bold"
              >
                <option value="PART">SPARE PART</option>
                <option value="CONSUMABLE">CONSUMABLE / OIL</option>
                <option value="ADDITIONAL_WORK">ADDITIONAL REPAIR WORK</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Quantity Required</label>
              <input
                type="number"
                min="1"
                required
                value={reqQty}
                onChange={(e) => setReqQty(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-lg border border-orange-200 dark:border-orange-800 bg-white dark:bg-slate-900 font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Urgency Level</label>
              <select
                value={reqUrgency}
                onChange={(e) => setReqUrgency(e.target.value as any)}
                className="w-full px-3 py-1.5 rounded-lg border border-orange-200 dark:border-orange-800 bg-white dark:bg-slate-900 font-bold"
              >
                <option value="LOW">LOW — Standard Service</option>
                <option value="MEDIUM">MEDIUM — Normal Priority</option>
                <option value="HIGH">HIGH — Urgent Vehicle Blocking</option>
                <option value="CRITICAL">CRITICAL — Emergency Delivery Stop</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Reason / Notes for Manager</label>
              <input
                type="text"
                placeholder="e.g. Existing bolt thread worn out during removal, out of stock in bay"
                value={reqReason}
                onChange={(e) => setReqReason(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-orange-200 dark:border-orange-800 bg-white dark:bg-slate-900 font-medium"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="submit"
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-extrabold shadow-xs"
            >
              Submit Requisition to Manager
            </button>
          </div>
        </form>
      )}

      {/* CONCERN / ISSUE REPORT FORM */}
      {showConcernForm && (
        <form onSubmit={handleCreateConcern} className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-rose-700 dark:text-rose-400 uppercase tracking-wide flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              Raise Work Difficulty or Concern
            </span>
            <button type="button" onClick={() => setShowConcernForm(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[11px] text-slate-600 dark:text-slate-300">
            Report any roadblock (e.g. seized bolt, unexpected leak, missing tool, or safety concern) to floor management.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Issue Description *</label>
              <input
                type="text"
                required
                placeholder="e.g. Engine block bolt sheared off; requires lathe extractor"
                value={concernIssue}
                onChange={(e) => setConcernIssue(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Urgency Level</label>
              <select
                value={concernUrgency}
                onChange={(e) => setConcernUrgency(e.target.value as any)}
                className="w-full px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 font-bold"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="submit"
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-extrabold shadow-xs"
            >
              Report Concern to Floor Manager
            </button>
          </div>
        </form>
      )}

      {/* PART REQUISITION TRACKER COMPONENT (OPENABLE BELOW WHEN TOGGLED) */}
      {showRequisitionTracker && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-2 duration-200">
          <PartRequisitionTracker
            jobCardId={card.id}
            taskId={task.id}
            taskTitle={task.title}
            requisitions={task.requisitions || []}
            currentRole={currentRole}
            currentEmployeeName={task.assignedToName}
          />
        </div>
      )}

      {/* DISPLAY EXISTING CONCERNS */}
      {task.concerns && task.concerns.length > 0 && (
        <div className="p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-2">
          <span className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3" />
            Reported Concerns & Difficulties ({task.concerns.length})
          </span>

          <div className="space-y-2 text-xs">
            {task.concerns.map((con) => (
              <div key={con.id} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-rose-100 dark:border-rose-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-slate-100">{con.issueDescription}</span>
                    <span className={`px-2 py-0.2 rounded text-[9px] font-black uppercase ${
                      con.urgency === 'CRITICAL' ? 'bg-rose-600 text-white' :
                      con.urgency === 'HIGH' ? 'bg-rose-500/20 text-rose-600' :
                      'bg-amber-500/20 text-amber-600'
                    }`}>
                      {con.urgency} URGENCY
                    </span>
                    <span className="text-[10px] text-slate-400">({con.status})</span>
                  </div>
                  {con.resolutionNotes && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                      Resolution: {con.resolutionNotes}
                    </p>
                  )}
                </div>

                {isManager && con.status !== 'RESOLVED' && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleResolveConcern(con.id, 'ACKNOWLEDGED')}
                      className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 rounded text-xs font-bold"
                    >
                      Acknowledge
                    </button>
                    <button
                      onClick={() => handleResolveConcern(con.id, 'RESOLVED')}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold"
                    >
                      Mark Resolved
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
