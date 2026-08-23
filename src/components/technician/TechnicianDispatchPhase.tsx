import React, { useState } from 'react';
import { JobCard } from '../../types';
import { 
  Truck, 
  LogOut, 
  CheckCircle2, 
  DollarSign, 
  FileText, 
  Phone, 
  Share2, 
  Printer, 
  ChevronLeft, 
  ShieldCheck, 
  QrCode,
  Lock,
  User,
  Car
} from 'lucide-react';
import { GSTInvoiceView } from '../GSTInvoiceView';

interface TechnicianDispatchPhaseProps {
  card: JobCard;
  onOpenGateCheckOut: () => void;
  onBackToQC: () => void;
}

export function TechnicianDispatchPhase({
  card,
  onOpenGateCheckOut,
  onBackToQC
}: TechnicianDispatchPhaseProps) {
  const [showFullInvoice, setShowFullInvoice] = useState(false);

  // Billing calculations
  const totalTaskPrice = card.tasks
    .filter(t => t.isCustomerApproved !== false)
    .reduce((sum, t) => sum + (t.customerPrice || 0), 0);

  const discountVal = card.discount || 0;
  const taxableAmount = Math.max(0, totalTaskPrice - discountVal);
  const taxVal = Math.round((taxableAmount * (card.taxRate || 18)) / 100);
  const grandTotal = taxableAmount + taxVal;
  const balanceDue = Math.max(0, grandTotal - (card.advancePaid || 0));

  const isDelivered = card.status === 'DELIVERED';

  return (
    <div className="space-y-6">
      
      {/* 1. Fast Gate Check-Out & Dispatch Action Banner */}
      <div className={`p-5 sm:p-6 rounded-3xl border text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl ${
        isDelivered 
          ? 'bg-slate-900 border-emerald-500/50' 
          : 'bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 border-emerald-500/40'
      }`}>
        <div className="flex items-center gap-3.5">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black shrink-0 ${
            isDelivered ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/25' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
          }`}>
            {isDelivered ? <CheckCircle2 className="w-8 h-8" /> : <LogOut className="w-8 h-8" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base sm:text-lg text-white">
                {isDelivered ? '✓ गाड़ी सफलतापूर्वक रवाना हो चुकी है' : 'गेट पास व डिलीवरी कन्फर्मेशन'}
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-black uppercase">
                {card.status}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              {isDelivered 
                ? `ड्राइवर ${card.checkOutDriverName || 'Cars24 Fleet Driver'} द्वारा समय ${card.checkedOutAt || 'अभी'} पर गेट आउट हुआ।`
                : 'गाड़ी पूरी तरह तैयार है। ड्राइवर के साथ फोटो लेकर गेट पास जारी करें।'
              }
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenGateCheckOut}
          className={`px-6 py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl transition-all active:scale-95 w-full sm:w-auto ${
            isDelivered
              ? 'bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700'
              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30 ring-2 ring-emerald-400'
          }`}
        >
          <LogOut className="w-4 h-4" />
          <span>{isDelivered ? 'गेट पास रसीद देखें (View Exit Pass)' : '🚪 गेट पास बनाएं व गाड़ी छोड़ें (Gate Exit)'}</span>
        </button>
      </div>

      {/* 2. Bill Settlement & Accounting Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-white space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400">कुल बिल (Total Bill)</span>
          <p className="text-xl font-black font-mono text-emerald-400">₹{grandTotal.toLocaleString('en-IN')}</p>
          <span className="text-[11px] text-slate-400">GST 18% सहित कुल राशि</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-white space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400">एडवांस प्राप्त (Advance Paid)</span>
          <p className="text-xl font-black font-mono text-blue-400">₹{(card.advancePaid || 0).toLocaleString('en-IN')}</p>
          <span className="text-[11px] text-slate-400">जमा एडवांस रकम</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-white space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400">बाकी भुगतान (Balance Due)</span>
          <p className="text-xl font-black font-mono text-amber-400">₹{balanceDue.toLocaleString('en-IN')}</p>
          <span className="text-[11px] text-slate-400">{balanceDue === 0 ? '✓ पूरा चुकता (Paid)' : 'डिलीवरी पर देय'}</span>
        </div>

      </div>

      {/* 3. Fast Actions: WhatsApp Customer & GST Invoice */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              <span>जीएसटी इनवॉइस व ग्राहक सूचना (GST Bill & Customer Receipt)</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              ग्राहक {card.customer.name} ({card.customer.phone})
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <a
              href={`https://wa.me/${card.customer.phone.replace(/[^0-9]/g, '')}?text=Namaste%20${encodeURIComponent(card.customer.name)},%20your%20vehicle%20${encodeURIComponent(card.vehicle.registrationNumber)}%20is%20repaired%20and%20ready%20for%20delivery!%20Total%20Bill:%20INR%20${grandTotal}.`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp पर भेजें</span>
            </a>

            <button
              type="button"
              onClick={() => setShowFullInvoice(prev => !prev)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs border border-slate-700"
            >
              {showFullInvoice ? 'इनवॉइस छुपाएं' : '📄 पूरा इनवॉइस देखें'}
            </button>
          </div>
        </div>

        {showFullInvoice && (
          <div className="pt-3 border-t border-slate-800">
            <GSTInvoiceView card={card} currentRole="FLOOR_MANAGER" />
          </div>
        )}
      </div>

      {/* 4. Stepper Bottom Navigation */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border-2 border-slate-800 flex items-center justify-between gap-4 shadow-xl">
        <button
          type="button"
          onClick={onBackToQC}
          className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>⬅️ 3. क्वालिटी चेक (QC Phase) पर वापस जाएं</span>
        </button>

        <span className="text-xs text-emerald-400 font-bold hidden sm:inline-block">
          ✓ ऑल फेज़ कम्प्लीटेड (All 4 Phases Done)
        </span>
      </div>

    </div>
  );
}
