import React, { useState, useEffect } from 'react';
import { UserRole, isTabAllowedForRole, getDefaultTabForRole } from '../types';
import { RoleBadge, ROLE_CONFIG } from './RoleBadge';
import { getStoredSupabaseConfig, getSupabaseClient } from '../lib/supabaseClient';
import { resetToDefaultMockData, getJobCards, subscribeToStore, getAuthUser, logoutAuthUser } from '../lib/storage';
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
  Home
} from 'lucide-react';

import { NotificationDrawer } from './NotificationDrawer';

interface HeaderNavProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenSupabaseModal: () => void;
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
  onOpenNewJobCardModal,
  onSwitchToCustomerPortal,
  onOpenScanner,
  onSelectJobCard,
  onLogout,
  onGoHome,
}: HeaderNavProps) {
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [settingsDropdownOpen, setSettingsDropdownOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState('');
  const [authUser, setAuthUser] = useState(() => getAuthUser());
  const supabaseConfig = getStoredSupabaseConfig();
  const { t, language, setLanguage } = useI18n();
  const [pendingApprovals, setPendingApprovals] = useState(0);

  useEffect(() => {
    setAuthUser(getAuthUser());
  }, [currentRole]);

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
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Header Bar: Logo & Actions */}
        <div className="flex items-center justify-between h-14 sm:h-16 gap-3">
          
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="bg-blue-600 p-2 rounded-xl text-white shadow-md shadow-blue-600/20 flex items-center justify-center">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1">
                Fixo<span className="text-blue-600 dark:text-blue-400">Car</span>
              </h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider hidden sm:block">
                Worry-Free Car Repair
              </p>
            </div>
          </div>

          {/* Right Controls: Role Switcher, Quick Actions & Call */}
          <div className="flex items-center gap-2 sm:gap-2.5">

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
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold hover:bg-amber-500 hover:text-slate-950 transition-all"
            >
              🚘 {t('action.customerPortal')}
            </button>

            {/* Direct Hotline Call Button */}
            <a
              href="tel:8819915656"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800 text-xs font-black tracking-wide hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all shadow-2xs"
              title="Call FixoCar Workshop Hotline"
            >
              <Phone className="w-3.5 h-3.5 fill-current text-emerald-600 dark:text-emerald-400" />
              <span>8819915656</span>
            </a>

            {/* OCR Number Plate Scanner Button */}
            {onOpenScanner && (
              <button
                type="button"
                onClick={onOpenScanner}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 dark:bg-slate-800 text-amber-400 border border-amber-500/40 hover:border-amber-400 font-bold text-xs transition-all shadow-xs active:scale-95"
                title="Scan Vehicle Number Plate"
              >
                <Camera className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline">Scan Plate</span>
              </button>
            )}

            {/* Quick Create Job Card Pill */}
            <button
              onClick={onOpenNewJobCardModal}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-md shadow-blue-600/20 active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>+ Create Card</span>
            </button>

            {/* Live Toast & Pipeline Notifications Drawer */}
            <NotificationDrawer onSelectJobCard={onSelectJobCard} />

            {/* Settings Dropdown */}
            <div className="relative">
              <button
                onClick={() => setSettingsDropdownOpen(!settingsDropdownOpen)}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors"
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
                    {/* Supabase Status Indicator */}
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
                    
                    {/* Language Toggle Container */}
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

            {/* Role Switcher Menu */}
            <div className="relative">
              <button
                onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white transition-colors"
              >
                <RoleBadge role={currentRole} />
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {roleDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Switch Access Role</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Test specialized workflow views</p>
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
            </div>

            {/* Home Portal Shortcut */}
            {onGoHome && (
              <button
                type="button"
                onClick={onGoHome}
                className="hidden lg:flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
                title="Return to Common Home Portal"
              >
                <Home className="w-3.5 h-3.5 text-blue-500" />
                <span>Home</span>
              </button>
            )}

            {/* Sign Out Button */}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 text-xs font-bold transition-all cursor-pointer"
                title="Sign Out of Session"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            )}

          </div>
        </div>

        {/* Navigation Tabs - Horizontal Scrollable Bar */}
        <div className="py-2 border-t border-slate-200/70 dark:border-slate-800">
          <nav className="flex items-center gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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
