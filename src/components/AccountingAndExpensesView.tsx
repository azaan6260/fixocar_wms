import React, { useState, useEffect } from 'react';
import { UserRole, WorkshopExpense, ExpenseCategory, ExpensePaymentMode } from '../types';
import { 
  getWorkshopExpenses, 
  addWorkshopExpense, 
  updateWorkshopExpense, 
  deleteWorkshopExpense,
  getJobCards,
  getWorkshops,
  subscribeToStore
} from '../lib/storage';
import { 
  DollarSign, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  Building2, 
  FileText, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown, 
  PieChart, 
  Zap, 
  Coffee, 
  Wrench, 
  Laptop, 
  Fuel, 
  ShieldCheck, 
  HelpCircle, 
  X, 
  Printer, 
  Download, 
  CreditCard, 
  Wallet, 
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  BarChart3,
  SlidersHorizontal
} from 'lucide-react';

interface AccountingAndExpensesViewProps {
  currentRole: UserRole;
}

const CATEGORY_MAP: Record<ExpenseCategory, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  ELECTRICITY_UTILITIES: { label: 'Electricity & Utilities', icon: Zap, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
  RENT_LEASE: { label: 'Rent & Bay Lease', icon: Building2, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/10' },
  STAFF_WELFARE: { label: 'Staff Refreshments & Welfare', icon: Coffee, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10' },
  TOOLS_MAINTENANCE: { label: 'Tools, Lifts & Maintenance', icon: Wrench, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10' },
  OFFICE_ADMIN: { label: 'Office, Internet & Admin', icon: Laptop, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-500/10' },
  FUEL_LOGISTICS: { label: 'Towing Fuel & Logistics', icon: Fuel, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10' },
  STATUTORY_TAXES: { label: 'Trade License & Taxes', icon: ShieldCheck, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
  MISCELLANEOUS: { label: 'Miscellaneous Costs', icon: HelpCircle, color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-500/10' }
};

const PAYMENT_MODE_LABELS: Record<ExpensePaymentMode, string> = {
  CASH: 'Cash',
  UPI: 'UPI (GPay / PhonePe)',
  BANK_TRANSFER: 'Bank Transfer (NEFT/RTGS)',
  CREDIT_CARD: 'Credit Card',
  PETTY_CASH: 'Petty Cash Box'
};

export function AccountingAndExpensesView({ currentRole }: AccountingAndExpensesViewProps) {
  const [expenses, setExpenses] = useState<WorkshopExpense[]>(() => getWorkshopExpenses());
  const [jobCards, setJobCards] = useState(() => getJobCards());
  const [workshops, setWorkshops] = useState(() => getWorkshops());

  // Navigation Tab inside Accounting Module
  const [activeSubTab, setActiveSubTab] = useState<'OVERVIEW' | 'EXPENSES'>('EXPENSES');

  // Search and Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | 'ALL'>('ALL');
  const [selectedWorkshop, setSelectedWorkshop] = useState<string>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<ExpensePaymentMode | 'ALL'>('ALL');

  // New Expense Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  // Form Fields
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<ExpenseCategory>('ELECTRICITY_UTILITIES');
  const [formAmount, setFormAmount] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [formWorkshopId, setFormWorkshopId] = useState<string>(() => workshops[0]?.id || '');
  const [formPaymentMode, setFormPaymentMode] = useState<ExpensePaymentMode>('UPI');
  const [formPaidByName, setFormPaidByName] = useState('Workshop Manager');
  const [formVendorName, setFormVendorName] = useState('');
  const [formReceiptNumber, setFormReceiptNumber] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Subscribe to store changes
  useEffect(() => {
    const unsubscribe = subscribeToStore(() => {
      setExpenses(getWorkshopExpenses());
      setJobCards(getJobCards());
      setWorkshops(getWorkshops());
    });
    return () => unsubscribe();
  }, []);

  const refreshExpenses = () => {
    setExpenses(getWorkshopExpenses());
  };

  // Open modal for editing
  const handleEditClick = (exp: WorkshopExpense) => {
    setEditingExpenseId(exp.id);
    setFormTitle(exp.title);
    setFormCategory(exp.category);
    setFormAmount(exp.amount.toString());
    setFormDate(exp.date);
    setFormWorkshopId(exp.workshopId || workshops[0]?.id || '');
    setFormPaymentMode(exp.paymentMode);
    setFormPaidByName(exp.paidByName);
    setFormVendorName(exp.vendorName || '');
    setFormReceiptNumber(exp.receiptNumber || '');
    setFormNotes(exp.notes || '');
    setShowAddModal(true);
  };

  // Open modal for new
  const handleOpenAddModal = () => {
    setEditingExpenseId(null);
    setFormTitle('');
    setFormCategory('STAFF_WELFARE');
    setFormAmount('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormWorkshopId(workshops[0]?.id || '');
    setFormPaymentMode('PETTY_CASH');
    setFormPaidByName('Workshop Manager');
    setFormVendorName('');
    setFormReceiptNumber('');
    setFormNotes('');
    setShowAddModal(true);
  };

  // Save Expense Form
  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formAmount || isNaN(Number(formAmount))) return;

    const selectedWs = workshops.find(w => w.id === formWorkshopId);

    if (editingExpenseId) {
      updateWorkshopExpense(editingExpenseId, {
        title: formTitle.trim(),
        category: formCategory,
        amount: Number(formAmount),
        date: formDate,
        workshopId: formWorkshopId,
        workshopName: selectedWs ? selectedWs.name : 'Central Workshop',
        paymentMode: formPaymentMode,
        paidByName: formPaidByName,
        vendorName: formVendorName.trim() || undefined,
        receiptNumber: formReceiptNumber.trim() || undefined,
        notes: formNotes.trim() || undefined,
      });
    } else {
      addWorkshopExpense({
        title: formTitle.trim(),
        category: formCategory,
        amount: Number(formAmount),
        date: formDate,
        workshopId: formWorkshopId,
        workshopName: selectedWs ? selectedWs.name : 'Central Workshop',
        paymentMode: formPaymentMode,
        paidByName: formPaidByName,
        vendorName: formVendorName.trim() || undefined,
        receiptNumber: formReceiptNumber.trim() || undefined,
        notes: formNotes.trim() || undefined,
        isApproved: true,
        approvedByName: currentRole
      });
    }

    setShowAddModal(false);
    refreshExpenses();
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this expense record?')) {
      deleteWorkshopExpense(id);
      refreshExpenses();
    }
  };

  // Compute Revenue Metrics from Invoiced Job Cards
  const totalRevenueBilled = jobCards.reduce((sum, card) => {
    const cardTasksTotal = card.tasks.reduce((tSum, t) => tSum + (t.isCustomerApproved !== false ? t.customerPrice : 0), 0);
    const cardGst = Math.round(cardTasksTotal * 0.18);
    const grandTotal = Math.max(0, cardTasksTotal + cardGst - (card.discount || 0));
    return sum + grandTotal;
  }, 0);

  const totalRevenueCollected = jobCards.reduce((sum, card) => sum + (card.advancePaid || 0), 0);

  // Filter Expenses
  const filteredExpenses = expenses.filter(exp => {
    const query = searchTerm.toLowerCase();
    const matchesSearch = 
      exp.title.toLowerCase().includes(query) ||
      exp.id.toLowerCase().includes(query) ||
      (exp.vendorName && exp.vendorName.toLowerCase().includes(query)) ||
      (exp.receiptNumber && exp.receiptNumber.toLowerCase().includes(query)) ||
      (exp.paidByName && exp.paidByName.toLowerCase().includes(query)) ||
      (exp.workshopName && exp.workshopName.toLowerCase().includes(query));

    if (!matchesSearch) return false;

    if (selectedCategory !== 'ALL' && exp.category !== selectedCategory) return false;
    if (selectedWorkshop !== 'ALL' && exp.workshopId !== selectedWorkshop) return false;
    if (paymentFilter !== 'ALL' && exp.paymentMode !== paymentFilter) return false;

    return true;
  });

  // Financial Stats Calculations
  const totalExpenseAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netOperatingProfit = totalRevenueBilled - totalExpenseAmount;
  const netMarginPercent = totalRevenueBilled > 0 ? (netOperatingProfit / totalRevenueBilled) * 100 : 0;

  // Expenses by Category breakdown
  const categoryTotals: Record<ExpenseCategory, number> = {
    ELECTRICITY_UTILITIES: 0,
    RENT_LEASE: 0,
    STAFF_WELFARE: 0,
    TOOLS_MAINTENANCE: 0,
    OFFICE_ADMIN: 0,
    FUEL_LOGISTICS: 0,
    STATUTORY_TAXES: 0,
    MISCELLANEOUS: 0
  };

  filteredExpenses.forEach(exp => {
    if (categoryTotals[exp.category] !== undefined) {
      categoryTotals[exp.category] += exp.amount;
    } else {
      categoryTotals.MISCELLANEOUS += exp.amount;
    }
  });

  // Export Expenses to CSV
  const handleExportCSV = () => {
    const headers = ['Expense ID', 'Date', 'Title', 'Category', 'Amount (INR)', 'Workshop', 'Payment Mode', 'Paid By', 'Vendor', 'Receipt Ref', 'Notes'];
    const rows = filteredExpenses.map(e => [
      e.id,
      e.date,
      `"${e.title.replace(/"/g, '""')}"`,
      e.category,
      e.amount,
      `"${(e.workshopName || '').replace(/"/g, '""')}"`,
      e.paymentMode,
      `"${e.paidByName.replace(/"/g, '""')}"`,
      `"${(e.vendorName || '').replace(/"/g, '""')}"`,
      `"${(e.receiptNumber || '').replace(/"/g, '""')}"`,
      `"${(e.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Workshop_Expenses_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Workshop Accounting & Expenses</span>
              <span className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border border-indigo-500/20">
                P&L & Operating Costs
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              Track electricity, facility lease, staff welfare, tool maintenance, and miscellaneous garage costs against job revenue.
            </p>
          </div>
        </div>

        {/* Tab Sub-Nav & Add Button */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
            <button
              onClick={() => setActiveSubTab('EXPENSES')}
              className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                activeSubTab === 'EXPENSES'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Workshop Expenses</span>
            </button>
            <button
              onClick={() => setActiveSubTab('OVERVIEW')}
              className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                activeSubTab === 'OVERVIEW'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>P&L Overview</span>
            </button>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white font-extrabold text-xs shadow-md flex items-center gap-2 transition-all shrink-0 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Log New Expense</span>
            <span className="sm:hidden">Log</span>
          </button>
        </div>
      </div>

      {/* TOP KPI METRICS SUMMARY */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Gross Revenue</p>
          <p className="text-xl font-black text-slate-900 dark:text-white font-mono">
            ₹{Math.round(totalRevenueBilled).toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5 font-mono">
            <ArrowUpRight className="w-3 h-3" />
            <span>₹{Math.round(totalRevenueCollected).toLocaleString('en-IN')} collected</span>
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Workshop Expenses</p>
          <p className="text-xl font-black text-rose-600 dark:text-rose-400 font-mono">
            ₹{Math.round(totalExpenseAmount).toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-slate-500 font-mono">
            {filteredExpenses.length} logged expense items
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Net Operating Profit</p>
          <p className={`text-xl font-black font-mono ${netOperatingProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            ₹{Math.round(netOperatingProfit).toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-slate-500 font-mono">
            Revenue minus operational costs
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Operating Margin %</p>
          <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
            {netMarginPercent.toFixed(1)}%
          </p>
          <p className="text-[11px] text-slate-500 font-mono">
            Net Margin efficiency ratio
          </p>
        </div>

      </div>

      {/* TAB 1: WORKSHOP EXPENSES LIST & TRACKING MODULE */}
      {activeSubTab === 'EXPENSES' && (
        <div className="space-y-4">
          
          {/* SEARCH & FILTERS BAR */}
          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
            
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search expense, vendor, receipt #, paid by..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Dropdown Filters */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full md:w-auto text-xs">
              
              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as any)}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold focus:outline-hidden"
              >
                <option value="ALL">All Expense Categories</option>
                {Object.entries(CATEGORY_MAP).map(([key, value]) => (
                  <option key={key} value={key}>{value.label}</option>
                ))}
              </select>

              {/* Workshop Location Filter */}
              <select
                value={selectedWorkshop}
                onChange={(e) => setSelectedWorkshop(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold focus:outline-hidden"
              >
                <option value="ALL">All Workshop Locations</option>
                {workshops.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>

              {/* Payment Mode Filter */}
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value as any)}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold focus:outline-hidden col-span-2 sm:col-span-1"
              >
                <option value="ALL">All Payment Modes</option>
                {Object.entries(PAYMENT_MODE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>

            </div>

            {/* Export CSV Button */}
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 w-full md:w-auto justify-center"
              title="Download CSV Statement"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

          </div>

          {/* EXPENSES DIRECTORY TABLE */}
          {filteredExpenses.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
              <Receipt className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
              <h3 className="font-extrabold text-slate-800 dark:text-slate-200 text-base">
                No Expense Records Found
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No workshop expenses match your current filter parameters. Try resetting filters or log a new expense.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900 shadow-xs">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                    <th className="p-3.5 pl-5">Date & Ref ID</th>
                    <th className="p-3.5">Expense Description</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Workshop / Facility</th>
                    <th className="p-3.5">Payment & Paid By</th>
                    <th className="p-3.5 text-right font-mono">Amount (₹)</th>
                    <th className="p-3.5 text-center pr-5">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredExpenses.map((exp) => {
                    const catInfo = CATEGORY_MAP[exp.category] || CATEGORY_MAP.MISCELLANEOUS;
                    const CategoryIcon = catInfo.icon;

                    return (
                      <tr 
                        key={exp.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        
                        {/* Date & Ref */}
                        <td className="p-3.5 pl-5 space-y-0.5">
                          <p className="font-mono font-black text-slate-900 dark:text-slate-100 text-xs">
                            {exp.id}
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            {exp.date}
                          </p>
                        </td>

                        {/* Title & Vendor */}
                        <td className="p-3.5 space-y-0.5 max-w-xs">
                          <p className="font-bold text-slate-900 dark:text-slate-100 leading-tight">
                            {exp.title}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            {exp.vendorName && (
                              <span>Vendor: <strong className="text-slate-700 dark:text-slate-300">{exp.vendorName}</strong></span>
                            )}
                            {exp.receiptNumber && (
                              <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded text-[10px]">
                                Ref: {exp.receiptNumber}
                              </span>
                            )}
                          </div>
                          {exp.notes && (
                            <p className="text-[10px] text-slate-400 italic line-clamp-1">
                              "{exp.notes}"
                            </p>
                          )}
                        </td>

                        {/* Category Badge */}
                        <td className="p-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${catInfo.bg} ${catInfo.color}`}>
                            <CategoryIcon className="w-3.5 h-3.5" />
                            <span>{catInfo.label}</span>
                          </span>
                        </td>

                        {/* Workshop Name */}
                        <td className="p-3.5 text-slate-700 dark:text-slate-300 font-medium">
                          <div className="flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            <span>{exp.workshopName || 'Central Hub'}</span>
                          </div>
                        </td>

                        {/* Payment Mode & Paid By */}
                        <td className="p-3.5 space-y-0.5">
                          <p className="font-bold text-slate-800 dark:text-slate-200">
                            {PAYMENT_MODE_LABELS[exp.paymentMode] || exp.paymentMode}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Paid by: <span className="font-semibold text-slate-700 dark:text-slate-300">{exp.paidByName}</span>
                          </p>
                        </td>

                        {/* Amount */}
                        <td className="p-3.5 text-right font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                          ₹{exp.amount.toLocaleString('en-IN')}
                        </td>

                        {/* Action buttons */}
                        <td className="p-3.5 text-center pr-5">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleEditClick(exp)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Edit Expense"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(exp.id)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Delete Expense"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>
      )}

      {/* TAB 2: FINANCIAL P&L OVERVIEW & CATEGORY BREAKDOWN */}
      {activeSubTab === 'OVERVIEW' && (
        <div className="space-y-6">
          
          {/* CATEGORY SPENDING BREAKDOWN GRID */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-indigo-500" />
                  <span>Workshop Operational Expense Breakdown by Category</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Detailed distribution of miscellaneous garage operating costs across categories.
                </p>
              </div>
              <span className="text-xs font-mono font-extrabold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full">
                Total: ₹{totalExpenseAmount.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(CATEGORY_MAP).map(([catKey, catInfo]) => {
                const amount = categoryTotals[catKey as ExpenseCategory] || 0;
                const percent = totalExpenseAmount > 0 ? (amount / totalExpenseAmount) * 100 : 0;
                const CategoryIcon = catInfo.icon;

                return (
                  <div 
                    key={catKey}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className={`p-2 rounded-xl ${catInfo.bg} ${catInfo.color}`}>
                        <CategoryIcon className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-400">
                        {percent.toFixed(1)}%
                      </span>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {catInfo.label}
                      </p>
                      <p className="text-lg font-black text-slate-900 dark:text-white font-mono mt-0.5">
                        ₹{amount.toLocaleString('en-IN')}
                      </p>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${catInfo.bg.replace('/10', '')}`}
                        style={{ width: `${Math.min(100, percent)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* WORKSHOP PROFITABILITY COMPARISON TABLE */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="font-black text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-500" />
              <span>Workshop / Branch Financial Statement</span>
            </h3>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <th className="p-3 pl-4">Workshop Facility</th>
                    <th className="p-3">City / Hub</th>
                    <th className="p-3 text-right font-mono">Billed Job Revenue</th>
                    <th className="p-3 text-right font-mono">Operating Expenses</th>
                    <th className="p-3 text-right font-mono">Net Operating Profit</th>
                    <th className="p-3 text-center">Profitability</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {workshops.map((ws) => {
                    const wsCards = jobCards.filter(c => c.workshopId === ws.id);
                    const wsRevenue = wsCards.reduce((sum, card) => {
                      const tTotal = card.tasks.reduce((ts, t) => ts + (t.isCustomerApproved !== false ? t.customerPrice : 0), 0);
                      return sum + tTotal;
                    }, 0);

                    const wsExpenses = expenses.filter(e => e.workshopId === ws.id).reduce((sum, e) => sum + e.amount, 0);
                    const wsProfit = wsRevenue - wsExpenses;

                    return (
                      <tr key={ws.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-3 pl-4 font-bold text-slate-900 dark:text-slate-100">
                          {ws.name}
                        </td>
                        <td className="p-3 text-slate-500">
                          {ws.cityName}
                        </td>
                        <td className="p-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          ₹{wsRevenue.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-right font-mono font-semibold text-rose-600 dark:text-rose-400">
                          ₹{wsExpenses.toLocaleString('en-IN')}
                        </td>
                        <td className={`p-3 text-right font-mono font-black ${wsProfit >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'}`}>
                          ₹{wsProfit.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-center">
                          {wsProfit >= 0 ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              Profitable
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                              Deficit
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* MODAL: CREATE / EDIT WORKSHOP EXPENSE */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-lg p-5 sm:p-6 space-y-4 shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-600 font-bold">
                  <Receipt className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                  {editingExpenseId ? 'Edit Workshop Expense' : 'Log New Workshop Expense'}
                </h3>
              </div>

              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-4 text-xs">
              
              {/* Title Description */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  Expense Description / Item Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Electricity Bill, Lift Seal Repair, Staff Tea & Coffee..."
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              {/* Amount & Date Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 2500"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    Date Paid *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Category & Workshop Location Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    Expense Category *
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as ExpenseCategory)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    {Object.entries(CATEGORY_MAP).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    Workshop Facility *
                  </label>
                  <select
                    value={formWorkshopId}
                    onChange={(e) => setFormWorkshopId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    {workshops.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Payment Mode & Paid By Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    Payment Method *
                  </label>
                  <select
                    value={formPaymentMode}
                    onChange={(e) => setFormPaymentMode(e.target.value as ExpensePaymentMode)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    {Object.entries(PAYMENT_MODE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    Paid By (Staff / Manager Name)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Marcus Vance, Rajesh Sharma..."
                    value={formPaidByName}
                    onChange={(e) => setFormPaidByName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Vendor & Receipt Reference */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    Vendor / Payee Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MSEDCL, Sai Tea Stall, HP Pump..."
                    value={formVendorName}
                    onChange={(e) => setFormVendorName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    Receipt / Voucher Ref # (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BILL-99201, PETTY-0728..."
                    value={formReceiptNumber}
                    onChange={(e) => setFormReceiptNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  Notes / Audit Remarks (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional details regarding this cost..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white font-extrabold shadow-md flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{editingExpenseId ? 'Update Expense' : 'Save Expense Record'}</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
