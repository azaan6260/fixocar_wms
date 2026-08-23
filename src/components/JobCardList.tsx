import React, { useState, useEffect } from 'react';
import { JobCard, JobCardStatus } from '../types';
import { 
  Search, 
  Plus, 
  Car, 
  User, 
  Calendar, 
  Wrench, 
  AlertCircle, 
  CheckCircle2, 
  Truck, 
  FileText,
  ChevronRight,
  Sparkles,
  Phone,
  ShieldCheck,
  Building2,
  QrCode,
  Flame,
  PackageCheck,
  History,
  Clock,
  Archive,
  Check,
  Trash2
} from 'lucide-react';
import { deleteJobCard } from '../lib/storage';
import { PartRequisitionModal } from './PartRequisitionModal';
import { FuelTypeBadge } from './FuelTypeBadge';

interface JobCardListProps {
  jobCards: JobCard[];
  onSelectJobCard: (cardId: string) => void;
  onOpenNewJobCardModal: () => void;
  onOpenCustomerApprovalPortal: (cardId: string) => void;
  onOpenQCModal: (cardId: string) => void;
  onOpenQRModal?: (cardId: string) => void;
  initialSection?: 'ACTIVE' | 'HISTORY';
}

const STATUS_BADGES: Record<JobCardStatus, { label: string; bg: string; text: string; border: string }> = {
  CREATED: { label: 'Opened', bg: 'bg-slate-500/10', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-800' },
  INSPECTION: { label: 'Diagnosing', bg: 'bg-blue-500/10', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
  JOB_ALLOCATED: { label: 'Tasks Allotted', bg: 'bg-indigo-500/10', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-800' },
  IN_PROGRESS: { label: 'In Repair', bg: 'bg-blue-500/10', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
  ESTIMATE_PENDING: { label: 'Approval Required', bg: 'bg-amber-500/10', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
  QC_PENDING: { label: 'Floor QC Audit', bg: 'bg-purple-500/10', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
  READY_FOR_DELIVERY: { label: 'Ready for Dispatch', bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', bg: 'bg-cyan-500/10', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-200 dark:border-cyan-800' },
  DELIVERED: { label: 'Delivered', bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
  CLOSED: { label: 'Closed', bg: 'bg-slate-500/10', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-800' },
};

export function JobCardList({
  jobCards,
  onSelectJobCard,
  onOpenNewJobCardModal,
  onOpenCustomerApprovalPortal,
  onOpenQCModal,
  onOpenQRModal,
  initialSection = 'ACTIVE'
}: JobCardListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [mainSection, setMainSection] = useState<'ACTIVE' | 'HISTORY'>(initialSection);
  const [activeSubFilter, setActiveSubFilter] = useState<string>('ALL');
  const [requisitionModalCard, setRequisitionModalCard] = useState<JobCard | null>(null);

  useEffect(() => {
    if (initialSection) {
      setMainSection(initialSection);
    }
  }, [initialSection]);

  const activeCards = jobCards.filter((c) => c.status !== 'DELIVERED' && c.status !== 'CLOSED');
  const historyCards = jobCards.filter((c) => c.status === 'DELIVERED' || c.status === 'CLOSED');

  const filteredCards = (mainSection === 'ACTIVE' ? activeCards : historyCards).filter((card) => {
    const searchLower = searchTerm.toLowerCase().trim();
    const matchesSearch = !searchLower || (
      card.id.toLowerCase().includes(searchLower) ||
      card.vehicle.registrationNumber.toLowerCase().includes(searchLower) ||
      card.vehicle.make.toLowerCase().includes(searchLower) ||
      card.vehicle.model.toLowerCase().includes(searchLower) ||
      (card.vehicle.variant && card.vehicle.variant.toLowerCase().includes(searchLower)) ||
      (card.vehicle.fuelType && card.vehicle.fuelType.toLowerCase().includes(searchLower)) ||
      card.customer.name.toLowerCase().includes(searchLower) ||
      card.customer.phone.includes(searchLower) ||
      (card.cityName && card.cityName.toLowerCase().includes(searchLower)) ||
      (card.workshopName && card.workshopName.toLowerCase().includes(searchLower))
    );

    if (!matchesSearch) return false;

    if (mainSection === 'ACTIVE') {
      if (activeSubFilter === 'APPROVAL') return card.status === 'ESTIMATE_PENDING' || card.tasks.some(t => t.requiresCustomerApproval && t.isCustomerApproved === null);
      if (activeSubFilter === 'QC') return card.status === 'QC_PENDING';
      if (activeSubFilter === 'DELIVERY') return card.status === 'READY_FOR_DELIVERY' || card.status === 'OUT_FOR_DELIVERY';
      if (activeSubFilter === 'CARS24') return card.isCars24;
      if (activeSubFilter === 'URGENT') return card.isUrgent;
    } else {
      if (activeSubFilter === 'DELIVERED') return card.status === 'DELIVERED';
      if (activeSubFilter === 'CLOSED') return card.status === 'CLOSED';
      if (activeSubFilter === 'CARS24') return card.isCars24;
    }

    return true;
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      
      {/* Primary Section Switcher Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 shadow-xs space-y-4">
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
              Automotive Job Cards Directory
            </span>
            <h1 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 mt-0.5">
              {mainSection === 'ACTIVE' ? (
                <>
                  <Car className="w-6 h-6 text-blue-600 shrink-0" />
                  Active Workshop Job Cards ({activeCards.length})
                </>
              ) : (
                <>
                  <History className="w-6 h-6 text-emerald-600 shrink-0" />
                  History of Job Cards (Delivered & Closed) ({historyCards.length})
                </>
              )}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
              {mainSection === 'ACTIVE'
                ? 'Vehicles currently undergoing inspection, diagnosis, repair, QC, or awaiting customer approval and handover.'
                : 'Completed & delivered vehicle job card archives with historical work orders, final billing, and check-out logs.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenNewJobCardModal}
            className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-600/20 active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Create Job Card</span>
          </button>
        </div>

        {/* Section Tabs: Active Job Cards vs History of Job Cards */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
          <button
            type="button"
            onClick={() => {
              setMainSection('ACTIVE');
              setActiveSubFilter('ALL');
            }}
            className={`flex-1 min-h-[42px] px-4 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${
              mainSection === 'ACTIVE'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Car className="w-4 h-4" />
            <span>Active Job Cards ({activeCards.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMainSection('HISTORY');
              setActiveSubFilter('ALL');
            }}
            className={`flex-1 min-h-[42px] px-4 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${
              mainSection === 'HISTORY'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <History className="w-4 h-4" />
            <span>📜 History of Job Cards ({historyCards.length})</span>
          </button>
        </div>

        {/* Filter Controls & Search Input */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 pt-1 border-t border-slate-100 dark:border-slate-800">
          
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Reg No, Customer, Make, Model..."
              className="w-full pl-9 pr-4 min-h-[44px] text-xs rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          {/* Sub-Filter Pills */}
          <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {mainSection === 'ACTIVE' ? (
              [
                { id: 'ALL', label: `All Active (${activeCards.length})` },
                { id: 'APPROVAL', label: `Needs Approval (${activeCards.filter(c => c.status === 'ESTIMATE_PENDING' || c.tasks.some(t => t.requiresCustomerApproval && t.isCustomerApproved === null)).length})` },
                { id: 'QC', label: `QC Audit (${activeCards.filter(c => c.status === 'QC_PENDING').length})` },
                { id: 'DELIVERY', label: `Ready/Delivery (${activeCards.filter(c => c.status === 'READY_FOR_DELIVERY' || c.status === 'OUT_FOR_DELIVERY').length})` },
                { id: 'CARS24', label: `Cars24 (${activeCards.filter(c => c.isCars24).length})` },
                { id: 'URGENT', label: `Urgent (${activeCards.filter(c => c.isUrgent).length})` },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActiveSubFilter(f.id)}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center justify-center shrink-0 active:scale-95 ${
                    activeSubFilter === f.id
                      ? f.id === 'CARS24' ? 'bg-orange-600 text-white shadow-xs' : 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {f.label}
                </button>
              ))
            ) : (
              [
                { id: 'ALL', label: `All History (${historyCards.length})` },
                { id: 'DELIVERED', label: `Delivered (${historyCards.filter(c => c.status === 'DELIVERED').length})` },
                { id: 'CLOSED', label: `Closed (${historyCards.filter(c => c.status === 'CLOSED').length})` },
                { id: 'CARS24', label: `Cars24 (${historyCards.filter(c => c.isCars24).length})` },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActiveSubFilter(f.id)}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center justify-center shrink-0 active:scale-95 ${
                    activeSubFilter === f.id
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {f.label}
                </button>
              ))
            )}
          </div>

        </div>

      </div>

      {/* Cards Responsive Grid */}
      {filteredCards.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 sm:p-12 text-center text-slate-500">
          <Car className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-slate-400 mb-3 stroke-[1.5]" />
          <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm sm:text-base">
            No {mainSection === 'ACTIVE' ? 'Active' : 'History'} Job Cards Found
          </h3>
          <p className="text-xs mt-1">
            {mainSection === 'ACTIVE'
              ? 'All delivered vehicles have been moved to the History of Job Cards section.'
              : 'Delivered and closed vehicle job cards will automatically appear here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {filteredCards.map((card) => {
            const statusStyle = STATUS_BADGES[card.status] || STATUS_BADGES.IN_PROGRESS;
            const completedCount = card.tasks.filter((t) => t.status === 'COMPLETED').length;
            const progress = card.tasks.length ? Math.round((completedCount / card.tasks.length) * 100) : 0;
            const needsApproval = card.status === 'ESTIMATE_PENDING' || card.tasks.some(t => t.requiresCustomerApproval && t.isCustomerApproved === null);
            const totalBill = card.tasks.reduce((acc, t) => acc + (t.customerPrice || 0), 0);
            const hasSublet = card.tasks.some(t => t.category === 'SUBLET_VENDOR' || t.category === 'WASHING');
            const isDeliveredOrClosed = card.status === 'DELIVERED' || card.status === 'CLOSED';

            return (
              <div
                key={card.id}
                className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 transition-all shadow-xs flex flex-col justify-between overflow-hidden group"
              >
                
                {/* Card Top Header & Main Info */}
                <div className="p-4 sm:p-5 space-y-3">
                  
                  {/* Top Bar: ID, Urgency, Cars24 & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-[11px] font-extrabold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                        {card.id}
                      </span>
                      {card.isUrgent && (
                        <span className="bg-amber-500 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-0.5 animate-pulse">
                          🔥 URGENT
                        </span>
                      )}
                      {card.isCars24 && (
                        <span className="bg-orange-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Cars24
                        </span>
                      )}
                    </div>

                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-wide border shrink-0 ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                      {statusStyle.label}
                    </span>
                  </div>

                  {/* Vehicle Information Row */}
                  <div className="flex items-start gap-3">
                    <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 font-bold border ${
                      isDeliveredOrClosed 
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/40' 
                        : 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/40'
                    }`}>
                      <Car className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h2 className="font-black text-base sm:text-lg text-slate-900 dark:text-slate-100 tracking-tight font-mono truncate">
                          {card.vehicle.registrationNumber}
                        </h2>
                        <FuelTypeBadge fuelType={card.vehicle.fuelType} size="sm" />
                      </div>
                      <p className="text-xs font-extrabold text-slate-700 dark:text-slate-300 truncate flex items-center gap-1 flex-wrap">
                        <span>{card.vehicle.make} {card.vehicle.model}</span>
                        {card.vehicle.variant && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700">
                            {card.vehicle.variant}
                          </span>
                        )}
                        <span className="text-slate-400 font-normal">({card.vehicle.year})</span>
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium truncate">
                        Color: {card.vehicle.color} • {card.vehicle.mileage.toLocaleString('en-IN')} km
                      </p>
                    </div>
                  </div>

                  {/* Customer Info Card */}
                  <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800/80 text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-medium">
                      <span className="flex items-center gap-1.5 font-bold truncate">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{card.customer.name}</span>
                      </span>
                      <a
                        href={`tel:${card.customer.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline text-[11px] font-mono font-bold shrink-0 ml-2"
                      >
                        <Phone className="w-3 h-3" />
                        <span>{card.customer.phone}</span>
                      </a>
                    </div>
                  </div>

                  {/* Tasks Progress Bar */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                        {isDeliveredOrClosed ? 'Work Order Completed' : 'Repair Progress'}
                      </span>
                      <span className="font-extrabold text-blue-600 dark:text-blue-400 font-mono text-[11px]">
                        {completedCount}/{card.tasks.length} Done ({progress}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`${isDeliveredOrClosed ? 'bg-emerald-500' : 'bg-blue-600'} h-2 rounded-full transition-all duration-300`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Checked out timestamp for history */}
                  {isDeliveredOrClosed && card.checkedOutAt && (
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center justify-between font-medium">
                      <span className="flex items-center gap-1 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        Delivered
                      </span>
                      <span className="font-mono text-[10px]">
                        {new Date(card.checkedOutAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  )}

                  {/* Badges / Sublet alert */}
                  <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                    {hasSublet && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                        <Building2 className="w-3 h-3" />
                        Sublet Vendor Work
                      </span>
                    )}
                    {!isDeliveredOrClosed && needsApproval && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
                        <AlertCircle className="w-3 h-3" />
                        Customer Approval Needed
                      </span>
                    )}
                  </div>

                </div>

                {/* Mobile Quick Action Bar for Parts / Requisitions (only for active cards) */}
                {!isDeliveredOrClosed && (
                  <div className="px-3.5 sm:px-4 py-2 bg-amber-500/10 dark:bg-amber-500/5 border-t border-b border-amber-500/20 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-900 dark:text-amber-300 font-bold">
                      <PackageCheck className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Parts Requisition</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setRequisitionModalCard(card)}
                      className="min-h-[36px] px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1 shadow-xs transition-transform active:scale-95 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      <span>+ Requisition</span>
                    </button>
                  </div>
                )}

                {/* Card Footer Actions */}
                <div className="p-3 sm:p-3.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-widest font-bold">Final Bill</p>
                    <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 font-mono">
                      ₹{totalBill.toLocaleString('en-IN')}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {onOpenQRModal && (
                      <button
                        type="button"
                        onClick={() => onOpenQRModal(card.id)}
                        className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-amber-500 hover:text-slate-950 transition-colors flex items-center justify-center shrink-0 active:scale-95"
                        title="View Job Card QR Code"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`🗑️ Delete Job Card ${card.id}?\n\nVehicle: ${card.vehicle.registrationNumber} (${card.vehicle.make} ${card.vehicle.model})\nCustomer: ${card.customer.name}\nStatus: ${card.status}\n\nAre you sure you want to delete this job card? This action cannot be undone.`)) {
                          deleteJobCard(card.id);
                        }
                      }}
                      className="w-9 h-9 rounded-full bg-rose-500/10 hover:bg-rose-500 text-rose-600 dark:text-rose-400 hover:text-white transition-colors flex items-center justify-center shrink-0 active:scale-95"
                      title="Delete Job Card"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectJobCard(card.id)}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-black hover:bg-slate-800 dark:hover:bg-slate-200 transition-all flex items-center gap-1 shadow-xs active:scale-95"
                    >
                      <span>{isDeliveredOrClosed ? 'View History' : 'Manage'}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Part Requisition / Consumption Modal */}
      {requisitionModalCard && (
        <PartRequisitionModal
          card={requisitionModalCard}
          isOpen={Boolean(requisitionModalCard)}
          onClose={() => setRequisitionModalCard(null)}
        />
      )}

    </div>
  );
}

