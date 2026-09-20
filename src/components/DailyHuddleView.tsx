import React, { useState, useEffect } from 'react';
import { 
  JobCard, 
  UserRole, 
  TaskCategory, 
  TaskStatus, 
  Employee, 
  Vendor,
  VehicleCheckIn
} from '../types';
import { 
  updateJobCardTask, 
  updateJobCard, 
  updateTaskStatus,
  getEmployees, 
  getVendors,
  formatJobCardStatus,
  getVehicleCheckIns,
  subscribeToStore
} from '../lib/storage';
import { getLocalDateString } from '../lib/urgencyHelper';
import { 
  Users, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar, 
  Search, 
  Paintbrush, 
  Wrench, 
  Sparkles, 
  Building2, 
  ChevronRight, 
  Plus, 
  UserCheck, 
  Flame, 
  FileText, 
  ShieldCheck, 
  Zap, 
  MessageSquare, 
  Filter, 
  ArrowUpRight,
  TrendingUp,
  AlertCircle,
  Truck,
  Check,
  Target,
  X,
  LogIn,
  Car
} from 'lucide-react';

interface DailyHuddleViewProps {
  jobCards: JobCard[];
  currentRole: UserRole;
  onSelectJobCard: (cardId: string) => void;
  onOpenNewJobCardModal?: () => void;
  onOpenCustomerApprovalPortal?: (cardId: string) => void;
  onOpenQCModal?: (cardId: string) => void;
}

export function DailyHuddleView({
  jobCards,
  currentRole,
  onSelectJobCard,
  onOpenNewJobCardModal,
  onOpenCustomerApprovalPortal,
  onOpenQCModal
}: DailyHuddleViewProps) {
  const isManagementRole = currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN' || currentRole === 'SERVICE_ADVISOR' || currentRole === 'FLOOR_MANAGER';
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<'ALL' | 'BODYSHOP' | 'MECHANICAL' | 'WASHING' | 'SUBLET' | 'QC'>('ALL');
  const [deadlineFilter, setDeadlineFilter] = useState<'ALL' | 'URGENT_DEADLINE' | 'DELIVERY_TODAY' | 'TARGET_TOMORROW' | 'OVERDUE' | 'UNASSIGNED'>('ALL');
  const [sortBy, setSortBy] = useState<'URGENCY' | 'PROGRESS' | 'NEWEST'>('URGENCY');
  
  // Daily Standup Huddle Notes state saved per date
  const todayDateStr = getLocalDateString(0);
  const tomorrowDateStr = getLocalDateString(1);
  const [huddleNotes, setHuddleNotes] = useState<string>(() => {
    try {
      return localStorage.getItem(`fixocar_huddle_notes_${todayDateStr}`) || '';
    } catch (e) {
      return '';
    }
  });

  const [checkIns, setCheckIns] = useState<VehicleCheckIn[]>(() => getVehicleCheckIns());

  useEffect(() => {
    const refreshData = () => {
      setCheckIns(getVehicleCheckIns());
    };
    refreshData();
    const unsubscribe = subscribeToStore(refreshData);
    return () => unsubscribe();
  }, []);

  const pendingCheckIns = checkIns.filter(c => {
    if (c.status === 'CHECKED_OUT') return false;
    const cleanReg = c.registrationNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const hasActiveJobCard = jobCards.some(jc => {
      if (jc.status === 'DELIVERED' || jc.status === 'CLOSED') return false;
      if (jc.checkInRecordId && jc.checkInRecordId === c.id) return true;
      const jcReg = jc.vehicle.registrationNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      return jcReg === cleanReg;
    });
    return !hasActiveJobCard;
  }).sort((a, b) => {
    const numA = parseInt(a.id.replace(/\D/g, '') || '0', 10);
    const numB = parseInt(b.id.replace(/\D/g, '') || '0', 10);
    return numB - numA;
  });

  const [employees, setEmployees] = useState<Employee[]>(() => getEmployees());
  const [vendors, setVendors] = useState<Vendor[]>(() => getVendors());

  const getCategoryLabel = (category: string) => {
    if (category === 'PAINT' || category === 'DENTING') return 'Paint & Dent';
    if (category === 'MECHANICAL' || category === 'ALIGNMENT_BALANCING' || category === 'TYRE_WORK') return 'Mechanical';
    if (category === 'WASHING') return 'Washing';
    if (category === 'SUBLET_VENDOR' || category === 'LATHE_WORK') return 'Sublet Vendor';
    return category || 'General';
  };

  useEffect(() => {
    try {
      localStorage.setItem(`fixocar_huddle_notes_${todayDateStr}`, huddleNotes);
    } catch (e) {
      // ignore local storage error
    }
  }, [huddleNotes, todayDateStr]);

  // Date parsing & Deadline status calculation
  const getDeadlineInfo = (estimatedCompletionDate: string, isUrgent?: boolean) => {
    const baseScore = isUrgent ? 200 : 0;

    if (!estimatedCompletionDate) {
      return { 
        status: 'UPCOMING' as const, 
        label: isUrgent ? '🔥 MARKED URGENT' : 'No Deadline Set', 
        subtext: isUrgent ? 'Priority High' : 'Target date unassigned', 
        color: isUrgent ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-400 font-bold' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300', 
        isOverdue: false, 
        isToday: false,
        urgencyScore: baseScore
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDate = new Date(estimatedCompletionDate);
    const targetDateOnly = new Date(targetDate);
    targetDateOnly.setHours(0, 0, 0, 0);

    const diffTime = targetDateOnly.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

    if (diffDays < 0) {
      const overdueDays = Math.abs(diffDays);
      return {
        status: 'OVERDUE' as const,
        label: `🚨 Overdue by ${overdueDays} day${overdueDays > 1 ? 's' : ''}${isUrgent ? ' 🔥' : ''}`,
        subtext: `Promised: ${estimatedCompletionDate}`,
        color: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800 animate-pulse',
        badgeBg: 'bg-rose-600 text-white',
        isOverdue: true,
        isToday: false,
        urgencyScore: baseScore + 100 + overdueDays
      };
    } else if (diffDays === 0) {
      return {
        status: 'DELIVERY_TODAY' as const,
        label: `⏰ Promised Delivery Today${isUrgent ? ' 🔥' : ''}`,
        subtext: `Target: ${estimatedCompletionDate}`,
        color: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700',
        badgeBg: 'bg-amber-500 text-slate-950',
        isOverdue: false,
        isToday: true,
        urgencyScore: baseScore + 80
      };
    } else if (diffDays === 1) {
      return {
        status: 'TOMORROW' as const,
        label: `📅 Promised Tomorrow${isUrgent ? ' 🔥' : ''}`,
        subtext: `Target: ${estimatedCompletionDate}`,
        color: isUrgent ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-400 font-bold' : 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800',
        badgeBg: 'bg-blue-600 text-white',
        isOverdue: false,
        isToday: false,
        urgencyScore: baseScore + 50
      };
    } else {
      return {
        status: 'UPCOMING' as const,
        label: `📆 Promised in ${diffDays} days${isUrgent ? ' 🔥' : ''}`,
        subtext: `Target: ${estimatedCompletionDate}`,
        color: isUrgent ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-400 font-bold' : 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800',
        badgeBg: 'bg-slate-700 text-slate-200',
        isOverdue: false,
        isToday: false,
        urgencyScore: baseScore + 10
      };
    }
  };

  // Filter Active Jobs (not delivered or closed)
  const activeJobCards = jobCards.filter(c => c.status !== 'DELIVERED' && c.status !== 'CLOSED');

  // Calculate Metrics
  const totalActiveCount = activeJobCards.length;
  
  const overdueCards = activeJobCards.filter(c => {
    const info = getDeadlineInfo(c.estimatedCompletionDate, c.isUrgent);
    return info.isOverdue;
  });

  const dueTodayCards = activeJobCards.filter(c => {
    const info = getDeadlineInfo(c.estimatedCompletionDate, c.isUrgent);
    return info.isToday || c.isUrgent;
  });

  const tomorrowCards = activeJobCards.filter(c => {
    const info = getDeadlineInfo(c.estimatedCompletionDate, c.isUrgent);
    return info.status === 'TOMORROW';
  });

  const urgentDeadlineCount = activeJobCards.filter(c => {
    const info = getDeadlineInfo(c.estimatedCompletionDate, c.isUrgent);
    return info.isOverdue || info.isToday || c.isUrgent;
  }).length;

  const unassignedTasksCards = activeJobCards.filter(c => 
    c.tasks.some(t => !t.assignedToId && t.status !== 'COMPLETED')
  );

  const readyForQCCount = activeJobCards.filter(c => c.status === 'QC_PENDING' || c.status === 'READY_FOR_DELIVERY').length;

  // Department Task counts
  const countDepartmentTasks = (categories: TaskCategory[]) => {
    let count = 0;
    activeJobCards.forEach(c => {
      c.tasks.forEach(t => {
        if (categories.includes(t.category) && t.status !== 'COMPLETED') {
          count++;
        }
      });
    });
    return count;
  };

  const bodyShopActiveTasks = countDepartmentTasks(['PAINT', 'DENTING']);
  const mechanicalActiveTasks = countDepartmentTasks(['MECHANICAL', 'ALIGNMENT_BALANCING', 'TYRE_WORK']);
  const washingActiveTasks = countDepartmentTasks(['WASHING']);
  const subletActiveTasks = countDepartmentTasks(['SUBLET_VENDOR', 'LATHE_WORK']);

  // Filter logic
  const filteredCards = activeJobCards.filter(card => {
    // 1. Search filter
    const matchesSearch = 
      card.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.vehicle.registrationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.vehicle.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.vehicle.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.customer.phone.includes(searchTerm) ||
      (card.cityName && card.cityName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (card.workshopName && card.workshopName.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    // 2. Deadline / Urgency filter
    const deadlineInfo = getDeadlineInfo(card.estimatedCompletionDate, card.isUrgent);
    if (deadlineFilter === 'URGENT_DEADLINE' && !card.isUrgent && !deadlineInfo.isOverdue && !deadlineInfo.isToday) return false;
    if (deadlineFilter === 'DELIVERY_TODAY' && !deadlineInfo.isToday && !card.isUrgent) return false;
    if (deadlineFilter === 'TARGET_TOMORROW' && deadlineInfo.status !== 'TOMORROW') return false;
    if (deadlineFilter === 'OVERDUE' && !deadlineInfo.isOverdue) return false;
    if (deadlineFilter === 'UNASSIGNED' && !card.tasks.some(t => !t.assignedToId && t.status !== 'COMPLETED')) return false;

    // 3. Department filter
    if (selectedDepartment === 'BODYSHOP') {
      return card.tasks.some(t => t.category === 'PAINT' || t.category === 'DENTING');
    }
    if (selectedDepartment === 'MECHANICAL') {
      return card.tasks.some(t => t.category === 'MECHANICAL' || t.category === 'ALIGNMENT_BALANCING' || t.category === 'TYRE_WORK');
    }
    if (selectedDepartment === 'WASHING') {
      return card.tasks.some(t => t.category === 'WASHING');
    }
    if (selectedDepartment === 'SUBLET') {
      return card.tasks.some(t => t.category === 'SUBLET_VENDOR' || t.category === 'LATHE_WORK');
    }
    if (selectedDepartment === 'QC') {
      return card.status === 'QC_PENDING' || card.status === 'READY_FOR_DELIVERY';
    }

    return true;
  });

  // Sort logic
  const sortedCards = [...filteredCards].sort((a, b) => {
    if (sortBy === 'URGENCY') {
      const aInfo = getDeadlineInfo(a.estimatedCompletionDate, a.isUrgent);
      const bInfo = getDeadlineInfo(b.estimatedCompletionDate, b.isUrgent);
      return bInfo.urgencyScore - aInfo.urgencyScore;
    }
    if (sortBy === 'PROGRESS') {
      const aCompleted = a.tasks.filter(t => t.status === 'COMPLETED').length;
      const aTotal = a.tasks.length || 1;
      const aRatio = aCompleted / aTotal;

      const bCompleted = b.tasks.filter(t => t.status === 'COMPLETED').length;
      const bTotal = b.tasks.length || 1;
      const bRatio = bCompleted / bTotal;

      return bRatio - aRatio; // Most completed first
    }
    if (sortBy === 'NEWEST') {
      return b.id.localeCompare(a.id);
    }
    return 0;
  });

  const handleQuickTaskStatus = (jobCardId: string, taskId: string, newStatus: TaskStatus) => {
    updateTaskStatus(jobCardId, taskId, newStatus);
  };

  const formattedToday = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-indigo-900/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Flame className="w-64 h-64 text-amber-400" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="bg-amber-500 text-slate-950 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider flex items-center gap-1 shadow-xs">
                <Flame className="w-3 h-3 fill-current text-slate-950" /> Daily Standup Huddle
              </span>
              <span className="text-xs font-semibold text-indigo-200 bg-indigo-900/50 px-3 py-0.5 rounded-full border border-indigo-700/50">
                {formattedToday}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              Shop Floor Daily Huddle
            </h1>
            <p className="text-xs sm:text-sm text-indigo-200/80 max-w-2xl">
              Real-time daily operations sync across all departments. Track active vehicles, monitor delivery deadlines, identify blockers, and assign unallotted tasks.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isManagementRole && onOpenNewJobCardModal && (
              <button
                type="button"
                onClick={onOpenNewJobCardModal}
                className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Create Job Card</span>
              </button>
            )}
          </div>
        </div>

        {/* Huddle Notes / Blockers Input Bar */}
        <div className="mt-6 pt-5 border-t border-indigo-800/50">
          <div className="flex items-center justify-between gap-2 mb-2">
            <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
              <span>Today's Standup Targets & Department Blockers:</span>
            </label>
            {huddleNotes && (
              <button
                type="button"
                onClick={() => setHuddleNotes('')}
                className="text-[10px] text-rose-300 hover:text-white underline font-medium flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear Targets
              </button>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={huddleNotes}
              onChange={(e) => setHuddleNotes(e.target.value)}
              placeholder="e.g., Priority: Complete Honda City paint by 2 PM | Lathe work on Swift delayed by 1 hr..."
              className="flex-1 bg-slate-950/80 border border-indigo-800/80 rounded-2xl px-4 py-2 text-xs font-medium text-slate-100 placeholder-indigo-300/40 focus:outline-none focus:border-amber-400 transition-all"
            />
            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              <button
                type="button"
                onClick={() => {
                  setHuddleNotes(prev => (prev ? `${prev} | ` : '') + '🔴 Focus on Delivery Today');
                  setDeadlineFilter('DELIVERY_TODAY');
                }}
                className="px-2.5 py-1 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[10px] font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1"
                title="Filter Promised Delivery Today & add note"
              >
                <span>+ Focus Delivery</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setHuddleNotes(prev => (prev ? `${prev} | ` : '') + '🟡 Body Shop Paint Target');
                  setSelectedDepartment('BODYSHOP');
                }}
                className="px-2.5 py-1 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-[10px] font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1"
                title="Filter Paint & Denting & add note"
              >
                <span>+ Paint Target</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setHuddleNotes(prev => (prev ? `${prev} | ` : '') + '⚠️ Clear Unassigned Tasks');
                  setDeadlineFilter('UNASSIGNED');
                }}
                className="px-2.5 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1"
                title="Filter Unassigned Tasks & add note"
              >
                <span>+ Unassigned</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setHuddleNotes(prev => (prev ? `${prev} | ` : '') + '🚨 Clear Overdue Jobs');
                  setDeadlineFilter('OVERDUE');
                }}
                className="px-2.5 py-1 rounded-xl bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 border border-rose-400/50 text-[10px] font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1"
                title="Filter Overdue Jobs & add note"
              >
                <span>+ Overdue Alert</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Gate Pass Checked-In Vehicles Section (Awaiting Job Card) */}
      {pendingCheckIns.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/20 to-blue-500/10 dark:from-amber-950/50 dark:to-blue-950/30 rounded-3xl p-5 border-2 border-amber-500/40 shadow-lg space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-sm animate-pulse">
                <LogIn className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>🚗 Gate Checked-In Vehicles (Awaiting Job Card)</span>
                  <span className="bg-amber-500 text-slate-950 font-black text-xs px-2.5 py-0.5 rounded-full">
                    {pendingCheckIns.length} Pending
                  </span>
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  These vehicles passed gate check-in and are inside the workshop waiting for Job Card creation.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingCheckIns.map((checkIn, idx) => {
              const isLatest = idx === 0;
              return (
                <div
                  key={checkIn.id}
                  className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border transition-all shadow-xs flex flex-col justify-between gap-3 ${
                    isLatest
                      ? 'border-2 border-amber-500 dark:border-amber-400 ring-2 ring-amber-500/30 shadow-md'
                      : 'border-amber-400/40 dark:border-amber-500/30 hover:border-amber-500'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {checkIn.checkInPhotoWithDriverUrl ? (
                      <img
                        src={checkIn.checkInPhotoWithDriverUrl}
                        alt={checkIn.registrationNumber}
                        className="w-12 h-12 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                        <Car className="w-6 h-6" />
                      </div>
                    )}

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <div className="flex items-center gap-1">
                          {isLatest && (
                            <span className="bg-amber-500 text-slate-950 font-black text-[9px] px-1.5 py-0.2 rounded uppercase tracking-wide animate-pulse">
                              ✨ LATEST
                            </span>
                          )}
                          <span className="font-mono font-black text-xs bg-slate-900 text-amber-400 px-2 py-0.5 rounded-lg border border-slate-700">
                            {checkIn.registrationNumber}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 font-mono">{checkIn.id}</span>
                      </div>
                      <h4 className="font-extrabold text-xs text-slate-900 dark:text-slate-100 truncate">
                        {checkIn.make} {checkIn.model} {checkIn.variant ? `(${checkIn.variant})` : ''}
                      </h4>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                        <span>🕒 Gate In: {checkIn.checkedInAt}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-[11px] space-y-1">
                    <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                      <span className="font-semibold truncate">Customer/Fleet:</span>
                      <strong className="text-slate-900 dark:text-slate-100 shrink-0 ml-1">{checkIn.customerName}</strong>
                    </div>
                    {checkIn.isCars24 && checkIn.cars24RefNo && (
                      <div className="flex justify-between items-center text-amber-600 dark:text-amber-400 font-bold">
                        <span>Cars24 Ref:</span>
                        <span className="font-mono">{checkIn.cars24RefNo}</span>
                      </div>
                    )}
                  </div>

                  {isManagementRole && onOpenNewJobCardModal && (
                    <button
                      type="button"
                      onClick={onOpenNewJobCardModal}
                      className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      <span>➕ Create Job Card for {checkIn.registrationNumber}</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Live Operational Standup Target Banner (if notes entered) */}
      {huddleNotes && (
        <div className="bg-amber-500/10 dark:bg-amber-500/15 border-2 border-amber-500/40 rounded-3xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-xs">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 block">
                Today's Active Standup Focus Target:
              </span>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                "{huddleNotes}"
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold shrink-0">
            <button
              onClick={() => { setDeadlineFilter('ALL'); setSelectedDepartment('ALL'); }}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-xs cursor-pointer"
            >
              Show All Cars
            </button>
            <button
              onClick={() => setHuddleNotes('')}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              title="Clear Standup Note"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* KPI Stats Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        
        {/* Total Active Jobs */}
        <div 
          onClick={() => { setDeadlineFilter('ALL'); setSelectedDepartment('ALL'); }}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            deadlineFilter === 'ALL' && selectedDepartment === 'ALL'
              ? 'bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-400/50'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[11px] font-extrabold uppercase tracking-wider ${
              deadlineFilter === 'ALL' && selectedDepartment === 'ALL' ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'
            }`}>
              Active Shop Floor
            </span>
            <FileText className={`w-4 h-4 ${
              deadlineFilter === 'ALL' && selectedDepartment === 'ALL' ? 'text-white' : 'text-blue-500'
            }`} />
          </div>
          <div className={`text-2xl font-black ${
            deadlineFilter === 'ALL' && selectedDepartment === 'ALL' ? 'text-white' : 'text-slate-900 dark:text-white'
          }`}>
            {totalActiveCount}
            <span className={`text-xs font-normal ml-1 ${
              deadlineFilter === 'ALL' && selectedDepartment === 'ALL' ? 'text-blue-200' : 'text-slate-500 dark:text-slate-400'
            }`}>cars</span>
          </div>
          <p className={`text-[10px] mt-1 font-medium ${
            deadlineFilter === 'ALL' && selectedDepartment === 'ALL' ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'
          }`}>
            Vehicles currently in repair
          </p>
        </div>

        {/* Promised Delivery Today */}
        <div 
          onClick={() => setDeadlineFilter('DELIVERY_TODAY')}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            deadlineFilter === 'DELIVERY_TODAY'
              ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-md ring-2 ring-amber-400/50'
              : 'bg-amber-500/10 dark:bg-amber-500/15 border-amber-200 dark:border-amber-800/60 hover:border-amber-400'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[11px] font-extrabold uppercase tracking-wider ${
              deadlineFilter === 'DELIVERY_TODAY' ? 'text-slate-950 font-black' : 'text-amber-700 dark:text-amber-300'
            }`}>
              Promised Today
            </span>
            <Clock className={`w-4 h-4 ${deadlineFilter === 'DELIVERY_TODAY' ? 'text-slate-950' : 'text-amber-600 dark:text-amber-400'}`} />
          </div>
          <div className={`text-2xl font-black ${deadlineFilter === 'DELIVERY_TODAY' ? 'text-slate-950' : 'text-amber-900 dark:text-amber-100'}`}>
            {dueTodayCards.length}
            <span className={`text-xs font-normal ml-1 ${deadlineFilter === 'DELIVERY_TODAY' ? 'text-slate-900 font-semibold' : 'text-amber-700 dark:text-amber-300'}`}>due today</span>
          </div>
          <p className={`text-[10px] mt-1 font-medium ${deadlineFilter === 'DELIVERY_TODAY' ? 'text-slate-900 font-medium' : 'text-amber-800/80 dark:text-amber-300/80'}`}>
            High priority handover targets
          </p>
        </div>

        {/* Overdue Deadlines */}
        <div 
          onClick={() => setDeadlineFilter('OVERDUE')}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            deadlineFilter === 'OVERDUE'
              ? 'bg-rose-600 text-white border-rose-700 shadow-md ring-2 ring-rose-400/50'
              : overdueCards.length > 0 
                ? 'bg-rose-500/10 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 hover:border-rose-500' 
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[11px] font-extrabold uppercase tracking-wider ${
              deadlineFilter === 'OVERDUE' ? 'text-white' : overdueCards.length > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-500'
            }`}>
              Overdue Deadlines
            </span>
            <AlertTriangle className={`w-4 h-4 ${deadlineFilter === 'OVERDUE' ? 'text-white' : overdueCards.length > 0 ? 'text-rose-600 dark:text-rose-400 animate-bounce' : 'text-slate-400'}`} />
          </div>
          <div className={`text-2xl font-black ${deadlineFilter === 'OVERDUE' ? 'text-white' : overdueCards.length > 0 ? 'text-rose-900 dark:text-rose-200' : 'text-slate-900 dark:text-white'}`}>
            {overdueCards.length}
            <span className={`text-xs font-normal ml-1 ${deadlineFilter === 'OVERDUE' ? 'text-rose-200' : 'text-rose-700 dark:text-rose-400'}`}>delayed</span>
          </div>
          <p className={`text-[10px] mt-1 font-medium ${deadlineFilter === 'OVERDUE' ? 'text-rose-100' : overdueCards.length > 0 ? 'text-rose-800 dark:text-rose-300' : 'text-slate-500'}`}>
            {overdueCards.length > 0 ? '🚨 Immediate action required' : 'No overdue jobs!'}
          </p>
        </div>

        {/* Unassigned Tasks */}
        <div 
          onClick={() => setDeadlineFilter('UNASSIGNED')}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            deadlineFilter === 'UNASSIGNED'
              ? 'bg-purple-600 text-white border-purple-700 shadow-md ring-2 ring-purple-400/50'
              : unassignedTasksCards.length > 0
                ? 'bg-purple-500/10 dark:bg-purple-950/30 border-purple-300 dark:border-purple-800 hover:border-purple-500'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[11px] font-extrabold uppercase tracking-wider ${deadlineFilter === 'UNASSIGNED' ? 'text-white' : 'text-purple-700 dark:text-purple-300'}`}>
              Unassigned Tasks
            </span>
            <UserCheck className={`w-4 h-4 ${deadlineFilter === 'UNASSIGNED' ? 'text-white' : 'text-purple-600 dark:text-purple-400'}`} />
          </div>
          <div className={`text-2xl font-black ${deadlineFilter === 'UNASSIGNED' ? 'text-white' : 'text-purple-900 dark:text-purple-200'}`}>
            {unassignedTasksCards.length}
            <span className={`text-xs font-normal ml-1 ${deadlineFilter === 'UNASSIGNED' ? 'text-purple-200' : 'text-purple-700 dark:text-purple-300'}`}>cards</span>
          </div>
          <p className={`text-[10px] mt-1 font-medium ${deadlineFilter === 'UNASSIGNED' ? 'text-purple-100' : 'text-purple-800 dark:text-purple-300'}`}>
            Needs staff or vendor allotment
          </p>
        </div>

        {/* QC & Delivery Ready */}
        <div 
          onClick={() => setSelectedDepartment('QC')}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            selectedDepartment === 'QC'
              ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-400/50'
              : 'bg-emerald-500/10 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 hover:border-emerald-500'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[11px] font-extrabold uppercase tracking-wider ${selectedDepartment === 'QC' ? 'text-white' : 'text-emerald-700 dark:text-emerald-300'}`}>
              QC & Dispatch
            </span>
            <ShieldCheck className={`w-4 h-4 ${selectedDepartment === 'QC' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
          </div>
          <div className={`text-2xl font-black ${selectedDepartment === 'QC' ? 'text-white' : 'text-emerald-900 dark:text-emerald-200'}`}>
            {readyForQCCount}
            <span className={`text-xs font-normal ml-1 ${selectedDepartment === 'QC' ? 'text-emerald-200' : 'text-emerald-700 dark:text-emerald-300'}`}>ready</span>
          </div>
          <p className={`text-[10px] mt-1 font-medium ${selectedDepartment === 'QC' ? 'text-emerald-100' : 'text-emerald-800 dark:text-emerald-300'}`}>
            Floor inspection & delivery
          </p>
        </div>

      </div>

      {/* Filter, Department Tabs & Search Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
        
        {/* Department Filters Row */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-blue-600" /> Dept:
            </span>

            <button
              type="button"
              onClick={() => setSelectedDepartment('ALL')}
              className={`px-3.5 py-1.5 rounded-2xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                selectedDepartment === 'ALL'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <span>🏢 All Depts</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">{totalActiveCount}</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedDepartment('BODYSHOP')}
              className={`px-3.5 py-1.5 rounded-2xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                selectedDepartment === 'BODYSHOP'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-purple-700 dark:text-purple-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Paintbrush className="w-3.5 h-3.5" />
              <span>Paint & Denting</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-800 dark:text-purple-200">{bodyShopActiveTasks}</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedDepartment('MECHANICAL')}
              className={`px-3.5 py-1.5 rounded-2xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                selectedDepartment === 'MECHANICAL'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-blue-700 dark:text-blue-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Mechanical</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-800 dark:text-blue-200">{mechanicalActiveTasks}</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedDepartment('WASHING')}
              className={`px-3.5 py-1.5 rounded-2xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                selectedDepartment === 'WASHING'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Washing & Detailing</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-200">{washingActiveTasks}</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedDepartment('SUBLET')}
              className={`px-3.5 py-1.5 rounded-2xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                selectedDepartment === 'SUBLET'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-amber-700 dark:text-amber-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Sublet & Lathe</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-200">{subletActiveTasks}</span>
            </button>
          </div>

          <div className="shrink-0">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 focus:outline-none"
            >
              <option value="URGENCY">Sort: Deadline Urgency (High to Low)</option>
              <option value="PROGRESS">Sort: Progress (% Completed)</option>
              <option value="NEWEST">Sort: Job Card ID (Newest)</option>
            </select>
          </div>
        </div>

        {/* Search & Deadline Quick Pills */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Reg #, Customer, Job ID..."
              className="w-full pl-9 pr-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 placeholder-slate-400 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
            <span className="text-xs font-bold text-slate-400 mr-1 shrink-0">Filter:</span>
            
            <button
              type="button"
              onClick={() => setDeadlineFilter('ALL')}
              className={`px-3 py-1 rounded-xl text-xs font-bold shrink-0 ${
                deadlineFilter === 'ALL'
                  ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              All Active ({activeJobCards.length})
            </button>

            <button
              type="button"
              onClick={() => setDeadlineFilter('URGENT_DEADLINE')}
              className={`px-3 py-1 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1 ${
                deadlineFilter === 'URGENT_DEADLINE'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30'
              }`}
            >
              <Clock className="w-3 h-3" /> Urgent / Today ({urgentDeadlineCount})
            </button>

            <button
              type="button"
              onClick={() => setDeadlineFilter('TARGET_TOMORROW')}
              className={`px-3 py-1 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1 ${
                deadlineFilter === 'TARGET_TOMORROW'
                  ? 'bg-blue-600 text-white font-black'
                  : 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/30'
              }`}
            >
              <Calendar className="w-3 h-3" /> Tomorrow ({tomorrowCards.length})
            </button>

            <button
              type="button"
              onClick={() => setDeadlineFilter('OVERDUE')}
              className={`px-3 py-1 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1 ${
                deadlineFilter === 'OVERDUE'
                  ? 'bg-rose-600 text-white font-black'
                  : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30'
              }`}
            >
              <AlertTriangle className="w-3 h-3" /> Overdue ({overdueCards.length})
            </button>

            <button
              type="button"
              onClick={() => setDeadlineFilter('UNASSIGNED')}
              className={`px-3 py-1 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1 ${
                deadlineFilter === 'UNASSIGNED'
                  ? 'bg-purple-600 text-white font-black'
                  : 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/30'
              }`}
            >
              <UserCheck className="w-3 h-3" /> Unassigned ({unassignedTasksCards.length})
            </button>
          </div>

        </div>

      </div>

      {/* Main Active Job Cards List for Huddle */}
      <div className="space-y-4">
        
        {sortedCards.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/50 rounded-full flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
              No Active Job Cards Found
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              There are no job cards matching your selected huddle filters or search parameters. Try adjusting the filters above.
            </p>
          </div>
        ) : (
          sortedCards.map(card => {
            const deadlineInfo = getDeadlineInfo(card.estimatedCompletionDate, card.isUrgent);
            const totalTasks = card.tasks.length;
            const completedTasks = card.tasks.filter(t => t.status === 'COMPLETED').length;
            const inProgressTasks = card.tasks.filter(t => t.status === 'IN_PROGRESS').length;
            const unassignedCount = card.tasks.filter(t => !t.assignedToId && t.status !== 'COMPLETED').length;
            
            const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            // Department task breakdown
            const paintTasks = card.tasks.filter(t => t.category === 'PAINT' || t.category === 'DENTING');
            const mechTasks = card.tasks.filter(t => t.category === 'MECHANICAL' || t.category === 'ALIGNMENT_BALANCING' || t.category === 'TYRE_WORK');
            const washTasks = card.tasks.filter(t => t.category === 'WASHING');
            const subletTasks = card.tasks.filter(t => t.category === 'SUBLET_VENDOR' || t.category === 'LATHE_WORK');

            return (
              <div 
                key={card.id}
                className={`bg-white dark:bg-slate-900 rounded-3xl border transition-all shadow-xs hover:shadow-md overflow-hidden ${
                  card.isUrgent
                    ? 'border-amber-500 dark:border-amber-600 ring-2 ring-amber-500/30 shadow-lg'
                    : deadlineInfo.isOverdue 
                    ? 'border-rose-300 dark:border-rose-900/80 ring-1 ring-rose-500/20' 
                    : deadlineInfo.isToday
                      ? 'border-amber-300 dark:border-amber-900/80 ring-1 ring-amber-500/20'
                      : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                {/* Card Top Banner Header */}
                <div className="p-5 sm:p-6 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  
                  {/* Left: Vehicle & Customer Basic Info */}
                  <div className="flex items-start gap-3">
                    <div className="bg-slate-900 dark:bg-slate-800 text-white p-3 rounded-2xl shrink-0 font-mono font-black text-xs tracking-wider border border-slate-700 shadow-xs text-center min-w-[100px]">
                      <span className="text-amber-400 block text-[9px] font-sans font-bold">REG NO.</span>
                      {card.vehicle.registrationNumber}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          {card.vehicle.make} {card.vehicle.model} ({card.vehicle.color})
                        </h2>

                        {card.isUrgent && (
                          <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs animate-pulse">
                            🔥 URGENT HUDDLE TARGET
                          </span>
                        )}

                        {card.isCars24 && (
                          <span className="bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                            ⚡ Cars24 Fleet
                          </span>
                        )}

                        <span className="text-xs font-mono font-bold text-slate-500 bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                          {card.id}
                        </span>

                        {/* Job Card Lifecycle Stage Chip */}
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border shadow-2xs ${
                          card.status === 'READY_FOR_DELIVERY' || card.status === 'DELIVERED'
                            ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-400'
                            : card.status === 'QC_PENDING'
                            ? 'bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border-cyan-400'
                            : card.status === 'IN_PROGRESS'
                            ? 'bg-amber-500/15 text-amber-900 dark:text-amber-200 border-amber-400'
                            : card.status === 'JOB_ALLOCATED'
                            ? 'bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-400'
                            : 'bg-slate-500/15 text-slate-800 dark:text-slate-300 border-slate-300'
                        }`}>
                          ⚙️ Stage: {formatJobCardStatus(card.status)}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 flex-wrap">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          👤 {card.customer.name} ({card.customer.phone})
                        </span>
                        <span>•</span>
                        <span>📍 {card.workshopName || card.cityName || 'Main Workshop'}</span>
                        {card.floorManagerName && (
                          <>
                            <span>•</span>
                            <span className="text-blue-600 dark:text-blue-400 font-medium">👔 Floor Mgr: {card.floorManagerName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Deadline Badge, Quick Urgency Actions & Progress */}
                  <div className="flex items-center gap-3 shrink-0 flex-wrap lg:flex-nowrap justify-between lg:justify-end">
                    
                    {/* Huddle Urgency Action Toggles */}
                    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/60 shrink-0 whitespace-nowrap">
                      {/* Toggle Urgent Flag */}
                      <button
                        type="button"
                        onClick={() => {
                          updateJobCard(card.id, (prev) => ({ ...prev, isUrgent: !prev.isUrgent }));
                        }}
                        title={card.isUrgent ? "Remove Urgent priority" : "Mark Urgent for Daily Huddle"}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1 transition-all whitespace-nowrap ${
                          card.isUrgent
                            ? 'bg-amber-500 text-slate-950 shadow-xs'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-600'
                        }`}
                      >
                        <Flame className={`w-3.5 h-3.5 ${card.isUrgent ? 'fill-current' : 'text-amber-500'}`} />
                        <span>{card.isUrgent ? 'Urgent' : 'Mark Urgent'}</span>
                      </button>

                      {/* Set Target Delivery Today */}
                      <button
                        type="button"
                        onClick={() => {
                          updateJobCard(card.id, (prev) => ({ 
                            ...prev,
                            estimatedCompletionDate: todayDateStr,
                            isUrgent: true 
                          }));
                        }}
                        title="Set target completion to Today & mark urgent"
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1 transition-all whitespace-nowrap ${
                          deadlineInfo.isToday
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5 text-emerald-500" />
                        <span>{deadlineInfo.isToday ? 'Due Today' : 'Target Today'}</span>
                      </button>

                      {/* Set Target Delivery Tomorrow */}
                      <button
                        type="button"
                        onClick={() => {
                          updateJobCard(card.id, (prev) => ({ 
                            ...prev,
                            estimatedCompletionDate: tomorrowDateStr,
                            isUrgent: true 
                          }));
                        }}
                        title="Set target completion to Tomorrow & mark urgent"
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1 transition-all whitespace-nowrap ${
                          deadlineInfo.status === 'TOMORROW'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600'
                        }`}
                      >
                        <Calendar className="w-3.5 h-3.5 text-blue-500" />
                        <span>{deadlineInfo.status === 'TOMORROW' ? 'Due Tomorrow' : 'Target Tomorrow'}</span>
                      </button>
                    </div>

                    {/* Deadline Highlight Badge */}
                    <div className={`px-3.5 py-1.5 rounded-2xl border flex flex-col items-end shrink-0 whitespace-nowrap ${deadlineInfo.color}`}>
                      <span className="text-xs font-black tracking-tight flex items-center gap-1">
                        {deadlineInfo.label}
                      </span>
                      <span className="text-[10px] font-medium opacity-80 mt-0.5">
                        {deadlineInfo.subtext}
                      </span>
                    </div>

                    {/* Overall Task Progress Bar */}
                    <div className="w-28 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-slate-500">Progress</span>
                        <span className="text-slate-900 dark:text-slate-100">{progressPercent}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-300 ${
                            progressPercent === 100 
                              ? 'bg-emerald-500' 
                              : progressPercent > 50 
                                ? 'bg-blue-600' 
                                : 'bg-amber-500'
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Action Button: View Card */}
                    <button
                      type="button"
                      onClick={() => onSelectJobCard(card.id)}
                      className="px-3.5 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1 transition-all shadow-xs shrink-0"
                    >
                      <span>View</span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </button>

                  </div>

                </div>

                {/* Department Tasks Breakdown Bar */}
                <div className="p-5 sm:p-6 space-y-4">
                  
                  {/* Department Summary Pills */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-400 mr-1 uppercase tracking-wider text-[10px]">
                      Depts Involved:
                    </span>

                    {paintTasks.length > 0 && (
                      <span className={`px-3 py-1 rounded-xl text-xs font-extrabold flex items-center gap-1.5 border ${
                        paintTasks.every(t => t.status === 'COMPLETED')
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300'
                          : 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800'
                      }`}>
                        <Paintbrush className="w-3.5 h-3.5" />
                        <span>Paint & Dent ({paintTasks.filter(t => t.status === 'COMPLETED').length}/{paintTasks.length})</span>
                      </span>
                    )}

                    {mechTasks.length > 0 && (
                      <span className={`px-3 py-1 rounded-xl text-xs font-extrabold flex items-center gap-1.5 border ${
                        mechTasks.every(t => t.status === 'COMPLETED')
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300'
                          : 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800'
                      }`}>
                        <Wrench className="w-3.5 h-3.5" />
                        <span>Mechanical ({mechTasks.filter(t => t.status === 'COMPLETED').length}/{mechTasks.length})</span>
                      </span>
                    )}

                    {washTasks.length > 0 && (
                      <span className={`px-3 py-1 rounded-xl text-xs font-extrabold flex items-center gap-1.5 border ${
                        washTasks.every(t => t.status === 'COMPLETED')
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300'
                          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300'
                      }`}>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Washing ({washTasks.filter(t => t.status === 'COMPLETED').length}/{washTasks.length})</span>
                      </span>
                    )}

                    {subletTasks.length > 0 && (
                      <span className={`px-3 py-1 rounded-xl text-xs font-extrabold flex items-center gap-1.5 border ${
                        subletTasks.every(t => t.status === 'COMPLETED')
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300'
                          : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300'
                      }`}>
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Sublet ({subletTasks.filter(t => t.status === 'COMPLETED').length}/{subletTasks.length})</span>
                      </span>
                    )}

                    {unassignedCount > 0 && (
                      <span className="px-3 py-1 rounded-xl text-xs font-black bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>{unassignedCount} Unassigned Task{unassignedCount > 1 ? 's' : ''}</span>
                      </span>
                    )}
                  </div>

                  {/* Task Items Table for Huddle Review - Scrollable Left to Right */}
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
                    {/* Table Header Section Bar */}
                    <div className="text-[11px] text-slate-600 dark:text-slate-400 font-bold px-3.5 py-2 bg-slate-100/90 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-blue-500" />
                        <span>Tasks List ({card.tasks.length} items)</span>
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 font-medium text-[10px] flex items-center gap-1">
                        <span>Tap buttons below to change task status</span>
                      </span>
                    </div>

                    <div className="overflow-x-auto scrollbar-thin">
                      <table className="w-full text-left border-collapse min-w-[840px]">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider select-none">
                            <th className="py-3 px-4 w-[28%] min-w-[180px] font-black">Service Task</th>
                            <th className="py-3 px-3 w-[15%] min-w-[120px] font-black">Department</th>
                            <th className="py-3 px-3 w-[22%] min-w-[160px] font-black">Assigned Staff / Vendor</th>
                            <th className="py-3 px-3 w-[15%] min-w-[130px] font-black text-center">Current Status</th>
                            <th className="py-3 px-4 w-[20%] min-w-[210px] font-black text-right">Action: Update Status</th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                          {card.tasks.map(task => {
                            return (
                              <tr key={task.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                                
                                {/* Task Title */}
                                <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100 align-middle">
                                  <div className="flex items-center gap-2 max-w-[240px]" title={task.title}>
                                    <span className="truncate">{task.title}</span>
                                  </div>
                                </td>

                                {/* Department */}
                                <td className="py-3 px-3 align-middle">
                                  <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-nowrap inline-block">
                                    {getCategoryLabel(task.category)}
                                  </span>
                                </td>

                                {/* Staff Allotted */}
                                <td className="py-3 px-3 align-middle">
                                  {task.assignedToName ? (
                                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 whitespace-nowrap" title={`Assigned to: ${task.assignedToName}`}>
                                      <UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                      <span className="truncate max-w-[160px]">{task.assignedToName}</span>
                                    </span>
                                  ) : (
                                    <span className="text-amber-700 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg text-[11px] border border-amber-200 dark:border-amber-800/80 flex items-center gap-1 w-fit whitespace-nowrap">
                                      ⚠️ Unassigned
                                    </span>
                                  )}
                                </td>

                                {/* Task Status Stage Chip Column */}
                                <td className="py-3 px-3 align-middle text-center">
                                  {task.status === 'COMPLETED' ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-400 dark:border-emerald-700 shadow-2xs whitespace-nowrap">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                      <span>Completed</span>
                                    </span>
                                  ) : task.status === 'IN_PROGRESS' ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/15 text-blue-800 dark:text-blue-300 border border-blue-400 dark:border-blue-700 shadow-2xs whitespace-nowrap">
                                      <Clock className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0 animate-spin" />
                                      <span>In Progress</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-400 dark:border-amber-700 shadow-2xs whitespace-nowrap">
                                      <AlertCircle className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                                      <span>Pending</span>
                                    </span>
                                  )}
                                </td>

                                {/* Status Controls */}
                                <td className="py-3 px-4 align-middle text-right">
                                  <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => handleQuickTaskStatus(card.id, task.id, 'PENDING')}
                                      title="Set task status to Pending"
                                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold border transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                                        task.status === 'PENDING'
                                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-amber-400'
                                      }`}
                                    >
                                      <Clock className="w-3 h-3" />
                                      <span>Pending</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleQuickTaskStatus(card.id, task.id, 'IN_PROGRESS')}
                                      title="Set task status to In Progress"
                                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold border transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                                        task.status === 'IN_PROGRESS'
                                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-blue-400'
                                      }`}
                                    >
                                      <Clock className="w-3 h-3" />
                                      <span>In Progress</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleQuickTaskStatus(card.id, task.id, 'COMPLETED')}
                                      title="Mark task as Completed"
                                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold border transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                                        task.status === 'COMPLETED'
                                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-emerald-400'
                                      }`}
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Done</span>
                                    </button>
                                  </div>
                                </td>

                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>

              </div>
            );
          })
        )}

      </div>

    </div>
  );
}
