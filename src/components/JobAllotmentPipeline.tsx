import React, { useState, useMemo, useEffect } from 'react';
import { TaskCategory, SpecializedTeam, Employee, Vendor, StandardJob, PaintScope } from '../types';
import { getStandardJobs, getVehiclePanels } from '../lib/storage';
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
  retailPrice?: number;
  cars24Price?: number;
  partPrice?: number;
  labourPrice?: number;
  isTaxInclusive?: boolean;
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
    'STANDARD_13' | 'PAINTING_DENTING' | 'DENTING' | 'MECHANICAL' | 'WASHING' | 'ACCESSORIES' | 'LATHE_WORK' | 'ALIGNMENT' | 'TYRE_WORK'
  >('STANDARD_13');

  const standardJobs = getStandardJobs();

  // Staged job IDs selected by checkbox before pressing "Add Selected Jobs to Job Card"
  const [stagedJobIds, setStagedJobIds] = useState<string[]>([]);

  // Default staff selections for auto-allotment across departments
  const [selectedPainterId, setSelectedPainterId] = useState<string>('');
  const [selectedDenterId, setSelectedDenterId] = useState<string>('');
  const [selectedMechanicId, setSelectedMechanicId] = useState<string>('');
  const [selectedOtherDeptStaffId, setSelectedOtherDeptStaffId] = useState<string>('');

  // Keep department dropdowns synced when tasks already have an assignee (e.g. from PaintBatchAllotmentControl or existing job card)
  useEffect(() => {
    const existingPainter = selectedTasks.find(t => t.category === 'PAINT' && t.assignedToId);
    if (existingPainter?.assignedToId && !selectedPainterId) {
      setSelectedPainterId(existingPainter.assignedToId);
    }
    const existingDenter = selectedTasks.find(t => (t.category === 'PAINT' && t.pairedDenterId) || (t.category === 'DENTING' && t.assignedToId));
    const dId = existingDenter?.category === 'PAINT' ? existingDenter.pairedDenterId : existingDenter?.assignedToId;
    if (dId && !selectedDenterId) {
      setSelectedDenterId(dId);
    }
    const existingMechanic = selectedTasks.find(t => (t.category === 'MECHANICAL' || t.category === 'ALIGNMENT_BALANCING' || t.category === 'TYRE_WORK') && t.assignedToId);
    if (existingMechanic?.assignedToId && !selectedMechanicId) {
      setSelectedMechanicId(existingMechanic.assignedToId);
    }
    const existingOther = selectedTasks.find(t => (t.category === 'WASHING' || t.category === 'ACCESSORIES' || t.category === 'LATHE_WORK' || t.category === 'SUBLET_VENDOR') && t.assignedToId);
    if (existingOther?.assignedToId && !selectedOtherDeptStaffId) {
      setSelectedOtherDeptStaffId(existingOther.assignedToId);
    }
  }, [selectedTasks]);

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
    const panelDef = VEHICLE_PANELS.find(p => p.id === panelId) || getVehiclePanels().find((p: any) => p.id === panelId);
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
      t.category === 'PAINT' && (
        (t.panelKey && t.panelKey === panelId) ||
        matchTaskToPanelDef(t)?.id === panelId
      )
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
    const panelDef = VEHICLE_PANELS.find(p => p.id === panelId) || getVehiclePanels().find((p: any) => p.id === panelId);
    if (!panelDef) return;

    const freshJobs = getStandardJobs();
    const effectiveScope: PaintScope = scope || 'FULL_OUTER';
    const rates = getPanelEnvironmentRates(panelDef, freshJobs, isCars24, effectiveScope);

    const existingTasks = selectedTasks.filter(t => 
      t.category === 'PAINT' && (
        (t.panelKey && t.panelKey === panelId) ||
        matchTaskToPanelDef(t)?.id === panelId
      )
    );

    if (existingTasks.length > 0) {
      if (!scope || existingTasks[0].paintScope === effectiveScope) {
        // Deselect panel
        const idsToRemove = new Set(existingTasks.map(t => t.id));
        onTasksChange(selectedTasks.filter(t => !idsToRemove.has(t.id)));
        return;
      }
    }

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
  };

  // Synchronize entire visual AR inspection changes with selectedTasks state
  const handleInspectionChange = (updatedInspections: Record<string, PanelInspectionItem>) => {
    let updatedTasksList = [...selectedTasks];
    const allKnownPanels = [...VEHICLE_PANELS, ...getVehiclePanels()];

    // Resolve active Painter & Denter from state OR from any existing paint/denting task on the vehicle
    const existingPaintWithPainter = selectedTasks.find(t => t.category === 'PAINT' && t.assignedToId);
    const effectivePainterId = selectedPainterId || existingPaintWithPainter?.assignedToId;
    const painterEmp = employees.find(e => e.id === effectivePainterId);
    const effectivePainterName = painterEmp?.name || existingPaintWithPainter?.assignedToName;

    const existingTaskWithDenter = selectedTasks.find(t => (t.category === 'PAINT' && t.pairedDenterId) || (t.category === 'DENTING' && t.assignedToId));
    const effectiveDenterId = selectedDenterId || existingTaskWithDenter?.pairedDenterId || (existingTaskWithDenter?.category === 'DENTING' ? existingTaskWithDenter?.assignedToId : undefined);
    const denterEmp = employees.find(e => e.id === effectiveDenterId);
    const effectiveDenterName = denterEmp?.name || existingTaskWithDenter?.pairedDenterName || (existingTaskWithDenter?.category === 'DENTING' ? existingTaskWithDenter?.assignedToName : undefined);

    // 1. Process all panels in updatedInspections
    Object.keys(updatedInspections).forEach(panelId => {
      const inspection = updatedInspections[panelId];
      const panelDef = allKnownPanels.find(p => p.id === panelId);
      if (!panelDef) return;

      if (!inspection.selected) {
        // Remove PAINT task if deselected
        updatedTasksList = updatedTasksList.filter(t => {
          if (t.category !== 'PAINT') return true;
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

      // Find by panelKey OR standard job match (restricted to PAINT category)
      const existingTaskIndex = updatedTasksList.findIndex(t => {
        if (t.category !== 'PAINT') return false;
        const matchedDef = matchTaskToPanelDef(t);
        return (t.panelKey && t.panelKey === panelId) || 
               (matchedDef && matchedDef.id === panelId);
      });

      if (existingTaskIndex !== -1) {
        const prevTask = updatedTasksList[existingTaskIndex];
        // Update the existing task with new paint scope, price, payouts, and preserve/apply Painter & Denter
        updatedTasksList[existingTaskIndex] = {
          ...prevTask,
          title: dynamicTitle,
          paintScope: scope,
          customerPrice: price,
          painterPayout,
          denterPayout,
          contractorPayout: totalContractorPayout,
          estimatedCost: totalContractorPayout,
          panelKey: panelId,
          panelNameEn: panelDef.nameEn,
          assignedToId: prevTask.assignedToId || effectivePainterId || undefined,
          assignedToName: prevTask.assignedToName || effectivePainterName || undefined,
          pairedDenterId: prevTask.pairedDenterId || effectiveDenterId || undefined,
          pairedDenterName: prevTask.pairedDenterName || effectiveDenterName || undefined,
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
        updatedTasksList.push({
          ...newTask,
          assignedToId: newTask.assignedToId || effectivePainterId || undefined,
          assignedToName: newTask.assignedToName || effectivePainterName || undefined,
          pairedDenterId: newTask.pairedDenterId || effectiveDenterId || undefined,
          pairedDenterName: newTask.pairedDenterName || effectiveDenterName || undefined,
        });
      }
    });

    // 2. Remove tasks ONLY for PAINT category panels that are marked selected=false or missing from updatedInspections
    const finalTasks = updatedTasksList.filter(t => {
      if (t.category !== 'PAINT') return true; // Always preserve mechanical, denting, washing, accessories etc.!
      const matchedDef = matchTaskToPanelDef(t);
      const resolvedPanelKey = t.panelKey || matchedDef?.id;
      if (!resolvedPanelKey) return true;
      
      const inspection = updatedInspections[resolvedPanelKey];
      return inspection && inspection.selected;
    });

    onTasksChange(finalTasks);
  };

  const chartSelectedPanelIds = useMemo(() => Array.from(new Set(selectedTasks.filter(t => t.category === 'PAINT').map(t => {
    const matchedDef = matchTaskToPanelDef(t);
    return matchedDef ? matchedDef.id : (t.panelKey || '');
  }).filter(Boolean))), [selectedTasks]);

  const chartInspections = useMemo(() => selectedTasks.filter(t => t.category === 'PAINT').reduce((acc, t) => {
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
  }, {} as Record<string, PanelInspectionItem>), [selectedTasks]);

  const CORE_13_JOB_IDS = [
    'std-gen-1',
    'std-gen-2',
    'std-gen-3',
    'std-gen-4',
    'std-gen-5',
    'std-gen-6',
    'std-gen-7',
    'std-gen-8',
    'std-gen-9',
    'std-gen-10',
    'std-gen-11',
    'std-gen-12',
    'std-gen-13',
  ];

  const sections = [
    { id: 'STANDARD_13', label: '⚡ Core Standard Jobs (13 Services)', icon: Sparkles, color: 'text-amber-500', count: selectedTasks.filter(t => CORE_13_JOB_IDS.includes(t.standardJobId || '')).length },
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
    const pRate = stdJob.partPrice ?? 0;
    const lRate = stdJob.labourPrice ?? Math.max(0, price - pRate);

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

    const existingPaintWithPainter = selectedTasks.find(t => t.category === 'PAINT' && t.assignedToId);
    const effectivePainterId = selectedPainterId || existingPaintWithPainter?.assignedToId || '';
    const painterEmp = employees.find(e => e.id === effectivePainterId);

    const existingTaskWithDenter = selectedTasks.find(t => (t.category === 'PAINT' && t.pairedDenterId) || (t.category === 'DENTING' && t.assignedToId));
    const effectiveDenterId = selectedDenterId || existingTaskWithDenter?.pairedDenterId || (existingTaskWithDenter?.category === 'DENTING' ? existingTaskWithDenter?.assignedToId : '') || '';
    const denterEmp = employees.find(e => e.id === effectiveDenterId);

    const mechanicEmp = employees.find(e => e.id === selectedMechanicId);
    const otherStaffEmp = employees.find(e => e.id === selectedOtherDeptStaffId);
    const otherVendor = vendors.find(v => v.id === selectedOtherDeptStaffId);

    if (stdJob.category === 'PAINT') {
      return {
        id: `task-paint-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        title: stdJob.title,
        category: 'PAINT',
        team: 'Paint',
        assignedToId: effectivePainterId || undefined,
        assignedToName: painterEmp?.name || existingPaintWithPainter?.assignedToName || undefined,
        assignedType: 'EMPLOYEE',
        estimatedCost: contractorPayout,
        customerPrice: price,
        retailPrice: stdJob.retailPrice,
        cars24Price: stdJob.cars24Price,
        partPrice: pRate,
        labourPrice: lRate,
        isTaxInclusive: true,
        requiresCustomerApproval: false,
        isContractBasis: true,
        contractorPayout: contractorPayout,
        painterPayout: painterPayout,
        denterPayout: denterPayout,
        pairedDenterId: effectiveDenterId || undefined,
        pairedDenterName: denterEmp?.name || existingTaskWithDenter?.pairedDenterName || undefined,
        standardJobId: stdJob.id,
        panelKey: resolvedPanelKey,
        panelNameEn: resolvedPanelNameEn,
        paintScope: stdJob.paintScope,
      };
    } else {
      const isDenting = stdJob.category === 'DENTING';
      const isMechOrWheel = stdJob.category === 'MECHANICAL' || stdJob.category === 'ALIGNMENT_BALANCING' || stdJob.category === 'TYRE_WORK';
      const targetId = isDenting
        ? effectiveDenterId
        : isMechOrWheel
        ? selectedMechanicId
        : selectedOtherDeptStaffId;

      const assignedEmp = isDenting
        ? denterEmp
        : isMechOrWheel
        ? mechanicEmp
        : otherStaffEmp;

      const assignedVen = (!isDenting && !isMechOrWheel) ? otherVendor : undefined;

      return {
        id: `task-std-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        title: stdJob.title,
        category: stdJob.category,
        team: stdJob.category === 'WASHING' ? 'Detailing & Washing' :
              stdJob.category === 'DENTING' ? 'Denting' :
              stdJob.category === 'LATHE_WORK' || stdJob.category === 'SUBLET_VENDOR' ? 'Logistics' : 'Mechanical',
        assignedToId: targetId || undefined,
        assignedToName: assignedEmp?.name || assignedVen?.name || undefined,
        assignedType: assignedVen || stdJob.category === 'SUBLET_VENDOR' || stdJob.category === 'LATHE_WORK' ? 'VENDOR' : 'EMPLOYEE',
        estimatedCost: stdJob.isContractBasis ? contractorPayout : Math.round(price * 0.5),
        customerPrice: price,
        retailPrice: stdJob.retailPrice,
        cars24Price: stdJob.cars24Price,
        partPrice: pRate,
        labourPrice: lRate,
        isTaxInclusive: true,
        requiresCustomerApproval: false,
        isContractBasis: stdJob.isContractBasis,
        contractorPayout: stdJob.isContractBasis ? contractorPayout : Math.round(price * 0.5),
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

  // Toggle single job directly (one-click add/remove)
  const handleToggleSingleJob = (stdJob: StandardJob) => {
    const matchedPanel = matchTaskToPanelDef(stdJob);
    const existing = selectedTasks.find(t => 
      t.standardJobId === stdJob.id || 
      (matchedPanel && (t.panelKey === matchedPanel.id || matchTaskToPanelDef(t)?.id === matchedPanel.id))
    );
    if (existing) {
      onTasksChange(selectedTasks.filter(t => t.id !== existing.id));
    } else {
      const newTask = createUnallocatedTask(stdJob);
      onTasksChange([...selectedTasks, newTask]);
    }
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
  const standard13Jobs = standardJobs.filter(j => CORE_13_JOB_IDS.includes(j.id));
  const paintPanels = standardJobs.filter(j => j.category === 'PAINT');
  const dentingJobs = standardJobs.filter(j => j.category === 'DENTING');
  const mechanicalJobs = standardJobs.filter(j => j.category === 'MECHANICAL');
  const washingJobs = standardJobs.filter(j => j.category === 'WASHING');
  const accessoryJobs = standardJobs.filter(j => j.category === 'ACCESSORIES');
  const latheJobs = standardJobs.filter(j => j.category === 'LATHE_WORK' || j.category === 'SUBLET_VENDOR');
  const alignmentJobs = standardJobs.filter(j => j.category === 'ALIGNMENT_BALANCING');
  const tyreJobs = standardJobs.filter(j => j.category === 'TYRE_WORK');

  // Generic render function for standard job cards in selection lists with complete rate breakdown
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

            const activePrice = (alreadyAdded && addedTask && addedTask.customerPrice !== undefined)
              ? addedTask.customerPrice
              : (isCars24 ? job.cars24Price : job.retailPrice);

            const activePartPrice = addedTask?.partPrice ?? job.partPrice ?? 0;
            const activeLabourPrice = addedTask?.labourPrice ?? job.labourPrice ?? Math.max(0, activePrice - activePartPrice);
            const activeContractorPayout = addedTask?.contractorPayout ?? (isCars24 ? (job.cars24ContractorPayout ?? job.contractorPayout ?? 0) : (job.retailContractorPayout ?? job.contractorPayout ?? 0));

            return (
              <div
                key={job.id}
                onClick={() => handleToggleSingleJob(job)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 relative group ${
                  alreadyAdded
                    ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700 shadow-sm ring-1 ring-emerald-500/30'
                    : isStaged
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/30 shadow-sm'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-700 hover:shadow-xs'
                }`}
              >
                {/* Header: Checkbox + Job Title & Category Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className={`mt-0.5 w-4.5 h-4.5 rounded-lg border flex items-center justify-center shrink-0 transition-all ${
                      alreadyAdded
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : isStaged
                        ? 'bg-amber-500 border-amber-500 text-slate-950'
                        : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 group-hover:border-amber-400'
                    }`}>
                      {(alreadyAdded || isStaged) && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-extrabold text-xs text-slate-900 dark:text-slate-100 leading-snug">
                          {job.title}
                        </h4>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {job.category}
                        </span>
                      </div>
                      {job.description && (
                        <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{job.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-black text-sm text-slate-900 dark:text-white font-mono">
                      ₹{activePrice.toLocaleString('en-IN')}
                    </span>
                    <div className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                      Incl. 18% Tax
                    </div>
                  </div>
                </div>

                {/* Rates Breakdown Box (Customer, Cars24, Part, Labour, Contract Payout) */}
                <div
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1 text-[10px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                    <span>Customer Rate: <strong className="text-slate-900 dark:text-white">₹{job.retailPrice}</strong></span>
                    <span>Cars24 Rate: <strong className="text-orange-600 dark:text-orange-400">₹{job.cars24Price}</strong></span>
                  </div>

                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 pt-0.5 border-t border-dashed border-slate-200 dark:border-slate-700">
                    <span>Part: <strong className="text-blue-600 dark:text-blue-400">₹{activePartPrice}</strong></span>
                    <span>Labour: <strong className="text-indigo-600 dark:text-indigo-400">₹{activeLabourPrice}</strong></span>
                    <span>Total: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">₹{activePrice}</strong></span>
                  </div>

                  {(job.isContractBasis || activeContractorPayout > 0 || job.category === 'PAINT') && (
                    <div className="flex items-center justify-between text-amber-700 dark:text-amber-300 pt-0.5 text-[9.5px] font-bold">
                      <span>⚡ Contract Job:</span>
                      <span>Contract Payout: ₹{activeContractorPayout}</span>
                    </div>
                  )}

                  {/* If already added, provide inline staff selector right here */}
                  {alreadyAdded && addedTask && (
                    <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-1.5">
                      <span className="font-bold text-[9px] uppercase text-purple-600 dark:text-purple-400 shrink-0">
                        Assigned To:
                      </span>
                      <select
                        value={addedTask.assignedToId || ''}
                        onChange={(e) => {
                          const targetId = e.target.value;
                          const emp = employees.find(item => item.id === targetId);
                          const ven = vendors.find(item => item.id === targetId);
                          onTasksChange(selectedTasks.map(t => t.id === addedTask.id ? {
                            ...t,
                            assignedToId: targetId || undefined,
                            assignedToName: emp?.name || ven?.name || undefined,
                            assignedType: ven ? 'VENDOR' : 'EMPLOYEE'
                          } : t));
                        }}
                        className="flex-1 px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-semibold text-[10px]"
                      >
                        <option value="">-- Allot Staff / Vendor --</option>
                        {employees.map(e => (
                          <option key={e.id} value={e.id}>👷 {e.name} ({e.specializedTeam || e.role})</option>
                        ))}
                        {vendors.map(v => (
                          <option key={v.id} value={v.id}>🏭 {v.name} (Sublet)</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Inline Paint Scope Chips for Painting Category */}
                {job.category === 'PAINT' && alreadyAdded && addedTask && (
                  <div className="pt-1 border-t border-slate-200/60 dark:border-slate-800/60 space-y-1" onClick={(e) => e.stopPropagation()}>
                    <div className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400">Paint Scope:</div>
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

                {/* Bottom Toggle Action */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                  {alreadyAdded ? (
                    <div className="w-full flex items-center justify-between">
                      <span className="font-extrabold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Added (Click to remove)
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSingleJob(job);
                        }}
                        className="px-2 py-0.5 rounded text-rose-600 dark:text-rose-400 font-bold hover:bg-rose-500/10 text-[11px]"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="w-full flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-medium">
                        Click card to toggle
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddSingleJob(job);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-[11px] transition-colors flex items-center gap-1 shadow-xs"
                      >
                        <Plus className="w-3 h-3 stroke-[3]" /> Add to Card
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
              <span className="font-black text-xs text-amber-400 uppercase tracking-wider">{sectionCategoryName} Pipeline</span>
              <span className="text-xs text-slate-400">({selectedTasks.length} total on job card)</span>
            </div>
            <p className="text-[11px] text-slate-300">
              Click any card above to instantly add or remove it from the job card with standard rates and staff allotment.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            {stagedJobIds.length > 0 && (
              <button
                type="button"
                onClick={handleAddStagedJobs}
                className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition-all shadow-md flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Add {stagedJobIds.length} Selected Jobs</span>
              </button>
            )}
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
      <div className="p-3.5 bg-linear-to-r from-purple-900/15 via-slate-900/60 to-slate-900/20 rounded-2xl border border-purple-400/40 dark:border-purple-800/50 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-purple-500" />
            Department & Technician Allotment (विभाग एवं स्टाफ आवंटन)
          </span>
          <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
            ✓ Selecting staff here immediately assigns all current & new tasks for that department
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
          {/* Painter Select */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase flex items-center gap-1">
              <Paintbrush className="w-3 h-3" />
              1. Painter (All Paint Panels)
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
                  assignedToName: painterEmp?.name,
                  assignedType: 'EMPLOYEE'
                } : t));
              }}
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-purple-300 dark:border-purple-800 text-slate-900 dark:text-slate-100 font-bold text-xs focus:ring-2 focus:ring-purple-500"
            >
              <option value="">-- Choose Painter --</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.name} ({e.specializedTeam || e.role})</option>
              ))}
            </select>
          </div>

          {/* Pre-Paint & Body Denter Select */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase flex items-center gap-1">
              <Hammer className="w-3 h-3" />
              2. Denter (Pre-Paint & Denting)
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
                      assignedToName: denterEmp?.name,
                      assignedType: 'EMPLOYEE'
                    };
                  }
                  return t;
                }));
              }}
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-800 text-slate-900 dark:text-slate-100 font-bold text-xs focus:ring-2 focus:ring-amber-500"
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
              3. Mechanic / Alignment / Tyre
            </label>
            <select
              value={selectedMechanicId}
              onChange={(e) => {
                const mId = e.target.value;
                setSelectedMechanicId(mId);
                const mechanicEmp = employees.find(emp => emp.id === mId);
                onTasksChange(selectedTasks.map(t => (t.category === 'MECHANICAL' || t.category === 'ALIGNMENT_BALANCING' || t.category === 'TYRE_WORK') ? {
                  ...t,
                  assignedToId: mId || undefined,
                  assignedToName: mechanicEmp?.name,
                  assignedType: 'EMPLOYEE'
                } : t));
              }}
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-800 text-slate-900 dark:text-slate-100 font-bold text-xs focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Choose Mechanic --</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.name} ({e.specializedTeam || e.role})</option>
              ))}
            </select>
          </div>

          {/* Washing / Accessories / Lathe & Sublet Select */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              4. Washing / Accessories / Sublet
            </label>
            <select
              value={selectedOtherDeptStaffId}
              onChange={(e) => {
                const oId = e.target.value;
                setSelectedOtherDeptStaffId(oId);
                const emp = employees.find(item => item.id === oId);
                const ven = vendors.find(item => item.id === oId);
                onTasksChange(selectedTasks.map(t => (t.category === 'WASHING' || t.category === 'ACCESSORIES' || t.category === 'LATHE_WORK' || t.category === 'SUBLET_VENDOR') ? {
                  ...t,
                  assignedToId: oId || undefined,
                  assignedToName: emp?.name || ven?.name,
                  assignedType: ven ? 'VENDOR' : 'EMPLOYEE'
                } : t));
              }}
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-800 text-slate-900 dark:text-slate-100 font-bold text-xs focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">-- Staff or Sublet Vendor --</option>
              <optgroup label="Workshop Staff">
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.name} ({e.specializedTeam || e.role})</option>
                ))}
              </optgroup>
              <optgroup label="Sublet Vendors">
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.name} ({v.category})</option>
                ))}
              </optgroup>
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

      {/* SECTION 0: 13 CORE GENERALIZED STANDARD JOBS */}
      {activeSection === 'STANDARD_13' && renderJobSelectionGrid(standard13Jobs, 'Core Standard Services')}

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
              selectedPanelIds={chartSelectedPanelIds}
              inspections={chartInspections}
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

      {/* Live Allotted Tasks Summary & Inline Price / Rate / Staff Editor */}
      {selectedTasks.length > 0 && (
        <div className="p-4 rounded-2xl bg-slate-900/95 border border-amber-500/30 space-y-3 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Allotted Jobs, Staff & Rate Editor ({selectedTasks.length} {selectedTasks.length === 1 ? 'Task' : 'Tasks'})</span>
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Edit Customer/Cars24 bill rate, Part rate, Labour rate, Contract Payout & assigned staff for any job below. All rates are inclusive of taxes.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono shrink-0">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold">
                Total Bill (Incl. Tax): ₹{selectedTasks.reduce((sum, t) => sum + (Number(t.customerPrice) || 0), 0).toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {selectedTasks.map((task, idx) => {
              const taskPart = task.partPrice ?? 0;
              const taskLabour = task.labourPrice ?? Math.max(0, (task.customerPrice ?? 0) - taskPart);

              return (
                <div
                  key={task.id || idx}
                  className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-black text-[10px] uppercase">
                        {task.category}
                      </span>
                      <input
                        type="text"
                        value={task.title}
                        onChange={(e) => {
                          const val = e.target.value;
                          onTasksChange(selectedTasks.map((t, i) => i === idx ? { ...t, title: val } : t));
                        }}
                        className="flex-1 min-w-[180px] font-bold text-white bg-transparent border-b border-slate-800 focus:border-amber-400 focus:outline-none text-xs"
                      />
                    </div>
                  </div>

                  {/* Inline Staff Assignment & Rate Inputs */}
                  <div className="flex flex-wrap items-center gap-2">
                    {task.category === 'PAINT' ? (
                      <>
                        {/* Painter Select (updates all paint panels together) */}
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-purple-400 uppercase">Painter (All Panels)</span>
                          <select
                            value={task.assignedToId || selectedPainterId || ''}
                            onChange={(e) => {
                              const pId = e.target.value;
                              setSelectedPainterId(pId);
                              const emp = employees.find(item => item.id === pId);
                              onTasksChange(selectedTasks.map(t => t.category === 'PAINT' ? {
                                ...t,
                                assignedToId: pId || undefined,
                                assignedToName: emp?.name || undefined,
                                assignedType: 'EMPLOYEE'
                              } : t));
                            }}
                            className="px-2 py-1 rounded-lg bg-slate-900 border border-purple-500/40 text-white font-bold text-[11px]"
                          >
                            <option value="">-- Painter --</option>
                            {employees.map(e => (
                              <option key={e.id} value={e.id}>{e.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Denter Select (updates all paint panels together) */}
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-orange-400 uppercase">Denter (All Panels)</span>
                          <select
                            value={task.pairedDenterId || selectedDenterId || ''}
                            onChange={(e) => {
                              const dId = e.target.value;
                              setSelectedDenterId(dId);
                              const emp = employees.find(item => item.id === dId);
                              onTasksChange(selectedTasks.map(t => t.category === 'PAINT' ? {
                                ...t,
                                pairedDenterId: dId || undefined,
                                pairedDenterName: emp?.name || undefined,
                              } : t));
                            }}
                            className="px-2 py-1 rounded-lg bg-slate-900 border border-orange-500/40 text-white font-bold text-[11px]"
                          >
                            <option value="">-- Denter --</option>
                            {employees.map(e => (
                              <option key={e.id} value={e.id}>{e.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Painter Payout */}
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-purple-300 uppercase">Painter ₹</span>
                          <input
                            type="number"
                            min="0"
                            value={task.painterPayout ?? 800}
                            onChange={(e) => {
                              const pVal = Number(e.target.value) || 0;
                              onTasksChange(selectedTasks.map((t, i) => i === idx ? {
                                ...t,
                                painterPayout: pVal,
                                contractorPayout: pVal + (t.denterPayout || 0),
                                estimatedCost: pVal + (t.denterPayout || 0)
                              } : t));
                            }}
                            className="w-16 px-1.5 py-1 rounded-lg bg-slate-900 border border-purple-500/40 text-purple-300 font-mono font-bold text-[11px]"
                          />
                        </div>

                        {/* Denter Payout */}
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-orange-300 uppercase">Denter ₹</span>
                          <input
                            type="number"
                            min="0"
                            value={task.denterPayout ?? 150}
                            onChange={(e) => {
                              const dVal = Number(e.target.value) || 0;
                              onTasksChange(selectedTasks.map((t, i) => i === idx ? {
                                ...t,
                                denterPayout: dVal,
                                contractorPayout: (t.painterPayout || 0) + dVal,
                                estimatedCost: (t.painterPayout || 0) + dVal
                              } : t));
                            }}
                            className="w-16 px-1.5 py-1 rounded-lg bg-slate-900 border border-orange-500/40 text-orange-300 font-mono font-bold text-[11px]"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Department Staff / Vendor Select */}
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-blue-400 uppercase">Assigned Staff / Dept</span>
                          <select
                            value={task.assignedToId || ''}
                            onChange={(e) => {
                              const targetId = e.target.value;
                              const emp = employees.find(item => item.id === targetId);
                              const ven = vendors.find(item => item.id === targetId);
                              onTasksChange(selectedTasks.map((t, i) => i === idx ? {
                                ...t,
                                assignedToId: targetId || undefined,
                                assignedToName: emp?.name || ven?.name || undefined,
                                assignedType: ven ? 'VENDOR' : 'EMPLOYEE'
                              } : t));
                            }}
                            className="px-2 py-1 rounded-lg bg-slate-900 border border-blue-500/40 text-white font-bold text-[11px]"
                          >
                            <option value="">-- Assign Staff / Vendor --</option>
                            <optgroup label="Workshop Staff">
                              {employees.map(e => (
                                <option key={e.id} value={e.id}>{e.name} ({e.specializedTeam || e.role})</option>
                              ))}
                            </optgroup>
                            <optgroup label="Sublet Vendors">
                              {vendors.map(v => (
                                <option key={v.id} value={v.id}>{v.name} ({v.category})</option>
                              ))}
                            </optgroup>
                          </select>
                        </div>

                        {/* Part Rate */}
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-blue-400 uppercase">Part ₹</span>
                          <input
                            type="number"
                            min="0"
                            value={taskPart}
                            onChange={(e) => {
                              const pVal = Number(e.target.value) || 0;
                              const newTotal = pVal + taskLabour;
                              onTasksChange(selectedTasks.map((t, i) => i === idx ? {
                                ...t,
                                partPrice: pVal,
                                customerPrice: newTotal
                              } : t));
                            }}
                            className="w-16 px-1.5 py-1 rounded-lg bg-slate-900 border border-blue-500/40 text-blue-300 font-mono font-bold text-[11px]"
                            title="Part Rate (Incl. Tax)"
                          />
                        </div>

                        {/* Labour Rate */}
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-indigo-400 uppercase">Labour ₹</span>
                          <input
                            type="number"
                            min="0"
                            value={taskLabour}
                            onChange={(e) => {
                              const lVal = Number(e.target.value) || 0;
                              const newTotal = taskPart + lVal;
                              onTasksChange(selectedTasks.map((t, i) => i === idx ? {
                                ...t,
                                labourPrice: lVal,
                                customerPrice: newTotal
                              } : t));
                            }}
                            className="w-16 px-1.5 py-1 rounded-lg bg-slate-900 border border-indigo-500/40 text-indigo-300 font-mono font-bold text-[11px]"
                            title="Labour Rate (Incl. Tax)"
                          />
                        </div>

                        {/* Labor / Contractor Payout Cost */}
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-amber-300 uppercase">Contract ₹</span>
                          <input
                            type="number"
                            min="0"
                            value={task.contractorPayout ?? task.estimatedCost ?? 0}
                            onChange={(e) => {
                              const cVal = Number(e.target.value) || 0;
                              onTasksChange(selectedTasks.map((t, i) => i === idx ? {
                                ...t,
                                estimatedCost: cVal,
                                contractorPayout: cVal,
                                isContractBasis: cVal > 0
                              } : t));
                            }}
                            className="w-16 px-1.5 py-1 rounded-lg bg-slate-900 border border-amber-500/40 text-amber-300 font-mono font-bold text-[11px]"
                            title="Contractor Payout (if piece-rate/contract)"
                          />
                        </div>
                      </>
                    )}

                    {/* Customer Bill Price (Total Rate) */}
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-emerald-400 uppercase">Total Bill ₹</span>
                      <input
                        type="number"
                        min="0"
                        value={task.customerPrice ?? 0}
                        onChange={(e) => {
                          const priceVal = Number(e.target.value) || 0;
                          const currentP = task.partPrice ?? 0;
                          onTasksChange(selectedTasks.map((t, i) => i === idx ? {
                            ...t,
                            customerPrice: priceVal,
                            labourPrice: Math.max(0, priceVal - currentP)
                          } : t));
                        }}
                        className="w-20 px-1.5 py-1 rounded-lg bg-slate-900 border border-emerald-500/40 text-emerald-400 font-mono font-extrabold text-[11px]"
                        title="Customer Bill Price (Inclusive of Taxes)"
                      />
                    </div>

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => {
                      onTasksChange(selectedTasks.filter((_, i) => i !== idx));
                    }}
                    className="mt-3 p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 transition-colors"
                    title="Remove Task"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}

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
