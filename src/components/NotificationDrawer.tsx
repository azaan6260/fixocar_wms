import React, { useState, useEffect, useRef } from 'react';
import { ToastNotification } from '../types/toast';
import { 
  Bell, 
  Car, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  X, 
  CheckCheck, 
  Trash2, 
  ChevronRight, 
  Filter,
  History,
  Layers
} from 'lucide-react';

interface NotificationDrawerProps {
  onSelectJobCard?: (id: string) => void;
}

const STORAGE_KEY = 'fixocar_notifications_history_v1';

export function NotificationDrawer({ onSelectJobCard }: NotificationDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<ToastNotification[]>(() => {
    try {
      const local = localStorage.getItem(STORAGE_KEY);
      return local ? JSON.parse(local) : [];
    } catch {
      return [];
    }
  });
  const [filter, setFilter] = useState<'ALL' | 'STATUS' | 'APPROVAL'>('ALL');
  const panelRef = useRef<HTMLDivElement>(null);

  // Save to localStorage when updated
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, 50)));
    } catch {
      // ignore
    }
  }, [notifications]);

  // Listen to APP_TOAST_EVENT
  useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent<ToastNotification>;
      if (!customEvent.detail) return;

      const newToast = customEvent.detail;
      setNotifications(prev => {
        // avoid duplicate IDs
        const exists = prev.some(n => n.id === newToast.id);
        if (exists) return prev;
        return [newToast, ...prev];
      });
    };

    window.addEventListener('APP_TOAST_EVENT', handleToastEvent);
    return () => {
      window.removeEventListener('APP_TOAST_EVENT', handleToastEvent);
    };
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const handleNotificationClick = (item: ToastNotification) => {
    // mark read
    setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n));
    if (item.jobCardId && onSelectJobCard) {
      onSelectJobCard(item.jobCardId);
      setIsOpen(false);
    }
  };

  const filteredList = notifications.filter(n => {
    if (filter === 'STATUS') return n.type === 'STATUS_CHANGE' || n.type === 'JOB_CARD_CREATED';
    if (filter === 'APPROVAL') return n.type === 'ESTIMATE_APPROVED' || n.type === 'ESTIMATE_DECLINED';
    return true;
  });

  return (
    <div className="relative" ref={panelRef}>
      
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen && unreadCount > 0) {
            // Option to mark read after opening
          }
        }}
        className={`relative p-2 rounded-full border transition-all active:scale-95 ${
          isOpen
            ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20'
            : unreadCount > 0
            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-800 animate-pulse'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
        }`}
        title="Live Pipeline & Estimate Notifications"
        aria-label="Toggle notifications menu"
      >
        <Bell className="w-4 h-4 stroke-[2.5]" />

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white font-mono text-[10px] font-black flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-xs">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Drawer Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
          
          {/* Header */}
          <div className="p-4 bg-slate-950 text-white border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                  Live Notifications
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-mono font-black">
                      {unreadCount} New
                    </span>
                  )}
                </h3>
                <p className="text-[10px] text-slate-400">Pipeline Status & Estimate Approvals</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Sub-Header Actions & Filter Tabs */}
          <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
            {/* Tabs */}
            <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all ${
                  filter === 'ALL'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('STATUS')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all ${
                  filter === 'STATUS'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                🚘 Status
              </button>
              <button
                type="button"
                onClick={() => setFilter('APPROVAL')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all ${
                  filter === 'APPROVAL'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                ✅ Estimate
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1 shrink-0">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  title="Clear notification history"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* List Content */}
          <div className="overflow-y-auto p-2 space-y-2 grow divide-y divide-slate-100 dark:divide-slate-800/60">
            {filteredList.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <Bell className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700 stroke-[1.5]" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400">No Notifications Yet</p>
                <p className="text-[11px] text-slate-400">
                  Real-time alerts will appear here when a vehicle moves in the pipeline or a customer approves an estimate.
                </p>
              </div>
            ) : (
              filteredList.map((item) => {
                const isApproval = item.type === 'ESTIMATE_APPROVED';
                const isDeclined = item.type === 'ESTIMATE_DECLINED';
                const isStatus = item.type === 'STATUS_CHANGE';

                return (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={`p-3 rounded-2xl transition-all cursor-pointer flex items-start gap-3 relative group ${
                      !item.read
                        ? 'bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {!item.read && (
                      <span className="w-2 h-2 rounded-full bg-blue-600 absolute left-2 top-3" />
                    )}

                    <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                      isApproval
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : isDeclined
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        : isStatus
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    }`}>
                      {isApproval && <CheckCircle2 className="w-4 h-4" />}
                      {isDeclined && <XCircle className="w-4 h-4" />}
                      {isStatus && <Car className="w-4 h-4" />}
                      {!isApproval && !isDeclined && !isStatus && <Sparkles className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">
                          {item.title}
                        </p>
                        <span className="text-[9px] font-mono text-slate-400 shrink-0">
                          {item.timestamp}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
                        {item.message}
                      </p>

                      <div className="flex items-center justify-between gap-2 mt-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-1.5">
                          {item.vehicleReg && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[9px] font-bold text-slate-700 dark:text-slate-300">
                              {item.vehicleReg}
                            </span>
                          )}
                          {item.amount !== undefined && item.amount > 0 && (
                            <span className="font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              ₹{item.amount.toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>

                        {item.jobCardId && (
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 group-hover:underline flex items-center gap-0.5">
                            Open <ChevronRight className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer note */}
          <div className="p-3 bg-slate-50 dark:bg-slate-950 text-center border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
            Real-Time Pipeline Monitoring • FixoCar WMS
          </div>

        </div>
      )}

    </div>
  );
}
