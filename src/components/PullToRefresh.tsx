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
  const startXRef = useRef<number | null>(null);
  const isPullingRef = useRef<boolean>(false);
  const pullYRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Require a deliberate, long pull from the absolute top of the page
  const DEADZONE = 60; // pixels of raw downward drag at scrollTop=0 before pull begins
  const THRESHOLD = 110; // visual pullY pixels needed to trigger refresh (~300px raw drag)

  useEffect(() => {
    if (disabled) return;

    const getWindowScrollTop = () =>
      Math.max(
        window.scrollY || 0,
        document.documentElement?.scrollTop || 0,
        document.body?.scrollTop || 0
      );

    // Ensure touch did not originate inside a scrolled nested container, modal, or form control
    const canInitiatePull = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.closest('[role="dialog"], .fixed.inset-0, input, textarea, select, button')) {
        return false;
      }
      let el: HTMLElement | null = target;
      while (el && el !== document.body && el !== document.documentElement) {
        if (el.scrollTop > 0) {
          return false;
        }
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 2) {
          // Inside a vertically scrollable inner container; let normal scrolling work unimpeded
          return false;
        }
        el = el.parentElement;
      }
      return true;
    };

    const resetPull = () => {
      startYRef.current = null;
      startXRef.current = null;
      isPullingRef.current = false;
      pullYRef.current = 0;
      setPullY(0);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (isRefreshing || e.touches.length !== 1) {
        resetPull();
        return;
      }

      const pageScrollY = getWindowScrollTop();
      const containerScrollTop = containerRef.current?.scrollTop || 0;

      // Only allow pull-to-refresh if the page is already resting at the very top (scrollTop === 0)
      if (pageScrollY === 0 && containerScrollTop === 0 && canInitiatePull(e.target)) {
        startYRef.current = e.touches[0].clientY;
        startXRef.current = e.touches[0].clientX;
        isPullingRef.current = false;
      } else {
        resetPull();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null || startXRef.current === null || isRefreshing) return;

      const pageScrollY = getWindowScrollTop();
      // If the page scrolled at all, immediately abort pull-to-refresh for this gesture
      if (pageScrollY > 0) {
        resetPull();
        return;
      }

      const currentY = e.touches[0].clientY;
      const currentX = e.touches[0].clientX;
      const diffY = currentY - startYRef.current;
      const diffX = currentX - startXRef.current;

      // If user moves finger upward (scrolling down) or swipes horizontally, cancel for this gesture
      if (diffY < -4 || Math.abs(diffX) > Math.abs(diffY) * 0.65) {
        resetPull();
        return;
      }

      // Only engage after passing the generous deadzone while strictly at the top
      if (diffY > DEADZONE) {
        isPullingRef.current = true;
        const effectiveDrag = diffY - DEADZONE;
        const calculatedPull = Math.min(135, Math.round(effectiveDrag * 0.45));
        pullYRef.current = calculatedPull;
        setPullY(calculatedPull);

        if (calculatedPull > 15 && e.cancelable) {
          e.preventDefault();
        }
      } else {
        pullYRef.current = 0;
        setPullY(0);
      }
    };

    const handleTouchEnd = async () => {
      if (startYRef.current === null) return;
      const finalPull = pullYRef.current;
      const wasPulling = isPullingRef.current;

      startYRef.current = null;
      startXRef.current = null;
      isPullingRef.current = false;

      if (wasPulling && finalPull >= THRESHOLD && !isRefreshing && getWindowScrollTop() === 0) {
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
            pullYRef.current = 0;
            setPullY(0);
          }, 400);
        }
      } else {
        pullYRef.current = 0;
        setPullY(0);
      }
    };

    const targetNode = containerRef.current || window;
    targetNode.addEventListener('touchstart', handleTouchStart as any, { passive: true });
    targetNode.addEventListener('touchmove', handleTouchMove as any, { passive: false });
    targetNode.addEventListener('touchend', handleTouchEnd as any, { passive: true });
    targetNode.addEventListener('touchcancel', resetPull as any, { passive: true });

    return () => {
      targetNode.removeEventListener('touchstart', handleTouchStart as any);
      targetNode.removeEventListener('touchmove', handleTouchMove as any);
      targetNode.removeEventListener('touchend', handleTouchEnd as any);
      targetNode.removeEventListener('touchcancel', resetPull as any);
    };
  }, [disabled, isRefreshing, onRefresh]);

  const progressRatio = Math.min(1, pullY / THRESHOLD);

  return (
    <div ref={containerRef} className="relative min-h-screen w-full overscroll-y-contain">
      {/* Pull-to-Refresh Top Indicator Banner */}
      {(pullY > 8 || isRefreshing || isSuccess) && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center transition-all duration-200 pointer-events-none"
          style={{
            transform: `translateY(${isRefreshing || isSuccess ? 16 : Math.max(0, pullY - 45)}px)`,
            opacity: isRefreshing || isSuccess ? 1 : Math.min(1, pullY / 35)
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
                  {pullY >= THRESHOLD ? 'Release to refresh' : 'Pull down further to refresh'}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Page Container with Subtle Elastic Transform */}
      <div
        style={{
          transform: pullY > 0 ? `translateY(${pullY * 0.45}px)` : 'none',
          transition: startYRef.current === null ? 'transform 0.25s ease-out' : 'none'
        }}
      >
        {children}
      </div>
    </div>
  );
};
