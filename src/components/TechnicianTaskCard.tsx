import React, { useState, useRef, useEffect } from 'react';
import { JobCard, JobTask, Employee, Vendor, UserRole, TaskStatus } from '../types';
import { 
  updateTaskStatus, 
  addRequisitionToTask, 
  addConcernToTask,
  dispatchToastNotification,
  getAuthUser
} from '../lib/storage';
import { ProofOfWorkModal } from './ProofOfWorkModal';
import { RequestAdditionalWorkModal } from './RequestAdditionalWorkModal';
import { 
  getVernacularTaskInfo, 
  CATEGORY_HINDI_MAP, 
  speakTechnicianPrompt, 
  stopTechnicianSpeech 
} from '../lib/technicianVoiceHelper';
import { 
  CheckCircle2, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  PackagePlus, 
  AlertTriangle, 
  Camera, 
  Plus, 
  Minus, 
  Check, 
  X, 
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  FileText
} from 'lucide-react';

export interface TechnicianTaskCardProps {
  key?: React.Key;
  card: JobCard;
  task: JobTask;
  employees: Employee[];
  vendors: Vendor[];
  currentRole: UserRole;
  onStatusUpdated?: () => void;
}

// Quick common parts that workshop mechanics frequently need
const QUICK_COMMON_PARTS = [
  { name: 'Engine Oil (इंजन ऑयल)', icon: '🛢️', defaultQty: 3.5 },
  { name: 'Oil Filter (ऑयल फ़िल्टर)', icon: '🔧', defaultQty: 1 },
  { name: 'Brake Pads (ब्रेक पैड)', icon: '🛑', defaultQty: 1 },
  { name: 'Coolant (कूलेंट)', icon: '❄️', defaultQty: 1 },
  { name: 'Sandpaper 1000/2000 (रेगमाल)', icon: '📜', defaultQty: 2 },
  { name: 'Primer / Putty (पुट्टी / प्राइमर)', icon: '🎨', defaultQty: 1 },
  { name: 'Wiper Blades (वाइपर ब्लेड)', icon: '🌧️', defaultQty: 1 },
  { name: 'Fastener / Bolts (नट-बोल्ट सेट)', icon: '🔩', defaultQty: 1 }
];

// Quick 1-tap issue chips for technicians
const QUICK_ISSUES = [
  { text: 'Part Not In Stock (सामान स्टोर में नहीं है)', icon: '📦' },
  { text: 'Waiting for Lift / Bay (लिफ्ट खाली होने का इंतज़ार)', icon: '⏳' },
  { text: 'Bolt Jammed / Broken (बोल्ट जाम या टूटा हुआ है)', icon: '🔩' },
  { text: 'Need Electrician / Sublet (इलेक्ट्रीशियन की मदद चाहिए)', icon: '⚡' },
  { text: 'Need Manager Approval (मैनेजर से बात करनी है)', icon: '👔' }
];

export const TechnicianTaskCard = React.memo(function TechnicianTaskCard({
  card,
  task,
  employees,
  vendors,
  currentRole,
  onStatusUpdated
}: TechnicianTaskCardProps) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showPartReqModal, setShowPartReqModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showAddWorkModal, setShowAddWorkModal] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const actionsMenuRef = useRef<HTMLDivElement>(null);

  // Close actions menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
        setShowActionsMenu(false);
      }
    }
    if (showActionsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showActionsMenu]);

  // Quick Part Requisition State
  const [selectedPartName, setSelectedPartName] = useState(QUICK_COMMON_PARTS[0].name);
  const [customPartName, setCustomPartName] = useState('');
  const [partQty, setPartQty] = useState(1);
  const [isSubmittingReq, setIsSubmittingReq] = useState(false);

  // Quick Issue State
  const [selectedIssueText, setSelectedIssueText] = useState(QUICK_ISSUES[0].text);
  const [customIssueText, setCustomIssueText] = useState('');

  const vernacular = getVernacularTaskInfo(task.title, task.category);
  const catConfig = CATEGORY_HINDI_MAP[task.category] || CATEGORY_HINDI_MAP.MECHANICAL;

  // Status computation
  const isCompleted = task.status === 'COMPLETED';
  const isInProgress = task.status === 'IN_PROGRESS';
  const isOnHoldForApproval = task.status === 'ON_HOLD' || Boolean(task.isAdditionalWork && task.approvalStatus === 'PENDING');
  const isApprovedAdditionalWork = Boolean(task.isAdditionalWork && task.approvalStatus === 'APPROVED');
  const isPending = task.status === 'PENDING' && !isOnHoldForApproval;

  // Handle Voice Audio Playback
  const handleToggleSpeech = () => {
    if (isPlayingAudio) {
      stopTechnicianSpeech();
      setIsPlayingAudio(false);
      return;
    }

    const speechText = `गाड़ी नंबर ${card.vehicle.registrationNumber}. काम है: ${task.title}. ${vernacular.categoryLabelHindi}. स्टेटस है: ${
      isCompleted ? 'काम पूरा हो चुका है' : isInProgress ? 'काम चालू है' : 'काम शुरू करना बाकी है'
    }.`;

    setIsPlayingAudio(true);
    speakTechnicianPrompt(speechText, () => {
      setIsPlayingAudio(false);
    });
  };

  // Status updates
  const handleSetStatus = (newStatus: TaskStatus) => {
    updateTaskStatus(card.id, task.id, newStatus);
    
    // Voice audio confirmation for non-reading workers
    if (newStatus === 'IN_PROGRESS') {
      speakTechnicianPrompt(`काम शुरू कर दिया गया है: ${task.title}`);
    } else if (newStatus === 'COMPLETED') {
      speakTechnicianPrompt(`बधाई, काम पूरा हो गया है: ${task.title}`);
    }

    if (onStatusUpdated) onStatusUpdated();
  };

  // 1-Click Request Part
  const handleSubmitPartRequest = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingReq(true);

    const finalPartTitle = customPartName.trim() || selectedPartName;

    addRequisitionToTask(card.id, task.id, {
      requestedByEmployeeId: currentRole,
      requestedByEmployeeName: task.assignedToName || `${currentRole} Technician`,
      title: finalPartTitle,
      itemType: 'PART',
      quantity: Number(partQty) || 1,
      urgency: 'HIGH',
      reason: `Technician shop-floor request for ${card.vehicle.make} ${card.vehicle.model}`
    });

    speakTechnicianPrompt(`सामान का ऑर्डर भेज दिया गया है: ${finalPartTitle}`);

    setIsSubmittingReq(false);
    setShowPartReqModal(false);
    setCustomPartName('');
    setPartQty(1);
  };

  // 1-Click Raise Issue
  const handleSubmitIssue = (e: React.FormEvent) => {
    e.preventDefault();
    const finalIssue = customIssueText.trim() || selectedIssueText;

    addConcernToTask(card.id, task.id, {
      raisedByEmployeeId: currentRole,
      requestedByEmployeeName: task.assignedToName || 'Technician',
      issueDescription: finalIssue,
      urgency: 'HIGH'
    } as any);

    speakTechnicianPrompt(`समस्या मैनेजर को भेज दी गई है: ${finalIssue}`);

    dispatchToastNotification({
      type: 'JOB_CARD_CREATED',
      title: `⚠️ Issue Raised (समस्या दर्ज)`,
      message: `Manager alerted for ${card.vehicle.registrationNumber}: "${finalIssue}".`,
      vehicleReg: card.vehicle.registrationNumber,
      jobCardId: card.id
    });

    setShowIssueModal(false);
    setCustomIssueText('');
  };

  const currentSanctionedPayout = currentRole === 'PAINTER' 
    ? (task.painterPayout || 0)
    : currentRole === 'DENTER' 
    ? (task.denterPayout || 0)
    : (task.contractorPayout || task.painterPayout || task.denterPayout || 0);

  const proofCount = task.proofMedia ? task.proofMedia.length : 0;
  const partsAndReqsCount = (task.partsList?.length || 0) + (task.requisitions?.length || 0);
  const activeConcernsCount = task.concerns ? task.concerns.filter(c => c.status !== 'RESOLVED').length : 0;

  return (
    <div className={`rounded-2xl border-2 transition-all relative ${
      isCompleted 
        ? 'bg-emerald-500/5 dark:bg-emerald-950/20 border-emerald-500/40 shadow-xs' 
        : isInProgress
        ? 'bg-amber-500/10 dark:bg-amber-950/30 border-amber-500 ring-2 ring-amber-500/30 shadow-md'
        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
    }`}>
      
      <div className="p-3.5 sm:p-4 space-y-3">
        
        {/* ROW 1: JOB TEXT & CATEGORY ONLY (Vehicle details and repeated status removed as requested) */}
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-0.5">
              <h3 className="text-base sm:text-lg font-black text-slate-950 dark:text-white tracking-tight leading-snug">
                {task.title}
              </h3>
              {vernacular.hindiTitle !== task.title && (
                <p className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <span>{vernacular.icon}</span>
                  <span>{vernacular.hindiTitle}</span>
                </p>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Category Badge */}
              <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 border shadow-xs ${catConfig.bg} ${catConfig.text}`}>
                <span>{catConfig.emoji}</span>
                <span className="hidden sm:inline">{catConfig.label}</span>
              </span>

              {/* Quick Audio Speak Button */}
              <button
                type="button"
                onClick={handleToggleSpeech}
                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                  isPlayingAudio 
                    ? 'bg-rose-500 text-white border-rose-600 shadow-sm' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:text-amber-500'
                }`}
                title="Click to hear task read out loud in Hindi"
              >
                {isPlayingAudio ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Sub-tags: Body Panel, Paint Scope, Payout, Add-on */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {task.isAdditionalWork && (
              <span className="bg-orange-500 text-slate-950 text-[10.5px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                ⚡ नया काम (Add-on)
              </span>
            )}
            {task.panelNameEn && (
              <span className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300 font-bold text-[11px]">
                🚘 {task.panelNameEn}
              </span>
            )}
            {task.paintScope && (
              <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/30 text-purple-700 dark:text-purple-300 font-bold text-[11px]">
                {task.paintScope === 'PARTIAL_TOUCHUP' ? '🎨 Touch-Up' :
                 task.paintScope === 'INSIDE_JAMB' ? '🚪 Inside Jamb' : '✨ Full Paint'}
              </span>
            )}
            {currentSanctionedPayout > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-black text-[11px]">
                💰 Payout: ₹{currentSanctionedPayout.toLocaleString('en-IN')}
              </span>
            )}
            {proofCount > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-300 font-bold text-[11px] flex items-center gap-1">
                <Camera className="w-3 h-3" /> {proofCount} Photo{proofCount > 1 ? 's' : ''}
              </span>
            )}
            {activeConcernsCount > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-600 dark:text-rose-400 font-black text-[11px] flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {activeConcernsCount} Issue
              </span>
            )}
          </div>

          {/* Notes if any */}
          {task.notes && (
            <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 p-2 rounded-lg italic border-l-2 border-amber-500">
              "{task.notes}"
            </p>
          )}

          {/* Additional Work Status Banner: Awaiting Approval vs Approved to Proceed */}
          {isOnHoldForApproval && (
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-2">
              <span className="text-base">⏳</span>
              <div>
                <span className="block font-black">Awaiting Approval (स्वीकृति की प्रतीक्षा है)</span>
                <span className="text-[11px] opacity-90">
                  Manager reviewed & added this task. You will receive a sound notification once approved to proceed.
                </span>
              </div>
            </div>
          )}

          {isApprovedAdditionalWork && !isCompleted && (
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
              <span className="text-base">✅</span>
              <div>
                <span className="block font-black uppercase tracking-wide">
                  Additional Work Approved — Proceed with Repair! (काम शुरू करें)
                </span>
                <span className="text-[11px] opacity-90">
                  Approved & allotted by Manager. Click Start Work below to proceed.
                </span>
              </div>
            </div>
          )}

          {/* Attached Discovery Photo / Video on Additional Work Task */}
          {(task.additionalWorkPhotoUrl || task.additionalWorkVideoUrl) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {task.additionalWorkPhotoUrl && (
                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-950 h-28">
                  <img
                    src={task.additionalWorkPhotoUrl}
                    alt="Discovery photo"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              {task.additionalWorkVideoUrl && (
                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-950 h-28">
                  <video
                    src={task.additionalWorkVideoUrl}
                    controls
                    playsInline
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
          )}

          {/* Live Status of Additional Work Requests Raised on This Task */}
          {task.requisitions && task.requisitions.some(r => r.itemType === 'ADDITIONAL_WORK') && (
            <div className="space-y-1.5 pt-1">
              {task.requisitions
                .filter(r => r.itemType === 'ADDITIONAL_WORK')
                .map((req) => (
                  <div
                    key={req.id}
                    className={`p-2.5 rounded-xl border text-xs flex flex-col gap-1.5 ${
                      req.status === 'APPROVED'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
                        : req.status === 'REJECTED'
                        ? 'bg-rose-500/15 border-rose-500/40 text-rose-800 dark:text-rose-300'
                        : req.status === 'AWAITING_CUSTOMER_APPROVAL'
                        ? 'bg-purple-500/15 border-purple-500/40 text-purple-800 dark:text-purple-300'
                        : 'bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-black flex items-center gap-1.5">
                        <span>🔧 Extra Work Request: {req.title}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-black/15">
                        {req.status === 'APPROVED'
                          ? '✅ Approved — Proceed Now!'
                          : req.status === 'REJECTED'
                          ? '❌ Declined'
                          : req.status === 'AWAITING_CUSTOMER_APPROVAL'
                          ? '📋 Manager Added Tasks — Awaiting Approval'
                          : '⏳ Sent to Manager for Review'}
                      </span>
                    </div>
                    {(req.photoUrl || req.videoUrl) && (
                      <div className="flex items-center gap-2 pt-0.5">
                        {req.photoUrl && (
                          <img
                            src={req.photoUrl}
                            alt={req.title}
                            className="w-16 h-12 object-cover rounded-lg border border-black/20"
                          />
                        )}
                        {req.videoUrl && (
                          <video
                            src={req.videoUrl}
                            controls
                            playsInline
                            className="w-24 h-12 object-cover rounded-lg border border-black/20 bg-black"
                          />
                        )}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* ROW 2: START WORKING / COMPLETE / REOPEN BUTTON + EXTRA WORK + MORE ACTIONS BUTTON */}
        <div className="pt-0.5 flex items-center gap-2 flex-wrap sm:flex-nowrap">
          
          {/* ON HOLD FOR APPROVAL DISPLAY */}
          {isOnHoldForApproval && (
            <div className="grow py-2.5 px-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-black text-xs flex items-center justify-center gap-2">
              <span>🔒 Waiting for Approval to Proceed (स्वीकृति के बाद शुरू करें)</span>
            </div>
          )}

          {/* PRIMARY BUTTON 1: START (When Pending) */}
          {isPending && (
            <button
              type="button"
              onClick={() => handleSetStatus('IN_PROGRESS')}
              className="grow py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>काम शुरू करें (START WORK)</span>
            </button>
          )}

          {/* PRIMARY BUTTON 2: COMPLETE (When In Progress) */}
          {isInProgress && (
            <button
              type="button"
              onClick={() => handleSetStatus('COMPLETED')}
              className="grow py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-500 hover:from-emerald-400 hover:to-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
              <span>काम पूरा हो गया (COMPLETE)</span>
            </button>
          )}

          {/* PRIMARY DISPLAY 3: COMPLETED BANNER WITH REOPEN */}
          {isCompleted && (
            <div className="grow py-2.5 px-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-extrabold text-xs sm:text-sm flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 stroke-[3] text-emerald-500" />
                <span>काम पूरा हुआ (Done)</span>
              </span>
              <button
                type="button"
                onClick={() => handleSetStatus('IN_PROGRESS')}
                className="text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:text-amber-500 flex items-center gap-1 underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" /> दोबारा खोलें (Reopen)
              </button>
            </div>
          )}

          {/* 1-TAP RAISE ADDITIONAL WORK (PHOTO + VIDEO) BUTTON */}
          <button
            type="button"
            onClick={() => setShowAddWorkModal(true)}
            className="py-3 px-3 rounded-xl bg-orange-500/15 hover:bg-orange-500/25 text-orange-700 dark:text-orange-300 border border-orange-500/40 text-xs font-black flex items-center gap-1.5 shrink-0 transition-all cursor-pointer"
            title="Found extra issue after opening up? Upload Photo & Video for Manager Review"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Extra Work</span>
          </button>

          {/* SINGLE "MORE ACTIONS" BUTTON */}
          <div className="relative shrink-0" ref={actionsMenuRef}>
            <button
              type="button"
              onClick={() => setShowActionsMenu(prev => !prev)}
              className={`py-3 px-3.5 rounded-xl text-xs font-black flex items-center gap-1.5 border transition-all cursor-pointer ${
                showActionsMenu
                  ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700'
              }`}
              title="More Actions"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Actions</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showActionsMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* POPUP ACTION MENU */}
            {showActionsMenu && (
              <div className="absolute right-0 bottom-full mb-2 sm:bottom-auto sm:top-full sm:mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 shadow-2xl p-2 z-40 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 text-[11px] font-black uppercase text-slate-400">
                  Task Actions (अन्य कार्य)
                </div>

                {/* Action 1: Request Parts */}
                <button
                  type="button"
                  onClick={() => {
                    setShowActionsMenu(false);
                    setShowPartReqModal(true);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl hover:bg-amber-500/10 text-left text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
                    <PackagePlus className="w-4 h-4" />
                  </span>
                  <div>
                    <span className="block font-black">📦 सामान मांगें (Request Parts)</span>
                    <span className="text-[10px] text-slate-400">ऑयल, फ़िल्टर, ब्रेक पैड, आदि</span>
                  </div>
                </button>

                {/* Action 2: Photo / Video Proof */}
                <button
                  type="button"
                  onClick={() => {
                    setShowActionsMenu(false);
                    setShowPhotoModal(true);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl hover:bg-blue-500/10 text-left text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <span className="p-1.5 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400">
                    <Camera className="w-4 h-4" />
                  </span>
                  <div>
                    <span className="block font-black">📸 फोटो / वीडियो प्रमाण (Proof)</span>
                    <span className="text-[10px] text-slate-400">
                      {proofCount > 0 ? `${proofCount} फोटो अपलोड हैं` : 'काम के पहले/बाद का फोटो'}
                    </span>
                  </div>
                </button>

                {/* Action 3: Report Issue / Delay */}
                <button
                  type="button"
                  onClick={() => {
                    setShowActionsMenu(false);
                    setShowIssueModal(true);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl hover:bg-rose-500/10 text-left text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <span className="p-1.5 rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-400">
                    <AlertTriangle className="w-4 h-4" />
                  </span>
                  <div>
                    <span className="block font-black">⚠️ समस्या बताएं (Report Problem)</span>
                    <span className="text-[10px] text-slate-400">सामान नहीं है, लिफ्ट जाम है, आदि</span>
                  </div>
                </button>

                {/* Action 4: Request Additional Work */}
                <button
                  type="button"
                  onClick={() => {
                    setShowActionsMenu(false);
                    setShowAddWorkModal(true);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl hover:bg-orange-500/10 text-left text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <span className="p-1.5 rounded-lg bg-orange-500/20 text-orange-600 dark:text-orange-400">
                    <Plus className="w-4 h-4" />
                  </span>
                  <div>
                    <span className="block font-black">➕ नया काम जोड़ें (Extra Work)</span>
                    <span className="text-[10px] text-slate-400">मैनेजर की स्वीकृति के लिए भेजें</span>
                  </div>
                </button>

                {/* Action 5: Pause Work (if in progress) */}
                {isInProgress && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowActionsMenu(false);
                      handleSetStatus('PENDING');
                    }}
                    className="w-full px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-left text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <span className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      <Pause className="w-4 h-4" />
                    </span>
                    <div>
                      <span className="block font-black">⏸️ काम रोकें (Pause Work)</span>
                      <span className="text-[10px] text-slate-400">अस्थायी रूप से काम रोकें</span>
                    </div>
                  </button>
                )}

                {/* Action 6: View Details & Requisitions */}
                {partsAndReqsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowActionsMenu(false);
                      setShowDetails(prev => !prev);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-left text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2.5 transition-colors border-t border-slate-100 dark:border-slate-800 mt-1 cursor-pointer"
                  >
                    <span className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      <FileText className="w-4 h-4" />
                    </span>
                    <div>
                      <span className="block font-black">📋 पार्ट्स लिस्ट ({partsAndReqsCount})</span>
                      <span className="text-[10px] text-slate-400">{showDetails ? 'छुपाएं' : 'देखें'}</span>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Expandable Details for Parts & Requisitions */}
        {showDetails && partsAndReqsCount > 0 && (
          <div className="space-y-2 pt-2 text-xs border-t border-slate-200/80 dark:border-slate-800 animate-in fade-in duration-150">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              आवंटित पार्ट्स एवं रिक्वेस्ट ({partsAndReqsCount}):
            </span>
            {task.partsList && task.partsList.map((p, idx) => (
              <div key={idx} className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 flex items-center justify-between border border-slate-200 dark:border-slate-700">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {p.quantity}x {p.name}
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded">
                  Stock Allocated
                </span>
              </div>
            ))}

            {task.requisitions && task.requisitions.map((r, idx) => (
              <div key={idx} className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 flex items-center justify-between border border-slate-200 dark:border-slate-700">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {r.quantity}x {r.title}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  r.status === 'CONSUMED' || r.status === 'RECEIVED' 
                    ? 'bg-emerald-500/20 text-emerald-500' 
                    : 'bg-amber-500/20 text-amber-500'
                }`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* POPUP 1: 1-CLICK PART REQUISITION MODAL */}
      {showPartReqModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold">
                  📦
                </div>
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white text-base">सामान मांगें (Request Part)</h4>
                  <p className="text-xs text-slate-400">
                    गाड़ी: <strong className="text-amber-500">{card.vehicle.registrationNumber}</strong> ({task.title})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPartReqModal(false)}
                className="p-2 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Part Selector Chips */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">
                अक्सर इस्तेमाल होने वाला सामान (Quick Select):
              </label>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_COMMON_PARTS.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setSelectedPartName(p.name);
                      setCustomPartName('');
                      setPartQty(p.defaultQty);
                    }}
                    className={`p-2 rounded-xl text-left text-xs font-bold border transition-all flex items-center gap-2 cursor-pointer ${
                      selectedPartName === p.name && !customPartName
                        ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <span>{p.icon}</span>
                    <span className="truncate">{p.name.split('(')[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Or custom part name */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                या कोई दूसरा सामान लिखें:
              </label>
              <input
                type="text"
                value={customPartName}
                onChange={(e) => setCustomPartName(e.target.value)}
                placeholder="उदा. 12 नंबर बोल्ट, साइड मिरर, आदि..."
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:border-amber-500"
              />
            </div>

            {/* Big Quantity Stepper */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span className="font-bold text-xs text-slate-700 dark:text-slate-300">मात्रा (Quantity):</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPartQty(prev => Math.max(1, prev - 1))}
                  className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white font-black text-base flex items-center justify-center cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="font-mono font-black text-lg text-slate-900 dark:text-white w-8 text-center">
                  {partQty}
                </span>
                <button
                  type="button"
                  onClick={() => setPartQty(prev => prev + 1)}
                  className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 font-black text-base flex items-center justify-center cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPartReqModal(false)}
                className="w-1/3 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
              >
                रद्द करें (Cancel)
              </button>
              <button
                type="button"
                onClick={handleSubmitPartRequest}
                disabled={isSubmittingReq}
                className="w-2/3 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>स्टोर को ऑर्डर भेजें</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* POPUP 2: 1-CLICK ISSUE & PROBLEM MODAL */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-500 flex items-center justify-center font-bold">
                  ⚠️
                </div>
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white text-base">समस्या बताएं (Raise Problem)</h4>
                  <p className="text-xs text-slate-400">
                    गाड़ी: <strong className="text-rose-400">{card.vehicle.registrationNumber}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowIssueModal(false)}
                className="p-2 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Issue Chips */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">
                समस्या चुनें (Click to choose):
              </label>
              <div className="space-y-1.5">
                {QUICK_ISSUES.map((issue, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedIssueText(issue.text);
                      setCustomIssueText('');
                    }}
                    className={`w-full p-2.5 rounded-xl text-left text-xs font-bold border transition-all flex items-center gap-2.5 cursor-pointer ${
                      selectedIssueText === issue.text && !customIssueText
                        ? 'bg-rose-500/20 border-rose-500 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <span className="text-base">{issue.icon}</span>
                    <span>{issue.text}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Issue Input */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                या अपनी बात लिखें:
              </label>
              <input
                type="text"
                value={customIssueText}
                onChange={(e) => setCustomIssueText(e.target.value)}
                placeholder="उदा. ग्राहक की अनुमति बाकी है, करंट नहीं आ रहा..."
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:border-rose-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowIssueModal(false)}
                className="w-1/3 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
              >
                रद्द करें
              </button>
              <button
                type="button"
                onClick={handleSubmitIssue}
                className="w-2/3 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20 cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>मैनेजर को सूचित करें</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* POPUP 3: PROOF OF WORK MODAL */}
      {showPhotoModal && (
        <ProofOfWorkModal
          isOpen={showPhotoModal}
          onClose={() => setShowPhotoModal(false)}
          jobCard={card}
          currentUser={getAuthUser()}
          initialTaskId={task.id}
          initialCategory="DURING_REPAIR"
          onUploaded={() => {
            if (onStatusUpdated) onStatusUpdated();
          }}
        />
      )}

      {/* POPUP 4: REQUEST ADDITIONAL WORK MODAL */}
      {showAddWorkModal && (
        <RequestAdditionalWorkModal
          card={card}
          isOpen={showAddWorkModal}
          onClose={() => setShowAddWorkModal(false)}
          currentRole={currentRole}
          currentEmployeeId={task.assignedToId}
          currentEmployeeName={task.assignedToName}
          initialCategory={task.category}
          initialTaskId={task.id}
        />
      )}

    </div>
  );
});
