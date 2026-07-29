import React, { useState } from 'react';
import { JobCard, TaskRequisition, UserRole, RequisitionStatus } from '../types';
import { getJobCards, updateRequisitionMarketPurchase, consumeRequisitionPart } from '../lib/storage';
import { 
  ShoppingBag, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Printer, 
  Share2, 
  X, 
  Building2, 
  User, 
  ChevronRight, 
  Tag, 
  DollarSign, 
  PackageCheck, 
  Store, 
  FileText,
  Filter,
  Car,
  Wrench
} from 'lucide-react';

interface PartOrderBasketViewProps {
  currentRole: UserRole;
  onOpenJobCard?: (id: string) => void;
}

export function PartOrderBasketView({
  currentRole,
  onOpenJobCard
}: PartOrderBasketViewProps) {
  const [jobCards, setJobCards] = useState<JobCard[]>(() => getJobCards());
  const [activeTab, setActiveTab] = useState<'TO_BUY' | 'PENDING_APPROVAL' | 'RECEIVED' | 'ALL'>('TO_BUY');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal / Popover states for Market Runner actions
  const [activePurchaseReq, setActivePurchaseReq] = useState<{
    card: JobCard;
    taskId: string;
    taskTitle: string;
    req: TaskRequisition;
  } | null>(null);

  const [purchasedPrice, setPurchasedPrice] = useState<number | ''>('');
  const [vendorName, setVendorName] = useState('');
  const [vendorInvoiceNo, setVendorInvoiceNo] = useState('');
  const [runnerNotes, setRunnerNotes] = useState('');

  // Printable Market Manifest state
  const [showPrintManifest, setShowPrintManifest] = useState(false);

  // Toast banner
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const refreshData = () => {
    setJobCards(getJobCards());
  };

  // Collect all requisitions across all active job cards
  const allRequisitionsList = React.useMemo(() => {
    const items: {
      card: JobCard;
      taskId: string;
      taskTitle: string;
      req: TaskRequisition;
    }[] = [];

    jobCards.forEach((card) => {
      if (card.status !== 'CLOSED' && card.status !== 'DELIVERED') {
        card.tasks.forEach((task) => {
          if (task.requisitions && task.requisitions.length > 0) {
            task.requisitions.forEach((req) => {
              items.push({
                card,
                taskId: task.id,
                taskTitle: task.title,
                req
              });
            });
          }
        });
      }
    });

    return items;
  }, [jobCards]);

  // Filtered requisitions list based on active tab & search
  const filteredRequisitions = allRequisitionsList.filter(({ card, taskTitle, req }) => {
    if (activeTab === 'TO_BUY') {
      // Items that need market purchasing or ordering (APPROVED or ORDERED)
      if (req.status !== 'APPROVED' && req.status !== 'ORDERED') return false;
    } else if (activeTab === 'PENDING_APPROVAL') {
      if (req.status !== 'PENDING_APPROVAL') return false;
    } else if (activeTab === 'RECEIVED') {
      if (req.status !== 'RECEIVED' && req.status !== 'CONSUMED') return false;
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchTitle = req.title.toLowerCase().includes(q);
      const matchReqId = req.id.toLowerCase().includes(q);
      const matchPartNo = (req.partNumber || '').toLowerCase().includes(q);
      const matchVehicle = card.vehicle.registrationNumber.toLowerCase().includes(q);
      const matchModel = (`${card.vehicle.make} ${card.vehicle.model}`).toLowerCase().includes(q);
      const matchMech = req.requestedByEmployeeName.toLowerCase().includes(q);
      const matchTask = taskTitle.toLowerCase().includes(q);
      return matchTitle || matchReqId || matchPartNo || matchVehicle || matchModel || matchMech || matchTask;
    }

    return true;
  });

  // KPI Calculations
  const toBuyCount = allRequisitionsList.filter(
    i => i.req.status === 'APPROVED' || i.req.status === 'ORDERED'
  ).length;

  const pendingApprovalCount = allRequisitionsList.filter(
    i => i.req.status === 'PENDING_APPROVAL'
  ).length;

  const criticalItemsCount = allRequisitionsList.filter(
    i => (i.req.status === 'APPROVED' || i.req.status === 'ORDERED') && i.req.urgency === 'CRITICAL'
  ).length;

  const totalMarketBudget = allRequisitionsList
    .filter(i => i.req.status === 'APPROVED' || i.req.status === 'ORDERED')
    .reduce((sum, i) => sum + (i.req.approvedPrice || i.req.suggestedPrice || 0), 0);

  // Submit Market Purchase action
  const handleConfirmPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePurchaseReq) return;

    updateRequisitionMarketPurchase(
      activePurchaseReq.card.id,
      activePurchaseReq.taskId,
      activePurchaseReq.req.id,
      {
        nextStatus: 'RECEIVED',
        purchasedPrice: Number(purchasedPrice) || activePurchaseReq.req.approvedPrice || activePurchaseReq.req.suggestedPrice,
        vendorName: vendorName.trim() || undefined,
        vendorInvoiceNo: vendorInvoiceNo.trim() || undefined,
        managerNotes: runnerNotes.trim() || undefined
      }
    );

    showToast('success', `Item "${activePurchaseReq.req.title}" marked as Purchased & Received at Workshop!`);
    setActivePurchaseReq(null);
    setPurchasedPrice('');
    setVendorName('');
    setVendorInvoiceNo('');
    setRunnerNotes('');
    refreshData();
  };

  // Quick mark RECEIVED
  const handleQuickMarkReceived = (jobCardId: string, taskId: string, reqId: string, itemTitle: string) => {
    updateRequisitionMarketPurchase(jobCardId, taskId, reqId, {
      nextStatus: 'RECEIVED'
    });
    showToast('success', `Marked "${itemTitle}" as Received at Workshop Store!`);
    refreshData();
  };

  // Share via WhatsApp helper text generator
  const generateWhatsAppMessage = () => {
    const itemsToBuy = allRequisitionsList.filter(
      i => i.req.status === 'APPROVED' || i.req.status === 'ORDERED'
    );

    if (itemsToBuy.length === 0) {
      alert('No active items in basket to buy!');
      return;
    }

    let text = `🛒 *AUTOCRAFT WORKSHOP - MARKET SPARE PARTS SHOPPING LIST*\n`;
    text += `Date: ${new Date().toLocaleDateString()}\n\n`;

    itemsToBuy.forEach((item, idx) => {
      text += `${idx + 1}. *${item.req.title}* (${item.req.quantity} Pcs)\n`;
      if (item.req.partNumber) text += `   Part #: ${item.req.partNumber}\n`;
      text += `   Car: ${item.card.vehicle.registrationNumber} (${item.card.vehicle.make} ${item.card.vehicle.model})\n`;
      if (item.req.approvedPrice) text += `   Est. Limit: ₹${item.req.approvedPrice}\n`;
      if (item.req.urgency) text += `   Urgency: ${item.req.urgency}\n`;
      text += `\n`;
    });

    text += `Please purchase and deliver to Workshop Store.`;

    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  return (
    <div className="space-y-6">
      
      {/* Toast Notification */}
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

      {/* Header & Primary Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black shrink-0">
            <ShoppingBag className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Part Order Basket & Market Shopping List</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500/20 text-amber-800 dark:text-amber-300">
                {toBuyCount} To Buy
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Aggregated spare part requisitions across all active job cards for market purchase runners.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={generateWhatsAppMessage}
            className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs shadow-md flex items-center gap-2 transition-all"
          >
            <Share2 className="w-4 h-4" />
            <span>Share via WhatsApp</span>
          </button>

          <button
            onClick={() => setShowPrintManifest(true)}
            className="px-4 py-2.5 rounded-2xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 font-extrabold text-xs shadow-md flex items-center gap-2 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Print Market List</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 text-xs font-bold">
            <span>Market Basket Items</span>
            <ShoppingBag className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-800 dark:text-amber-300">
            {toBuyCount}
          </p>
          <p className="text-[11px] text-amber-600/80 font-medium">Approved & ready for purchase</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-rose-500/30 bg-rose-500/5 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-rose-700 dark:text-rose-400 text-xs font-bold">
            <span>Critical Priority Parts</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-black text-rose-700 dark:text-rose-400">
            {criticalItemsCount}
          </p>
          <p className="text-[11px] text-rose-600/80 font-medium">Urgent vehicle hold-up</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>Est. Market Purchase Budget</span>
            <DollarSign className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            ₹{totalMarketBudget.toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-slate-400 font-medium">Sum of approved price limits</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>Pending Manager Approval</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">
            {pendingApprovalCount}
          </p>
          <p className="text-[11px] text-slate-400 font-medium">Awaiting price authorization</p>
        </div>

      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
        
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-xs">
          <button
            onClick={() => setActiveTab('TO_BUY')}
            className={`px-3.5 py-1.5 rounded-xl font-extrabold transition-all shrink-0 ${
              activeTab === 'TO_BUY'
                ? 'bg-amber-500 text-slate-950 font-extrabold shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            🛒 Market Shopping List ({toBuyCount})
          </button>

          <button
            onClick={() => setActiveTab('PENDING_APPROVAL')}
            className={`px-3.5 py-1.5 rounded-xl font-extrabold transition-all shrink-0 ${
              activeTab === 'PENDING_APPROVAL'
                ? 'bg-blue-600 text-white font-extrabold shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Pending Approval ({pendingApprovalCount})
          </button>

          <button
            onClick={() => setActiveTab('RECEIVED')}
            className={`px-3.5 py-1.5 rounded-xl font-extrabold transition-all shrink-0 ${
              activeTab === 'RECEIVED'
                ? 'bg-emerald-600 text-white font-extrabold shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Purchased & Received
          </button>

          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3.5 py-1.5 rounded-xl font-extrabold transition-all shrink-0 ${
              activeTab === 'ALL'
                ? 'bg-indigo-600 text-white font-extrabold shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            All Requisitions ({allRequisitionsList.length})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search part, car reg, mechanic, req ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Requisitions Shopping List Grid */}
      {filteredRequisitions.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900 space-y-3">
          <ShoppingBag className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            No part requisitions in this category!
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            When technicians or mechanics raise part requisitions from their task views and managers approve them, they automatically populate here for the market runner.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRequisitions.map(({ card, taskId, taskTitle, req }) => {
            const isToBuy = req.status === 'APPROVED' || req.status === 'ORDERED';
            const priceVal = req.purchasedPrice || req.approvedPrice || req.suggestedPrice || 0;

            return (
              <div
                key={`${card.id}-${taskId}-${req.id}`}
                className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 flex flex-col justify-between space-y-4 shadow-xs transition-all hover:border-amber-500/50 ${
                  req.urgency === 'CRITICAL' 
                    ? 'border-rose-500/40 bg-rose-500/5' 
                    : isToBuy
                    ? 'border-amber-500/30'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="space-y-3">
                  
                  {/* Card Top Meta Bar */}
                  <div className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800 pb-2.5">
                    <span className="font-mono font-black text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                      {req.id}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {req.urgency && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          req.urgency === 'CRITICAL' 
                            ? 'bg-rose-500 text-white'
                            : req.urgency === 'HIGH'
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                          {req.urgency}
                        </span>
                      )}

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        req.status === 'RECEIVED' || req.status === 'CONSUMED'
                          ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                          : req.status === 'APPROVED' || req.status === 'ORDERED'
                          ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300'
                          : 'bg-blue-500/20 text-blue-700 dark:text-blue-300'
                      }`}>
                        {req.status}
                      </span>
                    </div>
                  </div>

                  {/* Part Details */}
                  <div>
                    <h3 className="font-black text-base text-slate-900 dark:text-slate-100 flex items-center justify-between gap-2">
                      <span>{req.title}</span>
                      <span className="text-amber-600 dark:text-amber-400 font-mono text-sm shrink-0">
                        x{req.quantity} Pcs
                      </span>
                    </h3>

                    {req.partNumber && (
                      <p className="text-xs font-mono text-slate-500 mt-0.5 flex items-center gap-1">
                        <Tag className="w-3 h-3 text-slate-400" />
                        <span>Part #: {req.partNumber}</span>
                      </p>
                    )}
                  </div>

                  {/* Vehicle Context */}
                  <div className="bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <Car className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{card.vehicle.registrationNumber}</span>
                      </span>
                      <span className="text-slate-500 text-[11px] font-medium">
                        {card.vehicle.make} {card.vehicle.model}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Task: <strong className="text-slate-700 dark:text-slate-300">{taskTitle}</strong></span>
                      {onOpenJobCard && (
                        <button
                          onClick={() => onOpenJobCard(card.id)}
                          className="text-blue-600 dark:text-blue-400 hover:underline font-bold flex items-center gap-0.5"
                        >
                          <span>{card.id}</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Price & Mechanic Info */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <div className="flex items-center gap-1 text-slate-500">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>Mech: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{req.requestedByEmployeeName}</strong></span>
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Price Limit / Est</p>
                      <p className="font-mono font-black text-slate-900 dark:text-white text-sm">
                        ₹{priceVal.toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>

                  {req.vendorName && (
                    <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[11px] font-mono flex items-center justify-between">
                      <span>Purchased from: <strong>{req.vendorName}</strong></span>
                      {req.vendorInvoiceNo && <span>Bill #: {req.vendorInvoiceNo}</span>}
                    </div>
                  )}

                </div>

                {/* Bottom Market Action */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  {isToBuy ? (
                    <button
                      onClick={() => {
                        setActivePurchaseReq({ card, taskId, taskTitle, req });
                        setPurchasedPrice(req.approvedPrice || req.suggestedPrice || '');
                      }}
                      className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs shadow-md transition-all flex items-center justify-center gap-2"
                    >
                      <Store className="w-4 h-4" />
                      <span>Mark Purchased in Market</span>
                    </button>
                  ) : req.status === 'PENDING_APPROVAL' ? (
                    <p className="text-center text-xs font-bold text-slate-400 py-2">
                      Awaiting Manager Price Approval
                    </p>
                  ) : (
                    <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-bold py-1">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Acquired & At Workshop</span>
                      </span>
                      {req.consumedAt && (
                        <span className="text-[10px] font-mono text-slate-400">
                          Consumed: {req.consumedAt}
                        </span>
                      )}
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* MARK PURCHASED IN MARKET MODAL */}
      {activePurchaseReq && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold">
                  <Store className="w-4 h-4" />
                </div>
                <h3 className="font-black text-base text-slate-900 dark:text-slate-100">
                  Record Market Purchase
                </h3>
              </div>

              <button
                onClick={() => setActivePurchaseReq(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPurchase} className="space-y-4 text-xs">
              
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-1">
                <p className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                  {activePurchaseReq.req.title} (x{activePurchaseReq.req.quantity})
                </p>
                <p className="text-slate-500 font-mono text-[11px]">
                  Vehicle: {activePurchaseReq.card.vehicle.registrationNumber} ({activePurchaseReq.card.vehicle.make} {activePurchaseReq.card.vehicle.model})
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Actual Purchase Cost Paid in Market (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 1800"
                  value={purchasedPrice}
                  onChange={(e) => setPurchasedPrice(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Local Market Vendor / Shop Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Opera House Auto Spares / Laxmi Auto"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Vendor Cash Memo / Invoice # (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. INV-2026-99"
                  value={vendorInvoiceNo}
                  onChange={(e) => setVendorInvoiceNo(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Runner Notes / Quality Check
                </label>
                <input
                  type="text"
                  placeholder="e.g. Original OEM Hyundai sealed box verified."
                  value={runnerNotes}
                  onChange={(e) => setRunnerNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActivePurchaseReq(null)}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-md flex items-center gap-1.5"
                >
                  <PackageCheck className="w-4 h-4" />
                  <span>Confirm Received at Workshop</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE MARKET SHOPPING MANIFEST MODAL */}
      {showPrintManifest && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-3xl w-full max-w-2xl p-6 sm:p-8 space-y-6 shadow-2xl relative border border-slate-300 print:p-0 print:border-none">
            
            <button
              onClick={() => setShowPrintManifest(false)}
              className="absolute right-4 top-4 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 print:hidden"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Print Header */}
            <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
              <div className="flex items-center justify-center gap-2">
                <Wrench className="w-6 h-6 text-amber-600" />
                <h2 className="font-black text-2xl tracking-tight uppercase">
                  Auto<span className="text-amber-600">Craft</span> Workshop
                </h2>
              </div>
              <p className="text-xs font-bold text-slate-600">Local Auto Spare Market Procurement Manifest</p>
              <p className="text-[10px] font-mono text-slate-400">Printed Date: {new Date().toLocaleString()}</p>
            </div>

            {/* Manifest Table */}
            <div className="space-y-3">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-900 bg-slate-100 text-slate-800">
                    <th className="p-2 font-black">#</th>
                    <th className="p-2 font-black">Part Title & Part #</th>
                    <th className="p-2 font-black text-center">Qty</th>
                    <th className="p-2 font-black">Vehicle Registration & Model</th>
                    <th className="p-2 font-black text-right">Budget Limit</th>
                    <th className="p-2 font-black text-center print:table-cell">Got It [✓]</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {allRequisitionsList.filter(i => i.req.status === 'APPROVED' || i.req.status === 'ORDERED').map((item, idx) => (
                    <tr key={item.req.id}>
                      <td className="p-2 font-bold font-mono">{idx + 1}</td>
                      <td className="p-2">
                        <p className="font-black text-slate-900">{item.req.title}</p>
                        {item.req.partNumber && <p className="font-mono text-[10px] text-slate-500">PN: {item.req.partNumber}</p>}
                      </td>
                      <td className="p-2 text-center font-bold font-mono">{item.req.quantity}</td>
                      <td className="p-2">
                        <p className="font-mono font-bold text-slate-900">{item.card.vehicle.registrationNumber}</p>
                        <p className="text-[10px] text-slate-500">{item.card.vehicle.make} {item.card.vehicle.model}</p>
                      </td>
                      <td className="p-2 text-right font-mono font-bold">
                        ₹{(item.req.approvedPrice || item.req.suggestedPrice || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="p-2 text-center">
                        <div className="w-5 h-5 border-2 border-slate-800 rounded mx-auto"></div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer Signatures */}
            <div className="grid grid-cols-2 gap-6 pt-8 border-t text-center text-xs">
              <div className="space-y-8">
                <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto"></div>
                <p className="font-bold text-slate-700">Parts Runner / Purchaser Signature</p>
              </div>
              <div className="space-y-8">
                <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto"></div>
                <p className="font-bold text-slate-700">Workshop Store Keeper Receiver Sign</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t print:hidden">
              <button
                onClick={() => setShowPrintManifest(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 font-bold text-xs"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white font-black text-xs shadow-md flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>Print Manifest</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
