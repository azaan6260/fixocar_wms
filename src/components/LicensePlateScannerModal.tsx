import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  X, 
  RefreshCw, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Car, 
  SwitchCamera, 
  Zap,
  Image as ImageIcon,
  Keyboard,
  History,
  ScanLine,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Sliders,
  Crop,
  Sun
} from 'lucide-react';

interface LicensePlateScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: (plateNumber: string) => void;
}

const SAMPLE_TEST_PLATES = [
  { plate: 'MH12AB1234', label: 'MH-12-AB-1234 (Pune White Hatchback)', color: 'White' },
  { plate: 'DL01CA9988', label: 'DL-01-CA-9988 (Delhi Grey SUV)', color: 'Grey' },
  { plate: 'KA05MH8822', label: 'KA-05-MH-8822 (Bengaluru Silver Sedan)', color: 'Silver' },
  { plate: 'HR26DQ5511', label: 'HR-26-DQ-5511 (Gurugram Black Luxury)', color: 'Black' },
  { plate: 'GJ01CB4321', label: 'GJ-01-CB-4321 (Ahmedabad Red Compact)', color: 'Red' },
];

export function LicensePlateScannerModal({
  isOpen,
  onClose,
  onScanComplete,
}: LicensePlateScannerModalProps) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'camera' | 'upload' | 'manual'>('camera');
  const [manualPlate, setManualPlate] = useState('');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanMeta, setScanMeta] = useState<{ vehicleType?: string; vehicleColor?: string; confidence?: string } | null>(null);
  const [confidenceError, setConfidenceError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [recentScans, setRecentScans] = useState<string[]>([]);

  // Optical OCR Enhancements & Zoom State
  const [zoomLevel, setZoomLevel] = useState<number>(1.5); // Default 1.5x zoom for close plate alignment
  const [cropCenterOnly, setCropCenterOnly] = useState<boolean>(true); // Focus on alignment frame
  const [autoEnhance, setAutoEnhance] = useState<boolean>(true); // Apply contrast boost
  const [uploadZoom, setUploadZoom] = useState<number>(1.0); // Zoom for uploaded photos

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load recent scans from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('autocraft_recent_scanned_plates');
      if (stored) {
        setRecentScans(JSON.parse(stored));
      }
    } catch (e) {
      console.warn("Could not load recent scans", e);
    }
  }, []);

  const saveRecentScan = (plate: string) => {
    try {
      const cleaned = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!cleaned || cleaned.length < 3) return;
      const filtered = recentScans.filter((p) => p !== cleaned);
      const updated = [cleaned, ...filtered].slice(0, 8);
      setRecentScans(updated);
      localStorage.setItem('autocraft_recent_scanned_plates', JSON.stringify(updated));
    } catch (e) {
      console.warn("Could not save recent scan", e);
    }
  };

  // Start Camera Stream when Modal opens & Tab is 'camera'
  useEffect(() => {
    let currentStream: MediaStream | null = null;

    if (isOpen && activeTab === 'camera') {
      setCameraError(null);
      
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      };

      navigator.mediaDevices?.getUserMedia(constraints)
        .then((mediaStream) => {
          currentStream = mediaStream;
          setStream(mediaStream);
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
          }

          // Try hardware zoom constraint if supported
          const track = mediaStream.getVideoTracks()[0];
          if (track && 'getCapabilities' in track) {
            const capabilities = (track as any).getCapabilities?.();
            if (capabilities && capabilities.zoom) {
              (track as any).applyConstraints({
                advanced: [{ zoom: Math.min(zoomLevel, capabilities.zoom.max || 3) }]
              }).catch(() => {});
            }
          }
        })
        .catch((err) => {
          console.warn("Camera access error:", err);
          navigator.mediaDevices?.getUserMedia({ video: true })
            .then((mediaStream) => {
              currentStream = mediaStream;
              setStream(mediaStream);
              if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
              }
            })
            .catch((fallbackErr) => {
              console.error("Camera permissions denied or unavailable:", fallbackErr);
              setCameraError(
                "Unable to access camera directly in preview. You can upload a photo file or select from sample registration plates below."
              );
            });
        });
    }

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen, activeTab, facingMode]);

  // Clean up camera stream on close
  const handleClose = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setScanResult(null);
    setCapturedImage(null);
    setIsScanning(false);
    setManualPlate('');
    setScanMeta(null);
    onClose();
  };

  const toggleCameraFacing = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const compressImageBase64 = (base64Str: string, maxWidth = 1600, maxHeight = 1600, quality = 0.9): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          if (autoEnhance) {
            ctx.filter = 'contrast(1.25) brightness(1.05) saturate(1.1)';
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(base64Str);
        }
      };
      img.onerror = () => resolve(base64Str);
    });
  };

  const processImageForOCR = async (imageBase64: string, isFallbackPass = false) => {
    setIsScanning(true);
    setConfidenceError(null);
    if (!isFallbackPass) {
      setScanResult(null);
      setScanMeta(null);
    }

    try {
      const compressedImage = await compressImageBase64(imageBase64, 1600, 1600, 0.92);

      let data: any = null;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch('/api/scan-plate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: compressedImage }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          data = await response.json();
        } else {
          const errText = await response.text().catch(() => '');
          console.warn("Scan plate server response error:", response.status, errText);
        }
      } catch (fetchErr: any) {
        console.warn("API request failed or timed out:", fetchErr);
      }

      if (data && data.success && data.plateNumber && data.plateNumber !== 'UNKNOWN') {
        const cleanedPlate = data.plateNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
        setScanResult(cleanedPlate);
        setManualPlate(cleanedPlate);
        setScanMeta({
          vehicleType: data.vehicleType,
          vehicleColor: data.vehicleColor,
          confidence: data.confidence || 'high'
        });
        setConfidenceError(null);
        saveRecentScan(cleanedPlate);
      } else if (!isFallbackPass && videoRef.current && canvasRef.current) {
        // First pass failed — automatically try full-frame uncropped image as fallback
        console.log("Zoomed crop OCR failed, attempting full-frame fallback scan...");
        captureFullFrameFallback();
      } else {
        // Both passes failed
        setScanResult(null);
        const errMsg = data?.error || "Could not clearly read vehicle registration plate from image.";
        setConfidenceError(`${errMsg} Use the Zoom buttons above to bring the plate closer, select a sample plate, or enter manually below.`);
      }
    } catch (err: any) {
      console.error("Plate OCR API error:", err);
      if (!isFallbackPass) {
        captureFullFrameFallback();
      } else {
        setScanResult(null);
        setConfidenceError("OCR request failed. Please use zoom controls or enter registration number manually.");
      }
    } finally {
      setIsScanning(false);
    }
  };

  // Full frame fallback capture
  const captureFullFrameFallback = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const fullFrameDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    processImageForOCR(fullFrameDataUrl, true);
  };

  // Capture frame with high precision digital zoom & center crop
  const captureFrameFromCamera = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const rawWidth = video.videoWidth || 1280;
    const rawHeight = video.videoHeight || 720;

    // Output target resolution
    const outputWidth = 1280;
    const outputHeight = 720;

    canvas.width = outputWidth;
    canvas.height = outputHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Apply auto-contrast & sharpening filter for clear character reading
    if (autoEnhance) {
      ctx.filter = 'contrast(1.3) brightness(1.05) saturate(1.1)';
    } else {
      ctx.filter = 'none';
    }

    if (cropCenterOnly || zoomLevel > 1.0) {
      // Crop the center region where the license plate alignment box is shown
      // At zoom 1.0 + cropCenter, we crop 65% width and 35% height
      // At higher zoom levels, we zoom in even tighter
      const effectiveZoom = zoomLevel;
      const cropW = Math.round(rawWidth / effectiveZoom);
      const cropH = Math.round(rawHeight / effectiveZoom);
      const cropX = Math.max(0, Math.round((rawWidth - cropW) / 2));
      const cropY = Math.max(0, Math.round((rawHeight - cropH) / 2));

      ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, outputWidth, outputHeight);
    } else {
      // Full frame without crop
      ctx.drawImage(video, 0, 0, rawWidth, rawHeight, 0, 0, outputWidth, outputHeight);
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setCapturedImage(dataUrl);

    processImageForOCR(dataUrl);
  };

  // Process uploaded image with digital zoom/crop support
  const processUploadedImageWithZoom = (base64Str: string, zoom: number) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const w = img.width;
      const h = img.height;
      
      canvas.width = 1280;
      canvas.height = Math.round((h / w) * 1280) || 720;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (autoEnhance) {
          ctx.filter = 'contrast(1.25) brightness(1.05)';
        }

        if (zoom > 1.0) {
          const cropW = w / zoom;
          const cropH = h / zoom;
          const cropX = (w - cropW) / 2;
          const cropY = (h - cropH) / 2;
          ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
        } else {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        }

        const zoomedBase64 = canvas.toDataURL('image/jpeg', 0.92);
        setCapturedImage(zoomedBase64);
        processImageForOCR(zoomedBase64);
      } else {
        setCapturedImage(base64Str);
        processImageForOCR(base64Str);
      }
    };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setCapturedImage(base64);
      processUploadedImageWithZoom(base64, uploadZoom);
    };
    reader.readAsDataURL(file);
  };

  const handleSelectPlate = (plateNumber: string) => {
    const cleaned = plateNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleaned) {
      saveRecentScan(cleaned);
      onScanComplete(cleaned);
      handleClose();
    }
  };

  // Format license plate nicely (e.g., MH12AB1234 -> MH 12 AB 1234)
  const formatPlateDisplay = (raw: string) => {
    const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.length === 10) {
      return `${clean.slice(0, 2)} ${clean.slice(2, 4)} ${clean.slice(4, 6)} ${clean.slice(6)}`;
    }
    return clean;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full shadow-2xl overflow-hidden my-auto flex flex-col max-h-[94vh]">
        
        {/* Modal Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/20">
              <ScanLine className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black flex items-center gap-2">
                <span>License Plate Scanner</span>
                <span className="bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 rounded-full font-bold border border-amber-500/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" /> Gemini AI
                </span>
              </h2>
              <p className="text-xs text-slate-400">HD Optical Character Recognition with Digital Zoom</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between px-5 pt-3 pb-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('camera')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shrink-0 ${
                activeTab === 'camera'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Live Camera</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shrink-0 ${
                activeTab === 'upload'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Upload Photo</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('manual')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shrink-0 ${
                activeTab === 'manual'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Keyboard className="w-4 h-4" />
              <span>Manual Entry</span>
            </button>
          </div>

          {activeTab === 'camera' && stream && (
            <button
              type="button"
              onClick={toggleCameraFacing}
              title="Switch Camera"
              className="p-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 transition-all flex items-center gap-1 text-xs font-bold shrink-0 ml-2"
            >
              <SwitchCamera className="w-4 h-4" />
              <span className="hidden sm:inline">Flip</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
          {activeTab === 'camera' ? (
            <div className="space-y-3">
              {cameraError ? (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-center space-y-3 text-amber-800 dark:text-amber-200">
                  <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                  <p className="font-bold text-xs">{cameraError}</p>
                  <div className="pt-2 flex flex-wrap gap-2 justify-center">
                    <button
                      type="button"
                      onClick={() => setActiveTab('upload')}
                      className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-black hover:bg-amber-400 transition-all shadow-md flex items-center gap-1.5"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Upload Photo File</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('manual')}
                      className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold hover:bg-slate-300 transition-all"
                    >
                      Enter Plate Manually
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Digital Zoom Controls Toolbar */}
                  <div className="bg-slate-900 p-2.5 rounded-2xl border border-slate-800 flex items-center justify-between text-white text-xs gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                        <ZoomIn className="w-3.5 h-3.5 text-amber-400" /> Zoom:
                      </span>
                      <div className="flex items-center bg-slate-800 rounded-xl p-0.5 border border-slate-700">
                        {[1.0, 1.5, 2.0, 3.0].map((level) => (
                          <button
                            key={level}
                            type="button"
                            onClick={() => setZoomLevel(level)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all ${
                              zoomLevel === level
                                ? 'bg-amber-500 text-slate-950 shadow-sm'
                                : 'text-slate-300 hover:text-white'
                            }`}
                          >
                            {level}x
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Contrast Enhance Toggle */}
                      <button
                        type="button"
                        onClick={() => setAutoEnhance(!autoEnhance)}
                        className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1 border transition-all ${
                          autoEnhance
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                        title="Auto Contrast Sharpening for OCR"
                      >
                        <Sun className="w-3 h-3" />
                        <span>HDR</span>
                      </button>

                      {/* Center Crop Toggle */}
                      <button
                        type="button"
                        onClick={() => setCropCenterOnly(!cropCenterOnly)}
                        className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1 border transition-all ${
                          cropCenterOnly
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                        title="Crop plate region for maximum sharpness"
                      >
                        <Crop className="w-3 h-3" />
                        <span>Plate Crop</span>
                      </button>
                    </div>
                  </div>

                  {/* Camera Viewport with Live Scale */}
                  <div className="relative bg-slate-950 rounded-2xl overflow-hidden aspect-4/3 flex items-center justify-center shadow-inner group border border-slate-800">
                    <div 
                      className="w-full h-full transition-transform duration-300 origin-center"
                      style={{ transform: `scale(${zoomLevel})` }}
                    >
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* License Plate Alignment Overlay */}
                    <div className="absolute inset-0 pointer-events-none border-2 border-amber-500/40 m-6 rounded-2xl flex items-center justify-center z-10">
                      <div className="w-64 h-24 border-2 border-dashed border-amber-400 bg-amber-500/15 rounded-xl flex items-center justify-center relative overflow-hidden shadow-2xl">
                        <span className="text-[10px] font-black uppercase text-amber-300 tracking-widest bg-slate-900/90 px-2.5 py-1 rounded-md border border-amber-500/30">
                          Align License Plate Here ({zoomLevel}x)
                        </span>
                        {/* Scanning Laser Line */}
                        <div className="absolute inset-x-0 h-0.5 bg-amber-400 shadow-[0_0_12px_#f59e0b] animate-bounce opacity-90" />
                      </div>
                    </div>

                    {/* Scanning Spinner Overlay */}
                    {isScanning && (
                      <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center z-20 space-y-3">
                        <div className="relative flex items-center justify-center">
                          <div className="w-16 h-16 rounded-full border-4 border-amber-500/30 animate-ping absolute" />
                          <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/50 flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.5)]">
                            <Zap className="w-7 h-7 animate-pulse text-amber-400" />
                          </div>
                        </div>
                        <div className="text-center space-y-1">
                          <span className="text-amber-400 font-black text-sm tracking-wider uppercase block animate-pulse">
                            Scanning Zoomed Plate...
                          </span>
                          <span className="text-[11px] text-slate-300 font-semibold">
                            Extracting Vehicle Registration via Gemini AI
                          </span>
                        </div>
                      </div>
                    )}

                    <canvas ref={canvasRef} className="hidden" />

                    {/* Capture Button Overlay */}
                    <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-3 z-10">
                      <button
                        type="button"
                        onClick={captureFrameFromCamera}
                        disabled={isScanning}
                        className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs flex items-center gap-2 shadow-xl shadow-amber-500/40 transition-all disabled:opacity-50"
                      >
                        {isScanning ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>AI Reading Plate...</span>
                          </>
                        ) : (
                          <>
                            <Camera className="w-4 h-4" />
                            <span>Snap & Scan Plate ({zoomLevel}x)</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'upload' ? (
            /* Upload File Tab */
            <div className="space-y-4">
              <div className="bg-slate-900 p-3 rounded-2xl border border-slate-800 flex items-center justify-between text-white text-xs">
                <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                  <ZoomIn className="w-3.5 h-3.5 text-amber-400" /> Crop Zoom for Uploaded Photo:
                </span>
                <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-xl">
                  {[1.0, 1.5, 2.0, 2.5].map((z) => (
                    <button
                      key={z}
                      type="button"
                      onClick={() => {
                        setUploadZoom(z);
                        if (capturedImage) {
                          processUploadedImageWithZoom(capturedImage, z);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all ${
                        uploadZoom === z
                          ? 'bg-amber-500 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {z}x
                    </button>
                  ))}
                </div>
              </div>

              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500 dark:hover:border-amber-500 rounded-2xl p-8 text-center cursor-pointer bg-slate-50 dark:bg-slate-800/40 transition-all space-y-3 group"
              >
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-black text-slate-900 dark:text-slate-100 text-sm">Click to Select Vehicle Photo</p>
                  <p className="text-slate-500 text-xs mt-1">Select any JPG, PNG or WEBP vehicle photo</p>
                </div>
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs"
                >
                  Browse Image Files
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          ) : (
            /* Manual Entry Tab */
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold shrink-0">
                    <Keyboard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white text-sm">Manual License Plate Entry</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-xs">Directly enter or correct the vehicle registration plate text</p>
                  </div>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (manualPlate.trim().length >= 3) {
                      handleSelectPlate(manualPlate);
                    }
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Vehicle Registration Number
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={manualPlate}
                        onChange={(e) => setManualPlate(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                        placeholder="e.g. MH12AB1234 or DL01CA9988"
                        maxLength={12}
                        className="w-full px-4 py-3.5 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 focus:border-amber-500 dark:focus:border-amber-500 rounded-xl font-mono text-xl font-black tracking-wider text-slate-900 dark:text-white uppercase outline-none transition-all shadow-inner"
                        autoFocus
                      />
                      {manualPlate && (
                        <button
                          type="button"
                          onClick={() => setManualPlate('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={manualPlate.trim().length < 3}
                    className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Select Plate ({manualPlate || '...'})</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Captured Image Preview & Quick Zoom Re-Scan */}
          {capturedImage && activeTab !== 'manual' && (
            <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span>Cropped OCR Image Sent to Gemini AI</span>
                {isScanning && (
                  <span className="text-amber-500 flex items-center gap-1 font-bold animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Processing AI OCR...
                  </span>
                )}
              </div>

              <div className="h-32 rounded-xl overflow-hidden bg-slate-950 relative border border-slate-700">
                <img
                  src={capturedImage}
                  alt="Captured vehicle plate"
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          )}

          {/* Detected Plate Output Card */}
          {scanResult && activeTab !== 'manual' && (
            <div className="bg-emerald-500/10 border-2 border-emerald-500/40 rounded-2xl p-4 space-y-3 text-emerald-900 dark:text-emerald-200 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xs flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" /> License Plate Recognized
                </span>
                {scanMeta?.confidence && (
                  <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded-md font-mono font-bold text-emerald-700 dark:text-emerald-300 capitalize">
                    {scanMeta.confidence} AI Confidence
                  </span>
                )}
              </div>

              {/* Realistic License Plate Graphics */}
              <div className="bg-amber-400 text-slate-950 px-5 py-3 rounded-2xl border-4 border-slate-900 shadow-xl flex items-center justify-between relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-8 bg-blue-700 flex flex-col items-center justify-between py-1 text-white text-[9px] font-black">
                  <span>IND</span>
                  <div className="w-3 h-3 rounded-full border border-white flex items-center justify-center text-[7px]">🇮🇳</div>
                </div>
                <div className="pl-6">
                  <span className="text-[9px] uppercase font-black tracking-widest text-slate-800 block opacity-75">Vehicle Registration</span>
                  <span className="font-mono text-2xl font-black tracking-widest uppercase">{formatPlateDisplay(scanResult)}</span>
                  {(scanMeta?.vehicleType || scanMeta?.vehicleColor) && (
                    <span className="text-[10px] font-bold text-slate-800 block mt-0.5">
                      {[scanMeta.vehicleColor, scanMeta.vehicleType].filter(Boolean).join(' • ')}
                    </span>
                  )}
                </div>
                <Car className="w-8 h-8 text-slate-900 opacity-80" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectPlate(scanResult)}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Use Plate ({scanResult})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('manual');
                    setManualPlate(scanResult);
                  }}
                  className="w-full py-3 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-amber-500/20 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition-all border border-slate-300 dark:border-slate-600"
                >
                  <Keyboard className="w-4 h-4" />
                  <span>Edit Number</span>
                </button>
              </div>
            </div>
          )}

          {confidenceError && (
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-800 dark:text-amber-300 text-xs font-medium space-y-2">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Plate Detection Notice</span>
              </div>
              <p>{confidenceError}</p>
            </div>
          )}

          {/* Quick Preset Sample License Plates */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
            <span className="text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider block flex items-center gap-1">
              <Car className="w-3.5 h-3.5 text-amber-500" /> One-Click Test Registration Plates
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SAMPLE_TEST_PLATES.map((sample) => (
                <button
                  key={sample.plate}
                  type="button"
                  onClick={() => handleSelectPlate(sample.plate)}
                  className="p-2.5 rounded-2xl bg-slate-100 hover:bg-amber-500/20 dark:bg-slate-800 dark:hover:bg-amber-500/20 border border-slate-200 dark:border-slate-700 hover:border-amber-500 text-left transition-all group flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <span className="font-mono font-black text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 text-xs block">
                      {sample.plate}
                    </span>
                    <span className="text-[10px] text-slate-500 block truncate">{sample.label}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-500 shrink-0 transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          </div>

          {/* Recent Scans History */}
          {recentScans.length > 0 && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <span className="text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider block flex items-center gap-1">
                <History className="w-3.5 h-3.5 text-slate-400" /> Recently Scanned Vehicles
              </span>
              <div className="flex flex-wrap gap-2">
                {recentScans.map((plate) => (
                  <button
                    key={plate}
                    type="button"
                    onClick={() => handleSelectPlate(plate)}
                    className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-amber-500/20 dark:bg-slate-800 dark:hover:bg-amber-500/20 text-slate-800 dark:text-slate-200 font-mono font-bold text-xs border border-slate-300 dark:border-slate-700 transition-all flex items-center gap-1.5"
                  >
                    <span>{plate}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs hover:bg-slate-300 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
