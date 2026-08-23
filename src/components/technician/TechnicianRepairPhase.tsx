import React, { useState } from 'react';
import { JobCard, Employee, Vendor, UserRole, JobTask } from '../../types';
import { TechnicianTaskCard } from '../TechnicianTaskCard';
import { 
  Play, 
  CheckCircle2, 
  PackagePlus, 
  AlertTriangle, 
  Camera, 
  Plus, 
  Sparkles, 
  ChevronRight, 
  ChevronLeft,
  ShieldCheck,
  Zap,
  Wrench,
  Clock
} from 'lucide-react';
import { updateTaskStatus, dispatchToastNotification } from '../../lib/storage';

interface TechnicianRepairPhaseProps {
  card: JobCard;
  employees: Employee[];
  vendors: Vendor[];
  currentRole: UserRole;
  onRequestParts: () => void;
  onAddNewTask: () => void;
  onOpenStandardCatalog: () => void;
  onProceedToQC: () => void;
  onBackToInspection: () => void;
}

export function TechnicianRepairPhase({
  card,
  employees,
  vendors,
  currentRole,
  onRequestParts,
  onAddNewTask,
  onOpenStandardCatalog,
  onProceedToQC,
  onBackToInspection
}: TechnicianRepairPhaseProps) {
  // Task Filter
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE_PENDING' | 'COMPLETED' | 'MY_TASKS'>('ALL');
  const [showIssueReport, setShowIssueReport] = useState(false);
  const [selectedIssueReason, setSelectedIssueReason] = useState<string | null>(null);

  const completedCount = card.tasks.filter(t => t.status === 'COMPLETED').length;
  const inProgressCount = card.tasks.filter(t => t.status === 'IN_PROGRESS').length;
  const pendingCount = card.tasks.filter(t => t.status === 'PENDING').length;
  const totalCount = card.tasks.length;
  const progressPct = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;
  const isAllCompleted = totalCount > 0 && completedCount === totalCount;

  // Filter tasks
  const filteredTasks = card.tasks.filter(t => {
    if (filter === 'ACTIVE_PENDING') return t.status === 'PENDING' || t.status === 'IN_PROGRESS';
    if (filter === 'COMPLETED') return t.status === 'COMPLETED';
    if (filter === 'MY_TASKS') {
      return t.assignedToName?.toLowerCase().includes(currentRole.toLowerCase()) || 
             t.assignedToId === currentRole;
    }
    return true;
  });

  // Action: Start All Pending Tasks in one tap
  const handleStartAllPending = () => {
    card.tasks.forEach(t => {
      if (t.status === 'PENDING') {
        updateTaskStatus(card.id, t.id, 'IN_PROGRESS');
      }
    });
    dispatchToastNotification({
      type: 'JOB_CARD_CREATED',
      title: 'काम शुरू किया गया',
      message: `${card.vehicle.registrationNumber} के सभी काम चालू स्थिति में सेट किए गए।`,
      vehicleReg: card.vehicle.registrationNumber,
      jobCardId: card.id
    });
  };

  // Action: Mark All In-Progress Tasks Completed in one tap
  const handleMarkAllCompleted = () => {
    card.tasks.forEach(t => {
      if (t.status !== 'COMPLETED') {
        updateTaskStatus(card.id, t.id, 'COMPLETED');
      }
    });
    dispatchToastNotification({
      type: 'SUCCESS',
      title: 'सभी काम पूरे हुए',
      message: `${card.vehicle.registrationNumber} के सभी मरम्मत कार्य पूरे मार्क किए गए।`,
      vehicleReg: card.vehicle.registrationNumber,
      jobCardId: card.id
    });
  };

  // Action: Fast Delay / Concern Tagging
  const handleReportWorkshopIssue = (reason: string) => {
    setSelectedIssueReason(reason);
    setShowIssueReport(false);
    dispatchToastNotification({
      type: 'WARNING',
      title: '⚠️ रुकावट / समस्या दर्ज हुई',
      message: `${reason} - मैनेजर को सूचना भेज दी गई है।`,
      vehicleReg: card.vehicle.registrationNumber,
      jobCardId: card.id
    });
  };

  return (
    <div className="space-y-6">
      
      {/* 1. LARGE HIGH-CONTRAST ACTION HUB BUTTONS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        
        {/* Action 1: Start Work */}
        <button
          type="button"
          onClick={handleStartAllPending}
          disabled={pendingCount === 0}
          className={`p-3.5 sm:p-4 rounded-2xl font-black text-left flex flex-col justify-between gap-3 border transition-all duration-150 active:scale-95 shadow-md ${
            pendingCount > 0
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400 shadow-amber-500/25 ring-2 ring-amber-400/40'
              : 'bg-slate-800/60 text-slate-500 border-slate-800 opacity-60 cursor-not-allowed'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <div className="w-10 h-10 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center font-black shadow-inner">
              <Play className="w-5 h-5 fill-current ml-0.5" />
            </div>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-950/20 text-slate-950 font-mono">
              {pendingCount} Pending
            </span>
          </div>
          <div>
            <strong className="block text-sm sm:text-base leading-tight">▶️ सब काम शुरू करें</strong>
            <span className="text-[10px] sm:text-xs opacity-90 block mt-0.5">Start All Tasks</span>
          </div>
        </button>

        {/* Action 2: Completed / Mark Done */}
        <button
          type="button"
          onClick={handleMarkAllCompleted}
          disabled={isAllCompleted}
          className={`p-3.5 sm:p-4 rounded-2xl font-black text-left flex flex-col justify-between gap-3 border transition-all duration-150 active:scale-95 shadow-md ${
            !isAllCompleted
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-emerald-600/25 ring-2 ring-emerald-400/40'
              : 'bg-slate-800/60 text-slate-500 border-slate-800 opacity-60 cursor-not-allowed'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <div className="w-10 h-10 rounded-xl bg-emerald-950 text-emerald-300 flex items-center justify-center font-black shadow-inner">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-950/40 text-emerald-200 font-mono">
              {completedCount}/{totalCount} Done
            </span>
          </div>
          <div>
            <strong className="block text-sm sm:text-base leading-tight">✅ सब पूरा मार्क करें</strong>
            <span className="text-[10px] sm:text-xs opacity-90 block mt-0.5">Mark All Completed</span>
          </div>
        </button>

        {/* Action 3: Request Parts Requisition */}
        <button
          type="button"
          onClick={onRequestParts}
          className="p-3.5 sm:p-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white border border-blue-400 font-black text-left flex flex-col justify-between gap-3 shadow-md shadow-blue-600/25 transition-all duration-150 active:scale-95 ring-2 ring-blue-400/30"
        >
          <div className="flex items-center justify-between w-full">
            <div className="w-10 h-10 rounded-xl bg-blue-950 text-blue-300 flex items-center justify-center font-black shadow-inner">
              <PackagePlus className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-950/40 text-blue-200 font-mono">
              + Store Issue
            </span>
          </div>
          <div>
            <strong className="block text-sm sm:text-base leading-tight">📦 नया सामान मंगाएं</strong>
            <span className="text-[10px] sm:text-xs opacity-90 block mt-0.5">Request Spare Parts</span>
          </div>
        </button>

        {/* Action 4: Report Delay / Issue */}
        <button
          type="button"
          onClick={() => setShowIssueReport(prev => !prev)}
          className="p-3.5 sm:p-4 rounded-2xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/50 font-black text-left flex flex-col justify-between gap-3 shadow-md transition-all duration-150 active:scale-95"
        >
          <div className="flex items-center justify-between w-full">
            <div className="w-10 h-10 rounded-xl bg-rose-950 text-rose-300 flex items-center justify-center font-black">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-950/40 text-rose-300 font-mono">
              Help
            </span>
          </div>
          <div>
            <strong className="block text-sm sm:text-base leading-tight">⚠️ समस्या / देरी दर्ज करें</strong>
            <span className="text-[10px] sm:text-xs opacity-90 block mt-0.5">Report Shop Delay</span>
          </div>
        </button>

      </div>

      {/* Quick Problem Report Drawer */}
      {showIssueReport && (
        <div className="p-4 rounded-3xl bg-slate-900 border-2 border-rose-500/40 space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h4 className="font-black text-xs sm:text-sm text-rose-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              <span>काम में क्या अड़चन है? (Select Workshop Issue):</span>
            </h4>
            <button
              type="button"
              onClick={() => setShowIssueReport(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              ✕ बंद करें
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {[
              'लिफ्ट खाली होने का इंतजार',
              'पार्ट्स स्टोर में नहीं मिला',
              'बोल्ट / नट जाम है (Heated bolt)',
              'पेंट बूथ क्योरिंग चल रही है',
              'कस्टमर अप्रूवल रुका हुआ है',
              'वायरिंग / ईसीयू फॉल्ट मिला',
              'सस्पेंशन बुश कटा हुआ है',
              'अन्य तकनीकी समस्या'
            ].map(reason => (
              <button
                key={reason}
                type="button"
                onClick={() => handleReportWorkshopIssue(reason)}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-rose-500 hover:text-white text-slate-200 border border-slate-700 text-left font-bold transition-all text-xs"
              >
                ⚠️ {reason}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 2. TASK FILTER CHIPS & PROGRESS GAUGE */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800">
        
        {/* Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'ALL', label: `📋 सब काम (${totalCount})` },
            { id: 'ACTIVE_PENDING', label: `⏳ चालू व बाकी (${pendingCount + inProgressCount})` },
            { id: 'COMPLETED', label: `✅ पूरे (${completedCount})` },
            { id: 'MY_TASKS', label: `🔧 मेरे काम` }
          ].map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all border ${
                filter === f.id
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Quick Add Custom or Standard Task */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={onOpenStandardCatalog}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-bold text-xs flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5 fill-amber-300" />
            <span>स्टैंडर्ड जॉब्स</span>
          </button>

          <button
            type="button"
            onClick={onAddNewTask}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>+ नया काम</span>
          </button>
        </div>

      </div>

      {/* 3. LIST OF HIGH-CONTRAST TECHNICIAN TASK CARDS */}
      {filteredTasks.length === 0 ? (
        <div className="p-10 text-center bg-slate-900/60 rounded-3xl border border-slate-800 space-y-3">
          <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
          <h4 className="font-black text-white text-base">
            इस फ़िल्टर में कोई कार्य बाकी नहीं है!
          </h4>
          <p className="text-xs text-slate-400">
            ऊपर &quot;📋 सब काम (All)&quot; फ़िल्टर दबाकर पूरे कार्य देख सकते हैं।
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTasks.map((task) => (
            <TechnicianTaskCard
              key={task.id}
              card={card}
              task={task}
              employees={employees}
              vendors={vendors}
              currentRole={currentRole}
            />
          ))}
        </div>
      )}

      {/* 4. STEPPER BOTTOM NAVIGATION: BACK OR PROCEED TO QC */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border-2 border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        
        <button
          type="button"
          onClick={onBackToInspection}
          className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-2 w-full sm:w-auto justify-center"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>⬅️ 1. जांच रिपोर्ट पर वापस जाएं</span>
        </button>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={onProceedToQC}
            className={`px-6 py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all w-full sm:w-auto active:scale-95 shadow-xl ${
              isAllCompleted
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30 ring-2 ring-emerald-400'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/30'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>
              {isAllCompleted
                ? '🛡️ सब काम पूरा हुआ - क्वालिटी चेक खोलें ➔'
                : '3. क्वालिटी चेक (QC Phase) पर जाएं ➔'}
            </span>
          </button>
        </div>

      </div>

    </div>
  );
}
