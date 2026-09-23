import React, { useState } from 'react';
import { TaskCategory, SpecializedTeam, Employee, Vendor, StandardJob, PaintScope } from '../types';
import { getStandardJobs } from '../lib/storage';
import { mapPanelToStandardJob, matchTaskToPanelDef, getPanelEnvironmentRates, isPartialPaintAllowedForPanel, formatPaintTaskTitle } from '../lib/panelMappingHelper';
import { InteractiveVehicleInspectionChart, VEHICLE_PANELS, PanelInspectionItem } from './InteractiveVehicleInspectionChart';
import { 
  Paintbrush, 
  Hammer, 
  Wrench, 
  Sparkles, 
  Car, 
  Settings, 
  Compass, 
  Disc, 
  CheckCircle2, 
  Check,
  Plus, 
  Trash2, 
  ShieldCheck, 
  DollarSign, 
  UserCheck, 
  Info,
  ChevronRight,
  Layers,
  Zap,
  LayoutGrid,
  Eye
} from 'lucide-react';

export interface AllocatedTaskItem {
  id: string;
  title: string;
  category: TaskCategory;
  team: SpecializedTeam;
  assignedToId?: string;
  assignedToName?: string;
  assignedType: 'EMPLOYEE' | 'VENDOR';
  estimatedCost: number;
  customerPrice: number;
  requiresCustomerApproval: boolean;
  isContractBasis?: boolean;
  contractorPayout?: number;
  painterPayout?: number;
  denterPayout?: number;
  pairedDenterId?: string;
  pairedDenterName?: string;
  standardJobId?: string;
  panelKey?: string;
  panelNameEn?: string;
  paintScope?: PaintScope;
}

interface JobAllotmentPipelineProps {
  isCars24: boolean;
  cars24RefNo?: string;
  employees: Employee[];
  vendors: Vendor[];
  selectedTasks: AllocatedTaskItem[];
  onTasksChange: (tasks: AllocatedTaskItem[]) => void;
}

export function JobAllotmentPipeline({
  isCars24,
  cars24RefNo,
  employees,
  vendors,
  selectedTasks,
  onTasksChange,
}: JobAllotmentPipelineProps) {
  const [activeSection, setActiveSection] = useState<
    'PAINTING_DENTING' | 'DENTING' | 'MECHANICAL' | 'WASHING' | 'ACCESSORIES' | 'LATHE_WORK' | 'ALIGNMENT' | 'TYRE_WORK'
  >('PAINTING_DENTING');

  const standardJobs = getStandardJobs();

  // Staged job IDs selected by checkbox before pressing "Add Selected Jobs to Job Card"
  const [stagedJobIds, setStagedJobIds] = useState<string[]>([]);

  // Default staff selections for auto-allotment
  const [selectedPainterId, setSelectedPainterId] = useState<string>('');
  const [selectedDenterId, setSelectedDenterId] = useState<string>('');
  const [selectedMechanicId, setSelectedMechanicId] = useState<string>('');

  // Toggle between interactive Visual Sketch view vs standard list view for body panels
  const [paintViewMode, setPaintViewMode] = useState<'VISUAL_SKETCH' | 'GRID_LIST'>('VISUAL_SKETCH');

  // Modal state for feeding custom payout & billing prices when Partial Paint, Inside Paint, or Custom Scope is selected
  const [customRatePrompt, setCustomRatePrompt] = useState<{
    panelId: string;
    panelName: string;
    scope: PaintScope;
    matchedJobId?: string;
    billingPrice: number;
    painterPayout: number;
    denterPayout: number;
  } | null>(null);

  // Helper to apply panel rates (either custom or default) to selectedTasks
  const applyPanelTaskWithRates = (
    panelId: string, 
    scope: PaintScope, 
    billingPrice: number, 
    painterPayout: number, 
    denterPayout: number, 
    matchedJobId?: string
  ) => {
    const panelDef = VEHICLE_PANELS.find(p => p.id === panelId);
    if (!panelDef) return;

    const totalContractorPayout = painterPayout + denterPayout;
    const taskTitle = formatPaintTaskTitle(panelDef.nameEn, scope);

    const stdJob = {
      id: matchedJobId || panelDef.standardJobId,
      title: taskTitle,
      category: 'PAINT' as TaskCategory,
      panelKey: panelId,
      panelNameEn: panelDef.nameEn,
      paintScope: scope,
      retailPrice: billingPrice,
      cars24Price: billingPrice,
      isContractBasis: true,
      contractorPayout: totalContractorPayout,
      painterPayout: painterPayout,
      denterPayout: denterPayout,
      estimatedHours: 4
    };

    const existingTasks = selectedTasks.filter(t => 
      (t.panelKey && t.panelKey === panelId) ||
      matchTaskToPanelDef(t)?.id === panelId ||
      (t.title && panelDef.nameEn && t.title.toLowerCase().includes(panelDef.nameEn.toLowerCase()))
    );

    if (existingTasks.length > 0) {
      const updatedTasks = selectedTasks.map(t => {
        if (existingTasks.some(et => et.id === t.id)) {
          return {
            ...t,
            title: taskTitle,
            paintScope: scope,
            customerPrice: billingPrice,
            painterPayout: painterPayout,
            denterPayout: denterPayout,
            contractorPayout: totalContractorPayout,
            estimatedCost: totalContractorPayout
          };
        }
        return t;
      });
      onTasksChange(updatedTasks);
    } else {
      const newTask = createUnallocatedTask({
        ...stdJob,
        panelKey: panelId,
        panelNameEn: panelDef.nameEn
      });
      onTasksChange([...selectedTasks, newTask]);
    }
  };

  // Helper to handle panel toggles from interactive visual sketch chart
  const handlePanelChartToggle = (panelId: string, matchedJobId?: string, scope?: PaintScope) => {
    const panelDef = VEHICLE_PANELS.find(p => p.id === panelId);
    if (!panelDef) return;

    const freshJobs = getStandardJobs();
    const effectiveScope: PaintScope = scope || 'FULL_OUTER';
    const rates = getPanelEnvironmentRates(panelDef, freshJobs, isCars24, effectiveScope);

    const existingTasks = selectedTasks.filter(t => 
      (t.panelKey && t.panelKey === panelId) ||
      matchTaskToPanelDef(t)?.id === panelId ||
      (t.title && panelDef.nameEn && t.title.toLowerCase().includes(panelDef.nameEn.toLowerCase()))
    );

    if (existingTasks.length > 0 && (!scope || existingTasks[0].paintScope === effectiveScope)) {
      // Deselect panel
      const idsToRemove = new Set(existingTasks.map(t => t.id));
      onTasksChange(selectedTasks.filter(t => !idsToRemove.has(t.id)));
    } else {
      if (effectiveScope === 'PARTIAL_TOUCHUP' || effectiveScope === 'INSIDE_JAMB') {
        setCustomRatePrompt({
          panelId,
          panelName: panelDef.nameEn,
          scope: effectiveScope,
          matchedJobId,
          billingPrice: rates.price,
          painterPayout: rates.painterPayout,
          denterPayout: rates.denterPayout
        });
      } else {
        applyPanelTaskWithRates(panelId, effectiveScope, rates.price, rates.painterPayout, rates.denterPayout, matchedJobId);
      }
    }
  };

  // Synchronize entire visual AR inspection changes with selectedTasks state
  const handleInspectionChange = (updatedInspections: Record<string, PanelInspectionItem>) => {
    let updatedTasksList = [...selectedTasks];

    // 1. Process all selected panels in updatedInspections
    Object.keys(updatedInspections).forEach(panelId => {
      const inspection = updatedInspections[panelId];
      const panelDef = VEHICLE_PANELS.find(p => p.id === panelId);
      if (!panelDef) return;

      if (!inspection.selected) {
        // Remove task if deselected
        updatedTasksList = updatedTasksList.filter(t => {
          const matchedDef = matchTaskToPanelDef(t);
          return t.panelKey !== panelId && (!matchedDef || matchedDef.id !== panelId);
        });
        return;
      }

      const scope = inspection.paintScope || 'FULL_OUTER';
      const freshJobs = getStandardJobs();
      const rates = getPanelEnvironmentRates(panelDef, freshJobs, isCars24, scope);

      const price = inspection.customPrice !== undefined ? inspection.customPrice : rates.price;
      const painterPayout = inspection.customPainterPayout !== undefined ? inspection.customPainterPayout : rates.painterPayout;
      const denterPayout = inspection.customDenterPayout !== undefined ? inspection.customDenterPayout : rates.denterPayout;
      const totalContractorPayout = painterPayout + denterPayout;

      const dynamicTitle = formatPaintTaskTitle(panelDef.nameEn, scope);

      // Find by panelKey OR standard job match OR fuzzy title
      const existingTaskIndex = updatedTasksList.findIndex(t => {
        const matchedDef = matchTaskToPanelDef(t);
        return (t.panelKey && t.panelKey === panelId) || 
               (matchedDef && matchedDef.id === panelId) ||
               (t.title && panelDef.nameEn && t.title.toLowerCase().includes(panelDef.nameEn.toLowerCase()));
      });

      if (existingTaskIndex !== -1) {
        // Update the existing task with new paint scope, price, and payouts
        updatedTasksList[existingTaskIndex] = {
          ...updatedTasksList[existingTaskIndex],
          title: dynamicTitle,
          paintScope: scope,
          customerPrice: price,
          painterPayout,
          denterPayout,
          contractorPayout: totalContractorPayout,
          estimatedCost: totalContractorPayout,
          panelKey: panelId // preserve panelKey
        };
      } else {
        // Create a new task
        const stdJob = {
          id: panelDef.standardJobId,
          title: dynamicTitle,
          category: 'PAINT' as TaskCategory,
          panelKey: panelId,
          panelNameEn: panelDef.nameEn,
          paintScope: scope,
          retailPrice: price,
          cars24Price: price,
          isContractBasis: true,
          contractorPayout: totalContractorPayout,
          painterPayout: painterPayout,
          denterPayout: denterPayout,
          estimatedHours: 4
        };
        const newTask = createUnallocatedTask(stdJob as any);
        updatedTasksList.push(newTask);
      }
    });

    // 2. Remove tasks for panels that are no longer in updatedInspections or marked selected=false
    const finalTasks = updatedTasksList.filter(t => {
      const matchedDef = matchTaskToPanelDef(t);
      const resolvedPanelKey = t.panelKey || matchedDef?.id;
      if (!resolvedPanelKey) return true; // Keep mechanical/other non-panel tasks
      
      const inspection = updatedInspections[resolvedPanelKey];
      return inspection && inspection.selected;
    });

    onTasksChange(finalTasks);
  };

  const sections = [
    { id: 'PAINTING_DENTING', label: 'Painting & Denting', icon: Paintbrush, color: 'text-purple-600 dark:text-purple-400', count: selectedTasks.filter(t => t.category === 'PAINT').length },
    { id: 'DENTING', label: 'Exclusive Denting', icon: Hammer, color: 'text-orange-600 dark:text-orange-400', count: selectedTasks.filter(t => t.category === 'DENTING').length },
    { id: 'MECHANICAL', label: 'Mechanical', icon: Wrench, color: 'text-blue-600 dark:text-blue-400', count: selectedTasks.filter(t => t.category === 'MECHANICAL').length },
    { id: 'WASHING', label: 'Washing & Spa', icon: Sparkles, color: 'text-emerald-600 dark:text-emerald-400', count: selectedTasks.filter(t => t.category === 'WASHING').length },
    { id: 'ACCESSORIES', label: 'Accessories', icon: Layers, color: 'text-pink-600 dark:text-pink-400', count: selectedTasks.filter(t => t.category === 'ACCESSORIES').length },
    { id: 'LATHE_WORK', label: 'Lathe Work', icon: Settings, color: 'text-amber-600 dark:text-amber-400', count: selectedTasks.filter(t => t.category === 'LATHE_WORK' || t.category === 'SUBLET_VENDOR').length },
    { id: 'ALIGNMENT', label: 'Alignment & Balancing', icon: Compass, color: 'text-cyan-600 dark:text-cyan-400', count: selectedTasks.filter(t => t.category === 'ALIGNMENT_BALANCING').length },
    { id: 'TYRE_WORK', label: 'Tyre Work', icon: Disc, color: 'text-rose-600 dark:text-rose-400', count: selectedTasks.filter(t => t.category === 'TYRE_WORK').length },
  ];

  // Check if a standard job is currently on the job card
  const isJobSelected = (stdJobId: string) => {
    const stdJob = standardJobs.find(j => j.id === stdJobId);
    const matchedPanel = stdJob ? matchTaskToPanelDef(stdJob) : undefined;

    return selectedTasks.some(t => 
      t.standardJobId === stdJobId ||
      (matchedPanel && (t.panelKey === matchedPanel.id || matchTaskToPanelDef(t)?.id === matchedPanel.id))
    );
  };

  // Toggle staged selection for batch addition
  const toggleStagedJob = (jobId: string) => {
    setStagedJobIds(prev =>
      prev.includes(jobId) ? prev.filter(id => id !== jobId) : [...prev, jobId]
    );
  };

  // Helper to construct a task object from standard job (NO staff allotted yet)
  const createUnallocatedTask = (stdJob: StandardJob): AllocatedTaskItem => {
    const price = isCars24 ? stdJob.cars24Price : stdJob.retailPrice;

    const painterPayout = isCars24
      ? (stdJob.cars24PainterPayout ?? stdJob.painterPayout ?? 800)
      : (stdJob.retailPainterPayout ?? stdJob.painterPayout ?? 950);

    const denterPayout = isCars24
      ? (stdJob.cars24DenterPayout ?? stdJob.denterPayout ?? 150)
      : (stdJob.retailDenterPayout ?? stdJob.denterPayout ?? 200);

    const contractorPayout = isCars24
      ? (stdJob.cars24ContractorPayout ?? stdJob.contractorPayout ?? (painterPayout + denterPayout))
      : (stdJob.retailContractorPayout ?? stdJob.contractorPayout ?? (painterPayout + denterPayout));

    const matchedPanelDef = matchTaskToPanelDef(stdJob);
    const resolvedPanelKey = stdJob.panelKey || matchedPanelDef?.id;
    const resolvedPanelNameEn = stdJob.panelNameEn || matchedPanelDef?.nameEn;

    const painterEmp = employees.find(e => e.id === selectedPainterId);
    const denterEmp = employees.find(e => e.id === selectedDenterId);
    const mechanicEmp = employees.find(e => e.id === selectedMechanicId);

    if (stdJob.category === 'PAINT') {
      return {
        id: `task-paint-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        title: stdJob.title,
        category: 'PAINT',
        team: 'Paint',
        assignedToId: selectedPainterId || undefined,
        assignedToName: painterEmp?.name || undefined,
        assignedType: 'EMPLOYEE',
        estimatedCost: contractorPayout,
        customerPrice: price,
        requiresCustomerApproval: false,
        isContractBasis: true,
        painterPayout: painterPayout,
        denterPayout: denterPayout,
        pairedDenterId: selectedDenterId || undefined,
        pairedDenterName: denterEmp?.name || undefined,
        standardJobId: stdJob.id,
        panelKey: resolvedPanelKey,
        panelNameEn: resolvedPanelNameEn,
        paintScope: stdJob.paintScope,
      };
    } else {
      const assignedEmp = stdJob.category === 'DENTING' ? denterEmp : mechanicEmp;
      return {
        id: `task-std-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        title: stdJob.title,
        category: stdJob.category,
        team: stdJob.category === 'WASHING' ? 'Detailing & Washing' :
              stdJob.category === 'DENTING' ? 'Denting' :
              stdJob.category === 'LATHE_WORK' ? 'Logistics' : 'Mechanical',
        assignedToId: (stdJob.category === 'DENTING' ? selectedDenterId : selectedMechanicId) || undefined,
        assignedToName: assignedEmp?.name || undefined,
        assignedType: stdJob.category === 'SUBLET_VENDOR' || stdJob.category === 'LATHE_WORK' ? 'VENDOR' : 'EMPLOYEE',
        estimatedCost: stdJob.isContractBasis ? contractorPayout : Math.round(price * 0.5),
        customerPrice: price,
        requiresCustomerApproval: false,
        isContractBasis: stdJob.isContractBasis,
        painterPayout: painterPayout,
        denterPayout: denterPayout,
        standardJobId: stdJob.id,
        panelKey: resolvedPanelKey,
        panelNameEn: resolvedPanelNameEn
      };
    }
  };

  // Add a single job directly
  const handleAddSingleJob = (stdJob: StandardJob) => {
    if (isJobSelected(stdJob.id)) return;
    const newTask = createUnallocatedTask(stdJob);
    onTasksChange([...selectedTasks, newTask]);
  };

  // Batch add all staged jobs
  const handleAddStagedJobs = () => {
    const newTasksToAdd: AllocatedTaskItem[] = [];

    stagedJobIds.forEach(id => {
      if (isJobSelected(id)) return;
      const stdJob = standardJobs.find(j => j.id === id);
      if (stdJob) {
        newTasksToAdd.push(createUnallocatedTask(stdJob));
      }
    });

    if (newTasksToAdd.length > 0) {
      onTasksChange([...selectedTasks, ...newTasksToAdd]);
    }
    setStagedJobIds([]);
  };

  // Filter standard jobs by category
  const paintPanels = standardJobs.filter(j => j.category === 'PAINT');
  const dentingJobs = standardJobs.filter(j => j.category === 'DENTING');
  const mechanicalJobs = standardJobs.filter(j => j.category === 'MECHANICAL');
  const washingJobs = standardJobs.filter(j => j.category === 'WASHING');
  const accessoryJobs = standardJobs.filter(j => j.category === 'ACCESSORIES');
  const latheJobs = standardJobs.filter(j => j.category === 'LATHE_WORK' || j.category === 'SUBLET_VENDOR');
  const alignmentJobs = standardJobs.filter(j => j.category === 'ALIGNMENT_BALANCING');
  const tyreJobs = standardJobs.filter(j => j.category === 'TYRE_WORK');

  // Generic render function for standard job cards in selection lists (ONLY Name & Price)
  const renderJobSelectionGrid = (jobsList: StandardJob[], sectionCategoryName: string) => {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {jobsList.map(job => {
            const alreadyAdded = isJobSelected(job.id);
            const isStaged = stagedJobIds.includes(job.id);

            const matchedPanel = matchTaskToPanelDef(job);
            const addedTask = alreadyAdded ? selectedTasks.find(t => 
              t.standardJobId === job.id || 
              (matchedPanel && (t.panelKey === matchedPanel.id || matchTaskToPanelDef(t)?.id === matchedPanel.id))
            ) : undefined;

            const isPartialAllowed = matchedPanel ? isPartialPaintAllowedForPanel(matchedPanel.id) : true;
            const currentScope: PaintScope = addedTask?.paintScope || 'FULL_OUTER';

            const price = (alreadyAdded && addedTask && addedTask.customerPrice !== undefined)
              ? addedTask.customerPrice
              : (isCars24 ? job.cars24Price : job.retailPrice);

            return (
              <div
                key={job.id}
                onClick={() => {
                  if (!alreadyAdded) toggleStagedJob(job.id);
                }}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  alreadyAdded
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                    : isStaged
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/30 shadow-sm'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-800'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    {/* Checkbox */}
                    {!alreadyAdded ? (
                      <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        isStaged ? 'bg-amber-500 border-amber-500 text-slate-950' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800'
                      }`}>
                        {isStaged && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    )}

                    <div>
                      <h4 className="font-extrabold text-xs text-slate-900 dark:text-slate-100 leading-snug">
                        {job.title}
                      </h4>
                      {job.description && (
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{job.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-black text-xs text-slate-900 dark:text-white">
                      ₹{price.toLocaleString()}
                    </span>
                    <div className="text-[9.5px] text-slate-400 font-medium">
                      {isCars24 ? 'Cars24 Rate' : 'Retail Rate'}
                    </div>
                  </div>
                </div>

                {/* Inline Paint Scope Chips for Painting Category */}
                {job.category === 'PAINT' && alreadyAdded && addedTask && (
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Select Paint Scope:</div>
                    <div className="flex flex-wrap gap-1">
                      {[
                        { id: 'FULL_OUTER', label: 'Full Paint', icon: '✨' },
                        { id: 'PARTIAL_TOUCHUP', label: 'Partial Paint', icon: '🎨', disabled: !isPartialAllowed },
                        { id: 'INSIDE_JAMB', label: 'Inside Paint', icon: '🚪' },
                        { id: 'FULL_OUTER_AND_INSIDE', label: 'Outer + Inside', icon: '🌟' }
                      ].map(s => {
                        const active = currentScope === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            disabled={s.disabled}
                            title={s.disabled ? 'Partial paint not allowed for fenders & running boards' : s.label}
                            onClick={() => {
                              if (s.disabled) return;
                              
                              // Calculate new rates for the chosen scope
                              const newScope = s.id as PaintScope;
                              const freshJobs = getStandardJobs();
                              const rates = getPanelEnvironmentRates(matchedPanel || job.id, freshJobs, isCars24, newScope);
                              const priceVal = rates.price;
                              const painterPayout = rates.painterPayout;
                              const denterPayout = rates.denterPayout;
                              const totalContractorPayout = painterPayout + denterPayout;

                              const dynamicTitle = formatPaintTaskTitle(matchedPanel ? matchedPanel.nameEn : job.title, newScope);

                              const updatedTasks = selectedTasks.map(t => {
                                const isMatch = (addedTask && t.id === addedTask.id) ||
                                  (t.standardJobId && t.standardJobId === job.id) ||
                                  (t.panelKey && matchedPanel && t.panelKey === matchedPanel.id) ||
                                  (matchedPanel && matchTaskToPanelDef(t)?.id === matchedPanel.id) ||
                                  (matchedPanel && t.title && t.title.toLowerCase().includes(matchedPanel.nameEn.toLowerCase()));
                                if (isMatch) {
                                  return {
                                    ...t,
                                    title: dynamicTitle,
                                    paintScope: newScope,
                                    customerPrice: priceVal,
                                    painterPayout,
                                    denterPayout,
                                    contractorPayout: totalContractorPayout,
                                    estimatedCost: totalContractorPayout
                                  };
                                }
                                return t;
                              });
                              onTasksChange(updatedTasks);
                            }}
                            className={`px-2 py-0.5 rounded-lg font-bold text-[9px] transition-all flex items-center gap-1 ${
                              s.disabled
                                ? 'bg-slate-100 dark:bg-slate-900/50 text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-40'
                                : active
                                ? 'bg-amber-400 text-slate-950 font-black shadow-xs ring-1 ring-amber-300'
                                : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-amber-400/60'
                            }`}
                          >
                            <span>{s.icon}</span>
                            <span>{s.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                  {alreadyAdded ? (
                    <div className="w-full flex items-center justify-between">
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Added to Job Card
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const matchedPanel = matchTaskToPanelDef(job);
                          onTasksChange(selectedTasks.filter(t => 
                            t.standardJobId !== job.id && 
                            (!matchedPanel || (t.panelKey !== matchedPanel.id && matchTaskToPanelDef(t)?.id !== matchedPanel.id))
                          ));
                        }}
                        className="text-rose-600 dark:text-rose-400 font-bold hover:underline text-[11px]"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="w-full flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-medium">
                        {isStaged ? '✓ Selected' : 'Click to select'}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddSingleJob(job);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 font-bold text-[11px] text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add Now
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Section Bottom Add Action Bar */}
        <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg mt-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-xs text-amber-400 uppercase tracking-wider">{sectionCategoryName} Cart</span>
              <span className="text-xs text-slate-400">({stagedJobIds.length} selected)</span>
            </div>
            <p className="text-[11px] text-slate-300">
              Select jobs above and click the button to add to the job card. Staff allotment is done after adding.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            {stagedJobIds.length > 0 && (
              <button
                type="button"
                onClick={() => setStagedJobIds([])}
                className="px-3 py-2 text-xs font-bold text-slate-400 hover:text-white"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              disabled={stagedJobIds.length === 0}
              onClick={handleAddStagedJobs}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition-all disabled:opacity-30 disabled:hover:bg-amber-500 shadow-md flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Add {stagedJobIds.length > 0 ? `${stagedJobIds.length} Selected Job${stagedJobIds.length === 1 ? '' : 's'}` : 'Selected Jobs'} to Job Card</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Cars24 Partner Rule Header Indicator */}
      {isCars24 ? (
        <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold shrink-0">
            ⚡
          </div>
          <div className="text-xs space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-black text-orange-900 dark:text-orange-200 uppercase tracking-wide">
                Cars24 Fleet Job Allotment Protocol Active
              </span>
              {cars24RefNo && (
                <span className="font-mono bg-orange-200 dark:bg-orange-950 text-orange-900 dark:text-orange-300 font-bold px-2 py-0.5 rounded text-[10px]">
                  Ref: {cars24RefNo}
                </span>
              )}
            </div>
            <p className="text-slate-700 dark:text-slate-300 font-medium">
              Fixed panel rates apply per Cars24 B2B tariff. Selecting a panel creates a painting job which includes prepaint denting.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="font-bold text-slate-800 dark:text-slate-200">
              Standard Retail Workshop Tariff Active • Select jobs across 8 specialized sections below
            </span>
          </div>
        </div>
      )}

      {/* Staff Allotment Setup Bar */}
      <div className="p-3.5 bg-linear-to-r from-purple-900/10 via-slate-900/40 to-slate-900/10 rounded-2xl border border-purple-300/40 dark:border-purple-800/40 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-purple-500" />
            Staff & Technician Allotment (ऑटो-स्टाफ आवंटन)
          </span>
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
            Auto-assigns selected technicians to newly added tasks
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          {/* Painter Select */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase flex items-center gap-1">
              <Paintbrush className="w-3 h-3" />
              Painter Allotment
            </label>
            <select
              value={selectedPainterId}
              onChange={(e) => {
                const pId = e.target.value;
                setSelectedPainterId(pId);
                const painterEmp = employees.find(emp => emp.id === pId);
                onTasksChange(selectedTasks.map(t => t.category === 'PAINT' ? {
                  ...t,
                  assignedToId: pId || undefined,
                  assignedToName: painterEmp?.name
                } : t));
              }}
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-purple-300 dark:border-purple-800 text-slate-900 dark:text-slate-100 font-medium text-xs focus:ring-2 focus:ring-purple-500"
            >
              <option value="">-- Choose Painter --</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.name} ({e.specializedTeam || e.role})</option>
              ))}
            </select>
          </div>

          {/* Pre-Paint Denter Select */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase flex items-center gap-1">
              <Hammer className="w-3 h-3" />
              Pre-Paint Denter Allotment
            </label>
            <select
              value={selectedDenterId}
              onChange={(e) => {
                const dId = e.target.value;
                setSelectedDenterId(dId);
                const denterEmp = employees.find(emp => emp.id === dId);
                onTasksChange(selectedTasks.map(t => {
                  if (t.category === 'PAINT') {
                    return {
                      ...t,
                      pairedDenterId: dId || undefined,
                      pairedDenterName: denterEmp?.name
                    };
                  } else if (t.category === 'DENTING') {
                    return {
                      ...t,
                      assignedToId: dId || undefined,
                      assignedToName: denterEmp?.name
                    };
                  }
                  return t;
                }));
              }}
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-800 text-slate-900 dark:text-slate-100 font-medium text-xs focus:ring-2 focus:ring-amber-500"
            >
              <option value="">-- Choose Denter --</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.name} ({e.specializedTeam || e.role})</option>
              ))}
            </select>
          </div>

          {/* Mechanic Select */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase flex items-center gap-1">
              <Wrench className="w-3 h-3" />
              Mechanic Allotment
            </label>
            <select
              value={selectedMechanicId}
              onChange={(e) => {
                const mId = e.target.value;
                setSelectedMechanicId(mId);
                const mechanicEmp = employees.find(emp => emp.id === mId);
                onTasksChange(selectedTasks.map(t => t.category === 'MECHANICAL' ? {
                  ...t,
                  assignedToId: mId || undefined,
                  assignedToName: mechanicEmp?.name
                } : t));
              }}
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-800 text-slate-900 dark:text-slate-100 font-medium text-xs focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Choose Mechanic --</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.name} ({e.specializedTeam || e.role})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Section Tabs Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none border-b border-slate-200 dark:border-slate-800">
        {sections.map(sec => {
          const Icon = sec.icon;
          const isActive = activeSection === sec.id;

          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => {
                setActiveSection(sec.id as any);
                setStagedJobIds([]);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400 dark:text-slate-950' : sec.color}`} />
              <span>{sec.label}</span>
              {sec.count > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  isActive ? 'bg-amber-400 text-slate-950 dark:bg-slate-950 dark:text-amber-400' : 'bg-blue-600 text-white'
                }`}>
                  {sec.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* SECTION 1: PAINTING & DENTING */}
      {activeSection === 'PAINTING_DENTING' && (
        <div className="space-y-4">
          {/* Sub-view switcher: Visual Interactive Sketch vs Standard List */}
          <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800/80 p-2 rounded-2xl border border-slate-200 dark:border-slate-700/80">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 ml-2">
                पैनल चुनने का तरीका (Selection View):
              </span>
            </div>

            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPaintViewMode('VISUAL_SKETCH')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                  paintViewMode === 'VISUAL_SKETCH'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Car className="w-3.5 h-3.5" />
                <span>🎨 Visual Car Sketch (AR Diagram)</span>
              </button>

              <button
                type="button"
                onClick={() => setPaintViewMode('GRID_LIST')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                  paintViewMode === 'GRID_LIST'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>📋 List View</span>
              </button>
            </div>
          </div>

          {paintViewMode === 'VISUAL_SKETCH' ? (
            <InteractiveVehicleInspectionChart
              mode="INTERACTIVE_SELECT"
              isCars24={isCars24}
              selectedPanelIds={Array.from(new Set(selectedTasks.map(t => {
                const matchedDef = matchTaskToPanelDef(t);
                return matchedDef ? matchedDef.id : (t.panelKey || '');
              }).filter(Boolean)))}
              inspections={selectedTasks.reduce((acc, t) => {
                const matchedDef = matchTaskToPanelDef(t);
                const panelId = matchedDef ? matchedDef.id : (t.panelKey || '');
                if (panelId) {
                  acc[panelId] = {
                    panelId,
                    nameEn: t.panelNameEn || matchedDef?.nameEn || '',
                    nameHi: matchedDef?.nameHi || '',
                    category: 'EXTERIOR_BODY',
                    selected: true,
                    paintScope: t.paintScope || 'FULL_OUTER',
                    customPrice: t.customerPrice,
                    customPainterPayout: t.painterPayout,
                    customDenterPayout: t.denterPayout,
                    painterName: t.assignedToName,
                    denterName: t.pairedDenterName
                  };
                }
                return acc;
              }, {} as Record<string, any>)}
              onInspectionChange={handleInspectionChange}
              availableStandardJobs={standardJobs}
            />
          ) : (
            renderJobSelectionGrid(paintPanels, 'Painting & Denting')
          )}
        </div>
      )}

      {/* SECTION 2: EXCLUSIVE DENTING */}
      {activeSection === 'DENTING' && renderJobSelectionGrid(dentingJobs, 'Exclusive Denting')}

      {/* SECTION 3: MECHANICAL */}
      {activeSection === 'MECHANICAL' && renderJobSelectionGrid(mechanicalJobs, 'Mechanical Services')}

      {/* SECTION 4: WASHING & SPA */}
      {activeSection === 'WASHING' && renderJobSelectionGrid(washingJobs, 'Washing & Detailing')}

      {/* SECTION 5: ACCESSORIES */}
      {activeSection === 'ACCESSORIES' && renderJobSelectionGrid(accessoryJobs, 'Car Accessories')}

      {/* SECTION 6: LATHE WORK */}
      {activeSection === 'LATHE_WORK' && renderJobSelectionGrid(latheJobs, 'Lathe & Machining Sublet')}

      {/* SECTION 7: ALIGNMENT & BALANCING */}
      {activeSection === 'ALIGNMENT' && renderJobSelectionGrid(alignmentJobs, '3D Alignment & Balancing')}

      {/* SECTION 8: TYRE WORK */}
      {activeSection === 'TYRE_WORK' && renderJobSelectionGrid(tyreJobs, 'Tyre Work & Punctures')}

      {/* Custom Rate Settings Prompt Modal */}
      {customRatePrompt && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div>
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full">
                Custom Rates Allocation
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 mt-2">
                ✏️ Customize Rates: {customRatePrompt.panelName}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Configure customized customer billing and technician payouts for this 
                <strong className="text-amber-600 dark:text-amber-400 ml-1">
                  {customRatePrompt.scope === 'PARTIAL_TOUCHUP' ? '🖌️ Partial Paint / Touch-up' : '🚪 Inside Paint (Door Jamb)'}
                </strong>.
              </p>
            </div>

            <div className="space-y-4">
              {/* Customer Billing Price (GST inclusive) */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">
                  Customer Billing Price (₹) <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded ml-1">GST Included</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={customRatePrompt.billingPrice}
                  onChange={(e) => setCustomRatePrompt(prev => prev ? { ...prev, billingPrice: Number(e.target.value) || 0 } : null)}
                  className="w-full px-3.5 py-2 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 font-mono font-extrabold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <div className="text-[10px] text-emerald-600/85 dark:text-emerald-400/85 font-medium flex justify-between bg-emerald-500/5 p-2 rounded-xl border border-emerald-500/10">
                  <span>Base: ₹{Math.round(customRatePrompt.billingPrice / 1.18).toLocaleString('en-IN')}</span>
                  <span>GST (18%): ₹{Math.round(customRatePrompt.billingPrice - (customRatePrompt.billingPrice / 1.18)).toLocaleString('en-IN')}</span>
                  <span className="font-extrabold text-emerald-700 dark:text-emerald-300">Total: ₹{customRatePrompt.billingPrice.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Painter Payout */}
              <div className="space-y-1">
                <label className="block text-[11px] font-black text-purple-800 dark:text-purple-300 uppercase tracking-wide">
                  Painter Payout Rate (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={customRatePrompt.painterPayout}
                  onChange={(e) => setCustomRatePrompt(prev => prev ? { ...prev, painterPayout: Number(e.target.value) || 0 } : null)}
                  className="w-full px-3.5 py-2 rounded-xl border border-purple-300 dark:border-purple-800 bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 font-mono font-extrabold focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Denter Payout */}
              <div className="space-y-1">
                <label className="block text-[11px] font-black text-orange-800 dark:text-orange-300 uppercase tracking-wide">
                  Denter Payout Rate (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={customRatePrompt.denterPayout}
                  onChange={(e) => setCustomRatePrompt(prev => prev ? { ...prev, denterPayout: Number(e.target.value) || 0 } : null)}
                  className="w-full px-3.5 py-2 rounded-xl border border-orange-300 dark:border-orange-800 bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 font-mono font-extrabold focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Combined Total Contractor Payout display */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs">
                <span className="font-bold text-slate-500 dark:text-slate-400">Total Contractor Payout (Painter + Denter):</span>
                <span className="font-mono font-black text-slate-800 dark:text-slate-200">
                  ₹{(customRatePrompt.painterPayout + customRatePrompt.denterPayout).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCustomRatePrompt(null)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  applyPanelTaskWithRates(
                    customRatePrompt.panelId,
                    customRatePrompt.scope,
                    customRatePrompt.billingPrice,
                    customRatePrompt.painterPayout,
                    customRatePrompt.denterPayout,
                    customRatePrompt.matchedJobId
                  );
                  setCustomRatePrompt(null);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-4.5 py-2.5 rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center gap-1.5 cursor-pointer"
              >
                Apply Custom Rates
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
