import React, { useState } from 'react';
import { 
  X, 
  Car, 
  Lock, 
  CheckCircle2, 
  LogOut, 
  AlertTriangle, 
  FileText, 
  User, 
  Phone, 
  ShieldAlert,
  Camera,
  Truck
} from 'lucide-react';
import { JobCard } from '../types';
import { updateJobCard, updateVehicleCheckIn, getVehicleCheckIns, dispatchToastNotification } from '../lib/storage';
import { FuelTypeBadge } from './FuelTypeBadge';

interface RestrictedVehicleJobCardModalProps {
  card: JobCard;
  onClose: () => void;
  onRefreshData?: () => void;
}

export function RestrictedVehicleJobCardModal({
  card,
  onClose,
  onRefreshData,
}: RestrictedVehicleJobCardModalProps) {
  const [isCheckOutFormOpen, setIsCheckOutFormOpen] = useState(false);
  const [exitDriverName, setExitDriverName] = useState(card.customer?.name || 'Customer / Driver');
  const [exitDriverPhone, setExitDriverPhone] = useState(card.customer?.phone || '');
  const [exitNotes, setExitNotes] = useState('');
  const [exitPhotoUrl, setExitPhotoUrl] = useState('https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80');

  const isRfc = card.status === 'RFC' || card.status === 'READY_FOR_DELIVERY' || card.status === 'DELIVERED';

  const handleConfirmCheckOut = (e: React.FormEvent) => {
    e.preventDefault();
    if (!exitDriverName.trim()) {
      alert('Please enter driver name for vehicle checkout.');
      return;
    }

    const nowStr = new Date().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });

    // Update Job Card
    updateJobCard(card.id, (prev) => ({
      ...prev,
      status: 'DELIVERED',
      checkedOutAt: nowStr,
      checkOutDriverName: exitDriverName.trim(),
      checkOutDriverPhone: exitDriverPhone.trim(),
      checkOutPhotoWithDriverUrl: exitPhotoUrl,
      checkOutNotes: exitNotes.trim(),
    }));

    // Update Gate CheckIn record if exists
    if (card.checkInRecordId) {
      updateVehicleCheckIn(card.checkInRecordId, (prev) => ({
        ...prev,
        status: 'CHECKED_OUT',
        checkedOutAt: nowStr,
        checkedOutByName: 'Employee / Gate Staff',
        checkOutDriverName: exitDriverName.trim(),
        checkOutDriverPhone: exitDriverPhone.trim(),
        checkOutPhotoWithDriverUrl: exitPhotoUrl,
        checkOutNotes: exitNotes.trim(),
      }));
    } else {
      // Find matching checkin by regNo if not linked directly
      const checkIns = getVehicleCheckIns();
      const match = checkIns.find(c => c.registrationNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === card.vehicle.registrationNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() && c.status !== 'CHECKED_OUT');
      if (match) {
        updateVehicleCheckIn(match.id, (prev) => ({
          ...prev,
          status: 'CHECKED_OUT',
          checkedOutAt: nowStr,
          checkedOutByName: 'Employee / Gate Staff',
          checkOutDriverName: exitDriverName.trim(),
          checkOutDriverPhone: exitDriverPhone.trim(),
          checkOutPhotoWithDriverUrl: exitPhotoUrl,
          checkOutNotes: exitNotes.trim(),
        }));
      }
    }

    dispatchToastNotification({
      type: 'SUCCESS',
      title: 'Vehicle Checked Out',
      message: `Vehicle ${card.vehicle.registrationNumber} has been checked out successfully.`,
    });

    onRefreshData?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-lg shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col text-slate-900 dark:text-slate-100">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-linear-to-r from-amber-500/10 via-slate-900/5 to-transparent border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-base sm:text-lg text-slate-900 dark:text-white uppercase tracking-wider">
                  {card.vehicle.registrationNumber}
                </span>
                <FuelTypeBadge fuelType={card.vehicle.fuelType} />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {card.vehicle.make} {card.vehicle.model} {card.vehicle.variant ? `• ${card.vehicle.variant}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto text-xs">
          
          {/* Restricted Access Alert Box */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-extrabold text-xs uppercase tracking-wide">
                Job Card Allocated to Another Staff
              </h4>
              <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-200/90 font-medium">
                Full repair details are restricted because this job card is not allotted to your account. You can view the job card number and perform vehicle checkout once status is RFC (Ready For Checkout).
              </p>
            </div>
          </div>

          {/* Job Card Overview Card */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-500" />
                Job Card Number
              </span>
              <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                isRfc 
                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30' 
                  : 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30'
              }`}>
                {card.status.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="text-xl font-mono font-black text-blue-600 dark:text-blue-400">
              {card.jobCardNumber || card.id}
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Customer Name</span>
                <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1 mt-0.5">
                  <User className="w-3 h-3 text-slate-400" />
                  {card.customer?.name || 'Walk-in Customer'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Customer Phone</span>
                <span className="font-mono font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1 mt-0.5">
                  <Phone className="w-3 h-3 text-slate-400" />
                  {card.customer?.phone || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Vehicle Check-Out Status & Action */}
          {!isCheckOutFormOpen ? (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-500" />
                <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                  Vehicle Check-Out Status
                </span>
              </div>

              {isRfc ? (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Vehicle is Ready For Checkout (RFC)!</span>
                  </div>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300/80">
                    All repair tasks are complete and quality checked. You may now perform vehicle checkout.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsCheckOutFormOpen(true)}
                    className="w-full mt-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Check Out Vehicle (Vehicle OUT)</span>
                  </button>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-amber-600 dark:text-amber-400">
                    <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Checkout Locked (Vehicle Status: {card.status.replace(/_/g, ' ')})</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Vehicle checkout is possible ONLY when its status is RFC (Ready For Checkout). Please request the allotted technician or advisor to update repair status to RFC first.
                  </p>
                  <button
                    type="button"
                    disabled
                    className="w-full mt-1 py-2.5 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-400 font-bold text-xs flex items-center justify-center gap-2 cursor-not-allowed opacity-60"
                  >
                    <Lock className="w-4 h-4 text-amber-500" />
                    <span>Checkout Disabled (Requires RFC Status)</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Vehicle Gate Check-Out Form */
            <form onSubmit={handleConfirmCheckOut} className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-emerald-500/20">
                <span className="font-extrabold text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 uppercase">
                  <LogOut className="w-4 h-4 text-emerald-500" />
                  Vehicle Check-Out Details
                </span>
                <button
                  type="button"
                  onClick={() => setIsCheckOutFormOpen(false)}
                  className="text-slate-400 hover:text-slate-200 text-[10px] font-bold"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Driver / Receiver Name *
                </label>
                <input
                  type="text"
                  required
                  value={exitDriverName}
                  onChange={(e) => setExitDriverName(e.target.value)}
                  placeholder="e.g. Rahul Sharma (Customer / Driver)"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Driver Phone Number
                </label>
                <input
                  type="tel"
                  value={exitDriverPhone}
                  onChange={(e) => setExitDriverPhone(e.target.value)}
                  placeholder="e.g. 9820012345"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono font-bold text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Check-Out Notes / Gate Remarks
                </label>
                <input
                  type="text"
                  value={exitNotes}
                  onChange={(e) => setExitNotes(e.target.value)}
                  placeholder="e.g. Handover completed, key handed over, gate pass verified"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCheckOutFormOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Vehicle Check-Out</span>
                </button>
              </div>
            </form>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
