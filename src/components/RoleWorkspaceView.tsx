import React, { useState } from 'react';
import { UserRole, JobCard } from '../types';
import { updateTaskStatus, respondToCustomerApproval, getEmployees, getVendors } from '../lib/storage';
import { RoleBadge } from './RoleBadge';
import { TaskDetailCard } from './TaskDetailCard';
import { InteractiveVehicleInspectionChart } from './InteractiveVehicleInspectionChart';
import { ManagerRequisitionApprovalView } from './ManagerRequisitionApprovalView';
import { useI18n } from '../lib/i18n';
import { LicensePlateScannerModal } from './LicensePlateScannerModal';
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
  ChevronRight,
  Camera
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
  
  // Use global i18n
  const { language, setLanguage, t } = useI18n();

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
        } else if (currentRole === 'VENDOR' && (task.assignedType === 'VENDOR' || task.isOutsourced || task.category === 'SUBLET_VENDOR' || task.category === 'LATHE_WORK' || task.category === 'WASHING')) {
          list.push({ card, task });
        }
      });
    });

    return list;
  };

  const roleTasks = getTasksForRole();

  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const handleScannedPlate = (regNum: string) => {
    const activeCard = jobCards.find(
      j => j.vehicle.registrationNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === regNum && 
           j.status !== 'CLOSED' && j.status !== 'DELIVERED'
    );

    if (activeCard) {
      alert(`Found active job card for ${regNum}. Opening it...`);
      onOpenJobCard(activeCard.id);
    } else {
      alert(`No active job card found for ${regNum}.`);
    }
  };

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
            {currentRole === 'MECHANIC' && t('role.mechanicWorkspace')}
            {currentRole === 'DENTER' && t('role.denterWorkspace')}
            {currentRole === 'PAINTER' && t('role.painterWorkspace')}
            {currentRole === 'DELIVERY_BOY' && t('role.deliveryWorkspace')}
            {currentRole === 'CUSTOMER' && 'Vehicle Owner Personal Tracker'}
            {(currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN' || currentRole === 'FLOOR_MANAGER') && t('role.managementWorkspace')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('role.focus')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-xs px-3.5 py-2 rounded-full font-extrabold transition-all flex items-center gap-1.5 shadow-xs"
          >
            <Camera className="w-3.5 h-3.5 text-amber-500" />
            <span>Scan Plate Camera</span>
          </button>
        </div>
      </div>

      {/* MANAGER PART REQUISITIONS APPROVAL QUEUE */}
      {(currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN' || currentRole === 'FLOOR_MANAGER') && (
        <ManagerRequisitionApprovalView
          jobCards={jobCards}
          onOpenJobCard={onOpenJobCard}
          currentRole={currentRole}
        />
      )}

      {/* DENTER / PAINTER INTERACTIVE AR BODY PANEL SKETCH & DAMAGE CHART */}
      {(currentRole === 'DENTER' || currentRole === 'PAINTER') && (
        <InteractiveVehicleInspectionChart
          currentRole={currentRole}
          mode="VIEW"
          selectedPanelIds={selectedPanel ? [selectedPanel] : []}
          onPanelToggle={(panelId) => {
            setSelectedPanel(prev => prev === panelId ? null : panelId);
          }}
        />
      )}

      {/* Role Tasks List */}
      <div className="space-y-4">
        <h3 className="font-bold text-xs uppercase text-slate-500 tracking-wider">
          {t('role.tasksAssigned')} ({roleTasks.length})
        </h3>

        {roleTasks.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
            {t('role.noTasks')}
          </div>
        ) : (
          <div className="space-y-4">
            {roleTasks.map(({ card, task }) => (
              <div key={`${card.id}-${task.id}`} className="space-y-2">
                <div className="flex items-center justify-between px-2 text-xs">
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                    🚘 {card.vehicle.registrationNumber} — {card.vehicle.make} {card.vehicle.model} ({card.id})
                  </span>
                  <button
                    onClick={() => onOpenJobCard(card.id)}
                    className="text-blue-600 dark:text-blue-400 hover:underline font-bold text-[11px] flex items-center gap-1"
                  >
                    View Full Job Card <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <TaskDetailCard
                  card={card}
                  task={task}
                  employees={getEmployees()}
                  vendors={getVendors()}
                  currentRole={currentRole}
                  onTaskStatusChange={(taskId, status) => updateTaskStatus(card.id, taskId, status)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <LicensePlateScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanComplete={handleScannedPlate}
      />
    </div>
  );
}
