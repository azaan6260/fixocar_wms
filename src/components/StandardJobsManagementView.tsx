import React, { useState } from 'react';
import { UserRole, StandardJob, TaskCategory, PaintScope } from '../types';
import { getStandardJobs, addStandardJob, updateStandardJob, deleteStandardJob } from '../lib/storage';
import { VEHICLE_PANELS } from './InteractiveVehicleInspectionChart';
import { Zap, Plus, Edit2, Trash2, ShieldCheck, Tag, DollarSign, Clock, Layers, Save, X, Search, Lock, Car, Paintbrush, Sparkles } from 'lucide-react';

interface StandardJobsManagementViewProps {
  currentRole: UserRole;
}

export const PAINT_SCOPE_LABELS: Record<PaintScope, { label: string; desc: string; icon: string; bg: string; text: string; border: string }> = {
  FULL_OUTER: {
    label: 'Full Outer Paint',
    desc: 'Standard 100% exterior panel restoration',
    icon: '✨',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-500/30'
  },
  PARTIAL_TOUCHUP: {
    label: 'Partial Paint / Touch-Up',
    desc: 'Scratch & partial section spot painting',
    icon: '🎨',
    bg: 'bg-amber-500/10',
    text: 'text-amber-800 dark:text-amber-300',
    border: 'border-amber-500/30'
  },
  INSIDE_JAMB: {
    label: 'Inside Paint (Door Jamb / Frame)',
    desc: 'Inner aperture, door frame & jamb painting',
    icon: '🚪',
    bg: 'bg-purple-500/10',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-500/30'
  },
  FULL_OUTER_AND_INSIDE: {
    label: 'Full Outer + Inside Paint',
    desc: 'Complete exterior and inner jamb restoration',
    icon: '🌟',
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-indigo-500/30'
  }
};

export function StandardJobsManagementView({ currentRole }: StandardJobsManagementViewProps) {
  const canManage = currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN';

  if (!canManage) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-lg mx-auto my-12 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-black text-slate-900 dark:text-white">Access Restricted</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
          The Standard Jobs Library is confidential and restricted to Workshop Administrators (Super Admin & Admin). Employee accounts do not have access to view or edit standard job rates and contractor payouts.
        </p>
      </div>
    );
  }
  const [standardJobs, setStandardJobs] = useState<StandardJob[]>(() => getStandardJobs());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCat, setFilterCat] = useState<string>('ALL');

  // Form modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formCat, setFormCat] = useState<TaskCategory>('PAINT');
  const [formPanelKey, setFormPanelKey] = useState<string>('door_rhs_rear');
  const [formPaintScope, setFormPaintScope] = useState<PaintScope>('FULL_OUTER');
  
  const [formRetailPrice, setFormRetailPrice] = useState<number>(2500);
  const [formCars24Price, setFormCars24Price] = useState<number>(1800);
  const [formIsContract, setFormIsContract] = useState<boolean>(true);
  
  // Dual Contract Payout state: Retail vs Cars24
  const [formRetailPainterPayout, setFormRetailPainterPayout] = useState<number>(950);
  const [formRetailDenterPayout, setFormRetailDenterPayout] = useState<number>(200);
  const [formCars24PainterPayout, setFormCars24PainterPayout] = useState<number>(800);
  const [formCars24DenterPayout, setFormCars24DenterPayout] = useState<number>(150);
  const [formContractorPayout, setFormContractorPayout] = useState<number>(950);
  
  const [formHours, setFormHours] = useState<number>(2);
  const [formDesc, setFormDesc] = useState('');

  const refreshList = () => {
    setStandardJobs(getStandardJobs());
  };

  const handleOpenAdd = () => {
    setEditingJobId(null);
    setFormTitle('Door RHS Rear Painting & Denting');
    setFormCat('PAINT');
    setFormPanelKey('door_rhs_rear');
    setFormPaintScope('FULL_OUTER');
    setFormRetailPrice(1800);
    setFormCars24Price(1350);
    setFormIsContract(true);
    setFormRetailPainterPayout(950);
    setFormRetailDenterPayout(200);
    setFormCars24PainterPayout(800);
    setFormCars24DenterPayout(150);
    setFormContractorPayout(1150);
    setFormHours(3);
    setFormDesc('Full outer panel paint with computerized color match, primer coat & clear coat polish.');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (job: StandardJob) => {
    setEditingJobId(job.id);
    setFormTitle(job.title);
    setFormCat(job.category);
    setFormPanelKey(job.panelKey || 'NONE');
    setFormPaintScope(job.paintScope || 'FULL_OUTER');
    setFormRetailPrice(job.retailPrice);
    setFormCars24Price(job.cars24Price);
    setFormIsContract(job.isContractBasis);
    setFormRetailPainterPayout(job.retailPainterPayout ?? job.painterPayout ?? 950);
    setFormRetailDenterPayout(job.retailDenterPayout ?? job.denterPayout ?? 200);
    setFormCars24PainterPayout(job.cars24PainterPayout ?? job.painterPayout ?? 800);
    setFormCars24DenterPayout(job.cars24DenterPayout ?? job.denterPayout ?? 150);
    setFormContractorPayout(job.contractorPayout || ((job.painterPayout || 0) + (job.denterPayout || 0)));
    setFormHours(job.estimatedHours);
    setFormDesc(job.description || '');
    setIsModalOpen(true);
  };

  const handlePanelSelectionChange = (panelKey: string) => {
    setFormPanelKey(panelKey);
    const selectedPanel = VEHICLE_PANELS.find(p => p.id === panelKey);
    if (selectedPanel) {
      const scopeText = PAINT_SCOPE_LABELS[formPaintScope].label;
      setFormTitle(`${selectedPanel.nameEn} (${scopeText})`);
    } else if (panelKey === 'NONE') {
      setFormTitle('General Paint Repair');
    }
  };

  const handlePaintScopeChange = (scope: PaintScope) => {
    setFormPaintScope(scope);
    const selectedPanel = VEHICLE_PANELS.find(p => p.id === formPanelKey);
    const scopeInfo = PAINT_SCOPE_LABELS[scope];
    
    if (selectedPanel) {
      setFormTitle(`${selectedPanel.nameEn} (${scopeInfo.label})`);
    }

    // Auto-adjust default multiplier rates for convenience
    let multiplier = 1.0;
    if (scope === 'PARTIAL_TOUCHUP') multiplier = 0.6;
    if (scope === 'INSIDE_JAMB') multiplier = 0.5;
    if (scope === 'FULL_OUTER_AND_INSIDE') multiplier = 1.35;

    const baseRetail = selectedPanel ? selectedPanel.defaultPrice : 1800;
    const baseCars24 = 1350;

    setFormRetailPrice(Math.round(baseRetail * multiplier));
    setFormCars24Price(Math.round(baseCars24 * multiplier));
    setFormRetailPainterPayout(Math.round(950 * multiplier));
    setFormCars24PainterPayout(Math.round(800 * multiplier));
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this standard job from the library?')) {
      deleteStandardJob(id);
      refreshList();
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    const selectedPanel = VEHICLE_PANELS.find(p => p.id === formPanelKey);

    const retailPainter = formIsContract ? (Number(formRetailPainterPayout) || 0) : 0;
    const retailDenter = formIsContract ? (Number(formRetailDenterPayout) || 0) : 0;
    const retailTotal = retailPainter + retailDenter;

    const cars24Painter = formIsContract ? (Number(formCars24PainterPayout) || 0) : 0;
    const cars24Denter = formIsContract ? (Number(formCars24DenterPayout) || 0) : 0;
    const cars24Total = cars24Painter + cars24Denter;

    const generalTotal = formIsContract ? (Number(formContractorPayout) || retailTotal || cars24Total) : 0;

    const jobData: Partial<StandardJob> = {
      title: formTitle.trim(),
      category: formCat,
      panelKey: formPanelKey !== 'NONE' ? formPanelKey : undefined,
      panelNameEn: selectedPanel ? selectedPanel.nameEn : undefined,
      paintScope: formPaintScope,
      retailPrice: Number(formRetailPrice) || 0,
      cars24Price: Number(formCars24Price) || 0,
      isContractBasis: formIsContract,
      // Retail contract rates
      retailPainterPayout: retailPainter,
      retailDenterPayout: retailDenter,
      retailContractorPayout: retailTotal,
      // Cars24 contract rates
      cars24PainterPayout: cars24Painter,
      cars24DenterPayout: cars24Denter,
      cars24ContractorPayout: cars24Total,
      // Fallback
      painterPayout: retailPainter || cars24Painter,
      denterPayout: retailDenter || cars24Denter,
      contractorPayout: generalTotal,
      estimatedHours: Number(formHours) || 1,
      description: formDesc.trim()
    };

    if (editingJobId) {
      updateStandardJob(editingJobId, jobData);
    } else {
      addStandardJob(jobData as StandardJob);
    }

    setIsModalOpen(false);
    refreshList();
  };

  const filtered = standardJobs.filter(j => {
    const matchesSearch = j.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (j.description && j.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (j.panelNameEn && j.panelNameEn.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (j.panelKey && j.panelKey.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCat = filterCat === 'ALL' || j.category === filterCat;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-200 text-xs font-bold uppercase tracking-widest mb-1">
            <Zap className="w-4 h-4 text-amber-300 fill-amber-300" /> AutoCraft Standard Jobs Library
          </div>
          <h1 className="text-2xl font-black">Standard Jobs & Dual Pricing Catalog</h1>
          <p className="text-amber-100/90 text-sm mt-1 max-w-2xl">
            Pre-configure standard repair & service packages with differential rates for Retail Customers vs Cars24 B2B fleet, and specify Denting/Painting contractor payouts.
          </p>
        </div>

        {canManage && (
          <button
            onClick={handleOpenAdd}
            className="px-5 py-3 rounded-xl bg-white text-slate-900 font-extrabold text-sm hover:bg-amber-50 shadow-lg flex items-center gap-2 self-start md:self-auto transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4 text-amber-600" /> Create Standard Job
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search catalog by title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-medium outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          {['ALL', 'PAINT', 'DENTING', 'MECHANICAL', 'WASHING', 'SUBLET_VENDOR'].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                filterCat === cat
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {cat === 'ALL' ? 'All Standard Jobs' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Standard Jobs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((job) => (
          <div
            key={job.id}
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                  job.category === 'PAINT' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20' :
                  job.category === 'DENTING' ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20' :
                  job.category === 'MECHANICAL' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' :
                  'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                }`}>
                  {job.category}
                </span>

                {canManage && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(job)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Edit Job"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(job.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Delete Job"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <h3 className="font-extrabold text-base text-slate-900 dark:text-white leading-tight">
                {job.title}
              </h3>

              {/* Linked Body Panel and Paint Scope Badges */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {job.panelNameEn ? (
                  <span className="px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 font-bold text-[10px] flex items-center gap-1">
                    <Car className="w-3 h-3 text-blue-500" />
                    {job.panelNameEn}
                    {job.panelKey && <span className="opacity-60 text-[9px]">[{job.panelKey}]</span>}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium text-[10px]">
                    General / Multi-panel
                  </span>
                )}

                {job.paintScope && PAINT_SCOPE_LABELS[job.paintScope] ? (
                  <span className={`px-2 py-0.5 rounded-lg border font-bold text-[10px] flex items-center gap-1 ${PAINT_SCOPE_LABELS[job.paintScope].bg} ${PAINT_SCOPE_LABELS[job.paintScope].text} ${PAINT_SCOPE_LABELS[job.paintScope].border}`}>
                    <span>{PAINT_SCOPE_LABELS[job.paintScope].icon}</span>
                    {PAINT_SCOPE_LABELS[job.paintScope].label}
                  </span>
                ) : null}
              </div>

              {job.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">
                  {job.description}
                </p>
              )}

              {/* Pricing Cards Comparison */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
                  <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center justify-center gap-1">
                    <Tag className="w-3 h-3 text-emerald-500" /> Retail Price
                  </div>
                  <div className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                    ₹{job.retailPrice.toLocaleString()}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-center">
                  <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase flex items-center justify-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-blue-500" /> Cars24 Rate
                  </div>
                  <div className="text-base font-black text-blue-700 dark:text-blue-300 mt-0.5">
                    ₹{job.cars24Price.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Contractor Payout Section with Dual Rate Comparison */}
              {job.isContractBasis && (
                <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-800 dark:text-amber-200 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-amber-900 dark:text-amber-300">
                    <span className="flex items-center gap-1 font-extrabold">
                      <DollarSign className="w-3.5 h-3.5 text-amber-500" /> Contract Rates:
                    </span>
                    <span className="text-[10px] text-slate-500">Painter / Denter</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-300 flex flex-col">
                      <span className="text-[9px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400">Retail Contract</span>
                      <span className="font-mono font-black">
                        ₹{job.retailContractorPayout ?? job.contractorPayout}
                      </span>
                      {(job.retailPainterPayout || job.painterPayout) ? (
                        <span className="text-[9.5px] text-emerald-700 dark:text-emerald-400/80">
                          P: ₹{job.retailPainterPayout ?? job.painterPayout} | D: ₹{job.retailDenterPayout ?? job.denterPayout}
                        </span>
                      ) : null}
                    </div>

                    <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-900 dark:text-blue-300 flex flex-col">
                      <span className="text-[9px] font-extrabold uppercase text-blue-600 dark:text-blue-400">Cars24 Contract</span>
                      <span className="font-mono font-black">
                        ₹{job.cars24ContractorPayout ?? job.contractorPayout}
                      </span>
                      {(job.cars24PainterPayout || job.painterPayout) ? (
                        <span className="text-[9.5px] text-blue-700 dark:text-blue-400/80">
                          P: ₹{job.cars24PainterPayout ?? job.painterPayout} | D: ₹{job.cars24DenterPayout ?? job.denterPayout}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> Est. {job.estimatedHours} hrs
              </span>
              <span>{job.isContractBasis ? 'Contract Job' : 'Standard Labor'}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Edit / Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                {editingJobId ? 'Edit Standard Job' : 'Create New Standard Job'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs overflow-y-auto">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Job / Repair Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Full Panel Painting (Per Panel)"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Category *
                  </label>
                  <select
                    value={formCat}
                    onChange={(e) => setFormCat(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                  >
                    <option value="PAINT">PAINT</option>
                    <option value="DENTING">DENTING</option>
                    <option value="MECHANICAL">MECHANICAL</option>
                    <option value="WASHING">WASHING</option>
                    <option value="SUBLET_VENDOR">SUBLET VENDOR</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Est. Hours
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={formHours}
                    onChange={(e) => setFormHours(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                  />
                </div>
              </div>

              {/* Linked Body Panel Selection */}
              <div className="p-3 bg-blue-500/5 dark:bg-blue-950/20 border border-blue-500/20 rounded-2xl space-y-2">
                <label className="block font-extrabold text-blue-900 dark:text-blue-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Car className="w-4 h-4 text-blue-500" /> Linked Standard Body Panel
                  </span>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-normal">Connects with Visual Inspection Diagram</span>
                </label>

                <select
                  value={formPanelKey}
                  onChange={(e) => handlePanelSelectionChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-blue-200 dark:border-blue-800/80 bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-slate-100"
                >
                  <option value="NONE">-- None (General Non-Panel Job) --</option>
                  {VEHICLE_PANELS.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nameEn} ({p.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Paint Scope Option */}
              {(formCat === 'PAINT' || formCat === 'DENTING') && (
                <div className="p-3 bg-purple-500/5 dark:bg-purple-950/20 border border-purple-500/20 rounded-2xl space-y-2">
                  <label className="block font-extrabold text-purple-900 dark:text-purple-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Paintbrush className="w-4 h-4 text-purple-500" /> Paint Finish / Scope Option
                    </span>
                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-normal">Partial / Inside / Full Paint</span>
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(PAINT_SCOPE_LABELS) as PaintScope[]).map((scopeKey) => {
                      const item = PAINT_SCOPE_LABELS[scopeKey];
                      const isSelected = formPaintScope === scopeKey;
                      return (
                        <button
                          key={scopeKey}
                          type="button"
                          onClick={() => handlePaintScopeChange(scopeKey)}
                          className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                            isSelected
                              ? 'bg-purple-600 text-white border-purple-700 shadow-md ring-2 ring-purple-400/50'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-purple-300'
                          }`}
                        >
                          <div className="flex items-center justify-between font-black text-[11px]">
                            <span className="flex items-center gap-1">
                              <span>{item.icon}</span> {item.label}
                            </span>
                            {isSelected && <Sparkles className="w-3 h-3 text-amber-300 fill-amber-300" />}
                          </div>
                          <span className={`text-[9.5px] mt-1 leading-tight ${isSelected ? 'text-purple-100' : 'text-slate-400 dark:text-slate-400'}`}>
                            {item.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Pricing Grid */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                    Retail Customer Price (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formRetailPrice}
                    onChange={(e) => setFormRetailPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 font-black text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-blue-700 dark:text-blue-400 mb-1">
                    Cars24 B2B Rate (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formCars24Price}
                    onChange={(e) => setFormCars24Price(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-blue-300 dark:border-blue-800 bg-white dark:bg-slate-900 font-black text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Contract Basis & Contractor Payout */}
              <div className="p-3.5 bg-amber-500/10 rounded-xl border border-amber-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-extrabold text-amber-900 dark:text-amber-200">Contract Basis Job?</span>
                    <p className="text-[11px] text-amber-700 dark:text-amber-300">Set for Denting/Painting jobs allotted to painters/denters on contract payout.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formIsContract}
                    onChange={(e) => setFormIsContract(e.target.checked)}
                    className="w-5 h-5 rounded-md accent-amber-500"
                  />
                </div>

                {formIsContract && (
                  <div className="space-y-3 pt-2 border-t border-amber-500/20 text-xs">
                    
                    {/* Retail Contract Rates Box */}
                    <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/30 space-y-2">
                      <div className="font-extrabold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                        <span>🛒 Retail Contract Rates</span>
                        <span className="font-mono text-xs">Total: ₹{(Number(formRetailPainterPayout) || 0) + (Number(formRetailDenterPayout) || 0)}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Retail Painter (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formRetailPainterPayout}
                            onChange={(e) => setFormRetailPainterPayout(Number(e.target.value) || 0)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 font-extrabold text-purple-600 dark:text-purple-400"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Retail Denter (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formRetailDenterPayout}
                            onChange={(e) => setFormRetailDenterPayout(Number(e.target.value) || 0)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 font-extrabold text-orange-600 dark:text-orange-400"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Cars24 Contract Rates Box */}
                    <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/30 space-y-2">
                      <div className="font-extrabold text-blue-800 dark:text-blue-300 flex items-center justify-between">
                        <span>⚡ Cars24 Fleet Contract Rates</span>
                        <span className="font-mono text-xs">Total: ₹{(Number(formCars24PainterPayout) || 0) + (Number(formCars24DenterPayout) || 0)}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Cars24 Painter (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formCars24PainterPayout}
                            onChange={(e) => setFormCars24PainterPayout(Number(e.target.value) || 0)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-blue-300 dark:border-blue-800 bg-white dark:bg-slate-900 font-extrabold text-purple-600 dark:text-purple-400"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Cars24 Denter (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formCars24DenterPayout}
                            onChange={(e) => setFormCars24DenterPayout(Number(e.target.value) || 0)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-blue-300 dark:border-blue-800 bg-white dark:bg-slate-900 font-extrabold text-orange-600 dark:text-orange-400"
                          />
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Inclusions
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Computerized color match, primer coat & clear lacquer polish..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow-md flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" /> Save Standard Job
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
