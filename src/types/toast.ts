export type ToastType = 
  | 'STATUS_CHANGE'
  | 'ESTIMATE_APPROVED'
  | 'ESTIMATE_DECLINED'
  | 'JOB_CARD_CREATED'
  | 'SUCCESS'
  | 'INFO'
  | 'WARNING';

export interface ToastNotification {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  vehicleReg?: string;
  jobCardId?: string;
  customerName?: string;
  amount?: number;
  timestamp: string;
  read?: boolean;
  oldStatus?: string;
  newStatus?: string;
}

export const STATUS_LABELS: Record<string, string> = {
  INSPECTION: 'Pre-Inspection (PI)',
  CREATED: 'Job Card Created',
  JOB_ALLOCATED: 'Job Allocated',
  ESTIMATE_PENDING: 'Estimate Approval Pending',
  IN_PROGRESS: 'Work In Progress (WIP)',
  QC_PENDING: 'PDI & QC Audit',
  READY_FOR_DELIVERY: 'Ready for Delivery',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Handed Over & Delivered',
  CLOSED: 'Job Card Closed',
};

export function formatJobCardStatus(status: string): string {
  return STATUS_LABELS[status] || status;
}
