import { JobCard, JobTask, PaintScope, TaskStatus, TaskCategory } from '../types';
import { PanelInspectionItem, VEHICLE_PANELS, PanelDefinition } from '../components/InteractiveVehicleInspectionChart';
import { 
  getVehiclePanels, 
  getStandardJobs, 
  updateJobCard, 
  deleteJobCardTask,
  updateTaskStatus,
  respondToCustomerApproval,
  reassignAllPaintTasksForJobCard,
  isCars24JobCard
} from '../lib/storage';
import { 
  matchTaskToPanelDef, 
  getPanelEnvironmentRates, 
  formatPaintTaskTitle 
} from '../lib/panelMappingHelper';

export type PaintScopeCategory = 'OUTER' | 'INSIDE' | 'BOTH';

/**
 * Classifies a paint scope into its core functional category.
 * A single vehicle panel can have outer paint, inside paint, or both!
 */
export function getPaintScopeCategory(scope?: PaintScope): PaintScopeCategory {
  if (scope === 'INSIDE_JAMB') return 'INSIDE';
  if (scope === 'FULL_OUTER_AND_INSIDE') return 'BOTH';
  return 'OUTER'; // 'FULL_OUTER' | 'PARTIAL_TOUCHUP' or default
}

export interface JobCardPanelState {
  card: JobCard;
  inspections: Record<string, PanelInspectionItem>;
  selectedPanelIds: string[];
  lastAction: string;
  timestamp: number;
}

/**
 * Pure function to derive visual 3D/AR inspections and selected panel IDs from a job card's tasks.
 * Properly recognizes that a single panel may have inside paint, outer paint, or both!
 */
export function deriveInspectionsFromTasks(tasks: JobTask[]): {
  inspections: Record<string, PanelInspectionItem>;
  selectedPanelIds: string[];
} {
  const inspections: Record<string, PanelInspectionItem> = {};
  const selectedPanelIdsSet = new Set<string>();

  (tasks || []).forEach(task => {
    if (task.category !== 'PAINT') return;
    const matchedDef = matchTaskToPanelDef(task);
    const panelId = matchedDef?.id || task.panelKey;
    if (!panelId) return;

    selectedPanelIdsSet.add(panelId);

    const existing = inspections[panelId];
    const currScope = task.paintScope || 'FULL_OUTER';

    // If a panel already has an inspection from another task, determine if it has both outer and inside paint!
    let effectiveScope: PaintScope = currScope;
    if (existing) {
      const prevScope = existing.paintScope;
      const prevCat = getPaintScopeCategory(prevScope);
      const currCat = getPaintScopeCategory(currScope);

      if (prevCat === 'BOTH' || currCat === 'BOTH' || (prevCat === 'OUTER' && currCat === 'INSIDE') || (prevCat === 'INSIDE' && currCat === 'OUTER')) {
        effectiveScope = 'FULL_OUTER_AND_INSIDE';
      } else {
        effectiveScope = currScope;
      }
    }

    inspections[panelId] = {
      panelId,
      nameEn: task.panelNameEn || matchedDef?.nameEn || task.title,
      nameHi: matchedDef?.nameHi || task.title,
      category: 'EXTERIOR_BODY',
      selected: true,
      paintScope: effectiveScope,
      painterName: task.assignedToName || existing?.painterName,
      denterName: task.pairedDenterName || existing?.denterName,
      customPrice: (existing?.customPrice || 0) + (task.customerPrice || 0),
      customPainterPayout: (existing?.customPainterPayout || 0) + (task.painterPayout || 0),
      customDenterPayout: (existing?.customDenterPayout || 0) + (task.denterPayout || 0)
    };
  });

  return {
    inspections,
    selectedPanelIds: Array.from(selectedPanelIdsSet)
  };
}

/**
 * Initializes state for the panel management reducer.
 */
export function initJobCardPanelState(card: JobCard): JobCardPanelState {
  const { inspections, selectedPanelIds } = deriveInspectionsFromTasks(card.tasks || []);
  return {
    card,
    inspections,
    selectedPanelIds,
    lastAction: 'INIT',
    timestamp: Date.now()
  };
}

export type JobCardPanelAction =
  | { type: 'SYNC_CARD'; payload: JobCard }
  | {
      type: 'ADD_OR_UPDATE_PANEL';
      payload: {
        panelId: string;
        scope?: PaintScope;
        customPrice?: number;
        customPainterPayout?: number;
        customDenterPayout?: number;
        isCars24?: boolean;
        painterId?: string;
        painterName?: string;
        denterId?: string;
        denterName?: string;
      };
    }
  | {
      type: 'REMOVE_PANEL';
      payload: {
        panelId: string;
        scopeCategory?: 'OUTER' | 'INSIDE' | 'ALL';
      };
    }
  | {
      type: 'BATCH_SYNC_INSPECTIONS';
      payload: {
        updatedInspections: Record<string, PanelInspectionItem>;
        isCars24?: boolean;
      };
    }
  | {
      type: 'DELETE_TASK';
      payload: {
        taskId: string;
      };
    }
  | {
      type: 'UPDATE_TASK_STATUS';
      payload: {
        taskId: string;
        status: TaskStatus;
      };
    }
  | {
      type: 'UPDATE_TASK';
      payload: {
        taskId: string;
        updates: Partial<JobTask>;
      };
    }
  | {
      type: 'RESPOND_APPROVAL';
      payload: {
        taskId: string;
        approved: boolean;
        declineReason?: string;
      };
    }
  | {
      type: 'BATCH_REASSIGN_PAINT';
      payload: {
        painterId?: string;
        painterName?: string;
        denterId?: string;
        denterName?: string;
      };
    }
  | {
      type: 'ADD_CUSTOM_TASKS';
      payload: {
        tasks: JobTask[];
        requiresCustomerApproval?: boolean;
      };
    };

/**
 * Centralized reducer for all panel, task, and job card operations.
 * Enforces pure immutability, prevents race conditions, and handles single panels having inside paint also.
 */
export function jobCardPanelReducer(
  state: JobCardPanelState,
  action: JobCardPanelAction
): JobCardPanelState {
  const currentCard = state.card;
  const currentTasks = currentCard.tasks || [];
  const isCars24 = isCars24JobCard(currentCard);
  const allKnownPanels = [...VEHICLE_PANELS, ...getVehiclePanels()];
  const freshJobs = getStandardJobs();

  switch (action.type) {
    case 'SYNC_CARD': {
      // Sync from outside if card ID matches and content changed
      if (action.payload.id !== currentCard.id) {
        return initJobCardPanelState(action.payload);
      }
      const { inspections, selectedPanelIds } = deriveInspectionsFromTasks(action.payload.tasks || []);
      return {
        ...state,
        card: action.payload,
        inspections,
        selectedPanelIds,
        lastAction: 'SYNC_CARD',
        timestamp: Date.now()
      };
    }

    case 'ADD_OR_UPDATE_PANEL': {
      const {
        panelId,
        scope = 'FULL_OUTER',
        customPrice,
        customPainterPayout,
        customDenterPayout,
        painterId,
        painterName,
        denterId,
        denterName
      } = action.payload;

      const panelDef = allKnownPanels.find(p => p.id === panelId);
      if (!panelDef) return state;

      const rates = getPanelEnvironmentRates(panelDef, freshJobs, isCars24, scope);
      const price = customPrice !== undefined ? customPrice : rates.price;
      const pPayout = customPainterPayout !== undefined ? customPainterPayout : rates.painterPayout;
      const dPayout = customDenterPayout !== undefined ? customDenterPayout : rates.denterPayout;
      const totalContractorPayout = pPayout + dPayout;
      const dynamicTitle = formatPaintTaskTitle(panelDef.nameEn, scope);
      const targetCategory = getPaintScopeCategory(scope);

      // Check existing paint tasks for this panel
      const existingPanelTasks = currentTasks.filter(t =>
        t.category === 'PAINT' && (
          (t.panelKey && t.panelKey.toLowerCase() === panelId.toLowerCase()) ||
          matchTaskToPanelDef(t)?.id === panelId
        )
      );

      let updatedTasks: JobTask[];

      if (targetCategory === 'BOTH') {
        // Combined scope: consolidate any existing tasks into a single FULL_OUTER_AND_INSIDE task
        const primary = existingPanelTasks[0];
        const combinedTask: JobTask = {
          id: primary?.id || `task-panel-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          jobCardId: currentCard.id,
          title: dynamicTitle,
          category: 'PAINT',
          panelKey: panelId,
          panelNameEn: panelDef.nameEn,
          paintScope: 'FULL_OUTER_AND_INSIDE',
          customerPrice: price,
          partPrice: 0,
          labourPrice: price,
          retailPrice: rates.retailPrice,
          cars24Price: rates.cars24Price,
          painterPayout: pPayout,
          denterPayout: dPayout,
          contractorPayout: totalContractorPayout,
          estimatedCost: totalContractorPayout,
          isContractBasis: true,
          status: primary?.status || 'PENDING',
          assignedToId: painterId || primary?.assignedToId,
          assignedToName: painterName || primary?.assignedToName,
          assignedType: primary?.assignedType || 'EMPLOYEE',
          pairedDenterId: denterId || primary?.pairedDenterId,
          pairedDenterName: denterName || primary?.pairedDenterName,
          requiresCustomerApproval: false
        };

        // Remove all old panel tasks and add the unified combined task
        const otherTasks = currentTasks.filter(t => !existingPanelTasks.some(ep => ep.id === t.id));
        updatedTasks = [...otherTasks, combinedTask];

      } else {
        // Individual scope (OUTER or INSIDE)
        // Find existing task with the SAME scope category on this panel
        const sameCategoryTask = existingPanelTasks.find(t => getPaintScopeCategory(t.paintScope) === targetCategory);

        if (sameCategoryTask) {
          // Update the matching scope task
          updatedTasks = currentTasks.map(t => {
            if (t.id === sameCategoryTask.id) {
              return {
                ...t,
                title: dynamicTitle,
                paintScope: scope,
                customerPrice: price,
                painterPayout: pPayout,
                denterPayout: dPayout,
                contractorPayout: totalContractorPayout,
                estimatedCost: totalContractorPayout,
                panelKey: panelId,
                panelNameEn: panelDef.nameEn,
                assignedToId: painterId || t.assignedToId,
                assignedToName: painterName || t.assignedToName,
                pairedDenterId: denterId || t.pairedDenterId,
                pairedDenterName: denterName || t.pairedDenterName
              };
            }
            return t;
          });
        } else {
          // If panel has a FULL_OUTER_AND_INSIDE task, we can keep or adjust it.
          // Otherwise, CREATE a new task for this scope category!
          // This allows an INSIDE paint task and an OUTER paint task to happily co-exist on the same panel!
          const newTask: JobTask = {
            id: `task-panel-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            jobCardId: currentCard.id,
            title: dynamicTitle,
            category: 'PAINT',
            panelKey: panelId,
            panelNameEn: panelDef.nameEn,
            paintScope: scope,
            customerPrice: price,
            partPrice: 0,
            labourPrice: price,
            retailPrice: rates.retailPrice,
            cars24Price: rates.cars24Price,
            painterPayout: pPayout,
            denterPayout: dPayout,
            contractorPayout: totalContractorPayout,
            estimatedCost: totalContractorPayout,
            isContractBasis: true,
            status: 'PENDING',
            assignedToId: painterId || existingPanelTasks[0]?.assignedToId,
            assignedToName: painterName || existingPanelTasks[0]?.assignedToName,
            assignedType: existingPanelTasks[0]?.assignedType || 'EMPLOYEE',
            pairedDenterId: denterId || existingPanelTasks[0]?.pairedDenterId,
            pairedDenterName: denterName || existingPanelTasks[0]?.pairedDenterName,
            requiresCustomerApproval: false
          };

          updatedTasks = [...currentTasks, newTask];
        }
      }

      const updatedCard = { ...currentCard, tasks: updatedTasks };
      updateJobCard(updatedCard.id, () => updatedCard);
      const { inspections, selectedPanelIds } = deriveInspectionsFromTasks(updatedTasks);

      return {
        card: updatedCard,
        inspections,
        selectedPanelIds,
        lastAction: 'ADD_OR_UPDATE_PANEL',
        timestamp: Date.now()
      };
    }

    case 'REMOVE_PANEL': {
      const { panelId, scopeCategory = 'ALL' } = action.payload;

      const updatedTasks = currentTasks.filter(t => {
        if (t.category !== 'PAINT') return true;
        const matchesPanel = (t.panelKey && t.panelKey.toLowerCase() === panelId.toLowerCase()) ||
                             matchTaskToPanelDef(t)?.id === panelId;
        if (!matchesPanel) return true;

        if (scopeCategory === 'ALL') {
          return false; // Remove all tasks for this panel
        }

        const taskCat = getPaintScopeCategory(t.paintScope);
        if (taskCat === scopeCategory) {
          return false; // Remove only the specified scope category (e.g. only INSIDE or only OUTER)
        }

        return true; // Keep companion tasks (e.g. inside paint if outer was removed)
      });

      const updatedCard = { ...currentCard, tasks: updatedTasks };
      updateJobCard(updatedCard.id, () => updatedCard);
      const { inspections, selectedPanelIds } = deriveInspectionsFromTasks(updatedTasks);

      return {
        card: updatedCard,
        inspections,
        selectedPanelIds,
        lastAction: 'REMOVE_PANEL',
        timestamp: Date.now()
      };
    }

    case 'BATCH_SYNC_INSPECTIONS': {
      const { updatedInspections } = action.payload;
      let workingTasks = [...currentTasks];

      Object.keys(updatedInspections).forEach(panelId => {
        const inspection = updatedInspections[panelId];
        const panelDef = allKnownPanels.find(p => p.id === panelId);
        if (!panelDef) return;

        const matchingTasks = workingTasks.filter(t =>
          t.category === 'PAINT' && (
            (t.panelKey && t.panelKey.toLowerCase() === panelId.toLowerCase()) ||
            matchTaskToPanelDef(t)?.id === panelId
          )
        );

        if (!inspection.selected) {
          // Remove all tasks for deselected panel
          workingTasks = workingTasks.filter(t => !matchingTasks.some(mt => mt.id === t.id));
          return;
        }

        const scope = inspection.paintScope || 'FULL_OUTER';
        const rates = getPanelEnvironmentRates(panelDef, freshJobs, isCars24, scope);
        const price = inspection.customPrice !== undefined ? inspection.customPrice : rates.price;
        const painterPayout = inspection.customPainterPayout !== undefined ? inspection.customPainterPayout : rates.painterPayout;
        const denterPayout = inspection.customDenterPayout !== undefined ? inspection.customDenterPayout : rates.denterPayout;
        const totalContractorPayout = painterPayout + denterPayout;
        const dynamicTitle = formatPaintTaskTitle(panelDef.nameEn, scope);
        const targetCategory = getPaintScopeCategory(scope);

        if (targetCategory === 'BOTH') {
          const primary = matchingTasks[0];
          const unifiedTask: JobTask = {
            id: primary?.id || `task-panel-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            jobCardId: currentCard.id,
            title: dynamicTitle,
            category: 'PAINT',
            panelKey: panelId,
            panelNameEn: panelDef.nameEn,
            paintScope: 'FULL_OUTER_AND_INSIDE',
            customerPrice: price,
            partPrice: 0,
            labourPrice: price,
            retailPrice: rates.retailPrice,
            cars24Price: rates.cars24Price,
            painterPayout,
            denterPayout,
            contractorPayout: totalContractorPayout,
            estimatedCost: totalContractorPayout,
            isContractBasis: true,
            status: primary?.status || 'PENDING',
            assignedToId: primary?.assignedToId,
            assignedToName: primary?.assignedToName,
            assignedType: primary?.assignedType || 'EMPLOYEE',
            pairedDenterId: primary?.pairedDenterId,
            pairedDenterName: primary?.pairedDenterName,
            requiresCustomerApproval: false
          };

          workingTasks = workingTasks.filter(t => !matchingTasks.some(mt => mt.id === t.id));
          workingTasks.push(unifiedTask);

        } else {
          const sameCatTask = matchingTasks.find(t => getPaintScopeCategory(t.paintScope) === targetCategory);

          if (sameCatTask) {
            workingTasks = workingTasks.map(t => {
              if (t.id === sameCatTask.id) {
                return {
                  ...t,
                  title: dynamicTitle,
                  paintScope: scope,
                  customerPrice: price,
                  painterPayout,
                  denterPayout,
                  contractorPayout: totalContractorPayout,
                  estimatedCost: totalContractorPayout,
                  panelKey: panelId,
                  panelNameEn: panelDef.nameEn
                };
              }
              return t;
            });
          } else {
            // New companion task (e.g. inside paint added while outer paint already exists)
            const newTask: JobTask = {
              id: `task-panel-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              jobCardId: currentCard.id,
              title: dynamicTitle,
              category: 'PAINT',
              panelKey: panelId,
              panelNameEn: panelDef.nameEn,
              paintScope: scope,
              customerPrice: price,
              partPrice: 0,
              labourPrice: price,
              retailPrice: rates.retailPrice,
              cars24Price: rates.cars24Price,
              painterPayout,
              denterPayout,
              contractorPayout: totalContractorPayout,
              estimatedCost: totalContractorPayout,
              isContractBasis: true,
              status: 'PENDING',
              assignedToId: matchingTasks[0]?.assignedToId,
              assignedToName: matchingTasks[0]?.assignedToName,
              assignedType: matchingTasks[0]?.assignedType || 'EMPLOYEE',
              pairedDenterId: matchingTasks[0]?.pairedDenterId,
              pairedDenterName: matchingTasks[0]?.pairedDenterName,
              requiresCustomerApproval: false
            };
            workingTasks.push(newTask);
          }
        }
      });

      const updatedCard = { ...currentCard, tasks: workingTasks };
      updateJobCard(updatedCard.id, () => updatedCard);
      const { inspections, selectedPanelIds } = deriveInspectionsFromTasks(workingTasks);

      return {
        card: updatedCard,
        inspections,
        selectedPanelIds,
        lastAction: 'BATCH_SYNC_INSPECTIONS',
        timestamp: Date.now()
      };
    }

    case 'DELETE_TASK': {
      const { taskId } = action.payload;
      const target = currentTasks.find(t => t.id === taskId);
      const targetPanelKey = target?.category === 'PAINT' ? target.panelKey : undefined;
      const targetIsInside = target?.paintScope === 'INSIDE_JAMB';

      const updatedTasks = currentTasks.filter(task => {
        if (task.id === taskId) return false;
        // If it's a true duplicate of the SAME scope category on the SAME panel, remove duplicate
        if (targetPanelKey && task.category === 'PAINT' && task.panelKey && task.panelKey.toLowerCase() === targetPanelKey.toLowerCase()) {
          const taskIsInside = task.paintScope === 'INSIDE_JAMB';
          if (targetIsInside === taskIsInside) {
            return false;
          }
        }
        return true;
      });

      deleteJobCardTask(currentCard.id, taskId);
      const updatedCard = { ...currentCard, tasks: updatedTasks };
      const { inspections, selectedPanelIds } = deriveInspectionsFromTasks(updatedTasks);

      return {
        card: updatedCard,
        inspections,
        selectedPanelIds,
        lastAction: 'DELETE_TASK',
        timestamp: Date.now()
      };
    }

    case 'UPDATE_TASK_STATUS': {
      const { taskId, status } = action.payload;
      const updatedTasks = currentTasks.map(t => {
        if (t.id === taskId) {
          return { ...t, status };
        }
        return t;
      });

      updateTaskStatus(currentCard.id, taskId, status);
      const updatedCard = { ...currentCard, tasks: updatedTasks };
      const { inspections, selectedPanelIds } = deriveInspectionsFromTasks(updatedTasks);

      return {
        card: updatedCard,
        inspections,
        selectedPanelIds,
        lastAction: 'UPDATE_TASK_STATUS',
        timestamp: Date.now()
      };
    }

    case 'UPDATE_TASK': {
      const { taskId, updates } = action.payload;
      const updatedTasks = currentTasks.map(t => {
        if (t.id === taskId) {
          return { ...t, ...updates };
        }
        return t;
      });

      const updatedCard = { ...currentCard, tasks: updatedTasks };
      updateJobCard(updatedCard.id, () => updatedCard);
      const { inspections, selectedPanelIds } = deriveInspectionsFromTasks(updatedTasks);

      return {
        card: updatedCard,
        inspections,
        selectedPanelIds,
        lastAction: 'UPDATE_TASK',
        timestamp: Date.now()
      };
    }

    case 'RESPOND_APPROVAL': {
      const { taskId, approved, declineReason } = action.payload;
      const updatedTasks = currentTasks.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            isCustomerApproved: approved,
            approvalStatus: approved ? ('APPROVED' as const) : ('REJECTED' as const),
            approvalNotes: declineReason || (approved ? 'Approved by Customer' : 'Declined by Customer')
          };
        }
        return t;
      });

      respondToCustomerApproval(currentCard.id, taskId, approved, declineReason);
      const updatedCard = { ...currentCard, tasks: updatedTasks };
      const { inspections, selectedPanelIds } = deriveInspectionsFromTasks(updatedTasks);

      return {
        card: updatedCard,
        inspections,
        selectedPanelIds,
        lastAction: 'RESPOND_APPROVAL',
        timestamp: Date.now()
      };
    }

    case 'BATCH_REASSIGN_PAINT': {
      const { painterId, painterName, denterId, denterName } = action.payload;
      const updatedTasks = currentTasks.map(t => {
        if (t.category === 'PAINT') {
          return {
            ...t,
            assignedToId: painterId || t.assignedToId,
            assignedToName: painterName || t.assignedToName,
            pairedDenterId: denterId || t.pairedDenterId,
            pairedDenterName: denterName || t.pairedDenterName
          };
        }
        return t;
      });

      reassignAllPaintTasksForJobCard(currentCard.id, painterId, painterName, denterId, denterName);
      const updatedCard = { ...currentCard, tasks: updatedTasks };
      const { inspections, selectedPanelIds } = deriveInspectionsFromTasks(updatedTasks);

      return {
        card: updatedCard,
        inspections,
        selectedPanelIds,
        lastAction: 'BATCH_REASSIGN_PAINT',
        timestamp: Date.now()
      };
    }

    case 'ADD_CUSTOM_TASKS': {
      const { tasks: newTasksList, requiresCustomerApproval } = action.payload;
      const updatedTasks = [...currentTasks, ...newTasksList];
      const newStatus = requiresCustomerApproval ? 'ESTIMATE_PENDING' : currentCard.status;

      const updatedCard: JobCard = {
        ...currentCard,
        tasks: updatedTasks,
        status: newStatus
      };

      updateJobCard(updatedCard.id, () => updatedCard);
      const { inspections, selectedPanelIds } = deriveInspectionsFromTasks(updatedTasks);

      return {
        card: updatedCard,
        inspections,
        selectedPanelIds,
        lastAction: 'ADD_CUSTOM_TASKS',
        timestamp: Date.now()
      };
    }

    default:
      return state;
  }
}
