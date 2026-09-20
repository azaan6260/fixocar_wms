import React, { useState } from 'react';
import { X, Wrench, Building2, UserCheck, Hammer, Paintbrush, DollarSign, AlertCircle, ShieldCheck } from 'lucide-react';
import { TaskCategory, SpecializedTeam, Employee, Vendor } from '../types';

export interface CustomJobData {
  title: string;
  category: TaskCategory;
  team: SpecializedTeam;
  assignedToId?: string;
  assignedToName?: string;
  assignedType: 'EMPLOYEE' | 'VENDOR';
  estimatedCost: number;
  customerPrice: number;
  requiresCustomerApproval: boolean;
  isContractBasis?: boolean;
  contractorPayout?: number;
  painterPayout?: number;
  denterPayout?: number;
  pairedDenterId?: string;
  pairedDenterName?: string;
  isOutsourced?: boolean;
  outsourcedVendorId?: string;
  outsourcedVendorName?: string;
}

interface AddCustomJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  vendors: Vendor[];
  onAddJob: (job: CustomJobData) => void;
}

export function AddCustomJobModal({
  isOpen,
  onClose,
  employees,
  vendors,
  onAddJob,
}: AddCustomJobModalProps) {
  if (!isOpen) return null;

  const [title, setTitle] = useState('');
  const [jobExecutionType, setJobExecutionType] = useState<'IN_HOUSE' | 'CONTRACTOR' | 'OUTSOURCED'>('CONTRACTOR');
  const [category, setCategory] = useState<TaskCategory>('MECHANICAL');
  
  // Financials
  const [contractorPayout, setContractorPayout] = useState<number>(350);
  const [painterPayout, setPainterPayout] = useState<number>(800);
  const [denterPayout, setDenterPayout] = useState<number>(150);
  const [customerPrice, setCustomerPrice] = useState<number>(850);
  const [requiresCustomerApproval, setRequiresCustomerApproval] = useState<boolean>(false);

  // Allotments
  const [assignedToId, setAssignedToId] = useState<string>('');
  const [pairedDenterId, setPairedDenterId] = useState<string>('');

  // When job type changes, sync category & defaults
  const handleTypeChange = (type: 'IN_HOUSE' | 'CONTRACTOR' | 'OUTSOURCED') => {
    setJobExecutionType(type);
    if (type === 'OUTSOURCED') {
      setCategory('SUBLET_VENDOR');
      if (vendors.length > 0 && !assignedToId) {
        setAssignedToId(vendors[0].id);
      }
    } else if (type === 'CONTRACTOR') {
      if (category === 'SUBLET_VENDOR') setCategory('MECHANICAL');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Please enter a valid job title.');
      return;
    }

    let team: SpecializedTeam = 'Mechanical';
    if (category === 'PAINT') team = 'Paint';
    else if (category === 'DENTING') team = 'Denting';
    else if (category === 'WASHING') team = 'Detailing & Washing';
    else if (category === 'SUBLET_VENDOR') team = 'Sublet / Lathe';

    const isOutsourced = jobExecutionType === 'OUTSOURCED' || category === 'SUBLET_VENDOR';
    const isContractBasis = jobExecutionType === 'CONTRACTOR' || category === 'PAINT' || category === 'DENTING';

    const selectedVendor = vendors.find(v => v.id === assignedToId);
    const selectedEmployee = employees.find(e => e.id === assignedToId);
    const selectedDenter = employees.find(e => e.id === pairedDenterId);

    const assignedType: 'EMPLOYEE' | 'VENDOR' = isOutsourced ? 'VENDOR' : 'EMPLOYEE';

    const finalPayout = category === 'PAINT' ? (painterPayout + denterPayout) : contractorPayout;

    const jobData: CustomJobData = {
      title: title.trim(),
      category,
      team,
      assignedToId: assignedToId || undefined,
      assignedToName: isOutsourced ? selectedVendor?.name : selectedEmployee?.name,
      assignedType,
      estimatedCost: finalPayout,
      customerPrice: Number(customerPrice) || 0,
      requiresCustomerApproval,
      isContractBasis,
      contractorPayout: finalPayout,
      painterPayout: category === 'PAINT' ? painterPayout : undefined,
      denterPayout: category === 'PAINT' ? denterPayout : undefined,
      pairedDenterId: category === 'PAINT' ? (pairedDenterId || undefined) : undefined,
      pairedDenterName: category === 'PAINT' ? (selectedDenter?.name || undefined) : undefined,
      isOutsourced,
      outsourcedVendorId: isOutsourced ? (assignedToId || undefined) : undefined,
      outsourcedVendorName: isOutsourced ? (selectedVendor?.name || undefined) : undefined,
    };

    onAddJob(jobData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-lg shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col text-slate-900 dark:text-slate-100">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-linear-to-r from-amber-500/10 via-slate-900/5 to-transparent border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
                Add Custom Job / Repair (कस्टम जॉब जोड़ें)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure job title, outsource status, contractor payout, and billing price
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto text-xs">
          
          {/* Job Name Input */}
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1 uppercase tracking-wider text-[11px]">
              Job Name / Title (काम का नाम) *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Alloy Wheel Polishing, Sublet Glass Fitting, Steering Rack Overhaul..."
              className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          {/* Job Execution Mode Options */}
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5 uppercase tracking-wider text-[11px]">
              Job Execution Type (जॉब प्रकार) *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleTypeChange('CONTRACTOR')}
                className={`p-2.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-1 cursor-pointer ${
                  jobExecutionType === 'CONTRACTOR'
                    ? 'bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-300 font-bold shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[11px] font-extrabold">Contractor</span>
                </div>
                <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">Piece-rate Payout</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('OUTSOURCED')}
                className={`p-2.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-1 cursor-pointer ${
                  jobExecutionType === 'OUTSOURCED'
                    ? 'bg-purple-500/10 border-purple-500 text-purple-700 dark:text-purple-300 font-bold shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-purple-500" />
                  <span className="text-[11px] font-extrabold">Outsourced</span>
                </div>
                <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">Sublet Vendor</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('IN_HOUSE')}
                className={`p-2.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-1 cursor-pointer ${
                  jobExecutionType === 'IN_HOUSE'
                    ? 'bg-blue-500/10 border-blue-500 text-blue-700 dark:text-blue-300 font-bold shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-[11px] font-extrabold">In-House Staff</span>
                </div>
                <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">Regular Salary</span>
              </button>
            </div>
          </div>

          {/* Department / Category */}
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1 uppercase tracking-wider text-[11px]">
              Department / Category (विभाग)
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TaskCategory)}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold text-xs"
            >
              <option value="MECHANICAL">🔧 MECHANICAL (मैकेनिकल)</option>
              <option value="DENTING">🔨 DENTING (डेंटिंग)</option>
              <option value="PAINT">🎨 PAINT (पेंटिंग)</option>
              <option value="WASHING">🧼 WASHING & DETAILING (वाशिंग)</option>
              <option value="SUBLET_VENDOR">🏭 SUBLET VENDOR (सबलेट वेंडर)</option>
              <option value="ACCESSORIES">⚡ ACCESSORIES / ELECTRICAL (इलेक्ट्रिकल/एक्सेसरीज)</option>
              <option value="INSPECTION">🔍 INSPECTION & ROAD TEST (निरीक्षण)</option>
            </select>
          </div>

          {/* Pricing Grid: Contractor Payout vs Customer Billing Price */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3">
            <span className="font-extrabold text-[11px] uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              Payouts & Customer Billing (पेआउट व ग्राहक बिलिंग)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Contractor Payout */}
              {category === 'PAINT' ? (
                <div className="space-y-2 col-span-2 bg-purple-500/10 dark:bg-purple-950/20 p-2.5 rounded-xl border border-purple-200 dark:border-purple-800">
                  <span className="font-bold text-purple-700 dark:text-purple-300 text-[10px] uppercase">
                    Painting Split Payouts (पेंटर व डेंटर पेआउट)
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-purple-600 dark:text-purple-400 font-bold block mb-1">
                        Painter Payout (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={painterPayout}
                        onChange={(e) => setPainterPayout(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 font-mono font-bold text-purple-600 dark:text-purple-400 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block mb-1">
                        Pre-Denter Payout (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={denterPayout}
                        onChange={(e) => setDenterPayout(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 font-mono font-bold text-amber-600 dark:text-amber-400 text-xs"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase mb-1">
                    {jobExecutionType === 'OUTSOURCED' ? 'Vendor Cost Payout (वेंडर पेआउट) ₹' : 'Contractor Payout (ठेकेदार पेआउट) ₹'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={contractorPayout}
                    onChange={(e) => setContractorPayout(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800/80 font-mono font-extrabold text-amber-600 dark:text-amber-400 text-xs focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}

              {/* Customer Billing Price */}
              <div>
                <label className="block text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase mb-1">
                  Customer Price (ग्राहक बिलिंग मूल्य) ₹
                </label>
                <input
                  type="number"
                  min="0"
                  value={customerPrice}
                  onChange={(e) => setCustomerPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800/80 font-mono font-extrabold text-emerald-600 dark:text-emerald-400 text-xs focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Contractor / Staff Allotment */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3">
            <span className="font-extrabold text-[11px] uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-purple-500" />
              {jobExecutionType === 'OUTSOURCED' ? 'Sublet Contractor Allotment (सबलेट वेंडर आवंटन)' : 'Staff & Contractor Allotment (स्टाफ/ठेकेदार आवंटन)'}
            </span>

            {jobExecutionType === 'OUTSOURCED' ? (
              <div>
                <label className="block text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase mb-1">
                  Select Sublet Vendor (वेंडर चुनें) *
                </label>
                <select
                  value={assignedToId}
                  onChange={(e) => setAssignedToId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-800 font-bold text-slate-900 dark:text-slate-100 text-xs"
                >
                  <option value="">-- Choose Sublet Vendor --</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>
                      🏭 {v.name} ({v.category || 'Vendor'}) • Phone: {v.phone}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    {category === 'PAINT' ? 'Assign Painter (चित्रकार चुनें)' : 'Assign Technician / Contractor (तकनीशियन/ठेकेदार)'}
                  </label>
                  <select
                    value={assignedToId}
                    onChange={(e) => setAssignedToId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-slate-100 text-xs"
                  >
                    <option value="">-- Leave Unassigned (Allot Later) --</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>
                        👷 {e.name} ({e.specializedTeam || e.role})
                      </option>
                    ))}
                  </select>
                </div>

                {category === 'PAINT' && (
                  <div>
                    <label className="block text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase mb-1">
                      <Hammer className="w-3 h-3 inline mr-1 text-amber-500" />
                      Assign Pre-Paint Denter (डेंटर आवंटन)
                    </label>
                    <select
                      value={pairedDenterId}
                      onChange={(e) => setPairedDenterId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 font-bold text-amber-700 dark:text-amber-300 text-xs"
                    >
                      <option value="">-- No Denter Allotted --</option>
                      {employees.map(e => (
                        <option key={e.id} value={e.id}>
                          🔨 {e.name} ({e.specializedTeam || e.role})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Requires Customer Approval Checkbox */}
          <label className="flex items-center gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={requiresCustomerApproval}
              onChange={(e) => setRequiresCustomerApproval(e.target.checked)}
              className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
            />
            <div>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-xs block">
                Requires Customer Approval First
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                Flag job as pending estimate approval before work commences
              </span>
            </div>
          </label>

          {/* Modal Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-500/20 cursor-pointer flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Add Custom Job</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
