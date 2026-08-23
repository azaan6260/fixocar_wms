import React, { useState } from 'react';
import { JobCard, JobTask } from '../../types';
import { 
  PackagePlus, 
  Boxes, 
  CheckCircle2, 
  Clock, 
  Plus, 
  Minus, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Layers, 
  Tag, 
  Send,
  Zap,
  ShoppingBag,
  Fuel,
  Volume2,
  VolumeX,
  PackageCheck
} from 'lucide-react';
import { addRequisitionToTask, updateJobCard, dispatchToastNotification } from '../../lib/storage';
import { speakTechnicianPrompt, stopTechnicianSpeech } from '../../lib/technicianVoiceHelper';

interface TechnicianPartsRequestPhaseProps {
  card: JobCard;
  onOpenRequisitionModal: () => void;
  onProceedToRepair: () => void;
  onBackToAssessment: () => void;
}

// Common fast-pick workshop spare parts & consumables for Indian auto garage
const QUICK_WORKSHOP_CONSUMABLES = [
  { name: 'Engine Oil 5W-30 (Synthetic)', partNo: 'OIL-5W30-SYN', category: 'LUBRICANT', unitPrice: 1850, unit: 'Ltr' },
  { name: 'Oil Filter Assembly', partNo: 'FLT-OIL-OEM', category: 'FILTER', unitPrice: 380, unit: 'Pcs' },
  { name: 'Air Filter Element', partNo: 'FLT-AIR-OEM', category: 'FILTER', unitPrice: 450, unit: 'Pcs' },
  { name: 'Front Brake Pad Set', partNo: 'BRK-PAD-FRT', category: 'BRAKES', unitPrice: 1450, unit: 'Set' },
  { name: 'Coolant Green 1L', partNo: 'LUB-COOL-1L', category: 'LUBRICANT', unitPrice: 320, unit: 'Ltr' },
  { name: 'Spark Plugs (Set of 4)', partNo: 'IGN-PLUG-4X', category: 'IGNITION', unitPrice: 680, unit: 'Set' },
  { name: 'Denting Body Putty (1Kg)', partNo: 'DNT-PUTTY-1K', category: 'DENTING', unitPrice: 350, unit: 'Kg' },
  { name: 'Paint Clear Coat 2K (500ml)', partNo: 'PNT-CLR-2K', category: 'PAINT', unitPrice: 750, unit: 'Can' },
  { name: 'Sandpaper P80/P120 (5 Sheets)', partNo: 'DNT-SAND-80', category: 'CONSUMABLE', unitPrice: 120, unit: 'Pack' },
];

export function TechnicianPartsRequestPhase({
  card,
  onOpenRequisitionModal,
  onProceedToRepair,
  onBackToAssessment
}: TechnicianPartsRequestPhaseProps) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  
  // Quick request state
  const [selectedItemIdx, setSelectedItemIdx] = useState<number | null>(null);
  const [itemQty, setItemQty] = useState<number>(1);
  const [customPartName, setCustomPartName] = useState('');
  const [targetTaskId, setTargetTaskId] = useState<string>(card.tasks[0]?.id || '');

  // Extract all requisitions from tasks
  const allRequisitions = React.useMemo(() => {
    const list: Array<{
      id: string;
      taskId: string;
      taskTitle: string;
      partNumber?: string;
      title: string;
      quantity: number;
      status: string;
      price: number;
      requestedAt: string;
    }> = [];

    card.tasks.forEach(t => {
      if (t.requisitions) {
        t.requisitions.forEach(r => {
          list.push({
            id: r.id,
            taskId: t.id,
            taskTitle: t.title,
            partNumber: r.partNumber,
            title: r.title,
            quantity: r.quantity,
            status: r.status,
            price: r.approvedPrice || r.suggestedPrice || 0,
            requestedAt: r.createdAt
          });
        });
      }
    });

    return list;
  }, [card]);

  const pendingRequisitions = allRequisitions.filter(r => r.status === 'PENDING');
  const issuedRequisitions = allRequisitions.filter(r => r.status === 'APPROVED' || r.status === 'CONSUMED' || r.status === 'ISSUED');

  // Handle Quick Add Consumable / Part
  const handleQuickRequest = (item: typeof QUICK_WORKSHOP_CONSUMABLES[0]) => {
    const targetTask = card.tasks.find(t => t.id === targetTaskId) || card.tasks[0];
    if (!targetTask) return;

    addRequisitionToTask(card.id, targetTask.id, {
      requestedByEmployeeId: 'TECH-1',
      requestedByEmployeeName: 'Assigned Technician',
      title: item.name,
      partNumber: item.partNo,
      itemType: item.category === 'CONSUMABLE' || item.category === 'LUBRICANT' ? 'CONSUMABLE' : 'PART',
      quantity: itemQty,
      suggestedPrice: item.unitPrice * itemQty,
      urgency: 'HIGH',
      reason: 'Standard replacement during service repair'
    });

    // Reset
    setSelectedItemIdx(null);
    setItemQty(1);

    dispatchToastNotification({
      type: 'SUCCESS',
      title: 'पार्ट्स की मांग भेजी गई (Requisition Sent)',
      message: `${itemQty}x ${item.name} के लिए स्टोर को रिक्विजिशन भेजी गई।`,
      vehicleReg: card.vehicle.registrationNumber,
      jobCardId: card.id
    });
  };

  const handleCustomPartSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPartName.trim()) return;

    const targetTask = card.tasks.find(t => t.id === targetTaskId) || card.tasks[0];
    if (!targetTask) return;

    addRequisitionToTask(card.id, targetTask.id, {
      requestedByEmployeeId: 'TECH-1',
      requestedByEmployeeName: 'Assigned Technician',
      title: customPartName.trim(),
      itemType: 'PART',
      quantity: itemQty,
      suggestedPrice: 500 * itemQty,
      urgency: 'MEDIUM',
      reason: 'Technician on-demand requirement'
    });

    setCustomPartName('');
    setItemQty(1);

    dispatchToastNotification({
      type: 'SUCCESS',
      title: 'नया पार्ट दर्ज किया गया',
      message: `"${customPartName}" स्टोर से जारी होने के लिए कतार में है।`,
      vehicleReg: card.vehicle.registrationNumber,
      jobCardId: card.id
    });
  };

  const handleVoiceSummary = () => {
    if (isPlayingAudio) {
      stopTechnicianSpeech();
      setIsPlayingAudio(false);
      return;
    }

    const reg = card.vehicle.registrationNumber;
    const reqCount = allRequisitions.length;
    const pendingCount = pendingRequisitions.length;

    const speech = `पार्ट्स रिक्विजिशन रिपोर्ट. गाड़ी नंबर ${reg}. कुल ${reqCount} पार्ट्स की मांग दर्ज है, जिनमें से ${pendingCount} स्टोर से पेंडिंग हैं. नीचे दिए गए बड़े बटनों से नया सामान तुरंत मांग सकते हैं.`;

    setIsPlayingAudio(true);
    speakTechnicianPrompt(speech, () => {
      setIsPlayingAudio(false);
    });
  };

  return (
    <div className="space-y-6">
      
      {/* 1. High-Contrast Store Requisition Header */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/40 flex items-center justify-center font-black shrink-0 shadow-inner">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-base text-white">
                चरण 2: पार्ट्स एवं सामान रिक्विजिशन (Spare Parts & Store Issues)
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] font-mono font-bold">
                {allRequisitions.length} Requested
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              रिपेयर शुरू करने से पहले जरूरी पुर्जे व कंज्यूमेबल स्टोर से जारी करवाएं
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleVoiceSummary}
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
            onClick={onOpenRequisitionModal}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs flex items-center gap-1.5 shadow-lg shadow-blue-600/25 active:scale-95"
          >
            <PackagePlus className="w-4 h-4" />
            <span>+ स्टोर लिस्ट खोलें</span>
          </button>
        </div>
      </div>

      {/* 2. Target Job / Task Selector for Parts Billing */}
      {card.tasks.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <span className="font-bold text-slate-300 flex items-center gap-1.5">
            <Tag className="w-4 h-4 text-amber-400" />
            <span>किस काम के लिए पार्ट्स चाहिए? (Select Associated Task):</span>
          </span>

          <select
            value={targetTaskId}
            onChange={(e) => setTargetTaskId(e.target.value)}
            className="w-full sm:w-auto min-w-[240px] p-2 rounded-xl bg-slate-800 border border-slate-700 font-bold text-white text-xs"
          >
            {card.tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title} ({task.category})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 3. 1-TAP FAST CONSUMABLES / SPARE PARTS PICKER GRID */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-black text-xs sm:text-sm text-slate-200 flex items-center gap-2">
            <span>⚡ सामान्य सर्विस पार्ट्स (1-Tap Quick Consumables)</span>
          </h4>
          <span className="text-[10px] text-slate-400">टैप करके तुरंत स्टोर से मंगाएं</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {QUICK_WORKSHOP_CONSUMABLES.map((item, idx) => {
            const isSelected = selectedItemIdx === idx;
            return (
              <div
                key={item.partNo}
                className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'bg-blue-950/60 border-blue-400 ring-2 ring-blue-500/30'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                      {item.category}
                    </span>
                    <h5 className="font-extrabold text-sm text-white mt-1 leading-snug">
                      {item.name}
                    </h5>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      P/N: {item.partNo}
                    </p>
                  </div>
                  <span className="text-sm font-black font-mono text-emerald-400 shrink-0">
                    ₹{item.unitPrice}
                  </span>
                </div>

                {isSelected ? (
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-300">मात्रा (Qty):</span>
                      <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-xl border border-slate-700">
                        <button
                          type="button"
                          onClick={() => setItemQty(q => Math.max(1, q - 1))}
                          className="w-7 h-7 rounded-lg bg-slate-700 text-white font-black flex items-center justify-center hover:bg-slate-600"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-mono font-black text-sm text-white px-2">
                          {itemQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => setItemQty(q => q + 1)}
                          className="w-7 h-7 rounded-lg bg-slate-700 text-white font-black flex items-center justify-center hover:bg-slate-600"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedItemIdx(null)}
                        className="w-1/3 py-2 rounded-xl bg-slate-800 text-slate-400 text-xs font-bold hover:text-white"
                      >
                        रद्द करें
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickRequest(item)}
                        className="w-2/3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-md active:scale-95"
                      >
                        ✓ स्टोर को भेजें
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedItemIdx(idx);
                      setItemQty(1);
                    }}
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors border border-slate-700 hover:border-blue-500"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ मंगाएं (Request)</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. CUSTOM PART QUICK INPUT BAR */}
      <form 
        onSubmit={handleCustomPartSubmit}
        className="p-4 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center gap-3 text-xs"
      >
        <div className="flex items-center gap-2 w-full sm:w-auto text-slate-300 font-bold shrink-0">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>अन्य कोई पुर्जा चाहिए? (Custom Part):</span>
        </div>

        <input
          type="text"
          value={customPartName}
          onChange={(e) => setCustomPartName(e.target.value)}
          placeholder="उदा. वाइपर ब्लेड, हॉर्न रिले, डोर लॉक मोटर..."
          className="grow w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 font-bold text-white"
        />

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700 shrink-0">
            <button
              type="button"
              onClick={() => setItemQty(q => Math.max(1, q - 1))}
              className="w-6 h-6 rounded-lg bg-slate-700 text-white flex items-center justify-center font-bold"
            >
              -
            </button>
            <span className="font-mono font-bold text-xs px-2 text-white">{itemQty} Qty</span>
            <button
              type="button"
              onClick={() => setItemQty(q => q + 1)}
              className="w-6 h-6 rounded-lg bg-slate-700 text-white flex items-center justify-center font-bold"
            >
              +
            </button>
          </div>

          <button
            type="submit"
            disabled={!customPartName.trim()}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black shadow-md shrink-0"
          >
            + रिक्विजिशन बनाएं
          </button>
        </div>
      </form>

      {/* 5. CURRENT REQUISITION STATUS FOR THIS CAR */}
      {allRequisitions.length > 0 && (
        <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
          <h4 className="font-black text-xs sm:text-sm text-white flex items-center justify-between">
            <span className="flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-emerald-400" />
              <span>गाड़ी के लिए मांगे गए पुर्जे (Requested Parts Tracker):</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {issuedRequisitions.length}/{allRequisitions.length} Store Issued
            </span>
          </h4>

          <div className="divide-y divide-slate-800 border border-slate-800 rounded-2xl overflow-hidden bg-slate-950">
            {allRequisitions.map((req) => (
              <div key={req.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-white">{req.title}</span>
                    <span className="font-mono text-slate-400 font-bold">x{req.quantity}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    टास्क: {req.taskTitle}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${
                    req.status === 'CONSUMED' || req.status === 'APPROVED' || req.status === 'ISSUED'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  }`}>
                    {req.status === 'PENDING' ? '⏳ स्टोर पेंडिंग' : '✓ स्टोर से जारी (Issued)'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. OVERSIZED STEPPER NAVIGATION ACTIONS */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border-2 border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <button
          type="button"
          onClick={onBackToAssessment}
          className="px-4 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-2 w-full sm:w-auto justify-center"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>⬅️ 1. जांच रिपोर्ट पर वापस जाएं</span>
        </button>

        <button
          type="button"
          onClick={onProceedToRepair}
          className="px-6 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-amber-500/30 active:scale-95 transition-all w-full sm:w-auto"
        >
          <span>3. मरम्मत व कार्य (Proceed to Repair) ➔</span>
          <ChevronRight className="w-4 h-4 stroke-[3]" />
        </button>
      </div>

    </div>
  );
}
