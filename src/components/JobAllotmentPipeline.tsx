import React, { useState } from 'react';
import { TaskCategory, SpecializedTeam, Employee, Vendor, StandardJob, PaintScope } from '../types';
import { getStandardJobs } from '../lib/storage';
import { mapPanelToStandardJob, matchTaskToPanelDef } from '../lib/panelMappingHelper';
import { InteractiveVehicleInspectionChart, VEHICLE_PANELS } from './InteractiveVehicleInspectionChart';
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

  // Toggle between interactive Visual Sketch view vs standard list view for body panels
  const [paintViewMode, setPaintViewMode] = useState<'VISUAL_SKETCH' | 'GRID_LIST'>('VISUAL_SKETCH');

  // Helper to handle panel toggles from interactive visual sketch chart
  const handlePanelChartToggle = (panelId: string, matchedJobId?: string) => {
    // Find panel definition
    const panelDef = VEHICLE_PANELS.find(p => p.id === panelId);
    if (!panelDef) return;

    // Fetch freshest standard jobs from library
    const freshJobs = getStandardJobs();

    // Find matched standard job in standardJobs library
    const matchedStdJob = mapPanelToStandardJob(panelDef, freshJobs);
    const stdJob = matchedStdJob || {
      id: matchedJobId || panelDef.standardJobId,
      title: `${panelDef.nameEn} (Full Outer Paint)`,
      category: 'PAINT' as TaskCategory,
      panelKey: panelId,
      panelNameEn: panelDef.nameEn,
      retailPrice: 2000,
      cars24Price: 1350,
      isContractBasis: true,
      contractorPayout: isCars24 ? 950 : 1150,
      painterPayout: isCars24 ? 800 : 950,
      denterPayout: isCars24 ? 150 : 200,
      estimatedHours: 4
    };

    // Check if task(s) already exist in selectedTasks for this panel
    const existingTasks = selectedTasks.filter(t => 
      (t.panelKey && t.panelKey === panelId) ||
      matchTaskToPanelDef(t)?.id === panelId ||
      (stdJob && t.standardJobId === stdJob.id) ||
      (panelDef.standardJobId && t.standardJobId === panelDef.standardJobId) ||
      (panelDef.cars24StandardJobId && t.standardJobId === panelDef.cars24StandardJobId)
    );

    if (existingTasks.length > 0) {
      // Panel was already selected -> Clicked again -> Remove from task list
      const idsToRemove = new Set(existingTasks.map(t => t.id));
      onTasksChange(selectedTasks.filter(t => !idsToRemove.has(t.id)));
    } else {
      // Panel was not selected -> Clicked -> Add to task list
      const newTask = createUnallocatedTask({
        ...stdJob,
        panelKey: panelId,
        panelNameEn: panelDef.nameEn
      });
      onTasksChange([...selectedTasks, newTask]);
    }
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
    return selectedTasks.some(t => t.standardJobId === stdJobId);
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

    if (stdJob.category === 'PAINT') {
      return {
        id: `task-paint-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        title: stdJob.title,
        category: 'PAINT',
        team: 'Paint',
        assignedToId: undefined, // Unallocated initially
        assignedToName: undefined,
        assignedType: 'EMPLOYEE',
        estimatedCost: contractorPayout,
        customerPrice: price,
        requiresCustomerApproval: false,
        isContractBasis: true,
        painterPayout: painterPayout,
        denterPayout: denterPayout,
        pairedDenterId: undefined, // Unallocated initially
        pairedDenterName: undefined,
        standardJobId: stdJob.id,
        panelKey: stdJob.panelKey,
        panelNameEn: stdJob.panelNameEn,
        paintScope: stdJob.paintScope,
      };
    } else {
      return {
        id: `task-std-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        title: stdJob.title,
        category: stdJob.category,
        team: stdJob.category === 'WASHING' ? 'Detailing & Washing' :
              stdJob.category === 'DENTING' ? 'Denting' :
              stdJob.category === 'LATHE_WORK' ? 'Logistics' : 'Mechanical',
        assignedToId: undefined, // Unallocated initially
        assignedToName: undefined,
        assignedType: stdJob.category === 'SUBLET_VENDOR' || stdJob.category === 'LATHE_WORK' ? 'VENDOR' : 'EMPLOYEE',
        estimatedCost: stdJob.isContractBasis ? contractorPayout : Math.round(price * 0.5),
        customerPrice: price,
        requiresCustomerApproval: false,
        isContractBasis: stdJob.isContractBasis,
        painterPayout: painterPayout,
        denterPayout: denterPayout,
        standardJobId: stdJob.id,
        panelKey: stdJob.panelKey,
        panelNameEn: stdJob.panelNameEn
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
            const price = isCars24 ? job.cars24Price : job.retailPrice;

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
                          onTasksChange(selectedTasks.filter(t => t.standardJobId !== job.id));
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
              onPanelToggle={handlePanelChartToggle}
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
    </div>
  );
}
