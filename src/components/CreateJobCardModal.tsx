import React, { useState } from 'react';
import { JobCard, StandardServicePackage, TaskCategory, SpecializedTeam, Employee, Vendor } from '../types';
import { STANDARD_PACKAGES } from '../lib/mockData';
import { createJobCard } from '../lib/storage';
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
  Palette
} from 'lucide-react';

interface CreateJobCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  vendors: Vendor[];
  onCardCreated: (newCard: JobCard) => void;
}

export function CreateJobCardModal({
  isOpen,
  onClose,
  employees,
  vendors,
  onCardCreated,
}: CreateJobCardModalProps) {
  if (!isOpen) return null;

  const [step, setStep] = useState<1 | 2>(1);

  // Form State
  const [regNo, setRegNo] = useState('');
  const [make, setMake] = useState('Toyota');
  const [model, setModel] = useState('Corolla Altis');
  const [year, setYear] = useState(2022);
  const [color, setColor] = useState('Metallic Silver');
  const [vin, setVin] = useState('');
  const [fuelLevel, setFuelLevel] = useState(50);
  const [mileage, setMileage] = useState(35000);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');

  const [pickupRequested, setPickupRequested] = useState(false);
  const [deliveryRequested, setDeliveryRequested] = useState(true);

  const [serviceType, setServiceType] = useState<'STANDARD_PACKAGE' | 'CUSTOM_REPAIR' | 'ACCIDENT_BODYWORK'>('STANDARD_PACKAGE');
  const [selectedPackage, setSelectedPackage] = useState<StandardServicePackage | null>(STANDARD_PACKAGES[0]);

  // AI Symptoms
  const [symptomsInput, setSymptomsInput] = useState('');
  const [isAiDiagnosing, setIsAiDiagnosing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Tasks List
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

  // When package changes, auto fill tasks
  const handlePackageSelect = (pkg: StandardServicePackage) => {
    setSelectedPackage(pkg);
    const mappedTasks = pkg.includedTasks.map(t => {
      // Find matching employee or vendor
      let defaultEmp = employees.find(e => e.specializedTeam === t.defaultTeam);
      let defaultVendor = vendors.find(v => t.category === 'SUBLET_VENDOR' && v.category === 'LATHE_WORK');

      return {
        title: t.title,
        category: t.category,
        team: t.defaultTeam,
        assignedToId: defaultEmp?.id || defaultVendor?.id || employees[0]?.id,
        assignedToName: defaultEmp?.name || defaultVendor?.name || employees[0]?.name,
        assignedType: (t.category === 'SUBLET_VENDOR' || t.category === 'WASHING') ? ('VENDOR' as const) : ('EMPLOYEE' as const),
        estimatedCost: t.estimatedCost,
        customerPrice: t.price,
        requiresCustomerApproval: false,
      };
    });
    setTasks(mappedTasks);
  };

  // Initial load of default package tasks
  React.useEffect(() => {
    if (serviceType === 'STANDARD_PACKAGE' && selectedPackage && tasks.length === 0) {
      handlePackageSelect(selectedPackage);
    }
  }, [serviceType, selectedPackage]);

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
            assignedToId: employees[0]?.id,
            assignedToName: employees[0]?.name,
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
        assignedToId: employees[0]?.id,
        assignedToName: employees[0]?.name,
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

    const newJobCard = createJobCard({
      estimatedCompletionDate: new Date(Date.now() + 86400000 * 2).toLocaleDateString(),
      vehicle: {
        registrationNumber: regNo.toUpperCase(),
        make,
        model,
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
      }))
    });

    onCardCreated(newJobCard);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl shadow-2xl overflow-hidden my-8">
        
        {/* Header */}
        <div className="p-5 bg-slate-900 border-b border-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Create New Workshop Job Card</h2>
              <p className="text-xs text-slate-400">Step {step} of 2 • {step === 1 ? 'Vehicle & Customer Check-In' : 'Task Allotments & Service Selection'}</p>
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
              
              {/* Vehicle Section */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
                  <Car className="w-4 h-4 text-amber-500" />
                  Vehicle Inspection & Diagnostics
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Registration Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={regNo}
                      onChange={(e) => setRegNo(e.target.value)}
                      placeholder="e.g. NY-889-XJ"
                      className="w-full px-3 py-2 text-xs font-mono font-bold uppercase rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Make</label>
                    <input
                      type="text"
                      value={make}
                      onChange={(e) => setMake(e.target.value)}
                      placeholder="e.g. BMW, Toyota, Honda"
                      className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Model</label>
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="e.g. 330i, Camry, Civic"
                      className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Year</label>
                    <input
                      type="number"
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Color</label>
                    <input
                      type="text"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">VIN / Chassis No</label>
                    <input
                      type="text"
                      value={vin}
                      onChange={(e) => setVin(e.target.value)}
                      placeholder="Optional VIN"
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold mb-1">
                      <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <Fuel className="w-3.5 h-3.5 text-amber-500" />
                        Fuel Level ({fuelLevel}%)
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
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
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
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              
              {/* Service Selection */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">Select Service Type</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
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
              </div>

              {/* AI Diagnostic Assistant Box */}
              <div className="p-4 rounded-xl bg-slate-900 text-white border border-slate-800 space-y-3">
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

              {/* Itemized Tasks Allotment Table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Job Card Tasks & Team Allotments ({tasks.length})
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddTask}
                    className="text-xs text-amber-600 dark:text-amber-400 font-semibold hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Task
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {tasks.map((task, idx) => (
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
                          <span>Team: <strong>{task.team}</strong></span>
                          <span>Category: <strong>{task.category}</strong></span>
                        </div>
                      </div>

                      {/* Team Assignment Dropdown */}
                      <div className="flex items-center gap-2 w-full md:w-auto">
                        <select
                          value={task.assignedToId}
                          onChange={(e) => {
                            const emp = employees.find(emp => emp.id === e.target.value);
                            const ven = vendors.find(v => v.id === e.target.value);
                            setTasks(prev => prev.map((t, i) => i === idx ? {
                              ...t,
                              assignedToId: e.target.value,
                              assignedToName: emp?.name || ven?.name || 'Assigned Staff',
                              assignedType: ven ? 'VENDOR' : 'EMPLOYEE'
                            } : t));
                          }}
                          className="px-2 py-1 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium"
                        >
                          <optgroup label="Workshop Staff Teams">
                            {employees.map(e => (
                              <option key={e.id} value={e.id}>{e.name} ({e.specializedTeam})</option>
                            ))}
                          </optgroup>
                          <optgroup label="Sublet Vendors">
                            {vendors.map(v => (
                              <option key={v.id} value={v.id}>{v.name} ({v.category})</option>
                            ))}
                          </optgroup>
                        </select>

                        <div className="flex items-center gap-1">
                          <span className="text-slate-400">₹</span>
                          <input
                            type="number"
                            value={task.customerPrice}
                            onChange={(e) => {
                              const price = Number(e.target.value);
                              setTasks(prev => prev.map((t, i) => i === idx ? { ...t, customerPrice: price } : t));
                            }}
                            className="w-16 px-1.5 py-1 text-xs rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono font-bold"
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
                  ))}
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
    </div>
  );
}
