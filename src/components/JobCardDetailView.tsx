import React, { useState } from 'react';
import { JobCard, Employee, Vendor, TaskCategory, SpecializedTeam, JobTask } from '../types';
import { updateJobCard, updateTaskStatus, respondToCustomerApproval, createDeliveryRecord, updateVehicleCheckIn, getInventoryConsumptionRecords } from '../lib/storage';
import { 
  X, 
  Car, 
  User, 
  Wrench, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Truck, 
  DollarSign, 
  Plus, 
  FileText, 
  Building2, 
  ShieldCheck, 
  Send, 
  Printer, 
  ExternalLink,
  ChevronRight,
  Hammer,
  Palette,
  Phone,
  Calendar,
  Share2,
  Zap,
  QrCode,
  Flame,
  LogOut,
  LogIn,
  Camera,
  UserCheck,
  PackageCheck,
  Tag,
  Boxes
} from 'lucide-react';

import { TaskDetailCard } from './TaskDetailCard';
import { StandardJobsCatalogModal } from './StandardJobsCatalogModal';
import { UserRole } from '../types';

interface JobCardDetailViewProps {
  card: JobCard;
  currentRole?: UserRole;
  onClose: () => void;
  employees: Employee[];
  vendors: Vendor[];
  onOpenCustomerApprovalPortal: (cardId: string) => void;
  onOpenQCModal: (cardId: string) => void;
  onOpenQRModal?: (cardId: string) => void;
}

export function JobCardDetailView({
  card,
  currentRole = 'FLOOR_MANAGER',
  onClose,
  employees,
  vendors,
  onOpenCustomerApprovalPortal,
  onOpenQCModal,
  onOpenQRModal,
}: JobCardDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'tasks' | 'approvals' | 'consumption' | 'qc' | 'delivery' | 'invoice'>('tasks');

  // Part Consumption History compilation
  const consumedItemsList = React.useMemo(() => {
    const items: {
      id: string;
      requisitionId?: string;
      partNumber?: string;
      title: string;
      taskTitle: string;
      quantity: number;
      unitPrice: number;
      totalCost: number;
      consumedBy: string;
      consumedAt: string;
    }[] = [];

    // 1. From Requisitions marked CONSUMED
    card.tasks.forEach((t) => {
      if (t.requisitions) {
        t.requisitions.forEach((r) => {
          if (r.status === 'CONSUMED' || r.consumedAt) {
            const uPrice = r.approvedPrice && r.quantity > 0 ? r.approvedPrice / r.quantity : (r.suggestedPrice || 0);
            const tCost = r.approvedPrice || (uPrice * r.quantity);
            items.push({
              id: r.id,
              requisitionId: r.id,
              partNumber: r.partNumber,
              title: r.title,
              taskTitle: t.title,
              quantity: r.quantity,
              unitPrice: uPrice,
              totalCost: tCost,
              consumedBy: r.requestedByEmployeeName || 'Workshop Mechanic',
              consumedAt: r.consumedAt || r.createdAt
            });
          }
        });
      }

      // 2. From partsList on task
      if (t.partsList) {
        t.partsList.forEach((p) => {
          const exists = items.some(i => i.title === p.name);
          if (!exists) {
            items.push({
              id: p.id,
              partNumber: p.partNumber,
              title: p.name,
              taskTitle: t.title,
              quantity: p.quantity,
              unitPrice: p.unitPrice || 0,
              totalCost: p.totalPrice || 0,
              consumedBy: t.assignedToName || 'Assigned Mechanic',
              consumedAt: p.addedAt || card.createdAt
            });
          }
        });
      }
    });

    // 3. From global consumption records matching jobCardId
    const globalLogs = getInventoryConsumptionRecords().filter(r => r.jobCardId === card.id);
    globalLogs.forEach((g) => {
      const exists = items.some(i => i.id === g.id || i.requisitionId === g.requisitionId || (i.title === g.itemName && i.consumedAt === g.consumedAt));
      if (!exists) {
        items.push({
          id: g.id,
          requisitionId: g.requisitionId,
          partNumber: g.partNumber,
          title: g.itemName,
          taskTitle: card.tasks.find(t => t.id === g.taskId)?.title || 'General Repair',
          quantity: g.quantityConsumed,
          unitPrice: g.unitPrice,
          totalCost: g.totalCost,
          consumedBy: g.consumedByEmployeeName || 'Workshop Mechanic',
          consumedAt: g.consumedAt
        });
      }
    });

    return items;
  }, [card]);

  const totalConsumedCost = consumedItemsList.reduce((sum, item) => sum + item.totalCost, 0);

  // Gate Check-Out Modal State
  const [isGateCheckOutOpen, setIsGateCheckOutOpen] = useState(false);
  const [gateDriverName, setGateDriverName] = useState(card.checkInDriverName || 'Cars24 Fleet Driver');
  const [gateDriverPhone, setGateDriverPhone] = useState(card.checkInDriverPhone || '+91 98200 11223');
  const [gateExitPhotoUrl, setGateExitPhotoUrl] = useState('https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80');

  const handleExecuteGateCheckOut = (e: React.FormEvent) => {
    e.preventDefault();
    const nowStr = new Date().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });

    updateJobCard(card.id, (prev) => ({
      ...prev,
      status: 'DELIVERED',
      checkedOutAt: nowStr,
      checkOutDriverName: gateDriverName,
      checkOutDriverPhone: gateDriverPhone,
      checkOutPhotoWithDriverUrl: gateExitPhotoUrl,
    }));

    if (card.checkInRecordId) {
      updateVehicleCheckIn(card.checkInRecordId, (prev) => ({
        ...prev,
        status: 'CHECKED_OUT',
        checkedOutAt: nowStr,
        checkOutDriverName: gateDriverName,
        checkOutDriverPhone: gateDriverPhone,
        checkOutPhotoWithDriverUrl: gateExitPhotoUrl,
      }));
    }

    setIsGateCheckOutOpen(false);
    alert('Vehicle successfully checked out & gate exit recorded!');
  };
  
  // New additional work item state
  const [isStandardCatalogOpen, setIsStandardCatalogOpen] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState<TaskCategory>('MECHANICAL');
  const [newTaskCost, setNewTaskCost] = useState(40);
  const [newTaskPrice, setNewTaskPrice] = useState(85);
  const [newTaskAssignedId, setNewTaskAssignedId] = useState(employees[0]?.id || '');
  const [newTaskRequiresApproval, setNewTaskRequiresApproval] = useState(true);

  // Billing calculations
  const totalTaskPrice = card.tasks
    .filter(t => t.isCustomerApproved !== false)
    .reduce((sum, t) => sum + (t.customerPrice || 0), 0);

  const discountVal = card.discount || 0;
  const taxableAmount = Math.max(0, totalTaskPrice - discountVal);
  const taxVal = Math.round((taxableAmount * (card.taxRate || 18)) / 100);
  const grandTotal = taxableAmount + taxVal;
  const balanceDue = Math.max(0, grandTotal - (card.advancePaid || 0));

  const completedCount = card.tasks.filter(t => t.status === 'COMPLETED').length;
  const progressPct = card.tasks.length ? Math.round((completedCount / card.tasks.length) * 100) : 0;

  const handleCreateNewTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const assignedEmp = employees.find(e => e.id === newTaskAssignedId);
    const assignedVen = vendors.find(v => v.id === newTaskAssignedId);

    const newTask: JobTask = {
      id: `task-add-${Date.now()}`,
      jobCardId: card.id,
      title: newTaskTitle,
      category: newTaskCategory,
      assignedToId: newTaskAssignedId,
      assignedToName: assignedEmp?.name || assignedVen?.name || 'Staff',
      assignedType: assignedVen ? 'VENDOR' : 'EMPLOYEE',
      estimatedCost: Number(newTaskCost),
      customerPrice: Number(newTaskPrice),
      status: newTaskRequiresApproval ? 'PENDING' : 'IN_PROGRESS',
      requiresCustomerApproval: newTaskRequiresApproval,
      isCustomerApproved: newTaskRequiresApproval ? null : true,
      isAdditionalWork: true,
      approvalStatus: newTaskRequiresApproval ? 'PENDING' : 'APPROVED',
    };

    updateJobCard(card.id, (prev) => ({
      ...prev,
      tasks: [...prev.tasks, newTask],
      status: newTaskRequiresApproval ? 'ESTIMATE_PENDING' : prev.status
    }));

    setNewTaskTitle('');
    setShowAddTask(false);
  };

  const handleAssignDeliveryDriver = () => {
    const driver = employees.find(e => e.role === 'DELIVERY_BOY') || employees[0];
    if (!driver) {
      alert('No delivery driver available.');
      return;
    }

    createDeliveryRecord({
      jobCardId: card.id,
      vehicleReg: card.vehicle.registrationNumber,
      customerName: card.customer.name,
      customerPhone: card.customer.phone,
      deliveryBoyId: driver.id,
      deliveryBoyName: driver.name,
      deliveryBoyPhone: driver.phone,
      type: 'DELIVERY',
      pickupAddress: 'AutoCraft Workshop Central Bay 4',
      deliveryAddress: card.customer.address || 'Customer Residence',
      status: 'OUT_FOR_DELIVERY',
      totalAmountDue: balanceDue,
      paymentStatus: 'PENDING',
      currentLat: 37.7749,
      currentLng: -122.4194,
      destinationLat: 37.7833,
      destinationLng: -122.4167,
      etaMinutes: 22,
    });

    alert(`Vehicle dispatched out for delivery with driver ${driver.name}!`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-5xl shadow-2xl overflow-hidden my-4 sm:my-8 flex flex-col max-h-[92vh]">
        
        {/* Banner Header */}
        <div className="p-5 bg-slate-900 text-white border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-mono font-extrabold text-lg border ${
              card.isCars24
                ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
            }`}>
              <Car className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-bold border border-slate-700">
                  {card.id}
                </span>
                {card.isCars24 && (
                  <span className="bg-orange-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    ⚡ CARS24 FLEET {card.cars24RefNo ? `(${card.cars24RefNo})` : ''}
                  </span>
                )}
                {card.cityName && (
                  <span className="text-[11px] text-slate-300 font-medium">
                    📍 {card.cityName} • {card.workshopName || 'Main Hub'}
                  </span>
                )}
                <span className="text-xs text-slate-400">Created: {card.createdAt}</span>
              </div>
              <h2 className="text-xl font-extrabold tracking-tight font-mono mt-0.5">
                {card.vehicle.registrationNumber} • {card.vehicle.make} {card.vehicle.model}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {onOpenQRModal && (
              <button
                type="button"
                onClick={() => onOpenQRModal(card.id)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-amber-400 border border-amber-500/40 hover:bg-amber-500 hover:text-slate-950 font-bold text-xs transition-all flex items-center gap-1.5"
                title="Generate & View QR Code"
              >
                <QrCode className="w-3.5 h-3.5" />
                QR Pass
              </button>
            )}
            <button
              onClick={() => onOpenCustomerApprovalPortal(card.id)}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500 hover:text-slate-950 font-semibold text-xs transition-colors flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Customer Portal
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Vehicle & Customer Summary Bar */}
        <div className="bg-slate-800/50 p-4 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs shrink-0">
          <div>
            <span className="text-slate-400 font-medium">Customer:</span>
            <p className="font-bold text-slate-900 dark:text-slate-100">{card.customer.name}</p>
            <p className="text-[11px] text-slate-400">{card.customer.phone}</p>
          </div>
          <div>
            <span className="text-slate-400 font-medium">Floor Manager:</span>
            <p className="font-bold text-slate-900 dark:text-slate-100">{card.floorManagerName}</p>
            <p className="text-[11px] text-amber-400 font-semibold">Status: {card.status}</p>
          </div>
          <div>
            <span className="text-slate-400 font-medium">Task Progress:</span>
            <p className="font-bold text-slate-900 dark:text-slate-100">{completedCount}/{card.tasks.length} Completed ({progressPct}%)</p>
            <div className="w-full bg-slate-700 rounded-full h-1.5 mt-1 overflow-hidden">
              <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
          <div>
            <span className="text-slate-400 font-medium">Est. Total Bill:</span>
            <p className="font-extrabold text-sm text-emerald-400">₹{grandTotal.toLocaleString('en-IN')}</p>
            <p className="text-[11px] text-slate-400">Advance Paid: ₹{(card.advancePaid || 0).toLocaleString('en-IN')}</p>
          </div>
        </div>

        {/* Daily Huddle Urgency & Promised Delivery Date Bar */}
        <div className="px-4 py-2.5 bg-slate-900/95 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-black text-amber-400 flex items-center gap-1 uppercase tracking-wider text-[11px]">
              <Flame className="w-4 h-4 text-amber-400 fill-amber-400" />
              Daily Huddle Priority:
            </span>

            {/* Toggle Urgent Button */}
            <button
              type="button"
              onClick={() => {
                updateJobCard(card.id, (prev) => ({ ...prev, isUrgent: !prev.isUrgent }));
              }}
              className={`px-3 py-1 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all border ${
                card.isUrgent
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-xs'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-amber-500/50 hover:text-white'
              }`}
            >
              <Flame className={`w-3.5 h-3.5 ${card.isUrgent ? 'fill-current text-slate-950' : 'text-amber-400'}`} />
              <span>{card.isUrgent ? '🔥 MARKED URGENT' : 'Mark Urgent'}</span>
            </button>

            {/* Set Target Delivery Today Button */}
            <button
              type="button"
              onClick={() => {
                const todayStr = new Date().toISOString().split('T')[0];
                updateJobCard(card.id, (prev) => ({ 
                  ...prev,
                  estimatedCompletionDate: todayStr,
                  isUrgent: true
                }));
              }}
              className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500 hover:text-slate-950 font-bold text-xs transition-all flex items-center gap-1.5"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Target Completion Today</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium text-[11px]">Promised Date:</span>
            <input
              type="date"
              value={card.estimatedCompletionDate || ''}
              onChange={(e) => {
                const val = e.target.value;
                updateJobCard(card.id, (prev) => ({ ...prev, estimatedCompletionDate: val }));
              }}
              className="bg-slate-800 text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-hidden focus:border-amber-500"
            />
          </div>
        </div>

        {/* Gate Pass & Physical Workshop Location Banner */}
        <div className="px-4 py-3 bg-slate-950 text-white border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0 font-black">
              <LogIn className="w-5 h-5" />
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-black text-slate-200 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                  Arrival Driver: <strong className="text-white">{card.checkInDriverName || 'Cars24 Fleet Driver'}</strong>
                </span>
                <span className="text-slate-400">• Phone: {card.checkInDriverPhone || '+91 98200 11223'}</span>
              </div>

              <div className="text-slate-400 text-[11px] flex items-center gap-3">
                <span>Arrival: {card.checkedInAt || 'Gate Check-In Verified'}</span>
                {card.checkedOutAt ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <LogOut className="w-3 h-3" />
                    Departed: {card.checkedOutAt} (Driver: {card.checkOutDriverName})
                  </span>
                ) : (
                  <span className="text-amber-400 font-bold flex items-center gap-1">
                    <Car className="w-3 h-3" />
                    Physically Present in Workshop
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!card.checkedOutAt ? (
              <button
                type="button"
                onClick={() => setIsGateCheckOutOpen(true)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md transition-all shrink-0"
              >
                <LogOut className="w-4 h-4" />
                <span>Mark Gate Check-Out & Dispatch</span>
              </button>
            ) : (
              <span className="bg-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-xl border border-emerald-500/30 font-extrabold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Gate Exit Confirmed
              </span>
            )}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 px-4 pt-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 overflow-x-auto shrink-0">
          {[
            { id: 'tasks', label: `Task Allotments (${card.tasks.length})`, icon: Wrench },
            { id: 'consumption', label: `Part Consumption History (${consumedItemsList.length})`, icon: PackageCheck },
            { id: 'approvals', label: `Customer Approvals (${card.tasks.filter(t => t.requiresCustomerApproval).length})`, icon: AlertCircle },
            { id: 'qc', label: `Floor QC Inspection (${card.qcPassed ? 'PASSED' : 'PENDING'})`, icon: ShieldCheck },
            { id: 'delivery', label: 'Pick & Delivery Track', icon: Truck },
            { id: 'invoice', label: 'Billing & Invoice', icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-xl text-xs font-bold whitespace-nowrap transition-colors border-b-2 ${
                  isActive
                    ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-white dark:bg-slate-900 shadow-xs'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content Container */}
        <div className="p-6 overflow-y-auto grow space-y-6">
          
          {/* TAB 1: TASKS & TEAM ALLOTMENTS */}
          {activeTab === 'tasks' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    Assigned Tasks & Department Work Orders
                  </h3>
                  <p className="text-xs text-slate-500">
                    Track status per task. Tasks are routed to mechanics, denters, painters, or sublet vendors.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsStandardCatalogOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-sm transition-all hover:scale-[1.02]"
                  >
                    <Zap className="w-3.5 h-3.5 fill-slate-950" />
                    1-Click Standard Jobs
                  </button>

                  <button
                    onClick={() => setShowAddTask(!showAddTask)}
                    className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Custom Task
                  </button>
                </div>
              </div>

              {/* Add New Discovered Task Form */}
              {showAddTask && (
                <form onSubmit={handleCreateNewTask} className="p-4 rounded-xl bg-slate-900 text-white border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400">Add Additional Repair Work</span>
                    <button type="button" onClick={() => setShowAddTask(false)} className="text-slate-400 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] text-slate-400 mb-1">Task Description</label>
                      <input
                        type="text"
                        required
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        placeholder="e.g. Worn Control Arm Bushing Replacement"
                        className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-800 border border-slate-700 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Category</label>
                      <select
                        value={newTaskCategory}
                        onChange={(e) => setNewTaskCategory(e.target.value as any)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-800 border border-slate-700 text-white"
                      >
                        <option value="MECHANICAL">MECHANICAL</option>
                        <option value="DENTING">DENTING</option>
                        <option value="PAINT">PAINT</option>
                        <option value="SUBLET_VENDOR">SUBLET_VENDOR</option>
                        <option value="WASHING">WASHING</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Assign Staff / Vendor</label>
                      <select
                        value={newTaskAssignedId}
                        onChange={(e) => setNewTaskAssignedId(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-800 border border-slate-700 text-white"
                      >
                        <optgroup label="Workshop Staff">
                          {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.specializedTeam})</option>)}
                        </optgroup>
                        <optgroup label="Sublet Vendors">
                          {vendors.map(v => <option key={v.id} value={v.id}>{v.name} ({v.category})</option>)}
                        </optgroup>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Cost Price (₹)</label>
                      <input
                        type="number"
                        value={newTaskCost}
                        onChange={(e) => setNewTaskCost(Number(e.target.value))}
                        className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-800 border border-slate-700 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Customer Billing Price (₹)</label>
                      <input
                        type="number"
                        value={newTaskPrice}
                        onChange={(e) => setNewTaskPrice(Number(e.target.value))}
                        className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-800 border border-slate-700 text-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <label className="flex items-center gap-2 text-xs text-amber-300 font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newTaskRequiresApproval}
                        onChange={(e) => setNewTaskRequiresApproval(e.target.checked)}
                        className="rounded accent-amber-500"
                      />
                      Requires Customer Approval before proceeding
                    </label>

                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
                    >
                      Save Task
                    </button>
                  </div>
                </form>
              )}

              {/* Tasks List */}
              <div className="space-y-4">
                {card.tasks.map((task) => (
                  <TaskDetailCard
                    key={task.id}
                    card={card}
                    task={task}
                    employees={employees}
                    vendors={vendors}
                    currentRole={currentRole}
                    onTaskStatusChange={(taskId, status) => updateTaskStatus(card.id, taskId, status)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: CUSTOMER APPROVALS */}
          {activeTab === 'approvals' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-amber-500/10 p-4 rounded-xl border border-amber-500/30">
                <div>
                  <h3 className="font-bold text-amber-700 dark:text-amber-400 text-sm">Customer Approval Link</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Send customer their estimate approval portal link. Customer can accept/decline discovered repair work.
                  </p>
                </div>
                <button
                  onClick={() => onOpenCustomerApprovalPortal(card.id)}
                  className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1.5"
                >
                  Open Approval View <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                {card.tasks.filter(t => t.requiresCustomerApproval).length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center italic">No additional work items requiring approval.</p>
                ) : (
                  card.tasks.filter(t => t.requiresCustomerApproval).map((task) => (
                    <div key={task.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-sm text-slate-900 dark:text-slate-100">{task.title}</p>
                        <p className="text-xs text-slate-500">Estimate Price: ₹{task.customerPrice.toLocaleString('en-IN')}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => respondToCustomerApproval(card.id, task.id, true)}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => respondToCustomerApproval(card.id, task.id, false, 'Customer declined')}
                          className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB: PART CONSUMPTION HISTORY */}
          {activeTab === 'consumption' && (
            <div className="space-y-6">
              
              {/* Header Banner & Stats */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                    <PackageCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base">
                      Part & Consumable Consumption History
                    </h3>
                    <p className="text-xs text-slate-500">
                      Audit log of all spare parts and consumables fitted and consumed on Job Card {card.id}.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Total Consumed Items</p>
                    <p className="text-base font-black text-slate-900 dark:text-white font-mono">{consumedItemsList.length}</p>
                  </div>
                  <div className="h-8 w-px bg-slate-200 dark:bg-slate-800"></div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Total Consumed Value</p>
                    <p className="text-base font-black text-amber-600 dark:text-amber-400 font-mono">₹{totalConsumedCost.toLocaleString('en-IN')}</p>
                  </div>
                </div>
              </div>

              {/* Consumption History Table */}
              {consumedItemsList.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                  <PackageCheck className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    No parts or consumables consumed yet for this job card.
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    When assigned mechanics consume approved requisitions or install parts on assigned tasks, the consumption records will appear here automatically with timestamp and employee log.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                        <th className="p-3">Requisition ID</th>
                        <th className="p-3">Part / Consumable Name</th>
                        <th className="p-3">Assigned Task</th>
                        <th className="p-3 text-center">Qty</th>
                        <th className="p-3 text-right">Unit Price</th>
                        <th className="p-3 text-right">Total Cost</th>
                        <th className="p-3">Consumed Date & Time</th>
                        <th className="p-3">Completed By Employee</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {consumedItemsList.map((item, idx) => (
                        <tr key={`${item.id}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 font-mono font-black text-amber-600 dark:text-amber-400">
                            {item.requisitionId || 'PRT-DIRECT'}
                          </td>
                          <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                            <p>{item.title}</p>
                            {item.partNumber && (
                              <p className="text-[10px] text-slate-400 font-mono">PN: {item.partNumber}</p>
                            )}
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-300 font-medium">
                            {item.taskTitle}
                          </td>
                          <td className="p-3 text-center font-bold font-mono">
                            {item.quantity}
                          </td>
                          <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-400">
                            ₹{item.unitPrice.toLocaleString('en-IN')}
                          </td>
                          <td className="p-3 text-right font-mono font-black text-slate-900 dark:text-white">
                            ₹{item.totalCost.toLocaleString('en-IN')}
                          </td>
                          <td className="p-3 text-slate-500 font-mono text-[11px]">
                            {item.consumedAt}
                          </td>
                          <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-400" />
                              <span>{item.consumedBy}</span>
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Fitted & Consumed
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          )}

          {/* TAB 3: FLOOR QC */}
          {activeTab === 'qc' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Floor Manager Quality Control Checklist</h3>
                  <p className="text-xs text-slate-500">12-point quality check before marking vehicle ready for delivery.</p>
                </div>

                <button
                  onClick={() => onOpenQCModal(card.id)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" /> Open Full QC Audit Checklist
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {card.qcChecklist.map((item) => (
                  <div key={item.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{item.label}</span>
                    <span className={`px-2 py-0.5 rounded font-bold ${item.isPassed ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                      {item.isPassed ? 'PASSED' : 'PENDING'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: DELIVERY */}
          {activeTab === 'delivery' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3">
                <h3 className="font-bold text-sm text-cyan-400 flex items-center gap-2">
                  <Truck className="w-4 h-4" /> Vehicle Home Pickup & Delivery Service
                </h3>
                <p className="text-xs text-slate-300">
                  Assign a delivery boy to pick up or deliver the vehicle to the customer residence. Track driver live location and collect payment.
                </p>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    onClick={handleAssignDeliveryDriver}
                    className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-xs rounded-xl transition-colors shadow-md"
                  >
                    Dispatch Pick & Delivery Boy
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: INVOICE */}
          {activeTab === 'invoice' && (
            <div className="space-y-4">
              <div className={`p-6 rounded-2xl border space-y-4 ${
                card.isCars24
                  ? 'bg-orange-50/50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/50'
                  : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800'
              }`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-4 gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                        {card.isCars24 ? 'CARS24 B2B FLEET VENDOR INVOICE' : 'AutoCraft Workshop Tax Invoice'}
                      </h2>
                      {card.isCars24 && (
                        <span className="bg-orange-600 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase">
                          Cars24 B2B Account
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      Invoice ID: INV-{card.isCars24 ? 'C24' : 'RETAIL'}-{card.id} • Date: {new Date().toLocaleDateString()}
                    </p>
                    {card.workshopName && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                        Issued by: <strong>{card.workshopName}</strong> ({card.cityName || 'Central Hub'})
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => window.print()}
                      className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print Tax Invoice
                    </button>
                  </div>
                </div>

                {/* B2B Cars24 Account Info */}
                {card.isCars24 && (
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-orange-200 dark:border-orange-900/60 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 font-semibold text-[10px] uppercase">B2B Bill To:</span>
                      <p className="font-bold text-slate-900 dark:text-slate-100">Cars24 Services India Pvt Ltd</p>
                      <p className="text-[11px] text-slate-500">GSTIN: 07AABCC8821R1Z5</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold text-[10px] uppercase">Cars24 Ref / Order:</span>
                      <p className="font-mono font-bold text-orange-600 dark:text-orange-400">{card.cars24RefNo || 'C24-FLEET-88'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold text-[10px] uppercase">Settlement Terms:</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">Weekly B2B Vendor Payout</p>
                    </div>
                  </div>
                )}

                <div className="space-y-2 text-xs">
                  <div className="font-bold text-slate-500 uppercase text-[10px] grid grid-cols-12 pb-1 border-b border-slate-200 dark:border-slate-700">
                    <span className="col-span-8">Job / Repair Description</span>
                    <span className="col-span-2 text-center">Category</span>
                    <span className="col-span-2 text-right">Amount (₹)</span>
                  </div>

                  {card.tasks.map(t => (
                    <div key={t.id} className="grid grid-cols-12 items-center border-b border-slate-100 dark:border-slate-800 py-1.5">
                      <div className="col-span-8">
                        <span className="text-slate-800 dark:text-slate-200 font-medium">{t.title}</span>
                        {t.isAdditionalWork && (
                          <span className="ml-2 px-1.5 py-0.2 text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded">
                            Additional Work
                          </span>
                        )}
                      </div>
                      <span className="col-span-2 text-center text-[10px] font-mono uppercase text-slate-500">{t.category}</span>
                      <span className="col-span-2 text-right font-mono font-bold">₹{t.customerPrice.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-1 text-xs text-right font-medium">
                  <p>Subtotal: ₹{totalTaskPrice.toLocaleString('en-IN')}</p>
                  <p>Tax (18% GST): ₹{taxVal.toLocaleString('en-IN')}</p>
                  <p className="text-base font-extrabold text-slate-900 dark:text-slate-100 mt-2">
                    {card.isCars24 ? 'Total Cars24 Vendor Bill: ' : 'Grand Total: '}₹{grandTotal.toLocaleString('en-IN')}
                  </p>
                  <p className="text-emerald-600 dark:text-emerald-400 font-bold">Advance Paid: ₹{(card.advancePaid || 0).toLocaleString('en-IN')}</p>
                  <p className="text-amber-600 dark:text-amber-400 font-extrabold text-sm">
                    {card.isCars24 ? 'Net Cars24 Payable: ' : 'Balance Due: '}₹{balanceDue.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* 1-Click Standard Jobs Catalog Modal */}
      <StandardJobsCatalogModal
        card={card}
        isOpen={isStandardCatalogOpen}
        onClose={() => setIsStandardCatalogOpen(false)}
      />

      {/* Gate Departure Check-Out Modal */}
      {isGateCheckOutOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full shadow-2xl overflow-hidden">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black">
                  <LogOut className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black">Confirm Gate Check-Out</h2>
                  <p className="text-xs text-slate-400">{card.vehicle.registrationNumber} • {card.vehicle.make} {card.vehicle.model}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsGateCheckOutOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteGateCheckOut} className="p-6 space-y-4 text-xs">
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-2xl space-y-1 text-emerald-800 dark:text-emerald-300">
                <span className="font-bold flex items-center gap-1 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Pre-Delivery Inspection Complete & Invoice Ready
                </span>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Verify the driver picking up the car and capture the departure verification photo with driver.
                </p>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">Pickup Driver Name *</label>
                <input
                  type="text"
                  placeholder="Driver picking up vehicle"
                  value={gateDriverName}
                  onChange={(e) => setGateDriverName(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold"
                />
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">Driver Phone Number</label>
                <input
                  type="text"
                  placeholder="+91 98200 00000"
                  value={gateDriverPhone}
                  onChange={(e) => setGateDriverPhone(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Camera className="w-3.5 h-3.5 text-emerald-500" /> Departure Photo of Car with Driver
                  </span>
                </label>

                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={gateExitPhotoUrl}
                    onChange={(e) => setGateExitPhotoUrl(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-[11px]"
                  />

                  {gateExitPhotoUrl && (
                    <img 
                      src={gateExitPhotoUrl} 
                      alt="Departure photo preview"
                      className="w-12 h-12 rounded-xl object-cover border-2 border-emerald-500 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsGateCheckOutOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black flex items-center gap-1.5 shadow-lg shadow-emerald-600/20"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Confirm Gate Exit & Departure</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
