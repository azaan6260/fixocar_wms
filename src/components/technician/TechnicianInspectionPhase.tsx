import React, { useState } from 'react';
import { JobCard } from '../../types';
import { 
  InteractiveVehicleInspectionChart, 
  VEHICLE_PANELS 
} from '../InteractiveVehicleInspectionChart';
import { 
  Car, 
  Fuel, 
  Gauge, 
  ShieldCheck, 
  Volume2, 
  VolumeX, 
  ChevronRight, 
  CheckCircle2, 
  Plus, 
  Sparkles, 
  AlertTriangle,
  Camera
} from 'lucide-react';
import { speakTechnicianPrompt, stopTechnicianSpeech } from '../../lib/technicianVoiceHelper';

interface TechnicianInspectionPhaseProps {
  card: JobCard;
  onProceedToRepair: () => void;
  onOpenStandardJobs: () => void;
}

export function TechnicianInspectionPhase({
  card,
  onProceedToRepair,
  onOpenStandardJobs
}: TechnicianInspectionPhaseProps) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [selectedPanels, setSelectedPanels] = useState<string[]>(() => {
    return card.tasks.map(t => {
      const matched = VEHICLE_PANELS.find(p => 
        p.standardJobId === t.standardJobId || 
        t.title.toLowerCase().includes(p.nameEn.toLowerCase())
      );
      return matched ? matched.id : '';
    }).filter(Boolean);
  });

  const handleVoiceInspectionSummary = () => {
    if (isPlayingAudio) {
      stopTechnicianSpeech();
      setIsPlayingAudio(false);
      return;
    }

    const reg = card.vehicle.registrationNumber;
    const model = `${card.vehicle.make} ${card.vehicle.model}`;
    const fuel = card.vehicle.fuelType || 'पेट्रोल';
    const km = card.vehicle.mileage || '0';
    const panelCount = selectedPanels.length;

    const speech = `प्रारंभिक जांच रिपोर्ट. गाड़ी नंबर ${reg}, मॉडल ${model}, फ्यूल टाइप ${fuel}, ओडोमीटर ${km} किलोमीटर. इस गाड़ी में कुल ${panelCount} बॉडी पैनल पर काम दर्ज है. मरम्मत शुरू करने के लिए नीचे दिए गए बटन को दबाएं.`;

    setIsPlayingAudio(true);
    speakTechnicianPrompt(speech, () => {
      setIsPlayingAudio(false);
    });
  };

  return (
    <div className="space-y-6">
      
      {/* 1. High-Contrast Vehicle Diagnostics & Check-In Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        
        {/* Fuel Gauge */}
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold">
            <Fuel className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">फ्यूल स्तर (Fuel)</span>
            <p className="font-extrabold text-sm text-white">{card.vehicle.fuelLevel || '50% (Half Tank)'}</p>
            <span className="text-[10px] text-amber-400 font-mono">⛽ {card.vehicle.fuelType || 'Petrol'}</span>
          </div>
        </div>

        {/* Odometer KM */}
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-400 flex items-center justify-center font-bold">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">किलोमीटर (KM)</span>
            <p className="font-extrabold text-sm text-white font-mono">{card.vehicle.mileage ? `${card.vehicle.mileage.toLocaleString('en-IN')} KM` : '34,200 KM'}</p>
            <span className="text-[10px] text-slate-400 font-medium">Checked-in</span>
          </div>
        </div>

        {/* Customer & Floor Manager */}
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold">
            <Car className="w-5 h-5" />
          </div>
          <div className="truncate">
            <span className="text-[10px] uppercase font-bold text-slate-400">ग्राहक (Customer)</span>
            <p className="font-extrabold text-sm text-white truncate">{card.customer.name}</p>
            <span className="text-[10px] text-slate-400 font-mono truncate">{card.customer.phone}</span>
          </div>
        </div>

        {/* Floor Manager & Bay */}
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-400 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">फ्लोर सुपरवाइजर</span>
            <p className="font-extrabold text-sm text-white">{card.floorManagerName}</p>
            <span className="text-[10px] text-purple-300 font-bold">Bay #2 Active</span>
          </div>
        </div>

      </div>

      {/* 2. Interactive SVG AR Body Panel Sketch Diagram */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>🎨 विजुअल बॉडी पैनल चार्ट (Visual AR Body Chart)</span>
          </h3>

          <button
            type="button"
            onClick={handleVoiceInspectionSummary}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
              isPlayingAudio 
                ? 'bg-rose-500 text-white animate-pulse' 
                : 'bg-amber-500/20 text-amber-500 hover:bg-amber-500 hover:text-slate-950 border border-amber-500/40'
            }`}
          >
            {isPlayingAudio ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span>{isPlayingAudio ? 'रोकें' : '🔊 जांच रिपोर्ट सुनें'}</span>
          </button>
        </div>

        <InteractiveVehicleInspectionChart
          mode="VIEW"
          isCars24={card.isCars24}
          vehicleMakeModel={`${card.vehicle.make} ${card.vehicle.model}`}
          selectedPanelIds={selectedPanels}
          onPanelToggle={(panelId) => {
            setSelectedPanels(prev => 
              prev.includes(panelId) ? prev.filter(p => p !== panelId) : [...prev, panelId]
            );
          }}
        />
      </div>

      {/* 3. Big Next Step Navigation Action Bar */}
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-500/15 via-slate-900 to-slate-900 border-2 border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xl shrink-0 shadow-lg shadow-amber-500/20">
            ✓
          </div>
          <div>
            <h4 className="font-extrabold text-sm sm:text-base text-white">
              प्रारंभिक जांच पूरी हुई? (Inspection Verified)
            </h4>
            <p className="text-xs text-slate-300">
              गाड़ी के सभी पैनल जांच लिए गए हैं। अब रिपेयर और पार्ट्स का काम शुरू करें।
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={onOpenStandardJobs}
            className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-extrabold text-xs transition-all w-1/2 sm:w-auto"
          >
            + अतिरिक्त काम जोड़ें
          </button>

          <button
            type="button"
            onClick={onProceedToRepair}
            className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-amber-500/30 active:scale-95 transition-all w-1/2 sm:w-auto"
          >
            <span>▶️ काम शुरू करें (Proceed to Repair)</span>
            <ChevronRight className="w-4 h-4 stroke-[3]" />
          </button>
        </div>
      </div>

    </div>
  );
}
