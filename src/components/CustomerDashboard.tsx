import React, { useState, useEffect } from 'react';
import { 
  User, Car, Wrench, ShieldCheck, Clock, CheckCircle2, 
  AlertCircle, Plus, ChevronRight, Download, Printer, Phone, 
  Sparkles, FileText, Calendar, MapPin, LogOut, ArrowRight, 
  Check, X, Eye, Fuel, HelpCircle, MessageSquare, RefreshCw
} from 'lucide-react';
import { 
  CustomerUser, CustomerVehicleRecord, JobCard, JobTask, 
  CityServiceOffering, ServiceBookingRequest, AuthUser 
} from '../types';
import { 
  getCustomerVehicles, saveCustomerVehicles, getJobCards, 
  getCityServices, getServiceBookings, saveServiceBookings, 
  updateJobCard, subscribeToStore, getAuthUser, logoutAuthUser
} from '../lib/storage';

interface CustomerDashboardProps {
  onLogout: () => void;
  onBookService?: () => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'GARAGE' | 'TRACKER' | 'APPROVALS' | 'BOOKINGS' | 'INVOICES'>('GARAGE');
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => getAuthUser());
  const [vehicles, setVehicles] = useState<CustomerVehicleRecord[]>([]);
  const [jobCards, setJobCards] = useState<JobCard[]>([]);
  const [cityServices, setCityServices] = useState<CityServiceOffering[]>([]);
  const [bookings, setBookings] = useState<ServiceBookingRequest[]>([]);
  
  // Modals state
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);
  const [isBookServiceOpen, setIsBookServiceOpen] = useState(false);
  const [selectedVehicleForTracking, setSelectedVehicleForTracking] = useState<string | null>(null);
  const [selectedInvoiceCard, setSelectedInvoiceCard] = useState<JobCard | null>(null);

  // New Vehicle Form State
  const [vehReg, setVehReg] = useState('');
  const [vehMake, setVehMake] = useState('Honda');
  const [vehModel, setVehModel] = useState('City');
  const [vehYear, setVehYear] = useState(2022);
  const [vehFuel, setVehFuel] = useState('Petrol');
  const [vehColor, setVehColor] = useState('Pearl White');
  const [vehMileage, setVehMileage] = useState(32000);

  // Booking Form State
  const [bookReg, setBookReg] = useState('');
  const [bookServiceTitle, setBookServiceTitle] = useState('Comprehensive Periodic Service');
  const [bookDate, setBookDate] = useState('2026-08-25');
  const [bookTime, setBookTime] = useState('10:00 AM');
  const [bookPickup, setBookPickup] = useState(true);
  const [bookAddress, setBookAddress] = useState('B-402, Seawoods Grand Central, Nerul, Navi Mumbai');

  const refreshData = () => {
    const user = getAuthUser();
    setAuthUser(user);
    const phone = user?.phone || '8819915656';
    setVehicles(getCustomerVehicles(phone));
    setJobCards(getJobCards());
    setCityServices(getCityServices());
    setBookings(getServiceBookings());
  };

  useEffect(() => {
    refreshData();
    const unsub = subscribeToStore(refreshData);
    return unsub;
  }, []);

  // Filter job cards for this customer
  const customerPhoneQuery = authUser?.phone ? authUser.phone.replace(/\D/g, '') : '8819915656';
  const customerVehRegs = vehicles.map(v => v.registrationNumber.toUpperCase());

  const myJobCards = jobCards.filter(card => {
    const cardPhone = card.customer?.phone?.replace(/\D/g, '') || '';
    const cardReg = card.vehicle?.registrationNumber?.toUpperCase() || '';
    return (
      (customerPhoneQuery && cardPhone.includes(customerPhoneQuery)) ||
      customerVehRegs.includes(cardReg) ||
      (authUser?.name && card.customer?.name?.toLowerCase().includes(authUser.name.toLowerCase()))
    );
  });

  // Calculate pending approvals
  const pendingApprovals: { card: JobCard; task: JobTask }[] = [];
  myJobCards.forEach(card => {
    card.tasks.forEach(task => {
      if (task.requiresCustomerApproval && task.isCustomerApproved === null) {
        pendingApprovals.push({ card, task });
      }
    });
  });

  // Active in-progress job cards
  const activeJobCards = myJobCards.filter(c => c.status !== 'DELIVERED' && c.status !== 'CLOSED');

  // Handle Add Vehicle
  const handleSaveVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehReg.trim()) return;

    const newVeh: CustomerVehicleRecord = {
      id: `veh-${Date.now()}`,
      customerPhone: authUser?.phone || '8819915656',
      registrationNumber: vehReg.trim().toUpperCase(),
      make: vehMake,
      model: vehModel,
      year: Number(vehYear),
      color: vehColor,
      fuelType: vehFuel,
      mileage: Number(vehMileage),
      addedAt: new Date().toISOString().split('T')[0]
    };

    const updated = [newVeh, ...vehicles];
    saveCustomerVehicles(updated);
    setIsAddVehicleOpen(false);
    setVehReg('');
    refreshData();
  };

  // Handle Approval / Decline of a Task
  const handleTaskApproval = (cardId: string, taskId: string, approve: boolean) => {
    const card = jobCards.find(c => c.id === cardId);
    if (!card) return;

    const updatedTasks = card.tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          isCustomerApproved: approve,
          approvedAt: approve ? new Date().toISOString() : undefined,
          status: approve ? 'IN_PROGRESS' as const : 'ON_HOLD' as const
        };
      }
      return t;
    });

    updateJobCard(card.id, (prev) => ({ ...prev, tasks: updatedTasks }));
    refreshData();
  };

  // Handle Book Service Submit
  const handleCreateBooking = (e: React.FormEvent) => {
    e.preventDefault();
    const newBooking: ServiceBookingRequest = {
      id: `book-${Date.now()}`,
      city: authUser?.cityName || 'Mumbai',
      serviceId: 'srv-periodic',
      serviceTitle: bookServiceTitle,
      price: 2999,
      customerName: authUser?.name || 'Vikramaditya Singh',
      customerPhone: authUser?.phone || '8819915656',
      customerEmail: authUser?.email || 'vikram.singh@example.com',
      vehicleNumber: bookReg || (vehicles[0]?.registrationNumber || 'MH-02-CB-9988'),
      vehicleMakeModel: `${vehMake} ${vehModel}`,
      preferredDate: bookDate,
      preferredTimeSlot: bookTime,
      address: bookPickup ? bookAddress : 'Workshop Self-Drop',
      pickupNeeded: bookPickup,
      status: 'CONFIRMED',
      createdAt: new Date().toISOString()
    };

    saveServiceBookings([newBooking, ...bookings]);
    setIsBookServiceOpen(false);
    setActiveTab('BOOKINGS');
    refreshData();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS': return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      case 'QC_PENDING': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'READY_FOR_DELIVERY': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'DELIVERED': return 'text-slate-300 bg-slate-800 border-slate-700';
      default: return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 font-sans">
      
      {/* Top Customer Header Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
              <Wrench className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-white tracking-tight">Fixo<span className="text-blue-500">Car</span></span>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-black uppercase tracking-wider border border-blue-500/30">
                  Customer Portal
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Personal Garage & Real-Time Workshop Service Hub</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsBookServiceOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black transition-all shadow-md shadow-blue-600/30 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Book New Service
            </button>
            <button
              onClick={onLogout}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold border border-slate-800 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        
        {/* Customer Welcome & Quick Overview Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-blue-900/40 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
            
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-black text-2xl shadow-lg shadow-blue-600/30 shrink-0">
                {authUser?.name ? authUser.name.charAt(0).toUpperCase() : 'V'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-extrabold text-white tracking-tight">
                    Welcome back, {authUser?.name || 'Vikramaditya Singh'}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black border border-emerald-500/30">
                    Active Member
                  </span>
                </div>
                <div className="text-xs text-slate-300 font-mono mt-1 flex flex-wrap items-center gap-3">
                  <span>📱 +91 {authUser?.phone || '8819915656'}</span>
                  <span>✉️ {authUser?.email || 'vikram.singh@example.com'}</span>
                  <span>📍 {authUser?.cityName || 'Mumbai'}</span>
                </div>
              </div>
            </div>

            {/* Quick Balance / Reward Loyalty Chips */}
            <div className="flex items-center gap-3 self-stretch sm:self-auto">
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-center flex-1 sm:flex-initial">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">FixoPoints</span>
                <p className="text-base font-black text-amber-400 flex items-center justify-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> 750 Pts
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-center flex-1 sm:flex-initial">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">24x7 Valet Help</span>
                <p className="text-xs font-mono font-bold text-blue-400">8819915656</p>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Metric Stats Quick Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div 
            onClick={() => setActiveTab('GARAGE')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              activeTab === 'GARAGE' ? 'bg-blue-600/10 border-blue-500 shadow-lg' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
              <span>My Garage</span>
              <Car className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-black text-white mt-1">{vehicles.length} <span className="text-xs font-normal text-slate-400">Vehicles</span></p>
            <p className="text-[11px] text-slate-400 mt-0.5">Click to view garage specs</p>
          </div>

          <div 
            onClick={() => setActiveTab('TRACKER')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              activeTab === 'TRACKER' ? 'bg-blue-600/10 border-blue-500 shadow-lg' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
              <span>Active In Workshop</span>
              <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
            </div>
            <p className="text-2xl font-black text-blue-400 mt-1">{activeJobCards.length} <span className="text-xs font-normal text-slate-400">Live</span></p>
            <p className="text-[11px] text-slate-400 mt-0.5">Real-time stepper & status</p>
          </div>

          <div 
            onClick={() => setActiveTab('APPROVALS')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              activeTab === 'APPROVALS' ? 'bg-amber-600/10 border-amber-500 shadow-lg' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
              <span>Pending Approvals</span>
              <AlertCircle className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-black text-amber-400 mt-1">{pendingApprovals.length} <span className="text-xs font-normal text-slate-400">Actions</span></p>
            <p className="text-[11px] text-slate-400 mt-0.5">Authorize extra parts/work</p>
          </div>

          <div 
            onClick={() => setActiveTab('INVOICES')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              activeTab === 'INVOICES' ? 'bg-blue-600/10 border-blue-500 shadow-lg' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
              <span>GST Tax Invoices</span>
              <FileText className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-black text-emerald-400 mt-1">{myJobCards.length} <span className="text-xs font-normal text-slate-400">Records</span></p>
            <p className="text-[11px] text-slate-400 mt-0.5">View & download bills</p>
          </div>
        </div>

        {/* Tab Navigation Pill Selector */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800">
          <button
            onClick={() => setActiveTab('GARAGE')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'GARAGE' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            My Garage ({vehicles.length})
          </button>

          <button
            onClick={() => setActiveTab('TRACKER')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'TRACKER' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Live Workshop Tracker ({activeJobCards.length})
          </button>

          <button
            onClick={() => setActiveTab('APPROVALS')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'APPROVALS' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            Pending Approvals {pendingApprovals.length > 0 && <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[10px] font-black">{pendingApprovals.length}</span>}
          </button>

          <button
            onClick={() => setActiveTab('BOOKINGS')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'BOOKINGS' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Service Bookings ({bookings.length})
          </button>

          <button
            onClick={() => setActiveTab('INVOICES')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'INVOICES' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            GST Invoices & History
          </button>
        </div>

        {/* TAB 1: MY GARAGE */}
        {activeTab === 'GARAGE' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-white">Registered Vehicles</h2>
                <p className="text-xs text-slate-400">Manage vehicle details, specs, and schedule maintenance</p>
              </div>
              <button
                onClick={() => setIsAddVehicleOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-blue-600/30 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Vehicle
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vehicles.map((v) => {
                const linkedJobCard = myJobCards.find(c => c.vehicle.registrationNumber.toUpperCase() === v.registrationNumber.toUpperCase() && c.status !== 'DELIVERED' && c.status !== 'CLOSED');
                return (
                  <div key={v.id} className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl p-5 space-y-4 transition-all group">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-base font-black text-white">{v.registrationNumber}</span>
                          <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase border border-blue-500/20">
                            {v.fuelType}
                          </span>
                        </div>
                        <h3 className="text-sm font-extrabold text-slate-200 mt-1">
                          {v.year} {v.make} {v.model}
                        </h3>
                      </div>
                      <div className="w-10 h-10 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-300">
                        <Car className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800/80">
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold">Color</span>
                        <p className="text-slate-200 font-medium">{v.color || 'Standard'}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold">Odometer</span>
                        <p className="text-slate-200 font-medium">{v.mileage?.toLocaleString('en-IN')} km</p>
                      </div>
                    </div>

                    {/* Workshop Status Indicator */}
                    <div className="pt-2 border-t border-slate-800/80">
                      {linkedJobCard ? (
                        <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs">
                            <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                            <span className="font-bold text-blue-300">In Workshop: {linkedJobCard.status}</span>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedVehicleForTracking(v.registrationNumber);
                              setActiveTab('TRACKER');
                            }}
                            className="text-[11px] font-black text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                          >
                            Track <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Garage Ready
                          </span>
                          <button
                            onClick={() => {
                              setBookReg(v.registrationNumber);
                              setIsBookServiceOpen(true);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] cursor-pointer"
                          >
                            Book Service
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: LIVE WORKSHOP TRACKER */}
        {activeTab === 'TRACKER' && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h2 className="text-lg font-black text-white">Live Vehicle Progress & Milestones</h2>
              <p className="text-xs text-slate-400">Track stage-by-stage repairs, parts replacements, and technician reports</p>
            </div>

            {activeJobCards.length === 0 ? (
              <div className="p-12 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3">
                <Car className="w-12 h-12 text-slate-600 mx-auto" />
                <h3 className="text-base font-bold text-white">No active workshop jobs right now</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  All your registered cars are currently in your personal garage. Book a service package whenever you need maintenance!
                </p>
                <button
                  onClick={() => setIsBookServiceOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black transition-all cursor-pointer"
                >
                  Book Service Now
                </button>
              </div>
            ) : (
              activeJobCards.map((card) => {
                const totalTasks = card.tasks.length;
                const completedTasks = card.tasks.filter(t => t.status === 'COMPLETED').length;
                const percent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

                return (
                  <div key={card.id} className="bg-slate-900 border border-blue-900/40 rounded-3xl p-6 space-y-6 shadow-2xl">
                    
                    {/* Header Info */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-lg font-black text-white">{card.vehicle.registrationNumber}</span>
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-bold">
                            {card.vehicle.year} {card.vehicle.make} {card.vehicle.model}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Job Card: <span className="font-mono text-blue-400 font-bold">{card.id}</span> • {card.workshopName || 'FixoCar Central Hub'}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-black border ${getStatusColor(card.status)}`}>
                          {card.status}
                        </span>
                        <div className="text-right pl-3 border-l border-slate-800">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Est. Completion</span>
                          <span className="text-xs font-bold text-white font-mono">{card.estimatedCompletionDate}</span>
                        </div>
                      </div>
                    </div>

                    {/* Progress Gauge & Stages */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                      
                      {/* Gauge */}
                      <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-950 border border-slate-800">
                        <div className="relative w-28 h-28 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="40" stroke="#1e293b" strokeWidth="8" fill="transparent" />
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              stroke="#3b82f6"
                              strokeWidth="8"
                              strokeDasharray="251.2"
                              strokeDashoffset={251.2 - (251.2 * percent) / 100}
                              strokeLinecap="round"
                              fill="transparent"
                              className="transition-all duration-700 ease-out"
                            />
                          </svg>
                          <div className="absolute flex flex-col items-center">
                            <span className="text-2xl font-black text-white">{percent}%</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Completed</span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-300 font-bold mt-2">
                          {completedTasks} of {totalTasks} Tasks Done
                        </p>
                      </div>

                      {/* 4 Stages Stepper */}
                      <div className="md:col-span-3 space-y-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Workshop Progress Milestones</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { step: '1. Gate Check-In', status: 'COMPLETED', desc: 'Photos & Inspection' },
                            { step: '2. Quote Approval', status: card.tasks.some(t => t.requiresCustomerApproval && t.isCustomerApproved === null) ? 'PENDING' : 'COMPLETED', desc: 'Digital Estimate' },
                            { step: '3. Repairs & Spares', status: percent === 100 ? 'COMPLETED' : 'IN_PROGRESS', desc: 'Bay Repair' },
                            { step: '4. QC & Delivery', status: card.qcPassed ? 'COMPLETED' : 'WAITING', desc: 'Road Test & Valet' }
                          ].map((st, idx) => (
                            <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                              <div className="flex items-center gap-1.5 mb-1">
                                {st.status === 'COMPLETED' ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                ) : st.status === 'IN_PROGRESS' ? (
                                  <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                                ) : (
                                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                                )}
                                <span className="text-[11px] font-bold text-white truncate">{st.step}</span>
                              </div>
                              <p className="text-[10px] text-slate-400">{st.desc}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Allotted Tasks List */}
                    <div className="pt-4 border-t border-slate-800 space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Detailed Repair Checklist</h4>
                      <div className="space-y-2">
                        {card.tasks.map((task) => (
                          <div key={task.id} className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2.5">
                              {task.status === 'COMPLETED' ? (
                                <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                  <Check className="w-3 h-3" />
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                                  <Clock className="w-3 h-3" />
                                </div>
                              )}
                              <div>
                                <p className="font-bold text-white">{task.title}</p>
                                <p className="text-[11px] text-slate-400">
                                  Assigned to: <span className="text-slate-300 font-semibold">{task.assignedToName || 'Workshop Technician'}</span> • {task.category}
                                </p>
                              </div>
                            </div>

                            <div className="text-right">
                              <span className="font-mono font-bold text-white">₹{task.customerPrice?.toLocaleString('en-IN')}</span>
                              <p className="text-[10px] text-slate-400">{task.status}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 3: PENDING APPROVALS */}
        {activeTab === 'APPROVALS' && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h2 className="text-lg font-black text-white">Digital Estimate Approvals</h2>
              <p className="text-xs text-slate-400">Review extra parts or repair tasks discovered during preliminary inspection</p>
            </div>

            {pendingApprovals.length === 0 ? (
              <div className="p-12 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h3 className="text-base font-bold text-white">All estimates are approved!</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  There are no pending estimate requests or additional parts requiring your authorization.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingApprovals.map(({ card, task }) => (
                  <div key={task.id} className="bg-slate-900 border border-amber-500/30 rounded-3xl p-5 space-y-4 shadow-xl">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-base font-black text-white">{card.vehicle.registrationNumber}</span>
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold border border-amber-500/30">
                            Action Required
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Job Card: <span className="font-mono text-blue-400 font-bold">{card.id}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-black text-white font-mono">₹{task.customerPrice?.toLocaleString('en-IN')}</span>
                        <p className="text-[10px] text-slate-400">Estimate (Taxes extra)</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-extrabold text-white">{task.title}</h4>
                      <p className="text-xs text-slate-300 mt-1 bg-slate-950 p-3 rounded-xl border border-slate-800">
                        💬 <strong className="text-slate-200">Technician Observation:</strong> {task.notes || 'Identified wear during 30-point inspection. Replacement recommended for safety.'}
                      </p>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                      <button
                        onClick={() => handleTaskApproval(card.id, task.id, false)}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 font-bold text-xs transition-all cursor-pointer"
                      >
                        Decline Work
                      </button>
                      <button
                        onClick={() => handleTaskApproval(card.id, task.id, true)}
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        Approve & Authorize (₹{task.customerPrice?.toLocaleString('en-IN')})
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SERVICE BOOKINGS */}
        {activeTab === 'BOOKINGS' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-white">Scheduled Service Appointments</h2>
                <p className="text-xs text-slate-400">Track upcoming doorstep valet pickups and service packages</p>
              </div>
              <button
                onClick={() => setIsBookServiceOpen(true)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Book Service
              </button>
            </div>

            {bookings.length === 0 ? (
              <div className="p-12 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3">
                <Calendar className="w-12 h-12 text-slate-600 mx-auto" />
                <h3 className="text-base font-bold text-white">No upcoming appointments</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Schedule your next periodic maintenance or deep cleaning package with free doorstep valet pickup.
                </p>
                <button
                  onClick={() => setIsBookServiceOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black transition-all cursor-pointer"
                >
                  Book Service Now
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bookings.map((b) => (
                  <div key={b.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-mono font-bold text-white text-sm">{b.vehicleRegistration}</span>
                        <h4 className="text-sm font-extrabold text-blue-400 mt-0.5">{b.serviceTitle}</h4>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-black border border-emerald-500/20">
                        {b.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400">Scheduled Date</span>
                        <p className="text-slate-200 font-semibold">{b.preferredDate} ({b.preferredTimeSlot})</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400">Doorstep Pickup</span>
                        <p className="text-emerald-400 font-semibold">{b.doorstepPickup ? 'Yes (Valet Pickup)' : 'Self Drop'}</p>
                      </div>
                    </div>

                    {b.pickupAddress && (
                      <p className="text-xs text-slate-400 bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 truncate">
                        📍 {b.pickupAddress}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: GST TAX INVOICES & HISTORY */}
        {activeTab === 'INVOICES' && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h2 className="text-lg font-black text-white">GST Tax Invoices & Service History</h2>
              <p className="text-xs text-slate-400">Download official tax invoices, warranty certificates, and parts list</p>
            </div>

            <div className="space-y-3">
              {myJobCards.map((card) => {
                const subtotal = card.tasks.reduce((sum, t) => sum + (t.customerPrice || 0), 0);
                const tax = Math.round((subtotal * card.taxRate) / 100);
                const total = subtotal + tax - card.discount;

                return (
                  <div key={card.id} className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-black text-white text-base">{card.vehicle.registrationNumber}</span>
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-xs font-semibold">
                          {card.vehicle.make} {card.vehicle.model}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Invoice No: <span className="font-mono text-blue-400 font-bold">INV-{card.id.replace('JC-', '')}</span> • Date: {card.createdAt}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 self-stretch sm:self-auto justify-between sm:justify-start">
                      <div className="text-right">
                        <span className="text-lg font-black text-emerald-400 font-mono">₹{total.toLocaleString('en-IN')}</span>
                        <p className="text-[10px] text-slate-400">Incl. 18% GST</p>
                      </div>

                      <button
                        onClick={() => setSelectedInvoiceCard(card)}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-blue-400" />
                        View GST Invoice
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </main>

      {/* Add Vehicle Modal */}
      {isAddVehicleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-black text-white">Add New Vehicle to Garage</h3>
              <button onClick={() => setIsAddVehicleOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVehicle} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Registration Number</label>
                <input
                  type="text"
                  value={vehReg}
                  onChange={(e) => setVehReg(e.target.value)}
                  placeholder="e.g. MH04AB1234"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm uppercase placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Make</label>
                  <input
                    type="text"
                    value={vehMake}
                    onChange={(e) => setVehMake(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Model</label>
                  <input
                    type="text"
                    value={vehModel}
                    onChange={(e) => setVehModel(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Fuel Type</label>
                  <select
                    value={vehFuel}
                    onChange={(e) => setVehFuel(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="Petrol">Petrol</option>
                    <option value="Diesel">Diesel</option>
                    <option value="CNG">CNG</option>
                    <option value="Electric">Electric</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Year</label>
                  <input
                    type="number"
                    value={vehYear}
                    onChange={(e) => setVehYear(Number(e.target.value))}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddVehicleOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-md shadow-blue-600/30 cursor-pointer"
                >
                  Save Vehicle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Book Service Modal */}
      {isBookServiceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-black text-white">Book Car Service Appointment</h3>
              <button onClick={() => setIsBookServiceOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBooking} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Select Vehicle</label>
                <select
                  value={bookReg}
                  onChange={(e) => setBookReg(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {vehicles.map(v => (
                    <option key={v.id} value={v.registrationNumber}>
                      {v.registrationNumber} - {v.make} {v.model}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Service Package</label>
                <select
                  value={bookServiceTitle}
                  onChange={(e) => setBookServiceTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {cityServices.map(s => (
                    <option key={s.id} value={s.title}>{s.title}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Preferred Date</label>
                  <input
                    type="date"
                    value={bookDate}
                    onChange={(e) => setBookDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Time Slot</label>
                  <select
                    value={bookTime}
                    onChange={(e) => setBookTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="09:00 AM">09:00 AM - 11:00 AM</option>
                    <option value="11:00 AM">11:00 AM - 01:00 PM</option>
                    <option value="02:00 PM">02:00 PM - 04:00 PM</option>
                    <option value="04:00 PM">04:00 PM - 06:00 PM</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bookPickup}
                    onChange={(e) => setBookPickup(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Include Free Doorstep Valet Pickup & Drop</span>
                </label>
              </div>

              {bookPickup && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Pickup Address</label>
                  <textarea
                    rows={2}
                    value={bookAddress}
                    onChange={(e) => setBookAddress(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBookServiceOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-md shadow-blue-600/30 cursor-pointer"
                >
                  Confirm Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Viewer Modal */}
      {selectedInvoiceCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-2xl shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-black text-white">GST Tax Invoice</h3>
              </div>
              <button onClick={() => setSelectedInvoiceCard(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-4 font-mono">
              <div className="flex justify-between border-b border-slate-800 pb-3">
                <div>
                  <p className="font-black text-white text-sm">FixoCar Network India Pvt Ltd</p>
                  <p className="text-slate-400">GSTIN: 27AABCF1234F1Z8 • SAC: 998729</p>
                  <p className="text-slate-400">Workshop: {selectedInvoiceCard.workshopName || 'FixoCar Central Hub'}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-white">INV-{selectedInvoiceCard.id.replace('JC-', '')}</p>
                  <p className="text-slate-400">Date: {selectedInvoiceCard.createdAt}</p>
                  <p className="text-emerald-400 font-bold">PAID</p>
                </div>
              </div>

              <div className="flex justify-between border-b border-slate-800 pb-3">
                <div>
                  <p className="font-bold text-slate-300">Customer Details:</p>
                  <p className="text-white">{selectedInvoiceCard.customer.name}</p>
                  <p className="text-slate-400">Phone: {selectedInvoiceCard.customer.phone}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-300">Vehicle Details:</p>
                  <p className="text-white font-bold">{selectedInvoiceCard.vehicle.registrationNumber}</p>
                  <p className="text-slate-400">{selectedInvoiceCard.vehicle.year} {selectedInvoiceCard.vehicle.make} {selectedInvoiceCard.vehicle.model}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-4 font-bold text-slate-400 pb-1 border-b border-slate-800">
                  <span className="col-span-2">Description / Part</span>
                  <span className="text-center">SAC/HSN</span>
                  <span className="text-right">Amount (₹)</span>
                </div>
                {selectedInvoiceCard.tasks.map((t, idx) => (
                  <div key={idx} className="grid grid-cols-4 text-slate-200">
                    <span className="col-span-2">{t.title}</span>
                    <span className="text-center text-slate-400">998729</span>
                    <span className="text-right">₹{t.customerPrice?.toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-800 space-y-1 text-right">
                <p className="text-slate-400">Subtotal: ₹{selectedInvoiceCard.tasks.reduce((s, t) => s + (t.customerPrice || 0), 0).toLocaleString('en-IN')}</p>
                <p className="text-slate-400">GST (18%): ₹{Math.round((selectedInvoiceCard.tasks.reduce((s, t) => s + (t.customerPrice || 0), 0) * 18) / 100).toLocaleString('en-IN')}</p>
                {selectedInvoiceCard.discount > 0 && (
                  <p className="text-emerald-400">Promo Discount: -₹{selectedInvoiceCard.discount}</p>
                )}
                <p className="text-base font-black text-white pt-1 border-t border-slate-800">
                  Total Paid: ₹{(
                    selectedInvoiceCard.tasks.reduce((s, t) => s + (t.customerPrice || 0), 0) +
                    Math.round((selectedInvoiceCard.tasks.reduce((s, t) => s + (t.customerPrice || 0), 0) * 18) / 100) -
                    selectedInvoiceCard.discount
                  ).toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Print / Save PDF
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
