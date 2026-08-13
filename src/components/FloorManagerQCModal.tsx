import React, { useState } from 'react';
import { JobCard, QCCheckitem } from '../types';
import { updateQCChecklist } from '../lib/storage';
import { 
  X, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Car, 
  ClipboardCheck,
  Check
} from 'lucide-react';

interface FloorManagerQCModalProps {
  card: JobCard;
  onClose: () => void;
}

const DEFAULT_12_POINT_QC: Omit<QCCheckitem, 'isPassed'>[] = [
  { id: 'qc-1', label: 'Engine Oil Cap & Dipstick Tightened', category: 'ENGINE' },
  { id: 'qc-2', label: 'Brake Fluid & Coolant Reservoirs Filled', category: 'ENGINE' },
  { id: 'qc-3', label: 'Wheel Lug Nuts Torqued to Spec', category: 'BODY' },
  { id: 'qc-4', label: 'All 4 Tires Balanced to 32 PSI', category: 'BODY' },
  { id: 'qc-5', label: 'Dent & Paint Surface Finish Inspection', category: 'BODY' },
  { id: 'qc-6', label: 'Headlights, Taillights & Indicators Working', category: 'ELECTRICAL' },
  { id: 'qc-7', label: 'OBD-II Scanner Diagnostic Codes Cleared', category: 'ELECTRICAL' },
  { id: 'qc-8', label: 'Interior Seat Covers & Floor Mats Protection Removed', category: 'INTERIOR' },
  { id: 'qc-9', label: 'Dashboard AC Cooling & Fan Test', category: 'INTERIOR' },
  { id: 'qc-10', label: 'Eco Steam Wash & Exterior Polish Complete', category: 'BODY' },
  { id: 'qc-11', label: 'Road Test - Braking & Alignment Verified', category: 'TEST_DRIVE' },
  { id: 'qc-12', label: 'Customer Personal Belongings & Spare Wheel Intact', category: 'INTERIOR' },
];

export function FloorManagerQCModal({
  card,
  onClose,
}: FloorManagerQCModalProps) {
  // Merge existing card qc checklist or use 12 point defaults
  const [checklist, setChecklist] = useState<QCCheckitem[]>(() => {
    if (card.qcChecklist && card.qcChecklist.length >= 6) {
      return card.qcChecklist;
    }
    return DEFAULT_12_POINT_QC.map(item => ({ ...item, isPassed: false }));
  });

  const [qcNotes, setQcNotes] = useState(card.qcNotes || '');

  const toggleCheck = (id: string) => {
    setChecklist(prev => prev.map(item => item.id === id ? { ...item, isPassed: !item.isPassed } : item));
  };

  const handlePassAll = () => {
    setChecklist(prev => prev.map(item => ({ ...item, isPassed: true })));
  };

  const handleSave = () => {
    updateQCChecklist(card.id, checklist, qcNotes);
    alert('Quality Inspection audit saved!');
    onClose();
  };

  const passedCount = checklist.filter(c => c.isPassed).length;
  const isFullyPassed = passedCount === checklist.length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="p-5 bg-purple-950 text-white border-b border-purple-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
              <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Floor Manager QC Inspection</h2>
              <p className="text-xs text-purple-300 font-mono">
                {card.vehicle.registrationNumber} • {card.vehicle.make} {card.vehicle.model}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg bg-purple-900 text-purple-300 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          
          <div className="flex items-center justify-between bg-purple-500/10 p-4 rounded-xl border border-purple-500/30">
            <div>
              <p className="text-xs font-bold text-purple-700 dark:text-purple-300">
                QC Progress: {passedCount} / {checklist.length} Passed
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Verify each safety & finish item prior to marking ready for delivery.
              </p>
            </div>

            <button
              onClick={handlePassAll}
              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
            >
              Pass All Items
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {checklist.map((item) => (
              <div
                key={item.id}
                onClick={() => toggleCheck(item.id)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                  item.isPassed
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 text-xs">
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                    item.isPassed ? 'bg-emerald-500 text-white border-emerald-500' : 'border-slate-400'
                  }`}>
                    {item.isPassed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                  <span>{item.label}</span>
                </div>
                <span className="text-[10px] uppercase font-bold text-slate-400">{item.category}</span>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Floor Manager Inspection Notes & Remarks
            </label>
            <textarea
              rows={3}
              value={qcNotes}
              onChange={(e) => setQcNotes(e.target.value)}
              placeholder="e.g. Paint finish verified under inspection light. Test drive executed smoothly."
              className="w-full p-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800">
            Cancel
          </button>

          <button
            onClick={handleSave}
            className={`px-6 py-2.5 rounded-xl font-extrabold text-xs shadow-md transition-all ${
              isFullyPassed
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-purple-600 hover:bg-purple-500 text-white'
            }`}
          >
            {isFullyPassed ? 'Mark QC Passed & Ready for Delivery' : 'Save QC Audit Progress'}
          </button>
        </div>

      </div>
    </div>
  );
}
