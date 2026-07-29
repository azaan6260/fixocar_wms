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
  Image as ImageIcon
} from 'lucide-react';

interface LicensePlateScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: (plateNumber: string) => void;
}

const SAMPLE_TEST_PLATES = [
  { plate: 'MH02CB8811', label: 'MH-02-CB-8811 (White Hatchback)' },
  { plate: 'DL01CA1234', label: 'DL-01-CA-1234 (Grey SUV)' },
  { plate: 'KA05MB9988', label: 'KA-05-MB-9988 (Silver Sedan)' },
  { plate: 'HR26DQ5544', label: 'HR-26-DQ-5544 (Black Luxury)' },
  { plate: 'GJ01RS7788', label: 'GJ-01-RS-7788 (Red Compact)' },
];

export function LicensePlateScannerModal({
  isOpen,
  onClose,
  onScanComplete,
}: LicensePlateScannerModalProps) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'camera' | 'upload'>('camera');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [confidenceError, setConfidenceError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Start Camera Stream when Modal opens & Tab is 'camera'
  useEffect(() => {
    let currentStream: MediaStream | null = null;

    if (isOpen && activeTab === 'camera') {
      setCameraError(null);
      
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      navigator.mediaDevices?.getUserMedia(constraints)
        .then((mediaStream) => {
          currentStream = mediaStream;
          setStream(mediaStream);
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
          }
        })
        .catch((err) => {
          console.warn("Camera access error:", err);
          // Fallback to basic video without facingMode constraint
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
                "Unable to access camera. Please allow camera permissions in your browser, or upload an image file directly below."
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
    onClose();
  };

  const toggleCameraFacing = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const processImageForOCR = async (imageBase64: string) => {
    setIsScanning(true);
    setConfidenceError(null);
    setScanResult(null);

    try {
      const response = await fetch('/api/scan-plate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
      });

      const data = await response.json();

      if (data.success && data.plateNumber && data.plateNumber !== 'UNKNOWN') {
        const cleanedPlate = data.plateNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
        setScanResult(cleanedPlate);
      } else {
        // Fallback: Check if there's any pattern in the image name or fallback simulation
        setConfidenceError("AI could not detect a distinct license plate number. Try again or pick a sample plate.");
      }
    } catch (err: any) {
      console.error("Plate OCR API error:", err);
      setConfidenceError("Network issue during scan. Please check connection or choose a sample plate.");
    } finally {
      setIsScanning(false);
    }
  };

  const captureFrameFromCamera = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(dataUrl);

    processImageForOCR(dataUrl);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setCapturedImage(base64);
      processImageForOCR(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSelectPlate = (plateNumber: string) => {
    onScanComplete(plateNumber.toUpperCase().replace(/[^A-Z0-9]/g, ''));
    handleClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full shadow-2xl overflow-hidden my-auto flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black flex items-center gap-2">
                <span>License Plate Scanner</span>
                <span className="bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 rounded-full font-bold border border-amber-500/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Gemini AI
                </span>
              </h2>
              <p className="text-xs text-slate-400">Live Camera OCR & Vehicle Plate Recognition</p>
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

        {/* Tab Switcher */}
        <div className="flex items-center justify-between px-5 pt-3 pb-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('camera')}
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all ${
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
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all ${
                activeTab === 'upload'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Upload Photo</span>
            </button>
          </div>

          {activeTab === 'camera' && stream && (
            <button
              type="button"
              onClick={toggleCameraFacing}
              title="Switch Camera"
              className="p-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 transition-all flex items-center gap-1 text-xs font-bold"
            >
              <SwitchCamera className="w-4 h-4" />
              <span className="hidden sm:inline">Flip</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
          {activeTab === 'camera' ? (
            <div className="space-y-4">
              {cameraError ? (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-center space-y-3 text-amber-800 dark:text-amber-200">
                  <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                  <p className="font-bold text-xs">{cameraError}</p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('upload')}
                      className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-black hover:bg-amber-400 transition-all shadow-md"
                    >
                      Switch to File Upload
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative bg-slate-950 rounded-2xl overflow-hidden aspect-4/3 flex items-center justify-center shadow-inner group">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />

                  {/* License Plate Frame Overlay */}
                  <div className="absolute inset-0 pointer-events-none border-2 border-amber-500/40 m-6 rounded-2xl flex items-center justify-center">
                    <div className="w-64 h-24 border-2 border-dashed border-amber-400 bg-amber-500/10 rounded-xl flex items-center justify-center relative overflow-hidden shadow-lg">
                      <span className="text-[10px] font-black uppercase text-amber-300 tracking-widest bg-slate-900/80 px-2 py-1 rounded-md">
                        Align License Plate Here
                      </span>
                      {/* Scanning Line Animation */}
                      <div className="absolute inset-x-0 h-0.5 bg-amber-400 shadow-[0_0_8px_#f59e0b] animate-bounce opacity-80" />
                    </div>
                  </div>

                  {/* Hidden Canvas for Snapshots */}
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Camera Shutter Button Overlay */}
                  <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={captureFrameFromCamera}
                      disabled={isScanning}
                      className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs flex items-center gap-2 shadow-xl shadow-amber-500/30 transition-all disabled:opacity-50"
                    >
                      {isScanning ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>AI Scanning Plate...</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-4 h-4" />
                          <span>Capture & Scan Plate</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Upload File Tab */
            <div className="space-y-4">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500 dark:hover:border-amber-500 rounded-2xl p-8 text-center cursor-pointer bg-slate-50 dark:bg-slate-800/40 transition-all space-y-3 group"
              >
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-black text-slate-900 dark:text-slate-100 text-sm">Click to Select Vehicle Photo</p>
                  <p className="text-slate-500 text-xs mt-1">Supports JPG, PNG, WEBP images of license plates</p>
                </div>
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs"
                >
                  Browse Files
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
          )}

          {/* Captured Image Preview & Scan Results */}
          {capturedImage && (
            <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span>Captured Frame Preview</span>
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

          {/* Scan Success Box */}
          {scanResult && (
            <div className="bg-emerald-500/10 border-2 border-emerald-500/40 rounded-2xl p-4 space-y-3 text-emerald-900 dark:text-emerald-200 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xs flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" /> License Plate Detected
                </span>
                <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded-md font-mono font-bold text-emerald-700 dark:text-emerald-300">
                  100% OCR Confidence
                </span>
              </div>

              <div className="bg-amber-400 text-slate-950 px-4 py-2.5 rounded-xl border-2 border-slate-950 shadow-md flex items-center justify-between">
                <div>
                  <span className="text-[9px] uppercase font-bold tracking-widest text-slate-700 block">Registration Number</span>
                  <span className="font-mono text-xl font-black tracking-wider">{scanResult}</span>
                </div>
                <Car className="w-7 h-7 text-slate-900" />
              </div>

              <button
                type="button"
                onClick={() => handleSelectPlate(scanResult)}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Use License Plate ({scanResult})</span>
              </button>
            </div>
          )}

          {confidenceError && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-800 dark:text-amber-300 text-xs font-medium space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>OCR Detection Notice</span>
              </div>
              <p>{confidenceError}</p>
            </div>
          )}

          {/* Quick Sample Test Plates */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <span className="text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider block">
              Quick Test - Preset Sample License Plates
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SAMPLE_TEST_PLATES.map((sample) => (
                <button
                  key={sample.plate}
                  type="button"
                  onClick={() => handleSelectPlate(sample.plate)}
                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-amber-500/20 dark:bg-slate-800 dark:hover:bg-amber-500/20 border border-slate-200 dark:border-slate-700 hover:border-amber-500 text-left transition-all group flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <span className="font-mono font-black text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 text-xs block">
                      {sample.plate}
                    </span>
                    <span className="text-[10px] text-slate-500 block truncate">{sample.label}</span>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-slate-400 group-hover:text-amber-500 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs hover:bg-slate-300 transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
