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
  | 'PARTS';

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD';

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
}
