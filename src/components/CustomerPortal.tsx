import React, { useState, useEffect } from 'react';
import { 
  CustomerUser, 
  CustomerVehicleRecord, 
  JobCard, 
  CityServiceOffering, 
  ServiceBookingRequest, 
  IndianCity, 
  INDIAN_CITIES,
  UserRole,
  JobTask,
  FuelType
} from '../types';
import { 
  getCustomerSession, 
  saveCustomerSession, 
  logoutCustomerSession, 
  getCustomerVehicles, 
  addCustomerVehicle, 
  updateCustomerVehicle, 
  deleteCustomerVehicle, 
  getJobCards, 
  respondToCustomerApproval, 
  getCityServices, 
  getServiceBookings, 
  createCustomerBooking,
  updateCityServicePrice,
  subscribeToStore
} from '../lib/storage';
import { 
  Car, 
  Wrench, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Phone, 
  MapPin, 
  Plus, 
  Edit3, 
  Trash2, 
  ShieldCheck, 
  Sparkles, 
  X, 
  ChevronRight, 
  LogIn, 
  LogOut, 
  User, 
  Printer, 
  DollarSign, 
  Search, 
  Truck,
  Shield,
  Calendar,
  Fuel,
  Info,
  Check,
  Building,
  Key
} from 'lucide-react';

import { GSTInvoiceView } from './GSTInvoiceView';
import { FuelTypeBadge } from './FuelTypeBadge';
import { CarModelSelector } from './CarModelSelector';

interface CustomerPortalProps {
  currentRole: UserRole;
  onOpenApprovalModal?: (cardId: string) => void;
}

export function CustomerPortal({ currentRole, onOpenApprovalModal }: CustomerPortalProps) {
  // Session & Garage State
  const [customerSession, setCustomerSession] = useState<CustomerUser>(() => getCustomerSession());
  const [vehicles, setVehicles] = useState<CustomerVehicleRecord[]>(() => getCustomerVehicles(customerSession.phone));
  
  // Data lists
  const [jobCards, setJobCards] = useState<JobCard[]>(() => getJobCards());
  const [cityServices, setCityServices] = useState<CityServiceOffering[]>(() => getCityServices());
  const [bookings, setBookings] = useState<ServiceBookingRequest[]>(() => getServiceBookings());

  // Active Main Navigation Tab
  // 'OFFERINGS_RATES' | 'GARAGE' | 'JOB_CARDS' | 'APPROVALS' | 'SERVICES'
  const [activeTab, setActiveTab] = useState<'OFFERINGS_RATES' | 'GARAGE' | 'JOB_CARDS' | 'APPROVALS' | 'SERVICES'>('OFFERINGS_RATES');

  // Live Tracking Search & Offering Filters
  const [trackerSearchQuery, setTrackerSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [showRateComparisonTable, setShowRateComparisonTable] = useState(false);

  // Selected City for Service Catalog
  const [selectedCity, setSelectedCity] = useState<IndianCity>('Mumbai');

  // Login Flow State
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginPhone, setLoginPhone] = useState('8819915656');
  const [loginOtp, setLoginOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loginName, setLoginName] = useState('Vikramaditya Singh');
  const [loginEmail, setLoginEmail] = useState('vikram.singh@example.com');

  // Vehicle Modals State
  const [isAddVehicleModalOpen, setIsAddVehicleModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<CustomerVehicleRecord | null>(null);
  
  // Vehicle Form State
  const [vehReg, setVehReg] = useState('');
  const [vehMake, setVehMake] = useState('Honda');
  const [vehModel, setVehModel] = useState('City');
  const [vehVariant, setVehVariant] = useState('ZX');
  const [vehYear, setVehYear] = useState<number>(2022);
  const [vehColor, setVehColor] = useState('Pearl White');
  const [vehFuel, setVehFuel] = useState<FuelType>('Petrol');
  const [vehMileage, setVehMileage] = useState<number>(35000);
  const [vehVin, setVehVin] = useState('');
  const [vehNotes, setVehNotes] = useState('');

  // Service Booking Modal State
  const [bookingService, setBookingService] = useState<CityServiceOffering | null>(null);
  const [bookingVehicleReg, setBookingVehicleReg] = useState('');
  const [bookingMakeModel, setBookingMakeModel] = useState('');
  const [prefDate, setPrefDate] = useState(() => new Date(Date.now() + 86400000).toISOString().split('T')[0]);
  const [prefSlot, setPrefSlot] = useState('10:00 AM - 12:00 PM');
  const [pickupAddress, setPickupAddress] = useState(customerSession.address || 'Andheri East, Mumbai');
  const [pickupNeeded, setPickupNeeded] = useState(true);
  const [bookingNotes, setBookingNotes] = useState('');
  const [confirmedBooking, setConfirmedBooking] = useState<{ booking: ServiceBookingRequest; jobCard: JobCard } | null>(null);

  // Invoice Modal State
  const [invoiceJobCard, setInvoiceJobCard] = useState<JobCard | null>(null);

  // Decline Reason Modal
  const [declineTarget, setDeclineTarget] = useState<{ cardId: string; taskId: string; taskTitle: string } | null>(null);
  const [declineReasonText, setDeclineReasonText] = useState('');

  // Admin Price Editing State
  const [editingService, setEditingService] = useState<CityServiceOffering | null>(null);
  const [newPriceInput, setNewPriceInput] = useState<number>(0);

  const isAdmin = currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN';

  // Refresh data from storage
  const refreshData = () => {
    const session = getCustomerSession();
    setCustomerSession(session);
    setVehicles(getCustomerVehicles(session.phone));
    setJobCards(getJobCards());
    setCityServices(getCityServices());
    setBookings(getServiceBookings());
  };

  useEffect(() => {
    const unsubscribe = subscribeToStore(() => {
      refreshData();
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const handleGlobalScanCustomer = (e: any) => {
      const scannedReg = e.detail;
      setTrackerSearchQuery(scannedReg);
      setActiveTab('JOB_CARDS');
    };
    window.addEventListener('GLOBAL_SCAN_CUSTOMER', handleGlobalScanCustomer);
    return () => window.removeEventListener('GLOBAL_SCAN_CUSTOMER', handleGlobalScanCustomer);
  }, []);

  // Sync login phone changes to vehicles
  useEffect(() => {
    setVehicles(getCustomerVehicles(customerSession.phone));
  }, [customerSession.phone]);

  // Handle Customer Login
  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginPhone.trim()) return;
    setOtpSent(true);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    const newUser: CustomerUser = {
      id: `cust-${Date.now()}`,
      name: loginName.trim() || 'Valued Customer',
      phone: loginPhone.trim(),
      email: loginEmail.trim() || `${loginPhone}@customer.fixocar.in`,
      address: customerSession.address || 'Mumbai Central',
      city: selectedCity,
      isLoggedIn: true,
      loggedInAt: new Date().toISOString()
    };
    saveCustomerSession(newUser);
    setIsLoginModalOpen(false);
    setOtpSent(false);
    setLoginOtp('');
    refreshData();
  };

  const handleDemoLogin = () => {
    const demoUser: CustomerUser = {
      id: 'cust-demo-8819915656',
      name: 'Vikramaditya Singh',
      phone: '8819915656',
      email: 'vikram.singh@example.com',
      address: 'B-402, Seawoods Grand Central, Nerul, Navi Mumbai',
      city: 'Mumbai',
      isLoggedIn: true,
      loggedInAt: new Date().toISOString()
    };
    saveCustomerSession(demoUser);
    setIsLoginModalOpen(false);
    setOtpSent(false);
    refreshData();
  };

  const handleLogout = () => {
    logoutCustomerSession();
    refreshData();
  };

  // Handle Vehicle Creation / Update / Deletion
  const handleOpenAddVehicle = () => {
    setVehReg('');
    setVehMake('Honda');
    setVehModel('City');
    setVehVariant('ZX');
    setVehYear(2022);
    setVehColor('Pearl White');
    setVehFuel('Petrol');
    setVehMileage(30000);
    setVehVin('');
    setVehNotes('');
    setEditingVehicle(null);
    setIsAddVehicleModalOpen(true);
  };

  const handleOpenEditVehicle = (v: CustomerVehicleRecord) => {
    setEditingVehicle(v);
    setVehReg(v.registrationNumber);
    setVehMake(v.make);
    setVehModel(v.model);
    setVehVariant(v.variant || '');
    setVehYear(v.year);
    setVehColor(v.color);
    setVehFuel(v.fuelType);
    setVehMileage(v.mileage);
    setVehVin(v.vin || '');
    setVehNotes(v.notes || '');
    setIsAddVehicleModalOpen(true);
  };

  const handleSaveVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehReg.trim() || !vehMake.trim() || !vehModel.trim()) {
      alert('Please enter Registration Number, Make, and Model.');
      return;
    }

    const regUpper = vehReg.trim().toUpperCase();

    if (editingVehicle) {
      updateCustomerVehicle(editingVehicle.id, {
        registrationNumber: regUpper,
        make: vehMake.trim(),
        model: vehModel.trim(),
        variant: vehVariant.trim() || undefined,
        year: Number(vehYear) || 2022,
        color: vehColor.trim() || 'White',
        fuelType: vehFuel,
        mileage: Number(vehMileage) || 0,
        vin: vehVin.trim().toUpperCase(),
        notes: vehNotes.trim()
      });
    } else {
      addCustomerVehicle({
        customerPhone: customerSession.phone || '8819915656',
        registrationNumber: regUpper,
        make: vehMake.trim(),
        model: vehModel.trim(),
        variant: vehVariant.trim() || undefined,
        year: Number(vehYear) || 2022,
        color: vehColor.trim() || 'White',
        fuelType: vehFuel,
        mileage: Number(vehMileage) || 0,
        vin: vehVin.trim().toUpperCase(),
        notes: vehNotes.trim()
      });
    }

    setIsAddVehicleModalOpen(false);
    refreshData();
  };

  const handleDeleteVehicle = (id: string, reg: string) => {
    if (confirm(`Are you sure you want to remove vehicle ${reg} from your garage?`)) {
      deleteCustomerVehicle(id);
      refreshData();
    }
  };

  // Handle Booking trigger from Garage or Service catalog
  const handleStartBookingForVehicle = (v: CustomerVehicleRecord) => {
    setBookingVehicleReg(v.registrationNumber);
    setBookingMakeModel(`${v.make} ${v.model}`);
    setActiveTab('SERVICES');
  };

  const handleConfirmServiceBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingService) return;
    if (!bookingVehicleReg.trim()) {
      alert('Please select or enter a vehicle registration number.');
      return;
    }

    const price = bookingService.cityPrices[selectedCity] || 3999;

    const result = createCustomerBooking({
      city: selectedCity,
      serviceId: bookingService.id,
      serviceTitle: bookingService.title,
      price: price,
      customerName: customerSession.name || 'Valued Customer',
      customerPhone: customerSession.phone || '8819915656',
      customerEmail: customerSession.email || 'customer@example.com',
      vehicleNumber: bookingVehicleReg.toUpperCase(),
      vehicleMakeModel: bookingMakeModel || 'Customer Car',
      preferredDate: prefDate,
      preferredTimeSlot: prefSlot,
      address: pickupAddress || 'Mumbai Central',
      pickupNeeded: pickupNeeded,
      notes: bookingNotes
    });

    setConfirmedBooking(result);
    setBookingService(null);
    refreshData();
  };

  // Handle Approval / Decline Responses
  const handleApproveTask = (jobCardId: string, taskId: string) => {
    respondToCustomerApproval(jobCardId, taskId, true);
    refreshData();
  };

  const handleDeclineTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!declineTarget) return;
    respondToCustomerApproval(declineTarget.cardId, declineTarget.taskId, false, declineReasonText.trim() || 'Customer declined via portal');
    setDeclineTarget(null);
    setDeclineReasonText('');
    refreshData();
  };

  // Admin Price Save
  const handleSavePriceEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;
    updateCityServicePrice(editingService.id, selectedCity, Number(newPriceInput));
    setEditingService(null);
    refreshData();
  };

  // Filter Job Cards related to this customer (by phone or by saved vehicle reg numbers)
  const customerVehRegs = vehicles.map(v => v.registrationNumber.toUpperCase());
  const customerPhoneQuery = customerSession.phone.replace(/\D/g, '');

  const relevantJobCards = jobCards.filter(card => {
    const cardPhone = card.customer?.phone?.replace(/\D/g, '') || '';
    const cardReg = card.vehicle?.registrationNumber?.toUpperCase() || '';
    return (
      (customerPhoneQuery && cardPhone.includes(customerPhoneQuery)) ||
      customerVehRegs.includes(cardReg) ||
      card.customer?.name?.toLowerCase().includes(customerSession.name.toLowerCase())
    );
  });

  // Calculate pending approvals across customer job cards
  const allPendingApprovals: { card: JobCard; task: JobTask }[] = [];
  relevantJobCards.forEach(card => {
    card.tasks.forEach(task => {
      if (task.requiresCustomerApproval && task.isCustomerApproved === null) {
        allPendingApprovals.push({ card, task });
      }
    });
  });

  return (
    <div className="space-y-6 pb-12">
      
      {/* Top Banner: Customer Profile & Authentication Bar */}
      <div className="bg-gradient-to-r from-slate-950 via-blue-950 to-slate-950 text-white rounded-3xl p-6 border border-blue-900/40 shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-blue-600/30 shrink-0">
              {customerSession.isLoggedIn ? (
                <span>{customerSession.name.charAt(0).toUpperCase()}</span>
              ) : (
                <User className="w-7 h-7" />
              )}
            </div>

            <div>
              {customerSession.isLoggedIn ? (
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-extrabold text-white tracking-tight">
                      {customerSession.name}
                    </h1>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black border border-emerald-500/30">
                      ✓ Logged In
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-mono mt-0.5 flex items-center gap-3">
                    <span>📱 +91 {customerSession.phone}</span>
                    <span>✉️ {customerSession.email}</span>
                  </p>
                </div>
              ) : (
                <div>
                  <h1 className="text-xl font-extrabold text-white tracking-tight">
                    Guest Customer
                  </h1>
                  <p className="text-xs text-slate-300">
                    Log in with your phone number to manage garage vehicles, track job cards, and approve repair estimates.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Login / Account Actions */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            {customerSession.isLoggedIn ? (
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold transition-all border border-slate-800 flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                Logout / Switch
              </button>
            ) : (
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs transition-all shadow-lg shadow-blue-600/30 flex items-center gap-1.5"
              >
                <LogIn className="w-4 h-4" />
                Customer Login / Register
              </button>
            )}

            <a
              href="tel:8819915656"
              className="px-4 py-2 rounded-xl bg-blue-500/20 text-blue-300 hover:bg-blue-600 hover:text-white text-xs font-bold transition-all border border-blue-500/30 flex items-center gap-1.5"
            >
              <Phone className="w-3.5 h-3.5 fill-current" />
              <span>Helpline: 8819915656</span>
            </a>
          </div>

        </div>

        {/* Navigation Tabs Bar inside Customer Portal */}
        <div className="relative z-10 flex items-center gap-2 mt-6 pt-5 border-t border-slate-800/80 overflow-x-auto">
          <button
            onClick={() => setActiveTab('OFFERINGS_RATES')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'OFFERINGS_RATES'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-black'
                : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4 text-blue-400" />
            Business Offerings & Rates
          </button>

          <button
            onClick={() => setActiveTab('GARAGE')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'GARAGE'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-black'
                : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
            }`}
          >
            <Car className="w-4 h-4" />
            My Garage ({vehicles.length})
          </button>

          <button
            onClick={() => setActiveTab('JOB_CARDS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'JOB_CARDS'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-black'
                : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            Job Cards & Live Tracking ({relevantJobCards.length})
          </button>

          <button
            onClick={() => setActiveTab('APPROVALS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap relative ${
              activeTab === 'APPROVALS'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-black'
                : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
            }`}
          >
            <AlertCircle className="w-4 h-4 text-blue-400" />
            Pending Approvals
            {allPendingApprovals.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white font-mono text-[10px] font-black animate-pulse">
                {allPendingApprovals.length}
              </span>
            )}
          </button>
        </div>

        {/* Ambient Glow */}
        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-blue-600/20 blur-3xl pointer-events-none" />
      </div>

      {/* PENDING APPROVAL ALERT BANNER IF ANY */}
      {allPendingApprovals.length > 0 && activeTab !== 'APPROVALS' && (
        <div className="p-4 rounded-2xl bg-blue-950/60 border-2 border-blue-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-blue-100 text-xs shadow-lg shadow-blue-500/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600 text-white font-bold shrink-0 shadow-md">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="font-extrabold text-sm text-white">
                {allPendingApprovals.length} Repair Item{allPendingApprovals.length > 1 ? 's' : ''} Require Your Decision!
              </p>
              <p className="text-[11px] text-blue-200">
                Our workshop floor team found extra inspection items requiring your approval to continue work.
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('APPROVALS')}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs transition-colors self-end sm:self-auto shrink-0 shadow-md shadow-blue-600/20"
          >
            Review & Approve Now →
          </button>
        </div>
      )}

      {/* TAB 0: HOME - BUSINESS OFFERINGS & RATES (DEFAULT TAB) */}
      {activeTab === 'OFFERINGS_RATES' && (
        <div className="space-y-8">
          
          {/* Main Hero Banner: Business Offering & Value Proposition */}
          <div className="bg-slate-950 text-white rounded-3xl p-6 sm:p-8 border border-blue-900/50 shadow-2xl relative overflow-hidden space-y-6">
            <div className="relative z-10 max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-[11px] font-black uppercase tracking-wider border border-blue-500/30">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>India's Premier Tech-Enabled Multi-City Car Workshop Network</span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                Worry-Free Car Servicing, Upfront City Rates & 100% Genuine OEM Spares
              </h1>

              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                FixoCar brings multi-city standardized car repair, transparent flat rates, and digital job card tracking. Enjoy doorstep pickup & drop, live video inspection updates from workshop floor managers, and a 6-month/10,000 KM warranty on every repair.
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => {
                    const el = document.getElementById('offerings-catalog-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs transition-all shadow-lg shadow-blue-600/30 flex items-center gap-2"
                >
                  <Wrench className="w-4 h-4" />
                  <span>Explore City Rates & Book</span>
                </button>

                <button
                  onClick={() => setShowRateComparisonTable(!showRateComparisonTable)}
                  className="px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold text-xs transition-all border border-slate-800 flex items-center gap-2"
                >
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span>{showRateComparisonTable ? 'Hide Rate Matrix' : 'Compare Rates Across 10 Cities'}</span>
                </button>

                <a
                  href="tel:8819915656"
                  className="px-4 py-3 rounded-2xl bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 font-extrabold text-xs transition-all border border-blue-500/30 flex items-center gap-2"
                >
                  <Phone className="w-4 h-4 text-blue-400 fill-current" />
                  <span>24x7 Helpline: 8819915656</span>
                </a>
              </div>
            </div>

            {/* Key Guarantee Badges Grid */}
            <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-slate-800/80">
              <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800/80 flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-blue-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Protection</span>
                  <span className="text-xs font-black text-white">6-Mo / 10k KM Warranty</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800/80 flex items-center gap-3">
                <Truck className="w-6 h-6 text-blue-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Doorstep</span>
                  <span className="text-xs font-black text-white">Free Pick-up & Drop</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800/80 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-blue-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Parts</span>
                  <span className="text-xs font-black text-white">100% Genuine OEM</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800/80 flex items-center gap-3">
                <FileText className="w-6 h-6 text-blue-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Transparency</span>
                  <span className="text-xs font-black text-white">Live Video Job Cards</span>
                </div>
              </div>
            </div>

            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
          </div>

          {/* Quick Live Job Card / Vehicle Repair Tracker Search Bar */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Search className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Track Your Car Repair Status Live
                </h3>
                <p className="text-xs text-slate-500">
                  Enter your Vehicle Registration Number or Job Card ID to check live floor status & mechanic inspection updates.
                </p>
              </div>

              <div className="text-xs text-slate-400 font-mono">
                Try: <button onClick={() => setTrackerSearchQuery('MH-02-DN-4521')} className="text-blue-600 dark:text-blue-400 font-bold underline mr-2">MH-02-DN-4521</button>
                or <button onClick={() => setTrackerSearchQuery('JC-2026-104')} className="text-blue-600 dark:text-blue-400 font-bold underline">JC-2026-104</button>
              </div>
            </div>

            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={trackerSearchQuery}
                onChange={(e) => setTrackerSearchQuery(e.target.value)}
                placeholder="Type Vehicle Registration No. (e.g. MH-02-DN-4521) or Job Card ID..."
                className="w-full pl-12 pr-10 py-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-bold text-xs focus:ring-2 focus:ring-blue-500 outline-none"
              />
              {trackerSearchQuery && (
                <button
                  onClick={() => setTrackerSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Tracker Search Results Display */}
            {trackerSearchQuery.trim() && (() => {
              const query = trackerSearchQuery.trim().toLowerCase();
              const matchedTrackerCards = jobCards.filter(c => 
                c.id.toLowerCase().includes(query) || 
                c.vehicle.registrationNumber.toLowerCase().includes(query) || 
                c.customer.phone.includes(query) || 
                c.customer.name.toLowerCase().includes(query)
              );

              return (
                <div className="pt-2 space-y-3">
                  {matchedTrackerCards.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                      <Info className="w-4 h-4 shrink-0" />
                      <span>No active job card found for "<strong>{trackerSearchQuery}</strong>". Please verify your registration number or contact helpline 8819915656.</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Found {matchedTrackerCards.length} matching active job card(s):
                      </span>

                      {matchedTrackerCards.map(card => {
                        const pendingApprovalTasks = card.tasks.filter(t => t.requiresCustomerApproval && t.isCustomerApproved === null);

                        return (
                          <div
                            key={card.id}
                            className="p-4 rounded-2xl bg-slate-900 text-white border border-blue-500/40 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30">
                                  {card.id}
                                </span>
                                <span className="font-extrabold text-sm">{card.vehicle.make} {card.vehicle.model}</span>
                                <span className="text-xs text-slate-400 font-mono">({card.vehicle.registrationNumber})</span>
                              </div>
                              <p className="text-xs text-slate-300">
                                Customer: <strong>{card.customer.name}</strong> • Service: {card.serviceType}
                              </p>
                            </div>

                            <div className="flex items-center gap-3 w-full md:w-auto">
                              {pendingApprovalTasks.length > 0 && (
                                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/20 px-2.5 py-1 rounded-full border border-amber-500/30 animate-pulse">
                                  ⚠️ {pendingApprovalTasks.length} Approval Pending
                                </span>
                              )}
                              <button
                                onClick={() => setActiveTab('JOB_CARDS')}
                                className="grow md:grow-0 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                              >
                                View Live Tracker <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Business Offerings & Rates Section Header with City Selector */}
          <div id="offerings-catalog-section" className="space-y-4 pt-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div>
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest font-mono block">
                  Official Transparent Pricing Catalog
                </span>
                <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
                  Business Offerings & City Rate Cards
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Standardized flat rates across India. Select your operational city to view exact package prices.
                </p>
              </div>

              {/* City Selector Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> City:
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                  {INDIAN_CITIES.map((city) => (
                    <button
                      key={city}
                      onClick={() => setSelectedCity(city)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        selectedCity === city
                          ? 'bg-blue-600 text-white font-black shadow-md shadow-blue-600/30'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {city}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {[
                { id: 'ALL', label: 'All Business Offerings' },
                { id: 'PERIODIC', label: '🛢️ Periodic Maintenance' },
                { id: 'AC', label: '❄️ AC Repair & Cooling' },
                { id: 'BRAKES', label: '🛑 Brakes & Suspension' },
                { id: 'PAINT', label: '🎨 Denting & Painting' },
                { id: 'DETAILING', label: '✨ Detailing & Spa' },
                { id: 'MECHANICAL', label: '🔧 Clutch & Overhaul' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${
                    categoryFilter === cat.id
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-extrabold shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Offering Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cityServices
                .filter((srv) => {
                  if (categoryFilter === 'ALL') return true;
                  if (categoryFilter === 'PERIODIC') return srv.id.includes('periodic') || srv.title.toLowerCase().includes('periodic');
                  if (categoryFilter === 'AC') return srv.id.includes('ac') || srv.title.toLowerCase().includes('ac');
                  if (categoryFilter === 'BRAKES') return srv.id.includes('brake') || srv.title.toLowerCase().includes('brake');
                  if (categoryFilter === 'PAINT') return srv.id.includes('dent') || srv.category === 'PAINT' || srv.title.toLowerCase().includes('paint');
                  if (categoryFilter === 'DETAILING') return srv.id.includes('interior') || srv.category === 'WASHING' || srv.title.toLowerCase().includes('detailing');
                  if (categoryFilter === 'MECHANICAL') return srv.id.includes('clutch') || srv.category === 'MECHANICAL';
                  return true;
                })
                .map((service) => {
                  const price = service.cityPrices[selectedCity] || 3999;

                  return (
                    <div
                      key={service.id}
                      className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between space-y-4 hover:border-blue-500 transition-all group"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest font-mono">
                            {service.category}
                          </span>
                          {service.isPopular && (
                            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-black border border-blue-500/20">
                              ⚡ MOST POPULAR
                            </span>
                          )}
                        </div>

                        <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {service.title}
                        </h3>

                        <p className="text-xs text-slate-500 line-clamp-2">{service.tagline}</p>

                        <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">{selectedCity} Flat Rate</span>
                            <span className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">
                              ₹{price.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 block flex items-center gap-1 justify-end">
                              <Clock className="w-3.5 h-3.5" /> {service.estimatedHours} Hours
                            </span>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block mt-0.5">
                              ✓ Free Pickup & Drop
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2 pt-1">
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">What's Included:</span>
                          <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                            {service.includedFeatures.map((feat, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                <span className="leading-tight">{feat}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <button
                          onClick={() => {
                            setBookingService(service);
                            if (vehicles.length > 0) {
                              setBookingVehicleReg(vehicles[0].registrationNumber);
                              setBookingMakeModel(`${vehicles[0].make} ${vehicles[0].model}`);
                            }
                          }}
                          className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-1.5"
                        >
                          <Wrench className="w-4 h-4" />
                          <span>Book for {selectedCity} (₹{price.toLocaleString('en-IN')})</span>
                        </button>

                        <button
                          onClick={() => setShowRateComparisonTable(true)}
                          className="w-full py-1.5 text-center text-[11px] font-bold text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          View Rates in Other Cities →
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Multi-City Rate Comparison Matrix Section */}
          {showRateComparisonTable && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-500" />
                    Multi-City Transparent Price Matrix
                  </h3>
                  <p className="text-xs text-slate-500">
                    Compare official fixed rates for all business offerings across major Indian metropolitan cities.
                  </p>
                </div>

                <button
                  onClick={() => setShowRateComparisonTable(false)}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300">
                      <th className="p-3 font-extrabold">Service Offering</th>
                      <th className="p-3 font-extrabold">Est. Time</th>
                      {INDIAN_CITIES.map((c) => (
                        <th key={c} className={`p-3 font-extrabold text-center font-mono ${selectedCity === c ? 'bg-blue-600 text-white' : ''}`}>
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {cityServices.map((srv) => (
                      <tr key={srv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                          {srv.title}
                          <span className="block text-[10px] text-slate-400 font-normal">{srv.category}</span>
                        </td>
                        <td className="p-3 text-slate-500 font-mono">{srv.estimatedHours}h</td>
                        {INDIAN_CITIES.map((c) => {
                          const p = srv.cityPrices[c] || 3999;
                          return (
                            <td key={c} className={`p-3 text-center font-mono font-bold ${selectedCity === c ? 'bg-blue-50/50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                              ₹{p.toLocaleString('en-IN')}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Business Offering Value Pillars & Quality Guarantee Grid */}
          <div className="space-y-4">
            <div className="text-center max-w-xl mx-auto space-y-1">
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest font-mono">
                Why Car Owners Trust FixoCar
              </span>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                The FixoCar Business Offering Standard
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 text-white rounded-3xl p-5 border border-slate-800 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black">
                  1
                </div>
                <h3 className="font-extrabold text-sm text-white">Upfront Flat Pricing</h3>
                <p className="text-xs text-slate-300">
                  No surprise bills or inflated labor costs. Get pre-approved estimates before a single wrench touches your car.
                </p>
              </div>

              <div className="bg-slate-900 text-white rounded-3xl p-5 border border-slate-800 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black">
                  2
                </div>
                <h3 className="font-extrabold text-sm text-white">100% Genuine OEM Spares</h3>
                <p className="text-xs text-slate-300">
                  Directly sourced replacement parts with transparent part numbers and manufacturer barcodes uploaded to your job card.
                </p>
              </div>

              <div className="bg-slate-900 text-white rounded-3xl p-5 border border-slate-800 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black">
                  3
                </div>
                <h3 className="font-extrabold text-sm text-white">Live Video Job Cards</h3>
                <p className="text-xs text-slate-300">
                  Floor managers stream HD photos and videos of worn parts so you can approve or decline additional items with 1 click.
                </p>
              </div>

              <div className="bg-slate-900 text-white rounded-3xl p-5 border border-slate-800 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black">
                  4
                </div>
                <h3 className="font-extrabold text-sm text-white">6-Mo Warranty Protection</h3>
                <p className="text-xs text-slate-300">
                  Comprehensive 6-month / 10,000 km warranty covering both parts and labor across all FixoCar workshop hubs in India.
                </p>
              </div>
            </div>
          </div>

          {/* How FixoCar Works - 4 Step Process */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                  How FixoCar Works in 4 Simple Steps
                </h3>
                <p className="text-xs text-slate-500">
                  From online booking to doorstep delivery — hassle-free repair workflow.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2">
                <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400 block uppercase">Step 1</span>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">Select City & Book Package</h4>
                <p className="text-[11px] text-slate-500">Choose your city, vehicle, and desired service package with instant price confirmation.</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2">
                <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400 block uppercase">Step 2</span>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">Free Doorstep Pickup</h4>
                <p className="text-[11px] text-slate-500">A trained valet collects your vehicle at your preferred time slot and drives it to our hub.</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2">
                <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400 block uppercase">Step 3</span>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">Digital Job Card Approval</h4>
                <p className="text-[11px] text-slate-500">Track progress live. Approve or reject any additional inspection findings directly on your phone.</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2">
                <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400 block uppercase">Step 4</span>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">Doorstep Drop & Warranty</h4>
                <p className="text-[11px] text-slate-500">After multi-point QC inspection, your sanitized car is delivered back with a 6-month warranty.</p>
              </div>
            </div>
          </div>

          {/* Verified Customer Reviews Banner */}
          <div className="bg-slate-950 text-white rounded-3xl p-6 sm:p-8 border border-blue-900/40 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest font-mono block">
                  Verified Ratings & Customer Feedback
                </span>
                <h3 className="text-xl font-black text-white mt-0.5">
                  ⭐ 4.9 / 5 Rating Across 50,000+ Completed Servicing Jobs
                </h3>
              </div>
              <div className="text-xs text-blue-300 font-bold bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/20">
                100% Verified Reviews
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between text-amber-400">
                  <span>★★★★★</span>
                  <span className="text-[10px] text-slate-400 font-mono">Mumbai • Honda City</span>
                </div>
                <p className="text-slate-300 italic">
                  "FixoCar saved me over ₹12,000 compared to the authorized dealer. The live video job card showed exact brake pad wear."
                </p>
                <span className="text-white font-extrabold block text-[11px]">— Vikramaditya S., Bandra</span>
              </div>

              <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between text-amber-400">
                  <span>★★★★★</span>
                  <span className="text-[10px] text-slate-400 font-mono">Delhi NCR • Creta</span>
                </div>
                <p className="text-slate-300 italic">
                  "AC chilling package was done in 2 hours. Free doorstep pick and drop made it super effortless during work hours."
                </p>
                <span className="text-white font-extrabold block text-[11px]">— Ananya Gupta, Gurugram</span>
              </div>

              <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between text-amber-400">
                  <span>★★★★★</span>
                  <span className="text-[10px] text-slate-400 font-mono">Bengaluru • Swift</span>
                </div>
                <p className="text-slate-300 italic">
                  "Transparent rates in Whitefield. Got 6 months warranty document printed along with invoice."
                </p>
                <span className="text-white font-extrabold block text-[11px]">— Rajesh Nair, Indiranagar</span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* TAB 1: MY VEHICLE GARAGE */}
      {activeTab === 'GARAGE' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Car className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                Customer Vehicle Garage
              </h2>
              <p className="text-xs text-slate-500">
                Manage your registered cars, view mileage specs, and instantly trigger workshop service bookings.
              </p>
            </div>

            <button
              onClick={handleOpenAddVehicle}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-md flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Vehicle</span>
            </button>
          </div>

          {vehicles.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
              <Car className="w-12 h-12 text-slate-400 mx-auto" />
              <h3 className="font-bold text-slate-800 dark:text-slate-200 text-base">Your Garage is Empty</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Add your car registration number and model to keep track of repairs, maintenance history, and digital invoices.
              </p>
              <button
                onClick={handleOpenAddVehicle}
                className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-md"
              >
                + Register First Car
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {vehicles.map((v) => {
                const activeJobCard = relevantJobCards.find(jc => 
                  jc.vehicle.registrationNumber.toUpperCase() === v.registrationNumber.toUpperCase() &&
                  jc.status !== 'CLOSED' && jc.status !== 'DELIVERED'
                );

                return (
                  <div
                    key={v.id}
                    className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 transition-all p-6 shadow-xs flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-mono text-sm font-black text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 inline-block">
                              {v.registrationNumber}
                            </span>
                            <FuelTypeBadge fuelType={v.fuelType} size="sm" />
                          </div>
                          <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 leading-snug flex items-center gap-2 flex-wrap">
                            <span>{v.make} {v.model}</span>
                            {v.variant && (
                              <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700">
                                {v.variant}
                              </span>
                            )}
                          </h3>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEditVehicle(v)}
                            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-colors"
                            title="Edit Vehicle"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteVehicle(v.id, v.registrationNumber)}
                            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600 transition-colors"
                            title="Remove Vehicle"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Fuel & Year</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                            <Fuel className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            {v.fuelType} • {v.year}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Odometer</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 font-mono mt-0.5 block">
                            {v.mileage.toLocaleString()} km
                          </span>
                        </div>
                      </div>

                      {v.color && (
                        <div className="text-xs text-slate-500 flex items-center gap-2">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Color:</span> {v.color}
                          {v.vin && <span className="font-mono text-[10px] text-slate-400">| VIN: {v.vin}</span>}
                        </div>
                      )}

                      {activeJobCard && (
                        <div className="p-3 rounded-2xl bg-blue-950/40 border border-blue-500/40 text-blue-300 text-xs flex items-center justify-between">
                          <span className="font-bold flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-blue-400" />
                            Active Repair: {activeJobCard.id}
                          </span>
                          <span className="font-mono text-[10px] font-black px-2 py-0.5 rounded bg-blue-600 text-white">
                            {activeJobCard.status}
                          </span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleStartBookingForVehicle(v)}
                      className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-1.5"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Book Service for {v.registrationNumber}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: JOB CARDS & WORK HISTORY */}
      {activeTab === 'JOB_CARDS' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              Job Cards & Work Done History
            </h2>
            <p className="text-xs text-slate-500">
              Real-time repair progress, task inspection breakdowns, assigned mechanics, and tax invoices.
            </p>
          </div>

          {relevantJobCards.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-2">
              <FileText className="w-12 h-12 text-slate-400 mx-auto" />
              <h3 className="font-bold text-slate-800 dark:text-slate-200">No Job Cards Found</h3>
              <p className="text-xs text-slate-500">
                Job cards generated for your vehicles will appear here with full line-item details and invoices.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {relevantJobCards.map((card) => {
                const totalCustomerPrice = card.tasks.reduce((sum, t) => sum + (t.isCustomerApproved !== false ? t.customerPrice : 0), 0);
                const pendingApprovals = card.tasks.filter(t => t.requiresCustomerApproval && t.isCustomerApproved === null);

                return (
                  <div
                    key={card.id}
                    className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-5"
                  >
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black px-3 py-1 rounded-full bg-blue-600 text-white shadow-xs">
                            {card.id}
                          </span>
                          <span className="font-mono text-sm font-black text-slate-900 dark:text-slate-100">
                            {card.vehicle.registrationNumber}
                          </span>
                          <span className="text-xs text-slate-500">
                            ({card.vehicle.make} {card.vehicle.model})
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Created on {card.createdAt} • Workshop: <strong className="text-slate-800 dark:text-slate-200">{card.workshopName || 'FixoCar Central Hub'}</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          {card.status}
                        </span>

                        <button
                          onClick={() => setInvoiceJobCard(card)}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-950 dark:bg-slate-100 text-white dark:text-slate-900 font-extrabold text-xs hover:bg-blue-600 transition-colors flex items-center gap-1.5"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>View Invoice</span>
                        </button>
                      </div>
                    </div>

                    {/* Pending Approval Highlight */}
                    {pendingApprovals.length > 0 && (
                      <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-xs text-rose-800 dark:text-rose-300">
                        <span className="font-bold flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                          {pendingApprovals.length} task(s) on this job card require your approval!
                        </span>
                        <button
                          onClick={() => setActiveTab('APPROVALS')}
                          className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold text-[11px]"
                        >
                          Review Now
                        </button>
                      </div>
                    )}

                    {/* Work Breakdown Table */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        Work Done & Tasks Scope:
                      </h4>

                      <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-100 dark:border-slate-800">
                            <tr>
                              <th className="px-3.5 py-2.5">Task Description</th>
                              <th className="px-3.5 py-2.5">Category</th>
                              <th className="px-3.5 py-2.5">Assigned Specialist</th>
                              <th className="px-3.5 py-2.5 text-center">Status</th>
                              <th className="px-3.5 py-2.5 text-right">Price (₹)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                            {card.tasks.map((task) => (
                              <tr key={task.id} className={task.isCustomerApproved === false ? 'opacity-50 line-through bg-rose-50/50 dark:bg-rose-950/20' : ''}>
                                <td className="px-3.5 py-2.5 font-bold text-slate-900 dark:text-slate-100">
                                  {task.title}
                                  {task.isAdditionalWork && (
                                    <span className="ml-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold">
                                      Discovered
                                    </span>
                                  )}
                                </td>
                                <td className="px-3.5 py-2.5">
                                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold">
                                    {task.category}
                                  </span>
                                </td>
                                <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400">
                                  {task.assignedToName || 'Floor Team'}
                                </td>
                                <td className="px-3.5 py-2.5 text-center">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    task.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-blue-500/10 text-blue-600'
                                  }`}>
                                    {task.status}
                                  </span>
                                </td>
                                <td className="px-3.5 py-2.5 text-right font-mono font-bold">
                                  ₹{task.customerPrice.toLocaleString('en-IN')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Summary Footer */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                      <div className="space-y-0.5">
                        <p className="text-slate-500">
                          Floor Manager: <strong className="text-slate-800 dark:text-slate-200">{card.floorManagerName || 'Master Tech'}</strong>
                        </p>
                        <p className="text-slate-500">
                          Est. Completion: <strong className="text-slate-800 dark:text-slate-200">{card.estimatedCompletionDate || 'Same Day Delivery'}</strong>
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Approved Labor & Parts</span>
                        <span className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                          ₹{totalCustomerPrice.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PENDING APPROVALS */}
      {activeTab === 'APPROVALS' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              Pending Workshop Approvals
            </h2>
            <p className="text-xs text-slate-500">
              Review and approve/decline extra maintenance recommendations discovered during workshop inspection.
            </p>
          </div>

          {allPendingApprovals.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h3 className="font-bold text-slate-800 dark:text-slate-200">All Clear! No Pending Approvals</h3>
              <p className="text-xs text-slate-500">
                You have reviewed all workshop recommendations. No action required right now!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {allPendingApprovals.map(({ card, task }) => (
                <div
                  key={task.id}
                  className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-blue-500/40 p-6 shadow-lg shadow-blue-500/5 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded">
                        DISCOVERED DURING INSPECTION
                      </span>
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                        {task.title}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Job Card #{card.id} • Vehicle: <strong className="font-mono text-slate-800 dark:text-slate-200">{card.vehicle.registrationNumber}</strong>
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Additional Cost</span>
                      <span className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
                        +₹{task.customerPrice.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                    💡 <strong>Inspection Note:</strong> {task.notes || 'Master technician recommends this repair to prevent further wear and tear on your vehicle.'}
                  </p>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      onClick={() => setDeclineTarget({ cardId: card.id, taskId: task.id, taskTitle: task.title })}
                      className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-600 hover:text-white text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors"
                    >
                      Decline Item
                    </button>

                    <button
                      onClick={() => handleApproveTask(card.id, task.id)}
                      className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs transition-colors shadow-md shadow-blue-600/30 flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      Approve & Add (+₹{task.customerPrice.toLocaleString('en-IN')})
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: BOOK SERVICES CATALOG */}
      {activeTab === 'SERVICES' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Wrench className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                Standard Workshop Service Packages
              </h2>
              <p className="text-xs text-slate-500">
                Transparent flat pricing across India • Free doorstep pickup & drop included.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-xs font-bold text-slate-500">City:</span>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value as IndianCity)}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-bold text-xs"
              >
                {INDIAN_CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cityServices.map((service) => {
              const price = service.cityPrices[selectedCity] || 3999;

              return (
                <div
                  key={service.id}
                  className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between space-y-4 hover:border-blue-500 transition-all"
                >
                  <div className="space-y-3">
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest font-mono">
                      {service.category}
                    </span>
                    <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 leading-snug">
                      {service.title}
                    </h3>
                    <p className="text-xs text-slate-500">{service.tagline}</p>

                    <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">{selectedCity} Rate</span>
                        <span className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">
                          ₹{price.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> {service.estimatedHours} Hours
                      </span>
                    </div>

                    <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                      {service.includedFeatures.map((feat, idx) => (
                        <li key={idx} className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() => {
                      setBookingService(service);
                      if (vehicles.length > 0) {
                        setBookingVehicleReg(vehicles[0].registrationNumber);
                        setBookingMakeModel(`${vehicles[0].make} ${vehicles[0].model}`);
                      }
                    }}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs transition-colors shadow-md shadow-blue-600/20 flex items-center justify-center gap-1"
                  >
                    <span>Book for ₹{price.toLocaleString('en-IN')}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL 1: CUSTOMER LOGIN / REGISTER MODAL */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-5 sm:p-8 space-y-5 shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-600 text-white font-bold">
                  <LogIn className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-lg text-slate-900 dark:text-slate-100">
                  Customer Portal Login
                </h3>
              </div>
              <button onClick={() => setIsLoginModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Demo Login Option */}
            <div className="p-3.5 rounded-2xl bg-blue-950/50 border border-blue-500/40 text-blue-200 space-y-2">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block">
                ⚡ Quick Demo Login
              </span>
              <p className="text-xs text-slate-300">
                Click below to instantly log in as <strong>Vikramaditya Singh (+91 88199 15656)</strong> with pre-populated garage vehicles and active job cards.
              </p>
              <button
                onClick={handleDemoLogin}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs transition-colors shadow-md shadow-blue-600/20"
              >
                One-Click Demo Login →
              </button>
            </div>

            <div className="relative flex items-center justify-center my-2">
              <hr className="w-full border-slate-200 dark:border-slate-800" />
              <span className="absolute bg-white dark:bg-slate-900 px-3 text-[10px] text-slate-400 font-bold uppercase">
                OR LOGIN WITH MOBILE OTP
              </span>
            </div>

            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Your Mobile Phone Number *</label>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold font-mono">
                      +91
                    </span>
                    <input
                      type="text"
                      required
                      value={loginPhone}
                      onChange={(e) => setLoginPhone(e.target.value)}
                      placeholder="e.g. 8819915656"
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-sm text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={loginName}
                    onChange={(e) => setLoginName(e.target.value)}
                    placeholder="e.g. Vikramaditya Singh"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="e.g. vikram.singh@example.com"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs transition-colors shadow-md"
                >
                  Send OTP Verification Code
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4 text-xs">
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-center">
                  OTP sent to <strong>+91 {loginPhone}</strong>. Enter <strong>1234</strong> or any 4-digit code.
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Enter 4-Digit OTP Code *</label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    value={loginOtp}
                    onChange={(e) => setLoginOtp(e.target.value)}
                    placeholder="1 2 3 4"
                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-center text-xl font-black tracking-widest text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="w-1/3 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="w-2/3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md"
                  >
                    Verify & Access Portal
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT VEHICLE MODAL */}
      {isAddVehicleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-lg p-5 sm:p-8 space-y-4 shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Car className="w-5 h-5 text-blue-600" />
                {editingVehicle ? 'Edit Vehicle Details' : 'Register New Vehicle to Garage'}
              </h3>
              <button onClick={() => setIsAddVehicleModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVehicle} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Registration Number *</label>
                  <input
                    type="text"
                    required
                    value={vehReg}
                    onChange={(e) => setVehReg(e.target.value)}
                    placeholder="e.g. MH-02-DN-4521"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-slate-900 dark:text-slate-100 uppercase"
                  />
                </div>

                <div className="sm:col-span-2">
                  <CarModelSelector
                    selectedMake={vehMake}
                    selectedModel={vehModel}
                    selectedVariant={vehVariant}
                    selectedFuelType={vehFuel}
                    onChange={(selection) => {
                      setVehMake(selection.make);
                      setVehModel(selection.model);
                      if (selection.variant) setVehVariant(selection.variant);
                      if (selection.fuelType) setVehFuel(selection.fuelType);
                    }}
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Manufacturing Year</label>
                  <input
                    type="number"
                    value={vehYear}
                    onChange={(e) => setVehYear(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Fuel Type</label>
                  <select
                    value={vehFuel}
                    onChange={(e) => setVehFuel(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-bold"
                  >
                    <option value="Petrol">Petrol</option>
                    <option value="Diesel">Diesel</option>
                    <option value="CNG">CNG</option>
                    <option value="EV">EV (Electric)</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Color</label>
                  <input
                    type="text"
                    value={vehColor}
                    onChange={(e) => setVehColor(e.target.value)}
                    placeholder="e.g. White, Silver, Red"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Odometer Mileage (km)</label>
                  <input
                    type="number"
                    value={vehMileage}
                    onChange={(e) => setVehMileage(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">VIN / Chassis Number (Optional)</label>
                <input
                  type="text"
                  value={vehVin}
                  onChange={(e) => setVehVin(e.target.value)}
                  placeholder="e.g. MA3E12345678901"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono uppercase"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Notes / Reminders</label>
                <input
                  type="text"
                  value={vehNotes}
                  onChange={(e) => setVehNotes(e.target.value)}
                  placeholder="e.g. Extended warranty valid till Dec 2026"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs transition-colors shadow-md"
              >
                {editingVehicle ? 'Save Vehicle Updates' : 'Add Vehicle to My Garage'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DECLINE REASON MODAL */}
      {declineTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-5 sm:p-6 space-y-4 shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                Decline Recommendation
              </h3>
              <button onClick={() => setDeclineTarget(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDeclineTaskSubmit} className="space-y-4 text-xs">
              <p className="text-slate-600 dark:text-slate-300">
                You are declining: <strong>{declineTarget.taskTitle}</strong>
              </p>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for declining (Optional)
                </label>
                <textarea
                  value={declineReasonText}
                  onChange={(e) => setDeclineReasonText(e.target.value)}
                  placeholder="e.g. Will get this done next month / Budget constraint"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 h-20"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDeclineTarget(null)}
                  className="w-1/2 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-md"
                >
                  Confirm Decline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: INVOICE / RECEIPT MODAL */}
      {invoiceJobCard && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl p-5 sm:p-8 space-y-4 shadow-2xl my-auto max-h-[90vh] overflow-y-auto relative">
            <button 
              onClick={() => setInvoiceJobCard(null)} 
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 dark:hover:text-white p-2 rounded-xl bg-slate-100 dark:bg-slate-800 transition-all z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <GSTInvoiceView card={invoiceJobCard} isCustomerPortal={true} />
          </div>
        </div>
      )}

      {/* MODAL 5: SERVICE BOOKING CONFIRMATION MODAL */}
      {bookingService && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-xl p-5 sm:p-8 space-y-5 shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest font-mono">
                  FixoCar Service Booking • {selectedCity}
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
                  {bookingService.title}
                </h3>
              </div>
              <button onClick={() => setBookingService(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400 font-bold block">Selected City Package Price</span>
                <p className="text-2xl font-black text-blue-400 font-mono mt-0.5">
                  ₹{(bookingService.cityPrices[selectedCity] || 3999).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="text-right">
                <span className="text-slate-400 font-bold block">Service Duration</span>
                <p className="text-xs font-bold text-slate-200">{bookingService.estimatedHours} Hours</p>
              </div>
            </div>

            <form onSubmit={handleConfirmServiceBooking} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Vehicle Registration *</label>
                  <input
                    type="text"
                    required
                    value={bookingVehicleReg}
                    onChange={(e) => setBookingVehicleReg(e.target.value)}
                    placeholder="e.g. MH-02-DN-4521"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-slate-900 dark:text-slate-100 uppercase"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Make & Model</label>
                  <input
                    type="text"
                    value={bookingMakeModel}
                    onChange={(e) => setBookingMakeModel(e.target.value)}
                    placeholder="e.g. Honda City"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Preferred Date</label>
                  <input
                    type="date"
                    required
                    value={prefDate}
                    onChange={(e) => setPrefDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Time Slot</label>
                  <select
                    value={prefSlot}
                    onChange={(e) => setPrefSlot(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-bold"
                  >
                    <option value="09:00 AM - 11:00 AM">09:00 AM - 11:00 AM</option>
                    <option value="10:00 AM - 12:00 PM">10:00 AM - 12:00 PM</option>
                    <option value="01:00 PM - 03:00 PM">01:00 PM - 03:00 PM</option>
                    <option value="03:00 PM - 05:00 PM">03:00 PM - 05:00 PM</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Pickup Address</label>
                <input
                  type="text"
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  placeholder={`Flat/Building, Area, ${selectedCity}`}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <label className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pickupNeeded}
                  onChange={(e) => setPickupNeeded(e.target.checked)}
                  className="rounded accent-blue-600 w-4 h-4"
                />
                <span className="font-bold text-blue-900 dark:text-blue-300">
                  Request Free Doorstep Pick & Drop Service
                </span>
              </label>

              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm transition-all shadow-lg shadow-blue-600/30"
              >
                Confirm Booking for ₹{(bookingService.cityPrices[selectedCity] || 3999).toLocaleString('en-IN')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: CONFIRMED BOOKING SUCCESS MODAL */}
      {confirmedBooking && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-lg p-5 sm:p-8 space-y-5 text-center shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
              <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                Booking Confirmed
              </span>
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
                Service Booked Successfully!
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Your service order and workshop job card have been generated.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-left space-y-2 text-xs">
              <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <span className="text-slate-500">Booking ID:</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{confirmedBooking.booking.id}</span>
              </div>

              <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <span className="text-slate-500">Workshop Job Card ID:</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{confirmedBooking.jobCard.id}</span>
              </div>

              <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <span className="text-slate-500">Vehicle:</span>
                <span className="font-bold">{confirmedBooking.booking.vehicleNumber} ({confirmedBooking.booking.vehicleMakeModel})</span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500">Price in {confirmedBooking.booking.city}:</span>
                <span className="font-mono font-extrabold text-emerald-500">₹{confirmedBooking.booking.price.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                onClick={() => {
                  setConfirmedBooking(null);
                  setActiveTab('JOB_CARDS');
                }}
                className="w-full py-3 rounded-2xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-extrabold text-xs transition-colors"
              >
                Track Live Job Card Progress →
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
