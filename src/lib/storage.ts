import { JobCard, Employee, Vendor, DeliveryRecord, PurchaseOrder, JobTask, QCCheckitem, CityServiceOffering, ServiceBookingRequest } from '../types';
import { INITIAL_JOB_CARDS, INITIAL_EMPLOYEES, INITIAL_VENDORS, INITIAL_DELIVERIES, INITIAL_PURCHASE_ORDERS, INITIAL_CITY_SERVICES, INITIAL_SERVICE_BOOKINGS } from './mockData';
import { getSupabaseClient } from './supabaseClient';

const STORAGE_KEYS = {
  JOB_CARDS: 'autocraft_job_cards_v1',
  EMPLOYEES: 'autocraft_employees_v1',
  VENDORS: 'autocraft_vendors_v1',
  DELIVERIES: 'autocraft_deliveries_v1',
  PURCHASE_ORDERS: 'autocraft_purchase_orders_v1',
  CITY_SERVICES: 'fixocar_city_services_v1',
  SERVICE_BOOKINGS: 'fixocar_service_bookings_v1',
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
  notifyStoreChange();
}
