import React from 'react';
import { JobCard } from '../types';
import { formatJobCardStatus } from '../lib/storage';
import { 
  Printer, 
  X, 
  Car, 
  User, 
  Wrench, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  Building2, 
  ShieldCheck,
  Check,
  Tag
} from 'lucide-react';

interface JobCardPrintSummaryModalProps {
  card: JobCard;
  onClose: () => void;
}

export function JobCardPrintSummaryModal({ card, onClose }: JobCardPrintSummaryModalProps) {
  const handlePrint = () => {
    window.print();
  };

  // Financial calculations
  const totalApprovedPrice = card.tasks
    .filter(t => t.isCustomerApproved !== false)
    .reduce((sum, t) => sum + (t.customerPrice || t.estimatedCost || 0), 0);

  const discountVal = card.discount || 0;
  const taxableAmount = Math.max(0, totalApprovedPrice - discountVal);
  const taxRate = card.taxRate || 18;
  const taxVal = Math.round((taxableAmount * taxRate) / 100);
  const grandTotal = taxableAmount + taxVal;
  const advancePaid = card.advancePaid || 0;
  const balanceDue = Math.max(0, grandTotal - advancePaid);

  const createdDateFormatted = card.createdAt 
    ? new Date(card.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'N/A';

  const estDeliveryFormatted = card.estimatedCompletionDate
    ? new Date(card.estimatedCompletionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'As per work progress';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6 overflow-y-auto animate-in fade-in duration-200 print:p-0 print:bg-white print:fixed print:inset-0 print:z-50">
      
      {/* Modal Card Container */}
      <div className="bg-slate-900 text-slate-100 rounded-3xl border border-slate-800 w-full max-w-4xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:rounded-none print:bg-white print:text-black print:my-0">
        
        {/* TOP ACTION BAR (Hidden when printing) */}
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Job Card Print Summary</h3>
              <p className="text-[11px] text-slate-400">Clean, printer-friendly summary of Vehicle #{card.vehicle.registrationNumber}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Close Print Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE DOCUMENT BODY */}
        <div className="p-6 sm:p-10 overflow-y-auto space-y-6 bg-white text-slate-900 print:p-8 print:overflow-visible print:space-y-6">
          
          {/* HEADER LETTERHEAD */}
          <div className="border-b-2 border-slate-900 pb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-slate-900 text-amber-400 flex items-center justify-center font-black text-base print:bg-black print:text-white">
                  FC
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase">
                    Fixo<span className="text-amber-600 print:text-black">Car</span> Workshop Services
                  </h1>
                  <p className="text-xs font-bold text-slate-600">
                    {card.workshopName || 'Multi-Brand Auto Repair & Service Center'} {card.cityName ? `• ${card.cityName}` : ''}
                  </p>
                </div>
              </div>
            </div>

            <div className="text-left sm:text-right bg-slate-100 p-3.5 rounded-2xl border border-slate-200 min-w-[200px] print:bg-slate-50 print:border-slate-300">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-0.5">DOCUMENT TYPE</span>
              <h2 className="text-sm font-black text-slate-900 uppercase">JOB CARD SUMMARY</h2>
              <p className="text-xs font-mono text-amber-700 font-bold mt-1 print:text-slate-900">
                JC ID: #{card.id}
              </p>
              <p className="text-[11px] text-slate-600 font-medium">
                Date: {createdDateFormatted}
              </p>
            </div>
          </div>

          {/* TWO-COLUMN METADATA GRID: VEHICLE INFO & OWNER INFO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* VEHICLE DETAILS BOX */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Car className="w-4 h-4 text-slate-900" /> Vehicle Information
                </span>
                <span className="text-[10px] font-mono font-extrabold bg-slate-900 text-white px-2 py-0.5 rounded print:bg-black">
                  IND PLATE
                </span>
              </div>

              <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-slate-200">
                <div className="bg-slate-900 text-white rounded-lg px-3 py-1 font-mono font-black text-base tracking-wider text-center print:bg-black">
                  {card.vehicle.registrationNumber}
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">
                    {card.vehicle.make} {card.vehicle.model}
                  </h4>
                  <p className="text-xs text-slate-600 font-medium">
                    {card.vehicle.variant || 'Standard Trim'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs pt-1">
                <div>
                  <span className="text-slate-500 font-medium">Fuel Level / Type: </span>
                  <strong className="text-slate-900 font-bold">{card.vehicle.fuelLevel}% ({card.vehicle.fuelType || 'Petrol'})</strong>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Color: </span>
                  <strong className="text-slate-900 font-bold">{card.vehicle.color || 'Standard'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Odometer: </span>
                  <strong className="text-slate-900 font-bold">{card.vehicle.mileage ? `${card.vehicle.mileage.toLocaleString()} km` : 'N/A'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Year: </span>
                  <strong className="text-slate-900 font-bold">{card.vehicle.year || 2022}</strong>
                </div>
                {card.vehicle.vin && (
                  <div className="col-span-2 text-[11px] font-mono">
                    <span className="text-slate-500">VIN/Chassis: </span>
                    <strong className="text-slate-900">{card.vehicle.vin}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* OWNER / CUSTOMER DETAILS BOX */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-slate-900" /> Owner / Customer Info
                </span>
                <span className="text-[10px] font-bold text-slate-600">
                  {card.serviceType || 'CUSTOM_REPAIR'}
                </span>
              </div>

              <div className="space-y-1 text-xs">
                <div>
                  <span className="text-slate-500 font-medium">Customer Name: </span>
                  <strong className="text-sm font-black text-slate-900 block">{card.customer.name}</strong>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <span className="flex items-center gap-1 text-slate-700 font-semibold">
                    <Phone className="w-3.5 h-3.5 text-slate-500" /> {card.customer.phone || 'N/A'}
                  </span>
                  {card.customer.email && (
                    <span className="flex items-center gap-1 text-slate-700 font-semibold truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-500" /> {card.customer.email}
                    </span>
                  )}
                </div>
                {card.customer.address && (
                  <div className="pt-1 text-[11px] text-slate-600 flex items-start gap-1">
                    <MapPin className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />
                    <span>{card.customer.address}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500">Floor Manager: </span>
                  <strong className="text-slate-900 font-bold block">{card.floorManagerName || 'Assigned Manager'}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Target Delivery: </span>
                  <strong className="text-slate-900 font-bold block">{estDeliveryFormatted}</strong>
                </div>
              </div>
            </div>

          </div>

          {/* STATUS BANNER */}
          <div className="bg-slate-100 rounded-xl p-3 border border-slate-200 flex items-center justify-between text-xs font-bold">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-semibold">Overall Status:</span>
              <span className="bg-slate-900 text-white px-2.5 py-0.5 rounded-md font-black uppercase text-[11px] print:bg-black">
                {formatJobCardStatus(card.status)}
              </span>
            </div>
            <div className="text-slate-600">
              Total Work Tasks: <strong className="text-slate-900">{card.tasks.length}</strong> | Completed: <strong className="text-emerald-700">{card.tasks.filter(t => t.status === 'COMPLETED').length}</strong>
            </div>
          </div>

          {/* ITEMISED TASK LIST TABLE */}
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5 border-b-2 border-slate-900 pb-1">
              <Wrench className="w-4 h-4 text-slate-900" /> Scope of Repair & Service Work
            </h3>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-black uppercase text-[10px] tracking-wider print:bg-black">
                    <th className="p-2.5 text-center w-10">#</th>
                    <th className="p-2.5">Task Description</th>
                    <th className="p-2.5">Category</th>
                    <th className="p-2.5">Assigned Technician</th>
                    <th className="p-2.5 text-center">Status</th>
                    <th className="p-2.5 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {card.tasks.map((t, idx) => {
                    const isCompleted = t.status === 'COMPLETED';
                    const isInProgress = t.status === 'IN_PROGRESS';
                    const price = t.customerPrice || t.estimatedCost || 0;

                    return (
                      <tr key={t.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                        <td className="p-2.5 text-center font-bold text-slate-500">{idx + 1}</td>
                        <td className="p-2.5">
                          <div className="font-extrabold text-slate-900">{t.title}</div>
                          {t.notes && <div className="text-[10px] text-slate-500 italic mt-0.5">{t.notes}</div>}
                        </td>
                        <td className="p-2.5 font-semibold text-slate-700">
                          <span className="bg-slate-200 text-slate-800 px-2 py-0.5 rounded text-[10px] font-extrabold">
                            {t.category}
                          </span>
                        </td>
                        <td className="p-2.5 font-medium text-slate-800">
                          {t.assignedToName || 'Unassigned'}
                        </td>
                        <td className="p-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            isCompleted 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                              : isInProgress
                              ? 'bg-blue-100 text-blue-800 border border-blue-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                          ₹{price.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* FINANCIAL SUMMARY */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-2 border-t border-slate-200">
            <div className="text-xs text-slate-500 space-y-1 max-w-sm">
              <p className="font-bold text-slate-700 uppercase text-[10px] tracking-wider">Work Order Terms:</p>
              <p>1. All work completed as per standard quality procedures.</p>
              <p>2. Replaced parts, if any, will be returned upon vehicle delivery.</p>
              <p>3. Estimates are subject to additional work authorization by owner.</p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 w-full sm:w-72 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal Work Price:</span>
                <span className="font-mono font-bold text-slate-900">₹{totalApprovedPrice.toLocaleString('en-IN')}</span>
              </div>
              {discountVal > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount:</span>
                  <span className="font-mono font-bold">-₹{discountVal.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Estimated Tax ({taxRate}%):</span>
                <span className="font-mono font-bold text-slate-900">₹{taxVal.toLocaleString('en-IN')}</span>
              </div>
              <div className="border-t border-slate-300 pt-1.5 flex justify-between font-black text-sm text-slate-900">
                <span>Estimated Total:</span>
                <span className="font-mono text-base text-slate-900">₹{grandTotal.toLocaleString('en-IN')}</span>
              </div>
              {advancePaid > 0 && (
                <div className="flex justify-between text-slate-600 text-[11px] pt-1">
                  <span>Advance Paid:</span>
                  <span className="font-mono font-bold text-emerald-700">₹{advancePaid.toLocaleString('en-IN')}</span>
                </div>
              )}
              {advancePaid > 0 && (
                <div className="flex justify-between font-bold text-slate-900 text-xs border-t border-slate-200 pt-1">
                  <span>Net Balance Due:</span>
                  <span className="font-mono text-amber-800">₹{balanceDue.toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>
          </div>

          {/* SIGNATURE FOOTER */}
          <div className="pt-10 grid grid-cols-2 gap-12 text-xs">
            <div className="border-t border-slate-400 pt-2 text-center space-y-1">
              <p className="font-black text-slate-900">Customer / Vehicle Owner Signature</p>
              <p className="text-[10px] text-slate-500">(Authorized Repair Work & Vehicle Receipt)</p>
            </div>
            <div className="border-t border-slate-400 pt-2 text-center space-y-1">
              <p className="font-black text-slate-900">Authorized Workshop Manager</p>
              <p className="text-[10px] text-slate-500">FixoCar Workshop Representative</p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
