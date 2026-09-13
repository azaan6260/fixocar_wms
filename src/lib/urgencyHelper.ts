import { JobCard, JobCardStatus } from '../types';

/**
 * Returns today or offset date in local timezone as YYYY-MM-DD.
 * Ensures consistent comparison across devices without UTC midnight offset bugs.
 */
export function getLocalDateString(offsetDays = 0): string {
  const d = new Date();
  if (offsetDays !== 0) {
    d.setDate(d.getDate() + offsetDays);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Safely parses any date string (ISO timestamp, YYYY-MM-DD, or localized)
 * into a local Date object set to 00:00:00 local time.
 */
export function parseDateOnly(dateInput: string | Date | undefined | null): Date | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    const d = new Date(dateInput);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const str = String(dateInput).trim();
  if (!str) return null;

  // Match YYYY-MM-DD at the start of string
  const matchYMD = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (matchYMD) {
    const year = parseInt(matchYMD[1], 10);
    const month = parseInt(matchYMD[2], 10) - 1;
    const day = parseInt(matchYMD[3], 10);
    return new Date(year, month, day, 0, 0, 0, 0);
  }

  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

export interface DeadlineInfo {
  status: 'OVERDUE' | 'DELIVERY_TODAY' | 'TOMORROW' | 'UPCOMING' | 'NONE';
  label: string;
  subtext: string;
  color: string;
  badgeBg: string;
  isOverdue: boolean;
  isToday: boolean;
  isTomorrow: boolean;
  diffDays: number | null;
  urgencyScore: number;
}

/**
 * Calculates deadline proximity, overdue days, and visual color badge.
 */
export function getDeadlineInfo(estimatedCompletionDate?: string, isUrgent?: boolean): DeadlineInfo {
  const baseScore = isUrgent ? 500 : 0;

  if (!estimatedCompletionDate || !estimatedCompletionDate.trim()) {
    return {
      status: 'NONE',
      label: isUrgent ? '🔥 MARKED URGENT' : 'No Deadline Set',
      subtext: isUrgent ? 'Daily Huddle Priority' : 'Target date unassigned',
      color: isUrgent
        ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-400 font-bold'
        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300',
      badgeBg: isUrgent ? 'bg-amber-500 text-slate-950' : 'bg-slate-700 text-slate-200',
      isOverdue: false,
      isToday: false,
      isTomorrow: false,
      diffDays: null,
      urgencyScore: baseScore
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDateOnly = parseDateOnly(estimatedCompletionDate);
  if (!targetDateOnly) {
    return {
      status: 'NONE',
      label: isUrgent ? '🔥 MARKED URGENT' : 'Invalid Date',
      subtext: estimatedCompletionDate,
      color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300',
      badgeBg: 'bg-slate-700 text-slate-200',
      isOverdue: false,
      isToday: false,
      isTomorrow: false,
      diffDays: null,
      urgencyScore: baseScore
    };
  }

  const diffTime = targetDateOnly.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      status: 'OVERDUE',
      label: `🚨 Overdue by ${overdueDays} day${overdueDays > 1 ? 's' : ''}${isUrgent ? ' 🔥' : ''}`,
      subtext: `Target: ${estimatedCompletionDate}`,
      color: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800 font-bold',
      badgeBg: 'bg-rose-600 text-white',
      isOverdue: true,
      isToday: false,
      isTomorrow: false,
      diffDays,
      urgencyScore: baseScore + 1000 + (overdueDays * 50)
    };
  } else if (diffDays === 0) {
    return {
      status: 'DELIVERY_TODAY',
      label: `⏰ Promised Delivery Today${isUrgent ? ' 🔥' : ''}`,
      subtext: `Target: ${estimatedCompletionDate}`,
      color: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700 font-bold',
      badgeBg: 'bg-amber-500 text-slate-950 font-black',
      isOverdue: false,
      isToday: true,
      isTomorrow: false,
      diffDays: 0,
      urgencyScore: baseScore + 800
    };
  } else if (diffDays === 1) {
    return {
      status: 'TOMORROW',
      label: `📅 Promised Tomorrow${isUrgent ? ' 🔥' : ''}`,
      subtext: `Target: ${estimatedCompletionDate}`,
      color: isUrgent
        ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-400 font-bold'
        : 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800 font-bold',
      badgeBg: 'bg-blue-600 text-white',
      isOverdue: false,
      isToday: false,
      isTomorrow: true,
      diffDays: 1,
      urgencyScore: baseScore + 400
    };
  } else {
    return {
      status: 'UPCOMING',
      label: `📆 Promised in ${diffDays} days${isUrgent ? ' 🔥' : ''}`,
      subtext: `Target: ${estimatedCompletionDate}`,
      color: isUrgent
        ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-400 font-bold'
        : 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800',
      badgeBg: 'bg-slate-700 text-slate-200',
      isOverdue: false,
      isToday: false,
      isTomorrow: false,
      diffDays,
      urgencyScore: baseScore + Math.max(10, 100 - diffDays)
    };
  }
}

/**
 * High-precision priority scoring function for manager triage:
 * 1. Marked Urgent gets +1000.
 * 2. Overdue jobs get +500 to +1500 (escalating with days overdue).
 * 3. Due Today gets +400.
 * 4. Due Tomorrow gets +250.
 * 5. Pending Customer Estimates get +150.
 * 6. Pending QC audits get +80.
 */
export function calculateJobCardPriorityScore(card: JobCard): number {
  let score = 0;
  if (card.isUrgent) score += 1000;

  const deadline = getDeadlineInfo(card.estimatedCompletionDate, card.isUrgent);
  score += deadline.urgencyScore;

  if (card.status === 'ESTIMATE_PENDING' || card.tasks.some(t => t.requiresCustomerApproval && t.isCustomerApproved === null)) {
    score += 150;
  }

  if (card.status === 'QC_PENDING') {
    score += 80;
  }

  return score;
}

/**
 * Pipeline workflow order for status-based sorting:
 * 1. Estimate Pending / Approvals (action blocked on client)
 * 2. QC Pending (action blocked on floor manager)
 * 3. In Progress (active technicians on bay)
 * 4. Job Allocated (ready to start)
 * 5. Inspection (diagnostic stage)
 * 6. Created (new)
 * 7. Ready for Checkout (RFC)
 * 8. Ready for Delivery
 * 9. Out for Delivery
 * 10. Delivered
 * 11. Closed
 */
export function calculateJobCardStatusRank(status: JobCardStatus): number {
  switch (status) {
    case 'ESTIMATE_PENDING': return 1;
    case 'QC_PENDING': return 2;
    case 'IN_PROGRESS': return 3;
    case 'JOB_ALLOCATED': return 4;
    case 'INSPECTION': return 5;
    case 'CREATED': return 6;
    case 'RFC': return 7;
    case 'READY_FOR_DELIVERY': return 8;
    case 'OUT_FOR_DELIVERY': return 9;
    case 'DELIVERED': return 10;
    case 'CLOSED': return 11;
    default: return 99;
  }
}
