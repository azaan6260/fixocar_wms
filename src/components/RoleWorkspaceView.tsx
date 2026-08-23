import React, { useState } from 'react';
import { UserRole, JobCard } from '../types';
import { updateTaskStatus, respondToCustomerApproval, getEmployees, getVendors, getAuthUser } from '../lib/storage';
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
  Camera,
  Filter,
  User,
  Check
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
  const [selectedPanel, setSelectedPanel] = useState<string | null>(null);
  const [onlyMyTasks, setOnlyMyTasks] = useState<boolean>(true);
  const authUser = getAuthUser();
  
  // Use global i18n
  const { language, setLanguage, t } = useI18n();

  // Filter tasks tailored to current role and employee assignment
  const getTasksForRole = () => {
    const list: { card: JobCard; task: JobCard['tasks'][0] }[] = [];

    jobCards.forEach(card => {
      card.tasks.forEach(task => {
        let matchesRole = false;
        if (currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN' || currentRole === 'FLOOR_MANAGER') {
          matchesRole = true;
        } else if (currentRole === 'MECHANIC' && (task.category === 'MECHANICAL' || task.category === 'INSPECTION')) {
          matchesRole = true;
        } else if (currentRole === 'DENTER' && task.category === 'DENTING') {
          matchesRole = true;
        } else if (currentRole === 'PAINTER' && task.category === 'PAINT') {
          matchesRole = true;
        } else if (currentRole === 'VENDOR' && (task.assignedType === 'VENDOR' || task.isOutsourced || task.category === 'SUBLET_VENDOR' || task.category === 'LATHE_WORK' || task.category === 'WASHING')) {
          matchesRole = true;
        }

        if (!matchesRole) return;

        // If onlyMyTasks is enabled and user is logged in as employee/vendor
        if (onlyMyTasks && authUser && (authUser.employeeId || authUser.vendorId)) {
          const isAssignedToMe = 
            (authUser.employeeId && task.assignedToId === authUser.employeeId) ||
            (authUser.vendorId && (task.outsourcedVendorId === authUser.vendorId || task.assignedToId === authUser.vendorId)) ||
            (authUser.name && task.assignedToName && task.assignedToName.toLowerCase().includes(authUser.name.toLowerCase()));

          if (isAssignedToMe) {
            list.push({ card, task });
          }
        } else {
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
            {authUser?.name && (
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-500/20 flex items-center gap-1">
                <User className="w-3 h-3" /> Logged In: {authUser.name} ({authUser.loginId || authUser.role})
              </span>
            )}
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

        <div className="flex flex-wrap items-center gap-2">
          {/* My Tasks Toggle Button */}
          {authUser && (authUser.employeeId || authUser.vendorId) && (
            <button
              type="button"
              onClick={() => setOnlyMyTasks(!onlyMyTasks)}
              className={`text-xs px-3.5 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                onlyMyTasks
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/30'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{onlyMyTasks ? 'Showing: My Allotted Tasks' : 'Showing: All Trade Tasks'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-xs px-3.5 py-2 rounded-xl font-extrabold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5 text-amber-500" />
            <span>Scan Plate</span>
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
