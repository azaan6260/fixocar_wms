import React, { useState } from 'react';
import { JobCard, StandardJob, TaskCategory, Employee, Vendor } from '../types';
import { getStandardJobs, addStandardJobToJobCard, getEmployees, getVendors } from '../lib/storage';
import { Zap, CheckCircle2, Search, X, DollarSign, Tag, Clock, UserCheck, ShieldCheck } from 'lucide-react';

interface StandardJobsCatalogModalProps {
  card: JobCard;
  isOpen: boolean;
  onClose: () => void;
  onJobAdded?: () => void;
}

export function StandardJobsCatalogModal({
  card,
  isOpen,
  onClose,
  onJobAdded
}: StandardJobsCatalogModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [assignedIdMap, setAssignedIdMap] = useState<Record<string, string>>({});
  const [addedSuccessMap, setAddedSuccessMap] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  const standardJobs = getStandardJobs();
  const employees = getEmployees();
  const vendors = getVendors();

  const filteredJobs = standardJobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (job.description && job.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCat = selectedCategory === 'ALL' || job.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const handleQuickAdd = (job: StandardJob) => {
    const customAssignedId = assignedIdMap[job.id] || undefined;
    const result = addStandardJobToJobCard(card.id, job.id, customAssignedId);
    if (result) {
      setAddedSuccessMap(prev => ({ ...prev, [job.id]: true }));
      setTimeout(() => {
        setAddedSuccessMap(prev => ({ ...prev, [job.id]: false }));
      }, 2000);
      if (onJobAdded) onJobAdded();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Zap className="w-5 h-5 fill-amber-400" />
            </div>
            <div>
              <h2 className="font-extrabold text-lg flex items-center gap-2">
                One-Click Standard Jobs Library
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-300 mt-0.5">
                <span className="font-semibold text-slate-200">{card.vehicle.registrationNumber} ({card.vehicle.make} {card.vehicle.model})</span>
                <span>•</span>
                {card.isCars24 ? (
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-300 border border-blue-400/40 font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-blue-400" /> Cars24 B2B Rates Active
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 font-bold flex items-center gap-1">
                    <Tag className="w-3 h-3 text-emerald-400" /> Retail Customer Rates Active
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters & Search */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search standard jobs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
            {['ALL', 'MECHANICAL', 'DENTING', 'PAINT', 'WASHING', 'SUBLET_VENDOR'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all text-xs ${
                  selectedCategory === cat
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {cat === 'ALL' ? 'All Jobs' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Jobs List Grid */}
        <div className="p-5 max-h-[60vh] overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredJobs.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-400 text-sm font-medium">
              No standard jobs match your search criteria.
            </div>
          ) : (
            filteredJobs.map((job) => {
              const appliedPrice = card.isCars24 ? job.cars24Price : job.retailPrice;
              const isAdded = addedSuccessMap[job.id];

              return (
                <div
                  key={job.id}
                  className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 hover:border-amber-500/50 dark:hover:border-amber-500/50 shadow-xs transition-all flex flex-col justify-between gap-3 relative group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide ${
                        job.category === 'PAINT' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20' :
                        job.category === 'DENTING' ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20' :
                        job.category === 'MECHANICAL' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' :
                        'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {job.category}
                      </span>

                      <div className="text-right">
                        <div className="text-base font-black text-slate-900 dark:text-white">
                          ₹{appliedPrice.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          {card.isCars24 ? `Retail: ₹${job.retailPrice}` : `Cars24: ₹${job.cars24Price}`}
                        </div>
                      </div>
                    </div>

                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight">
                      {job.title}
                    </h3>

                    {job.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {job.description}
                      </p>
                    )}

                    {/* Contractor Payout Badge */}
                    {job.isContractBasis && (
                      <div className="mt-2.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-1 text-xs">
                        <div className="flex items-center justify-between font-bold text-amber-800 dark:text-amber-200">
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3.5 h-3.5 text-amber-500" /> Total Contract Payout:
                          </span>
                          <span className="font-black text-amber-600 dark:text-amber-400">
                            ₹{job.contractorPayout.toLocaleString()}
                          </span>
                        </div>
                        {(job.painterPayout !== undefined || job.denterPayout !== undefined) && (
                          <div className="flex items-center justify-between text-[11px] text-amber-700/90 dark:text-amber-300/90 font-semibold border-t border-amber-500/20 pt-1">
                            <span>Painter: <strong className="text-purple-600 dark:text-purple-300">₹{job.painterPayout || 0}</strong></span>
                            <span>Denter: <strong className="text-orange-600 dark:text-orange-300">₹{job.denterPayout || 0}</strong></span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Assignee & Action Row */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex flex-col sm:flex-row items-center justify-between gap-2">
                    {/* Optional Assignee Select */}
                    <div className="w-full sm:w-1/2">
                      <select
                        value={assignedIdMap[job.id] || ''}
                        onChange={(e) => setAssignedIdMap(prev => ({ ...prev, [job.id]: e.target.value }))}
                        className="w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-[11px] font-semibold text-slate-700 dark:text-slate-300"
                      >
                        <option value="">-- Assign Staff/Vendor --</option>
                        {job.category === 'PAINT' && employees.filter(e => e.role === 'PAINTER').map(e => (
                          <option key={e.id} value={e.id}>{e.name} (Painter)</option>
                        ))}
                        {job.category === 'DENTING' && employees.filter(e => e.role === 'DENTER').map(e => (
                          <option key={e.id} value={e.id}>{e.name} (Denter)</option>
                        ))}
                        {job.category === 'MECHANICAL' && employees.filter(e => e.role === 'MECHANIC').map(e => (
                          <option key={e.id} value={e.id}>{e.name} (Mechanic)</option>
                        ))}
                        {job.category === 'SUBLET_VENDOR' && vendors.map(v => (
                          <option key={v.id} value={v.id}>{v.name} (Vendor)</option>
                        ))}
                        {employees.map(e => (
                          <option key={`all-${e.id}`} value={e.id}>{e.name} ({e.role})</option>
                        ))}
                      </select>
                    </div>

                    {/* 1-Click Add Button */}
                    <button
                      onClick={() => handleQuickAdd(job)}
                      disabled={isAdded}
                      className={`w-full sm:w-auto px-4 py-1.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all ${
                        isAdded 
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black hover:scale-[1.02] active:scale-95'
                      }`}
                    >
                      {isAdded ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" /> Added to Job Card
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5 fill-slate-950" /> Add to Job Card
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>Click "+ Add to Job Card" to immediately append task with active pricing rule.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
