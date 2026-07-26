import React, { useState } from 'react';
import { JobCard, JobCardStatus } from '../types';
import { 
  Search, 
  Plus, 
  Car, 
  User, 
  Calendar, 
  Wrench, 
  AlertCircle, 
  CheckCircle2, 
  Truck, 
  FileText,
  ChevronRight,
  Sparkles,
  Phone,
  ShieldCheck,
  Building2
} from 'lucide-react';

interface JobCardListProps {
  jobCards: JobCard[];
  onSelectJobCard: (cardId: string) => void;
  onOpenNewJobCardModal: () => void;
  onOpenCustomerApprovalPortal: (cardId: string) => void;
  onOpenQCModal: (cardId: string) => void;
}

const STATUS_BADGES: Record<JobCardStatus, { label: string; bg: string; text: string; border: string }> = {
  CREATED: { label: 'Opened', bg: 'bg-slate-500/10', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-800' },
  INSPECTION: { label: 'Diagnosing', bg: 'bg-blue-500/10', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
  JOB_ALLOCATED: { label: 'Tasks Allotted', bg: 'bg-indigo-500/10', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-800' },
  IN_PROGRESS: { label: 'In Repair', bg: 'bg-blue-500/10', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
  ESTIMATE_PENDING: { label: 'Approval Required', bg: 'bg-amber-500/10', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
  QC_PENDING: { label: 'Floor QC Audit', bg: 'bg-purple-500/10', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
  READY_FOR_DELIVERY: { label: 'Ready for Dispatch', bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', bg: 'bg-cyan-500/10', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-200 dark:border-cyan-800' },
  DELIVERED: { label: 'Delivered', bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
  CLOSED: { label: 'Closed', bg: 'bg-slate-500/10', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-800' },
};

export function JobCardList({
  jobCards,
  onSelectJobCard,
  onOpenNewJobCardModal,
  onOpenCustomerApprovalPortal,
  onOpenQCModal,
}: JobCardListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIVE' | 'APPROVAL' | 'QC' | 'DELIVERY'>('ALL');

  const filteredCards = jobCards.filter((card) => {
    const matchesSearch = 
      card.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.vehicle.registrationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.vehicle.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.vehicle.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.customer.phone.includes(searchTerm);

    if (!matchesSearch) return false;

    if (activeFilter === 'ACTIVE') return card.status !== 'DELIVERED' && card.status !== 'CLOSED';
    if (activeFilter === 'APPROVAL') return card.status === 'ESTIMATE_PENDING';
    if (activeFilter === 'QC') return card.status === 'QC_PENDING';
    if (activeFilter === 'DELIVERY') return card.status === 'READY_FOR_DELIVERY' || card.status === 'OUT_FOR_DELIVERY';

    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Search & Filter Header */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Automotive Job Cards
            </span>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2 mt-0.5">
              <FileText className="w-5 h-5 text-blue-600" />
              Workshop Job Cards Directory
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage work orders, team task allotments, customer approvals, floor inspection checklists and deliveries.
            </p>
          </div>

          <button
            onClick={onOpenNewJobCardModal}
            className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-600/20 active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            New Job Card
          </button>
        </div>

        {/* Filter Controls & Search Input */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-2">
          
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Reg No, Customer, Make, Model..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            {[
              { id: 'ALL', label: `All (${jobCards.length})` },
              { id: 'ACTIVE', label: `Active (${jobCards.filter(c => c.status !== 'DELIVERED').length})` },
              { id: 'APPROVAL', label: `Needs Approval (${jobCards.filter(c => c.status === 'ESTIMATE_PENDING').length})` },
              { id: 'QC', label: `QC Audit (${jobCards.filter(c => c.status === 'QC_PENDING').length})` },
              { id: 'DELIVERY', label: `Ready/Delivery (${jobCards.filter(c => c.status === 'READY_FOR_DELIVERY' || c.status === 'OUT_FOR_DELIVERY').length})` },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id as any)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                  activeFilter === f.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

        </div>

      </div>

      {/* Cards Grid */}
      {filteredCards.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-500">
          <Car className="w-12 h-12 mx-auto text-slate-400 mb-3 stroke-[1.5]" />
          <h3 className="font-bold text-slate-800 dark:text-slate-200">No Job Cards Found</h3>
          <p className="text-xs mt-1">Try adjusting your search filter or create a new job card.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCards.map((card) => {
            const statusStyle = STATUS_BADGES[card.status] || STATUS_BADGES.IN_PROGRESS;
            const completedCount = card.tasks.filter((t) => t.status === 'COMPLETED').length;
            const progress = card.tasks.length ? Math.round((completedCount / card.tasks.length) * 100) : 0;
            const needsApproval = card.status === 'ESTIMATE_PENDING' || card.tasks.some(t => t.requiresCustomerApproval && t.isCustomerApproved === null);
            const totalBill = card.tasks.reduce((acc, t) => acc + (t.customerPrice || 0), 0);

            // Sublet / Team badges
            const hasSublet = card.tasks.some(t => t.category === 'SUBLET_VENDOR' || t.category === 'WASHING');

            return (
              <div
                key={card.id}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 transition-all shadow-xs flex flex-col justify-between overflow-hidden group"
              >
                
                {/* Card Top Header */}
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                      {card.id}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                      {statusStyle.label}
                    </span>
                  </div>

                  {/* Vehicle Information */}
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center shrink-0 font-bold">
                      <Car className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="font-black text-base text-slate-900 dark:text-slate-100 tracking-tight font-mono">
                        {card.vehicle.registrationNumber}
                      </h2>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {card.vehicle.make} {card.vehicle.model} ({card.vehicle.year})
                      </p>
                      <p className="text-[11px] text-slate-500">Color: {card.vehicle.color} • {card.vehicle.mileage.toLocaleString()} km</p>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-medium">
                      <span className="flex items-center gap-1.5 font-bold">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {card.customer.name}
                      </span>
                      <span className="flex items-center gap-1 text-slate-500 text-[11px] font-mono">
                        <Phone className="w-3 h-3" />
                        {card.customer.phone}
                      </span>
                    </div>
                  </div>

                  {/* Tasks Progress Bar */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">Progress</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">
                        {completedCount}/{card.tasks.length} Done ({progress}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Badges / Sublet alert */}
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    {hasSublet && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                        <Building2 className="w-3 h-3" />
                        Sublet Vendor Work
                      </span>
                    )}
                    {needsApproval && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
                        <AlertCircle className="w-3 h-3" />
                        Customer Approval Needed
                      </span>
                    )}
                    {card.status === 'QC_PENDING' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                        <ShieldCheck className="w-3 h-3" />
                        QC Ready
                      </span>
                    )}
                  </div>

                </div>

                {/* Card Footer Actions */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Est. Bill</p>
                    <p className="text-sm font-black text-slate-900 dark:text-slate-100 font-mono">₹{totalBill.toLocaleString('en-IN')}</p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {needsApproval && (
                      <button
                        onClick={() => onOpenCustomerApprovalPortal(card.id)}
                        className="px-3 py-1.5 rounded-full bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition-colors"
                      >
                        Approval View
                      </button>
                    )}

                    {card.status === 'QC_PENDING' && (
                      <button
                        onClick={() => onOpenQCModal(card.id)}
                        className="px-3 py-1.5 rounded-full bg-purple-600 text-white text-xs font-bold hover:bg-purple-500 transition-colors"
                      >
                        QC Audit
                      </button>
                    )}

                    <button
                      onClick={() => onSelectJobCard(card.id)}
                      className="px-3.5 py-1.5 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors flex items-center gap-1"
                    >
                      Manage
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
