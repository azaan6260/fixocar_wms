import React, { useState } from 'react';
import { 
  CityServiceOffering, 
  ServiceBookingRequest, 
  INDIAN_CITIES, 
  IndianCity,
  UserRole,
  JobCard
} from '../types';
import { 
  getCityServices, 
  getServiceBookings, 
  createCustomerBooking, 
  updateCityServicePrice,
  getJobCards,
  respondToCustomerApproval
} from '../lib/storage';
import { 
  MapPin, 
  Phone, 
  CheckCircle2, 
  Clock, 
  Search, 
  Car, 
  Calendar, 
  Sparkles, 
  ShieldCheck, 
  Wrench, 
  Truck, 
  Edit3, 
  X, 
  ChevronRight,
  AlertCircle,
  FileText,
  User,
  ArrowRight
} from 'lucide-react';

interface CustomerPortalProps {
  currentRole: UserRole;
  onOpenApprovalModal?: (cardId: string) => void;
}

export function CustomerPortal({ currentRole, onOpenApprovalModal }: CustomerPortalProps) {
  const [selectedCity, setSelectedCity] = useState<IndianCity>('Mumbai');
  const [cityServices, setCityServices] = useState<CityServiceOffering[]>(() => getCityServices());
  const [bookings, setBookings] = useState<ServiceBookingRequest[]>(() => getServiceBookings());
  const [jobCards, setJobCards] = useState<JobCard[]>(() => getJobCards());

  // Active View Tab inside Customer Portal: 'SERVICES' or 'TRACK_ORDER'
  const [activeTab, setActiveTab] = useState<'SERVICES' | 'TRACK_ORDER'>('SERVICES');

  // Selected Service for Booking
  const [bookingService, setBookingService] = useState<CityServiceOffering | null>(null);

  // Booking Form Fields
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('8819915656');
  const [custEmail, setCustEmail] = useState('');
  const [vehNumber, setVehNumber] = useState('');
  const [vehMakeModel, setVehMakeModel] = useState('');
  const [prefDate, setPrefDate] = useState(() => new Date(Date.now() + 86400000).toISOString().split('T')[0]);
  const [prefSlot, setPrefSlot] = useState('10:00 AM - 12:00 PM');
  const [address, setAddress] = useState('');
  const [pickupNeeded, setPickupNeeded] = useState(true);
  const [bookingNotes, setBookingNotes] = useState('');

  // Confirmation state
  const [confirmedBooking, setConfirmedBooking] = useState<{ booking: ServiceBookingRequest; jobCard: JobCard } | null>(null);

  // Search/Track order state
  const [searchPhoneOrId, setSearchPhoneOrId] = useState('');

  // Admin Price Edit Modal
  const [editingService, setEditingService] = useState<CityServiceOffering | null>(null);
  const [newPriceInput, setNewPriceInput] = useState<number>(0);

  const isAdmin = currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN';

  const refreshData = () => {
    setCityServices(getCityServices());
    setBookings(getServiceBookings());
    setJobCards(getJobCards());
  };

  const handleStartBooking = (service: CityServiceOffering) => {
    setBookingService(service);
  };

  const handleCreateBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingService) return;
    if (!custName.trim() || !custPhone.trim() || !vehNumber.trim()) {
      alert('Please fill out customer name, phone, and vehicle registration number.');
      return;
    }

    const price = bookingService.cityPrices[selectedCity] || 3999;

    const result = createCustomerBooking({
      city: selectedCity,
      serviceId: bookingService.id,
      serviceTitle: bookingService.title,
      price: price,
      customerName: custName,
      customerPhone: custPhone,
      customerEmail: custEmail || `${custName.toLowerCase().replace(/\s+/g, '')}@example.com`,
      vehicleNumber: vehNumber.toUpperCase(),
      vehicleMakeModel: vehMakeModel || 'Honda City i-VTEC',
      preferredDate: prefDate,
      preferredTimeSlot: prefSlot,
      address: address || `Downtown, ${selectedCity}`,
      pickupNeeded: pickupNeeded,
      notes: bookingNotes,
    });

    setConfirmedBooking(result);
    setBookingService(null);
    refreshData();
  };

  const handleSavePriceEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;
    updateCityServicePrice(editingService.id, selectedCity, Number(newPriceInput));
    setEditingService(null);
    refreshData();
  };

  const handleCustomerApprovalResponse = (jobCardId: string, taskId: string, approved: boolean) => {
    respondToCustomerApproval(jobCardId, taskId, approved);
    refreshData();
  };

  // Filter customer bookings
  const filteredBookings = bookings.filter((b) => {
    if (!searchPhoneOrId.trim()) return true;
    const query = searchPhoneOrId.toLowerCase();
    return (
      b.id.toLowerCase().includes(query) ||
      b.customerPhone.includes(query) ||
      b.vehicleNumber.toLowerCase().includes(query) ||
      b.customerName.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      
      {/* Hero & City Selection Header (Bento Style) */}
      <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white border border-slate-800 shadow-xl relative overflow-hidden">
        
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 font-mono text-xs font-black border border-blue-500/30 uppercase tracking-widest">
                FIXOCAR • WORRY-FREE CAR REPAIR
              </span>
              <a 
                href="tel:8819915656" 
                className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-extrabold text-xs flex items-center gap-1.5 hover:bg-emerald-500 hover:text-slate-950 transition-colors"
              >
                <Phone className="w-3.5 h-3.5 fill-current" />
                Helpline: 8819915656
              </a>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
              Transparent Service Pricing <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-amber-300 to-emerald-400">
                Booked in 60 Seconds across India
              </span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Select your city to view verified workshop service packages, OEM parts pricing, doorstep pick & drop, and real-time live repair tracking.
            </p>
          </div>

          {/* City Selector Pill */}
          <div className="bg-slate-800/90 border border-slate-700/80 p-4 rounded-2xl w-full lg:w-80 space-y-2 backdrop-blur-md shadow-2xl">
            <label className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-amber-400" />
              Select Your City
            </label>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value as IndianCity)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {INDIAN_CITIES.map((c) => (
                <option key={c} value={c}>
                  📍 {c}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 font-medium pt-1">
              Showing standard workshop service rates for <strong className="text-white">{selectedCity}</strong>
            </p>
          </div>
        </div>

        {/* Navigation Tabs Header inside Customer Portal */}
        <div className="relative z-10 flex items-center gap-3 mt-8 pt-6 border-t border-slate-800/80 overflow-x-auto">
          <button
            onClick={() => setActiveTab('SERVICES')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'SERVICES'
                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Wrench className="w-4 h-4" />
            Standard Services & City Prices ({cityServices.length})
          </button>

          <button
            onClick={() => setActiveTab('TRACK_ORDER')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'TRACK_ORDER'
                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Truck className="w-4 h-4" />
            Track Order & Approvals ({bookings.length})
          </button>
        </div>

        {/* Ambient Glow */}
        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-blue-600/20 blur-3xl pointer-events-none" />
      </div>

      {/* VIEW 1: STANDARD SERVICES CATALOG WITH CITY PRICING */}
      {activeTab === 'SERVICES' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Standard Car Maintenance Packages in {selectedCity}
              </h2>
              <p className="text-xs text-slate-500">
                100% Genuine OEM/OES Spare Parts • Free Doorstep Pick & Drop • 6 Months Workshop Warranty
              </p>
            </div>

            {isAdmin && (
              <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto">
                <Edit3 className="w-3.5 h-3.5" /> Admin City Price Edit Mode Enabled
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cityServices.map((service) => {
              const priceForCity = service.cityPrices[selectedCity] || 3999;

              return (
                <div
                  key={service.id}
                  className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-500 transition-all shadow-xs flex flex-col justify-between overflow-hidden relative group"
                >
                  {service.isPopular && (
                    <div className="absolute top-4 right-4 z-10 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-[10px] px-3 py-1 rounded-full shadow-md uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Most Popular
                    </div>
                  )}

                  <div className="p-6 space-y-4">
                    <div>
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest font-mono">
                        {service.category}
                      </span>
                      <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 mt-0.5 leading-snug">
                        {service.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 font-medium">{service.tagline}</p>
                    </div>

                    {/* Price display in Indian Rupees */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                          Rate in {selectedCity}
                        </span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">
                            ₹{priceForCity.toLocaleString('en-IN')}
                          </span>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                            All Inclusive
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Time Req</span>
                        <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center justify-end gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          {service.estimatedHours} Hours
                        </span>
                      </div>
                    </div>

                    {/* Included Features List */}
                    <div className="space-y-2 pt-1">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Package Scope & Inclusions:</p>
                      <ul className="space-y-1.5">
                        {service.includedFeatures.map((feat, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setEditingService(service);
                          setNewPriceInput(priceForCity);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-purple-600/10 text-purple-600 dark:text-purple-300 hover:bg-purple-600 hover:text-white text-xs font-bold transition-colors flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit Rate
                      </button>
                    )}

                    <button
                      onClick={() => handleStartBooking(service)}
                      className="grow py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition-colors shadow-md flex items-center justify-center gap-1.5"
                    >
                      <span>Book Service for ₹{priceForCity.toLocaleString('en-IN')}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: TRACK CUSTOMER ORDERS & APPROVALS */}
      {activeTab === 'TRACK_ORDER' && (
        <div className="space-y-6">
          
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                  Track Your Booking & Workshop Job Card
                </h2>
                <p className="text-xs text-slate-500">
                  Enter your mobile number, booking ID, or vehicle number to view live repair progress and respond to additional work approvals.
                </p>
              </div>

              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  value={searchPhoneOrId}
                  onChange={(e) => setSearchPhoneOrId(e.target.value)}
                  placeholder="Search Booking ID, Phone, Reg No..."
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {filteredBookings.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-500">
                <Car className="w-12 h-12 mx-auto text-slate-400 mb-2" />
                <h3 className="font-bold text-slate-800 dark:text-slate-200">No Bookings Found</h3>
                <p className="text-xs mt-1">Try searching with phone number 8819915656 or book a new service.</p>
              </div>
            ) : (
              filteredBookings.map((b) => {
                // Find matching job card
                const matchingCard = jobCards.find(jc => jc.id === b.createdJobCardId || jc.vehicle.registrationNumber === b.vehicleNumber);
                const pendingApprovals = matchingCard?.tasks.filter(t => t.requiresCustomerApproval && t.isCustomerApproved === null) || [];

                return (
                  <div
                    key={b.id}
                    className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            Booking #{b.id}
                          </span>
                          {b.createdJobCardId && (
                            <span className="font-mono text-xs font-bold text-slate-500">
                              Workshop Job Card: {b.createdJobCardId}
                            </span>
                          )}
                          <span className="text-xs font-bold text-amber-500 px-2 py-0.5 rounded bg-amber-500/10">
                            {b.city}
                          </span>
                        </div>
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                          {b.serviceTitle} • <span className="font-mono">{b.vehicleNumber}</span> ({b.vehicleMakeModel})
                        </h3>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Booking Status</span>
                        <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          {matchingCard?.status || b.status}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Customer Details</span>
                        <p className="font-bold text-slate-900 dark:text-slate-100">{b.customerName}</p>
                        <p className="text-slate-500">{b.customerPhone}</p>
                        <p className="text-slate-500">{b.address}</p>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Slot & Pickup</span>
                        <p className="font-bold text-slate-900 dark:text-slate-100">{b.preferredDate}</p>
                        <p className="text-slate-500">{b.preferredTimeSlot}</p>
                        <p className="text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                          {b.pickupNeeded ? '✓ Free Doorstep Pickup Requested' : 'Self Drive-in to Workshop'}
                        </p>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Service Price</span>
                        <p className="text-xl font-black text-slate-900 dark:text-slate-100 font-mono">
                          ₹{b.price.toLocaleString('en-IN')}
                        </p>
                        <p className="text-[11px] text-slate-500">All Taxes & Labor Included</p>
                      </div>
                    </div>

                    {/* Customer Additional Work Approval Block */}
                    {matchingCard && pendingApprovals.length > 0 && (
                      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4 text-amber-500" />
                            Discovered Repairs Requiring Your Approval ({pendingApprovals.length})
                          </span>
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded">
                            URGENT DECISION NEEDED
                          </span>
                        </div>

                        <div className="space-y-2">
                          {pendingApprovals.map((task) => (
                            <div
                              key={task.id}
                              className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                            >
                              <div>
                                <p className="font-bold text-slate-900 dark:text-slate-100">{task.title}</p>
                                <p className="text-[11px] text-slate-500">Inspection finding by floor team</p>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className="font-mono font-extrabold text-amber-600 dark:text-amber-400 text-sm">
                                  +₹{task.customerPrice.toLocaleString('en-IN')}
                                </span>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => handleCustomerApprovalResponse(matchingCard.id, task.id, false)}
                                    className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold text-xs"
                                  >
                                    Decline
                                  </button>
                                  <button
                                    onClick={() => handleCustomerApprovalResponse(matchingCard.id, task.id, true)}
                                    className="px-3.5 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs"
                                  >
                                    Approve
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Progress details if job card active */}
                    {matchingCard && (
                      <div className="pt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 dark:border-slate-800">
                        <span>Floor Manager: <strong className="text-slate-800 dark:text-slate-200">{matchingCard.floorManagerName}</strong></span>
                        <a
                          href="tel:8819915656"
                          className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1 hover:underline"
                        >
                          <Phone className="w-3.5 h-3.5" /> Call Workshop: 8819915656
                        </a>
                      </div>
                    )}

                  </div>
                );
              })
            )}
          </div>

        </div>
      )}

      {/* MODAL 1: BOOKING FORM MODAL */}
      {bookingService && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-xl p-6 sm:p-8 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">
                  FixoCar Service Booking • {selectedCity}
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                  {bookingService.title}
                </h3>
              </div>
              <button onClick={() => setBookingService(null)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
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

            <form onSubmit={handleCreateBooking} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Customer Full Name *</label>
                  <input
                    type="text"
                    required
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    placeholder="e.g. Vikramaditya Singh"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    placeholder="8819915656"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Vehicle Registration Number *</label>
                  <input
                    type="text"
                    required
                    value={vehNumber}
                    onChange={(e) => setVehNumber(e.target.value)}
                    placeholder="e.g. MH-02-DN-4521"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Car Make & Model</label>
                  <input
                    type="text"
                    value={vehMakeModel}
                    onChange={(e) => setVehMakeModel(e.target.value)}
                    placeholder="e.g. Honda City 1.5 i-VTEC"
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
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Time Slot</label>
                  <select
                    value={prefSlot}
                    onChange={(e) => setPrefSlot(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
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
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
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

      {/* MODAL 2: CONFIRMED BOOKING SUCCESS MODAL */}
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
                Your service order and workshop job card have been generated. Our floor team in {confirmedBooking.booking.city} will reach out shortly.
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
                  setActiveTab('TRACK_ORDER');
                }}
                className="w-full py-3 rounded-2xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-extrabold text-xs transition-colors"
              >
                Track Live Order Progress →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ADMIN EDIT PRICE MODAL */}
      {editingService && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Update {editingService.title} Rate for {selectedCity}
              </h3>
              <button onClick={() => setEditingService(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePriceEdit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Target City</label>
                <input
                  type="text"
                  disabled
                  value={selectedCity}
                  className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Package Price in Indian Rupees (₹)</label>
                <input
                  type="number"
                  required
                  value={newPriceInput}
                  onChange={(e) => setNewPriceInput(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono font-bold text-base"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs"
              >
                Save Price for {selectedCity}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
