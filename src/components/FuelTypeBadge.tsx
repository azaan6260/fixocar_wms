import React from 'react';
import { FuelType } from '../types';
import { FUEL_TYPE_CONFIG } from '../lib/carModelsData';
import { Fuel, Droplets, Wind, Zap, BatteryCharging, Flame } from 'lucide-react';

interface FuelTypeBadgeProps {
  fuelType?: FuelType | string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export const FuelTypeBadge: React.FC<FuelTypeBadgeProps> = ({
  fuelType,
  size = 'md',
  showIcon = true,
  className = '',
}) => {
  if (!fuelType) return null;

  const validKey = (Object.keys(FUEL_TYPE_CONFIG) as FuelType[]).find(
    k => k.toLowerCase() === fuelType.toLowerCase()
  ) || 'Petrol';

  const config = FUEL_TYPE_CONFIG[validKey] || {
    label: fuelType,
    emoji: '⛽',
    bgColor: 'bg-slate-100 dark:bg-slate-800',
    textColor: 'text-slate-700 dark:text-slate-300',
    borderColor: 'border-slate-200 dark:border-slate-700',
    iconName: 'Fuel',
  };

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1 font-medium',
    md: 'text-xs px-2 py-0.5 gap-1.5 font-semibold',
    lg: 'text-sm px-3 py-1 gap-2 font-semibold',
  };

  const iconSizes = {
    sm: 10,
    md: 12,
    lg: 14,
  };

  const renderIcon = () => {
    switch (validKey) {
      case 'Petrol':
        return <Fuel size={iconSizes[size]} className="shrink-0" />;
      case 'Diesel':
        return <Droplets size={iconSizes[size]} className="shrink-0" />;
      case 'CNG':
        return <Wind size={iconSizes[size]} className="shrink-0" />;
      case 'EV':
        return <Zap size={iconSizes[size]} className="shrink-0 text-amber-500 fill-amber-500" />;
      case 'Hybrid':
        return <BatteryCharging size={iconSizes[size]} className="shrink-0 text-emerald-500" />;
      case 'LPG':
        return <Flame size={iconSizes[size]} className="shrink-0 text-orange-500" />;
      default:
        return <Fuel size={iconSizes[size]} className="shrink-0" />;
    }
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border shadow-xs transition-colors select-none ${config.bgColor} ${config.textColor} ${config.borderColor} ${sizeClasses[size]} ${className}`}
      title={`Fuel Type: ${config.label}`}
    >
      {showIcon && renderIcon()}
      <span>{config.label}</span>
    </span>
  );
};
