import React, { useState } from 'react';
import { TaskCategory, SpecializedTeam, Employee, Vendor, StandardJob } from '../types';
import { getStandardJobs } from '../lib/storage';
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
  Plus, 
  Trash2, 
  ShieldCheck, 
  DollarSign, 
  UserCheck, 
  Info,
  ChevronRight,
  Layers,
  Zap
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

  // Filtered lists of employees by role
  const painters = employees.filter(e => e.role === 'PAINTER' || e.specializedTeam === 'Paint');
  const denters = employees.filter(e => e.role === 'DENTER' || e.specializedTeam === 'Denting');
  const mechanics = employees.filter(e => e.role === 'MECHANIC' || e.specializedTeam === 'Mechanical');

  // Track panel assignments in state for Painting & Denting section
  const [panelAssignments, setPanelAssignments] = useState<Record<string, { painterId: string; denterId: string }>>({});

  const sections = [
    { id: 'PAINTING_DENTING', label: 'Painting & Denting', icon: Paintbrush, color: 'text-purple-600 dark:text-purple-400', count: selectedTasks.filter(t => t.category === 'PAINT' || (t.category === 'DENTING' && t.title.includes('Pre-Paint'))).length },
    { id: 'DENTING', label: 'Exclusive Denting', icon: Hammer, color: 'text-orange-600 dark:text-orange-400', count: selectedTasks.filter(t => t.category === 'DENTING' && !t.title.includes('Pre-Paint')).length },
    { id: 'MECHANICAL', label: 'Mechanical', icon: Wrench, color: 'text-blue-600 dark:text-blue-400', count: selectedTasks.filter(t => t.category === 'MECHANICAL').length },
    { id: 'WASHING', label: 'Washing & Spa', icon: Sparkles, color: 'text-emerald-600 dark:text-emerald-400', count: selectedTasks.filter(t => t.category === 'WASHING').length },
    { id: 'ACCESSORIES', label: 'Accessories', icon: Layers, color: 'text-pink-600 dark:text-pink-400', count: selectedTasks.filter(t => t.category === 'ACCESSORIES').length },
    { id: 'LATHE_WORK', label: 'Lathe Work', icon: Settings, color: 'text-amber-600 dark:text-amber-400', count: selectedTasks.filter(t => t.category === 'LATHE_WORK' || t.category === 'SUBLET_VENDOR').length },
    { id: 'ALIGNMENT', label: 'Alignment & Balancing', icon: Compass, color: 'text-cyan-600 dark:text-cyan-400', count: selectedTasks.filter(t => t.category === 'ALIGNMENT_BALANCING').length },
    { id: 'TYRE_WORK', label: 'Tyre Work', icon: Disc, color: 'text-rose-600 dark:text-rose-400', count: selectedTasks.filter(t => t.category === 'TYRE_WORK').length },
  ];

  // Check if a standard job or panel is currently selected
  const isJobSelected = (stdJobId: string) => {
    return selectedTasks.some(t => t.standardJobId === stdJobId);
  };

  // Toggle Panel Painting + Pre-Paint Denting Task
  const handleTogglePanel = (stdJob: StandardJob) => {
    const isAlreadyAdded = isJobSelected(stdJob.id);

    if (isAlreadyAdded) {
      // Remove all tasks associated with this standard job ID
      onTasksChange(selectedTasks.filter(t => t.standardJobId !== stdJob.id));
    } else {
      // Add Painter + Denter pair for panel
      const assignedPainterId = panelAssignments[stdJob.id]?.painterId || painters[0]?.id || employees[0]?.id;
      const assignedDenterId = panelAssignments[stdJob.id]?.denterId || denters[0]?.id || employees[0]?.id;

      const painterObj = employees.find(e => e.id === assignedPainterId);
      const denterObj = employees.find(e => e.id === assignedDenterId);

      const price = isCars24 ? stdJob.cars24Price : stdJob.retailPrice;

      // 1. Paint Task assigned to Painter
      const paintTask: AllocatedTaskItem = {
        id: `task-paint-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        title: stdJob.title.includes('Paint') ? stdJob.title : `${stdJob.title} - Paint Refinish`,
        category: 'PAINT',
        team: 'Paint',
        assignedToId: painterObj?.id,
        assignedToName: painterObj?.name || 'Unassigned Painter',
        assignedType: 'EMPLOYEE',
        estimatedCost: stdJob.painterPayout || Math.round(price * 0.6),
        customerPrice: price, // Main panel charge billed here
        requiresCustomerApproval: false,
        isContractBasis: true,
        painterPayout: stdJob.painterPayout || 800,
        denterPayout: 0,
        standardJobId: stdJob.id
      };

      // 2. Pre-Paint Denting Task assigned to Denter
      const preDentTask: AllocatedTaskItem = {
        id: `task-dent-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        title: `${stdJob.title.replace(' - Paint & Dent Repair', '')} - Pre-Paint Denting`,
        category: 'DENTING',
        team: 'Denting',
        assignedToId: denterObj?.id,
        assignedToName: denterObj?.name || 'Unassigned Denter',
        assignedType: 'EMPLOYEE',
        estimatedCost: stdJob.denterPayout || 150,
        customerPrice: 0, // Billed inside main panel charge
        requiresCustomerApproval: false,
        isContractBasis: true,
        painterPayout: 0,
        denterPayout: stdJob.denterPayout || 150,
        standardJobId: stdJob.id
      };

      onTasksChange([...selectedTasks, paintTask, preDentTask]);
    }
  };

  // Toggle Standard Single Task
  const handleToggleStandardJob = (stdJob: StandardJob, customAssignedId?: string) => {
    const isAlreadyAdded = isJobSelected(stdJob.id);

    if (isAlreadyAdded) {
      onTasksChange(selectedTasks.filter(t => t.standardJobId !== stdJob.id));
    } else {
      const price = isCars24 ? stdJob.cars24Price : stdJob.retailPrice;
      let assignedEmp = employees.find(e => e.id === customAssignedId) || mechanics[0] || employees[0];
      let assignedVendor = vendors.find(v => v.id === customAssignedId) || vendors[0];

      const isVendor = stdJob.category === 'SUBLET_VENDOR' || stdJob.category === 'LATHE_WORK';

      const newTask: AllocatedTaskItem = {
        id: `task-std-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        title: stdJob.title,
        category: stdJob.category,
        team: stdJob.category === 'WASHING' ? 'Detailing & Washing' :
              stdJob.category === 'DENTING' ? 'Denting' :
              stdJob.category === 'PAINT' ? 'Paint' :
              stdJob.category === 'LATHE_WORK' ? 'Logistics' : 'Mechanical',
        assignedToId: isVendor ? assignedVendor?.id : assignedEmp?.id,
        assignedToName: isVendor ? assignedVendor?.name : assignedEmp?.name,
        assignedType: isVendor ? 'VENDOR' : 'EMPLOYEE',
        estimatedCost: stdJob.isContractBasis ? stdJob.contractorPayout : Math.round(price * 0.5),
        customerPrice: price,
        requiresCustomerApproval: false,
        isContractBasis: stdJob.isContractBasis,
        painterPayout: stdJob.painterPayout || 0,
        denterPayout: stdJob.denterPayout || 0,
        standardJobId: stdJob.id
      };

      onTasksChange([...selectedTasks, newTask]);
    }
  };

  // Update painter or denter assignment for an already added panel
  const handleUpdatePanelStaff = (stdJobId: string, type: 'PAINTER' | 'DENTER', staffId: string) => {
    setPanelAssignments(prev => ({
      ...prev,
      [stdJobId]: {
        painterId: type === 'PAINTER' ? staffId : prev[stdJobId]?.painterId || painters[0]?.id || '',
        denterId: type === 'DENTER' ? staffId : prev[stdJobId]?.denterId || denters[0]?.id || ''
      }
    }));

    const staffObj = employees.find(e => e.id === staffId);
    if (!staffObj) return;

    onTasksChange(selectedTasks.map(task => {
      if (task.standardJobId === stdJobId) {
        if (type === 'PAINTER' && task.category === 'PAINT') {
          return { ...task, assignedToId: staffObj.id, assignedToName: staffObj.name };
        }
        if (type === 'DENTER' && task.category === 'DENTING' && task.title.includes('Pre-Paint')) {
          return { ...task, assignedToId: staffObj.id, assignedToName: staffObj.name };
        }
      }
      return task;
    }));
  };

  // Filter standard jobs by category for current active section
  const paintPanels = standardJobs.filter(j => j.category === 'PAINT');
  const dentingJobs = standardJobs.filter(j => j.category === 'DENTING');
  const mechanicalJobs = standardJobs.filter(j => j.category === 'MECHANICAL');
  const washingJobs = standardJobs.filter(j => j.category === 'WASHING');
  const accessoryJobs = standardJobs.filter(j => j.category === 'ACCESSORIES');
  const latheJobs = standardJobs.filter(j => j.category === 'LATHE_WORK' || j.category === 'SUBLET_VENDOR');
  const alignmentJobs = standardJobs.filter(j => j.category === 'ALIGNMENT_BALANCING');
  const tyreJobs = standardJobs.filter(j => j.category === 'TYRE_WORK');

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
              Fixed panel rates apply per Cars24 B2B tariff. When you allot a panel for painting, the system <strong>automatically allots it to a Painter for paint refinish</strong> AND <strong>allots the same panel to a Denter for pre-paint denting</strong>.
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
              onClick={() => setActiveSection(sec.id as any)}
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

      {/* SECTION 1: PAINTING & DENTING (Panel Matrix for Cars24 & Retail) */}
      {activeSection === 'PAINTING_DENTING' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Paintbrush className="w-4 h-4 text-purple-600" />
                Standard Exterior Body Panels (Paint + Pre-Paint Dent)
              </h3>
              <p className="text-xs text-slate-500">
                Selecting any panel automatically creates linked tasks for both Painter (Paint Refinish) and Denter (Pre-Paint Denting).
              </p>
            </div>
            <span className="text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/40 px-3 py-1 rounded-xl">
              {paintPanels.filter(p => isJobSelected(p.id)).length} / {paintPanels.length} Panels Selected
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {paintPanels.map(panel => {
              const selected = isJobSelected(panel.id);
              const price = isCars24 ? panel.cars24Price : panel.retailPrice;

              const currentPainterId = panelAssignments[panel.id]?.painterId || 
                selectedTasks.find(t => t.standardJobId === panel.id && t.category === 'PAINT')?.assignedToId || 
                painters[0]?.id || '';

              const currentDenterId = panelAssignments[panel.id]?.denterId || 
                selectedTasks.find(t => t.standardJobId === panel.id && t.category === 'DENTING')?.assignedToId || 
                denters[0]?.id || '';

              return (
                <div
                  key={panel.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                    selected
                      ? 'bg-purple-50/90 dark:bg-purple-950/40 border-purple-500 dark:border-purple-600 ring-2 ring-purple-500/30 shadow-md'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-800'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-extrabold text-xs text-slate-900 dark:text-slate-100 leading-snug">
                        {panel.title}
                      </h4>
                      <div className="text-right shrink-0">
                        <span className="font-black text-sm text-slate-900 dark:text-white">
                          ₹{price.toLocaleString()}
                        </span>
                        <div className="text-[10px] text-slate-400 font-medium">
                          {isCars24 ? 'Cars24 Rate' : `Retail Rate`}
                        </div>
                      </div>
                    </div>

                    {/* Contractor Payout breakdown badge */}
                    <div className="mt-2 p-2 rounded-xl bg-purple-100/60 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800/50 flex items-center justify-between text-[11px]">
                      <span className="font-bold text-purple-900 dark:text-purple-200">Contractor Payouts:</span>
                      <div className="flex items-center gap-2 font-black text-purple-700 dark:text-purple-300">
                        <span>Painter: ₹{panel.painterPayout || 800}</span>
                        <span>•</span>
                        <span>Denter: ₹{panel.denterPayout || 150}</span>
                      </div>
                    </div>
                  </div>

                  {/* Staff Allocation Dropdowns when Selected */}
                  {selected && (
                    <div className="pt-2 border-t border-purple-200 dark:border-purple-800/60 space-y-2 animate-in fade-in duration-150">
                      {/* Painter Select */}
                      <div className="flex items-center justify-between text-xs gap-2">
                        <span className="font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1 shrink-0">
                          <Paintbrush className="w-3 h-3 text-purple-500" /> Painter:
                        </span>
                        <select
                          value={currentPainterId}
                          onChange={(e) => handleUpdatePanelStaff(panel.id, 'PAINTER', e.target.value)}
                          className="flex-1 p-1.5 rounded-lg border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200"
                        >
                          <option value="">-- Select Painter --</option>
                          {painters.map(p => (
                            <option key={p.id} value={p.id}>{p.name} (Painter)</option>
                          ))}
                        </select>
                      </div>

                      {/* Denter Select */}
                      <div className="flex items-center justify-between text-xs gap-2">
                        <span className="font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1 shrink-0">
                          <Hammer className="w-3 h-3 text-orange-500" /> Pre-Denter:
                        </span>
                        <select
                          value={currentDenterId}
                          onChange={(e) => handleUpdatePanelStaff(panel.id, 'DENTER', e.target.value)}
                          className="flex-1 p-1.5 rounded-lg border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200"
                        >
                          <option value="">-- Select Denter --</option>
                          {denters.map(d => (
                            <option key={d.id} value={d.id}>{d.name} (Denter)</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Toggle Button */}
                  <button
                    type="button"
                    onClick={() => handleTogglePanel(panel)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      selected
                        ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-xs'
                        : 'bg-purple-600 hover:bg-purple-700 text-white shadow-xs'
                    }`}
                  >
                    {selected ? (
                      <>
                        <Trash2 className="w-3.5 h-3.5" /> Remove Panel
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" /> Allot Panel (Paint + Dent)
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 2: EXCLUSIVE DENTING */}
      {activeSection === 'DENTING' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Hammer className="w-4 h-4 text-orange-600" />
              Exclusive Denting & Structural Body Repair
            </h3>
            <p className="text-xs text-slate-500">Heavy panel pulling, frame straightening, and plastic welding repair work.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {dentingJobs.map(job => {
              const selected = isJobSelected(job.id);
              const price = isCars24 ? job.cars24Price : job.retailPrice;

              return (
                <div
                  key={job.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                    selected
                      ? 'bg-orange-50/90 dark:bg-orange-950/40 border-orange-500 ring-2 ring-orange-500/30'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-extrabold text-xs text-slate-900 dark:text-slate-100">{job.title}</h4>
                      <span className="font-black text-sm text-slate-900 dark:text-white">₹{price.toLocaleString()}</span>
                    </div>
                    {job.description && <p className="text-xs text-slate-500 mt-1">{job.description}</p>}
                    <div className="mt-2 text-[11px] font-bold text-orange-600">
                      Denter Payout: ₹{job.denterPayout || job.contractorPayout}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleStandardJob(job, denters[0]?.id)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      selected ? 'bg-rose-500 text-white' : 'bg-orange-600 hover:bg-orange-700 text-white'
                    }`}
                  >
                    {selected ? 'Remove Job' : 'Allot Denting Job'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 3: MECHANICAL */}
      {activeSection === 'MECHANICAL' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-blue-600" />
              Mechanical, Engine & Brake Services
            </h3>
            <p className="text-xs text-slate-500">Periodic maintenance, brake pads, clutch, suspension & AC service.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {mechanicalJobs.map(job => {
              const selected = isJobSelected(job.id);
              const price = isCars24 ? job.cars24Price : job.retailPrice;

              return (
                <div
                  key={job.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                    selected
                      ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/30'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-extrabold text-xs text-slate-900 dark:text-slate-100">{job.title}</h4>
                      <span className="font-black text-sm text-slate-900 dark:text-white">₹{price.toLocaleString()}</span>
                    </div>
                    {job.description && <p className="text-xs text-slate-500 mt-1">{job.description}</p>}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleStandardJob(job, mechanics[0]?.id)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      selected ? 'bg-rose-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {selected ? 'Remove Job' : 'Allot Mechanical Job'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 4: WASHING & SPA */}
      {activeSection === 'WASHING' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              Washing, Detailing & Spa
            </h3>
            <p className="text-xs text-slate-500">Foam wash, interior dry cleaning, teflon & ceramic polish.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {washingJobs.map(job => {
              const selected = isJobSelected(job.id);
              const price = isCars24 ? job.cars24Price : job.retailPrice;

              return (
                <div
                  key={job.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                    selected
                      ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/30'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-extrabold text-xs text-slate-900 dark:text-slate-100">{job.title}</h4>
                      <span className="font-black text-sm text-slate-900 dark:text-white">₹{price.toLocaleString()}</span>
                    </div>
                    {job.description && <p className="text-xs text-slate-500 mt-1">{job.description}</p>}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleStandardJob(job, employees[0]?.id)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      selected ? 'bg-rose-500 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {selected ? 'Remove Job' : 'Allot Washing Job'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 5: ACCESSORIES */}
      {activeSection === 'ACCESSORIES' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-pink-600" />
              Accessories & Upgrades (Seat Covers, Mats, Infotainment)
            </h3>
            <p className="text-xs text-slate-500">Custom seat covers, 7D floor mats, dashcams & Android stereo systems.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {accessoryJobs.map(job => {
              const selected = isJobSelected(job.id);
              const price = isCars24 ? job.cars24Price : job.retailPrice;

              return (
                <div
                  key={job.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                    selected
                      ? 'bg-pink-50/90 dark:bg-pink-950/40 border-pink-500 ring-2 ring-pink-500/30'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-extrabold text-xs text-slate-900 dark:text-slate-100">{job.title}</h4>
                      <span className="font-black text-sm text-slate-900 dark:text-white">₹{price.toLocaleString()}</span>
                    </div>
                    {job.description && <p className="text-xs text-slate-500 mt-1">{job.description}</p>}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleStandardJob(job, employees[0]?.id)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      selected ? 'bg-rose-500 text-white' : 'bg-pink-600 hover:bg-pink-700 text-white'
                    }`}
                  >
                    {selected ? 'Remove Job' : 'Allot Accessory Job'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 6: LATHE WORK */}
      {activeSection === 'LATHE_WORK' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Settings className="w-4 h-4 text-amber-600" />
              Lathe Work & Precision Machining (Sublet)
            </h3>
            <p className="text-xs text-slate-500">Brake disc skim turning, flywheel facing, axle turning & bearing pressing.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {latheJobs.map(job => {
              const selected = isJobSelected(job.id);
              const price = isCars24 ? job.cars24Price : job.retailPrice;

              return (
                <div
                  key={job.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                    selected
                      ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/30'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-extrabold text-xs text-slate-900 dark:text-slate-100">{job.title}</h4>
                      <span className="font-black text-sm text-slate-900 dark:text-white">₹{price.toLocaleString()}</span>
                    </div>
                    {job.description && <p className="text-xs text-slate-500 mt-1">{job.description}</p>}
                    <div className="mt-2 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                      Sublet Lathe Vendor Payout: ₹{job.contractorPayout}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleStandardJob(job, vendors[0]?.id)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      selected ? 'bg-rose-500 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'
                    }`}
                  >
                    {selected ? 'Remove Job' : 'Allot Lathe Job'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 7: ALIGNMENT & BALANCING */}
      {activeSection === 'ALIGNMENT' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Compass className="w-4 h-4 text-cyan-600" />
              3D Wheel Alignment & Dynamic Balancing
            </h3>
            <p className="text-xs text-slate-500">Laser sensor wheel alignment, steering recalibration & 4-wheel spin balancing.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {alignmentJobs.map(job => {
              const selected = isJobSelected(job.id);
              const price = isCars24 ? job.cars24Price : job.retailPrice;

              return (
                <div
                  key={job.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                    selected
                      ? 'bg-cyan-50/90 dark:bg-cyan-950/40 border-cyan-500 ring-2 ring-cyan-500/30'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-extrabold text-xs text-slate-900 dark:text-slate-100">{job.title}</h4>
                      <span className="font-black text-sm text-slate-900 dark:text-white">₹{price.toLocaleString()}</span>
                    </div>
                    {job.description && <p className="text-xs text-slate-500 mt-1">{job.description}</p>}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleStandardJob(job, mechanics[0]?.id)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      selected ? 'bg-rose-500 text-white' : 'bg-cyan-600 hover:bg-cyan-700 text-white'
                    }`}
                  >
                    {selected ? 'Remove Job' : 'Allot Alignment Job'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 8: TYRE WORK */}
      {activeSection === 'TYRE_WORK' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Disc className="w-4 h-4 text-rose-600" />
              Tyre Replacement & Puncture Repairs
            </h3>
            <p className="text-xs text-slate-500">Pneumatic tyre mounting, tubeless vulcanization puncture repair & rotation.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {tyreJobs.map(job => {
              const selected = isJobSelected(job.id);
              const price = isCars24 ? job.cars24Price : job.retailPrice;

              return (
                <div
                  key={job.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                    selected
                      ? 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-500 ring-2 ring-rose-500/30'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-extrabold text-xs text-slate-900 dark:text-slate-100">{job.title}</h4>
                      <span className="font-black text-sm text-slate-900 dark:text-white">₹{price.toLocaleString()}</span>
                    </div>
                    {job.description && <p className="text-xs text-slate-500 mt-1">{job.description}</p>}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleStandardJob(job, mechanics[0]?.id)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      selected ? 'bg-rose-500 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'
                    }`}
                  >
                    {selected ? 'Remove Job' : 'Allot Tyre Job'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
