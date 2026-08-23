import { JobCard, Employee, Vendor, DeliveryRecord, PurchaseOrder, JobTask, QCCheckitem, CityServiceOffering, ServiceBookingRequest, City, Workshop, TaskPartItem, TaskRequisition, TaskConcern, InventoryItem, InventoryConsumptionRecord, StandardJob, CustomerUser, CustomerVehicleRecord, JobCardComment, VehicleCheckIn, OutsourceStatus, RequisitionStatus, WorkshopExpense, CarModelRecord, FuelType, AuthUser } from '../types';
import { INITIAL_JOB_CARDS, INITIAL_EMPLOYEES, INITIAL_VENDORS, INITIAL_DELIVERIES, INITIAL_PURCHASE_ORDERS, INITIAL_CITY_SERVICES, INITIAL_SERVICE_BOOKINGS, INITIAL_INVENTORY_ITEMS, INITIAL_STANDARD_JOBS, INITIAL_VEHICLE_CHECKINS } from './mockData';
import { INITIAL_CAR_MODELS } from './carModelsData';
import { getSupabaseClient, syncEmployeeToSupabaseAuth, authenticateViaSupabase } from './supabaseClient';
import { ToastNotification, formatJobCardStatus } from '../types/toast';

export function dispatchToastNotification(notification: Omit<ToastNotification, 'id' | 'timestamp'>) {
  if (typeof window === 'undefined') return;
  const fullNotification: ToastNotification = {
    ...notification,
    id: `toast-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    read: false,
  };
  window.dispatchEvent(new CustomEvent('APP_TOAST_EVENT', { detail: fullNotification }));
}

export const INITIAL_CITIES: City[] = [
  { id: 'city-mumbai', name: 'Mumbai', state: 'Maharashtra', createdAt: '2026-01-01' },
  { id: 'city-delhi', name: 'Delhi NCR', state: 'Delhi', createdAt: '2026-01-01' },
  { id: 'city-bangalore', name: 'Bengaluru', state: 'Karnataka', createdAt: '2026-01-01' },
  { id: 'city-pune', name: 'Pune', state: 'Maharashtra', createdAt: '2026-01-01' },
];

export const INITIAL_WORKSHOPS: Workshop[] = [];

const STORAGE_KEYS = {
  JOB_CARDS: 'autocraft_job_cards_v4',
  EMPLOYEES: 'autocraft_employees_v4',
  VENDORS: 'autocraft_vendors_v4',
  DELIVERIES: 'autocraft_deliveries_v4',
  PURCHASE_ORDERS: 'autocraft_purchase_orders_v4',
  CITY_SERVICES: 'fixocar_city_services_v4',
  SERVICE_BOOKINGS: 'fixocar_service_bookings_v4',
  CITIES: 'fixocar_cities_v4',
  WORKSHOPS: 'fixocar_workshops_v4',
  INVENTORY: 'fixocar_inventory_v4',
  INVENTORY_CONSUMPTION: 'fixocar_inventory_consumption_v4',
  STANDARD_JOBS: 'fixocar_standard_jobs_v4',
  CUSTOMER_SESSION: 'fixocar_customer_session_v4',
  CUSTOMER_VEHICLES: 'fixocar_customer_vehicles_v4',
  VEHICLE_CHECKINS: 'fixocar_vehicle_checkins_v4',
  WORKSHOP_EXPENSES: 'fixocar_workshop_expenses_v4',
  CAR_MODELS: 'fixocar_car_models_v4',
  AUTH_USER: 'fixocar_auth_user_v4',
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
  if (local === null) {
    localStorage.setItem(STORAGE_KEYS.JOB_CARDS, JSON.stringify(INITIAL_JOB_CARDS));
    return INITIAL_JOB_CARDS;
  }
  try {
    return JSON.parse(local);
  } catch {
    return INITIAL_JOB_CARDS;
  }
}

export function saveJobCards(cards: JobCard[], skipPush = false) {
  localStorage.setItem(STORAGE_KEYS.JOB_CARDS, JSON.stringify(cards));
  notifyStoreChange();

  if (!skipPush) {
    // Async sync to Supabase if connected
    const client = getSupabaseClient();
    if (client) {
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
          if (error) {
            console.error('Supabase sync error (job_card):', error);
            dispatchToastNotification({
              type: 'ESTIMATE_DECLINED',
              title: `❌ Supabase Sync Error (Job Card)`,
              message: `Could not sync Job Card "${card.id}" to Supabase: ${error.message}`
            });
          } else {
            dispatchToastNotification({
              type: 'ESTIMATE_APPROVED',
              title: `✅ Saved to Supabase Database`,
              message: `Job Card "${card.id}" saved to Supabase database successfully.`
            });
          }
        });

        // Also upsert tasks
        if (card.tasks && card.tasks.length > 0) {
          card.tasks.forEach(t => {
            client.from('job_tasks').upsert({
              id: t.id,
              job_card_id: card.id,
              title: t.title,
              category: t.category,
              assigned_to_id: t.assignedToId,
              assigned_to_name: t.assignedToName,
              assigned_type: t.assignedType || 'EMPLOYEE',
              estimated_cost: t.estimatedCost || 0,
              customer_price: t.customerPrice || 0,
              status: t.status || 'PENDING',
              requires_customer_approval: t.requiresCustomerApproval || false,
              is_customer_approved: t.isCustomerApproved ?? null,
              rejection_reason: t.rejectionReason || null,
              notes: t.notes || '',
              completed_at: t.completedAt || null,
              is_additional_work: t.isAdditionalWork || false,
              additional_work_requested_by: t.additionalWorkRequestedBy || null,
              additional_work_requested_at: t.additionalWorkRequestedAt || null,
              approval_status: t.approvalStatus || 'PENDING'
            }).then(({ error }) => {
              if (error) console.warn(`Supabase task sync error (${t.id}):`, error.message);
            });
          });
        }
      });
    }
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

  dispatchToastNotification({
    type: 'JOB_CARD_CREATED',
    title: `📋 New Job Card Created: ${fullCard.id}`,
    message: `${fullCard.vehicle.registrationNumber} (${fullCard.vehicle.make} ${fullCard.vehicle.model}) registered for ${fullCard.customer.name}.`,
    vehicleReg: fullCard.vehicle.registrationNumber,
    jobCardId: fullCard.id,
    customerName: fullCard.customer.name,
  });

  return fullCard;
}

export function updateJobCard(id: string, updater: (prev: JobCard) => JobCard) {
  const cards = getJobCards();
  const index = cards.findIndex(c => c.id === id);
  if (index !== -1) {
    const oldCard = cards[index];
    const newCard = updater(oldCard);
    cards[index] = newCard;

    // 1. Detect vehicle pipeline status changes
    if (oldCard.status !== newCard.status) {
      const oldLabel = formatJobCardStatus(oldCard.status);
      const newLabel = formatJobCardStatus(newCard.status);
      dispatchToastNotification({
        type: 'STATUS_CHANGE',
        title: `🚘 Pipeline Status Updated: ${newCard.vehicle.registrationNumber}`,
        message: `${newCard.vehicle.make} ${newCard.vehicle.model} (${newCard.id}) moved from "${oldLabel}" ➔ "${newLabel}".`,
        vehicleReg: newCard.vehicle.registrationNumber,
        jobCardId: newCard.id,
        customerName: newCard.customer.name,
        oldStatus: oldCard.status,
        newStatus: newCard.status,
      });
    }

    // 2. Detect customer estimate approval/decline changes on tasks
    oldCard.tasks.forEach(oldTask => {
      const newTask = newCard.tasks.find(t => t.id === oldTask.id);
      if (newTask && oldTask.isCustomerApproved !== newTask.isCustomerApproved) {
        if (newTask.isCustomerApproved === true) {
          dispatchToastNotification({
            type: 'ESTIMATE_APPROVED',
            title: `✅ Customer Estimate Approved!`,
            message: `${newCard.customer.name} approved "${newTask.title}" (₹${(newTask.customerPrice || 0).toLocaleString('en-IN')}) for ${newCard.vehicle.registrationNumber}.`,
            vehicleReg: newCard.vehicle.registrationNumber,
            jobCardId: newCard.id,
            customerName: newCard.customer.name,
            amount: newTask.customerPrice || 0,
          });
        } else if (newTask.isCustomerApproved === false) {
          dispatchToastNotification({
            type: 'ESTIMATE_DECLINED',
            title: `❌ Customer Declined Estimate Item`,
            message: `${newCard.customer.name} declined "${newTask.title}" for ${newCard.vehicle.registrationNumber}${newTask.rejectionReason ? ` (${newTask.rejectionReason})` : ''}.`,
            vehicleReg: newCard.vehicle.registrationNumber,
            jobCardId: newCard.id,
            customerName: newCard.customer.name,
            amount: newTask.customerPrice || 0,
          });
        }
      }
    });

    saveJobCards(cards);
  }
}

export function addJobCardComment(jobCardId: string, comment: Omit<JobCardComment, 'id' | 'timestamp'>): JobCardComment {
  let createdComment: JobCardComment | null = null;
  updateJobCard(jobCardId, (card) => {
    const newComment: JobCardComment = {
      ...comment,
      id: `cmt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      jobCardId,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date().toLocaleDateString()
    };
    createdComment = newComment;
    return {
      ...card,
      comments: [newComment, ...(card.comments || [])]
    };
  });
  return createdComment!;
}

export function updateJobCardGSTInvoice(
  jobCardId: string,
  data: {
    workshopGstin?: string;
    customerGstin?: string;
    isInterstate?: boolean;
    stateCode?: string;
    invoiceNumber?: string;
    invoiceDate?: string;
    customItemTaxRates?: Record<string, { hsnCode: string; gstRate: number }>;
  }
) {
  updateJobCard(jobCardId, (card) => ({
    ...card,
    workshopGstin: data.workshopGstin ?? card.workshopGstin,
    customerGstin: data.customerGstin ?? card.customerGstin,
    isInterstate: data.isInterstate ?? card.isInterstate,
    stateCode: data.stateCode ?? card.stateCode,
    invoiceNumber: data.invoiceNumber ?? card.invoiceNumber,
    invoiceDate: data.invoiceDate ?? card.invoiceDate,
    customItemTaxRates: data.customItemTaxRates ?? card.customItemTaxRates
  }));
}

export function updateJobCardTask(jobCardId: string, taskId: string, updates: Partial<JobTask>) {
  updateJobCard(jobCardId, (card) => {
    const updatedTasks = card.tasks.map(task => {
      if (task.id === taskId) {
        return {
          ...task,
          ...updates
        };
      }
      return task;
    });

    return {
      ...card,
      tasks: updatedTasks
    };
  });
}

export function deleteJobCardTask(jobCardId: string, taskId: string) {
  updateJobCard(jobCardId, (card) => {
    return {
      ...card,
      tasks: card.tasks.filter(task => task.id !== taskId)
    };
  });
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

// Outsource a task to an external vendor
export function outsourceTaskToVendor(
  jobCardId: string,
  taskId: string,
  data: {
    vendorId: string;
    vendorName: string;
    outsourcedCost: number;
    expectedReturnDate?: string;
    outsourceNotes?: string;
  }
) {
  const challanNo = `CHN-${Date.now().toString().slice(-6)}`;
  const nowStr = new Date().toLocaleString();

  updateJobCard(jobCardId, (card) => ({
    ...card,
    tasks: card.tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          isOutsourced: true,
          assignedType: 'VENDOR',
          assignedToId: data.vendorId,
          assignedToName: data.vendorName,
          outsourcedVendorId: data.vendorId,
          outsourcedVendorName: data.vendorName,
          outsourcedCost: data.outsourcedCost,
          outsourceStatus: 'PENDING_DISPATCH',
          expectedReturnDate: data.expectedReturnDate,
          outsourceNotes: data.outsourceNotes,
          outsourceChallanNumber: challanNo,
          outsourcedAt: nowStr,
          estimatedCost: data.outsourcedCost || t.estimatedCost
        };
      }
      return t;
    })
  }));

  // Update vendor outstanding balance
  if (data.vendorId && data.outsourcedCost > 0) {
    const vendors = getVendors();
    const idx = vendors.findIndex(v => v.id === data.vendorId);
    if (idx !== -1) {
      vendors[idx].outstandingBalance = (vendors[idx].outstandingBalance || 0) + data.outsourcedCost;
      saveVendors(vendors);
    }
  }
}

// Update status of an outsourced task
export function updateTaskOutsourceStatus(
  jobCardId: string,
  taskId: string,
  data: {
    outsourceStatus: OutsourceStatus;
    vendorInvoiceNumber?: string;
    outsourceNotes?: string;
    outsourcedCost?: number;
  }
) {
  const nowStr = new Date().toLocaleString();

  updateJobCard(jobCardId, (card) => ({
    ...card,
    tasks: card.tasks.map(t => {
      if (t.id === taskId) {
        const isFinished = data.outsourceStatus === 'RECEIVED_BACK' || data.outsourceStatus === 'COMPLETED_BY_VENDOR';
        return {
          ...t,
          outsourceStatus: data.outsourceStatus,
          vendorInvoiceNumber: data.vendorInvoiceNumber || t.vendorInvoiceNumber,
          outsourceNotes: data.outsourceNotes || t.outsourceNotes,
          outsourcedCost: data.outsourcedCost !== undefined ? data.outsourcedCost : t.outsourcedCost,
          receivedBackAt: isFinished ? (t.receivedBackAt || nowStr) : t.receivedBackAt,
          status: isFinished ? 'COMPLETED' as const : t.status,
          completedAt: isFinished ? (t.completedAt || nowStr) : t.completedAt
        };
      }
      return t;
    })
  }));
}

// Cancel task outsourcing
export function cancelTaskOutsourcing(jobCardId: string, taskId: string) {
  updateJobCard(jobCardId, (card) => ({
    ...card,
    tasks: card.tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          isOutsourced: false,
          outsourceStatus: undefined,
          outsourcedVendorId: undefined,
          outsourcedVendorName: undefined
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
    partNumber?: string;
    inventoryItemId?: string;
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

        return {
          ...t,
          requisitions: updatedReqs
        };
      }
      return t;
    });

    // If approved and is ADDITIONAL_WORK, also create a sub-task
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

// Update requisition lifecycle stage (Mark as Ordered or Received)
export function markRequisitionStatus(
  jobCardId: string,
  taskId: string,
  requisitionId: string,
  nextStatus: 'ORDERED' | 'RECEIVED',
  managerNotes?: string
) {
  updateJobCard(jobCardId, (card) => ({
    ...card,
    tasks: card.tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          requisitions: (t.requisitions || []).map(r => {
            if (r.id === requisitionId) {
              const nowStr = new Date().toLocaleString();
              return {
                ...r,
                status: nextStatus,
                managerNotes: managerNotes || r.managerNotes,
                orderedAt: nextStatus === 'ORDERED' ? nowStr : r.orderedAt,
                receivedAt: nextStatus === 'RECEIVED' ? nowStr : r.receivedAt,
              };
            }
            return r;
          })
        };
      }
      return t;
    })
  }));
}

// Update Requisition with Market Runner Purchase details
export function updateRequisitionMarketPurchase(
  jobCardId: string,
  taskId: string,
  requisitionId: string,
  data: {
    nextStatus: RequisitionStatus;
    purchasedPrice?: number;
    vendorName?: string;
    vendorInvoiceNo?: string;
    managerNotes?: string;
  }
) {
  updateJobCard(jobCardId, (card) => ({
    ...card,
    tasks: card.tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          requisitions: (t.requisitions || []).map(r => {
            if (r.id === requisitionId) {
              const nowStr = new Date().toLocaleString();
              return {
                ...r,
                status: data.nextStatus,
                purchasedPrice: data.purchasedPrice !== undefined ? data.purchasedPrice : (r.purchasedPrice || r.approvedPrice),
                vendorName: data.vendorName || r.vendorName,
                vendorInvoiceNo: data.vendorInvoiceNo || r.vendorInvoiceNo,
                managerNotes: data.managerNotes || r.managerNotes,
                orderedAt: data.nextStatus === 'ORDERED' ? (r.orderedAt || nowStr) : r.orderedAt,
                receivedAt: data.nextStatus === 'RECEIVED' ? (r.receivedAt || nowStr) : r.receivedAt,
              };
            }
            return r;
          })
        };
      }
      return t;
    })
  }));
}

// Mechanic One-Click Consume Part function
export function consumeRequisitionPart(
  jobCardId: string,
  taskId: string,
  requisitionId: string,
  employeeId?: string,
  employeeName?: string
): { success: boolean; message: string } {
  let targetReq: TaskRequisition | null = null;
  const cards = getJobCards();
  const card = cards.find(c => c.id === jobCardId);
  if (!card) return { success: false, message: 'Job Card not found' };

  const task = card.tasks.find(t => t.id === taskId);
  if (!task) return { success: false, message: 'Task not found' };

  const req = (task.requisitions || []).find(r => r.id === requisitionId);
  if (!req) return { success: false, message: 'Requisition entry not found' };

  targetReq = req;

  // 1. If linked to an inventory item, deduct stock if available
  if (req.inventoryItemId) {
    const items = getInventoryItems();
    const itemIdx = items.findIndex(i => i.id === req.inventoryItemId);
    if (itemIdx !== -1) {
      const item = items[itemIdx];
      if (item.stockQuantity >= req.quantity) {
        item.stockQuantity -= req.quantity;
        items[itemIdx] = item;
        saveInventoryItems(items);
      }
    }
  }

  // 2. Mark requisition as CONSUMED and add part to task's partsList
  const nowStr = new Date().toLocaleString();
  const unitPrice = req.approvedPrice && req.quantity > 0 
    ? req.approvedPrice / req.quantity 
    : (req.suggestedPrice || 0);

  const totalPrice = req.approvedPrice || (unitPrice * req.quantity);

  const newPart: TaskPartItem = {
    id: `PRT-${Date.now().toString().slice(-6)}`,
    name: `${req.title}${req.partNumber ? ` (${req.partNumber})` : ''}`,
    quantity: req.quantity,
    unitPrice,
    totalPrice,
    type: req.itemType === 'CONSUMABLE' ? 'CONSUMABLE' : 'PART',
    isApproved: true,
    addedAt: nowStr
  };

  updateJobCard(jobCardId, (c) => ({
    ...c,
    tasks: c.tasks.map(t => {
      if (t.id === taskId) {
        const updatedReqs = (t.requisitions || []).map(r => {
          if (r.id === requisitionId) {
            return {
              ...r,
              status: 'CONSUMED' as const,
              consumedAt: nowStr
            };
          }
          return r;
        });

        // Avoid adding duplicate if already added
        const existingParts = t.partsList || [];
        const alreadyExists = existingParts.some(p => p.name.includes(req.title));
        const updatedParts = alreadyExists ? existingParts : [...existingParts, newPart];

        return {
          ...t,
          requisitions: updatedReqs,
          partsList: updatedParts
        };
      }
      return t;
    })
  }));

  // 3. Log consumption record
  const records = getInventoryConsumptionRecords();
  const newRecord: InventoryConsumptionRecord = {
    id: `cons-${Date.now()}`,
    inventoryItemId: req.inventoryItemId || `custom-${Date.now()}`,
    itemName: req.title,
    jobCardId,
    taskId,
    requisitionId: req.id,
    partNumber: req.partNumber,
    quantityConsumed: req.quantity,
    unitPrice,
    totalCost: totalPrice,
    consumedByEmployeeId: employeeId || req.requestedByEmployeeId,
    consumedByEmployeeName: employeeName || req.requestedByEmployeeName,
    consumedAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
  };
  saveInventoryConsumptionRecords([newRecord, ...records]);

  return {
    success: true,
    message: `Part "${req.title}" successfully consumed & attached to job card!`
  };
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
  let list: Employee[];
  if (local === null) {
    list = INITIAL_EMPLOYEES;
  } else {
    try { list = JSON.parse(local); } catch { list = INITIAL_EMPLOYEES; }
  }

  // Ensure default employmentType for denters/painters (CONTRACT) vs others (PAYROLL)
  let updated = false;
  const migrated = list.map(emp => {
    if (!emp.employmentType) {
      updated = true;
      const isContract = emp.role === 'DENTER' || emp.role === 'PAINTER' || 
                         emp.specializedTeam === 'Denting' || emp.specializedTeam === 'Paint';
      return { ...emp, employmentType: isContract ? ('CONTRACT' as const) : ('PAYROLL' as const) };
    }
    return emp;
  });

  if (local === null || updated) {
    localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(migrated));
  }
  return migrated;
}

export function saveEmployees(employees: Employee[], skipPush = false) {
  localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));
  notifyStoreChange();

  if (!skipPush) {
    const client = getSupabaseClient();
    if (client) {
      employees.forEach(emp => {
        const payload = {
          id: emp.id,
          name: emp.name,
          role: emp.role,
          phone: emp.phone,
          email: emp.email || `${emp.id}@workshop.fixocar.com`,
          specialized_team: emp.specializedTeam,
          status: emp.status || 'AVAILABLE',
          active_jobs_count: emp.activeJobsCount || 0,
          avatar_url: emp.avatarUrl,
          login_id: emp.loginId,
          password_hash: emp.password || 'password123',
          base_salary: emp.baseSalary || 0,
          employment_type: emp.employmentType || 'PAYROLL',
          city_id: emp.cityId,
          city_name: emp.cityName,
          workshop_id: emp.workshopId,
          workshop_name: emp.workshopName,
          updated_at: new Date().toISOString()
        };

        client.from('employees').upsert(payload).then(({ error }) => {
          if (error) {
            console.error('Supabase sync error (employees):', error);
            dispatchToastNotification({
              type: 'ESTIMATE_DECLINED',
              title: `❌ Supabase Sync Error (Employee)`,
              message: `Could not sync "${emp.name}" to Supabase: ${error.message}`
            });
          } else {
            dispatchToastNotification({
              type: 'ESTIMATE_APPROVED',
              title: `✅ Saved to Supabase Database`,
              message: `Employee "${emp.name}" saved to Supabase database successfully.`
            });
          }
        });

        syncEmployeeToSupabaseAuth(emp, emp.password, 'update');
      });
    }
  }
}

export function createEmployee(employee: Omit<Employee, 'id'>): Employee {
  const employees = getEmployees();
  const newEmp: Employee = {
    ...employee,
    id: `emp-${Date.now().toString().slice(-4)}`
  };
  employees.push(newEmp);
  saveEmployees(employees, false);
  syncEmployeeToSupabaseAuth(newEmp, newEmp.password, 'create').then((res) => {
    if (res && res.message) {
      console.log('Employee Auth create response:', res.message);
    }
  });
  return newEmp;
}

export function updateEmployee(id: string, updates: Partial<Employee>) {
  const employees = getEmployees();
  const index = employees.findIndex(e => e.id === id);
  if (index !== -1) {
    const updatedEmp = { ...employees[index], ...updates };
    employees[index] = updatedEmp;
    saveEmployees(employees, false);
    syncEmployeeToSupabaseAuth(updatedEmp, updatedEmp.password, 'update').then((res) => {
      if (res && res.message) {
        console.log('Employee Auth update response:', res.message);
      }
    });
  }
}

export function deleteEmployee(id: string) {
  const employees = getEmployees();
  const emp = employees.find(e => e.id === id);
  const remaining = employees.filter(e => e.id !== id);

  localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(remaining));
  notifyStoreChange();

  const client = getSupabaseClient();
  if (client && emp) {
    client.from('employees').delete().eq('id', id).then(({ error }) => {
      if (error) {
        dispatchToastNotification({
          type: 'ESTIMATE_DECLINED',
          title: `❌ Supabase Delete Error`,
          message: `Could not delete employee from Supabase: ${error.message}`
        });
      } else {
        dispatchToastNotification({
          type: 'ESTIMATE_APPROVED',
          title: `🗑️ Removed from Supabase`,
          message: `Employee "${emp.name}" removed from Supabase database.`
        });
      }
    });
    syncEmployeeToSupabaseAuth(emp, undefined, 'delete');
  }
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
  if (local === null) {
    localStorage.setItem(STORAGE_KEYS.VENDORS, JSON.stringify(INITIAL_VENDORS));
    return INITIAL_VENDORS;
  }
  try { return JSON.parse(local); } catch { return INITIAL_VENDORS; }
}

export function saveVendors(vendors: Vendor[], skipPush = false) {
  localStorage.setItem(STORAGE_KEYS.VENDORS, JSON.stringify(vendors));
  notifyStoreChange();

  if (!skipPush) {
    const client = getSupabaseClient();
    if (client) {
      vendors.forEach(v => {
        client.from('vendors').upsert({
          id: v.id,
          name: v.name,
          category: v.category,
          contact_person: v.contactPerson,
          phone: v.phone,
          email: v.email,
          address: v.address,
          outstanding_balance: v.outstandingBalance,
          rating: v.rating,
        }).then(({ error }) => {
          if (error) {
            console.error('Supabase sync error (vendors):', error);
            dispatchToastNotification({
              type: 'ESTIMATE_DECLINED',
              title: `❌ Supabase Sync Error (Vendors)`,
              message: `Could not sync "${v.name}" to Supabase: ${error.message}`
            });
          } else {
            dispatchToastNotification({
              type: 'ESTIMATE_APPROVED',
              title: `✅ Saved to Supabase Database`,
              message: `Vendor "${v.name}" saved to Supabase database successfully.`
            });
          }
        });
      });
    }
  }
}

export function createVendor(vendor: Omit<Vendor, 'id'>): Vendor {
  const vendors = getVendors();
  const newVen: Vendor = {
    ...vendor,
    id: `ven-${Date.now().toString().slice(-4)}`
  };
  vendors.push(newVen);
  saveVendors(vendors, false);
  return newVen;
}

export function deleteVendor(id: string) {
  const vendors = getVendors();
  const target = vendors.find(v => v.id === id);
  const remaining = vendors.filter(v => v.id !== id);
  localStorage.setItem(STORAGE_KEYS.VENDORS, JSON.stringify(remaining));
  notifyStoreChange();

  const client = getSupabaseClient();
  if (client) {
    client.from('vendors').delete().eq('id', id).then(({ error }) => {
      if (error) {
        dispatchToastNotification({
          type: 'ESTIMATE_DECLINED',
          title: `❌ Supabase Delete Error`,
          message: `Could not delete vendor from Supabase: ${error.message}`
        });
      } else if (target) {
        dispatchToastNotification({
          type: 'ESTIMATE_APPROVED',
          title: `🗑️ Removed from Supabase`,
          message: `Vendor "${target.name}" removed from Supabase database.`
        });
      }
    });
  }
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
  if (local === null) {
    localStorage.setItem(STORAGE_KEYS.CITIES, JSON.stringify(INITIAL_CITIES));
    return INITIAL_CITIES;
  }
  try {
    return JSON.parse(local);
  } catch {
    return INITIAL_CITIES;
  }
}

export function saveCities(cities: City[], skipPush = false) {
  localStorage.setItem(STORAGE_KEYS.CITIES, JSON.stringify(cities));
  notifyStoreChange();

  if (!skipPush) {
    const client = getSupabaseClient();
    if (client) {
      cities.forEach(city => {
        client.from('cities').upsert({
          id: city.id,
          name: city.name,
          state: city.state,
        }).then(({ error }) => {
          if (error) {
            console.error('Supabase sync error (cities):', error);
            dispatchToastNotification({
              type: 'ESTIMATE_DECLINED',
              title: `❌ Supabase Sync Error (Cities)`,
              message: `Could not sync "${city.name}" to Supabase: ${error.message}`
            });
          } else {
            dispatchToastNotification({
              type: 'ESTIMATE_APPROVED',
              title: `✅ Saved to Supabase Database`,
              message: `City "${city.name}" saved to Supabase database successfully.`
            });
          }
        });
      });
    }
  }
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
  const cities = getCities();
  const target = cities.find(c => c.id === id);
  const remaining = cities.filter(c => c.id !== id);
  localStorage.setItem(STORAGE_KEYS.CITIES, JSON.stringify(remaining));
  notifyStoreChange();

  const client = getSupabaseClient();
  if (client) {
    client.from('cities').delete().eq('id', id).then(({ error }) => {
      if (error) {
        dispatchToastNotification({
          type: 'ESTIMATE_DECLINED',
          title: `❌ Supabase Delete Error`,
          message: `Could not delete city from Supabase: ${error.message}`
        });
      } else if (target) {
        dispatchToastNotification({
          type: 'ESTIMATE_APPROVED',
          title: `🗑️ Removed from Supabase`,
          message: `City "${target.name}" removed from Supabase database.`
        });
      }
    });
  }
}

// 9. WORKSHOPS STORAGE
export function getWorkshops(): Workshop[] {
  const local = localStorage.getItem(STORAGE_KEYS.WORKSHOPS);
  if (local === null) {
    localStorage.setItem(STORAGE_KEYS.WORKSHOPS, JSON.stringify(INITIAL_WORKSHOPS));
    return INITIAL_WORKSHOPS;
  }
  try {
    return JSON.parse(local);
  } catch {
    return INITIAL_WORKSHOPS;
  }
}

export function saveWorkshops(workshops: Workshop[], skipPush = false) {
  localStorage.setItem(STORAGE_KEYS.WORKSHOPS, JSON.stringify(workshops));
  notifyStoreChange();

  if (!skipPush) {
    const client = getSupabaseClient();
    if (client) {
      workshops.forEach(ws => {
        const fullPayload = {
          id: ws.id,
          name: ws.name,
          city_id: ws.cityId,
          city_name: ws.cityName,
          code: ws.code || 'WS',
          address: ws.address || '',
          phone: ws.phone || '',
          is_cars24_partner: ws.isCars24Partner ?? false,
          manager_name: ws.managerName || '',
        };

        client.from('workshops').upsert(fullPayload).then(({ error }) => {
          if (error) {
            console.error('Supabase sync error (workshops):', error);
            
            // Fallback retry without optional columns if column missing in Supabase schema
            if (error.message?.includes('is_cars24_partner') || error.message?.includes('manager_name') || error.message?.includes('schema cache')) {
              const fallbackPayload = {
                id: ws.id,
                name: ws.name,
                city_id: ws.cityId,
                city_name: ws.cityName,
                code: ws.code || 'WS',
                address: ws.address || '',
                phone: ws.phone || ''
              };

              client.from('workshops').upsert(fallbackPayload).then(({ error: fallbackErr }) => {
                if (fallbackErr) {
                  dispatchToastNotification({
                    type: 'ESTIMATE_DECLINED',
                    title: `❌ Supabase Sync Error (Workshops)`,
                    message: `Could not sync "${ws.name}" to Supabase: ${fallbackErr.message}`
                  });
                } else {
                  dispatchToastNotification({
                    type: 'ESTIMATE_APPROVED',
                    title: `⚠️ Workshop Saved (Missing Column)`,
                    message: `"${ws.name}" saved to Supabase! To save Cars24 status, run SQL script in Database Settings.`
                  });
                }
              });
            } else {
              dispatchToastNotification({
                type: 'ESTIMATE_DECLINED',
                title: `❌ Supabase Sync Error (Workshops)`,
                message: `Could not sync "${ws.name}" to Supabase: ${error.message}`
              });
            }
          } else {
            dispatchToastNotification({
              type: 'ESTIMATE_APPROVED',
              title: `✅ Saved to Supabase Database`,
              message: `Workshop "${ws.name}" saved to Supabase database successfully.`
            });
          }
        });
      });
    }
  }
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
  const workshops = getWorkshops();
  const target = workshops.find(w => w.id === id);
  const remaining = workshops.filter(w => w.id !== id);
  localStorage.setItem(STORAGE_KEYS.WORKSHOPS, JSON.stringify(remaining));
  notifyStoreChange();

  const client = getSupabaseClient();
  if (client) {
    client.from('workshops').delete().eq('id', id).then(({ error }) => {
      if (error) {
        dispatchToastNotification({
          type: 'ESTIMATE_DECLINED',
          title: `❌ Supabase Delete Error`,
          message: `Could not delete workshop from Supabase: ${error.message}`
        });
      } else if (target) {
        dispatchToastNotification({
          type: 'ESTIMATE_APPROVED',
          title: `🗑️ Removed from Supabase`,
          message: `Workshop "${target.name}" removed from Supabase database.`
        });
      }
    });
  }
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
  let jobs: StandardJob[] = [];
  if (!data) {
    jobs = INITIAL_STANDARD_JOBS;
    localStorage.setItem(STORAGE_KEYS.STANDARD_JOBS, JSON.stringify(jobs));
    return jobs;
  } else {
    try {
      jobs = JSON.parse(data);
    } catch (e) {
      jobs = INITIAL_STANDARD_JOBS;
      localStorage.setItem(STORAGE_KEYS.STANDARD_JOBS, JSON.stringify(jobs));
      return jobs;
    }
  }

  // Ensure panelKey and panelNameEn are populated for legacy stored jobs if missing
  let updated = false;
  const synchronizedJobs = jobs.map(j => {
    if (!j.panelKey && j.id) {
      const matchInInitial = INITIAL_STANDARD_JOBS.find(initJ => initJ.id === j.id);
      if (matchInInitial && matchInInitial.panelKey) {
        updated = true;
        return {
          ...j,
          panelKey: matchInInitial.panelKey,
          panelNameEn: j.panelNameEn || matchInInitial.panelNameEn,
          paintScope: j.paintScope || matchInInitial.paintScope
        };
      }
    }
    return j;
  });

  if (updated) {
    localStorage.setItem(STORAGE_KEYS.STANDARD_JOBS, JSON.stringify(synchronizedJobs));
    return synchronizedJobs;
  }

  return jobs;
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
  customAssignedId?: string,
  customDenterId?: string
): JobTask[] | null {
  const cards = getJobCards();
  const cardIndex = cards.findIndex(c => c.id === jobCardId);
  if (cardIndex === -1) return null;

  const card = cards[cardIndex];
  const stdJobs = getStandardJobs();
  const stdJob = stdJobs.find(j => j.id === standardJobId);
  if (!stdJob) return null;

  // Dual pricing check: Cars24 B2B vs Retail
  const customerPrice = card.isCars24 ? stdJob.cars24Price : stdJob.retailPrice;
  const employees = getEmployees();
  const vendorList = getVendors();

  // Dual contract pricing check: Cars24 vs Retail
  const painterPayout = card.isCars24
    ? (stdJob.cars24PainterPayout ?? stdJob.painterPayout ?? 800)
    : (stdJob.retailPainterPayout ?? stdJob.painterPayout ?? 950);

  const denterPayout = card.isCars24
    ? (stdJob.cars24DenterPayout ?? stdJob.denterPayout ?? 150)
    : (stdJob.retailDenterPayout ?? stdJob.denterPayout ?? 200);

  const contractorPayout = card.isCars24
    ? (stdJob.cars24ContractorPayout ?? stdJob.contractorPayout ?? (painterPayout + denterPayout))
    : (stdJob.retailContractorPayout ?? stdJob.contractorPayout ?? (painterPayout + denterPayout));

  const createdTasks: JobTask[] = [];

  let assignedType: 'EMPLOYEE' | 'VENDOR' = 'EMPLOYEE';
  let assignedName: string | undefined = undefined;

  if (customAssignedId) {
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
  } else if (stdJob.category === 'PAINT') {
    const painterEmp = employees.find(e => e.role === 'PAINTER' || e.specializedTeam === 'Paint');
    if (painterEmp) {
      assignedName = painterEmp.name;
      customAssignedId = painterEmp.id;
    }
  } else if (stdJob.category === 'SUBLET_VENDOR' || stdJob.category === 'LATHE_WORK') {
    assignedType = 'VENDOR';
    const ven = vendorList[0];
    if (ven) {
      assignedName = ven.name;
    }
  }

  const newTask: JobTask = {
    id: `task-std-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    jobCardId,
    title: stdJob.title,
    category: stdJob.category,
    panelKey: stdJob.panelKey,
    panelNameEn: stdJob.panelNameEn,
    paintScope: stdJob.paintScope,
    assignedToId: customAssignedId,
    assignedToName: assignedName,
    assignedType,
    estimatedCost: stdJob.isContractBasis ? contractorPayout : Math.round(customerPrice * 0.5),
    customerPrice,
    status: 'PENDING',
    requiresCustomerApproval: false,
    isContractBasis: stdJob.isContractBasis,
    contractorPayout: stdJob.isContractBasis ? contractorPayout : 0,
    painterPayout: painterPayout,
    denterPayout: denterPayout,
    standardJobId: stdJob.id,
    notes: `${card.isCars24 ? '⚡ Cars24 Fleet Contract Rate' : '🛒 Retail Customer Rate'} applied. ${stdJob.description || ''}`
  };
  createdTasks.push(newTask);

  card.tasks = [...(card.tasks || []), ...createdTasks];
  cards[cardIndex] = card;
  saveJobCards(cards);
  return createdTasks;
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
  id: '',
  name: '',
  phone: '',
  email: '',
  isLoggedIn: false
};

export const INITIAL_CUSTOMER_VEHICLES: CustomerVehicleRecord[] = [];

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

// ----------------------------------------------------
// VEHICLE GATE CHECK-IN & WORKSHOP PRESENCE STORAGE
// ----------------------------------------------------
export function getVehicleCheckIns(): VehicleCheckIn[] {
  const local = localStorage.getItem(STORAGE_KEYS.VEHICLE_CHECKINS);
  if (!local) {
    localStorage.setItem(STORAGE_KEYS.VEHICLE_CHECKINS, JSON.stringify(INITIAL_VEHICLE_CHECKINS));
    return INITIAL_VEHICLE_CHECKINS;
  }
  try {
    return JSON.parse(local);
  } catch {
    return INITIAL_VEHICLE_CHECKINS;
  }
}

export function saveVehicleCheckIns(checkIns: VehicleCheckIn[]): void {
  localStorage.setItem(STORAGE_KEYS.VEHICLE_CHECKINS, JSON.stringify(checkIns));
  notifyStoreChange();
}

export function createVehicleCheckIn(newCheckIn: Omit<VehicleCheckIn, 'id' | 'checkedInAt'>): VehicleCheckIn {
  const checkIns = getVehicleCheckIns();
  const nextNum = checkIns.length + 106;
  const gateId = `GATE-2026-${nextNum}`;
  const nowStr = new Date().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
  
  const fullRecord: VehicleCheckIn = {
    ...newCheckIn,
    id: gateId,
    checkedInAt: nowStr,
    status: newCheckIn.status || 'IDLE_AWAITING_PI',
  };

  checkIns.unshift(fullRecord);
  saveVehicleCheckIns(checkIns);
  return fullRecord;
}

export function updateVehicleCheckIn(id: string, updater: (prev: VehicleCheckIn) => VehicleCheckIn): VehicleCheckIn | null {
  const checkIns = getVehicleCheckIns();
  const index = checkIns.findIndex(c => c.id === id);
  if (index === -1) return null;
  checkIns[index] = updater(checkIns[index]);
  saveVehicleCheckIns(checkIns);
  return checkIns[index];
}

export function getVehicleCheckInById(id: string): VehicleCheckIn | undefined {
  return getVehicleCheckIns().find(c => c.id === id);
}

// -------------------------------------------------------------
// WORKSHOP EXPENSES & ACCOUNTING STORAGE
// -------------------------------------------------------------
export const INITIAL_WORKSHOP_EXPENSES: WorkshopExpense[] = [];

export function getWorkshopExpenses(): WorkshopExpense[] {
  const local = localStorage.getItem(STORAGE_KEYS.WORKSHOP_EXPENSES);
  if (!local) {
    localStorage.setItem(STORAGE_KEYS.WORKSHOP_EXPENSES, JSON.stringify(INITIAL_WORKSHOP_EXPENSES));
    return INITIAL_WORKSHOP_EXPENSES;
  }
  try {
    return JSON.parse(local);
  } catch {
    return INITIAL_WORKSHOP_EXPENSES;
  }
}

export function saveWorkshopExpenses(expenses: WorkshopExpense[]): void {
  localStorage.setItem(STORAGE_KEYS.WORKSHOP_EXPENSES, JSON.stringify(expenses));
  notifyStoreChange();
}

export function addWorkshopExpense(expenseData: Omit<WorkshopExpense, 'id' | 'createdAt'>): WorkshopExpense {
  const expenses = getWorkshopExpenses();
  const nextNum = expenses.length + 101;
  const newExpense: WorkshopExpense = {
    ...expenseData,
    id: `EXP-2026-${String(nextNum).padStart(3, '0')}`,
    createdAt: new Date().toISOString()
  };

  expenses.unshift(newExpense);
  saveWorkshopExpenses(expenses);
  return newExpense;
}

export function updateWorkshopExpense(id: string, updates: Partial<WorkshopExpense>): WorkshopExpense | null {
  const expenses = getWorkshopExpenses();
  const index = expenses.findIndex(e => e.id === id);
  if (index === -1) return null;

  expenses[index] = { ...expenses[index], ...updates };
  saveWorkshopExpenses(expenses);
  return expenses[index];
}

export function deleteWorkshopExpense(id: string): boolean {
  const expenses = getWorkshopExpenses();
  const filtered = expenses.filter(e => e.id !== id);
  if (filtered.length === expenses.length) return false;

  saveWorkshopExpenses(filtered);
  return true;
}

// ----------------------------------------------------
// CAR MODELS, VARIANTS & FUEL TYPES MASTER CATALOG
// ----------------------------------------------------
export function getCarModels(): CarModelRecord[] {
  const local = localStorage.getItem(STORAGE_KEYS.CAR_MODELS);
  if (!local) {
    localStorage.setItem(STORAGE_KEYS.CAR_MODELS, JSON.stringify(INITIAL_CAR_MODELS));
    return INITIAL_CAR_MODELS;
  }
  try {
    const parsed = JSON.parse(local);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(STORAGE_KEYS.CAR_MODELS, JSON.stringify(INITIAL_CAR_MODELS));
      return INITIAL_CAR_MODELS;
    }
    return parsed;
  } catch {
    return INITIAL_CAR_MODELS;
  }
}

export function saveCarModels(models: CarModelRecord[]): void {
  localStorage.setItem(STORAGE_KEYS.CAR_MODELS, JSON.stringify(models));
  notifyStoreChange();
}

export function addCarModel(modelData: Omit<CarModelRecord, 'id' | 'createdAt'>): CarModelRecord {
  const models = getCarModels();
  const newModel: CarModelRecord = {
    ...modelData,
    id: `model-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    createdAt: new Date().toISOString()
  };
  models.unshift(newModel);
  saveCarModels(models);
  return newModel;
}

export function updateCarModel(id: string, updates: Partial<CarModelRecord>): CarModelRecord | null {
  const models = getCarModels();
  const idx = models.findIndex(m => m.id === id);
  if (idx === -1) return null;
  models[idx] = { ...models[idx], ...updates };
  saveCarModels(models);
  return models[idx];
}

export function deleteCarModel(id: string): boolean {
  const models = getCarModels();
  const filtered = models.filter(m => m.id !== id);
  if (filtered.length === models.length) return false;
  saveCarModels(filtered);
  return true;
}

export function getCarMakes(): string[] {
  const models = getCarModels();
  const makesSet = new Set<string>();
  models.forEach(m => {
    if (m.make) makesSet.add(m.make.trim());
  });
  return Array.from(makesSet).sort();
}

export function getModelsByMake(make: string): CarModelRecord[] {
  const models = getCarModels();
  if (!make) return models;
  return models.filter(m => m.make.toLowerCase() === make.toLowerCase());
}

export function findCarModel(make: string, model: string): CarModelRecord | undefined {
  const models = getCarModels();
  return models.find(m => 
    m.make.toLowerCase() === make.trim().toLowerCase() && 
    (m.model.toLowerCase() === model.trim().toLowerCase() || model.trim().toLowerCase().startsWith(m.model.toLowerCase()))
  );
}

// 18. AUTHENTICATION & RBAC SESSIONS
export function getAuthUser(): AuthUser | null {
  const local = localStorage.getItem(STORAGE_KEYS.AUTH_USER);
  if (!local) return null;
  try {
    return JSON.parse(local);
  } catch {
    return null;
  }
}

export function saveAuthUser(user: AuthUser | null): void {
  if (user) {
    localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
  }
  notifyStoreChange();
}

export function logoutAuthUser(): void {
  localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
  logoutCustomerSession();
  notifyStoreChange();
}

export function authenticateUser(
  identifier: string, 
  password?: string, 
  options?: { isCustomerLogin?: boolean; customerName?: string; city?: string }
): { success: boolean; user?: AuthUser; error?: string } {
  const cleanId = identifier.trim().toLowerCase();
  const cleanPass = (password || '').trim();

  // Handle Customer Portal Sign In / Register
  if (options?.isCustomerLogin) {
    const rawPhone = cleanId.replace(/\D/g, '');
    const isEmail = cleanId.includes('@');
    
    if (!isEmail && rawPhone.length < 10) {
      return { success: false, error: 'Please enter a valid 10-digit mobile number or email address.' };
    }

    const custUser: AuthUser = {
      id: `cust-${rawPhone || cleanId.replace(/[^a-z0-9]/gi, '')}`,
      name: options.customerName?.trim() || (isEmail ? identifier.split('@')[0] : 'Valued Customer'),
      loginId: cleanId,
      email: isEmail ? cleanId : `${rawPhone || 'customer'}@customer.fixocar.com`,
      phone: rawPhone || '8819915656',
      role: 'CUSTOMER',
      userType: 'CUSTOMER',
      customerId: `cust-${rawPhone || cleanId.replace(/[^a-z0-9]/gi, '')}`,
      cityName: options.city || 'Mumbai',
      loggedInAt: new Date().toISOString()
    };
    saveAuthUser(custUser);
    
    const custSession: CustomerUser = {
      id: custUser.id,
      name: custUser.name,
      phone: custUser.phone || '8819915656',
      email: custUser.email,
      city: custUser.cityName || 'Mumbai',
      isLoggedIn: true,
      loggedInAt: new Date().toISOString()
    };
    saveCustomerSession(custSession);

    return { success: true, user: custUser };
  }

  // WMS Staff & Contractor Authentication:
  // 1. Check Employees & Super Admin in employee registry
  const employees = getEmployees();
  const matchedEmp = employees.find(e => 
    (e.loginId && e.loginId.toLowerCase() === cleanId) || 
    (e.email && e.email.toLowerCase() === cleanId) ||
    (e.id && e.id.toLowerCase() === cleanId) ||
    (e.phone && e.phone.replace(/\D/g, '') === cleanId.replace(/\D/g, '') && cleanId.replace(/\D/g, '').length >= 10)
  );

  if (matchedEmp) {
    const expectedPassword = matchedEmp.password || 'password123';
    if (!cleanPass) {
      return { success: false, error: 'Password is required to sign in.' };
    }
    if (cleanPass !== expectedPassword) {
      return { success: false, error: 'Incorrect password. Please verify your credentials and try again.' };
    }

    const authUser: AuthUser = {
      id: matchedEmp.id,
      name: matchedEmp.name,
      loginId: matchedEmp.loginId || matchedEmp.email.split('@')[0],
      email: matchedEmp.email,
      phone: matchedEmp.phone,
      role: matchedEmp.role,
      userType: matchedEmp.employmentType === 'CONTRACT' ? 'CONTRACTOR' : (matchedEmp.role === 'SUPER_ADMIN' || matchedEmp.role === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE'),
      employeeId: matchedEmp.id,
      specializedTeam: matchedEmp.specializedTeam,
      workshopId: matchedEmp.workshopId,
      workshopName: matchedEmp.workshopName,
      cityId: matchedEmp.cityId,
      cityName: matchedEmp.cityName,
      employmentType: matchedEmp.employmentType,
      loggedInAt: new Date().toISOString()
    };
    saveAuthUser(authUser);
    return { success: true, user: authUser };
  }

  // 2. Check Vendors / Sublet Contractors
  const vendors = getVendors();
  const matchedVen = vendors.find(v =>
    (v.loginId && v.loginId.toLowerCase() === cleanId) ||
    (v.email && v.email.toLowerCase() === cleanId) ||
    (v.id && v.id.toLowerCase() === cleanId) ||
    (v.phone && v.phone.replace(/\D/g, '') === cleanId.replace(/\D/g, '') && cleanId.replace(/\D/g, '').length >= 10)
  );

  if (matchedVen) {
    const expectedPassword = matchedVen.password || 'password123';
    if (!cleanPass) {
      return { success: false, error: 'Password is required for vendor sign in.' };
    }
    if (cleanPass !== expectedPassword) {
      return { success: false, error: 'Incorrect vendor password. Please verify your credentials.' };
    }

    const authUser: AuthUser = {
      id: matchedVen.id,
      name: matchedVen.name,
      loginId: matchedVen.loginId || matchedVen.email.split('@')[0],
      email: matchedVen.email,
      phone: matchedVen.phone,
      role: 'VENDOR',
      userType: 'VENDOR',
      vendorId: matchedVen.id,
      loggedInAt: new Date().toISOString()
    };
    saveAuthUser(authUser);
    return { success: true, user: authUser };
  }

  return { 
    success: false, 
    error: 'Staff account not found. Please check your Work Login ID, Employee ID, or Email ID.' 
  };
}



