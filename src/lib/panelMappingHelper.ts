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
  standardJobs?: StandardJob[]
): StandardJob | undefined {
  const jobs = (standardJobs && standardJobs.length > 0) ? standardJobs : getStandardJobs();
  const panelId = typeof panelIdOrPanel === 'string' ? panelIdOrPanel : panelIdOrPanel.id;
  const panelObj = typeof panelIdOrPanel === 'string' 
    ? VEHICLE_PANELS.find(p => p.id === panelId)
    : panelIdOrPanel;

  if (!panelId && !panelObj) return undefined;

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
 */
export function getPanelEnvironmentRates(
  panelIdOrPanel: string | PanelDefinition,
  standardJobs?: StandardJob[],
  isCars24: boolean = false
): PanelEnvironmentRates {
  const matchedJob = mapPanelToStandardJob(panelIdOrPanel, standardJobs);

  if (matchedJob) {
    const retailPrice = matchedJob.retailPrice ?? 2000;
    const cars24Price = matchedJob.cars24Price ?? 1350;
    const activePrice = isCars24 ? cars24Price : retailPrice;

    const retailPainterPayout = matchedJob.retailPainterPayout ?? matchedJob.painterPayout ?? 950;
    const retailDenterPayout = matchedJob.retailDenterPayout ?? matchedJob.denterPayout ?? 200;
    const retailContractorPayout = matchedJob.retailContractorPayout ?? (retailPainterPayout + retailDenterPayout);

    const cars24PainterPayout = matchedJob.cars24PainterPayout ?? 800;
    const cars24DenterPayout = matchedJob.cars24DenterPayout ?? 150;
    const cars24ContractorPayout = matchedJob.cars24ContractorPayout ?? (cars24PainterPayout + cars24DenterPayout);

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
  const defaultBasePrice = isCars24 ? 1350 : 2000;
  return {
    price: defaultBasePrice,
    retailPrice: 2000,
    cars24Price: 1350,
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
