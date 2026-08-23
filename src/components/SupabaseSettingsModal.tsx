import React, { useState } from 'react';
import { getStoredSupabaseConfig, saveSupabaseConfig, clearSupabaseConfig, syncAllEmployeesToSupabase } from '../lib/supabaseClient';
import { getEmployees } from '../lib/storage';
import { SUPABASE_SQL_SCHEMA } from '../lib/supabaseSchema';
import { 
  Database, 
  X, 
  CheckCircle2, 
  Copy, 
  Check, 
  Trash2, 
  ExternalLink,
  Code2,
  RefreshCw,
  Users,
  AlertCircle
} from 'lucide-react';

interface SupabaseSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SupabaseSettingsModal({ isOpen, onClose }: SupabaseSettingsModalProps) {
  if (!isOpen) return null;

  const config = getStoredSupabaseConfig();
  const [url, setUrl] = useState(config.supabaseUrl);
  const [anonKey, setAnonKey] = useState(config.supabaseAnonKey);
  const [serviceKey, setServiceKey] = useState(config.supabaseServiceKey || '');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'schema'>('config');
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseConfig(url, anonKey, serviceKey);
    alert('Supabase credentials saved! Connecting to live Supabase database & Auth admin sync.');
    onClose();
  };

  const handleBulkSync = async () => {
    saveSupabaseConfig(url, anonKey, serviceKey);
    setIsSyncingAll(true);
    setSyncResult(null);

    try {
      const allStaff = getEmployees();
      const res = await syncAllEmployeesToSupabase(allStaff);
      setIsSyncingAll(false);
      setSyncResult(`Successfully synced ${res.synced} / ${res.total} staff users to Supabase database & Auth!`);
    } catch (err: any) {
      setIsSyncingAll(false);
      setSyncResult(`Sync encountered errors: ${err.message}`);
    }
  };

  const handleClear = () => {
    if (confirm('Disconnect Supabase and revert to local storage engine?')) {
      clearSupabaseConfig();
      setUrl('');
      setAnonKey('');
      onClose();
    }
  };

  const handleCopySchema = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Database className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Supabase Database Integration</h2>
              <p className="text-xs text-slate-400">Connect live Supabase database & export SQL schema</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-200 dark:border-slate-800 text-xs font-bold">
          <button
            onClick={() => setActiveTab('config')}
            className={`pb-2.5 border-b-2 ${activeTab === 'config' ? 'border-emerald-500 text-emerald-500' : 'border-transparent text-slate-400'}`}
          >
            Connection Settings
          </button>
          <button
            onClick={() => setActiveTab('schema')}
            className={`pb-2.5 border-b-2 ${activeTab === 'schema' ? 'border-emerald-500 text-emerald-500' : 'border-transparent text-slate-400'}`}
          >
            SQL Migration Schema Script
          </button>
        </div>

        <div className="p-6 space-y-5">
          {activeTab === 'config' ? (
            <form onSubmit={handleSave} className="space-y-4 text-xs">
              
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900 dark:text-slate-100">Status: {config.isConfigured ? 'Supabase Live Connected' : 'Local Storage Fallback Mode'}</p>
                  <p className="text-slate-500 mt-0.5">
                    {config.isConfigured ? 'Job Card modifications sync live with your Supabase database.' : 'Operating on local browser state engine. Paste Supabase URL below to connect.'}
                  </p>
                </div>
                {config.isConfigured && (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30 text-[11px]">
                    ● Active
                  </span>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Supabase Project URL (VITE_SUPABASE_URL)
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://xyzxyz.supabase.co"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Supabase Anon Key (VITE_SUPABASE_ANON_KEY)
                </label>
                <input
                  type="password"
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  placeholder="eyJhY2... (Anon public key)"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                  <span>Supabase Service Role Key (SUPABASE_SERVICE_ROLE_KEY) - Recommended</span>
                  <span className="text-[10px] text-emerald-500 font-normal">Enables live Auth Admin API</span>
                </label>
                <input
                  type="password"
                  value={serviceKey}
                  onChange={(e) => setServiceKey(e.target.value)}
                  placeholder="eyJhY2... (Service Role secret key to populate Auth -> Users panel)"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>

              {/* Step-by-Step Diagnostic & Sync Box */}
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-2 text-[11px]">
                <div className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>How to see users in your Supabase Dashboard:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-700 dark:text-slate-300">
                  <li>Switch to the <strong>SQL Migration Schema Script</strong> tab above, copy the SQL code, and run it in your <strong>Supabase SQL Editor</strong> to create the <code className="font-mono bg-slate-200 dark:bg-slate-800 px-1 rounded">public.employees</code> table.</li>
                  <li>Provide your <strong>Supabase Service Role Key</strong> above (from Supabase Settings -&gt; API) so users show up in the <strong>Auth -&gt; Users</strong> tab.</li>
                  <li>Click the button below to push all current staff accounts to Supabase:</li>
                </ol>

                <div className="pt-2 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleBulkSync}
                    disabled={isSyncingAll}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {isSyncingAll ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Syncing Staff to Supabase...</span>
                      </>
                    ) : (
                      <>
                        <Users className="w-3.5 h-3.5" />
                        <span>Sync All Existing Staff to Supabase Now</span>
                      </>
                    )}
                  </button>
                  {syncResult && (
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-xs">{syncResult}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                {config.isConfigured ? (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="px-3 py-2 rounded-xl text-rose-500 hover:bg-rose-500/10 font-semibold flex items-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" /> Disconnect
                  </button>
                ) : <div />}

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md transition-colors"
                >
                  Save & Connect Supabase
                </button>
              </div>

            </form>
          ) : (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <p className="text-slate-500">Copy this SQL script and paste it into the Supabase SQL Editor to create tables and RLS rules:</p>
                <button
                  onClick={handleCopySchema}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold flex items-center gap-1.5"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied to Clipboard!' : 'Copy SQL Schema'}
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] max-h-72 overflow-y-auto border border-slate-800">
                {SUPABASE_SQL_SCHEMA}
              </pre>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
