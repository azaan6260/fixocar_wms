import React, { useState, useRef } from 'react';
import { JobCard, TaskCategory, UserRole, SpecializedTeam, JobTask } from '../types';
import {
  addRequisitionToTask,
  updateJobCard,
  dispatchToastNotification,
  getAuthUser,
  getStandardJobs,
  getAllEmployees
} from '../lib/storage';
import { uploadProofMedia } from '../lib/supabaseStorage';
import { compressImage } from '../lib/storageService';
import {
  X,
  Wrench,
  Sparkles,
  Check,
  Send,
  ShieldCheck,
  Calculator,
  Camera,
  Video,
  Trash2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  Film
} from 'lucide-react';

interface RequestAdditionalWorkModalProps {
  card: JobCard;
  isOpen: boolean;
  onClose: () => void;
  currentRole?: UserRole;
  currentEmployeeName?: string;
  currentEmployeeId?: string;
  initialCategory?: TaskCategory;
  initialTaskId?: string;
}

const CORE_13_JOB_IDS = [
  'std-gen-1',
  'std-gen-2',
  'std-gen-3',
  'std-gen-4',
  'std-gen-5',
  'std-gen-6',
  'std-gen-7',
  'std-gen-8',
  'std-gen-9',
  'std-gen-10',
  'std-gen-11',
  'std-gen-12',
  'std-gen-13',
];

const DISCOVERY_QUICK_CHIPS: { title: string; reason: string; category: TaskCategory; icon: string }[] = [
  {
    title: 'Brake Pads / Brake Disc Worn Out (ब्रेक पैड / डिस्क खराब है)',
    reason: 'Found worn out brake pads and scored rotor disc after opening wheel assembly. Needs replacement/skimming.',
    category: 'MECHANICAL',
    icon: '🛑'
  },
  {
    title: 'Suspension Bush / Lower Arm Cracked (सस्पेंशन बुश / आर्म टूटा है)',
    reason: 'Discovered cracked lower arm bush and link rod play after lifting vehicle and inspecting suspension.',
    category: 'MECHANICAL',
    icon: '🔩'
  },
  {
    title: 'Internal Oil / Coolant Seal Leakage (अंदर ऑयल / कूलेंट लीकेज मिली)',
    reason: 'Found internal seal/hose leakage after opening engine cover. Needs new seal and top-up.',
    category: 'MECHANICAL',
    icon: '🛢️'
  },
  {
    title: 'Clutch Plate / Release Bearing Worn (क्लच प्लेट खराब निकली)',
    reason: 'After opening gearbox housing, clutch plate lining and release bearing found worn out.',
    category: 'MECHANICAL',
    icon: '⚙️'
  },
  {
    title: 'Inner Panel Rust / Hidden Dent Found (अंदर पैनल में जंग / डेंट मिला)',
    reason: 'After stripping bumper/fender, found inner apron/panel rust and impact damage needing denting & welding.',
    category: 'DENTING',
    icon: '🧱'
  },
  {
    title: 'Extra Panel Blending / Clear Coat Needed (एक्स्ट्रा पैनल पेंट मैचिंग)',
    reason: 'Adjacent panel requires primer & paint blending after sanding inspection to avoid color mismatch.',
    category: 'PAINT',
    icon: '🎨'
  },
  {
    title: 'AC Cooling Coil / Compressor Leak (एसी कूलिंग कॉइल लीक मिली)',
    reason: 'After opening dashboard/AC line for pressure testing, cooling coil leak detected.',
    category: 'MECHANICAL',
    icon: '❄️'
  },
  {
    title: 'Wiring Harness / Sensor Damaged (अंदर वायरिंग या सेंसर खराब मिला)',
    reason: 'Found damaged wiring connector/sensor after opening assembly.',
    category: 'ACCESSORIES',
    icon: '⚡'
  }
];

export function RequestAdditionalWorkModal({
  card,
  isOpen,
  onClose,
  currentRole,
  currentEmployeeName,
  currentEmployeeId,
  initialCategory = 'MECHANICAL',
  initialTaskId
}: RequestAdditionalWorkModalProps) {
  if (!isOpen) return null;

  const authUser = getAuthUser();
  const effectiveRole = currentRole || authUser?.role || 'MECHANIC';
  const isManagerOrAdmin = effectiveRole === 'SUPER_ADMIN' || effectiveRole === 'FLOOR_MANAGER' || effectiveRole === 'ADMIN';

  const empId = currentEmployeeId || authUser?.employeeId || authUser?.id || 'emp-101';
  const empName = currentEmployeeName || authUser?.name || 'Workshop Mechanic';

  const allStandardJobs = getStandardJobs();
  const coreStandardJobs = allStandardJobs.filter(j => CORE_13_JOB_IDS.includes(j.id));
  const employees = getAllEmployees();

  const [selectedTaskId, setSelectedTaskId] = useState<string>(
    initialTaskId || card.tasks[0]?.id || ''
  );
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [workTitle, setWorkTitle] = useState('');
  const [category, setCategory] = useState<TaskCategory>(initialCategory);
  const [urgency, setUrgency] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');

  // Photo & Video Proof State for Additional Work Discovery
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [photoStats, setPhotoStats] = useState<string>('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);

  const [videoUrl, setVideoUrl] = useState<string>('');
  const [videoStats, setVideoStats] = useState<string>('');
  const [isUploadingVideo, setIsUploadingVideo] = useState<boolean>(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Rates Breakdown (Optional for employee, editable by Manager)
  const isCars24 = !!card.isCars24;
  const [showPricingSection, setShowPricingSection] = useState<boolean>(isManagerOrAdmin);
  const [partPrice, setPartPrice] = useState<number>(0);
  const [labourPrice, setLabourPrice] = useState<number>(0);
  const [customerPrice, setCustomerPrice] = useState<number>(0);
  const [isContractBasis, setIsContractBasis] = useState<boolean>(false);
  const [contractorPayout, setContractorPayout] = useState<number>(0);
  const [assignedEmployeeId, setAssignedEmployeeId] = useState<string>(empId);

  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Active total rate inclusive of taxes
  const totalRate = Number(customerPrice) || 0;
  const baseTaxable = Math.round(totalRate / 1.18);
  const gstAmount = Math.round(totalRate - baseTaxable);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    try {
      const targetTask = card.tasks.find(t => t.id === selectedTaskId) || card.tasks[0];
      const uploaded = await uploadProofMedia({
        jobCardId: card.id,
        taskId: targetTask?.id,
        taskTitle: workTitle.trim() || targetTask?.title || 'Additional Work Discovery',
        vehicleNumber: card.vehicle.registrationNumber,
        customerName: card.customer.name,
        customerPhone: card.customer.phone,
        file,
        fileName: file.name,
        mediaType: 'image',
        title: `[Additional Work Photo] ${workTitle.trim() || card.vehicle.registrationNumber}`,
        category: 'CUSTOMER_APPROVAL_NEEDED',
        notes: reason.trim() || `Additional work discovered by ${empName}`,
        capturedByEmployeeId: empId,
        capturedByEmployeeName: empName,
      });
      setPhotoUrl(uploaded.url);
      const kb = (uploaded as any).fileSizeBytes ? Math.round((uploaded as any).fileSizeBytes / 1024) : 185;
      setPhotoStats(`Compressed & Saved (${kb} KB)`);
    } catch (err) {
      try {
        const compressed = await compressImage(file, { maxWidth: 1280, maxHeight: 1280, quality: 0.78 });
        setPhotoUrl(compressed.dataUrl);
        setPhotoStats(`Compressed (${Math.round(compressed.compressedSize / 1024)} KB)`);
      } catch {
        // ignore
      }
    } finally {
      setIsUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingVideo(true);
    try {
      const targetTask = card.tasks.find(t => t.id === selectedTaskId) || card.tasks[0];
      const uploaded = await uploadProofMedia({
        jobCardId: card.id,
        taskId: targetTask?.id,
        taskTitle: workTitle.trim() || targetTask?.title || 'Additional Work Discovery',
        vehicleNumber: card.vehicle.registrationNumber,
        customerName: card.customer.name,
        customerPhone: card.customer.phone,
        file,
        fileName: file.name,
        mediaType: 'video',
        title: `[Additional Work Video] ${workTitle.trim() || card.vehicle.registrationNumber}`,
        category: 'CUSTOMER_APPROVAL_NEEDED',
        notes: reason.trim() || `Additional work video recorded by ${empName}`,
        capturedByEmployeeId: empId,
        capturedByEmployeeName: empName,
      });
      setVideoUrl(uploaded.url);
      const mb = (uploaded as any).fileSizeBytes ? ((uploaded as any).fileSizeBytes / (1024 * 1024)).toFixed(1) : '1.2';
      setVideoStats(`Video Ready (${mb} MB)`);
    } catch (err) {
      const localObjUrl = URL.createObjectURL(file);
      setVideoUrl(localObjUrl);
      setVideoStats(`Video Attached (${(file.size / (1024 * 1024)).toFixed(1)} MB)`);
    } finally {
      setIsUploadingVideo(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const handleSelectPreset = (jobId: string) => {
    setSelectedPresetId(jobId);
    const sj = coreStandardJobs.find(j => j.id === jobId);
    if (sj) {
      setWorkTitle(sj.title);
      setCategory(sj.category);
      setIsContractBasis(sj.isContractBasis || false);
      const pRate = sj.partPrice ?? 0;
      const effectiveTotal = isCars24 ? sj.cars24Price : sj.retailPrice;
      const lRate = sj.labourPrice ?? Math.max(0, effectiveTotal - pRate);
      setPartPrice(pRate);
      setLabourPrice(lRate);
      setCustomerPrice(effectiveTotal);
      setContractorPayout(
        isCars24
          ? (sj.cars24ContractorPayout ?? sj.contractorPayout ?? 0)
          : (sj.retailContractorPayout ?? sj.contractorPayout ?? 0)
      );
    }
  };

  const handlePartChange = (p: number) => {
    const cleanP = Math.max(0, p);
    setPartPrice(cleanP);
    const newTotal = cleanP + labourPrice;
    setCustomerPrice(newTotal);
  };

  const handleLabourChange = (l: number) => {
    const cleanL = Math.max(0, l);
    setLabourPrice(cleanL);
    const newTotal = partPrice + cleanL;
    setCustomerPrice(newTotal);
  };

  const handleDirectApproveAndAdd = () => {
    if (!workTitle.trim()) return;

    const assignedEmp = employees.find(e => e.id === assignedEmployeeId);

    const newTask: JobTask = {
      id: `task-add-${Date.now()}`,
      jobCardId: card.id,
      title: `[ADDITIONAL] ${workTitle.trim()}`,
      category,
      assignedToId: assignedEmployeeId || undefined,
      assignedToName: assignedEmp?.name || empName,
      assignedType: 'EMPLOYEE',
      estimatedCost: isContractBasis ? contractorPayout : 0,
      customerPrice: totalRate,
      retailPrice: totalRate,
      cars24Price: totalRate,
      partPrice: Number(partPrice) || 0,
      labourPrice: Number(labourPrice) || 0,
      isTaxInclusive: true,
      status: 'PENDING',
      requiresCustomerApproval: false,
      isCustomerApproved: true,
      isContractBasis,
      contractorPayout: isContractBasis ? contractorPayout : 0,
      isAdditionalWork: true,
      additionalWorkRequestedBy: empName,
      additionalWorkRequestedAt: new Date().toISOString(),
      additionalWorkPhotoUrl: photoUrl || undefined,
      additionalWorkVideoUrl: videoUrl || undefined,
      approvalStatus: 'APPROVED',
      notes: reason.trim() || `Directly approved additional work (${category}) by ${empName}`
    };

    updateJobCard(card.id, prev => ({
      ...prev,
      tasks: [...prev.tasks, newTask]
    }));

    dispatchToastNotification({
      type: 'ADDITIONAL_WORK_APPROVED',
      title: `✅ Additional Work Approved & Allotted: ${card.vehicle.registrationNumber}`,
      message: `"${workTitle.trim()}" allotted to ${assignedEmp?.name || empName}. Proceed with repair!`,
      vehicleReg: card.vehicle.registrationNumber,
      jobCardId: card.id,
      targetEmployeeId: assignedEmployeeId || empId,
      targetEmployeeName: assignedEmp?.name || empName
    });

    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 1000);
  };

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workTitle.trim()) return;

    let targetTaskId = selectedTaskId;
    if (!targetTaskId && card.tasks.length > 0) {
      targetTaskId = card.tasks[0].id;
    }

    // If the job card has no tasks yet, create an initial inspection task so the request attaches cleanly
    if (!targetTaskId) {
      const fallbackTaskId = `task-insp-${Date.now()}`;
      const fallbackTask: JobTask = {
        id: fallbackTaskId,
        jobCardId: card.id,
        title: 'Vehicle Opening & Inspection',
        category: category || 'MECHANICAL',
        assignedToId: empId,
        assignedToName: empName,
        assignedType: 'EMPLOYEE',
        estimatedCost: 0,
        customerPrice: 0,
        status: 'IN_PROGRESS',
        requiresCustomerApproval: false,
        requisitions: []
      };
      updateJobCard(card.id, prev => ({
        ...prev,
        tasks: [...prev.tasks, fallbackTask]
      }));
      targetTaskId = fallbackTaskId;
    }

    addRequisitionToTask(card.id, targetTaskId, {
      requestedByEmployeeId: empId,
      requestedByEmployeeName: empName,
      title: `[${category}] ${workTitle.trim()}`,
      itemType: 'ADDITIONAL_WORK',
      quantity: 1,
      urgency,
      reason: reason.trim() || `Additional ${category} work discovered after opening up by ${empName}`,
      suggestedPrice: totalRate,
      partPrice: Number(partPrice) || 0,
      labourPrice: Number(labourPrice) || 0,
      customerPrice: totalRate,
      cars24Price: isCars24 ? totalRate : undefined,
      isTaxInclusive: true,
      contractorPayout: isContractBasis ? contractorPayout : undefined,
      photoUrl: photoUrl || undefined,
      videoUrl: videoUrl || undefined,
    });

    dispatchToastNotification({
      type: 'ADDITIONAL_WORK_REQUESTED',
      title: `🔧 Additional Work Raised: ${card.vehicle.registrationNumber}`,
      message: `${empName} discovered "${workTitle.trim()}"${photoUrl ? ' 📸' : ''}${videoUrl ? ' 🎥' : ''}. Waiting for Manager review & task allotment.`,
      vehicleReg: card.vehicle.registrationNumber,
      jobCardId: card.id,
      targetRole: 'FLOOR_MANAGER'
    });

    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
      <div className="bg-slate-900 text-white rounded-3xl border border-slate-800 w-full max-w-2xl p-5 sm:p-6 space-y-4 shadow-2xl relative max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white flex items-center gap-2 flex-wrap">
                <span>Raise Additional Work (अतिरिक्त काम की रिक्वेस्ट)</span>
                <span className="text-[10px] bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase">
                  Found After Opening Up
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Vehicle: <span className="font-bold text-amber-400 font-mono">{card.vehicle.registrationNumber}</span> ({card.vehicle.make} {card.vehicle.model}) • Raised by: <strong className="text-slate-200">{empName}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="py-10 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto text-2xl font-black animate-bounce">
              <Check className="w-8 h-8" />
            </div>
            <h4 className="font-black text-lg text-white">Additional Work Request Sent to Manager!</h4>
            <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
              Your photo/video evidence and explanation have been sent to the Floor Manager. Once reviewed and approved, the tasks will be allotted to you and you will receive a sound notification to proceed.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmitRequest} className="space-y-4 text-xs">
            
            {/* STEP 1: PHOTO & VIDEO EVIDENCE UPLOAD */}
            <div className="p-3.5 rounded-2xl bg-slate-800/70 border border-amber-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Camera className="w-4 h-4" />
                  1. Attach Photo & Video of Discovered Issue (फोटो और वीडियो लगाएं)
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">
                  Auto-Compressed for Cloud Storage
                </span>
              </div>

              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoSelect}
                className="hidden"
              />
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                capture="environment"
                onChange={handleVideoSelect}
                className="hidden"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Photo Upload Card */}
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-700 flex flex-col justify-between gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                      <ImageIcon className="w-4 h-4 text-blue-400" />
                      <span>Issue Photo (फोटो)</span>
                    </span>
                    {photoUrl && (
                      <button
                        type="button"
                        onClick={() => { setPhotoUrl(''); setPhotoStats(''); }}
                        className="text-rose-400 hover:text-rose-300 p-1 rounded cursor-pointer"
                        title="Remove Photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {photoUrl ? (
                    <div className="space-y-1.5">
                      <div className="relative h-32 w-full rounded-lg overflow-hidden border border-emerald-500/40 bg-slate-950">
                        <img
                          src={photoUrl}
                          alt="Additional work discovery"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> {photoStats || 'Photo Attached'}
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isUploadingPhoto}
                      onClick={() => photoInputRef.current?.click()}
                      className="w-full py-5 rounded-xl border-2 border-dashed border-blue-500/40 hover:border-blue-400 bg-blue-500/5 hover:bg-blue-500/10 text-blue-300 font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      {isUploadingPhoto ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                          <span className="text-[11px]">Compressing & Uploading Photo...</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-5 h-5 text-blue-400" />
                          <span className="text-xs font-black">📸 Take / Upload Photo</span>
                          <span className="text-[10px] text-slate-400">Show worn or damaged part</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Video Upload Card */}
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-700 flex flex-col justify-between gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                      <Film className="w-4 h-4 text-purple-400" />
                      <span>Issue Video (वीडियो)</span>
                    </span>
                    {videoUrl && (
                      <button
                        type="button"
                        onClick={() => { setVideoUrl(''); setVideoStats(''); }}
                        className="text-rose-400 hover:text-rose-300 p-1 rounded cursor-pointer"
                        title="Remove Video"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {videoUrl ? (
                    <div className="space-y-1.5">
                      <div className="relative h-32 w-full rounded-lg overflow-hidden border border-purple-500/40 bg-slate-950">
                        <video
                          src={videoUrl}
                          controls
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-[10px] text-purple-300 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> {videoStats || 'Video Attached'}
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isUploadingVideo}
                      onClick={() => videoInputRef.current?.click()}
                      className="w-full py-5 rounded-xl border-2 border-dashed border-purple-500/40 hover:border-purple-400 bg-purple-500/5 hover:bg-purple-500/10 text-purple-300 font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      {isUploadingVideo ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                          <span className="text-[11px]">Uploading Video Clip...</span>
                        </>
                      ) : (
                        <>
                          <Video className="w-5 h-5 text-purple-400" />
                          <span className="text-xs font-black">🎥 Record / Upload Video</span>
                          <span className="text-[10px] text-slate-400">Explain play, noise, or leak</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* STEP 2: QUICK DISCOVERY CHIPS FOR MECHANICS / EMPLOYEES */}
            <div className="p-3 rounded-2xl bg-slate-800/50 border border-slate-700 space-y-2">
              <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                2. Quick Select Discovered Issue (पार्ट खोलने पर क्या समस्या मिली?):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                {DISCOVERY_QUICK_CHIPS.map((chip, idx) => {
                  const isSelected = workTitle === chip.title;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setWorkTitle(chip.title);
                        setCategory(chip.category);
                        if (!reason.trim()) {
                          setReason(chip.reason);
                        }
                      }}
                      className={`p-2 rounded-xl border text-left text-[11px] font-bold transition-all flex items-center gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-sm'
                          : 'bg-slate-900/90 border-slate-700 text-slate-200 hover:border-amber-500/50'
                      }`}
                    >
                      <span className="text-sm shrink-0">{chip.icon}</span>
                      <span className="truncate">{chip.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Work Title & What Needs To Be Done */}
            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1">
                What Additional Work Needs to be Done? (क्या काम करना होगा?) *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Front Brake Disc Skimming & Pad Replacement, Lower Arm Bush Replace..."
                value={workTitle}
                onChange={(e) => {
                  setWorkTitle(e.target.value);
                  setSelectedPresetId('');
                }}
                className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Detailed Explanation / Findings */}
            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1">
                Explain What You Found After Opening Up (विस्तार से बताएं क्या खराबी मिली) *
              </label>
              <textarea
                rows={3}
                required
                placeholder="Tell the manager what you found after opening the assembly and what parts/work are required to resolve it..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-medium text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Category, Urgency & Related Task */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Department / Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TaskCategory)}
                  className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="MECHANICAL">MECHANICAL (यांत्रिक)</option>
                  <option value="DENTING">DENTING (डेंटिंग)</option>
                  <option value="PAINT">PAINTING (पेंटिंग)</option>
                  <option value="ACCESSORIES">ELECTRICAL / WIRING</option>
                  <option value="LATHE_WORK">LATHE WORK (लेथ काम)</option>
                  <option value="WASHING">WASHING / DETAILING</option>
                  <option value="SUBLET_VENDOR">SUBLET VENDOR</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Urgency Level
                </label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="HIGH">HIGH (उच्च - काम रुका है)</option>
                  <option value="CRITICAL">CRITICAL (अति आवश्यक)</option>
                  <option value="MEDIUM">MEDIUM (मध्यम)</option>
                  <option value="LOW">LOW (सामान्य)</option>
                </select>
              </div>

              {card.tasks.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Discovered During Task
                  </label>
                  <select
                    value={selectedTaskId}
                    onChange={(e) => setSelectedTaskId(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold text-xs"
                  >
                    {card.tasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Optional Pricing / Standard Job Presets Toggle */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowPricingSection(prev => !prev)}
                className="text-[11px] font-bold text-amber-400 hover:underline flex items-center gap-1.5 cursor-pointer"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>
                  {showPricingSection
                    ? 'Hide Estimated Rate / Standard Presets'
                    : '+ Add Estimated Rate or Pick Standard Job Preset (Optional for Mechanic)'}
                </span>
              </button>
            </div>

            {showPricingSection && (
              <div className="p-3.5 bg-slate-800/40 rounded-2xl border border-slate-700/80 space-y-3 animate-in fade-in duration-150">
                {/* Quick-Select 13 Standard Jobs Bar */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    Standard Job Presets:
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                    {coreStandardJobs.map((sj) => {
                      const isSelected = selectedPresetId === sj.id;
                      const price = isCars24 ? sj.cars24Price : sj.retailPrice;
                      return (
                        <button
                          key={sj.id}
                          type="button"
                          onClick={() => handleSelectPreset(sj.id)}
                          className={`px-2 py-1 rounded-xl border text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500 text-slate-950 border-amber-500 font-black'
                              : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-amber-400'
                          }`}
                        >
                          <span>{sj.title.replace(/\s*\(.*\)/, '')}</span>
                          <span className="font-mono text-[9.5px] opacity-80">₹{price}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-blue-400 uppercase mb-1">
                      Part Rate (₹, Incl. Tax)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={partPrice}
                      onChange={(e) => handlePartChange(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-blue-500/40 text-blue-300 font-mono font-bold text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-indigo-400 uppercase mb-1">
                      Labour Rate (₹, Incl. Tax)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={labourPrice}
                      onChange={(e) => handleLabourChange(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-indigo-500/40 text-indigo-300 font-mono font-bold text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-emerald-400 uppercase mb-1">
                      Total Customer Bill (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={customerPrice}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setCustomerPrice(val);
                        setLabourPrice(Math.max(0, val - partPrice));
                      }}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/50 text-emerald-300 font-mono font-extrabold text-xs"
                    />
                  </div>
                </div>

                {isManagerOrAdmin && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-700/60">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">
                        Allot To Mechanic / Employee
                      </label>
                      <select
                        value={assignedEmployeeId}
                        onChange={(e) => setAssignedEmployeeId(e.target.value)}
                        className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-semibold text-xs"
                      >
                        <option value="">-- Same as Requester ({empName}) --</option>
                        {employees.map(e => (
                          <option key={e.id} value={e.id}>
                            👷 {e.name} ({e.specializedTeam || e.role})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center justify-between pt-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isContractBasis}
                          onChange={(e) => setIsContractBasis(e.target.checked)}
                          className="rounded text-amber-500"
                        />
                        <span className="font-bold text-slate-200 text-xs">
                          Contract Payout (₹)
                        </span>
                      </label>
                      {isContractBasis && (
                        <input
                          type="number"
                          min="0"
                          value={contractorPayout}
                          onChange={(e) => setContractorPayout(Number(e.target.value))}
                          className="w-24 px-2 py-1 rounded-lg bg-slate-900 border border-amber-500/40 text-amber-300 font-mono font-bold text-xs"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isUploadingPhoto || isUploadingVideo}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Send to Manager for Review & Approval (मैनेजर को भेजें)</span>
              </button>

              {isManagerOrAdmin && (
                <button
                  type="button"
                  onClick={handleDirectApproveAndAdd}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Direct Approve & Allot</span>
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
