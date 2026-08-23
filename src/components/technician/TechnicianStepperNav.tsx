import React, { useState } from 'react';
import { 
  ClipboardCheck, 
  Boxes, 
  Wrench, 
  ShieldCheck, 
  CheckCircle2,
  Volume2,
  VolumeX,
  Sparkles,
  Check,
  Clock,
  Car,
  Package,
  ArrowRight,
  Activity,
  Zap
} from 'lucide-react';
import { speakTechnicianPrompt, stopTechnicianSpeech } from '../../lib/technicianVoiceHelper';

export type TechnicianRepairPhase = 'ASSESSMENT' | 'PARTS_REQUEST' | 'REPAIR' | 'QC';

interface TechnicianStepperNavProps {
  currentPhase: TechnicianRepairPhase;
  onPhaseChange: (phase: TechnicianRepairPhase) => void;
  completedTasksCount: number;
  totalTasksCount: number;
  requisitionsCount: number;
  qcPassed: boolean;
  isDelivered: boolean;
  vehicleReg?: string;
  vehicleMakeModel?: string;
  isCars24?: boolean;
}

export function TechnicianStepperNav({
  currentPhase,
  onPhaseChange,
  completedTasksCount,
  totalTasksCount,
  requisitionsCount,
  qcPassed,
  isDelivered,
  vehicleReg,
  vehicleMakeModel,
  isCars24
}: TechnicianStepperNavProps) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const percentage = totalTasksCount > 0 
    ? Math.round((completedTasksCount / totalTasksCount) * 100) 
    : 0;

  const remainingTasksCount = Math.max(0, totalTasksCount - completedTasksCount);
  const isRepairDone = totalTasksCount > 0 && completedTasksCount === totalTasksCount;

  // SVG Gauge Math (Radius = 54, Circumference ≈ 339.292)
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // High-Contrast Color Theme based on completion percentage
  const gaugeTheme = (() => {
    if (percentage === 100) {
      return {
        strokeStart: '#10b981', // Emerald 500
        strokeEnd: '#34d399',   // Emerald 400
        glowColor: '#10b981',
        textColor: 'text-emerald-400',
        borderColor: 'border-emerald-500/40',
        bgAccent: 'bg-emerald-500/10',
        badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        badgeText: '✓ 100% COMPLETE',
        titleHi: 'सभी कार्य पूरे हो चुके हैं! 🎉',
        descHi: 'गाड़ी अंतिम क्वालिटी चेक (QC) व हैंडओवर के लिए तैयार है।'
      };
    }
    if (percentage >= 70) {
      return {
        strokeStart: '#06b6d4', // Cyan 500
        strokeEnd: '#38bdf8',   // Sky 400
        glowColor: '#06b6d4',
        textColor: 'text-cyan-400',
        borderColor: 'border-cyan-500/40',
        bgAccent: 'bg-cyan-500/10',
        badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
        badgeText: '⚡ अंतिम चरण (FINAL STAGE)',
        titleHi: 'मरम्मत लगभग पूरी होने वाली है',
        descHi: `${completedTasksCount} में से ${totalTasksCount} काम पूरे हो चुके हैं।`
      };
    }
    if (percentage >= 40) {
      return {
        strokeStart: '#f59e0b', // Amber 500
        strokeEnd: '#fbbf24',   // Amber 400
        glowColor: '#f59e0b',
        textColor: 'text-amber-400',
        borderColor: 'border-amber-500/40',
        bgAccent: 'bg-amber-500/10',
        badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        badgeText: '⚡ प्रगति पर (IN PROGRESS)',
        titleHi: 'मरम्मत कार्य तेजी से जारी है',
        descHi: `कुल ${remainingTasksCount} काम अभी बाकी हैं।`
      };
    }
    if (percentage > 0) {
      return {
        strokeStart: '#f97316', // Orange 500
        strokeEnd: '#fb923c',   // Orange 400
        glowColor: '#f97316',
        textColor: 'text-orange-400',
        borderColor: 'border-orange-500/40',
        bgAccent: 'bg-orange-500/10',
        badgeBg: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
        badgeText: '🔧 शुरुआती चरण (STARTED)',
        titleHi: 'काम शुरू हो चुका है',
        descHi: `प्रारंभिक कार्य प्रगति पर है, कुल ${totalTasksCount} काम तय हैं।`
      };
    }
    return {
      strokeStart: '#64748b', // Slate 500
      strokeEnd: '#94a3b8',   // Slate 400
      glowColor: '#64748b',
      textColor: 'text-slate-400',
      borderColor: 'border-slate-700/60',
      bgAccent: 'bg-slate-900/60',
      badgeBg: 'bg-slate-800 text-slate-400 border-slate-700',
      badgeText: '⏳ अभी शुरू नहीं हुआ (PENDING)',
      titleHi: 'काम शुरू करने की प्रतीक्षा',
      descHi: 'पैनल जांच या पार्ट्स मांग के बाद कार्य शुरू करें।'
    };
  })();

  const handleVoiceProgressReadout = () => {
    if (isPlayingAudio) {
      stopTechnicianSpeech();
      setIsPlayingAudio(false);
      return;
    }

    const reg = vehicleReg || 'गाड़ी';
    const speech = `तकनीशियन प्रगति रिपोर्ट. गाड़ी नंबर ${reg}. कुल ${totalTasksCount} कार्यों में से ${completedTasksCount} कार्य पूरे हो चुके हैं, यानी कार्य की प्रगति ${percentage} प्रतिशत है. ${
      percentage === 100
        ? 'सभी कार्य पूरे हो चुके हैं, कृपया क्वालिटी चेक की प्रक्रिया पूरी करें.'
        : `${remainingTasksCount} काम अभी बाकी हैं.`
    }`;

    setIsPlayingAudio(true);
    speakTechnicianPrompt(speech, () => {
      setIsPlayingAudio(false);
    });
  };

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
      id: 'ASSESSMENT',
      stepNumber: 1,
      titleHi: '1. जांच व पैनल',
      titleEn: 'Assessment',
      icon: ClipboardCheck,
      isCompleted: isRepairDone || completedTasksCount > 0,
      isActive: currentPhase === 'ASSESSMENT',
      badge: 'Visual AR'
    },
    {
      id: 'PARTS_REQUEST',
      stepNumber: 2,
      titleHi: '2. पार्ट्स मांग',
      titleEn: 'Parts Request',
      icon: Boxes,
      isCompleted: requisitionsCount > 0,
      isActive: currentPhase === 'PARTS_REQUEST',
      badge: requisitionsCount > 0 ? `${requisitionsCount} Items` : 'Store'
    },
    {
      id: 'REPAIR',
      stepNumber: 3,
      titleHi: '3. मरम्मत व कार्य',
      titleEn: 'Repair Tasks',
      icon: Wrench,
      isCompleted: isRepairDone,
      isActive: currentPhase === 'REPAIR',
      badge: `${completedTasksCount}/${totalTasksCount}`
    },
    {
      id: 'QC',
      stepNumber: 4,
      titleHi: '4. क्वालिटी व गेट पास',
      titleEn: 'QC & Handover',
      icon: ShieldCheck,
      isCompleted: Boolean(qcPassed || isDelivered),
      isActive: currentPhase === 'QC',
      badge: isDelivered ? '✓ Delivered' : qcPassed ? '✓ Passed' : 'Pending'
    }
  ];

  return (
    <div className="bg-slate-900 border-b border-slate-800 shrink-0 flex flex-col">
      
      {/* =========================================================================
          LARGE CIRCULAR COLOR-CODED PROGRESS GAUGE (Top High-Contrast Header)
         ========================================================================= */}
      <div className={`p-3.5 sm:p-4 md:p-5 bg-slate-950/90 border-b border-slate-800 transition-colors ${gaugeTheme.bgAccent}`}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6">
          
          {/* Left: Big Circular Progress Gauge + Center Stat */}
          <div className="flex items-center gap-4 sm:gap-5 w-full md:w-auto">
            
            {/* SVG Circular Dial */}
            <div className="relative shrink-0 w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 flex items-center justify-center select-none">
              <svg 
                className="w-full h-full transform -rotate-90 drop-shadow-xl" 
                viewBox="0 0 140 140"
              >
                <defs>
                  {/* Dynamic Color Gradient */}
                  <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={gaugeTheme.strokeStart} />
                    <stop offset="100%" stopColor={gaugeTheme.strokeEnd} />
                  </linearGradient>

                  {/* High-Contrast Neon Glow Filter */}
                  <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow 
                      dx="0" 
                      dy="0" 
                      stdDeviation="3.5" 
                      floodColor={gaugeTheme.glowColor} 
                      floodOpacity="0.85" 
                    />
                  </filter>
                </defs>

                {/* Track Circle (Muted Dark Background) */}
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  className="stroke-slate-800/90"
                  strokeWidth="11"
                  fill="transparent"
                />

                {/* Inner Accent Ring */}
                <circle
                  cx="70"
                  cy="70"
                  r="44"
                  className="stroke-slate-900/80"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                  fill="transparent"
                />

                {/* Active Progress Circle */}
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  stroke="url(#gaugeGradient)"
                  strokeWidth="11"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  filter="url(#gaugeGlow)"
                  className="transition-all duration-700 ease-out"
                />
              </svg>

              {/* Center Typography Inside Gauge */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className={`font-black font-mono tracking-tighter text-xl sm:text-2xl md:text-3xl leading-none ${gaugeTheme.textColor}`}>
                  {percentage}%
                </span>
                <span className="text-[9px] sm:text-[10px] font-black text-slate-400 tracking-wider uppercase mt-0.5">
                  {completedTasksCount}/{totalTasksCount} DONE
                </span>
              </div>
            </div>

            {/* Gauge Context & Vehicle Details */}
            <div className="space-y-1 sm:space-y-1.5 grow min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wide border shadow-xs ${gaugeTheme.badgeBg}`}>
                  {gaugeTheme.badgeText}
                </span>

                {isCars24 && (
                  <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/40 text-[10px] font-black uppercase">
                    Cars24 SLA
                  </span>
                )}
              </div>

              <h3 className="text-sm sm:text-base md:text-lg font-black text-white flex items-center gap-2">
                <span>{gaugeTheme.titleHi}</span>
              </h3>

              <p className="text-xs text-slate-300/90 leading-tight">
                {gaugeTheme.descHi}
              </p>

              {(vehicleReg || vehicleMakeModel) && (
                <div className="flex items-center gap-2 text-xs font-mono text-slate-400 pt-0.5">
                  {vehicleReg && (
                    <span className="font-bold text-amber-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                      🚗 {vehicleReg}
                    </span>
                  )}
                  {vehicleMakeModel && (
                    <span className="truncate text-slate-300">
                      {vehicleMakeModel}
                    </span>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Right: Tactile Quick Metrics & Vernacular Voice Button */}
          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 sm:gap-3 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
            
            {/* Metric: Completed Tasks */}
            <div className="px-3 py-2 rounded-2xl bg-slate-900 border border-slate-800 text-center min-w-[76px] grow sm:grow-0">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                पूर्ण (Done)
              </div>
              <div className="text-base sm:text-lg font-black text-emerald-400 font-mono">
                {completedTasksCount}
              </div>
            </div>

            {/* Metric: Remaining Tasks */}
            <div className="px-3 py-2 rounded-2xl bg-slate-900 border border-slate-800 text-center min-w-[76px] grow sm:grow-0">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                बाकी (Pending)
              </div>
              <div className="text-base sm:text-lg font-black text-amber-400 font-mono">
                {remainingTasksCount}
              </div>
            </div>

            {/* Metric: Parts Requisitions */}
            <div className="px-3 py-2 rounded-2xl bg-slate-900 border border-slate-800 text-center min-w-[76px] grow sm:grow-0">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                पार्ट्स (Parts)
              </div>
              <div className="text-base sm:text-lg font-black text-cyan-400 font-mono">
                {requisitionsCount}
              </div>
            </div>

            {/* Voice Audio Readout Button for Technicians */}
            <button
              type="button"
              onClick={handleVoiceProgressReadout}
              className={`px-3 py-2.5 rounded-2xl border flex items-center justify-center gap-1.5 text-xs font-black transition-all active:scale-95 grow sm:grow-0 ${
                isPlayingAudio
                  ? 'bg-rose-600 text-white border-rose-400 animate-pulse shadow-lg shadow-rose-600/30'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
              }`}
              title="तकनीशियन प्रगति बोलकर सुनें"
            >
              {isPlayingAudio ? (
                <>
                  <VolumeX className="w-4 h-4 shrink-0" />
                  <span>रोकें (Stop)</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 shrink-0" />
                  <span>🔊 बोलकर सुनें</span>
                </>
              )}
            </button>

          </div>

        </div>
      </div>

      {/* =========================================================================
          4-PHASE TACTILE STEPPER BUTTONS
         ========================================================================= */}
      <div className="p-2 sm:p-3">
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
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-sm transition-colors ${
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
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                    )}
                  </div>

                  <div className="truncate">
                    <div className="flex items-center gap-1.5 leading-none">
                      <span className="font-extrabold text-xs sm:text-sm truncate">
                        {step.titleHi}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] sm:text-xs font-semibold block truncate mt-0.5 ${
                        step.isActive ? 'text-slate-950 font-bold' : 'text-slate-400'
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

    </div>
  );
}
