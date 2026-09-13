import React, { useState, useMemo, useRef } from 'react';
import { 
  Camera, 
  Video, 
  Download, 
  Share2, 
  Trash2, 
  Play, 
  Maximize2, 
  X, 
  HardDrive, 
  Plus, 
  Calendar, 
  User, 
  FileText,
  Clock,
  Sparkles,
  ExternalLink,
  MessageCircle,
  Wrench,
  Car,
  Copy,
  Check,
  Info,
  Paperclip,
  Loader2
} from 'lucide-react';
import { JobCard, ProofMediaItem, ProofMediaCategory, AuthUser, JobAttachment } from '../types';
import { getCategoryBadgeInfo, downloadProofMedia, shareProofOnWhatsApp } from '../lib/supabaseStorage';
import { deleteProofMediaFromJobCard, deleteAttachmentFromJobCard } from '../lib/storage';
import { uploadJobAttachment, SUPABASE_STORAGE_FREE_TIER_INFO } from '../lib/storageService';

interface ProofMediaGalleryProps {
  jobCard: JobCard;
  currentUser?: AuthUser | null;
  onOpenAddModal: (taskId?: string) => void;
  readOnly?: boolean;
  initialFilterTaskId?: string;
  isModal?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

export function ProofMediaGallery({
  jobCard,
  currentUser,
  onOpenAddModal,
  readOnly = false,
  initialFilterTaskId,
  isModal = false,
  isOpen = true,
  onClose
}: ProofMediaGalleryProps) {
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');
  const [selectedTaskFilter, setSelectedTaskFilter] = useState<string>(initialFilterTaskId || 'ALL');
  const [activeMediaItem, setActiveMediaItem] = useState<ProofMediaItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showStorageInfo, setShowStorageInfo] = useState(false);

  // Direct file attachment state
  const [isAttaching, setIsAttaching] = useState(false);
  const [attachmentProgress, setAttachmentProgress] = useState(0);
  const directFileInputRef = useRef<HTMLInputElement>(null);

  if (isModal && !isOpen) return null;

  // Unify and deduplicate proofMedia and attachments
  const proofList: ProofMediaItem[] = useMemo(() => {
    const combinedMap = new Map<string, ProofMediaItem>();

    if (Array.isArray(jobCard.proofMedia)) {
      jobCard.proofMedia.forEach((item) => {
        if (item.id || item.url) {
          combinedMap.set(item.id || item.url, { ...item });
        }
      });
    }

    if (Array.isArray(jobCard.attachments)) {
      jobCard.attachments.forEach((att) => {
        const key = att.id || att.url;
        const existing = combinedMap.get(key);
        if (existing) {
          combinedMap.set(key, {
            ...existing,
            fileSize: att.fileSize || existing.fileSize,
            originalSize: att.originalSize || existing.originalSize,
            compressionRatio: att.compressionRatio ?? existing.compressionRatio,
            capturedByEmployeeName: att.uploader?.name || existing.capturedByEmployeeName,
            capturedByEmployeeId: att.uploader?.id || existing.capturedByEmployeeId,
            notes: existing.notes || att.caption || ''
          });
        } else {
          combinedMap.set(key, {
            id: att.id,
            jobCardId: att.jobCardId,
            taskId: att.taskId,
            taskTitle: att.taskTitle,
            vehicleNumber: jobCard.vehicle?.registrationNumber || '',
            customerName: jobCard.customer?.name || '',
            customerPhone: jobCard.customer?.phone || '',
            mediaType: att.fileType || 'image',
            url: att.url,
            storagePath: att.storagePath,
            storageBucket: att.storageBucket || 'job-attachments',
            title: att.caption || (att.fileType === 'video' ? 'Inspection Video' : 'Attachment Photo'),
            category: (att.category as ProofMediaCategory) || 'DURING_REPAIR',
            notes: att.caption || '',
            capturedByEmployeeId: att.uploader?.id,
            capturedByEmployeeName: att.uploader?.name || 'Workshop Staff',
            capturedAt: att.timestamp,
            fileSize: att.fileSize,
            originalSize: att.originalSize,
            compressionRatio: att.compressionRatio,
            mimeType: att.mimeType
          });
        }
      });
    }

    return Array.from(combinedMap.values()).sort(
      (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
    );
  }, [jobCard.proofMedia, jobCard.attachments, jobCard.vehicle, jobCard.customer]);

  const filteredList = proofList.filter((item) => {
    // 1. Task association filter
    if (selectedTaskFilter === 'VEHICLE_ONLY') {
      if (item.taskId) return false;
    } else if (selectedTaskFilter !== 'ALL') {
      if (item.taskId !== selectedTaskFilter) return false;
    }

    // 2. Category / Media Type filter
    if (selectedFilter === 'ALL') return true;
    if (selectedFilter === 'IMAGES') return item.mediaType === 'image';
    if (selectedFilter === 'VIDEOS') return item.mediaType === 'video';
    return item.category === selectedFilter;
  });

  const handleDelete = (item: ProofMediaItem) => {
    if (!window.confirm(`क्या आप इस प्रमाण (${item.title}) को हटाना चाहते हैं?`)) return;
    setIsDeleting(item.id);
    deleteProofMediaFromJobCard(jobCard.id, item.id, item.storagePath);
    deleteAttachmentFromJobCard(jobCard.id, item.id, item.storagePath);
    if (activeMediaItem?.id === item.id) {
      setActiveMediaItem(null);
    }
    setIsDeleting(null);
  };

  const handleCopyUrl = (url: string, id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => {});
  };

  const handleDirectFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsAttaching(true);
      setAttachmentProgress(10);
      const isVid = file.type.startsWith('video');

      await uploadJobAttachment({
        jobCardId: jobCard.id,
        taskId: selectedTaskFilter !== 'ALL' && selectedTaskFilter !== 'VEHICLE_ONLY' ? selectedTaskFilter : undefined,
        file,
        fileName: file.name,
        fileType: isVid ? 'video' : 'image',
        caption: `${isVid ? 'Video' : 'Photo'} Attachment`,
        category: 'DURING_REPAIR',
        uploader: {
          id: currentUser?.id,
          name: currentUser?.name || 'Staff Member',
          role: currentUser?.role || 'STAFF'
        },
        onProgress: (p) => setAttachmentProgress(p)
      });
    } catch (err: any) {
      alert(`Attachment upload failed: ${err.message || 'Error uploading file'}`);
    } finally {
      setIsAttaching(false);
      setAttachmentProgress(0);
      if (directFileInputRef.current) directFileInputRef.current.value = '';
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const imageCount = proofList.filter(i => i.mediaType === 'image').length;
  const videoCount = proofList.filter(i => i.mediaType === 'video').length;
  const vehicleLevelCount = proofList.filter(i => !i.taskId).length;

  const galleryContent = (
    <div className="space-y-4">
      {/* Hidden direct file input */}
      <input
        type="file"
        ref={directFileInputRef}
        onChange={handleDirectFileAttach}
        accept="image/*,video/*"
        className="hidden"
      />

      {/* Gallery Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-4 rounded-3xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-sm sm:text-base text-white">
                काम का फोटो व वीडियो प्रमाण (Proof of Work & Attachments)
              </h3>
              <button
                type="button"
                onClick={() => setShowStorageInfo(true)}
                className="px-2 py-0.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-[10px] font-bold text-emerald-400 flex items-center gap-1 transition-colors cursor-pointer"
                title="View Supabase Free Tier storage limits and compression efficiency"
              >
                <HardDrive className="w-3 h-3" />
                <span>Supabase 1 GB Free Tier (Client Compressed)</span>
                <Info className="w-3 h-3 ml-0.5 text-emerald-300" />
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              {jobCard.vehicle?.registrationNumber} • {proofList.length} कुल प्रमाण ({imageCount} Photos, {videoCount} Videos) • Direct WhatsApp & Download
            </p>
          </div>
        </div>

        {!readOnly && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Direct Quick Attach File Button */}
            <button
              type="button"
              disabled={isAttaching}
              onClick={() => directFileInputRef.current?.click()}
              className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0"
              title="Quickly attach any photo or video file from device"
            >
              {isAttaching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Compressing {attachmentProgress}%</span>
                </>
              ) : (
                <>
                  <Paperclip className="w-4 h-4 text-amber-400" />
                  <span>+ Quick Attach</span>
                </>
              )}
            </button>

            {/* Camera & Video Modal Trigger */}
            <button
              type="button"
              onClick={() => onOpenAddModal(selectedTaskFilter !== 'ALL' && selectedTaskFilter !== 'VEHICLE_ONLY' ? selectedTaskFilter : undefined)}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>+ नया फोटो / वीडियो (Add Proof)</span>
            </button>
          </div>
        )}
      </div>

      {/* Task-Level Filter Row */}
      {proofList.length > 0 && (
        <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-amber-400" />
              <span>जॉब / वाहन स्तर पर फ़िल्टर करें (Filter By Job):</span>
            </span>
            {selectedTaskFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedTaskFilter('ALL')}
                className="text-[10px] text-amber-400 hover:underline font-bold"
              >
                सभी दिखाएं (Show All)
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              onClick={() => setSelectedTaskFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold whitespace-nowrap transition-all ${
                selectedTaskFilter === 'ALL'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                  : 'bg-slate-800/60 border-slate-700/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              सभी प्रमाण ({proofList.length})
            </button>

            <button
              type="button"
              onClick={() => setSelectedTaskFilter('VEHICLE_ONLY')}
              className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                selectedTaskFilter === 'VEHICLE_ONLY'
                  ? 'bg-blue-500/20 border-blue-500 text-blue-300 shadow-sm'
                  : 'bg-slate-800/60 border-slate-700/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Car className="w-3 h-3" />
              <span>पूरा वाहन / चेक-इन ({vehicleLevelCount})</span>
            </button>

            {jobCard.tasks && jobCard.tasks.map((task) => {
              const taskCount = proofList.filter(p => p.taskId === task.id).length;
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => setSelectedTaskFilter(task.id)}
                  className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    selectedTaskFilter === task.id
                      ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                      : 'bg-slate-800/60 border-slate-700/80 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Wrench className="w-3 h-3" />
                  <span className="truncate max-w-[150px]">{task.title}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono ${
                    taskCount > 0 ? 'bg-amber-400 text-slate-950 font-black' : 'bg-slate-700 text-slate-300'
                  }`}>
                    {taskCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Category / Type Tabs */}
      {proofList.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { key: 'ALL', label: `सभी प्रकार (${filteredList.length})` },
            { key: 'IMAGES', label: `📸 फोटो (${filteredList.filter(i => i.mediaType === 'image').length})` },
            { key: 'VIDEOS', label: `🎥 वीडियो (${filteredList.filter(i => i.mediaType === 'video').length})` },
            { key: 'INTAKE', label: 'आगमन जांच (Intake)' },
            { key: 'BEFORE_REPAIR', label: 'काम से पहले (Before)' },
            { key: 'DURING_REPAIR', label: 'काम करते समय (In Progress)' },
            { key: 'AFTER_REPAIR_QC', label: 'QC व पूरा काम (Done)' },
            { key: 'DEFECTIVE_PART', label: 'खराब पार्ट्स (Faulty)' }
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSelectedFilter(tab.key)}
              className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold whitespace-nowrap transition-all ${
                selectedFilter === tab.key
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                  : 'bg-slate-800/60 border-slate-700/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Empty State */}
      {proofList.length === 0 && (
        <div className="p-8 sm:p-10 rounded-3xl bg-slate-900/60 border-2 border-dashed border-slate-800 text-center space-y-3">
          <div className="w-14 h-14 rounded-3xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <Camera className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto">
            <h4 className="font-extrabold text-sm sm:text-base text-white">
              कोई फोटो या वीडियो प्रमाण नहीं जुड़ा है (No Proof Attached)
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              कर्मचारी रिपेयर शुरू करने से पहले, काम के दौरान, या डिलीवरी के समय लाइव फोटो और वीडियो रिकॉर्ड करके Supabase क्लाउड स्टोरेज में सेव कर सकते हैं।
            </p>
          </div>
          {!readOnly && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onOpenAddModal(selectedTaskFilter !== 'ALL' && selectedTaskFilter !== 'VEHICLE_ONLY' ? selectedTaskFilter : undefined)}
                className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs inline-flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>पहला फोटो / वीडियो क्लिक करें</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Filtered Empty State */}
      {proofList.length > 0 && filteredList.length === 0 && (
        <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800 text-center space-y-2">
          <p className="text-xs text-slate-400">इस फ़िल्टर में कोई फोटो या वीडियो मौजूद नहीं है।</p>
          <button
            type="button"
            onClick={() => { setSelectedFilter('ALL'); setSelectedTaskFilter('ALL'); }}
            className="text-xs text-amber-400 hover:underline font-bold"
          >
            फ़िल्टर हटाएं (Reset Filters)
          </button>
        </div>
      )}

      {/* Media Grid */}
      {filteredList.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredList.map((item) => {
            const badge = getCategoryBadgeInfo(item.category);
            const isVideo = item.mediaType === 'video';

            return (
              <div
                key={item.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl overflow-hidden flex flex-col group transition-all shadow-md"
              >
                {/* Media Thumbnail Container */}
                <div 
                  className="relative aspect-video bg-slate-950 overflow-hidden cursor-pointer"
                  onClick={() => setActiveMediaItem(item)}
                >
                  {isVideo ? (
                    <div className="relative w-full h-full flex items-center justify-center bg-slate-950">
                      <video
                        src={item.url}
                        preload="metadata"
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                      <div className="w-12 h-12 rounded-2xl bg-rose-600/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <Play className="w-5 h-5 ml-0.5 fill-white" />
                      </div>
                      <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-slate-900/90 border border-slate-700 text-[10px] text-rose-300 font-bold flex items-center gap-1">
                        <Video className="w-3 h-3" />
                        <span>VIDEO {item.durationSeconds ? `• ${item.durationSeconds}s` : ''}</span>
                      </span>
                    </div>
                  ) : (
                    <div className="relative w-full h-full">
                      <img
                        src={item.url}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                      <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-slate-900/90 border border-slate-700 text-[10px] text-amber-300 font-bold flex items-center gap-1">
                        <Camera className="w-3 h-3" />
                        <span>PHOTO</span>
                      </span>
                    </div>
                  )}

                  {/* Category Pill on Top Left */}
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-extrabold ${badge.bgClass} ${badge.textClass} ${badge.borderClass}`}>
                      {badge.label}
                    </span>
                  </div>

                  {/* Top Right: Copy URL + Expand */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => handleCopyUrl(item.url, item.id, e)}
                      className="w-7 h-7 rounded-xl bg-slate-950/80 hover:bg-slate-900 text-slate-300 hover:text-white flex items-center justify-center backdrop-blur-sm border border-slate-700/60 transition-colors"
                      title="Copy Public Supabase URL"
                    >
                      {copiedId === item.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMediaItem(item);
                      }}
                      className="w-7 h-7 rounded-xl bg-slate-950/80 hover:bg-slate-900 text-slate-300 hover:text-white flex items-center justify-center backdrop-blur-sm border border-slate-700/60 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Fullscreen Lightbox"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    {/* Task or Vehicle Badge & Compression ratio */}
                    <div className="flex items-center justify-between gap-1">
                      {item.taskTitle ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-[10px] font-bold text-blue-300">
                          <Wrench className="w-2.5 h-2.5 text-blue-400 shrink-0" />
                          <span className="truncate max-w-[160px]">{item.taskTitle}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-[10px] font-medium text-slate-400">
                          <Car className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                          <span>पूरा वाहन (Vehicle Level)</span>
                        </span>
                      )}

                      {item.compressionRatio !== undefined && item.compressionRatio > 0 ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-mono text-emerald-400 shrink-0" title={`Compressed: ${formatBytes(item.fileSize)} (Original: ${formatBytes(item.originalSize)})`}>
                          <span>-{item.compressionRatio}%</span>
                        </span>
                      ) : item.fileSize ? (
                        <span className="text-[9px] font-mono text-slate-500 shrink-0">
                          {formatBytes(item.fileSize)}
                        </span>
                      ) : null}
                    </div>

                    <h4 className="font-extrabold text-sm text-white line-clamp-1 group-hover:text-amber-400 transition-colors">
                      {item.title}
                    </h4>
                    {item.notes && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {item.notes}
                      </p>
                    )}
                  </div>

                  {/* Metadata Row: Uploader + Timestamp */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 truncate max-w-[140px]">
                      <User className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{item.capturedByEmployeeName || 'Technician'}</span>
                    </span>
                    <span className="flex items-center gap-1 font-mono text-[10px] shrink-0">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>
                        {new Date(item.capturedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                        {new Date(item.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </span>
                  </div>

                  {/* Action Buttons: WhatsApp & Download */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {/* Share on WhatsApp */}
                    <button
                      type="button"
                      onClick={() => shareProofOnWhatsApp({ mediaItem: item, jobCard })}
                      className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                      title="Share to WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5 fill-slate-950" />
                      <span>व्हाट्सएप</span>
                    </button>

                    {/* Download */}
                    <button
                      type="button"
                      onClick={() => downloadProofMedia(item)}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition-all cursor-pointer"
                      title="Download full file to device"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>डाउनलोड</span>
                    </button>
                  </div>

                  {/* Bottom Strip: Copy Public URL & Delete */}
                  <div className="flex items-center justify-between pt-0.5 text-[10px]">
                    <button
                      type="button"
                      onClick={(e) => handleCopyUrl(item.url, item.id, e)}
                      className="text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {copiedId === item.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">Copied URL!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Public Link</span>
                        </>
                      )}
                    </button>

                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        disabled={isDeleting === item.id}
                        className="text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>हटाएं (Delete)</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FULLSCREEN LIGHTBOX & HD PLAYER MODAL */}
      {activeMediaItem && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 backdrop-blur-md">
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden flex flex-col shadow-2xl">
            {/* Lightbox Header */}
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold shrink-0 ${getCategoryBadgeInfo(activeMediaItem.category).bgClass} ${getCategoryBadgeInfo(activeMediaItem.category).textClass} ${getCategoryBadgeInfo(activeMediaItem.category).borderClass}`}>
                  {getCategoryBadgeInfo(activeMediaItem.category).label}
                </span>
                {activeMediaItem.taskTitle && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] font-mono shrink-0">
                    🔧 {activeMediaItem.taskTitle}
                  </span>
                )}
                <h3 className="font-bold text-sm text-white truncate max-w-md">
                  {activeMediaItem.title}
                </h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopyUrl(activeMediaItem.url, activeMediaItem.id)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedId === activeMediaItem.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy URL</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => shareProofOnWhatsApp({ mediaItem: activeMediaItem, jobCard })}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5 fill-slate-950" />
                  <span>WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadProofMedia(activeMediaItem)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMediaItem(null)}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Media Content */}
            <div className="flex-1 bg-black flex items-center justify-center p-2 sm:p-4 overflow-hidden min-h-[300px]">
              {activeMediaItem.mediaType === 'video' ? (
                <video
                  src={activeMediaItem.url}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[68vh] w-auto max-w-full rounded-xl"
                />
              ) : (
                <img
                  src={activeMediaItem.url}
                  alt={activeMediaItem.title}
                  className="max-h-[68vh] w-auto max-w-full object-contain rounded-xl"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>

            {/* Lightbox Footer */}
            <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-400 gap-2 shrink-0">
              <div>
                <p className="text-white font-semibold">{activeMediaItem.notes || 'No extra notes'}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Uploaded by {activeMediaItem.capturedByEmployeeName || 'Staff'} • {new Date(activeMediaItem.capturedAt).toLocaleString()}
                  {activeMediaItem.fileSize ? ` • ${formatBytes(activeMediaItem.fileSize)}` : ''}
                  {activeMediaItem.compressionRatio ? ` (${activeMediaItem.compressionRatio}% compressed)` : ''}
                </p>
              </div>
              <a
                href={activeMediaItem.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 font-mono"
              >
                <span>View Supabase Public URL</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* STORAGE TIERS & FREE QUOTA INFORMATION MODAL */}
      {showStorageInfo && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-white">
                    Supabase Storage — Free Tier Limits & Capacity
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Analysis & comparison with alternative free services
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowStorageInfo(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Summary Hero */}
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-emerald-400 uppercase text-[11px]">Free Tier Quota</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold text-xs">
                    1 GB Storage • 2 GB Bandwidth / mo
                  </span>
                </div>
                <p className="text-slate-200 leading-relaxed">
                  Supabase provides <strong>1 GB of persistent storage</strong> and <strong>2 GB of egress bandwidth</strong> completely free. Because we integrated automatic client-side compression (downscaling raw 6MB photos to ~180-280 KB), <strong>1 GB holds 4,000 to 6,000 photos</strong> without paying anything.
                </p>
              </div>

              {/* Comparison cards */}
              <div className="space-y-2.5">
                <h4 className="font-bold text-slate-300 text-xs uppercase tracking-wide">
                  Service Comparison:
                </h4>
                {SUPABASE_STORAGE_FREE_TIER_INFO.alternativesComparison.map((alt, idx) => (
                  <div key={idx} className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-white text-xs">{alt.name}</span>
                      <span className="text-[10px] font-mono text-amber-400 font-bold">{alt.freeLimit}</span>
                    </div>
                    <p className="text-[11px] text-slate-300"><strong>Pros:</strong> {alt.pros}</p>
                    <p className="text-[11px] text-slate-400"><strong>Cons:</strong> {alt.cons}</p>
                    <div className="text-[10px] text-emerald-400 pt-0.5">
                      💡 <strong>Verdict:</strong> {alt.recommendation}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                🎯 <strong>Recommendation for FixoCar:</strong> Stay on <strong>Supabase Storage</strong>. It is fully integrated with your central database, requires no extra external credentials, and the new client-side compression engine makes the 1 GB quota go ~25x further.
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/60 flex justify-end">
              <button
                type="button"
                onClick={() => setShowStorageInfo(false)}
                className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
        <div className="bg-slate-950 border border-slate-800 w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
          {/* Modal Header */}
          <div className="px-5 py-4 border-b border-slate-800 bg-slate-900 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-white text-base">
                  {jobCard.vehicle.registrationNumber} — वाहन के सभी फोटो व वीडियो
                </h3>
                <p className="text-xs text-slate-400">
                  {jobCard.vehicle.make} {jobCard.vehicle.model} • Supabase Storage Proof Gallery
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 sm:p-6 overflow-y-auto">
            {galleryContent}
          </div>
        </div>
      </div>
    );
  }

  return galleryContent;
}
