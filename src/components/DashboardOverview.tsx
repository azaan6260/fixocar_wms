import React, { useRef, useState } from 'react';
import { JobCard, UserRole } from '../types';
import { LicensePlateScannerModal } from './LicensePlateScannerModal';
import { 
  Car, 
  Wrench, 
  AlertCircle, 
  CheckCircle2, 
  Truck, 
  DollarSign, 
  Plus, 
  Sparkles, 
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Building2,
  Clock,
  ChevronRight,
  Camera,
  Package,
  AlertTriangle,
  Check,
  X,
  Flame
} from 'lucide-react';
import { respondToRequisition, resolveConcern } from '../lib/storage';

interface DashboardOverviewProps {
  jobCards: JobCard[];
  currentRole: UserRole;
  onOpenNewJobCard: (prefilledRegNum?: string) => void;
  onSelectJobCard: (cardId: string) => void;
  onOpenAIDiagnostics: () => void;
  onNavigateTab: (tab: string) => void;
}

export function DashboardOverview({
  jobCards,
  currentRole,
  onOpenNewJobCard,
  onSelectJobCard,
  onOpenAIDiagnostics,
  onNavigateTab,
}: DashboardOverviewProps) {
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const handleScannedPlate = (regNum: string) => {
    // Search active job cards
    const activeCard = jobCards.find(
      j => j.vehicle.registrationNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === regNum && 
           j.status !== 'CLOSED' && j.status !== 'DELIVERED'
    );

    if (activeCard) {
      alert(`Found active job card for ${regNum}. Opening details...`);
      onSelectJobCard(activeCard.id);
    } else {
      if (confirm(`No active job card found for ${regNum}. Create a new job card for this vehicle?`)) {
        onOpenNewJobCard(regNum);
      }
    }
  };

  // Metrics
  const activeCars = jobCards.filter(j => j.status !== 'DELIVERED' && j.status !== 'CLOSED');
  const retailCars = activeCars.filter(j => !j.isCars24);
  const cars24Cars = activeCars.filter(j => j.isCars24);

  const inProgress = jobCards.filter(j => j.status === 'IN_PROGRESS');
  const estimatePending = jobCards.filter(j => j.status === 'ESTIMATE_PENDING');
  const qcPending = jobCards.filter(j => j.status === 'QC_PENDING');
  const outForDelivery = jobCards.filter(j => j.status === 'OUT_FOR_DELIVERY');

  // Vehicle Type filter state for Live Job Cards table
  const [vehicleFilter, setVehicleFilter] = useState<'ALL' | 'RETAIL' | 'CARS24'>('ALL');

  const filteredActiveCars = activeCars.filter(j => {
    if (vehicleFilter === 'RETAIL') return !j.isCars24;
    if (vehicleFilter === 'CARS24') return j.isCars24;
    return true;
  });

  // Revenue
  const totalRevenue = jobCards.reduce((acc, card) => {
    const taskSum = card.tasks.reduce((tAcc, t) => tAcc + (t.customerPrice || 0), 0);
    return acc + taskSum;
  }, 0);

  const cars24Revenue = jobCards
    .filter(j => j.isCars24)
    .reduce((acc, card) => acc + card.tasks.reduce((tAcc, t) => tAcc + (t.customerPrice || 0), 0), 0);

  // Requisition Approval Prices state for Manager Action Desk
  const [approvalPrices, setApprovalPrices] = useState<Record<string, number>>({});

  const handlePriceChange = (reqId: string, value: number) => {
    setApprovalPrices(prev => ({ ...prev, [reqId]: value }));
  };

  const handleDashboardApproveReq = (cardId: string, taskId: string, reqId: string) => {
    const price = approvalPrices[reqId] || 0;
    respondToRequisition(cardId, taskId, reqId, true, price, 'Approved via Manager Dashboard');
  };

  const handleDashboardRejectReq = (cardId: string, taskId: string, reqId: string) => {
    respondToRequisition(cardId, taskId, reqId, false, 0, 'Rejected via Manager Dashboard');
  };

  const handleDashboardResolveConcern = (cardId: string, taskId: string, concernId: string) => {
    resolveConcern(cardId, taskId, concernId, 'RESOLVED', 'Resolved via Manager Dashboard');
  };

  // Requisitions & Concerns across all job cards
  const pendingRequisitions = jobCards.flatMap(card =>
    card.tasks.flatMap(task =>
      (task.requisitions || [])
        .filter(r => r.status === 'PENDING_APPROVAL')
        .map(r => ({ requisition: r, card, task }))
    )
  );

  const openConcerns = jobCards.flatMap(card =>
    card.tasks.flatMap(task =>
      (task.concerns || [])
        .filter(c => c.status !== 'RESOLVED')
        .map(c => ({ concern: c, card, task }))
    )
  );

  return (
    <div className="space-y-6">

      {/* Daily Huddle Quick Entry Banner */}
      <div 
        onClick={() => onNavigateTab('daily-huddle')}
        className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-5 shadow-lg border border-indigo-900/50 hover:border-amber-400/60 transition-all cursor-pointer group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="bg-amber-500 text-slate-950 p-3 rounded-2xl shrink-0 font-black shadow-md group-hover:scale-105 transition-transform">
            <Flame className="w-6 h-6 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-extrabold text-[10px] uppercase tracking-widest bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                Live Shop Floor Sync
              </span>
              <span className="text-indigo-200 text-xs font-semibold">Today's Standup</span>
            </div>
            <h2 className="text-base sm:text-lg font-black tracking-tight text-white mt-0.5">
              Daily Huddle Dashboard • Active Jobs & Upcoming Deadlines
            </h2>
            <p className="text-xs text-indigo-200/80">
              Filtered list of active jobs across body shop, mechanical, washing & sublet with deadline urgency alerts.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNavigateTab('daily-huddle');
          }}
          className="px-4 py-2 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-all shadow-md shrink-0"
        >
          <span>Open Daily Huddle</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* CARS24 & WORKSHOP VEHICLE BREAKDOWN METRICS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Cars In Workshop</span>
            <Car className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{activeCars.length}</p>
          <span className="text-[10px] text-slate-500 font-semibold">Active in all workshop bays</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/40 shadow-xs">
          <div className="flex items-center justify-between text-blue-600 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Retail Customer Cars</span>
            <Car className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{retailCars.length}</p>
          <span className="text-[10px] text-slate-500 font-semibold">Regular retail repairs</span>
        </div>

        <div className="bg-orange-50/60 dark:bg-orange-950/30 p-4 rounded-2xl border border-orange-200 dark:border-orange-900/60 shadow-xs">
          <div className="flex items-center justify-between text-orange-600 dark:text-orange-400 mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider">Cars24 Partner Fleet</span>
            <Car className="w-4 h-4 text-orange-600" />
          </div>
          <p className="text-2xl font-black text-orange-600 dark:text-orange-400">{cars24Cars.length}</p>
          <span className="text-[10px] text-orange-700 dark:text-orange-300 font-semibold">Cars24 Vendor Jobs</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Cars24 Billing Volume</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">₹{cars24Revenue.toLocaleString('en-IN')}</p>
          <span className="text-[10px] text-slate-500 font-semibold">Cars24 B2B Invoices Total</span>
        </div>
      </div>

      {/* WORKSHOP MANAGER ACTION DESK: PENDING REQUISITIONS & CONCERNS */}
      {(pendingRequisitions.length > 0 || openConcerns.length > 0) && (
        <div className="bg-amber-500/10 border-2 border-amber-500/40 dark:border-amber-500/30 p-5 rounded-3xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-500/20 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500 animate-ping" />
              <h2 className="text-sm font-black text-amber-950 dark:text-amber-200 uppercase tracking-wider flex items-center gap-2">
                ⚡ Manager Action Desk: Pending Part Requisitions & Floor Concerns
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
              <span className="px-2.5 py-0.5 rounded-full bg-orange-500 text-white text-[11px]">
                {pendingRequisitions.length} Pending Requisitions
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-rose-500 text-white text-[11px]">
                {openConcerns.length} Reported Concerns
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* PENDING REQUISITIONS LIST */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/50 space-y-3">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-1.5">
                <Package className="w-4 h-4 text-orange-500" />
                Pending Part & Consumable Requisitions ({pendingRequisitions.length})
              </h3>

              {pendingRequisitions.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No pending part requisitions from mechanics.</p>
              ) : (
                <div className="space-y-3 text-xs max-h-72 overflow-y-auto pr-1">
                  {pendingRequisitions.map(({ requisition: req, card, task }) => (
                    <div key={req.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 dark:text-slate-100">{req.title}</span>
                            <span className="px-2 py-0.2 rounded font-mono font-bold text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                              Qty: {req.quantity}
                            </span>
                            <span className="px-1.5 py-0.2 rounded font-bold text-[9px] bg-orange-500/10 text-orange-600 uppercase">
                              {req.itemType}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Job: <strong className="text-slate-800 dark:text-slate-200">{card.vehicle.registrationNumber} ({card.id})</strong> • Task: {task.title}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Requested by: {req.requestedByEmployeeName || 'Mechanic Staff'} {req.reason ? `• "${req.reason}"` : ''}
                          </p>
                        </div>

                        <button
                          onClick={() => onSelectJobCard(card.id)}
                          className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                        >
                          View Job Card
                        </button>
                      </div>

                      {/* Approval Controls */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-700/60">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-500">Approve Price (₹):</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="Price ₹"
                            value={approvalPrices[req.id] || ''}
                            onChange={(e) => handlePriceChange(req.id, Number(e.target.value))}
                            className="w-24 px-2 py-1 text-xs font-mono font-bold rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600"
                          />
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleDashboardApproveReq(card.id, task.id, req.id)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs"
                          >
                            <Check className="w-3 h-3" /> Approve & Add
                          </button>
                          <button
                            onClick={() => handleDashboardRejectReq(card.id, task.id, req.id)}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* OPEN TECHNICAL CONCERNS LIST */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-rose-200 dark:border-rose-900/50 space-y-3">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                Reported Mechanics Difficulties & Concerns ({openConcerns.length})
              </h3>

              {openConcerns.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No open concerns reported by mechanics.</p>
              ) : (
                <div className="space-y-3 text-xs max-h-72 overflow-y-auto pr-1">
                  {openConcerns.map(({ concern: c, card, task }) => (
                    <div key={c.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 dark:text-slate-100">{c.issueDescription}</span>
                            <span className={`px-2 py-0.2 rounded text-[9px] font-black uppercase ${
                              c.urgency === 'CRITICAL' ? 'bg-rose-600 text-white' :
                              c.urgency === 'HIGH' ? 'bg-rose-500/20 text-rose-600' :
                              'bg-amber-500/20 text-amber-600'
                            }`}>
                              {c.urgency}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Job: <strong className="text-slate-800 dark:text-slate-200">{card.vehicle.registrationNumber} ({card.id})</strong> • Task: {task.title}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Reported by: {c.raisedByEmployeeName || 'Staff'} • {c.createdAt}
                          </p>
                        </div>

                        <button
                          onClick={() => onSelectJobCard(card.id)}
                          className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                        >
                          View Job Card
                        </button>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700/60">
                        <button
                          onClick={() => handleDashboardResolveConcern(card.id, task.id, c.id)}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs"
                        >
                          <Check className="w-3 h-3" /> Mark Resolved
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">

        {/* 1. Live Job Cards (Main Large Bento Card) */}
        <section className="col-span-12 lg:col-span-8 bg-white dark:bg-slate-900 rounded-3xl shadow-xs border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="font-extrabold text-lg text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                  Live Job Cards
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Active vehicles in repair bays & inspection pipeline</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-xs px-3.5 py-2 rounded-full font-extrabold transition-all flex items-center gap-1.5 shadow-xs"
                >
                  <Camera className="w-3.5 h-3.5 text-amber-500" />
                  <span>Scan Plate Camera</span>
                </button>
                <button
                  onClick={onOpenAIDiagnostics}
                  className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs px-3.5 py-2 rounded-full font-bold transition-all flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  AI Diagnosis
                </button>
                <button
                  onClick={() => onOpenNewJobCard()}
                  className="bg-blue-600 text-white text-xs px-4 py-2 rounded-full font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-600/20 active:scale-95"
                >
                  + CREATE JOB CARD
                </button>
              </div>
            </div>

            {/* Filter Pills for All / Retail / Cars24 */}
            <div className="flex items-center gap-1.5 mb-4 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl w-fit">
              <button
                onClick={() => setVehicleFilter('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  vehicleFilter === 'ALL'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                All Cars ({activeCars.length})
              </button>
              <button
                onClick={() => setVehicleFilter('RETAIL')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  vehicleFilter === 'RETAIL'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Retail Cars ({retailCars.length})
              </button>
              <button
                onClick={() => setVehicleFilter('CARS24')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  vehicleFilter === 'CARS24'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Cars24 Fleet ({cars24Cars.length})
              </button>
            </div>

            {/* Job Cards Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Vehicle</th>
                    <th className="px-4 py-3">Primary Service</th>
                    <th className="px-4 py-3">Team Assigned</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredActiveCars.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        No active vehicles in this category.
                      </td>
                    </tr>
                  ) : (
                    filteredActiveCars.slice(0, 5).map((card) => {
                      const primaryTask = card.tasks[0]?.title || 'General Inspection';
                      const hasPendingApproval = card.status === 'ESTIMATE_PENDING';

                      return (
                        <tr
                          key={card.id}
                          onClick={() => onSelectJobCard(card.id)}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                            <div className="flex items-center gap-1.5">
                              {card.id}
                              {card.isCars24 && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-orange-500 text-white uppercase">
                                  Cars24
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="font-bold text-slate-900 dark:text-slate-100">
                              {card.vehicle.make} {card.vehicle.model}
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono">
                              {card.vehicle.registrationNumber} • {card.vehicle.color}
                            </p>
                          </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-block text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                            hasPendingApproval
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                              : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400'
                          }`}>
                            {primaryTask}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex -space-x-1.5 overflow-hidden">
                            <div className="w-6 h-6 bg-blue-500 text-white rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-[9px] font-extrabold">
                              M
                            </div>
                            <div className="w-6 h-6 bg-purple-500 text-white rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-[9px] font-extrabold">
                              D
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                            {card.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-blue-600 dark:text-blue-400 hover:underline">
                          View →
                        </td>
                      </tr>
                    );
                  })
                )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card Footer Link */}
          <div className="pt-4 flex items-center justify-between text-xs font-bold text-slate-500 border-t border-slate-100 dark:border-slate-800 mt-4">
            <span>Showing {Math.min(5, activeCars.length)} of {activeCars.length} active job cards</span>
            <button
              onClick={() => onNavigateTab('job-cards')}
              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              Open Full Job Cards Board
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>

        {/* 2. Floor Capacity (Dark Bento Card) */}
        <section className="col-span-12 lg:col-span-4 bg-slate-900 rounded-3xl p-6 text-white overflow-hidden relative shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Floor Capacity
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">LIVE BAYS</span>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-slate-200">Mechanics</span>
                  <span className="font-bold">8/12 <span className="text-[10px] font-normal text-slate-400">Busy</span></span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full w-[66%]" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-slate-200">Painters & Booth</span>
                  <span className="font-bold">3/4 <span className="text-[10px] font-normal text-slate-400">Busy</span></span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div className="bg-pink-500 h-2 rounded-full w-[75%]" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-slate-200">Denters & Metalwork</span>
                  <span className="font-bold">2/6 <span className="text-[10px] font-normal text-slate-400">Busy</span></span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div className="bg-amber-500 h-2 rounded-full w-[33%]" />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Gross Revenue: <strong className="text-emerald-400 font-mono">₹{totalRevenue.toLocaleString('en-IN')}</strong></span>
            <button
              onClick={() => onNavigateTab('role-workspace')}
              className="text-blue-400 font-bold hover:underline"
            >
              Role Workspaces →
            </button>
          </div>

          {/* Ambient Glow */}
          <div className="absolute -bottom-10 -right-10 w-36 h-36 bg-blue-600/25 blur-3xl pointer-events-none" />
        </section>

        {/* 3. Pending Approvals (Bento Card) */}
        <section className="col-span-12 md:col-span-6 lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Pending Approvals
              </h2>
              <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse">
                {estimatePending.length} URGENT
              </span>
            </div>

            <div className="space-y-3">
              {estimatePending.length === 0 ? (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-center text-xs text-slate-400">
                  All estimates approved!
                </div>
              ) : (
                estimatePending.slice(0, 2).map((card) => {
                  const estPrice = card.tasks.reduce((sum, t) => sum + (t.customerPrice || 0), 0);
                  return (
                    <div
                      key={card.id}
                      className="bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-2xl flex items-center justify-between border border-slate-100 dark:border-slate-700"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {card.id} • {card.vehicle.registrationNumber}
                        </p>
                        <p className="text-[10px] text-slate-500 uppercase font-mono mt-0.5">
                          ₹{estPrice.toLocaleString('en-IN')} Estimated
                        </p>
                      </div>
                      <button
                        onClick={() => onSelectJobCard(card.id)}
                        className="text-blue-600 dark:text-blue-400 font-bold text-[10px] uppercase hover:underline"
                      >
                        Review
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('job-cards')}
            className="mt-4 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center justify-center gap-1 pt-2 border-t border-slate-100 dark:border-slate-800"
          >
            Manage Approvals Board
          </button>
        </section>

        {/* 4. Pickup & Delivery / Logistics (Indigo Bento Card) */}
        <section className="col-span-12 md:col-span-6 lg:col-span-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-xs font-bold text-indigo-900/50 dark:text-indigo-300/60 uppercase tracking-widest mb-4">
              Pickup & Delivery
            </h2>

            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-indigo-950 dark:text-indigo-100 text-base">
                  {outForDelivery.length || 3} Vehicles Out
                </p>
                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium uppercase tracking-wide">
                  Next arrival in 12 mins
                </p>
              </div>
            </div>

            <div className="border-t border-indigo-200/60 dark:border-indigo-900/60 pt-3">
              <p className="text-[10px] font-bold text-indigo-900/50 dark:text-indigo-300/50 uppercase mb-2">
                Latest Logistics Status
              </p>
              <div className="flex items-center gap-2 text-xs font-medium text-indigo-950 dark:text-indigo-200">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Driver assigned • GPS tracking live</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('deliveries')}
            className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            Open Logistics Tracker
          </button>
        </section>

        {/* 5. Supplier Network / Vendor Quick Links (Bento Card) */}
        <section className="col-span-12 md:col-span-6 lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
              Supplier Network
            </h2>

            <div className="grid grid-cols-2 gap-2.5">
              <div
                onClick={() => onNavigateTab('vendors')}
                className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl flex flex-col justify-center items-center gap-1 cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-700 border border-transparent hover:border-blue-200 transition-all text-center"
              >
                <span className="text-xl">⚙️</span>
                <span className="text-[10px] font-bold uppercase text-slate-800 dark:text-slate-200">Spare Parts</span>
              </div>

              <div
                onClick={() => onNavigateTab('vendors')}
                className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl flex flex-col justify-center items-center gap-1 cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-700 border border-transparent hover:border-blue-200 transition-all text-center"
              >
                <span className="text-xl">🧴</span>
                <span className="text-[10px] font-bold uppercase text-slate-800 dark:text-slate-200">Oils & Fluids</span>
              </div>

              <div
                onClick={() => onNavigateTab('vendors')}
                className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl flex flex-col justify-center items-center gap-1 cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-700 border border-transparent hover:border-blue-200 transition-all text-center"
              >
                <span className="text-xl">🏎️</span>
                <span className="text-[10px] font-bold uppercase text-slate-800 dark:text-slate-200">Lathe Work</span>
              </div>

              <div
                onClick={() => onNavigateTab('vendors')}
                className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl flex flex-col justify-center items-center gap-1 cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-700 border border-transparent hover:border-blue-200 transition-all text-center"
              >
                <span className="text-xl">🛞</span>
                <span className="text-[10px] font-bold uppercase text-slate-800 dark:text-slate-200">Tyres</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('vendors')}
            className="mt-4 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline text-center"
          >
            Manage Vendors & Sublet POs →
          </button>
        </section>

        {/* 6. Inspection Queue (Emerald Bento Card) */}
        <section className="col-span-12 md:col-span-6 lg:col-span-4 bg-emerald-600 rounded-3xl p-6 text-white relative shadow-md flex flex-col justify-between overflow-hidden">
          <div>
            <h2 className="text-xs font-bold text-emerald-100 uppercase tracking-widest mb-4">
              Inspection Queue
            </h2>

            <div className="flex items-end justify-between">
              <div>
                <span className="text-4xl font-black font-mono">
                  {qcPending.length < 10 ? `0${qcPending.length}` : qcPending.length}
                </span>
                <p className="text-xs font-bold text-emerald-100 uppercase mt-1">
                  Cars Waiting Quality Control
                </p>
              </div>
              <ShieldCheck className="w-12 h-12 text-emerald-300 opacity-80" />
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('job-cards')}
            className="mt-6 w-full bg-white/20 hover:bg-white/30 transition-all py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider backdrop-blur-xs"
          >
            Open 12-Point QC Audit
          </button>
        </section>

      </div>

      <LicensePlateScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanComplete={handleScannedPlate}
      />
    </div>
  );
}
