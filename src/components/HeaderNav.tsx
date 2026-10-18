import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UserRole, Workshop, City, JobCard, VehicleCheckIn, isTabAllowedForRole, getDefaultTabForRole } from '../types';
import { RoleBadge, ROLE_CONFIG } from './RoleBadge';
import { getStoredSupabaseConfig, getSupabaseClient } from '../lib/supabaseClient';
import {
  resetToDefaultMockData,
  getJobCards,
  getVehicleCheckIns,
  subscribeToStore,
  getAuthUser,
  getWorkshops,
  getCities,
  getActiveWorkshopId,
  setActiveWorkshopId,
  dispatchToastNotification
} from '../lib/storage';
import { useI18n } from '../lib/i18n';
import {
  Wrench,
  LayoutDashboard,
  FileText,
  Truck,
  Building2,
  Database,
  RefreshCw,
  ChevronDown,
  Sparkles,
  UserCheck,
  Search,
  Zap,
  Phone,
  Users,
  MapPin,
  Boxes,
  Layers,
  DollarSign,
  History,
  LogIn,
  ExternalLink,
  Receipt,
  ShoppingBag,
  Wallet,
  Camera,
  Settings,
  Car,
  LogOut,
  Fingerprint,
  Menu,
  X,
  Plus,
  Flame,
  FolderKanban,
  ShieldCheck,
  ArrowRight,
  Bot
} from 'lucide-react';
import { getSavedBiometricBinding, registerBiometricForUser } from '../lib/biometricAuth';
import { NotificationDrawer } from './NotificationDrawer';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderNavProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenSupabaseModal: () => void;
  onOpenAppVersionModal?: () => void;
  onOpenNewJobCardModal: () => void;
  onSwitchToCustomerPortal?: () => void;
  onOpenScanner?: () => void;
  onSelectJobCard?: (id: string) => void;
  onLogout?: () => void;
  onGoHome?: () => void;
}

export function HeaderNav({
  currentRole,
  onRoleChange,
  activeTab,
  onTabChange,
  onOpenSupabaseModal,
  onOpenAppVersionModal,
  onOpenNewJobCardModal,
  onSwitchToCustomerPortal,
  onOpenScanner,
  onSelectJobCard,
  onLogout,
}: HeaderNavProps) {
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [settingsDropdownOpen, setSettingsDropdownOpen] = useState(false);
  const [opsDropdownOpen, setOpsDropdownOpen] = useState(false);
  const [adminDropdownOpen, setAdminDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const [authUser, setAuthUser] = useState(() => getAuthUser());
  const [workshops, setWorkshops] = useState<Workshop[]>(() => getWorkshops());
  const [cities, setCities] = useState<City[]>(() => getCities());
  const [activeWsId, setActiveWsId] = useState<string>(() => getActiveWorkshopId());
  const [jobCards, setJobCards] = useState<JobCard[]>(() => getJobCards());
  const [checkIns, setCheckIns] = useState<VehicleCheckIn[]>(() => getVehicleCheckIns());

  const supabaseConfig = getStoredSupabaseConfig();
  const { t, language, setLanguage } = useI18n();
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [biometricBinding, setBiometricBinding] = useState(() => getSavedBiometricBinding());
  const [isBiometricRegistering, setIsBiometricRegistering] = useState(false);

  const isAdmin = currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN';
  const isManagementRole =
    currentRole === 'SUPER_ADMIN' ||
    currentRole === 'ADMIN' ||
    currentRole === 'SERVICE_ADVISOR' ||
    currentRole === 'FLOOR_MANAGER';

  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const [wsSearch, setWsSearch] = useState('');

  // Close search dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getActiveWorkshopName = () => {
    if (activeWsId === 'ALL') return 'All Workshops';
    if (activeWsId.startsWith('CITY:')) {
      const cityId = activeWsId.replace('CITY:', '');
      const city = cities.find(c => c.id === cityId);
      return city ? `City: ${city.name}` : 'City Hub';
    }
    const ws = workshops.find(w => w.id === activeWsId);
    return ws ? ws.name : 'Workshop Hub';
  };

  const handleWorkshopChange = (id: string, name: string) => {
    setActiveWorkshopId(id);
    setActiveWsId(id);
    setWsDropdownOpen(false);
    dispatchToastNotification({
      type: 'SUCCESS',
      title: 'Workshop Context Updated',
      message: `Switched active workspace to "${name}".`
    });
  };

  const filteredCities = cities.filter(
    c =>
      c.name.toLowerCase().includes(wsSearch.toLowerCase()) ||
      (c.state && c.state.toLowerCase().includes(wsSearch.toLowerCase()))
  );

  const filteredWorkshops = workshops.filter(
    ws =>
      ws.name.toLowerCase().includes(wsSearch.toLowerCase()) ||
      (ws.cityName && ws.cityName.toLowerCase().includes(wsSearch.toLowerCase()))
  );

  useEffect(() => {
    setAuthUser(getAuthUser());
    setBiometricBinding(getSavedBiometricBinding());
  }, [currentRole]);

  const handleRegisterBiometric = async () => {
    if (!authUser) {
      dispatchToastNotification({
        type: 'WARNING',
        title: 'Sign-In Required',
        message: 'Please sign in with your work password first before registering biometric credentials.'
      });
      return;
    }

    setIsBiometricRegistering(true);
    try {
      const res = await registerBiometricForUser(authUser);
      setIsBiometricRegistering(false);

      if (res.success && res.binding) {
        setBiometricBinding(res.binding);
        dispatchToastNotification({
          type: 'SUCCESS',
          title: 'Biometrics Registered',
          message: `Touch ID / Face ID linked for ${authUser.name} on this device.`
        });
      } else {
        dispatchToastNotification({
          type: 'WARNING',
          title: 'Biometric Scanner Notice',
          message: res.message || 'Biometric scan could not be completed.'
        });
      }
    } catch (err: any) {
      setIsBiometricRegistering(false);
      dispatchToastNotification({
        type: 'WARNING',
        title: 'Biometric Setup Notice',
        message: err?.message || 'Biometric registration failed. Please try again.'
      });
    }
  };

  useEffect(() => {
    const syncHeaderStore = () => {
      const cards = getJobCards();
      setWorkshops(getWorkshops());
      setCities(getCities());
      setActiveWsId(getActiveWorkshopId());
      setJobCards(cards);
      setCheckIns(getVehicleCheckIns());

      let count = 0;
      cards.forEach(c => {
        c.tasks.forEach(t => {
          if (t.requiresCustomerApproval && (t.isCustomerApproved === undefined || t.isCustomerApproved === null)) {
            count++;
          }
        });
      });
      setPendingApprovals(count);
    };

    syncHeaderStore();
    const unsubscribeWs = subscribeToStore(syncHeaderStore);

    const client = getSupabaseClient();
    let subscription: any = null;
    if (client) {
      subscription = client
        .channel('job_tasks_changes_header')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'job_tasks' }, () => {
          syncHeaderStore();
        })
        .subscribe();
    }

    return () => {
      unsubscribeWs();
      if (subscription) {
        client?.removeChannel(subscription);
      }
    };
  }, []);

  const handleReset = () => {
    if (confirm('Reset workshop store to default initial job cards and seed data?')) {
      resetToDefaultMockData();
    }
  };

  // Live Pipeline Badges
  const activeJobCardsCount = useMemo(
    () => jobCards.filter(c => c.status !== 'DELIVERED' && c.status !== 'CLOSED').length,
    [jobCards]
  );

  const pendingGateCheckInsCount = useMemo(() => {
    return checkIns.filter(c => {
      if (c.status === 'CHECKED_OUT') return false;
      const cleanReg = c.registrationNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const hasActiveCard = jobCards.some(jc => {
        if (jc.status === 'DELIVERED' || jc.status === 'CLOSED') return false;
        if (jc.checkInRecordId && jc.checkInRecordId === c.id) return true;
        return jc.vehicle.registrationNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanReg;
      });
      return !hasActiveCard;
    }).length;
  }, [checkIns, jobCards]);

  const urgentHuddleCount = useMemo(
    () => jobCards.filter(c => c.status !== 'DELIVERED' && c.status !== 'CLOSED' && c.isUrgent).length,
    [jobCards]
  );

  // Instant Global Search Results
  const searchResults = useMemo(() => {
    const q = headerSearch.trim().toLowerCase();
    if (!q) return [];
    return jobCards
      .filter(
        c =>
          c.vehicle.registrationNumber.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q) ||
          c.customer.name.toLowerCase().includes(q) ||
          c.customer.phone.toLowerCase().includes(q) ||
          `${c.vehicle.make} ${c.vehicle.model}`.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [headerSearch, jobCards]);

  // Core Workflow Pipeline Tabs (Always visible on primary bar)
  const primaryTabs = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard, badge: 0 },
    { id: 'ai-agent', label: 'AI Co-Pilot', icon: Bot, badge: 0, badgeColor: 'bg-indigo-600 text-white' },
    { id: 'gate-pass', label: 'Gate Entry', icon: LogIn, badge: pendingGateCheckInsCount, badgeColor: 'bg-amber-500 text-slate-950' },
    { id: 'job-cards', label: t('nav.jobCards'), icon: FileText, badge: activeJobCardsCount, badgeColor: 'bg-blue-500 text-white' },
    { id: 'status-pipeline', label: 'Pipeline Board', icon: Layers, badge: 0 },
    { id: 'daily-huddle', label: 'Daily Huddle', icon: Flame, badge: urgentHuddleCount, badgeColor: 'bg-rose-500 text-white' },
    { id: 'role-workspace', label: t('nav.myRoleTasks'), icon: UserCheck, badge: 0 },
    { id: 'invoices', label: 'GST Billing', icon: Receipt, badge: 0 },
  ].filter(item => isTabAllowedForRole(currentRole, item.id));

  // Secondary Operations & Parts Modules
  const operationsModules = [
    { id: 'part-basket', label: 'Part Order Basket', desc: 'Approve & order technician spare parts', icon: ShoppingBag },
    { id: 'inventory', label: 'Parts & Inventory', desc: 'Stock levels, SKUs & consumption logs', icon: Boxes },
    { id: 'outsourced-jobs', label: 'Outsourced Sublet Jobs', desc: 'Lathe, machine shop & external vendor jobs', icon: ExternalLink },
    { id: 'deliveries', label: t('nav.delivery'), desc: 'Pickup & delivery driver tracking', icon: Truck },
    { id: 'job-cards-history', label: 'Job Cards Archive', desc: 'Delivered & closed historical work orders', icon: History },
  ].filter(item => isTabAllowedForRole(currentRole, item.id));

  // Admin, Finance & Master Setup Modules
  const adminModules = [
    { id: 'accounting-expenses', label: 'Accounting & Expenses', desc: 'P&L ledger, workshop expenses & cashflow', icon: Wallet },
    { id: 'contractor-payouts', label: 'Contractor Payouts', desc: 'Painter, denter & contract labor settlements', icon: DollarSign },
    { id: 'employees', label: t('nav.employees'), desc: 'Staff roles, logins, attendance & payroll', icon: Users },
    { id: 'vendors', label: t('nav.vendors'), desc: 'Sublet vendors, suppliers & PO ledgers', icon: Building2 },
    { id: 'standard-jobs', label: 'Standard Jobs Library', desc: 'Fixed rate catalog for panels & services', icon: Zap },
    { id: 'car-models', label: 'Car Models & Variants', desc: 'Vehicle master database & fuel types', icon: Car },
    { id: 'workshops', label: 'Cities & Workshops', desc: 'Multi-branch workshop hubs & Cars24 tie-ups', icon: MapPin },
    { id: 'customer-portal', label: t('nav.customerPortal'), desc: 'Live customer approval & tracking portal', icon: Sparkles },
  ].filter(item => isTabAllowedForRole(currentRole, item.id));

  const allAllowedMobileItems = [
    ...primaryTabs,
    ...operationsModules,
    ...adminModules,
  ];

  const isOpsTabActive = operationsModules.some(m => m.id === activeTab);
  const isAdminTabActive = adminModules.some(m => m.id === activeTab);

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 shadow-2xs pt-[max(env(safe-area-inset-top,0px),4px)]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 w-full">
        {/* Top Bar: Brand, Workshop Context, Global Search, Primary Actions */}
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-3">
          {/* Left: Brand & Workshop Switcher */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onTabChange('dashboard')}
              className="flex items-center gap-2 text-left group cursor-pointer"
            >
              <div className="bg-blue-600 group-hover:bg-blue-500 transition-colors p-2 rounded-xl text-white shadow-sm shadow-blue-600/20 flex items-center justify-center shrink-0">
                <Wrench className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white leading-none">
                  Fixo<span className="text-blue-600 dark:text-blue-400">Car</span>
                </h1>
                <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest hidden sm:block mt-0.5">
                  Workshop OS
                </p>
              </div>
            </button>

            <div className="hidden md:block h-5 w-px bg-slate-200 dark:bg-slate-800" />

            {/* Workshop Scope Switcher (Desktop) */}
            <div className="hidden md:block relative">
              {isAdmin ? (
                <>
                  <button
                    type="button"
                    onClick={() => setWsDropdownOpen(!wsDropdownOpen)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/90 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                    title="Switch active workshop hub"
                  >
                    <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="max-w-[140px] truncate">{getActiveWorkshopName()}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </button>

                  {wsDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-50" onClick={() => setWsDropdownOpen(false)} />
                      <div className="absolute left-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-3 z-[60]">
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                          <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                            Workshop Context
                          </span>
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-md">
                            Multi-Hub
                          </span>
                        </div>

                        <div className="relative mb-2">
                          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Filter city or workshop..."
                            value={wsSearch}
                            onChange={e => setWsSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            onClick={e => e.stopPropagation()}
                          />
                        </div>

                        <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                          {'all cities & workshops'.includes(wsSearch.toLowerCase()) && (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                handleWorkshopChange('ALL', 'All Cities & Workshops');
                              }}
                              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold text-left transition-colors cursor-pointer ${
                                activeWsId === 'ALL'
                                  ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <span>All Cities & Workshops</span>
                              {activeWsId === 'ALL' && <span className="text-blue-500">✓</span>}
                            </button>
                          )}

                          {filteredCities.length > 0 && (
                            <div>
                              <div className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 px-2 mb-1">
                                Cities
                              </div>
                              <div className="space-y-0.5">
                                {filteredCities.map(c => {
                                  const optId = `CITY:${c.id}`;
                                  const isCurrent = activeWsId === optId;
                                  return (
                                    <button
                                      key={`ws-opt-city-${c.id}`}
                                      type="button"
                                      onClick={e => {
                                        e.stopPropagation();
                                        handleWorkshopChange(optId, `City: ${c.name}`);
                                      }}
                                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium text-left transition-colors cursor-pointer ${
                                        isCurrent
                                          ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold'
                                          : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                      }`}
                                    >
                                      <span className="truncate">{c.name}</span>
                                      {isCurrent && <span className="text-blue-500 text-xs">✓</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {filteredWorkshops.length > 0 && (
                            <div>
                              <div className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 px-2 mb-1">
                                Workshop Hubs
                              </div>
                              <div className="space-y-0.5">
                                {filteredWorkshops.map(ws => {
                                  const isCurrent = activeWsId === ws.id;
                                  return (
                                    <button
                                      key={`ws-opt-ws-${ws.id}`}
                                      type="button"
                                      onClick={e => {
                                        e.stopPropagation();
                                        handleWorkshopChange(ws.id, ws.name);
                                      }}
                                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium text-left transition-colors cursor-pointer ${
                                        isCurrent
                                          ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold'
                                          : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                      }`}
                                    >
                                      <div className="truncate flex flex-col">
                                        <span className="font-bold">{ws.name}</span>
                                        <span className="text-[10px] text-slate-400 truncate">{ws.cityName || 'Active Hub'}</span>
                                      </div>
                                      {isCurrent && <span className="text-blue-500 text-xs shrink-0 ml-1">✓</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="max-w-[140px] truncate">{getActiveWorkshopName()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Center: Global Vehicle & Job Card Quick Search */}
          <div ref={searchContainerRef} className="hidden sm:block relative flex-1 max-w-md mx-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={headerSearch}
                onFocus={() => setSearchFocused(true)}
                onChange={e => {
                  setHeaderSearch(e.target.value);
                  setSearchFocused(true);
                }}
                placeholder="Quick jump: Reg No, Job Card ID, Customer, Model..."
                className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
              />
              {headerSearch && (
                <button
                  type="button"
                  onClick={() => setHeaderSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Instant Search Results Dropdown */}
            {searchFocused && headerSearch.trim().length > 0 && (
              <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50">
                <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <span>Matching Vehicles & Job Cards</span>
                  <span>{searchResults.length} found</span>
                </div>
                {searchResults.length === 0 ? (
                  <div className="p-4 text-center space-y-2">
                    <p className="text-xs text-slate-500">No job card found matching "{headerSearch}"</p>
                    {isManagementRole && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchFocused(false);
                          onOpenNewJobCardModal();
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create New Job Card</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
                    {searchResults.map(card => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => {
                          setSearchFocused(false);
                          setHeaderSearch('');
                          onSelectJobCard?.(card.id);
                        }}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-blue-50/60 dark:hover:bg-slate-800/80 flex items-center justify-between gap-3 transition-colors cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-xs text-slate-900 dark:text-white">
                              {card.vehicle.registrationNumber}
                            </span>
                            <span className="font-mono text-[10px] font-bold text-slate-400">{card.id}</span>
                            {card.isCars24 && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-orange-500 text-white uppercase">
                                Cars24
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {card.vehicle.make} {card.vehicle.model} • {card.customer.name}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                            {card.status.replace(/_/g, ' ')}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-blue-500" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Primary Actions & Profile/Settings */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            {/* Scan Plate Button */}
            {onOpenScanner && (
              <button
                type="button"
                onClick={onOpenScanner}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-amber-400 border border-amber-500/30 hover:border-amber-400 font-bold text-xs transition-all cursor-pointer active:scale-95"
                title="Scan Vehicle License Plate (OCR)"
              >
                <Camera className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="hidden lg:inline">Scan Plate</span>
              </button>
            )}

            {/* Primary CTA: + New Job Card */}
            {isManagementRole && (
              <button
                type="button"
                onClick={onOpenNewJobCardModal}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-sm shadow-blue-600/20 cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>New Job Card</span>
              </button>
            )}

            <PWAInstallButton />
            <NotificationDrawer onSelectJobCard={onSelectJobCard} />

            {/* Role Switcher / Indicator */}
            <div className="relative">
              {authUser?.role === 'SUPER_ADMIN' || authUser?.role === 'ADMIN' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs transition-colors cursor-pointer"
                    title="Switch role view (Admin Audit)"
                  >
                    <RoleBadge role={currentRole} hideLabelOnMobile={false} />
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </button>

                  {roleDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setRoleDropdownOpen(false)} />
                      <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2 z-50">
                        <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Audit Role Workspace</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">Preview role-specific views & permissions</p>
                        </div>
                        <div className="space-y-1 max-h-80 overflow-y-auto">
                          {(Object.keys(ROLE_CONFIG) as UserRole[]).map(r => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => {
                                onRoleChange(r);
                                setRoleDropdownOpen(false);
                                if (!isTabAllowedForRole(r, activeTab)) {
                                  onTabChange(getDefaultTabForRole(r));
                                }
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer ${
                                currentRole === r
                                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold'
                                  : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <RoleBadge role={r} />
                              {currentRole === r && <span className="text-blue-600 dark:text-blue-400 font-bold">Active</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                  <RoleBadge role={currentRole} hideLabelOnMobile={false} />
                </div>
              )}
            </div>

            {/* Unified System Settings & User Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setSettingsDropdownOpen(!settingsDropdownOpen)}
                className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer relative"
                title="System Settings & Account"
              >
                <Settings className="w-4 h-4" />
                <span
                  className={`w-2 h-2 rounded-full absolute -top-0.5 -right-0.5 border border-white dark:border-slate-900 ${
                    supabaseConfig.isConfigured ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
              </button>

              {settingsDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSettingsDropdownOpen(false)} />
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2.5 z-50 space-y-2">
                    {/* User Identity */}
                    <div className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-800">
                      <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                        {authUser?.name || 'Workshop Staff'}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {authUser?.email || authUser?.loginId || currentRole}
                      </p>
                    </div>

                    <div className="space-y-1">
                      {/* Supabase Cloud Database */}
                      <button
                        type="button"
                        onClick={() => {
                          onOpenSupabaseModal();
                          setSettingsDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer ${
                          supabaseConfig.isConfigured
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-amber-600 dark:text-amber-400 font-bold'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Database className="w-3.5 h-3.5" />
                          <span>{supabaseConfig.isConfigured ? 'Supabase Cloud Connected' : 'Connect Supabase DB'}</span>
                        </span>
                        <span className={`w-2 h-2 rounded-full ${supabaseConfig.isConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      </button>

                      {/* Biometric Quick Login */}
                      {authUser && (
                        <button
                          type="button"
                          onClick={() => {
                            setSettingsDropdownOpen(false);
                            handleRegisterBiometric();
                          }}
                          disabled={isBiometricRegistering}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <Fingerprint className="w-3.5 h-3.5 text-emerald-500" />
                            <span>
                              {isBiometricRegistering
                                ? 'Scanning...'
                                : biometricBinding?.userId === authUser.id
                                ? 'Biometrics Bound ✓'
                                : 'Bind Touch / Face ID'}
                            </span>
                          </span>
                        </button>
                      )}

                      {/* Customer Portal Switch */}
                      <button
                        type="button"
                        onClick={() => {
                          setSettingsDropdownOpen(false);
                          if (onSwitchToCustomerPortal) {
                            onSwitchToCustomerPortal();
                          } else {
                            onTabChange('customer-portal');
                          }
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          <span>{t('action.customerPortal')}</span>
                        </span>
                        {pendingApprovals > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                            {pendingApprovals}
                          </span>
                        )}
                      </button>

                      {/* Language Switcher */}
                      <div className="flex items-center justify-between px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Language</span>
                        <div className="flex items-center gap-0.5 bg-slate-200 dark:bg-slate-700 p-0.5 rounded-lg">
                          <button
                            type="button"
                            onClick={() => setLanguage('en')}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors ${
                              language === 'en'
                                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                                : 'text-slate-500'
                            }`}
                          >
                            EN
                          </button>
                          <button
                            type="button"
                            onClick={() => setLanguage('hi')}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors ${
                              language === 'hi'
                                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                                : 'text-slate-500'
                            }`}
                          >
                            हि
                          </button>
                        </div>
                      </div>

                      {/* Support Helpline */}
                      <a
                        href="tel:8819915656"
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Support Helpline</span>
                        </span>
                        <span className="font-mono font-bold text-[11px] text-emerald-600 dark:text-emerald-400">8819915656</span>
                      </a>

                      {/* Reset Demo Data */}
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            setSettingsDropdownOpen(false);
                            handleReset();
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Reset Seed Data</span>
                        </button>
                      )}
                    </div>

                    {onLogout && (
                      <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => {
                            setSettingsDropdownOpen(false);
                            onLogout();
                          }}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-bold transition-colors cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Mobile Controls */}
          <div className="flex sm:hidden items-center gap-1.5 shrink-0">
            {isManagementRole && (
              <button
                type="button"
                onClick={onOpenNewJobCardModal}
                className="px-2.5 py-1.5 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center gap-1 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Job Card</span>
              </button>
            )}
            <NotificationDrawer onSelectJobCard={onSelectJobCard} />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              aria-label="Toggle Mobile Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Desktop Categorized Navigation Bar (Clean, Zero Horizontal Overflow) */}
        <div className="hidden sm:flex items-center justify-between py-1.5 border-t border-slate-200/70 dark:border-slate-800/80 gap-2">
          {/* Primary Workflow Pipeline Tabs */}
          <nav className="flex items-center gap-1 flex-wrap">
            {primaryTabs.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.label}</span>
                  {item.badge > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-black leading-tight ${
                        isActive ? 'bg-white text-blue-700' : item.badgeColor || 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Grouped Module Dropdowns: Operations & Parts + Admin & Master */}
          <div className="flex items-center gap-1.5 shrink-0">
            {operationsModules.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setOpsDropdownOpen(!opsDropdownOpen);
                    setAdminDropdownOpen(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    isOpsTabActive
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                      : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200/70 dark:border-slate-700/70 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Boxes className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Operations & Parts</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                </button>

                {opsDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpsDropdownOpen(false)} />
                    <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2 z-50 space-y-1">
                      <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Parts, Sublet & Logistics
                      </div>
                      {operationsModules.map(mod => {
                        const Icon = mod.icon;
                        const active = activeTab === mod.id;
                        return (
                          <button
                            key={mod.id}
                            type="button"
                            onClick={() => {
                              onTabChange(mod.id);
                              setOpsDropdownOpen(false);
                            }}
                            className={`w-full flex items-start gap-2.5 p-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                              active
                                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            <div className={`p-1.5 rounded-lg shrink-0 ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold">{mod.label}</div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">{mod.desc}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {adminModules.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setAdminDropdownOpen(!adminDropdownOpen);
                    setOpsDropdownOpen(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    isAdminTabActive
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                      : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200/70 dark:border-slate-700/70 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <FolderKanban className="w-3.5 h-3.5 text-amber-500" />
                  <span>Finance & Master Setup</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                </button>

                {adminDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setAdminDropdownOpen(false)} />
                    <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2 z-50 space-y-1 max-h-[75vh] overflow-y-auto">
                      <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Accounting, Payouts & Master Directories
                      </div>
                      {adminModules.map(mod => {
                        const Icon = mod.icon;
                        const active = activeTab === mod.id;
                        return (
                          <button
                            key={mod.id}
                            type="button"
                            onClick={() => {
                              onTabChange(mod.id);
                              setAdminDropdownOpen(false);
                            }}
                            className={`w-full flex items-start gap-2.5 p-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                              active
                                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            <div className={`p-1.5 rounded-lg shrink-0 ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold flex items-center justify-between">
                                <span>{mod.label}</span>
                                {mod.id === 'customer-portal' && pendingApprovals > 0 && (
                                  <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                                    {pendingApprovals}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">{mod.desc}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Slide-Down Drawer */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-slate-200 dark:border-slate-800 py-3 space-y-3 bg-white dark:bg-slate-900">
            {/* Mobile Quick Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={headerSearch}
                onChange={e => setHeaderSearch(e.target.value)}
                placeholder="Search vehicle Reg No, Job Card, Customer..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white"
              />
              {headerSearch.trim().length > 0 && searchResults.length > 0 && (
                <div className="mt-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700">
                  {searchResults.map(card => (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => {
                        setHeaderSearch('');
                        setMobileMenuOpen(false);
                        onSelectJobCard?.(card.id);
                      }}
                      className="w-full p-2.5 text-left flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono font-black text-slate-900 dark:text-white">{card.vehicle.registrationNumber}</span>
                        <span className="ml-2 text-slate-500">{card.customer.name}</span>
                      </div>
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">Open →</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Active User Info */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-black text-slate-900 dark:text-white">
                    {authUser?.name || 'Authorized Staff'}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">{getActiveWorkshopName()}</div>
                </div>
                <RoleBadge role={currentRole} hideLabelOnMobile={false} />
              </div>
            </div>

            {/* All Allowed Modules List */}
            <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
              <div className="text-[10px] font-black uppercase text-slate-400 px-2 pt-1 pb-0.5">All Modules</div>
              {allAllowedMobileItems.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={`m-tab-${item.id}`}
                    type="button"
                    onClick={() => {
                      onTabChange(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {onLogout && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full py-2.5 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/30 font-bold text-xs flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
