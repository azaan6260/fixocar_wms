import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Video, 
  Upload, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Loader2, 
  Film, 
  Image as ImageIcon,
  Share2,
  HardDrive
} from 'lucide-react';
import { JobCard, ProofMediaCategory, ProofMediaItem, AuthUser, JobTask } from '../types';
import { uploadProofMedia, getCategoryBadgeInfo } from '../lib/supabaseStorage';

interface ProofOfWorkModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobCard: JobCard;
  currentUser?: AuthUser | null;
  onUploaded?: (item: ProofMediaItem) => void;
  initialCategory?: ProofMediaCategory;
  initialTaskId?: string;
}

const QUICK_TITLES = [
  'Brake Pads Inspection & Replacement',
  'Engine Oil Draining & New 5W30 Refill',
  'Air Filter Cleaned / Replaced',
  'Suspension Bushing & Arm Check',
  'Dent Pulling & Primer Coating',
  'Full Body Paint & Clearcoat Finish',
  'Faulty Spark Plugs / Old Parts',
  'Post-Service Engine Bay Detailing',
  'Final QC Inspection Walkaround',
  'Customer Handover / Gate Departure'
];

export function ProofOfWorkModal({
  isOpen,
  onClose,
  jobCard,
  currentUser,
  onUploaded,
  initialCategory = 'DURING_REPAIR',
  initialTaskId
}: ProofOfWorkModalProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string>(initialTaskId || '');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [category, setCategory] = useState<ProofMediaCategory>(initialCategory);
  const [title, setTitle] = useState(() => {
    if (initialTaskId && jobCard.tasks) {
      const matched = jobCard.tasks.find(t => t.id === initialTaskId);
      if (matched) return `${matched.title} Proof`;
    }
    return '';
  });
  const [notes, setNotes] = useState('');
  
  // Selected file & preview
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Live video recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const liveVideoPreviewRef = useRef<HTMLVideoElement | null>(null);

  // Upload status
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [successItem, setSuccessItem] = useState<ProofMediaItem | null>(null);

  // Hidden file inputs
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setUploadError(null);
    setSuccessItem(null);

    const isVid = file.type.startsWith('video');
    setMediaType(isVid ? 'video' : 'image');

    const objUrl = URL.createObjectURL(file);
    setPreviewUrl(objUrl);

    // Auto-suggest title if empty
    if (!title) {
      if (isVid) {
        setTitle('Engine / Workshop Video Inspection');
      } else {
        setTitle('Work Proof Photo');
      }
    }
  };

  // Start live browser video recording
  const startLiveRecording = async () => {
    try {
      setUploadError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
      });
      streamRef.current = stream;

      if (liveVideoPreviewRef.current) {
        liveVideoPreviewRef.current.srcObject = stream;
        liveVideoPreviewRef.current.play();
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm'
      });
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const videoBlob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const videoFile = new File([videoBlob], `work_clip_${Date.now()}.webm`, { type: 'video/webm' });
        handleFileSelect(videoFile);
        stopStream();
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      // Fallback: trigger standard video file input
      if (videoInputRef.current) {
        videoInputRef.current.click();
      }
    }
  };

  const stopLiveRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    setIsRecording(false);
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        stopLiveRecording();
        stopStream();
      }
    };
    window.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('visibilitychange', handleVisibility);
      stopLiveRecording();
      stopStream();
    };
  }, []);

  const resetForm = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setTitle('');
    setNotes('');
    setSuccessItem(null);
    setUploadError(null);
    setUploadProgress(0);
    stopStream();
  };

  const handleClose = () => {
    stopStream();
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    resetForm();
    onClose();
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError('कृपया पहले कोई फोटो या वीडियो चुनें (Please select or capture a photo/video)');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(10);
      setUploadError(null);

      const matchedTask = jobCard.tasks?.find(t => t.id === selectedTaskId);

      const capturedItem = await uploadProofMedia({
        jobCardId: jobCard.id,
        taskId: selectedTaskId || undefined,
        taskTitle: matchedTask ? matchedTask.title : undefined,
        vehicleNumber: jobCard.vehicle.registrationNumber,
        customerName: jobCard.customer.name,
        customerPhone: jobCard.customer.phone,
        file: selectedFile,
        fileName: selectedFile.name,
        mediaType,
        title: title || (matchedTask ? `${matchedTask.title} Proof` : (mediaType === 'video' ? 'Inspection Video' : 'Proof Photo')),
        category,
        notes,
        capturedByEmployeeId: currentUser?.id,
        capturedByEmployeeName: currentUser?.name || 'Workshop Staff',
        durationSeconds: mediaType === 'video' ? (recordingSeconds || 15) : undefined,
        onProgress: (pct) => setUploadProgress(pct)
      });

      setSuccessItem(capturedItem);
      if (onUploaded) onUploaded(capturedItem);
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed. Please check Supabase connection.');
    } finally {
      setIsUploading(false);
    }
  };

  const badge = getCategoryBadgeInfo(category);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-white">
                  काम का फोटो/वीडियो प्रमाण (Proof of Work)
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                  <HardDrive className="w-3 h-3" />
                  <span>Supabase Storage</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                {jobCard.vehicle.registrationNumber} • {jobCard.id}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Success Notification */}
          {successItem && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>सफलतापूर्वक Supabase Storage में अपलोड हो गया!</span>
              </div>
              <p className="text-xs text-emerald-400/80">
                Uploaded to public bucket <strong>proof-of-work</strong>. Ready to download and share on WhatsApp.
              </p>
              {successItem.taskTitle ? (
                <div className="p-2 rounded-xl bg-slate-900/80 border border-blue-500/30 flex items-center justify-between text-xs">
                  <span className="text-slate-400">🔧 संबद्ध कार्य (Linked Job):</span>
                  <span className="font-extrabold text-blue-300 truncate max-w-[240px]">{successItem.taskTitle}</span>
                </div>
              ) : (
                <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-700/60 flex items-center justify-between text-xs">
                  <span className="text-slate-400">🚗 वाहन स्तर (Vehicle Level):</span>
                  <span className="font-bold text-amber-300">जॉब कार्ड व सम्पूर्ण वाहन</span>
                </div>
              )}
              <div className="pt-1 flex gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs transition-colors"
                >
                  + दूसरा फोटो/वीडियो जोड़ें
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors"
                >
                  पूर्ण (Close)
                </button>
              </div>
            </div>
          )}

          {/* Capture Trigger Buttons */}
          {!selectedFile && !isRecording && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-300 block">
                1. मीडिया प्रकार चुनें (Choose Capture Mode):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Camera Photo */}
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="p-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-amber-400/60 text-left transition-all group flex flex-col items-center justify-center text-center gap-2 cursor-pointer shadow-sm"
                >
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 group-hover:bg-amber-500/20 text-amber-400 flex items-center justify-center transition-colors">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-white">फोटो खींचें</h4>
                    <p className="text-[10px] text-slate-400">Click Camera Photo</p>
                  </div>
                </button>

                {/* 2. Record Video */}
                <button
                  type="button"
                  onClick={startLiveRecording}
                  className="p-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-rose-400/60 text-left transition-all group flex flex-col items-center justify-center text-center gap-2 cursor-pointer shadow-sm"
                >
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/10 group-hover:bg-rose-500/20 text-rose-400 flex items-center justify-center transition-colors">
                    <Video className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-white">वीडियो बनाएं</h4>
                    <p className="text-[10px] text-slate-400">Record Live Video Clip</p>
                  </div>
                </button>

                {/* 3. Upload from Gallery / File */}
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="p-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-cyan-400/60 text-left transition-all group flex flex-col items-center justify-center text-center gap-2 cursor-pointer shadow-sm"
                >
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 group-hover:bg-cyan-500/20 text-cyan-400 flex items-center justify-center transition-colors">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-white">गैलरी / फाइल</h4>
                    <p className="text-[10px] text-slate-400">Pick from Storage</p>
                  </div>
                </button>
              </div>

              {/* Hidden Inputs */}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />
            </div>
          )}

          {/* Live Recording Stream View */}
          {isRecording && (
            <div className="space-y-3 rounded-2xl border border-rose-500/40 bg-slate-950 p-3 overflow-hidden">
              <div className="relative aspect-video rounded-xl bg-black overflow-hidden flex items-center justify-center">
                <video
                  ref={liveVideoPreviewRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {/* Live recording indicator */}
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-rose-600/90 text-white font-black text-xs flex items-center gap-1.5 shadow-lg animate-pulse">
                  <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                  <span>REC {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')}</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <p className="text-[11px] text-slate-400">
                  Record vehicle condition, faulty parts, or completed job walkaround.
                </p>
                <button
                  type="button"
                  onClick={stopLiveRecording}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-colors"
                >
                  <span className="w-3 h-3 rounded-sm bg-white" />
                  <span>रिकॉर्डिंग रोकें (Stop & Save)</span>
                </button>
              </div>
            </div>
          )}

          {/* Preview of Selected Photo or Video */}
          {selectedFile && previewUrl && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  {mediaType === 'video' ? <Film className="w-4 h-4 text-rose-400" /> : <ImageIcon className="w-4 h-4 text-amber-400" />}
                  <span>चुना गया मीडिया (Selected {mediaType.toUpperCase()}):</span>
                </span>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-rose-400 hover:text-rose-300 font-semibold"
                >
                  हटाएं (Change)
                </button>
              </div>

              <div className="relative aspect-video max-h-56 w-full rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 flex items-center justify-center">
                {mediaType === 'video' ? (
                  <video
                    src={previewUrl}
                    controls
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt="Proof Preview"
                    className="w-full h-full object-contain"
                  />
                )}
                <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-slate-900/90 border border-slate-700 text-[10px] text-slate-300 font-mono">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
            </div>
          )}

          {/* Task / Job Association Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <span>2. संबंधित कार्य या पूरा वाहन चुनें (Attach to Job / Vehicle):</span>
              </label>
              {selectedTaskId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTaskId('');
                    setTitle(mediaType === 'video' ? 'Vehicle Inspection Video' : 'Vehicle Inspection Photo');
                  }}
                  className="text-[10px] text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
                >
                  पूरा वाहन चुनें (Switch to Vehicle)
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
              {/* Option A: Overall Vehicle */}
              <button
                type="button"
                onClick={() => {
                  setSelectedTaskId('');
                  if (!title || jobCard.tasks?.some(t => title.startsWith(t.title))) {
                    setTitle(mediaType === 'video' ? 'Vehicle Inspection Video' : 'Vehicle Inspection Photo');
                  }
                }}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  !selectedTaskId
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                    : 'bg-slate-800/60 border-slate-700/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-base">🚗</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-xs text-white">पूरा वाहन (Job Card Level)</span>
                      {!selectedTaskId && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 text-[9px] font-black">
                          SELECTED
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                      General check-in walkaround, delivery exit
                    </p>
                  </div>
                </div>
              </button>

              {/* Option B: Specific Tasks in the Job Card */}
              {jobCard.tasks && jobCard.tasks.length > 0 ? (
                jobCard.tasks.map((task) => {
                  const isSelected = selectedTaskId === task.id;
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => {
                        setSelectedTaskId(task.id);
                        setTitle(`${task.title} Proof`);
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-500/20 border-blue-500 text-blue-300 shadow-sm'
                          : 'bg-slate-800/60 border-slate-700/80 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-base">🔧</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-xs text-white truncate max-w-[130px]">
                              {task.title}
                            </span>
                            {isSelected && (
                              <span className="px-1.5 py-0.2 rounded bg-blue-500 text-white text-[9px] font-black">
                                LINKED
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">
                            {task.category} • {task.assignedToName || 'Technician'}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="p-3 rounded-2xl bg-slate-800/40 border border-slate-800 text-slate-500 text-xs flex items-center justify-center text-center">
                  No individual tasks yet (vehicle level only)
                </div>
              )}
            </div>
          </div>

          {/* Category Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 block">
              3. काम का चरण (Stage / Category):
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { cat: 'INTAKE' as ProofMediaCategory, name: 'वाहन आगमन (Intake Check)' },
                { cat: 'BEFORE_REPAIR' as ProofMediaCategory, name: 'काम से पहले (Before Repair)' },
                { cat: 'DURING_REPAIR' as ProofMediaCategory, name: 'काम करते समय (In Progress)' },
                { cat: 'AFTER_REPAIR_QC' as ProofMediaCategory, name: 'काम पूरा / QC (Work Done)' },
                { cat: 'DEFECTIVE_PART' as ProofMediaCategory, name: 'खराब पार्ट्स (Faulty Part)' },
                { cat: 'CUSTOMER_APPROVAL_NEEDED' as ProofMediaCategory, name: 'ग्राहक स्वीकृति (Approval)' },
                { cat: 'GATE_EXIT' as ProofMediaCategory, name: 'गेट पास (Delivery Exit)' }
              ].map((item) => (
                <button
                  key={item.cat}
                  type="button"
                  onClick={() => setCategory(item.cat)}
                  className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all ${
                    category === item.cat
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                      : 'bg-slate-800/60 border-slate-700/80 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>

          {/* Title and Quick Suggestions */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 block">
              4. शीर्षक या काम का विवरण (Title / Description):
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Brake Pad Replacement or Engine Tuning"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-amber-400 transition-colors"
            />

            {/* Quick Suggestions Chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {QUICK_TITLES.slice(0, 5).map((quick) => (
                <button
                  key={quick}
                  type="button"
                  onClick={() => setTitle(quick)}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-300 border border-slate-700 text-[10px] font-medium transition-colors"
                >
                  + {quick}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">
              5. अतिरिक्त टिप्पणी (Optional Technician Notes):
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Worn down to 2mm, replaced with OEM ceramic brake pads."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-amber-400 transition-colors resize-none"
            />
          </div>

          {/* Upload Error Banner */}
          {uploadError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span className="font-medium">{uploadError}</span>
              </div>
              <button
                type="button"
                onClick={handleUpload}
                disabled={isUploading || !selectedFile}
                className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-[11px] shrink-0 cursor-pointer"
              >
                पुनः प्रयास (Retry)
              </button>
            </div>
          )}

          {/* Upload Progress Bar */}
          {isUploading && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-amber-300 font-semibold">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Uploading to Supabase Storage ('proof-of-work')...</span>
                </span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            disabled={isUploading}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
          >
            रद्द करें (Cancel)
          </button>

          <button
            type="button"
            onClick={handleUpload}
            disabled={isUploading || !selectedFile}
            className={`px-5 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg transition-all ${
              isUploading || !selectedFile
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20 cursor-pointer'
            }`}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>अपलोड हो रहा है...</span>
              </>
            ) : (
              <>
                <CloudUploadIcon className="w-4 h-4" />
                <span>Supabase में सेव करें (Upload Proof)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function CloudUploadIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      width="16" 
      height="16" 
      stroke="currentColor" 
      strokeWidth="2" 
      fill="none" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      {...props}
    >
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
      <path d="M12 12v9" />
      <path d="m16 16-4-4-4 4" />
    </svg>
  );
}
