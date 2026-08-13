import React, { useState, useEffect, useRef } from 'react';
import { ToastNotification } from '../types/toast';
import { playNotificationChime } from '../lib/sound';
import { 
  Car, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  X, 
  ChevronRight, 
  ArrowRightLeft, 
  AlertCircle,
  Bell,
  Check
} from 'lucide-react';

interface ToastContainerProps {
  onSelectJobCard?: (id: string) => void;
}

const TOAST_DURATION = 5500; // 5.5 seconds

export function ToastContainer({ onSelectJobCard }: ToastContainerProps) {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent<ToastNotification>;
      if (!customEvent.detail) return;

      const newToast = customEvent.detail;

      // Play subtle chime sound
      playNotificationChime(newToast.type);

      // Add to toasts list (keep max 5 floating toasts on screen at once)
      setToasts(prev => [newToast, ...prev].slice(0, 5));
    };

    window.addEventListener('APP_TOAST_EVENT', handleToastEvent);
    return () => {
      window.removeEventListener('APP_TOAST_EVENT', handleToastEvent);
    };
  }, []);

  // Auto dismiss timers
  useEffect(() => {
    if (toasts.length === 0) return;

    const interval = setInterval(() => {
      setToasts(prev => {
        return prev.filter(t => {
          if (t.id === hoveredId) return true; // pause timer if hovered
          // dismiss if older than duration
          const age = Date.now() - (t.id.startsWith('toast-') ? parseInt(t.id.split('-')[1]) || 0 : 0);
          return age < TOAST_DURATION;
        });
      });
    }, 500);

    return () => clearInterval(interval);
  }, [toasts, hoveredId]);

  const dismissToast = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleToastClick = (toast: ToastNotification) => {
    if (toast.jobCardId && onSelectJobCard) {
      onSelectJobCard(toast.jobCardId);
      dismissToast(toast.id);
    }
  };

  if (toasts.length === 0) return null;

  return (
    <div 
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm sm:max-w-md w-[calc(100vw-2rem)] pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const isStatusChange = toast.type === 'STATUS_CHANGE';
        const isApproval = toast.type === 'ESTIMATE_APPROVED';
        const isDeclined = toast.type === 'ESTIMATE_DECLINED';
        const isCreated = toast.type === 'JOB_CARD_CREATED';

        return (
          <div
            key={toast.id}
            onMouseEnter={() => setHoveredId(toast.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => handleToastClick(toast)}
            className={`pointer-events-auto group relative overflow-hidden rounded-2xl border shadow-xl p-3.5 sm:p-4 transition-all duration-200 backdrop-blur-md cursor-pointer animate-in slide-in-from-right-8 duration-300 active:scale-[0.98] ${
              isApproval
                ? 'bg-emerald-950/95 text-emerald-100 border-emerald-500/40 dark:bg-emerald-950/95 shadow-emerald-950/30'
                : isDeclined
                ? 'bg-rose-950/95 text-rose-100 border-rose-500/40 dark:bg-rose-950/95 shadow-rose-950/30'
                : isStatusChange
                ? 'bg-slate-950/95 text-slate-100 border-blue-500/40 dark:bg-slate-950/95 shadow-blue-950/30'
                : 'bg-slate-950/95 text-slate-100 border-amber-500/40 shadow-slate-950/30'
            }`}
          >
            {/* Countdown Progress Bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20 overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${
                  isApproval ? 'bg-emerald-400' : isDeclined ? 'bg-rose-400' : isStatusChange ? 'bg-blue-400' : 'bg-amber-400'
                }`}
                style={{
                  animation: hoveredId === toast.id ? 'none' : `toast-progress ${TOAST_DURATION}ms linear forwards`
                }}
              />
            </div>

            <div className="flex items-start gap-3">
              {/* Type Icon Badge */}
              <div className={`p-2 rounded-xl shrink-0 ${
                isApproval
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : isDeclined
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : isStatusChange
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                {isApproval && <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />}
                {isDeclined && <XCircle className="w-5 h-5 stroke-[2.5]" />}
                {isStatusChange && <Car className="w-5 h-5 stroke-[2.5]" />}
                {isCreated && <Sparkles className="w-5 h-5 stroke-[2.5]" />}
              </div>

              {/* Toast Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-extrabold text-xs sm:text-sm tracking-tight flex items-center gap-1.5 leading-tight">
                    <span>{toast.title}</span>
                  </h4>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">
                    {toast.timestamp}
                  </span>
                </div>

                <p className="text-xs text-slate-300 dark:text-slate-300 mt-1 leading-snug font-medium">
                  {toast.message}
                </p>

                {/* Additional metadata pills */}
                <div className="flex items-center gap-2 mt-2 pt-1 border-t border-white/10">
                  {toast.vehicleReg && (
                    <span className="px-2 py-0.5 rounded-md bg-white/10 font-mono text-[10px] font-black uppercase text-white tracking-wider">
                      {toast.vehicleReg}
                    </span>
                  )}
                  {toast.amount !== undefined && toast.amount > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-black">
                      ₹{toast.amount.toLocaleString('en-IN')}
                    </span>
                  )}
                  {toast.jobCardId && (
                    <span className="text-[11px] font-bold text-blue-300 group-hover:underline flex items-center gap-0.5 ml-auto">
                      View Job Card <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={(e) => dismissToast(toast.id, e)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 -mr-1 -mt-1"
                aria-label="Dismiss toast notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}

      <style>{`
        @keyframes toast-progress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
