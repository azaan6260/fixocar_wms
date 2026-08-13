import React, { useState } from 'react';
import { JobCard, UserRole } from '../types';
import { getJobCards, updateJobCardGSTInvoice } from '../lib/storage';
import { GSTInvoiceView } from './GSTInvoiceView';
import { 
  DEFAULT_WORKSHOP_GSTIN, 
  DEFAULT_CARS24_GSTIN, 
  getDefaultHSNForCategory 
} from '../lib/hsnData';
import { 
  FileText, 
  Search, 
  Filter, 
  Printer, 
  Share2, 
  Plus, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  Car, 
  User, 
  Building2, 
  Tag, 
  ChevronRight, 
  X, 
  Receipt,
  Sparkles,
  AlertCircle
} from 'lucide-react';

interface InvoiceManagementViewProps {
  currentRole: UserRole;
  onSelectJobCard?: (id: string) => void;
}

export function InvoiceManagementView({ currentRole, onSelectJobCard }: InvoiceManagementViewProps) {
  const [jobCards, setJobCards] = useState<JobCard[]>(() => getJobCards());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'DUE' | 'CARS24'>('ALL');
  
  // Selected Job Card for Invoice View Modal
  const [selectedInvoiceCard, setSelectedInvoiceCard] = useState<JobCard | null>(null);
  
  // Modal for generating new invoice on card without invoice number
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedCardForCreation, setSelectedCardForCreation] = useState<string>('');

  const refreshCards = () => {
    setJobCards(getJobCards());
  };

  // Helper to compute line items and financial metrics for a Job Card
  const calculateCardInvoiceMetrics = (card: JobCard) => {
    let taxable = 0;
    let totalTax = 0;

    card.tasks.forEach((task) => {
      if (task.isCustomerApproved === false) return;
      
      // Task labor
      const taskItemId = `task-${task.id}`;
      const savedTaskTax = card.customItemTaxRates?.[taskItemId];
      const defaultTaskHsn = getDefaultHSNForCategory(task.category, false);
      const taskRate = savedTaskTax?.gstRate ?? task.gstRate ?? defaultTaskHsn.rate;
      
      taxable += task.customerPrice;
      totalTax += (task.customerPrice * taskRate) / 100;

      // Parts & Consumables
      if (task.requisitions && task.requisitions.length > 0) {
        task.requisitions.forEach((req) => {
          if (['APPROVED', 'ORDERED', 'RECEIVED', 'CONSUMED'].includes(req.status)) {
            const reqItemId = `req-${req.id}`;
            const savedReqTax = card.customItemTaxRates?.[reqItemId];
            const defaultPartHsn = getDefaultHSNForCategory(task.category, true);
            const partRate = savedReqTax?.gstRate ?? req.gstRate ?? defaultPartHsn.rate;
            const partVal = req.approvedPrice || (req.suggestedPrice || 0) * req.quantity;

            taxable += partVal;
            totalTax += (partVal * partRate) / 100;
          }
        });
      } else if (task.partsList && task.partsList.length > 0) {
        task.partsList.forEach((p) => {
          const partItemId = `part-${p.id}`;
          const savedPartTax = card.customItemTaxRates?.[partItemId];
          const defaultPartHsn = getDefaultHSNForCategory(task.category, true);
          const partRate = savedPartTax?.gstRate ?? p.gstRate ?? defaultPartHsn.rate;
          const partVal = p.totalPrice || (p.unitPrice * p.quantity);

          taxable += partVal;
          totalTax += (partVal * partRate) / 100;
        });
      }
    });

    const gross = taxable + totalTax;
    const discount = card.discount || 0;
    const grandTotal = Math.max(0, gross - discount);
    const advancePaid = card.advancePaid || 0;
    const balanceDue = Math.max(0, grandTotal - advancePaid);
    const isFullyPaid = balanceDue <= 0;

    const invNum = card.invoiceNumber || `INV/2026-27/${card.id.replace('JC-', '')}`;
    const invDate = card.invoiceDate || card.createdAt;

    return {
      invNum,
      invDate,
      taxable,
      totalTax,
      grandTotal,
      advancePaid,
      balanceDue,
      isFullyPaid
    };
  };

  // Enriched cards list with calculated metrics
  const enrichedInvoices = React.useMemo(() => {
    return jobCards.map((card) => {
      const metrics = calculateCardInvoiceMetrics(card);
      return {
        card,
        ...metrics
      };
    });
  }, [jobCards]);

  // Filtered List
  const filteredInvoices = React.useMemo(() => {
    return enrichedInvoices.filter(({ card, invNum }) => {
      // Search match
      const query = searchTerm.toLowerCase();
      const matchesSearch = 
        invNum.toLowerCase().includes(query) ||
        card.id.toLowerCase().includes(query) ||
        card.customer.name.toLowerCase().includes(query) ||
        card.customer.phone.includes(query) ||
        card.vehicle.registrationNumber.toLowerCase().includes(query) ||
        card.vehicle.make.toLowerCase().includes(query) ||
        card.vehicle.model.toLowerCase().includes(query) ||
        (card.customerGstin && card.customerGstin.toLowerCase().includes(query));

      if (!matchesSearch) return false;

      // Status Filter
      if (statusFilter === 'PAID') return card.advancePaid >= calculateCardInvoiceMetrics(card).grandTotal;
      if (statusFilter === 'DUE') return calculateCardInvoiceMetrics(card).balanceDue > 0;
      if (statusFilter === 'CARS24') return card.isCars24;

      return true;
    });
  }, [enrichedInvoices, searchTerm, statusFilter]);

  // Overall Financial Summary Stats
  const totalInvoicesCount = enrichedInvoices.length;
  const totalBilledValue = enrichedInvoices.reduce((sum, item) => sum + item.grandTotal, 0);
  const totalGstCollected = enrichedInvoices.reduce((sum, item) => sum + item.totalTax, 0);
  const totalPaidValue = enrichedInvoices.reduce((sum, item) => sum + item.advancePaid, 0);
  const totalOutstandingDue = enrichedInvoices.reduce((sum, item) => sum + item.balanceDue, 0);
  const cars24Count = enrichedInvoices.filter(i => i.card.isCars24).length;

  const handleGenerateInvoiceForCard = () => {
    if (!selectedCardForCreation) return;
    const targetCard = jobCards.find(c => c.id === selectedCardForCreation);
    if (targetCard) {
      if (!targetCard.invoiceNumber) {
        updateJobCardGSTInvoice(targetCard.id, {
          invoiceNumber: `INV/2026-27/${targetCard.id.replace('JC-', '')}`,
          invoiceDate: new Date().toISOString().split('T')[0],
          workshopGstin: targetCard.workshopGstin || DEFAULT_WORKSHOP_GSTIN,
          customerGstin: targetCard.customerGstin || (targetCard.isCars24 ? DEFAULT_CARS24_GSTIN : '')
        });
        refreshCards();
      }
      setSelectedInvoiceCard(getJobCards().find(c => c.id === targetCard.id) || targetCard);
      setShowGenerateModal(false);
      setSelectedCardForCreation('');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header Title & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black shrink-0">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>GST Invoices & Tax Billing Center</span>
              <span className="bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border border-amber-500/20">
                {totalInvoicesCount} Active Records
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              Central ledger for all retail and Cars24 B2B GST invoices with HSN/SAC itemization and tax audits.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowGenerateModal(true)}
          className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white font-extrabold text-xs shadow-md flex items-center gap-2 transition-all shrink-0 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Generate New GST Invoice</span>
        </button>
      </div>

      {/* KPI Financial Metric Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Gross Billed</p>
          <p className="text-xl font-black text-slate-900 dark:text-white font-mono">
            ₹{Math.round(totalBilledValue).toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
            <span>Inc. {cars24Count} Cars24 B2B bills</span>
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total GST Tax Collected</p>
          <p className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
            ₹{Math.round(totalGstCollected).toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-slate-500 font-mono">
            CGST + SGST + IGST Output
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Paid / Received</p>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            ₹{Math.round(totalPaidValue).toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-emerald-600/80 font-bold font-mono">
            Advance + Final Cash/UPI
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Balance Outstanding</p>
          <p className="text-xl font-black text-rose-600 dark:text-rose-400 font-mono">
            ₹{Math.round(totalOutstandingDue).toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-rose-500/80 font-bold font-mono">
            Pending Payment Collections
          </p>
        </div>

      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        
        {/* Search Input */}
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search invoice #, Job Card, reg #, customer, GSTIN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Filter:
          </span>

          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            All Invoices ({totalInvoicesCount})
          </button>

          <button
            onClick={() => setStatusFilter('DUE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'DUE'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            Balance Due
          </button>

          <button
            onClick={() => setStatusFilter('PAID')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'PAID'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            Paid in Full
          </button>

          <button
            onClick={() => setStatusFilter('CARS24')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'CARS24'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            Cars24 B2B ({cars24Count})
          </button>
        </div>

      </div>

      {/* Invoices Directory Table */}
      {filteredInvoices.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
          <Receipt className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="font-extrabold text-slate-800 dark:text-slate-200 text-base">
            No GST Tax Invoices Found
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Try adjusting your search query or generate a new GST invoice for an active job card.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900 shadow-xs">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                <th className="p-3.5 pl-5">Invoice # & Date</th>
                <th className="p-3.5">Customer / Client</th>
                <th className="p-3.5">Vehicle Details</th>
                <th className="p-3.5 text-right font-mono">Taxable Val</th>
                <th className="p-3.5 text-right font-mono">GST Output</th>
                <th className="p-3.5 text-right font-mono">Grand Total</th>
                <th className="p-3.5 text-right font-mono">Balance Due</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-center pr-5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredInvoices.map(({ card, invNum, invDate, taxable, totalTax, grandTotal, advancePaid, balanceDue, isFullyPaid }) => (
                <tr 
                  key={card.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                >
                  
                  {/* Invoice # & Date */}
                  <td className="p-3.5 pl-5 space-y-0.5">
                    <p className="font-mono font-black text-amber-600 dark:text-amber-400 text-sm">
                      {invNum}
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Ref Job Card: <span className="font-bold text-slate-700 dark:text-slate-300">{card.id}</span> • {invDate}
                    </p>
                  </td>

                  {/* Customer Details */}
                  <td className="p-3.5 space-y-0.5">
                    <p className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{card.customer.name}</span>
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono">{card.customer.phone}</p>
                    {card.customerGstin && (
                      <p className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.2 rounded inline-block">
                        GSTIN: {card.customerGstin}
                      </p>
                    )}
                  </td>

                  {/* Vehicle Details */}
                  <td className="p-3.5 space-y-0.5">
                    <p className="font-mono font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                      <Car className="w-3.5 h-3.5" />
                      <span>{card.vehicle.registrationNumber}</span>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {card.vehicle.make} {card.vehicle.model}
                    </p>
                  </td>

                  {/* Taxable Amount */}
                  <td className="p-3.5 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                    ₹{Math.round(taxable).toLocaleString('en-IN')}
                  </td>

                  {/* GST Tax Output */}
                  <td className="p-3.5 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                    ₹{Math.round(totalTax).toLocaleString('en-IN')}
                  </td>

                  {/* Grand Total */}
                  <td className="p-3.5 text-right font-mono font-black text-slate-900 dark:text-white text-sm">
                    ₹{Math.round(grandTotal).toLocaleString('en-IN')}
                  </td>

                  {/* Balance Due */}
                  <td className="p-3.5 text-right font-mono font-black">
                    {balanceDue > 0 ? (
                      <span className="text-rose-600 dark:text-rose-400">
                        ₹{Math.round(balanceDue).toLocaleString('en-IN')}
                      </span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        ₹0 (Clear)
                      </span>
                    )}
                  </td>

                  {/* Status Badge */}
                  <td className="p-3.5 text-center">
                    {card.isCars24 ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/30">
                        Cars24 B2B
                      </span>
                    ) : isFullyPaid ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Paid
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Due
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="p-3.5 text-center pr-5">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => setSelectedInvoiceCard(card)}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-extrabold text-xs transition-all flex items-center gap-1 border border-amber-500/20"
                        title="View / Print Tax Invoice"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>View / Print</span>
                      </button>

                      {onSelectJobCard && (
                        <button
                          onClick={() => onSelectJobCard(card.id)}
                          className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                          title="Open Full Job Card"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* FULL GST INVOICE MODAL VIEWER */}
      {selectedInvoiceCard && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-5xl p-6 sm:p-8 space-y-4 shadow-2xl my-8 relative">
            <button 
              onClick={() => {
                setSelectedInvoiceCard(null);
                refreshCards();
              }} 
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 dark:hover:text-white p-2 rounded-xl bg-slate-100 dark:bg-slate-800 transition-all z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <GSTInvoiceView 
              card={selectedInvoiceCard} 
              onRefreshCard={() => {
                refreshCards();
                const updated = getJobCards().find(c => c.id === selectedInvoiceCard.id);
                if (updated) setSelectedInvoiceCard(updated);
              }}
              currentRole={currentRole} 
            />
          </div>
        </div>
      )}

      {/* MODAL: GENERATE INVOICE FOR JOB CARD */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-5 sm:p-6 space-y-4 shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 font-bold">
                  <Receipt className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                  Generate GST Tax Invoice
                </h3>
              </div>

              <button
                onClick={() => setShowGenerateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                Select Active Job Card to Issue Invoice:
              </label>

              <select
                value={selectedCardForCreation}
                onChange={(e) => setSelectedCardForCreation(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-xs font-bold text-slate-900 dark:text-slate-100"
              >
                <option value="">-- Choose Job Card --</option>
                {jobCards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id} - {c.vehicle.registrationNumber} ({c.customer.name})
                  </option>
                ))}
              </select>

              <p className="text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                Generating an invoice will automatically assign an official GST Tax Invoice number (e.g. <code>INV/2026-27/001</code>) and compute HSN/SAC taxes for all approved repair tasks and parts.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!selectedCardForCreation}
                  onClick={handleGenerateInvoiceForCard}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black shadow-md flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Generate & Open Invoice</span>
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
