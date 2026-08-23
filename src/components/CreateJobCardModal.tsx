import React, { useState, useEffect } from 'react';
import { JobCard, StandardServicePackage, TaskCategory, SpecializedTeam, Employee, Vendor, City, Workshop, FuelType } from '../types';
import { STANDARD_PACKAGES } from '../lib/mockData';
import { createJobCard, getCities, getWorkshops, getVehicleCheckIns, createVehicleCheckIn, updateVehicleCheckIn, updateJobCard } from '../lib/storage';
import { JobAllotmentPipeline, AllocatedTaskItem } from './JobAllotmentPipeline';
import { LicensePlateScannerModal } from './LicensePlateScannerModal';
import { CarModelSelector } from './CarModelSelector';
import { FuelTypeBadge } from './FuelTypeBadge';
import { 
  X, 
  Car, 
  User, 
  Wrench, 
  Sparkles, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Fuel, 
  Gauge, 
  Building2,
  Hammer,
  Palette,
  Building,
  MapPin,
  Layers,
  Camera
} from 'lucide-react';

interface CreateJobCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  vendors: Vendor[];
  onCardCreated: (newCard: JobCard) => void;
  prefilledRegNum?: string;
}

export function CreateJobCardModal({
  isOpen,
  onClose,
  employees,
  vendors,
  onCardCreated,
  prefilledRegNum,
}: CreateJobCardModalProps) {
  if (!isOpen) return null;

  const [step, setStep] = useState<1 | 2>(1);

  // Cities & Workshops
  const [cities, setCities] = useState<City[]>([]);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<string>('');
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string>('');
  const [isCars24, setIsCars24] = useState<boolean>(false);
  const [cars24RefNo, setCars24RefNo] = useState<string>('');

  // Form State
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [regNo, setRegNo] = useState(prefilledRegNum || '');
  const [make, setMake] = useState('Toyota');
  const [model, setModel] = useState('Corolla Altis');
  const [variant, setVariant] = useState('');
  const [fuelType, setFuelType] = useState<FuelType>('Petrol');
  const [year, setYear] = useState(2022);
  const [color, setColor] = useState('Metallic Silver');
  const [vin, setVin] = useState('');
  const [fuelLevel, setFuelLevel] = useState(50);
  const [mileage, setMileage] = useState(35000);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');

  // Load cities & workshops on open
  useEffect(() => {
    if (isOpen) {
      const loadedCities = getCities();
      const loadedWorkshops = getWorkshops();
      setCities(loadedCities);
      setWorkshops(loadedWorkshops);

      if (loadedCities.length > 0) {
        setSelectedCityId(loadedCities[0].id);
        const cityWorkshops = loadedWorkshops.filter(w => w.cityId === loadedCities[0].id);
        if (cityWorkshops.length > 0) {
          setSelectedWorkshopId(cityWorkshops[0].id);
          setIsCars24(!!cityWorkshops[0].isCars24Partner);
          if (cityWorkshops[0].isCars24Partner && !customerName) {
            setCustomerName('Cars24 Fleet Manager');
            setCustomerPhone('+91 9876543210');
          }
        }
      }
    }
  }, [isOpen]);

  const handleCityChange = (cityId: string) => {
    setSelectedCityId(cityId);
    const cityWorkshops = workshops.filter(w => w.cityId === cityId);
    if (cityWorkshops.length > 0) {
      setSelectedWorkshopId(cityWorkshops[0].id);
      setIsCars24(!!cityWorkshops[0].isCars24Partner);
    } else {
      setSelectedWorkshopId('');
    }
  };

  const handleWorkshopChange = (workshopId: string) => {
    setSelectedWorkshopId(workshopId);
    const ws = workshops.find(w => w.id === workshopId);
    if (ws) {
      setIsCars24(!!ws.isCars24Partner);
      if (ws.isCars24Partner && (!customerName || customerName === 'Cars24 Fleet Manager')) {
        setCustomerName('Cars24 Fleet Manager');
        setCustomerPhone('+91 9876543210');
      }
    }
  };

  const [pickupRequested, setPickupRequested] = useState(false);
  const [deliveryRequested, setDeliveryRequested] = useState(true);

  const [serviceType, setServiceType] = useState<'STANDARD_PACKAGE' | 'CUSTOM_REPAIR' | 'ACCIDENT_BODYWORK'>('STANDARD_PACKAGE');
  const [selectedPackage, setSelectedPackage] = useState<StandardServicePackage | null>(null);

  // AI Symptoms
  const [symptomsInput, setSymptomsInput] = useState('');
  const [isAiDiagnosing, setIsAiDiagnosing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Tasks List (starts completely empty until user selects or adds jobs)
  const [tasks, setTasks] = useState<{
    title: string;
    category: TaskCategory;
    team: SpecializedTeam;
    assignedToId?: string;
    assignedToName?: string;
    assignedType: 'EMPLOYEE' | 'VENDOR';
    estimatedCost: number;
    customerPrice: number;
    requiresCustomerApproval: boolean;
  }[]>([]);

  // When package changes on explicit user click, populate tasks
  const handlePackageSelect = (pkg: StandardServicePackage) => {
    setSelectedPackage(pkg);
    const mappedTasks = pkg.includedTasks.map(t => {
      return {
        title: t.title,
        category: t.category,
        team: t.defaultTeam,
        assignedToId: undefined,
        assignedToName: undefined,
        assignedType: (t.category === 'SUBLET_VENDOR' || t.category === 'WASHING') ? ('VENDOR' as const) : ('EMPLOYEE' as const),
        estimatedCost: t.estimatedCost,
        customerPrice: t.price,
        requiresCustomerApproval: false,
      };
    });
    setTasks(mappedTasks);
  };

  // Reset form & clear tasks when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setStep(1);
      setTasks([]);
      setSelectedPackage(null);
      setSymptomsInput('');
      setRegNo(prefilledRegNum || '');
    }
  }, [isOpen, prefilledRegNum]);

  // AI Diagnostics trigger
  const handleRunAiDiagnosis = async () => {
    if (!symptomsInput.trim()) return;
    setIsAiDiagnosing(true);
    setAiError(null);

    try {
      const res = await fetch('/api/ai-diagnosis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleInfo: { make, model, year, mileage },
          reportedSymptoms: symptomsInput
        })
      });

      const data = await res.json();
      if (data.success && data.diagnosis?.suggestedTasks) {
        const generatedTasks = data.diagnosis.suggestedTasks.map((st: any) => {
          return {
            title: st.title,
            category: (st.category as TaskCategory) || 'MECHANICAL',
            team: (st.team as SpecializedTeam) || 'Mechanical',
            assignedToId: undefined,
            assignedToName: undefined,
            assignedType: 'EMPLOYEE' as const,
            estimatedCost: st.estimatedCost || 25,
            customerPrice: st.customerPrice || 50,
            requiresCustomerApproval: Boolean(st.requiresCustomerApproval),
          };
        });

        setTasks(prev => [...prev, ...generatedTasks]);
        setSymptomsInput('');
      } else {
        setAiError(data.error || 'Could not parse AI diagnosis. Added default task.');
      }
    } catch (err: any) {
      setAiError('API Request failed. Make sure server is running.');
    } finally {
      setIsAiDiagnosing(false);
    }
  };

  const handleAddTask = () => {
    setTasks(prev => [
      ...prev,
      {
        title: 'Custom Repair / Maintenance Task',
        category: 'MECHANICAL',
        team: 'Mechanical',
        assignedToId: undefined,
        assignedToName: undefined,
        assignedType: 'EMPLOYEE',
        estimatedCost: 30,
        customerPrice: 65,
        requiresCustomerApproval: false,
      }
    ]);
  };

  const handleRemoveTask = (idx: number) => {
    setTasks(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regNo.trim() || !customerName.trim() || !customerPhone.trim()) {
      alert('Please fill in vehicle registration number, customer name, and phone number.');
      return;
    }

    const selectedCity = cities.find(c => c.id === selectedCityId);
    const selectedWorkshop = workshops.find(w => w.id === selectedWorkshopId);

    // Sync Gate Check-In Record
    const formattedRegNo = regNo.toUpperCase().trim();
    const existingCheckIns = getVehicleCheckIns();
    let matchingCheckIn = existingCheckIns.find(c => c.registrationNumber === formattedRegNo && c.status !== 'CHECKED_OUT');

    if (!matchingCheckIn) {
      // Create Gate Check-In record automatically upon Job Card creation if not already created
      matchingCheckIn = createVehicleCheckIn({
        registrationNumber: formattedRegNo,
        make,
        model,
        variant: variant.trim() || undefined,
        fuelType,
        color,
        fuelLevel: Number(fuelLevel),
        mileage: Number(mileage),
        isCars24,
        cars24RefNo: isCars24 ? (cars24RefNo || `C24-${Date.now().toString().slice(-6)}`) : undefined,
        customerName,
        customerPhone,
        checkInDriverName: isCars24 ? 'Cars24 Delivery Driver' : customerName,
        checkInDriverPhone: customerPhone,
        checkInPhotoWithDriverUrl: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80',
        checkInNotes: 'Checked in at workshop counter during Job Card creation.',
        status: 'JOB_CARD_CREATED',
      });
    }

    const nowStr = new Date().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });

    const newJobCard = createJobCard({
      cityId: selectedCityId,
      cityName: selectedCity?.name,
      workshopId: selectedWorkshopId,
      workshopName: selectedWorkshop?.name,
      isCars24,
      cars24RefNo: isCars24 ? (cars24RefNo || `C24-${Date.now().toString().slice(-6)}`) : undefined,
      estimatedCompletionDate: new Date(Date.now() + 86400000 * 2).toLocaleDateString(),
      vehicle: {
        registrationNumber: formattedRegNo,
        make,
        model,
        variant: variant.trim() || undefined,
        fuelType,
        year: Number(year),
        color,
        vin,
        fuelLevel: Number(fuelLevel),
        mileage: Number(mileage),
      },
      customer: {
        id: `cust-${Date.now().toString().slice(-4)}`,
        name: customerName,
        phone: customerPhone,
        email: customerEmail,
        address: customerAddress || 'Workshop Counter Check-in',
      },
      status: 'IN_PROGRESS',
      serviceType,
      packageName: serviceType === 'STANDARD_PACKAGE' ? selectedPackage?.name : 'Custom Workshop Repair',
      floorManagerId: employees.find(e => e.role === 'FLOOR_MANAGER')?.id || employees[0]?.id,
      floorManagerName: employees.find(e => e.role === 'FLOOR_MANAGER')?.name || employees[0]?.name,
      pickupRequested,
      deliveryRequested,
      discount: 0,
      taxRate: 18,
      advancePaid: 0,

      // Gate Check-In Details
      isCheckedIn: true,
      checkInRecordId: matchingCheckIn.id,
      checkedInAt: matchingCheckIn.checkedInAt || nowStr,
      checkInDriverName: matchingCheckIn.checkInDriverName,
      checkInDriverPhone: matchingCheckIn.checkInDriverPhone,
      checkInPhotoWithDriverUrl: matchingCheckIn.checkInPhotoWithDriverUrl,

      qcChecklist: [
        { id: 'qc-1', label: 'Engine oil cap & dipstick tightened', category: 'ENGINE', isPassed: false },
        { id: 'qc-2', label: 'Brake fluid reservoir level checked', category: 'ENGINE', isPassed: false },
        { id: 'qc-3', label: 'Wheel lug nuts torque check', category: 'BODY', isPassed: false },
        { id: 'qc-4', label: 'Tire pressure balanced (32 PSI)', category: 'BODY', isPassed: false },
        { id: 'qc-5', label: 'Interior seat & dashboard protection removed', category: 'INTERIOR', isPassed: false },
        { id: 'qc-6', label: 'Road test - no vibration/noise', category: 'TEST_DRIVE', isPassed: false },
      ],
      qcPassed: false,
      tasks: tasks.map((t, idx) => ({
        id: `task-gen-${Date.now()}-${idx}`,
        jobCardId: 'PENDING',
        title: t.title,
        category: t.category,
        assignedToId: t.assignedToId,
        assignedToName: t.assignedToName,
        assignedType: t.assignedType,
        estimatedCost: t.estimatedCost,
        customerPrice: t.customerPrice,
        status: 'PENDING',
        requiresCustomerApproval: t.requiresCustomerApproval,
        isCustomerApproved: t.requiresCustomerApproval ? null : true,
        isContractBasis: t.isContractBasis,
        contractorPayout: (t as any).contractorPayout || t.estimatedCost,
        painterPayout: t.painterPayout,
        denterPayout: t.denterPayout,
        pairedDenterId: t.pairedDenterId,
        pairedDenterName: t.pairedDenterName,
        standardJobId: t.standardJobId,
      }))
    });

    // Update Gate Check-In status & link Job Card ID
    updateVehicleCheckIn(matchingCheckIn.id, (prev) => ({
      ...prev,
      status: 'JOB_CARD_CREATED',
      jobCardId: newJobCard.id,
    }));

    onCardCreated(newJobCard);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="p-5 bg-slate-900 border-b border-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Create New Workshop Job Card</h2>
              <p className="text-xs text-slate-400">Step {step} of 2 • {step === 1 ? '1. Basic Vehicle & Customer Details' : '2. Tick Standard Services (Allot Later)'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          
          {step === 1 && (
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">

              {/* City & Workshop Selection + Cars24 Tag */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  Workshop Location & Fleet Channel
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      City / Region
                    </label>
                    <select
                      value={selectedCityId}
                      onChange={(e) => handleCityChange(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-semibold"
                    >
                      {cities.length === 0 ? (
                        <option value="">No cities configured</option>
                      ) : (
                        cities.map(c => <option key={c.id} value={c.id}>{c.name} ({c.state})</option>)
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Assigned Workshop Branch
                    </label>
                    <select
                      value={selectedWorkshopId}
                      onChange={(e) => handleWorkshopChange(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-semibold"
                    >
                      {workshops.filter(w => !selectedCityId || w.cityId === selectedCityId).length === 0 ? (
                        <option value="">No workshops in city</option>
                      ) : (
                        workshops
                          .filter(w => !selectedCityId || w.cityId === selectedCityId)
                          .map(w => (
                            <option key={w.id} value={w.id}>
                              {w.name} {w.isCars24Partner ? '⚡ (Cars24 Partner)' : ''}
                            </option>
                          ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Fleet / B2B Category
                    </label>
                    <div className="flex items-center gap-3 pt-1">
                      <label className="flex items-center gap-2 text-xs font-bold text-orange-600 dark:text-orange-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isCars24}
                          onChange={(e) => setIsCars24(e.target.checked)}
                          className="rounded accent-orange-500 w-4 h-4"
                        />
                        Cars24 Vendor Fleet
                      </label>
                    </div>
                  </div>
                </div>

                {isCars24 && (
                  <div className="p-3 bg-orange-500/10 rounded-xl border border-orange-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-black text-orange-700 dark:text-orange-400 uppercase tracking-wide">
                        ⚡ CARS24 FLEET VEHICLE CHECK-IN
                      </span>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300">
                        This job card will be managed in Cars24 vendor pipeline with segregated invoicing & separate fleet counters.
                      </p>
                    </div>

                    <input
                      type="text"
                      placeholder="Cars24 Ref / Order ID (e.g. C24-99812)"
                      value={cars24RefNo}
                      onChange={(e) => setCars24RefNo(e.target.value)}
                      className="px-3 py-1.5 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-900 border border-orange-300 dark:border-orange-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                )}
              </div>
              
              {/* Vehicle Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Car className="w-4 h-4 text-amber-500" />
                  Vehicle Make, Model, Variant & Powertrain Details
                </h3>

                {/* Make, Model, Variant & Fuel Type Selector */}
                <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                  <CarModelSelector
                    make={make}
                    model={model}
                    variant={variant}
                    fuelType={fuelType}
                    onMakeChange={setMake}
                    onModelChange={setModel}
                    onVariantChange={setVariant}
                    onFuelTypeChange={setFuelType}
                    required
                  />
                </div>

                {/* License Plate, Year, Color, VIN, Fuel Level & Mileage */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-1">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Registration Number <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsScannerOpen(true)}
                        className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Scan</span>
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={regNo}
                        onChange={(e) => setRegNo(e.target.value)}
                        placeholder="e.g. MH02CB8811"
                        className="w-full px-3 py-2 text-xs font-mono font-bold uppercase rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setIsScannerOpen(true)}
                        title="Scan license plate with live camera"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-amber-500 transition-colors"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Mfg Year</label>
                    <input
                      type="number"
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Vehicle Color</label>
                    <input
                      type="text"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">VIN / Chassis No</label>
                    <input
                      type="text"
                      value={vin}
                      onChange={(e) => setVin(e.target.value)}
                      placeholder="Optional VIN"
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold mb-1">
                      <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <Fuel className="w-3.5 h-3.5 text-amber-500" />
                        Fuel Gauge Level ({fuelLevel}%)
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={fuelLevel}
                      onChange={(e) => setFuelLevel(Number(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold mb-1">
                      <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <Gauge className="w-3.5 h-3.5 text-amber-500" />
                        Odometer Mileage (km)
                      </span>
                    </div>
                    <input
                      type="number"
                      value={mileage}
                      onChange={(e) => setMileage(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Customer Section */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
                  <User className="w-4 h-4 text-amber-500" />
                  Vehicle Owner Contact
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Customer Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Phone Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="e.g. +1 (555) 000-1234"
                      className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="john@example.com"
                      className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Delivery Address</label>
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="742 Evergreen Terrace, Sector 4..."
                    className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="flex items-center gap-6 mt-4">
                  <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pickupRequested}
                      onChange={(e) => setPickupRequested(e.target.checked)}
                      className="rounded accent-amber-500"
                    />
                    Customer requested vehicle pickup from home
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deliveryRequested}
                      onChange={(e) => setDeliveryRequested(e.target.checked)}
                      className="rounded accent-amber-500"
                    />
                    Customer requested home delivery when repair done
                  </label>
                </div>
              </div>

            </div>
          )}

          {step === 2 && (
            <div className="p-6 space-y-6 max-h-[72vh] overflow-y-auto">
              
              {/* Vehicle Context Banner */}
              <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="px-2 py-0.5 rounded font-mono font-black text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700">
                    {regNo || 'REG-PENDING'}
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    {make} {model} {variant ? `• ${variant}` : ''}
                  </span>
                  <FuelTypeBadge fuelType={fuelType} size="sm" />
                  <span className="text-slate-500 dark:text-slate-400">
                    ({year} • {color})
                  </span>
                </div>
                <div className="text-slate-600 dark:text-slate-300 font-medium">
                  Customer: <span className="font-bold text-slate-900 dark:text-slate-100">{customerName || 'Counter Customer'}</span> ({customerPhone || 'N/A'})
                </div>
              </div>

              {/* Job Allotment Mode Selector */}
              <div className="p-4 rounded-2xl bg-slate-900 text-white border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-amber-400 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      Standard Job Allotment Pipeline
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {isCars24 
                        ? '⚡ Cars24 Fleet Mode: Selecting paint panels creates painting jobs which include prepaint denting.'
                        : 'Select standard jobs from 8 categorized sections or run AI diagnostics below.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400">Total Allotted:</span>
                    <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-xs font-mono">
                      {tasks.length} {tasks.length === 1 ? 'Job' : 'Jobs'}
                    </span>
                  </div>
                </div>

                {/* Categorized Job Allotment Pipeline Component */}
                <div className="pt-2">
                  <JobAllotmentPipeline
                    isCars24={isCars24}
                    cars24RefNo={cars24RefNo}
                    employees={employees}
                    vendors={vendors}
                    selectedTasks={tasks as AllocatedTaskItem[]}
                    onTasksChange={(updated) => setTasks(updated as any)}
                  />
                </div>
              </div>

              {/* Service Type & AI Diagnosis Assistant Accordion/Section */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-4">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-amber-500" />
                  Additional Preset Packages & AI Diagnosis
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setServiceType('STANDARD_PACKAGE')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      serviceType === 'STANDARD_PACKAGE'
                        ? 'border-amber-500 bg-amber-500/10 text-slate-900 dark:text-slate-100 font-semibold'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <p className="text-xs font-bold">Standard Service Package</p>
                    <p className="text-[11px] opacity-80">30-Point Checkup, Brake Overhaul, etc.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setServiceType('CUSTOM_REPAIR')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      serviceType === 'CUSTOM_REPAIR'
                        ? 'border-amber-500 bg-amber-500/10 text-slate-900 dark:text-slate-100 font-semibold'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <p className="text-xs font-bold">Custom Repair / Diagnostic</p>
                    <p className="text-[11px] opacity-80">Ad-hoc mechanical issues & troubleshooting</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setServiceType('ACCIDENT_BODYWORK')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      serviceType === 'ACCIDENT_BODYWORK'
                        ? 'border-amber-500 bg-amber-500/10 text-slate-900 dark:text-slate-100 font-semibold'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <p className="text-xs font-bold">Accident & Body Paint</p>
                    <p className="text-[11px] opacity-80">Dent pulling, spray booth paint & polishing</p>
                  </button>
                </div>

                {serviceType === 'STANDARD_PACKAGE' && (
                  <div className="space-y-2 mb-4">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Choose Preset Package:</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {STANDARD_PACKAGES.map((pkg) => (
                        <div
                          key={pkg.id}
                          onClick={() => handlePackageSelect(pkg)}
                          className={`p-3 rounded-xl border cursor-pointer transition-all ${
                            selectedPackage?.id === pkg.id
                              ? 'border-amber-500 bg-slate-900 text-white shadow-md'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-xs">{pkg.name}</span>
                            <span className="text-amber-400 font-extrabold text-xs">₹{pkg.basePrice.toLocaleString('en-IN')}</span>
                          </div>
                          <p className="text-[11px] text-slate-400">{pkg.tagline}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Diagnostic Assistant Box */}
                <div className="p-4 rounded-2xl bg-slate-900 text-white border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                      <Sparkles className="w-4 h-4" />
                      Gemini AI Diagnostic Assistant
                    </div>
                    <span className="text-[10px] text-slate-400">Auto-suggest repair tasks based on vehicle symptoms</span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={symptomsInput}
                      onChange={(e) => setSymptomsInput(e.target.value)}
                      placeholder="Enter symptoms e.g. 'Engine knocking sound when accelerating, brake squeal'"
                      className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <button
                      type="button"
                      onClick={handleRunAiDiagnosis}
                      disabled={isAiDiagnosing || !symptomsInput.trim()}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors disabled:opacity-50"
                    >
                      {isAiDiagnosing ? 'Analyzing...' : 'Generate Tasks'}
                    </button>
                  </div>
                  {aiError && <p className="text-[11px] text-rose-400">{aiError}</p>}
                </div>
              </div>

              {/* Itemized Allotted Tasks Table */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Alloted Job Card Tasks List ({tasks.length})
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddTask}
                    className="text-xs text-amber-600 dark:text-amber-400 font-semibold hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Custom Task
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {tasks.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs font-medium border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50 p-4">
                      <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">No jobs added to this job card yet</p>
                      <p className="text-[11px] text-slate-500">Select standard jobs section-by-section using the section tabs above (Painting & Denting, Mechanical, Washing, Accessories, etc.) by clicking "+ Add", or add a custom task above.</p>
                    </div>
                  ) : (
                    tasks.map((task, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex-1 w-full space-y-1">
                          <input
                            type="text"
                            value={task.title}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTasks(prev => prev.map((t, i) => i === idx ? { ...t, title: val } : t));
                            }}
                            className="w-full font-semibold text-slate-900 dark:text-slate-100 bg-transparent border-b border-slate-200 dark:border-slate-700 focus:outline-none focus:border-amber-500"
                          />

                          <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                            <span>Team: <strong>{task.team || 'General'}</strong></span>
                            <span>Category: <strong>{task.category}</strong></span>
                          </div>

                          {/* Editable Painter/Denter or Contractor Payouts inline */}
                          {task.isContractBasis && (
                            <div className="flex items-center gap-2 pt-1 text-[11px]">
                              <span className="font-bold text-amber-600 dark:text-amber-400">Payout:</span>
                              {task.category === 'PAINT' ? (
                                <div className="flex items-center gap-2">
                                  <label className="flex items-center gap-1 text-[10px] text-purple-600 dark:text-purple-400 font-medium">
                                    P: ₹
                                    <input
                                      type="number"
                                      value={task.painterPayout ?? 800}
                                      onChange={(e) => {
                                        const pVal = Number(e.target.value) || 0;
                                        setTasks(prev => prev.map((t, i) => i === idx ? {
                                          ...t,
                                          painterPayout: pVal,
                                          estimatedCost: pVal + (t.denterPayout || 0)
                                        } : t));
                                      }}
                                      className="w-14 px-1 py-0.5 rounded bg-slate-50 dark:bg-slate-800 border border-purple-300 dark:border-purple-800 font-mono font-bold"
                                    />
                                  </label>
                                  <label className="flex items-center gap-1 text-[10px] text-orange-600 dark:text-orange-400 font-medium">
                                    D: ₹
                                    <input
                                      type="number"
                                      value={task.denterPayout ?? 150}
                                      onChange={(e) => {
                                        const dVal = Number(e.target.value) || 0;
                                        setTasks(prev => prev.map((t, i) => i === idx ? {
                                          ...t,
                                          denterPayout: dVal,
                                          estimatedCost: (t.painterPayout || 0) + dVal
                                        } : t));
                                      }}
                                      className="w-14 px-1 py-0.5 rounded bg-slate-50 dark:bg-slate-800 border border-orange-300 dark:border-orange-800 font-mono font-bold"
                                    />
                                  </label>
                                </div>
                              ) : (
                                <label className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                  Total: ₹
                                  <input
                                    type="number"
                                    value={task.estimatedCost}
                                    onChange={(e) => {
                                      const cost = Number(e.target.value) || 0;
                                      setTasks(prev => prev.map((t, i) => i === idx ? { ...t, estimatedCost: cost } : t));
                                    }}
                                    className="w-16 px-1 py-0.5 rounded bg-slate-50 dark:bg-slate-800 border border-amber-300 dark:border-amber-800 font-mono font-bold"
                                  />
                                </label>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Team Assignment & Customer Price */}
                        <div className="flex items-center gap-2 w-full md:w-auto">
                          <select
                            value={task.assignedToId || ''}
                            onChange={(e) => {
                              const emp = employees.find(emp => emp.id === e.target.value);
                              const ven = vendors.find(v => v.id === e.target.value);
                              setTasks(prev => prev.map((t, i) => i === idx ? {
                                ...t,
                                assignedToId: e.target.value || undefined,
                                assignedToName: emp?.name || ven?.name || undefined,
                                assignedType: ven ? 'VENDOR' : 'EMPLOYEE'
                              } : t));
                            }}
                            className="px-2 py-1 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium"
                          >
                            <option value="">-- Unassigned (Allot Later) --</option>
                            <optgroup label="Workshop Staff">
                              {employees.map(e => (
                                <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                              ))}
                            </optgroup>
                            <optgroup label="Sublet Vendors">
                              {vendors.map(v => (
                                <option key={v.id} value={v.id}>{v.name} ({v.category})</option>
                              ))}
                            </optgroup>
                          </select>

                          <div className="flex items-center gap-1">
                            <span className="text-emerald-600 font-bold text-[10px]">Bill: ₹</span>
                            <input
                              type="number"
                              value={task.customerPrice}
                              onChange={(e) => {
                                const price = Number(e.target.value);
                                setTasks(prev => prev.map((t, i) => i === idx ? { ...t, customerPrice: price } : t));
                              }}
                              className="w-16 px-1.5 py-1 text-xs rounded-md bg-slate-50 dark:bg-slate-800 border border-emerald-300 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 font-mono font-bold"
                              title="Customer Billing Price"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveTask(idx)}
                            className="p-1 text-rose-500 hover:bg-rose-500/10 rounded-md"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}

          {/* Modal Footer Controls */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            {step === 1 ? (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                Back to Vehicle Details
              </button>
            )}

            {step === 1 ? (
              <button
                type="button"
                onClick={() => {
                  if (!regNo.trim() || !customerName.trim() || !customerPhone.trim()) {
                    alert('Please enter Registration Number, Customer Name, and Phone Number.');
                    return;
                  }
                  setStep(2);
                }}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-md"
              >
                Continue to Task Allotments →
              </button>
            ) : (
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition-colors shadow-md flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Create Job Card
              </button>
            )}
          </div>

        </form>

      </div>

      <LicensePlateScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanComplete={(scannedPlate) => setRegNo(scannedPlate)}
      />
    </div>
  );
}
