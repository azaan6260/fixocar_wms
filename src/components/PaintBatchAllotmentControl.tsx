import React, { useState, useEffect } from 'react';
import { Employee, JobTask } from '../types';
import { AllocatedTaskItem } from './JobAllotmentPipeline';
import { Paintbrush, Hammer, UserCheck, ShieldCheck, CheckCircle2, RefreshCw, Users } from 'lucide-react';

interface PaintBatchAllotmentControlProps {
  paintTasks: (JobTask | AllocatedTaskItem)[];
  employees: Employee[];
  onApplyBatchAllotment: (
    painterId: string | undefined,
    painterName: string | undefined,
    denterId: string | undefined,
    denterName: string | undefined
  ) => void;
  vehicleReg?: string;
  isCars24?: boolean;
}

export function PaintBatchAllotmentControl({
  paintTasks,
  employees,
  onApplyBatchAllotment,
  vehicleReg,
  isCars24
}: PaintBatchAllotmentControlProps) {
  // Filter painters and denters from employee list
  const painters = employees.filter(
    e => e.role === 'PAINTER' || e.specializedTeam === 'Paint' || e.role === 'MECHANIC'
  );
  const denters = employees.filter(
    e => e.role === 'DENTER' || e.specializedTeam === 'Denting' || e.role === 'MECHANIC'
  );

  // Fallback lists if specific roles are empty
  const availablePainters = painters.length > 0 ? painters : employees;
  const availableDenters = denters.length > 0 ? denters : employees;

  // Determine initial common painter & denter if all tasks match
  const firstPainterId = paintTasks[0]?.assignedToId;
  const allSamePainter = paintTasks.length > 0 && paintTasks.every(t => t.assignedToId === firstPainterId && firstPainterId);
  
  const firstDenterId = paintTasks[0]?.pairedDenterId;
  const allSameDenter = paintTasks.length > 0 && paintTasks.every(t => t.pairedDenterId === firstDenterId && firstDenterId);

  const [selectedPainterId, setSelectedPainterId] = useState<string>(allSamePainter ? (firstPainterId || '') : '');
  const [selectedDenterId, setSelectedDenterId] = useState<string>(allSameDenter ? (firstDenterId || '') : '');
  const [justApplied, setJustApplied] = useState(false);

  useEffect(() => {
    if (allSamePainter && firstPainterId) {
      setSelectedPainterId(firstPainterId);
    }
    if (allSameDenter && firstDenterId) {
      setSelectedDenterId(firstDenterId);
    }
  }, [paintTasks, allSamePainter, firstPainterId, allSameDenter, firstDenterId]);

  if (paintTasks.length === 0) return null;

  const handleApply = () => {
    const painterObj = availablePainters.find(e => e.id === selectedPainterId) || employees.find(e => e.id === selectedPainterId);
    const denterObj = availableDenters.find(e => e.id === selectedDenterId) || employees.find(e => e.id === selectedDenterId);

    onApplyBatchAllotment(
      selectedPainterId || undefined,
      painterObj?.name || undefined,
      selectedDenterId || undefined,
      denterObj?.name || undefined
    );

    setJustApplied(true);
    setTimeout(() => setJustApplied(false), 3000);
  };

  return (
    <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-900/90 via-slate-900 to-indigo-950 text-white border border-purple-500/30 shadow-xl space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-800/50 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm text-purple-200">
                Vehicle Paint & Dent Batch Allotment
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-300 border border-purple-400/40 font-mono font-bold text-[10px]">
                {paintTasks.length} Panel{paintTasks.length === 1 ? '' : 's'} Total
              </span>
            </div>
            <p className="text-[11px] text-purple-300/80 mt-0.5">
              Allot all vehicle paint jobs to <span className="font-bold text-white">1 Painter & 1 Denter</span>. Changing here reassigns all panels together.
            </p>
          </div>
        </div>

        {vehicleReg && (
          <div className="text-right shrink-0">
            <span className="font-mono text-xs font-black text-amber-300 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-amber-500/30">
              {vehicleReg}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
        {/* Painter Dropdown */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-purple-300 flex items-center gap-1.5">
            <Paintbrush className="w-3.5 h-3.5 text-purple-400" />
            <span>Primary Painter (All Paint Panels)</span>
          </label>
          <select
            value={selectedPainterId}
            onChange={(e) => setSelectedPainterId(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-purple-500/40 text-white font-medium focus:ring-2 focus:ring-purple-400 focus:outline-none"
          >
            <option value="">-- Select Painter for All Panels --</option>
            {availablePainters.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.role || 'Painter'})
              </option>
            ))}
          </select>
        </div>

        {/* Denter Dropdown */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-orange-300 flex items-center gap-1.5">
            <Hammer className="w-3.5 h-3.5 text-orange-400" />
            <span>Primary Denter (All Dent Prep)</span>
          </label>
          <select
            value={selectedDenterId}
            onChange={(e) => setSelectedDenterId(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-orange-500/40 text-white font-medium focus:ring-2 focus:ring-orange-400 focus:outline-none"
          >
            <option value="">-- Select Denter for All Panels --</option>
            {availableDenters.map(d => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.role || 'Denter'})
              </option>
            ))}
          </select>
        </div>

        {/* Apply All Action Button */}
        <div>
          <button
            type="button"
            onClick={handleApply}
            className={`w-full py-2 px-4 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-lg ${
              justApplied
                ? 'bg-emerald-500 text-slate-950 border border-emerald-400'
                : 'bg-amber-400 hover:bg-amber-300 text-slate-950 border border-amber-300'
            }`}
          >
            {justApplied ? (
              <>
                <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                <span>All {paintTasks.length} Panels Reassigned Together!</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Assign / Change All {paintTasks.length} Panels Together</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
