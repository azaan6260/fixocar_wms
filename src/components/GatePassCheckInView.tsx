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
  Gauge,
  Trash2,
  Check
} from 'lucide-react';
import { VehicleCheckIn, CheckInStatus, FuelType, City, Workshop, JobCard } from '../types';
import { getVehicleCheckIns, createVehicleCheckIn, updateVehicleCheckIn, deleteVehicleCheckIn, updateJobCard, getJobCards, subscribeToStore, getAuthUser, getCities, getWorkshops, dispatchToastNotification } from '../lib/storage';
import { compressImageFile } from '../lib/imageCompressor';
import { LicensePlateScannerModal } from './LicensePlateScannerModal';
import { CarModelSelector } from './CarModelSelector';
import { FuelTypeBadge } from './FuelTypeBadge';

interface GatePassCheckInViewProps {
  initialFilter?: 'IN_WORKSHOP' | 'IDLE_PI' | 'ACTIVE_REPAIR' | 'READY_DISPATCH' | 'CHECKED_OUT';
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
    workOrderNo?: string;
    workOrderNotes?: string;
    cityId?: string;
    cityName?: string;
    workshopId?: string;
    workshopName?: string;
  }) => void;
  onSelectJobCard?: (jobCardId: string) => void;
}

const SAMPLE_DRIVER_CAR_PHOTOS = [
  { label: 'White Hatchback + Driver', url: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80' },
  { label: 'Grey SUV + Driver', url: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80' },
  { label: 'Silver Sedan + Driver', url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80' },
  { label: 'Brown Luxury + Driver', url: 'https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=800&q=80' },
];

export function GatePassCheckInView({ initialFilter, onOpenCreateJobCardWithPrefill, onSelectJobCard }: GatePassCheckInViewProps) {
  const authUser = getAuthUser();
  const isManagementRole = authUser?.role === 'SUPER_ADMIN' || authUser?.role === 'ADMIN' || authUser?.role === 'SERVICE_ADVISOR' || authUser?.role === 'FLOOR_MANAGER';
  const [checkIns, setCheckIns] = useState<VehicleCheckIn[]>(() => getVehicleCheckIns());
  const [jobCardsList, setJobCardsList] = useState<JobCard[]>(() => getJobCards());

  useEffect(() => {
    const refreshData = () => {
      setCheckIns(getVehicleCheckIns());
      setJobCardsList(getJobCards());
    };
    refreshData();
    const unsubscribe = subscribeToStore(refreshData);
    return () => { unsubscribe(); };
  }, []);
  const [activeFilter, setActiveFilter] = useState<'IN_WORKSHOP' | 'IDLE_PI' | 'ACTIVE_REPAIR' | 'READY_DISPATCH' | 'CHECKED_OUT'>(initialFilter || 'IN_WORKSHOP');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Camera License Plate Scanner Modal State
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // New Gate Check-In Modal State
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [checkInStep, setCheckInStep] = useState<number>(1);
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
  const [workOrderNo, setWorkOrderNo] = useState('');
  const [workOrderNotes, setWorkOrderNotes] = useState('');

  // Check-Out Modal State
  const [justCheckedInSuccess, setJustCheckedInSuccess] = useState<VehicleCheckIn | null>(null);
  const [checkOutItem, setCheckOutItem] = useState<VehicleCheckIn | null>(null);
  const [checkOutStep, setCheckOutStep] = useState<number>(1);
  const [confirmRemoveItem, setConfirmRemoveItem] = useState<VehicleCheckIn | null>(null);
  const [exitDriverName, setExitDriverName] = useState('');
  const [exitDriverPhone, setExitDriverPhone] = useState('');
  const [exitPhotoUrl, setExitPhotoUrl] = useState(SAMPLE_DRIVER_CAR_PHOTOS[1].url);
  const [exitNotes, setExitNotes] = useState('Work completed & inspected. Car handed over to delivery driver.');

  // Camera & File Upload State
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<'checkIn' | 'checkOut'>('checkIn');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const cameraVideoRef = React.useRef<HTMLVideoElement>(null);
  const checkInFileInputRef = React.useRef<HTMLInputElement>(null);
  const checkInCameraInputRef = React.useRef<HTMLInputElement>(null);
  const checkOutFileInputRef = React.useRef<HTMLInputElement>(null);
  const checkOutCameraInputRef = React.useRef<HTMLInputElement>(null);

  // Photo File Upload Handler
  const handlePhotoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isExit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingPhoto(true);
    try {
      const compressedDataUrl = await compressImageFile(file, 600, 600, 0.65);
      if (compressedDataUrl) {
        if (isExit) {
          setExitPhotoUrl(compressedDataUrl);
        } else {
          setPhotoUrl(compressedDataUrl);
        }
      }
    } catch (err) {
      console.warn('Image processing fallback:', err);
      if (isExit) {
        setExitPhotoUrl(SAMPLE_DRIVER_CAR_PHOTOS[1].url);
      } else {
        setPhotoUrl(SAMPLE_DRIVER_CAR_PHOTOS[0].url);
      }
    } finally {
      setIsCompressingPhoto(false);
      e.target.value = '';
    }
  };

  // Camera stream release effect on background or unmount to save Android battery
  useEffect(() => {
    if (!cameraStream) return;
    const handleVisibility = () => {
      if (document.hidden) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
        setIsCameraModalOpen(false);
      }
    };
    window.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('visibilitychange', handleVisibility);
      cameraStream.getTracks().forEach(track => track.stop());
    };
  }, [cameraStream]);

  // Live Camera Stream Handlers
  const startCamera = async (target: 'checkIn' | 'checkOut') => {
    setCameraTarget(target);
    setCameraError(null);
    setIsCameraModalOpen(true);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      setCameraStream(mediaStream);
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setCameraError('Camera stream access unavailable or permission denied. Use file upload or camera app button.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraModalOpen(false);
  };

  const capturePhotoFromStream = () => {
    if (!cameraVideoRef.current) return;
    const video = cameraVideoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      if (cameraTarget === 'checkOut') {
        setExitPhotoUrl(dataUrl);
      } else {
        setPhotoUrl(dataUrl);
      }
    }
    stopCamera();
  };

  const refreshList = () => {
    setCheckIns(getVehicleCheckIns());
  };

  // Workshop counts
  const inWorkshopCount = checkIns.filter(c => c.status !== 'CHECKED_OUT').length;
  const idleAwaitingPiCount = checkIns.filter(c => c.status === 'IDLE_AWAITING_PI' || c.status === 'AWAITING_JOB_CARD').length;
  const activeRepairCount = checkIns.filter(c => c.status === 'JOB_CARD_CREATED').length;
  const readyDispatchCount = checkIns.filter(c => c.status === 'READY_PENDING_DISPATCH').length;
  const checkedOutCount = checkIns.filter(c => c.status === 'CHECKED_OUT').length;

  // Auth & Workshop Assignment Rules
  const isSuperAdmin = authUser?.role === 'SUPER_ADMIN';

  const citiesList = getCities();
  const workshopsList = getWorkshops();

  // Determine assigned workshop / city for current user
  const assignedWorkshop = workshopsList.find(w => w.id === authUser?.workshopId) || workshopsList[0];
  const assignedCity = citiesList.find(c => c.id === authUser?.cityId || c.name.toLowerCase() === assignedWorkshop?.cityName.toLowerCase()) || citiesList[0];

  const [selectedCityId, setSelectedCityId] = useState<string>(assignedCity?.id || '');
  const [selectedCityName, setSelectedCityName] = useState<string>(assignedCity?.name || 'Mumbai');
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string>(assignedWorkshop?.id || '');
  const [selectedWorkshopName, setSelectedWorkshopName] = useState<string>(assignedWorkshop?.name || 'Andheri West Hub');

  // Customer Email for Retail Customer
  const [customerEmail, setCustomerEmail] = useState('');

  // Auto-update workshop selection if city changes (for Super Admin)
  const handleCityChange = (newCityId: string) => {
    const cityObj = citiesList.find(c => c.id === newCityId);
    if (!cityObj) return;
    setSelectedCityId(cityObj.id);
    setSelectedCityName(cityObj.name);

    const filteredWorkshops = workshopsList.filter(w => w.cityId === newCityId || w.cityName.toLowerCase() === cityObj.name.toLowerCase());
    if (filteredWorkshops.length > 0) {
      setSelectedWorkshopId(filteredWorkshops[0].id);
      setSelectedWorkshopName(filteredWorkshops[0].name);
    } else {
      setSelectedWorkshopId('');
      setSelectedWorkshopName('');
    }
  };

  const handleWorkshopChange = (newWorkshopId: string) => {
    const wsObj = workshopsList.find(w => w.id === newWorkshopId);
    if (!wsObj) return;
    setSelectedWorkshopId(wsObj.id);
    setSelectedWorkshopName(wsObj.name);
  };

  const activeWorkshopsForSelectedCity = workshopsList.filter(
    w => !selectedCityId || w.cityId === selectedCityId || w.cityName.toLowerCase() === selectedCityName.toLowerCase()
  );

  const handleCreateCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regNo.trim()) return;

    const stampedTime = new Date().toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const stampedBy = `${authUser?.name || 'Gate Security'} (${authUser?.role || 'Security'})`;

    const newRecord = createVehicleCheckIn({
      registrationNumber: regNo.toUpperCase().trim(),
      make,
      model,
      variant: variant.trim() || undefined,
      fuelType,
      color,
      fuelLevel,
      mileage,
      isCars24,
      cars24RefNo: isCars24 ? (cars24RefNo.trim() || undefined) : undefined,
      customerName: isCars24 ? 'Cars24 Fleet Partner' : (customerName.trim() || 'Retail Customer'),
      customerPhone: isCars24 ? 'N/A' : (customerPhone.trim() || 'N/A'),
      customerEmail: isCars24 ? undefined : (customerEmail.trim() || undefined),
      cityId: selectedCityId,
      cityName: selectedCityName,
      workshopId: selectedWorkshopId,
      workshopName: selectedWorkshopName,
      checkedInByName: stampedBy,
      checkInDriverName: driverName.trim() || (authUser?.name ? `${authUser.name} (Gate)` : 'Gate Driver'),
      checkInDriverPhone: driverPhone.trim() || 'N/A',
      checkInPhotoWithDriverUrl: photoUrl,
      checkInNotes,
      status: isCars24 ? 'IDLE_AWAITING_PI' : 'AWAITING_JOB_CARD',
      workOrderNo: workOrderNo.trim() || undefined,
      workOrderNotes: workOrderNotes.trim() || undefined,
    });

    setSearchTerm('');
    setActiveFilter('IN_WORKSHOP');
    refreshList();
    setIsCheckInModalOpen(false);
    resetForm();
    setJustCheckedInSuccess(newRecord);
  };

  const resetForm = () => {
    setCheckInStep(1);
    setCheckOutStep(1);
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
    setCustomerName('Cars24 Fleet Partner');
    setCustomerPhone('N/A');
    setCustomerEmail('');
    setDriverName(authUser?.name ? `${authUser.name} (Gate)` : 'Ramesh Kumar (Logistics)');
    setDriverPhone('+91 98200 99887');
    setPhotoUrl(SAMPLE_DRIVER_CAR_PHOTOS[0].url);
    setCheckInNotes('Arrived at gate check-in.');
    setInitialStatus('IDLE_AWAITING_PI');
    setWorkOrderNo('');
    setWorkOrderNotes('');

    // Reset City / Workshop to assigned location
    if (assignedWorkshop) {
      setSelectedWorkshopId(assignedWorkshop.id);
      setSelectedWorkshopName(assignedWorkshop.name);
    }
    if (assignedCity) {
      setSelectedCityId(assignedCity.id);
      setSelectedCityName(assignedCity.name);
    }
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
    const searchLower = searchTerm.toLowerCase().trim();
    const cleanSearch = searchLower.replace(/[^a-z0-9]/g, '');
    const cleanReg = item.registrationNumber.toLowerCase().replace(/[^a-z0-9]/g, '');

    const matchesSearch = !searchLower ||
      item.registrationNumber.toLowerCase().includes(searchLower) ||
      (cleanSearch.length > 0 && cleanReg.includes(cleanSearch)) ||
      item.make.toLowerCase().includes(searchLower) ||
      item.model.toLowerCase().includes(searchLower) ||
      item.checkInDriverName.toLowerCase().includes(searchLower) ||
      item.customerName.toLowerCase().includes(searchLower) ||
      item.id.toLowerCase().includes(searchLower);

    if (!matchesSearch) return false;

    if (activeFilter === 'IN_WORKSHOP') return item.status !== 'CHECKED_OUT';
    if (activeFilter === 'IDLE_PI') return item.status === 'IDLE_AWAITING_PI' || item.status === 'AWAITING_JOB_CARD';
    if (activeFilter === 'ACTIVE_REPAIR') return item.status === 'JOB_CARD_CREATED';
    if (activeFilter === 'READY_DISPATCH') return item.status === 'READY_PENDING_DISPATCH';
    if (activeFilter === 'CHECKED_OUT') return item.status === 'CHECKED_OUT';

    return true;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    if (justCheckedInSuccess && a.id === justCheckedInSuccess.id) return -1;
    if (justCheckedInSuccess && b.id === justCheckedInSuccess.id) return 1;

    const numA = parseInt(a.id.replace(/\D/g, '') || '0', 10);
    const numB = parseInt(b.id.replace(/\D/g, '') || '0', 10);
    return numB - numA;
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
              Awaiting Job Card / PI ({idleAwaitingPiCount})
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
      {sortedItems.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 space-y-3">
          <Car className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
          <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">No Vehicles Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No gate check-in records match your search query or active filter tab.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {sortedItems.map((item, idx) => {
            const isLatest = idx === 0;
            return (
            <div 
              key={item.id}
              className={`bg-white dark:bg-slate-900 rounded-3xl border transition-all shadow-xs hover:shadow-md overflow-hidden flex flex-col justify-between ${
                isLatest
                  ? 'border-2 border-amber-500 dark:border-amber-400 ring-4 ring-amber-500/20 shadow-lg shadow-amber-500/10'
                  : item.status === 'IDLE_AWAITING_PI'
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
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isLatest && (
                          <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider flex items-center gap-1 shadow-md animate-bounce">
                            ✨ LATEST GATE-IN
                          </span>
                        )}
                        <span className="font-mono text-xs font-black bg-slate-900/90 text-white px-2.5 py-1 rounded-xl border border-slate-700">
                          {item.id}
                        </span>
                        {(isSuperAdmin || authUser?.role === 'ADMIN' || authUser?.role === 'FLOOR_MANAGER' || authUser?.userType === 'ADMIN' || authUser?.role === 'SUPER_ADMIN') && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmRemoveItem(item);
                            }}
                            className="p-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border border-rose-500/30 transition-colors cursor-pointer"
                            title="Remove vehicle from check-in list"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

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
                      isManagementRole ? (
                        <button
                          type="button"
                          onClick={() => {
                            onOpenCreateJobCardWithPrefill?.({
                              regNo: item.registrationNumber,
                              make: item.make,
                              model: item.model,
                              variant: item.variant,
                              fuelType: item.fuelType as FuelType,
                              color: item.color,
                              customerName: item.customerName,
                              customerPhone: item.customerPhone,
                              isCars24: item.isCars24,
                              cars24RefNo: item.cars24RefNo,
                              checkInRecordId: item.id,
                              cityId: item.cityId,
                              cityName: item.cityName,
                              workshopId: item.workshopId,
                              workshopName: item.workshopName,
                              driverName: item.checkInDriverName,
                              driverPhone: item.checkInDriverPhone,
                              driverPhotoUrl: item.checkInPhotoWithDriverUrl,
                              workOrderNo: item.workOrderNo,
                              workOrderNotes: item.workOrderNotes,
                            });
                          }}
                          className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-xs transition-all w-full justify-center cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Create Job Card</span>
                        </button>
                      ) : (
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 italic">
                          Job Card Creation Pending (Advisor/Manager)
                        </span>
                      )
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

                    {(() => {
                      const linkedCard = item.jobCardId ? jobCardsList.find(c => c.id === item.jobCardId) : null;
                      const canCheckOut = !linkedCard || linkedCard.status === 'RFC' || linkedCard.status === 'READY_FOR_DELIVERY' || linkedCard.status === 'DELIVERED';

                      if (canCheckOut) {
                        return (
                          <button
                            type="button"
                            onClick={() => {
                              setCheckOutItem(item);
                              setCheckOutStep(1);
                              setExitDriverName(item.checkInDriverName || 'Driver / Customer');
                              setExitDriverPhone(item.checkInDriverPhone || '');
                            }}
                            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-xs transition-all shrink-0 cursor-pointer"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Check-Out</span>
                          </button>
                        );
                      }

                      return (
                        <button
                          type="button"
                          disabled
                          title="Vehicle checkout is permitted ONLY when Job Card status is RFC (Ready For Checkout)"
                          className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 font-bold text-xs flex items-center gap-1 cursor-not-allowed opacity-70 shrink-0"
                        >
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          <span>Checkout (Locked - Requires RFC)</span>
                        </button>
                      );
                    })()}
                  </>
                ) : (
                  <span className="text-slate-400 font-bold text-xs flex items-center gap-1 mx-auto">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Vehicle Departed Workshop
                  </span>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* NEW VEHICLE GATE CHECK-IN MODAL (STEP-BY-STEP WIZARD) */}
      {isCheckInModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-md shadow-amber-500/20">
                  <LogIn className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black">Gate Entry Check-In</h2>
                  <p className="text-[11px] text-slate-400 font-medium">Step {checkInStep} of 3 • Easy Gate Check-In</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCheckInModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step Progress Indicator Bar */}
            <div className="bg-slate-950 px-5 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-1.5">
                <div className={`w-6 h-6 rounded-full text-[11px] font-black flex items-center justify-center transition-all ${checkInStep >= 1 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>1</div>
                <span className={`text-[11px] font-extrabold ${checkInStep === 1 ? 'text-amber-400' : 'text-slate-400'}`}>Registration & Owner</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-700" />
              <div className="flex items-center gap-1.5">
                <div className={`w-6 h-6 rounded-full text-[11px] font-black flex items-center justify-center transition-all ${checkInStep >= 2 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>2</div>
                <span className={`text-[11px] font-extrabold ${checkInStep === 2 ? 'text-amber-400' : 'text-slate-400'}`}>Car Model</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-700" />
              <div className="flex items-center gap-1.5">
                <div className={`w-6 h-6 rounded-full text-[11px] font-black flex items-center justify-center transition-all ${checkInStep >= 3 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>3</div>
                <span className={`text-[11px] font-extrabold ${checkInStep === 3 ? 'text-amber-400' : 'text-slate-400'}`}>Take Photo</span>
              </div>
            </div>

            <form onSubmit={handleCreateCheckIn} className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
              
              {/* STEP 1: Registration Number & Customer/Ownership Type */}
              {checkInStep === 1 && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="font-extrabold text-amber-800 dark:text-amber-300 text-xs block">
                        Step 1: Enter Registration & Customer Type
                      </span>
                      <p className="text-[11px] text-amber-700 dark:text-amber-200/80">
                        Scan license plate or type vehicle registration number below
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsScannerOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1 shadow-sm shrink-0"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Scan Plate</span>
                    </button>
                  </div>

                  <div>
                    <label className="text-slate-700 dark:text-slate-300 font-extrabold block mb-1.5 uppercase text-[10px] tracking-wider">
                      Vehicle Registration Number *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g. MH12AB1234"
                        value={regNo}
                        onChange={(e) => setRegNo(e.target.value.toUpperCase())}
                        required
                        autoFocus
                        className="w-full p-3 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 font-mono font-black text-base uppercase pr-10 focus:border-amber-500 focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => setIsScannerOpen(true)}
                        title="Scan license plate with camera"
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-amber-500 transition-colors"
                      >
                        <Camera className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-700 dark:text-slate-300 font-extrabold block mb-1.5 uppercase text-[10px] tracking-wider">
                      Customer / Ownership Type *
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <label
                        className={`p-3 rounded-2xl border-2 cursor-pointer flex items-center gap-2.5 transition-all ${
                          isCars24
                            ? 'border-amber-500 bg-amber-500/10 dark:bg-amber-500/20'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="customerType"
                          checked={isCars24}
                          onChange={() => {
                            setIsCars24(true);
                            setCustomerName('Cars24 Fleet Partner');
                            setCustomerPhone('N/A');
                            setCustomerEmail('');
                          }}
                          className="text-amber-500 focus:ring-amber-500"
                        />
                        <div>
                          <span className="font-extrabold text-amber-800 dark:text-amber-300 block text-xs">Cars24 Vehicle</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">Hub Fleet Car</span>
                        </div>
                      </label>

                      <label
                        className={`p-3 rounded-2xl border-2 cursor-pointer flex items-center gap-2.5 transition-all ${
                          !isCars24
                            ? 'border-blue-500 bg-blue-500/10 dark:bg-blue-500/20'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="customerType"
                          checked={!isCars24}
                          onChange={() => {
                            setIsCars24(false);
                            setCustomerName('');
                            setCustomerPhone('');
                            setCustomerEmail('');
                          }}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <span className="font-extrabold text-blue-700 dark:text-blue-300 block text-xs">Retail Owner</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">Direct Customer</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {!isCars24 ? (
                    <div className="space-y-3 pt-1 border-t border-slate-200 dark:border-slate-800">
                      <div>
                        <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">Customer Name *</label>
                        <input
                          type="text"
                          placeholder="Customer Full Name"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-bold text-xs"
                        />
                      </div>

                      <div>
                        <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">Customer Phone Number *</label>
                        <input
                          type="text"
                          placeholder="+91 98200 00000"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono font-bold text-xs"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">Cars24 Fleet Partner pre-selected.</span>
                      <input
                        type="text"
                        placeholder="Ref No (Optional)"
                        value={cars24RefNo}
                        onChange={(e) => setCars24RefNo(e.target.value)}
                        className="w-36 p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-[10px] font-bold"
                      />
                    </div>
                  )}

                  <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsCheckInModalOpen(false)}
                      className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!regNo.trim()) {
                          alert('Please enter or scan registration number.');
                          return;
                        }
                        if (!isCars24 && (!customerName.trim() || !customerPhone.trim())) {
                          alert('Please enter customer name and phone number.');
                          return;
                        }
                        setCheckInStep(2);
                      }}
                      className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                    >
                      <span>Next: Vehicle Model</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: Car Make, Model, Color & Workshop Location */}
              {checkInStep === 2 && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700 dark:text-slate-300 font-extrabold uppercase text-[10px] tracking-wider block flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-amber-500" />
                        Workshop & Location Assignment
                      </span>
                    </div>

                    {isSuperAdmin ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-slate-500 font-bold block mb-1 text-[10px]">City</label>
                          <select
                            value={selectedCityId}
                            onChange={(e) => handleCityChange(e.target.value)}
                            className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-bold text-xs"
                          >
                            {citiesList.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-slate-500 font-bold block mb-1 text-[10px]">Workshop</label>
                          <select
                            value={selectedWorkshopId}
                            onChange={(e) => handleWorkshopChange(e.target.value)}
                            className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-bold text-xs"
                          >
                            {activeWorkshopsForSelectedCity.map((w) => (
                              <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <span className="font-extrabold text-slate-900 dark:text-white text-xs">
                          {selectedCityName} • {selectedWorkshopName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold">Assigned Hub</span>
                      </div>
                    )}
                  </div>

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

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">Vehicle Color</label>
                      <input
                        type="text"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        placeholder="e.g. Arctic White"
                        className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-bold text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">Driver Name (Brought Car)</label>
                      <input
                        type="text"
                        placeholder="Driver name"
                        value={driverName}
                        onChange={(e) => setDriverName(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-bold text-xs"
                      />
                    </div>
                  </div>

                  <div className="pt-3 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setCheckInStep(1)}
                      className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!make.trim() || !model.trim()) {
                          alert('Please select vehicle make and model.');
                          return;
                        }
                        setCheckInStep(3);
                      }}
                      className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                    >
                      <span>Next: Take Photo</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Take Photo & Confirm Check-In */}
              {checkInStep === 3 && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-2xl space-y-2">
                    <span className="text-amber-900 dark:text-amber-300 font-extrabold uppercase text-[10px] tracking-wider block flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-amber-500" />
                      Step 3: Vehicle Photo & Entry Pass Confirmation
                    </span>
                    <p className="text-[11px] text-amber-800 dark:text-amber-200/90 font-medium">
                      Capture live photo of vehicle with driver at gate to generate entry pass.
                    </p>
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={checkInCameraInputRef}
                    onChange={(e) => handlePhotoFileUpload(e, false)}
                    className="hidden"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    ref={checkInFileInputRef}
                    onChange={(e) => handlePhotoFileUpload(e, false)}
                    className="hidden"
                  />

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => startCamera('checkIn')}
                      className="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                    >
                      <Camera className="w-4 h-4 stroke-[2.5]" />
                      <span>Take Live Photo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => checkInFileInputRef.current?.click()}
                      className="px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                    >
                      <Upload className="w-4 h-4 stroke-[2.5]" />
                      <span>Upload File</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => checkInCameraInputRef.current?.click()}
                      className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all col-span-2 sm:col-span-1 cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Camera App</span>
                    </button>
                  </div>

                  {/* Photo Preview Card */}
                  <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                    {isCompressingPhoto ? (
                      <div className="text-center py-4 space-y-2">
                        <RefreshCw className="w-6 h-6 text-amber-500 animate-spin mx-auto" />
                        <p className="text-xs font-bold text-amber-600 dark:text-amber-400">Compressing & optimizing photo for instant save...</p>
                      </div>
                    ) : photoUrl ? (
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <img
                            src={photoUrl}
                            alt="Vehicle check-in preview"
                            className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-500 shadow-md"
                            referrerPolicy="no-referrer"
                          />
                          <button
                            type="button"
                            onClick={() => setPhotoUrl('')}
                            title="Remove photo"
                            className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow-md hover:bg-red-500 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex-1 space-y-0.5">
                          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-black">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Photo Attached & Optimized</span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate max-w-xs">
                            {photoUrl.startsWith('data:image') ? 'Compressed Upload Photo (Image)' : photoUrl}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-3 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl space-y-1">
                        <Camera className="w-6 h-6 text-slate-400 mx-auto" />
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No Photo Attached</p>
                      </div>
                    )}
                  </div>

                  {/* Stamped Gate Pass Metadata */}
                  <div className="bg-slate-900 text-white p-3 rounded-2xl border border-slate-800 space-y-1 text-[11px]">
                    <span className="text-amber-400 font-bold block flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      Gate Check-In Stamp Metadata
                    </span>
                    <div className="flex items-center justify-between text-slate-300 font-mono text-[10px] pt-1">
                      <span>Time: {new Date().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      <span>By: {authUser?.name || 'Gate Staff'}</span>
                    </div>
                  </div>

                  <div className="pt-3 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setCheckInStep(2)}
                      className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                    >
                      ← Back
                    </button>
                    <button
                      type="submit"
                      disabled={isCompressingPhoto}
                      className={`px-6 py-2.5 rounded-xl text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg transition-all ${
                        isCompressingPhoto
                          ? 'bg-amber-300 opacity-60 cursor-not-allowed'
                          : 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/20 cursor-pointer'
                      }`}
                    >
                      {isCompressingPhoto ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Processing Photo...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Confirm & Complete Check-In</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* CHECK-OUT / GATE DEPARTURE MODAL (STEP-BY-STEP WIZARD) */}
      {checkOutItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
            
            {/* Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-md shadow-emerald-500/20">
                  <LogOut className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black">Gate Departure Check-Out</h2>
                  <p className="text-[11px] text-slate-400 font-mono font-bold">{checkOutItem.registrationNumber} • {checkOutItem.make} {checkOutItem.model}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCheckOutItem(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step Progress Bar */}
            <div className="bg-slate-950 px-5 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-1.5">
                <div className={`w-6 h-6 rounded-full text-[11px] font-black flex items-center justify-center transition-all ${checkOutStep >= 1 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>1</div>
                <span className={`text-[11px] font-extrabold ${checkOutStep === 1 ? 'text-emerald-400' : 'text-slate-400'}`}>Pickup Driver Info</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-700" />
              <div className="flex items-center gap-1.5">
                <div className={`w-6 h-6 rounded-full text-[11px] font-black flex items-center justify-center transition-all ${checkOutStep >= 2 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>2</div>
                <span className={`text-[11px] font-extrabold ${checkOutStep === 2 ? 'text-emerald-400' : 'text-slate-400'}`}>Departure Photo</span>
              </div>
            </div>

            <form onSubmit={handleConfirmCheckOut} className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
              
              {/* CHECKOUT STEP 1: Pickup Driver Info */}
              {checkOutStep === 1 && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="bg-emerald-500/10 border border-emerald-500/30 p-3.5 rounded-2xl space-y-1 text-emerald-800 dark:text-emerald-300">
                    <span className="font-extrabold flex items-center gap-1 text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Step 1: Enter Pickup Driver Details
                    </span>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      Specify the driver name and phone number picking up vehicle {checkOutItem.registrationNumber}.
                    </p>
                  </div>

                  <div>
                    <label className="text-slate-700 dark:text-slate-300 font-extrabold block mb-1">Pickup Driver / Customer Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Sharma"
                      value={exitDriverName}
                      onChange={(e) => setExitDriverName(e.target.value)}
                      required
                      autoFocus
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 dark:text-slate-300 font-extrabold block mb-1">Pickup Driver Phone Number</label>
                    <input
                      type="text"
                      placeholder="+91 98200 00000"
                      value={exitDriverPhone}
                      onChange={(e) => setExitDriverPhone(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">Departure Notes (Optional)</label>
                    <textarea
                      rows={2}
                      value={exitNotes}
                      onChange={(e) => setExitNotes(e.target.value)}
                      placeholder="e.g. Handed over key & registration card to driver"
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs"
                    />
                  </div>

                  <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setCheckOutItem(null)}
                      className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!exitDriverName.trim()) {
                          alert('Please enter pickup driver name.');
                          return;
                        }
                        setCheckOutStep(2);
                      }}
                      className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                    >
                      <span>Next: Departure Photo</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* CHECKOUT STEP 2: Departure Photo & Submit */}
              {checkOutStep === 2 && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="bg-emerald-500/10 border border-emerald-500/30 p-3.5 rounded-2xl space-y-1">
                    <span className="text-emerald-800 dark:text-emerald-300 font-extrabold text-xs block flex items-center gap-1">
                      <Camera className="w-4 h-4 text-emerald-500" />
                      Step 2: Capture Departure Verification Photo
                    </span>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      Take photo of car exit at gate with pickup driver ({exitDriverName}).
                    </p>
                  </div>

                  {/* Hidden File Inputs for Check Out */}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={checkOutCameraInputRef}
                    onChange={(e) => handlePhotoFileUpload(e, true)}
                    className="hidden"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    ref={checkOutFileInputRef}
                    onChange={(e) => handlePhotoFileUpload(e, true)}
                    className="hidden"
                  />

                  {/* Camera Buttons */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => startCamera('checkOut')}
                      className="px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      <Camera className="w-4 h-4 stroke-[2.5]" />
                      <span>Take Live Photo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => checkOutFileInputRef.current?.click()}
                      className="px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      <Upload className="w-4 h-4 stroke-[2.5]" />
                      <span>Upload File</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => checkOutCameraInputRef.current?.click()}
                      className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all col-span-2 sm:col-span-1 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Camera App</span>
                    </button>
                  </div>

                  {/* Photo Preview Card */}
                  <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                    {exitPhotoUrl ? (
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <img 
                            src={exitPhotoUrl} 
                            alt="Exit photo preview"
                            className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-500 shrink-0 shadow-md"
                            referrerPolicy="no-referrer"
                          />
                          <button
                            type="button"
                            onClick={() => setExitPhotoUrl('')}
                            title="Clear exit photo"
                            className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow-md hover:bg-red-500 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex-1 space-y-0.5">
                          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-black">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Departure Photo Attached</span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate max-w-xs">
                            {exitPhotoUrl.startsWith('data:image') ? 'Captured Photo (Image)' : exitPhotoUrl}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-3 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl space-y-1">
                        <Camera className="w-6 h-6 text-slate-400 mx-auto" />
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No Departure Photo Attached</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setCheckOutStep(1)}
                      className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                    >
                      ← Back
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Confirm Gate Exit & Dispatch</span>
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* LIVE CAMERA CAPTURE MODAL */}
      {isCameraModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-amber-400 animate-pulse" />
                <h3 className="font-black text-sm">
                  {cameraTarget === 'checkIn' ? 'Gate Check-In Photo' : 'Gate Departure Photo'} - Live Camera
                </h3>
              </div>
              <button
                type="button"
                onClick={stopCamera}
                className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-black flex flex-col items-center justify-center relative min-h-[300px]">
              {cameraError ? (
                <div className="text-center p-6 space-y-3">
                  <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
                  <p className="text-xs text-slate-300">{cameraError}</p>
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        stopCamera();
                        if (cameraTarget === 'checkOut') {
                          checkOutCameraInputRef.current?.click();
                        } else {
                          checkInCameraInputRef.current?.click();
                        }
                      }}
                      className="px-4 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
                    >
                      Open Native Camera App
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <video
                    ref={cameraVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full max-h-[360px] object-cover rounded-2xl border border-slate-800"
                  />
                  <div className="mt-4 flex items-center justify-center gap-4">
                    <button
                      type="button"
                      onClick={capturePhotoFromStream}
                      className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex items-center gap-2 shadow-lg shadow-amber-500/30 transition-transform active:scale-95 cursor-pointer"
                    >
                      <Camera className="w-5 h-5" />
                      <span>Capture Vehicle Photo</span>
                    </button>

                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-4 py-3 rounded-2xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-bold text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
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

      {/* CONFIRM REMOVE CHECK-IN MODAL */}
      {confirmRemoveItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-3 bg-rose-100 dark:bg-rose-950/60 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                  Remove Check-In Record?
                </h3>
                <p className="text-xs text-slate-500 font-bold">
                  {confirmRemoveItem.registrationNumber} ({confirmRemoveItem.make} {confirmRemoveItem.model})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to remove check-in record <strong>{confirmRemoveItem.id}</strong> from the gate check-in list? This action will delete the entry.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmRemoveItem(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteVehicleCheckIn(confirmRemoveItem.id);
                  setConfirmRemoveItem(null);
                  setCheckIns(getVehicleCheckIns());
                }}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-md shadow-rose-600/20 cursor-pointer"
              >
                Yes, Remove Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Check-In Complete Confirmation Modal */}
      {justCheckedInSuccess && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-500 flex items-center justify-center mx-auto shadow-xs">
              <Check className="w-8 h-8 stroke-[3]" />
            </div>

            <div className="space-y-1">
              <span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-black px-3 py-1 rounded-full border border-emerald-500/30 uppercase tracking-widest inline-block">
                Gate Pass Check-In Registered
              </span>
              <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
                {justCheckedInSuccess.registrationNumber} Checked In Successfully!
              </h2>
              <p className="text-xs text-slate-500 font-bold">
                {justCheckedInSuccess.make} {justCheckedInSuccess.model} • Driver: {justCheckedInSuccess.checkInDriverName}
              </p>
            </div>

            {justCheckedInSuccess.checkInPhotoWithDriverUrl && (
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 max-h-48">
                <img src={justCheckedInSuccess.checkInPhotoWithDriverUrl} alt="CheckIn" className="w-full h-48 object-cover" />
                <div className="absolute bottom-2 left-2 bg-slate-950/80 text-amber-400 font-mono text-[10px] font-black px-2 py-1 rounded-lg">
                  📷 Check-In Photo Verified
                </div>
              </div>
            )}

            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-left space-y-1">
              <span className="text-amber-800 dark:text-amber-300 font-extrabold text-xs flex items-center gap-1.5">
                <LogIn className="w-4 h-4 text-amber-500" /> Current Status: In Workshop (Awaiting Job Card)
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                This vehicle is now active in the Workshop Gate List and under Job Cards Directory.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              {onOpenCreateJobCardWithPrefill && (
                <button
                  type="button"
                  onClick={() => {
                    const item = justCheckedInSuccess;
                    setJustCheckedInSuccess(null);
                    onOpenCreateJobCardWithPrefill({
                      regNo: item.registrationNumber,
                      make: item.make,
                      model: item.model,
                      variant: item.variant,
                      fuelType: item.fuelType as FuelType,
                      color: item.color,
                      customerName: item.customerName,
                      customerPhone: item.customerPhone,
                      isCars24: !!item.isCars24,
                      cars24RefNo: item.cars24RefNo,
                      checkInRecordId: item.id,
                      driverName: item.checkInDriverName,
                      driverPhone: item.checkInDriverPhone,
                      driverPhotoUrl: item.checkInPhotoWithDriverUrl,
                      workOrderNo: item.workOrderNo,
                      workOrderNotes: item.workOrderNotes,
                    });
                  }}
                  className="w-full py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-lg shadow-blue-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>⚡ Open / Create Job Card Now</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setSearchTerm(justCheckedInSuccess.registrationNumber);
                  setJustCheckedInSuccess(null);
                }}
                className="w-full py-3 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-extrabold text-xs transition-all cursor-pointer"
              >
                <span>View in Gate List</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
