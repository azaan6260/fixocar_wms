import React, { useState } from 'react';
import { Vendor, PurchaseOrder } from '../types';
import { getVendors, createVendor, getPurchaseOrders, createPurchaseOrder, saveVendors } from '../lib/storage';
import { 
  Building2, 
  Plus, 
  DollarSign, 
  Phone, 
  Mail, 
  MapPin, 
  FileCheck, 
  Star,
  CheckCircle2,
  X
} from 'lucide-react';

export function VendorManagementView() {
  const [vendors, setVendors] = useState<Vendor[]>(() => getVendors());
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => getPurchaseOrders());

  // New Vendor Form
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [vName, setVName] = useState('');
  const [vCategory, setVCategory] = useState<Vendor['category']>('PARTS_SUPPLIER');
  const [vContact, setVContact] = useState('');
  const [vPhone, setVPhone] = useState('');
  const [vEmail, setVEmail] = useState('');
  const [vAddress, setVAddress] = useState('');

  // New PO Form
  const [showAddPO, setShowAddPO] = useState(false);
  const [poJobCard, setPoJobCard] = useState('JC-2026-101');
  const [poVehicle, setPoVehicle] = useState('NY-889-XJ');
  const [poVendorId, setPoVendorId] = useState(vendors[0]?.id || '');
  const [poDesc, setPoDesc] = useState('');
  const [poAmount, setPoAmount] = useState(120);

  const refreshData = () => {
    setVendors(getVendors());
    setPurchaseOrders(getPurchaseOrders());
  };

  const handleAddVendor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vName.trim() || !vPhone.trim()) return;

    createVendor({
      name: vName,
      category: vCategory,
      contactPerson: vContact || vName,
      phone: vPhone,
      email: vEmail,
      address: vAddress,
      outstandingBalance: 0,
      rating: 4.8,
    });

    setVName('');
    setShowAddVendor(false);
    refreshData();
  };

  const handleCreatePO = (e: React.FormEvent) => {
    e.preventDefault();
    if (!poDesc.trim()) return;

    const selectedVen = vendors.find(v => v.id === poVendorId);
    if (!selectedVen) return;

    createPurchaseOrder({
      jobCardId: poJobCard,
      vehicleReg: poVehicle,
      vendorId: poVendorId,
      vendorName: selectedVen.name,
      category: selectedVen.category,
      itemDescription: poDesc,
      amount: Number(poAmount),
      status: 'ISSUED',
    });

    setPoDesc('');
    setShowAddPO(false);
    refreshData();
  };

  const handleSettleBalance = (vendorId: string) => {
    const list = getVendors();
    const idx = list.findIndex(v => v.id === vendorId);
    if (idx !== -1) {
      list[idx].outstandingBalance = 0;
      saveVendors(list);
      refreshData();
      alert(`Outstanding balance cleared for ${list[idx].name}`);
    }
  };

  const totalOutstanding = vendors.reduce((acc, v) => acc + (v.outstandingBalance || 0), 0);

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-rose-500" />
            Sublet Vendors & Parts Suppliers Hub
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage external service providers (Lathe works, Steam Washing, Electricians) and Spare Parts Suppliers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddPO(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold transition-all"
          >
            + Issue Sublet Order / PO
          </button>
          <button
            onClick={() => setShowAddVendor(true)}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all"
          >
            + Add New Vendor
          </button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500">Registered Sublet Vendors</span>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">{vendors.length}</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500">Issued Purchase Orders</span>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">{purchaseOrders.length}</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500">Total Vendor Outstanding Payable</span>
          <p className="text-2xl font-extrabold text-rose-500 mt-1">${totalOutstanding}</p>
        </div>
      </div>

      {/* Vendors Grid */}
      <div className="space-y-3">
        <h3 className="font-bold text-xs uppercase text-slate-500 tracking-wider">Sublet Service & Parts Vendor Roster</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vendors.map((v) => (
            <div
              key={v.id}
              className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{v.name}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                    {v.category}
                  </span>
                </div>

                <div className="text-xs text-slate-500 space-y-1 mt-2">
                  <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {v.phone} ({v.contactPerson})</p>
                  <p className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {v.email}</p>
                  <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {v.address}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-slate-400">Balance Payable:</span>
                  <p className="font-bold text-rose-500 font-mono">${v.outstandingBalance}</p>
                </div>

                {v.outstandingBalance > 0 && (
                  <button
                    onClick={() => handleSettleBalance(v.id)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                  >
                    Settle Pay
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Sublet Purchase Orders Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
        <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Sublet & Parts Purchase Orders History</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px]">
              <tr>
                <th className="p-3">PO Number</th>
                <th className="p-3">Job Card & Reg</th>
                <th className="p-3">Vendor</th>
                <th className="p-3">Description</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {purchaseOrders.map((po) => (
                <tr key={po.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="p-3 font-mono font-bold text-slate-900 dark:text-slate-100">{po.id}</td>
                  <td className="p-3">{po.jobCardId} ({po.vehicleReg})</td>
                  <td className="p-3 font-semibold">{po.vendorName}</td>
                  <td className="p-3">{po.itemDescription}</td>
                  <td className="p-3 font-mono font-bold text-emerald-500">${po.amount}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500">
                      {po.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Vendor Modal */}
      {showAddVendor && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Add Sublet / Parts Vendor</h3>
              <button onClick={() => setShowAddVendor(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleAddVendor} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Company / Vendor Name *</label>
                <input
                  type="text"
                  required
                  value={vName}
                  onChange={(e) => setVName(e.target.value)}
                  placeholder="e.g. Apex Lathe & Cylinder Works"
                  className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Category</label>
                <select
                  value={vCategory}
                  onChange={(e) => setVCategory(e.target.value as any)}
                  className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  <option value="PARTS_SUPPLIER">PARTS_SUPPLIER</option>
                  <option value="LATHE_WORK">LATHE_WORK</option>
                  <option value="WASHING">WASHING</option>
                  <option value="ELECTRICIAN">ELECTRICIAN</option>
                  <option value="ALIGNMENT">ALIGNMENT</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={vPhone}
                  onChange={(e) => setVPhone(e.target.value)}
                  placeholder="+1 (555) 000-1111"
                  className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-amber-500 font-bold text-slate-950 mt-2"
              >
                Save Vendor
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add PO Modal */}
      {showAddPO && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Issue Sublet / Parts Purchase Order</h3>
              <button onClick={() => setShowAddPO(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleCreatePO} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Target Vendor</label>
                <select
                  value={poVendorId}
                  onChange={(e) => setPoVendorId(e.target.value)}
                  className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name} ({v.category})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Description of Sublet Work / Spare Part</label>
                <input
                  type="text"
                  required
                  value={poDesc}
                  onChange={(e) => setPoDesc(e.target.value)}
                  placeholder="e.g. Front Rotor Disc Skimming & Lathe Facing"
                  className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Amount ($)</label>
                <input
                  type="number"
                  value={poAmount}
                  onChange={(e) => setPoAmount(Number(e.target.value))}
                  className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold mt-2"
              >
                Issue Purchase Order
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
