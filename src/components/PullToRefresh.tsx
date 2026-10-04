import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, ArrowDown, CheckCircle2 } from 'lucide-react';
import { triggerLightHaptic, triggerSuccessHaptic } from '../lib/mobileBridge';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  disabled?: boolean;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  disabled = false
}) => {
  const [pullY, setPullY] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const startYRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const THRESHOLD = 65; // pixels needed to pull to trigger refresh

  useEffect(() => {
    if (disabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      const pageScrollY = window.scrollY || document.documentElement.scrollTop || 0;
      const containerScrollTop = containerRef.current?.scrollTop || 0;

      // Only enable pull down if scroll is at the very top
      if (pageScrollY <= 2 && containerScrollTop <= 2) {
        startYRef.current = e.touches[0].clientY;
      } else {
        startYRef.current = null;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const diffY = currentY - startYRef.current;
      const pageScrollY = window.scrollY || document.documentElement.scrollTop || 0;

      if (diffY > 0 && pageScrollY <= 2) {
        // Resistance formula for smooth pulling
        const calculatedPull = Math.min(110, Math.pow(diffY, 0.85) * 1.8);
        setPullY(calculatedPull);

        // Prevent native bounce / unwanted scrolling while actively pulling down
        if (calculatedPull > 10 && e.cancelable) {
          e.preventDefault();
        }
      } else {
        setPullY(0);
      }
    };

    const handleTouchEnd = async () => {
      if (startYRef.current === null) return;
      startYRef.current = null;

      if (pullY >= THRESHOLD && !isRefreshing) {
        setIsRefreshing(true);
        triggerLightHaptic();

        try {
          await Promise.resolve(onRefresh());
          setIsSuccess(true);
          triggerSuccessHaptic();
          setTimeout(() => {
            setIsSuccess(false);
          }, 1200);
        } catch (err) {
          console.error('Pull to refresh failed:', err);
        } finally {
          setTimeout(() => {
            setIsRefreshing(false);
            setPullY(0);
          }, 400);
        }
      } else {
        setPullY(0);
      }
    };

    const targetNode = containerRef.current || window;
    targetNode.addEventListener('touchstart', handleTouchStart as any, { passive: true });
    targetNode.addEventListener('touchmove', handleTouchMove as any, { passive: false });
    targetNode.addEventListener('touchend', handleTouchEnd as any, { passive: true });

    return () => {
      targetNode.removeEventListener('touchstart', handleTouchStart as any);
      targetNode.removeEventListener('touchmove', handleTouchMove as any);
      targetNode.removeEventListener('touchend', handleTouchEnd as any);
    };
  }, [disabled, isRefreshing, pullY, onRefresh]);

  const progressRatio = Math.min(1, pullY / THRESHOLD);

  return (
    <div ref={containerRef} className="relative min-h-screen w-full overscroll-y-contain">
      {/* Pull-to-Refresh Top Indicator Banner */}
      {(pullY > 5 || isRefreshing || isSuccess) && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center transition-all duration-200 pointer-events-none"
          style={{
            transform: `translateY(${isRefreshing || isSuccess ? 16 : Math.max(0, pullY - 45)}px)`,
            opacity: isRefreshing || isSuccess ? 1 : Math.min(1, pullY / 25)
          }}
        >
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-900/95 dark:bg-slate-800/95 text-white shadow-xl border border-slate-700/80 backdrop-blur-md text-xs font-semibold tracking-wide">
            {isSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400 animate-bounce" />
                <span className="text-emerald-300">Refreshed Successfully!</span>
              </>
            ) : isRefreshing ? (
              <>
                <RefreshCw className="w-4 h-4 text-sky-400 animate-spin" />
                <span className="text-sky-200">Updating application data...</span>
              </>
            ) : (
              <>
                <div
                  className="transition-transform duration-150"
                  style={{ transform: `rotate(${pullY >= THRESHOLD ? 180 : progressRatio * 180}deg)` }}
                >
                  <ArrowDown className={`w-4 h-4 ${pullY >= THRESHOLD ? 'text-emerald-400' : 'text-slate-300'}`} />
                </div>
                <span>
                  {pullY >= THRESHOLD ? 'Release to refresh' : 'Pull down to refresh'}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Page Container with Pull Elastic Transform */}
      <div
        style={{
          transform: pullY > 0 ? `translateY(${pullY * 0.6}px)` : 'none',
          transition: startYRef.current === null ? 'transform 0.3s ease-out' : 'none'
        }}
      >
        {children}
      </div>
    </div>
  );
};
