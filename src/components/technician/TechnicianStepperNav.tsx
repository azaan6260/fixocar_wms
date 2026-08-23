import React, { useState } from 'react';
import { 
  ClipboardCheck, 
  Wrench, 
  ShieldCheck, 
  Truck, 
  CheckCircle2,
  Volume2,
  VolumeX,
  Sparkles
} from 'lucide-react';

export type TechnicianRepairPhase = 'INSPECTION' | 'ACTIVE_REPAIR' | 'QUALITY_CHECK' | 'DISPATCH_HANDOVER';

interface TechnicianStepperNavProps {
  currentPhase: TechnicianRepairPhase;
  onPhaseChange: (phase: TechnicianRepairPhase) => void;
  completedTasksCount: number;
  totalTasksCount: number;
  qcPassed: boolean;
  isDelivered: boolean;
}

export function TechnicianStepperNav({
  currentPhase,
  onPhaseChange,
  completedTasksCount,
  totalTasksCount,
  qcPassed,
  isDelivered
}: TechnicianStepperNavProps) {
  const isRepairDone = totalTasksCount > 0 && completedTasksCount === totalTasksCount;

  const steps: {
    id: TechnicianRepairPhase;
    stepNumber: number;
    titleHi: string;
    titleEn: string;
    icon: any;
    isCompleted: boolean;
    isActive: boolean;
    badge?: string;
  }[] = [
    {
      id: 'INSPECTION',
      stepNumber: 1,
      titleHi: '1. जांच व पैनल',
      titleEn: 'Inspection & Body',
      icon: ClipboardCheck,
      isCompleted: isRepairDone || completedTasksCount > 0,
      isActive: currentPhase === 'INSPECTION',
      badge: 'Visual AR'
    },
    {
      id: 'ACTIVE_REPAIR',
      stepNumber: 2,
      titleHi: '2. काम व पार्ट्स',
      titleEn: 'Repair & Parts',
      icon: Wrench,
      isCompleted: isRepairDone,
      isActive: currentPhase === 'ACTIVE_REPAIR',
      badge: `${completedTasksCount}/${totalTasksCount}`
    },
    {
      id: 'QUALITY_CHECK',
      stepNumber: 3,
      titleHi: '3. क्वालिटी जांच',
      titleEn: 'QC & Photo Proof',
      icon: ShieldCheck,
      isCompleted: Boolean(qcPassed),
      isActive: currentPhase === 'QUALITY_CHECK',
      badge: qcPassed ? '✓ Passed' : 'Pending'
    },
    {
      id: 'DISPATCH_HANDOVER',
      stepNumber: 4,
      titleHi: '4. डिलीवरी व बिल',
      titleEn: 'Handover & Gate Pass',
      icon: Truck,
      isCompleted: Boolean(isDelivered),
      isActive: currentPhase === 'DISPATCH_HANDOVER',
      badge: isDelivered ? '✓ Delivered' : 'Gate Pass'
    }
  ];

  return (
    <div className="bg-slate-900 border-b border-slate-800 p-2 sm:p-3 shrink-0">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onPhaseChange(step.id)}
              className={`p-2.5 sm:p-3 rounded-2xl text-left transition-all duration-200 flex items-center justify-between gap-2 border relative overflow-hidden group active:scale-95 ${
                step.isActive
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/25 ring-2 ring-amber-400'
                  : step.isCompleted
                  ? 'bg-slate-800/90 text-slate-200 border-emerald-500/50 hover:bg-slate-800'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-black text-sm transition-colors ${
                    step.isActive
                      ? 'bg-slate-950 text-amber-400 shadow-inner'
                      : step.isCompleted
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {step.isCompleted && !step.isActive ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>

                <div className="truncate">
                  <div className="flex items-center gap-1.5 leading-none">
                    <span className="font-extrabold text-xs truncate">
                      {step.titleHi}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-medium block truncate mt-0.5 ${
                      step.isActive ? 'text-slate-900' : 'text-slate-400'
                    }`}
                  >
                    {step.titleEn}
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              {step.badge && (
                <span
                  className={`hidden sm:inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 border ${
                    step.isActive
                      ? 'bg-slate-950 text-amber-400 border-slate-950'
                      : step.isCompleted
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {step.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
