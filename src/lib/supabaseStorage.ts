import { ProofMediaItem, ProofMediaCategory, JobCard, JobAttachment } from '../types';
import { addProofMediaToJobCard, addAttachmentToJobCard } from './storage';
import { getSupabaseClient } from './supabaseClient';
import { compressImage, compressVideo } from './storageService';

export interface UploadProofMediaParams {
  jobCardId: string;
  taskId?: string; // Optional specific job/task within the job card
  taskTitle?: string;
  vehicleNumber?: string;
  customerName?: string;
  customerPhone?: string;
  file: File | Blob;
  fileName?: string;
  mediaType: 'image' | 'video';
  title: string;
  category: ProofMediaCategory;
  notes?: string;
  capturedByEmployeeId?: string;
  capturedByEmployeeName?: string;
  durationSeconds?: number;
  onProgress?: (progressPercent: number) => void;
}

export function getCategoryBadgeInfo(category: ProofMediaCategory): {
  label: string;
  hindiLabel: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
} {
  switch (category) {
    case 'BEFORE_REPAIR':
      return {
        label: 'Initial Check-in',
        hindiLabel: 'आने के समय (Before)',
        bgClass: 'bg-blue-500/15',
        textClass: 'text-blue-400',
        borderClass: 'border-blue-500/30'
      };
    case 'DURING_REPAIR':
      return {
        label: 'Work In Progress',
        hindiLabel: 'काम करते समय (In Progress)',
        bgClass: 'bg-amber-500/15',
        textClass: 'text-amber-400',
        borderClass: 'border-amber-500/30'
      };
    case 'AFTER_REPAIR_QC':
      return {
        label: 'QC & Work Done',
        hindiLabel: 'काम पूरा / QC पास (After)',
        bgClass: 'bg-emerald-500/15',
        textClass: 'text-emerald-400',
        borderClass: 'border-emerald-500/30'
      };
    case 'DEFECTIVE_PART':
      return {
        label: 'Defective / Replaced Part',
        hindiLabel: 'खराब पार्ट (Worn Out)',
        bgClass: 'bg-rose-500/15',
        textClass: 'text-rose-400',
        borderClass: 'border-rose-500/30'
      };
    case 'CUSTOMER_APPROVAL_NEEDED':
      return {
        label: 'Approval Requested',
        hindiLabel: 'ग्राहक स्वीकृति हेतु',
        bgClass: 'bg-purple-500/15',
        textClass: 'text-purple-400',
        borderClass: 'border-purple-500/30'
      };
    case 'GATE_EXIT':
      return {
        label: 'Gate Pass Handover',
        hindiLabel: 'डिलीवरी हैंडओवर (Exit)',
        bgClass: 'bg-cyan-500/15',
        textClass: 'text-cyan-400',
        borderClass: 'border-cyan-500/30'
      };
    default:
      return {
        label: 'General Proof',
        hindiLabel: 'सामान्य प्रमाण',
        bgClass: 'bg-slate-500/15',
        textClass: 'text-slate-400',
        borderClass: 'border-slate-500/30'
      };
  }
}

/**
 * Upload an image or video to Supabase Storage bucket 'proof-of-work'
 */
export async function uploadProofMedia(params: UploadProofMediaParams): Promise<ProofMediaItem> {
  const {
    jobCardId,
    taskId,
    taskTitle,
    vehicleNumber,
    customerName,
    customerPhone,
    file,
    fileName,
    mediaType,
    title,
    category,
    notes,
    capturedByEmployeeId,
    capturedByEmployeeName,
    durationSeconds,
    onProgress
  } = params;

  if (onProgress) onProgress(15);

  let uploadBlob: Blob = file;
  let originalSize = file.size;
  let compressedSize = file.size;
  let compressionRatio = 0;

  // Compress photo or video before upload to maximize Supabase Free Tier storage
  if (mediaType === 'image') {
    try {
      if (onProgress) onProgress(25);
      const comp = await compressImage(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.82 });
      uploadBlob = comp.blob;
      originalSize = comp.originalSize;
      compressedSize = comp.compressedSize;
      compressionRatio = comp.compressionRatio;
    } catch (e) {
      console.warn('[COMPRESS] Fallback to raw image:', e);
    }
  } else if (mediaType === 'video') {
    try {
      if (onProgress) onProgress(25);
      const comp = await compressVideo(file, { targetBitrate: 1000000 });
      uploadBlob = comp.blob;
      originalSize = comp.originalSize;
      compressedSize = comp.compressedSize;
      compressionRatio = comp.compressionRatio;
    } catch (e) {
      console.warn('[COMPRESS] Fallback to raw video:', e);
    }
  }

  const cleanFileName = fileName || (file instanceof File ? file.name : `proof_${Date.now()}.${mediaType === 'video' ? 'mp4' : 'jpg'}`);
  const contentType = uploadBlob.type || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg');

  // Try direct Supabase client upload first if available
  const supabase = getSupabaseClient();
  let publicUrl = '';
  let storagePath = '';

  const safeJobCardId = String(jobCardId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const ext = cleanFileName.includes('.') ? cleanFileName.split('.').pop() : (mediaType === 'video' ? 'mp4' : 'jpg');
  storagePath = `${safeJobCardId}/${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${ext}`;

  let uploadedDirectly = false;

  if (supabase && supabase.storage) {
    try {
      if (onProgress) onProgress(45);
      const { data: uploadResult, error: uploadErr } = await supabase.storage
        .from('job-attachments')
        .upload(storagePath, uploadBlob, {
          contentType,
          upsert: true
        });

      if (!uploadErr && uploadResult) {
        const { data: urlData } = supabase.storage.from('job-attachments').getPublicUrl(storagePath);
        if (urlData?.publicUrl) {
          publicUrl = urlData.publicUrl;
          uploadedDirectly = true;
          if (onProgress) onProgress(80);
        }
      }
    } catch (err) {
      console.warn('[STORAGE_CLIENT] Direct client upload failed, falling back to server API:', err);
    }
  }

  // Fallback or primary server API route
  if (!uploadedDirectly || !publicUrl) {
    if (onProgress) onProgress(50);
    const base64Data = await fileToBase64(uploadBlob);
    if (onProgress) onProgress(75);

    const res = await fetch('/api/supabase/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bucket: 'job-attachments',
        jobCardId,
        taskId,
        taskTitle,
        fileName: cleanFileName,
        contentType,
        fileBase64: base64Data,
        title,
        category,
        notes,
        capturedByEmployeeId,
        capturedByEmployeeName,
        mediaType,
        originalSize,
        compressedSize,
        compressionRatio,
        durationSeconds,
        uploader: {
          id: capturedByEmployeeId,
          name: capturedByEmployeeName || 'Workshop Staff',
          role: 'STAFF'
        }
      })
    });

    const responseText = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('[STORAGE_UPLOAD] Received non-JSON response:', responseText.substring(0, 160));
      throw new Error(`Server returned HTML (${res.status} ${res.statusText}) instead of JSON. The backend server is initializing or route is loading. Please tap Retry.`);
    }

    if (!res.ok || !data.success || !data.mediaItem) {
      throw new Error(data?.error || `Upload failed with status ${res.status}: ${res.statusText}`);
    }

    if (onProgress) onProgress(100);
    // Add to local job card state
    addProofMediaToJobCard(jobCardId, data.mediaItem);

    if (data.attachment) {
      addAttachmentToJobCard(jobCardId, data.attachment);
    }

    return data.mediaItem;
  }

  // If uploaded directly via Supabase client, build media item and update local state
  const newItem: ProofMediaItem = {
    id: `proof-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    jobCardId,
    taskId: taskId || undefined,
    taskTitle: taskTitle || undefined,
    vehicleNumber,
    customerName,
    customerPhone,
    mediaType,
    url: publicUrl,
    storagePath,
    storageBucket: 'job-attachments',
    title: title || (mediaType === 'video' ? 'Inspection Video' : 'Proof Photo'),
    category,
    notes: notes || '',
    capturedByEmployeeId,
    capturedByEmployeeName,
    capturedAt: new Date().toISOString(),
    fileSize: compressedSize,
    originalSize,
    compressionRatio,
    durationSeconds,
    mimeType: contentType
  };

  const newAttachment: JobAttachment = {
    id: newItem.id,
    jobCardId,
    taskId: taskId || undefined,
    taskTitle: taskTitle || undefined,
    url: publicUrl,
    storagePath,
    storageBucket: 'job-attachments',
    fileName: cleanFileName,
    fileType: mediaType,
    mimeType: contentType,
    fileSize: compressedSize,
    originalSize,
    compressionRatio,
    timestamp: newItem.capturedAt,
    uploader: {
      id: capturedByEmployeeId,
      name: capturedByEmployeeName || 'Workshop Staff',
      role: 'STAFF'
    },
    caption: notes || title || '',
    category
  };

  if (onProgress) onProgress(100);
  addProofMediaToJobCard(jobCardId, newItem);
  addAttachmentToJobCard(jobCardId, newAttachment);

  // Sync to server central store
  fetch('/api/central-store/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entity: 'jobCards',
      action: 'UPDATE_PROOF_MEDIA',
      jobCardId,
      mediaItem: newItem,
      attachment: newAttachment
    })
  }).catch(() => {});

  return newItem;
}

/**
 * Download a proof-of-work photo or video directly to the device
 */
export async function downloadProofMedia(mediaItem: ProofMediaItem): Promise<void> {
  const ext = mediaItem.mediaType === 'video' ? 'mp4' : 'jpg';
  const safeVeh = (mediaItem.vehicleNumber || mediaItem.jobCardId || 'Proof').replace(/[^a-zA-Z0-9]/g, '_');
  const safeCat = mediaItem.category.toLowerCase();
  const downloadFileName = `${safeVeh}_${safeCat}_${mediaItem.id.slice(-6)}.${ext}`;

  try {
    const response = await fetch(mediaItem.url, { mode: 'cors' });
    if (!response.ok) throw new Error('Failed to fetch media file for download');
    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = downloadFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(objectUrl);
  } catch (err) {
    console.warn('Direct blob download failed, opening URL in new window:', err);
    window.open(mediaItem.url, '_blank');
  }
}

/**
 * Format and share proof of work directly to WhatsApp
 */
export function shareProofOnWhatsApp(params: {
  mediaItem: ProofMediaItem;
  jobCard?: JobCard;
  targetPhone?: string;
}): void {
  const { mediaItem, jobCard, targetPhone } = params;

  const vehicleNum = mediaItem.vehicleNumber || jobCard?.vehicle?.registrationNumber || 'Vehicle';
  const vehicleModel = jobCard?.vehicle ? `${jobCard.vehicle.make} ${jobCard.vehicle.model}` : '';
  const customer = mediaItem.customerName || jobCard?.customer?.name || 'Customer';
  const phone = targetPhone || mediaItem.customerPhone || jobCard?.customer?.phone || '';
  const cleanPhone = phone.replace(/[^0-9]/g, '');

  const badgeInfo = getCategoryBadgeInfo(mediaItem.category);
  const formattedDate = new Date(mediaItem.capturedAt).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const mediaTypeEmoji = mediaItem.mediaType === 'video' ? '🎥 VIDEO' : '📸 PHOTO';

  let message = `🚗 *FixoCar Workshop - Proof of Work*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📋 *Job Card:* ${mediaItem.jobCardId}\n`;
  message += `🚘 *Vehicle:* ${vehicleNum} ${vehicleModel ? `(${vehicleModel})` : ''}\n`;
  message += `👤 *Customer:* ${customer}\n`;
  message += `🏷️ *Stage:* ${badgeInfo.label} (${badgeInfo.hindiLabel})\n`;
  message += `${mediaTypeEmoji}: *${mediaItem.title}*\n`;
  if (mediaItem.notes) {
    message += `📝 *Notes:* ${mediaItem.notes}\n`;
  }
  if (mediaItem.capturedByEmployeeName) {
    message += `🛠️ *Technician:* ${mediaItem.capturedByEmployeeName}\n`;
  }
  message += `⏰ *Recorded:* ${formattedDate}\n\n`;
  message += `🔗 *View & Download Proof from Cloud Storage:*\n`;
  message += `${mediaItem.url}\n\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📍 *FixoCar Standardized Multi-City Auto Care*`;

  // Check if Web Share API is available on mobile and user has not specified a phone
  if (!cleanPhone && typeof navigator !== 'undefined' && (navigator as any).share) {
    try {
      (navigator as any).share({
        title: `${vehicleNum} - ${mediaItem.title}`,
        text: message,
        url: mediaItem.url
      }).catch(() => {
        // Fallback to whatsapp link if user cancels or share fails
        openWhatsAppUrl(cleanPhone, message);
      });
      return;
    } catch (e) {
      // Fall through to open WhatsApp url
    }
  }

  openWhatsAppUrl(cleanPhone, message);
}

function openWhatsAppUrl(phone: string, text: string) {
  let url = '';
  // If Indian number without country code, prepend 91
  let formattedPhone = phone;
  if (formattedPhone.length === 10) {
    formattedPhone = `91${formattedPhone}`;
  }

  if (formattedPhone) {
    url = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(text)}`;
  } else {
    url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Utility: Convert File or Blob to base64 string
 */
export function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
