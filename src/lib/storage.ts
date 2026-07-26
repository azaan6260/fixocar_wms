import { JobCard, Employee, Vendor, DeliveryRecord, PurchaseOrder, JobTask, QCCheckitem } from '../types';
import { INITIAL_JOB_CARDS, INITIAL_EMPLOYEES, INITIAL_VENDORS, INITIAL_DELIVERIES, INITIAL_PURCHASE_ORDERS } from './mockData';
import { getSupabaseClient } from './supabaseClient';

const STORAGE_KEYS = {
  JOB_CARDS: 'autocraft_job_cards_v1',
  EMPLOYEES: 'autocraft_employees_v1',
  VENDORS: 'autocraft_vendors_v1',
  DELIVERIES: 'autocraft_deliveries_v1',
  PURCHASE_ORDERS: 'autocraft_purchase_orders_v1',
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

export function resetToDefaultMockData() {
  localStorage.removeItem(STORAGE_KEYS.JOB_CARDS);
  localStorage.removeItem(STORAGE_KEYS.EMPLOYEES);
  localStorage.removeItem(STORAGE_KEYS.VENDORS);
  localStorage.removeItem(STORAGE_KEYS.DELIVERIES);
  localStorage.removeItem(STORAGE_KEYS.PURCHASE_ORDERS);
  notifyStoreChange();
}
