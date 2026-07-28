import React, { useState, useEffect } from 'react';
import { 
  JobCard, 
  UserRole, 
  TaskCategory, 
  TaskStatus, 
  Employee, 
  Vendor 
} from '../types';
import { 
  updateJobCardTask, 
  updateJobCard, 
  getEmployees, 
  getVendors 
} from '../lib/storage';
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
  Check
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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<'ALL' | 'BODYSHOP' | 'MECHANICAL' | 'WASHING' | 'SUBLET' | 'QC'>('ALL');
  const [deadlineFilter, setDeadlineFilter] = useState<'ALL' | 'URGENT_DEADLINE' | 'DELIVERY_TODAY' | 'OVERDUE' | 'UNASSIGNED'>('ALL');
  const [sortBy, setSortBy] = useState<'URGENCY' | 'PROGRESS' | 'NEWEST'>('URGENCY');
  
  // Daily Standup Huddle Notes state saved per date
  const todayDateStr = new Date().toISOString().split('T')[0];
  const [huddleNotes, setHuddleNotes] = useState<string>(() => {
    try {
      return localStorage.getItem(`fixocar_huddle_notes_${todayDateStr}`) || '';
    } catch (e) {
      return '';
    }
  });

  const [employees, setEmployees] = useState<Employee[]>(() => getEmployees());
  const [vendors, setVendors] = useState<Vendor[]>(() => getVendors());

  useEffect(() => {
    try {
      localStorage.setItem(`fixocar_huddle_notes_${todayDateStr}`, huddleNotes);
    } catch (e) {
      // ignore local storage error
    }
  }, [huddleNotes, todayDateStr]);

  // Date parsing & Deadline status calculation
  const getDeadlineInfo = (estimatedCompletionDate: string) => {
    if (!estimatedCompletionDate) {
      return { status: 'UPCOMING' as const, label: 'No Deadline Set', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300', isOverdue: false, isToday: false };
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
        label: `🚨 Overdue by ${overdueDays} day${overdueDays > 1 ? 's' : ''}`,
        subtext: `Promised: ${estimatedCompletionDate}`,
        color: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800 animate-pulse',
        badgeBg: 'bg-rose-600 text-white',
        isOverdue: true,
        isToday: false,
        urgencyScore: 100 + overdueDays
      };
    } else if (diffDays === 0) {
      return {
        status: 'DELIVERY_TODAY' as const,
        label: '⏰ Promised Delivery Today',
        subtext: `Target: ${estimatedCompletionDate}`,
        color: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700',
        badgeBg: 'bg-amber-500 text-slate-950',
        isOverdue: false,
        isToday: true,
        urgencyScore: 80
      };
    } else if (diffDays === 1) {
      return {
        status: 'TOMORROW' as const,
        label: '📅 Promised Tomorrow',
        subtext: `Target: ${estimatedCompletionDate}`,
        color: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800',
        badgeBg: 'bg-blue-600 text-white',
        isOverdue: false,
        isToday: false,
        urgencyScore: 50
      };
    } else {
      return {
        status: 'UPCOMING' as const,
        label: `📆 Promised in ${diffDays} days`,
        subtext: `Target: ${estimatedCompletionDate}`,
        color: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800',
        badgeBg: 'bg-slate-700 text-slate-200',
        isOverdue: false,
        isToday: false,
        urgencyScore: 10
      };
    }
  };

  // Filter Active Jobs (not delivered or closed)
  const activeJobCards = jobCards.filter(c => c.status !== 'DELIVERED' && c.status !== 'CLOSED');

  // Calculate Metrics
  const totalActiveCount = activeJobCards.length;
  
  const overdueCards = activeJobCards.filter(c => {
    const info = getDeadlineInfo(c.estimatedCompletionDate);
    return info.isOverdue;
  });

  const dueTodayCards = activeJobCards.filter(c => {
    const info = getDeadlineInfo(c.estimatedCompletionDate);
    return info.isToday;
  });

  const urgentDeadlineCount = overdueCards.length + dueTodayCards.length;

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
    const deadlineInfo = getDeadlineInfo(card.estimatedCompletionDate);
    if (deadlineFilter === 'URGENT_DEADLINE' && !deadlineInfo.isOverdue && !deadlineInfo.isToday) return false;
    if (deadlineFilter === 'OVERDUE' && !deadlineInfo.isOverdue) return false;
    if (deadlineFilter === 'DELIVERY_TODAY' && !deadlineInfo.isToday) return false;
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
      const aInfo = getDeadlineInfo(a.estimatedCompletionDate);
      const bInfo = getDeadlineInfo(b.estimatedCompletionDate);
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
    updateJobCardTask(jobCardId, taskId, {
      status: newStatus,
      completedAt: newStatus === 'COMPLETED' ? new Date().toISOString() : undefined
    });
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
            {onOpenNewJobCardModal && (
              <button
                type="button"
                onClick={onOpenNewJobCardModal}
                className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all active:scale-95"
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
            <span className="text-[10px] text-indigo-300 font-mono">Auto-saved for today</span>
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
                onClick={() => setHuddleNotes(prev => (prev ? `${prev} | ` : '') + '🔴 Focus on Delivery Today')}
                className="px-2.5 py-1 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[10px] font-bold shrink-0 transition-all"
              >
                + Focus Delivery
              </button>
              <button
                type="button"
                onClick={() => setHuddleNotes(prev => (prev ? `${prev} | ` : '') + '🟡 Body Shop Paint Target')}
                className="px-2.5 py-1 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-[10px] font-bold shrink-0 transition-all"
              >
                + Paint Target
              </button>
              <button
                type="button"
                onClick={() => setHuddleNotes(prev => (prev ? `${prev} | ` : '') + '⚠️ Clear Unassigned Tasks')}
                className="px-2.5 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-bold shrink-0 transition-all"
              >
                + Unassigned
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        
        {/* Total Active Jobs */}
        <div 
          onClick={() => { setDeadlineFilter('ALL'); setSelectedDepartment('ALL'); }}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            deadlineFilter === 'ALL' && selectedDepartment === 'ALL'
              ? 'bg-slate-900 text-white border-slate-700 shadow-md ring-2 ring-blue-500/50'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider">Active Shop Floor</span>
            <FileText className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {totalActiveCount}
            <span className="text-xs font-normal text-slate-500 ml-1">cars</span>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
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
            <span className={`text-[11px] font-extrabold uppercase tracking-wider ${deadlineFilter === 'DELIVERY_TODAY' ? 'text-slate-950' : 'text-amber-700 dark:text-amber-300'}`}>
              Promised Today
            </span>
            <Clock className={`w-4 h-4 ${deadlineFilter === 'DELIVERY_TODAY' ? 'text-slate-950' : 'text-amber-600 dark:text-amber-400'}`} />
          </div>
          <div className={`text-2xl font-black ${deadlineFilter === 'DELIVERY_TODAY' ? 'text-slate-950' : 'text-amber-900 dark:text-amber-100'}`}>
            {dueTodayCards.length}
            <span className="text-xs font-normal ml-1">due today</span>
          </div>
          <p className={`text-[10px] mt-1 font-medium ${deadlineFilter === 'DELIVERY_TODAY' ? 'text-slate-900' : 'text-amber-800/80 dark:text-amber-300/80'}`}>
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
            <span className={`text-[11px] font-extrabold uppercase tracking-wider ${deadlineFilter === 'OVERDUE' ? 'text-white' : overdueCards.length > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-500'}`}>
              Overdue Deadlines
            </span>
            <AlertTriangle className={`w-4 h-4 ${deadlineFilter === 'OVERDUE' ? 'text-white' : overdueCards.length > 0 ? 'text-rose-600 dark:text-rose-400 animate-bounce' : 'text-slate-400'}`} />
          </div>
          <div className={`text-2xl font-black ${deadlineFilter === 'OVERDUE' ? 'text-white' : overdueCards.length > 0 ? 'text-rose-900 dark:text-rose-200' : 'text-slate-900 dark:text-white'}`}>
            {overdueCards.length}
            <span className="text-xs font-normal ml-1">delayed</span>
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
            <span className="text-xs font-normal ml-1">cards</span>
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
            <span className="text-xs font-normal ml-1">ready</span>
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
            const deadlineInfo = getDeadlineInfo(card.estimatedCompletionDate);
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
                  deadlineInfo.isOverdue 
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

                        {card.isCars24 && (
                          <span className="bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                            ⚡ Cars24 Fleet
                          </span>
                        )}

                        <span className="text-xs font-mono font-bold text-slate-500 bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                          {card.id}
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

                  {/* Right: Deadline Badge & Overall Progress */}
                  <div className="flex items-center gap-4 shrink-0 flex-wrap lg:flex-nowrap justify-between lg:justify-end">
                    
                    {/* Deadline Highlight Badge */}
                    <div className={`px-4 py-2 rounded-2xl border flex flex-col items-end ${deadlineInfo.color}`}>
                      <span className="text-xs font-black tracking-tight flex items-center gap-1">
                        {deadlineInfo.label}
                      </span>
                      <span className="text-[10px] font-medium opacity-80 mt-0.5">
                        {deadlineInfo.subtext}
                      </span>
                    </div>

                    {/* Overall Task Progress Bar */}
                    <div className="w-36 space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-slate-500">Task Progress</span>
                        <span className="text-slate-900 dark:text-slate-100">{completedTasks}/{totalTasks} ({progressPercent}%)</span>
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
                      className="px-4 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs shrink-0"
                    >
                      <span>View Card</span>
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

                  {/* Task Items Table Grid for Huddle Review */}
                  <div className="bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="p-3 bg-slate-100/80 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black text-slate-500 uppercase tracking-wider grid grid-cols-12 gap-2">
                      <span className="col-span-4">Service Task</span>
                      <span className="col-span-2">Department</span>
                      <span className="col-span-3">Assigned Staff / Vendor</span>
                      <span className="col-span-3 text-right">Huddle Status Toggle</span>
                    </div>

                    <div className="divide-y divide-slate-200 dark:divide-slate-800/60 text-xs">
                      {card.tasks.map(task => {
                        return (
                          <div key={task.id} className="p-3 grid grid-cols-12 gap-2 items-center hover:bg-white dark:hover:bg-slate-900/40 transition-colors">
                            
                            {/* Task Title */}
                            <div className="col-span-4 font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${
                                task.status === 'COMPLETED' ? 'bg-emerald-500' : task.status === 'IN_PROGRESS' ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'
                              }`} />
                              <span className="truncate" title={task.title}>{task.title}</span>
                            </div>

                            {/* Department */}
                            <div className="col-span-2 font-semibold text-slate-500 dark:text-slate-400 text-[11px]">
                              {task.category}
                            </div>

                            {/* Staff Allotted */}
                            <div className="col-span-3">
                              {task.assignedToName ? (
                                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                                  <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                                  <span className="truncate">{task.assignedToName}</span>
                                </span>
                              ) : (
                                <span className="text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md text-[11px] border border-amber-200 dark:border-amber-800 flex items-center gap-1 w-fit">
                                  ⚠️ Unassigned
                                </span>
                              )}
                            </div>

                            {/* Status Controls */}
                            <div className="col-span-3 flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleQuickTaskStatus(card.id, task.id, 'PENDING')}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                  task.status === 'PENDING'
                                    ? 'bg-slate-700 text-white border-slate-700'
                                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-400'
                                }`}
                              >
                                Pending
                              </button>

                              <button
                                type="button"
                                onClick={() => handleQuickTaskStatus(card.id, task.id, 'IN_PROGRESS')}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                  task.status === 'IN_PROGRESS'
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-400'
                                }`}
                              >
                                In Progress
                              </button>

                              <button
                                type="button"
                                onClick={() => handleQuickTaskStatus(card.id, task.id, 'COMPLETED')}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1 ${
                                  task.status === 'COMPLETED'
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-400'
                                }`}
                              >
                                <Check className="w-3 h-3" /> Done
                              </button>
                            </div>

                          </div>
                        );
                      })}
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
