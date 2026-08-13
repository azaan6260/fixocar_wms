import React, { useState } from 'react';
import { JobCard, DeliveryRecord, UserRole } from '../types';
import { addJobCardComment, getDeliveries, getJobCards } from '../lib/storage';
import { 
  X, 
  QrCode, 
  Search, 
  Car, 
  User, 
  Phone, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Truck, 
  MessageSquare, 
  Send, 
  Camera, 
  Sparkles, 
  ShieldCheck, 
  Wrench, 
  MapPin, 
  DollarSign, 
  ArrowRight,
  Zap,
  Check,
  Scan,
  CheckCircle,
  Maximize2
} from 'lucide-react';

interface LiveJobCardTrackerModalProps {
  isOpen?: boolean;
  jobCards?: JobCard[];
  initialJobCardId?: string | null;
  currentRole?: UserRole;
  onClose: () => void;
}

export function LiveJobCardTrackerModal({
  isOpen,
  jobCards: propsJobCards,
  initialJobCardId,
  currentRole = 'FLOOR_MANAGER',
  onClose
}: LiveJobCardTrackerModalProps) {
  const jobCards = propsJobCards || getJobCards();

  // Mode: QR code scan vs Number Plate ANPR scan
  const [scanMode, setScanMode] = useState<'qr' | 'plate'>('plate');

  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Custom plate input for OCR simulation
  const [plateInput, setPlateInput] = useState('MH 12 AB 1234');
  const [ocrResult, setOcrResult] = useState<{ plate: string; confidence: number; matchedCardId?: string } | null>(null);

  // Active selected Job Card
  const [selectedCardId, setSelectedCardId] = useState<string>(() => {
    if (initialJobCardId && jobCards.some(c => c.id === initialJobCardId)) {
      return initialJobCardId;
    }
    return jobCards[0]?.id || '';
  });

  const [commentText, setCommentText] = useState('');
  const [commentAuthor, setCommentAuthor] = useState(() => {
    if (currentRole === 'FLOOR_MANAGER') return 'Floor Manager (Rajesh)';
    if (currentRole === 'MECHANIC') return 'Head Technician (Vikram)';
    if (currentRole === 'DELIVERY_BOY') return 'Delivery Agent (Sunil)';
    return 'Customer';
  });

  const activeCard = jobCards.find(c => c.id === selectedCardId) || jobCards[0];
  const allDeliveries = getDeliveries();
  const activeDelivery = activeCard 
    ? allDeliveries.find(d => d.jobCardId === activeCard.id || d.vehicleReg === activeCard.vehicle.registrationNumber)
    : null;

  // Filter job cards for drop down / quick select
  const filteredCards = jobCards.filter(c => 
    c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.vehicle.registrationNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.vehicle.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.vehicle.model.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // QR Code Camera Scan Simulation
  const handleSimulateQRScan = (cardId: string) => {
    setIsScanning(true);
    setScanMessage('Optical QR Code Decoding in Progress...');
    setTimeout(() => {
      setSelectedCardId(cardId);
      setIsScanning(false);
      setScanMessage('');
    }, 800);
  };

  // Automatic Number Plate Recognition (ANPR / OCR) Simulation
  const handleSimulatePlateScan = (rawPlateText?: string) => {
    const queryPlate = (rawPlateText || plateInput).replace(/\s+/g, '').toUpperCase();
    if (!queryPlate) return;

    setIsScanning(true);
    setScanMessage(`Scanning Number Plate [ ${queryPlate} ] via ANPR Vision Engine...`);

    setTimeout(() => {
      // Find matching job card by vehicle registration number (partial or exact)
      const matched = jobCards.find(c => {
        const reg = c.vehicle.registrationNumber.replace(/\s+/g, '').toUpperCase();
        return reg === queryPlate || reg.includes(queryPlate) || queryPlate.includes(reg);
      });

      if (matched) {
        setSelectedCardId(matched.id);
        setOcrResult({
          plate: matched.vehicle.registrationNumber,
          confidence: 99.4,
          matchedCardId: matched.id
        });
      } else {
        setOcrResult({
          plate: queryPlate,
          confidence: 92.1,
          matchedCardId: undefined
        });
      }

      setIsScanning(false);
      setScanMessage('');
    }, 1000);
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !activeCard) return;

    addJobCardComment(activeCard.id, {
      jobCardId: activeCard.id,
      authorName: commentAuthor.trim() || 'Floor Staff',
      authorRole: currentRole,
      text: commentText.trim()
    });

    setCommentText('');
  };

  // Status stage step calculation
  const getStageIndex = (status: JobCard['status']) => {
    switch (status) {
      case 'CREATED': return 0;
      case 'INSPECTION': return 1;
      case 'JOB_ALLOCATED':
      case 'IN_PROGRESS': return 2;
      case 'ESTIMATE_PENDING': return 2;
      case 'QC_PENDING': return 3;
      case 'READY_FOR_DELIVERY': return 4;
      case 'OUT_FOR_DELIVERY': return 5;
      case 'DELIVERED':
      case 'CLOSED': return 6;
      default: return 0;
    }
  };

  const stages = [
    { label: 'Job Created', icon: Car },
    { label: 'Inspection', icon: Wrench },
    { label: 'In Progress', icon: Zap },
    { label: 'Quality Control', icon: ShieldCheck },
    { label: 'Ready for Delivery', icon: CheckCircle2 },
    { label: 'Out for Delivery', icon: Truck },
    { label: 'Delivered', icon: Check }
  ];

  const currentStageIdx = activeCard ? getStageIndex(activeCard.status) : 0;
  const completedTasks = activeCard ? activeCard.tasks.filter(t => t.status === 'COMPLETED').length : 0;
  const totalTasks = activeCard ? activeCard.tasks.length : 0;
  const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto">
        
        {/* Top Header Banner */}
        <div className="bg-slate-900 text-white p-5 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
              <Scan className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-lg tracking-tight text-white">
                  Live Scanner & Floor Feed
                </h2>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  QR + ANPR OCR
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Scan vehicle number plates or job card QR tags to pull status, ETA & add comments
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full transition-colors self-end sm:self-auto"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          
          {/* Scanner Mode Tabs & Controls Bar */}
          <div className="bg-slate-900/95 text-white p-4 rounded-2xl border border-slate-800 space-y-4">
            
            {/* Mode Selector */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
                <button
                  type="button"
                  onClick={() => setScanMode('plate')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                    scanMode === 'plate'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Scan className="w-4 h-4" />
                  🚘 Number Plate Scan (ANPR)
                </button>

                <button
                  type="button"
                  onClick={() => setScanMode('qr')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                    scanMode === 'qr'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  📱 QR Code Tag Scan
                </button>
              </div>

              <span className="text-[11px] text-amber-400 font-mono hidden md:inline-flex items-center gap-1 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                <Sparkles className="w-3 h-3" /> FixoCar AI Optical Scanner v2.4
              </span>
            </div>

            {/* SCANNER VIEW: NUMBER PLATE ANPR OCR */}
            {scanMode === 'plate' && (
              <div className="space-y-3">
                <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  
                  {/* Camera Reticle Visualization */}
                  <div className="w-full md:w-64 h-24 bg-slate-900 rounded-xl border-2 border-dashed border-amber-500/60 relative flex flex-col items-center justify-center overflow-hidden shrink-0">
                    <div className="absolute top-2 left-2 border-t-2 border-l-2 border-amber-400 w-3 h-3" />
                    <div className="absolute top-2 right-2 border-t-2 border-r-2 border-amber-400 w-3 h-3" />
                    <div className="absolute bottom-2 left-2 border-b-2 border-l-2 border-amber-400 w-3 h-3" />
                    <div className="absolute bottom-2 right-2 border-b-2 border-r-2 border-amber-400 w-3 h-3" />

                    {/* License Plate Graphic */}
                    <div className="bg-amber-400 text-slate-950 px-4 py-1 rounded-md border-2 border-slate-950 font-mono font-black text-sm tracking-widest shadow-md flex items-center gap-2">
                      <span className="bg-blue-800 text-white text-[8px] px-1 rounded font-sans">IND</span>
                      {plateInput.toUpperCase() || 'MH 12 AB 1234'}
                    </div>

                    <span className="text-[10px] text-amber-400/80 font-mono mt-1.5 flex items-center gap-1">
                      <Camera className="w-3 h-3 animate-pulse" /> ANPR Reticle Alignment
                    </span>
                  </div>

                  {/* Input & Action */}
                  <div className="flex-1 space-y-2.5 w-full">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      Enter or Select License Plate Number to Scan:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={plateInput}
                        onChange={(e) => setPlateInput(e.target.value.toUpperCase())}
                        placeholder="e.g. MH12AB1234, KA01MJ9081..."
                        className="flex-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 font-mono text-sm font-bold text-amber-400 tracking-wider placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase"
                      />
                      <button
                        type="button"
                        onClick={() => handleSimulatePlateScan()}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-2 transition-all shadow-md shrink-0"
                      >
                        <Scan className="w-4 h-4" />
                        Scan Plate (ANPR)
                      </button>
                    </div>

                    {/* Quick registered plate chips */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pt-1 scrollbar-none">
                      <span className="text-[11px] text-slate-400 font-medium shrink-0">Tap Plate:</span>
                      {jobCards.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setPlateInput(c.vehicle.registrationNumber);
                            handleSimulatePlateScan(c.vehicle.registrationNumber);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold shrink-0 transition-all border ${
                            activeCard?.vehicle.registrationNumber === c.vehicle.registrationNumber
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          {c.vehicle.registrationNumber}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>

                {/* OCR Result Badge */}
                {ocrResult && (
                  <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                    ocrResult.matchedCardId 
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  }`}>
                    <div className="flex items-center gap-2">
                      {ocrResult.matchedCardId ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-400" />
                      )}
                      <div>
                        <span className="font-mono font-bold">{ocrResult.plate}</span> matched with {ocrResult.confidence}% ANPR confidence.
                        {!ocrResult.matchedCardId && ' (No active workshop job card found for this plate).' }
                      </div>
                    </div>
                    {ocrResult.matchedCardId && (
                      <span className="font-mono font-bold text-amber-400 text-[11px]">
                        Job Card #{ocrResult.matchedCardId} Loaded
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* SCANNER VIEW: QR CODE TAG */}
            {scanMode === 'qr' && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Job Card #, Vehicle Reg, Customer Name..."
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleSimulateQRScan(filteredCards[0]?.id || selectedCardId)}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shrink-0"
                >
                  <Camera className="w-4 h-4" />
                  Simulate QR Camera Scan
                </button>
              </div>
            )}

            {/* Quick Cards Selector */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-none border-t border-slate-800/80 pt-2">
              <span className="text-[11px] text-slate-400 font-medium shrink-0">Select Job Ticket:</span>
              {filteredCards.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCardId(c.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 border ${
                    selectedCardId === c.id
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <span className="font-mono text-[11px]">{c.id}</span>
                  <span className="opacity-80">({c.vehicle.registrationNumber})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Scanner Simulation Animation Box */}
          {isScanning && (
            <div className="bg-slate-950 p-6 rounded-2xl border border-amber-500/40 text-center space-y-3 relative overflow-hidden animate-pulse">
              <div className="absolute inset-0 bg-amber-500/5 pointer-events-none" />
              <div className="w-16 h-16 mx-auto bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center border border-amber-500/40">
                <Scan className="w-8 h-8 animate-spin" />
              </div>
              <h4 className="text-amber-400 font-bold text-sm">
                {scanMessage || 'Decoding Optical Data...'}
              </h4>
              <p className="text-xs text-slate-400">Verifying signature & fetching live floor comments</p>
            </div>
          )}

          {activeCard && !isScanning && (
            <>
              {/* Card Summary Header */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xl font-black text-amber-600 dark:text-amber-400">
                      {activeCard.id}
                    </span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold border border-slate-300 dark:border-slate-600">
                      {activeCard.serviceType.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Car className="w-5 h-5 text-amber-500" />
                    {activeCard.vehicle.make} {activeCard.vehicle.model} ({activeCard.vehicle.color})
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300 pt-1">
                    <span className="font-mono bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded font-bold border border-amber-500/20">
                      {activeCard.vehicle.registrationNumber}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" /> {activeCard.customer.name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" /> {activeCard.customer.phone}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-start md:items-end gap-1.5 shrink-0">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Current Status</span>
                  <span className="px-3 py-1 bg-amber-500 text-slate-950 font-bold text-xs rounded-full uppercase tracking-wide shadow-xs">
                    {activeCard.status.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" /> Promised: {activeCard.estimatedCompletionDate || 'Today 6:00 PM'}
                  </span>
                </div>
              </div>

              {/* Progress Stage Tracker */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    Live Repair Stage
                  </h4>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                    {taskProgress}% Tasks Completed ({completedTasks}/{totalTasks})
                  </span>
                </div>

                {/* Stages Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  {stages.map((stg, index) => {
                    const isCompleted = index <= currentStageIdx;
                    const isCurrent = index === currentStageIdx;
                    const IconComponent = stg.icon;

                    return (
                      <div 
                        key={stg.label}
                        className={`p-2.5 rounded-xl border text-center flex flex-col items-center justify-center gap-1.5 transition-all ${
                          isCurrent
                            ? 'bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400 shadow-xs'
                            : isCompleted
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 opacity-60'
                        }`}
                      >
                        <div className={`p-1.5 rounded-lg ${
                          isCurrent ? 'bg-amber-500 text-slate-950' : isCompleted ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                        }`}>
                          <IconComponent className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[10px] font-bold leading-tight">
                          {stg.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Live Delivery GPS Tracking (If out for delivery) */}
              {activeDelivery && (
                <div className="bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-slate-900 p-5 rounded-2xl border border-blue-500/30 space-y-3 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Truck className="w-5 h-5 text-amber-400" />
                      <h4 className="font-bold text-sm text-white">Live Delivery Out-for-Delivery Tracking</h4>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs border border-emerald-500/30">
                      ETA: {activeDelivery.etaMinutes} mins
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                    <div>
                      <span className="text-slate-400 block">Driver Name</span>
                      <p className="font-bold text-white mt-0.5">{activeDelivery.deliveryBoyName}</p>
                      <p className="text-[11px] text-slate-400">{activeDelivery.deliveryBoyPhone}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Delivery Address</span>
                      <p className="font-medium text-slate-200 mt-0.5 truncate">{activeDelivery.deliveryAddress}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Payment Due</span>
                      <p className="font-bold text-amber-400 mt-0.5">
                        ₹{activeDelivery.totalAmountDue} ({activeDelivery.paymentStatus})
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Live Comments & Floor Feed */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-amber-500" />
                    Live Floor Comments & Status Log
                  </h4>
                  <span className="text-xs text-slate-500 font-medium">
                    {(activeCard.comments || []).length} Comments
                  </span>
                </div>

                {/* Add Comment Form */}
                <form onSubmit={handlePostComment} className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={commentAuthor}
                      onChange={(e) => setCommentAuthor(e.target.value)}
                      placeholder="Your Name / Role..."
                      className="sm:w-48 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Type a live update (e.g. Engine flush complete, washing in Bay 2)..."
                      className="flex-1 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      type="submit"
                      disabled={!commentText.trim()}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Post Comment
                    </button>
                  </div>
                </form>

                {/* Feed List */}
                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {(!activeCard.comments || activeCard.comments.length === 0) ? (
                    <div className="text-center py-6 text-slate-400 text-xs italic">
                      No live comments posted yet for this job card. Use the box above to add a status update.
                    </div>
                  ) : (
                    activeCard.comments.map((cmt) => (
                      <div 
                        key={cmt.id}
                        className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {cmt.authorName}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold uppercase">
                              {cmt.authorRole.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {cmt.timestamp}
                          </span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
                          {cmt.text}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-100 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
            <Scan className="w-3.5 h-3.5 text-amber-500" /> Optical Camera Scanner Ready (QR + ANPR)
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-bold transition-colors"
          >
            Close Tracker
          </button>
        </div>

      </div>
    </div>
  );
}

