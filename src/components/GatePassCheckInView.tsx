import React, { useState, useEffect } from 'react';
import { 
  Car, 
  UserCheck, 
  Camera, 
  Plus, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  LogOut, 
  LogIn, 
  ShieldCheck, 
  Building2, 
  Phone, 
  FileText, 
  ChevronRight, 
  ArrowRight,
  X,
  Upload,
  RefreshCw,
  Flame,
  Gauge
} from 'lucide-react';
import { VehicleCheckIn, CheckInStatus, FuelType } from '../types';
import { getVehicleCheckIns, createVehicleCheckIn, updateVehicleCheckIn, updateJobCard, subscribeToStore } from '../lib/storage';
import { LicensePlateScannerModal } from './LicensePlateScannerModal';
import { CarModelSelector } from './CarModelSelector';
import { FuelTypeBadge } from './FuelTypeBadge';

interface GatePassCheckInViewProps {
  onOpenCreateJobCardWithPrefill?: (prefill: {
    regNo: string;
    make: string;
    model: string;
    variant?: string;
    fuelType?: FuelType;
    color?: string;
    customerName: string;
    customerPhone: string;
    isCars24: boolean;
    cars24RefNo?: string;
    checkInRecordId: string;
    driverName: string;
    driverPhone: string;
    driverPhotoUrl?: string;
  }) => void;
  onSelectJobCard?: (jobCardId: string) => void;
}

const SAMPLE_DRIVER_CAR_PHOTOS = [
  { label: 'White Hatchback + Driver', url: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80' },
  { label: 'Grey SUV + Driver', url: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80' },
  { label: 'Silver Sedan + Driver', url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80' },
  { label: 'Brown Luxury + Driver', url: 'https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=800&q=80' },
];

export function GatePassCheckInView({ onOpenCreateJobCardWithPrefill, onSelectJobCard }: GatePassCheckInViewProps) {
  const [checkIns, setCheckIns] = useState<VehicleCheckIn[]>(() => getVehicleCheckIns());

  useEffect(() => {
    const refreshData = () => {
      setCheckIns(getVehicleCheckIns());
    };
    refreshData();
    const unsubscribe = subscribeToStore(refreshData);
    return () => { unsubscribe(); };
  }, []);
  const [activeFilter, setActiveFilter] = useState<'IN_WORKSHOP' | 'IDLE_PI' | 'ACTIVE_REPAIR' | 'READY_DISPATCH' | 'CHECKED_OUT'>('IN_WORKSHOP');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Camera License Plate Scanner Modal State
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // New Gate Check-In Modal State
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [regNo, setRegNo] = useState('');
  const [make, setMake] = useState('Maruti Suzuki');
  const [model, setModel] = useState('Swift');
  const [variant, setVariant] = useState('VXi');
  const [fuelType, setFuelType] = useState<FuelType>('Petrol');
  const [color, setColor] = useState('Arctic White');
  const [fuelLevel, setFuelLevel] = useState(50);
  const [mileage, setMileage] = useState(35000);
  const [isCars24, setIsCars24] = useState(true);
  const [cars24RefNo, setCars24RefNo] = useState('C24-MUM-' + Math.floor(1000 + Math.random() * 9000));
  const [customerName, setCustomerName] = useState('Cars24 Hub - Andheri');
  const [customerPhone, setCustomerPhone] = useState('+91 98200 11223');
  const [driverName, setDriverName] = useState('Ramesh Kumar (Logistics)');
  const [driverPhone, setDriverPhone] = useState('+91 98200 99887');
  const [photoUrl, setPhotoUrl] = useState(SAMPLE_DRIVER_CAR_PHOTOS[0].url);
  const [checkInNotes, setCheckInNotes] = useState('Arrived via driver. Waiting for Cars24 WSM preliminary inspection (PI) & estimate approval.');
  const [initialStatus, setInitialStatus] = useState<CheckInStatus>('IDLE_AWAITING_PI');

  // Check-Out Modal State
  const [checkOutItem, setCheckOutItem] = useState<VehicleCheckIn | null>(null);
  const [exitDriverName, setExitDriverName] = useState('');
  const [exitDriverPhone, setExitDriverPhone] = useState('');
  const [exitPhotoUrl, setExitPhotoUrl] = useState(SAMPLE_DRIVER_CAR_PHOTOS[1].url);
  const [exitNotes, setExitNotes] = useState('Work completed & inspected. Car handed over to delivery driver.');

  const refreshList = () => {
    setCheckIns(getVehicleCheckIns());
  };

  // Workshop counts
  const inWorkshopCount = checkIns.filter(c => c.status !== 'CHECKED_OUT').length;
  const idleAwaitingPiCount = checkIns.filter(c => c.status === 'IDLE_AWAITING_PI').length;
  const activeRepairCount = checkIns.filter(c => c.status === 'JOB_CARD_CREATED' || c.status === 'AWAITING_JOB_CARD').length;
  const readyDispatchCount = checkIns.filter(c => c.status === 'READY_PENDING_DISPATCH').length;
  const checkedOutCount = checkIns.filter(c => c.status === 'CHECKED_OUT').length;

  const handleCreateCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regNo.trim() || !driverName.trim()) return;

    createVehicleCheckIn({
      registrationNumber: regNo.toUpperCase().trim(),
      make,
      model,
      variant: variant.trim() || undefined,
      fuelType,
      color,
      fuelLevel,
      mileage,
      isCars24,
      cars24RefNo: isCars24 ? cars24RefNo : undefined,
      customerName: isCars24 ? (customerName || 'Cars24 Hub') : customerName,
      customerPhone,
      checkedInByName: 'Gate Security / Manager',
      checkInDriverName: driverName,
      checkInDriverPhone: driverPhone,
      checkInPhotoWithDriverUrl: photoUrl,
      checkInNotes,
      status: initialStatus,
    });

    refreshList();
    setIsCheckInModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setRegNo('');
    setMake('Maruti Suzuki');
    setModel('Swift');
    setVariant('VXi');
    setFuelType('Petrol');
    setColor('Arctic White');
    setFuelLevel(50);
    setMileage(35000);
    setIsCars24(true);
    setCars24RefNo('C24-MUM-' + Math.floor(1000 + Math.random() * 9000));
    setCustomerName('Cars24 Hub - Andheri');
    setCustomerPhone('+91 98200 11223');
    setDriverName('Ramesh Kumar (Logistics)');
    setDriverPhone('+91 98200 99887');
    setPhotoUrl(SAMPLE_DRIVER_CAR_PHOTOS[0].url);
    setCheckInNotes('Arrived via driver. Waiting for Cars24 WSM preliminary inspection (PI) & estimate approval.');
    setInitialStatus('IDLE_AWAITING_PI');
  };

  const handleConfirmCheckOut = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkOutItem || !exitDriverName.trim()) return;

    const nowStr = new Date().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });

    updateVehicleCheckIn(checkOutItem.id, (prev) => ({
      ...prev,
      status: 'CHECKED_OUT',
      checkedOutAt: nowStr,
      checkedOutByName: 'Gate Security / Manager',
      checkOutDriverName: exitDriverName,
      checkOutDriverPhone: exitDriverPhone,
      checkOutPhotoWithDriverUrl: exitPhotoUrl,
      checkOutNotes: exitNotes,
    }));

    // If linked to a Job Card, update Job Card status to DELIVERED / closed
    if (checkOutItem.jobCardId) {
      updateJobCard(checkOutItem.jobCardId, (card) => ({
        ...card,
        status: 'DELIVERED',
        checkedOutAt: nowStr,
        checkOutDriverName: exitDriverName,
        checkOutDriverPhone: exitDriverPhone,
        checkOutPhotoWithDriverUrl: exitPhotoUrl,
      }));
    }

    refreshList();
    setCheckOutItem(null);
    setExitDriverName('');
    setExitDriverPhone('');
  };

  const filteredItems = checkIns.filter(item => {
    const matchesSearch = 
      item.registrationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.checkInDriverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.customerName.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (activeFilter === 'IN_WORKSHOP') return item.status !== 'CHECKED_OUT';
    if (activeFilter === 'IDLE_PI') return item.status === 'IDLE_AWAITING_PI';
    if (activeFilter === 'ACTIVE_REPAIR') return item.status === 'JOB_CARD_CREATED' || item.status === 'AWAITING_JOB_CARD';
    if (activeFilter === 'READY_DISPATCH') return item.status === 'READY_PENDING_DISPATCH';
    if (activeFilter === 'CHECKED_OUT') return item.status === 'CHECKED_OUT';

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Car className="w-64 h-64 text-blue-400" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-blue-500/20 text-blue-300 text-xs font-black px-3 py-1 rounded-full border border-blue-500/30 uppercase tracking-widest flex items-center gap-1.5">
                <LogIn className="w-3.5 h-3.5" /> Gate Pass & Workshop Presence
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-500/30">
                Live Workshop Entry & Dispatch
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Vehicle Gate Check-In & Physical Count
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              Track physical vehicles in the workshop premise—from initial driver drop-off & preliminary inspection (PI) to final driver pick-up & gate exit verification with driver photos.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="px-4 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 font-black text-sm flex items-center justify-center gap-2 transition-all shadow-md"
            >
              <Camera className="w-5 h-5 text-amber-400" />
              <span>Scan License Plate</span>
            </button>

            <button
              type="button"
              onClick={() => {
                resetForm();
                setIsCheckInModalOpen(true);
              }}
              className="px-5 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
              <span>New Vehicle Gate Check-In</span>
            </button>
          </div>
        </div>

        {/* Live Workshop Physical Count KPI Metrics */}
        <div className="mt-6 pt-6 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-800/80 border border-slate-700/60 p-4 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
              <span>Physically In Workshop</span>
              <Car className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-black text-white mt-1">{inWorkshopCount}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Vehicles currently on site</p>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl">
            <div className="flex items-center justify-between text-amber-300 text-xs font-bold">
              <span>Idle - Awaiting PI / Estimate</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-black text-amber-400 mt-1">{idleAwaitingPiCount}</p>
            <p className="text-[11px] text-amber-300/80 mt-0.5">Waiting Cars24 WSM approval</p>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-2xl">
            <div className="flex items-center justify-between text-blue-300 text-xs font-bold">
              <span>Active Job Cards</span>
              <Gauge className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-black text-blue-400 mt-1">{activeRepairCount}</p>
            <p className="text-[11px] text-blue-300/80 mt-0.5">Under repair in bay</p>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl">
            <div className="flex items-center justify-between text-emerald-300 text-xs font-bold">
              <span>Ready - Pending Driver Exit</span>
              <LogOut className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-black text-emerald-400 mt-1">{readyDispatchCount}</p>
            <p className="text-[11px] text-emerald-300/80 mt-0.5">Invoice done, awaiting driver</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveFilter('IN_WORKSHOP')}
              className={`px-4 py-2 rounded-2xl text-xs font-black transition-all shrink-0 ${
                activeFilter === 'IN_WORKSHOP'
                  ? 'bg-slate-900 text-white dark:bg-blue-600 dark:text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              In Workshop ({inWorkshopCount})
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('IDLE_PI')}
              className={`px-4 py-2 rounded-2xl text-xs font-black transition-all shrink-0 flex items-center gap-1.5 ${
                activeFilter === 'IDLE_PI'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 hover:bg-amber-500/20'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              Idle - Awaiting PI ({idleAwaitingPiCount})
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('ACTIVE_REPAIR')}
              className={`px-4 py-2 rounded-2xl text-xs font-black transition-all shrink-0 ${
                activeFilter === 'ACTIVE_REPAIR'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Active Job Cards ({activeRepairCount})
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('READY_DISPATCH')}
              className={`px-4 py-2 rounded-2xl text-xs font-black transition-all shrink-0 ${
                activeFilter === 'READY_DISPATCH'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Ready - Awaiting Driver ({readyDispatchCount})
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('CHECKED_OUT')}
              className={`px-4 py-2 rounded-2xl text-xs font-black transition-all shrink-0 ${
                activeFilter === 'CHECKED_OUT'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Gate Departures ({checkedOutCount})
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Reg No, Driver, Make..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xs border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Checked-In Vehicles Grid */}
      {filteredItems.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 space-y-3">
          <Car className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
          <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">No Vehicles Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No gate check-in records match your search query or active filter tab.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredItems.map((item) => (
            <div 
              key={item.id}
              className={`bg-white dark:bg-slate-900 rounded-3xl border transition-all shadow-xs hover:shadow-md overflow-hidden flex flex-col justify-between ${
                item.status === 'IDLE_AWAITING_PI'
                  ? 'border-amber-400 dark:border-amber-500/60 ring-2 ring-amber-500/20'
                  : item.status === 'READY_PENDING_DISPATCH'
                  ? 'border-emerald-400 dark:border-emerald-500/60 ring-1 ring-emerald-500/20'
                  : item.status === 'CHECKED_OUT'
                  ? 'border-slate-200 dark:border-slate-800 opacity-80'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div>
                {/* Image Header with Photo of Car & Driver */}
                <div className="relative h-44 bg-slate-950 overflow-hidden group">
                  {item.checkInPhotoWithDriverUrl ? (
                    <img 
                      src={item.checkInPhotoWithDriverUrl} 
                      alt={`Car with driver ${item.checkInDriverName}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                      <Camera className="w-10 h-10" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-linear-to-t from-slate-950/90 via-slate-950/30 to-transparent p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-black bg-slate-900/90 text-white px-2.5 py-1 rounded-xl border border-slate-700">
                        {item.id}
                      </span>

                      {/* Status Badge */}
                      {item.status === 'IDLE_AWAITING_PI' && (
                        <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-md animate-pulse">
                          <Clock className="w-3 h-3" /> Idle - Waiting PI
                        </span>
                      )}
                      {item.status === 'JOB_CARD_CREATED' && (
                        <span className="bg-blue-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                          <Gauge className="w-3 h-3" /> Active Job Card
                        </span>
                      )}
                      {item.status === 'READY_PENDING_DISPATCH' && (
                        <span className="bg-emerald-500 text-slate-950 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-md">
                          <CheckCircle2 className="w-3 h-3" /> Ready For Driver
                        </span>
                      )}
                      {item.status === 'CHECKED_OUT' && (
                        <span className="bg-slate-700 text-slate-200 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                          <LogOut className="w-3 h-3" /> Checked Out
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-amber-500 text-slate-950 font-mono text-sm font-black px-2.5 py-0.5 rounded-lg inline-block border border-amber-400">
                          {item.registrationNumber}
                        </span>
                        <FuelTypeBadge fuelType={item.fuelType} size="sm" />
                      </div>
                      <h3 className="text-white font-black text-base drop-shadow-xs flex items-center gap-1.5 flex-wrap">
                        <span>{item.make} {item.model}</span>
                        {item.variant && (
                          <span className="text-xs px-2 py-0.5 rounded-md bg-white/20 text-white font-semibold">
                            {item.variant}
                          </span>
                        )}
                        {item.color && (
                          <span className="text-xs text-slate-300 font-normal">
                            ({item.color})
                          </span>
                        )}
                      </h3>
                    </div>
                  </div>
                </div>

                {/* Details Body */}
                <div className="p-5 space-y-4 text-xs">
                  {/* Driver & Arrival Info */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3.5 space-y-2 border border-slate-200/80 dark:border-slate-700/60">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-bold text-[11px]">
                      <span className="flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-blue-500" /> Arrival Driver:
                      </span>
                      <span className="text-slate-900 dark:text-slate-100 font-extrabold">{item.checkInDriverName}</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-bold text-[11px]">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-emerald-500" /> Driver Phone:
                      </span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">{item.checkInDriverPhone || 'N/A'}</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-bold text-[11px]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-500" /> Gate Arrival:
                      </span>
                      <span className="text-slate-700 dark:text-slate-300">{item.checkedInAt}</span>
                    </div>
                  </div>

                  {/* Customer / Fleet details */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-slate-400 text-[10px] font-bold block uppercase tracking-wider">Customer / Fleet</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                        {item.isCars24 ? (
                          <span className="bg-orange-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-sm">CARS24</span>
                        ) : (
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                        )}
                        {item.customerName}
                      </span>
                    </div>

                    {item.jobCardId && (
                      <div className="text-right">
                        <span className="text-slate-400 text-[10px] font-bold block uppercase tracking-wider">Linked Job Card</span>
                        <button
                          type="button"
                          onClick={() => onSelectJobCard?.(item.jobCardId!)}
                          className="font-mono font-black text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 justify-end"
                        >
                          {item.jobCardId} <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {item.checkInNotes && (
                    <p className="text-slate-600 dark:text-slate-400 text-[11px] italic bg-slate-100 dark:bg-slate-800/40 p-2.5 rounded-xl">
                      "{item.checkInNotes}"
                    </p>
                  )}

                  {/* Departure info if checked out */}
                  {item.status === 'CHECKED_OUT' && (
                    <div className="bg-slate-100 dark:bg-slate-800/80 p-3 rounded-2xl space-y-1.5 border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-500 font-bold text-[10px] uppercase tracking-wider block">Check-Out Departure Details</span>
                      <div className="flex items-center justify-between font-extrabold text-slate-800 dark:text-slate-200 text-[11px]">
                        <span>Pickup Driver:</span>
                        <span>{item.checkOutDriverName}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-500 text-[11px]">
                        <span>Departed:</span>
                        <span>{item.checkedOutAt}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Footer */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                {item.status !== 'CHECKED_OUT' ? (
                  <>
                    {!item.jobCardId ? (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenCreateJobCardWithPrefill?.({
                            regNo: item.registrationNumber,
                            make: item.make,
                            model: item.model,
                            variant: item.variant,
                            fuelType: item.fuelType,
                            color: item.color,
                            customerName: item.customerName,
                            customerPhone: item.customerPhone,
                            isCars24: item.isCars24,
                            cars24RefNo: item.cars24RefNo,
                            checkInRecordId: item.id,
                            driverName: item.checkInDriverName,
                            driverPhone: item.checkInDriverPhone,
                            driverPhotoUrl: item.checkInPhotoWithDriverUrl,
                          });
                        }}
                        className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-xs transition-all w-full justify-center"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create Job Card</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelectJobCard?.(item.jobCardId!)}
                        className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-extrabold text-xs flex items-center gap-1 transition-all"
                      >
                        <span>View Job Card</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setCheckOutItem(item);
                        setExitDriverName(item.checkInDriverName || 'Cars24 Driver');
                        setExitDriverPhone(item.checkInDriverPhone || '');
                      }}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-xs transition-all shrink-0"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Check-Out</span>
                    </button>
                  </>
                ) : (
                  <span className="text-slate-400 font-bold text-xs flex items-center gap-1 mx-auto">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Vehicle Departed Workshop
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* NEW VEHICLE GATE CHECK-IN MODAL */}
      {isCheckInModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
                  <LogIn className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black">Gate Entry - Vehicle Check-In</h2>
                  <p className="text-xs text-slate-400">Record physical car entry & capture photo with driver</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCheckInModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCheckIn} className="p-6 space-y-5 text-xs overflow-y-auto">
              {/* Fleet / Ownership Selector */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <span className="text-slate-700 dark:text-slate-300 font-black uppercase text-[10px] tracking-wider block">
                  1. Fleet / Source Type
                </span>
                
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 font-bold cursor-pointer">
                    <input
                      type="radio"
                      name="fleetType"
                      checked={isCars24}
                      onChange={() => {
                        setIsCars24(true);
                        setCustomerName('Cars24 Hub - Andheri');
                        setCustomerPhone('+91 98200 11223');
                        setInitialStatus('IDLE_AWAITING_PI');
                      }}
                      className="text-amber-500 focus:ring-amber-500"
                    />
                    <span className="text-amber-600 dark:text-amber-400 font-black">Cars24 Fleet Partner Vehicle</span>
                  </label>

                  <label className="flex items-center gap-2 font-bold cursor-pointer">
                    <input
                      type="radio"
                      name="fleetType"
                      checked={!isCars24}
                      onChange={() => {
                        setIsCars24(false);
                        setCustomerName('');
                        setCustomerPhone('');
                        setInitialStatus('AWAITING_JOB_CARD');
                      }}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>Retail Customer Car</span>
                  </label>
                </div>

                {isCars24 && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-slate-500 font-bold block mb-1">Cars24 Reference ID</label>
                      <input
                        type="text"
                        value={cars24RefNo}
                        onChange={(e) => setCars24RefNo(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 font-bold block mb-1">Cars24 Hub / Yard Name</label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-bold"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Vehicle Specs */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <span className="text-slate-700 dark:text-slate-300 font-black uppercase text-[10px] tracking-wider block">
                  2. Vehicle Make, Model, Variant & Powertrain
                </span>

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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-700 dark:text-slate-300 font-bold block">Registration No *</label>
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
                        placeholder="e.g. MH02CB8811"
                        value={regNo}
                        onChange={(e) => setRegNo(e.target.value)}
                        required
                        className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono font-black text-sm uppercase pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setIsScannerOpen(true)}
                        title="Scan license plate with live camera"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-amber-500 transition-colors"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">Vehicle Color</label>
                    <input
                      type="text"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      placeholder="e.g. Arctic White"
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">Fuel Gauge ({fuelLevel}%)</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={fuelLevel}
                      onChange={(e) => setFuelLevel(Number(e.target.value))}
                      className="w-full mt-2 accent-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Driver Details & Verification Photo */}
              <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl space-y-3">
                <span className="text-amber-800 dark:text-amber-300 font-black uppercase text-[10px] tracking-wider block flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-amber-500" />
                  3. Arrival Driver & Photo Verification
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">Driver Name *</label>
                    <input
                      type="text"
                      placeholder="Driver name who brought the car"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      required
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">Driver Phone Number</label>
                    <input
                      type="text"
                      placeholder="+91 98200 00000"
                      value={driverPhone}
                      onChange={(e) => setDriverPhone(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
                    />
                  </div>
                </div>

                {/* Driver + Car Photo Selector */}
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5 text-amber-500" /> Photo of Car with Driver
                    </span>
                    <span className="text-slate-400 font-normal text-[11px]">Select sample preset or enter photo URL</span>
                  </label>

                  <div className="flex items-center gap-2 mb-2 overflow-x-auto pb-1">
                    {SAMPLE_DRIVER_CAR_PHOTOS.map((sample, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPhotoUrl(sample.url)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold shrink-0 border transition-all ${
                          photoUrl === sample.url
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                        }`}
                      >
                        Preset {idx + 1}: {sample.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={photoUrl}
                      onChange={(e) => setPhotoUrl(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-[11px]"
                    />

                    {photoUrl && (
                      <img 
                        src={photoUrl} 
                        alt="Driver car preview"
                        className="w-12 h-12 rounded-xl object-cover border-2 border-amber-500 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Status & Gate Notes */}
              <div>
                <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">Initial Workshop Status</label>
                <select
                  value={initialStatus}
                  onChange={(e) => setInitialStatus(e.target.value as CheckInStatus)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold"
                >
                  <option value="IDLE_AWAITING_PI">⏳ Idle - Awaiting Cars24 WSM Preliminary Inspection (PI) & Estimate Approval</option>
                  <option value="AWAITING_JOB_CARD">📋 Inspection Done - Waiting for Job Card Creation</option>
                  <option value="JOB_CARD_CREATED">🔧 Direct Job Card Creation</option>
                </select>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">Gate Notes / Observations</label>
                <textarea
                  rows={2}
                  value={checkInNotes}
                  onChange={(e) => setCheckInNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCheckInModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black flex items-center gap-2 shadow-lg shadow-amber-500/20"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Gate Check-In</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHECK-OUT / GATE DEPARTURE MODAL */}
      {checkOutItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black">
                  <LogOut className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black">Gate Departure Check-Out</h2>
                  <p className="text-xs text-slate-400">{checkOutItem.registrationNumber} - {checkOutItem.make} {checkOutItem.model}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCheckOutItem(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmCheckOut} className="p-6 space-y-4 text-xs">
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-3.5 rounded-2xl space-y-1 text-emerald-800 dark:text-emerald-300">
                <span className="font-bold flex items-center gap-1 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Vehicle Ready for Departure Handover
                </span>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Verify the driver picking up the vehicle and capture departure verification photo with the driver before gate exit.
                </p>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">Pickup Driver Name *</label>
                <input
                  type="text"
                  placeholder="Driver picking up vehicle"
                  value={exitDriverName}
                  onChange={(e) => setExitDriverName(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold"
                />
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">Pickup Driver Phone</label>
                <input
                  type="text"
                  placeholder="+91 98200 00000"
                  value={exitDriverPhone}
                  onChange={(e) => setExitDriverPhone(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono"
                />
              </div>

              {/* Exit Driver + Photo Selector */}
              <div>
                <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Camera className="w-3.5 h-3.5 text-emerald-500" /> Departure Photo of Car with Driver
                  </span>
                </label>

                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={exitPhotoUrl}
                    onChange={(e) => setExitPhotoUrl(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-[11px]"
                  />

                  {exitPhotoUrl && (
                    <img 
                      src={exitPhotoUrl} 
                      alt="Exit photo preview"
                      className="w-12 h-12 rounded-xl object-cover border-2 border-emerald-500 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">Departure Notes</label>
                <textarea
                  rows={2}
                  value={exitNotes}
                  onChange={(e) => setExitNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCheckOutItem(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black flex items-center gap-1.5 shadow-lg shadow-emerald-600/20"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Confirm Gate Exit & Dispatch</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* CAMERA LICENSE PLATE SCANNER MODAL */}
      <LicensePlateScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanComplete={(scannedPlate) => {
          if (isCheckInModalOpen) {
            setRegNo(scannedPlate);
          } else {
            setRegNo(scannedPlate);
            setIsCheckInModalOpen(true);
          }
        }}
      />
    </div>
  );
}
