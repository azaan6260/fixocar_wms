import React, { useState, useEffect, useMemo } from 'react';
import { 
  JobCard, 
  StandardJob, 
  JobTask, 
  TaskCategory, 
  SpecializedTeam, 
  CarModelRecord, 
  FuelType, 
  TaskPartItem 
} from '../types';
import { 
  getStandardJobs, 
  getCarModels, 
  findCarModel, 
  updateJobCard, 
  getEmployees, 
  getVendors,
  dispatchToastNotification 
} from '../lib/storage';
import { FUEL_TYPE_CONFIG } from '../lib/carModelsData';
import { 
  Sparkles, 
  Calculator, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Car, 
  Wrench, 
  Package, 
  ShieldCheck, 
  ArrowRight, 
  RefreshCw, 
  Copy, 
  Check, 
  Percent, 
  Clock, 
  Info, 
  Sliders, 
  FileText,
  Search,
  Filter,
  Layers,
  ChevronDown,
  Zap,
  Tag,
  DollarSign
} from 'lucide-react';

export interface AICostEstimateItem {
  id: string;
  title: string;
  category: TaskCategory;
  partName: string;
  partNumber?: string;
  partCost: number;
  laborHours: number;
  laborCost: number;
  customerPrice: number;
  team: SpecializedTeam;
  requiresApproval?: boolean;
  isContractBasis?: boolean;
  painterPayout?: number;
  denterPayout?: number;
  explanation?: string;
  selected?: boolean;
}

export interface AICostEstimateResult {
  overallSummary: string;
  recommendedEstimate: {
    totalPartsCost: number;
    totalLaborCost: number;
    consumablesCost: number;
    subtotal: number;
    recommendedCustomerPrice: number;
    estimatedDealershipPrice: number;
    customerSavings: number;
    savingsPercentage: number;
    estimatedHours: number;
  };
  confidence: string;
  itemizedBreakdown: AICostEstimateItem[];
  modelInsights: string[];
  priceTierRange: {
    budgetOes: number;
    recommendedOem: number;
    premiumDealership: number;
  };
}

interface AICostEstimatorModalProps {
  card: JobCard;
  isOpen: boolean;
  onClose: () => void;
  onEstimateApplied?: () => void;
}

export function AICostEstimatorModal({
  card,
  isOpen,
  onClose,
  onEstimateApplied
}: AICostEstimatorModalProps) {
  if (!isOpen) return null;

  // Car model lookup
  const matchedModel = useMemo(() => {
    return findCarModel(card.vehicle.make, card.vehicle.model);
  }, [card.vehicle.make, card.vehicle.model]);

  const fuelType = (card.vehicle.fuelType || (matchedModel?.fuelTypes?.[0] as FuelType) || 'Petrol') as FuelType;
  const fuelConfig = FUEL_TYPE_CONFIG[fuelType] || FUEL_TYPE_CONFIG.Petrol;

  // Standard jobs catalog for multi-selection
  const standardJobs = useMemo(() => getStandardJobs(), []);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [searchJobQuery, setSearchJobQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Estimation settings
  const [customerType, setCustomerType] = useState<'RETAIL' | 'CARS24_B2B'>(
    card.isCars24 ? 'CARS24_B2B' : 'RETAIL'
  );
  const [pricingTier, setPricingTier] = useState<'STANDARD' | 'PREMIUM_OEM' | 'BUDGET_OES'>('PREMIUM_OEM');
  const [customRepairNotes, setCustomRepairNotes] = useState('');

  // Execution state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimateResult, setEstimateResult] = useState<AICostEstimateResult | null>(null);
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [copiedQuote, setCopiedQuote] = useState(false);
  const [applying, setApplying] = useState(false);

  // Filtered standard jobs for user selection
  const filteredStandardJobs = useMemo(() => {
    return standardJobs.filter(job => {
      const matchQuery = job.title.toLowerCase().includes(searchJobQuery.toLowerCase()) ||
        (job.description && job.description.toLowerCase().includes(searchJobQuery.toLowerCase()));
      const matchCat = categoryFilter === 'ALL' || job.category === categoryFilter;
      return matchQuery && matchCat;
    });
  }, [standardJobs, searchJobQuery, categoryFilter]);

  const handleToggleJobSelect = (id: string) => {
    setSelectedJobIds(prev => 
      prev.includes(id) ? prev.filter(jId => jId !== id) : [...prev, id]
    );
  };

  const handleSelectAllCategory = (cat: string) => {
    const idsInCat = standardJobs.filter(j => cat === 'ALL' || j.category === cat).map(j => j.id);
    setSelectedJobIds(prev => {
      const allSelected = idsInCat.every(id => prev.includes(id));
      if (allSelected) {
        return prev.filter(id => !idsInCat.includes(id));
      } else {
        return Array.from(new Set([...prev, ...idsInCat]));
      }
    });
  };

  // Run AI estimation
  const runAIEstimate = async () => {
    setLoading(true);
    setError(null);

    const selectedJobsPayload = standardJobs
      .filter(j => selectedJobIds.includes(j.id))
      .map(j => ({
        id: j.id,
        title: j.title,
        category: j.category,
        retailPrice: j.retailPrice,
        cars24Price: j.cars24Price,
        estimatedHours: j.estimatedHours,
        isContractBasis: j.isContractBasis,
        painterPayout: j.painterPayout,
        denterPayout: j.denterPayout,
        contractorPayout: j.contractorPayout,
        description: j.description
      }));

    const payload = {
      vehicle: {
        make: card.vehicle.make,
        model: card.vehicle.model,
        variant: card.vehicle.variant || matchedModel?.variants?.[0] || '',
        fuelType: fuelType,
        year: card.vehicle.year || 2022,
        mileage: card.vehicle.mileage || 35000,
        category: matchedModel?.category || 'Hatchback',
        engineOilSpec: matchedModel?.engineOilSpec || 'Synthetic 5W-30',
        coolantSpec: matchedModel?.coolantSpec || 'Long Life Coolant',
        recommendedPsi: matchedModel?.recommendedPsi || '32 PSI',
        notes: matchedModel?.notes || '',
        isCars24: card.isCars24
      },
      selectedJobs: selectedJobsPayload,
      customRepairNotes,
      customerType,
      pricingTier,
      existingTasks: card.tasks.map(t => ({
        title: t.title,
        category: t.category,
        customerPrice: t.customerPrice
      }))
    };

    try {
      const res = await fetch('/api/ai-cost-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success && data.estimate) {
        const est = data.estimate as AICostEstimateResult;
        setEstimateResult(est);
        
        // Default select all generated items
        const initialSelected: Record<string, boolean> = {};
        est.itemizedBreakdown.forEach((item, idx) => {
          initialSelected[item.id || `est-${idx}`] = true;
        });
        setSelectedItems(initialSelected);
      } else {
        throw new Error(data.error || 'Failed to generate AI cost estimation');
      }
    } catch (err: any) {
      console.error('Error generating AI estimate:', err);
      setError(err.message || 'Unable to connect to AI Estimator service.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-run estimation on modal open if no estimate yet
  useEffect(() => {
    if (isOpen && !estimateResult && !loading) {
      // Pre-select existing standard jobs if any
      const existingStdIds = card.tasks.map(t => t.standardJobId).filter(Boolean) as string[];
      if (existingStdIds.length > 0) {
        setSelectedJobIds(existingStdIds);
      }
      runAIEstimate();
    }
  }, [isOpen]);

  // Recalculate totals based on user checkbox toggles
  const activeItems = useMemo(() => {
    if (!estimateResult) return [];
    return estimateResult.itemizedBreakdown.filter(
      (item, idx) => selectedItems[item.id || `est-${idx}`] !== false
    );
  }, [estimateResult, selectedItems]);

  const liveTotals = useMemo(() => {
    if (!estimateResult) {
      return {
        customerPrice: 0,
        partsCost: 0,
        laborCost: 0,
        hours: 0,
        dealershipPrice: 0,
        savings: 0
      };
    }
    const customerPrice = activeItems.reduce((sum, it) => sum + (it.customerPrice || 0), 0);
    const partsCost = activeItems.reduce((sum, it) => sum + (it.partCost || 0), 0);
    const laborCost = activeItems.reduce((sum, it) => sum + (it.laborCost || 0), 0);
    const hours = activeItems.reduce((sum, it) => sum + (it.laborHours || 0), 0);
    const dealershipPrice = Math.round(customerPrice * 1.5);
    const savings = dealershipPrice - customerPrice;

    return {
      customerPrice,
      partsCost,
      laborCost,
      hours: Number(hours.toFixed(1)),
      dealershipPrice,
      savings
    };
  }, [activeItems, estimateResult]);

  // Apply selected items directly to Job Card
  const handleApplyToJobCard = () => {
    if (!estimateResult || activeItems.length === 0) return;
    setApplying(true);

    const employees = getEmployees();
    const vendors = getVendors();

    const newTasks: JobTask[] = activeItems.map((item, idx) => {
      // Team-based employee allotting
      let assignedEmp = employees.find(e => e.specializedTeam === item.team);
      if (!assignedEmp) {
        assignedEmp = employees.find(e => e.role === 'MECHANIC') || employees[0];
      }

      const isSublet = item.category === 'SUBLET_VENDOR' || item.team === 'Sublet / Lathe';
      const assignedVen = isSublet ? vendors[0] : undefined;

      const partsList: TaskPartItem[] = item.partName ? [
        {
          id: `part-${Date.now()}-${idx}`,
          name: item.partName,
          partNumber: item.partNumber || `OEM-${card.vehicle.make.slice(0, 3).toUpperCase()}`,
          quantity: 1,
          unitPrice: item.partCost || Math.round(item.customerPrice * 0.45),
          totalPrice: item.partCost || Math.round(item.customerPrice * 0.45),
          type: item.category === 'PAINT' ? 'CONSUMABLE' : 'PART',
          isApproved: true,
          addedAt: new Date().toLocaleString()
        }
      ] : [];

      return {
        id: `task-ai-${Date.now()}-${idx}`,
        jobCardId: card.id,
        title: item.title,
        category: item.category,
        assignedToId: isSublet ? assignedVen?.id : assignedEmp?.id,
        assignedToName: isSublet ? assignedVen?.name : assignedEmp?.name,
        assignedType: isSublet ? 'VENDOR' : 'EMPLOYEE',
        estimatedCost: item.partCost + item.laborCost,
        customerPrice: item.customerPrice,
        status: 'PENDING',
        requiresCustomerApproval: Boolean(item.requiresApproval),
        isCustomerApproved: item.requiresApproval ? null : true,
        isAdditionalWork: true,
        isContractBasis: Boolean(item.isContractBasis),
        painterPayout: item.painterPayout,
        denterPayout: item.denterPayout,
        contractorPayout: (item.painterPayout || 0) + (item.denterPayout || 0),
        partsList,
        notes: `AI Cost Estimation: ${item.explanation || `Optimized for ${card.vehicle.make} ${card.vehicle.model}`}`
      };
    });

    updateJobCard(card.id, prev => ({
      ...prev,
      tasks: [...prev.tasks, ...newTasks],
      status: prev.status === 'CREATED' ? 'ESTIMATE_PENDING' : prev.status
    }));

    dispatchToastNotification({
      type: 'JOB_CARD_CREATED',
      title: `✨ AI Estimate Applied to ${card.id}`,
      message: `Added ${newTasks.length} baseline tasks & parts (Total: ₹${liveTotals.customerPrice.toLocaleString('en-IN')}) for ${card.vehicle.make} ${card.vehicle.model}.`,
      vehicleReg: card.vehicle.registrationNumber,
      jobCardId: card.id,
      customerName: card.customer.name
    });

    setApplying(false);
    if (onEstimateApplied) onEstimateApplied();
    onClose();
  };

  // Copy structured estimate for WhatsApp / Customer Quote
  const handleCopyQuote = () => {
    if (!estimateResult) return;
    const lines = [
      `🚗 *FIXOCAR ESTIMATE QUOTATION*`,
      `Vehicle: ${card.vehicle.make} ${card.vehicle.model} (${card.vehicle.registrationNumber})`,
      `Fuel: ${fuelType} | Mileage: ${(card.vehicle.mileage || 0).toLocaleString()} km`,
      `---------------------------------`,
      `*Recommended Service & Parts Breakdown:*`,
      ...activeItems.map((item, i) => `${i + 1}. ${item.title}\n   • Spec: ${item.partName}\n   • Price: ₹${item.customerPrice.toLocaleString('en-IN')}`),
      `---------------------------------`,
      `*Total Baseline Estimate: ₹${liveTotals.customerPrice.toLocaleString('en-IN')}*`,
      `Estimated Dealership Price: ₹${liveTotals.dealershipPrice.toLocaleString('en-IN')}`,
      `💰 *You Save: ₹${liveTotals.savings.toLocaleString('en-IN')} with FixoCar*`,
      `Est. Turnaround: ${liveTotals.hours} hours`,
      `---------------------------------`,
      `FixoCar Multi-Brand Workshop • Genuine Parts Guaranteed`
    ];

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedQuote(true);
    setTimeout(() => setCopiedQuote(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        
        {/* MODAL TOP BANNER */}
        <div className="p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-black shadow-inner">
              <Sparkles className="w-6 h-6 fill-amber-400/30 text-amber-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  AI Cost Estimator
                </span>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-bold border border-slate-700">
                  {card.id}
                </span>
                {card.isCars24 ? (
                  <span className="bg-orange-500/30 text-orange-300 border border-orange-400/40 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    ⚡ Cars24 Fleet Partner
                  </span>
                ) : (
                  <span className="bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    🛒 Retail Customer
                  </span>
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold tracking-tight mt-1 flex items-center gap-2">
                <span>{card.vehicle.make} {card.vehicle.model}</span>
                <span className="text-slate-400 text-sm font-normal">({card.vehicle.registrationNumber})</span>
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CAR MODEL SPECIFICATIONS & CONFIGURATION DRAWER */}
        <div className="bg-slate-900/90 border-b border-slate-800 p-4 text-xs shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            
            {/* Spec 1: Make & Model */}
            <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
              <span className="text-slate-400 block text-[10px] font-semibold uppercase">Car Category</span>
              <span className="font-bold text-white text-xs">{matchedModel?.category || 'Standard Sedan/Hatch'}</span>
            </div>

            {/* Spec 2: Fuel Type */}
            <div className={`p-2.5 rounded-xl border ${fuelConfig.bgColor} ${fuelConfig.borderColor}`}>
              <span className="text-slate-400 block text-[10px] font-semibold uppercase">Fuel & Engine</span>
              <span className={`font-bold text-xs flex items-center gap-1 ${fuelConfig.textColor}`}>
                <span>{fuelConfig.emoji}</span>
                <span>{fuelType}</span>
              </span>
            </div>

            {/* Spec 3: Factory Oil Spec */}
            <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
              <span className="text-slate-400 block text-[10px] font-semibold uppercase">Engine Oil Spec</span>
              <span className="font-bold text-amber-300 text-xs truncate block" title={matchedModel?.engineOilSpec || 'Synthetic 5W-30'}>
                {matchedModel?.engineOilSpec ? matchedModel.engineOilSpec.split('•')[0] : 'Synthetic 5W-30'}
              </span>
            </div>

            {/* Spec 4: Coolant & Fluids */}
            <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
              <span className="text-slate-400 block text-[10px] font-semibold uppercase">Coolant & Odo</span>
              <span className="font-bold text-slate-200 text-xs">
                {(card.vehicle.mileage || 35000).toLocaleString()} km
              </span>
            </div>

            {/* Spec 5: Client Tier Toggle */}
            <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700/60 flex flex-col justify-center">
              <span className="text-slate-400 block text-[10px] font-semibold uppercase mb-1">Pricing Scheme</span>
              <select
                value={customerType}
                onChange={(e) => setCustomerType(e.target.value as any)}
                className="bg-slate-900 text-amber-400 font-bold rounded-lg px-2 py-1 border border-slate-700 text-xs focus:outline-hidden"
              >
                <option value="RETAIL">Retail Customer</option>
                <option value="CARS24_B2B">Cars24 B2B Fleet</option>
              </select>
            </div>

            {/* Spec 6: Tier Quality */}
            <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700/60 flex flex-col justify-center">
              <span className="text-slate-400 block text-[10px] font-semibold uppercase mb-1">Part Grade Tier</span>
              <select
                value={pricingTier}
                onChange={(e) => setPricingTier(e.target.value as any)}
                className="bg-slate-900 text-emerald-400 font-bold rounded-lg px-2 py-1 border border-slate-700 text-xs focus:outline-hidden"
              >
                <option value="PREMIUM_OEM">OEM Standard</option>
                <option value="STANDARD">Balanced OES</option>
                <option value="BUDGET_OES">Economy Aftermarket</option>
              </select>
            </div>
          </div>
        </div>

        {/* MAIN BODY: SPLIT VIEW (Standard Jobs Selector + AI Output) */}
        <div className="p-4 sm:p-6 overflow-y-auto grow space-y-6">
          
          {/* TOP SECTION: STANDARD JOBS SELECTOR ACCORDION */}
          <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-500" />
                  Select Standard Job Items to Estimate (Optional)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pick specific standard repair panels or service packages, or leave unselected for a full vehicle health baseline.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {selectedJobIds.length} items selected
                </span>
                {selectedJobIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedJobIds([])}
                    className="text-xs text-rose-500 hover:text-rose-600 font-bold underline"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter standard jobs..."
                  value={searchJobQuery}
                  onChange={(e) => setSearchJobQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                {['ALL', 'MECHANICAL', 'PAINT', 'DENTING', 'WASHING', 'ACCESSORIES'].map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors ${
                      categoryFilter === cat
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable Standard Job Chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1">
              {filteredStandardJobs.map(job => {
                const isSelected = selectedJobIds.includes(job.id);
                const price = customerType === 'CARS24_B2B' ? job.cars24Price : job.retailPrice;
                return (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => handleToggleJobSelect(job.id)}
                    className={`p-2 rounded-xl text-left text-xs border transition-all flex items-start justify-between gap-2 ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500 text-slate-900 dark:text-white font-bold ring-1 ring-amber-500/40'
                        : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-500/50'
                    }`}
                  >
                    <div className="space-y-0.5 truncate">
                      <p className="truncate font-semibold">{job.title}</p>
                      <span className="text-[10px] text-slate-400 block">{job.category} • ~{job.estimatedHours}h</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400 block">₹{price}</span>
                      <span className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center ml-auto ${
                        isSelected ? 'bg-amber-500 border-amber-500 text-slate-950' : 'border-slate-400'
                      }`}>
                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Additional notes prompt */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                value={customRepairNotes}
                onChange={(e) => setCustomRepairNotes(e.target.value)}
                placeholder="Additional notes for AI (e.g. customer complains of squeaking brakes, slight oil burning, rear door scratch)..."
                className="grow px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:border-amber-500"
              />

              <button
                type="button"
                onClick={runAIEstimate}
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-md hover:shadow-amber-500/20 active:scale-95 transition-all shrink-0 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? 'Analyzing Specs...' : 'Recalculate Estimate'}</span>
              </button>
            </div>
          </div>

          {/* ERROR STATE */}
          {error && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                onClick={runAIEstimate}
                className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold text-[11px]"
              >
                Retry
              </button>
            </div>
          )}

          {/* LOADING STATE */}
          {loading && !estimateResult && (
            <div className="p-12 text-center space-y-4">
              <div className="w-14 h-14 rounded-3xl bg-amber-500/10 border-2 border-amber-500 text-amber-500 flex items-center justify-center mx-auto animate-bounce">
                <Sparkles className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-slate-900 dark:text-white text-base">
                  Analyzing {card.vehicle.make} {card.vehicle.model} Specifications...
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Cross-referencing OEM parts catalog, engine oil capacity ({matchedModel?.engineOilSpec || '3.5L'}), brake wear limits, and competitive market labor rates.
                </p>
              </div>
            </div>
          )}

          {/* ESTIMATE RESULTS VIEW */}
          {estimateResult && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              
              {/* TOP SUMMARY CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                
                {/* 1. Recommended Customer Baseline Price */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/30 space-y-1">
                  <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-xs font-extrabold uppercase">
                    <span>Baseline Estimate</span>
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white">
                    ₹{liveTotals.customerPrice.toLocaleString('en-IN')}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Transparent customer billing across {activeItems.length} selected items
                  </p>
                </div>

                {/* 2. Dealership Benchmark & Savings */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/30 space-y-1">
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-extrabold uppercase">
                    <span>Customer Savings</span>
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                    ₹{liveTotals.savings.toLocaleString('en-IN')}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    vs Dealership: <span className="line-through">₹{liveTotals.dealershipPrice.toLocaleString('en-IN')}</span> (~35% saved)
                  </p>
                </div>

                {/* 3. Wholesale Parts vs Workshop Labor */}
                <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 space-y-1">
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 text-xs font-extrabold uppercase">
                    <span>Cost Split</span>
                    <DollarSign className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between pt-1">
                    <span>Parts Cost:</span>
                    <span className="font-mono text-blue-500 font-bold">₹{liveTotals.partsCost.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                    <span>Labor Cost:</span>
                    <span className="font-mono text-purple-500 font-bold">₹{liveTotals.laborCost.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* 4. Estimated Labor Hours & Turnaround */}
                <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 space-y-1">
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 text-xs font-extrabold uppercase">
                    <span>Turnaround</span>
                    <Clock className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white">
                    {liveTotals.hours} <span className="text-sm font-bold text-slate-400">Hours</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Calculated for {card.vehicle.make} technician workflow
                  </p>
                </div>
              </div>

              {/* MODEL TECHNICAL INSIGHTS BANNER */}
              {estimateResult.modelInsights && estimateResult.modelInsights.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-amber-700 dark:text-amber-400">
                    <Info className="w-4 h-4 shrink-0" />
                    <span>Technical Observations for {card.vehicle.make} {card.vehicle.model} ({fuelType}):</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 dark:text-slate-300">
                    {estimateResult.modelInsights.map((insight, idx) => (
                      <div key={idx} className="flex items-start gap-2 bg-white/50 dark:bg-slate-900/50 p-2 rounded-xl">
                        <span className="text-amber-500 font-bold">•</span>
                        <span>{insight}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ITEMIZED BREAKDOWN TABLE */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-amber-500" />
                    <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200">
                      Itemized Tasks & Spare Parts Recommendation ({estimateResult.itemizedBreakdown.length} items)
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        const allChecked: Record<string, boolean> = {};
                        estimateResult.itemizedBreakdown.forEach((it, idx) => {
                          allChecked[it.id || `est-${idx}`] = true;
                        });
                        setSelectedItems(allChecked);
                      }}
                      className="text-amber-600 dark:text-amber-400 font-bold hover:underline"
                    >
                      Select All
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setSelectedItems({})}
                      className="text-slate-500 hover:underline"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100/70 dark:bg-slate-800/40 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                        <th className="p-3 w-10 text-center">Include</th>
                        <th className="p-3">Job / Task Title</th>
                        <th className="p-3">Category & Team</th>
                        <th className="p-3">Part Name & OEM Spec</th>
                        <th className="p-3 text-right">Part Cost</th>
                        <th className="p-3 text-right">Labor Hrs</th>
                        <th className="p-3 text-right">Customer Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {estimateResult.itemizedBreakdown.map((item, idx) => {
                        const itemKey = item.id || `est-${idx}`;
                        const isChecked = selectedItems[itemKey] !== false;

                        return (
                          <tr 
                            key={itemKey}
                            className={`transition-colors ${
                              isChecked 
                                ? 'bg-white dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-800/40' 
                                : 'opacity-50 bg-slate-50/50 dark:bg-slate-950/40'
                            }`}
                          >
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  setSelectedItems(prev => ({
                                    ...prev,
                                    [itemKey]: e.target.checked
                                  }));
                                }}
                                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 cursor-pointer accent-amber-500"
                              />
                            </td>

                            <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                              <div className="space-y-0.5">
                                <span>{item.title}</span>
                                {item.explanation && (
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                                    {item.explanation}
                                  </p>
                                )}
                              </div>
                            </td>

                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                item.category === 'PAINT' ? 'bg-purple-500/20 text-purple-400' :
                                item.category === 'DENTING' ? 'bg-blue-500/20 text-blue-400' :
                                item.category === 'WASHING' ? 'bg-teal-500/20 text-teal-400' :
                                item.category === 'INSPECTION' ? 'bg-indigo-500/20 text-indigo-400' :
                                'bg-amber-500/20 text-amber-400'
                              }`}>
                                {item.category}
                              </span>
                              <span className="block text-[10px] text-slate-400 mt-0.5 font-medium">{item.team}</span>
                            </td>

                            <td className="p-3">
                              <div className="font-medium text-slate-800 dark:text-slate-200">
                                {item.partName || 'Service Consumables'}
                              </div>
                              {item.partNumber && (
                                <span className="font-mono text-[10px] text-slate-400">
                                  #{item.partNumber}
                                </span>
                              )}
                            </td>

                            <td className="p-3 text-right font-mono text-slate-500 dark:text-slate-400">
                              ₹{(item.partCost || 0).toLocaleString('en-IN')}
                            </td>

                            <td className="p-3 text-right font-mono text-slate-500 dark:text-slate-400">
                              {item.laborHours || 1}h
                            </td>

                            <td className="p-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">
                              ₹{(item.customerPrice || 0).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER ACTIONS BAR */}
        <div className="p-4 bg-slate-900 text-white border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Selected Total Estimate:</span>
              <span className="text-xl font-extrabold font-mono text-amber-400">
                ₹{liveTotals.customerPrice.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="h-8 w-px bg-slate-800 hidden sm:block" />

            <div className="text-right sm:text-left">
              <span className="text-[11px] text-slate-400 block font-medium">Customer Savings:</span>
              <span className="text-sm font-bold text-emerald-400 font-mono">
                +₹{liveTotals.savings.toLocaleString('en-IN')} vs Showroom
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            <button
              type="button"
              onClick={handleCopyQuote}
              disabled={!estimateResult}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-40"
            >
              {copiedQuote ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedQuote ? 'Copied Quote!' : 'Copy WhatsApp Quote'}</span>
            </button>

            <button
              type="button"
              onClick={handleApplyToJobCard}
              disabled={!estimateResult || activeItems.length === 0 || applying}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 active:scale-95 transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
              <span>{applying ? 'Applying...' : `1-Click Apply ${activeItems.length} Tasks to Job Card`}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
