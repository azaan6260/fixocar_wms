import React, { useState, useEffect } from 'react';
import { 
  X, Lock, Mail, User, ShieldCheck, Wrench, AlertCircle, ArrowRight, Phone, MapPin, Building2, Fingerprint, ScanFace, Smartphone, CheckCircle2
} from 'lucide-react';
import { AuthUser } from '../types';
import { authenticateUser, saveAuthUser, INITIAL_CITIES } from '../lib/storage';
import { authenticateViaSupabase } from '../lib/supabaseClient';
import { 
  getSavedBiometricBinding, 
  authenticateWithBiometrics, 
  registerBiometricForUser, 
  checkBiometricSupport,
  BiometricBinding 
} from '../lib/biometricAuth';

interface UnifiedLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: AuthUser) => void;
  initialTab?: 'STAFF' | 'CUSTOMER';
  defaultTab?: 'STAFF' | 'CUSTOMER';
  forcedMode?: 'STAFF' | 'CUSTOMER';
}

export const UnifiedLoginModal: React.FC<UnifiedLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  initialTab = 'CUSTOMER',
  defaultTab,
  forcedMode,
}) => {
  const [activeTab, setActiveTab] = useState<'STAFF' | 'CUSTOMER'>(forcedMode || defaultTab || initialTab);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [selectedCity, setSelectedCity] = useState('Mumbai');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBiometricScanning, setIsBiometricScanning] = useState(false);
  const [savedBinding, setSavedBinding] = useState<BiometricBinding | null>(null);
  const [biometricNotice, setBiometricNotice] = useState<string | null>(null);

  useEffect(() => {
    if (forcedMode) {
      setActiveTab(forcedMode);
    } else if (defaultTab) {
      setActiveTab(defaultTab);
    } else if (initialTab) {
      setActiveTab(initialTab);
    }
    setError(null);
    setBiometricNotice(null);
    setIdentifier('');
    setPassword('');
    setSavedBinding(getSavedBiometricBinding());
  }, [isOpen, initialTab, defaultTab, forcedMode]);

  if (!isOpen) return null;

  const handleBiometricLogin = async () => {
    setIsBiometricScanning(true);
    setError(null);
    setBiometricNotice(null);

    try {
      const res = await authenticateWithBiometrics();
      setIsBiometricScanning(false);

      if (res.success && res.user) {
        onLoginSuccess(res.user);
        onClose();
      } else {
        setError(res.error || 'Biometric scan failed. Please verify with your password.');
      }
    } catch (err: any) {
      setIsBiometricScanning(false);
      setError('Biometric authentication failed. Please enter your work password.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError(activeTab === 'STAFF' ? 'Please enter your Work Login ID or Email' : 'Please enter your Mobile Number or Email ID');
      return;
    }

    if (activeTab === 'STAFF' && !password.trim()) {
      setError('Password is required for staff & admin sign-in.');
      return;
    }

    setIsLoading(true);
    setError(null);

    let result = authenticateUser(
      identifier, 
      password,
      {
        isCustomerLogin: activeTab === 'CUSTOMER',
        customerName: customerName.trim() || undefined,
        city: selectedCity
      }
    );

    // If staff auth failed or not found locally, check directly with Supabase
    if (!result.success && activeTab === 'STAFF') {
      try {
        const supaRes = await authenticateViaSupabase(identifier, password);
        if (supaRes.success && supaRes.user) {
          saveAuthUser(supaRes.user);
          result = { success: true, user: supaRes.user };
        } else if (supaRes.error) {
          result = { success: false, error: supaRes.error };
        }
      } catch (supaErr) {
        console.warn('Supabase remote login check warning:', supaErr);
      }
    }

    setIsLoading(false);
    if (result.success && result.user) {
      // Register biometric binding automatically if staff user logged in on mobile/tablet
      if (activeTab === 'STAFF') {
        registerBiometricForUser(result.user).catch(() => {});
      }
      onLoginSuccess(result.user);
      onClose();
    } else {
      setError(result.error || 'Authentication failed. Please verify your credentials.');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden relative">
        
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              {activeTab === 'STAFF' ? (
                <ShieldCheck className="w-5 h-5 text-white" />
              ) : (
                <User className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">
                {activeTab === 'STAFF' ? 'WMS Staff & Admin Login' : 'Customer Portal Sign In'}
              </h2>
              <p className="text-xs text-slate-400">
                {activeTab === 'STAFF' 
                  ? 'Access allotted tasks & workshop operations' 
                  : 'Track your car live, view invoices & book services'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection (only if not forced) */}
        {!forcedMode && (
          <div className="px-6 pt-4">
            <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => { setActiveTab('CUSTOMER'); setError(null); }}
                className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'CUSTOMER'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                Customer
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('STAFF'); setError(null); }}
                className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'STAFF'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                Staff / Admin
              </button>
            </div>
          </div>
        )}

        {/* Form Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {activeTab === 'STAFF' ? (
              <>
                {/* Biometric Quick Login Banner / Button */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-950/80 to-blue-950/80 border border-blue-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-blue-300">
                      <Fingerprint className="w-4 h-4 text-emerald-400 animate-pulse" />
                      <span>Biometric Mobile Quick Sign-In</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                      Touch ID / Face ID
                    </span>
                  </div>

                  {savedBinding ? (
                    <div className="text-xs text-slate-300 flex items-center justify-between bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span>{savedBinding.userName}</span>
                          <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.2 rounded">{savedBinding.userRole}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">Bound on this mobile device</div>
                      </div>
                      <button
                        type="button"
                        onClick={handleBiometricLogin}
                        disabled={isBiometricScanning}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
                      >
                        {isBiometricScanning ? (
                          <>
                            <ScanFace className="w-3.5 h-3.5 animate-spin" />
                            <span>Scanning...</span>
                          </>
                        ) : (
                          <>
                            <Fingerprint className="w-3.5 h-3.5" />
                            <span>1-Tap Scan</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] text-slate-400">
                        Log in once with your work password to link Fingerprint/Face ID for instant 1-tap mobile access.
                      </p>
                      <button
                        type="button"
                        onClick={handleBiometricLogin}
                        disabled={isBiometricScanning}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-300 border border-blue-500/30 text-xs font-bold shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isBiometricScanning ? (
                          <>
                            <ScanFace className="w-3.5 h-3.5 animate-spin" />
                            <span>Scanning...</span>
                          </>
                        ) : (
                          <>
                            <Fingerprint className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Scan Biometrics</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <div className="relative flex items-center my-1">
                  <div className="flex-grow border-t border-slate-800"></div>
                  <span className="flex-shrink mx-3 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Or Work Password</span>
                  <div className="flex-grow border-t border-slate-800"></div>
                </div>

                {/* Staff Sign In Fields */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Work Login ID / Employee ID / Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="e.g. admin or employee login ID"
                      required
                      autoFocus
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Work Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter work password"
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>Super Admin login: Work ID <span className="text-white font-mono font-bold">admin</span> | Password <span className="text-white font-mono font-bold">password123</span></span>
                </div>
              </>
            ) : (
              <>
                {/* Customer Sign In Fields */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Mobile Number or Email ID
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Phone className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="e.g. 9820011223 or customer@gmail.com"
                      required
                      autoFocus
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Your Name <span className="text-slate-500 font-normal">(Optional for new customers)</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Rohan Mehra"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    City Location
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <select
                      value={selectedCity}
                      onChange={(e) => setSelectedCity(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    >
                      {INITIAL_CITIES.map((c) => (
                        <option key={c.id} value={c.name} className="bg-slate-900 text-white">
                          {c.name} ({c.state})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>
                    {activeTab === 'STAFF' ? 'Sign In to Staff Workspace' : 'Continue to Customer Dashboard'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
