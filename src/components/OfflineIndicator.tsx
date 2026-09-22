import React, { useEffect, useState } from 'react';
import { WifiOff, CloudLightning } from 'lucide-react';
import { getOfflineQueue } from '../lib/offlineSync';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial and periodic update for pending queue size
    const updateQueueCount = () => {
      setPendingCount(getOfflineQueue().length);
    };

    updateQueueCount();
    const interval = setInterval(updateQueueCount, 3000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  if (isOnline && pendingCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col gap-2 max-w-sm rounded-xl border border-slate-800 bg-slate-950 p-4 text-slate-100 shadow-2xl animate-bounce-subtle">
      {!isOnline ? (
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
            <WifiOff className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-amber-500">Working Offline</h4>
            <p className="mt-1 text-xs text-slate-400">
              Your changes are being saved locally. They will automatically sync with the server once your connection is restored.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
            <CloudLightning className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-emerald-400">Sync in Progress...</h4>
            <p className="mt-1 text-xs text-slate-400">
              Synchronizing {pendingCount} queued modifications with the master database.
            </p>
          </div>
        </div>
      )}

      {pendingCount > 0 && (
        <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-900 px-3 py-1.5 text-xs">
          <span className="text-slate-400">Queued Updates:</span>
          <span className="font-bold text-amber-500 px-1.5 py-0.5 bg-amber-500/10 rounded">
            {pendingCount}
          </span>
        </div>
      )}
    </div>
  );
};
