import { pushLocalDataToSupabase } from './syncService';
import { dispatchToastNotification } from './storage';

const SYNC_QUEUE_KEY = 'fixocar_offline_sync_queue';

export interface PendingUpdate {
  id: string;
  timestamp: number;
  type: 'jobCardUpdate' | 'all';
}

export function addToOfflineQueue(type: 'jobCardUpdate' | 'all') {
  if (typeof window === 'undefined') return;
  
  const queue: PendingUpdate[] = getOfflineQueue();
  const newItem: PendingUpdate = {
    id: `sync-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    timestamp: Date.now(),
    type
  };
  queue.push(newItem);
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  
  dispatchToastNotification({
    title: 'Offline Update Cached ⚡',
    message: 'You are currently offline. Your changes have been cached and will automatically sync when connection is restored.',
    type: 'WARNING'
  });
}

export function getOfflineQueue(): PendingUpdate[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearOfflineQueue() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SYNC_QUEUE_KEY);
}

export async function processOfflineQueue() {
  if (typeof window === 'undefined') return;
  if (!navigator.onLine) return;
  
  const queue = getOfflineQueue();
  if (queue.length === 0) return;
  
  console.log(`[OfflineSync] Found ${queue.length} pending updates. Syncing with master database...`);
  
  try {
    const syncRes = await pushLocalDataToSupabase();
    if (syncRes && syncRes.success) {
      clearOfflineQueue();
      dispatchToastNotification({
        title: 'Offline Sync Completed! ✅',
        message: `Successfully synchronized ${queue.length} job card updates with the master database.`,
        type: 'SUCCESS'
      });
    }
  } catch (error) {
    console.error('[OfflineSync] Sync failed:', error);
  }
}

export function initOfflineSyncListeners() {
  if (typeof window === 'undefined') return;
  
  window.addEventListener('online', () => {
    console.log('[OfflineSync] Browser went ONLINE. Processing queue...');
    processOfflineQueue();
  });
  
  window.addEventListener('offline', () => {
    console.log('[OfflineSync] Browser went OFFLINE. Operations will be queued.');
  });
}
