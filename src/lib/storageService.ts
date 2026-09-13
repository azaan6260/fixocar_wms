import { JobAttachment, JobAttachmentUploader, JobCard, ProofMediaCategory } from '../types';
import { addAttachmentToJobCard, deleteAttachmentFromJobCard } from './storage';
import { getSupabaseClient } from './supabaseClient';

export const JOB_ATTACHMENTS_BUCKET = 'job-attachments';
export const PROOF_OF_WORK_BUCKET = 'proof-of-work';

export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0, default 0.82
  mimeType?: 'image/jpeg' | 'image/webp' | 'image/png';
}

export interface CompressedImageResult {
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number; // percentage saved, e.g. 76 (%)
  width: number;
  height: number;
  dataUrl: string;
}

export interface VideoCompressionOptions {
  maxDurationSeconds?: number;
  targetBitrate?: number; // bits per second, default 1,000,000 (1 Mbps)
  targetWidth?: number;
  targetHeight?: number;
}

export interface CompressedVideoResult {
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number; // percentage saved
}

export interface UploadJobAttachmentParams {
  jobCardId: string;
  taskId?: string;
  taskTitle?: string;
  file: File | Blob;
  fileName?: string;
  fileType?: 'image' | 'video';
  caption?: string;
  category?: ProofMediaCategory | string;
  uploader?: JobAttachmentUploader;
  bucket?: string; // defaults to 'job-attachments'
  skipCompression?: boolean;
  onProgress?: (progressPercent: number) => void;
}

/**
 * Information regarding Supabase Storage Free Tier vs Alternatives
 */
export const SUPABASE_STORAGE_FREE_TIER_INFO = {
  service: 'Supabase Storage',
  tier: 'Free Plan',
  storageQuotaBytes: 1073741824, // 1 GB (1,024 MB)
  storageQuotaFormatted: '1 GB',
  egressBandwidthMonthly: '2 GB',
  maxUploadFileSize: '50 MB',
  uncompressedCapacityEstimate: '~150 - 250 high-res camera photos (at 4-6 MB each)',
  compressedCapacityEstimate: '~3,500 - 6,000 compressed photos (at 180-280 KB each with our 1600px 82% quality engine)',
  videoCapacityEstimate: '~250 - 400 15-second inspection video clips (at 1-2 MB each with 1Mbps encoding)',
  alternativesComparison: [
    {
      name: 'Supabase Storage (Current)',
      freeLimit: '1 GB Storage, 2 GB Bandwidth',
      pros: 'Direct integration with FixoCar Auth, RLS, instant Public CDN URLs, already configured in your workspace.',
      cons: '1 GB is modest if uploading uncompressed 8MB raw photos (our client compression solves this 100%).',
      recommendation: 'Optimal and best choice right now. With our client-side compression, 1 GB easily holds 4,000+ vehicle photos for zero cost.'
    },
    {
      name: 'Firebase Storage (Google Cloud)',
      freeLimit: '5 GB Storage, 1 GB/day download bandwidth',
      pros: 'Higher free quota (5 GB), excellent global Google CDN, very reliable.',
      cons: 'Requires Firebase project credentials & GCP setup; bandwidth egress is capped at 1GB/day on free Spark plan.',
      recommendation: 'Great secondary backup if your workshop reaches 1 GB in Supabase.'
    },
    {
      name: 'Cloudinary',
      freeLimit: '25 Credits/month (~25 GB storage or bandwidth)',
      pros: 'Generous free tier (25 GB), automatic on-the-fly thumbnail generation and video transcoding.',
      cons: 'Requires separate API keys, third-party vendor dependency.',
      recommendation: 'Ideal if advanced video streaming or on-the-fly transformations are needed.'
    },
    {
      name: 'AWS S3',
      freeLimit: '5 GB free for 12 months only',
      pros: 'Industry standard, unlimited scalability, ultra-cheap paid tier (~$0.023/GB/month).',
      cons: 'Free tier expires after 1 year; complex IAM policy setup required.',
      recommendation: 'Good for enterprise multi-workshop chains once budget is allocated.'
    }
  ]
};

/**
 * Compress an image file/blob using HTML5 Canvas
 * Reduces standard 4MB-8MB mobile camera photos down to 150KB-300KB
 * while retaining high-definition sharpness for scratches, paint finishes, and license plates.
 */
export async function compressImage(
  file: File | Blob,
  options: ImageCompressionOptions = {}
): Promise<CompressedImageResult> {
  const {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 0.82,
    mimeType = 'image/jpeg'
  } = options;

  const originalSize = file.size;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.onload = () => {
        let { width, height } = img;

        // Calculate aspect ratio preserving bounds
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback if canvas 2D is unavailable
          const dataUrl = reader.result as string;
          return resolve({
            blob: file,
            originalSize,
            compressedSize: originalSize,
            compressionRatio: 0,
            width: img.width,
            height: img.height,
            dataUrl
          });
        }

        // Apply high-quality bicubic smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error('Canvas compression returned empty blob'));
            }

            // If compressed size is somehow larger than original (e.g. tiny logo), keep original
            const effectiveBlob = blob.size < originalSize ? blob : file;
            const compressedSize = effectiveBlob.size;
            const compressionRatio = Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100));

            const dataUrl = canvas.toDataURL(mimeType, quality);

            resolve({
              blob: effectiveBlob,
              originalSize,
              compressedSize,
              compressionRatio,
              width,
              height,
              dataUrl
            });
          },
          mimeType,
          quality
        );
      };

      img.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Configure MediaRecorder with optimal lightweight bitrate for camera video captures
 * (1 Mbps 720p encoding = ~1.2 MB per 10 seconds, compared to 15 MB uncompressed)
 */
export function createOptimizedMediaRecorder(
  stream: MediaStream,
  options: VideoCompressionOptions = {}
): MediaRecorder {
  const targetBitrate = options.targetBitrate || 1000000; // 1 Mbps

  // Select best supported lightweight video codec
  const supportedMimeTypes = [
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=h264,opus',
    'video/webm',
    'video/mp4'
  ];

  let chosenMimeType = '';
  for (const mime of supportedMimeTypes) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
      chosenMimeType = mime;
      break;
    }
  }

  const recorderOptions: MediaRecorderOptions = {
    videoBitsPerSecond: targetBitrate
  };

  if (chosenMimeType) {
    recorderOptions.mimeType = chosenMimeType;
  }

  return new MediaRecorder(stream, recorderOptions);
}

/**
 * Compress an existing video blob if needed
 */
export async function compressVideo(
  file: File | Blob,
  options: VideoCompressionOptions = {}
): Promise<CompressedVideoResult> {
  const originalSize = file.size;

  // If video is already compact (< 2.5 MB), no re-compression needed
  if (originalSize <= 2.5 * 1024 * 1024) {
    return {
      blob: file,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 0
    };
  }

  // For uploaded video files in browser, attempt MediaStream canvas recording compression if supported
  try {
    const videoUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;

    await new Promise<void>((res, rej) => {
      video.onloadedmetadata = () => res();
      video.onerror = () => rej(new Error('Video metadata loading failed'));
      setTimeout(() => rej(new Error('Video load timeout')), 4000);
    });

    const targetWidth = Math.min(1280, video.videoWidth || 1280);
    const targetHeight = Math.round(targetWidth * ((video.videoHeight || 720) / (video.videoWidth || 1280)));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx || typeof (canvas as any).captureStream !== 'function') {
      URL.revokeObjectURL(videoUrl);
      return {
        blob: file,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 0
      };
    }

    const stream = (canvas as any).captureStream(24);
    const recorder = createOptimizedMediaRecorder(stream, options);
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    const transcodePromise = new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        const compressedBlob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
        resolve(compressedBlob);
      };
    });

    recorder.start(100);
    video.play();

    const drawFrame = () => {
      if (!video.paused && !video.ended) {
        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
        requestAnimationFrame(drawFrame);
      }
    };
    drawFrame();

    await new Promise<void>((resolve) => {
      video.onended = () => resolve();
      // Cap at max 45 seconds or duration
      const duration = Math.min(video.duration || 30, 45);
      setTimeout(resolve, (duration + 1) * 1000);
    });

    if (recorder.state === 'recording') {
      recorder.stop();
    }
    video.pause();
    URL.revokeObjectURL(videoUrl);

    const compressedBlob = await transcodePromise;
    const effectiveBlob = compressedBlob.size < originalSize ? compressedBlob : file;
    const compressedSize = effectiveBlob.size;
    const compressionRatio = Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100));

    return {
      blob: effectiveBlob,
      originalSize,
      compressedSize,
      compressionRatio
    };
  } catch (err) {
    console.warn('[COMPRESS_VIDEO] In-browser video transcode skipped, using original blob:', err);
    return {
      blob: file,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 0
    };
  }
}

/**
 * Retrieve public URL for a file in Supabase Storage
 */
export function getPublicAttachmentUrl(
  storagePath: string,
  bucket: string = JOB_ATTACHMENTS_BUCKET
): string {
  const supabase = getSupabaseClient();
  if (supabase && supabase.storage) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
    if (data?.publicUrl) return data.publicUrl;
  }

  // Construct standard Supabase public storage URL
  const baseUrl = (typeof window !== 'undefined' && (window as any).__SUPABASE_URL) ||
    'https://bacclguxbbdmbutnoylw.supabase.co';
  return `${baseUrl}/storage/v1/object/public/${bucket}/${storagePath}`;
}

/**
 * Upload an image or video to Supabase Storage 'job-attachments' bucket.
 * Automatically compresses image/video before uploading to maximize free storage.
 * Updates the JobCard model with attachment metadata (URL, timestamp, uploader, etc.).
 */
export async function uploadJobAttachment(
  params: UploadJobAttachmentParams
): Promise<JobAttachment> {
  const {
    jobCardId,
    taskId,
    taskTitle,
    file,
    fileName,
    fileType: explicitFileType,
    caption,
    category = 'DURING_REPAIR',
    uploader = { name: 'Technician / Manager', role: 'STAFF' },
    bucket = JOB_ATTACHMENTS_BUCKET,
    skipCompression = false,
    onProgress
  } = params;

  if (onProgress) onProgress(10);

  // 1. Detect media type
  const isVideo = explicitFileType === 'video' || file.type.startsWith('video/') || (fileName && /\.(mp4|mov|webm|avi|mkv)$/i.test(fileName));
  const fileType: 'image' | 'video' = isVideo ? 'video' : 'image';

  let uploadBlob: Blob = file;
  let originalSize = file.size;
  let compressedSize = file.size;
  let compressionRatio = 0;

  // 2. Perform Client-Side Compression before storage
  if (!skipCompression) {
    if (fileType === 'image') {
      try {
        if (onProgress) onProgress(20);
        const comp = await compressImage(file, {
          maxWidth: 1600,
          maxHeight: 1600,
          quality: 0.82,
          mimeType: 'image/jpeg'
        });
        uploadBlob = comp.blob;
        originalSize = comp.originalSize;
        compressedSize = comp.compressedSize;
        compressionRatio = comp.compressionRatio;
        if (onProgress) onProgress(45);
      } catch (e) {
        console.warn('[STORAGE_SERVICE] Image compression fallback to raw file:', e);
      }
    } else if (fileType === 'video') {
      try {
        if (onProgress) onProgress(20);
        const comp = await compressVideo(file, {
          targetBitrate: 1000000 // 1 Mbps
        });
        uploadBlob = comp.blob;
        originalSize = comp.originalSize;
        compressedSize = comp.compressedSize;
        compressionRatio = comp.compressionRatio;
        if (onProgress) onProgress(45);
      } catch (e) {
        console.warn('[STORAGE_SERVICE] Video compression fallback to raw file:', e);
      }
    }
  }

  // 3. Generate clean storage path
  const safeJobCardId = String(jobCardId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const baseName = fileName || (file instanceof File ? file.name : `attachment_${Date.now()}`);
  const ext = baseName.includes('.') ? baseName.split('.').pop() : (fileType === 'video' ? 'mp4' : 'jpg');
  const cleanExt = (ext || 'jpg').toLowerCase();
  const storagePath = `${safeJobCardId}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${cleanExt}`;
  const contentType = uploadBlob.type || (fileType === 'video' ? 'video/mp4' : 'image/jpeg');

  // 4. Upload to Supabase Storage
  let publicUrl = '';
  const supabase = getSupabaseClient();

  if (supabase && supabase.storage) {
    try {
      if (onProgress) onProgress(55);
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(storagePath, uploadBlob, {
          contentType,
          upsert: true
        });

      if (!uploadErr && uploadData) {
        publicUrl = getPublicAttachmentUrl(storagePath, bucket);
        if (onProgress) onProgress(85);
      } else if (uploadErr) {
        console.warn('[STORAGE_SERVICE] Direct client upload returned error, trying server fallback:', uploadErr);
      }
    } catch (err) {
      console.warn('[STORAGE_SERVICE] Direct upload failed, falling back to server route:', err);
    }
  }

  // Fallback to Server API route
  if (!publicUrl) {
    if (onProgress) onProgress(60);
    const base64Data = await blobToBase64(uploadBlob);
    if (onProgress) onProgress(75);

    const res = await fetch('/api/supabase/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bucket,
        jobCardId,
        taskId,
        taskTitle,
        fileName: `${Date.now()}_attachment.${cleanExt}`,
        contentType,
        fileBase64: base64Data,
        title: caption || `${fileType === 'video' ? 'Video' : 'Photo'} Attachment`,
        category,
        notes: caption,
        capturedByEmployeeId: uploader.id,
        capturedByEmployeeName: uploader.name,
        mediaType: fileType,
        uploader,
        originalSize,
        compressedSize,
        compressionRatio
      })
    });

    const responseText = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('[STORAGE_UPLOAD] Non-JSON response received:', responseText.substring(0, 160));
      throw new Error(`Server returned non-JSON response (${res.status} ${res.statusText}). Please retry.`);
    }

    if (!res.ok || !data.success || !data.publicUrl) {
      throw new Error(data?.error || `Storage upload rejected (${res.status} ${res.statusText})`);
    }
    publicUrl = data.publicUrl;
  }

  // 5. Construct JobAttachment metadata
  const attachmentId = `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const attachment: JobAttachment = {
    id: attachmentId,
    jobCardId,
    taskId: taskId || undefined,
    taskTitle: taskTitle || undefined,
    url: publicUrl,
    storagePath,
    storageBucket: bucket,
    fileName: baseName,
    fileType,
    mimeType: contentType,
    fileSize: compressedSize,
    originalSize,
    compressionRatio,
    timestamp: new Date().toISOString(),
    uploader: {
      id: uploader.id,
      name: uploader.name || 'Workshop Staff',
      role: uploader.role || 'STAFF'
    },
    caption: caption || '',
    category
  };

  // 6. Update JobCard in storage & Central Store
  addAttachmentToJobCard(jobCardId, attachment);

  if (onProgress) onProgress(100);
  return attachment;
}

/**
 * Delete a job attachment from Supabase Storage and remove it from JobCard
 */
export async function deleteJobAttachment(
  jobCardId: string,
  attachmentId: string,
  storagePath?: string,
  bucket: string = JOB_ATTACHMENTS_BUCKET
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (supabase && supabase.storage && storagePath) {
    try {
      await supabase.storage.from(bucket).remove([storagePath]);
    } catch (e) {
      console.warn('[STORAGE_SERVICE] Direct client delete error:', e);
    }
  }

  return deleteAttachmentFromJobCard(jobCardId, attachmentId, storagePath, bucket);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to convert blob to base64'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}
