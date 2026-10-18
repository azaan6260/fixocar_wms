import {
  JobCard,
  JobTask,
  TaskCategory,
  TaskPartItem,
  TaskRequisition,
  VehicleCheckIn,
  FuelType,
  UserRole,
} from '../types';
import {
  getJobCards,
  createJobCard,
  updateJobCard,
  createVehicleCheckIn,
  updateVehicleCheckIn,
  getVehicleCheckIns,
  getAllEmployees,
  getStandardJobs,
  getInventoryItems,
  getCarModels,
  getWorkshops,
  getCities,
  getAuthUser,
  addJobCardComment,
  dispatchToastNotification,
} from './storage';

export interface WorkshopLearnedRule {
  id: string;
  triggerKeyword: string; // e.g. "Hyundai Creta - Front Bumper", "Cars24 Baleno", "Full Body Paint"
  instruction: string;
  defaultParts: string[];
  videoCheckPrompt?: string;
  createdBy: string;
  createdAt: string;
}

export interface AgentSessionAccess {
  userId: string;
  employeeId: string;
  userName: string;
  role: UserRole;
  workshopId?: string;
  isManagementRole: boolean;
  canCreateJobCard: boolean;
  canEditOrDeleteTasks: boolean;
  canAllotTechnicians: boolean;
  canViewFinancialsAndRates: boolean;
  canViewFullWorkshopData: boolean;
  canManageLearningRules: boolean;
  canApprovePurchaseOrders: boolean;
  canCheckInGateVehicle: boolean;
  canUpdateOwnTaskStatusAndVideo: boolean;
  scopeDescription: string;
}

/**
 * Resolves the exact Role-Based Access Control (RBAC) permissions and database scope
 * for the currently logged-in account.
 */
export function resolveAgentSessionAccess(roleOverride?: UserRole): AgentSessionAccess {
  const authUser = getAuthUser();
  const effectiveRole: UserRole = roleOverride || authUser?.role || 'MECHANIC';
  const isManagementRole =
    effectiveRole === 'SUPER_ADMIN' ||
    effectiveRole === 'ADMIN' ||
    effectiveRole === 'SERVICE_ADVISOR' ||
    effectiveRole === 'FLOOR_MANAGER';

  const allEmps = getAllEmployees();
  // Match employee profile if logged in as staff or simulated role
  let matchedEmployee = allEmps.find(
    (e) =>
      (authUser?.employeeId && e.id === authUser.employeeId) ||
      (authUser?.id && e.id === authUser.id) ||
      (authUser?.name && e.name.toLowerCase() === authUser.name.toLowerCase())
  );

  if (!matchedEmployee && !isManagementRole) {
    matchedEmployee = allEmps.find((e) => e.role === effectiveRole);
  }

  const userName =
    authUser && (!roleOverride || authUser.role === roleOverride)
      ? authUser.name
      : matchedEmployee?.name || `${effectiveRole} Staff`;
  const employeeId = matchedEmployee?.id || authUser?.employeeId || authUser?.id || '';

  return {
    userId: authUser?.id || employeeId || 'anon',
    employeeId,
    userName,
    role: effectiveRole,
    workshopId: authUser?.workshopId || matchedEmployee?.workshopId,
    isManagementRole,
    canCreateJobCard: isManagementRole,
    canEditOrDeleteTasks: isManagementRole,
    canAllotTechnicians: isManagementRole,
    canViewFinancialsAndRates: isManagementRole,
    canViewFullWorkshopData: isManagementRole,
    canManageLearningRules:
      effectiveRole === 'SUPER_ADMIN' || effectiveRole === 'ADMIN' || effectiveRole === 'FLOOR_MANAGER',
    canApprovePurchaseOrders: isManagementRole,
    canCheckInGateVehicle:
      isManagementRole || effectiveRole === 'DELIVERY_BOY',
    canUpdateOwnTaskStatusAndVideo: true,
    scopeDescription: isManagementRole
      ? `Full Workshop Database Access (${effectiveRole}) — Can Create Job Cards, Edit/Delete Tasks, Allot Staff & View Billing Rates`
      : `Account-Scoped Access (${userName} • ${effectiveRole}) — Restricted to Your Allotted Vehicles & Tasks Only (Job Card Creation & Task Edit/Delete Locked)`,
  };
}

/**
 * Checks whether a specific task is allotted to the logged-in employee account.
 */
export function isTaskAllottedToEmployee(task: JobTask, access: AgentSessionAccess): boolean {
  if (access.canViewFullWorkshopData) return true;
  const empId = (access.employeeId || '').toLowerCase().trim();
  const empName = (access.userName || '').toLowerCase().trim();

  const idsOnTask = [
    task.assignedToId,
    task.pairedDenterId,
    (task as any).assignedPainterId,
    (task as any).assignedDenterId,
    (task as any).assignedEmployeeId,
    task.outsourcedVendorId,
  ]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase().trim());

  const namesOnTask = [
    task.assignedToName,
    task.pairedDenterName,
    (task as any).assignedPainterName,
    (task as any).assignedDenterName,
    (task as any).assignedEmployeeName,
    task.outsourcedVendorName,
  ]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase().trim());

  if (empId && idsOnTask.includes(empId)) return true;
  if (empName && namesOnTask.some((n) => n.includes(empName) || empName.includes(n))) return true;

  // Also match by role category if demo role-switcher is used and employee name matches role default
  return false;
}

/**
 * Fetches active Job Cards scoped strictly to the logged-in user's database access permissions:
 * - Admin / Floor Manager / Service Advisor: All active Job Cards with full task & financial details.
 * - Employee (Painter, Denter, Mechanic, Delivery, Vendor): ONLY Job Cards & Tasks allotted to their account,
 *   with customer billing rates masked out.
 */
export function getScopedJobCardsForAgent(roleOverride?: UserRole): {
  access: AgentSessionAccess;
  cards: JobCard[];
} {
  const access = resolveAgentSessionAccess(roleOverride);
  const allActive = getJobCards().filter((c) => c.status !== 'DELIVERED' && c.status !== 'CLOSED');

  if (access.canViewFullWorkshopData) {
    return { access, cards: allActive };
  }

  // Filter strictly to vehicles & tasks allotted to this employee
  const scopedCards: JobCard[] = [];
  allActive.forEach((card) => {
    const myTasks = (card.tasks || []).filter((t) => isTaskAllottedToEmployee(t, access));
    const isCardAssignedToMe =
      (access.employeeId &&
        (card.assignedAdvisorId === access.employeeId ||
          card.assignedManagerId === access.employeeId ||
          card.floorManagerId === access.employeeId)) ||
      myTasks.length > 0;

    if (isCardAssignedToMe) {
      // Mask customer billing rates for non-management employees
      const sanitizedTasks = (myTasks.length > 0 ? myTasks : card.tasks).map((t) => ({
        ...t,
        customerPrice: 0, // Hidden from non-management employees
      }));

      scopedCards.push({
        ...card,
        tasks: sanitizedTasks,
      });
    }
  });

  return { access, cards: scopedCards };
}

/**
 * Detects if a non-management employee is attempting a forbidden mutation in chat
 * (e.g., creating a job card, deleting/editing a task, changing prices/rates, or re-allotting staff).
 */
export function detectForbiddenEmployeeMutationIntent(
  message: string,
  access: AgentSessionAccess
): string | null {
  if (access.isManagementRole) return null;
  const low = message.toLowerCase();

  const wantsToDeleteOrEditTask =
    (low.includes('delete') ||
      low.includes('remove') ||
      low.includes('edit') ||
      low.includes('change') ||
      low.includes('modify') ||
      low.includes('update price') ||
      low.includes('update rate')) &&
    (low.includes('task') ||
      low.includes('job') ||
      low.includes('panel') ||
      low.includes('price') ||
      low.includes('rate') ||
      low.includes('billing') ||
      low.includes('card'));

  const wantsToCreateJobCard =
    (low.includes('create') || low.includes('new') || low.includes('make') || low.includes('generate')) &&
    (low.includes('job card') || low.includes('jobcard') || low.includes('work order'));

  const wantsToReallot =
    (low.includes('allot') || low.includes('assign') || low.includes('reassign')) &&
    (low.includes('painter') || low.includes('denter') || low.includes('mechanic') || low.includes('task'));

  const wantsTeachGlobalRule = low.startsWith('teach:') || low.startsWith('remember:');

  if (wantsToDeleteOrEditTask || wantsToCreateJobCard || wantsToReallot || wantsTeachGlobalRule) {
    return `🔒 **Role-Based Access Restriction (${access.userName} • ${access.role})**:\nYour employee account does **not** have permission to **create a Job Card**, **edit or delete tasks**, **modify rates/prices**, or **change staff allotments** (these actions are restricted to **Admin** and **Floor Manager** accounts).\n\n✅ **What you CAN do from your ${access.role} AI Agent**:\n• View only the **vehicles and tasks allotted to your account (${access.userName})**\n• Check **required spare parts & consumables** for your allotted vehicles\n• View **Inspection Video Checklists** required for additional jobs on your cars\n• Snap a vehicle photo to identify Make/Model or check your bay queue`;
  }

  return null;
}

export interface AIVehiclePhotoAnalysis {
  detected: boolean;
  plateNumber: string;
  make: string;
  model: string;
  variant?: string;
  year?: number;
  color?: string;
  fuelType?: string;
  bodyType?: string;
  visibleDamages: string[];
  suggestedTasks: {
    title: string;
    category: string;
    panelKey?: string;
    panelNameEn?: string;
    customerPrice: number;
    painterPayout?: number;
    denterPayout?: number;
  }[];
  suggestedParts: {
    name: string;
    quantity: number;
    unitPrice: number;
    partNumber?: string;
  }[];
  employeeVideoPrompts: string[];
  confidence?: string;
  summary: string;
}

export interface AIParsedJobCardPayload {
  isCars24: boolean;
  cars24RefNo?: string;
  workOrderNo?: string;
  registrationNumber: string;
  make: string;
  model: string;
  variant?: string;
  year?: number;
  color?: string;
  fuelType?: string;
  mileage?: number;
  fuelLevel?: number;
  customerName?: string;
  customerPhone?: string;
  workOrderSummary: string;
  tasks: {
    title: string;
    category: string;
    panelKey?: string;
    panelNameEn?: string;
    paintScope?: string;
    customerPrice: number;
    estimatedCost?: number;
    painterPayout?: number;
    denterPayout?: number;
    requiresCustomerApproval?: boolean;
  }[];
  requiredParts: {
    name: string;
    quantity: number;
    unitPrice: number;
    partNumber?: string;
    category?: string;
  }[];
  employeeVideoPrompts: string[];
}

export interface VehiclePaintSummaryItem {
  jobCardId: string;
  registrationNumber: string;
  vehicleLabel: string;
  color: string;
  isCars24: boolean;
  painterName: string;
  denterName: string;
  panels: {
    taskId: string;
    title: string;
    panelName: string;
    paintScope: string;
    status: string;
    customerPrice: number;
    painterPayout: number;
    denterPayout: number;
  }[];
  totalCustomerPrice: number;
  totalPainterPayout: number;
  totalDenterPayout: number;
}

export interface PaintJobsReport {
  vehicles: VehiclePaintSummaryItem[];
  totalVehicles: number;
  totalPanels: number;
  totalPaintBilling: number;
  totalPainterPayout: number;
  totalDenterPayout: number;
  copyableText: string;
}

export interface VehiclePurchaseItem {
  partName: string;
  partNumber: string;
  category: string;
  quantityNeeded: number;
  inStockQty: number;
  netToOrderQty: number;
  unitCost: number;
  totalEstimatedCost: number;
  sourceTaskTitle: string;
  requisitionStatus?: string;
}

export interface VehiclePartsPurchaseGroup {
  jobCardId: string;
  registrationNumber: string;
  vehicleLabel: string;
  isCars24: boolean;
  priorityLabel: string;
  items: VehiclePurchaseItem[];
  vehicleTotalPurchaseCost: number;
}

export interface ConsolidatedDailyPurchaseItem {
  partKey: string;
  partName: string;
  partNumber: string;
  category: string;
  totalQuantityNeeded: number;
  inStockQty: number;
  netQuantityToBuy: number;
  unitCost: number;
  totalPurchaseCost: number;
  vehiclesUsing: { regNo: string; model: string; qty: number; jobCardId: string }[];
}

export interface DailyPurchaseReport {
  dateStr: string;
  vehicleGroups: VehiclePartsPurchaseGroup[];
  consolidatedItems: ConsolidatedDailyPurchaseItem[];
  grandTotalEstimatedCost: number;
  totalUniquePartsToBuy: number;
  copyableText: string;
}

export interface AIChatMessage {
  id: string;
  sender: 'USER' | 'AI';
  timestamp: string;
  text: string;
  attachmentPreviewUrl?: string;
  attachmentName?: string;
  attachmentType?: 'IMAGE' | 'PDF';
  vehicleAnalysis?: AIVehiclePhotoAnalysis;
  parsedPdfJobCard?: AIParsedJobCardPayload;
  createdJobCardId?: string;
  createdCheckInId?: string;
  paintReport?: PaintJobsReport;
  purchaseReport?: DailyPurchaseReport;
  learnedRule?: WorkshopLearnedRule;
  followUpPrompts?: string[];
}

const LEARNED_RULES_STORAGE_KEY = 'fixocar_ai_learned_rules_v1';
const AI_CHAT_HISTORY_STORAGE_KEY = 'fixocar_ai_chat_history_v1';

const DEFAULT_LEARNED_RULES: WorkshopLearnedRule[] = [
  {
    id: 'rule-seed-1',
    triggerKeyword: 'Front Bumper / Fender Impact',
    instruction: 'Whenever Front Bumper or Front Fender dent/paint is added, instruct Denter & Mechanic to inspect Headlight Mounting Brackets, Radiator Core Support & AC Condenser, and include Bumper Retainer Clips in the parts list.',
    defaultParts: ['Front Bumper Side Retainer Clips Set', 'Headlight Mounting Repair Bracket Kit'],
    videoCheckPrompt: 'Record a 15-sec video behind the Front Bumper showing Headlight Mounting Tabs, Radiator Support & Fog Lamp wiring before assembly.',
    createdBy: 'Workshop Admin',
    createdAt: '2026-10-15',
  },
  {
    id: 'rule-seed-2',
    triggerKeyword: 'Cars24 Periodic Service (>40,000 km)',
    instruction: 'For Cars24 vehicles with mileage above 40,000 km, automatically check Front Lower Arm Bushes, Stabilizer Link Rods, and Front Brake Pad thickness.',
    defaultParts: ['Synthetic Engine Oil (3.5L)', 'OEM Oil Filter & Air Filter Combo', 'Front Disc Brake Pad Set'],
    videoCheckPrompt: 'Record a short underbody video on the 2-post lift showing Front Lower Arm Bushes, Link Rods & Brake Disc thickness.',
    createdBy: 'Workshop Admin',
    createdAt: '2026-10-16',
  },
  {
    id: 'rule-seed-3',
    triggerKeyword: 'Multi-Panel Dent & Paint (3+ Panels)',
    instruction: 'When 3 or more body panels are scheduled for paint on the same car, allot a single Painter + Denter pair for color-match consistency and add 2K Primer, Basecoat & Clearcoat consumables.',
    defaultParts: ['2K Polyurethane Clearcoat & Hardener (1L)', 'High-Build Epoxy Primer & Putty Kit', 'Rubbing Compound & 3M Masking Roll'],
    videoCheckPrompt: 'Record a walkaround video after primer/sanding stage and final booth gloss finish check.',
    createdBy: 'Floor Manager',
    createdAt: '2026-10-17',
  },
];

export function getLearnedWorkshopRules(): WorkshopLearnedRule[] {
  try {
    const raw = window.localStorage.getItem(LEARNED_RULES_STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(LEARNED_RULES_STORAGE_KEY, JSON.stringify(DEFAULT_LEARNED_RULES));
      return DEFAULT_LEARNED_RULES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_LEARNED_RULES;
  } catch {
    return DEFAULT_LEARNED_RULES;
  }
}

export function saveLearnedWorkshopRule(
  rule: Omit<WorkshopLearnedRule, 'id' | 'createdAt' | 'createdBy'>,
  roleOverride?: UserRole
): WorkshopLearnedRule {
  const access = resolveAgentSessionAccess(roleOverride);
  if (!access.canManageLearningRules) {
    throw new Error(
      `Access Denied (${access.role}): Only Admin or Floor Manager accounts can add or modify Workshop AI Learning Rules.`
    );
  }
  const existing = getLearnedWorkshopRules();
  const newRule: WorkshopLearnedRule = {
    id: `rule-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    triggerKeyword: rule.triggerKeyword.trim() || 'Workshop Standard Rule',
    instruction: rule.instruction.trim(),
    defaultParts: Array.isArray(rule.defaultParts) ? rule.defaultParts : [],
    videoCheckPrompt: rule.videoCheckPrompt?.trim(),
    createdBy: `${access.userName} (${access.role})`,
    createdAt: new Date().toISOString().split('T')[0],
  };
  const updated = [newRule, ...existing];
  try {
    window.localStorage.setItem(LEARNED_RULES_STORAGE_KEY, JSON.stringify(updated));
  } catch {}
  return newRule;
}

export function deleteLearnedWorkshopRule(id: string, roleOverride?: UserRole): WorkshopLearnedRule[] {
  const access = resolveAgentSessionAccess(roleOverride);
  if (!access.canManageLearningRules) {
    dispatchToastNotification({
      type: 'WARNING',
      title: 'Role Restriction',
      message: 'Only Admin or Floor Manager accounts can delete Workshop AI Learning Rules.',
    });
    return getLearnedWorkshopRules();
  }
  const updated = getLearnedWorkshopRules().filter((r) => r.id !== id);
  try {
    window.localStorage.setItem(LEARNED_RULES_STORAGE_KEY, JSON.stringify(updated));
  } catch {}
  return updated;
}

export function getSavedAIChatHistory(): AIChatMessage[] {
  try {
    const raw = window.localStorage.getItem(AI_CHAT_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAIChatHistory(messages: AIChatMessage[]): void {
  try {
    // Keep last 40 messages and strip huge base64 strings to keep storage fast
    const trimmed = messages.slice(-40).map((m) => ({
      ...m,
      attachmentPreviewUrl:
        m.attachmentPreviewUrl && m.attachmentPreviewUrl.length > 80000
          ? undefined
          : m.attachmentPreviewUrl,
    }));
    window.localStorage.setItem(AI_CHAT_HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {}
}

/**
 * Selects the best available Painter, Denter, and Mechanic based on lowest active workload.
 */
export function selectOptimalWorkshopTechnicians() {
  const allEmployees = getAllEmployees();
  const activeCards = getJobCards().filter((c) => c.status !== 'DELIVERED' && c.status !== 'CLOSED');

  const countActiveTasksFor = (empId: string, empName: string) => {
    let count = 0;
    const nameLow = empName.toLowerCase();
    activeCards.forEach((c) => {
      c.tasks.forEach((t) => {
        if (t.status === 'COMPLETED') return;
        if (
          t.assignedToId === empId ||
          t.pairedDenterId === empId ||
          (t as any).assignedPainterId === empId ||
          (t as any).assignedDenterId === empId ||
          (t as any).assignedEmployeeId === empId ||
          t.assignedToName?.toLowerCase() === nameLow ||
          t.pairedDenterName?.toLowerCase() === nameLow ||
          (t as any).assignedPainterName?.toLowerCase() === nameLow ||
          (t as any).assignedDenterName?.toLowerCase() === nameLow
        ) {
          count += 1;
        }
      });
    });
    return count;
  };

  const painters = allEmployees
    .filter((e) => e.role === 'PAINTER' || e.specializedTeam === 'Paint')
    .sort((a, b) => countActiveTasksFor(a.id, a.name) - countActiveTasksFor(b.id, b.name));

  const denters = allEmployees
    .filter((e) => e.role === 'DENTER' || e.specializedTeam === 'Denting')
    .sort((a, b) => countActiveTasksFor(a.id, a.name) - countActiveTasksFor(b.id, b.name));

  const mechanics = allEmployees
    .filter((e) => e.role === 'MECHANIC' || e.specializedTeam === 'Mechanical')
    .sort((a, b) => countActiveTasksFor(a.id, a.name) - countActiveTasksFor(b.id, b.name));

  const floorManagers = allEmployees.filter((e) => e.role === 'FLOOR_MANAGER');

  return {
    painter: painters[0] || allEmployees[0],
    denter: denters[0] || allEmployees[0],
    mechanic: mechanics[0] || allEmployees[0],
    floorManager: floorManagers[0] || allEmployees[0],
  };
}

/**
 * 1. Generate a clean, one-click copyable Paint Jobs List scoped to the logged-in user's role:
 * - Admin / Manager: All active vehicles & paint panels with customer billing & contractor payouts.
 * - Employee (Painter / Denter): ONLY vehicles & paint/dent panels allotted to their account, with customer billing hidden.
 */
export function generateCopyablePaintJobsSummary(
  vehicleFilterQuery?: string,
  roleOverride?: UserRole
): PaintJobsReport {
  const { access, cards: activeCards } = getScopedJobCardsForAgent(roleOverride);
  const q = (vehicleFilterQuery || '').trim().toLowerCase();

  const matchingCards = q
    ? activeCards.filter(
        (c) =>
          c.vehicle.registrationNumber.toLowerCase().includes(q) ||
          c.vehicle.make.toLowerCase().includes(q) ||
          c.vehicle.model.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q)
      )
    : activeCards;

  const vehicles: VehiclePaintSummaryItem[] = [];
  let totalPanels = 0;
  let totalPaintBilling = 0;
  let totalPainterPayout = 0;
  let totalDenterPayout = 0;

  matchingCards.forEach((card) => {
    const paintAndDentTasks = card.tasks.filter(
      (t) => t.category === 'PAINT' || (t.category === 'DENTING' && !t.title.includes('Pre-Denting'))
    );
    if (paintAndDentTasks.length === 0) return;

    let painterName = 'Unassigned Painter';
    let denterName = 'Unassigned Denter';

    paintAndDentTasks.forEach((t) => {
      const pName = (t as any).assignedPainterName || (t.category === 'PAINT' ? t.assignedToName : undefined);
      const dName = (t as any).assignedDenterName || t.pairedDenterName || (t.category === 'DENTING' ? t.assignedToName : undefined);
      if (pName && painterName === 'Unassigned Painter') painterName = pName;
      if (dName && denterName === 'Unassigned Denter') denterName = dName;
    });

    const panels = paintAndDentTasks.map((t) => {
      const cPrice = access.canViewFinancialsAndRates ? Number(t.customerPrice || 0) : 0;
      const pPayout = Number(t.painterPayout ?? (t.category === 'PAINT' ? Math.round((t.contractorPayout || 850) * 0.8) : 0));
      const dPayout = Number(t.denterPayout ?? 200);
      const cleanPanel =
        t.panelNameEn ||
        t.title
          .replace(/- Paint & Dent Repair/i, '')
          .replace(/\(.*\)/g, '')
          .trim();

      return {
        taskId: t.id,
        title: t.title,
        panelName: cleanPanel,
        paintScope: t.paintScope ? t.paintScope.replace(/_/g, ' ') : 'FULL OUTER',
        status: t.status,
        customerPrice: cPrice,
        painterPayout: pPayout,
        denterPayout: dPayout,
      };
    });

    const vCustomerPrice = panels.reduce((s, p) => s + p.customerPrice, 0);
    const vPainter = panels.reduce((s, p) => s + p.painterPayout, 0);
    const vDenter = panels.reduce((s, p) => s + p.denterPayout, 0);

    totalPanels += panels.length;
    totalPaintBilling += vCustomerPrice;
    totalPainterPayout += vPainter;
    totalDenterPayout += vDenter;

    vehicles.push({
      jobCardId: card.id,
      registrationNumber: card.vehicle.registrationNumber,
      vehicleLabel: `${card.vehicle.make} ${card.vehicle.model}`,
      color: card.vehicle.color || 'Standard',
      isCars24: Boolean(card.isCars24),
      painterName,
      denterName,
      panels,
      totalCustomerPrice: vCustomerPrice,
      totalPainterPayout: vPainter,
      totalDenterPayout: vDenter,
    });
  });

  const dateHeader = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const scopeHeader = access.canViewFullWorkshopData
    ? `🎨 *FIXOCAR WORKSHOP — ALL ACTIVE PAINT & DENTING JOBS (${dateHeader})*`
    : `🎨 *MY ALLOTTED PAINT & DENTING PANELS — ${access.userName.toUpperCase()} (${access.role}) (${dateHeader})*`;

  const lines: string[] = [
    scopeHeader,
    `Total Vehicles: ${vehicles.length} | Total Paint Panels: ${totalPanels}`,
    `----------------------------------------`,
  ];

  if (vehicles.length === 0) {
    lines.push(
      access.canViewFullWorkshopData
        ? 'No active paint or denting panels found in current workshop queue.'
        : `No active paint or denting panels are currently allotted to your account (${access.userName}).`
    );
  } else {
    vehicles.forEach((v, idx) => {
      lines.push(
        `\n${idx + 1}. *${v.registrationNumber}* — ${v.vehicleLabel} (${v.color})${v.isCars24 ? ' [Cars24]' : ''} [${v.jobCardId}]`
      );
      lines.push(`   👨‍🎨 Painter: ${v.painterName} | 🔨 Denter: ${v.denterName}`);
      v.panels.forEach((p, pIdx) => {
        if (access.canViewFinancialsAndRates) {
          lines.push(
            `   • ${pIdx + 1}) ${p.panelName} (${p.paintScope}) — Status: ${p.status} | Bill: ₹${p.customerPrice.toLocaleString('en-IN')} (P: ₹${p.painterPayout} / D: ₹${p.denterPayout})`
          );
        } else {
          lines.push(
            `   • ${pIdx + 1}) ${p.panelName} (${p.paintScope}) — Status: ${p.status}`
          );
        }
      });
      if (access.canViewFinancialsAndRates) {
        lines.push(
          `   Subtotal (${v.panels.length} panels): ₹${v.totalCustomerPrice.toLocaleString('en-IN')} | Painter Payout: ₹${v.totalPainterPayout.toLocaleString('en-IN')} | Denter Payout: ₹${v.totalDenterPayout.toLocaleString('en-IN')}`
        );
      }
    });
    lines.push(`\n----------------------------------------`);
    if (access.canViewFinancialsAndRates) {
      lines.push(
        `✅ *GRAND TOTAL (${totalPanels} Panels across ${vehicles.length} Cars)*: Billing ₹${totalPaintBilling.toLocaleString('en-IN')} | Painter Total: ₹${totalPainterPayout.toLocaleString('en-IN')} | Denter Total: ₹${totalDenterPayout.toLocaleString('en-IN')}`
      );
    } else {
      lines.push(
        `✅ *TOTAL ALLOTTED TO ${access.userName.toUpperCase()}*: ${totalPanels} Panel(s) across ${vehicles.length} Vehicle(s)`
      );
    }
  }

  return {
    vehicles,
    totalVehicles: vehicles.length,
    totalPanels,
    totalPaintBilling,
    totalPainterPayout,
    totalDenterPayout,
    copyableText: lines.join('\n'),
  };
}

/**
 * Infers required spare parts or consumables for a task when explicit partsList is empty,
 * combining task keywords + learned workshop rules so every active vehicle produces an accurate purchase list.
 */
function inferPartsForTask(card: JobCard, task: JobTask): { name: string; partNumber: string; category: string; qty: number; unitCost: number }[] {
  const titleLow = task.title.toLowerCase();
  const makeCode = (card.vehicle.make || 'OEM').slice(0, 3).toUpperCase();
  const modelCode = (card.vehicle.model || 'STD').slice(0, 3).toUpperCase();
  const results: { name: string; partNumber: string; category: string; qty: number; unitCost: number }[] = [];

  if (task.category === 'PAINT') {
    if (titleLow.includes('bumper')) {
      results.push({
        name: `${card.vehicle.make} ${card.vehicle.model} Bumper Retainer Clips & Bracket Set`,
        partNumber: `CLIP-${makeCode}-${modelCode}-BMP`,
        category: 'SPARES',
        qty: 1,
        unitCost: 280,
      });
    }
    results.push({
      name: `2K Basecoat (${card.vehicle.color || 'OEM Match'}) + Clearcoat & Primer Kit (Per Panel)`,
      partNumber: `PNT-2K-${(card.vehicle.color || 'STD').slice(0, 3).toUpperCase()}`,
      category: 'CONSUMABLES',
      qty: 1,
      unitCost: 580,
    });
    return results;
  }

  if (titleLow.includes('oil') || titleLow.includes('periodic') || titleLow.includes('service')) {
    results.push(
      {
        name: `Synthetic Engine Oil (${card.vehicle.fuelType === 'Diesel' ? '5W-30 Diesel' : '0W-20 / 5W-30 Petrol'} - 3.5L)`,
        partNumber: `OIL-SYN-${makeCode}`,
        category: 'OILS_LUBRICANTS',
        qty: 1,
        unitCost: 1250,
      },
      {
        name: `${card.vehicle.make} ${card.vehicle.model} OEM Oil Filter & Air Filter Kit`,
        partNumber: `FLT-${makeCode}-${modelCode}`,
        category: 'SPARES',
        qty: 1,
        unitCost: 540,
      }
    );
  }

  if (titleLow.includes('brake') || titleLow.includes('pad') || titleLow.includes('disc')) {
    results.push({
      name: `${card.vehicle.make} ${card.vehicle.model} Front Ceramic Brake Pad Set`,
      partNumber: `BP-${makeCode}-${modelCode}-FR`,
      category: 'SPARES',
      qty: 1,
      unitCost: 1350,
    });
  }

  if (titleLow.includes('clutch')) {
    results.push({
      name: `${card.vehicle.make} ${card.vehicle.model} Clutch Plate, Pressure Plate & Release Bearing Set`,
      partNumber: `CLT-${makeCode}-${modelCode}`,
      category: 'SPARES',
      qty: 1,
      unitCost: 4200,
    });
  }

  if (titleLow.includes('suspension') || titleLow.includes('shock') || titleLow.includes('lower arm') || titleLow.includes('bush')) {
    results.push({
      name: `${card.vehicle.make} ${card.vehicle.model} Front Lower Arm Assembly & Link Rod Bush Kit`,
      partNumber: `SUS-${makeCode}-${modelCode}`,
      category: 'SPARES',
      qty: 1,
      unitCost: 2450,
    });
  }

  if (titleLow.includes('ac ') || titleLow.includes('cooling') || titleLow.includes('condenser')) {
    results.push({
      name: `R134a Refrigerant Gas + Cabin AC Micro-Filter (${card.vehicle.model})`,
      partNumber: `AC-${makeCode}-${modelCode}`,
      category: 'CONSUMABLES',
      qty: 1,
      unitCost: 850,
    });
  }

  if (titleLow.includes('battery')) {
    results.push({
      name: `Amaron / Exide DIN/JIS Automotive Battery (${card.vehicle.model})`,
      partNumber: `BAT-${makeCode}-${modelCode}`,
      category: 'TYRES_BATTERIES',
      qty: 1,
      unitCost: 4600,
    });
  }

  return results;
}

/**
 * 2. Generate Vehicle-by-Vehicle Required Parts List + Consolidated Total Purchase List for Today,
 * automatically scoped to the logged-in user's role & allotted vehicles.
 */
export function generateConsolidatedPartsPurchaseList(
  vehicleFilterQuery?: string,
  roleOverride?: UserRole
): DailyPurchaseReport {
  const { access, cards: activeCards } = getScopedJobCardsForAgent(roleOverride);
  const inventoryItems = getInventoryItems();
  const q = (vehicleFilterQuery || '').trim().toLowerCase();

  const matchingCards = q
    ? activeCards.filter(
        (c) =>
          c.vehicle.registrationNumber.toLowerCase().includes(q) ||
          c.vehicle.make.toLowerCase().includes(q) ||
          c.vehicle.model.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q)
      )
    : activeCards;

  const vehicleGroups: VehiclePartsPurchaseGroup[] = [];
  const consolidatedMap = new Map<string, ConsolidatedDailyPurchaseItem>();

  const findStockForPart = (name: string, partNumber?: string) => {
    const cleanName = name.toLowerCase().trim();
    const cleanPN = (partNumber || '').toLowerCase().trim();
    const match = inventoryItems.find(
      (item) =>
        (cleanPN && item.partNumber.toLowerCase() === cleanPN) ||
        item.name.toLowerCase().includes(cleanName) ||
        cleanName.includes(item.name.toLowerCase())
    );
    return match ? { stock: match.stockQuantity, cost: match.unitCost, partNumber: match.partNumber, category: match.category } : null;
  };

  matchingCards.forEach((card) => {
    const vehicleItemsMap = new Map<string, VehiclePurchaseItem>();

    card.tasks.forEach((task) => {
      if (task.status === 'COMPLETED') return;

      // 1) Explicit task.partsList
      if (Array.isArray(task.partsList) && task.partsList.length > 0) {
        task.partsList.forEach((p) => {
          const key = (p.partNumber || p.name).toLowerCase().trim();
          const stockMatch = findStockForPart(p.name, p.partNumber);
          const unitCost = p.unitPrice || stockMatch?.cost || 500;
          const existing = vehicleItemsMap.get(key);
          if (existing) {
            existing.quantityNeeded += p.quantity || 1;
            existing.netToOrderQty = Math.max(0, existing.quantityNeeded - existing.inStockQty);
            existing.totalEstimatedCost = existing.netToOrderQty * existing.unitCost;
          } else {
            const inStock = stockMatch?.stock ?? 0;
            const qty = p.quantity || 1;
            const netOrder = Math.max(0, qty - inStock);
            vehicleItemsMap.set(key, {
              partName: p.name,
              partNumber: p.partNumber || stockMatch?.partNumber || 'OEM-PART',
              category: p.type === 'CONSUMABLE' ? 'CONSUMABLES' : 'SPARES',
              quantityNeeded: qty,
              inStockQty: inStock,
              netToOrderQty: netOrder > 0 ? netOrder : qty, // Always include in purchase planning if requested for job
              unitCost,
              totalEstimatedCost: (netOrder > 0 ? netOrder : qty) * unitCost,
              sourceTaskTitle: task.title,
              requisitionStatus: p.isApproved ? 'APPROVED' : 'PENDING',
            });
          }
        });
      }

      // 2) Explicit task.requisitions
      if (Array.isArray(task.requisitions) && task.requisitions.length > 0) {
        task.requisitions.forEach((req) => {
          if (req.status === 'REJECTED' || req.status === 'CONSUMED') return;
          const key = (req.partNumber || req.title).toLowerCase().trim();
          const stockMatch = findStockForPart(req.title, req.partNumber);
          const unitCost = req.approvedPrice || req.suggestedPrice || stockMatch?.cost || 650;
          const existing = vehicleItemsMap.get(key);
          if (!existing) {
            const inStock = stockMatch?.stock ?? 0;
            const qty = req.quantity || 1;
            vehicleItemsMap.set(key, {
              partName: req.title,
              partNumber: req.partNumber || stockMatch?.partNumber || 'REQ-PART',
              category: req.itemType === 'CONSUMABLE' ? 'CONSUMABLES' : 'SPARES',
              quantityNeeded: qty,
              inStockQty: inStock,
              netToOrderQty: qty,
              unitCost,
              totalEstimatedCost: qty * unitCost,
              sourceTaskTitle: task.title,
              requisitionStatus: req.status,
            });
          }
        });
      }

      // 3) Inferred parts if task has no explicit parts or requisitions yet
      if ((!task.partsList || task.partsList.length === 0) && (!task.requisitions || task.requisitions.length === 0)) {
        const inferred = inferPartsForTask(card, task);
        inferred.forEach((inf) => {
          const key = (inf.partNumber || inf.name).toLowerCase().trim();
          const stockMatch = findStockForPart(inf.name, inf.partNumber);
          const existing = vehicleItemsMap.get(key);
          if (existing) {
            existing.quantityNeeded += inf.qty;
            existing.netToOrderQty += inf.qty;
            existing.totalEstimatedCost = existing.netToOrderQty * existing.unitCost;
          } else {
            vehicleItemsMap.set(key, {
              partName: inf.name,
              partNumber: inf.partNumber,
              category: inf.category,
              quantityNeeded: inf.qty,
              inStockQty: stockMatch?.stock ?? 0,
              netToOrderQty: inf.qty,
              unitCost: stockMatch?.cost ?? inf.unitCost,
              totalEstimatedCost: inf.qty * (stockMatch?.cost ?? inf.unitCost),
              sourceTaskTitle: task.title,
              requisitionStatus: 'AI_RECOMMENDED',
            });
          }
        });
      }
    });

    const items = Array.from(vehicleItemsMap.values());
    if (items.length === 0) return;

    const vehicleTotalPurchaseCost = items.reduce((s, i) => s + i.totalEstimatedCost, 0);

    vehicleGroups.push({
      jobCardId: card.id,
      registrationNumber: card.vehicle.registrationNumber,
      vehicleLabel: `${card.vehicle.make} ${card.vehicle.model} (${card.vehicle.year})`,
      isCars24: Boolean(card.isCars24),
      priorityLabel: card.isUrgent ? 'HIGH / URGENT' : 'STANDARD',
      items,
      vehicleTotalPurchaseCost,
    });

    // Aggregate into Consolidated Master List for Today
    items.forEach((item) => {
      const masterKey = `${item.partNumber.toLowerCase()}__${item.partName.toLowerCase().slice(0, 25)}`;
      const existingMaster = consolidatedMap.get(masterKey);
      if (existingMaster) {
        existingMaster.totalQuantityNeeded += item.quantityNeeded;
        existingMaster.netQuantityToBuy += item.netToOrderQty;
        existingMaster.totalPurchaseCost = existingMaster.netQuantityToBuy * existingMaster.unitCost;
        existingMaster.vehiclesUsing.push({
          regNo: card.vehicle.registrationNumber,
          model: `${card.vehicle.make} ${card.vehicle.model}`,
          qty: item.quantityNeeded,
          jobCardId: card.id,
        });
      } else {
        consolidatedMap.set(masterKey, {
          partKey: masterKey,
          partName: item.partName,
          partNumber: item.partNumber,
          category: item.category,
          totalQuantityNeeded: item.quantityNeeded,
          inStockQty: item.inStockQty,
          netQuantityToBuy: item.netToOrderQty,
          unitCost: item.unitCost,
          totalPurchaseCost: item.netToOrderQty * item.unitCost,
          vehiclesUsing: [
            {
              regNo: card.vehicle.registrationNumber,
              model: `${card.vehicle.make} ${card.vehicle.model}`,
              qty: item.quantityNeeded,
              jobCardId: card.id,
            },
          ],
        });
      }
    });
  });

  const consolidatedItems = Array.from(consolidatedMap.values()).sort(
    (a, b) => b.totalPurchaseCost - a.totalPurchaseCost
  );
  const grandTotalEstimatedCost = consolidatedItems.reduce((s, i) => s + i.totalPurchaseCost, 0);
  const dateStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const lines: string[] = [
    access.canViewFullWorkshopData
      ? `🛒 *FIXOCAR WORKSHOP — DAILY PARTS PURCHASE LIST (${dateStr})*`
      : `🛒 *PARTS REQUIRED FOR MY ALLOTTED VEHICLES — ${access.userName.toUpperCase()} (${access.role}) (${dateStr})*`,
    `Active Vehicles Requiring Parts: ${vehicleGroups.length} | Unique Parts/Consumables: ${consolidatedItems.length}`,
    `========================================`,
    `📌 *PART 1: VEHICLE-BY-VEHICLE PARTS LIST*`,
  ];

  if (vehicleGroups.length === 0) {
    lines.push(
      access.canViewFullWorkshopData
        ? 'No pending parts or consumables required across active job cards.'
        : `No pending parts required for vehicles currently allotted to ${access.userName}.`
    );
  } else {
    vehicleGroups.forEach((vg, idx) => {
      lines.push(
        `\n🚗 *Vehicle ${idx + 1}: ${vg.registrationNumber}* — ${vg.vehicleLabel}${vg.isCars24 ? ' [Cars24]' : ''} (${vg.jobCardId})`
      );
      vg.items.forEach((it, iIdx) => {
        if (access.canViewFinancialsAndRates) {
          lines.push(
            `   ${iIdx + 1}) ${it.partName} [${it.partNumber}] — Qty: ${it.netToOrderQty} × ₹${it.unitCost.toLocaleString('en-IN')} = ₹${it.totalEstimatedCost.toLocaleString('en-IN')} (For: ${it.sourceTaskTitle})`
          );
        } else {
          lines.push(
            `   ${iIdx + 1}) ${it.partName} [${it.partNumber}] — Qty Needed: ${it.netToOrderQty} (For: ${it.sourceTaskTitle})`
          );
        }
      });
      if (access.canViewFinancialsAndRates) {
        lines.push(`   👉 *Vehicle ${vg.registrationNumber} Parts Subtotal*: ₹${vg.vehicleTotalPurchaseCost.toLocaleString('en-IN')}`);
      }
    });

    lines.push(`\n========================================`);
    lines.push(`📦 *PART 2: CONSOLIDATED TOTAL PARTS LIST FOR TODAY*`);
    consolidatedItems.forEach((ci, cIdx) => {
      const carsStr = ci.vehiclesUsing.map((v) => `${v.regNo} (${v.qty})`).join(', ');
      if (access.canViewFinancialsAndRates) {
        lines.push(
          `${cIdx + 1}. *${ci.partName}* [${ci.partNumber}] — *Total Buy Qty: ${ci.netQuantityToBuy}* | Est. Cost: ₹${ci.totalPurchaseCost.toLocaleString('en-IN')} (Used in: ${carsStr})`
        );
      } else {
        lines.push(
          `${cIdx + 1}. *${ci.partName}* [${ci.partNumber}] — *Total Qty: ${ci.netQuantityToBuy}* (Used in: ${carsStr})`
        );
      }
    });
    if (access.canViewFinancialsAndRates) {
      lines.push(`----------------------------------------`);
      lines.push(
        `💰 *TODAY'S TOTAL PARTS PROCUREMENT BUDGET*: ₹${grandTotalEstimatedCost.toLocaleString('en-IN')}`
      );
    }
  }

  return {
    dateStr,
    vehicleGroups,
    consolidatedItems,
    grandTotalEstimatedCost: access.canViewFinancialsAndRates ? grandTotalEstimatedCost : 0,
    totalUniquePartsToBuy: consolidatedItems.length,
    copyableText: lines.join('\n'),
  };
}

/**
 * Pushes all AI-recommended / required parts from the Daily Purchase Report directly into the Part Order Basket (Requisitions)
 * so the procurement team can order them with one click.
 */
export function syncPurchaseReportToPartOrderBasket(report: DailyPurchaseReport): number {
  const user = getAuthUser();
  let addedCount = 0;

  report.vehicleGroups.forEach((vg) => {
    updateJobCard(vg.jobCardId, (card) => {
      const updatedTasks = card.tasks.map((task) => {
        const matchingItems = vg.items.filter(
          (i) => i.sourceTaskTitle === task.title && i.requisitionStatus === 'AI_RECOMMENDED'
        );
        if (matchingItems.length === 0) return task;

        const existingReqs: TaskRequisition[] = Array.isArray(task.requisitions) ? [...task.requisitions] : [];
        matchingItems.forEach((item, idx) => {
          const alreadyExists = existingReqs.some(
            (r) => r.title.toLowerCase() === item.partName.toLowerCase()
          );
          if (!alreadyExists) {
            existingReqs.push({
              id: `req-ai-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
              taskId: task.id,
              jobCardId: card.id,
              requestedByEmployeeId: user?.id || 'emp-admin',
              requestedByEmployeeName: user?.name || 'AI Workshop Co-Pilot',
              title: item.partName,
              itemType: item.category === 'CONSUMABLES' ? 'CONSUMABLE' : 'PART',
              quantity: item.netToOrderQty,
              urgency: card.isUrgent ? 'HIGH' : 'MEDIUM',
              reason: `Auto-generated for ${card.vehicle.registrationNumber} (${task.title})`,
              suggestedPrice: item.unitCost,
              approvedPrice: item.unitCost,
              status: 'APPROVED',
              createdAt: new Date().toLocaleString(),
              approvedAt: new Date().toLocaleString(),
              partNumber: item.partNumber,
            });
            addedCount += 1;
          }
        });

        return {
          ...task,
          requisitions: existingReqs,
        };
      });

      return {
        ...card,
        tasks: updatedTasks,
      };
    });
  });

  if (addedCount > 0) {
    dispatchToastNotification({
      type: 'SUCCESS',
      title: '🛒 Added to Part Order Basket',
      message: `${addedCount} part item(s) synced to the Part Order Basket for procurement.`,
    });
  }

  return addedCount;
}

/**
 * 3. Creates a Gate Check-In record directly from an AI-analyzed vehicle entry photo.
 */
export function createGateCheckInFromAiPhoto(analysis: AIVehiclePhotoAnalysis, photoUrl?: string): VehicleCheckIn {
  const workshops = getWorkshops();
  const cities = getCities();
  const defaultWs = workshops[0];
  const defaultCity = cities.find((c) => c.id === defaultWs?.cityId) || cities[0];

  const cleanReg = (analysis.plateNumber && analysis.plateNumber !== 'UNREADABLE'
    ? analysis.plateNumber
    : `TEMP${Math.floor(1000 + Math.random() * 9000)}`
  )
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  const checkIn = createVehicleCheckIn({
    registrationNumber: cleanReg,
    make: analysis.make || 'Maruti Suzuki',
    model: analysis.model || 'Swift',
    variant: analysis.variant || 'Standard',
    fuelType: (analysis.fuelType as FuelType) || 'Petrol',
    color: analysis.color || 'White',
    fuelLevel: 50,
    mileage: 38000,
    isCars24: true,
    cars24RefNo: `C24-${Date.now().toString().slice(-6)}`,
    customerName: 'Cars24 / Walk-In Customer',
    customerPhone: '9820011223',
    cityId: defaultCity?.id,
    cityName: defaultCity?.name,
    workshopId: defaultWs?.id,
    workshopName: defaultWs?.name,
    checkInDriverName: 'Gate Arrival Driver',
    checkInDriverPhone: '9820011223',
    checkInPhotoWithDriverUrl:
      photoUrl && photoUrl.length < 45000
        ? photoUrl
        : 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80',
    checkInNotes: `AI Gate Photo Scan: ${analysis.summary}`,
    workOrderNotes: (analysis.visibleDamages || []).join(', '),
    status: 'AWAITING_JOB_CARD',
  });

  return checkIn;
}

/**
 * 4. Creates a complete, actionable internal Job Card from an AI-parsed PDF Job Card (e.g. Cars24 Work Order)
 * or AI Vehicle Photo Analysis, automatically allotting Painter, Denter, and Mechanic, attaching parts,
 * and posting video inspection instructions for employees.
 * STRICT RBAC: Only Management roles (Admin, Super Admin, Floor Manager, Service Advisor) can create Job Cards.
 */
export function createActionableJobCardFromAiPayload(
  payload: AIParsedJobCardPayload,
  roleOverride?: UserRole
): JobCard {
  const access = resolveAgentSessionAccess(roleOverride);
  if (!access.canCreateJobCard) {
    throw new Error(
      `Role Permission Denied (${access.userName} • ${access.role}): Only Admin, Floor Manager, or Service Advisor accounts can create Job Cards or allot tasks.`
    );
  }

  const workshops = getWorkshops();
  const cities = getCities();
  const stdJobs = getStandardJobs();
  const { painter, denter, mechanic, floorManager } = selectOptimalWorkshopTechnicians();

  const defaultWs = workshops[0];
  const defaultCity = cities.find((c) => c.id === defaultWs?.cityId) || cities[0];

  const cleanReg = (payload.registrationNumber || `KA01AB${Math.floor(1000 + Math.random() * 9000)}`)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  // Ensure Gate Check-In exists or create one
  const existingCheckIns = getVehicleCheckIns();
  let matchingCheckIn = existingCheckIns.find(
    (c) => c.registrationNumber.replace(/[^A-Z0-9]/g, '').toUpperCase() === cleanReg && c.status !== 'CHECKED_OUT'
  );

  if (!matchingCheckIn) {
    matchingCheckIn = createVehicleCheckIn({
      registrationNumber: cleanReg,
      make: payload.make || 'Maruti Suzuki',
      model: payload.model || 'Baleno',
      variant: payload.variant || 'Standard',
      fuelType: (payload.fuelType as FuelType) || 'Petrol',
      color: payload.color || 'White',
      fuelLevel: payload.fuelLevel || 50,
      mileage: payload.mileage || 42000,
      isCars24: Boolean(payload.isCars24),
      cars24RefNo: payload.cars24RefNo || (payload.isCars24 ? `C24-${Date.now().toString().slice(-6)}` : undefined),
      customerName: payload.customerName || (payload.isCars24 ? 'Cars24 Fleet Hub' : 'Walk-In Customer'),
      customerPhone: payload.customerPhone || '9820099110',
      cityId: defaultCity?.id,
      cityName: defaultCity?.name,
      workshopId: defaultWs?.id,
      workshopName: defaultWs?.name,
      checkInDriverName: payload.isCars24 ? 'Cars24 Fleet Driver' : (payload.customerName || 'Customer'),
      checkInDriverPhone: payload.customerPhone || '9820099110',
      checkInPhotoWithDriverUrl: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80',
      checkInNotes: `Auto-checked in via AI PDF Job Card Parser (${payload.workOrderNo || 'Work Order'})`,
      workOrderNo: payload.workOrderNo,
      workOrderNotes: payload.workOrderSummary,
      status: 'JOB_CARD_CREATED',
    });
  }

  // Build tasks with full Painter + Denter + Mechanic allotment and pre-attached required parts
  const builtTasks: JobTask[] = [];
  const rawTasks = Array.isArray(payload.tasks) && payload.tasks.length > 0
    ? payload.tasks
    : [
        {
          title: 'Comprehensive Multipoint Inspection & Diagnostics',
          category: 'INSPECTION',
          customerPrice: 850,
          estimatedCost: 400,
        },
      ];

  rawTasks.forEach((rawTask, idx) => {
    const cat = (['PAINT', 'DENTING', 'MECHANICAL', 'WASHING', 'INSPECTION', 'PARTS', 'SUBLET_VENDOR'].includes(
      rawTask.category?.toUpperCase()
    )
      ? rawTask.category.toUpperCase()
      : 'MECHANICAL') as TaskCategory;

    const stdMatch = stdJobs.find(
      (sj) =>
        (rawTask.panelKey && sj.panelKey === rawTask.panelKey) ||
        sj.title.toLowerCase() === rawTask.title.toLowerCase()
    );

    const isPaintOrDent = cat === 'PAINT' || cat === 'DENTING';
    const assignedEmp = cat === 'PAINT' ? painter : cat === 'DENTING' ? denter : mechanic;

    const taskId = `task-ai-${Date.now()}-${idx}`;
    const painterPayout = rawTask.painterPayout ?? stdMatch?.cars24PainterPayout ?? (cat === 'PAINT' ? 850 : 0);
    const denterPayout = rawTask.denterPayout ?? stdMatch?.cars24DenterPayout ?? (isPaintOrDent ? 200 : 0);

    // Attach requiredParts to the first mechanical task or matching task so nothing is lost
    const taskParts: TaskPartItem[] = [];
    if (idx === 0 && Array.isArray(payload.requiredParts)) {
      payload.requiredParts.forEach((rp, pIdx) => {
        taskParts.push({
          id: `part-ai-${Date.now()}-${pIdx}`,
          name: rp.name,
          quantity: rp.quantity || 1,
          unitPrice: rp.unitPrice || 500,
          totalPrice: (rp.quantity || 1) * (rp.unitPrice || 500),
          partNumber: rp.partNumber || `OEM-${pIdx + 101}`,
          type: rp.category === 'CONSUMABLES' ? 'CONSUMABLE' : 'PART',
          isApproved: true,
          addedAt: new Date().toLocaleString(),
        });
      });
    }

    const videoInstruction =
      payload.employeeVideoPrompts && payload.employeeVideoPrompts.length > 0
        ? `📹 Video Check Required: ${payload.employeeVideoPrompts.join(' | ')}`
        : undefined;

    const newTask: any = {
      id: taskId,
      jobCardId: 'PENDING',
      title: rawTask.title,
      category: cat,
      panelKey: rawTask.panelKey || stdMatch?.panelKey,
      panelNameEn: rawTask.panelNameEn || stdMatch?.panelNameEn,
      paintScope: (rawTask.paintScope as any) || stdMatch?.paintScope || (cat === 'PAINT' ? 'FULL_OUTER' : undefined),
      assignedToId: assignedEmp?.id,
      assignedToName: assignedEmp?.name,
      assignedType: 'EMPLOYEE',
      // Explicitly populate role-specific technician fields so JobCardList, Pipeline & Detail views display them everywhere
      assignedPainterId: cat === 'PAINT' ? painter?.id : undefined,
      assignedPainterName: cat === 'PAINT' ? painter?.name : undefined,
      assignedDenterId: isPaintOrDent ? denter?.id : undefined,
      assignedDenterName: isPaintOrDent ? denter?.name : undefined,
      pairedDenterId: cat === 'PAINT' ? denter?.id : undefined,
      pairedDenterName: cat === 'PAINT' ? denter?.name : undefined,
      assignedEmployeeId: !isPaintOrDent ? mechanic?.id : undefined,
      assignedEmployeeName: !isPaintOrDent ? mechanic?.name : undefined,
      estimatedCost: Number(rawTask.estimatedCost || (isPaintOrDent ? painterPayout + denterPayout : Math.round((rawTask.customerPrice || 1200) * 0.55))),
      customerPrice: Number(rawTask.customerPrice || 1500),
      status: 'PENDING',
      requiresCustomerApproval: Boolean(rawTask.requiresCustomerApproval),
      isCustomerApproved: rawTask.requiresCustomerApproval ? null : true,
      isContractBasis: isPaintOrDent,
      contractorPayout: isPaintOrDent ? painterPayout + denterPayout : 0,
      painterPayout: cat === 'PAINT' ? painterPayout : undefined,
      denterPayout: isPaintOrDent ? denterPayout : undefined,
      standardJobId: stdMatch?.id,
      partsList: taskParts,
      notes: videoInstruction,
    };

    builtTasks.push(newTask);

    // If PAINT panel has paired denter, also create explicit Pre-Denting task for Denter workspace
    if (cat === 'PAINT' && denter) {
      const pName = newTask.panelNameEn || rawTask.title.replace(/- Paint & Dent Repair/i, '').trim();
      builtTasks.push({
        id: `task-ai-dent-${Date.now()}-${idx}`,
        jobCardId: 'PENDING',
        title: `${pName} - Pre-Denting & Panel Prep`,
        category: 'DENTING',
        panelKey: newTask.panelKey,
        panelNameEn: pName,
        assignedToId: denter.id,
        assignedToName: denter.name,
        assignedType: 'EMPLOYEE',
        assignedDenterId: denter.id,
        assignedDenterName: denter.name,
        pairedDenterId: denter.id,
        pairedDenterName: denter.name,
        estimatedCost: denterPayout,
        customerPrice: 0,
        status: 'PENDING',
        requiresCustomerApproval: false,
        isCustomerApproved: true,
        isContractBasis: true,
        contractorPayout: denterPayout,
        denterPayout: denterPayout,
        notes: videoInstruction,
      } as any);
    }
  });

  const createdCard = createJobCard({
    cityId: defaultCity?.id,
    cityName: defaultCity?.name,
    workshopId: defaultWs?.id,
    workshopName: defaultWs?.name,
    isCars24: Boolean(payload.isCars24),
    cars24RefNo: payload.cars24RefNo || (payload.isCars24 ? `C24-${Date.now().toString().slice(-6)}` : undefined),
    workOrderNo: payload.workOrderNo || `WO-${Date.now().toString().slice(-5)}`,
    workOrderNotes: `${payload.workOrderSummary}\n${(payload.employeeVideoPrompts || []).map((v) => `• [Video Proof Required]: ${v}`).join('\n')}`,
    estimatedCompletionDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    isUrgent: Boolean(payload.isCars24),
    huddleNotes:
      payload.employeeVideoPrompts && payload.employeeVideoPrompts.length > 0
        ? `AI Inspection Video Requests: ${payload.employeeVideoPrompts.join(' | ')}`
        : undefined,
    vehicle: {
      registrationNumber: cleanReg,
      make: payload.make || 'Maruti Suzuki',
      model: payload.model || 'Baleno',
      variant: payload.variant || 'Zeta',
      fuelType: (payload.fuelType as FuelType) || 'Petrol',
      year: Number(payload.year || 2022),
      color: payload.color || 'White',
      fuelLevel: Number(payload.fuelLevel || 50),
      mileage: Number(payload.mileage || 42000),
    },
    customer: {
      id: `cust-${Date.now().toString().slice(-4)}`,
      name: payload.customerName || (payload.isCars24 ? 'Cars24 Fleet Partner' : 'Workshop Customer'),
      phone: payload.customerPhone || '9820099110',
      email: 'fleet@cars24.com',
      address: defaultWs?.name || 'Workshop Counter',
    },
    status: 'JOB_ALLOCATED',
    serviceType: 'CUSTOM_REPAIR',
    packageName: payload.isCars24 ? 'Cars24 PDF Refurbishment Order' : 'AI Parsed Work Order',
    floorManagerId: floorManager?.id,
    floorManagerName: floorManager?.name,
    pickupRequested: false,
    deliveryRequested: false,
    discount: 0,
    taxRate: 18,
    advancePaid: 0,
    isCheckedIn: true,
    checkInRecordId: matchingCheckIn.id,
    checkedInAt: matchingCheckIn.checkedInAt,
    checkInDriverName: matchingCheckIn.checkInDriverName,
    checkInDriverPhone: matchingCheckIn.checkInDriverPhone,
    checkInPhotoWithDriverUrl: matchingCheckIn.checkInPhotoWithDriverUrl,
    qcChecklist: [
      { id: 'qc-1', label: 'Engine oil cap & dipstick tightened', category: 'ENGINE', isPassed: false },
      { id: 'qc-2', label: 'Brake fluid reservoir level checked', category: 'ENGINE', isPassed: false },
      { id: 'qc-3', label: 'Panel paint gloss & color match verified', category: 'BODY', isPassed: false },
      { id: 'qc-4', label: 'Employee video inspection uploaded for additional work', category: 'BODY', isPassed: false },
    ],
    qcPassed: false,
    tasks: builtTasks,
  });

  updateVehicleCheckIn(matchingCheckIn.id, (prev) => ({
    ...prev,
    status: 'JOB_CARD_CREATED',
    jobCardId: createdCard.id,
  }));

  if (payload.employeeVideoPrompts && payload.employeeVideoPrompts.length > 0) {
    addJobCardComment(createdCard.id, {
      jobCardId: createdCard.id,
      authorName: 'AI Workshop Co-Pilot',
      authorRole: 'AI_AGENT',
      text: `📹 Employee Video Inspection Instructions (${painter?.name || 'Painter'}, ${denter?.name || 'Denter'}, ${mechanic?.name || 'Mechanic'}): ${payload.employeeVideoPrompts.join(' • ')}`,
    });
  }

  return createdCard;
}

/**
 * Builds a role-scoped snapshot of the live workshop database to ground the AI Chat Agent.
 * - For Admin/Manager: Full workshop snapshot.
 * - For Employee: Strictly filtered to vehicles and tasks allotted to that logged-in employee, without billing prices.
 */
export function buildLiveWorkshopSnapshotForAI(roleOverride?: UserRole) {
  const { access, cards: scopedCards } = getScopedJobCardsForAgent(roleOverride);
  const paintReport = generateCopyablePaintJobsSummary(undefined, roleOverride);
  const purchaseReport = generateConsolidatedPartsPurchaseList(undefined, roleOverride);
  const techs = selectOptimalWorkshopTechnicians();

  return {
    loggedInAccount: {
      userName: access.userName,
      role: access.role,
      employeeId: access.employeeId,
      scopeDescription: access.scopeDescription,
      permissions: {
        canCreateJobCard: access.canCreateJobCard,
        canEditOrDeleteTasks: access.canEditOrDeleteTasks,
        canAllotTechnicians: access.canAllotTechnicians,
        canViewFinancialsAndRates: access.canViewFinancialsAndRates,
      },
    },
    activeCardCount: scopedCards.length,
    totalActivePaintPanels: paintReport.totalPanels,
    ...(access.canViewFinancialsAndRates
      ? { totalPartsProcurementBudget: purchaseReport.grandTotalEstimatedCost }
      : {}),
    ...(access.canAllotTechnicians
      ? {
          recommendedTechniciansForNextJob: {
            painter: techs.painter?.name,
            denter: techs.denter?.name,
            mechanic: techs.mechanic?.name,
          },
        }
      : {}),
    activeVehicles: scopedCards.slice(0, 12).map((c) => ({
      id: c.id,
      regNo: c.vehicle.registrationNumber,
      vehicle: `${c.vehicle.make} ${c.vehicle.model} (${c.vehicle.color})`,
      status: c.status,
      isCars24: c.isCars24,
      isUrgent: c.isUrgent,
      huddleOrVideoNotes: c.huddleNotes || c.workOrderNotes || '',
      taskCount: c.tasks.length,
      tasks: c.tasks.map((t) => ({
        title: t.title,
        category: t.category,
        status: t.status,
        assignedTo:
          (t as any).assignedPainterName ||
          (t as any).assignedDenterName ||
          t.assignedToName ||
          'Unassigned',
        videoOrInspectionNote: t.notes || '',
      })),
    })),
  };
}

