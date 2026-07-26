import React from 'react';
import { UserRole } from '../types';
import { ShieldCheck, Wrench, Hammer, Palette, Truck, Building2, User, UserCheck } from 'lucide-react';

interface RoleBadgeProps {
  role: UserRole;
  showIcon?: boolean;
  className?: string;
}

export const ROLE_CONFIG: Record<UserRole, { label: string; bg: string; text: string; border: string; icon: React.ElementType }> = {
  SUPER_ADMIN: { label: 'Super Admin', bg: 'bg-purple-500/10', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800', icon: ShieldCheck },
  ADMIN: { label: 'Workshop Admin', bg: 'bg-indigo-500/10', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-800', icon: ShieldCheck },
  FLOOR_MANAGER: { label: 'Floor Manager', bg: 'bg-amber-500/10', text: 'text-amber-800 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800', icon: UserCheck },
  MECHANIC: { label: 'Mechanic', bg: 'bg-blue-500/10', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800', icon: Wrench },
  DENTER: { label: 'Denter Specialist', bg: 'bg-orange-500/10', text: 'text-orange-800 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800', icon: Hammer },
  PAINTER: { label: 'Paint Specialist', bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800', icon: Palette },
  DELIVERY_BOY: { label: 'Pick & Delivery', bg: 'bg-cyan-500/10', text: 'text-cyan-800 dark:text-cyan-300', border: 'border-cyan-200 dark:border-cyan-800', icon: Truck },
  VENDOR: { label: 'Sublet / Vendor', bg: 'bg-rose-500/10', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800', icon: Building2 },
  CUSTOMER: { label: 'Vehicle Owner', bg: 'bg-slate-500/10', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-700', icon: User },
};

export function RoleBadge({ role, showIcon = true, className = '' }: RoleBadgeProps) {
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.MECHANIC;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${config.bg} ${config.text} ${config.border} ${className}`}>
      {showIcon && <Icon className="w-3.5 h-3.5" />}
      {config.label}
    </span>
  );
}
