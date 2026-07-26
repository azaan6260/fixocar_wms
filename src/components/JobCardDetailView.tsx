import React, { useState } from 'react';
import { JobCard, Employee, Vendor, TaskCategory, SpecializedTeam, JobTask } from '../types';
import { updateJobCard, updateTaskStatus, respondToCustomerApproval, createDeliveryRecord } from '../lib/storage';
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
  Share2
} from 'lucide-react';

interface JobCardDetailViewProps {
  card: JobCard;
  onClose: () => void;
  employees: Employee[];
  vendors: Vendor[];
  onOpenCustomerApprovalPortal: (cardId: string) => void;
  onOpenQCModal: (cardId: string) => void;
}

export function JobCardDetailView({
  card,
  onClose,
  employees,
  vendors,
  onOpenCustomerApprovalPortal,
  onOpenQCModal,
}: JobCardDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'tasks' | 'approvals' | 'qc' | 'delivery' | 'invoice'>('tasks');
  
  // New additional work item state
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
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-mono font-extrabold text-lg border border-amber-500/30">
              <Car className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
                  {card.id}
                </span>
                <span className="text-xs text-slate-400">Created: {card.createdAt}</span>
              </div>
              <h2 className="text-xl font-extrabold tracking-tight font-mono mt-0.5">
                {card.vehicle.registrationNumber} • {card.vehicle.make} {card.vehicle.model}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
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

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 px-4 pt-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 overflow-x-auto shrink-0">
          {[
            { id: 'tasks', label: `Task Allotments (${card.tasks.length})`, icon: Wrench },
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

                <button
                  onClick={() => setShowAddTask(!showAddTask)}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  Add Discovered Repair Task
                </button>
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
              <div className="space-y-3">
                {card.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs"
                  >
                    <div className="space-y-1 max-w-lg">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{task.title}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase">
                          {task.category}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                        <span>Assigned: <strong className="text-slate-800 dark:text-slate-200">{task.assignedToName}</strong> ({task.assignedType})</span>
                        <span>Billing: <strong className="text-emerald-600 dark:text-emerald-400">₹{task.customerPrice.toLocaleString('en-IN')}</strong></span>
                      </div>

                      {task.requiresCustomerApproval && (
                        <div className="pt-1">
                          {task.isCustomerApproved === true && (
                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Customer Approved
                            </span>
                          )}
                          {task.isCustomerApproved === false && (
                            <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                              <X className="w-3.5 h-3.5" /> Rejected by Customer
                            </span>
                          )}
                          {task.isCustomerApproved === null && (
                            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" /> Awaiting Customer Approval
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Status Toggles */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateTaskStatus(card.id, task.id, 'PENDING')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          task.status === 'PENDING' ? 'bg-slate-800 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        Pending
                      </button>

                      <button
                        onClick={() => updateTaskStatus(card.id, task.id, 'IN_PROGRESS')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          task.status === 'IN_PROGRESS' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        In Progress
                      </button>

                      <button
                        onClick={() => updateTaskStatus(card.id, task.id, 'COMPLETED')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          task.status === 'COMPLETED' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        Completed
                      </button>
                    </div>
                  </div>
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
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">AutoCraft Workshop Invoice</h2>
                    <p className="text-xs text-slate-500">Invoice ID: INV-{card.id}</p>
                  </div>
                  <button
                    onClick={() => window.print()}
                    className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print Invoice
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  {card.tasks.map(t => (
                    <div key={t.id} className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                      <span className="text-slate-800 dark:text-slate-200">{t.title}</span>
                      <span className="font-mono font-bold">₹{t.customerPrice.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-1 text-xs text-right font-medium">
                  <p>Subtotal: ₹{totalTaskPrice.toLocaleString('en-IN')}</p>
                  <p>Tax (18%): ₹{taxVal.toLocaleString('en-IN')}</p>
                  <p className="text-base font-extrabold text-slate-900 dark:text-slate-100 mt-2">Grand Total: ₹{grandTotal.toLocaleString('en-IN')}</p>
                  <p className="text-emerald-500 font-bold">Advance Paid: ₹{(card.advancePaid || 0).toLocaleString('en-IN')}</p>
                  <p className="text-amber-500 font-extrabold text-sm">Balance Due: ₹{balanceDue.toLocaleString('en-IN')}</p>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
