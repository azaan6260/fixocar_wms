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
  Keyboard, 
  History, 
  ScanLine, 
  ChevronRight, 
  ImageIcon 
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [recentScans, setRecentScans] = useState<string[]>([]);

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
      console.warn('Could not load recent scans', e);
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
      console.warn('Could not save recent scan', e);
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
        .catch(() => {
          // Retry with basic video constraints if ideal facingMode failed
          navigator.mediaDevices?.getUserMedia({ video: true })
            .then((mediaStream) => {
              currentStream = mediaStream;
              setStream(mediaStream);
              if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
              }
            })
            .catch(() => {
              setCameraError(
                'Camera access is unavailable or disabled in this view. You can upload a vehicle photo or select a test registration plate below.'
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

  const handleClose = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setScanResult(null);
    setCapturedImage(null);
    setIsScanning(false);
    setManualPlate('');
    setErrorMessage(null);
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

  const processImageForOCR = async (imageBase64: string) => {
    setIsScanning(true);
    setErrorMessage(null);
    setScanResult(null);
    setScanMeta(null);

    try {
      const response = await fetch('/api/scan-plate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
      });

      const data = await response.json().catch(() => null);

      if (data && data.success && data.plateNumber && data.plateNumber !== 'UNKNOWN') {
        const cleanedPlate = data.plateNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
        setScanResult(cleanedPlate);
        setManualPlate(cleanedPlate);
        setScanMeta({
          vehicleType: data.vehicleType,
          vehicleColor: data.vehicleColor,
          confidence: data.confidence || 'high',
        });
        saveRecentScan(cleanedPlate);
      } else {
        const errText = data?.error || 'Could not clearly read the registration plate from this image.';
        setErrorMessage(errText);
      }
    } catch (err) {
      console.error('OCR Request Error:', err);
      setErrorMessage('OCR service request failed. Please enter registration plate manually.');
    } finally {
      setIsScanning(false);
    }
  };

  const captureFrameFromCamera = () => {
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
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
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
    const cleaned = plateNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleaned) {
      saveRecentScan(cleaned);
      onScanComplete(cleaned);
      handleClose();
    }
  };

  const formatPlateDisplay = (raw: string) => {
    const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.length === 10) {
      return `${clean.slice(0, 2)} ${clean.slice(2, 4)} ${clean.slice(4, 6)} ${clean.slice(6)}`;
    }
    return clean;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/20">
              <ScanLine className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black flex items-center gap-2">
                <span>License Plate Scanner</span>
                <span className="bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 rounded-full font-bold border border-amber-500/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" /> Gemini Vision
                </span>
              </h2>
              <p className="text-xs text-slate-400">Automatic Registration Number Recognition</p>
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

        {/* Tab Selection */}
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
              <span>Camera</span>
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

            <button
              type="button"
              onClick={() => setActiveTab('manual')}
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all ${
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
              className="p-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 transition-all flex items-center gap-1 text-xs font-bold shrink-0"
            >
              <SwitchCamera className="w-4 h-4" />
              <span className="hidden sm:inline">Flip</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
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
                      <span>Upload Vehicle Photo</span>
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
                <div className="relative bg-slate-950 rounded-2xl overflow-hidden aspect-4/3 flex items-center justify-center shadow-inner border border-slate-800">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />

                  {/* Alignment Frame Overlay */}
                  <div className="absolute inset-0 pointer-events-none border-2 border-amber-500/30 m-6 rounded-2xl flex items-center justify-center z-10">
                    <div className="w-64 h-24 border-2 border-dashed border-amber-400 bg-amber-500/10 rounded-xl flex items-center justify-center relative overflow-hidden shadow-2xl">
                      <span className="text-[10px] font-black uppercase text-amber-300 tracking-widest bg-slate-900/90 px-2.5 py-1 rounded-md border border-amber-500/30">
                        Align License Plate Here
                      </span>
                    </div>
                  </div>

                  {/* Processing Overlay */}
                  {isScanning && (
                    <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center z-20 space-y-3">
                      <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
                      <span className="text-amber-400 font-black text-xs tracking-wider uppercase animate-pulse">
                        Analyzing License Plate with AI...
                      </span>
                    </div>
                  )}

                  <canvas ref={canvasRef} className="hidden" />

                  {/* Snap Button */}
                  <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-3 z-10">
                    <button
                      type="button"
                      onClick={captureFrameFromCamera}
                      disabled={isScanning}
                      className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs flex items-center gap-2 shadow-xl shadow-amber-500/40 transition-all disabled:opacity-50"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Snap & AI Scan Plate</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'upload' ? (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500 dark:hover:border-amber-500 rounded-2xl p-8 text-center cursor-pointer bg-slate-50 dark:bg-slate-800/40 transition-all space-y-3 group"
              >
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-black text-slate-900 dark:text-slate-100 text-sm">Select Vehicle Photo</p>
                  <p className="text-slate-500 text-xs mt-1">Upload JPG, PNG or WEBP file with visible plate</p>
                </div>
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs"
                >
                  Choose Image File
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
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold shrink-0">
                    <Keyboard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white text-sm">Manual Plate Entry</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-xs">Enter registration number directly</p>
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
                      Registration Number
                    </label>
                    <input
                      type="text"
                      value={manualPlate}
                      onChange={(e) => setManualPlate(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                      placeholder="e.g. MH12AB1234 or DL01CA9988"
                      maxLength={12}
                      className="w-full px-4 py-3.5 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 focus:border-amber-500 dark:focus:border-amber-500 rounded-xl font-mono text-xl font-black tracking-wider text-slate-900 dark:text-white uppercase outline-none transition-all shadow-inner"
                      autoFocus
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={manualPlate.trim().length < 3}
                    className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Plate ({manualPlate || '...'})</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Captured Image Preview */}
          {capturedImage && activeTab !== 'manual' && (
            <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span>Selected Photo Preview</span>
                {isScanning && (
                  <span className="text-amber-500 flex items-center gap-1 font-bold animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Scanning with AI...
                  </span>
                )}
              </div>
              <div className="h-32 rounded-xl overflow-hidden bg-slate-950 border border-slate-700">
                <img
                  src={capturedImage}
                  alt="Captured plate"
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          )}

          {/* Scan Result Card */}
          {scanResult && activeTab !== 'manual' && (
            <div className="bg-emerald-500/10 border-2 border-emerald-500/40 rounded-2xl p-4 space-y-3 text-emerald-900 dark:text-emerald-200">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xs flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Plate Recognized
                </span>
                {scanMeta?.confidence && (
                  <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded-md font-mono font-bold text-emerald-700 dark:text-emerald-300 capitalize">
                    {scanMeta.confidence} Confidence
                  </span>
                )}
              </div>

              {/* Plate Graphic */}
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

          {errorMessage && (
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-800 dark:text-amber-300 text-xs font-medium space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Notice</span>
              </div>
              <p>{errorMessage}</p>
            </div>
          )}

          {/* Quick Preset Test Plates */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
            <span className="text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider block flex items-center gap-1">
              <Car className="w-3.5 h-3.5 text-amber-500" /> Quick Select Test Plates
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

          {/* Recent Scans */}
          {recentScans.length > 0 && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <span className="text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider block flex items-center gap-1">
                <History className="w-3.5 h-3.5 text-slate-400" /> Recent Registration Numbers
              </span>
              <div className="flex flex-wrap gap-2">
                {recentScans.map((plate) => (
                  <button
                    key={plate}
                    type="button"
                    onClick={() => handleSelectPlate(plate)}
                    className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-amber-500/20 dark:bg-slate-800 dark:hover:bg-amber-500/20 text-slate-800 dark:text-slate-200 font-mono font-bold text-xs border border-slate-300 dark:border-slate-700 transition-all"
                  >
                    {plate}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end shrink-0">
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
