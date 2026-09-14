import React, { useState } from 'react';
import { JobCard, TaskCategory, UserRole } from '../types';
import { addRequisitionToTask, dispatchToastNotification, getAuthUser } from '../lib/storage';
import { X, Wrench, Sparkles, Plus, AlertTriangle, Send, Check } from 'lucide-react';

interface RequestAdditionalWorkModalProps {
  card: JobCard;
  isOpen: boolean;
  onClose: () => void;
  currentRole?: UserRole;
  currentEmployeeName?: string;
  currentEmployeeId?: string;
  initialCategory?: TaskCategory;
  initialTaskId?: string;
}

export function RequestAdditionalWorkModal({
  card,
  isOpen,
  onClose,
  currentEmployeeName,
  currentEmployeeId,
  initialCategory = 'MECHANICAL',
  initialTaskId
}: RequestAdditionalWorkModalProps) {
  if (!isOpen) return null;

  const authUser = getAuthUser();
  const empId = currentEmployeeId || authUser?.employeeId || authUser?.id || 'emp-101';
  const empName = currentEmployeeName || authUser?.name || 'Workshop Employee';

  const [selectedTaskId, setSelectedTaskId] = useState<string>(
    initialTaskId || card.tasks[0]?.id || ''
  );
  const [workTitle, setWorkTitle] = useState('');
  const [category, setCategory] = useState<TaskCategory>(initialCategory);
  const [urgency, setUrgency] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');
  const [suggestedPrice, setSuggestedPrice] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workTitle.trim()) return;

    let targetTaskId = selectedTaskId;
    if (!targetTaskId && card.tasks.length > 0) {
      targetTaskId = card.tasks[0].id;
    }

    if (!targetTaskId) {
      alert('This job card does not have any active tasks to attach the request to.');
      return;
    }

    addRequisitionToTask(card.id, targetTaskId, {
      requestedByEmployeeId: empId,
      requestedByEmployeeName: empName,
      title: `[${category}] ${workTitle.trim()}`,
      itemType: 'ADDITIONAL_WORK',
      quantity: 1,
      urgency,
      reason: reason.trim() || `Additional ${category} work requested by ${empName}`,
      suggestedPrice: suggestedPrice !== '' ? Number(suggestedPrice) : undefined
    });

    dispatchToastNotification({
      type: 'STATUS_CHANGE',
      title: '🚨 Additional Work Requested',
      message: `Request for "${workTitle.trim()}" on ${card.vehicle.registrationNumber} sent to Manager/Admin for approval.`,
      vehicleReg: card.vehicle.registrationNumber,
      jobCardId: card.id
    });

    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
      <div className="bg-slate-900 text-white rounded-3xl border border-slate-800 w-full max-w-lg p-5 sm:p-6 space-y-4 shadow-2xl relative">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white flex items-center gap-1.5">
                <span>Request Additional Work</span>
                <span className="text-[10px] bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase">
                  Needs Approval
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Vehicle: <span className="font-bold text-slate-200">{card.vehicle.registrationNumber}</span> ({card.vehicle.make} {card.vehicle.model})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto text-2xl font-black animate-bounce">
              <Check className="w-8 h-8" />
            </div>
            <h4 className="font-black text-lg text-white">Work Request Sent to Manager!</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Your request for additional work has been submitted. The Manager or Admin will review and approve it.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Work Title */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Additional Work Description / Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Left rear fender dent repair, Front brake pad replacement"
                value={workTitle}
                onChange={(e) => setWorkTitle(e.target.value)}
                className="w-full p-3 rounded-2xl bg-slate-800 border border-slate-700 text-white font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Category & Urgency */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Work Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TaskCategory)}
                  className="w-full p-3 rounded-2xl bg-slate-800 border border-slate-700 text-white font-bold text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="MECHANICAL">MECHANICAL (यांत्रिक)</option>
                  <option value="DENTING">DENTING (डेंटिंग)</option>
                  <option value="PAINT">PAINTING (पेंटिंग)</option>
                  <option value="WASHING">WASHING / DETAILING</option>
                  <option value="LATHE_WORK">LATHE WORK (लेथ काम)</option>
                  <option value="SUBLET_VENDOR">SUBLET VENDOR</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Urgency Level
                </label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as any)}
                  className="w-full p-3 rounded-2xl bg-slate-800 border border-slate-700 text-white font-bold text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="LOW">LOW (सामान्य)</option>
                  <option value="MEDIUM">MEDIUM (मध्यम)</option>
                  <option value="HIGH">HIGH (उच्च)</option>
                  <option value="CRITICAL">CRITICAL (अति आवश्यक)</option>
                </select>
              </div>
            </div>

            {/* Estimated Price & Target Task */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Suggested Price / Estimate (₹) <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 1500"
                  value={suggestedPrice}
                  onChange={(e) => setSuggestedPrice(e.target.value !== '' ? Number(e.target.value) : '')}
                  className="w-full p-3 rounded-2xl bg-slate-800 border border-slate-700 text-amber-300 font-mono font-bold text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {card.tasks.length > 1 && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Related Main Task
                  </label>
                  <select
                    value={selectedTaskId}
                    onChange={(e) => setSelectedTaskId(e.target.value)}
                    className="w-full p-3 rounded-2xl bg-slate-800 border border-slate-700 text-white font-bold text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {card.tasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} ({t.category})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Description / Reason */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Reason / Observation Notes
              </label>
              <textarea
                rows={2}
                placeholder="Explain why this extra work is required (e.g. Deep dent found after removing door trim during inspection)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full p-3 rounded-2xl bg-slate-800 border border-slate-700 text-white font-medium text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Note: This request will be sent to the Floor Manager / Admin. Once approved, the job will be added to the official job card.
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
              >
                <Send className="w-4 h-4" />
                <span>Submit Request for Manager Approval</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
