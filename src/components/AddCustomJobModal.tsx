import React, { useState } from 'react';
import { X, Wrench, Building2, UserCheck, Hammer, DollarSign, ShieldCheck, Sparkles, Check, Calculator } from 'lucide-react';
import { TaskCategory, SpecializedTeam, Employee, Vendor, StandardJob } from '../types';
import { getStandardJobs, addStandardJob } from '../lib/storage';

export interface CustomJobData {
  title: string;
  category: TaskCategory;
  team: SpecializedTeam;
  assignedToId?: string;
  assignedToName?: string;
  assignedType: 'EMPLOYEE' | 'VENDOR';
  estimatedCost: number;
  customerPrice: number;
  retailPrice?: number;
  cars24Price?: number;
  partPrice?: number;
  labourPrice?: number;
  isTaxInclusive?: boolean;
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
  standardJobId?: string;
}

interface AddCustomJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  vendors: Vendor[];
  isCars24?: boolean;
  onAddJob: (job: CustomJobData) => void;
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

export function AddCustomJobModal({
  isOpen,
  onClose,
  employees,
  vendors,
  isCars24 = false,
  onAddJob,
}: AddCustomJobModalProps) {
  if (!isOpen) return null;

  const allStandardJobs = getStandardJobs();
  const coreStandardJobs = allStandardJobs.filter(j => CORE_13_JOB_IDS.includes(j.id));

  const [selectedStdJobId, setSelectedStdJobId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [jobExecutionType, setJobExecutionType] = useState<'IN_HOUSE' | 'CONTRACTOR' | 'OUTSOURCED'>('CONTRACTOR');
  const [category, setCategory] = useState<TaskCategory>('MECHANICAL');

  // Detailed Rate Breakdown (Inclusive of Taxes)
  const [partPrice, setPartPrice] = useState<number>(0);
  const [labourPrice, setLabourPrice] = useState<number>(850);
  const [retailPrice, setRetailPrice] = useState<number>(850);
  const [cars24Price, setCars24Price] = useState<number>(650);
  const [contractorPayout, setContractorPayout] = useState<number>(350);
  const [painterPayout, setPainterPayout] = useState<number>(800);
  const [denterPayout, setDenterPayout] = useState<number>(150);
  const [requiresCustomerApproval, setRequiresCustomerApproval] = useState<boolean>(false);
  const [saveToCatalog, setSaveToCatalog] = useState<boolean>(false);

  // Allotments
  const [assignedToId, setAssignedToId] = useState<string>('');
  const [pairedDenterId, setPairedDenterId] = useState<string>('');

  // Active total rate based on mode (Retail vs Cars24)
  const totalRate = isCars24 ? cars24Price : retailPrice;
  const baseTaxable = Math.round(totalRate / 1.18);
  const gstAmount = Math.round(totalRate - baseTaxable);

  // Apply one of the 13 generalized standard jobs
  const handleSelectStandardPreset = (job: StandardJob) => {
    setSelectedStdJobId(job.id);
    setTitle(job.title);
    setCategory(job.category);
    setJobExecutionType(job.isContractBasis ? 'CONTRACTOR' : 'IN_HOUSE');
    const pRate = job.partPrice ?? 0;
    const lRate = job.labourPrice ?? Math.max(0, (isCars24 ? job.cars24Price : job.retailPrice) - pRate);
    setPartPrice(pRate);
    setLabourPrice(lRate);
    setRetailPrice(job.retailPrice);
    setCars24Price(job.cars24Price);
    setContractorPayout(
      isCars24
        ? (job.cars24ContractorPayout ?? job.contractorPayout ?? 0)
        : (job.retailContractorPayout ?? job.contractorPayout ?? 0)
    );
    setPainterPayout(
      isCars24
        ? (job.cars24PainterPayout ?? job.painterPayout ?? 800)
        : (job.retailPainterPayout ?? job.painterPayout ?? 950)
    );
    setDenterPayout(
      isCars24
        ? (job.cars24DenterPayout ?? job.denterPayout ?? 150)
        : (job.retailDenterPayout ?? job.denterPayout ?? 200)
    );
  };

  // Update Part Rate and auto-recalculate Total (Customer & Cars24 rate)
  const handlePartPriceChange = (val: number) => {
    const cleanPart = Math.max(0, val);
    setPartPrice(cleanPart);
    const combined = cleanPart + labourPrice;
    setRetailPrice(combined);
    if (isCars24) {
      setCars24Price(combined);
    }
  };

  // Update Labour Rate and auto-recalculate Total (Customer & Cars24 rate)
  const handleLabourPriceChange = (val: number) => {
    const cleanLabour = Math.max(0, val);
    setLabourPrice(cleanLabour);
    const combined = partPrice + cleanLabour;
    setRetailPrice(combined);
    if (isCars24) {
      setCars24Price(combined);
    }
  };

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
    else if (category === 'SUBLET_VENDOR' || category === 'LATHE_WORK') team = 'Sublet / Lathe';

    const isOutsourced = jobExecutionType === 'OUTSOURCED' || category === 'SUBLET_VENDOR';
    const isContractBasis = jobExecutionType === 'CONTRACTOR' || category === 'PAINT' || category === 'DENTING';

    const selectedVendor = vendors.find(v => v.id === assignedToId);
    const selectedEmployee = employees.find(e => e.id === assignedToId);
    const selectedDenter = employees.find(e => e.id === pairedDenterId);

    const assignedType: 'EMPLOYEE' | 'VENDOR' = isOutsourced ? 'VENDOR' : 'EMPLOYEE';
    const finalPayout = category === 'PAINT'
      ? (painterPayout + denterPayout)
      : (isContractBasis || isOutsourced ? contractorPayout : 0);

    const effectiveCustomerPrice = isCars24 ? (Number(cars24Price) || 0) : (Number(retailPrice) || 0);

    let finalStdJobId = selectedStdJobId || undefined;
    if (saveToCatalog && !selectedStdJobId) {
      const createdStd = addStandardJob({
        title: title.trim(),
        category,
        hsnSacCode: partPrice > 0 ? '87089900' : '998729',
        retailPrice: Number(retailPrice) || 0,
        cars24Price: Number(cars24Price) || 0,
        partPrice: Number(partPrice) || 0,
        labourPrice: Number(labourPrice) || 0,
        isTaxInclusive: true,
        isContractBasis,
        contractorPayout: finalPayout,
        retailContractorPayout: finalPayout,
        cars24ContractorPayout: finalPayout,
        painterPayout: category === 'PAINT' ? painterPayout : undefined,
        denterPayout: category === 'PAINT' ? denterPayout : undefined,
        estimatedHours: 1.5,
        description: `Custom standard job (${isContractBasis ? 'Contract' : 'In-House'})`
      });
      finalStdJobId = createdStd.id;
    }

    const jobData: CustomJobData = {
      title: title.trim(),
      category,
      team,
      assignedToId: assignedToId || undefined,
      assignedToName: isOutsourced ? selectedVendor?.name : selectedEmployee?.name,
      assignedType,
      estimatedCost: finalPayout,
      customerPrice: effectiveCustomerPrice,
      retailPrice: Number(retailPrice) || 0,
      cars24Price: Number(cars24Price) || 0,
      partPrice: Number(partPrice) || 0,
      labourPrice: Number(labourPrice) || 0,
      isTaxInclusive: true,
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
      standardJobId: finalStdJobId,
    };

    onAddJob(jobData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col text-slate-900 dark:text-slate-100">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-linear-to-r from-amber-500/10 via-slate-900/5 to-transparent border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <span>Add Custom / Standard Job</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  All Rates Incl. Tax
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Select a generalized standard job or enter custom job with Customer Rate, Cars24 Rate, Part Rate, Labour Rate & Contract Payout
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
          
          {/* Quick-Select 13 Standard Jobs Bar */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Quick-Fill from 13 Standard Jobs (या नीचे कस्टम नाम लिखें):
              </span>
              {selectedStdJobId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStdJobId('');
                    setTitle('');
                  }}
                  className="text-[10px] font-bold text-slate-500 hover:text-rose-500 underline"
                >
                  Clear Preset
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
              {coreStandardJobs.map((sj) => {
                const isSelected = selectedStdJobId === sj.id;
                const displayRate = isCars24 ? sj.cars24Price : sj.retailPrice;
                return (
                  <button
                    key={sj.id}
                    type="button"
                    onClick={() => handleSelectStandardPreset(sj)}
                    className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs font-black'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-amber-400'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    <span>{sj.title.replace(/\s*\(.*\)/, '')}</span>
                    <span className={`font-mono text-[10px] px-1 rounded ${
                      isSelected ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400'
                    }`}>
                      ₹{displayRate}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Job Name & Department Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1 uppercase tracking-wider text-[11px]">
                Job Name / Title (काम का नाम) *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setSelectedStdJobId('');
                }}
                placeholder="e.g. Service, Rubbing, Wiper Blade Front Replace, Custom AC Repair..."
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1 uppercase tracking-wider text-[11px]">
                Department (विभाग)
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TaskCategory)}
                className="w-full px-3 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold text-xs"
              >
                <option value="MECHANICAL">🔧 MECHANICAL</option>
                <option value="WASHING">🧼 WASHING & SPA</option>
                <option value="ACCESSORIES">⚡ ACCESSORIES / WIRING</option>
                <option value="DENTING">🔨 DENTING</option>
                <option value="PAINT">🎨 PAINTING</option>
                <option value="SUBLET_VENDOR">🏭 SUBLET VENDOR</option>
                <option value="LATHE_WORK">⚙️ LATHE WORK</option>
                <option value="ALIGNMENT_BALANCING">🧭 ALIGNMENT & BALANCING</option>
                <option value="TYRE_WORK">🛞 TYRE WORK</option>
                <option value="INSPECTION">🔍 INSPECTION</option>
              </select>
            </div>
          </div>

          {/* Complete Rate Breakdown Section (Customer Rate, Cars24 Rate, Part Rate, Labour Rate, Total Incl. Tax, Contract Payout) */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700/60 pb-2">
              <span className="font-extrabold text-[11px] uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-emerald-500" />
                Complete Rate Breakdown (Inclusive of 18% GST)
              </span>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                Active Mode: {isCars24 ? '⚡ Cars24 Tariff' : '🏷️ Customer Retail Tariff'}
              </span>
            </div>

            {/* Row 1: Part Rate + Labour Rate = Total Rate */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase mb-1">
                  1. Part Rate (₹, Incl. Tax)
                </label>
                <input
                  type="number"
                  min="0"
                  value={partPrice}
                  onChange={(e) => handlePartPriceChange(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-800 font-mono font-extrabold text-blue-600 dark:text-blue-400 text-xs focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[9px] text-slate-400 block mt-0.5">Spares / consumables cost</span>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase mb-1">
                  2. Labour Rate (₹, Incl. Tax)
                </label>
                <input
                  type="number"
                  min="0"
                  value={labourPrice}
                  onChange={(e) => handleLabourPriceChange(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-800 font-mono font-extrabold text-indigo-600 dark:text-indigo-400 text-xs focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-[9px] text-slate-400 block mt-0.5">Service / workmanship charge</span>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase mb-1">
                  3. Total Bill Rate (₹, Incl. Tax)
                </label>
                <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/40 font-mono font-black text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between">
                  <span>₹{totalRate.toLocaleString('en-IN')}</span>
                  <span className="text-[9px] font-sans font-bold uppercase bg-emerald-500/20 px-1.5 py-0.5 rounded">
                    Part + Labour
                  </span>
                </div>
                <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium block mt-0.5">
                  Base ₹{baseTaxable} + 18% GST ₹{gstAmount}
                </span>
              </div>
            </div>

            {/* Row 2: Customer Rate vs Cars24 Rate */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase mb-1">
                  Customer Rate (Retail ₹, Incl. Tax)
                </label>
                <input
                  type="number"
                  min="0"
                  value={retailPrice}
                  onChange={(e) => {
                    const val = Math.max(0, Number(e.target.value));
                    setRetailPrice(val);
                    if (!isCars24) {
                      setLabourPrice(Math.max(0, val - partPrice));
                    }
                  }}
                  className={`w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border font-mono font-extrabold text-xs ${
                    !isCars24
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-orange-700 dark:text-orange-400 uppercase mb-1">
                  Cars24 Rate (B2B ₹, Incl. Tax)
                </label>
                <input
                  type="number"
                  min="0"
                  value={cars24Price}
                  onChange={(e) => {
                    const val = Math.max(0, Number(e.target.value));
                    setCars24Price(val);
                    if (isCars24) {
                      setLabourPrice(Math.max(0, val - partPrice));
                    }
                  }}
                  className={`w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border font-mono font-extrabold text-xs ${
                    isCars24
                      ? 'border-orange-500 ring-2 ring-orange-500/20 text-orange-600 dark:text-orange-400'
                      : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Job Execution Mode & Contract Payout */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3">
            <label className="block text-slate-700 dark:text-slate-300 font-extrabold uppercase tracking-wider text-[11px]">
              Execution Mode & Contract Payout (जॉब प्रकार व ठेकेदार पेआउट)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleTypeChange('CONTRACTOR')}
                className={`p-2.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-1 cursor-pointer ${
                  jobExecutionType === 'CONTRACTOR'
                    ? 'bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-300 font-bold shadow-xs'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[11px] font-extrabold">Contract Job</span>
                </div>
                <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">Piece-rate Payout</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('IN_HOUSE')}
                className={`p-2.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-1 cursor-pointer ${
                  jobExecutionType === 'IN_HOUSE'
                    ? 'bg-blue-500/10 border-blue-500 text-blue-700 dark:text-blue-300 font-bold shadow-xs'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-[11px] font-extrabold">In-House Staff</span>
                </div>
                <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">Regular Payroll</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('OUTSOURCED')}
                className={`p-2.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-1 cursor-pointer ${
                  jobExecutionType === 'OUTSOURCED'
                    ? 'bg-purple-500/10 border-purple-500 text-purple-700 dark:text-purple-300 font-bold shadow-xs'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-purple-500" />
                  <span className="text-[11px] font-extrabold">Outsourced</span>
                </div>
                <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">Sublet Vendor</span>
              </button>
            </div>

            {/* Contract Payout Input if Contract Job or Outsourced or Paint */}
            {category === 'PAINT' ? (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[10px] text-purple-600 dark:text-purple-400 font-bold block mb-1">
                    Painter Payout (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={painterPayout}
                    onChange={(e) => setPainterPayout(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 font-mono font-bold text-purple-600 dark:text-purple-400 text-xs"
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
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 font-mono font-bold text-amber-600 dark:text-amber-400 text-xs"
                  />
                </div>
              </div>
            ) : (jobExecutionType === 'CONTRACTOR' || jobExecutionType === 'OUTSOURCED') && (
              <div className="pt-1">
                <label className="block text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase mb-1">
                  {jobExecutionType === 'OUTSOURCED' ? 'Sublet Vendor Payout Rate (₹)' : 'Contract Payout Rate (ठेकेदार पेआउट ₹)'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={contractorPayout}
                  onChange={(e) => setContractorPayout(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-amber-400 dark:border-amber-700 font-mono font-extrabold text-amber-600 dark:text-amber-400 text-xs focus:ring-2 focus:ring-amber-500"
                />
              </div>
            )}
          </div>

          {/* Staff / Contractor Allotment */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2.5">
            <span className="font-extrabold text-[11px] uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-purple-500" />
              {jobExecutionType === 'OUTSOURCED' ? 'Sublet Vendor Allotment' : 'Employee / Contractor Allotment (स्टाफ आवंटन)'}
            </span>

            {jobExecutionType === 'OUTSOURCED' ? (
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
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className={category === 'PAINT' ? '' : 'sm:col-span-2'}>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    {category === 'PAINT' ? 'Assign Painter' : 'Assign Employee / Technician'}
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
                      Assign Pre-Paint Denter
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

          {/* Options Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <label className="flex items-center gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={requiresCustomerApproval}
                onChange={(e) => setRequiresCustomerApproval(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
              />
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 text-xs block">
                  Requires Customer Approval
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                  Flag as pending customer approval
                </span>
              </div>
            </label>

            {!selectedStdJobId && (
              <label className="flex items-center gap-2 p-3 rounded-2xl bg-amber-500/5 border border-amber-500/20 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveToCatalog}
                  onChange={(e) => setSaveToCatalog(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                />
                <div>
                  <span className="font-bold text-amber-700 dark:text-amber-300 text-xs block">
                    Save to Standard Jobs Catalog
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                    Reuse this custom job & rates on future job cards
                  </span>
                </div>
              </label>
            )}
          </div>

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
              <span>Add Job to Card (₹{totalRate.toLocaleString('en-IN')})</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
