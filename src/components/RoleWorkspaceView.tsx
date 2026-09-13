import React, { useState } from 'react';
import { UserRole, JobCard } from '../types';
import { getEmployees, getVendors, getAuthUser } from '../lib/storage';
import { RoleBadge } from './RoleBadge';
import { TechnicianTaskCard } from './TechnicianTaskCard';
import { InteractiveVehicleInspectionChart } from './InteractiveVehicleInspectionChart';
import { ManagerRequisitionApprovalView } from './ManagerRequisitionApprovalView';
import { useI18n } from '../lib/i18n';
import { LicensePlateScannerModal } from './LicensePlateScannerModal';
import { matchTaskToPanelDef } from '../lib/panelMappingHelper';
import { 
  Wrench, 
  User, 
  ChevronRight, 
  ChevronDown, 
  ChevronUp, 
  Camera, 
  Filter
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
  const isAdminOrManager = currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN' || currentRole === 'FLOOR_MANAGER';
  const [onlyMyTasks, setOnlyMyTasks] = useState<boolean>(!isAdminOrManager);
  const authUser = getAuthUser();
  
  // Use global i18n
  const { t } = useI18n();

  // Group allotted tasks by vehicle / job card
  const getVehiclesWithTasks = () => {
    const result: {
      card: JobCard;
      assignedTasks: JobCard['tasks'];
      allottedPanelIds: string[];
      totalSanctionedPayout: number;
      completedCount: number;
    }[] = [];

    jobCards.forEach(card => {
      const assignedTasks = card.tasks.filter(task => {
        let matchesRole = false;
        if (isAdminOrManager) {
          matchesRole = true;
        } else if (currentRole === 'MECHANIC' && (task.category === 'MECHANICAL' || task.category === 'INSPECTION')) {
          matchesRole = true;
        } else if (currentRole === 'DENTER' && (task.category === 'DENTING' || task.title.toLowerCase().includes('dent'))) {
          matchesRole = true;
        } else if (currentRole === 'PAINTER' && (task.category === 'PAINT' || task.title.toLowerCase().includes('paint'))) {
          matchesRole = true;
        } else if (currentRole === 'VENDOR' && (task.assignedType === 'VENDOR' || task.isOutsourced || task.category === 'SUBLET_VENDOR' || task.category === 'LATHE_WORK' || task.category === 'WASHING')) {
          matchesRole = true;
        }

        if (!matchesRole) return false;

        if (onlyMyTasks && !isAdminOrManager && authUser && (authUser.employeeId || authUser.vendorId)) {
          const isAssignedToMe = 
            (authUser.employeeId && task.assignedToId === authUser.employeeId) ||
            (authUser.vendorId && (task.outsourcedVendorId === authUser.vendorId || task.assignedToId === authUser.vendorId)) ||
            (authUser.name && task.assignedToName && task.assignedToName.toLowerCase().includes(authUser.name.toLowerCase()));
          return isAssignedToMe;
        }
        return true;
      });

      if (assignedTasks.length > 0) {
        const panelIdsSet = new Set<string>();
        let cardPayoutSum = 0;
        let completedCount = 0;

        assignedTasks.forEach(task => {
          if (task.status === 'COMPLETED') completedCount++;

          const taskPayout = currentRole === 'PAINTER' 
            ? (task.painterPayout || task.contractorPayout || 0)
            : currentRole === 'DENTER' 
            ? (task.denterPayout || task.contractorPayout || 0)
            : (task.contractorPayout || task.painterPayout || task.denterPayout || 0);
          cardPayoutSum += taskPayout;

          if (task.panelKey) {
            panelIdsSet.add(task.panelKey);
          } else {
            const matchedDef = matchTaskToPanelDef(task);
            if (matchedDef) {
              panelIdsSet.add(matchedDef.id);
            }
          }
        });

        result.push({
          card,
          assignedTasks,
          allottedPanelIds: Array.from(panelIdsSet),
          totalSanctionedPayout: cardPayoutSum,
          completedCount
        });
      }
    });

    return result;
  };

  const vehicleGroups = getVehiclesWithTasks();

  // Keep track of which vehicle cards are expanded
  const [expandedCardIds, setExpandedCardIds] = useState<string[]>(() => {
    return vehicleGroups.length > 0 ? [vehicleGroups[0].card.id] : [];
  });

  const toggleExpandCard = (cardId: string) => {
    setExpandedCardIds(prev => 
      prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]
    );
  };

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

      {/* Vehicle Cards List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-xs uppercase text-slate-500 tracking-wider">
            Allotted Vehicles ({vehicleGroups.length})
          </h3>
          <span className="text-xs text-slate-400">
            Click any vehicle card to view jobs & AR body panel map
          </span>
        </div>

        {vehicleGroups.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
            {t('role.noTasks')}
          </div>
        ) : (
          <div className="space-y-4">
            {vehicleGroups.map(({ card, assignedTasks, allottedPanelIds, totalSanctionedPayout, completedCount }) => {
              const isExpanded = expandedCardIds.includes(card.id);
              const isPainterOrDenter = currentRole === 'PAINTER' || currentRole === 'DENTER';
              const showARMap = isPainterOrDenter || allottedPanelIds.length > 0;

              return (
                <div key={card.id} className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-slate-200 dark:border-slate-800 shadow-md overflow-hidden transition-all">
                  {/* Vehicle Card Header */}
                  <div 
                    onClick={() => toggleExpandCard(card.id)}
                    className="p-5 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 text-white cursor-pointer hover:bg-slate-800/90 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-black text-amber-400 bg-amber-500/20 px-3 py-1 rounded-xl border border-amber-500/30 text-sm">
                          🚘 {card.vehicle.registrationNumber}
                        </span>
                        <span className="text-xs font-bold text-slate-300 bg-slate-800 px-2.5 py-1 rounded-xl">
                          {card.vehicle.make} {card.vehicle.model}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-lg">
                          {card.id}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span>👤 Customer: <strong className="text-slate-200">{card.customer.name}</strong></span>
                        {card.customer.phone && (
                          <span>📞 <a href={`tel:${card.customer.phone}`} onClick={e => e.stopPropagation()} className="hover:underline text-blue-400">{card.customer.phone}</a></span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 flex-wrap">
                      {/* Sanctioned Payout Pill */}
                      {totalSanctionedPayout > 0 && (
                        <div className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-black flex items-center gap-1 shadow-sm">
                          <span>💰 Sanctioned:</span>
                          <span className="font-mono text-emerald-300">₹{totalSanctionedPayout.toLocaleString('en-IN')}</span>
                        </div>
                      )}

                      {/* Tasks Count Badge */}
                      <div className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold border border-slate-700">
                        <span>{completedCount}/{assignedTasks.length} Done</span>
                      </div>

                      {/* Expand/Collapse Toggle Button */}
                      <button
                        type="button"
                        className="p-2 rounded-xl bg-amber-500 text-slate-950 font-black hover:bg-amber-400 transition-transform"
                      >
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Vehicle Details: AR Panel Map + Tasks List */}
                  {isExpanded && (
                    <div className="p-5 space-y-6 bg-slate-50/50 dark:bg-slate-950/40 border-t border-slate-200 dark:border-slate-800 animate-in fade-in duration-200">
                      
                      {/* 1. AR VEHICLE PANEL MAP (For Painters & Denters) */}
                      {showARMap && (
                        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 shadow-inner">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2 text-amber-400 font-extrabold text-xs uppercase tracking-wider">
                              <span>🎯</span>
                              <span>Allotted {currentRole === 'PAINTER' ? 'Painting' : currentRole === 'DENTER' ? 'Denting' : 'Vehicle'} Panels (AR View)</span>
                            </div>
                            <div className="text-[11px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-lg font-mono">
                              {allottedPanelIds.length} Panel{allottedPanelIds.length === 1 ? '' : 's'} Highlighted
                            </div>
                          </div>

                          {/* Interactive Vehicle Diagram */}
                          <div className="border border-slate-800 rounded-2xl bg-slate-900/60 p-2 overflow-hidden shadow-lg">
                            <InteractiveVehicleInspectionChart
                              mode="VIEW"
                              selectedPanelIds={allottedPanelIds}
                              compact={true}
                              currentRole={currentRole}
                              vehicleMakeModel={`${card.vehicle.make} ${card.vehicle.model}`}
                            />
                          </div>

                          <p className="text-[11px] text-slate-400 italic text-center">
                            Highlighted panels in gold show all {currentRole === 'PAINTER' ? 'painting' : currentRole === 'DENTER' ? 'denting' : 'assigned'} work allotted to you for {card.vehicle.registrationNumber}.
                          </p>
                        </div>
                      )}

                      {/* 2. TASK / JOB LIST FOR THIS VEHICLE */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-extrabold text-xs uppercase text-slate-500 dark:text-slate-400 tracking-wider flex items-center gap-1.5">
                            <Wrench className="w-3.5 h-3.5 text-amber-500" />
                            <span>Job List ({assignedTasks.length} Task{assignedTasks.length === 1 ? '' : 's'})</span>
                          </h4>

                          <button
                            type="button"
                            onClick={() => onOpenJobCard(card.id)}
                            className="text-blue-600 dark:text-blue-400 hover:underline font-bold text-xs flex items-center gap-1"
                          >
                            View Full Card Details <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="space-y-4">
                          {assignedTasks.map(task => (
                            <TechnicianTaskCard
                              key={`${card.id}-${task.id}`}
                              card={card}
                              task={task}
                              employees={getEmployees()}
                              vendors={getVendors()}
                              currentRole={currentRole}
                            />
                          ))}
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              );
            })}
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
