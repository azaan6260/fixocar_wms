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
  JobTask
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
  // 'GARAGE' | 'JOB_CARDS' | 'APPROVALS' | 'SERVICES' | 'INVOICES'
  const [activeTab, setActiveTab] = useState<'GARAGE' | 'JOB_CARDS' | 'APPROVALS' | 'SERVICES'>('GARAGE');

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
  const [vehMake, setVehMake] = useState('');
  const [vehModel, setVehModel] = useState('');
  const [vehYear, setVehYear] = useState<number>(2022);
  const [vehColor, setVehColor] = useState('');
  const [vehFuel, setVehFuel] = useState<'Petrol' | 'Diesel' | 'CNG' | 'EV' | 'Hybrid'>('Petrol');
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
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-3xl p-6 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center font-black text-xl shadow-lg shadow-amber-500/20 shrink-0">
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
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all border border-slate-700 flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                Logout / Switch
              </button>
            ) : (
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-md flex items-center gap-1.5"
              >
                <LogIn className="w-4 h-4" />
                Customer Login / Register
              </button>
            )}

            <a
              href="tel:8819915656"
              className="px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 text-xs font-bold transition-all border border-emerald-500/30 flex items-center gap-1.5"
            >
              <Phone className="w-3.5 h-3.5 fill-current" />
              <span>Helpline: 8819915656</span>
            </a>
          </div>

        </div>

        {/* Navigation Tabs Bar inside Customer Portal */}
        <div className="relative z-10 flex items-center gap-2 mt-6 pt-5 border-t border-slate-800/80 overflow-x-auto">
          <button
            onClick={() => setActiveTab('GARAGE')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'GARAGE'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Car className="w-4 h-4" />
            My Garage ({vehicles.length} Vehicles)
          </button>

          <button
            onClick={() => setActiveTab('JOB_CARDS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'JOB_CARDS'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            Job Cards & History ({relevantJobCards.length})
          </button>

          <button
            onClick={() => setActiveTab('APPROVALS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap relative ${
              activeTab === 'APPROVALS'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <AlertCircle className="w-4 h-4 text-amber-400" />
            Pending Approvals
            {allPendingApprovals.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white font-mono text-[10px] font-black animate-pulse">
                {allPendingApprovals.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('SERVICES')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'SERVICES'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Wrench className="w-4 h-4" />
            Book Service Packages
          </button>
        </div>

        {/* Ambient Glow */}
        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-blue-600/20 blur-3xl pointer-events-none" />
      </div>

      {/* PENDING APPROVAL ALERT BANNER IF ANY */}
      {allPendingApprovals.length > 0 && activeTab !== 'APPROVALS' && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-800 dark:text-amber-300 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500 text-slate-950 font-bold shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="font-extrabold text-sm">
                {allPendingApprovals.length} Repair Item{allPendingApprovals.length > 1 ? 's' : ''} Require Your Decision!
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Our workshop floor team found extra inspection items requiring your approval to continue work.
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('APPROVALS')}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-colors self-end sm:self-auto shrink-0 shadow-sm"
          >
            Review & Approve Now →
          </button>
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
                          <span className="font-mono text-sm font-black text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 inline-block mb-1">
                            {v.registrationNumber}
                          </span>
                          <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 leading-snug">
                            {v.make} {v.model}
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
                            <Fuel className="w-3.5 h-3.5 text-amber-500" />
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
                        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between">
                          <span className="font-bold flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-amber-500" />
                            Active Repair: {activeJobCard.id}
                          </span>
                          <span className="font-mono text-[10px] font-black px-2 py-0.5 rounded bg-amber-500/20">
                            {activeJobCard.status}
                          </span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleStartBookingForVehicle(v)}
                      className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5"
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
                        <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          {card.status}
                        </span>

                        <button
                          onClick={() => setInvoiceJobCard(card)}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-extrabold text-xs hover:bg-blue-600 transition-colors flex items-center gap-1.5"
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
                                    <span className="ml-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 font-bold">
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
                                    task.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
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
              <AlertCircle className="w-6 h-6 text-amber-500" />
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
                  className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-amber-500/40 p-6 shadow-md space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded">
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
                      <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
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
                      className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-colors shadow-md flex items-center gap-1.5"
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
                <Wrench className="w-6 h-6 text-amber-500" />
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
                  className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between space-y-4 hover:border-amber-500 transition-all"
                >
                  <div className="space-y-3">
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest font-mono">
                      {service.category}
                    </span>
                    <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 leading-snug">
                      {service.title}
                    </h3>
                    <p className="text-xs text-slate-500">{service.tagline}</p>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">{selectedCity} Rate</span>
                        <span className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">
                          ₹{price.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-amber-500 flex items-center gap-1">
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
                    className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-colors shadow-sm flex items-center justify-center gap-1"
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
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 sm:p-8 space-y-5 shadow-2xl">
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
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest block">
                ⚡ Quick Demo Login
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Click below to instantly log in as <strong>Vikramaditya Singh (+91 88199 15656)</strong> with pre-populated garage vehicles and active job cards.
              </p>
              <button
                onClick={handleDemoLogin}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-colors shadow-xs"
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
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-lg p-6 sm:p-8 space-y-4 shadow-2xl my-8">
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

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Make / Brand *</label>
                  <input
                    type="text"
                    required
                    value={vehMake}
                    onChange={(e) => setVehMake(e.target.value)}
                    placeholder="e.g. Honda, Maruti, Hyundai"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Model Name *</label>
                  <input
                    type="text"
                    required
                    value={vehModel}
                    onChange={(e) => setVehModel(e.target.value)}
                    placeholder="e.g. City 1.5 i-VTEC, Swift"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
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
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 space-y-4 shadow-2xl">
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
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl p-6 sm:p-8 space-y-6 shadow-2xl my-8">
            
            {/* Header & Print Control */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-600 text-white font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-slate-900 dark:text-slate-100">
                    FixoCar Workshop Tax Invoice
                  </h3>
                  <p className="text-xs text-slate-500">
                    Invoice #{invoiceJobCard.id} • {invoiceJobCard.createdAt}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print / Download PDF
                </button>
                <button onClick={() => setInvoiceJobCard(null)} className="text-slate-400 hover:text-white p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Bill Details */}
            <div className="grid grid-cols-2 gap-4 text-xs p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Customer Info</span>
                <p className="font-bold text-slate-900 dark:text-slate-100">{invoiceJobCard.customer.name}</p>
                <p className="text-slate-500">{invoiceJobCard.customer.phone}</p>
                <p className="text-slate-500">{invoiceJobCard.customer.email}</p>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Vehicle Reg & Details</span>
                <p className="font-mono font-bold text-blue-600 dark:text-blue-400">{invoiceJobCard.vehicle.registrationNumber}</p>
                <p className="text-slate-500">{invoiceJobCard.vehicle.make} {invoiceJobCard.vehicle.model} ({invoiceJobCard.vehicle.year})</p>
                <p className="text-slate-500 font-mono">Odo: {invoiceJobCard.vehicle.mileage?.toLocaleString() || 0} km</p>
              </div>
            </div>

            {/* Itemized Tasks Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-2.5">Item / Task</th>
                    <th className="px-4 py-2.5">Category</th>
                    <th className="px-4 py-2.5 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {invoiceJobCard.tasks.filter(t => t.isCustomerApproved !== false).map((t) => (
                    <tr key={t.id}>
                      <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-slate-100">{t.title}</td>
                      <td className="px-4 py-2.5 font-mono text-[11px]">{t.category}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold">₹{t.customerPrice.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Price Calculations */}
            {(() => {
              const subtotal = invoiceJobCard.tasks.reduce((sum, t) => sum + (t.isCustomerApproved !== false ? t.customerPrice : 0), 0);
              const gst = Math.round(subtotal * 0.18);
              const grandTotal = subtotal + gst - (invoiceJobCard.discount || 0);
              const netBalance = grandTotal - (invoiceJobCard.advancePaid || 0);

              return (
                <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2 text-xs font-mono">
                  <div className="flex justify-between text-slate-300">
                    <span>Labor & Spares Subtotal:</span>
                    <span>₹{subtotal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>GST (18% Tax):</span>
                    <span>₹{gst.toLocaleString('en-IN')}</span>
                  </div>
                  {invoiceJobCard.discount > 0 && (
                    <div className="flex justify-between text-emerald-400">
                      <span>Discount Applied:</span>
                      <span>-₹{invoiceJobCard.discount.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-extrabold border-t border-slate-700 pt-2 text-amber-400">
                    <span>Grand Total:</span>
                    <span>₹{grandTotal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-emerald-400 pt-1">
                    <span>Advance Paid:</span>
                    <span>₹{(invoiceJobCard.advancePaid || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-lg font-black border-t border-slate-700 pt-2 text-white">
                    <span>Net Balance Due:</span>
                    <span className="text-emerald-400">₹{netBalance.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              );
            })()}

          </div>
        </div>
      )}

      {/* MODAL 5: SERVICE BOOKING CONFIRMATION MODAL */}
      {bookingService && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-xl p-6 sm:p-8 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest font-mono">
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

            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500 font-bold block">Selected City Package Price</span>
                <p className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                  ₹{(bookingService.cityPrices[selectedCity] || 3999).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="text-right">
                <span className="text-slate-500 font-bold block">Service Duration</span>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{bookingService.estimatedHours} Hours</p>
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

              <label className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pickupNeeded}
                  onChange={(e) => setPickupNeeded(e.target.checked)}
                  className="rounded accent-emerald-500 w-4 h-4"
                />
                <span className="font-bold text-emerald-800 dark:text-emerald-300">
                  Request Free Doorstep Pick & Drop Service
                </span>
              </label>

              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm transition-all shadow-lg shadow-amber-500/20"
              >
                Confirm Booking for ₹{(bookingService.cityPrices[selectedCity] || 3999).toLocaleString('en-IN')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: CONFIRMED BOOKING SUCCESS MODAL */}
      {confirmedBooking && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-lg p-6 sm:p-8 space-y-5 text-center shadow-2xl">
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
                <span className="font-mono font-bold text-amber-500">{confirmedBooking.jobCard.id}</span>
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
