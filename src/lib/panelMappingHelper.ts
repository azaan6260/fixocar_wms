import { StandardJob } from '../types';
import { getStandardJobs } from './storage';
import { VEHICLE_PANELS, PanelDefinition } from '../components/InteractiveVehicleInspectionChart';

/**
 * Safely maps any job task or title string to its correct visual vehicle panel definition.
 * Specifically handles the distinction between 'boot_floor' (Dicky Boot Floor Underbody)
 * and 'boot_trunk' (Dicky Door / Boot Lid) so they are never confused.
 */
export function matchTaskToPanelDef(task: { title: string; panelKey?: string; standardJobId?: string }): PanelDefinition | undefined {
  if (!task) return undefined;

  // 1. Direct panelKey match
  if (task.panelKey) {
    const found = VEHICLE_PANELS.find(p => p.id === task.panelKey);
    if (found) return found;
  }

  // 2. Standard Job ID match
  if (task.standardJobId) {
    const found = VEHICLE_PANELS.find(p => p.standardJobId === task.standardJobId || p.cars24StandardJobId === task.standardJobId);
    if (found) return found;
  }

  const titleLower = (task.title || '').toLowerCase();
  const cleanTitle = titleLower.replace(/[^a-z0-9]/g, ' ');

  // 3. Dicky Boot Floor / Underbody Panel Check
  if (cleanTitle.includes('floor') || cleanTitle.includes('underbody') || cleanTitle.includes('फर्श') || cleanTitle.includes('अंडरबॉडी')) {
    return VEHICLE_PANELS.find(p => p.id === 'boot_floor');
  }

  // 4. Dicky Outer Door / Boot Lid Check
  if (cleanTitle.includes('boot') || cleanTitle.includes('trunk') || cleanTitle.includes('tailgate') || cleanTitle.includes('डिक्की') || cleanTitle.includes('बूट')) {
    return VEHICLE_PANELS.find(p => p.id === 'boot_trunk');
  }

  if (cleanTitle.includes('bonnet') || cleanTitle.includes('hood') || cleanTitle.includes('बोनट')) {
    return VEHICLE_PANELS.find(p => p.id === 'hood_bonnet');
  }

  if (cleanTitle.includes('spoiler') || cleanTitle.includes('स्पॉइलर')) {
    return VEHICLE_PANELS.find(p => p.id === 'spoiler');
  }

  if (cleanTitle.includes('front bumper') || (cleanTitle.includes('bumper') && cleanTitle.includes('front'))) {
    return VEHICLE_PANELS.find(p => p.id === 'bumper_front');
  }

  if (cleanTitle.includes('rear bumper') || (cleanTitle.includes('bumper') && cleanTitle.includes('rear'))) {
    return VEHICLE_PANELS.find(p => p.id === 'bumper_rear');
  }

  if (cleanTitle.includes('roof') || cleanTitle.includes('छत')) {
    return VEHICLE_PANELS.find(p => p.id === 'roof');
  }

  // 5. LHS vs RHS Side Panels matching
  const isLHS = cleanTitle.includes('lhs') || cleanTitle.includes('left') || cleanTitle.includes('बायां');
  const isRHS = cleanTitle.includes('rhs') || cleanTitle.includes('right') || cleanTitle.includes('दायां');

  if (cleanTitle.includes('fender')) {
    if (isLHS) return VEHICLE_PANELS.find(p => p.id === 'fender_lhs');
    if (isRHS) return VEHICLE_PANELS.find(p => p.id === 'fender_rhs');
  }

  if (cleanTitle.includes('running board') || cleanTitle.includes('sill')) {
    if (isLHS) return VEHICLE_PANELS.find(p => p.id === 'running_board_lhs');
    if (isRHS) return VEHICLE_PANELS.find(p => p.id === 'running_board_rhs');
  }

  if (cleanTitle.includes('quarter')) {
    if (isLHS) return VEHICLE_PANELS.find(p => p.id === 'quarter_panel_lhs');
    if (isRHS) return VEHICLE_PANELS.find(p => p.id === 'quarter_panel_rhs');
  }

  if (cleanTitle.includes('door')) {
    const isFront = cleanTitle.includes('front') || cleanTitle.includes('fr') || cleanTitle.includes('अगला');
    const isRear = cleanTitle.includes('rear') || cleanTitle.includes('rr') || cleanTitle.includes('पिछला');
    if (isLHS && isFront) return VEHICLE_PANELS.find(p => p.id === 'door_lhs_front');
    if (isLHS && isRear) return VEHICLE_PANELS.find(p => p.id === 'door_lhs_rear');
    if (isRHS && isFront) return VEHICLE_PANELS.find(p => p.id === 'door_rhs_front');
    if (isRHS && isRear) return VEHICLE_PANELS.find(p => p.id === 'door_rhs_rear');
  }

  if (cleanTitle.includes('windshield') || cleanTitle.includes('glass')) {
    const isFront = cleanTitle.includes('front') || cleanTitle.includes('fr');
    const isRear = cleanTitle.includes('rear') || cleanTitle.includes('rr');
    if (isFront) return VEHICLE_PANELS.find(p => p.id === 'windshield_front');
    if (isRear) return VEHICLE_PANELS.find(p => p.id === 'windshield_rear');
  }

  // Fallback match against panel nameEn, code, or id
  return VEHICLE_PANELS.find(p => 
    titleLower.includes(p.nameEn.toLowerCase()) ||
    titleLower.includes(p.code.toLowerCase()) ||
    titleLower.includes(p.id.replace(/_/g, ' '))
  );
}

/**
 * Maps a visual panel ID (e.g. 'hood_bonnet', 'bumper_front', 'fender_lhs') 
 * or panel definition object to its corresponding StandardJob from the standard_jobs table/store.
 */
export function mapPanelToStandardJob(
  panelIdOrPanel: string | PanelDefinition,
  standardJobs?: StandardJob[],
  scope?: string
): StandardJob | undefined {
  const jobs = (standardJobs && standardJobs.length > 0) ? standardJobs : getStandardJobs();
  const panelId = typeof panelIdOrPanel === 'string' ? panelIdOrPanel : panelIdOrPanel.id;
  const panelObj = typeof panelIdOrPanel === 'string' 
    ? VEHICLE_PANELS.find(p => p.id === panelId)
    : panelIdOrPanel;

  if (!panelId && !panelObj) return undefined;

  // 1. Prioritize exact match for panelKey AND paintScope if scope is provided
  if (scope && panelId) {
    const exactScopeMatch = jobs.find(job => job.panelKey === panelId && job.paintScope === scope);
    if (exactScopeMatch) return exactScopeMatch;
  }

  // 2. Fallback to FULL_OUTER or general panel key if scope is FULL_OUTER or not found
  if (panelId) {
    const defaultScopeMatch = jobs.find(job => job.panelKey === panelId && (job.paintScope === 'FULL_OUTER' || !job.paintScope));
    if (defaultScopeMatch) return defaultScopeMatch;
  }

  const targetStdId = panelObj?.standardJobId;
  const targetCode = panelObj?.code?.toLowerCase();
  const targetNameEn = panelObj?.nameEn?.toLowerCase();

  // Primary match: exact panelKey or standardJobId match
  const matchedJob = jobs.find(job => {
    if (job.panelKey && job.panelKey === panelId) return true;
    if (targetStdId && job.id === targetStdId) return true;
    if (job.panelNameEn && targetNameEn && job.panelNameEn.toLowerCase() === targetNameEn) return true;
    if (job.title && targetNameEn && job.title.toLowerCase().includes(targetNameEn)) return true;
    if (job.title && targetCode && job.title.toLowerCase().includes(targetCode)) return true;
    return false;
  });

  return matchedJob;
}

/**
 * Helper to check if Partial Paint scope is permitted for a panel.
 * Fenders and Running Boards are strictly prohibited from Partial Paint per workshop rules.
 */
export function isPartialPaintAllowedForPanel(panelIdOrName?: string): boolean {
  return true;
}

export interface PanelEnvironmentRates {
  standardJob?: StandardJob;
  price: number;
  retailPrice: number;
  cars24Price: number;
  retailPainterPayout: number;
  retailDenterPayout: number;
  retailContractorPayout: number;
  cars24PainterPayout: number;
  cars24DenterPayout: number;
  cars24ContractorPayout: number;
  painterPayout: number;
  denterPayout: number;
  contractorPayout: number;
}

/**
 * Fetches the correct, environment-specific rates (Retail vs. Cars24) by matching
 * the panel's unique identifier against the 'standard_jobs' database table / store.
 * Supports paintScope ('FULL_OUTER', 'PARTIAL_TOUCHUP', 'INSIDE_JAMB', 'FULL_OUTER_AND_INSIDE').
 */
export function getPanelEnvironmentRates(
  panelIdOrPanel: string | PanelDefinition,
  standardJobs?: StandardJob[],
  isCars24: boolean = false,
  scope?: string
): PanelEnvironmentRates {
  const panelId = typeof panelIdOrPanel === 'string' ? panelIdOrPanel : panelIdOrPanel?.id;
  const isPartialAllowed = isPartialPaintAllowedForPanel(panelId);
  const activeScope = (scope === 'PARTIAL_TOUCHUP' && !isPartialAllowed) ? 'FULL_OUTER' : (scope || 'FULL_OUTER');
  
  // Pass scope to mapPanelToStandardJob so we get the exact scope-specific job if configured!
  const matchedJob = mapPanelToStandardJob(panelIdOrPanel, standardJobs, activeScope);

  let multiplier = 1.0;
  if (activeScope === 'PARTIAL_TOUCHUP') multiplier = 0.6;
  else if (activeScope === 'INSIDE_JAMB') multiplier = 0.5;
  else if (activeScope === 'FULL_OUTER_AND_INSIDE') multiplier = 1.35;

  if (matchedJob) {
    let retailPrice = matchedJob.retailPrice ?? 2000;
    let cars24Price = matchedJob.cars24Price ?? 1350;

    // Only apply nested scope math / defaults if the matched job is NOT already scope-specific
    if (matchedJob.paintScope !== activeScope) {
      if (activeScope === 'PARTIAL_TOUCHUP') {
        retailPrice = matchedJob.retailPartialPrice ?? Math.round(retailPrice * 0.6);
        cars24Price = matchedJob.cars24PartialPrice ?? Math.round(cars24Price * 0.6);
      } else if (activeScope === 'INSIDE_JAMB') {
        retailPrice = matchedJob.retailInsidePrice ?? Math.round(retailPrice * 0.5);
        cars24Price = matchedJob.cars24InsidePrice ?? Math.round(cars24Price * 0.5);
      } else if (activeScope === 'FULL_OUTER_AND_INSIDE') {
        retailPrice = matchedJob.retailFullOuterInsidePrice ?? Math.round(retailPrice * 1.35);
        cars24Price = matchedJob.cars24FullOuterInsidePrice ?? Math.round(cars24Price * 1.35);
      }
    }

    const activePrice = isCars24 ? cars24Price : retailPrice;

    const retailPainterPayout = Math.round(matchedJob.retailPainterPayout ?? matchedJob.painterPayout ?? 950);
    const retailDenterPayout = Math.round(matchedJob.retailDenterPayout ?? matchedJob.denterPayout ?? 200);
    const retailContractorPayout = matchedJob.retailContractorPayout ? Math.round(matchedJob.retailContractorPayout) : (retailPainterPayout + retailDenterPayout);

    const cars24PainterPayout = Math.round(matchedJob.cars24PainterPayout ?? 800);
    const cars24DenterPayout = Math.round(matchedJob.cars24DenterPayout ?? 150);
    const cars24ContractorPayout = matchedJob.cars24ContractorPayout ? Math.round(matchedJob.cars24ContractorPayout) : (cars24PainterPayout + cars24DenterPayout);

    const painterPayout = isCars24 ? cars24PainterPayout : retailPainterPayout;
    const denterPayout = isCars24 ? cars24DenterPayout : retailDenterPayout;
    const contractorPayout = isCars24 ? cars24ContractorPayout : retailContractorPayout;

    return {
      standardJob: matchedJob,
      price: activePrice,
      retailPrice,
      cars24Price,
      retailPainterPayout,
      retailDenterPayout,
      retailContractorPayout,
      cars24PainterPayout,
      cars24DenterPayout,
      cars24ContractorPayout,
      painterPayout,
      denterPayout,
      contractorPayout,
    };
  }

  // Fallback if no matching standard job in table yet
  const baseRetail = Math.round(2000 * multiplier);
  const baseCars24 = Math.round(1350 * multiplier);
  const defaultBasePrice = isCars24 ? baseCars24 : baseRetail;

  return {
    price: defaultBasePrice,
    retailPrice: baseRetail,
    cars24Price: baseCars24,
    retailPainterPayout: 950,
    retailDenterPayout: 200,
    retailContractorPayout: 1150,
    cars24PainterPayout: 800,
    cars24DenterPayout: 150,
    cars24ContractorPayout: 950,
    painterPayout: isCars24 ? 800 : 950,
    denterPayout: isCars24 ? 150 : 200,
    contractorPayout: isCars24 ? 950 : 1150,
  };
}

export type PaintScope = 'FULL_OUTER' | 'PARTIAL_TOUCHUP' | 'INSIDE_JAMB' | 'FULL_OUTER_AND_INSIDE';

/**
 * Formats a clean, variable paint task title according to the chosen paint scope.
 * Example:
 *  "Door RHS Rear Full Outer Paint" + INSIDE_JAMB -> "Door RHS Rear Inside Paint Only"
 *  "Door RHS Rear (Full Outer Paint)" + PARTIAL_TOUCHUP -> "Door RHS Rear Partial Paint"
 */
export function formatPaintTaskTitle(panelNameOrTitle: string, scope: PaintScope): string {
  if (!panelNameOrTitle) return 'Panel Paint Job';

  // Strip existing scope phrases, parentheses, and generic paint/dent suffixes
  let baseName = panelNameOrTitle
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s*(Full Outer \+ Inside Paint|Full Outer Paint|Full Paint|Partial Paint|Inside Paint Only|Inside Paint|Outer \+ Inside Paint|Outer \+ Inside|Painting & Denting|Painting|Paint|Dent)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!baseName) {
    baseName = panelNameOrTitle.replace(/\s*\([^)]*\)\s*/g, ' ').trim() || 'Panel';
  }

  const scopeMap: Record<PaintScope, string> = {
    FULL_OUTER: 'Full Paint',
    PARTIAL_TOUCHUP: 'Partial Paint',
    INSIDE_JAMB: 'Inside Paint',
    FULL_OUTER_AND_INSIDE: 'Outer + Inside Paint'
  };

  const scopeSuffix = scopeMap[scope] || 'Full Paint';
  return `${baseName} ${scopeSuffix}`;
}
