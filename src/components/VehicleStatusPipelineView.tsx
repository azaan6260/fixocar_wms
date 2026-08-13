import React, { useState, useMemo } from 'react';
import { JobCard, JobCardStatus, UserRole } from '../types';
import { updateJobCard, getJobCards } from '../lib/storage';
import { 
  Car, 
  Search, 
  Plus, 
  ChevronRight, 
  ArrowRight, 
  Clock, 
  User, 
  Phone, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  PackageCheck, 
  Wrench, 
  Building2, 
  Sparkles, 
  Flame, 
  SlidersHorizontal, 
  Layers, 
  Eye, 
  LogOut, 
  Tag,
  ArrowRightLeft,
  Check
} from 'lucide-react';
import { PartRequisitionModal } from './PartRequisitionModal';

interface VehicleStatusPipelineViewProps {
  jobCards: JobCard[];
  currentRole: UserRole;
  onSelectJobCard: (id: string) => void;
  onOpenNewJobCardModal: () => void;
  onOpenCustomerApprovalPortal: (id: string) => void;
  onOpenQCModal: (id: string) => void;
}

export interface StatusColumnConfig {
  id: string;
  title: string;
  shortLabel: string;
  icon: any;
  colorTheme: {
    bg: string;
    border: string;
    badgeBg: string;
    badgeText: string;
    headerBg: string;
    accent: string;
  };
  statuses: JobCardStatus[];
  description: string;
}

const PIPELINE_COLUMNS: StatusColumnConfig[] = [
  {
    id: 'pi_done',
    title: 'Pre-Inspection (PI Done)',
    shortLabel: 'PI Done',
    icon: ShieldCheck,
    colorTheme: {
      bg: 'bg-slate-50/50 dark:bg-slate-900/50',
      border: 'border-cyan-500/30',
      badgeBg: 'bg-cyan-500/10 dark:bg-cyan-500/20',
      badgeText: 'text-cyan-700 dark:text-cyan-300',
      headerBg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-900 dark:text-cyan-300',
      accent: 'text-cyan-500',
    },
    statuses: ['INSPECTION'],
    description: 'Vehicle received & undergoing pre-inspection diagnostic check.',
  },
  {
    id: 'created',
    title: 'Job Card Created',
    shortLabel: 'JC Created',
    icon: Sparkles,
    colorTheme: {
      bg: 'bg-slate-50/50 dark:bg-slate-900/50',
      border: 'border-blue-500/30',
      badgeBg: 'bg-blue-500/10 dark:bg-blue-500/20',
      badgeText: 'text-blue-700 dark:text-blue-300',
      headerBg: 'bg-blue-500/10 border-blue-500/20 text-blue-900 dark:text-blue-300',
      accent: 'text-blue-500',
    },
    statuses: ['CREATED'],
    description: 'Job card registered, awaiting task allotment & technical breakdown.',
  },
  {
    id: 'allocated',
    title: 'Job Allocated & Estimate',
    shortLabel: 'Allocated/Est',
    icon: User,
    colorTheme: {
      bg: 'bg-slate-50/50 dark:bg-slate-900/50',
      border: 'border-amber-500/30',
      badgeBg: 'bg-amber-500/10 dark:bg-amber-500/20',
      badgeText: 'text-amber-800 dark:text-amber-300',
      headerBg: 'bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-300',
      accent: 'text-amber-500',
    },
    statuses: ['JOB_ALLOCATED', 'ESTIMATE_PENDING'],
    description: 'Technicians assigned or estimate pending customer approval.',
  },
  {
    id: 'in_progress',
    title: 'Work In Progress (WIP)',
    shortLabel: 'In Progress',
    icon: Wrench,
    colorTheme: {
      bg: 'bg-slate-50/50 dark:bg-slate-900/50',
      border: 'border-indigo-500/30',
      badgeBg: 'bg-indigo-500/10 dark:bg-indigo-500/20',
      badgeText: 'text-indigo-700 dark:text-indigo-300',
      headerBg: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-900 dark:text-indigo-300',
      accent: 'text-indigo-500',
    },
    statuses: ['IN_PROGRESS'],
    description: 'Active mechanical, denting, painting or detailing repairs.',
  },
  {
    id: 'pdi_qc',
    title: 'PDI & QC Audit',
    shortLabel: 'PDI / QC',
    icon: ShieldCheck,
    colorTheme: {
      bg: 'bg-slate-50/50 dark:bg-slate-900/50',
      border: 'border-purple-500/30',
      badgeBg: 'bg-purple-500/10 dark:bg-purple-500/20',
      badgeText: 'text-purple-700 dark:text-purple-300',
      headerBg: 'bg-purple-500/10 border-purple-500/20 text-purple-900 dark:text-purple-300',
      accent: 'text-purple-500',
    },
    statuses: ['QC_PENDING'],
    description: 'Pre-Delivery Inspection (PDI) and floor manager quality audit.',
  },
  {
    id: 'ready_delivery',
    title: 'Ready for Delivery',
    shortLabel: 'Ready/Dispatch',
    icon: CheckCircle2,
    colorTheme: {
      bg: 'bg-slate-50/50 dark:bg-slate-900/50',
      border: 'border-emerald-500/30',
      badgeBg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
      badgeText: 'text-emerald-700 dark:text-emerald-300',
      headerBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-300',
      accent: 'text-emerald-500',
    },
    statuses: ['READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY'],
    description: 'QC cleared, final bill generated, ready for customer handover.',
  },
  {
    id: 'delivered',
    title: 'Delivered & Closed',
    shortLabel: 'Delivered',
    icon: LogOut,
    colorTheme: {
      bg: 'bg-slate-50/50 dark:bg-slate-900/50',
      border: 'border-slate-500/30',
      badgeBg: 'bg-slate-500/10 dark:bg-slate-500/20',
      badgeText: 'text-slate-700 dark:text-slate-300',
      headerBg: 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200',
      accent: 'text-slate-500',
    },
    statuses: ['DELIVERED', 'CLOSED'],
    description: 'Vehicle dispatched, payment settled and job card closed.',
  },
];

const ALL_STATUS_OPTIONS: { value: JobCardStatus; label: string }[] = [
  { value: 'INSPECTION', label: '1. Pre-Inspection (PI)' },
  { value: 'CREATED', label: '2. Job Card Created' },
  { value: 'JOB_ALLOCATED', label: '3. Job Allocated' },
  { value: 'ESTIMATE_PENDING', label: '4. Estimate Pending' },
  { value: 'IN_PROGRESS', label: '5. Work In Progress' },
  { value: 'QC_PENDING', label: '6. PDI / QC Pending' },
  { value: 'READY_FOR_DELIVERY', label: '7. Ready for Delivery' },
  { value: 'OUT_FOR_DELIVERY', label: '8. Out for Delivery' },
  { value: 'DELIVERED', label: '9. Delivered' },
  { value: 'CLOSED', label: '10. Closed' },
];

export function VehicleStatusPipelineView({
  jobCards,
  currentRole,
  onSelectJobCard,
  onOpenNewJobCardModal,
  onOpenCustomerApprovalPortal,
  onOpenQCModal,
}: VehicleStatusPipelineViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'ACTIVE' | 'ALL' | 'CARS24' | 'URGENT'>('ACTIVE');
  const [selectedMobileColumn, setSelectedMobileColumn] = useState<string>('ALL');
  
  // Requisition Modal State
  const [requisitionCard, setRequisitionCard] = useState<JobCard | null>(null);

  // Status Change Selector state
  const [statusMenuCardId, setStatusMenuCardId] = useState<string | null>(null);

  // Filter job cards based on search and top filters
  const filteredCards = useMemo(() => {
    return jobCards.filter((card) => {
      // Search match
      const searchLower = searchTerm.toLowerCase().trim();
      const matchesSearch = !searchLower || (
        card.vehicle.registrationNumber.toLowerCase().includes(searchLower) ||
        card.vehicle.make.toLowerCase().includes(searchLower) ||
        card.vehicle.model.toLowerCase().includes(searchLower) ||
        card.customer.name.toLowerCase().includes(searchLower) ||
        card.customer.phone.includes(searchLower) ||
        card.id.toLowerCase().includes(searchLower)
      );

      if (!matchesSearch) return false;

      // Filter modes
      if (filterMode === 'ACTIVE') {
        return card.status !== 'DELIVERED' && card.status !== 'CLOSED';
      }
      if (filterMode === 'CARS24') {
        return card.isCars24;
      }
      if (filterMode === 'URGENT') {
        return card.isUrgent;
      }

      return true; // ALL
    });
  }, [jobCards, searchTerm, filterMode]);

  // Group cards into pipeline columns
  const columnData = useMemo(() => {
    return PIPELINE_COLUMNS.map((col) => {
      const cardsInCol = filteredCards.filter((c) => col.statuses.includes(c.status));
      const totalEstimatedBill = cardsInCol.reduce((acc, c) => {
        return acc + c.tasks.reduce((sum, t) => sum + (t.customerPrice || 0), 0);
      }, 0);

      return {
        ...col,
        cards: cardsInCol,
        totalEstimatedBill,
      };
    });
  }, [filteredCards]);

  const totalActiveVehicles = useMemo(() => {
    return jobCards.filter(c => c.status !== 'DELIVERED' && c.status !== 'CLOSED').length;
  }, [jobCards]);

  const handleUpdateStatus = (cardId: string, newStatus: JobCardStatus) => {
    updateJobCard(cardId, (prev) => ({
      ...prev,
      status: newStatus,
      checkedOutAt: newStatus === 'DELIVERED' || newStatus === 'CLOSED' ? (prev.checkedOutAt || new Date().toISOString()) : prev.checkedOutAt
    }));
    setStatusMenuCardId(null);
  };

  return (
    <div className="space-y-5">
      
      {/* Top Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                Live Workshop Floor
              </span>
              <span className="text-xs font-bold text-slate-400">
                • {totalActiveVehicles} Active Vehicles in Workshop
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 mt-1">
              <Layers className="w-6 h-6 text-blue-600 shrink-0" />
              Vehicle Status Board & Pipeline
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
              Track vehicle lifecycle from Pre-Inspection (PI) & Job Card creation through Work In Progress, PDI/QC to Final Handover.
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

        {/* Filters & Search Controls Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          
          {/* Search Field */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Reg No, Customer, Model..."
              className="w-full pl-9 pr-4 min-h-[44px] text-xs rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          {/* Quick Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {[
              { id: 'ACTIVE', label: `Active (${totalActiveVehicles})` },
              { id: 'ALL', label: `All Cards (${jobCards.length})` },
              { id: 'CARS24', label: `Cars24 Partner (${jobCards.filter(c => c.isCars24).length})` },
              { id: 'URGENT', label: `Urgent (${jobCards.filter(c => c.isUrgent).length})` },
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterMode(f.id as any)}
                className={`min-h-[38px] px-4 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center justify-center shrink-0 active:scale-95 ${
                  filterMode === f.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

        </div>

        {/* Mobile View Column Filter Pill Bar */}
        <div className="lg:hidden block pt-1 border-t border-slate-100 dark:border-slate-800">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Mobile Stage View:
          </p>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedMobileColumn('ALL')}
              className={`min-h-[36px] px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap ${
                selectedMobileColumn === 'ALL'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              All Columns
            </button>
            {columnData.map(col => (
              <button
                key={col.id}
                type="button"
                onClick={() => setSelectedMobileColumn(col.id)}
                className={`min-h-[36px] px-3 py-1 rounded-xl text-xs font-extrabold whitespace-nowrap flex items-center gap-1.5 ${
                  selectedMobileColumn === col.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                <span>{col.shortLabel}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px] font-mono">
                  {col.cards.length}
                </span>
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Kanban Board Container */}
      <div className="overflow-x-auto pb-6 scrollbar-thin">
        <div className="flex gap-4 min-w-max lg:min-w-full items-start">
          
          {columnData.map((col) => {
            const Icon = col.icon;

            // Mobile column hide check
            if (selectedMobileColumn !== 'ALL' && selectedMobileColumn !== col.id) {
              return null;
            }

            return (
              <div
                key={col.id}
                className={`w-[320px] sm:w-[350px] shrink-0 rounded-3xl border ${col.colorTheme.border} ${col.colorTheme.bg} flex flex-col max-h-[80vh] shadow-xs overflow-hidden transition-all`}
              >
                {/* Column Header */}
                <div className={`p-4 border-b ${col.colorTheme.headerBg} flex items-center justify-between shrink-0`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`p-1.5 rounded-xl bg-white/80 dark:bg-slate-900/80 ${col.colorTheme.accent} shadow-xs shrink-0`}>
                      <Icon className="w-4 h-4 stroke-[2.5]" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-sm tracking-tight truncate">
                        {col.title}
                      </h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {col.description}
                      </p>
                    </div>
                  </div>

                  <span className={`ml-2 px-2.5 py-0.5 rounded-full text-xs font-black font-mono shrink-0 ${col.colorTheme.badgeBg} ${col.colorTheme.badgeText}`}>
                    {col.cards.length}
                  </span>
                </div>

                {/* Subtotal Banner */}
                {col.cards.length > 0 && (
                  <div className="px-4 py-2 bg-white/60 dark:bg-slate-900/60 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between text-[11px] text-slate-500 font-medium shrink-0">
                    <span>Est. Volume:</span>
                    <span className="font-mono font-black text-slate-900 dark:text-slate-100">
                      ₹{col.totalEstimatedBill.toLocaleString('en-IN')}
                    </span>
                  </div>
                )}

                {/* Column Scrollable Cards Container */}
                <div className="p-3 overflow-y-auto space-y-3 grow min-h-[220px]">
                  {col.cards.length === 0 ? (
                    <div className="h-40 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center p-4 text-center text-slate-400">
                      <Car className="w-8 h-8 stroke-[1.5] mb-1 opacity-50" />
                      <p className="text-xs font-bold">No vehicles</p>
                      <p className="text-[10px]">in {col.shortLabel} status</p>
                    </div>
                  ) : (
                    col.cards.map((card) => {
                      const completedCount = card.tasks.filter(t => t.status === 'COMPLETED').length;
                      const progress = card.tasks.length ? Math.round((completedCount / card.tasks.length) * 100) : 0;
                      const totalBill = card.tasks.reduce((acc, t) => acc + (t.customerPrice || 0), 0);
                      const hasSublet = card.tasks.some(t => t.category === 'SUBLET_VENDOR');
                      const isMenuOpen = statusMenuCardId === card.id;

                      return (
                        <div
                          key={card.id}
                          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 transition-all shadow-xs p-3.5 space-y-3 relative group"
                        >
                          {/* Card Reg Number & JC ID */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono text-[10px] font-extrabold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                  {card.id}
                                </span>
                                {card.isUrgent && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-rose-500 text-white flex items-center gap-0.5 animate-pulse">
                                    <Flame className="w-2.5 h-2.5" />
                                    Urgent
                                  </span>
                                )}
                                {card.isCars24 && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-orange-600 text-white">
                                    Cars24
                                  </span>
                                )}
                              </div>
                              <h4 className="font-black text-base text-slate-900 dark:text-slate-100 tracking-tight font-mono mt-1">
                                {card.vehicle.registrationNumber}
                              </h4>
                              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                {card.vehicle.make} {card.vehicle.model}
                              </p>
                            </div>

                            {/* Status Change Trigger Button */}
                            <div className="relative shrink-0">
                              <button
                                type="button"
                                onClick={() => setStatusMenuCardId(isMenuOpen ? null : card.id)}
                                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center gap-1 transition-colors"
                                title="Change Status"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                              </button>

                              {/* Status Dropdown Menu */}
                              {isMenuOpen && (
                                <div className="absolute right-0 top-8 z-50 w-52 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl p-1.5 space-y-1 animate-in fade-in duration-100 text-xs">
                                  <div className="px-2 py-1 text-[10px] font-black uppercase text-slate-400 border-b border-slate-100 dark:border-slate-700">
                                    Move Vehicle To Stage:
                                  </div>
                                  <div className="max-h-56 overflow-y-auto space-y-0.5">
                                    {ALL_STATUS_OPTIONS.map((opt) => {
                                      const isCurrent = card.status === opt.value;
                                      return (
                                        <button
                                          key={opt.value}
                                          type="button"
                                          onClick={() => handleUpdateStatus(card.id, opt.value)}
                                          className={`w-full text-left px-2.5 py-1.5 rounded-xl font-medium flex items-center justify-between transition-colors ${
                                            isCurrent
                                              ? 'bg-blue-600 text-white font-bold'
                                              : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                                          }`}
                                        >
                                          <span className="truncate">{opt.label}</span>
                                          {isCurrent && <Check className="w-3.5 h-3.5" />}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Customer Row */}
                          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs flex items-center justify-between">
                            <span className="font-bold text-slate-800 dark:text-slate-200 truncate flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{card.customer.name}</span>
                            </span>
                            <a
                              href={`tel:${card.customer.phone}`}
                              className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 shrink-0 ml-1"
                            >
                              <Phone className="w-3 h-3" />
                              <span>{card.customer.phone}</span>
                            </a>
                          </div>

                          {/* Progress Bar */}
                          <div>
                            <div className="flex items-center justify-between text-[11px] mb-1 font-semibold">
                              <span className="text-slate-500">Tasks Done</span>
                              <span className="font-mono text-blue-600 dark:text-blue-400 font-extrabold">
                                {completedCount}/{card.tasks.length} ({progress}%)
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                              <div
                                className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>

                          {/* Sublet / Alert Flags */}
                          {hasSublet && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                              <Building2 className="w-3 h-3" />
                              Sublet Work
                            </span>
                          )}

                          {/* Card Footer Actions & Bill */}
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                            <div>
                              <p className="text-[9px] text-slate-400 uppercase font-bold">Est. Bill</p>
                              <p className="text-xs font-black font-mono text-slate-900 dark:text-slate-100">
                                ₹{totalBill.toLocaleString('en-IN')}
                              </p>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setRequisitionCard(card)}
                                className="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500 text-amber-700 dark:text-amber-300 hover:text-slate-950 transition-colors"
                                title="Parts Requisition"
                              >
                                <PackageCheck className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => onSelectJobCard(card.id)}
                                className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-black hover:bg-slate-800 dark:hover:bg-slate-200 transition-all flex items-center gap-1 shadow-xs active:scale-95"
                              >
                                <span>Manage</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                        </div>
                      );
                    })
                  )}
                </div>

              </div>
            );
          })}

        </div>
      </div>

      {/* Part Requisition Modal */}
      {requisitionCard && (
        <PartRequisitionModal
          card={requisitionCard}
          isOpen={Boolean(requisitionCard)}
          onClose={() => setRequisitionCard(null)}
        />
      )}

    </div>
  );
}
