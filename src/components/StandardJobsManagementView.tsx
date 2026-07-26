import React, { useState } from 'react';
import { UserRole, StandardJob, TaskCategory } from '../types';
import { getStandardJobs, addStandardJob, updateStandardJob, deleteStandardJob } from '../lib/storage';
import { Zap, Plus, Edit2, Trash2, ShieldCheck, Tag, DollarSign, Clock, Layers, Save, X, Search } from 'lucide-react';

interface StandardJobsManagementViewProps {
  currentRole: UserRole;
}

export function StandardJobsManagementView({ currentRole }: StandardJobsManagementViewProps) {
  const [standardJobs, setStandardJobs] = useState<StandardJob[]>(() => getStandardJobs());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCat, setFilterCat] = useState<string>('ALL');

  // Form modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formCat, setFormCat] = useState<TaskCategory>('PAINT');
  const [formRetailPrice, setFormRetailPrice] = useState<number>(2500);
  const [formCars24Price, setFormCars24Price] = useState<number>(1800);
  const [formIsContract, setFormIsContract] = useState<boolean>(true);
  const [formContractorPayout, setFormContractorPayout] = useState<number>(950);
  const [formPainterPayout, setFormPainterPayout] = useState<number>(800);
  const [formDenterPayout, setFormDenterPayout] = useState<number>(150);
  const [formHours, setFormHours] = useState<number>(2);
  const [formDesc, setFormDesc] = useState('');

  const refreshList = () => {
    setStandardJobs(getStandardJobs());
  };

  const handleOpenAdd = () => {
    setEditingJobId(null);
    setFormTitle('');
    setFormCat('PAINT');
    setFormRetailPrice(1350);
    setFormCars24Price(1350);
    setFormIsContract(true);
    setFormPainterPayout(800);
    setFormDenterPayout(150);
    setFormContractorPayout(950);
    setFormHours(3);
    setFormDesc('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (job: StandardJob) => {
    setEditingJobId(job.id);
    setFormTitle(job.title);
    setFormCat(job.category);
    setFormRetailPrice(job.retailPrice);
    setFormCars24Price(job.cars24Price);
    setFormIsContract(job.isContractBasis);
    setFormPainterPayout(job.painterPayout || 0);
    setFormDenterPayout(job.denterPayout || 0);
    setFormContractorPayout(job.contractorPayout || ((job.painterPayout || 0) + (job.denterPayout || 0)));
    setFormHours(job.estimatedHours);
    setFormDesc(job.description || '');
    setIsModalOpen(true);
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

    const painter = formIsContract ? (Number(formPainterPayout) || 0) : 0;
    const denter = formIsContract ? (Number(formDenterPayout) || 0) : 0;
    const totalPayout = formIsContract ? (Number(formContractorPayout) || (painter + denter)) : 0;

    if (editingJobId) {
      updateStandardJob(editingJobId, {
        title: formTitle.trim(),
        category: formCat,
        retailPrice: Number(formRetailPrice) || 0,
        cars24Price: Number(formCars24Price) || 0,
        isContractBasis: formIsContract,
        painterPayout: painter,
        denterPayout: denter,
        contractorPayout: totalPayout,
        estimatedHours: Number(formHours) || 1,
        description: formDesc.trim()
      });
    } else {
      addStandardJob({
        title: formTitle.trim(),
        category: formCat,
        retailPrice: Number(formRetailPrice) || 0,
        cars24Price: Number(formCars24Price) || 0,
        isContractBasis: formIsContract,
        painterPayout: painter,
        denterPayout: denter,
        contractorPayout: totalPayout,
        estimatedHours: Number(formHours) || 1,
        description: formDesc.trim()
      });
    }

    setIsModalOpen(false);
    refreshList();
  };

  const filtered = standardJobs.filter(j => {
    const matchesSearch = j.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (j.description && j.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCat = filterCat === 'ALL' || j.category === filterCat;
    return matchesSearch && matchesCat;
  });

  const canManage = currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN' || currentRole === 'FLOOR_MANAGER';

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

              {job.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
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

              {/* Contractor Payout Section */}
              {job.isContractBasis && (
                <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs font-bold text-amber-800 dark:text-amber-200">
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-amber-500" /> Contractor Payout Rate:
                  </span>
                  <span className="font-black text-amber-600 dark:text-amber-400 text-sm">
                    ₹{job.contractorPayout.toLocaleString()}
                  </span>
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
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

            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
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
                  <div className="space-y-3 pt-2 border-t border-amber-500/20">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-purple-700 dark:text-purple-300 mb-1">
                          Painter Payout (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={formPainterPayout}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setFormPainterPayout(val);
                            setFormContractorPayout(val + formDenterPayout);
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-purple-300 dark:border-purple-800 bg-white dark:bg-slate-900 font-extrabold text-purple-600 dark:text-purple-400"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-orange-700 dark:text-orange-300 mb-1">
                          Denter Payout (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={formDenterPayout}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setFormDenterPayout(val);
                            setFormContractorPayout(formPainterPayout + val);
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-orange-300 dark:border-orange-800 bg-white dark:bg-slate-900 font-extrabold text-orange-600 dark:text-orange-400"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-amber-800 dark:text-amber-300 mb-1">
                        Total Combined Contractor Payout (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={formContractorPayout}
                        onChange={(e) => setFormContractorPayout(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 font-black text-amber-600 dark:text-amber-400 text-sm"
                      />
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
