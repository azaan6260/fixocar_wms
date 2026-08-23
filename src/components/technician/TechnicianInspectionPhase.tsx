import React, { useState } from 'react';
import { JobCard, Employee, Vendor, UserRole } from '../../types';
import { TechnicianBodyPanelAssessmentChart } from './TechnicianBodyPanelAssessmentChart';
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
  Camera,
  Hammer,
  Paintbrush
} from 'lucide-react';
import { speakTechnicianPrompt, stopTechnicianSpeech } from '../../lib/technicianVoiceHelper';

interface TechnicianInspectionPhaseProps {
  card: JobCard;
  employees?: Employee[];
  vendors?: Vendor[];
  currentRole?: UserRole;
  onProceedToPartsRequest: () => void;
  onOpenStandardJobs: () => void;
}

export function TechnicianInspectionPhase({
  card,
  employees = [],
  vendors = [],
  currentRole = 'FLOOR_MANAGER',
  onProceedToPartsRequest,
  onOpenStandardJobs
}: TechnicianInspectionPhaseProps) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const dentingTasksCount = card.tasks.filter(t => 
    t.category === 'DENTING' || 
    t.title.toLowerCase().includes('dent') || 
    t.title.includes('डेंट')
  ).length;

  const paintingTasksCount = card.tasks.filter(t => 
    t.category === 'PAINT' || 
    t.title.toLowerCase().includes('paint') || 
    t.title.includes('पेंट')
  ).length;

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
    const totalTasks = card.tasks.length;

    const speech = `प्रारंभिक जांच रिपोर्ट. गाड़ी नंबर ${reg}, मॉडल ${model}, फ्यूल स्तर ${card.vehicle.fuelLevel || '50%'}, ओडोमीटर ${km} किलोमीटर. इस गाड़ी में कुल ${totalTasks} काम दर्ज हैं, जिनमें से ${dentingTasksCount} डेंटिंग और ${paintingTasksCount} पेंटिंग के काम शामिल हैं. बॉडी पैनल चार्ट पर किसी भी पैनल को छूकर जानकारी देखें या नया काम जोड़ें.`;

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

        {/* Customer & Contact */}
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

        {/* Floor Supervisor & Active Bay */}
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

      {/* 2. Interactive SVG Body Panel Chart with Denter/Painter Red Highlight Mode & Repair Logger */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>🎨 विजुअल बॉडी पैनल चार्ट (Visual AR Body Chart)</span>
            </h3>
            <span className="hidden sm:inline-flex items-center gap-2 text-xs text-slate-400">
              <span className="flex items-center gap-1 text-red-400 font-bold">
                <Hammer className="w-3 h-3" /> {dentingTasksCount} Denting
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-blue-400 font-bold">
                <Paintbrush className="w-3 h-3" /> {paintingTasksCount} Paint
              </span>
            </span>
          </div>

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

        <TechnicianBodyPanelAssessmentChart
          card={card}
          employees={employees}
          vendors={vendors}
          currentRole={currentRole}
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
              गाड़ी के सभी बॉडी पैनल जांच लिए गए हैं। अब रिपेयर और पार्ट्स का काम शुरू करें।
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
            onClick={onProceedToPartsRequest}
            className="px-6 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-amber-500/30 active:scale-95 transition-all w-1/2 sm:w-auto"
          >
            <span>2. पार्ट्स रिक्विजिशन (Proceed to Parts Request) ➔</span>
            <ChevronRight className="w-4 h-4 stroke-[3]" />
          </button>
        </div>
      </div>

    </div>
  );
}
