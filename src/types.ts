/**
 * AutoCraft Workshop Management Tool - TypeScript Definitions
 */

export type UserRole = 
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'FLOOR_MANAGER'
  | 'MECHANIC'
  | 'DENTER'
  | 'PAINTER'
  | 'DELIVERY_BOY'
  | 'VENDOR'
  | 'CUSTOMER';

export type SpecializedTeam = 
  | 'Mechanical'
  | 'Denting'
  | 'Paint'
  | 'Detailing & Washing'
  | 'Sublet / Lathe'
  | 'Logistics'
  | 'Management';

export type EmployeeStatus = 'AVAILABLE' | 'BUSY' | 'OFF_DUTY';

export interface City {
  id: string;
  name: string;
  state?: string;
  createdAt?: string;
}

export interface Workshop {
  id: string;
  name: string;
  cityId: string;
  cityName: string;
  address: string;
  phone: string;
  isCars24Partner: boolean; // Flag to activate workshop as Cars24 vendor partner
  managerName?: string;
  createdAt?: string;
}

export interface Employee {
  id: string;
  name: string;
  role: UserRole;
  phone: string;
  email: string;
  specializedTeam: SpecializedTeam;
  status: EmployeeStatus;
  avatarUrl?: string;
  activeJobsCount: number;
  loginId?: string;
  password?: string;
  baseSalary?: number;
  employmentType?: 'PAYROLL' | 'CONTRACT'; // Payroll (Full-Time) vs Contract Basis (Piece-rate per job)
  cityId?: string;
  cityName?: string;
  workshopId?: string;
  workshopName?: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  clockInTime?: string;
  clockOutTime?: string;
  status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE';
  clockInLocation?: string;
  clockOutLocation?: string;
  photoUrl?: string;
}

export interface SalaryRecord {
  id: string;
  employeeId: string;
  month: string; // YYYY-MM
  baseSalary: number;
  deductions: number;
  bonuses: number;
  netPay: number;
  status: 'PENDING' | 'TRANSFERRED';
  transferDate?: string;
}

export type InventoryCategory = 
  | 'SPARES'
  | 'CONSUMABLES'
  | 'OILS_LUBRICANTS'
  | 'TYRES_BATTERIES'
  | 'ELECTRICAL'
  | 'DETAILING_WASH'
  | 'TOOLS_EQUIPMENT';

export interface InventoryItem {
  id: string;
  name: string;
  partNumber: string;
  category: InventoryCategory;
  stockQuantity: number;
  unit: 'Pcs' | 'Liters' | 'Kgs' | 'Sets' | 'Packs' | 'Bottles' | 'Cans';
  minStockAlert: number;
  unitCost: number;       // Purchase / cost price
  sellingPrice: number;   // Customer billing price
  supplierVendorId?: string;
  supplierVendorName?: string;
  shelfLocation?: string;
  workshopId?: string;
  workshopName?: string;
  lastRestockedAt?: string;
}

export interface InventoryConsumptionRecord {
  id: string;
  inventoryItemId: string;
  itemName: string;
  jobCardId: string;
  taskId: string;
  quantityConsumed: number;
  unitPrice: number;
  totalCost: number;
  consumedByEmployeeId?: string;
  consumedByEmployeeName?: string;
  consumedAt: string;
}

export type VendorCategory = 
  | 'PARTS_SUPPLIER'
  | 'WASHING'
  | 'LATHE_WORK'
  | 'ELECTRICIAN'
  | 'ALIGNMENT'
  | 'OTHER';

export interface Vendor {
  id: string;
  name: string;
  category: VendorCategory;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  outstandingBalance: number;
  rating: number; // 1-5
}

export type JobCardStatus = 
  | 'CREATED'
  | 'INSPECTION'
  | 'JOB_ALLOCATED'
  | 'IN_PROGRESS'
  | 'ESTIMATE_PENDING'
  | 'QC_PENDING'
  | 'READY_FOR_DELIVERY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CLOSED';

export type TaskCategory = 
  | 'MECHANICAL'
  | 'DENTING'
  | 'PAINT'
  | 'SUBLET_VENDOR'
  | 'WASHING'
  | 'INSPECTION'
  | 'PARTS'
  | 'ACCESSORIES'
  | 'LATHE_WORK'
  | 'ALIGNMENT_BALANCING'
  | 'TYRE_WORK';

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD';

export interface TaskPartItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  partNumber?: string;
  type: 'PART' | 'CONSUMABLE' | 'LABOR';
  isApproved: boolean;
  addedAt: string;
}

export interface TaskRequisition {
  id: string;
  taskId: string;
  jobCardId: string;
  requestedByEmployeeId: string;
  requestedByEmployeeName: string;
  title: string;
  itemType: 'PART' | 'CONSUMABLE' | 'ADDITIONAL_WORK';
  quantity: number;
  urgency?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reason?: string;
  suggestedPrice?: number;
  approvedPrice?: number;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  managerNotes?: string;
  createdAt: string;
  approvedAt?: string;
}

export interface TaskConcern {
  id: string;
  taskId: string;
  jobCardId: string;
  raisedByEmployeeId: string;
  raisedByEmployeeName: string;
  issueDescription: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  resolutionNotes?: string;
  createdAt: string;
}

export interface JobTask {
  id: string;
  jobCardId: string;
  title: string;
  category: TaskCategory;
  assignedToId?: string; // Employee ID or Vendor ID
  assignedToName?: string;
  assignedType: 'EMPLOYEE' | 'VENDOR';
  estimatedCost: number;
  customerPrice: number;
  status: TaskStatus;
  requiresCustomerApproval: boolean;
  isCustomerApproved?: boolean | null; // true, false (rejected), null (pending)
  rejectionReason?: string;
  notes?: string;
  completedAt?: string;
  isAdditionalWork?: boolean; // Flagged when extra work is raised during repair
  additionalWorkRequestedBy?: string;
  additionalWorkRequestedAt?: string;
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  partsList?: TaskPartItem[];
  requisitions?: TaskRequisition[];
  concerns?: TaskConcern[];
  isContractBasis?: boolean;
  contractorPayout?: number;
  painterPayout?: number;
  denterPayout?: number;
  standardJobId?: string;
}

export interface QCCheckitem {
  id: string;
  label: string;
  category: 'ENGINE' | 'BODY' | 'INTERIOR' | 'ELECTRICAL' | 'TEST_DRIVE';
  isPassed: boolean;
  notes?: string;
}

export interface Vehicle {
  registrationNumber: string;
  make: string;
  model: string;
  year: number;
  color: string;
  vin?: string;
  fuelLevel: number; // percentage 0 - 100
  mileage: number; // in km
  photoUrl?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
}

export interface CustomerUser {
  id: string;
  name: string;
  phone: string;
  email: string;
  address?: string;
  city?: string;
  isLoggedIn: boolean;
  loggedInAt?: string;
}

export interface CustomerVehicleRecord {
  id: string;
  customerPhone: string;
  registrationNumber: string;
  make: string;
  model: string;
  year: number;
  color: string;
  fuelType: 'Petrol' | 'Diesel' | 'CNG' | 'EV' | 'Hybrid';
  mileage: number;
  vin?: string;
  notes?: string;
  addedAt: string;
}

export type DeliveryStatus = 
  | 'ASSIGNED'
  | 'EN_ROUTE_PICKUP'
  | 'VEHICLE_PICKED'
  | 'AT_WORKSHOP'
  | 'OUT_FOR_DELIVERY'
  | 'ARRIVED_AT_DESTINATION'
  | 'DELIVERED';

export type PaymentMethod = 'CASH' | 'CARD' | 'UPI' | 'ONLINE_LINK';
export type PaymentStatus = 'PENDING' | 'COLLECTED' | 'REFUNDED';

export interface DeliveryRecord {
  id: string;
  jobCardId: string;
  vehicleReg: string;
  customerName: string;
  customerPhone: string;
  deliveryBoyId: string;
  deliveryBoyName: string;
  deliveryBoyPhone: string;
  type: 'PICKUP' | 'DELIVERY';
  pickupAddress: string;
  deliveryAddress: string;
  status: DeliveryStatus;
  totalAmountDue: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  collectedAt?: string;
  currentLat: number;
  currentLng: number;
  destinationLat: number;
  destinationLng: number;
  etaMinutes: number;
  notes?: string;
}

export interface StandardJob {
  id: string;
  title: string;
  category: TaskCategory;
  retailPrice: number;    // Customer price for Retail vehicles
  cars24Price: number;    // B2B Customer price for Cars24 fleet
  isContractBasis: boolean; // True for Denting, Painting, Sublet
  // Retail Contract Rates
  retailPainterPayout?: number;  // Painter payout for Retail vehicles
  retailDenterPayout?: number;   // Denter payout for Retail vehicles
  retailContractorPayout?: number; // Combined payout for Retail
  // Cars24 Contract Rates
  cars24PainterPayout?: number;  // Painter payout for Cars24 fleet
  cars24DenterPayout?: number;   // Denter payout for Cars24 fleet
  cars24ContractorPayout?: number; // Combined payout for Cars24
  // General / Fallback Contract Rates
  contractorPayout: number; // Total direct payout reserved for painter + denter
  painterPayout?: number;   // Specific payout to Painter
  denterPayout?: number;    // Specific payout to Denter
  estimatedHours: number;
  description?: string;
}

export interface StandardServicePackage {
  id: string;
  name: string;
  tagline: string;
  basePrice: number;
  estimatedHours: number;
  includedTasks: {
    title: string;
    category: TaskCategory;
    defaultTeam: SpecializedTeam;
    estimatedCost: number;
    price: number;
  }[];
}

export interface PurchaseOrder {
  id: string;
  jobCardId: string;
  vehicleReg: string;
  vendorId: string;
  vendorName: string;
  category: VendorCategory;
  itemDescription: string;
  amount: number;
  status: 'ISSUED' | 'IN_TRANSIT' | 'DELIVERED' | 'PAID';
  createdAt: string;
}

export interface CityServiceOffering {
  id: string;
  title: string;
  category: TaskCategory;
  description: string;
  tagline: string;
  estimatedHours: number;
  cityPrices: Record<string, number>; // City Name -> Price in INR
  includedFeatures: string[];
  isPopular?: boolean;
}

export interface ServiceBookingRequest {
  id: string;
  city: string;
  serviceId: string;
  serviceTitle: string;
  price: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  vehicleNumber: string;
  vehicleMakeModel: string;
  preferredDate: string;
  preferredTimeSlot: string;
  address: string;
  pickupNeeded: boolean;
  notes?: string;
  createdAt: string;
  status: 'BOOKED' | 'CONFIRMED' | 'IN_REPAIR' | 'COMPLETED' | 'CANCELLED';
  createdJobCardId?: string;
}

export const INDIAN_CITIES = [
  'Mumbai',
  'Delhi NCR',
  'Bengaluru',
  'Hyderabad',
  'Pune',
  'Chennai',
  'Jaipur',
  'Ahmedabad',
  'Chandigarh',
  'Kolkata'
] as const;

export type IndianCity = typeof INDIAN_CITIES[number];

export interface JobCardComment {
  id: string;
  jobCardId: string;
  authorName: string;
  authorRole: string;
  text: string;
  timestamp: string;
}

export interface JobCard {
  id: string; // e.g. "JC-2026-104"
  createdAt: string;
  estimatedCompletionDate: string;
  vehicle: Vehicle;
  customer: Customer;
  status: JobCardStatus;
  serviceType: 'STANDARD_PACKAGE' | 'CUSTOM_REPAIR' | 'ACCIDENT_BODYWORK';
  packageName?: string;
  floorManagerId?: string;
  floorManagerName?: string;
  cityId?: string;
  cityName?: string;
  workshopId?: string;
  workshopName?: string;
  isCars24?: boolean; // Flag if this is a Cars24 fleet car
  cars24RefNo?: string;
  tasks: JobTask[];
  qcChecklist: QCCheckitem[];
  qcPassed: boolean;
  qcNotes?: string;
  qcPassedAt?: string;
  pickupRequested: boolean;
  deliveryRequested: boolean;
  deliveryRecordId?: string;
  discount: number;
  taxRate: number; // percentage e.g. 18
  advancePaid: number;
  notes?: string;
  comments?: JobCardComment[];
}
