import React, { useState, useEffect } from 'react';
import { DeliveryRecord, UserRole } from '../types';
import { getDeliveries, updateDeliveryStatus } from '../lib/storage';
import confetti from 'canvas-confetti';
import { 
  Truck, 
  MapPin, 
  Phone, 
  User, 
  CheckCircle2, 
  DollarSign, 
  Clock, 
  Navigation,
  CreditCard,
  Banknote,
  QrCode,
  ShieldCheck,
  RefreshCw,
  X
} from 'lucide-react';

interface DeliveryTrackingViewProps {
  currentRole: UserRole;
  onOpenQRModal?: (jobCardId: string) => void;
}

export function DeliveryTrackingView({ currentRole, onOpenQRModal }: DeliveryTrackingViewProps) {
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>(() => getDeliveries());
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryRecord | null>(deliveries[0] || null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'UPI' | 'ONLINE_LINK'>('UPI');

  useEffect(() => {
    setDeliveries(getDeliveries());
  }, []);

  const refreshList = () => {
    const list = getDeliveries();
    setDeliveries(list);
    if (selectedDelivery) {
      const updated = list.find(d => d.id === selectedDelivery.id);
      if (updated) setSelectedDelivery(updated);
    }
  };

  const handleUpdateStatus = (status: DeliveryRecord['status']) => {
    if (!selectedDelivery) return;
    updateDeliveryStatus(selectedDelivery.id, status);
    refreshList();
  };

  const handleCollectPayment = () => {
    if (!selectedDelivery) return;
    updateDeliveryStatus(selectedDelivery.id, 'DELIVERED', 'COLLECTED', paymentMethod);
    setShowPaymentModal(false);
    refreshList();

    // Trigger celebratory confetti
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {}
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Truck className="w-5 h-5 text-cyan-500" />
            Pick & Delivery Boys Logistics Tracker
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time status tracking for home vehicle pickup, workshop arrival, customer delivery, and payment collection.
          </p>
        </div>

        <button
          onClick={refreshList}
          className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-xs font-semibold flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Live Fleet
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Deliveries List */}
        <div className="space-y-3">
          <h3 className="font-bold text-xs uppercase text-slate-500 tracking-wider">Active Logistics Dispatches ({deliveries.length})</h3>

          {deliveries.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
              No active vehicle deliveries.
            </div>
          ) : (
            deliveries.map((del) => {
              const isSelected = selectedDelivery?.id === del.id;
              return (
                <div
                  key={del.id}
                  onClick={() => setSelectedDelivery(del)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all shadow-xs space-y-2 ${
                    isSelected
                      ? 'border-cyan-500 bg-slate-900 text-white shadow-md'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 hover:border-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-cyan-400">{del.vehicleReg}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      del.status === 'DELIVERED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-cyan-500/20 text-cyan-400'
                    }`}>
                      {del.status}
                    </span>
                  </div>

                  <div>
                    <p className="font-bold text-sm">{del.customerName}</p>
                    <p className="text-xs opacity-75">{del.deliveryAddress}</p>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
                    <span className="flex items-center gap-1 opacity-80">
                      <User className="w-3 h-3" /> Driver: {del.deliveryBoyName}
                    </span>
                    <span className="font-bold font-mono text-emerald-400">₹{del.totalAmountDue.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Side: Map Canvas & Driver Controls */}
        <div className="lg:col-span-2 space-y-4">
          {selectedDelivery ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
              
              {/* Delivery Details Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400">
                      {selectedDelivery.id}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">Job Card: {selectedDelivery.jobCardId}</span>
                  </div>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 font-mono mt-1">
                    {selectedDelivery.vehicleReg}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  {onOpenQRModal && (
                    <button
                      type="button"
                      onClick={() => onOpenQRModal(selectedDelivery.jobCardId)}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 text-amber-400 border border-amber-500/40 hover:bg-amber-500 hover:text-slate-950 font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm"
                      title="View Job Card QR Code"
                    >
                      <QrCode className="w-4 h-4" />
                      QR Tracking
                    </button>
                  )}

                  {selectedDelivery.status !== 'DELIVERED' ? (
                    <button
                      onClick={() => setShowPaymentModal(true)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md transition-all flex items-center gap-1.5"
                    >
                      <DollarSign className="w-4 h-4 stroke-[3]" /> Collect Payment & Deliver
                    </button>
                  ) : (
                    <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 text-xs font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Delivered & Paid (₹{selectedDelivery.totalAmountDue.toLocaleString('en-IN')})
                    </span>
                  )}
                </div>
              </div>

              {/* Driver & Location Info Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Customer & Destination</span>
                  <p className="font-bold text-sm text-slate-900 dark:text-slate-100">{selectedDelivery.customerName}</p>
                  <p className="text-slate-600 dark:text-slate-300 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> {selectedDelivery.customerPhone}
                  </p>
                  <p className="text-slate-600 dark:text-slate-300 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-cyan-500" /> {selectedDelivery.deliveryAddress}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Assigned Driver</span>
                  <p className="font-bold text-sm text-slate-900 dark:text-slate-100">{selectedDelivery.deliveryBoyName}</p>
                  <p className="text-slate-600 dark:text-slate-300 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> {selectedDelivery.deliveryBoyPhone}
                  </p>
                  <p className="text-slate-600 dark:text-slate-300 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-500" /> Estimated Time: {selectedDelivery.etaMinutes} mins
                  </p>
                </div>
              </div>

              {/* Simulated Live GPS Map Visualizer */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Navigation className="w-4 h-4 text-cyan-500" /> Live Vehicle Route & Driver GPS Map
                  </span>
                  <span className="text-[11px] text-emerald-500 font-semibold animate-pulse">● Live Tracking Active</span>
                </div>

                <div className="w-full h-56 rounded-2xl bg-slate-950 border border-slate-800 relative overflow-hidden flex items-center justify-center p-4">
                  {/* Grid Lines */}
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:24px_24px] opacity-40"></div>

                  {/* Route Line */}
                  <svg className="absolute inset-0 w-full h-full">
                    <path
                      d="M 60 180 Q 200 60, 450 120 T 700 80"
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="3"
                      strokeDasharray="6 6"
                      className="animate-pulse"
                    />
                  </svg>

                  {/* Workshop Marker */}
                  <div className="absolute left-12 bottom-12 flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-xs shadow-lg">
                      A
                    </div>
                    <span className="text-[10px] text-amber-400 font-bold mt-1 bg-slate-900/80 px-1.5 py-0.5 rounded">Workshop</span>
                  </div>

                  {/* Driver Vehicle Marker */}
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10">
                    <div className="w-10 h-10 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center shadow-lg shadow-cyan-500/50 animate-bounce">
                      <Truck className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] text-cyan-300 font-bold mt-1 bg-slate-900/90 px-2 py-0.5 rounded border border-cyan-500/30">
                      {selectedDelivery.vehicleReg} ({selectedDelivery.deliveryBoyName})
                    </span>
                  </div>

                  {/* Customer Marker */}
                  <div className="absolute right-12 top-12 flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-xs shadow-lg">
                      B
                    </div>
                    <span className="text-[10px] text-emerald-400 font-bold mt-1 bg-slate-900/80 px-1.5 py-0.5 rounded">Customer Home</span>
                  </div>
                </div>
              </div>

              {/* Status Update Controls */}
              <div className="pt-2">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Driver Workflow Status Controls:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'ASSIGNED', label: '1. Driver Assigned' },
                    { id: 'EN_ROUTE_PICKUP', label: '2. En Route to Pickup' },
                    { id: 'AT_WORKSHOP', label: '3. Arrived at Workshop' },
                    { id: 'OUT_FOR_DELIVERY', label: '4. Out for Delivery' },
                    { id: 'DELIVERED', label: '5. Delivered & Closed' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleUpdateStatus(s.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        selectedDelivery.status === s.id
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-500">
              Select a delivery record from the list.
            </div>
          )}
        </div>

      </div>

      {/* Collect Payment Modal */}
      {showPaymentModal && selectedDelivery && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-5 sm:p-6 space-y-5 shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-500" /> Payment Collection
              </h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 text-center space-y-1">
              <span className="text-xs text-slate-500 font-mono">Job Card {selectedDelivery.jobCardId}</span>
              <p className="text-2xl font-extrabold text-emerald-500 font-mono">₹{selectedDelivery.totalAmountDue.toLocaleString('en-IN')}</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">Customer: {selectedDelivery.customerName}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Select Payment Mode:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'UPI', label: 'Instant UPI / QR', icon: QrCode },
                  { id: 'CARD', label: 'Card Reader (POS)', icon: CreditCard },
                  { id: 'CASH', label: 'Cash on Delivery', icon: Banknote },
                  { id: 'ONLINE_LINK', label: 'Online Link', icon: ShieldCheck },
                ].map((pm) => {
                  const Icon = pm.icon;
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPaymentMethod(pm.id as any)}
                      className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold transition-all ${
                        paymentMethod === pm.id
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {pm.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleCollectPayment}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" /> Confirm Payment Received & Close Order
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
