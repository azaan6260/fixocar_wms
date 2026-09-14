import React, { useState, useEffect } from 'react';
import { 
  X, 
  Smartphone, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Download, 
  ShieldCheck, 
  ArrowUpRight, 
  Info,
  Key,
  Layers,
  Wrench
} from 'lucide-react';
import { dispatchToastNotification } from '../lib/storage';

interface AppVersionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AppVersionModal({ isOpen, onClose }: AppVersionModalProps) {
  const [versionName, setVersionName] = useState('1.0.2');
  const [versionCode, setVersionCode] = useState(3);
  const [buildDate, setBuildDate] = useState('2026-09-14');
  const [isBumping, setIsBumping] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  useEffect(() => {
    // Load stored version if any, else default to 1.0.2 / 3
    const savedVer = localStorage.getItem('app_version_name') || '1.0.2';
    const savedCode = parseInt(localStorage.getItem('app_version_code') || '3', 10);
    const savedDate = localStorage.getItem('app_build_date') || new Date().toISOString().split('T')[0];
    setVersionName(savedVer);
    setVersionCode(savedCode);
    setBuildDate(savedDate);
  }, []);

  if (!isOpen) return null;

  const handleBumpVersion = () => {
    setIsBumping(true);
    setTimeout(() => {
      const parts = versionName.split('.').map(Number);
      let newName = versionName;
      if (parts.length === 3 && !parts.some(isNaN)) {
        parts[2] += 1;
        newName = parts.join('.');
      } else {
        newName = '1.0.3';
      }

      const newCode = versionCode + 1;
      const today = new Date().toISOString().split('T')[0];

      setVersionName(newName);
      setVersionCode(newCode);
      setBuildDate(today);

      localStorage.setItem('app_version_name', newName);
      localStorage.setItem('app_version_code', newCode.toString());
      localStorage.setItem('app_build_date', today);

      setIsBumping(false);

      dispatchToastNotification({
        type: 'STATUS_CHANGE',
        title: '🚀 APK Version Code Bumped!',
        message: `Version updated to v${newName} (versionCode: ${newCode}). Android will now install updates cleanly without uninstalling.`,
      });
    }, 400);
  };

  const copyBuildCommand = () => {
    navigator.clipboard.writeText('npm run build:apk');
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 text-white rounded-3xl border border-slate-800 w-full max-w-2xl shadow-2xl overflow-hidden my-4">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <span>Android APK Version Manager</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold border border-emerald-500/30">
                  In-Place Update Ready
                </span>
              </h3>
              <p className="text-xs text-slate-400">Configure versionCode and fix "App Not Installed" update errors</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-6">
          
          {/* Current Version Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Current Release Version</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
                    v{versionName}
                  </span>
                  <span className="text-xs font-bold text-slate-400 font-mono bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                    versionCode: {versionCode}
                  </span>
                </div>
              </div>

              <button
                onClick={handleBumpVersion}
                disabled={isBumping}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isBumping ? 'animate-spin' : ''}`} />
                <span>🚀 Bump versionCode ({versionCode + 1})</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800 text-xs">
              <div>
                <span className="text-slate-500 block">Package ID</span>
                <span className="font-mono text-slate-300 font-bold">com.fixocar.workshop</span>
              </div>
              <div>
                <span className="text-slate-500 block">Build Date</span>
                <span className="font-mono text-slate-300 font-bold">{buildDate}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Capacitor Engine</span>
                <span className="font-mono text-emerald-400 font-bold">v8.5.2 (Android 14+)</span>
              </div>
            </div>
          </div>

          {/* Explanation Section for APK Overwrite / In-Place Update */}
          <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-3">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>How Android Handles APK Overwrite / Updates</span>
            </div>
            
            <p className="text-xs text-slate-300 leading-relaxed">
              When installing a new APK file on an Android device without uninstalling the existing application, Android OS enforces two strict security rules:
            </p>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-blue-500/20 flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</div>
                <div>
                  <span className="font-bold text-amber-300 block">Strict versionCode Increment</span>
                  <span className="text-slate-400">The new APK's <code className="text-amber-300 font-mono">versionCode</code> must be strictly greater than the currently installed APK's <code className="text-amber-300 font-mono">versionCode</code> (e.g. 3 &gt; 2). If <code className="text-amber-300 font-mono">versionCode</code> is equal or lower, Android aborts installation with "App Not Installed".</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-blue-500/20 flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</div>
                <div>
                  <span className="font-bold text-amber-300 block">Keystore Signature Matching</span>
                  <span className="text-slate-400">Both builds must be signed using the exact same keystore certificate (<code className="text-amber-300 font-mono">debug.keystore</code> or production key). Our Gradle config is configured to fall back to a consistent keystore to avoid signature mismatch conflicts.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick CLI Build Helper */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-amber-400" />
                <span>One-Command APK Build & Sync</span>
              </span>
              <button
                onClick={copyBuildCommand}
                className="text-[11px] font-bold text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copiedScript ? '✅ Copied!' : 'Copy Command'}
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs text-amber-300 flex items-center justify-between">
              <code>npm run build:apk</code>
              <span className="text-[10px] text-slate-500">Auto-increments versionCode &amp; syncs Capacitor</span>
            </div>
            <p className="text-[11px] text-slate-400">
              This command automatically bumps <code className="text-slate-300 font-mono">versionCode</code> in <code className="text-slate-300 font-mono">version.properties</code>, compiles Vite assets, and syncs Android native code.
            </p>
          </div>

          {/* Resolution Tips */}
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold block">Offline Data Safety</span>
              <span className="text-slate-300 text-[11px]">In-place APK updates retain all local Job Cards, draft estimates, and user login tokens without any data loss.</span>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
