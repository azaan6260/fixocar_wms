import React, { useState } from 'react';
import { JobCard, UserRole } from '../types';
import { 
  STANDARD_HSN_CODES, 
  GST_RATES, 
  DEFAULT_WORKSHOP_GSTIN, 
  DEFAULT_CARS24_GSTIN,
  getDefaultHSNForCategory,
  numberToWordsIndian,
  StandardHSN 
} from '../lib/hsnData';
import { updateJobCardGSTInvoice } from '../lib/storage';
import { 
  FileText, 
  Printer, 
  Share2, 
  Edit3, 
  CheckCircle2, 
  Building2, 
  Car, 
  User, 
  X, 
  Info, 
  DollarSign, 
  Settings2,
  ChevronDown,
  ShieldCheck,
  QrCode,
  Tag
} from 'lucide-react';

interface GSTInvoiceViewProps {
  card: JobCard;
  onRefreshCard?: () => void;
  currentRole?: UserRole;
  isCustomerPortal?: boolean;
}

export interface InvoiceLineItem {
  id: string;
  type: 'LABOR' | 'PART' | 'CONSUMABLE';
  title: string;
  category: string;
  partNumber?: string;
  quantity: number;
  unitPrice: number;
  taxableValue: number;
  hsnCode: string;
  gstRate: number; // e.g. 28, 18, 12, 5
}

export function GSTInvoiceView({
  card,
  onRefreshCard,
  currentRole,
  isCustomerPortal = false
}: GSTInvoiceViewProps) {
  // Modal states for HSN & GST editor
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [showConfigHeaderModal, setShowConfigHeaderModal] = useState(false);

  // Editable header fields
  const [workshopGstin, setWorkshopGstin] = useState(
    card.workshopGstin || DEFAULT_WORKSHOP_GSTIN
  );
  const [customerGstin, setCustomerGstin] = useState(
    card.customerGstin || (card.isCars24 ? DEFAULT_CARS24_GSTIN : '')
  );
  const [isInterstate, setIsInterstate] = useState<boolean>(
    card.isInterstate || false
  );
  const [stateCode, setStateCode] = useState(
    card.stateCode || "27 - Maharashtra"
  );
  const [invoiceNumber, setInvoiceNumber] = useState(
    card.invoiceNumber || `INV/2026-27/${card.id.replace('JC-', '')}`
  );
  const [invoiceDate, setInvoiceDate] = useState(
    card.invoiceDate || new Date().toISOString().split('T')[0]
  );

  // Line item tax overrides stored on card
  const [itemTaxMap, setItemTaxMap] = useState<Record<string, { hsnCode: string; gstRate: number }>>(
    () => card.customItemTaxRates || {}
  );

  // 1. Compile Line Items across tasks and parts
  const lineItems = React.useMemo(() => {
    const items: InvoiceLineItem[] = [];

    card.tasks.forEach((task) => {
      // Skip customer rejected tasks
      if (task.isCustomerApproved === false) return;

      // Labor Task
      const taskItemId = `task-${task.id}`;
      const savedTaskTax = itemTaxMap[taskItemId];
      const defaultTaskHsn = getDefaultHSNForCategory(task.category, false);

      items.push({
        id: taskItemId,
        type: 'LABOR',
        title: task.title + (task.isAdditionalWork ? ' (Additional Repair Work)' : ''),
        category: task.category,
        quantity: 1,
        unitPrice: task.customerPrice,
        taxableValue: task.customerPrice,
        hsnCode: savedTaskTax?.hsnCode || task.hsnCode || defaultTaskHsn.code,
        gstRate: savedTaskTax?.gstRate ?? task.gstRate ?? defaultTaskHsn.rate
      });

      // Parts in Task (from task.requisitions or task.partsList)
      if (task.requisitions && task.requisitions.length > 0) {
        task.requisitions.forEach((req) => {
          if (req.status === 'APPROVED' || req.status === 'ORDERED' || req.status === 'RECEIVED' || req.status === 'CONSUMED') {
            const reqItemId = `req-${req.id}`;
            const savedReqTax = itemTaxMap[reqItemId];
            const defaultPartHsn = getDefaultHSNForCategory(task.category, true);
            const uPrice = req.approvedPrice && req.quantity > 0 
              ? Math.round(req.approvedPrice / req.quantity) 
              : (req.suggestedPrice || 0);
            const taxVal = req.approvedPrice || (uPrice * req.quantity);

            items.push({
              id: reqItemId,
              type: req.itemType === 'CONSUMABLE' ? 'CONSUMABLE' : 'PART',
              title: req.title,
              category: task.category,
              partNumber: req.partNumber,
              quantity: req.quantity,
              unitPrice: uPrice,
              taxableValue: taxVal,
              hsnCode: savedReqTax?.hsnCode || req.hsnCode || defaultPartHsn.code,
              gstRate: savedReqTax?.gstRate ?? req.gstRate ?? defaultPartHsn.rate
            });
          }
        });
      } else if (task.partsList && task.partsList.length > 0) {
        task.partsList.forEach((p) => {
          const partItemId = `part-${p.id}`;
          const savedPartTax = itemTaxMap[partItemId];
          const defaultPartHsn = getDefaultHSNForCategory(task.category, true);
          const uPrice = p.unitPrice || 0;
          const taxVal = p.totalPrice || (uPrice * p.quantity);

          items.push({
            id: partItemId,
            type: p.type === 'CONSUMABLE' ? 'CONSUMABLE' : 'PART',
            title: p.name,
            category: task.category,
            partNumber: p.partNumber,
            quantity: p.quantity,
            unitPrice: uPrice,
            taxableValue: taxVal,
            hsnCode: savedPartTax?.hsnCode || p.hsnCode || defaultPartHsn.code,
            gstRate: savedPartTax?.gstRate ?? p.gstRate ?? defaultPartHsn.rate
          });
        });
      }
    });

    return items;
  }, [card, itemTaxMap]);

  // 2. Calculations per item
  const lineItemCalculations = lineItems.map((item) => {
    const taxAmt = (item.taxableValue * item.gstRate) / 100;
    const totalAmt = item.taxableValue + taxAmt;

    let cgstRate = 0, cgstAmt = 0;
    let sgstRate = 0, sgstAmt = 0;
    let igstRate = 0, igstAmt = 0;

    if (isInterstate) {
      igstRate = item.gstRate;
      igstAmt = taxAmt;
    } else {
      cgstRate = item.gstRate / 2;
      cgstAmt = taxAmt / 2;
      sgstRate = item.gstRate / 2;
      sgstAmt = taxAmt / 2;
    }

    return {
      ...item,
      taxAmt,
      totalAmt,
      cgstRate,
      cgstAmt,
      sgstRate,
      sgstAmt,
      igstRate,
      igstAmt
    };
  });

  // 3. HSN/SAC Summary Grouping
  const hsnSummaryMap = React.useMemo(() => {
    const map: Record<string, {
      hsnCode: string;
      taxableValue: number;
      cgstRate: number;
      cgstAmt: number;
      sgstRate: number;
      sgstAmt: number;
      igstRate: number;
      igstAmt: number;
      totalTax: number;
    }> = {};

    lineItemCalculations.forEach((calc) => {
      const key = `${calc.hsnCode}-${calc.gstRate}`;
      if (!map[key]) {
        map[key] = {
          hsnCode: calc.hsnCode,
          taxableValue: 0,
          cgstRate: calc.cgstRate,
          cgstAmt: 0,
          sgstRate: calc.sgstRate,
          sgstAmt: 0,
          igstRate: calc.igstRate,
          igstAmt: 0,
          totalTax: 0
        };
      }

      map[key].taxableValue += calc.taxableValue;
      map[key].cgstAmt += calc.cgstAmt;
      map[key].sgstAmt += calc.sgstAmt;
      map[key].igstAmt += calc.igstAmt;
      map[key].totalTax += calc.taxAmt;
    });

    return Object.values(map);
  }, [lineItemCalculations]);

  // 4. Totals
  const totalTaxableValue = lineItemCalculations.reduce((sum, i) => sum + i.taxableValue, 0);
  const totalCGST = lineItemCalculations.reduce((sum, i) => sum + i.cgstAmt, 0);
  const totalSGST = lineItemCalculations.reduce((sum, i) => sum + i.sgstAmt, 0);
  const totalIGST = lineItemCalculations.reduce((sum, i) => sum + i.igstAmt, 0);
  const totalTaxAmount = lineItemCalculations.reduce((sum, i) => sum + i.taxAmt, 0);

  const grossTotal = totalTaxableValue + totalTaxAmount;
  const discountVal = card.discount || 0;
  const grandTotal = Math.max(0, grossTotal - discountVal);
  const advancePaid = card.advancePaid || 0;
  const balanceDue = Math.max(0, grandTotal - advancePaid);
  const amountInWords = numberToWordsIndian(grandTotal);

  // Save Header & Config updates
  const handleSaveHeaderConfig = (e: React.FormEvent) => {
    e.preventDefault();
    updateJobCardGSTInvoice(card.id, {
      workshopGstin,
      customerGstin,
      isInterstate,
      stateCode,
      invoiceNumber,
      invoiceDate
    });
    setShowConfigHeaderModal(false);
    if (onRefreshCard) onRefreshCard();
  };

  // Save HSN & GST rate overrides
  const handleSaveTaxOverrides = (newMap: Record<string, { hsnCode: string; gstRate: number }>) => {
    setItemTaxMap(newMap);
    updateJobCardGSTInvoice(card.id, {
      customItemTaxRates: newMap
    });
    setShowEditorModal(false);
    if (onRefreshCard) onRefreshCard();
  };

  // WhatsApp GST Invoice Share
  const handleShareWhatsApp = () => {
    const customerPhone = card.customer.phone.replace(/[^0-9]/g, '');
    const cleanPhone = customerPhone.length === 10 ? `91${customerPhone}` : customerPhone;

    let text = `🧾 *AUTOCRAFT MOTORS - GST TAX INVOICE*\n`;
    text += `*Invoice #:* ${invoiceNumber}\n`;
    text += `*Date:* ${invoiceDate}\n`;
    text += `*GSTIN:* ${workshopGstin}\n\n`;

    text += `*CUSTOMER & VEHICLE DETAILS:*\n`;
    text += `• Customer: ${card.customer.name} (${card.customer.phone})\n`;
    text += `• Vehicle: ${card.vehicle.registrationNumber} - ${card.vehicle.make} ${card.vehicle.model}\n`;
    if (customerGstin) text += `• Client GSTIN: ${customerGstin}\n`;
    text += `\n*ITEMIZED REPAIR & PARTS BREAKDOWN:*\n`;

    lineItemCalculations.forEach((item, idx) => {
      text += `${idx + 1}. *${item.title}*\n`;
      text += `   [${item.type}] HSN/SAC: ${item.hsnCode} | GST: ${item.gstRate}%\n`;
      text += `   Qty: ${item.quantity} x ₹${item.unitPrice} = ₹${item.taxableValue.toLocaleString('en-IN')} (+ Tax: ₹${Math.round(item.taxAmt)})\n`;
    });

    text += `\n--------------------------------\n`;
    text += `• *Taxable Amount:* ₹${totalTaxableValue.toLocaleString('en-IN')}\n`;
    if (!isInterstate) {
      text += `• *CGST:* ₹${Math.round(totalCGST).toLocaleString('en-IN')}\n`;
      text += `• *SGST:* ₹${Math.round(totalSGST).toLocaleString('en-IN')}\n`;
    } else {
      text += `• *IGST:* ₹${Math.round(totalIGST).toLocaleString('en-IN')}\n`;
    }
    if (discountVal > 0) text += `• *Discount:* -₹${discountVal.toLocaleString('en-IN')}\n`;
    text += `• *GRAND TOTAL:* ₹${Math.round(grandTotal).toLocaleString('en-IN')}\n`;
    text += `• *Advance Paid:* ₹${advancePaid.toLocaleString('en-IN')}\n`;
    text += `• *NET BALANCE DUE:* ₹${Math.round(balanceDue).toLocaleString('en-IN')}\n`;
    text += `\n_Thank you for servicing your vehicle with AutoCraft Workshop!_\n`;

    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, '_blank');
  };

  return (
    <div className="space-y-6">
      
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs print:hidden">
        
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-extrabold text-slate-900 dark:text-slate-100 text-base flex items-center gap-2">
              <span>GST Tax Invoice & HSN Summary</span>
              {card.isCars24 && (
                <span className="bg-orange-500/20 text-orange-700 dark:text-orange-300 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">
                  Cars24 B2B Invoice
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500">
              Tax invoice with itemized HSN/SAC codes, CGST/SGST breakdown, and WhatsApp/Print PDF export.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {!isCustomerPortal && (
            <>
              <button
                onClick={() => setShowConfigHeaderModal(true)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition-all"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>GSTIN & Terms</span>
              </button>

              <button
                onClick={() => setShowEditorModal(true)}
                className="px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 font-bold text-xs flex items-center gap-1.5 transition-all border border-indigo-200 dark:border-indigo-800"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit HSN & GST %</span>
              </button>
            </>
          )}

          <button
            onClick={handleShareWhatsApp}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs shadow-md flex items-center gap-2 transition-all"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Send Invoice via WhatsApp</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 font-extrabold text-xs shadow-md flex items-center gap-2 transition-all"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print GST Invoice</span>
          </button>
        </div>

      </div>

      {/* PRINTABLE GST TAX INVOICE CONTAINER */}
      <div className="bg-white text-slate-900 rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-sm print:p-0 print:border-none print:shadow-none print:bg-white print:text-black">
        
        {/* Invoice Letterhead Header */}
        <div className="border-b-2 border-slate-900 pb-5 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            
            {/* Workshop Branding */}
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black text-sm">
                  AC
                </div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
                  Auto<span className="text-amber-600">Craft</span> Motors Pvt Ltd
                </h1>
              </div>
              <p className="text-xs font-semibold text-slate-600 mt-1">
                Multi-Brand Auto Repair & Service Center
              </p>
              <p className="text-xs text-slate-500">
                Plot 42, Workshop Hub, Whitefield Industrial Area, Bengaluru - 560066
              </p>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Phone: +91 98765 43210 • Email: billing@autocraftmotors.com
              </p>
              <p className="text-xs font-mono font-black text-slate-900 mt-1">
                GSTIN: <span className="text-amber-700 bg-amber-500/10 px-1.5 py-0.5 rounded">{workshopGstin}</span> • State Code: {stateCode}
              </p>
            </div>

            {/* Invoice Meta Box */}
            <div className="text-left sm:text-right bg-slate-50 p-4 rounded-2xl border border-slate-200 min-w-[220px]">
              <span className="px-3 py-1 bg-slate-900 text-white text-xs font-black rounded-full uppercase tracking-wider inline-block mb-2">
                TAX INVOICE
              </span>
              <p className="text-xs font-mono">
                <span className="text-slate-500">Invoice #: </span>
                <strong className="text-slate-900 font-bold">{invoiceNumber}</strong>
              </p>
              <p className="text-xs font-mono">
                <span className="text-slate-500">Invoice Date: </span>
                <strong className="text-slate-900">{invoiceDate}</strong>
              </p>
              <p className="text-xs font-mono">
                <span className="text-slate-500">Job Card Ref: </span>
                <strong className="text-indigo-600">{card.id}</strong>
              </p>
              <p className="text-xs font-mono">
                <span className="text-slate-500">Place of Supply: </span>
                <strong className="text-slate-900">{stateCode}</strong>
              </p>
            </div>

          </div>
        </div>

        {/* Bill To & Vehicle Info Box */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
          
          {/* Customer / Bill To Details */}
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
              Billed To (Customer Details):
            </span>
            <p className="font-black text-sm text-slate-900 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span>{card.customer.name}</span>
            </p>
            <p className="text-slate-600">Phone: {card.customer.phone}</p>
            <p className="text-slate-600">Email: {card.customer.email || 'N/A'}</p>
            <p className="text-slate-600">Address: {card.customer.address || 'Bengaluru'}</p>
            {customerGstin ? (
              <p className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 mt-1 inline-block">
                Client GSTIN: {customerGstin}
              </p>
            ) : (
              <p className="text-[11px] text-slate-400 italic">Unregistered End-Consumer (B2C)</p>
            )}
          </div>

          {/* Vehicle & Repair Details */}
          <div className="space-y-1 md:border-l md:border-slate-200 md:pl-4">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
              Vehicle & Repair Details:
            </span>
            <p className="font-mono font-black text-sm text-indigo-700 flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5 text-indigo-600" />
              <span>{card.vehicle.registrationNumber}</span>
            </p>
            <p className="text-slate-700 font-bold">
              {card.vehicle.make} {card.vehicle.model} ({card.vehicle.year})
            </p>
            <p className="text-slate-600 font-mono">
              Odometer Reading: {card.vehicle.mileage?.toLocaleString() || 0} KM
            </p>
            {card.isCars24 && (
              <p className="text-xs font-mono text-orange-700 bg-orange-50 px-2 py-0.5 rounded font-bold border border-orange-200 inline-block">
                Cars24 Fleet Order #: {card.cars24RefNo || 'C24-B2B'}
              </p>
            )}
          </div>

        </div>

        {/* Itemized Line Items Table with HSN Code & GST % */}
        <div className="space-y-2">
          <h3 className="font-black text-xs uppercase tracking-wider text-slate-700">
            Itemized Repair Labor & Spare Parts Breakdown
          </h3>

          <div className="overflow-x-auto border border-slate-300 rounded-2xl bg-white">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-black border-b border-slate-300">
                  <th className="p-2.5">#</th>
                  <th className="p-2.5">Item Description</th>
                  <th className="p-2.5 text-center">Type</th>
                  <th className="p-2.5 text-center font-mono">HSN/SAC</th>
                  <th className="p-2.5 text-center">Qty</th>
                  <th className="p-2.5 text-right">Unit Rate</th>
                  <th className="p-2.5 text-right">Taxable Val</th>
                  <th className="p-2.5 text-center font-mono">GST %</th>
                  {!isInterstate ? (
                    <>
                      <th className="p-2.5 text-right font-mono">CGST (₹)</th>
                      <th className="p-2.5 text-right font-mono">SGST (₹)</th>
                    </>
                  ) : (
                    <th className="p-2.5 text-right font-mono">IGST (₹)</th>
                  )}
                  <th className="p-2.5 text-right font-black">Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {lineItemCalculations.map((calc, idx) => (
                  <tr key={`${calc.id}-${idx}`} className="hover:bg-slate-50">
                    <td className="p-2.5 font-bold font-mono text-slate-400">{idx + 1}</td>
                    <td className="p-2.5 font-bold text-slate-900">
                      <p>{calc.title}</p>
                      {calc.partNumber && (
                        <p className="text-[10px] font-mono text-slate-500 font-normal">Part #: {calc.partNumber}</p>
                      )}
                    </td>
                    <td className="p-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        calc.type === 'LABOR' 
                          ? 'bg-blue-100 text-blue-800' 
                          : calc.type === 'CONSUMABLE'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {calc.type}
                      </span>
                    </td>
                    <td className="p-2.5 text-center font-mono font-bold text-slate-700">{calc.hsnCode}</td>
                    <td className="p-2.5 text-center font-mono font-bold">{calc.quantity}</td>
                    <td className="p-2.5 text-right font-mono">₹{calc.unitPrice.toLocaleString('en-IN')}</td>
                    <td className="p-2.5 text-right font-mono font-bold">₹{calc.taxableValue.toLocaleString('en-IN')}</td>
                    <td className="p-2.5 text-center font-mono font-black text-amber-700">{calc.gstRate}%</td>
                    {!isInterstate ? (
                      <>
                        <td className="p-2.5 text-right font-mono text-slate-600">
                          ₹{Math.round(calc.cgstAmt).toLocaleString('en-IN')}
                          <span className="text-[9px] block text-slate-400">({calc.cgstRate}%)</span>
                        </td>
                        <td className="p-2.5 text-right font-mono text-slate-600">
                          ₹{Math.round(calc.sgstAmt).toLocaleString('en-IN')}
                          <span className="text-[9px] block text-slate-400">({calc.sgstRate}%)</span>
                        </td>
                      </>
                    ) : (
                      <td className="p-2.5 text-right font-mono text-slate-600">
                        ₹{Math.round(calc.igstAmt).toLocaleString('en-IN')}
                        <span className="text-[9px] block text-slate-400">({calc.igstRate}%)</span>
                      </td>
                    )}
                    <td className="p-2.5 text-right font-mono font-black text-slate-900">
                      ₹{Math.round(calc.totalAmt).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* HSN / SAC TAX SUMMARY TABLE */}
        <div className="space-y-2 pt-2">
          <h4 className="font-black text-[11px] uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-amber-600" />
            <span>GST Tax Summary by HSN / SAC Code</span>
          </h4>

          <div className="overflow-x-auto border border-slate-300 rounded-xl bg-slate-50">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-200 text-slate-800 font-bold border-b border-slate-300 text-[11px]">
                  <th className="p-2 font-mono">HSN / SAC Code</th>
                  <th className="p-2 text-right font-mono">Taxable Value (₹)</th>
                  {!isInterstate ? (
                    <>
                      <th className="p-2 text-center font-mono">CGST Rate</th>
                      <th className="p-2 text-right font-mono">CGST Amount (₹)</th>
                      <th className="p-2 text-center font-mono">SGST Rate</th>
                      <th className="p-2 text-right font-mono">SGST Amount (₹)</th>
                    </>
                  ) : (
                    <>
                      <th className="p-2 text-center font-mono">IGST Rate</th>
                      <th className="p-2 text-right font-mono">IGST Amount (₹)</th>
                    </>
                  )}
                  <th className="p-2 text-right font-black font-mono">Total Tax (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                {hsnSummaryMap.map((hsn) => (
                  <tr key={`${hsn.hsnCode}-${hsn.cgstRate}`}>
                    <td className="p-2 font-black text-slate-900">{hsn.hsnCode}</td>
                    <td className="p-2 text-right font-bold">₹{hsn.taxableValue.toLocaleString('en-IN')}</td>
                    {!isInterstate ? (
                      <>
                        <td className="p-2 text-center text-slate-600">{hsn.cgstRate}%</td>
                        <td className="p-2 text-right">₹{Math.round(hsn.cgstAmt).toLocaleString('en-IN')}</td>
                        <td className="p-2 text-center text-slate-600">{hsn.sgstRate}%</td>
                        <td className="p-2 text-right">₹{Math.round(hsn.sgstAmt).toLocaleString('en-IN')}</td>
                      </>
                    ) : (
                      <>
                        <td className="p-2 text-center text-slate-600">{hsn.igstRate}%</td>
                        <td className="p-2 text-right">₹{Math.round(hsn.igstAmt).toLocaleString('en-IN')}</td>
                      </>
                    )}
                    <td className="p-2 text-right font-black text-amber-800">
                      ₹{Math.round(hsn.totalTax).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Invoice Summary & Payment Totals Box */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t-2 border-slate-900">
          
          {/* Left: Amount in Words & Bank Details */}
          <div className="space-y-4 text-xs">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">
                Total Invoice Amount In Words:
              </span>
              <p className="font-extrabold text-slate-900 italic text-sm">
                {amountInWords}
              </p>
            </div>

            {/* Payment Terms & Bank Account */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] space-y-1 font-mono">
              <span className="font-bold text-slate-900 uppercase block font-sans text-xs">
                Bank & Payment Details:
              </span>
              <p>Bank: HDFC Bank Ltd • Branch: Whitefield Main Rd</p>
              <p>Account Name: AutoCraft Motors Private Limited</p>
              <p>A/C #: 502000987654321 • IFSC Code: HDFC0001234</p>
              <p>UPI ID: autocraft@hdfcbank</p>
            </div>
          </div>

          {/* Right: Calculations Totals Box */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-2.5 text-xs font-mono">
            <div className="flex justify-between text-slate-300">
              <span>Total Taxable Amount:</span>
              <span className="font-bold">₹{totalTaxableValue.toLocaleString('en-IN')}</span>
            </div>

            {!isInterstate ? (
              <>
                <div className="flex justify-between text-slate-300">
                  <span>Central GST (CGST):</span>
                  <span>₹{Math.round(totalCGST).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>State GST (SGST):</span>
                  <span>₹{Math.round(totalSGST).toLocaleString('en-IN')}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-slate-300">
                <span>Integrated GST (IGST):</span>
                <span>₹{Math.round(totalIGST).toLocaleString('en-IN')}</span>
              </div>
            )}

            {discountVal > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Discount Applied:</span>
                <span>-₹{discountVal.toLocaleString('en-IN')}</span>
              </div>
            )}

            <div className="flex justify-between text-base font-extrabold border-t border-slate-700 pt-2 text-amber-400 font-sans">
              <span>Grand Total (Inc. Taxes):</span>
              <span className="font-mono text-lg">₹{Math.round(grandTotal).toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between text-emerald-400 pt-1">
              <span>Advance Paid Amount:</span>
              <span>₹{advancePaid.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between text-base font-black border-t border-slate-700 pt-2 text-white font-sans">
              <span>Net Balance Payable:</span>
              <span className="text-emerald-400 font-mono text-xl">
                ₹{Math.round(balanceDue).toLocaleString('en-IN')}
              </span>
            </div>
          </div>

        </div>

        {/* Footer Terms & Signatures */}
        <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200 text-xs text-slate-600">
          <div className="space-y-1">
            <h5 className="font-bold text-slate-900 text-[11px] uppercase">Terms & Conditions:</h5>
            <ol className="list-decimal pl-4 space-y-0.5 text-[10px] text-slate-500">
              <li>Goods once sold will not be taken back unless defective.</li>
              <li>Warranty valid for 6 months / 10,000 km on OEM spare parts fitted at workshop.</li>
              <li>All disputes subject to local jurisdiction only.</li>
            </ol>
          </div>

          <div className="text-right space-y-8">
            <p className="font-black text-slate-900 text-xs">For AUTOCRAFT MOTORS PVT LTD</p>
            <div className="border-b border-dashed border-slate-400 w-48 ml-auto"></div>
            <p className="font-bold text-slate-700 text-[11px]">Authorized Signatory</p>
          </div>
        </div>

      </div>

      {/* MODAL 1: EDIT HSN CODES & GST RATES */}
      {showEditorModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl p-6 space-y-5 shadow-2xl my-8">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-500 font-bold">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                    Configure HSN / SAC Codes & GST Rates
                  </h3>
                  <p className="text-xs text-slate-500">
                    Set line-item specific HSN codes and GST rates (28%, 18%, 12%, 5%) for tax compliance.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowEditorModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Preset Picker Help Banner */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <Info className="w-4 h-4 text-amber-500" />
                <span>Automotive Standard Tax Rates:</span>
              </p>
              <p className="text-[11px]">
                • <strong>28% GST:</strong> Spare Parts, Mechanical Assemblies, Tires, Batteries, Glass (HSN: 8708, 4011, 8507)<br/>
                • <strong>18% GST:</strong> Repair Labor Services (SAC: 998714), Oils & Lubricants (HSN: 2710), Filters (HSN: 8421)
              </p>
            </div>

            {/* List of Line Items with HSN & GST Selectors */}
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {lineItems.map((item) => {
                const currentTax = itemTaxMap[item.id] || { hsnCode: item.hsnCode, gstRate: item.gstRate };

                return (
                  <div 
                    key={item.id}
                    className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <p className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                        {item.title}
                      </p>
                      <p className="text-slate-500 font-mono text-[11px]">
                        Category: {item.category} • Value: ₹{item.taxableValue.toLocaleString('en-IN')}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      {/* HSN Code Selector */}
                      <div className="w-1/2 sm:w-44">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase">
                          HSN / SAC Code
                        </label>
                        <select
                          value={currentTax.hsnCode}
                          onChange={(e) => {
                            const selectedHsn = e.target.value;
                            const preset = STANDARD_HSN_CODES.find(h => h.code === selectedHsn);
                            setItemTaxMap(prev => ({
                              ...prev,
                              [item.id]: {
                                hsnCode: selectedHsn,
                                gstRate: preset ? preset.defaultGstRate : currentTax.gstRate
                              }
                            }));
                          }}
                          className="w-full px-2 py-1.5 font-mono text-xs font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600"
                        >
                          {STANDARD_HSN_CODES.map((hsn) => (
                            <option key={hsn.code} value={hsn.code}>
                              {hsn.code} ({hsn.defaultGstRate}%)
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* GST Rate Selector */}
                      <div className="w-1/2 sm:w-28">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase">
                          GST Rate %
                        </label>
                        <select
                          value={currentTax.gstRate}
                          onChange={(e) => {
                            const newRate = Number(e.target.value);
                            setItemTaxMap(prev => ({
                              ...prev,
                              [item.id]: {
                                ...currentTax,
                                gstRate: newRate
                              }
                            }));
                          }}
                          className="w-full px-2 py-1.5 font-mono text-xs font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-amber-600 dark:text-amber-400"
                        >
                          {GST_RATES.map((rate) => (
                            <option key={rate} value={rate}>
                              {rate}% GST
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowEditorModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveTaxOverrides(itemTaxMap)}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-md flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Apply Tax Rates & Save</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 2: CONFIGURE HEADER & GSTIN DETAILS */}
      {showConfigHeaderModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 space-y-4 shadow-2xl">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-slate-900 text-white font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                  GSTIN & Invoice Header Configuration
                </h3>
              </div>

              <button
                onClick={() => setShowConfigHeaderModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveHeaderConfig} className="space-y-3 text-xs">
              
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Workshop Company GSTIN
                </label>
                <input
                  type="text"
                  required
                  value={workshopGstin}
                  onChange={(e) => setWorkshopGstin(e.target.value)}
                  className="w-full px-3 py-2 font-mono text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Customer / B2B Client GSTIN (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 07AABCC8821R1Z5 (For Cars24 / Corporate)"
                  value={customerGstin}
                  onChange={(e) => setCustomerGstin(e.target.value)}
                  className="w-full px-3 py-2 font-mono text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Invoice Number
                  </label>
                  <input
                    type="text"
                    required
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full px-3 py-2 font-mono text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Invoice Date
                  </label>
                  <input
                    type="date"
                    required
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full px-3 py-2 font-mono text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  State Name & Code
                </label>
                <input
                  type="text"
                  value={stateCode}
                  onChange={(e) => setStateCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Inter-state IGST Toggle */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <p className="font-extrabold text-slate-900 dark:text-slate-100">Inter-State Supply (IGST)</p>
                  <p className="text-[10px] text-slate-500">Toggle ON if customer is outside workshop state (IGST instead of CGST+SGST)</p>
                </div>
                <input
                  type="checkbox"
                  checked={isInterstate}
                  onChange={(e) => setIsInterstate(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 accent-indigo-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowConfigHeaderModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-slate-900 text-white font-black shadow-md"
                >
                  Save Configuration
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
