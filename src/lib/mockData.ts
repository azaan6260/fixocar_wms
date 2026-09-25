import { 
  Employee, Vendor, JobCard, StandardServicePackage, PurchaseOrder, 
  DeliveryRecord, CityServiceOffering, ServiceBookingRequest, InventoryItem, 
  StandardJob, VehicleCheckIn, Workshop, City 
} from '../types';

export const INITIAL_CITY_SERVICES: CityServiceOffering[] = [];

export const INITIAL_SERVICE_BOOKINGS: ServiceBookingRequest[] = [];

export const INITIAL_CITIES: City[] = [
  { id: 'city-mumbai', name: 'Mumbai', state: 'Maharashtra', createdAt: '2025-01-01' },
  { id: 'city-delhi', name: 'Delhi NCR', state: 'Delhi', createdAt: '2025-01-01' },
  { id: 'city-bengaluru', name: 'Bengaluru', state: 'Karnataka', createdAt: '2025-01-01' },
  { id: 'city-hyderabad', name: 'Hyderabad', state: 'Telangana', createdAt: '2025-01-01' },
  { id: 'city-pune', name: 'Pune', state: 'Maharashtra', createdAt: '2025-01-01' },
  { id: 'city-chennai', name: 'Chennai', state: 'Tamil Nadu', createdAt: '2025-01-01' },
  { id: 'city-jaipur', name: 'Jaipur', state: 'Rajasthan', createdAt: '2025-01-01' },
  { id: 'city-ahmedabad', name: 'Ahmedabad', state: 'Gujarat', createdAt: '2025-01-01' },
  { id: 'city-chandigarh', name: 'Chandigarh', state: 'Punjab', createdAt: '2025-01-01' },
  { id: 'city-kolkata', name: 'Kolkata', state: 'West Bengal', createdAt: '2025-01-01' },
  { id: 'city-lucknow', name: 'Lucknow', state: 'Uttar Pradesh', createdAt: '2025-01-01' }
];

export const INITIAL_WORKSHOPS: Workshop[] = [
  { id: 'ws-mumbai-central', cityId: 'city-mumbai', cityName: 'Mumbai', name: 'FixoCar Mumbai Central Workshop', code: 'WS-MUM-01', address: 'Andheri East, Mumbai, MH', phone: '022-88990011', isCars24Partner: true, managerName: 'Taifur', createdAt: '2025-01-01' },
  { id: 'ws-delhi-hub', cityId: 'city-delhi', cityName: 'Delhi NCR', name: 'FixoCar Delhi NCR Hub', code: 'WS-DEL-01', address: 'Okhla Industrial Area, New Delhi', phone: '011-88990022', isCars24Partner: true, managerName: 'Rajesh Kumar', createdAt: '2025-01-01' },
  { id: 'ws-bengaluru-main', cityId: 'city-bengaluru', cityName: 'Bengaluru', name: 'FixoCar Bengaluru Tech Park Hub', code: 'WS-BLR-01', address: 'Whitefield, Bengaluru, KA', phone: '080-88990033', isCars24Partner: true, managerName: 'Anand V', createdAt: '2025-01-01' }
];

export const DEFAULT_SUPER_ADMIN: Employee = {
  id: 'emp-admin',
  name: 'Super Admin',
  role: 'SUPER_ADMIN',
  phone: '9820011223',
  email: 'admin@fixocar.com',
  specializedTeam: 'Management',
  status: 'AVAILABLE',
  activeJobsCount: 0,
  loginId: 'admin@fixocar.com',
  password: '123456',
  baseSalary: 120000,
  employmentType: 'PAYROLL'
};

export const TAIFUR_EMPLOYEE: Employee = {
  id: 'emp-taifur',
  name: 'Taifur',
  role: 'ADMIN',
  phone: '9820011224',
  email: 'taifur@fixocar.com',
  specializedTeam: 'Management',
  status: 'AVAILABLE',
  activeJobsCount: 0,
  loginId: 'taifur@fixocar.com',
  password: '123456',
  baseSalary: 80000,
  employmentType: 'PAYROLL'
};

export const INITIAL_EMPLOYEES: Employee[] = [
  DEFAULT_SUPER_ADMIN,
  TAIFUR_EMPLOYEE
];

export const INITIAL_VENDORS: Vendor[] = [];

export const INITIAL_INVENTORY_ITEMS: InventoryItem[] = [];

export const INITIAL_STANDARD_JOBS: StandardJob[] = [
  {
    id: 'std-bumper-front-full',
    title: 'Front Bumper (Full Outer Paint)',
    category: 'PAINT',
    panelKey: 'bumper_front',
    panelNameEn: 'Front Bumper',
    paintScope: 'FULL_OUTER',
    retailPrice: 2200,
    cars24Price: 1350,
    retailPartialPrice: 1300,
    cars24PartialPrice: 800,
    retailInsidePrice: 1100,
    cars24InsidePrice: 675,
    retailFullOuterInsidePrice: 2950,
    cars24FullOuterInsidePrice: 1800,
    isContractBasis: true,
    retailPainterPayout: 950,
    retailDenterPayout: 200,
    retailContractorPayout: 1150,
    cars24PainterPayout: 800,
    cars24DenterPayout: 150,
    cars24ContractorPayout: 950,
    contractorPayout: 950,
    estimatedHours: 4
  },
  {
    id: 'std-hood-bonnet-full',
    title: 'Hood / Bonnet (Full Outer Paint)',
    category: 'PAINT',
    panelKey: 'hood_bonnet',
    panelNameEn: 'Hood / Bonnet',
    paintScope: 'FULL_OUTER',
    retailPrice: 2500,
    cars24Price: 1350,
    retailPartialPrice: 1500,
    cars24PartialPrice: 800,
    retailInsidePrice: 1250,
    cars24InsidePrice: 675,
    retailFullOuterInsidePrice: 3350,
    cars24FullOuterInsidePrice: 1800,
    isContractBasis: true,
    retailPainterPayout: 950,
    retailDenterPayout: 200,
    retailContractorPayout: 1150,
    cars24PainterPayout: 800,
    cars24DenterPayout: 150,
    cars24ContractorPayout: 950,
    contractorPayout: 950,
    estimatedHours: 4
  },
  {
    id: 'std-fender-lhs-full',
    title: 'Left Front Fender (Full Outer Paint)',
    category: 'PAINT',
    panelKey: 'fender_lhs',
    panelNameEn: 'Left Front Fender',
    paintScope: 'FULL_OUTER',
    retailPrice: 1800,
    cars24Price: 1350,
    retailInsidePrice: 900,
    cars24InsidePrice: 675,
    retailFullOuterInsidePrice: 2400,
    cars24FullOuterInsidePrice: 1800,
    isContractBasis: true,
    retailPainterPayout: 950,
    retailDenterPayout: 200,
    retailContractorPayout: 1150,
    cars24PainterPayout: 800,
    cars24DenterPayout: 150,
    cars24ContractorPayout: 950,
    contractorPayout: 950,
    estimatedHours: 3
  },
  {
    id: 'std-fender-rhs-full',
    title: 'Right Front Fender (Full Outer Paint)',
    category: 'PAINT',
    panelKey: 'fender_rhs',
    panelNameEn: 'Right Front Fender',
    paintScope: 'FULL_OUTER',
    retailPrice: 1800,
    cars24Price: 1350,
    retailInsidePrice: 900,
    cars24InsidePrice: 675,
    retailFullOuterInsidePrice: 2400,
    cars24FullOuterInsidePrice: 1800,
    isContractBasis: true,
    retailPainterPayout: 950,
    retailDenterPayout: 200,
    retailContractorPayout: 1150,
    cars24PainterPayout: 800,
    cars24DenterPayout: 150,
    cars24ContractorPayout: 950,
    contractorPayout: 950,
    estimatedHours: 3
  },
  {
    id: 'std-roof-full',
    title: 'Roof Panel (Full Outer Paint)',
    category: 'PAINT',
    panelKey: 'roof',
    panelNameEn: 'Roof Panel',
    paintScope: 'FULL_OUTER',
    retailPrice: 3000,
    cars24Price: 1350,
    retailPartialPrice: 1800,
    cars24PartialPrice: 800,
    retailInsidePrice: 1500,
    cars24InsidePrice: 675,
    retailFullOuterInsidePrice: 4000,
    cars24FullOuterInsidePrice: 1800,
    isContractBasis: true,
    retailPainterPayout: 1100,
    retailDenterPayout: 300,
    retailContractorPayout: 1400,
    cars24PainterPayout: 800,
    cars24DenterPayout: 150,
    cars24ContractorPayout: 950,
    contractorPayout: 950,
    estimatedHours: 5
  },
  {
    id: 'std-door-lhs-front-full',
    title: 'Door LHS Front (Full Outer Paint)',
    category: 'PAINT',
    panelKey: 'door_lhs_front',
    panelNameEn: 'Door LHS Front',
    paintScope: 'FULL_OUTER',
    retailPrice: 2000,
    cars24Price: 1350,
    retailPartialPrice: 1200,
    cars24PartialPrice: 800,
    retailInsidePrice: 1000,
    cars24InsidePrice: 675,
    retailFullOuterInsidePrice: 2700,
    cars24FullOuterInsidePrice: 1800,
    isContractBasis: true,
    retailPainterPayout: 950,
    retailDenterPayout: 200,
    retailContractorPayout: 1150,
    cars24PainterPayout: 800,
    cars24DenterPayout: 150,
    cars24ContractorPayout: 950,
    contractorPayout: 950,
    estimatedHours: 4
  },
  {
    id: 'std-door-lhs-rear-full',
    title: 'Door LHS Rear (Full Outer Paint)',
    category: 'PAINT',
    panelKey: 'door_lhs_rear',
    panelNameEn: 'Door LHS Rear',
    paintScope: 'FULL_OUTER',
    retailPrice: 2000,
    cars24Price: 1350,
    retailPartialPrice: 1200,
    cars24PartialPrice: 800,
    retailInsidePrice: 1000,
    cars24InsidePrice: 675,
    retailFullOuterInsidePrice: 2700,
    cars24FullOuterInsidePrice: 1800,
    isContractBasis: true,
    retailPainterPayout: 950,
    retailDenterPayout: 200,
    retailContractorPayout: 1150,
    cars24PainterPayout: 800,
    cars24DenterPayout: 150,
    cars24ContractorPayout: 950,
    contractorPayout: 950,
    estimatedHours: 4
  },
  {
    id: 'std-running-board-lhs-full',
    title: 'Running Board LHS / Sill (Full Outer Paint)',
    category: 'PAINT',
    panelKey: 'running_board_lhs',
    panelNameEn: 'Running Board LHS / Sill',
    paintScope: 'FULL_OUTER',
    retailPrice: 1800,
    cars24Price: 1350,
    retailInsidePrice: 900,
    cars24InsidePrice: 675,
    retailFullOuterInsidePrice: 2400,
    cars24FullOuterInsidePrice: 1800,
    isContractBasis: true,
    retailPainterPayout: 950,
    retailDenterPayout: 200,
    retailContractorPayout: 1150,
    cars24PainterPayout: 800,
    cars24DenterPayout: 150,
    cars24ContractorPayout: 950,
    contractorPayout: 950,
    estimatedHours: 3
  },
  {
    id: 'std-quarter-panel-lhs-full',
    title: 'Quarter Panel LHS (Full Outer Paint)',
    category: 'PAINT',
    panelKey: 'quarter_panel_lhs',
    panelNameEn: 'Quarter Panel LHS',
    paintScope: 'FULL_OUTER',
    retailPrice: 2000,
    cars24Price: 1350,
    retailPartialPrice: 1200,
    cars24PartialPrice: 800,
    retailInsidePrice: 1000,
    cars24InsidePrice: 675,
    retailFullOuterInsidePrice: 2700,
    cars24FullOuterInsidePrice: 1800,
    isContractBasis: true,
    retailPainterPayout: 950,
    retailDenterPayout: 200,
    retailContractorPayout: 1150,
    cars24PainterPayout: 800,
    cars24DenterPayout: 150,
    cars24ContractorPayout: 950,
    contractorPayout: 950,
    estimatedHours: 4
  },
  {
    id: 'std-door-rhs-front-full',
    title: 'Door RHS Front (Full Outer Paint)',
    category: 'PAINT',
    panelKey: 'door_rhs_front',
    panelNameEn: 'Door RHS Front',
    paintScope: 'FULL_OUTER',
    retailPrice: 2000,
    cars24Price: 1350,
    retailPartialPrice: 1200,
    cars24PartialPrice: 800,
    retailInsidePrice: 1000,
    cars24InsidePrice: 675,
    retailFullOuterInsidePrice: 2700,
    cars24FullOuterInsidePrice: 1800,
    isContractBasis: true,
    retailPainterPayout: 950,
    retailDenterPayout: 200,
    retailContractorPayout: 1150,
    cars24PainterPayout: 800,
    cars24DenterPayout: 150,
    cars24ContractorPayout: 950,
    contractorPayout: 950,
    estimatedHours: 4
  },
  {
    id: 'std-door-rhs-rear-full',
    title: 'Door RHS Rear (Full Outer Paint)',
    category: 'PAINT',
    panelKey: 'door_rhs_rear',
    panelNameEn: 'Door RHS Rear',
    paintScope: 'FULL_OUTER',
    retailPrice: 2000,
    cars24Price: 1350,
    retailPartialPrice: 1200,
    cars24PartialPrice: 800,
    retailInsidePrice: 1000,
    cars24InsidePrice: 675,
    retailFullOuterInsidePrice: 2700,
    cars24FullOuterInsidePrice: 1800,
    isContractBasis: true,
    retailPainterPayout: 950,
    retailDenterPayout: 200,
    retailContractorPayout: 1150,
    cars24PainterPayout: 800,
    cars24DenterPayout: 150,
    cars24ContractorPayout: 950,
    contractorPayout: 950,
    estimatedHours: 4
  },
  {
    id: 'std-running-board-rhs-full',
    title: 'Running Board RHS / Sill (Full Outer Paint)',
    category: 'PAINT',
    panelKey: 'running_board_rhs',
    panelNameEn: 'Running Board RHS / Sill',
    paintScope: 'FULL_OUTER',
    retailPrice: 1800,
    cars24Price: 1350,
    retailInsidePrice: 900,
    cars24InsidePrice: 675,
    retailFullOuterInsidePrice: 2400,
    cars24FullOuterInsidePrice: 1800,
    isContractBasis: true,
    retailPainterPayout: 950,
    retailDenterPayout: 200,
    retailContractorPayout: 1150,
    cars24PainterPayout: 800,
    cars24DenterPayout: 150,
    cars24ContractorPayout: 950,
    contractorPayout: 950,
    estimatedHours: 3
  },
  {
    id: 'std-quarter-panel-rhs-full',
    title: 'Quarter Panel RHS (Full Outer Paint)',
    category: 'PAINT',
    panelKey: 'quarter_panel_rhs',
    panelNameEn: 'Quarter Panel RHS',
    paintScope: 'FULL_OUTER',
    retailPrice: 2000,
    cars24Price: 1350,
    retailPartialPrice: 1200,
    cars24PartialPrice: 800,
    retailInsidePrice: 1000,
    cars24InsidePrice: 675,
    retailFullOuterInsidePrice: 2700,
    cars24FullOuterInsidePrice: 1800,
    isContractBasis: true,
    retailPainterPayout: 950,
    retailDenterPayout: 200,
    retailContractorPayout: 1150,
    cars24PainterPayout: 800,
    cars24DenterPayout: 150,
    cars24ContractorPayout: 950,
    contractorPayout: 950,
    estimatedHours: 4
  },
  {
    id: 'std-boot-trunk-full',
    title: 'Boot Lid / Dicky Door (Full Outer Paint)',
    category: 'PAINT',
    panelKey: 'boot_trunk',
    panelNameEn: 'Boot Lid / Dicky Door',
    paintScope: 'FULL_OUTER',
    retailPrice: 2000,
    cars24Price: 1350,
    retailPartialPrice: 1200,
    cars24PartialPrice: 800,
    retailInsidePrice: 1000,
    cars24InsidePrice: 675,
    retailFullOuterInsidePrice: 2700,
    cars24FullOuterInsidePrice: 1800,
    isContractBasis: true,
    retailPainterPayout: 950,
    retailDenterPayout: 200,
    retailContractorPayout: 1150,
    cars24PainterPayout: 800,
    cars24DenterPayout: 150,
    cars24ContractorPayout: 950,
    contractorPayout: 950,
    estimatedHours: 4
  },
  {
    id: 'std-boot-floor-full',
    title: 'Dicky Boot Floor / Underbody (Internal Panel)',
    category: 'PAINT',
    panelKey: 'boot_floor',
    panelNameEn: 'Dicky Boot Floor / Underbody (Internal Panel)',
    paintScope: 'FULL_OUTER',
    retailPrice: 2000,
    cars24Price: 1350,
    retailPartialPrice: 1200,
    cars24PartialPrice: 800,
    retailInsidePrice: 1000,
    cars24InsidePrice: 675,
    retailFullOuterInsidePrice: 2700,
    cars24FullOuterInsidePrice: 1800,
    isContractBasis: true,
    retailPainterPayout: 950,
    retailDenterPayout: 200,
    retailContractorPayout: 1150,
    cars24PainterPayout: 800,
    cars24DenterPayout: 150,
    cars24ContractorPayout: 950,
    contractorPayout: 950,
    estimatedHours: 4
  },
  {
    id: 'std-bumper-rear-full',
    title: 'Rear Bumper (Full Outer Paint)',
    category: 'PAINT',
    panelKey: 'bumper_rear',
    panelNameEn: 'Rear Bumper',
    paintScope: 'FULL_OUTER',
    retailPrice: 2200,
    cars24Price: 1350,
    retailPartialPrice: 1300,
    cars24PartialPrice: 800,
    retailInsidePrice: 1100,
    cars24InsidePrice: 675,
    retailFullOuterInsidePrice: 2950,
    cars24FullOuterInsidePrice: 1800,
    isContractBasis: true,
    retailPainterPayout: 950,
    retailDenterPayout: 200,
    retailContractorPayout: 1150,
    cars24PainterPayout: 800,
    cars24DenterPayout: 150,
    cars24ContractorPayout: 950,
    contractorPayout: 950,
    estimatedHours: 4
  },
  {
    id: 'std-pillar-a',
    title: 'A-Pillar (Inside Paint Only)',
    category: 'PAINT',
    panelKey: 'pillar_a',
    panelNameEn: 'A-Pillar',
    paintScope: 'INSIDE_JAMB',
    retailPrice: 1000,
    cars24Price: 800,
    retailInsidePrice: 1000,
    cars24InsidePrice: 800,
    isContractBasis: true,
    retailPainterPayout: 600,
    retailDenterPayout: 100,
    retailContractorPayout: 700,
    cars24PainterPayout: 500,
    cars24DenterPayout: 100,
    cars24ContractorPayout: 600,
    contractorPayout: 600,
    estimatedHours: 2
  },
  {
    id: 'std-pillar-b',
    title: 'B-Pillar (Inside Paint Only)',
    category: 'PAINT',
    panelKey: 'pillar_b',
    panelNameEn: 'B-Pillar',
    paintScope: 'INSIDE_JAMB',
    retailPrice: 1000,
    cars24Price: 800,
    retailInsidePrice: 1000,
    cars24InsidePrice: 800,
    isContractBasis: true,
    retailPainterPayout: 600,
    retailDenterPayout: 100,
    retailContractorPayout: 700,
    cars24PainterPayout: 500,
    cars24DenterPayout: 100,
    cars24ContractorPayout: 600,
    contractorPayout: 600,
    estimatedHours: 2
  },
  {
    id: 'std-pillar-c',
    title: 'C-Pillar (Inside Paint Only)',
    category: 'PAINT',
    panelKey: 'pillar_c',
    panelNameEn: 'C-Pillar',
    paintScope: 'INSIDE_JAMB',
    retailPrice: 1000,
    cars24Price: 800,
    retailInsidePrice: 1000,
    cars24InsidePrice: 800,
    isContractBasis: true,
    retailPainterPayout: 600,
    retailDenterPayout: 100,
    retailContractorPayout: 700,
    cars24PainterPayout: 500,
    cars24DenterPayout: 100,
    cars24ContractorPayout: 600,
    contractorPayout: 600,
    estimatedHours: 2
  },
  {
    id: 'std-spoiler-full',
    title: 'Rear Spoiler (Full Paint)',
    category: 'PAINT',
    panelKey: 'spoiler',
    panelNameEn: 'Rear Spoiler',
    paintScope: 'FULL_OUTER',
    retailPrice: 1200,
    cars24Price: 900,
    retailPartialPrice: 800,
    cars24PartialPrice: 600,
    retailInsidePrice: 600,
    cars24InsidePrice: 450,
    retailFullOuterInsidePrice: 1600,
    cars24FullOuterInsidePrice: 1200,
    isContractBasis: true,
    retailPainterPayout: 600,
    retailDenterPayout: 100,
    retailContractorPayout: 700,
    cars24PainterPayout: 500,
    cars24DenterPayout: 100,
    cars24ContractorPayout: 600,
    contractorPayout: 600,
    estimatedHours: 2
  }
];

export const INITIAL_DELIVERIES: DeliveryRecord[] = [];

export const INITIAL_PURCHASE_ORDERS: PurchaseOrder[] = [];

export const INITIAL_JOB_CARDS: JobCard[] = [];

export const INITIAL_VEHICLE_CHECKINS: VehicleCheckIn[] = [];

export const STANDARD_PACKAGES: StandardServicePackage[] = [];

export const INITIAL_VEHICLE_PANELS: any[] = [
  {
    id: 'bumper_front',
    code: 'FB',
    nameEn: 'Front Bumper',
    nameHi: 'आगे का बंपर (Front Bumper)',
    standardJobId: 'std-bumper-front-full',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 140 30 C 180 15, 260 15, 300 30 C 310 38, 300 55, 290 55 C 240 45, 200 45, 150 55 C 140 55, 130 38, 140 30 Z'
    },
    labelPos: { x: 220, y: 38 },
    defaultPrice: 1350
  },
  {
    id: 'hood_bonnet',
    code: 'BONNET',
    nameEn: 'Hood / Bonnet',
    nameHi: 'बोनट / हुड (Bonnet)',
    standardJobId: 'std-hood-bonnet-full',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 152 60 C 190 52, 250 52, 288 60 L 280 135 C 240 130, 200 130, 160 135 Z'
    },
    labelPos: { x: 220, y: 95 },
    defaultPrice: 2200
  },
  {
    id: 'fender_lhs',
    code: 'F-LHS',
    nameEn: 'Left Front Fender',
    nameHi: 'बायां अगला फेंडर (Left Front Fender)',
    standardJobId: 'std-fender-lhs-full',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 132 38 L 148 58 L 158 135 L 132 135 C 125 100, 125 70, 132 38 Z'
    },
    labelPos: { x: 140, y: 90 },
    defaultPrice: 750
  },
  {
    id: 'fender_rhs',
    code: 'F-RHS',
    nameEn: 'Right Front Fender',
    nameHi: 'दायां अगला फेंडर (Right Front Fender)',
    standardJobId: 'std-fender-rhs-full',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 308 38 L 292 58 L 282 135 L 308 135 C 315 100, 315 70, 308 38 Z'
    },
    labelPos: { x: 300, y: 90 },
    defaultPrice: 750
  },
  {
    id: 'windshield_front',
    code: 'WS-FR',
    nameEn: 'Front Windshield Glass',
    nameHi: 'आगे का शीशा (Front Glass)',
    standardJobId: 'std-glass-front',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 163 140 C 200 136, 240 136, 277 140 L 270 180 C 235 178, 205 178, 170 180 Z'
    },
    labelPos: { x: 220, y: 160 },
    defaultPrice: 0
  },
  {
    id: 'roof',
    code: 'ROOF',
    nameEn: 'Roof Panel',
    nameHi: 'छत (Roof)',
    standardJobId: 'std-roof-full',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 172 185 C 205 182, 235 182, 268 185 L 268 290 C 235 293, 205 293, 172 290 Z'
    },
    labelPos: { x: 220, y: 238 },
    defaultPrice: 2600
  },
  {
    id: 'windshield_rear',
    code: 'WS-RR',
    nameEn: 'Rear Windshield Glass',
    nameHi: 'पीछे का शीशा (Rear Glass)',
    standardJobId: 'std-glass-rear',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 172 295 C 205 298, 235 298, 268 295 L 275 330 C 240 334, 200 334, 165 330 Z'
    },
    labelPos: { x: 220, y: 312 },
    defaultPrice: 0
  },
  {
    id: 'door_lhs_front',
    code: 'D-L-FR',
    nameEn: 'Door LHS Front',
    nameHi: 'बायां अगला दरवाजा (Left Front Door)',
    standardJobId: 'std-door-lhs-front-full',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 130 140 L 168 140 L 168 210 L 130 210 Z'
    },
    labelPos: { x: 148, y: 175 },
    defaultPrice: 1350
  },
  {
    id: 'door_lhs_rear',
    code: 'D-L-RR',
    nameEn: 'Door LHS Rear',
    nameHi: 'बायां पिछला दरवाजा (Left Rear Door)',
    standardJobId: 'std-door-lhs-rear-full',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 130 215 L 168 215 L 168 285 L 130 285 Z'
    },
    labelPos: { x: 148, y: 250 },
    defaultPrice: 1350
  },
  {
    id: 'running_board_lhs',
    code: 'RB-L',
    nameEn: 'Running Board LHS (Sill)',
    nameHi: 'बायां रनिंग बोर्ड / सिल (Left Running Board)',
    standardJobId: 'std-running-board-lhs-full',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 116 142 L 126 142 L 126 283 L 116 283 Z'
    },
    labelPos: { x: 104, y: 212 },
    defaultPrice: 750
  },
  {
    id: 'quarter_panel_lhs',
    code: 'QP-L',
    nameEn: 'Quarter Panel LHS',
    nameHi: 'बायां क्वार्टर पैनल (Left Quarter Panel)',
    standardJobId: 'std-quarter-panel-lhs-full',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 130 290 L 163 290 L 163 355 L 135 355 C 128 335, 126 310, 130 290 Z'
    },
    labelPos: { x: 146, y: 325 },
    defaultPrice: 1350
  },
  {
    id: 'door_rhs_front',
    code: 'D-R-FR',
    nameEn: 'Door RHS Front',
    nameHi: 'दायां अगला दरवाजा (Right Front Door)',
    standardJobId: 'std-door-rhs-front-full',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 272 140 L 310 140 L 310 210 L 272 210 Z'
    },
    labelPos: { x: 292, y: 175 },
    defaultPrice: 1350
  },
  {
    id: 'door_rhs_rear',
    code: 'D-R-RR',
    nameEn: 'Door RHS Rear',
    nameHi: 'दायां पिछला दरवाजा (Right Rear Door)',
    standardJobId: 'std-door-rhs-rear-full',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 272 215 L 310 215 L 310 285 L 272 285 Z'
    },
    labelPos: { x: 292, y: 250 },
    defaultPrice: 1350
  },
  {
    id: 'running_board_rhs',
    code: 'RB-R',
    nameEn: 'Running Board RHS (Sill)',
    nameHi: 'दायां रनिंग बोर्ड / सिल (Right Running Board)',
    standardJobId: 'std-running-board-rhs-full',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 314 142 L 324 142 L 324 283 L 314 283 Z'
    },
    labelPos: { x: 336, y: 212 },
    defaultPrice: 750
  },
  {
    id: 'quarter_panel_rhs',
    code: 'QP-R',
    nameEn: 'Quarter Panel RHS',
    nameHi: 'दायां क्वार्टर पैनल (Right Quarter Panel)',
    standardJobId: 'std-quarter-panel-rhs-full',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 277 290 L 310 290 C 314 310, 312 335, 305 355 L 277 355 Z'
    },
    labelPos: { x: 294, y: 325 },
    defaultPrice: 1350
  },
  {
    id: 'boot_trunk',
    code: 'DICKY',
    nameEn: 'Dicky Door / Boot Lid (Outer Panel)',
    nameHi: 'डिक्की का दरवाजा / बूट लिड (Dicky Door)',
    standardJobId: 'std-boot-trunk-full',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 166 332 C 200 335, 240 335, 274 332 L 280 358 C 240 361, 200 361, 160 358 Z'
    },
    labelPos: { x: 220, y: 345 },
    defaultPrice: 1350
  },
  {
    id: 'boot_floor',
    code: 'DICKY FLR',
    nameEn: 'Dicky Boot Floor / Underbody (Internal Panel)',
    nameHi: 'डिक्की का फर्श (Dicky Boot Floor)',
    standardJobId: 'std-boot-floor-full',
    view: 'TOP',
    svgShape: {
      type: 'rect',
      x: 172,
      y: 362,
      width: 96,
      height: 18,
      rx: 4
    },
    labelPos: { x: 220, y: 371 },
    defaultPrice: 300
  },
  {
    id: 'spoiler',
    code: 'SPOILER',
    nameEn: 'Rear Spoiler',
    nameHi: 'रियर स्पॉइलर (Rear Spoiler)',
    standardJobId: 'std-spoiler-full',
    view: 'TOP',
    svgShape: {
      type: 'rect',
      x: 172,
      y: 328,
      width: 96,
      height: 5,
      rx: 1
    },
    labelPos: { x: 220, y: 322 },
    defaultPrice: 1200
  },
  {
    id: 'bumper_rear',
    code: 'RB',
    nameEn: 'Rear Bumper',
    nameHi: 'पीछे का बंपर (Rear Bumper)',
    standardJobId: 'std-bumper-rear-full',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 140 398 C 180 410, 260 410, 300 398 C 308 393, 312 384, 304 384 C 260 393, 180 393, 136 384 C 128 384, 132 393, 140 398 Z'
    },
    labelPos: { x: 220, y: 397 },
    defaultPrice: 1350
  },
  {
    id: 'apron_lhs',
    code: 'APRON-L',
    nameEn: 'Apron LHS (Left Engine Bay)',
    nameHi: 'बायां अप्रन (Left Engine Apron)',
    standardJobId: 'std-apron-lhs-full',
    view: 'FRONT',
    svgShape: {
      type: 'rect',
      x: 155,
      y: 65,
      width: 25,
      height: 45,
      rx: 3
    },
    labelPos: { x: 167, y: 87 },
    defaultPrice: 1100
  },
  {
    id: 'apron_rhs',
    code: 'APRON-R',
    nameEn: 'Apron RHS (Right Engine Bay)',
    nameHi: 'दायां अप्रन (Right Engine Apron)',
    standardJobId: 'std-apron-rhs-full',
    view: 'FRONT',
    svgShape: {
      type: 'rect',
      x: 260,
      y: 65,
      width: 25,
      height: 45,
      rx: 3
    },
    labelPos: { x: 272, y: 87 },
    defaultPrice: 1100
  },
  {
    id: 'underbody',
    code: 'UNDERBODY',
    nameEn: 'Underbody Chassis Frame',
    nameHi: 'अंडरबॉडी चेसिस (Underbody Painting)',
    standardJobId: 'std-underbody-full',
    view: 'TOP',
    svgShape: {
      type: 'rect',
      x: 170,
      y: 190,
      width: 100,
      height: 95,
      rx: 6
    },
    labelPos: { x: 220, y: 238 },
    defaultPrice: 1800
  },
  {
    id: 'pillar_a',
    code: 'P-A',
    nameEn: 'A-Pillar',
    nameHi: 'ए-पिलर (A-Pillar - Inside Only)',
    standardJobId: 'std-pillar-a',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 152 140 L 162 140 L 170 180 L 160 180 Z M 278 140 L 288 140 L 280 180 L 270 180 Z'
    },
    labelPos: { x: 220, y: 124 },
    defaultPrice: 800
  },
  {
    id: 'pillar_b',
    code: 'P-B',
    nameEn: 'B-Pillar',
    nameHi: 'बी-पिलर (B-Pillar - Inside Only)',
    standardJobId: 'std-pillar-b',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 164 230 L 174 230 L 174 245 L 164 245 Z M 266 230 L 276 230 L 276 245 L 266 245 Z'
    },
    labelPos: { x: 220, y: 215 },
    defaultPrice: 800
  },
  {
    id: 'pillar_c',
    code: 'P-C',
    nameEn: 'C-Pillar',
    nameHi: 'सी-पिलर (C-Pillar - Inside Only)',
    standardJobId: 'std-pillar-c',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 166 290 L 174 290 L 164 330 L 156 330 Z M 266 290 L 274 290 L 284 330 L 276 330 Z'
    },
    labelPos: { x: 220, y: 326 },
    defaultPrice: 800
  }
];
