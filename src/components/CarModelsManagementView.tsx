import React, { useState, useEffect, useMemo } from 'react';
import { CarModelRecord, FuelType } from '../types';
import { getCarModels, saveCarModels, addCarModel, updateCarModel, deleteCarModel, getCarMakes } from '../lib/storage';
import { FUEL_TYPE_CONFIG } from '../lib/carModelsData';
import { FuelTypeBadge } from './FuelTypeBadge';
import { 
  Car, 
  Search, 
  Plus, 
  Filter, 
  Edit, 
  Trash2, 
  Fuel, 
  Zap, 
  Droplets, 
  Wind, 
  BatteryCharging, 
  Check, 
  X, 
  Tag, 
  Sliders, 
  Layers, 
  Wrench, 
  Gauge, 
  ChevronRight, 
  FileText, 
  Sparkles,
  ClipboardList,
  Flame,
  LayoutGrid,
  List
} from 'lucide-react';

interface CarModelsManagementViewProps {
  onSelectForJobCard?: (modelRecord: CarModelRecord, variant?: string, fuelType?: FuelType) => void;
  onNavigateToGatePass?: (modelRecord: CarModelRecord) => void;
}

const ALL_CATEGORIES = ['All', 'Hatchback', 'Sedan', 'Compact SUV', 'SUV', 'MUV', 'Luxury', 'EV'] as const;
const ALL_FUEL_TYPES: FuelType[] = ['Petrol', 'Diesel', 'CNG', 'EV', 'Hybrid', 'LPG'];

export const CarModelsManagementView: React.FC<CarModelsManagementViewProps> = ({
  onSelectForJobCard,
  onNavigateToGatePass,
}) => {
  const [carModels, setCarModels] = useState<CarModelRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMake, setSelectedMake] = useState<string>('All');
  const [selectedFuelType, setSelectedFuelType] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<CarModelRecord | null>(null);

  // Form State
  const [formMake, setFormMake] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formCategory, setFormCategory] = useState<CarModelRecord['category']>('SUV');
  const [formVariants, setFormVariants] = useState<string[]>([]);
  const [newVariantInput, setNewVariantInput] = useState('');
  const [formFuelTypes, setFormFuelTypes] = useState<FuelType[]>(['Petrol']);
  const [formEngineDisplacement, setFormEngineDisplacement] = useState('');
  const [formEngineOilSpec, setFormEngineOilSpec] = useState('');
  const [formCoolantSpec, setFormCoolantSpec] = useState('');
  const [formRecommendedPsi, setFormRecommendedPsi] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Delete Confirmation State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setCarModels(getCarModels());
  }, []);

  const refreshData = () => {
    setCarModels(getCarModels());
  };

  const makesList = useMemo(() => {
    const list = getCarMakes();
    return ['All', ...list];
  }, [carModels]);

  // Metrics Calculations
  const metrics = useMemo(() => {
    const totalMakes = new Set(carModels.map(m => m.make)).size;
    const totalModels = carModels.length;
    const totalVariants = carModels.reduce((acc, m) => acc + (m.variants?.length || 0), 0);
    
    const fuelCounts: Record<FuelType, number> = {
      Petrol: 0,
      Diesel: 0,
      CNG: 0,
      EV: 0,
      Hybrid: 0,
      LPG: 0
    };

    carModels.forEach(m => {
      m.fuelTypes?.forEach(f => {
        if (fuelCounts[f] !== undefined) {
          fuelCounts[f]++;
        }
      });
    });

    return { totalMakes, totalModels, totalVariants, fuelCounts };
  }, [carModels]);

  // Filtered Models
  const filteredModels = useMemo(() => {
    return carModels.filter(m => {
      // Make Filter
      if (selectedMake !== 'All' && m.make.toLowerCase() !== selectedMake.toLowerCase()) {
        return false;
      }

      // Fuel Type Filter
      if (selectedFuelType !== 'All' && !m.fuelTypes.includes(selectedFuelType as FuelType)) {
        return false;
      }

      // Category Filter
      if (selectedCategory !== 'All' && m.category !== selectedCategory) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchMake = m.make.toLowerCase().includes(query);
        const matchModel = m.model.toLowerCase().includes(query);
        const matchCategory = m.category.toLowerCase().includes(query);
        const matchVariants = m.variants?.some(v => v.toLowerCase().includes(query));
        const matchEngine = m.engineDisplacement?.toLowerCase().includes(query);
        const matchOil = m.engineOilSpec?.toLowerCase().includes(query);

        if (!matchMake && !matchModel && !matchCategory && !matchVariants && !matchEngine && !matchOil) {
          return false;
        }
      }

      return true;
    });
  }, [carModels, selectedMake, selectedFuelType, selectedCategory, searchQuery]);

  // Modal Handlers
  const handleOpenAddModal = () => {
    setEditingModel(null);
    setFormMake('');
    setFormModel('');
    setFormCategory('SUV');
    setFormVariants(['Standard', 'Top Trim']);
    setNewVariantInput('');
    setFormFuelTypes(['Petrol']);
    setFormEngineDisplacement('');
    setFormEngineOilSpec('');
    setFormCoolantSpec('');
    setFormRecommendedPsi('32 PSI (Front) / 32 PSI (Rear)');
    setFormNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (model: CarModelRecord) => {
    setEditingModel(model);
    setFormMake(model.make);
    setFormModel(model.model);
    setFormCategory(model.category);
    setFormVariants([...(model.variants || [])]);
    setNewVariantInput('');
    setFormFuelTypes([...(model.fuelTypes || ['Petrol'])]);
    setFormEngineDisplacement(model.engineDisplacement || '');
    setFormEngineOilSpec(model.engineOilSpec || '');
    setFormCoolantSpec(model.coolantSpec || '');
    setFormRecommendedPsi(model.recommendedPsi || '');
    setFormNotes(model.notes || '');
    setIsModalOpen(true);
  };

  const handleAddVariant = () => {
    if (!newVariantInput.trim()) return;
    const trimmed = newVariantInput.trim();
    if (!formVariants.includes(trimmed)) {
      setFormVariants([...formVariants, trimmed]);
    }
    setNewVariantInput('');
  };

  const handleRemoveVariant = (variantToRemove: string) => {
    setFormVariants(formVariants.filter(v => v !== variantToRemove));
  };

  const toggleFormFuelType = (type: FuelType) => {
    if (formFuelTypes.includes(type)) {
      if (formFuelTypes.length > 1) {
        setFormFuelTypes(formFuelTypes.filter(f => f !== type));
      }
    } else {
      setFormFuelTypes([...formFuelTypes, type]);
    }
  };

  const handleSaveModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMake.trim() || !formModel.trim()) {
      alert('Please enter both Make and Model name.');
      return;
    }

    if (formFuelTypes.length === 0) {
      alert('Please select at least one supported Fuel Type.');
      return;
    }

    const payload: Omit<CarModelRecord, 'id' | 'createdAt'> = {
      make: formMake.trim(),
      model: formModel.trim(),
      category: formCategory,
      variants: formVariants.length > 0 ? formVariants : ['Standard'],
      fuelTypes: formFuelTypes,
      engineDisplacement: formEngineDisplacement.trim() || undefined,
      engineOilSpec: formEngineOilSpec.trim() || undefined,
      coolantSpec: formCoolantSpec.trim() || undefined,
      recommendedPsi: formRecommendedPsi.trim() || undefined,
      notes: formNotes.trim() || undefined,
    };

    if (editingModel) {
      updateCarModel(editingModel.id, payload);
    } else {
      addCarModel(payload);
    }

    setIsModalOpen(false);
    refreshData();
  };

  const handleDeleteModel = (id: string) => {
    deleteCarModel(id);
    setDeletingId(null);
    refreshData();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 rounded-2xl shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-6 opacity-10 pointer-events-none">
          <Car size={320} />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold uppercase tracking-wider mb-3">
              <Sparkles size={14} className="text-amber-400" />
              Automotive Master Registry
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Car Models, Variants & Fuel Types
            </h1>
            <p className="text-slate-300 text-sm sm:text-base mt-1 max-w-2xl">
              Master catalog of vehicle manufacturers, models, specific trim variants (e.g. ZXi+, SX(O), Creative+), powertrain fuel types (Petrol, Diesel, CNG, EV, Hybrid), and workshop fluid specifications.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl shadow-lg hover:shadow-blue-500/25 transition-all"
            >
              <Plus size={16} />
              Add Car Model & Variant
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Brands</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{metrics.totalMakes}</div>
          <div className="text-[11px] text-slate-400 mt-1">Maruti, Tata, Hyundai, etc.</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Models</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{metrics.totalModels}</div>
          <div className="text-[11px] text-slate-400 mt-1">Active car catalog</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Registered Trims</div>
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{metrics.totalVariants}</div>
          <div className="text-[11px] text-slate-400 mt-1">LXi, VXi, SX, Fearless, etc.</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Petrol / CNG</span>
            <span className="text-sm">⛽</span>
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {metrics.fuelCounts.Petrol} <span className="text-sm font-normal text-slate-400">/ {metrics.fuelCounts.CNG} CNG</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Internal combustion</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Diesel Engines</span>
            <span className="text-sm">🛢️</span>
          </div>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-400 mt-1">{metrics.fuelCounts.Diesel}</div>
          <div className="text-[11px] text-slate-400 mt-1">CRDi, D-4D, mHawk, etc.</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">EV & Hybrid</span>
            <span className="text-sm">⚡</span>
          </div>
          <div className="text-2xl font-bold text-violet-600 dark:text-violet-400 mt-1">
            {metrics.fuelCounts.EV} <span className="text-sm font-normal text-slate-400">/ {metrics.fuelCounts.Hybrid} Hyb</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Electric & Strong Hybrids</div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by make, model, variant (e.g. 'ZXi', 'Creta', '1.5 SX', '0W-20')..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* View Toggles & Clear */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center border border-slate-200 dark:border-slate-800 rounded-lg p-1 bg-slate-50 dark:bg-slate-950">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
                title="Grid View"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
                title="Table View"
              >
                <List size={16} />
              </button>
            </div>

            {(selectedMake !== 'All' || selectedFuelType !== 'All' || selectedCategory !== 'All' || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedMake('All');
                  setSelectedFuelType('All');
                  setSelectedCategory('All');
                  setSearchQuery('');
                }}
                className="text-xs font-medium text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 px-2 py-1.5"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          {/* Brand Filter */}
          <span className="font-semibold text-slate-500 dark:text-slate-400 mr-1">Brand:</span>
          <select
            value={selectedMake}
            onChange={e => setSelectedMake(e.target.value)}
            className="px-2.5 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 text-xs outline-none focus:ring-1 focus:ring-blue-500"
          >
            {makesList.map(make => (
              <option key={make} value={make}>{make === 'All' ? 'All Manufacturers' : make}</option>
            ))}
          </select>

          {/* Fuel Type Filter Chips */}
          <span className="font-semibold text-slate-500 dark:text-slate-400 ml-2 mr-1">Fuel:</span>
          <button
            onClick={() => setSelectedFuelType('All')}
            className={`px-2.5 py-1 rounded-lg border transition-all ${
              selectedFuelType === 'All'
                ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-xs'
                : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
            }`}
          >
            All Fuels
          </button>
          {ALL_FUEL_TYPES.map(fuel => {
            const config = FUEL_TYPE_CONFIG[fuel];
            const isSelected = selectedFuelType === fuel;
            return (
              <button
                key={fuel}
                onClick={() => setSelectedFuelType(fuel)}
                className={`px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 ${
                  isSelected
                    ? `${config.bgColor} ${config.textColor} ${config.borderColor} font-bold ring-1 ring-blue-500`
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                }`}
              >
                <span>{config.emoji}</span>
                <span>{fuel}</span>
              </button>
            );
          })}

          {/* Segment Filter */}
          <span className="font-semibold text-slate-500 dark:text-slate-400 ml-2 mr-1">Body Type:</span>
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 text-xs outline-none focus:ring-1 focus:ring-blue-500"
          >
            {ALL_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat === 'All' ? 'All Body Types' : cat}</option>
            ))}
          </select>

          <div className="ml-auto text-[11px] text-slate-400">
            Showing <strong className="text-slate-700 dark:text-slate-200">{filteredModels.length}</strong> of {carModels.length} models
          </div>
        </div>
      </div>

      {/* Content Area: Grid View or Table View */}
      {filteredModels.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8">
          <Car size={48} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">No Car Models Found</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
            No vehicle models match your current search and filter criteria. Try clearing some filters or add a new car model to the catalog.
          </p>
          <button
            onClick={handleOpenAddModal}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg shadow-sm"
          >
            <Plus size={16} />
            Add New Car Model
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredModels.map(model => (
            <div
              key={model.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                      {model.make}
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {model.model}
                    </h3>
                  </div>
                  <span className="px-2.5 py-1 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full border border-slate-200 dark:border-slate-700 shrink-0">
                    {model.category}
                  </span>
                </div>

                {/* Fuel Types Badges */}
                <div className="mt-3 flex flex-wrap gap-1.5 items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">Fuel:</span>
                  {model.fuelTypes?.map(fuel => (
                    <FuelTypeBadge key={fuel} fuelType={fuel} size="sm" />
                  ))}
                </div>
              </div>

              {/* Variants Section */}
              <div className="p-5 bg-slate-50/50 dark:bg-slate-950/40 space-y-3 flex-1">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Tag size={12} className="text-blue-500" />
                      Variants & Trims ({model.variants?.length || 0})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                    {model.variants && model.variants.length > 0 ? (
                      model.variants.map(v => (
                        <span
                          key={v}
                          className="text-xs font-medium px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-md shadow-2xs"
                        >
                          {v}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">No specific trims registered</span>
                    )}
                  </div>
                </div>

                {/* Technical Specifications */}
                {(model.engineDisplacement || model.engineOilSpec || model.recommendedPsi) && (
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[11px] space-y-1 text-slate-600 dark:text-slate-400">
                    {model.engineDisplacement && (
                      <div className="flex items-center gap-1.5">
                        <Gauge size={12} className="text-slate-400 shrink-0" />
                        <span className="truncate"><strong>Engine:</strong> {model.engineDisplacement}</span>
                      </div>
                    )}
                    {model.engineOilSpec && (
                      <div className="flex items-center gap-1.5">
                        <Droplets size={12} className="text-blue-500 shrink-0" />
                        <span className="truncate"><strong>Oil Spec:</strong> {model.engineOilSpec}</span>
                      </div>
                    )}
                    {model.recommendedPsi && (
                      <div className="flex items-center gap-1.5">
                        <Sliders size={12} className="text-emerald-500 shrink-0" />
                        <span className="truncate"><strong>Tyre PSI:</strong> {model.recommendedPsi}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEditModal(model)}
                    className="p-1.5 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title="Edit Car Model & Variants"
                  >
                    <Edit size={15} />
                  </button>
                  <button
                    onClick={() => setDeletingId(model.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title="Delete Model"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {onNavigateToGatePass && (
                    <button
                      onClick={() => onNavigateToGatePass(model)}
                      className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors"
                    >
                      Gate In
                    </button>
                  )}
                  {onSelectForJobCard && (
                    <button
                      onClick={() => onSelectForJobCard(model, model.variants?.[0], model.fuelTypes?.[0])}
                      className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-2xs transition-colors"
                    >
                      <span>New Job Card</span>
                      <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-xs uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Manufacturer & Model</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Fuel Types</th>
                  <th className="py-3 px-4">Variants / Trims</th>
                  <th className="py-3 px-4">Technical Specs</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                {filteredModels.map(model => (
                  <tr key={model.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">{model.model}</div>
                      <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">{model.make}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 rounded-full font-medium text-slate-700 dark:text-slate-300">
                        {model.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        {model.fuelTypes?.map(f => (
                          <FuelTypeBadge key={f} fuelType={f} size="sm" />
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="flex flex-wrap gap-1">
                        {model.variants?.map(v => (
                          <span
                            key={v}
                            className="text-[11px] font-medium px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700"
                          >
                            {v}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                      {model.engineDisplacement && <div>{model.engineDisplacement}</div>}
                      {model.engineOilSpec && <div className="text-blue-600 dark:text-blue-400 font-medium">{model.engineOilSpec}</div>}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(model)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Edit Model"
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          onClick={() => setDeletingId(model.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Delete Model"
                        >
                          <Trash2 size={15} />
                        </button>
                        {onSelectForJobCard && (
                          <button
                            onClick={() => onSelectForJobCard(model, model.variants?.[0], model.fuelTypes?.[0])}
                            className="px-2.5 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-md"
                          >
                            Job Card
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Car Model Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-xl">
                  <Car size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {editingModel ? `Edit ${editingModel.make} ${editingModel.model}` : 'Register New Car Model & Variants'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Define manufacturer, model name, supported powertrain fuel types, and trim variants.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveModel} className="space-y-4">
              {/* Manufacturer & Model Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Manufacturer / Brand <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formMake}
                    onChange={e => setFormMake(e.target.value)}
                    placeholder="e.g. Maruti Suzuki, Tata Motors, Hyundai"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Model Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formModel}
                    onChange={e => setFormModel(e.target.value)}
                    placeholder="e.g. Swift, Creta, Nexon, Thar Roxx"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Segment & Category */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Vehicle Body Segment / Type
                </label>
                <select
                  value={formCategory}
                  onChange={e => setFormCategory(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="Hatchback">Hatchback (e.g. Swift, Baleno, i20)</option>
                  <option value="Sedan">Sedan (e.g. City, Verna, Dzire, Virtus)</option>
                  <option value="Compact SUV">Compact SUV (e.g. Brezza, Nexon, Venue, Punch)</option>
                  <option value="SUV">Mid-Size / Full SUV (e.g. Creta, Scorpio-N, Harrier, Fortuner)</option>
                  <option value="MUV">MUV / MPV (e.g. Innova Crysta, Hycross, Ertiga, Carens)</option>
                  <option value="Luxury">Luxury (e.g. BMW 3 Series, C-Class, Audi A4)</option>
                  <option value="EV">Pure Electric Platform (e.g. Ioniq 5, EV6, ZS EV)</option>
                  <option value="Commercial">Commercial / Fleet</option>
                </select>
              </div>

              {/* Supported Fuel Types */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Supported Fuel Types <span className="text-rose-500">*</span> (Select all that apply)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ALL_FUEL_TYPES.map(fuel => {
                    const isSelected = formFuelTypes.includes(fuel);
                    const config = FUEL_TYPE_CONFIG[fuel];
                    return (
                      <button
                        key={fuel}
                        type="button"
                        onClick={() => toggleFormFuelType(fuel)}
                        className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center justify-between transition-all ${
                          isSelected
                            ? `${config.bgColor} ${config.textColor} ${config.borderColor} ring-1 ring-blue-500 font-bold`
                            : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <span>{config.emoji}</span>
                          <span>{config.label}</span>
                        </span>
                        {isSelected && <Check size={14} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Variant / Trim Manager */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Variants & Trim Levels ({formVariants.length})
                  </label>
                  <span className="text-[11px] text-slate-500">e.g. LXi, VXi, ZXi+, SX(O), Creative+</span>
                </div>

                {/* Add Variant Input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newVariantInput}
                    onChange={e => setNewVariantInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddVariant();
                      }
                    }}
                    placeholder="Type variant name (e.g. ZXi Plus) & press Add"
                    className="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddVariant}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shrink-0"
                  >
                    Add Variant
                  </button>
                </div>

                {/* Variants List Chips */}
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pt-1">
                  {formVariants.map(v => (
                    <span
                      key={v}
                      className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-200 shadow-2xs"
                    >
                      <span>{v}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveVariant(v)}
                        className="text-slate-400 hover:text-rose-500 ml-0.5"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Technical Specifications */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Powertrain / Engine Displacement
                  </label>
                  <input
                    type="text"
                    value={formEngineDisplacement}
                    onChange={e => setFormEngineDisplacement(e.target.value)}
                    placeholder="e.g. 1.5L Turbo GDi (1482 cc)"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Engine Oil Capacity & Grade Spec
                  </label>
                  <input
                    type="text"
                    value={formEngineOilSpec}
                    onChange={e => setFormEngineOilSpec(e.target.value)}
                    placeholder="e.g. 3.8 Litres • 0W-20 Synthetic"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Coolant Fluid Specification
                  </label>
                  <input
                    type="text"
                    value={formCoolantSpec}
                    onChange={e => setFormCoolantSpec(e.target.value)}
                    placeholder="e.g. 5.5 Litres Long Life Coolant"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Recommended Tyre Pressure
                  </label>
                  <input
                    type="text"
                    value={formRecommendedPsi}
                    onChange={e => setFormRecommendedPsi(e.target.value)}
                    placeholder="e.g. 33 PSI Front / 33 PSI Rear"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Workshop Inspection Notes & Common Work
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="e.g. Critical: Low-SAPS C3 oil required for DPF. Check rear stabilizer links during 30k service."
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-sm"
                >
                  {editingModel ? 'Update Model & Variants' : 'Save Car Model'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <Trash2 size={24} />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Car Model</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Are you sure you want to remove this car model and its registered variants from the catalog?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteModel(deletingId)}
                className="px-4 py-2 text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg"
              >
                Delete Model
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
