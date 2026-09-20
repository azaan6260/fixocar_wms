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
  Flame,
  LogOut,
  Car,
  Wrench,
  ArrowLeftRight,
  UserCheck,
  Building2,
  ShieldAlert
} from 'lucide-react';
import { getJobCards, getVehicleCheckIns, subscribeToStore, getAuthUser } from '../lib/storage';
import { triggerLightHaptic, triggerMediumHaptic } from '../lib/mobileBridge';

interface MobileBottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenScanner: () => void;
  onOpenNewJobCard: () => void;
  onOpenSupabaseModal: () => void;
  onLogout?: () => void;
  currentRole: string;
}

export function MobileBottomNav({
  activeTab,
  onTabChange,
  onOpenScanner,
  onOpenNewJobCard,
  onOpenSupabaseModal,
  onLogout,
  currentRole
}: MobileBottomNavProps) {
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [activeJobsCount, setActiveJobsCount] = useState(0);
  const [gateInCount, setGateInCount] = useState(0);
  const [myAllottedCount, setMyAllottedCount] = useState(0);

  const authUser = getAuthUser();

  useEffect(() => {
    const updateCounts = () => {
      const allCards = getJobCards();
      const activeCards = allCards.filter(c => c.status !== 'DELIVERED' && c.status !== 'CLOSED');
      setActiveJobsCount(activeCards.length);

      const checkIns = getVehicleCheckIns();
      const insideWorkshop = checkIns.filter(c => c.status !== 'CHECKED_OUT');
      setGateInCount(insideWorkshop.length);

      // Allotted count for logged-in employee
      const user = getAuthUser();
      const empId = user?.employeeId;
      const empName = user?.name?.toLowerCase();
      
      const allotted = allCards.filter(card => {
        if (card.status === 'DELIVERED' || card.status === 'CLOSED') return false;
        if (empId && (card.assignedAdvisorId === empId || card.assignedManagerId === empId)) return true;
        return card.tasks?.some(t => 
          (empId && (t.assignedToId === empId || t.pairedDenterId === empId || t.outsourcedVendorId === empId)) ||
          (empName && (t.assignedToName?.toLowerCase().includes(empName) || t.pairedDenterName?.toLowerCase().includes(empName)))
        );
      });
      setMyAllottedCount(allotted.length);
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

  // Bottom Navigation Bar Items (Home, Cars List, Job Cards, [SCAN 📷], My Allotted, Vehicle IN/OUT, Menu)
  const navItems = [
    {
      key: 'dashboard',
      label: 'Home',
      icon: LayoutDashboard,
      badge: 0
    },
    {
      key: 'cars-list',
      label: 'Cars List',
      icon: Car,
      badge: gateInCount
    },
    {
      key: 'job-cards',
      label: 'Job Cards',
      icon: FileText,
      badge: activeJobsCount
    },
    {
      key: 'scan-action',
      label: 'Scan',
      icon: Camera,
      badge: 0,
      isScan: true
    },
    {
      key: 'role-workspace',
      label: 'My Allotted',
      icon: Wrench,
      badge: myAllottedCount,
      highlight: myAllottedCount > 0
    },
    {
      key: 'gate-pass',
      label: 'IN / OUT',
      icon: ArrowLeftRight,
      badge: 0
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
      {/* Quick Menu Bottom Drawer Modal */}
      {quickMenuOpen && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex flex-col justify-end md:hidden animate-fade-in"
          onClick={() => setQuickMenuOpen(false)}
        >
          <div 
            className="bg-slate-900 border-t border-slate-800 rounded-t-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto pb-[calc(2rem+env(safe-area-inset-bottom,0px))]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">
                  ⚡
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">Workshop Mobile Hub</h3>
                  <p className="text-[11px] text-slate-400">
                    Logged in as: <strong className="text-amber-400">{authUser?.name || currentRole}</strong>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setQuickMenuOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* High Impact Primary Actions */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => {
                  triggerMediumHaptic();
                  setQuickMenuOpen(false);
                  onOpenScanner();
                }}
                className="p-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-98 text-slate-950 flex flex-col items-center text-center gap-1.5 font-black shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <Camera className="w-6 h-6" />
                <span className="text-xs">Scan Plate / QR</span>
                <span className="text-[10px] font-medium text-slate-900/80">Camera AI Detection</span>
              </button>

              <button
                onClick={() => {
                  triggerMediumHaptic();
                  setQuickMenuOpen(false);
                  handleTabClick('gate-pass');
                }}
                className="p-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-98 text-white flex flex-col items-center text-center gap-1.5 font-black shadow-lg shadow-blue-600/20 cursor-pointer"
              >
                <ArrowLeftRight className="w-6 h-6" />
                <span className="text-xs">Vehicle IN / OUT</span>
                <span className="text-[10px] font-medium text-blue-100">Gate Pass Entry & Exit</span>
              </button>
            </div>

            {/* Menu Grid Options */}
            <div className="space-y-2 pt-1">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block px-1">
                Workshop Operations
              </span>
              
              <div className="grid grid-cols-3 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleTabClick('dashboard')}
                  className="p-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 flex flex-col items-center text-center gap-1 text-slate-200 cursor-pointer"
                >
                  <LayoutDashboard className="w-4 h-4 text-amber-400" />
                  <span className="text-[11px] font-bold">Home</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabClick('cars-list')}
                  className="p-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 flex flex-col items-center text-center gap-1 text-slate-200 cursor-pointer"
                >
                  <Car className="w-4 h-4 text-emerald-400" />
                  <span className="text-[11px] font-bold">Cars List</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabClick('job-cards')}
                  className="p-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 flex flex-col items-center text-center gap-1 text-slate-200 cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-sky-400" />
                  <span className="text-[11px] font-bold">Job Cards</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabClick('role-workspace')}
                  className="p-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 flex flex-col items-center text-center gap-1 text-slate-200 cursor-pointer"
                >
                  <Wrench className="w-4 h-4 text-purple-400" />
                  <span className="text-[11px] font-bold">My Allotted</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabClick('gate-pass')}
                  className="p-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 flex flex-col items-center text-center gap-1 text-slate-200 cursor-pointer"
                >
                  <Truck className="w-4 h-4 text-indigo-400" />
                  <span className="text-[11px] font-bold">Gate Pass</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabClick('daily-huddle')}
                  className="p-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 flex flex-col items-center text-center gap-1 text-slate-200 cursor-pointer"
                >
                  <Flame className="w-4 h-4 text-orange-400" />
                  <span className="text-[11px] font-bold">Daily Huddle</span>
                </button>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuickMenuOpen(false);
                      onOpenSupabaseModal();
                    }}
                    className="p-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 flex flex-col items-center text-center gap-1 text-slate-200 cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-slate-400" />
                    <span className="text-[11px] font-bold">Cloud DB</span>
                  </button>
                )}

                {onLogout && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerMediumHaptic();
                      setQuickMenuOpen(false);
                      onLogout();
                    }}
                    className="p-2.5 rounded-2xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/40 flex flex-col items-center text-center gap-1 text-rose-300 cursor-pointer col-span-2"
                  >
                    <LogOut className="w-4 h-4 text-rose-400" />
                    <span className="text-[11px] font-extrabold">Log Out (लॉग आउट)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Mobile Bottom Navigation Bar Dock */}
      <nav 
        aria-label="Mobile Bottom Navigation" 
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800/80 px-1 pt-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] shadow-2xl"
      >
        <div className="grid grid-cols-7 items-center justify-between max-w-lg mx-auto">
          {navItems.map((item) => {
            if (item.isScan) {
              return (
                <div key={item.key} className="flex justify-center items-center relative -top-3">
                  <button
                    type="button"
                    onClick={() => {
                      triggerMediumHaptic();
                      onOpenScanner();
                    }}
                    className="w-12 h-12 rounded-full bg-linear-to-tr from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 flex flex-col items-center justify-center font-black shadow-lg shadow-amber-500/30 transition-transform active:scale-90 cursor-pointer ring-4 ring-slate-950"
                  >
                    <Camera className="w-5 h-5" />
                    <span className="text-[8px] font-black uppercase tracking-tighter">SCAN</span>
                  </button>
                </div>
              );
            }

            const isTabActive = !item.isMenu && (
              activeTab === item.key || 
              (item.key === 'cars-list' && activeTab === 'cars-list') ||
              (item.key === 'role-workspace' && (activeTab === 'role-workspace' || activeTab === 'my-tasks')) ||
              (item.key === 'gate-pass' && activeTab === 'gate-pass')
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
                  } else {
                    handleTabClick(item.key);
                  }
                }}
                className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-xl relative transition-all active:scale-90 cursor-pointer ${
                  isTabActive 
                    ? 'text-amber-400 font-extrabold' 
                    : item.isMenu && quickMenuOpen 
                    ? 'text-amber-400 font-extrabold' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {/* Active Top Bar Indicator */}
                {isTabActive && (
                  <span className="absolute -top-1.5 w-5 h-0.5 bg-amber-400 rounded-full" />
                )}

                <div className="relative">
                  <Icon className={`w-4 h-4 transition-transform ${isTabActive ? 'scale-110 stroke-[2.5]' : 'scale-100'}`} />
                  {item.badge > 0 && (
                    <span className={`absolute -top-1.5 -right-2 min-w-[14px] h-3.5 px-0.5 rounded-full text-[8px] font-black flex items-center justify-center ${
                      item.highlight 
                        ? 'bg-purple-500 text-white animate-pulse' 
                        : 'bg-amber-500 text-slate-950'
                    }`}>
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>

                <span className="text-[9px] mt-0.5 tracking-tight leading-none truncate max-w-full">
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
