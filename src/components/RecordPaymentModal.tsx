import React, { useState } from 'react';
import { PaymentMode } from '../types';
import { recordContractorPayment, recordVendorPayment, getEmployees, getVendors } from '../lib/storage';
import { X, DollarSign, CreditCard, CheckCircle2, AlertCircle, Building2, User } from 'lucide-react';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: 'CONTRACTOR' | 'VENDOR';
  targetId?: string;
  targetName?: string;
  suggestedAmount?: number;
  onPaymentRecorded?: () => void;
}

export function RecordPaymentModal({
  isOpen,
  onClose,
  targetType,
  targetId = '',
  targetName = '',
  suggestedAmount = 0,
  onPaymentRecorded
}: RecordPaymentModalProps) {
  const employees = getEmployees();
  const vendors = getVendors();

  const [selectedEntityId, setSelectedEntityId] = useState(targetId);
  const [selectedEntityName, setSelectedEntityName] = useState(targetName);
  const [amount, setAmount] = useState(suggestedAmount > 0 ? suggestedAmount : '');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('UPI');
  const [transactionRef, setTransactionRef] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      alert('Please enter a valid payment amount (> 0).');
      return;
    }

    const nameToUse = selectedEntityName || (targetType === 'CONTRACTOR'
      ? employees.find(e => e.id === selectedEntityId)?.name || 'Contractor'
      : vendors.find(v => v.id === selectedEntityId)?.name || 'Vendor');

    setIsSubmitting(true);

    try {
      if (targetType === 'CONTRACTOR') {
        recordContractorPayment({
          contractorId: selectedEntityId || nameToUse,
          contractorName: nameToUse,
          amount: numAmount,
          paymentMode,
          transactionRef,
          notes
        });
      } else {
        recordVendorPayment({
          vendorId: selectedEntityId || nameToUse,
          vendorName: nameToUse,
          amount: numAmount,
          paymentMode,
          transactionRef,
          notes
        });
      }

      if (onPaymentRecorded) onPaymentRecorded();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Error recording payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 text-white rounded-3xl border border-slate-800 w-full max-w-lg shadow-2xl overflow-hidden my-6">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
              targetType === 'CONTRACTOR' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            }`}>
              {targetType === 'CONTRACTOR' ? <User className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-lg font-black text-white">
                Record {targetType === 'CONTRACTOR' ? 'Contractor Payout' : 'Vendor Bill Payment'}
              </h3>
              <p className="text-xs text-slate-400">
                Disburse payment and deduct from account billing balance
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">

          {/* Recipient Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
              {targetType === 'CONTRACTOR' ? 'Contractor / Mechanic' : 'Vendor / Supplier'}
            </label>
            {targetName ? (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-bold text-sm text-amber-400 flex items-center justify-between">
                <span>{targetName}</span>
                <span className="text-xs font-mono text-slate-500 uppercase">{targetType}</span>
              </div>
            ) : (
              <select
                value={selectedEntityId}
                onChange={(e) => {
                  setSelectedEntityId(e.target.value);
                  const found = targetType === 'CONTRACTOR' 
                    ? employees.find(emp => emp.id === e.target.value)
                    : vendors.find(ven => ven.id === e.target.value);
                  if (found) setSelectedEntityName(found.name);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-bold text-sm outline-none focus:ring-2 focus:ring-amber-500"
                required
              >
                <option value="">-- Select {targetType === 'CONTRACTOR' ? 'Contractor' : 'Vendor'} --</option>
                {targetType === 'CONTRACTOR' ? (
                  employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                  ))
                ) : (
                  vendors.map(ven => (
                    <option key={ven.id} value={ven.id}>{ven.name} (Due: ₹{ven.outstandingBalance || 0})</option>
                  ))
                )}
              </select>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
              Payment Amount (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-amber-400 font-black text-lg">₹</span>
              <input
                type="number"
                min="1"
                step="any"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-amber-300 font-mono font-black text-xl outline-none focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>
            {suggestedAmount > 0 && (
              <p className="text-[11px] text-slate-400 mt-1">
                Suggested full outstanding balance: <strong className="text-amber-400 font-mono">₹{suggestedAmount.toLocaleString('en-IN')}</strong>
              </p>
            )}
          </div>

          {/* Payment Mode */}
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
              Payment Mode
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['UPI', 'CASH', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'] as PaymentMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPaymentMode(mode)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                    paymentMode === mode
                      ? 'bg-amber-500 text-slate-950 border-amber-500 font-black shadow-md'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {mode === 'BANK_TRANSFER' ? 'BANK' : mode}
                </button>
              ))}
            </div>
          </div>

          {/* Transaction Ref / UTR */}
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
              Transaction Ref / UTR No. (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. UPI/123984920/AXIS or Chq #4091"
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-medium text-xs outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Notes / Remarks */}
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
              Payment Remarks / Notes
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Weekly settlement for bumper painting jobs"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-medium text-xs outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirm & Deduct Payment</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
