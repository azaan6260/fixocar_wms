import React, { useState } from 'react';
import { 
  Wrench, Shield, Clock, CheckCircle2, Phone, Search, Car, 
  ArrowRight, Star, ChevronRight, MapPin, Sparkles, AlertCircle,
  Settings, KeyRound, User, Lock, Fuel, Check, RefreshCw, Zap
} from 'lucide-react';
import { CityServiceOffering, JobCard, INDIAN_CITIES } from '../types';
import { getCityServices, getJobCards } from '../lib/storage';

interface CommonHomePageProps {
  onOpenLogin: (tab?: 'STAFF' | 'CUSTOMER') => void;
  onBookService?: (serviceTitle?: string) => void;
  onTrackPlate?: (regNumber: string) => void;
}

export const CommonHomePage: React.FC<CommonHomePageProps> = ({
  onOpenLogin,
  onBookService,
  onTrackPlate,
}) => {
  const [selectedCity, setSelectedCity] = useState<string>('Mumbai');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchReg, setSearchReg] = useState<string>('');
  const [trackedCard, setTrackedCard] = useState<JobCard | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const cityServices = getCityServices();
  const jobCards = getJobCards();

  const handleSearchVehicle = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchReg.trim()) {
      setSearchError('Please enter a vehicle registration number (e.g. MH02CB9988)');
      setTrackedCard(null);
      return;
    }

    const cleanInput = searchReg.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const found = jobCards.find(card => 
      card.vehicle?.registrationNumber?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().includes(cleanInput)
    );

    if (found) {
      setTrackedCard(found);
      setSearchError(null);
    } else {
      setSearchError(`No active workshop repair found for "${searchReg}". (Try demo: MH02CB9988 or KA01MJ8821)`);
      setTrackedCard(null);
    }
  };

  const filteredServices = cityServices.filter(srv => {
    if (selectedCategory === 'ALL') return true;
    return srv.category === selectedCategory;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS':
        return <span className="px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold border border-blue-500/30 flex items-center gap-1.5"><RefreshCw className="w-3 h-3 animate-spin" /> Repair in Progress</span>;
      case 'QC_PENDING':
        return <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold border border-amber-500/30 flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> Quality Check Pending</span>;
      case 'READY_FOR_DELIVERY':
        return <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30 flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3" /> Ready for Delivery</span>;
      case 'OUT_FOR_DELIVERY':
        return <span className="px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold border border-cyan-500/30 flex items-center gap-1.5"><Car className="w-3 h-3" /> Out for Delivery</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-bold border border-slate-700">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-blue-600 selection:text-white font-sans">
      
      {/* Top Universal Navbar */}
      <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
              <Wrench className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-black tracking-tight text-white">Fixo<span className="text-blue-500">Car</span></span>
                <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-wider border border-blue-500/30">Auto Hub</span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Smart Car Service & Workshop Network</p>
            </div>
          </div>

          {/* Quick Helpline & Navigation */}
          <div className="hidden lg:flex items-center gap-8 text-xs font-bold text-slate-300">
            <a href="#services" className="hover:text-blue-400 transition-colors">Services & Pricing</a>
            <a href="#tracker" className="hover:text-blue-400 transition-colors">Live Vehicle Tracker</a>
            <a href="#compare" className="hover:text-blue-400 transition-colors">Why FixoCar</a>
            <a href="#workshops" className="hover:text-blue-400 transition-colors">Workshop Bays</a>
            <div className="flex items-center gap-2 pl-4 border-l border-slate-800 text-slate-300">
              <Phone className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-mono text-slate-200">8819915656</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-black border border-emerald-500/20">24x7</span>
            </div>
          </div>

          {/* Customer & WMS Staff Actions */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.history.pushState({}, '', '/wms');
                  window.dispatchEvent(new Event('popstate'));
                }
              }}
              className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-400 hover:text-amber-300 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
              title="Workshop Management System Staff Gateway (/wms)"
            >
              <Wrench className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">WMS Portal (/wms)</span>
              <span className="sm:hidden">WMS</span>
            </button>

            <button
              onClick={() => onOpenLogin('CUSTOMER')}
              className="px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black transition-all shadow-lg shadow-blue-600/30 flex items-center gap-2 cursor-pointer"
            >
              <User className="w-4 h-4" />
              <span>Customer Sign In</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section with Live Plate Search */}
      <section className="relative pt-12 pb-20 overflow-hidden">
        {/* Background Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-blue-600/15 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>India's Most Trusted Multi-Brand Auto Service Network</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight">
              Worry-Free Car Care & <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Transparent Repairs</span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Up to 40% more affordable than dealer centers. 100% genuine OEM spares, 6-month warranty, and live job card milestones updated in real time.
            </p>
          </div>

          {/* Instant Vehicle Live Tracker Box */}
          <div id="tracker" className="mt-10 max-w-2xl mx-auto">
            <div className="bg-slate-900/90 border border-slate-800 p-3 sm:p-4 rounded-3xl shadow-2xl backdrop-blur-xl">
              <form onSubmit={handleSearchVehicle} className="flex flex-col sm:flex-row items-center gap-2.5">
                <div className="relative flex-1 w-full">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                    <Car className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    value={searchReg}
                    onChange={(e) => setSearchReg(e.target.value)}
                    placeholder="Enter Car Registration (e.g. MH02CB9988)"
                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-white font-mono text-sm placeholder-slate-500 uppercase tracking-wider focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                  <Search className="w-4 h-4" />
                  <span>Check Live Status</span>
                </button>
              </form>

              {/* Search Error */}
              {searchError && (
                <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{searchError}</span>
                </div>
              )}

              {/* Found Job Card Result */}
              {trackedCard && (
                <div className="mt-4 p-4 rounded-2xl bg-slate-950 border border-blue-900/40 text-left animate-fadeIn">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-white text-base">
                          {trackedCard.vehicle.registrationNumber}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-xs font-semibold">
                          {trackedCard.vehicle.year} {trackedCard.vehicle.make} {trackedCard.vehicle.model}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Job Card ID: <span className="font-mono text-blue-400 font-bold">{trackedCard.id}</span> • {trackedCard.workshopName || 'FixoCar Hub'}
                      </p>
                    </div>
                    <div>{getStatusBadge(trackedCard.status)}</div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/60">
                      <p className="text-slate-400 text-[10px] uppercase font-bold">Service Package</p>
                      <p className="text-white font-bold truncate mt-0.5">{trackedCard.packageName || trackedCard.serviceType}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/60">
                      <p className="text-slate-400 text-[10px] uppercase font-bold">Service Supervisor</p>
                      <p className="text-white font-bold truncate mt-0.5">{trackedCard.floorManagerName || 'Service Supervisor'}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/60">
                      <p className="text-slate-400 text-[10px] uppercase font-bold">Tasks Progress</p>
                      <p className="text-emerald-400 font-bold mt-0.5">
                        {trackedCard.tasks.filter(t => t.status === 'COMPLETED').length} / {trackedCard.tasks.length} Completed
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/60">
                      <p className="text-slate-400 text-[10px] uppercase font-bold">Est. Ready By</p>
                      <p className="text-white font-bold truncate mt-0.5">{trackedCard.estimatedCompletionDate}</p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      Want detailed task breakdowns & invoice approvals?
                    </span>
                    <button
                      onClick={() => onOpenLogin('CUSTOMER')}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <span>Sign In to Customer Portal</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Key Value Propositions */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-left">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">40% Cheaper than Dealers</h3>
              <p className="text-xs text-slate-400 mt-1">Zero hidden costs, fixed transparent labor and OEM parts.</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-left">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">100% Genuine OEM Spares</h3>
              <p className="text-xs text-slate-400 mt-1">Directly sourced manufacturer parts with verifiable barcodes.</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-left">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">6-Month Warranty</h3>
              <p className="text-xs text-slate-400 mt-1">Comprehensive repair warranty backed across all workshop hubs.</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-left">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-3">
                <Car className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Free Doorstep Pickup</h3>
              <p className="text-xs text-slate-400 mt-1">Convenient contactless pickup and drop from your home or office.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Services & Transparent Rates Section */}
      <section id="services" className="py-16 bg-slate-900/40 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Transparent Pricing</span>
              <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">Popular Service Packages</h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">Select your city for verified rates with parts, labor & GST included.</p>
            </div>

            {/* City Selector */}
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-bold focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                {INDIAN_CITIES.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6">
            {[
              { id: 'ALL', label: 'All Services' },
              { id: 'MECHANICAL', label: 'Periodic & Mechanical' },
              { id: 'PAINT', label: 'Denting & Paint' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Service Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServices.map((srv) => {
              const price = srv.cityPrices[selectedCity] || 2999;
              return (
                <div
                  key={srv.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl p-6 flex flex-col justify-between transition-all hover:shadow-xl group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-wider border border-blue-500/20">
                        {srv.category}
                      </span>
                      <div className="text-right">
                        <span className="text-2xl font-black text-white">₹{price.toLocaleString('en-IN')}</span>
                        <p className="text-[10px] text-slate-400">All-Inclusive ({selectedCity})</p>
                      </div>
                    </div>

                    <h3 className="text-base font-extrabold text-white group-hover:text-blue-400 transition-colors">
                      {srv.title}
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 line-clamp-2">
                      {srv.tagline}
                    </p>

                    <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Includes:</p>
                      {srv.includedFeatures?.slice(0, 4).map((feat, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400">⏱️ Est. {srv.estimatedHours} Hours</span>
                    <button
                      onClick={() => onOpenLogin('CUSTOMER')}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black transition-all shadow-md shadow-blue-600/30 flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Book Service</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Comparison: Dealer vs FixoCar */}
      <section id="compare" className="py-16 border-t border-slate-800/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Why Vehicle Owners Choose Us</span>
            <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">FixoCar vs Authorized Dealerships</h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">Complete transparency and savings without compromising genuine OEM standards.</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
            <div className="grid grid-cols-3 p-4 sm:p-5 bg-slate-950 border-b border-slate-800 text-xs font-black uppercase tracking-wider">
              <span className="text-slate-400">Service Feature</span>
              <span className="text-blue-400 flex items-center gap-1">⚡ FixoCar Network</span>
              <span className="text-slate-400">Authorized Dealer</span>
            </div>

            <div className="divide-y divide-slate-800/60 text-xs">
              {[
                { feature: 'Periodic Maintenance Cost', fixocar: '₹2,999 - ₹4,499 (40% Savings)', dealer: '₹6,500 - ₹9,500 (High Markup)' },
                { feature: 'Spare Parts Authenticity', fixocar: '100% Genuine OEM / OES with QR', dealer: 'OEM Parts with heavy margins' },
                { feature: 'Live Milestone Tracking', fixocar: 'Real-time photos & digital approval', dealer: 'Phone calls only / No photos' },
                { feature: 'Repair Warranty', fixocar: '6 Months / 10,000 km Warranty', dealer: '1 - 3 Months Warranty' },
                { feature: 'Doorstep Pickup & Drop', fixocar: 'Free Contactless Valet Pickup', dealer: 'Paid or not available' },
                { feature: 'Estimate Approvals', fixocar: '1-Click Digital Approval on Phone', dealer: 'Manual paperwork / surprises' }
              ].map((row, idx) => (
                <div key={idx} className="grid grid-cols-3 p-4 sm:p-5 items-center">
                  <span className="font-bold text-white">{row.feature}</span>
                  <span className="text-emerald-400 font-extrabold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    {row.fixocar}
                  </span>
                  <span className="text-slate-400">{row.dealer}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Workshop Bays Network */}
      <section id="workshops" className="py-16 bg-slate-900/40 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400">State-Of-The-Art Facilities</span>
            <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">Our Workshop Hubs & Bays</h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">Equipped with computerized hydraulic lifts, dust-free paint booths, and OBD-II diagnostics.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-left">
              <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase mb-2">
                <MapPin className="w-3.5 h-3.5" /> Multi-Brand Service Hub
              </div>
              <h3 className="text-base font-extrabold text-white">Full Mechanical & Engine Overhaul Bay</h3>
              <p className="text-xs text-slate-400 mt-1">Computerized OBD-II diagnostics, laser alignment, and synthetic fluid flushing stations.</p>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-300 pt-3 border-t border-slate-800">
                <span className="text-slate-400">Capacity: 12 Active Bays</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">Operational</span>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-left">
              <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase mb-2">
                <MapPin className="w-3.5 h-3.5" /> Body & Collision Center
              </div>
              <h3 className="text-base font-extrabold text-white">Precision Denting & Heated Paint Booth</h3>
              <p className="text-xs text-slate-400 mt-1">Dust-free negative pressure bake booths with computerized OEM color spectrometer matching.</p>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-300 pt-3 border-t border-slate-800">
                <span className="text-slate-400">Capacity: 6 Paint Booths</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">Operational</span>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-left">
              <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase mb-2">
                <MapPin className="w-3.5 h-3.5" /> Detailing & Logistics Hub
              </div>
              <h3 className="text-base font-extrabold text-white">Eco Steam Detailing & Doorstep Valet</h3>
              <p className="text-xs text-slate-400 mt-1">Hot steam interior extraction, 9H ceramic coating bays, and live GPS valet dispatch tracking.</p>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-300 pt-3 border-t border-slate-800">
                <span className="text-slate-400">Doorstep Pickup & Drop</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">Operational</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 border-t border-slate-800/80 bg-slate-950 text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-blue-500" />
            <span className="font-bold text-white">FixoCar Network</span>
            <span>• 24x7 Customer Support Helpline: <span className="font-mono text-slate-200">8819915656</span></span>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium">
            <button onClick={() => onOpenLogin('CUSTOMER')} className="hover:text-white transition-colors cursor-pointer font-semibold text-blue-400">
              Customer Portal Sign In
            </button>
            <span className="text-slate-700">•</span>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.history.pushState({}, '', '/wms');
                  window.dispatchEvent(new Event('popstate'));
                }
              }}
              className="hover:text-amber-300 transition-colors cursor-pointer font-semibold text-amber-400 flex items-center gap-1"
            >
              <Wrench className="w-3.5 h-3.5 text-amber-400" />
              <span>WMS Staff Login (/wms)</span>
            </button>
            <span className="text-slate-700">•</span>
            <span className="text-slate-500">© 2026 FixoCar Automotive Technologies</span>
          </div>
        </div>
      </footer>

    </div>
  );
};
