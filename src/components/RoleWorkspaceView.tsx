import React, { useState } from 'react';
import { UserRole, JobCard } from '../types';
import { updateTaskStatus, respondToCustomerApproval } from '../lib/storage';
import { RoleBadge } from './RoleBadge';
import { 
  Wrench, 
  Hammer, 
  Palette, 
  UserCheck, 
  CheckCircle2, 
  AlertCircle, 
  Car, 
  Truck, 
  Sparkles,
  Phone,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';

interface RoleWorkspaceViewProps {
  currentRole: UserRole;
  jobCards: JobCard[];
  onOpenJobCard: (id: string) => void;
  onOpenCustomerApprovalPortal: (id: string) => void;
}

export function RoleWorkspaceView({
  currentRole,
  jobCards,
  onOpenJobCard,
  onOpenCustomerApprovalPortal,
}: RoleWorkspaceViewProps) {
  // Select active panel for body/paint tasks
  const [selectedPanel, setSelectedPanel] = useState<string | null>(null);

  // Filter tasks tailored to current role
  const getTasksForRole = () => {
    const list: { card: JobCard; task: JobCard['tasks'][0] }[] = [];

    jobCards.forEach(card => {
      card.tasks.forEach(task => {
        if (currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN' || currentRole === 'FLOOR_MANAGER') {
          list.push({ card, task });
        } else if (currentRole === 'MECHANIC' && (task.category === 'MECHANICAL' || task.category === 'INSPECTION')) {
          list.push({ card, task });
        } else if (currentRole === 'DENTER' && task.category === 'DENTING') {
          list.push({ card, task });
        } else if (currentRole === 'PAINTER' && task.category === 'PAINT') {
          list.push({ card, task });
        } else if (currentRole === 'VENDOR' && (task.category === 'SUBLET_VENDOR' || task.category === 'WASHING')) {
          list.push({ card, task });
        }
      });
    });

    return list;
  };

  const roleTasks = getTasksForRole();

  return (
    <div className="space-y-6">
      
      {/* Role Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <RoleBadge role={currentRole} />
            <span className="text-xs text-slate-400">Tailored Specialized View</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {currentRole === 'MECHANIC' && 'Mechanical Technician Workspace'}
            {currentRole === 'DENTER' && 'Denting & Body Metalwork Station'}
            {currentRole === 'PAINTER' && 'Spray Booth & Paint Restoration Studio'}
            {currentRole === 'DELIVERY_BOY' && 'Logistics Driver Taskboard'}
            {currentRole === 'CUSTOMER' && 'Vehicle Owner Personal Tracker'}
            {(currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN' || currentRole === 'FLOOR_MANAGER') && 'Floor Management Oversight Board'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Focus purely on the tasks allotted to your team role with direct status toggles and inspection logging.
          </p>
        </div>
      </div>

      {/* DENTER / PAINTER INTERACTIVE BODY PANEL DIAGRAM */}
      {(currentRole === 'DENTER' || currentRole === 'PAINTER') && (
        <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              {currentRole === 'DENTER' ? <Hammer className="w-4 h-4" /> : <Palette className="w-4 h-4" />}
              Interactive Vehicle Body Panel Inspection Chart
            </span>
            <span className="text-[11px] text-slate-400">Click panel to view damage stage</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
            {[
              'Front Bumper',
              'Hood / Bonnet',
              'Right Front Fender',
              'Left Door Panel',
              'Rear Quarter Panel'
            ].map((panel) => {
              const isSel = selectedPanel === panel;
              return (
                <button
                  key={panel}
                  onClick={() => setSelectedPanel(isSel ? null : panel)}
                  className={`p-3 rounded-xl border font-bold transition-all ${
                    isSel
                      ? 'border-amber-500 bg-amber-500/20 text-amber-300 shadow-md'
                      : 'border-slate-800 bg-slate-800/60 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {panel}
                </button>
              );
            })}
          </div>

          {selectedPanel && (
            <div className="p-3 rounded-xl bg-slate-800/80 text-xs text-amber-300 border border-amber-500/20 flex items-center justify-between">
              <span>Selected Panel: <strong>{selectedPanel}</strong></span>
              <span className="text-slate-300">Stage: {currentRole === 'DENTER' ? 'Hydro Pulling & Metal Sanding' : 'Anti-Rust Primer & Baked Paint Curing'}</span>
            </div>
          )}
        </div>
      )}

      {/* Role Tasks List */}
      <div className="space-y-3">
        <h3 className="font-bold text-xs uppercase text-slate-500 tracking-wider">
          Work Orders Assigned to Your Team ({roleTasks.length})
        </h3>

        {roleTasks.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
            No active tasks pending for this role.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roleTasks.map(({ card, task }) => (
              <div
                key={task.id}
                className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                      {card.vehicle.registrationNumber} ({card.id})
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      task.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'
                    }`}>
                      {task.status}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">{task.title}</h3>
                  <p className="text-xs text-slate-500 mt-1">Vehicle: {card.vehicle.make} {card.vehicle.model}</p>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">${task.customerPrice}</span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateTaskStatus(card.id, task.id, 'IN_PROGRESS')}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
                    >
                      Start Work
                    </button>
                    <button
                      onClick={() => updateTaskStatus(card.id, task.id, 'COMPLETED')}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                    >
                      Mark Complete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
