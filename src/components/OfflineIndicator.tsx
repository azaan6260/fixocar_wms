import React, { useEffect, useState } from 'react';
import { WifiOff, CloudLightning, AlertTriangle } from 'lucide-react';
import { getOfflineQueue } from '../lib/offlineSync';
import { isSupabaseQuotaRestricted } from '../lib/supabaseClient';
import { getSyncHealth, SyncHealth } from '../lib/syncService';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [syncHealth, setSyncHealth] = useState<SyncHealth>(() => getSyncHealth());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      setSyncHealth(getSyncHealth());
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncHealth(getSyncHealth());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const updateSyncState = () => {
      setPendingCount(getOfflineQueue().length);
      setSyncHealth(getSyncHealth());
    };

    updateSyncState();

    window.addEventListener('fixocar_offline_queue_changed', updateSyncState);
    window.addEventListener('fixocar_sync_health_changed', updateSyncState);
    window.addEventListener('storage', updateSyncState);

    const interval = setInterval(updateSyncState, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('fixocar_offline_queue_changed', updateSyncState);
      window.removeEventListener('fixocar_sync_health_changed', updateSyncState);
      window.removeEventListener('storage', updateSyncState);
      clearInterval(interval);
    };
  }, []);

  const isQuotaRestricted = isSupabaseQuotaRestricted() || syncHealth.isQuotaRestricted;

  if (isOnline && pendingCount === 0 && !isQuotaRestricted) return null;

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col gap-2 max-w-sm rounded-2xl border border-slate-800 bg-slate-950/95 backdrop-blur-md p-4 text-slate-100 shadow-2xl animate-in slide-in-from-bottom-5 duration-200">
      {!isOnline ? (
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
            <WifiOff className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-red-400">Connection Offline</h4>
            <p className="mt-1 text-xs text-slate-400">
              No internet connection detected. Data changes will queue locally until network connection is restored.
            </p>
          </div>
        </div>
      ) : isQuotaRestricted ? (
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-amber-400">Supabase Egress Limit Active</h4>
            <p className="mt-1 text-xs text-slate-400">
              Direct Supabase sync is restricted due to quota. Syncing live via Central Cloud Store.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
            <CloudLightning className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-emerald-400">Syncing Local Modifications...</h4>
            <p className="mt-1 text-xs text-slate-400">
              Synchronizing {pendingCount} queued modifications with the database server.
            </p>
          </div>
        </div>
      )}

      {pendingCount > 0 && (
        <div className="mt-2 flex items-center justify-between rounded-xl bg-slate-900 px-3 py-1.5 text-xs">
          <span className="text-slate-400">Queued Updates:</span>
          <span className="font-bold text-amber-500 px-2 py-0.5 bg-amber-500/10 rounded-lg">
            {pendingCount}
          </span>
        </div>
      )}
    </div>
  );
};
