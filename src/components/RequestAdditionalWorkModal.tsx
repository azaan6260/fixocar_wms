import React, { useState } from 'react';
import { JobCard, TaskCategory, UserRole, SpecializedTeam, JobTask } from '../types';
import { addRequisitionToTask, updateJobCard, dispatchToastNotification, getAuthUser, getStandardJobs, getAllEmployees } from '../lib/storage';
import { X, Wrench, Sparkles, Check, Send, ShieldCheck, Calculator, UserCheck } from 'lucide-react';

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

const CORE_13_JOB_IDS = [
  'std-gen-1',
  'std-gen-2',
  'std-gen-3',
  'std-gen-4',
  'std-gen-5',
  'std-gen-6',
  'std-gen-7',
  'std-gen-8',
  'std-gen-9',
  'std-gen-10',
  'std-gen-11',
  'std-gen-12',
  'std-gen-13',
];

export function RequestAdditionalWorkModal({
  card,
  isOpen,
  onClose,
  currentRole,
  currentEmployeeName,
  currentEmployeeId,
  initialCategory = 'MECHANICAL',
  initialTaskId
}: RequestAdditionalWorkModalProps) {
  if (!isOpen) return null;

  const authUser = getAuthUser();
  const effectiveRole = currentRole || authUser?.role || 'TECHNICIAN';
  const isManagerOrAdmin = effectiveRole === 'SUPER_ADMIN' || effectiveRole === 'FLOOR_MANAGER' || effectiveRole === 'ADMIN';

  const empId = currentEmployeeId || authUser?.employeeId || authUser?.id || 'emp-101';
  const empName = currentEmployeeName || authUser?.name || 'Workshop Employee';

  const allStandardJobs = getStandardJobs();
  const coreStandardJobs = allStandardJobs.filter(j => CORE_13_JOB_IDS.includes(j.id));
  const employees = getAllEmployees();

  const [selectedTaskId, setSelectedTaskId] = useState<string>(
    initialTaskId || card.tasks[0]?.id || ''
  );
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [workTitle, setWorkTitle] = useState('');
  const [category, setCategory] = useState<TaskCategory>(initialCategory);
  const [urgency, setUrgency] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');

  // Rates Breakdown (All Inclusive of 18% Tax)
  const isCars24 = !!card.isCars24;
  const [partPrice, setPartPrice] = useState<number>(0);
  const [labourPrice, setLabourPrice] = useState<number>(850);
  const [customerPrice, setCustomerPrice] = useState<number>(850);
  const [isContractBasis, setIsContractBasis] = useState<boolean>(false);
  const [contractorPayout, setContractorPayout] = useState<number>(350);
  const [assignedEmployeeId, setAssignedEmployeeId] = useState<string>('');

  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Active total rate inclusive of taxes
  const totalRate = Number(customerPrice) || 0;
  const baseTaxable = Math.round(totalRate / 1.18);
  const gstAmount = Math.round(totalRate - baseTaxable);

  const handleSelectPreset = (jobId: string) => {
    setSelectedPresetId(jobId);
    const sj = coreStandardJobs.find(j => j.id === jobId);
    if (sj) {
      setWorkTitle(sj.title);
      setCategory(sj.category);
      setIsContractBasis(sj.isContractBasis || false);
      const pRate = sj.partPrice ?? 0;
      const effectiveTotal = isCars24 ? sj.cars24Price : sj.retailPrice;
      const lRate = sj.labourPrice ?? Math.max(0, effectiveTotal - pRate);
      setPartPrice(pRate);
      setLabourPrice(lRate);
      setCustomerPrice(effectiveTotal);
      setContractorPayout(
        isCars24
          ? (sj.cars24ContractorPayout ?? sj.contractorPayout ?? 0)
          : (sj.retailContractorPayout ?? sj.contractorPayout ?? 0)
      );
    }
  };

  const handlePartChange = (p: number) => {
    const cleanP = Math.max(0, p);
    setPartPrice(cleanP);
    const newTotal = cleanP + labourPrice;
    setCustomerPrice(newTotal);
  };

  const handleLabourChange = (l: number) => {
    const cleanL = Math.max(0, l);
    setLabourPrice(cleanL);
    const newTotal = partPrice + cleanL;
    setCustomerPrice(newTotal);
  };

  const handleDirectApproveAndAdd = () => {
    if (!workTitle.trim()) {
      alert('Please enter additional work title');
      return;
    }

    let team: SpecializedTeam = 'Mechanical';
    if (category === 'PAINT') team = 'Paint';
    else if (category === 'DENTING') team = 'Denting';
    else if (category === 'WASHING') team = 'Detailing & Washing';
    else if (category === 'SUBLET_VENDOR' || category === 'LATHE_WORK') team = 'Sublet / Lathe';

    const assignedEmp = employees.find(e => e.id === assignedEmployeeId);

    const newTask: JobTask = {
      id: `task-add-${Date.now()}`,
      jobCardId: card.id,
      title: `[ADDITIONAL] ${workTitle.trim()}`,
      category,
      assignedToId: assignedEmployeeId || undefined,
      assignedToName: assignedEmp?.name,
      assignedType: 'EMPLOYEE',
      estimatedCost: isContractBasis ? contractorPayout : 0,
      customerPrice: totalRate,
      retailPrice: totalRate,
      cars24Price: totalRate,
      partPrice: Number(partPrice) || 0,
      labourPrice: Number(labourPrice) || 0,
      isTaxInclusive: true,
      status: 'PENDING',
      requiresCustomerApproval: false,
      isCustomerApproved: true,
      isContractBasis,
      contractorPayout: isContractBasis ? contractorPayout : 0,
      isAdditionalWork: true,
      additionalWorkRequestedBy: empName,
      additionalWorkRequestedAt: new Date().toISOString(),
      approvalStatus: 'APPROVED',
      notes: reason.trim() || `Directly approved additional work (${category}) by ${empName}`
    };

    updateJobCard(card.id, prev => ({
      ...prev,
      tasks: [...prev.tasks, newTask]
    }));

    dispatchToastNotification({
      type: 'STATUS_CHANGE',
      title: '✅ Additional Job Added to Card',
      message: `"${workTitle.trim()}" (₹${totalRate}) directly approved and added to ${card.vehicle.registrationNumber}.`,
      vehicleReg: card.vehicle.registrationNumber,
      jobCardId: card.id
    });

    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 1000);
  };

  const handleSubmitRequest = (e: React.FormEvent) => {
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
      suggestedPrice: totalRate,
      partPrice: Number(partPrice) || 0,
      labourPrice: Number(labourPrice) || 0,
      customerPrice: totalRate,
      cars24Price: isCars24 ? totalRate : undefined,
      isTaxInclusive: true,
      contractorPayout: isContractBasis ? contractorPayout : undefined
    });

    dispatchToastNotification({
      type: 'STATUS_CHANGE',
      title: '🚨 Additional Work Requested',
      message: `Request for "${workTitle.trim()}" (₹${totalRate}) on ${card.vehicle.registrationNumber} sent to Manager/Admin for approval.`,
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
      <div className="bg-slate-900 text-white rounded-3xl border border-slate-800 w-full max-w-xl p-5 sm:p-6 space-y-4 shadow-2xl relative max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white flex items-center gap-1.5">
                <span>Add / Request Additional Job</span>
                <span className="text-[10px] bg-emerald-500 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase">
                  Rates Incl. Tax
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
            <h4 className="font-black text-lg text-white">Additional Job Processed Successfully!</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              The additional job and rates have been saved to the job card.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmitRequest} className="space-y-4 text-xs">
            
            {/* Quick-Select 13 Standard Jobs Bar */}
            <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-2">
              <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Quick-Select Standard Job (Service, Wash, Checkups):
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                {coreStandardJobs.map((sj) => {
                  const isSelected = selectedPresetId === sj.id;
                  const price = isCars24 ? sj.cars24Price : sj.retailPrice;
                  return (
                    <button
                      key={sj.id}
                      type="button"
                      onClick={() => handleSelectPreset(sj.id)}
                      className={`px-2 py-1 rounded-xl border text-[10.5px] font-bold transition-all flex items-center gap-1 ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 border-amber-500 font-black'
                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-amber-400'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      <span>{sj.title.replace(/\s*\(.*\)/, '')}</span>
                      <span className="font-mono text-[9.5px] opacity-80">₹{price}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Work Title */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Additional Work Description / Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Wiper blade rear replace, AC leak test, Brake disc skimming..."
                value={workTitle}
                onChange={(e) => {
                  setWorkTitle(e.target.value);
                  setSelectedPresetId('');
                }}
                className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                  className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="MECHANICAL">MECHANICAL (यांत्रिक)</option>
                  <option value="WASHING">WASHING / DETAILING</option>
                  <option value="ACCESSORIES">ACCESSORIES / WIRING</option>
                  <option value="DENTING">DENTING (डेंटिंग)</option>
                  <option value="PAINT">PAINTING (पेंटिंग)</option>
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
                  className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="LOW">LOW (सामान्य)</option>
                  <option value="MEDIUM">MEDIUM (मध्यम)</option>
                  <option value="HIGH">HIGH (उच्च)</option>
                  <option value="CRITICAL">CRITICAL (अति आवश्यक)</option>
                </select>
              </div>
            </div>

            {/* Dedicated Rate Breakdown: Part Rate, Labour Rate, Total Incl. Tax */}
            <div className="p-3.5 bg-slate-800/40 rounded-2xl border border-slate-700/80 space-y-2.5">
              <span className="font-extrabold text-[11px] uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-emerald-400" />
                Additional Job Rates (Inclusive of 18% Tax)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-blue-400 uppercase mb-1">
                    Part Rate (₹, Incl. Tax)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={partPrice}
                    onChange={(e) => handlePartChange(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-blue-500/40 text-blue-300 font-mono font-bold text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-indigo-400 uppercase mb-1">
                    Labour Rate (₹, Incl. Tax)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={labourPrice}
                    onChange={(e) => handleLabourChange(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-indigo-500/40 text-indigo-300 font-mono font-bold text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-emerald-400 uppercase mb-1">
                    Total Customer Bill (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={customerPrice}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setCustomerPrice(val);
                      setLabourPrice(Math.max(0, val - partPrice));
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/50 text-emerald-300 font-mono font-extrabold text-xs"
                  />
                </div>
              </div>

              <div className="text-[10px] text-emerald-400 font-medium flex justify-between bg-emerald-500/5 px-2.5 py-1 rounded-xl border border-emerald-500/20">
                <span>Taxable Base: ₹{baseTaxable.toLocaleString('en-IN')}</span>
                <span>GST (18%): ₹{gstAmount.toLocaleString('en-IN')}</span>
                <span className="font-bold">Total: ₹{totalRate.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Contract Job Toggle & Payout */}
            <div className="p-3 bg-slate-800/40 rounded-2xl border border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isContractBasis}
                    onChange={(e) => setIsContractBasis(e.target.checked)}
                    className="rounded text-amber-500"
                  />
                  <span className="font-bold text-slate-200 text-xs">
                    Is Contract Job (ठेकेदार / पीस-रेट काम)
                  </span>
                </label>

                {isContractBasis && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-amber-400 uppercase">Payout: ₹</span>
                    <input
                      type="number"
                      min="0"
                      value={contractorPayout}
                      onChange={(e) => setContractorPayout(Number(e.target.value))}
                      className="w-20 px-2 py-1 rounded-lg bg-slate-900 border border-amber-500/40 text-amber-300 font-mono font-bold text-xs"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Staff Allotment & Target Task */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Assign Staff / Technician (Optional)
                </label>
                <select
                  value={assignedEmployeeId}
                  onChange={(e) => setAssignedEmployeeId(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-semibold text-xs"
                >
                  <option value="">-- Leave Unassigned --</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>
                      👷 {e.name} ({e.specializedTeam || e.role})
                    </option>
                  ))}
                </select>
              </div>

              {card.tasks.length > 1 && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Related Main Task
                  </label>
                  <select
                    value={selectedTaskId}
                    onChange={(e) => setSelectedTaskId(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold text-xs"
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
                placeholder="Explain observation or necessity (e.g. Wiper rubber cracked, AC refrigerant low)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-medium text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit for Approval</span>
              </button>

              {isManagerOrAdmin && (
                <button
                  type="button"
                  onClick={handleDirectApproveAndAdd}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Approve & Add Directly (₹{totalRate.toLocaleString('en-IN')})</span>
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
