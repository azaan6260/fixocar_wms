import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Truck, 
  Layers, 
  CheckCircle2, 
  Menu, 
  Camera, 
  Plus, 
  QrCode, 
  Clock, 
  X,
  FileText,
  Boxes,
  Receipt,
  Users,
  Settings,
  Flame
} from 'lucide-react';
import { getJobCards, getVehicleCheckIns, subscribeToStore } from '../lib/storage';
import { triggerLightHaptic, triggerMediumHaptic } from '../lib/mobileBridge';

interface MobileBottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenScanner: () => void;
  onOpenNewJobCard: () => void;
  onOpenSupabaseModal: () => void;
  currentRole: string;
}

export function MobileBottomNav({
  activeTab,
  onTabChange,
  onOpenScanner,
  onOpenNewJobCard,
  onOpenSupabaseModal,
  currentRole
}: MobileBottomNavProps) {
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [activeJobsCount, setActiveJobsCount] = useState(0);
  const [gateInCount, setGateInCount] = useState(0);
  const [rfcCount, setRfcCount] = useState(0);

  useEffect(() => {
    const updateCounts = () => {
      const allCards = getJobCards();
      const activeCards = allCards.filter(c => c.status !== 'DELIVERED' && c.status !== 'CLOSED');
      setActiveJobsCount(activeCards.length);

      const rfcCards = allCards.filter(c => c.status === 'RFC');
      setRfcCount(rfcCards.length);

      const checkIns = getVehicleCheckIns();
      const insideWorkshop = checkIns.filter(c => c.status !== 'CHECKED_OUT');
      setGateInCount(insideWorkshop.length);
    };

    updateCounts();
    const unsub = subscribeToStore(updateCounts);
    return () => unsub();
  }, []);

  const handleTabClick = (tabKey: string) => {
    triggerLightHaptic();
    setQuickMenuOpen(false);
    onTabChange(tabKey);
  };

  const isAdmin = currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN';

  const navItems = [
    {
      key: 'dashboard',
      label: 'Home',
      icon: LayoutDashboard,
      badge: 0
    },
    {
      key: 'gate-pass',
      label: 'Gate Pass',
      icon: Truck,
      badge: gateInCount
    },
    {
      key: 'status-pipeline',
      label: 'Pipeline',
      icon: Layers,
      badge: activeJobsCount
    },
    {
      key: 'rfc_quick',
      label: 'RFC Ready',
      icon: CheckCircle2,
      badge: rfcCount,
      highlight: rfcCount > 0
    },
    {
      key: 'more',
      label: 'Menu',
      icon: Menu,
      badge: 0,
      isMenu: true
    }
  ];

  return (
    <>
      {/* Quick Action Mobile Drawer Modal */}
      {quickMenuOpen && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex flex-col justify-end md:hidden animate-fade-in"
          onClick={() => setQuickMenuOpen(false)}
        >
          <div 
            className="bg-slate-900 border-t border-slate-800 rounded-t-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto pb-[calc(2rem+env(safe-area-inset-bottom,0px))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                  ⚡
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">Workshop Mobile Hub</h3>
                  <p className="text-[11px] text-slate-400">Quick floor controls • Role: <strong className="text-amber-400">{currentRole}</strong></p>
                </div>
              </div>
              <button 
                onClick={() => setQuickMenuOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Prominent High-Touch Actions */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => {
                  triggerMediumHaptic();
                  setQuickMenuOpen(false);
                  onOpenScanner();
                }}
                className="p-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-98 text-slate-950 flex flex-col items-center text-center gap-1.5 font-black shadow-lg shadow-amber-500/20"
              >
                <Camera className="w-6 h-6" />
                <span className="text-xs">Scan Plate / VIN</span>
                <span className="text-[10px] font-medium text-slate-900/80">Camera AI Detection</span>
              </button>

              <button
                onClick={() => {
                  triggerMediumHaptic();
                  setQuickMenuOpen(false);
                  onOpenNewJobCard();
                }}
                className="p-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white flex flex-col items-center text-center gap-1.5 font-black shadow-lg shadow-emerald-600/20"
              >
                <Plus className="w-6 h-6" />
                <span className="text-xs">New Job Card</span>
                <span className="text-[10px] font-medium text-emerald-100">Quick Check-in Allotment</span>
              </button>
            </div>

            {/* Quick module links */}
            <div className="space-y-1 pt-1">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block px-1">Floor Modules</span>
              
              <div className="grid grid-cols-3 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleTabClick('job-cards')}
                  className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 flex flex-col items-center text-center gap-1 text-slate-200 cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-sky-400" />
                  <span className="text-[11px] font-bold">Job Cards</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabClick('daily-huddle')}
                  className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 flex flex-col items-center text-center gap-1 text-slate-200 cursor-pointer"
                >
                  <Flame className="w-4 h-4 text-orange-400" />
                  <span className="text-[11px] font-bold">Daily Huddle</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabClick('inventory')}
                  className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 flex flex-col items-center text-center gap-1 text-slate-200 cursor-pointer"
                >
                  <Boxes className="w-4 h-4 text-amber-400" />
                  <span className="text-[11px] font-bold">Inventory</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabClick('invoices')}
                  className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 flex flex-col items-center text-center gap-1 text-slate-200 cursor-pointer"
                >
                  <Receipt className="w-4 h-4 text-emerald-400" />
                  <span className="text-[11px] font-bold">Invoices</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabClick('employees')}
                  className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 flex flex-col items-center text-center gap-1 text-slate-200 cursor-pointer"
                >
                  <Users className="w-4 h-4 text-purple-400" />
                  <span className="text-[11px] font-bold">Staff / Access</span>
                </button>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuickMenuOpen(false);
                      onOpenSupabaseModal();
                    }}
                    className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 flex flex-col items-center text-center gap-1 text-slate-200 cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-slate-400" />
                    <span className="text-[11px] font-bold">Cloud DB</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Bottom Bar Dock */}
      <nav 
        aria-label="Mobile Navigation" 
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800/80 px-2 pt-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] shadow-2xl"
      >
        <div className="grid grid-cols-5 items-center justify-between max-w-md mx-auto">
          {navItems.map((item) => {
            const isTabActive = !item.isMenu && (
              item.key === 'rfc_quick' ? (activeTab === 'rfc_quick' || activeTab === 'rfc') : (activeTab === item.key || activeTab === item.key.replace(/-/g, '_'))
            );
            const Icon = item.icon;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  if (item.isMenu) {
                    triggerLightHaptic();
                    setQuickMenuOpen(!quickMenuOpen);
                  } else if (item.key === 'rfc_quick') {
                    handleTabClick('rfc_quick');
                  } else {
                    handleTabClick(item.key);
                  }
                }}
                className={`flex flex-col items-center justify-center py-1 px-1 rounded-2xl relative transition-all active:scale-90 cursor-pointer ${
                  isTabActive 
                    ? 'text-amber-400 font-bold' 
                    : item.isMenu && quickMenuOpen 
                    ? 'text-amber-400 font-bold' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {/* Active Indicator Bar */}
                {isTabActive && (
                  <span className="absolute -top-1.5 w-6 h-1 bg-amber-400 rounded-full" />
                )}

                <div className="relative">
                  <Icon className={`w-5 h-5 transition-transform ${isTabActive ? 'scale-110 stroke-[2.5]' : 'scale-100'}`} />
                  {item.badge > 0 && (
                    <span className={`absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black flex items-center justify-center ${
                      item.highlight 
                        ? 'bg-blue-500 text-white animate-pulse' 
                        : 'bg-amber-500 text-slate-950'
                    }`}>
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>

                <span className="text-[10px] mt-1 tracking-tight leading-none truncate max-w-full">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
