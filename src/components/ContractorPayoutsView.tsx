import React, { useState, useEffect } from 'react';
import { UserRole, ContractorPayoutRecord } from '../types';
import { 
  getContractorPayoutsReport, 
  getEmployees, 
  getVendors,
  getContractorPaymentRecords,
  getContractorAccountSummary,
  subscribeToStore
} from '../lib/storage';
import { RecordPaymentModal } from './RecordPaymentModal';
import { AccountBillingLedgerModal } from './AccountBillingLedgerModal';
import { 
  DollarSign, 
  Palette, 
  Hammer, 
  ShieldCheck, 
  Tag, 
  CheckCircle2, 
  AlertCircle, 
  Users, 
  Download, 
  Filter, 
  Search, 
  Award,
  Plus,
  Receipt,
  ArrowRight
} from 'lucide-react';

interface ContractorPayoutsViewProps {
  currentRole: UserRole;
}

export function ContractorPayoutsView({ currentRole }: ContractorPayoutsViewProps) {
  const [payoutRecords, setPayoutRecords] = useState<ContractorPayoutRecord[]>(() => getContractorPayoutsReport());
  const [contractorPayments, setContractorPayments] = useState(() => getContractorPaymentRecords());
  const [selectedContractor, setSelectedContractor] = useState<string>('ALL');
  const [selectedCat, setSelectedCat] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [recordPaymentModalState, setRecordPaymentModalState] = useState<{
    isOpen: boolean;
    contractorId?: string;
    contractorName?: string;
    suggestedAmount?: number;
  }>({ isOpen: false });

  const [ledgerModalState, setLedgerModalState] = useState<{
    isOpen: boolean;
    contractorName?: string;
  }>({ isOpen: false });

  const refreshReport = () => {
    setPayoutRecords(getContractorPayoutsReport());
    setContractorPayments(getContractorPaymentRecords());
  };

  useEffect(() => {
    refreshReport();
    const unsubscribe = subscribeToStore(refreshReport);
    return () => { unsubscribe(); };
  }, []);

  // Filter contractor list for denting & painting
  const contractorsList = Array.from(new Set(payoutRecords.map(r => r.assignedToName).filter(Boolean)));

  const filtered = payoutRecords.filter(r => {
    const matchesSearch = r.vehicleReg.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.taskTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (r.assignedToName && r.assignedToName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesContractor = selectedContractor === 'ALL' || r.assignedToName === selectedContractor;
    const matchesCat = selectedCat === 'ALL' || r.category === selectedCat;
    return matchesSearch && matchesContractor && matchesCat;
  });

  // Calculate Aggregates
  const totalCustomerRevenue = filtered.reduce((acc, r) => acc + r.customerPrice, 0);
  const totalContractorAccrued = filtered.reduce((acc, r) => acc + r.contractorPayout, 0);
  
  // Total payments made to contractors in filter
  const totalPaymentsPaid = contractorPayments
    .filter(p => selectedContractor === 'ALL' || p.contractorName === selectedContractor)
    .reduce((acc, p) => acc + p.amount, 0);

  const netRemainingPayable = Math.max(0, totalContractorAccrued - totalPaymentsPaid);
  const totalWorkshopMargin = totalCustomerRevenue - totalContractorAccrued;
  const completedCount = filtered.filter(r => r.taskStatus === 'COMPLETED' || r.jobCardStatus === 'CLOSED').length;

  const isAdminOrManager = currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN' || currentRole === 'FLOOR_MANAGER';

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-purple-900/40">
        <div>
          <div className="flex items-center gap-2 text-purple-300 text-xs font-bold uppercase tracking-widest mb-1">
            <Palette className="w-4 h-4 text-purple-400" /> Denting & Painting Contract Payout & Ledger Desk
          </div>
          <h1 className="text-2xl font-black">Contractor Billing & Payout Management</h1>
          <p className="text-slate-300 text-sm mt-1 max-w-2xl">
            Contract-basis painting and denting job payouts directly linked to job cards. Record admin/manager payments and let contractors inspect their billing statement in real-time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdminOrManager && (
            <button
              onClick={() => setRecordPaymentModalState({ isOpen: true })}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Disburse / Record Payment
            </button>
          )}

          <button
            onClick={refreshReport}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs shadow-md flex items-center gap-1.5 transition-colors"
          >
            <Award className="w-4 h-4" /> Refresh Records
          </button>
        </div>
      </div>

      {/* Analytics Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isAdminOrManager ? (
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase">
              <span>Customer Revenue</span>
              <Tag className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
              ₹{totalCustomerRevenue.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-semibold">
              Billed for {filtered.length} Contract Jobs
            </div>
          </div>
        ) : (
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase">
              <span>Completed RFC Jobs</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
              {filtered.length} Jobs
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-semibold">
              Ready For Collection (RFC)
            </div>
          </div>
        )}

        <div className="p-5 rounded-2xl bg-purple-500/10 border border-purple-500/30 shadow-sm">
          <div className="flex items-center justify-between text-xs font-extrabold text-purple-700 dark:text-purple-300 uppercase">
            <span>Contractor Accruals</span>
            <DollarSign className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-purple-700 dark:text-purple-300 mt-2">
            ₹{totalContractorAccrued.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-purple-600/80 dark:text-purple-400 mt-1 font-semibold">
            Accrued by Painters & Denters
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 shadow-sm">
          <div className="flex items-center justify-between text-xs font-extrabold text-emerald-700 dark:text-emerald-300 uppercase">
            <span>Payments Paid to Date</span>
            <Receipt className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-2">
            ₹{totalPaymentsPaid.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400 mt-1 font-semibold">
            Disbursed by Admin / Manager
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 shadow-sm">
          <div className="flex items-center justify-between text-xs font-extrabold text-amber-700 dark:text-amber-300 uppercase">
            <span>Remaining Net Payable</span>
            <CheckCircle2 className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-2">
            ₹{netRemainingPayable.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-amber-600/80 dark:text-amber-400 mt-1 font-semibold">
            Outstanding Account Balance Due
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search vehicle reg, contractor or task..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-medium outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Category Filter */}
          <select
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-bold"
          >
            <option value="ALL">All Categories</option>
            <option value="PAINT">Painting Jobs</option>
            <option value="DENTING">Denting Jobs</option>
            <option value="SUBLET_VENDOR">Sublet Vendor Jobs</option>
          </select>

          {/* Contractor Name Filter */}
          <select
            value={selectedContractor}
            onChange={(e) => setSelectedContractor(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-bold"
          >
            <option value="ALL">All Contractors & Staff</option>
            {contractorsList.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          {selectedContractor !== 'ALL' && (
            <button
              onClick={() => setLedgerModalState({ isOpen: true, contractorName: selectedContractor })}
              className="px-3 py-2 rounded-xl bg-purple-600 text-white font-extrabold flex items-center gap-1 shadow-sm hover:bg-purple-500"
            >
              <Receipt className="w-3.5 h-3.5" /> View {selectedContractor.split(' ')[0]}'s Account Statement
            </button>
          )}
        </div>
      </div>

      {/* Contractor Payout Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-extrabold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3.5">Vehicle & Job Card</th>
                <th className="px-4 py-3.5">Task / Contract Job</th>
                <th className="px-4 py-3.5">Allotted Contractor</th>
                {isAdminOrManager && <th className="px-4 py-3.5 text-right">Customer Price</th>}
                <th className="px-4 py-3.5 text-right">Painter / Denter Share</th>
                <th className="px-4 py-3.5 text-right">Total Payout</th>
                {isAdminOrManager && <th className="px-4 py-3.5 text-right">Workshop Margin</th>}
                <th className="px-4 py-3.5 text-center">Account Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={isAdminOrManager ? 8 : 6} className="px-4 py-8 text-center text-slate-400 font-semibold">
                    No contract payouts found matching your filter options.
                  </td>
                </tr>
              ) : (
                filtered.map((record, i) => (
                  <tr key={`${record.taskId}-${i}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    {/* Vehicle */}
                    <td className="px-4 py-3.5">
                      <div className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                        {record.vehicleReg}
                        {record.isCars24 ? (
                          <span className="px-1.5 py-0.2 bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] rounded-md font-bold">
                            Cars24
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] rounded-md font-bold">
                            Retail
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-semibold">
                        {record.vehicleModel} • #{record.jobCardNumber}
                      </div>
                    </td>

                    {/* Task */}
                    <td className="px-4 py-3.5">
                      <div className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        {record.category === 'PAINT' ? <Palette className="w-3.5 h-3.5 text-purple-500" /> : <Hammer className="w-3.5 h-3.5 text-orange-500" />}
                        {record.taskTitle}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">
                        {record.category}
                      </div>
                    </td>

                    {/* Contractor */}
                    <td className="px-4 py-3.5">
                      <div className="font-extrabold text-purple-700 dark:text-purple-300 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-purple-500" />
                        {record.assignedToName || 'Unassigned'}
                      </div>
                      <div className="text-[10px] text-slate-400">Contractor / Staff</div>
                    </td>

                    {/* Customer Price (Admin/Manager only) */}
                    {isAdminOrManager && (
                      <td className="px-4 py-3.5 text-right font-bold text-slate-900 dark:text-white">
                        ₹{record.customerPrice.toLocaleString('en-IN')}
                      </td>
                    )}

                    {/* Painter / Denter Share */}
                    <td className="px-4 py-3.5 text-right font-semibold text-slate-700 dark:text-slate-300">
                      <div className="text-[11px]">
                        Painter: <strong className="text-purple-600 dark:text-purple-300">₹{record.painterPayout}</strong>
                      </div>
                      <div className="text-[11px]">
                        Denter: <strong className="text-orange-600 dark:text-orange-300">₹{record.denterPayout}</strong>
                      </div>
                    </td>

                    {/* Contractor Payout */}
                    <td className="px-4 py-3.5 text-right font-black text-purple-700 dark:text-purple-300 text-sm">
                      ₹{record.contractorPayout.toLocaleString('en-IN')}
                    </td>

                    {/* Margin (Admin/Manager only) */}
                    {isAdminOrManager && (
                      <td className="px-4 py-3.5 text-right font-extrabold text-emerald-600 dark:text-emerald-400">
                        ₹{record.workshopMargin.toLocaleString('en-IN')}
                      </td>
                    )}

                    {/* Account Actions */}
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setLedgerModalState({ 
                            isOpen: true, 
                            contractorName: record.assignedToName || 'Contractor' 
                          })}
                          className="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-extrabold text-[11px] border border-purple-500/20 transition-all flex items-center gap-1"
                        >
                          <Receipt className="w-3 h-3" /> Account Ledger
                        </button>

                        {isAdminOrManager && (
                          <button
                            onClick={() => setRecordPaymentModalState({
                              isOpen: true,
                              contractorId: record.assignedToId || record.assignedToName,
                              contractorName: record.assignedToName,
                              suggestedAmount: record.contractorPayout
                            })}
                            className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-black text-[11px] border border-emerald-500/20 transition-all"
                            title="Record payment to contractor"
                          >
                            Pay ₹
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Account Ledger Modal */}
      {ledgerModalState.isOpen && ledgerModalState.contractorName && (
        <AccountBillingLedgerModal
          isOpen={ledgerModalState.isOpen}
          onClose={() => setLedgerModalState({ isOpen: false })}
          accountType="CONTRACTOR"
          accountIdOrName={ledgerModalState.contractorName}
          accountDisplayName={ledgerModalState.contractorName}
          currentRole={currentRole}
        />
      )}

      {/* Record Payment Sub-Modal */}
      {recordPaymentModalState.isOpen && (
        <RecordPaymentModal
          isOpen={recordPaymentModalState.isOpen}
          onClose={() => setRecordPaymentModalState({ isOpen: false })}
          targetType="CONTRACTOR"
          targetId={recordPaymentModalState.contractorId}
          targetName={recordPaymentModalState.contractorName}
          suggestedAmount={recordPaymentModalState.suggestedAmount}
          onPaymentRecorded={refreshReport}
        />
      )}
    </div>
  );
}

