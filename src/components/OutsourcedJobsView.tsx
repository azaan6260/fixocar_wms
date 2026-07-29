import React, { useState } from 'react';
import { JobCard, JobTask, Vendor, UserRole, OutsourceStatus } from '../types';
import { 
  getJobCards, 
  getVendors, 
  outsourceTaskToVendor, 
  updateTaskOutsourceStatus, 
  cancelTaskOutsourcing 
} from '../lib/storage';
import { 
  ExternalLink, 
  Building2, 
  Plus, 
  Search, 
  Truck, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  FileText, 
  Calendar, 
  Printer, 
  X, 
  AlertCircle, 
  ChevronRight, 
  ArrowRight, 
  ShieldCheck, 
  Wrench,
  Tag,
  Receipt
} from 'lucide-react';

interface OutsourcedJobsViewProps {
  currentRole: UserRole;
  onOpenJobCard?: (id: string) => void;
}

export function OutsourcedJobsView({
  currentRole,
  onOpenJobCard
}: OutsourcedJobsViewProps) {
  const [jobCards, setJobCards] = useState<JobCard[]>(() => getJobCards());
  const [vendors, setVendors] = useState<Vendor[]>(() => getVendors());

  const [activeTab, setActiveTab] = useState<OutsourceStatus | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [showOutsourceModal, setShowOutsourceModal] = useState(false);
  const [selectedJobCardId, setSelectedJobCardId] = useState<string>('');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [vendorId, setVendorId] = useState<string>('');
  const [outsourcedCost, setOutsourcedCost] = useState<number | ''>('');
  const [expectedReturnDate, setExpectedReturnDate] = useState<string>('');
  const [outsourceNotes, setOutsourceNotes] = useState<string>('');

  // Outsource Gate Challan Modal
  const [activeChallanItem, setActiveChallanItem] = useState<{
    card: JobCard;
    task: JobTask;
  } | null>(null);

  // Status Update Inline State
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [vendorInvoiceNo, setVendorInvoiceNo] = useState('');

  // Toast State
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const refreshData = () => {
    setJobCards(getJobCards());
    setVendors(getVendors());
  };

  // Collect all outsourced tasks (and tasks that are candidate for outsourcing)
  const outsourcedTasksList = React.useMemo(() => {
    const items: {
      card: JobCard;
      task: JobTask;
    }[] = [];

    jobCards.forEach((card) => {
      if (card.status !== 'CLOSED' && card.status !== 'DELIVERED') {
        card.tasks.forEach((task) => {
          // If explicitly marked as outsourced OR category is SUBLET_VENDOR or assignedType is VENDOR
          if (
            task.isOutsourced || 
            task.assignedType === 'VENDOR' || 
            task.category === 'SUBLET_VENDOR' || 
            task.category === 'LATHE_WORK'
          ) {
            items.push({ card, task });
          }
        });
      }
    });

    return items;
  }, [jobCards]);

  // Candidates for outsourcing: tasks in open job cards that are not yet outsourced
  const outsourceCandidates = React.useMemo(() => {
    const list: { card: JobCard; task: JobTask }[] = [];
    jobCards.forEach(card => {
      if (card.status !== 'CLOSED' && card.status !== 'DELIVERED') {
        card.tasks.forEach(task => {
          if (!task.isOutsourced && task.status !== 'COMPLETED') {
            list.push({ card, task });
          }
        });
      }
    });
    return list;
  }, [jobCards]);

  // When selecting a job card in the outsource modal
  const selectedCardTasks = React.useMemo(() => {
    if (!selectedJobCardId) return [];
    const card = jobCards.find(c => c.id === selectedJobCardId);
    return card ? card.tasks.filter(t => t.status !== 'COMPLETED') : [];
  }, [selectedJobCardId, jobCards]);

  // Filtered List
  const filteredTasks = outsourcedTasksList.filter(({ card, task }) => {
    if (activeTab !== 'ALL') {
      const currentStatus = task.outsourceStatus || 'PENDING_DISPATCH';
      if (activeTab === 'PENDING_DISPATCH' && currentStatus !== 'PENDING_DISPATCH') return false;
      if (activeTab === 'SENT_TO_VENDOR' && currentStatus !== 'SENT_TO_VENDOR') return false;
      if (activeTab === 'WORK_IN_PROGRESS' && currentStatus !== 'WORK_IN_PROGRESS') return false;
      if (activeTab === 'COMPLETED_BY_VENDOR' && currentStatus !== 'COMPLETED_BY_VENDOR') return false;
      if (activeTab === 'RECEIVED_BACK' && currentStatus !== 'RECEIVED_BACK') return false;
      if (activeTab === 'PAID_SETTLED' && currentStatus !== 'PAID_SETTLED') return false;
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchTitle = task.title.toLowerCase().includes(q);
      const matchReg = card.vehicle.registrationNumber.toLowerCase().includes(q);
      const matchVendor = (task.outsourcedVendorName || task.assignedToName || '').toLowerCase().includes(q);
      const matchChallan = (task.outsourceChallanNumber || '').toLowerCase().includes(q);
      const matchInvoice = (task.vendorInvoiceNumber || '').toLowerCase().includes(q);
      return matchTitle || matchReg || matchVendor || matchChallan || matchInvoice;
    }

    return true;
  });

  // KPI Calculations
  const totalOutsourcedCount = outsourcedTasksList.length;
  const inVendorTransitCount = outsourcedTasksList.filter(
    i => (i.task.outsourceStatus || 'PENDING_DISPATCH') === 'SENT_TO_VENDOR' || (i.task.outsourceStatus) === 'WORK_IN_PROGRESS'
  ).length;
  const receivedBackCount = outsourcedTasksList.filter(
    i => i.task.outsourceStatus === 'RECEIVED_BACK' || i.task.outsourceStatus === 'COMPLETED_BY_VENDOR'
  ).length;

  const totalVendorCostVal = outsourcedTasksList.reduce(
    (acc, i) => acc + (i.task.outsourcedCost || i.task.estimatedCost || 0), 0
  );

  const handleCreateOutsource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobCardId || !selectedTaskId || !vendorId) {
      showToast('error', 'Please select Job Card, Task, and Vendor');
      return;
    }

    const ven = vendors.find(v => v.id === vendorId);
    if (!ven) return;

    outsourceTaskToVendor(selectedJobCardId, selectedTaskId, {
      vendorId: ven.id,
      vendorName: ven.name,
      outsourcedCost: Number(outsourcedCost) || 0,
      expectedReturnDate: expectedReturnDate || undefined,
      outsourceNotes: outsourceNotes.trim() || undefined
    });

    showToast('success', `Task successfully outsourced to ${ven.name}!`);
    setShowOutsourceModal(false);
    setSelectedJobCardId('');
    setSelectedTaskId('');
    setVendorId('');
    setOutsourcedCost('');
    setExpectedReturnDate('');
    setOutsourceNotes('');
    refreshData();
  };

  const handleStatusUpdate = (
    jobCardId: string, 
    taskId: string, 
    nextStatus: OutsourceStatus, 
    invNo?: string
  ) => {
    updateTaskOutsourceStatus(jobCardId, taskId, {
      outsourceStatus: nextStatus,
      vendorInvoiceNumber: invNo || undefined
    });

    showToast('success', `Outsource status updated to "${nextStatus.replace(/_/g, ' ')}"`);
    setUpdatingTaskId(null);
    setVendorInvoiceNo('');
    refreshData();
  };

  return (
    <div className="space-y-6">
      
      {/* Toast Banner */}
      {toastMsg && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-2 shadow-lg animate-in fade-in slide-in-from-top-2 ${
          toastMsg.type === 'success' 
            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-900 dark:text-emerald-200' 
            : 'bg-rose-500/15 border-rose-500/40 text-rose-900 dark:text-rose-200'
        }`}>
          <div className="flex items-center gap-2 font-bold text-xs">
            {toastMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-rose-500" />}
            <span>{toastMsg.text}</span>
          </div>
          <button onClick={() => setToastMsg(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black shrink-0">
            <ExternalLink className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Outsourced Jobs & Sublet Dispatch Hub</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-500/20 text-indigo-700 dark:text-indigo-300">
                {totalOutsourcedCount} Jobs
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Outsource lathe work, wheel alignment, upholstery, & sublet services to specialist vendors with gate passes.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowOutsourceModal(true)}
          className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-extrabold text-xs shadow-lg shadow-indigo-600/25 flex items-center gap-2 transition-all shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Outsource Job to Vendor</span>
        </button>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>Active Outsourced</span>
            <ExternalLink className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">
            {totalOutsourcedCount}
          </p>
          <p className="text-[11px] text-slate-400 font-medium">Lathe, Sublet & Vendors</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 text-xs font-bold">
            <span>With Vendors (In Transit)</span>
            <Truck className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-700 dark:text-amber-400">
            {inVendorTransitCount}
          </p>
          <p className="text-[11px] text-amber-600/80 font-medium">Currently at vendor workshop</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 text-xs font-bold">
            <span>Received Back at Workshop</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
            {receivedBackCount}
          </p>
          <p className="text-[11px] text-emerald-600/80 font-medium">Ready to fit & invoice</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>Total Vendor Charges</span>
            <DollarSign className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            ₹{totalVendorCostVal.toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-slate-400 font-medium">Outsourced labor & service cost</p>
        </div>

      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
        
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-xs">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 ${
              activeTab === 'ALL'
                ? 'bg-indigo-600 text-white font-extrabold shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            All Jobs ({totalOutsourcedCount})
          </button>

          <button
            onClick={() => setActiveTab('PENDING_DISPATCH')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 ${
              activeTab === 'PENDING_DISPATCH'
                ? 'bg-amber-500 text-slate-950 font-extrabold shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Pending Dispatch
          </button>

          <button
            onClick={() => setActiveTab('SENT_TO_VENDOR')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 ${
              activeTab === 'SENT_TO_VENDOR'
                ? 'bg-blue-600 text-white font-extrabold shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Sent to Vendor
          </button>

          <button
            onClick={() => setActiveTab('RECEIVED_BACK')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 ${
              activeTab === 'RECEIVED_BACK'
                ? 'bg-emerald-600 text-white font-extrabold shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Received Back
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search job, vehicle, vendor, challan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Outsourced Jobs List */}
      {filteredTasks.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900 space-y-3">
          <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            No outsourced jobs found matching filter.
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            To assign a lathe work, wheel alignment, key duplicate, or sublet task to a vendor, click <strong className="text-indigo-600 dark:text-indigo-400">"Outsource Job to Vendor"</strong>.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTasks.map(({ card, task }) => {
            const status = task.outsourceStatus || 'PENDING_DISPATCH';
            const vendorName = task.outsourcedVendorName || task.assignedToName || 'Sublet Vendor';
            const cost = task.outsourcedCost || task.estimatedCost || 0;
            const customerPrice = task.customerPrice || 0;
            const margin = customerPrice - cost;

            return (
              <div
                key={`${card.id}-${task.id}`}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs transition-all hover:border-indigo-500/40"
              >
                {/* Header Context Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-mono font-extrabold text-indigo-700 dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">
                      🚘 {card.vehicle.registrationNumber} — {card.vehicle.make} {card.vehicle.model}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="font-mono text-slate-500 font-bold">
                      JC ID: {card.id}
                    </span>
                    {task.outsourceChallanNumber && (
                      <>
                        <span className="text-slate-400">•</span>
                        <span className="font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded">
                          Challan: {task.outsourceChallanNumber}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveChallanItem({ card, task })}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
                    >
                      <Printer className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Print Gate Slip</span>
                    </button>

                    {onOpenJobCard && (
                      <button
                        onClick={() => onOpenJobCard(card.id)}
                        className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <span>View Job Card</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Job & Vendor Details Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                  
                  {/* Left Column: Task Details */}
                  <div className="lg:col-span-7 space-y-2.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                        {task.title}
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                        {task.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-indigo-500" />
                        <span>Vendor: <strong className="text-slate-900 dark:text-slate-100">{vendorName}</strong></span>
                      </div>
                      {task.expectedReturnDate && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-amber-500" />
                          <span>Expected Return: <strong className="text-amber-700 dark:text-amber-300">{task.expectedReturnDate}</strong></span>
                        </div>
                      )}
                    </div>

                    {task.outsourceNotes && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                        Notes: {task.outsourceNotes}
                      </p>
                    )}

                    {/* Cost & Financials */}
                    <div className="flex items-center gap-4 text-xs font-mono pt-1">
                      <span className="text-slate-600 dark:text-slate-300">
                        Vendor Cost: <strong className="text-slate-900 dark:text-slate-100 font-bold">₹{cost.toLocaleString('en-IN')}</strong>
                      </span>
                      <span>•</span>
                      <span className="text-slate-600 dark:text-slate-300">
                        Customer Price: <strong className="text-slate-900 dark:text-slate-100 font-bold">₹{customerPrice.toLocaleString('en-IN')}</strong>
                      </span>
                      {margin > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            Margin: +₹{margin.toLocaleString('en-IN')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Outsource Status Lifecycle Controls */}
                  <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                    
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                      <span className="text-xs font-bold text-slate-500">Outsource Status</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-black uppercase flex items-center gap-1.5 ${
                        status === 'RECEIVED_BACK' || status === 'COMPLETED_BY_VENDOR'
                          ? 'bg-emerald-500 text-slate-950 font-black'
                          : status === 'SENT_TO_VENDOR' || status === 'WORK_IN_PROGRESS'
                          ? 'bg-blue-600 text-white font-bold'
                          : 'bg-amber-500 text-slate-950 font-bold'
                      }`}>
                        {status === 'PENDING_DISPATCH' && <Clock className="w-3.5 h-3.5" />}
                        {(status === 'SENT_TO_VENDOR' || status === 'WORK_IN_PROGRESS') && <Truck className="w-3.5 h-3.5" />}
                        {(status === 'RECEIVED_BACK' || status === 'COMPLETED_BY_VENDOR') && <CheckCircle2 className="w-3.5 h-3.5" />}
                        <span>{status.replace(/_/g, ' ')}</span>
                      </span>
                    </div>

                    {/* Invoice Number display if entered */}
                    {task.vendorInvoiceNumber && (
                      <div className="text-xs font-mono text-slate-600 dark:text-slate-300 flex items-center gap-1.5 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                        <Receipt className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Vendor Invoice #: <strong>{task.vendorInvoiceNumber}</strong></span>
                      </div>
                    )}

                    {/* Action Controls based on current status */}
                    <div className="space-y-2 pt-1">
                      {status === 'PENDING_DISPATCH' && (
                        <button
                          onClick={() => handleStatusUpdate(card.id, task.id, 'SENT_TO_VENDOR')}
                          className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-2"
                        >
                          <Truck className="w-4 h-4" />
                          <span>Dispatch Component to Vendor</span>
                        </button>
                      )}

                      {(status === 'SENT_TO_VENDOR' || status === 'WORK_IN_PROGRESS') && (
                        <div className="space-y-2">
                          {updatingTaskId === task.id ? (
                            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 space-y-2">
                              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                Vendor Bill / Invoice # (Optional)
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. VEN-99482"
                                value={vendorInvoiceNo}
                                onChange={(e) => setVendorInvoiceNo(e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleStatusUpdate(card.id, task.id, 'RECEIVED_BACK', vendorInvoiceNo)}
                                  className="flex-1 py-1.5 bg-emerald-600 text-white font-bold rounded-lg text-xs"
                                >
                                  Confirm Received Back
                                </button>
                                <button
                                  onClick={() => setUpdatingTaskId(null)}
                                  className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setUpdatingTaskId(task.id)}
                              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-2"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Mark Received Back at Workshop</span>
                            </button>
                          )}
                        </div>
                      )}

                      {status === 'RECEIVED_BACK' && (
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <span>Job Completed & Received Back at Workshop!</span>
                        </div>
                      )}
                    </div>

                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* OUTSOURCE JOB MODAL */}
      {showOutsourceModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-lg p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-500 flex items-center justify-center font-bold">
                  <ExternalLink className="w-4 h-4" />
                </div>
                <h3 className="font-black text-base text-slate-900 dark:text-slate-100">
                  Outsource Job / Sublet Task
                </h3>
              </div>

              <button
                onClick={() => setShowOutsourceModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOutsource} className="space-y-4 text-xs">
              
              {/* Select Job Card */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Select Active Job Card <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={selectedJobCardId}
                  onChange={(e) => {
                    setSelectedJobCardId(e.target.value);
                    setSelectedTaskId('');
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-bold"
                >
                  <option value="">-- Choose Job Card --</option>
                  {jobCards.filter(c => c.status !== 'CLOSED' && c.status !== 'DELIVERED').map(card => (
                    <option key={card.id} value={card.id}>
                      {card.vehicle.registrationNumber} — {card.vehicle.make} {card.vehicle.model} ({card.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Task */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Select Task to Outsource <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  disabled={!selectedJobCardId}
                  value={selectedTaskId}
                  onChange={(e) => setSelectedTaskId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-bold disabled:opacity-50"
                >
                  <option value="">-- Choose Task --</option>
                  {selectedCardTasks.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.category}) — Customer ₹{t.customerPrice}
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Outsource Vendor */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Select Outsource Vendor / Sublet Partner <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-bold"
                >
                  <option value="">-- Choose Vendor --</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.category}) — Phone: {v.phone}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Outsource Cost */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Vendor Cost / Charge (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 600"
                    value={outsourcedCost}
                    onChange={(e) => setOutsourcedCost(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>

                {/* Expected Return Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Expected Return Date
                  </label>
                  <input
                    type="date"
                    value={expectedReturnDate}
                    onChange={(e) => setExpectedReturnDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Instructions / Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Outsource Notes / Special Instructions
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Resurface front brake discs up to 0.5mm limit. Deliver back by 4 PM."
                  value={outsourceNotes}
                  onChange={(e) => setOutsourceNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowOutsourceModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black shadow-md flex items-center gap-1.5"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Outsource Job</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* OUTSOURCE GATE CHALLAN SLIP MODAL */}
      {activeChallanItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-3xl w-full max-w-xl p-6 sm:p-8 space-y-6 shadow-2xl relative border border-slate-300 print:p-0 print:border-none">
            
            <button
              onClick={() => setActiveChallanItem(null)}
              className="absolute right-4 top-4 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 print:hidden"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Printable Slip Header */}
            <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
              <div className="flex items-center justify-center gap-2">
                <Wrench className="w-6 h-6 text-indigo-600" />
                <h2 className="font-black text-2xl tracking-tight uppercase">
                  Fixo<span className="text-indigo-600">Car</span> Workshop
                </h2>
              </div>
              <p className="text-xs font-bold text-slate-600">Sublet Component Outsource Delivery Gate Pass</p>
              <p className="text-[10px] font-mono text-slate-400">Gate Pass / Challan #: {activeChallanItem.task.outsourceChallanNumber || `CHN-${Date.now().toString().slice(-6)}`}</p>
            </div>

            {/* Slip Meta */}
            <div className="grid grid-cols-2 gap-4 text-xs font-mono border p-3 rounded-2xl bg-slate-50">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Vehicle Details</p>
                <p className="font-black text-sm text-slate-900">{activeChallanItem.card.vehicle.registrationNumber}</p>
                <p>{activeChallanItem.card.vehicle.make} {activeChallanItem.card.vehicle.model}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Outsource Vendor</p>
                <p className="font-black text-sm text-slate-900">{activeChallanItem.task.outsourcedVendorName || activeChallanItem.task.assignedToName}</p>
                <p>Date: {new Date().toLocaleDateString()}</p>
              </div>
            </div>

            {/* Task Description */}
            <div className="space-y-2 text-xs">
              <h4 className="font-black text-slate-900 uppercase border-b pb-1">Outsourced Component / Work Description</h4>
              <div className="p-3 bg-slate-100 rounded-xl font-bold flex justify-between items-center">
                <span>{activeChallanItem.task.title} ({activeChallanItem.task.category})</span>
                <span className="font-mono">Expected Return: {activeChallanItem.task.expectedReturnDate || 'Today'}</span>
              </div>
              {activeChallanItem.task.outsourceNotes && (
                <p className="text-slate-600 italic">Instructions: {activeChallanItem.task.outsourceNotes}</p>
              )}
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-6 pt-8 border-t text-center text-xs">
              <div className="space-y-8">
                <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto"></div>
                <p className="font-bold text-slate-700">Workshop Security / Manager Sign</p>
              </div>
              <div className="space-y-8">
                <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto"></div>
                <p className="font-bold text-slate-700">Vendor Receiver Signature & Stamp</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t print:hidden">
              <button
                onClick={() => setActiveChallanItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 font-bold text-xs"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-black text-xs shadow-md flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>Print Gate Slip</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
