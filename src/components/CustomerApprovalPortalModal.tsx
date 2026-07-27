import React, { useState } from 'react';
import { JobCard } from '../types';
import { respondToCustomerApproval } from '../lib/storage';
import { 
  X, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Car, 
  DollarSign, 
  Sparkles,
  Phone
} from 'lucide-react';

interface CustomerApprovalPortalModalProps {
  card: JobCard;
  onClose: () => void;
}

export function CustomerApprovalPortalModal({
  card,
  onClose,
}: CustomerApprovalPortalModalProps) {
  const [tasks, setTasks] = useState(card.tasks);

  const pendingApprovals = tasks.filter(t => t.requiresCustomerApproval);

  const handleToggle = (taskId: string, approved: boolean) => {
    respondToCustomerApproval(card.id, taskId, approved);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isCustomerApproved: approved } : t));
  };

  const totalApprovedPrice = tasks
    .filter(t => t.isCustomerApproved !== false)
    .reduce((sum, t) => sum + (t.customerPrice || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl shadow-2xl overflow-hidden my-8">
        
        {/* Customer Portal Header */}
        <div className="p-6 bg-gradient-to-r from-slate-950 via-blue-950 to-slate-950 text-white border-b border-blue-900/40">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 font-mono text-xs font-black border border-blue-500/30 tracking-wider">
                FIXOCAR • WORRY-FREE CAR REPAIR
              </span>
              <a href="tel:8819915656" className="text-xs text-blue-400 font-bold flex items-center gap-1 hover:underline">
                <Phone className="w-3 h-3 fill-current" />
                8819915656
              </a>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-600/30">
              <Car className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold font-mono tracking-tight">
                {card.vehicle.registrationNumber} • {card.vehicle.make} {card.vehicle.model}
              </h1>
              <p className="text-xs text-slate-300 mt-0.5">
                Hello {card.customer.name}, please review discovered repair items for your vehicle.
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-500/30 text-blue-200 text-xs space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-blue-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Additional Work Approval Requested
            </div>
            <p className="text-slate-300">
              During disassembly inspection, our master mechanics identified additional maintenance recommendations. Please review and approve or decline each item below.
            </p>
          </div>

          {/* Pending Approval Items */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Discovered Items Awaiting Your Decision</h3>

            {pendingApprovals.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">All items have been reviewed!</p>
            ) : (
              pendingApprovals.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">{item.title}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{item.notes || 'Inspection finding by master mechanic'}</p>
                    </div>
                    <span className="text-base font-extrabold text-blue-600 dark:text-blue-400 font-mono">
                      +₹{item.customerPrice.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-xs text-slate-500">Status: {item.isCustomerApproved === true ? 'Approved' : item.isCustomerApproved === false ? 'Declined' : 'Pending'}</span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggle(item.id, false)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          item.isCustomerApproved === false
                            ? 'bg-rose-600 text-white shadow-sm'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-rose-500 hover:text-white'
                        }`}
                      >
                        Decline
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggle(item.id, true)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          item.isCustomerApproved === true
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20'
                        }`}
                      >
                        Approve Item
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Estimate Summary */}
          <div className="p-4 rounded-xl bg-slate-950 text-white border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Recalculated Estimate Total</p>
              <p className="text-xl font-extrabold text-blue-400 font-mono">₹{totalApprovedPrice.toLocaleString('en-IN')}</p>
            </div>

            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs transition-colors shadow-md shadow-blue-600/30"
            >
              Confirm Choices & Return
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
