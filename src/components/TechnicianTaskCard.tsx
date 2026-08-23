import React, { useState } from 'react';
import { JobCard, JobTask, Employee, Vendor, UserRole, TaskStatus } from '../types';
import { 
  updateTaskStatus, 
  addRequisitionToTask, 
  addConcernToTask,
  updateJobCardTask,
  dispatchToastNotification 
} from '../lib/storage';
import { 
  getVernacularTaskInfo, 
  CATEGORY_HINDI_MAP, 
  speakTechnicianPrompt, 
  stopTechnicianSpeech 
} from '../lib/technicianVoiceHelper';
import { 
  Wrench, 
  Hammer, 
  Paintbrush, 
  CheckCircle2, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  PackagePlus, 
  AlertTriangle, 
  Camera, 
  Sparkles, 
  Clock, 
  Check, 
  X, 
  UserCheck, 
  Plus, 
  Minus, 
  Image as ImageIcon,
  ChevronDown,
  ChevronUp
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

export function TechnicianTaskCard({
  card,
  task,
  employees,
  vendors,
  currentRole,
  onStatusUpdated
}: TechnicianTaskCardProps) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showPartReqModal, setShowPartReqModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [showDetails, setShowDetails] = useState(false);

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
  const isPending = task.status === 'PENDING';

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

  // Status updates with big buttons
  const handleSetStatus = (newStatus: TaskStatus) => {
    updateTaskStatus(card.id, task.id, newStatus);
    
    // Voice audio confirmation for non-reading workers
    if (newStatus === 'IN_PROGRESS') {
      speakTechnicianPrompt(`काम शुरू कर दिया गया है: ${task.title}`);
      dispatchToastNotification({
        type: 'JOB_CARD_CREATED',
        title: `▶ Work Started (काम शुरू)`,
        message: `${task.title} for ${card.vehicle.registrationNumber} is now IN PROGRESS.`,
        vehicleReg: card.vehicle.registrationNumber,
        jobCardId: card.id
      });
    } else if (newStatus === 'COMPLETED') {
      speakTechnicianPrompt(`बधाई, काम पूरा हो गया है: ${task.title}`);
      dispatchToastNotification({
        type: 'JOB_CARD_CREATED',
        title: `✅ Work Completed (काम पूरा)`,
        message: `${task.title} for ${card.vehicle.registrationNumber} marked DONE.`,
        vehicleReg: card.vehicle.registrationNumber,
        jobCardId: card.id
      });
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

    dispatchToastNotification({
      type: 'JOB_CARD_CREATED',
      title: `📦 Part Requested (सामान की मांग)`,
      message: `Requested ${partQty}x "${finalPartTitle}" for task "${task.title}".`,
      vehicleReg: card.vehicle.registrationNumber,
      jobCardId: card.id
    });

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

  // Add Photo Proof
  const handleSavePhotoProof = () => {
    if (!photoUrlInput.trim()) return;

    // Attach as task note / proof
    updateJobCardTask(card.id, task.id, {
      notes: `${task.notes ? task.notes + '\n' : ''}[PHOTO PROOF]: ${photoUrlInput.trim()}`
    });

    dispatchToastNotification({
      type: 'JOB_CARD_CREATED',
      title: `📸 Photo Proof Saved (फोटो सेव हुई)`,
      message: `Attached photo evidence to ${task.title}.`,
      vehicleReg: card.vehicle.registrationNumber,
      jobCardId: card.id
    });

    setShowPhotoModal(false);
    setPhotoUrlInput('');
  };

  return (
    <div className={`rounded-3xl border-2 transition-all overflow-hidden ${
      isCompleted 
        ? 'bg-emerald-500/5 dark:bg-emerald-950/20 border-emerald-500/40 shadow-xs' 
        : isInProgress
        ? 'bg-amber-500/10 dark:bg-amber-950/30 border-amber-500 ring-2 ring-amber-500/30 shadow-lg shadow-amber-500/5'
        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm'
    }`}>
      
      {/* CARD MAIN HEADER WITH LARGE TOUCH TARGETS */}
      <div className="p-4 sm:p-5 space-y-4">
        
        {/* Row 1: Category Badge + Audio Speaker + Assigned Mechanic */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 border shadow-xs ${catConfig.bg} ${catConfig.text}`}>
              <span className="text-base">{catConfig.emoji}</span>
              <span>{catConfig.label}</span>
            </span>

            {task.isAdditionalWork && (
              <span className="bg-orange-500 text-slate-950 text-[11px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider">
                ⚡ नया काम (Add-on)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* 🔊 Big Audio Button (Listen in Hindi) */}
            <button
              type="button"
              onClick={handleToggleSpeech}
              className={`px-3 py-1.5 rounded-xl font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-xs ${
                isPlayingAudio 
                  ? 'bg-rose-500 text-white animate-pulse' 
                  : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-600 dark:text-amber-400 border border-amber-500/30 active:scale-95'
              }`}
              title="Click to hear task read out loud in Hindi"
            >
              {isPlayingAudio ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span>{isPlayingAudio ? 'आवाज बंद करें' : '🔊 सुनें (Listen)'}</span>
            </button>

            {/* Assigned person badge */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700">
              <UserCheck className="w-3.5 h-3.5 text-blue-500" />
              <span className="truncate max-w-[120px]">{task.assignedToName || 'Unassigned'}</span>
            </div>
          </div>
        </div>

        {/* Row 2: Big Bold Task Title with Phonetic Subtitle */}
        <div className="space-y-1">
          <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight leading-snug">
            {task.title}
          </h3>
          {vernacular.hindiTitle !== task.title && (
            <p className="text-xs sm:text-sm font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <span>{vernacular.icon}</span>
              <span>{vernacular.hindiTitle}</span>
            </p>
          )}
          {task.notes && (
            <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 mt-1">
              📝 <strong className="text-slate-700 dark:text-slate-300">नोट:</strong> {task.notes}
            </p>
          )}
        </div>

        {/* Row 3: GIANT PRIMARY STATUS ACTION BUTTON */}
        <div className="pt-2">
          {isPending && (
            <button
              type="button"
              onClick={() => handleSetStatus('IN_PROGRESS')}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-base sm:text-lg flex items-center justify-center gap-3 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all"
            >
              <Play className="w-6 h-6 fill-slate-950" />
              <span>▶ काम शुरू करें (START WORK)</span>
            </button>
          )}

          {isInProgress && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleSetStatus('COMPLETED')}
                className="sm:col-span-2 py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-500 hover:from-emerald-400 hover:to-emerald-500 text-white font-black text-base sm:text-lg flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition-all"
              >
                <CheckCircle2 className="w-6 h-6 stroke-[3]" />
                <span>✅ काम पूरा हो गया (MARK DONE)</span>
              </button>

              <button
                type="button"
                onClick={() => handleSetStatus('PENDING')}
                className="py-3 px-4 rounded-2xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <Pause className="w-4 h-4" />
                <span>रोकें (Pause)</span>
              </button>
            </div>
          )}

          {isCompleted && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/15 border-2 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-black">
                  <Check className="w-5 h-5 stroke-[3]" />
                </div>
                <div>
                  <span className="font-black text-sm sm:text-base block">काम पूरा हो चुका है (Completed)</span>
                  <span className="text-[11px] opacity-80 block">Verified & Logged on Job Card</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleSetStatus('IN_PROGRESS')}
                className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold"
              >
                दोबारा खोलें (Reopen)
              </button>
            </div>
          )}
        </div>

        {/* Row 4: 1-Tap Workshop Assistant Buttons (Need Parts / Take Photo / Report Problem) */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          
          {/* Button 1: Request Parts */}
          <button
            type="button"
            onClick={() => setShowPartReqModal(true)}
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-amber-500/10 dark:hover:bg-amber-500/20 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all active:scale-95 text-center"
          >
            <PackagePlus className="w-4 h-4 text-amber-500" />
            <span>📦 सामान चाहिए</span>
          </button>

          {/* Button 2: Photo Proof */}
          <button
            type="button"
            onClick={() => setShowPhotoModal(true)}
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-blue-500/10 dark:hover:bg-blue-500/20 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all active:scale-95 text-center"
          >
            <Camera className="w-4 h-4 text-blue-500" />
            <span>📸 फोटो लें</span>
          </button>

          {/* Button 3: Raise Issue */}
          <button
            type="button"
            onClick={() => setShowIssueModal(true)}
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-rose-500/10 dark:hover:bg-rose-500/20 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all active:scale-95 text-center"
          >
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            <span>⚠️ समस्या / मदद</span>
          </button>
        </div>

        {/* Existing Parts / Requisitions / Issues Counter */}
        {((task.partsList && task.partsList.length > 0) || (task.requisitions && task.requisitions.length > 0) || (task.concerns && task.concerns.length > 0)) && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <button
              type="button"
              onClick={() => setShowDetails(prev => !prev)}
              className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300 hover:text-amber-500"
            >
              <span>आवंटित पार्ट्स एवं रिक्वेस्ट ({((task.partsList?.length || 0) + (task.requisitions?.length || 0))})</span>
              {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {task.concerns && task.concerns.filter(c => c.status !== 'RESOLVED').length > 0 && (
              <span className="text-rose-500 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {task.concerns.filter(c => c.status !== 'RESOLVED').length} खुली समस्या (Issue)
              </span>
            )}
          </div>
        )}

        {/* Expandable Details for Parts & Requisitions */}
        {showDetails && (
          <div className="space-y-2 pt-2 text-xs border-t border-slate-100 dark:border-slate-800">
            {task.partsList && task.partsList.map((p, idx) => (
              <div key={idx} className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {p.quantity}x {p.name}
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded">
                  Stock Allocated
                </span>
              </div>
            ))}

            {task.requisitions && task.requisitions.map((r, idx) => (
              <div key={idx} className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
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
                  <p className="text-xs text-slate-400">दुकान/स्टोर से सामान मंगाने के लिए चुनें</p>
                </div>
              </div>
              <button
                onClick={() => setShowPartReqModal(false)}
                className="p-2 text-slate-400 hover:text-white"
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
                    className={`p-2 rounded-xl text-left text-xs font-bold border transition-all flex items-center gap-2 ${
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
                  className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white font-black text-base flex items-center justify-center"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="font-mono font-black text-lg text-slate-900 dark:text-white w-8 text-center">
                  {partQty}
                </span>
                <button
                  type="button"
                  onClick={() => setPartQty(prev => prev + 1)}
                  className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 font-black text-base flex items-center justify-center"
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
                className="w-1/3 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
              >
                रद्द करें (Cancel)
              </button>
              <button
                type="button"
                onClick={handleSubmitPartRequest}
                disabled={isSubmittingReq}
                className="w-2/3 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
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
                  <p className="text-xs text-slate-400">काम में रुकावट आने पर मैनेजर को अलर्ट भेजें</p>
                </div>
              </div>
              <button
                onClick={() => setShowIssueModal(false)}
                className="p-2 text-slate-400 hover:text-white"
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
                    className={`w-full p-2.5 rounded-xl text-left text-xs font-bold border transition-all flex items-center gap-2.5 ${
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
                className="w-1/3 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
              >
                रद्द करें
              </button>
              <button
                type="button"
                onClick={handleSubmitIssue}
                className="w-2/3 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>मैनेजर को सूचित करें</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* POPUP 3: QUICK PHOTO PROOF ATTACH MODAL */}
      {showPhotoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-500 flex items-center justify-center font-bold">
                  📸
                </div>
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white text-base">काम का फोटो जोड़ें</h4>
                  <p className="text-xs text-slate-400">काम की पुष्टि के लिए फोटो का लिंक डालें</p>
                </div>
              </div>
              <button
                onClick={() => setShowPhotoModal(false)}
                className="p-2 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {/* Quick sample photo presets for instant tap */}
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">
                फ़ोटो का लिंक या सैंपल चुनें:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { name: 'नया पार्ट फिटिंग', url: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=600&q=80' },
                  { name: 'डेंटिंग / प्राइमर', url: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=600&q=80' },
                  { name: 'पेंट फाइनल फ़िनिश', url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=600&q=80' },
                  { name: 'इंजन ऑयल बदला', url: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=600&q=80' }
                ].map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPhotoUrlInput(sample.url)}
                    className="p-2 rounded-xl text-left text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-slate-800 dark:text-slate-200 font-medium truncate"
                  >
                    📸 {sample.name}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={photoUrlInput}
                onChange={(e) => setPhotoUrlInput(e.target.value)}
                placeholder="या फ़ोटो URL पेस्ट करें..."
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white mt-2 focus:outline-hidden focus:border-blue-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPhotoModal(false)}
                className="w-1/3 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
              >
                रद्द करें
              </button>
              <button
                type="button"
                onClick={handleSavePhotoProof}
                disabled={!photoUrlInput.trim()}
                className="w-2/3 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-50"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>फ़ोटो सेव करें</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
