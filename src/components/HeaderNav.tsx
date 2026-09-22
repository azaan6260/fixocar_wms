import React, { useState, useEffect } from 'react';
import { UserRole, Workshop, City, isTabAllowedForRole, getDefaultTabForRole } from '../types';
import { RoleBadge, ROLE_CONFIG } from './RoleBadge';
import { getStoredSupabaseConfig, getSupabaseClient } from '../lib/supabaseClient';
import { resetToDefaultMockData, getJobCards, getAllJobCards, getAllEmployees, subscribeToStore, getAuthUser, logoutAuthUser, getWorkshops, getCities, getActiveWorkshopId, setActiveWorkshopId, dispatchToastNotification } from '../lib/storage';
import { syncFromSupabase } from '../lib/syncService';
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
  Palette,
  QrCode,
  Flame,
  Clock,
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
  Home,
  Fingerprint,
  Menu,
  X
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
  onGoHome,
}: HeaderNavProps) {
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [settingsDropdownOpen, setSettingsDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState('');
  const [authUser, setAuthUser] = useState(() => getAuthUser());
  const [workshops, setWorkshops] = useState<Workshop[]>(() => getWorkshops());
  const [cities, setCities] = useState<City[]>(() => getCities());
  const [activeWsId, setActiveWsId] = useState<string>(() => getActiveWorkshopId());
  const supabaseConfig = getStoredSupabaseConfig();
  const { t, language, setLanguage } = useI18n();
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [biometricBinding, setBiometricBinding] = useState(() => getSavedBiometricBinding());
  const [isBiometricRegistering, setIsBiometricRegistering] = useState(false);
  const isAdmin = currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN';
  const isManagementRole = currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN' || currentRole === 'SERVICE_ADVISOR' || currentRole === 'FLOOR_MANAGER';

  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const [wsSearch, setWsSearch] = useState('');

  const getActiveWorkshopName = () => {
    if (activeWsId === 'ALL') return 'All Cities & Workshops';
    if (activeWsId.startsWith('CITY:')) {
      const cityId = activeWsId.replace('CITY:', '');
      const city = cities.find(c => c.id === cityId);
      return city ? `City: ${city.name}` : 'City Context';
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
      title: 'Context Switched',
      message: `Successfully switched active workshop context to "${name}".`
    });
  };

  const filteredCities = cities.filter(c => 
    c.name.toLowerCase().includes(wsSearch.toLowerCase()) ||
    (c.state && c.state.toLowerCase().includes(wsSearch.toLowerCase()))
  );
  
  const filteredWorkshops = workshops.filter(ws => 
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
          title: 'Biometrics Registered!',
          message: `Fingerprint / Touch ID / Face ID successfully linked for ${authUser.name} on this device.`
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
      setWorkshops(getWorkshops());
      setCities(getCities());
      setActiveWsId(getActiveWorkshopId());
    };
    syncHeaderStore();
    const unsubscribeWs = subscribeToStore(syncHeaderStore);
    return () => unsubscribeWs();
  }, []);

  useEffect(() => {
    const calculatePending = () => {
      const cards = getJobCards();
      let count = 0;
      cards.forEach(c => {
        c.tasks.forEach(t => {
          if (t.requiresCustomerApproval && t.isCustomerApproved === undefined) {
            count++;
          }
        });
      });
      setPendingApprovals(count);
    };

    calculatePending();
    const unsubscribe = subscribeToStore(calculatePending);

    const client = getSupabaseClient();
    let subscription: any = null;
    if (client) {
      subscription = client.channel('job_tasks_changes_header')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'job_tasks' },
          () => {
            calculatePending();
          }
        )
        .subscribe();
    }

    return () => {
      unsubscribe();
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

  const row1Items = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { id: 'gate-pass', label: '🚗 Gate Pass', icon: LogIn },
    { id: 'daily-huddle', label: '🔥 Daily Huddle', icon: Flame },
    { id: 'workshops', label: 'Cities & Workshops', icon: MapPin },
    { id: 'job-cards', label: t('nav.jobCards'), icon: FileText },
    { id: 'job-cards-history', label: '📜 Job Cards History', icon: History },
    { id: 'status-pipeline', label: '📊 Status Pipeline Board', icon: Layers },
    { id: 'invoices', label: '🧾 GST Invoices', icon: Receipt },
    { id: 'accounting-expenses', label: '💰 Accounting & Expenses', icon: Wallet },
    { id: 'part-basket', label: '🛒 Part Order Basket', icon: ShoppingBag },
    { id: 'standard-jobs', label: 'Standard Jobs Library', icon: Zap },
    { id: 'contractor-payouts', label: 'Contractor Payouts', icon: DollarSign },
    { id: 'inventory', label: 'Parts & Inventory', icon: Boxes },
  ];

  const row2Items = [
    { id: 'car-models', label: '🚗 Car Models & Variants', icon: Car },
    { id: 'role-workspace', label: t('nav.myRoleTasks'), icon: UserCheck },
    { id: 'outsourced-jobs', label: 'Outsourced Jobs', icon: ExternalLink },
    { id: 'customer-portal', label: t('nav.customerPortal'), icon: Sparkles },
    { id: 'deliveries', label: t('nav.delivery'), icon: Truck },
    { id: 'vendors', label: t('nav.vendors'), icon: Building2 },
    { id: 'employees', label: t('nav.employees'), icon: Users },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 sm:bg-white/95 sm:dark:bg-slate-900/95 sm:backdrop-blur-md border-b border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 shadow-xs max-w-full pt-[max(env(safe-area-inset-top,0px),8px)]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 w-full max-w-full">
        {/* Top Header Bar: Logo & Actions */}
        <div className="flex items-center justify-between min-h-[56px] sm:h-16 gap-1.5 sm:gap-3 w-full py-1">
          
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <div className="bg-blue-600 p-2 rounded-xl text-white shadow-md shadow-blue-600/20 flex items-center justify-center shrink-0">
              <Wrench className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-0.5 sm:gap-1">
                Fixo<span className="text-blue-600 dark:text-blue-400">Car</span>
              </h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider hidden sm:block">
                Worry-Free Car Repair
              </p>
            </div>
          </div>

          {/* Desktop Right Controls: Role Switcher, Quick Actions & Call */}
          <div className="hidden sm:flex items-center gap-1.5 sm:gap-2.5 shrink-0">

            {/* Active Workshop / City Scope Selector */}
            {isAdmin ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setWsDropdownOpen(!wsDropdownOpen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 hover:dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-xs font-black text-blue-950 dark:text-blue-100 shadow-2xs cursor-pointer select-none shrink-0"
                  title="Quick switch active workshop context"
                >
                  <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="max-w-[120px] sm:max-w-[180px] truncate">
                    {getActiveWorkshopName()}
                  </span>
                  <ChevronDown className="w-3 h-3 text-blue-500 shrink-0" />
                </button>

                {wsDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-50 cursor-default" onClick={() => setWsDropdownOpen(false)} />
                    <div className="absolute left-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-3 z-[60] animate-in fade-in zoom-in-95 duration-100">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                          Switch Workshop Context
                        </span>
                        <span className="text-[9px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5 rounded">
                          Admin Switcher
                        </span>
                      </div>

                      {/* Dropdown Search Box */}
                      <div className="relative mb-2">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search workshops or cities..."
                          value={wsSearch}
                          onChange={(e) => setWsSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>

                      <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                        {/* Option 1: Global View */}
                        {('all cities & workshops'.includes(wsSearch.toLowerCase())) && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleWorkshopChange('ALL', 'All Cities & Workshops'); }}
                            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold text-left transition-colors cursor-pointer ${
                              activeWsId === 'ALL'
                                ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              <span>🌐</span>
                              <span>All Cities & Workshops</span>
                            </span>
                            {activeWsId === 'ALL' && <span className="text-blue-500">✓</span>}
                          </button>
                        )}

                        {/* Option 2: Cities Group */}
                        {filteredCities.length > 0 && (
                          <div>
                            <div className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 px-2.5 mb-1">
                              🏙️ Cities
                            </div>
                            <div className="space-y-0.5">
                              {filteredCities.map((c) => {
                                const optId = `CITY:${c.id}`;
                                const isCurrent = activeWsId === optId;
                                return (
                                  <button
                                    key={`ws-opt-city-${c.id}`}
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleWorkshopChange(optId, `City: ${c.name}`); }}
                                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium text-left transition-colors cursor-pointer ${
                                      isCurrent
                                        ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold'
                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                    }`}
                                  >
                                    <span className="truncate">City: {c.name}</span>
                                    {isCurrent && <span className="text-blue-500 text-xs">✓</span>}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Option 3: Workshops Group */}
                        {filteredWorkshops.length > 0 && (
                          <div>
                            <div className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 px-2.5 mb-1">
                              📍 Workshop Hubs
                            </div>
                            <div className="space-y-0.5">
                              {filteredWorkshops.map((ws) => {
                                const isCurrent = activeWsId === ws.id;
                                return (
                                  <button
                                    key={`ws-opt-ws-${ws.id}`}
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleWorkshopChange(ws.id, ws.name); }}
                                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium text-left transition-colors cursor-pointer ${
                                      isCurrent
                                        ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold'
                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                    }`}
                                  >
                                    <div className="truncate flex flex-col">
                                      <span className="font-bold">{ws.name}</span>
                                      <span className="text-[9px] text-slate-400 truncate">{ws.cityName || 'Active Hub'}</span>
                                    </div>
                                    {isCurrent && <span className="text-blue-500 text-xs shrink-0 ml-1">✓</span>}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        
                        {filteredCities.length === 0 && filteredWorkshops.length === 0 && (
                          <div className="text-center py-4 text-xs text-slate-400">
                            No workshops found matching "{wsSearch}"
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1 sm:gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-3xs shrink-0 select-none">
                <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="max-w-[120px] sm:max-w-[180px] truncate">
                  {getActiveWorkshopName()}
                </span>
              </div>
            )}

            <button 
              type="button"
              onClick={() => {
                if (onSwitchToCustomerPortal) {
                  onSwitchToCustomerPortal();
                } else {
                  try {
                    window.history.pushState({}, '', '/');
                    window.dispatchEvent(new Event('popstate'));
                  } catch (e) {
                    window.location.href = '/';
                  }
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold hover:bg-amber-500 hover:text-slate-950 transition-all"
            >
              🚘 {t('action.customerPortal')}
            </button>

            {/* Direct Supabase Database Configure & Connection Status Button */}
            <button
              type="button"
              onClick={onOpenSupabaseModal}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-black transition-all shadow-2xs active:scale-95 cursor-pointer ${
                supabaseConfig.isConfigured
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100'
                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 hover:bg-amber-100'
              }`}
              title={supabaseConfig.isConfigured ? 'Live Supabase Connected.' : 'Click to enter Supabase URL & Anon Key.'}
            >
              <Database className={`w-3.5 h-3.5 ${supabaseConfig.isConfigured ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`} />
              <span>{supabaseConfig.isConfigured ? 'Supabase Live' : 'Connect Supabase'}</span>
            </button>

            {/* Direct Hotline Call Button */}
            <a
              href="tel:8819915656"
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800 text-xs font-black tracking-wide hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all shadow-2xs"
              title="Call FixoCar Workshop Hotline"
            >
              <Phone className="w-3.5 h-3.5 fill-current text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>8819915656</span>
            </a>

            {/* OCR Number Plate Scanner Button */}
            {onOpenScanner && (
              <button
                type="button"
                onClick={onOpenScanner}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-900 dark:bg-slate-800 text-amber-400 border border-amber-500/40 hover:border-amber-400 font-bold text-xs transition-all shadow-xs active:scale-95"
                title="Scan Vehicle Number Plate"
              >
                <Camera className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Scan Plate</span>
              </button>
            )}

            {/* Quick Create Job Card Pill */}
            {isManagementRole && (
              <button
                onClick={onOpenNewJobCardModal}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-md shadow-blue-600/20 active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>+ Create Card</span>
              </button>
            )}

            {/* Live Toast & Pipeline Notifications Drawer */}
            <PWAInstallButton />
            <NotificationDrawer onSelectJobCard={onSelectJobCard} />

            {/* Settings Dropdown */}
            <div className="relative">
              <button
                onClick={() => setSettingsDropdownOpen(!settingsDropdownOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors"
                title="Administrative Settings"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Settings</span>
              </button>

              {settingsDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-2">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Administrative Settings</p>
                  </div>
                  
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        onOpenSupabaseModal();
                        setSettingsDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-colors ${
                        supabaseConfig.isConfigured
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Database className={`w-4 h-4 ${supabaseConfig.isConfigured ? 'text-emerald-500' : 'text-slate-400'}`} />
                      <span>{supabaseConfig.isConfigured ? 'Live Supabase Configured' : 'Configure Supabase'}</span>
                    </button>
                    
                    <div className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        Language
                      </span>
                      <div className="flex items-center gap-0.5 bg-slate-200 dark:bg-slate-700 p-0.5 rounded-full border border-slate-300 dark:border-slate-600">
                        <button 
                          onClick={() => setLanguage('en')}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${language === 'en' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                          EN
                        </button>
                        <button 
                          onClick={() => setLanguage('hi')}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${language === 'hi' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                          हि
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 mt-2 text-center">
                    <button
                      onClick={() => {
                        setSettingsDropdownOpen(false);
                        handleReset();
                      }}
                      className="inline-flex w-full justify-center items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-[11px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors font-medium border border-slate-100 dark:border-slate-700"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Reset Store Seed Data
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Role Badge / Switcher Menu */}
            <div className="relative shrink-0">
              {authUser?.role === 'SUPER_ADMIN' || authUser?.role === 'ADMIN' ? (
                <>
                  <button
                    onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                    className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white transition-colors cursor-pointer"
                    title="Audit role workspaces (Executive feature)"
                  >
                    <RoleBadge role={currentRole} hideLabelOnMobile={false} />
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </button>

                  {roleDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Audit Role View</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Executive inspection of technician views</p>
                      </div>
                      <div className="space-y-1 max-h-80 overflow-y-auto">
                        {(Object.keys(ROLE_CONFIG) as UserRole[]).map((r) => (
                          <button
                            key={r}
                            onClick={() => {
                              onRoleChange(r);
                              setRoleDropdownOpen(false);
                              if (!isTabAllowedForRole(r, activeTab)) {
                                onTabChange(getDefaultTabForRole(r));
                              }
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors ${
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
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                  <RoleBadge role={currentRole} hideLabelOnMobile={false} />
                </div>
              )}
            </div>

            {/* Quick Biometric Fingerprint Binding Button */}
            {authUser && (
              <button
                type="button"
                onClick={handleRegisterBiometric}
                disabled={isBiometricRegistering}
                className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer ${
                  biometricBinding?.userId === authUser.id
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/60'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 animate-pulse'
                }`}
                title={
                  biometricBinding?.userId === authUser.id
                    ? `Biometrics registered for ${authUser.name}. Click to re-scan.`
                    : 'Register Fingerprint / Face ID for 1-tap quick sign-in on this device'
                }
              >
                <Fingerprint className="w-3.5 h-3.5 text-emerald-500" />
                <span>
                  {isBiometricRegistering ? 'Scanning...' : biometricBinding?.userId === authUser.id ? 'Biometrics Registered ✓' : 'Bind Fingerprint'}
                </span>
              </button>
            )}

            {/* Sign Out Button */}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 text-xs font-bold transition-all cursor-pointer shrink-0"
                title="Sign Out of Session"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span>Sign Out</span>
              </button>
            )}

          </div>

          {/* Mobile Right Controls: Compact Buttons & Hamburger Toggle */}
          <div className="flex sm:hidden items-center gap-1.5 shrink-0">
            {/* Notification Drawer */}
            <NotificationDrawer onSelectJobCard={onSelectJobCard} />

            {/* Mobile Menu Hamburger Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              aria-label="Toggle Mobile Workspace Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>

        {/* Mobile Navigation Slide-Down Drawer (Visible on Mobile when Toggled) */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-slate-200 dark:border-slate-800 py-3 space-y-3 bg-white dark:bg-slate-900/98 animate-in slide-in-from-top-2 duration-150">
            
            {/* Active User Info & Role Switcher */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>{authUser?.name || 'Authorized Staff'}</span>
                    <span className="text-[10px] text-blue-500 font-mono">({authUser?.role || currentRole})</span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{authUser?.email || authUser?.loginId || 'Staff Account'}</div>
                </div>
                <RoleBadge role={currentRole} hideLabelOnMobile={false} />
              </div>

              {/* Biometric Mobile Quick Registration Card */}
              {authUser && (
                <div className="p-2.5 rounded-xl bg-slate-900 border border-blue-500/30 text-white flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Fingerprint className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
                    <div className="truncate">
                      <div className="text-[11px] font-bold text-white">
                        {biometricBinding?.userId === authUser.id ? 'Biometrics Registered ✓' : 'Register Biometrics'}
                      </div>
                      <div className="text-[9px] text-slate-400 truncate">
                        {biometricBinding?.userId === authUser.id ? `Bound on this device` : 'Fingerprint/Face ID 1-tap sign in'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleRegisterBiometric();
                    }}
                    disabled={isBiometricRegistering}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shrink-0 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isBiometricRegistering ? 'Scanning...' : biometricBinding?.userId === authUser.id ? 'Re-Scan' : 'Bind Now'}
                  </button>
                </div>
              )}

              {/* Scope Selector */}
              {isAdmin ? (
                <div className="space-y-1.5 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">
                      Active Workshop Context
                    </span>
                    <span className="text-[8px] font-bold text-blue-600 bg-blue-50 px-1 py-0.5 rounded uppercase">
                      Quick-Switch
                    </span>
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setWsDropdownOpen(!wsDropdownOpen)}
                      className="w-full flex items-center justify-between p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 font-bold text-xs"
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="truncate">{getActiveWorkshopName()}</span>
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-blue-500" />
                    </button>
                    
                    {wsDropdownOpen && (
                      <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-2 z-50 animate-in fade-in duration-100">
                        {/* Dropdown Search Box */}
                        <div className="relative mb-2">
                          <Search className="absolute left-2.5 top-2.5 h-3 w-3 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search workshops or cities..."
                            value={wsSearch}
                            onChange={(e) => setWsSearch(e.target.value)}
                            className="w-full pl-7 pr-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-[11px] text-slate-900 dark:text-white focus:outline-none"
                          />
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {('all cities & workshops'.includes(wsSearch.toLowerCase())) && (
                            <button
                              type="button"
                              onClick={() => {
                                handleWorkshopChange('ALL', 'All Cities & Workshops');
                                setMobileMenuOpen(false);
                              }}
                              className={`w-full flex items-center justify-between p-2 rounded-lg text-xs font-bold text-left ${
                                activeWsId === 'ALL' ? 'bg-blue-50 dark:bg-blue-950 text-blue-500' : 'text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <span>🌐 All Cities & Workshops</span>
                              {activeWsId === 'ALL' && <span>✓</span>}
                            </button>
                          )}
                          
                          {filteredCities.map(c => (
                            <button
                              key={`m-ws-opt-city-${c.id}`}
                              type="button"
                              onClick={() => {
                                handleWorkshopChange(`CITY:${c.id}`, `City: ${c.name}`);
                                setMobileMenuOpen(false);
                              }}
                              className={`w-full flex items-center justify-between p-2 rounded-lg text-xs font-medium text-left ${
                                activeWsId === `CITY:${c.id}` ? 'bg-blue-50 dark:bg-blue-950 text-blue-500 font-bold' : 'text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <span>🏙️ City: {c.name}</span>
                              {activeWsId === `CITY:${c.id}` && <span>✓</span>}
                            </button>
                          ))}
                          
                          {filteredWorkshops.map(ws => (
                            <button
                              key={`m-ws-opt-ws-${ws.id}`}
                              type="button"
                              onClick={() => {
                                handleWorkshopChange(ws.id, ws.name);
                                setMobileMenuOpen(false);
                              }}
                              className={`w-full flex items-center justify-between p-2 rounded-lg text-xs font-medium text-left ${
                                activeWsId === ws.id ? 'bg-blue-50 dark:bg-blue-950 text-blue-500 font-bold' : 'text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <span>📍 {ws.name} ({ws.cityName})</span>
                              {activeWsId === ws.id && <span>✓</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">
                  <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-bold">{getActiveWorkshopName()}</span>
                </div>
              )}

              {/* Supabase Status for Mobile (Admin only) */}
              {isAdmin && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenSupabaseModal();
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-bold transition-all ${
                      supabaseConfig.isConfigured
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                        : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                    }`}
                  >
                    <Database className={`w-4 h-4 ${supabaseConfig.isConfigured ? 'text-emerald-500' : 'text-amber-500'}`} />
                    <span>{supabaseConfig.isConfigured ? 'Supabase Live' : 'Connect Supabase'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-2 gap-2">
              {isManagementRole && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenNewJobCardModal();
                  }}
                  className="p-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/30"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>+ Create Job Card</span>
                </button>
              )}

              {onOpenScanner && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenScanner();
                  }}
                  className="p-2.5 rounded-xl bg-slate-900 text-amber-400 border border-amber-500/40 font-bold text-xs flex items-center justify-center gap-1.5"
                >
                  <Camera className="w-4 h-4 text-amber-400" />
                  <span>Scan Plate OCR</span>
                </button>
              )}

              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenSupabaseModal();
                    }}
                    className={`p-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border ${
                      supabaseConfig.isConfigured 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    <Database className="w-4 h-4" />
                    <span>DB Settings</span>
                  </button>

                  {onOpenAppVersionModal && (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onOpenAppVersionModal();
                      }}
                      className="p-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border bg-amber-500/10 text-amber-400 border-amber-500/30"
                    >
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span>📱 APK Version</span>
                    </button>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (onSwitchToCustomerPortal) {
                    onSwitchToCustomerPortal();
                  } else {
                    window.history.pushState({}, '', '/');
                    window.dispatchEvent(new Event('popstate'));
                  }
                }}
                className={`p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/30 font-bold text-xs flex items-center justify-center gap-1.5 ${!isAdmin ? 'col-span-1' : ''}`}
              >
                <Car className="w-4 h-4" />
                <span>Customer Portal</span>
              </button>
            </div>

            {/* Full Module Tabs Navigation List for Mobile */}
            <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
              <div className="text-[10px] font-black uppercase text-slate-400 px-2 pt-1 pb-0.5">Workspace Operations</div>
              {[...row1Items, ...row2Items]
                .filter(item => isTabAllowedForRole(currentRole, item.id))
                .map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={`m-tab-${item.id}`}
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
                      {item.id === 'customer-portal' && pendingApprovals > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-[10px] text-white font-bold">
                          {pendingApprovals}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>

            {/* Logout Action */}
            {onLogout && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 font-bold text-xs flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out of Mobile Session</span>
                </button>
              </div>
            )}

          </div>
        )}

        {/* Desktop Navigation Tabs - Horizontal Scrollable Bar */}
        <div className="hidden sm:block py-2 border-t border-slate-200/70 dark:border-slate-800 w-full max-w-full overflow-hidden">
          <nav className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full w-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {[...row1Items, ...row2Items]
              .filter(item => isTabAllowedForRole(currentRole, item.id))
              .map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap shrink-0 relative ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                    {item.id === 'customer-portal' && pendingApprovals > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm">
                        {pendingApprovals}
                      </span>
                    )}
                  </button>
                );
              })}
          </nav>
        </div>

      </div>
    </header>
  );
}

