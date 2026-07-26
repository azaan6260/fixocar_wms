import { JobCard, Employee, Vendor, DeliveryRecord, PurchaseOrder, JobTask, QCCheckitem, CityServiceOffering, ServiceBookingRequest, City, Workshop, TaskPartItem, TaskRequisition, TaskConcern, InventoryItem, InventoryConsumptionRecord, StandardJob, CustomerUser, CustomerVehicleRecord } from '../types';
import { INITIAL_JOB_CARDS, INITIAL_EMPLOYEES, INITIAL_VENDORS, INITIAL_DELIVERIES, INITIAL_PURCHASE_ORDERS, INITIAL_CITY_SERVICES, INITIAL_SERVICE_BOOKINGS, INITIAL_INVENTORY_ITEMS, INITIAL_STANDARD_JOBS } from './mockData';
import { getSupabaseClient } from './supabaseClient';

export const INITIAL_CITIES: City[] = [
  { id: 'city-mumbai', name: 'Mumbai', state: 'Maharashtra', createdAt: '2026-01-01' },
  { id: 'city-delhi', name: 'Delhi NCR', state: 'Delhi', createdAt: '2026-01-01' },
  { id: 'city-bangalore', name: 'Bengaluru', state: 'Karnataka', createdAt: '2026-01-01' },
  { id: 'city-pune', name: 'Pune', state: 'Maharashtra', createdAt: '2026-01-01' },
];

export const INITIAL_WORKSHOPS: Workshop[] = [
  {
    id: 'ws-mumbai-central',
    name: 'FixoCar Central Hub - Andheri',
    cityId: 'city-mumbai',
    cityName: 'Mumbai',
    address: 'Bay 12, Marol Industrial Area, Andheri East, Mumbai',
    phone: '+91 98200 11223',
    isCars24Partner: true, // Marked as Cars24 Partner Workshop
    managerName: 'Marcus Vance'
  },
  {
    id: 'ws-delhi-south',
    name: 'FixoCar Fleet Bay - Okhla',
    cityId: 'city-delhi',
    cityName: 'Delhi NCR',
    address: 'Phase III, Okhla Industrial Estate, New Delhi',
    phone: '+91 98110 33445',
    isCars24Partner: true, // Marked as Cars24 Partner Workshop
    managerName: 'Vikram Mehta'
  },
  {
    id: 'ws-bangalore-east',
    name: 'FixoCar Express - Whitefield',
    cityId: 'city-bangalore',
    cityName: 'Bengaluru',
    address: 'ITPL Main Rd, Hoodi, Bengaluru',
    phone: '+91 98450 55667',
    isCars24Partner: false,
    managerName: 'Anil Kumar'
  }
];

const STORAGE_KEYS = {
  JOB_CARDS: 'autocraft_job_cards_v1',
  EMPLOYEES: 'autocraft_employees_v1',
  VENDORS: 'autocraft_vendors_v1',
  DELIVERIES: 'autocraft_deliveries_v1',
  PURCHASE_ORDERS: 'autocraft_purchase_orders_v1',
  CITY_SERVICES: 'fixocar_city_services_v1',
  SERVICE_BOOKINGS: 'fixocar_service_bookings_v1',
  CITIES: 'fixocar_cities_v1',
  WORKSHOPS: 'fixocar_workshops_v1',
  INVENTORY: 'fixocar_inventory_v1',
  INVENTORY_CONSUMPTION: 'fixocar_inventory_consumption_v1',
  STANDARD_JOBS: 'fixocar_standard_jobs_v1',
  CUSTOMER_SESSION: 'fixocar_customer_session_v1',
  CUSTOMER_VEHICLES: 'fixocar_customer_vehicles_v1',
};

// Event listener mechanism for real-time UI updates across views
type StorageListener = () => void;
const listeners: Set<StorageListener> = new Set();

export function subscribeToStore(listener: StorageListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyStoreChange() {
  listeners.forEach(fn => fn());
}

// 1. JOB CARDS STORAGE
export function getJobCards(): JobCard[] {
  const local = localStorage.getItem(STORAGE_KEYS.JOB_CARDS);
  if (!local) {
    localStorage.setItem(STORAGE_KEYS.JOB_CARDS, JSON.stringify(INITIAL_JOB_CARDS));
    return INITIAL_JOB_CARDS;
  }
  try {
    return JSON.parse(local);
  } catch {
    return INITIAL_JOB_CARDS;
  }
}

export function saveJobCards(cards: JobCard[]) {
  localStorage.setItem(STORAGE_KEYS.JOB_CARDS, JSON.stringify(cards));
  notifyStoreChange();

  // Async sync to Supabase if connected
  const client = getSupabaseClient();
  if (client) {
    // Attempt best-effort background sync
    cards.forEach(card => {
      client.from('job_cards').upsert({
        id: card.id,
        registration_number: card.vehicle.registrationNumber,
        vehicle_make: card.vehicle.make,
        vehicle_model: card.vehicle.model,
        vehicle_year: card.vehicle.year,
        vehicle_color: card.vehicle.color,
        vehicle_vin: card.vehicle.vin,
        fuel_level: card.vehicle.fuelLevel,
        mileage: card.vehicle.mileage,
        customer_name: card.customer.name,
        customer_phone: card.customer.phone,
        customer_email: card.customer.email,
        customer_address: card.customer.address,
        status: card.status,
        service_type: card.serviceType,
        package_name: card.packageName,
        floor_manager_id: card.floorManagerId,
        pickup_requested: card.pickupRequested,
        delivery_requested: card.deliveryRequested,
        discount: card.discount,
        tax_rate: card.taxRate,
        advance_paid: card.advancePaid,
        qc_passed: card.qcPassed,
        qc_notes: card.qcNotes,
      }).then(({ error }) => {
        if (error) console.error('Supabase sync error (job_card):', error);
      });
    });
  }
}

export function getJobCardById(id: string): JobCard | undefined {
  return getJobCards().find(card => card.id === id);
}

export function createJobCard(newCard: Omit<JobCard, 'id' | 'createdAt'>): JobCard {
  const cards = getJobCards();
  const nextNum = cards.length + 105;
  const cardId = `JC-2026-${nextNum}`;
  const fullCard: JobCard = {
    ...newCard,
    id: cardId,
    createdAt: new Date().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }),
  };
  cards.unshift(fullCard);
  saveJobCards(cards);
  return fullCard;
}

export function updateJobCard(id: string, updater: (prev: JobCard) => JobCard) {
  const cards = getJobCards();
  const index = cards.findIndex(c => c.id === id);
  if (index !== -1) {
    cards[index] = updater(cards[index]);
    saveJobCards(cards);
  }
}

export function updateTaskStatus(jobCardId: string, taskId: string, newStatus: JobTask['status']) {
  updateJobCard(jobCardId, (card) => {
    const updatedTasks = card.tasks.map(task => {
      if (task.id === taskId) {
        return {
          ...task,
          status: newStatus,
          completedAt: newStatus === 'COMPLETED' ? new Date().toLocaleTimeString() : undefined
        };
      }
      return task;
    });

    // Auto-recalculate status: if all tasks done -> QC PENDING or READY
    const allDone = updatedTasks.every(t => t.status === 'COMPLETED' || t.status === 'ON_HOLD');
    let nextStatus = card.status;
    if (allDone && card.status === 'IN_PROGRESS') {
      nextStatus = 'QC_PENDING';
    }

    return {
      ...card,
      tasks: updatedTasks,
      status: nextStatus
    };
  });
}

export function respondToCustomerApproval(jobCardId: string, taskId: string, approved: boolean, reason?: string) {
  updateJobCard(jobCardId, (card) => {
    const updatedTasks = card.tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          isCustomerApproved: approved,
          rejectionReason: reason,
          status: approved ? ('IN_PROGRESS' as const) : ('ON_HOLD' as const)
        };
      }
      return t;
    });

    // Check if any estimate approvals are still pending
    const remainingPendingApprovals = updatedTasks.some(t => t.requiresCustomerApproval && t.isCustomerApproved === null);
    const nextStatus = remainingPendingApprovals ? 'ESTIMATE_PENDING' : 'IN_PROGRESS';

    return {
      ...card,
      tasks: updatedTasks,
      status: card.status === 'ESTIMATE_PENDING' ? nextStatus : card.status
    };
  });
}

export function updateQCChecklist(jobCardId: string, checklist: QCCheckitem[], notes: string) {
  const allPassed = checklist.length > 0 && checklist.every(i => i.isPassed);
  updateJobCard(jobCardId, (card) => {
    return {
      ...card,
      qcChecklist: checklist,
      qcNotes: notes,
      qcPassed: allPassed,
      qcPassedAt: allPassed ? new Date().toLocaleTimeString() : undefined,
      status: allPassed ? 'READY_FOR_DELIVERY' : 'QC_PENDING'
    };
  });
}

// Re-allot / reassign a task to another employee or sublet vendor
export function reallotTask(
  jobCardId: string, 
  taskId: string, 
  newAssigneeId: string, 
  newAssigneeName: string, 
  newAssigneeType: 'EMPLOYEE' | 'VENDOR'
) {
  updateJobCard(jobCardId, (card) => ({
    ...card,
    tasks: card.tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          assignedToId: newAssigneeId,
          assignedToName: newAssigneeName,
          assignedType: newAssigneeType,
          notes: (t.notes ? `${t.notes} | ` : '') + `Re-allotted to ${newAssigneeName} on ${new Date().toLocaleTimeString()}`
        };
      }
      return t;
    })
  }));
}

// Add a requisition for spare part, consumable, or additional work (raised by employee)
export function addRequisitionToTask(
  jobCardId: string,
  taskId: string,
  reqData: {
    requestedByEmployeeId: string;
    requestedByEmployeeName: string;
    title: string;
    itemType: 'PART' | 'CONSUMABLE' | 'ADDITIONAL_WORK';
    quantity: number;
    urgency?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    reason?: string;
    suggestedPrice?: number;
  }
) {
  const newReq: TaskRequisition = {
    id: `REQ-${Date.now().toString().slice(-6)}`,
    taskId,
    jobCardId,
    ...reqData,
    status: 'PENDING_APPROVAL',
    createdAt: new Date().toLocaleString(),
  };

  updateJobCard(jobCardId, (card) => ({
    ...card,
    tasks: card.tasks.map(t => {
      if (t.id === taskId) {
        const existingReqs = t.requisitions || [];
        return {
          ...t,
          requisitions: [newReq, ...existingReqs]
        };
      }
      return t;
    })
  }));

  return newReq;
}

// Approve or reject a requisition by Manager/Admin
export function respondToRequisition(
  jobCardId: string,
  taskId: string,
  requisitionId: string,
  approved: boolean,
  approvedPrice: number = 0,
  managerNotes?: string
) {
  updateJobCard(jobCardId, (card) => {
    let reqItemToConvert: TaskRequisition | null = null;

    const updatedTasks = card.tasks.map(t => {
      if (t.id === taskId) {
        const updatedReqs = (t.requisitions || []).map(r => {
          if (r.id === requisitionId) {
            reqItemToConvert = {
              ...r,
              status: approved ? ('APPROVED' as const) : ('REJECTED' as const),
              approvedPrice,
              managerNotes,
              approvedAt: new Date().toLocaleString()
            };
            return reqItemToConvert;
          }
          return r;
        });

        // If approved, automatically add to task's parts list
        let updatedParts = t.partsList || [];
        if (approved && reqItemToConvert) {
          const req = reqItemToConvert as TaskRequisition;
          const newPart: TaskPartItem = {
            id: `PRT-${Date.now().toString().slice(-6)}`,
            name: req.title,
            quantity: req.quantity,
            unitPrice: approvedPrice > 0 ? approvedPrice / req.quantity : 0,
            totalPrice: approvedPrice,
            type: req.itemType === 'CONSUMABLE' ? 'CONSUMABLE' : req.itemType === 'PART' ? 'PART' : 'LABOR',
            isApproved: true,
            addedAt: new Date().toLocaleString()
          };
          updatedParts = [...updatedParts, newPart];
        }

        return {
          ...t,
          requisitions: updatedReqs,
          partsList: updatedParts
        };
      }
      return t;
    });

    // If approved and is ADDITIONAL_WORK, also create a sub-task or update job card customer price
    if (approved && reqItemToConvert && (reqItemToConvert as TaskRequisition).itemType === 'ADDITIONAL_WORK' && approvedPrice > 0) {
      const req = reqItemToConvert as TaskRequisition;
      const additionalTask: JobTask = {
        id: `TSK-${Date.now().toString().slice(-6)}`,
        jobCardId,
        title: `[Add-on] ${req.title}`,
        category: 'MECHANICAL',
        assignedToId: req.requestedByEmployeeId,
        assignedToName: req.requestedByEmployeeName,
        assignedType: 'EMPLOYEE',
        estimatedCost: approvedPrice * 0.7,
        customerPrice: approvedPrice,
        status: 'IN_PROGRESS',
        requiresCustomerApproval: false,
        isCustomerApproved: true,
        isAdditionalWork: true,
        approvalStatus: 'APPROVED'
      };
      return {
        ...card,
        tasks: [...updatedTasks, additionalTask]
      };
    }

    return {
      ...card,
      tasks: updatedTasks
    };
  });
}

// Raise a concern / difficulty on a task by employee
export function addConcernToTask(
  jobCardId: string,
  taskId: string,
  concernData: {
    raisedByEmployeeId: string;
    raisedByEmployeeName: string;
    issueDescription: string;
    urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }
) {
  const newConcern: TaskConcern = {
    id: `CON-${Date.now().toString().slice(-6)}`,
    taskId,
    jobCardId,
    ...concernData,
    status: 'OPEN',
    createdAt: new Date().toLocaleString()
  };

  updateJobCard(jobCardId, (card) => ({
    ...card,
    tasks: card.tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          concerns: [newConcern, ...(t.concerns || [])]
        };
      }
      return t;
    })
  }));

  return newConcern;
}

// Resolve or acknowledge a concern by manager
export function resolveConcern(
  jobCardId: string,
  taskId: string,
  concernId: string,
  status: 'ACKNOWLEDGED' | 'RESOLVED',
  resolutionNotes?: string
) {
  updateJobCard(jobCardId, (card) => ({
    ...card,
    tasks: card.tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          concerns: (t.concerns || []).map(c => {
            if (c.id === concernId) {
              return {
                ...c,
                status,
                resolutionNotes
              };
            }
            return c;
          })
        };
      }
      return t;
    })
  }));
}

// Add parts or consumables directly to task
export function addPartToTask(
  jobCardId: string,
  taskId: string,
  partData: {
    name: string;
    quantity: number;
    unitPrice: number;
    partNumber?: string;
    type: 'PART' | 'CONSUMABLE' | 'LABOR';
  }
) {
  const totalPrice = partData.quantity * partData.unitPrice;
  const newPart: TaskPartItem = {
    id: `PRT-${Date.now().toString().slice(-6)}`,
    ...partData,
    totalPrice,
    isApproved: true,
    addedAt: new Date().toLocaleString()
  };

  updateJobCard(jobCardId, (card) => ({
    ...card,
    tasks: card.tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          partsList: [...(t.partsList || []), newPart]
        };
      }
      return t;
    })
  }));
}

// 2. EMPLOYEES STORAGE
export function getEmployees(): Employee[] {
  const local = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
  if (!local) {
    localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(INITIAL_EMPLOYEES));
    return INITIAL_EMPLOYEES;
  }
  try { return JSON.parse(local); } catch { return INITIAL_EMPLOYEES; }
}

export function saveEmployees(employees: Employee[]) {
  localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));
  notifyStoreChange();
}

export function createEmployee(employee: Omit<Employee, 'id'>): Employee {
  const employees = getEmployees();
  const newEmp: Employee = {
    ...employee,
    id: `emp-${Date.now().toString().slice(-4)}`
  };
  employees.push(newEmp);
  saveEmployees(employees);
  return newEmp;
}

export function updateEmployee(id: string, updates: Partial<Employee>) {
  const employees = getEmployees();
  const index = employees.findIndex(e => e.id === id);
  if (index !== -1) {
    employees[index] = { ...employees[index], ...updates };
    saveEmployees(employees);
  }
}

export function deleteEmployee(id: string) {
  const employees = getEmployees();
  saveEmployees(employees.filter(e => e.id !== id));
}

// 2b. ATTENDANCE STORAGE
export function getAttendances(): import('../types').AttendanceRecord[] {
  const local = localStorage.getItem('autocraft_attendance_v1');
  if (!local) return [];
  try { return JSON.parse(local); } catch { return []; }
}

export function saveAttendances(records: import('../types').AttendanceRecord[]) {
  localStorage.setItem('autocraft_attendance_v1', JSON.stringify(records));
  notifyStoreChange();
}

export function createAttendance(record: Omit<import('../types').AttendanceRecord, 'id'>) {
  const records = getAttendances();
  const newRecord: import('../types').AttendanceRecord = {
    ...record,
    id: `att-${Date.now()}`
  };
  records.unshift(newRecord);
  saveAttendances(records);
  return newRecord;
}

// 2c. SALARY STORAGE
export function getSalaries(): import('../types').SalaryRecord[] {
  const local = localStorage.getItem('autocraft_salaries_v1');
  if (!local) return [];
  try { return JSON.parse(local); } catch { return []; }
}

export function saveSalaries(records: import('../types').SalaryRecord[]) {
  localStorage.setItem('autocraft_salaries_v1', JSON.stringify(records));
  notifyStoreChange();
}

export function createSalaryRecord(record: Omit<import('../types').SalaryRecord, 'id'>) {
  const records = getSalaries();
  const newRecord: import('../types').SalaryRecord = {
    ...record,
    id: `sal-${Date.now()}`
  };
  records.unshift(newRecord);
  saveSalaries(records);
  return newRecord;
}

export function updateSalaryStatus(id: string, status: 'PENDING' | 'TRANSFERRED') {
  const records = getSalaries();
  const index = records.findIndex(r => r.id === id);
  if (index !== -1) {
    records[index].status = status;
    if (status === 'TRANSFERRED') records[index].transferDate = new Date().toISOString();
    saveSalaries(records);
  }
}

// 3. VENDORS STORAGE
export function getVendors(): Vendor[] {
  const local = localStorage.getItem(STORAGE_KEYS.VENDORS);
  if (!local) {
    localStorage.setItem(STORAGE_KEYS.VENDORS, JSON.stringify(INITIAL_VENDORS));
    return INITIAL_VENDORS;
  }
  try { return JSON.parse(local); } catch { return INITIAL_VENDORS; }
}

export function saveVendors(vendors: Vendor[]) {
  localStorage.setItem(STORAGE_KEYS.VENDORS, JSON.stringify(vendors));
  notifyStoreChange();
}

export function createVendor(vendor: Omit<Vendor, 'id'>): Vendor {
  const vendors = getVendors();
  const newVen: Vendor = {
    ...vendor,
    id: `ven-${Date.now().toString().slice(-4)}`
  };
  vendors.push(newVen);
  saveVendors(vendors);
  return newVen;
}

// 4. DELIVERIES STORAGE
export function getDeliveries(): DeliveryRecord[] {
  const local = localStorage.getItem(STORAGE_KEYS.DELIVERIES);
  if (!local) {
    localStorage.setItem(STORAGE_KEYS.DELIVERIES, JSON.stringify(INITIAL_DELIVERIES));
    return INITIAL_DELIVERIES;
  }
  try { return JSON.parse(local); } catch { return INITIAL_DELIVERIES; }
}

export function saveDeliveries(deliveries: DeliveryRecord[]) {
  localStorage.setItem(STORAGE_KEYS.DELIVERIES, JSON.stringify(deliveries));
  notifyStoreChange();
}

export function createDeliveryRecord(record: Omit<DeliveryRecord, 'id'>): DeliveryRecord {
  const deliveries = getDeliveries();
  const newDel: DeliveryRecord = {
    ...record,
    id: `del-${Date.now().toString().slice(-4)}`
  };
  deliveries.unshift(newDel);
  saveDeliveries(deliveries);

  // Update associated Job Card status
  updateJobCard(record.jobCardId, (card) => ({
    ...card,
    deliveryRecordId: newDel.id,
    status: 'OUT_FOR_DELIVERY'
  }));

  return newDel;
}

export function updateDeliveryStatus(
  deliveryId: string, 
  status: DeliveryRecord['status'], 
  paymentStatus?: DeliveryRecord['paymentStatus'],
  paymentMethod?: DeliveryRecord['paymentMethod']
) {
  const deliveries = getDeliveries();
  const index = deliveries.findIndex(d => d.id === deliveryId);
  if (index !== -1) {
    const del = deliveries[index];
    del.status = status;
    if (paymentStatus) del.paymentStatus = paymentStatus;
    if (paymentMethod) del.paymentMethod = paymentMethod;
    if (status === 'DELIVERED') {
      del.collectedAt = new Date().toLocaleTimeString();
      // Close job card
      updateJobCard(del.jobCardId, (card) => ({
        ...card,
        status: 'DELIVERED'
      }));
    }
    saveDeliveries(deliveries);
  }
}

// 5. PURCHASE ORDERS STORAGE
export function getPurchaseOrders(): PurchaseOrder[] {
  const local = localStorage.getItem(STORAGE_KEYS.PURCHASE_ORDERS);
  if (!local) {
    localStorage.setItem(STORAGE_KEYS.PURCHASE_ORDERS, JSON.stringify(INITIAL_PURCHASE_ORDERS));
    return INITIAL_PURCHASE_ORDERS;
  }
  try { return JSON.parse(local); } catch { return INITIAL_PURCHASE_ORDERS; }
}

export function createPurchaseOrder(po: Omit<PurchaseOrder, 'id' | 'createdAt'>): PurchaseOrder {
  const pos = getPurchaseOrders();
  const newPO: PurchaseOrder = {
    ...po,
    id: `PO-${Math.floor(1000 + Math.random() * 9000)}`,
    createdAt: new Date().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })
  };
  pos.unshift(newPO);
  localStorage.setItem(STORAGE_KEYS.PURCHASE_ORDERS, JSON.stringify(pos));

  // Update Vendor outstanding balance
  const vendors = getVendors();
  const vIndex = vendors.findIndex(v => v.id === po.vendorId);
  if (vIndex !== -1) {
    vendors[vIndex].outstandingBalance += po.amount;
    saveVendors(vendors);
  }

  notifyStoreChange();
  return newPO;
}

// 6. CITY SERVICES STORAGE (Admin pricing per city)
export function getCityServices(): CityServiceOffering[] {
  const local = localStorage.getItem(STORAGE_KEYS.CITY_SERVICES);
  if (!local) {
    localStorage.setItem(STORAGE_KEYS.CITY_SERVICES, JSON.stringify(INITIAL_CITY_SERVICES));
    return INITIAL_CITY_SERVICES;
  }
  try {
    return JSON.parse(local);
  } catch {
    return INITIAL_CITY_SERVICES;
  }
}

export function saveCityServices(services: CityServiceOffering[]) {
  localStorage.setItem(STORAGE_KEYS.CITY_SERVICES, JSON.stringify(services));
  notifyStoreChange();
}

export function updateCityServicePrice(serviceId: string, city: string, newPrice: number) {
  const services = getCityServices();
  const index = services.findIndex(s => s.id === serviceId);
  if (index !== -1) {
    services[index].cityPrices[city] = newPrice;
    saveCityServices(services);
  }
}

export function addCityService(service: Omit<CityServiceOffering, 'id'>): CityServiceOffering {
  const services = getCityServices();
  const newService: CityServiceOffering = {
    ...service,
    id: `srv-custom-${Date.now()}`
  };
  services.push(newService);
  saveCityServices(services);
  return newService;
}

// 7. SERVICE BOOKINGS & CUSTOMER ORDER TRACKING
export function getServiceBookings(): ServiceBookingRequest[] {
  const local = localStorage.getItem(STORAGE_KEYS.SERVICE_BOOKINGS);
  if (!local) {
    localStorage.setItem(STORAGE_KEYS.SERVICE_BOOKINGS, JSON.stringify(INITIAL_SERVICE_BOOKINGS));
    return INITIAL_SERVICE_BOOKINGS;
  }
  try {
    return JSON.parse(local);
  } catch {
    return INITIAL_SERVICE_BOOKINGS;
  }
}

export function saveServiceBookings(bookings: ServiceBookingRequest[]) {
  localStorage.setItem(STORAGE_KEYS.SERVICE_BOOKINGS, JSON.stringify(bookings));
  notifyStoreChange();
}

export function createCustomerBooking(bookingData: Omit<ServiceBookingRequest, 'id' | 'createdAt' | 'status'>): { booking: ServiceBookingRequest; jobCard: JobCard } {
  const bookings = getServiceBookings();
  const now = new Date();
  const bookingId = `BOOK-${Math.floor(100 + Math.random() * 900)}`;
  const jobCardId = `JC-${now.getFullYear()}-${Math.floor(200 + Math.random() * 800)}`;

  // Automatically create a corresponding JobCard for the workshop floor
  const newJobCard: JobCard = {
    id: jobCardId,
    createdAt: `${now.toISOString().split('T')[0]} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    estimatedCompletionDate: `${bookingData.preferredDate} 06:00 PM`,
    vehicle: {
      registrationNumber: bookingData.vehicleNumber,
      make: bookingData.vehicleMakeModel.split(' ')[0] || 'Car',
      model: bookingData.vehicleMakeModel,
      year: new Date().getFullYear(),
      color: 'Standard',
      fuelLevel: 50,
      mileage: 25000,
    },
    customer: {
      id: `cust-${Date.now()}`,
      name: bookingData.customerName,
      phone: bookingData.customerPhone,
      email: bookingData.customerEmail,
      address: `${bookingData.address}, ${bookingData.city}`,
    },
    status: 'ESTIMATE_PENDING',
    serviceType: 'STANDARD_PACKAGE',
    packageName: bookingData.serviceTitle,
    floorManagerId: 'emp-101',
    floorManagerName: 'Marcus Vance',
    pickupRequested: bookingData.pickupNeeded,
    deliveryRequested: bookingData.pickupNeeded,
    discount: 0,
    taxRate: 18,
    advancePaid: 0,
    tasks: [
      {
        id: `task-${jobCardId}-1`,
        jobCardId: jobCardId,
        title: `${bookingData.serviceTitle} (${bookingData.city} Booking)`,
        category: 'MECHANICAL',
        assignedToId: 'emp-102',
        assignedToName: 'Rajesh Sharma',
        assignedType: 'EMPLOYEE',
        estimatedCost: Math.round(bookingData.price * 0.5),
        customerPrice: bookingData.price,
        status: 'PENDING',
        requiresCustomerApproval: false,
        isCustomerApproved: true,
        notes: `Customer booking notes: ${bookingData.notes || 'None'}. Preferred slot: ${bookingData.preferredTimeSlot}`,
      }
    ],
    qcChecklist: [],
    qcPassed: false
  };

  const newBooking: ServiceBookingRequest = {
    ...bookingData,
    id: bookingId,
    createdAt: `${now.toISOString().split('T')[0]} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    status: 'BOOKED',
    createdJobCardId: jobCardId
  };

  saveJobCards([newJobCard, ...getJobCards()]);
  saveServiceBookings([newBooking, ...bookings]);

  return { booking: newBooking, jobCard: newJobCard };
}

export function resetToDefaultMockData() {
  localStorage.removeItem(STORAGE_KEYS.JOB_CARDS);
  localStorage.removeItem(STORAGE_KEYS.EMPLOYEES);
  localStorage.removeItem(STORAGE_KEYS.VENDORS);
  localStorage.removeItem(STORAGE_KEYS.DELIVERIES);
  localStorage.removeItem(STORAGE_KEYS.PURCHASE_ORDERS);
  localStorage.removeItem(STORAGE_KEYS.CITY_SERVICES);
  localStorage.removeItem(STORAGE_KEYS.SERVICE_BOOKINGS);
  localStorage.removeItem(STORAGE_KEYS.CITIES);
  localStorage.removeItem(STORAGE_KEYS.WORKSHOPS);
  notifyStoreChange();
}

// Clear all demo data completely for fresh Admin setup (Cities -> Workshops -> Employees -> Cards)
export function clearAllDemoData() {
  localStorage.setItem(STORAGE_KEYS.JOB_CARDS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.VENDORS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.DELIVERIES, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.PURCHASE_ORDERS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.SERVICE_BOOKINGS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.CITIES, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.WORKSHOPS, JSON.stringify([]));
  notifyStoreChange();
}

// 8. CITIES STORAGE
export function getCities(): City[] {
  const local = localStorage.getItem(STORAGE_KEYS.CITIES);
  if (!local) {
    localStorage.setItem(STORAGE_KEYS.CITIES, JSON.stringify(INITIAL_CITIES));
    return INITIAL_CITIES;
  }
  try {
    return JSON.parse(local);
  } catch {
    return INITIAL_CITIES;
  }
}

export function saveCities(cities: City[]) {
  localStorage.setItem(STORAGE_KEYS.CITIES, JSON.stringify(cities));
  notifyStoreChange();
}

export function addCity(cityName: string, stateName?: string): City {
  const cities = getCities();
  const id = `city-${Date.now()}`;
  const newCity: City = {
    id,
    name: cityName,
    state: stateName || '',
    createdAt: new Date().toISOString().split('T')[0]
  };
  const updated = [newCity, ...cities];
  saveCities(updated);
  return newCity;
}

export function deleteCity(id: string) {
  const cities = getCities().filter(c => c.id !== id);
  saveCities(cities);
}

// 9. WORKSHOPS STORAGE
export function getWorkshops(): Workshop[] {
  const local = localStorage.getItem(STORAGE_KEYS.WORKSHOPS);
  if (!local) {
    localStorage.setItem(STORAGE_KEYS.WORKSHOPS, JSON.stringify(INITIAL_WORKSHOPS));
    return INITIAL_WORKSHOPS;
  }
  try {
    return JSON.parse(local);
  } catch {
    return INITIAL_WORKSHOPS;
  }
}

export function saveWorkshops(workshops: Workshop[]) {
  localStorage.setItem(STORAGE_KEYS.WORKSHOPS, JSON.stringify(workshops));
  notifyStoreChange();
}

export function addWorkshop(wsData: Omit<Workshop, 'id'>): Workshop {
  const workshops = getWorkshops();
  const id = `ws-${Date.now()}`;
  const newWs: Workshop = {
    ...wsData,
    id,
    createdAt: new Date().toISOString().split('T')[0]
  };
  const updated = [newWs, ...workshops];
  saveWorkshops(updated);
  return newWs;
}

export function updateWorkshop(id: string, updates: Partial<Workshop>) {
  const workshops = getWorkshops();
  const idx = workshops.findIndex(w => w.id === id);
  if (idx !== -1) {
    workshops[idx] = { ...workshops[idx], ...updates };
    saveWorkshops(workshops);
  }
}

export function deleteWorkshop(id: string) {
  const workshops = getWorkshops().filter(w => w.id !== id);
  saveWorkshops(workshops);
}

// 10. INVENTORY STORAGE & CONSUMPTION MANAGEMENT
export function getInventoryItems(): InventoryItem[] {
  const local = localStorage.getItem(STORAGE_KEYS.INVENTORY);
  if (!local) {
    localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(INITIAL_INVENTORY_ITEMS));
    return INITIAL_INVENTORY_ITEMS;
  }
  try {
    return JSON.parse(local);
  } catch {
    return INITIAL_INVENTORY_ITEMS;
  }
}

export function saveInventoryItems(items: InventoryItem[]) {
  localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(items));
  notifyStoreChange();
}

export function addInventoryItem(itemData: Omit<InventoryItem, 'id'>): InventoryItem {
  const items = getInventoryItems();
  const id = `inv-${Date.now()}`;
  const newItem: InventoryItem = {
    ...itemData,
    id,
    lastRestockedAt: new Date().toISOString().split('T')[0]
  };
  const updated = [newItem, ...items];
  saveInventoryItems(updated);
  return newItem;
}

export function updateInventoryItem(id: string, updates: Partial<InventoryItem>) {
  const items = getInventoryItems();
  const idx = items.findIndex(i => i.id === id);
  if (idx !== -1) {
    items[idx] = { ...items[idx], ...updates };
    saveInventoryItems(items);
  }
}

export function restockInventoryItem(id: string, qtyToAdd: number) {
  const items = getInventoryItems();
  const idx = items.findIndex(i => i.id === id);
  if (idx !== -1 && qtyToAdd > 0) {
    items[idx].stockQuantity = Number(items[idx].stockQuantity || 0) + qtyToAdd;
    items[idx].lastRestockedAt = new Date().toISOString().split('T')[0];
    saveInventoryItems(items);
  }
}

export function deleteInventoryItem(id: string) {
  const items = getInventoryItems().filter(i => i.id !== id);
  saveInventoryItems(items);
}

// Inventory Consumption Logs
export function getInventoryConsumptionRecords(): InventoryConsumptionRecord[] {
  const local = localStorage.getItem(STORAGE_KEYS.INVENTORY_CONSUMPTION);
  if (!local) return [];
  try {
    return JSON.parse(local);
  } catch {
    return [];
  }
}

export function saveInventoryConsumptionRecords(records: InventoryConsumptionRecord[]) {
  localStorage.setItem(STORAGE_KEYS.INVENTORY_CONSUMPTION, JSON.stringify(records));
  notifyStoreChange();
}

// Direct Consumption of In-Stock Inventory from Job Card Task
export function consumeInventoryItemForTask(
  jobCardId: string,
  taskId: string,
  inventoryItemId: string,
  quantityToConsume: number,
  employeeId?: string,
  employeeName?: string
): { success: boolean; message: string } {
  const items = getInventoryItems();
  const itemIdx = items.findIndex(i => i.id === inventoryItemId);

  if (itemIdx === -1) {
    return { success: false, message: 'Selected item not found in workshop inventory.' };
  }

  const item = items[itemIdx];
  if (item.stockQuantity < quantityToConsume) {
    return { 
      success: false, 
      message: `Insufficient stock! Requested ${quantityToConsume} ${item.unit}, but only ${item.stockQuantity} ${item.unit} available in stock.` 
    };
  }

  // 1. Deduct stock from inventory
  item.stockQuantity -= quantityToConsume;
  items[itemIdx] = item;
  saveInventoryItems(items);

  // 2. Add as part/consumable under task parts list
  const cards = getJobCards();
  const cardIdx = cards.findIndex(c => c.id === jobCardId);
  if (cardIdx !== -1) {
    const card = cards[cardIdx];
    const taskIdx = card.tasks.findIndex(t => t.id === taskId);
    if (taskIdx !== -1) {
      const task = card.tasks[taskIdx];
      const existingParts = task.partsList || [];

      const newPart: TaskPartItem = {
        id: `part-${Date.now()}`,
        name: `${item.name} (${item.partNumber})`,
        quantity: quantityToConsume,
        unitPrice: item.sellingPrice,
        totalPrice: item.sellingPrice * quantityToConsume,
        partNumber: item.partNumber,
        type: item.category === 'CONSUMABLES' || item.category === 'OILS_LUBRICANTS' ? 'CONSUMABLE' : 'PART',
        isApproved: true,
        addedAt: new Date().toLocaleString()
      };

      task.partsList = [...existingParts, newPart];
      card.tasks[taskIdx] = task;
      cards[cardIdx] = card;
      saveJobCards(cards);
    }
  }

  // 3. Log consumption record
  const records = getInventoryConsumptionRecords();
  const newRecord: InventoryConsumptionRecord = {
    id: `cons-${Date.now()}`,
    inventoryItemId: item.id,
    itemName: item.name,
    jobCardId,
    taskId,
    quantityConsumed: quantityToConsume,
    unitPrice: item.sellingPrice,
    totalCost: item.sellingPrice * quantityToConsume,
    consumedByEmployeeId: employeeId,
    consumedByEmployeeName: employeeName,
    consumedAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
  };
  saveInventoryConsumptionRecords([newRecord, ...records]);

  return {
    success: true,
    message: `Successfully issued ${quantityToConsume} ${item.unit} of "${item.name}" directly from stock!`
  };
}

// ==========================================
// STANDARD JOBS & CONTRACTOR PAYOUTS MODULE
// ==========================================

export function getStandardJobs(): StandardJob[] {
  const data = localStorage.getItem(STORAGE_KEYS.STANDARD_JOBS);
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.STANDARD_JOBS, JSON.stringify(INITIAL_STANDARD_JOBS));
    return INITIAL_STANDARD_JOBS;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    return INITIAL_STANDARD_JOBS;
  }
}

export function saveStandardJobs(jobs: StandardJob[]): void {
  localStorage.setItem(STORAGE_KEYS.STANDARD_JOBS, JSON.stringify(jobs));
  notifyStoreChange();
}

export function addStandardJob(job: Omit<StandardJob, 'id'>): StandardJob {
  const jobs = getStandardJobs();
  const newJob: StandardJob = {
    ...job,
    id: `std-job-${Date.now()}`
  };
  saveStandardJobs([newJob, ...jobs]);
  return newJob;
}

export function updateStandardJob(id: string, updates: Partial<StandardJob>): StandardJob | null {
  const jobs = getStandardJobs();
  const idx = jobs.findIndex(j => j.id === id);
  if (idx === -1) return null;
  jobs[idx] = { ...jobs[idx], ...updates };
  saveStandardJobs(jobs);
  return jobs[idx];
}

export function deleteStandardJob(id: string): void {
  const jobs = getStandardJobs();
  const filtered = jobs.filter(j => j.id !== id);
  saveStandardJobs(filtered);
}

export function addStandardJobToJobCard(
  jobCardId: string, 
  standardJobId: string, 
  customAssignedId?: string
): JobTask | null {
  const cards = getJobCards();
  const cardIndex = cards.findIndex(c => c.id === jobCardId);
  if (cardIndex === -1) return null;

  const card = cards[cardIndex];
  const stdJobs = getStandardJobs();
  const stdJob = stdJobs.find(j => j.id === standardJobId);
  if (!stdJob) return null;

  // Dual pricing check: Cars24 B2B vs Retail
  const customerPrice = card.isCars24 ? stdJob.cars24Price : stdJob.retailPrice;
  
  let assignedType: 'EMPLOYEE' | 'VENDOR' = 'EMPLOYEE';
  let assignedName: string | undefined = undefined;

  if (customAssignedId) {
    const employees = getEmployees();
    const vendorList = getVendors();
    const emp = employees.find(e => e.id === customAssignedId);
    if (emp) {
      assignedType = 'EMPLOYEE';
      assignedName = emp.name;
    } else {
      const ven = vendorList.find(v => v.id === customAssignedId);
      if (ven) {
        assignedType = 'VENDOR';
        assignedName = ven.name;
      }
    }
  } else if (stdJob.category === 'SUBLET_VENDOR') {
    assignedType = 'VENDOR';
  }

  const newTask: JobTask = {
    id: `task-std-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    jobCardId,
    title: stdJob.title,
    category: stdJob.category,
    assignedToId: customAssignedId,
    assignedToName: assignedName,
    assignedType,
    estimatedCost: stdJob.isContractBasis ? stdJob.contractorPayout : Math.round(customerPrice * 0.5),
    customerPrice,
    status: 'PENDING',
    requiresCustomerApproval: false,
    isContractBasis: stdJob.isContractBasis,
    contractorPayout: stdJob.isContractBasis ? stdJob.contractorPayout : 0,
    painterPayout: stdJob.painterPayout || 0,
    denterPayout: stdJob.denterPayout || 0,
    standardJobId: stdJob.id,
    notes: `${card.isCars24 ? '⚡ Cars24 Fleet Standard Rate' : '🛒 Retail Customer Rate'} applied. ${stdJob.description || ''}`
  };

  card.tasks = [...(card.tasks || []), newTask];
  cards[cardIndex] = card;
  saveJobCards(cards);
  return newTask;
}

export interface ContractorPayoutRecord {
  jobCardId: string;
  jobCardNumber: string;
  vehicleReg: string;
  vehicleModel: string;
  isCars24: boolean;
  taskId: string;
  taskTitle: string;
  category: string;
  assignedToName?: string;
  assignedToId?: string;
  customerPrice: number;
  contractorPayout: number;
  painterPayout: number;
  denterPayout: number;
  workshopMargin: number;
  taskStatus: string;
  jobCardStatus: string;
  billFinalizedAt?: string;
}

export function getContractorPayoutsReport(): ContractorPayoutRecord[] {
  const cards = getJobCards();
  const records: ContractorPayoutRecord[] = [];

  cards.forEach(card => {
    card.tasks.forEach(task => {
      // Contract basis tasks (Denting, Paint, Sublet or marked isContractBasis)
      if (task.isContractBasis || task.category === 'DENTING' || task.category === 'PAINT' || (task.contractorPayout && task.contractorPayout > 0)) {
        const painter = task.painterPayout ?? (task.category === 'PAINT' ? Math.round(task.customerPrice * 0.45) : 0);
        const denter = task.denterPayout ?? (task.category === 'DENTING' ? Math.round(task.customerPrice * 0.35) : (task.category === 'PAINT' ? 150 : 0));
        const payout = task.contractorPayout || (painter + denter) || Math.round(task.customerPrice * 0.5);

        records.push({
          jobCardId: card.id,
          jobCardNumber: card.id,
          vehicleReg: card.vehicle.registrationNumber,
          vehicleModel: `${card.vehicle.make} ${card.vehicle.model}`,
          isCars24: card.isCars24 || false,
          taskId: task.id,
          taskTitle: task.title,
          category: task.category,
          assignedToName: task.assignedToName || 'Unassigned Contractor',
          assignedToId: task.assignedToId,
          customerPrice: task.customerPrice,
          contractorPayout: payout,
          painterPayout: painter,
          denterPayout: denter,
          workshopMargin: task.customerPrice - payout,
          taskStatus: task.status,
          jobCardStatus: card.status,
          billFinalizedAt: card.createdAt
        });
      }
    });
  });

  return records;
}

// -------------------------------------------------------------
// CUSTOMER SESSION & GARAGE VEHICLE MANAGEMENT STORAGE
// -------------------------------------------------------------

export const DEFAULT_CUSTOMER_SESSION: CustomerUser = {
  id: 'cust-demo-8819915656',
  name: 'Vikramaditya Singh',
  phone: '8819915656',
  email: 'vikram.singh@example.com',
  address: 'B-402, Seawoods Grand Central, Nerul, Navi Mumbai',
  city: 'Mumbai',
  isLoggedIn: true,
  loggedInAt: new Date().toISOString()
};

export const INITIAL_CUSTOMER_VEHICLES: CustomerVehicleRecord[] = [
  {
    id: 'veh-8819915656-1',
    customerPhone: '8819915656',
    registrationNumber: 'MH-02-DN-4521',
    make: 'Honda',
    model: 'City 1.5 i-VTEC',
    year: 2021,
    color: 'Taffeta White',
    fuelType: 'Petrol',
    mileage: 42000,
    vin: 'MA3E12345678901',
    notes: 'Primary personal sedan. Regular servicing done at FixoCar Andheri Hub.',
    addedAt: '2026-01-10'
  },
  {
    id: 'veh-8819915656-2',
    customerPhone: '8819915656',
    registrationNumber: 'DL-01-AB-1234',
    make: 'Maruti Suzuki',
    model: 'Swift ZXi',
    year: 2020,
    color: 'Solid Fire Red',
    fuelType: 'Petrol',
    mileage: 35500,
    vin: 'MA3F98765432109',
    notes: 'Family hatchback used for city commuting.',
    addedAt: '2026-02-01'
  },
  {
    id: 'veh-8819915656-3',
    customerPhone: '8819915656',
    registrationNumber: 'KA-05-MC-8899',
    make: 'Hyundai',
    model: 'Creta 1.5 SX',
    year: 2022,
    color: 'Sleek Silver',
    fuelType: 'Diesel',
    mileage: 28000,
    vin: 'MALC34567812345',
    notes: 'Outstation SUV.',
    addedAt: '2026-03-15'
  }
];

export function getCustomerSession(): CustomerUser {
  const local = localStorage.getItem(STORAGE_KEYS.CUSTOMER_SESSION);
  if (!local) {
    localStorage.setItem(STORAGE_KEYS.CUSTOMER_SESSION, JSON.stringify(DEFAULT_CUSTOMER_SESSION));
    return DEFAULT_CUSTOMER_SESSION;
  }
  try {
    return JSON.parse(local);
  } catch {
    return DEFAULT_CUSTOMER_SESSION;
  }
}

export function saveCustomerSession(user: CustomerUser): void {
  localStorage.setItem(STORAGE_KEYS.CUSTOMER_SESSION, JSON.stringify(user));
  notifyStoreChange();
}

export function logoutCustomerSession(): void {
  const loggedOut: CustomerUser = {
    id: '',
    name: '',
    phone: '',
    email: '',
    isLoggedIn: false
  };
  localStorage.setItem(STORAGE_KEYS.CUSTOMER_SESSION, JSON.stringify(loggedOut));
  notifyStoreChange();
}

export function getCustomerVehicles(customerPhone?: string): CustomerVehicleRecord[] {
  const local = localStorage.getItem(STORAGE_KEYS.CUSTOMER_VEHICLES);
  let vehicles: CustomerVehicleRecord[] = [];
  if (!local) {
    localStorage.setItem(STORAGE_KEYS.CUSTOMER_VEHICLES, JSON.stringify(INITIAL_CUSTOMER_VEHICLES));
    vehicles = INITIAL_CUSTOMER_VEHICLES;
  } else {
    try {
      vehicles = JSON.parse(local);
    } catch {
      vehicles = INITIAL_CUSTOMER_VEHICLES;
    }
  }

  if (customerPhone && customerPhone.trim()) {
    const query = customerPhone.replace(/\D/g, '');
    return vehicles.filter(v => v.customerPhone.replace(/\D/g, '').includes(query) || v.customerPhone === customerPhone);
  }

  return vehicles;
}

export function saveCustomerVehicles(vehicles: CustomerVehicleRecord[]): void {
  localStorage.setItem(STORAGE_KEYS.CUSTOMER_VEHICLES, JSON.stringify(vehicles));
  notifyStoreChange();
}

export function addCustomerVehicle(veh: Omit<CustomerVehicleRecord, 'id' | 'addedAt'>): CustomerVehicleRecord {
  const vehicles = getCustomerVehicles();
  const newVehRecord: CustomerVehicleRecord = {
    ...veh,
    id: `veh-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    addedAt: new Date().toISOString().split('T')[0]
  };
  vehicles.unshift(newVehRecord);
  saveCustomerVehicles(vehicles);
  return newVehRecord;
}

export function updateCustomerVehicle(id: string, updated: Partial<CustomerVehicleRecord>): CustomerVehicleRecord | null {
  const vehicles = getCustomerVehicles();
  const idx = vehicles.findIndex(v => v.id === id);
  if (idx === -1) return null;
  vehicles[idx] = { ...vehicles[idx], ...updated };
  saveCustomerVehicles(vehicles);
  return vehicles[idx];
}

export function deleteCustomerVehicle(id: string): void {
  const vehicles = getCustomerVehicles();
  const filtered = vehicles.filter(v => v.id !== id);
  saveCustomerVehicles(filtered);
}

