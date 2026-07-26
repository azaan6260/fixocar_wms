import React, { useState } from 'react';
import { UserRole } from '../types';
import { RoleBadge, ROLE_CONFIG } from './RoleBadge';
import { getStoredSupabaseConfig } from '../lib/supabaseClient';
import { resetToDefaultMockData } from '../lib/storage';
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
  Phone
} from 'lucide-react';

interface HeaderNavProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenSupabaseModal: () => void;
  onOpenNewJobCardModal: () => void;
}

export function HeaderNav({
  currentRole,
  onRoleChange,
  activeTab,
  onTabChange,
  onOpenSupabaseModal,
  onOpenNewJobCardModal,
}: HeaderNavProps) {
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState('');
  const supabaseConfig = getStoredSupabaseConfig();

  const handleReset = () => {
    if (confirm('Reset workshop store to default initial job cards and seed data?')) {
      resetToDefaultMockData();
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'customer-portal', label: 'Customer Portal & Rates', icon: Sparkles },
    { id: 'job-cards', label: 'Job Cards', icon: FileText },
    { id: 'role-workspace', label: 'My Role Tasks', icon: UserCheck },
    { id: 'deliveries', label: 'Delivery Tracker', icon: Truck },
    { id: 'vendors', label: 'Vendors & POs', icon: Building2 },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-md shadow-blue-600/20 flex items-center justify-center">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1">
                Fixo<span className="text-blue-600 dark:text-blue-400">Car</span>
              </h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider hidden sm:block">
                Worry-Free Car Repair
              </p>
            </div>
          </div>

          {/* Navigation Tabs (Desktop Bento Style) */}
          <nav className="hidden lg:flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-full border border-slate-200/60 dark:border-slate-700/60">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Right Controls: Role Switcher, Quick Actions & Search */}
          <div className="flex items-center gap-2 sm:gap-3">

            {/* Direct Hotline Call Button */}
            <a
              href="tel:8819915656"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800 text-xs font-black tracking-wide hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all shadow-2xs"
              title="Call FixoCar Workshop Hotline"
            >
              <Phone className="w-3.5 h-3.5 fill-current" />
              <span>8819915656</span>
            </a>

            {/* Quick Create Job Card Pill */}
            <button
              onClick={onOpenNewJobCardModal}
              className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-md shadow-blue-600/20 active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>+ Create Card</span>
            </button>

            {/* Supabase Status Indicator */}
            <button
              onClick={onOpenSupabaseModal}
              title="Supabase Database Configuration"
              className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                supabaseConfig.isConfigured
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-emerald-500" />
              <span>{supabaseConfig.isConfigured ? 'Live Supabase' : 'Database'}</span>
            </button>

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
                          if (r === 'MECHANIC' || r === 'DENTER' || r === 'PAINTER' || r === 'CUSTOMER') {
                            onTabChange('role-workspace');
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

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 mt-2 text-center">
                    <button
                      onClick={() => {
                        setRoleDropdownOpen(false);
                        handleReset();
                      }}
                      className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors font-medium"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Reset Store Seed Data
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="flex lg:hidden items-center justify-around py-2 border-t border-slate-200 dark:border-slate-800 text-xs">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg ${
                  isActive ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-500'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

      </div>
    </header>
  );
}
