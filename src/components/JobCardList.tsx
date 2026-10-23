import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Trash2,
  ArrowUpDown,
  LogIn,
  X,
  Users,
  Filter,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { deleteJobCard, getAuthUser, getEmployees, getVehicleCheckIns, subscribeToStore } from '../lib/storage';
import { VehicleCheckIn } from '../types';
import { PartRequisitionModal } from './PartRequisitionModal';
import { FuelTypeBadge } from './FuelTypeBadge';
import { 
  getDeadlineInfo, 
  calculateJobCardPriorityScore, 
  calculateJobCardStatusRank, 
  parseDateOnly,
  getJobCardPriorityLevel,
  JobCardPriorityLevel,
  getLocalDateString
} from '../lib/urgencyHelper';

export type JobCardSortOption = 
  | 'PRIORITY'
  | 'TARGET_DATE_ASC'
  | 'DATE_NEWEST'
  | 'DATE_OLDEST'
  | 'STATUS';

interface JobCardListProps {
  jobCards: JobCard[];
  onSelectJobCard: (cardId: string) => void;
  onOpenNewJobCardModal: (prefill?: any) => void;
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
  PDI_QC: { label: 'PDI & QC Audit', bg: 'bg-purple-500/10', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
  READY_FOR_DELIVERY: { label: 'Ready for Dispatch', bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', bg: 'bg-cyan-500/10', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-200 dark:border-cyan-800' },
  RFC: { label: 'Ready for Checkout', bg: 'bg-blue-500/10', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
  DELIVERED: { label: 'Delivered', bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
  CLOSED: { label: 'Closed', bg: 'bg-slate-500/10', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-800' },
};

interface JobCardListItemProps {
  card: JobCard;
  isManagementRole: boolean;
  confirmDeleteId: string | null;
  selectedTechnician: string;
  searchTerm: string;
  onSelectJobCard: (cardId: string) => void;
  onOpenQRModal?: (cardId: string) => void;
  onOpenRequisitionModal: (card: JobCard) => void;
  onSetConfirmDeleteId: (id: string | null) => void;
  onDeleteJobCard: (id: string) => void;
  onTogglePriorityFilter: (priority: JobCardPriorityLevel) => void;
  onToggleTechnicianFilter: (techName: string) => void;
}

const JobCardListItem = React.memo(function JobCardListItem({
  card,
  isManagementRole,
  confirmDeleteId,
  selectedTechnician,
  searchTerm,
  onSelectJobCard,
  onOpenQRModal,
  onOpenRequisitionModal,
  onSetConfirmDeleteId,
  onDeleteJobCard,
  onTogglePriorityFilter,
  onToggleTechnicianFilter
}: JobCardListItemProps) {
  const statusStyle = STATUS_BADGES[card.status] || STATUS_BADGES.IN_PROGRESS;
  const completedCount = card.tasks.filter((t) => t.status === 'COMPLETED').length;
  const progress = card.tasks.length ? Math.round((completedCount / card.tasks.length) * 100) : 0;
  const needsApproval = card.status === 'ESTIMATE_PENDING' || card.tasks.some(t => t.requiresCustomerApproval && t.isCustomerApproved === null);
  const totalBill = card.tasks.reduce((acc, t) => acc + (t.customerPrice || 0), 0);
  const hasSublet = card.tasks.some(t => t.category === 'SUBLET_VENDOR' || t.category === 'WASHING');
  const isDeliveredOrClosed = card.status === 'DELIVERED' || card.status === 'CLOSED';
  const deadlineInfo = getDeadlineInfo(card.estimatedCompletionDate, card.isUrgent);
  const priorityLevel = getJobCardPriorityLevel(card);

  return (
    <div
      key={card.id}
      className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 transition-all shadow-xs flex flex-col justify-between overflow-hidden group"
    >
      {/* Card Top Header & Main Info */}
      <div className="p-4 sm:p-5 space-y-3">
        {/* Top Bar: ID, Priority, Urgency, Cars24 & Status */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-[11px] font-extrabold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
              {card.id}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePriorityFilter(priorityLevel);
              }}
              title={`Filter by ${priorityLevel} Priority`}
              className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border cursor-pointer transition-all ${
                priorityLevel === 'HIGH'
                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                  : priorityLevel === 'MEDIUM'
                  ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                  : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
              }`}
            >
              {priorityLevel === 'HIGH' ? '● High' : priorityLevel === 'MEDIUM' ? '● Med' : '● Low'}
            </button>
            {card.isUrgent && (
              <span className="bg-amber-500 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-0.5 shadow-xs">
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

        {/* Urgency & Promised Delivery Badge */}
        {(card.isUrgent || card.estimatedCompletionDate) && (
          <div className={`px-2.5 py-1.5 rounded-xl border flex items-center justify-between text-xs ${deadlineInfo.color}`}>
            <div className="flex items-center gap-1.5 font-black text-[11px] truncate">
              <Clock className="w-3 h-3 shrink-0" />
              <span className="truncate">{deadlineInfo.label}</span>
            </div>
            <span className="text-[10px] font-bold opacity-85 shrink-0 ml-2 font-mono">
              {deadlineInfo.subtext}
            </span>
          </div>
        )}

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

          {/* Allotted Technicians Summary Strip */}
          {(() => {
            const techMap = new Map<string, { name: string; roleLabel: string }>();
            card.tasks.forEach(t => {
              if (t.assignedPainterName) {
                techMap.set(`P-${t.assignedPainterName}`, { name: t.assignedPainterName, roleLabel: 'Painter' });
              }
              if (t.assignedDenterName) {
                techMap.set(`D-${t.assignedDenterName}`, { name: t.assignedDenterName, roleLabel: 'Denter' });
              }
              if (t.assignedEmployeeName && t.assignedEmployeeName !== t.assignedPainterName && t.assignedEmployeeName !== t.assignedDenterName) {
                techMap.set(`M-${t.assignedEmployeeName}`, { name: t.assignedEmployeeName, roleLabel: 'Tech' });
              }
            });
            const assignedTechs = Array.from(techMap.values());
            const unassignedCount = card.tasks.filter(t => !t.assignedEmployeeId && !t.assignedPainterId && !t.assignedDenterId).length;
            if (assignedTechs.length === 0 && (unassignedCount === 0 || isDeliveredOrClosed)) return null;
            return (
              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/70 flex items-center gap-1.5 flex-wrap">
                {assignedTechs.length > 0 && (
                  <>
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 mr-0.5">Allotted:</span>
                    {assignedTechs.slice(0, 4).map((tech, idx) => {
                      const searchLow = searchTerm.toLowerCase().trim();
                      const isHighlighted =
                        (selectedTechnician !== 'ALL' && selectedTechnician.toLowerCase() === tech.name.toLowerCase()) ||
                        (searchLow.length > 0 && tech.name.toLowerCase().includes(searchLow));
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleTechnicianFilter(tech.name);
                          }}
                          title={`Filter Job Cards allotted to ${tech.name} (${tech.roleLabel})`}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all cursor-pointer ${
                            isHighlighted
                              ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-500/30 shadow-2xs'
                              : tech.roleLabel === 'Painter'
                              ? 'bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 border-pink-200/70 dark:border-pink-800/50 hover:border-pink-400'
                              : tech.roleLabel === 'Denter'
                              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200/70 dark:border-amber-800/50 hover:border-amber-400'
                              : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200/70 dark:border-blue-800/50 hover:border-blue-400'
                          }`}
                        >
                          <span className="opacity-75 text-[8px] uppercase font-black">{tech.roleLabel[0]}:</span>
                          <span className="truncate max-w-[95px]">{tech.name}</span>
                        </button>
                      );
                    })}
                    {assignedTechs.length > 4 && (
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        +{assignedTechs.length - 4}
                      </span>
                    )}
                  </>
                )}
                {unassignedCount > 0 && !isDeliveredOrClosed && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleTechnicianFilter('UNASSIGNED');
                    }}
                    title="Filter Job Cards with unallotted tasks"
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all cursor-pointer ${
                      selectedTechnician === 'UNASSIGNED'
                        ? 'bg-amber-500 text-slate-950 border-amber-600 ring-2 ring-amber-500/30'
                        : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200/70 dark:border-amber-800/50 hover:border-amber-400'
                    }`}
                  >
                    <span>{unassignedCount} Unallotted</span>
                  </button>
                )}
              </div>
            );
          })()}
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
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
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
            onClick={() => onOpenRequisitionModal(card)}
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

          {isManagementRole && (
            confirmDeleteId === card.id ? (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => onDeleteJobCard(card.id)}
                  className="px-2.5 py-1.5 rounded-full bg-rose-600 text-white text-[10px] font-black hover:bg-rose-700 transition-colors cursor-pointer"
                >
                  Confirm Delete
                </button>
                <button
                  type="button"
                  onClick={() => onSetConfirmDeleteId(null)}
                  className="px-2 py-1.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSetConfirmDeleteId(card.id);
                }}
                className="w-9 h-9 rounded-full bg-rose-500/10 hover:bg-rose-500 text-rose-600 dark:text-rose-400 hover:text-white transition-colors flex items-center justify-center shrink-0 active:scale-95 cursor-pointer"
                title="Delete Job Card"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )
          )}

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
});

export const JobCardList = React.memo(function JobCardList({
  jobCards,
  onSelectJobCard,
  onOpenNewJobCardModal,
  onOpenCustomerApprovalPortal,
  onOpenQCModal,
  onOpenQRModal,
  initialSection = 'ACTIVE'
}: JobCardListProps) {
  const authUser = getAuthUser();
  const isManagementRole = authUser?.role === 'SUPER_ADMIN' || authUser?.role === 'ADMIN' || authUser?.role === 'SERVICE_ADVISOR' || authUser?.role === 'FLOOR_MANAGER';
  const [searchTerm, setSearchTerm] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [searchScope, setSearchScope] = useState<'ALL' | 'REG_NO' | 'CUSTOMER' | 'TECHNICIAN'>('ALL');
  const [selectedTechnician, setSelectedTechnician] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | JobCardPriorityLevel>('ALL');
  const [dateRangeField, setDateRangeField] = useState<'ANY' | 'CREATED' | 'TARGET'>('ANY');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [mainSection, setMainSection] = useState<'ACTIVE' | 'HISTORY'>(initialSection);
  const [activeSubFilter, setActiveSubFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<JobCardSortOption>('PRIORITY');
  const [requisitionModalCard, setRequisitionModalCard] = useState<JobCard | null>(null);
  const [checkInsList, setCheckInsList] = useState<VehicleCheckIn[]>(() => getVehicleCheckIns());
  const employees = getEmployees();

  useEffect(() => {
    if (initialSection) {
      setMainSection(initialSection);
    }
  }, [initialSection]);

  useEffect(() => {
    const refreshCheckIns = () => {
      setCheckInsList(getVehicleCheckIns());
    };
    refreshCheckIns();
    const unsubscribe = subscribeToStore(refreshCheckIns);
    return () => unsubscribe();
  }, []);

  // Helper to extract all assigned technician names & roles from a JobCard
  const getCardTechnicians = (card: JobCard): { id?: string; name: string; role: string }[] => {
    const map = new Map<string, { id?: string; name: string; role: string }>();
    if (card.floorManagerName) {
      map.set(`fm-${card.floorManagerName.toLowerCase()}`, {
        id: card.floorManagerId,
        name: card.floorManagerName,
        role: 'Floor Manager',
      });
    }
    card.tasks.forEach((t) => {
      if (t.assignedPainterName) {
        map.set(`painter-${t.assignedPainterName.toLowerCase()}`, {
          id: t.assignedPainterId,
          name: t.assignedPainterName,
          role: 'Painter',
        });
      }
      if (t.assignedDenterName) {
        map.set(`denter-${t.assignedDenterName.toLowerCase()}`, {
          id: t.assignedDenterId,
          name: t.assignedDenterName,
          role: 'Denter',
        });
      }
      if (t.assignedEmployeeName) {
        map.set(`tech-${t.assignedEmployeeName.toLowerCase()}`, {
          id: t.assignedEmployeeId,
          name: t.assignedEmployeeName,
          role: 'Technician',
        });
      }
    });
    return Array.from(map.values());
  };

  const pendingCheckIns = checkInsList.filter((c) => {
    if (c.status === 'CHECKED_OUT') return false;
    const cleanRegC = c.registrationNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const hasActiveJobCard = jobCards.some((jc) => {
      if (jc.status === 'DELIVERED' || jc.status === 'CLOSED') return false;
      if (jc.checkInRecordId && jc.checkInRecordId === c.id) return true;
      const cleanJC = jc.vehicle.registrationNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      return cleanJC === cleanRegC;
    });
    return !hasActiveJobCard;
  });

  const filteredPendingCheckIns = pendingCheckIns
    .filter((c) => {
      const searchLower = searchTerm.toLowerCase().trim();
      const searchAlnum = searchLower.replace(/[^a-z0-9]/g, '');
      if (!searchLower) return true;
      const regLower = c.registrationNumber.toLowerCase();
      const regAlnum = regLower.replace(/[^a-z0-9]/g, '');
      if (searchScope === 'REG_NO') {
        return regLower.includes(searchLower) || (searchAlnum.length > 0 && regAlnum.includes(searchAlnum));
      }
      if (searchScope === 'CUSTOMER') {
        return (
          c.customerName.toLowerCase().includes(searchLower) ||
          c.customerPhone.toLowerCase().includes(searchLower)
        );
      }
      if (searchScope === 'TECHNICIAN') {
        return c.checkInDriverName.toLowerCase().includes(searchLower);
      }
      return (
        regLower.includes(searchLower) ||
        (searchAlnum.length > 0 && regAlnum.includes(searchAlnum)) ||
        c.make.toLowerCase().includes(searchLower) ||
        c.model.toLowerCase().includes(searchLower) ||
        c.customerName.toLowerCase().includes(searchLower) ||
        c.customerPhone.toLowerCase().includes(searchLower) ||
        c.checkInDriverName.toLowerCase().includes(searchLower) ||
        c.id.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      const numA = parseInt(a.id.replace(/\D/g, '') || '0', 10);
      const numB = parseInt(b.id.replace(/\D/g, '') || '0', 10);
      return numB - numA;
    });

  const activeCards = jobCards.filter((c) => c.status !== 'DELIVERED' && c.status !== 'CLOSED');
  const historyCards = jobCards.filter((c) => c.status === 'DELIVERED' || c.status === 'CLOSED');
  const sectionCards = mainSection === 'ACTIVE' ? activeCards : historyCards;

  // Build unique list of all technicians allotted across current section cards + employees directory
  const availableTechnicians = React.useMemo(() => {
    const namesMap = new Map<string, { name: string; role: string; count: number }>();
    sectionCards.forEach((card) => {
      const cardTechs = new Set<string>();
      card.tasks.forEach((t) => {
        if (t.assignedPainterName) {
          const key = t.assignedPainterName.trim();
          cardTechs.add(key);
          if (!namesMap.has(key)) namesMap.set(key, { name: key, role: 'Painter', count: 0 });
        }
        if (t.assignedDenterName) {
          const key = t.assignedDenterName.trim();
          cardTechs.add(key);
          if (!namesMap.has(key)) namesMap.set(key, { name: key, role: 'Denter', count: 0 });
        }
        if (t.assignedEmployeeName) {
          const key = t.assignedEmployeeName.trim();
          cardTechs.add(key);
          if (!namesMap.has(key)) namesMap.set(key, { name: key, role: 'Technician', count: 0 });
        }
      });
      cardTechs.forEach((techName) => {
        const entry = namesMap.get(techName);
        if (entry) entry.count += 1;
      });
    });
    employees.forEach((emp) => {
      if (['MECHANIC', 'PAINTER', 'DENTER', 'ELECTRICIAN', 'FLOOR_MANAGER'].includes(emp.role)) {
        const key = emp.name.trim();
        if (!namesMap.has(key)) {
          namesMap.set(key, { name: key, role: emp.role.replace('_', ' '), count: 0 });
        }
      }
    });
    return Array.from(namesMap.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [sectionCards, employees]);

  // Count cards by priority level in current section
  const priorityCounts = React.useMemo(() => {
    const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    sectionCards.forEach((c) => {
      const level = getJobCardPriorityLevel(c);
      counts[level] += 1;
    });
    return counts;
  }, [sectionCards]);

  // Count active advanced filters (excluding search text)
  const activeAdvancedFilterCount =
    (priorityFilter !== 'ALL' ? 1 : 0) +
    (dateFrom !== '' || dateTo !== '' ? 1 : 0) +
    (selectedTechnician !== 'ALL' ? 1 : 0) +
    (searchScope !== 'ALL' ? 1 : 0);

  const hasAnyActiveSearchOrFilter =
    searchTerm.trim() !== '' ||
    activeAdvancedFilterCount > 0 ||
    activeSubFilter !== 'ALL';

  const resetAllFilters = useCallback(() => {
    setSearchTerm('');
    setSearchScope('ALL');
    setSelectedTechnician('ALL');
    setPriorityFilter('ALL');
    setDateFrom('');
    setDateTo('');
    setDateRangeField('ANY');
    setActiveSubFilter('ALL');
  }, []);

  const handleTogglePriorityFilter = useCallback((level: string) => {
    setPriorityFilter((prev) => (prev === level ? 'ALL' : (level as any)));
  }, []);

  const handleToggleTechnicianFilter = useCallback((tech: string) => {
    setSelectedTechnician((prev) => (prev === tech ? 'ALL' : tech));
  }, []);

  const handleOpenRequisitionModal = useCallback((card: JobCard) => {
    setRequisitionModalCard(card);
  }, []);

  const handleSetConfirmDeleteId = useCallback((id: string | null) => {
    setConfirmDeleteId(id);
  }, []);

  const handleDeleteJobCard = useCallback((id: string) => {
    deleteJobCard(id);
    setConfirmDeleteId(null);
  }, []);

  const handleSelectJobCard = useCallback((id: string) => {
    onSelectJobCard(id);
  }, [onSelectJobCard]);

  const handleOpenQRModal = useCallback((id: string) => {
    onOpenQRModal?.(id);
  }, [onOpenQRModal]);

  const filteredCards = useMemo(() => {
    return sectionCards.filter((card) => {
      const searchLower = searchTerm.toLowerCase().trim();
      const searchAlnum = searchLower.replace(/[^a-z0-9]/g, '');

      // Check vehicle registration match (both raw and normalized alphanumeric without spaces/hyphens)
      const regLower = card.vehicle.registrationNumber.toLowerCase();
      const regAlnum = regLower.replace(/[^a-z0-9]/g, '');
      const matchesRegistration =
        regLower.includes(searchLower) ||
        (searchAlnum.length > 0 && regAlnum.includes(searchAlnum)) ||
        card.vehicle.make.toLowerCase().includes(searchLower) ||
        card.vehicle.model.toLowerCase().includes(searchLower) ||
        Boolean(card.vehicle.variant && card.vehicle.variant.toLowerCase().includes(searchLower)) ||
        Boolean(card.vehicle.vin && card.vehicle.vin.toLowerCase().includes(searchLower)) ||
        card.id.toLowerCase().includes(searchLower) ||
        Boolean(card.cars24RefNo && card.cars24RefNo.toLowerCase().includes(searchLower)) ||
        Boolean(card.workOrderNo && card.workOrderNo.toLowerCase().includes(searchLower));

      // Check customer match
      const matchesCustomer =
        card.customer.name.toLowerCase().includes(searchLower) ||
        card.customer.phone.toLowerCase().includes(searchLower) ||
        Boolean(card.customer.email && card.customer.email.toLowerCase().includes(searchLower));

      // Check assigned technician match across all task roles (Painter, Denter, Mechanic/Tech, Floor Manager, Sublet Vendor)
      const cardTechnicians = getCardTechnicians(card);
      const matchesTechnicianSearch =
        cardTechnicians.some(
          (tech) =>
            tech.name.toLowerCase().includes(searchLower) ||
            tech.role.toLowerCase().includes(searchLower)
        ) ||
        card.tasks.some(
          (t) =>
            (t.assignedEmployeeName && t.assignedEmployeeName.toLowerCase().includes(searchLower)) ||
            (t.assignedPainterName && t.assignedPainterName.toLowerCase().includes(searchLower)) ||
            (t.assignedDenterName && t.assignedDenterName.toLowerCase().includes(searchLower)) ||
            (t.vendorName && t.vendorName.toLowerCase().includes(searchLower))
        );

      // Check scope-based search match
      let matchesSearch = true;
      if (searchLower) {
        if (searchScope === 'REG_NO') {
          matchesSearch = matchesRegistration;
        } else if (searchScope === 'CUSTOMER') {
          matchesSearch = matchesCustomer;
        } else if (searchScope === 'TECHNICIAN') {
          matchesSearch = matchesTechnicianSearch;
        } else {
          matchesSearch =
            matchesRegistration ||
            matchesCustomer ||
            matchesTechnicianSearch ||
            Boolean(card.cityName && card.cityName.toLowerCase().includes(searchLower)) ||
            Boolean(card.workshopName && card.workshopName.toLowerCase().includes(searchLower));
        }
      }

      if (!matchesSearch) return false;

      // Check explicit Technician dropdown filter
      if (selectedTechnician !== 'ALL') {
        if (selectedTechnician === 'UNASSIGNED') {
          const hasUnassigned = card.tasks.some(
            (t) => !t.assignedEmployeeId && !t.assignedPainterId && !t.assignedDenterId
          );
          if (!hasUnassigned) return false;
        } else {
          const techLower = selectedTechnician.toLowerCase();
          const hasSelectedTech = card.tasks.some(
            (t) =>
              t.assignedPainterName?.toLowerCase() === techLower ||
              t.assignedDenterName?.toLowerCase() === techLower ||
              t.assignedEmployeeName?.toLowerCase() === techLower
          ) || card.floorManagerName?.toLowerCase() === techLower;
          if (!hasSelectedTech) return false;
        }
      }

      // Check Job Priority filter (HIGH / MEDIUM / LOW)
      if (priorityFilter !== 'ALL') {
        const cardPriority = getJobCardPriorityLevel(card);
        if (cardPriority !== priorityFilter) return false;
      }

      // Check Date Range filter (dateFrom / dateTo)
      if (dateFrom || dateTo) {
        const fromDateObj = dateFrom ? parseDateOnly(dateFrom) : null;
        const toDateObj = dateTo ? parseDateOnly(dateTo) : null;

        const createdDateObj = parseDateOnly(card.createdAt);
        const targetDateObj = parseDateOnly(card.estimatedCompletionDate);

        const isDateWithinRange = (d: Date | null): boolean => {
          if (!d) return false;
          if (fromDateObj && d.getTime() < fromDateObj.getTime()) return false;
          if (toDateObj && d.getTime() > toDateObj.getTime()) return false;
          return true;
        };

        if (dateRangeField === 'CREATED') {
          if (!isDateWithinRange(createdDateObj)) return false;
        } else if (dateRangeField === 'TARGET') {
          if (!isDateWithinRange(targetDateObj)) return false;
        } else {
          // ANY: match either Created Date or Target Completion Date
          if (!isDateWithinRange(createdDateObj) && !isDateWithinRange(targetDateObj)) {
            return false;
          }
        }
      }

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
  }, [sectionCards, searchTerm, searchScope, selectedTechnician, priorityFilter, dateFrom, dateTo, dateRangeField, mainSection, activeSubFilter]);

  // Sort filtered cards by manager preference
  const sortedCards = useMemo(() => {
    return [...filteredCards].sort((a, b) => {
      if (sortBy === 'PRIORITY') {
        const aScore = calculateJobCardPriorityScore(a);
        const bScore = calculateJobCardPriorityScore(b);
        return bScore - aScore;
      }
      if (sortBy === 'TARGET_DATE_ASC') {
        if (!a.estimatedCompletionDate && !b.estimatedCompletionDate) return 0;
        if (!a.estimatedCompletionDate) return 1;
        if (!b.estimatedCompletionDate) return -1;
        const aDate = parseDateOnly(a.estimatedCompletionDate)?.getTime() || 0;
        const bDate = parseDateOnly(b.estimatedCompletionDate)?.getTime() || 0;
        return aDate - bDate;
      }
      if (sortBy === 'DATE_NEWEST') {
        const aTime = new Date(a.createdAt).getTime() || 0;
        const bTime = new Date(b.createdAt).getTime() || 0;
        if (aTime && bTime) return bTime - aTime;
        return b.id.localeCompare(a.id);
      }
      if (sortBy === 'DATE_OLDEST') {
        const aTime = new Date(a.createdAt).getTime() || 0;
        const bTime = new Date(b.createdAt).getTime() || 0;
        if (aTime && bTime) return aTime - bTime;
        return a.id.localeCompare(b.id);
      }
      if (sortBy === 'STATUS') {
        const aRank = calculateJobCardStatusRank(a.status);
        const bRank = calculateJobCardStatusRank(b.status);
        return aRank - bRank;
      }
      return 0;
    });
  }, [filteredCards, sortBy]);

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

          {isManagementRole && (
            <button
              type="button"
              onClick={onOpenNewJobCardModal}
              className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-600/20 active:scale-95 shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>+ Create Job Card</span>
            </button>
          )}
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

        {/* Clean Global Search Bar (Always visible on page open; Advanced Filters collapsed until toggled) */}
        <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          
          {/* Primary Row: Search Input + Advanced Filters Toggle Button */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-600 dark:text-blue-400 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={
                  searchScope === 'REG_NO'
                    ? 'Type Vehicle Reg No (e.g. KA01AB1234, MH-12) or Job Card ID...'
                    : searchScope === 'CUSTOMER'
                    ? 'Type Customer Name, Phone Number, or Email...'
                    : searchScope === 'TECHNICIAN'
                    ? 'Type Assigned Painter, Denter, Mechanic, or Floor Manager...'
                    : 'Search Job Cards by Customer Name, Vehicle Reg No, or Assigned Technician...'
                }
                aria-label="Global Job Card Search"
                className="w-full pl-10 pr-20 min-h-[46px] text-xs sm:text-sm rounded-2xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 font-semibold transition-all shadow-2xs"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-1 rounded-lg bg-slate-200/80 dark:bg-slate-700 hover:bg-rose-500 hover:text-white text-slate-600 dark:text-slate-300 text-[10px] font-black flex items-center gap-1 transition-colors cursor-pointer"
                  title="Clear search query"
                >
                  <X className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            {/* Toggle Button for Collapsible Advanced Filters (Hidden on Page Opening) */}
            <button
              type="button"
              onClick={() => setShowAdvancedFilters((prev) => !prev)}
              aria-expanded={showAdvancedFilters}
              className={`min-h-[46px] px-3.5 sm:px-4 rounded-2xl border text-xs font-extrabold flex items-center gap-2 shrink-0 transition-all cursor-pointer ${
                showAdvancedFilters || activeAdvancedFilterCount > 0
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/20'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              title="Toggle Advanced Filters (Priority, Date Range, Technician & Sort)"
            >
              <SlidersHorizontal className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Advanced Filters</span>
              {activeAdvancedFilterCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-white text-blue-700 text-[10px] font-black leading-none">
                  {activeAdvancedFilterCount}
                </span>
              )}
              {showAdvancedFilters ? (
                <ChevronUp className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
              )}
            </button>
          </div>

          {/* Collapsible Advanced Filters Drawer (Not visible on page opening) */}
          {showAdvancedFilters && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-3.5 animate-in fade-in duration-150">
              
              {/* Row 1: Job Priority (High / Medium / Low) + Date Range Filter */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                
                {/* Job Priority Selector (High / Medium / Low) */}
                <div className="lg:col-span-5 flex flex-col gap-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Flame className="w-3 h-3 text-amber-500" />
                    Job Priority Level
                  </span>
                  <div className="grid grid-cols-4 gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                    {[
                      { id: 'ALL', label: `All (${sectionCards.length})`, activeClass: 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900' },
                      { id: 'HIGH', label: `High (${priorityCounts.HIGH})`, activeClass: 'bg-rose-600 text-white' },
                      { id: 'MEDIUM', label: `Med (${priorityCounts.MEDIUM})`, activeClass: 'bg-amber-500 text-slate-950' },
                      { id: 'LOW', label: `Low (${priorityCounts.LOW})`, activeClass: 'bg-emerald-600 text-white' },
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPriorityFilter(p.id as any)}
                        className={`min-h-[34px] px-2 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer truncate ${
                          priorityFilter === p.id
                            ? `${p.activeClass} shadow-2xs`
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date Range Filter (From Date / To Date + Date Field + Quick Presets) */}
                <div className="lg:col-span-7 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                      Date Range Filter
                    </span>
                    <div className="flex items-center gap-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          const today = getLocalDateString(0);
                          setDateFrom(today);
                          setDateTo(today);
                        }}
                        className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:border-blue-500 cursor-pointer"
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDateFrom(getLocalDateString(-7));
                          setDateTo(getLocalDateString(0));
                        }}
                        className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:border-blue-500 cursor-pointer"
                      >
                        Last 7 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDateFrom(getLocalDateString(-30));
                          setDateTo(getLocalDateString(0));
                        }}
                        className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:border-blue-500 cursor-pointer"
                      >
                        Last 30 Days
                      </button>
                      {(dateFrom || dateTo) && (
                        <button
                          type="button"
                          onClick={() => {
                            setDateFrom('');
                            setDateTo('');
                          }}
                          className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-black hover:bg-rose-500 hover:text-white cursor-pointer"
                        >
                          Clear Dates
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select
                      value={dateRangeField}
                      onChange={(e) => setDateRangeField(e.target.value as any)}
                      aria-label="Date Filter Field"
                      className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-extrabold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="ANY">📅 Created or Target Date</option>
                      <option value="CREATED">📥 Created Date</option>
                      <option value="TARGET">⏰ Target Delivery Date</option>
                    </select>

                    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">From:</span>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        aria-label="Start Date"
                        className="w-full bg-transparent text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">To:</span>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        aria-label="End Date"
                        className="w-full bg-transparent text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* Row 2: Search Scope + Assigned Technician Filter + Sort By */}
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 pt-2.5 border-t border-slate-200/70 dark:border-slate-700/70">
                
                {/* Search Scope Selector Pills */}
                <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto scrollbar-none">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-2 shrink-0">
                    Search Scope:
                  </span>
                  {[
                    { id: 'ALL', label: 'All Fields' },
                    { id: 'REG_NO', label: '🚗 Reg No' },
                    { id: 'CUSTOMER', label: '👤 Customer' },
                    { id: 'TECHNICIAN', label: '👨‍🔧 Technician' },
                  ].map((scope) => (
                    <button
                      key={scope.id}
                      type="button"
                      onClick={() => setSearchScope(scope.id as any)}
                      className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                        searchScope === scope.id
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      {scope.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  {/* Technician Direct Filter Dropdown */}
                  <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1.5 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700">
                    <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">Technician:</span>
                    <select
                      value={selectedTechnician}
                      onChange={(e) => setSelectedTechnician(e.target.value)}
                      aria-label="Filter by Assigned Technician"
                      className="bg-transparent text-slate-900 dark:text-slate-100 text-xs font-black focus:outline-none cursor-pointer pr-1 max-w-[180px] truncate"
                    >
                      <option value="ALL">All Technicians ({sectionCards.length})</option>
                      <option value="UNASSIGNED">
                        ⚠️ Unassigned Tasks ({sectionCards.filter(c => c.tasks.some(t => !t.assignedEmployeeId && !t.assignedPainterId && !t.assignedDenterId)).length})
                      </option>
                      {availableTechnicians.map((tech) => (
                        <option key={tech.name} value={tech.name}>
                          {tech.name} ({tech.role}) {tech.count > 0 ? `• ${tech.count}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sort By Dropdown */}
                  <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1.5 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700">
                    <ArrowUpDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">Sort:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as JobCardSortOption)}
                      aria-label="Sort Job Cards"
                      className="bg-transparent text-slate-900 dark:text-slate-100 text-xs font-black focus:outline-none cursor-pointer pr-1"
                    >
                      <option value="PRIORITY">🔥 Urgency & Priority</option>
                      <option value="TARGET_DATE_ASC">⏰ Target Delivery Date</option>
                      <option value="DATE_NEWEST">📅 Created (Newest)</option>
                      <option value="DATE_OLDEST">📅 Created (Oldest)</option>
                      <option value="STATUS">🚦 Pipeline Status</option>
                    </select>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Active Search / Filter Feedback Banner */}
          {(searchTerm.trim() !== '' || activeAdvancedFilterCount > 0) && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/60 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  Found <span className="font-black text-blue-600 dark:text-blue-400">{sortedCards.length}</span> matching {mainSection === 'ACTIVE' ? 'active' : 'history'} job card{sortedCards.length === 1 ? '' : 's'}
                </span>
                {searchTerm.trim() && (
                  <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 font-mono font-bold text-[11px] text-blue-700 dark:text-blue-300">
                    Query: "{searchTerm.trim()}" ({searchScope === 'ALL' ? 'Customer, Reg No & Technician' : searchScope.replace('_', ' ')})
                  </span>
                )}
                {priorityFilter !== 'ALL' && (
                  <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                    priorityFilter === 'HIGH'
                      ? 'bg-rose-600 text-white'
                      : priorityFilter === 'MEDIUM'
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-emerald-600 text-white'
                  }`}>
                    Priority: {priorityFilter}
                  </span>
                )}
                {(dateFrom || dateTo) && (
                  <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white font-bold text-[11px]">
                    Date: {dateFrom || 'Any'} → {dateTo || 'Any'}
                  </span>
                )}
                {selectedTechnician !== 'ALL' && (
                  <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white font-bold text-[11px]">
                    Technician: {selectedTechnician === 'UNASSIGNED' ? 'Unallotted Tasks' : selectedTechnician}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={resetAllFilters}
                className="text-[11px] font-black text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Reset All Filters</span>
              </button>
            </div>
          )}

          {/* Bottom Row: Sub-Filter Stage Pills */}
          <div className="flex items-center gap-1.5 w-full overflow-x-auto pb-1 scrollbar-none">
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
      {sortedCards.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 sm:p-12 text-center text-slate-500 space-y-3">
          <Car className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-slate-400 stroke-[1.5]" />
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm sm:text-base">
              No {mainSection === 'ACTIVE' ? 'Active' : 'History'} Job Cards Match Your Search
            </h3>
            <p className="text-xs mt-1 max-w-md mx-auto">
              {hasAnyActiveSearchOrFilter
                ? 'No job cards matched your active search or filter criteria. Try adjusting the search term, priority level, or date range.'
                : mainSection === 'ACTIVE'
                ? 'All delivered vehicles have been moved to the History of Job Cards section.'
                : 'Delivered and closed vehicle job cards will automatically appear here.'}
            </p>
          </div>
          {hasAnyActiveSearchOrFilter && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-xs transition-all cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear Search & Filters</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {sortedCards.map((card) => (
            <JobCardListItem
              key={card.id}
              card={card}
              isManagementRole={isManagementRole}
              searchTerm={searchTerm}
              selectedTechnician={selectedTechnician}
              confirmDeleteId={confirmDeleteId}
              onTogglePriorityFilter={handleTogglePriorityFilter}
              onToggleTechnicianFilter={handleToggleTechnicianFilter}
              onOpenRequisitionModal={handleOpenRequisitionModal}
              onSetConfirmDeleteId={handleSetConfirmDeleteId}
              onDeleteJobCard={handleDeleteJobCard}
              onSelectJobCard={handleSelectJobCard}
              onOpenQRModal={onOpenQRModal ? handleOpenQRModal : undefined}
            />
          ))}
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
});

