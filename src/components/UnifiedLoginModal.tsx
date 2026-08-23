import React, { useState } from 'react';
import { 
  X, Lock, Mail, User, ShieldCheck, Wrench, Hammer, Palette, 
  Truck, Building2, UserCheck, AlertCircle, ArrowRight, Sparkles, KeyRound
} from 'lucide-react';
import { AuthUser, UserRole } from '../types';
import { authenticateUser } from '../lib/storage';

interface UnifiedLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: AuthUser) => void;
  defaultTab?: 'STAFF' | 'CUSTOMER';
}

export const UnifiedLoginModal: React.FC<UnifiedLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  defaultTab = 'STAFF',
}) => {
  const [activeTab, setActiveTab] = useState<'STAFF' | 'CUSTOMER'>(defaultTab);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Please enter your Login ID, Email ID, or Phone Number');
      return;
    }

    setIsLoading(true);
    setError(null);

    setTimeout(() => {
      const result = authenticateUser(identifier, password);
      setIsLoading(false);
      if (result.success && result.user) {
        onLoginSuccess(result.user);
        onClose();
      } else {
        setError(result.error || 'Authentication failed. Please check your credentials.');
      }
    }, 200);
  };

  const handleQuickLogin = (id: string, pass: string = 'password123') => {
    setIdentifier(id);
    setPassword(pass);
    setError(null);
    setIsLoading(true);
    setTimeout(() => {
      const result = authenticateUser(id, pass);
      setIsLoading(false);
      if (result.success && result.user) {
        onLoginSuccess(result.user);
        onClose();
      } else {
        setError(result.error || 'Login failed');
      }
    }, 150);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden relative">
        {/* Top Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <KeyRound className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">FixoCar Secure Sign In</h2>
              <p className="text-xs text-slate-400">Access your role-specific dashboard & allotted tasks</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher: Staff & Contractors vs Customer */}
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => { setActiveTab('STAFF'); setError(null); }}
              className={`py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                activeTab === 'STAFF'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              Staff & Contractors
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('CUSTOMER'); setError(null); }}
              className={`py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                activeTab === 'CUSTOMER'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              Customer Portal
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                {activeTab === 'STAFF' ? 'Login ID or Work Email ID' : 'Mobile Number or Email ID'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={
                    activeTab === 'STAFF'
                      ? 'e.g. rajesh.mechanic or marcus.vance'
                      : 'e.g. 8819915656 or vikramaditya'
                  }
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-300">Password</label>
                <span className="text-[11px] text-slate-400">Default: password123</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In to {activeTab === 'STAFF' ? 'Workspace' : 'Dashboard'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Login Chips */}
          <div className="pt-3 border-t border-slate-800/80">
            <div className="flex items-center gap-1.5 mb-2.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                1-Click Quick Demo Sign-Ins
              </span>
            </div>

            {activeTab === 'STAFF' ? (
              <div className="grid grid-cols-2 gap-2 text-left">
                <button
                  type="button"
                  onClick={() => handleQuickLogin('rajesh.mechanic')}
                  className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-left transition-all group"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <Wrench className="w-3 h-3" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-white truncate group-hover:text-blue-400">Rajesh Sharma</p>
                      <p className="text-[10px] text-slate-400 truncate">Mechanic (Payroll)</p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('david.denter')}
                  className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-left transition-all group"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                      <Hammer className="w-3 h-3" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-white truncate group-hover:text-blue-400">David O'Connor</p>
                      <p className="text-[10px] text-slate-400 truncate">Denter (Contractor)</p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('kenji.paint')}
                  className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-left transition-all group"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                      <Palette className="w-3 h-3" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-white truncate group-hover:text-blue-400">Kenji Sato</p>
                      <p className="text-[10px] text-slate-400 truncate">Painter (Contractor)</p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('alex.logistics')}
                  className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-left transition-all group"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                      <Truck className="w-3 h-3" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-white truncate group-hover:text-blue-400">Alex Rivera</p>
                      <p className="text-[10px] text-slate-400 truncate">Logistics / Delivery</p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('precisionlathe')}
                  className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-left transition-all group"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
                      <Building2 className="w-3 h-3" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-white truncate group-hover:text-blue-400">Precision Lathe</p>
                      <p className="text-[10px] text-slate-400 truncate">Sublet Lathe Vendor</p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('marcus.vance')}
                  className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-left transition-all group"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                      <UserCheck className="w-3 h-3" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-white truncate group-hover:text-blue-400">Marcus Vance</p>
                      <p className="text-[10px] text-slate-400 truncate">Floor Manager</p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('admin', 'password123')}
                  className="col-span-2 p-2.5 rounded-xl bg-gradient-to-r from-slate-900 to-blue-950 hover:to-blue-900 border border-blue-900/50 text-left transition-all group flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-3 h-3" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-white group-hover:text-blue-300">Workshop Administrator / Super Admin</p>
                      <p className="text-[10px] text-slate-400">Full executive access across all workshops & settings</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    Login ⚡
                  </span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleQuickLogin('8819915656')}
                  className="w-full p-3 rounded-2xl bg-gradient-to-r from-blue-950 to-slate-900 hover:from-blue-900 hover:to-slate-800 border border-blue-800/40 text-left transition-all group flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-600/30 text-blue-400 flex items-center justify-center font-black">
                      V
                    </div>
                    <div>
                      <p className="text-xs font-black text-white group-hover:text-blue-300">Vikramaditya Singh</p>
                      <p className="text-[10px] text-slate-400 font-mono">📱 +91 8819915656 • 3 Registered Cars</p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-blue-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    Sign In <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
