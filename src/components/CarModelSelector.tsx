import React, { useState, useEffect, useMemo } from 'react';
import { FuelType, CarModelRecord } from '../types';
import { getCarModels, getCarMakes, getModelsByMake } from '../lib/storage';
import { FUEL_TYPE_CONFIG } from '../lib/carModelsData';
import { FuelTypeBadge } from './FuelTypeBadge';
import { Car, Fuel, Sparkles, ChevronDown, Check, Info } from 'lucide-react';

interface CarModelSelectorProps {
  make: string;
  model: string;
  variant: string;
  fuelType: FuelType | string;
  onMakeChange: (make: string) => void;
  onModelChange: (model: string) => void;
  onVariantChange: (variant: string) => void;
  onFuelTypeChange: (fuelType: FuelType) => void;
  required?: boolean;
  showTechSpecs?: boolean;
  disabled?: boolean;
  layout?: 'grid' | 'compact' | 'stacked';
}

const ALL_FUEL_TYPES: FuelType[] = ['Petrol', 'Diesel', 'CNG', 'EV', 'Hybrid', 'LPG'];

export const CarModelSelector: React.FC<CarModelSelectorProps> = ({
  make,
  model,
  variant,
  fuelType,
  onMakeChange,
  onModelChange,
  onVariantChange,
  onFuelTypeChange,
  required = false,
  showTechSpecs = true,
  disabled = false,
  layout = 'grid',
}) => {
  const [carModels, setCarModels] = useState<CarModelRecord[]>([]);
  const [allMakes, setAllMakes] = useState<string[]>([]);
  const [makeSuggestionsOpen, setMakeSuggestionsOpen] = useState(false);
  const [modelSuggestionsOpen, setModelSuggestionsOpen] = useState(false);

  useEffect(() => {
    const loadedModels = getCarModels();
    setCarModels(loadedModels);
    setAllMakes(getCarMakes());
  }, []);

  // Filter models for the current make
  const availableModelsForMake = useMemo(() => {
    if (!make.trim()) return carModels;
    return carModels.filter(m => m.make.toLowerCase() === make.trim().toLowerCase());
  }, [carModels, make]);

  // Find exact matched model record
  const matchedModelRecord = useMemo(() => {
    if (!make.trim() || !model.trim()) return undefined;
    return carModels.find(
      m =>
        m.make.toLowerCase() === make.trim().toLowerCase() &&
        (m.model.toLowerCase() === model.trim().toLowerCase() ||
          model.trim().toLowerCase().startsWith(m.model.toLowerCase()))
    );
  }, [carModels, make, model]);

  // Available variants for the selected model
  const availableVariants = useMemo(() => {
    return matchedModelRecord?.variants || [];
  }, [matchedModelRecord]);

  // Available fuel types for the selected model
  const availableFuelTypes = useMemo(() => {
    return matchedModelRecord?.fuelTypes || ALL_FUEL_TYPES;
  }, [matchedModelRecord]);

  // Filtered make suggestions
  const filteredMakes = useMemo(() => {
    if (!make) return allMakes;
    return allMakes.filter(m => m.toLowerCase().includes(make.toLowerCase()));
  }, [allMakes, make]);

  // Filtered model suggestions
  const filteredModels = useMemo(() => {
    if (!model) return availableModelsForMake;
    return availableModelsForMake.filter(m => m.model.toLowerCase().includes(model.toLowerCase()));
  }, [availableModelsForMake, model]);

  const handleSelectMake = (selectedMake: string) => {
    onMakeChange(selectedMake);
    setMakeSuggestionsOpen(false);
    // If the currently selected model doesn't belong to the new make, reset it
    const modelsForNewMake = carModels.filter(
      m => m.make.toLowerCase() === selectedMake.toLowerCase()
    );
    if (!modelsForNewMake.some(m => m.model.toLowerCase() === model.toLowerCase())) {
      onModelChange('');
      onVariantChange('');
    }
  };

  const handleSelectModel = (selectedModelRecord: CarModelRecord) => {
    onModelChange(selectedModelRecord.model);
    setModelSuggestionsOpen(false);
    
    // Auto-select the first fuel type if current fuel type is not supported
    if (selectedModelRecord.fuelTypes && selectedModelRecord.fuelTypes.length > 0) {
      if (!selectedModelRecord.fuelTypes.includes(fuelType as FuelType)) {
        onFuelTypeChange(selectedModelRecord.fuelTypes[0]);
      }
    }

    // Auto-suggest first variant if none selected
    if (!variant && selectedModelRecord.variants && selectedModelRecord.variants.length > 0) {
      onVariantChange(selectedModelRecord.variants[0]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Row 1: Make and Model */}
      <div className={layout === 'compact' ? 'space-y-3' : 'grid grid-cols-1 md:grid-cols-2 gap-4'}>
        {/* Make Input */}
        <div className="relative">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
            Vehicle Make {required && <span className="text-rose-500">*</span>}
          </label>
          <div className="relative">
            <input
              type="text"
              value={make}
              onChange={e => {
                onMakeChange(e.target.value);
                setMakeSuggestionsOpen(true);
              }}
              onFocus={() => setMakeSuggestionsOpen(true)}
              placeholder="e.g. Maruti Suzuki, Hyundai, Tata"
              disabled={disabled}
              className="w-full pl-3 pr-9 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setMakeSuggestionsOpen(!makeSuggestionsOpen)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
            >
              <ChevronDown size={14} />
            </button>
          </div>

          {/* Make Suggestions Dropdown */}
          {makeSuggestionsOpen && filteredMakes.length > 0 && !disabled && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setMakeSuggestionsOpen(false)}
              />
              <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-56 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                <div className="p-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-slate-950/50">
                  Select Manufacturer / Brand
                </div>
                {filteredMakes.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleSelectMake(m)}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-800 dark:text-slate-200 transition-colors ${
                      make.toLowerCase() === m.toLowerCase() ? 'bg-blue-50/70 dark:bg-blue-950/50 font-semibold text-blue-600 dark:text-blue-400' : ''
                    }`}
                  >
                    <span>{m}</span>
                    {make.toLowerCase() === m.toLowerCase() && (
                      <Check size={14} className="text-blue-600 dark:text-blue-400" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Model Input */}
        <div className="relative">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
            Vehicle Model {required && <span className="text-rose-500">*</span>}
          </label>
          <div className="relative">
            <input
              type="text"
              value={model}
              onChange={e => {
                onModelChange(e.target.value);
                setModelSuggestionsOpen(true);
              }}
              onFocus={() => setModelSuggestionsOpen(true)}
              placeholder={make ? `Select or type model for ${make}` : 'e.g. Swift, Creta, Nexon'}
              disabled={disabled}
              className="w-full pl-3 pr-9 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setModelSuggestionsOpen(!modelSuggestionsOpen)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
            >
              <ChevronDown size={14} />
            </button>
          </div>

          {/* Model Suggestions Dropdown */}
          {modelSuggestionsOpen && filteredModels.length > 0 && !disabled && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setModelSuggestionsOpen(false)}
              />
              <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-60 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                <div className="p-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-slate-950/50 flex items-center justify-between">
                  <span>Registered Models {make ? `(${make})` : ''}</span>
                  <span className="text-[10px] font-normal">{filteredModels.length} models</span>
                </div>
                {filteredModels.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelectModel(m)}
                    className={`w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-800 dark:text-slate-200 transition-colors ${
                      model.toLowerCase() === m.model.toLowerCase() ? 'bg-blue-50/70 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-semibold' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{m.model}</div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {m.category}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {m.fuelTypes.map(f => (
                        <FuelTypeBadge key={f} fuelType={f} size="sm" />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Row 2: Variant & Fuel Type */}
      <div className={layout === 'compact' ? 'space-y-3' : 'grid grid-cols-1 md:grid-cols-2 gap-4'}>
        {/* Variant Input & Quick Selection */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Vehicle Variant / Trim
            </label>
            {availableVariants.length > 0 && (
              <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                {availableVariants.length} registered trims
              </span>
            )}
          </div>
          <input
            type="text"
            value={variant}
            onChange={e => onVariantChange(e.target.value)}
            placeholder="e.g. ZXi Plus, 1.5 SX(O), Creative+, AX7 L"
            disabled={disabled}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
          />

          {/* Quick Variant Chips */}
          {availableVariants.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] font-semibold text-slate-400 uppercase mr-1">Quick Select:</span>
              {availableVariants.map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => onVariantChange(v)}
                  disabled={disabled}
                  className={`text-xs px-2.5 py-1 rounded-md border font-medium transition-all ${
                    variant === v
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Fuel Type Selector */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
            Fuel Type {required && <span className="text-rose-500">*</span>}
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {ALL_FUEL_TYPES.map(f => {
              const isSelected = fuelType === f;
              const isRecommended = availableFuelTypes.includes(f);
              const config = FUEL_TYPE_CONFIG[f];

              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => onFuelTypeChange(f)}
                  disabled={disabled}
                  className={`relative flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-semibold transition-all ${
                    isSelected
                      ? `${config.bgColor} ${config.textColor} ${config.borderColor} ring-2 ring-blue-500/50 shadow-xs font-bold`
                      : isRecommended
                      ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      : 'bg-slate-50/50 dark:bg-slate-900/40 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 opacity-60 hover:opacity-100'
                  }`}
                >
                  <span className="text-sm">{config.emoji}</span>
                  <span>{config.label}</span>
                  {isSelected && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-600 rounded-full ring-2 ring-white dark:ring-slate-900" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Technical Specifications Preview Box */}
      {showTechSpecs && matchedModelRecord && (
        <div className="p-3 bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/80 dark:from-slate-900 dark:via-slate-900 dark:to-slate-850 border border-blue-100 dark:border-slate-800 rounded-xl text-xs space-y-1.5">
          <div className="flex items-center justify-between font-semibold text-blue-900 dark:text-blue-300">
            <span className="flex items-center gap-1.5">
              <Car size={14} className="text-blue-600 dark:text-blue-400" />
              {matchedModelRecord.make} {matchedModelRecord.model} Specifications
            </span>
            <span className="px-2 py-0.5 text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 rounded-full font-medium">
              {matchedModelRecord.category}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1 text-slate-600 dark:text-slate-400">
            {matchedModelRecord.engineDisplacement && (
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500 block">Powertrain</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{matchedModelRecord.engineDisplacement}</span>
              </div>
            )}
            {matchedModelRecord.engineOilSpec && (
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500 block">Engine Oil Spec</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{matchedModelRecord.engineOilSpec}</span>
              </div>
            )}
            {matchedModelRecord.recommendedPsi && (
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500 block">Recommended Tyre Pressure</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{matchedModelRecord.recommendedPsi}</span>
              </div>
            )}
          </div>

          {matchedModelRecord.notes && (
            <div className="flex items-start gap-1.5 pt-1 text-[11px] text-slate-500 dark:text-slate-400 border-t border-blue-100/60 dark:border-slate-800/80 mt-1">
              <Info size={12} className="shrink-0 text-blue-500 mt-0.5" />
              <span>{matchedModelRecord.notes}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
