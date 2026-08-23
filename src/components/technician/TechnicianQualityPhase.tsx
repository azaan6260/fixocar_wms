import React, { useState } from 'react';
import { JobCard } from '../../types';
import { 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Camera, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  Sparkles, 
  Image as ImageIcon,
  Volume2,
  VolumeX,
  FileCheck,
  Zap
} from 'lucide-react';
import { updateJobCard, dispatchToastNotification } from '../../lib/storage';
import { speakTechnicianPrompt, stopTechnicianSpeech } from '../../lib/technicianVoiceHelper';

interface TechnicianQualityPhaseProps {
  card: JobCard;
  onOpenQCModal: (cardId: string) => void;
  onProceedToDispatch: () => void;
  onBackToRepair: () => void;
}

export function TechnicianQualityPhase({
  card,
  onOpenQCModal,
  onProceedToDispatch,
  onBackToRepair
}: TechnicianQualityPhaseProps) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isPassingAll, setIsPassingAll] = useState(false);

  // Toggle single QC item
  const handleToggleQCItem = (itemId: string) => {
    const updated = card.qcChecklist.map(item => {
      if (item.id === itemId) {
        return { ...item, isPassed: !item.isPassed };
      }
      return item;
    });

    const allPassed = updated.every(item => item.isPassed);

    updateJobCard(card.id, prev => ({
      ...prev,
      qcChecklist: updated,
      qcPassed: allPassed,
      status: allPassed ? 'READY_FOR_DELIVERY' : prev.status
    }));
  };

  // Pass all QC checks in one tap
  const handlePassAllQC = () => {
    const updated = card.qcChecklist.map(item => ({ ...item, isPassed: true }));
    updateJobCard(card.id, prev => ({
      ...prev,
      qcChecklist: updated,
      qcPassed: true,
      status: 'READY_FOR_DELIVERY'
    }));

    dispatchToastNotification({
      type: 'SUCCESS',
      title: 'क्वालिटी चेक पास हुआ (QC Approved)',
      message: `${card.vehicle.registrationNumber} का 12-पॉइंट निरीक्षण सफल रहा। गाड़ी डिलीवरी के लिए तैयार है।`,
      vehicleReg: card.vehicle.registrationNumber,
      jobCardId: card.id
    });
  };

  const passedCount = card.qcChecklist.filter(i => i.isPassed).length;
  const totalChecks = card.qcChecklist.length;
  const isQCPassed = Boolean(card.qcPassed || (totalChecks > 0 && passedCount === totalChecks));

  const handleVoiceQCRead = () => {
    if (isPlayingAudio) {
      stopTechnicianSpeech();
      setIsPlayingAudio(false);
      return;
    }

    const reg = card.vehicle.registrationNumber;
    const speech = `क्वालिटी चेक रिपोर्ट. गाड़ी नंबर ${reg}. कुल ${totalChecks} में से ${passedCount} पॉइंट पास हो चुके हैं. ${
      isQCPassed 
        ? 'गाड़ी क्वालिटी इंस्पेक्शन पास कर चुकी है और डिलीवरी के लिए तैयार है.' 
        : 'कृपया बाकी बचे हुए पॉइंट्स चेक करके पास करें.'
    }`;

    setIsPlayingAudio(true);
    speakTechnicianPrompt(speech, () => {
      setIsPlayingAudio(false);
    });
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Header Banner & Big One-Tap Pass Button */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black shrink-0 ${
            isQCPassed ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20' : 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
          }`}>
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base text-white">
                12-पॉइंट क्वालिटी कंट्रोल ऑडिट
              </h3>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                isQCPassed 
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
              }`}>
                {isQCPassed ? '✓ QC PASSED' : `${passedCount}/${totalChecks} PASSED`}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              फ्लोर मैनेजर एवं हेड मिस्त्री द्वारा डिलीवरी से पहले अनिवार्य जांच
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleVoiceQCRead}
            className={`p-2.5 rounded-xl border font-bold text-xs flex items-center gap-1.5 transition-all ${
              isPlayingAudio 
                ? 'bg-rose-500 text-white border-rose-400 animate-pulse' 
                : 'bg-slate-800 text-amber-400 border-slate-700 hover:bg-slate-700'
            }`}
          >
            {isPlayingAudio ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span>{isPlayingAudio ? 'रोकें' : '🔊 सुनें'}</span>
          </button>

          <button
            type="button"
            onClick={handlePassAllQC}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/25 active:scale-95 transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>✓ सभी 12 चेक पास करें (Pass All)</span>
          </button>
        </div>
      </div>

      {/* 2. Tactile 12-Point Checklist Cards with Large Tap Targets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {card.qcChecklist.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleToggleQCItem(item.id)}
            className={`p-3.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all duration-150 active:scale-98 ${
              item.isPassed
                ? 'bg-emerald-500/10 border-emerald-500/40 text-white hover:bg-emerald-500/15'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-amber-500/40 hover:bg-slate-800/80'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-black text-xs ${
                item.isPassed 
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30' 
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>
                {item.isPassed ? <Check className="w-4 h-4 stroke-[3]" /> : '○'}
              </div>
              <span className="font-bold text-xs leading-snug">
                {item.label}
              </span>
            </div>

            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 border ${
              item.isPassed 
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              {item.isPassed ? 'पास (Passed)' : 'जांचें'}
            </span>
          </button>
        ))}
      </div>

      {/* 3. Photo Proof Upload Preview */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-extrabold text-xs sm:text-sm text-white flex items-center gap-2">
            <Camera className="w-4 h-4 text-amber-400" />
            <span>काम का फोटो प्रमाण (Work Proof & Final Photos)</span>
          </h4>
          <span className="text-[10px] text-slate-400 font-mono">2 Photos Attached</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="aspect-video rounded-2xl overflow-hidden border border-slate-700 relative group bg-slate-950">
            <img 
              src="https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=400&q=80" 
              alt="Repaired Body Proof"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-slate-950/80 text-[9px] font-bold text-emerald-400 rounded-md">
              ✓ Paint Finished
            </span>
          </div>

          <div className="aspect-video rounded-2xl overflow-hidden border border-slate-700 relative group bg-slate-950">
            <img 
              src="https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=400&q=80" 
              alt="Engine Bay Proof"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-slate-950/80 text-[9px] font-bold text-emerald-400 rounded-md">
              ✓ Engine Tuned
            </span>
          </div>

          <div className="aspect-video rounded-2xl border-2 border-dashed border-slate-700 hover:border-amber-400 text-slate-400 hover:text-amber-300 flex flex-col items-center justify-center p-2 cursor-pointer transition-colors bg-slate-800/40">
            <Camera className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-bold">+ और फोटो जोड़ें</span>
          </div>
        </div>
      </div>

      {/* 4. Stepper Bottom Navigation */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border-2 border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        
        <button
          type="button"
          onClick={onBackToRepair}
          className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-2 w-full sm:w-auto justify-center"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>⬅️ 2. मरम्मत व टास्क पर वापस जाएं</span>
        </button>

        <button
          type="button"
          onClick={onProceedToDispatch}
          className={`px-6 py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all w-full sm:w-auto active:scale-95 shadow-xl ${
            isQCPassed
              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30 ring-2 ring-emerald-400'
              : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/30'
          }`}
        >
          <span>4. फाइनल बिलिंग एवं गेट पास (Proceed to Handover) ➔</span>
          <ChevronRight className="w-4 h-4 stroke-[3]" />
        </button>

      </div>

    </div>
  );
}
