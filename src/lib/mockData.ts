import { 
  Employee, Vendor, JobCard, StandardServicePackage, PurchaseOrder, 
  DeliveryRecord, CityServiceOffering, ServiceBookingRequest, InventoryItem, 
  StandardJob, VehicleCheckIn, Workshop 
} from '../types';

export const INITIAL_CITY_SERVICES: CityServiceOffering[] = [
  {
    id: 'srv-periodic-30',
    title: 'Comprehensive Periodic Service',
    category: 'MECHANICAL',
    tagline: 'Complete 30-Point Check, Synthetic Engine Oil, Oil & Air Filter Replacement, OBD-II Scan',
    description: 'Full periodic engine tune-up with synthetic oil flush, spark plug checks, brake pad wear inspection, coolant top-up, and eco steam wash.',
    estimatedHours: 3.5,
    isPopular: true,
    cityPrices: {
      'Mumbai': 3499,
      'Delhi NCR': 2999,
      'Bengaluru': 3299,
      'Hyderabad': 2899,
      'Pune': 2999,
      'Chennai': 2899,
      'Jaipur': 2499,
      'Ahmedabad': 2599,
      'Chandigarh': 2699,
      'Kolkata': 2799,
    },
    includedFeatures: [
      'Synthetic Engine Oil (up to 4L) & Filter Replacement',
      'Cabin Air Filter & Fuel Line Cleaning',
      '30-Point Computerized OBD-II Diagnostics Scan',
      'Brake Pad & Rotor Thickness Check',
      'Coolant, Brake Fluid & Battery Top-Up',
      'Complimentary Interior Vacuum & Eco Steam Wash'
    ]
  },
  {
    id: 'srv-ac-chilling',
    title: 'AC Deep Chilling & Gas Refill',
    category: 'MECHANICAL',
    tagline: 'High-grade R134a Gas Recharge, Condenser Cleaning, Leak Test & Antibacterial Treatment',
    description: 'Beat the heat with full AC system diagnostics, vacuum leak testing, condenser pressure wash, and fresh R134a gas recharge.',
    estimatedHours: 2,
    isPopular: true,
    cityPrices: {
      'Mumbai': 2499,
      'Delhi NCR': 2199,
      'Bengaluru': 2299,
      'Hyderabad': 1999,
      'Pune': 2099,
      'Chennai': 2199,
      'Jaipur': 1899,
      'Ahmedabad': 1999,
      'Chandigarh': 1999,
      'Kolkata': 2099,
    },
    includedFeatures: [
      'Environment Friendly R134a Gas Top-Up',
      'Compressor Oil & Leakage Vacuum Testing',
      'Condenser & Cooling Coil Pressure Wash',
      'AC Vent Antibacterial Foam Cleaning',
      'Cabin AC Dust Filter Cleaning / Replacement Check'
    ]
  },
  {
    id: 'srv-brake-alignment',
    title: 'Brake Overhaul & 3D Wheel Alignment',
    category: 'MECHANICAL',
    tagline: 'Front & Rear Brake Pad Renewal, Rotor Lathe Resurfacing & 3D Laser Alignment',
    description: 'Ensure maximum stopping safety and smooth steering stability with precision brake overhaul and 3D laser alignment.',
    estimatedHours: 3,
    isPopular: false,
    cityPrices: {
      'Mumbai': 4299,
      'Delhi NCR': 3899,
      'Bengaluru': 3999,
      'Hyderabad': 3699,
      'Pune': 3799,
      'Chennai': 3599,
      'Jaipur': 3299,
      'Ahmedabad': 3399,
      'Chandigarh': 3499,
      'Kolkata': 3499,
    },
    includedFeatures: [
      'Front Ceramic Brake Pad Replacement',
      'Brake Disc Rotor Skimming & Lathe Resurfacing',
      'Brake Fluid Bleeding & Flushing (DOT 4)',
      'Computerized 3D Laser Wheel Alignment',
      '4-Wheel Dynamic Balancing & Tire Rotation'
    ]
  },
  {
    id: 'srv-denting-painting',
    title: 'Panel Denting & Paint Restoration',
    category: 'PAINT',
    tagline: 'Precision Metal Pulling, Anti-Rust Primer & Heated Booth Metallic Painting',
    description: 'Flawless panel paint restoration using computerized color matching, anti-corrosion primer, and clear coat baking.',
    estimatedHours: 6,
    isPopular: true,
    cityPrices: {
      'Mumbai': 3200,
      'Delhi NCR': 2800,
      'Bengaluru': 2999,
      'Hyderabad': 2600,
      'Pune': 2700,
      'Chennai': 2600,
      'Jaipur': 2400,
      'Ahmedabad': 2500,
      'Chandigarh': 2500,
      'Kolkata': 2600,
    },
    includedFeatures: [
      'Panel Dent Pulling & Surface Leveling',
      'Anti-Rust Epoxy Primer Coat',
      '3-Layer High Temperature Baked Metallic Paint',
      '3M Buffing, Polishing & Clear Coat Sealant',
      '2-Year Paint Color Protection Warranty'
    ]
  },
  {
    id: 'srv-interior-detailing',
    title: 'Full Interior Spa & Ceramic Polishing',
    category: 'WASHING',
    tagline: 'Deep Upholstery Steam Wash, Dashboard Protection & Exterior Ceramic Shield',
    description: 'Transform your vehicle inside and out with deep interior foam extraction and hydrophobic paint ceramic polish.',
    estimatedHours: 4,
    isPopular: false,
    cityPrices: {
      'Mumbai': 3999,
      'Delhi NCR': 3499,
      'Bengaluru': 3699,
      'Hyderabad': 3299,
      'Pune': 3399,
      'Chennai': 3299,
      'Jaipur': 2999,
      'Ahmedabad': 3099,
      'Chandigarh': 3199,
      'Kolkata': 3199,
    },
    includedFeatures: [
      'Hot Steam Interior Upholstery Wash & Stain Removal',
      'Dashboard & Leather Trim UV Conditioning',
      'Ozone Sanitization & Odor Eliminator',
      'High-Gloss Paint Buffing & Ceramic Paste Wax',
      'Engine Bay Detailing & Rubber Dressing'
    ]
  },
  {
    id: 'srv-clutch-transmission',
    title: 'Clutch Assembly Overhaul',
    category: 'MECHANICAL',
    tagline: 'Clutch Plate & Pressure Plate Renewal, Release Bearing & Gear Oil Flush',
    description: 'Eliminate clutch slippage, harsh gear shifts, and poor pickup with genuine OEM clutch replacement.',
    estimatedHours: 5,
    isPopular: false,
    cityPrices: {
      'Mumbai': 8499,
      'Delhi NCR': 7499,
      'Bengaluru': 7999,
      'Hyderabad': 7299,
      'Pune': 7399,
      'Chennai': 7199,
      'Jaipur': 6899,
      'Ahmedabad': 6999,
      'Chandigarh': 7099,
      'Kolkata': 7199,
    },
    includedFeatures: [
      'OEM Clutch Plate & Pressure Plate Replacement',
      'Clutch Release Bearing Installation',
      'Flywheel Facing & Alignment Check',
      'Synthetic Gearbox Oil Flush & Refill',
      'Clutch Cable / Hydraulic Cylinder Bleeding'
    ]
  }
];

export const INITIAL_SERVICE_BOOKINGS: ServiceBookingRequest[] = [];

export const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: 'emp-admin',
    name: 'Super Admin',
    role: 'SUPER_ADMIN',
    phone: '',
    email: 'admin@fixocar.com',
    loginId: 'admin',
    password: 'password123',
    specializedTeam: 'Management',
    status: 'AVAILABLE',
    activeJobsCount: 0,
    employmentType: 'PAYROLL',
  }
];

export const INITIAL_VENDORS: Vendor[] = [];

export const INITIAL_WORKSHOPS: Workshop[] = [];

export const INITIAL_INVENTORY_ITEMS: InventoryItem[] = [];

export const INITIAL_STANDARD_JOBS: StandardJob[] = [];

export const STANDARD_PACKAGES: StandardServicePackage[] = [
  {
    id: 'pkg-full-service',
    name: 'Comprehensive Periodic Service (30-Point)',
    tagline: 'Complete mechanical tune-up, fluid replacement & 30-point safety check',
    basePrice: 3499,
    estimatedHours: 4,
    includedTasks: [
      { title: 'Engine Oil & Filter Replacement (Synthetic 5W-30)', category: 'MECHANICAL', defaultTeam: 'Mechanical', estimatedCost: 1200, price: 1850 },
      { title: 'Air Filter & Cabin AC Filter Replacement', category: 'MECHANICAL', defaultTeam: 'Mechanical', estimatedCost: 350, price: 650 },
      { title: 'Brake Pad & Rotor Wear Thickness Inspection', category: 'MECHANICAL', defaultTeam: 'Mechanical', estimatedCost: 200, price: 400 },
      { title: 'Spark Plug & Ignition Coil Test', category: 'MECHANICAL', defaultTeam: 'Mechanical', estimatedCost: 300, price: 500 },
      { title: 'Coolant & Transmission Fluid Top-up', category: 'MECHANICAL', defaultTeam: 'Mechanical', estimatedCost: 250, price: 450 },
      { title: '30-Point Computerized OBD-II Diagnostics Scan', category: 'INSPECTION', defaultTeam: 'Management', estimatedCost: 300, price: 600 },
      { title: 'Eco Steam Wash & Interior Vacuuming (Sublet)', category: 'WASHING', defaultTeam: 'Detailing & Washing', estimatedCost: 250, price: 500 },
    ]
  },
  {
    id: 'pkg-brake-suspension',
    name: 'Brake Overhaul & Suspension Alignment',
    tagline: 'Front & Rear brake pad renewal, rotor resurfacing and 3D wheel alignment',
    basePrice: 4299,
    estimatedHours: 5,
    includedTasks: [
      { title: 'Front Ceramic Brake Pad Replacement', category: 'MECHANICAL', defaultTeam: 'Mechanical', estimatedCost: 1400, price: 2200 },
      { title: 'Brake Disc Lathe Resurfacing (Sublet Lathe)', category: 'SUBLET_VENDOR', defaultTeam: 'Sublet / Lathe', estimatedCost: 600, price: 1100 },
      { title: 'Brake Fluid Flushing & Bleeding (DOT 4)', category: 'MECHANICAL', defaultTeam: 'Mechanical', estimatedCost: 300, price: 600 },
      { title: 'Suspension Bushing & Strut Inspection', category: 'MECHANICAL', defaultTeam: 'Mechanical', estimatedCost: 200, price: 450 },
      { title: '3D Laser Wheel Alignment & Balancing', category: 'MECHANICAL', defaultTeam: 'Mechanical', estimatedCost: 400, price: 850 },
    ]
  },
  {
    id: 'pkg-body-paint',
    name: 'Denting & Panel Paint Restoration',
    tagline: 'Precision metal pulling, primer coat & booth baked ceramic lacquer paint',
    basePrice: 3200,
    estimatedHours: 8,
    includedTasks: [
      { title: 'Panel Dent Pulling & Surface Leveling', category: 'DENTING', defaultTeam: 'Denting', estimatedCost: 800, price: 1500 },
      { title: 'Anti-Rust Epoxy Primer Application', category: 'PAINT', defaultTeam: 'Paint', estimatedCost: 400, price: 800 },
      { title: 'High-Temperature Baked Metallic Paint & Clear Coat', category: 'PAINT', defaultTeam: 'Paint', estimatedCost: 1200, price: 2200 },
      { title: '3M Buffing, Polishing & Paint Protection Sealant', category: 'PAINT', defaultTeam: 'Paint', estimatedCost: 300, price: 700 },
    ]
  }
];

export const INITIAL_DELIVERIES: DeliveryRecord[] = [];

export const INITIAL_PURCHASE_ORDERS: PurchaseOrder[] = [];

export const INITIAL_JOB_CARDS: JobCard[] = [];

export const INITIAL_VEHICLE_CHECKINS: VehicleCheckIn[] = [];
