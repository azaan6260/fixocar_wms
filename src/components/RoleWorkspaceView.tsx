import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { UserRole, JobCard } from '../types';
import { getEmployees, getVendors, getAuthUser, getContractorAccountSummary, getVendorAccountSummary, getVehicleCheckIns } from '../lib/storage';
import { RoleBadge } from './RoleBadge';
import { TechnicianTaskCard } from './TechnicianTaskCard';
import { InteractiveVehicleInspectionChart } from './InteractiveVehicleInspectionChart';
import { Interactive3DVehicleInspectionModel } from './Interactive3DVehicleInspectionModel';
import { ManagerRequisitionApprovalView } from './ManagerRequisitionApprovalView';
import { AccountBillingLedgerModal } from './AccountBillingLedgerModal';
import { useI18n } from '../lib/i18n';
import { LicensePlateScannerModal } from './LicensePlateScannerModal';
import { RequestAdditionalWorkModal } from './RequestAdditionalWorkModal';
import { matchTaskToPanelDef } from '../lib/panelMappingHelper';
import { 
  Wrench, 
  User, 
  ChevronRight, 
  ChevronDown, 
  ChevronUp, 
  Camera, 
  Filter,
  Plus,
  Receipt,
  CreditCard,
  Car
} from 'lucide-react';

interface RoleWorkspaceViewProps {
  currentRole: UserRole;
  jobCards: JobCard[];
  onOpenJobCard: (id: string) => void;
  onOpenCustomerApprovalPortal: (id: string) => void;
}

export const RoleWorkspaceView = React.memo(function RoleWorkspaceView({
  currentRole,
  jobCards,
  onOpenJobCard,
  onOpenCustomerApprovalPortal,
}: RoleWorkspaceViewProps) {
  const isAdminOrManager = currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN' || currentRole === 'FLOOR_MANAGER';
  const authUser = getAuthUser();
  const actualUserRole = authUser?.role;
  const isActualAdminOrManager = 
    actualUserRole === 'SUPER_ADMIN' || 
    actualUserRole === 'ADMIN' || 
    actualUserRole === 'FLOOR_MANAGER';

  const [onlyMyTasks, setOnlyMyTasks] = useState<boolean>(!isActualAdminOrManager);
  const [showLedgerModal, setShowLedgerModal] = useState(false);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('ALL');
  const [use3DView, setUse3DView] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setSelectedEmployeeId('ALL');
    setOnlyMyTasks(!isActualAdminOrManager);
  }, [currentRole, isActualAdminOrManager]);

  const activeTradeEmployees = useMemo(() => {
    return getEmployees().filter(e => {
      if (currentRole === 'PAINTER') return e.role === 'PAINTER' || e.specializedTeam === 'Paint';
      if (currentRole === 'DENTER') return e.role === 'DENTER' || e.specializedTeam === 'Denting';
      if (currentRole === 'MECHANIC') return e.role === 'MECHANIC' || e.specializedTeam === 'Mechanical';
      if (currentRole === 'DELIVERY_BOY') return e.role === 'DELIVERY_BOY';
      return false;
    });
  }, [currentRole]);
  
  // Account summary for logged-in contractor / vendor / technician
  const userAccountName = authUser?.name || authUser?.employeeId || authUser?.vendorId || '';
  const isContractorOrVendor = currentRole === 'PAINTER' || currentRole === 'DENTER' || currentRole === 'MECHANIC' || currentRole === 'VENDOR';

  let accountNetBalance = 0;
  if (isContractorOrVendor && userAccountName) {
    if (currentRole === 'VENDOR') {
      const vs = getVendorAccountSummary(authUser?.vendorId || userAccountName);
      accountNetBalance = vs.netOutstandingBalance;
    } else {
      const cs = getContractorAccountSummary(authUser?.employeeId || userAccountName);
      accountNetBalance = cs.netBalancePayable;
    }
  }
  
  // Use global i18n
  const { t } = useI18n();

  // Group allotted tasks by vehicle / job card
  const vehicleGroups = useMemo(() => {
    const result: {
      card: JobCard;
      assignedTasks: JobCard['tasks'];
      allottedPanelIds: string[];
      totalSanctionedPayout: number;
      completedCount: number;
    }[] = [];

    const activeStaffList = getEmployees();
    const activeVendorList = getVendors();

    jobCards.forEach(card => {
      const assignedTasks = card.tasks.filter(task => {
        const isUserAssigned = Boolean(authUser && (
          (authUser.employeeId && (task.assignedToId === authUser.employeeId || task.pairedDenterId === authUser.employeeId)) ||
          (authUser.vendorId && (task.outsourcedVendorId === authUser.vendorId || task.assignedToId === authUser.vendorId)) ||
          (authUser.id && (task.assignedToId === authUser.id || task.pairedDenterId === authUser.id)) ||
          (authUser.name && (
            (task.assignedToName && (
              task.assignedToName.toLowerCase().includes(authUser.name.toLowerCase()) ||
              authUser.name.toLowerCase().includes(task.assignedToName.toLowerCase())
            )) ||
            (task.pairedDenterName && (
              task.pairedDenterName.toLowerCase().includes(authUser.name.toLowerCase()) ||
              authUser.name.toLowerCase().includes(task.pairedDenterName.toLowerCase())
            ))
          ))
        ));

        let matchesRole = false;
        if (isAdminOrManager) {
          matchesRole = true;
        } else if (isUserAssigned) {
          matchesRole = true;
        } else if (currentRole === 'MECHANIC' && (task.category === 'MECHANICAL' || task.category === 'INSPECTION')) {
          matchesRole = true;
        } else if (currentRole === 'DENTER' && (task.category === 'DENTING' || task.pairedDenterId || Boolean(task.pairedDenterName) || task.title.toLowerCase().includes('dent'))) {
          matchesRole = true;
        } else if (currentRole === 'PAINTER' && (task.category === 'PAINT' || task.title.toLowerCase().includes('paint'))) {
          matchesRole = true;
        } else if (currentRole === 'VENDOR' && (task.assignedType === 'VENDOR' || task.isOutsourced || task.category === 'SUBLET_VENDOR' || task.category === 'LATHE_WORK' || task.category === 'WASHING')) {
          matchesRole = true;
        }

        if (!matchesRole) return false;

        // If a specific technician or vendor is selected via dropdown, filter by that entity
        if (selectedEmployeeId && selectedEmployeeId !== 'ALL') {
          const matchedEmp = activeStaffList.find(e => e.id === selectedEmployeeId);
          const matchedVendor = activeVendorList.find(v => v.id === selectedEmployeeId);
          const nameToMatch = matchedEmp?.name || matchedVendor?.name || '';

          const isAssignedToSelected = 
            task.assignedToId === selectedEmployeeId || 
            task.pairedDenterId === selectedEmployeeId ||
            (nameToMatch && (
              (task.assignedToName && (
                task.assignedToName.toLowerCase() === nameToMatch.toLowerCase() ||
                task.assignedToName.toLowerCase().includes(nameToMatch.toLowerCase()) ||
                nameToMatch.toLowerCase().includes(task.assignedToName.toLowerCase())
              )) ||
              (task.pairedDenterName && (
                task.pairedDenterName.toLowerCase() === nameToMatch.toLowerCase() ||
                task.pairedDenterName.toLowerCase().includes(nameToMatch.toLowerCase()) ||
                nameToMatch.toLowerCase().includes(task.pairedDenterName.toLowerCase())
              ))
            ));
          return isAssignedToSelected;
        }

        if (onlyMyTasks && !isAdminOrManager && authUser && (authUser.id || authUser.employeeId || authUser.vendorId)) {
          const uId = authUser.id;
          const empId = authUser.employeeId;
          const vendId = authUser.vendorId;

          const isAssignedToMe = 
            (empId && (task.assignedToId === empId || task.pairedDenterId === empId)) ||
            (vendId && (task.outsourcedVendorId === vendId || task.assignedToId === vendId)) ||
            (uId && (task.assignedToId === uId || task.pairedDenterId === uId)) ||
            (authUser.name && (
              (task.assignedToName && (
                task.assignedToName.toLowerCase().includes(authUser.name.toLowerCase()) ||
                authUser.name.toLowerCase().includes(task.assignedToName.toLowerCase())
              )) ||
              (task.pairedDenterName && (
                task.pairedDenterName.toLowerCase().includes(authUser.name.toLowerCase()) ||
                authUser.name.toLowerCase().includes(task.pairedDenterName.toLowerCase())
              ))
            ));
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
            ? (task.painterPayout || 0)
            : currentRole === 'DENTER' 
            ? (task.denterPayout || 0)
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
  }, [jobCards, currentRole, isAdminOrManager, authUser, selectedEmployeeId, onlyMyTasks]);

  // Keep track of which vehicle cards are expanded
  const [expandedCardIds, setExpandedCardIds] = useState<string[]>(() => {
    return vehicleGroups.length > 0 ? [vehicleGroups[0].card.id] : [];
  });

  const toggleExpandCard = useCallback((cardId: string) => {
    setExpandedCardIds(prev => 
      prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]
    );
  }, []);

  const [showARMapForCard, setShowARMapForCard] = useState<Record<string, boolean>>({});
  const [taskStatusFilter, setTaskStatusFilter] = useState<Record<string, 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'>>({});
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [requestWorkCard, setRequestWorkCard] = useState<JobCard | null>(null);

  const handleScannedPlate = useCallback((regNum: string) => {
    const activeCard = jobCards.find(
      j => j.vehicle.registrationNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === regNum && 
           j.status !== 'CLOSED' && j.status !== 'DELIVERED'
    );

    if (activeCard) {
      onOpenJobCard(activeCard.id);
    }
  }, [jobCards, onOpenJobCard]);

  const getVehiclePhoto = (c: JobCard): string | null => {
    if (c.vehicle?.photoUrl) return c.vehicle.photoUrl;
    if ((c as any).vehiclePhotoUrl) return (c as any).vehiclePhotoUrl;
    if (c.checkInPhotoWithDriverUrl) return c.checkInPhotoWithDriverUrl;
    const allCheckIns = getVehicleCheckIns();
    const match = allCheckIns.find(ci => 
      (c.checkInRecordId && ci.id === c.checkInRecordId) ||
      (ci.registrationNumber && c.vehicle?.registrationNumber && 
       ci.registrationNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === c.vehicle.registrationNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())
    );
    if (match?.checkInPhotoWithDriverUrl) return match.checkInPhotoWithDriverUrl;
    if ((match as any)?.photoUrl) return (match as any).photoUrl;
    return null;
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
          {/* Account Ledger Button for Contractors & Vendors */}
          {userAccountName && (
            <button
              type="button"
              onClick={() => setShowLedgerModal(true)}
              className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs px-3.5 py-2 rounded-xl font-black transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <CreditCard className="w-4 h-4 text-emerald-500" />
              <span>My Account Billing &amp; Receipts</span>
              {accountNetBalance > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[10px]">
                  Due: ₹{accountNetBalance.toLocaleString('en-IN')}
                </span>
              )}
            </button>
          )}

          {/* Active Technician Filter Selector - Only show if actual user is Admin/Manager */}
          {isActualAdminOrManager && (currentRole === 'PAINTER' || currentRole === 'DENTER' || currentRole === 'MECHANIC' || currentRole === 'VENDOR') && (
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <span className="font-extrabold uppercase text-[10px] text-slate-400 dark:text-slate-500">Technician Filter:</span>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="bg-transparent border-none text-xs font-black text-slate-800 dark:text-slate-200 outline-none cursor-pointer pr-4"
              >
                <option value="ALL">🌐 All {currentRole} Trade Tasks</option>
                {currentRole === 'VENDOR' ? (
                  getVendors().map(v => (
                    <option key={`v-filter-${v.id}`} value={v.id}>🏢 Vendor: {v.name}</option>
                  ))
                ) : (
                  activeTradeEmployees.map(e => (
                    <option key={`e-filter-${e.id}`} value={e.id}>👤 {e.name}</option>
                  ))
                )}
              </select>
            </div>
          )}

          {/* My Tasks Toggle Button - Only show if actual user is Admin/Manager and not filtering specifically */}
          {isActualAdminOrManager && selectedEmployeeId === 'ALL' && authUser && (authUser.employeeId || authUser.vendorId) && (
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
                  {(() => {
                    const vehiclePhoto = getVehiclePhoto(card);
                    return (
                      <div 
                        onClick={() => toggleExpandCard(card.id)}
                        className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 text-white cursor-pointer hover:bg-slate-800/90 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          {/* Vehicle Photo Thumbnail to make vehicle instantly recognizable */}
                          <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden shrink-0 bg-slate-800 border-2 border-slate-700 shadow-md flex items-center justify-center">
                            {vehiclePhoto ? (
                              <img
                                src={vehiclePhoto}
                                alt={`${card.vehicle.make} ${card.vehicle.model}`}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950 text-slate-400">
                                <Car className="w-7 h-7 text-amber-400" />
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">Photo</span>
                              </div>
                            )}
                          </div>

                          {/* Vehicle Details */}
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-black text-amber-400 bg-amber-500/20 px-3 py-1 rounded-xl border border-amber-500/30 text-sm">
                                🚘 {card.vehicle.registrationNumber}
                              </span>
                              <span className="text-xs font-bold text-slate-200 bg-slate-800 px-2.5 py-1 rounded-xl">
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

                          {/* Request Additional Work Button (Available to Employees & All Roles) */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRequestWorkCard(card);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                            title="Submit request for additional job/work for manager approval"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Request Extra Work</span>
                          </button>

                          {/* Expand/Collapse Toggle Button */}
                          <button
                            type="button"
                            className="p-2 rounded-xl bg-amber-500 text-slate-950 font-black hover:bg-amber-400 transition-transform cursor-pointer"
                          >
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Expanded Vehicle Details: Jobs List First + Collapsible AR Map */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 space-y-5 bg-slate-50/50 dark:bg-slate-950/40 border-t border-slate-200 dark:border-slate-800 animate-in fade-in duration-200">
                      
                      {/* 1. JOB / TASK LIST FOR THIS VEHICLE (FRONT & CENTER) */}
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-xl bg-amber-500/20 text-amber-500">
                              <Wrench className="w-4 h-4" />
                            </span>
                            <div>
                              <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                                <span>गाड़ी के कार्य (Allotted Jobs)</span>
                                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold border border-slate-200 dark:border-slate-700">
                                  {completedCount}/{assignedTasks.length} Done
                                </span>
                              </h4>
                            </div>
                          </div>

                          {/* Filter Tabs (All / Pending / In Progress / Completed) */}
                          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start sm:self-auto text-xs">
                            {(['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED'] as const).map(f => {
                              const active = (taskStatusFilter[card.id] || 'ALL') === f;
                              const label = f === 'ALL' ? `सभी (${assignedTasks.length})` :
                                            f === 'PENDING' ? `⏳ बाकी (${assignedTasks.filter(t => t.status === 'PENDING').length})` :
                                            f === 'IN_PROGRESS' ? `⚡ चालू (${assignedTasks.filter(t => t.status === 'IN_PROGRESS').length})` :
                                            `✅ पूरा (${assignedTasks.filter(t => t.status === 'COMPLETED').length})`;
                              return (
                                <button
                                  key={f}
                                  type="button"
                                  onClick={() => setTaskStatusFilter(prev => ({ ...prev, [card.id]: f }))}
                                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                                    active 
                                      ? 'bg-amber-500 text-slate-950 font-black shadow-xs' 
                                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                  }`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* List of Tasks */}
                        {(() => {
                          const currentFilter = taskStatusFilter[card.id] || 'ALL';
                          const filteredTasks = assignedTasks.filter(t => {
                            if (currentFilter === 'ALL') return true;
                            return t.status === currentFilter;
                          });

                          if (filteredTasks.length === 0) {
                            return (
                              <div className="p-6 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                                इस फ़िल्टर में कोई कार्य नहीं है ({currentFilter}).
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-3">
                              {filteredTasks.map(task => (
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
                          );
                        })()}
                      </div>

                      {/* 2. COLLAPSIBLE 3D AR VEHICLE PANEL MAP (Available on-demand without taking over screen) */}
                      {showARMap && (
                        <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => setShowARMapForCard(prev => ({ ...prev, [card.id]: !prev[card.id] }))}
                            className="w-full p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500/50 flex items-center justify-between text-xs font-black transition-all cursor-pointer"
                          >
                            <span className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                              <span>🚗 3D AR बॉडी पैनल्स एवं डेंट/पेंट डायग्राम (3D Inspection Map)</span>
                              <span className="text-[10px] text-slate-400">({allottedPanelIds.length} Panels)</span>
                            </span>
                            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                              <span>{showARMapForCard[card.id] ? 'छुपाएं (Hide)' : 'खोलें (View 3D)'}</span>
                              <ChevronDown className={`w-4 h-4 transition-transform ${showARMapForCard[card.id] ? 'rotate-180' : ''}`} />
                            </span>
                          </button>

                          {showARMapForCard[card.id] && (
                            <div className="space-y-3 animate-in fade-in duration-200">
                              <div className="flex items-center justify-end gap-2 px-1">
                                <div className="flex items-center bg-slate-250 dark:bg-slate-900 rounded-xl p-1 border border-slate-300 dark:border-slate-800 shadow-xs">
                                  <button
                                    type="button"
                                    onClick={() => setUse3DView(prev => ({ ...prev, [card.id]: true }))}
                                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer ${
                                      use3DView[card.id] !== false
                                        ? 'bg-amber-500 text-slate-950 font-black shadow'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                    }`}
                                  >
                                    🌟 Interactive 3D Model
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setUse3DView(prev => ({ ...prev, [card.id]: false }))}
                                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer ${
                                      use3DView[card.id] === false
                                        ? 'bg-amber-500 text-slate-950 font-black shadow'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                    }`}
                                  >
                                    📊 2D Diagram
                                  </button>
                                </div>
                              </div>

                              <div className="p-1 sm:p-2.5 rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden">
                                {use3DView[card.id] !== false ? (
                                  <Interactive3DVehicleInspectionModel
                                    mode="VIEW"
                                    selectedPanelIds={allottedPanelIds}
                                    inspections={card.tasks.reduce((acc, t) => {
                                      if (t.panelKey && (t.category === 'PAINT' || t.category === 'DENTING')) {
                                        acc[t.panelKey] = {
                                          panelId: t.panelKey,
                                          nameEn: t.panelNameEn || t.title,
                                          nameHi: t.title,
                                          category: 'EXTERIOR_BODY',
                                          selected: true,
                                          paintScope: t.paintScope || 'FULL_OUTER'
                                        };
                                      }
                                      return acc;
                                    }, {} as Record<string, any>)}
                                  />
                                ) : (
                                  <InteractiveVehicleInspectionChart
                                    mode="VIEW"
                                    selectedPanelIds={allottedPanelIds}
                                    inspections={card.tasks.reduce((acc, t) => {
                                      if (t.panelKey && (t.category === 'PAINT' || t.category === 'DENTING')) {
                                        acc[t.panelKey] = {
                                          panelId: t.panelKey,
                                          nameEn: t.panelNameEn || t.title,
                                          nameHi: t.title,
                                          category: 'EXTERIOR_BODY',
                                          selected: true,
                                          paintScope: t.paintScope || 'FULL_OUTER',
                                          painterName: t.assignedToName,
                                          denterName: t.pairedDenterName,
                                          customPrice: t.customerPrice,
                                          customPainterPayout: t.painterPayout,
                                          customDenterPayout: t.denterPayout
                                        };
                                      }
                                      return acc;
                                    }, {} as Record<string, any>)}
                                    compact={true}
                                    currentRole={currentRole}
                                    vehicleMakeModel={`${card.vehicle.make} ${card.vehicle.model}`}
                                  />
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

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

      {requestWorkCard && (
        <RequestAdditionalWorkModal
          card={requestWorkCard}
          isOpen={Boolean(requestWorkCard)}
          onClose={() => setRequestWorkCard(null)}
          currentRole={currentRole}
        />
      )}

      {/* Account Ledger Modal for logged-in user */}
      {showLedgerModal && userAccountName && (
        <AccountBillingLedgerModal
          isOpen={showLedgerModal}
          onClose={() => setShowLedgerModal(false)}
          accountType={currentRole === 'VENDOR' ? 'VENDOR' : 'CONTRACTOR'}
          accountIdOrName={authUser?.vendorId || authUser?.employeeId || userAccountName}
          accountDisplayName={userAccountName}
          currentRole={currentRole}
        />
      )}
    </div>
  );
});
