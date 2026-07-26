import React, { useState, useEffect } from 'react';
import { UserRole, City, Workshop, Employee } from '../types';
import { 
  getCities, addCity, deleteCity,
  getWorkshops, addWorkshop, updateWorkshop, deleteWorkshop,
  getEmployees, updateEmployee,
  clearAllDemoData, resetToDefaultMockData
} from '../lib/storage';
import { 
  Building2, MapPin, Plus, Trash2, Edit2, ShieldCheck, 
  Car, Check, Users, RefreshCw, AlertTriangle, Phone, CheckCircle2
} from 'lucide-react';

interface CityWorkshopManagementProps {
  currentRole: UserRole;
  onNavigateEmployees?: () => void;
}

export function CityWorkshopManagementView({ currentRole, onNavigateEmployees }: CityWorkshopManagementProps) {
  const [cities, setCities] = useState<City[]>([]);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [activeTab, setActiveTab] = useState<'CITIES' | 'WORKSHOPS' | 'STAFFING'>('WORKSHOPS');
  const [selectedCityId, setSelectedCityId] = useState<string>('ALL');

  // Form states for new City
  const [showAddCity, setShowAddCity] = useState(false);
  const [newCityName, setNewCityName] = useState('');
  const [newCityState, setNewCityState] = useState('');

  // Form states for new Workshop
  const [showAddWorkshop, setShowAddWorkshop] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [newWsCityId, setNewWsCityId] = useState('');
  const [newWsAddress, setNewWsAddress] = useState('');
  const [newWsPhone, setNewWsPhone] = useState('');
  const [newWsIsCars24, setNewWsIsCars24] = useState(false);
  const [newWsManager, setNewWsManager] = useState('');

  const isAdmin = currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN';

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    const cList = getCities();
    const wList = getWorkshops();
    const eList = getEmployees();
    setCities(cList);
    setWorkshops(wList);
    setEmployees(eList);

    if (cList.length > 0 && !newWsCityId) {
      setNewWsCityId(cList[0].id);
    }
  };

  const handleAddCitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCityName.trim()) return;
    addCity(newCityName.trim(), newCityState.trim());
    setNewCityName('');
    setNewCityState('');
    setShowAddCity(false);
    refreshData();
  };

  const handleDeleteCityClick = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete city "${name}"? Workshops under it may need reassignment.`)) {
      deleteCity(id);
      refreshData();
    }
  };

  const handleAddWorkshopSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim() || !newWsCityId) return;

    const city = cities.find(c => c.id === newWsCityId);
    addWorkshop({
      name: newWsName.trim(),
      cityId: newWsCityId,
      cityName: city?.name || 'Central',
      address: newWsAddress.trim() || 'Workshop Bay',
      phone: newWsPhone.trim() || '+91 98000 00000',
      isCars24Partner: newWsIsCars24,
      managerName: newWsManager.trim() || 'Floor Manager',
    });

    setNewWsName('');
    setNewWsAddress('');
    setNewWsPhone('');
    setNewWsManager('');
    setNewWsIsCars24(false);
    setShowAddWorkshop(false);
    refreshData();
  };

  const handleToggleCars24Partner = (ws: Workshop) => {
    const nextState = !ws.isCars24Partner;
    updateWorkshop(ws.id, { isCars24Partner: nextState });
    refreshData();
  };

  const handleDeleteWorkshopClick = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete workshop "${name}"?`)) {
      deleteWorkshop(id);
      refreshData();
    }
  };

  const handleClearDemoDataClick = () => {
    if (confirm('DANGER: Clear all demo data (Cities, Workshops, Employees, Job Cards)? This allows you to set up everything fresh from scratch.')) {
      clearAllDemoData();
      refreshData();
      alert('All demo data cleared. You can now add cities, workshops, and employees fresh!');
    }
  };

  const handleResetDefaultsClick = () => {
    if (confirm('Reset store back to default initial seed data?')) {
      resetToDefaultMockData();
      refreshData();
    }
  };

  const filteredWorkshops = selectedCityId === 'ALL' 
    ? workshops 
    : workshops.filter(w => w.cityId === selectedCityId);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      
      {/* Top Banner & Title */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30">
              Admin Organization Management
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30">
              Cars24 Partner Vendor Enabled
            </span>
          </div>
          <h2 className="text-2xl font-black tracking-tight">Cities, Workshops & Cars24 Partners</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage multi-city locations, authorize Cars24 vendor hubs, and assign workshop staff.
          </p>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleClearDemoDataClick}
              className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Demo Data (Start Fresh)</span>
            </button>
            <button
              onClick={handleResetDefaultsClick}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('WORKSHOPS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'WORKSHOPS'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Workshops & Cars24 Hubs ({workshops.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('CITIES')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'CITIES'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Cities Directory ({cities.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('STAFFING')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'STAFFING'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Workshop Staff Matrix</span>
          </button>
        </div>

        {activeTab === 'WORKSHOPS' && isAdmin && (
          <button
            onClick={() => setShowAddWorkshop(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Workshop</span>
          </button>
        )}

        {activeTab === 'CITIES' && isAdmin && (
          <button
            onClick={() => setShowAddCity(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add City</span>
          </button>
        )}
      </div>

      {/* CITIES TAB CONTENT */}
      {activeTab === 'CITIES' && (
        <div className="space-y-4">
          
          {showAddCity && (
            <form onSubmit={handleAddCitySubmit} className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4 animate-in fade-in">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                Add New Operational City
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">City Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jaipur, Lucknow, Kochi"
                    value={newCityName}
                    onChange={e => setNewCityName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">State / Region</label>
                  <input
                    type="text"
                    placeholder="e.g. Rajasthan, Uttar Pradesh"
                    value={newCityState}
                    onChange={e => setNewCityState(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddCity(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                >
                  Save City
                </button>
              </div>
            </form>
          )}

          {cities.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-800">
              <MapPin className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Operational Cities Added</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Click "+ Add City" above to add your first city location and start setting up workshops.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cities.map(city => {
                const cityWorkshops = workshops.filter(w => w.cityId === city.id || w.cityName === city.name);
                const cars24Count = cityWorkshops.filter(w => w.isCars24Partner).length;

                return (
                  <div key={city.id} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-bold">
                            <MapPin className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-slate-900 dark:text-white text-base">{city.name}</h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">{city.state || 'India'}</p>
                          </div>
                        </div>

                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteCityClick(city.id, city.name)}
                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Delete City"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex items-center justify-between">
                          <span>Total Workshops:</span>
                          <span className="font-bold text-slate-900 dark:text-white">{cityWorkshops.length}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Cars24 Partner Hubs:</span>
                          <span className="font-bold text-orange-600 dark:text-orange-400">{cars24Count}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedCityId(city.id);
                        setActiveTab('WORKSHOPS');
                      }}
                      className="mt-4 w-full py-2 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold text-xs rounded-xl transition-colors border border-slate-200/80 dark:border-slate-700/80 text-center"
                    >
                      View Workshops in {city.name}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* WORKSHOPS TAB CONTENT */}
      {activeTab === 'WORKSHOPS' && (
        <div className="space-y-4">
          
          {/* Filter Bar */}
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Filter by City:</span>
              <select
                value={selectedCityId}
                onChange={e => setSelectedCityId(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                <option value="ALL">All Operational Cities ({cities.length})</option>
                {cities.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="text-xs font-bold text-slate-500">
              Showing {filteredWorkshops.length} workshop(s)
            </div>
          </div>

          {/* Add Workshop Form */}
          {showAddWorkshop && (
            <form onSubmit={handleAddWorkshopSubmit} className="bg-slate-50 dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4 animate-in fade-in">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                Add New Workshop Bay / Hub
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Workshop Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FixoCar Central Hub - Andheri"
                    value={newWsName}
                    onChange={e => setNewWsName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">City *</label>
                  <select
                    required
                    value={newWsCityId}
                    onChange={e => setNewWsCityId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                  >
                    {cities.length === 0 && <option value="">No Cities Created Yet</option>}
                    {cities.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Address & Bay No.</label>
                  <input
                    type="text"
                    placeholder="e.g. Bay 4, Industrial Area Phase II"
                    value={newWsAddress}
                    onChange={e => setNewWsAddress(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="+91 98000 00000"
                    value={newWsPhone}
                    onChange={e => setNewWsPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Manager Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Marcus Vance"
                    value={newWsManager}
                    onChange={e => setNewWsManager(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                {/* CARS24 PARTNER VENDOR TOGGLE */}
                <div className="flex items-center gap-3 pt-4 sm:col-span-2 bg-orange-50 dark:bg-orange-950/40 p-3 rounded-xl border border-orange-200 dark:border-orange-800">
                  <input
                    type="checkbox"
                    id="newWsIsCars24"
                    checked={newWsIsCars24}
                    onChange={e => setNewWsIsCars24(e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                  />
                  <label htmlFor="newWsIsCars24" className="text-xs font-extrabold text-orange-900 dark:text-orange-200 cursor-pointer">
                    Activate as Cars24 Vendor Partner Hub
                    <span className="block text-[11px] font-normal text-orange-700 dark:text-orange-300">
                      Enables receiving, inspecting, and managing Cars24 fleet cars & separate B2B billing stream.
                    </span>
                  </label>
                </div>

              </div>

              <div className="flex items-center gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddWorkshop(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                >
                  Save Workshop
                </button>
              </div>
            </form>
          )}

          {/* Workshops List Grid */}
          {filteredWorkshops.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-800">
              <Building2 className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Workshops Found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                No workshops added yet for this filter. Add your first workshop location to begin processing cars.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredWorkshops.map(ws => {
                const wsEmployees = employees.filter(e => e.workshopId === ws.id || e.workshopName === ws.name);

                return (
                  <div 
                    key={ws.id}
                    className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border shadow-xs flex flex-col justify-between transition-all ${
                      ws.isCars24Partner 
                        ? 'border-orange-300 dark:border-orange-900/60 ring-1 ring-orange-500/20' 
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div>
                      {/* Header with Name & Cars24 Badge */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-start gap-3">
                          <div className={`p-2.5 rounded-2xl shrink-0 ${
                            ws.isCars24Partner 
                              ? 'bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800' 
                              : 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                          }`}>
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-extrabold text-slate-900 dark:text-white text-base">
                                {ws.name}
                              </h4>
                              {ws.isCars24Partner && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/30">
                                  <Car className="w-3 h-3" />
                                  Cars24 Vendor Partner
                                </span>
                              )}
                            </div>
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                              <MapPin className="w-3.5 h-3.5 text-blue-600" />
                              {ws.cityName}
                            </span>
                          </div>
                        </div>

                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteWorkshopClick(ws.id, ws.name)}
                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Delete Workshop"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Details */}
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1.5 text-xs text-slate-600 dark:text-slate-300 mb-4">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Address:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{ws.address}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Manager:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{ws.managerName || 'Assigned Manager'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Phone:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{ws.phone}</span>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                          <span className="text-slate-500">Assigned Staff Count:</span>
                          <span className="font-black text-blue-600 dark:text-blue-400">{wsEmployees.length} Employee(s)</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Controls: Toggle Cars24 Vendor Status */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`toggle-c24-${ws.id}`}
                          checked={ws.isCars24Partner}
                          onChange={() => handleToggleCars24Partner(ws)}
                          className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500 cursor-pointer"
                        />
                        <label 
                          htmlFor={`toggle-c24-${ws.id}`}
                          className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                        >
                          Cars24 Vendor Partner
                        </label>
                      </div>

                      <button
                        onClick={() => {
                          if (onNavigateEmployees) onNavigateEmployees();
                        }}
                        className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline"
                      >
                        Manage Staff →
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* STAFFING MATRIX TAB CONTENT */}
      {activeTab === 'STAFFING' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Workshop Staffing Matrix</h3>
              <p className="text-xs text-slate-500">Overview of employees assigned across different cities & workshops.</p>
            </div>
            {onNavigateEmployees && (
              <button
                onClick={onNavigateEmployees}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all"
              >
                Open Employee Manager →
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {employees.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No employees found. Add employees in the Employee Directory.</p>
            ) : (
              employees.map(emp => (
                <div key={emp.id} className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center">
                      {emp.name.charAt(0)}
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">{emp.name}</span>
                      <span className="text-[11px] text-slate-500">{emp.role} • {emp.specializedTeam}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 font-medium text-slate-700 dark:text-slate-300">
                      📍 {emp.cityName || 'City Unassigned'} - {emp.workshopName || 'Workshop Unassigned'}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      emp.status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {emp.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

    </div>
  );
}
