import React, { useState } from 'react';
import { JobCard, StandardJob, Employee, Vendor, TaskCategory, SpecializedTeam } from '../types';
import { getStandardJobs, addStandardJobToJobCard, getEmployees, getVendors, deleteJobCardTask, isCars24JobCard } from '../lib/storage';
import { matchTaskToPanelDef } from '../lib/panelMappingHelper';
import { JobAllotmentPipeline, AllocatedTaskItem } from './JobAllotmentPipeline';
import { Zap, CheckCircle2, X, Tag, ShieldCheck, Plus, Trash2 } from 'lucide-react';

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
  if (!isOpen || !card) return null;

  const employees = getEmployees();
  const vendors = getVendors();
  const isCars24 = isCars24JobCard(card);

  // Convert existing job card tasks into pipeline format for syncing
  const existingTasks: AllocatedTaskItem[] = (card.tasks || []).map(t => ({
    id: t.id,
    title: t.title,
    category: t.category,
    team: (t.category as SpecializedTeam) || 'Mechanical',
    assignedToId: t.assignedToId,
    assignedToName: t.assignedToName,
    assignedType: t.assignedType || 'EMPLOYEE',
    estimatedCost: t.estimatedCost,
    customerPrice: t.customerPrice,
    requiresCustomerApproval: Boolean(t.requiresCustomerApproval),
    isContractBasis: t.isContractBasis,
    painterPayout: t.painterPayout,
    denterPayout: t.denterPayout,
    standardJobId: t.standardJobId,
    panelKey: t.panelKey || matchTaskToPanelDef(t)?.id,
    panelNameEn: t.panelNameEn || matchTaskToPanelDef(t)?.nameEn
  }));

  const handleTasksPipelineChange = (updatedTasks: AllocatedTaskItem[]) => {
    // 1. Handle removed tasks
    const updatedIds = new Set(updatedTasks.map(t => t.id));
    const removedTasks = existingTasks.filter(t => !updatedIds.has(t.id));
    removedTasks.forEach(removed => {
      deleteJobCardTask(card.id, removed.id);
    });

    // 2. Determine newly added tasks
    const currentStdJobIds = new Set(existingTasks.map(t => t.standardJobId).filter(Boolean));
    const newTasks = updatedTasks.filter(t => t.standardJobId && !currentStdJobIds.has(t.standardJobId));

    if (newTasks.length > 0) {
      newTasks.forEach(newTask => {
        if (newTask.standardJobId) {
          addStandardJobToJobCard(
            card.id, 
            newTask.standardJobId, 
            newTask.assignedToId,
            newTask.category === 'DENTING' ? newTask.assignedToId : undefined
          );
        }
      });
    }

    if (onJobAdded || removedTasks.length > 0 || newTasks.length > 0) {
      if (onJobAdded) onJobAdded();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-extrabold">
              <Zap className="w-5 h-5 fill-amber-400" />
            </div>
            <div>
              <h2 className="font-extrabold text-base sm:text-lg flex items-center gap-2">
                Job Card Allotment Pipeline
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-300 mt-0.5 flex-wrap">
                <span className="font-bold text-amber-400">{card.id}</span>
                <span>•</span>
                <span className="font-semibold text-slate-200">{card.vehicle.registrationNumber} ({card.vehicle.make} {card.vehicle.model})</span>
                <span>•</span>
                {isCars24 ? (
                  <span className="px-2 py-0.5 rounded-full bg-orange-500/30 text-orange-300 border border-orange-400/40 font-black text-[10px] flex items-center gap-1 uppercase tracking-wide">
                    <ShieldCheck className="w-3 h-3 text-orange-400" /> Cars24 Fleet Partner
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 font-bold text-[10px] flex items-center gap-1">
                    <Tag className="w-3 h-3 text-emerald-400" /> Retail Customer Rates
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

        {/* Pipeline Body Container */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <JobAllotmentPipeline
            isCars24={isCars24}
            cars24RefNo={card.cars24RefNo}
            employees={employees}
            vendors={vendors}
            selectedTasks={existingTasks}
            onTasksChange={handleTasksPipelineChange}
          />
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>
            {isCars24 
              ? '⚡ Panel paint selections create linked Painter + Denter tasks automatically per Cars24 agreement.' 
              : '🛒 Standard jobs added reflect in active Job Card bill and floor manager assignments.'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow-xs transition-all"
          >
            Done & Save Allotments
          </button>
        </div>

      </div>
    </div>
  );
}
