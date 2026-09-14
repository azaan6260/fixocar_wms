import React, { useState, useEffect } from 'react';
import { 
  getContractorAccountSummary, 
  getVendorAccountSummary, 
  subscribeToStore
} from '../lib/storage';
import { ContractorAccountSummary, VendorAccountSummary, UserRole } from '../types';
import { RecordPaymentModal } from './RecordPaymentModal';
import { 
  X, 
  DollarSign, 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  Receipt, 
  FileText, 
  Download, 
  Building2, 
  User, 
  ArrowDownRight, 
  ArrowUpRight,
  TrendingUp,
  ShieldCheck,
  Plus
} from 'lucide-react';

interface AccountBillingLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountType: 'CONTRACTOR' | 'VENDOR';
  accountIdOrName: string;
  accountDisplayName?: string;
  currentRole?: UserRole;
}

export function AccountBillingLedgerModal({
  isOpen,
  onClose,
  accountType,
  accountIdOrName,
  accountDisplayName,
  currentRole
}: AccountBillingLedgerModalProps) {
  const isAdminOrManager = currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN' || currentRole === 'FLOOR_MANAGER';
  const [activeTab, setActiveTab] = useState<'ACCROUED_JOBS' | 'PAYMENT_HISTORY'>('ACCROUED_JOBS');
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);

  const [contractorSummary, setContractorSummary] = useState<ContractorAccountSummary | null>(null);
  const [vendorSummary, setVendorSummary] = useState<VendorAccountSummary | null>(null);

  const loadSummaryData = () => {
    if (!accountIdOrName) return;
    if (accountType === 'CONTRACTOR') {
      const summary = getContractorAccountSummary(accountIdOrName);
      setContractorSummary(summary);
    } else {
      const summary = getVendorAccountSummary(accountIdOrName);
      setVendorSummary(summary);
    }
  };

  useEffect(() => {
    loadSummaryData();
    const unsubscribe = subscribeToStore(loadSummaryData);
    return () => { unsubscribe(); };
  }, [accountType, accountIdOrName]);

  if (!isOpen) return null;

  const displayName = accountDisplayName || 
    (accountType === 'CONTRACTOR' ? contractorSummary?.contractorName : vendorSummary?.vendorName) || 
    accountIdOrName;

  const totalAccrued = accountType === 'CONTRACTOR' 
    ? contractorSummary?.totalAccruedEarnings || 0 
    : vendorSummary?.totalAccruedBills || 0;

  const totalPaid = accountType === 'CONTRACTOR' 
    ? contractorSummary?.totalPaymentsReceived || 0 
    : vendorSummary?.totalPaymentsMade || 0;

  const netBalance = accountType === 'CONTRACTOR' 
    ? contractorSummary?.netBalancePayable || 0 
    : vendorSummary?.netOutstandingBalance || 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 text-white rounded-3xl border border-slate-800 w-full max-w-4xl shadow-2xl overflow-hidden my-4">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
              accountType === 'CONTRACTOR' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            }`}>
              {accountType === 'CONTRACTOR' ? <User className="w-6 h-6" /> : <Building2 className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-white">{displayName}</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                  accountType === 'CONTRACTOR' 
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' 
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}>
                  {accountType} ACCOUNT LEDGER
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Complete billing statements, task earnings, and admin payout history
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Account Financial Metric Bar */}
        <div className="p-5 bg-slate-950/80 border-b border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          {/* Total Accrued */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs font-extrabold text-slate-400 uppercase tracking-wider">
              <span>Total Accrued Bills</span>
              <TrendingUp className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono">
              ₹{totalAccrued.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500 font-semibold">
              Gross value of completed tasks / POs
            </div>
          </div>

          {/* Total Payments Made */}
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
            <div className="flex items-center justify-between text-xs font-extrabold text-emerald-400 uppercase tracking-wider">
              <span>Total Payments Received</span>
              <ArrowDownRight className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400 font-mono">
              ₹{totalPaid.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-emerald-500/80 font-semibold">
              Paid by Workshop Admin / Manager
            </div>
          </div>

          {/* Net Outstanding Balance */}
          <div className={`p-4 rounded-2xl border space-y-1 ${
            netBalance > 0 
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
              : 'bg-slate-900 border-slate-800 text-slate-300'
          }`}>
            <div className="flex items-center justify-between text-xs font-extrabold uppercase tracking-wider">
              <span>Net Account Balance Due</span>
              <DollarSign className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black font-mono">
              ₹{netBalance.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] font-semibold opacity-80">
              {netBalance > 0 ? 'Remaining payable by workshop' : 'Fully Settled Account'}
            </div>
          </div>

        </div>

        {/* Controls Header */}
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          
          {/* Tabs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('ACCROUED_JOBS')}
              className={`px-4 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'ACCROUED_JOBS'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Billed Jobs &amp; Orders</span>
            </button>

            <button
              onClick={() => setActiveTab('PAYMENT_HISTORY')}
              className={`px-4 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'PAYMENT_HISTORY'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Payment History &amp; Receipts</span>
            </button>
          </div>

          {/* Admin Record Payment Button */}
          {isAdminOrManager && (
            <button
              onClick={() => setShowRecordPaymentModal(true)}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black flex items-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Record Payment to {displayName.split(' ')[0]}</span>
            </button>
          )}

        </div>

        {/* Tab Content Body */}
        <div className="p-5 overflow-y-auto max-h-[50vh]">
          {activeTab === 'ACCROUED_JOBS' ? (
            accountType === 'CONTRACTOR' ? (
              /* Contractor Tasks List */
              <div className="space-y-3">
                {contractorSummary?.taskAllotments.length === 0 ? (
                  <div className="p-8 text-center bg-slate-950 rounded-2xl border border-slate-800 text-slate-400 text-xs">
                    No task allotments found for this contractor account yet.
                  </div>
                ) : (
                  <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                        <tr>
                          <th className="px-4 py-3">Vehicle &amp; Job Card</th>
                          <th className="px-4 py-3">Task Title</th>
                          <th className="px-4 py-3 text-right">Customer Price</th>
                          <th className="px-4 py-3 text-right">Contractor Payout</th>
                          <th className="px-4 py-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-medium text-slate-300">
                        {contractorSummary?.taskAllotments.map((task, idx) => (
                          <tr key={`${task.taskId}-${idx}`} className="hover:bg-slate-900/60 transition-colors">
                            <td className="px-4 py-3">
                              <span className="font-mono font-bold text-amber-400 block">{task.vehicleReg}</span>
                              <span className="text-[11px] text-slate-400">{task.vehicleModel} • #{task.jobCardNumber}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-extrabold text-white block">{task.taskTitle}</span>
                              <span className="text-[10px] uppercase font-bold text-slate-500">{task.category}</span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-slate-300">
                              ₹{task.customerPrice.toLocaleString('en-IN')}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-black text-purple-400 text-sm">
                              ₹{task.contractorPayout.toLocaleString('en-IN')}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                task.taskStatus === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                              }`}>
                                {task.taskStatus}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              /* Vendor Bills & POs List */
              <div className="space-y-4">
                {vendorSummary?.purchaseOrders.length === 0 && vendorSummary?.outsourcedTasks.length === 0 ? (
                  <div className="p-8 text-center bg-slate-950 rounded-2xl border border-slate-800 text-slate-400 text-xs">
                    No purchase orders or sublet jobs recorded for this vendor yet.
                  </div>
                ) : (
                  <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                        <tr>
                          <th className="px-4 py-3">Type &amp; Ref</th>
                          <th className="px-4 py-3">Item / Service Description</th>
                          <th className="px-4 py-3 text-right">Bill Amount</th>
                          <th className="px-4 py-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-medium text-slate-300">
                        {vendorSummary?.purchaseOrders.map((po) => (
                          <tr key={po.id} className="hover:bg-slate-900/60 transition-colors">
                            <td className="px-4 py-3">
                              <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold text-[10px] uppercase block w-fit mb-0.5">PURCHASE ORDER</span>
                              <span className="font-mono text-slate-400 text-[11px]">{po.id} ({po.jobCardId})</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-bold text-white block">{po.itemDescription}</span>
                              <span className="text-[11px] text-slate-400">Vehicle: {po.vehicleReg}</span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-black text-emerald-400 text-sm">
                              ₹{po.amount.toLocaleString('en-IN')}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 uppercase">
                                {po.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {vendorSummary?.outsourcedTasks.map((task) => (
                          <tr key={task.id} className="hover:bg-slate-900/60 transition-colors">
                            <td className="px-4 py-3">
                              <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-bold text-[10px] uppercase block w-fit mb-0.5">SUBLET TASK</span>
                              <span className="font-mono text-slate-400 text-[11px]">#{task.jobCardId}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-bold text-white block">{task.title}</span>
                              <span className="text-[11px] text-slate-400">Outsourced Job</span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-black text-purple-400 text-sm">
                              ₹{(task.outsourcedCost || task.contractorPayout || task.estimatedCost || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500/20 text-blue-400 uppercase">
                                {task.outsourceStatus || task.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          ) : (
            /* Payment History Tab */
            <div className="space-y-3">
              {((accountType === 'CONTRACTOR' ? contractorSummary?.paymentHistory : vendorSummary?.paymentHistory) || []).length === 0 ? (
                <div className="p-8 text-center bg-slate-950 rounded-2xl border border-slate-800 text-slate-400 text-xs">
                  No payment disbursements recorded for this account yet.
                </div>
              ) : (
                <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3">Receipt Ref &amp; Date</th>
                        <th className="px-4 py-3">Payment Mode</th>
                        <th className="px-4 py-3">Txn Ref / Notes</th>
                        <th className="px-4 py-3">Paid By</th>
                        <th className="px-4 py-3 text-right">Amount Paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-medium text-slate-300">
                      {(accountType === 'CONTRACTOR' ? contractorSummary?.paymentHistory : vendorSummary?.paymentHistory)?.map((pay) => (
                        <tr key={pay.id} className="hover:bg-slate-900/60 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-mono font-bold text-amber-400 block">{pay.id}</span>
                            <span className="text-[11px] text-slate-400">{new Date(pay.paidAt).toLocaleDateString()} {new Date(pay.paidAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-amber-300 font-bold border border-slate-700 text-[11px]">
                              💳 {pay.paymentMode}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {pay.transactionRef && (
                              <span className="font-mono text-slate-300 text-[11px] block">Ref: {pay.transactionRef}</span>
                            )}
                            <span className="text-slate-400 text-[11px]">{pay.notes || 'Direct account payment'}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-400 font-semibold">
                            {pay.paidByEmployeeName}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-black text-emerald-400 text-base">
                            ₹{pay.amount.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Payments recorded by Admin/Manager automatically update account balance</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
          >
            Close Statement
          </button>
        </div>

      </div>

      {/* Record Payment Sub-Modal */}
      {showRecordPaymentModal && (
        <RecordPaymentModal
          isOpen={showRecordPaymentModal}
          onClose={() => setShowRecordPaymentModal(false)}
          targetType={accountType}
          targetId={accountIdOrName}
          targetName={displayName}
          suggestedAmount={netBalance}
          onPaymentRecorded={() => {
            loadSummaryData();
          }}
        />
      )}
    </div>
  );
}
