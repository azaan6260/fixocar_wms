import React, { useState } from 'react';
import { JobCard, Employee, Vendor, TaskCategory, SpecializedTeam, JobTask, UserRole } from '../types';
import { 
  updateJobCard, 
  updateTaskStatus, 
  respondToCustomerApproval, 
  createDeliveryRecord, 
  updateVehicleCheckIn, 
  getInventoryConsumptionRecords,
  dispatchToastNotification
} from '../lib/storage';
import { 
  speakTechnicianPrompt, 
  stopTechnicianSpeech 
} from '../lib/technicianVoiceHelper';
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
  Boxes,
  Lock,
  Sparkles,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Layers,
  Check,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Play,
  HelpCircle
} from 'lucide-react';

import { TaskDetailCard } from './TaskDetailCard';
import { TechnicianTaskCard } from './TechnicianTaskCard';
import { StandardJobsCatalogModal } from './StandardJobsCatalogModal';
import { GSTInvoiceView } from './GSTInvoiceView';
import { PartRequisitionModal } from './PartRequisitionModal';
import { AIPrioritySuggestionBox } from './AIPrioritySuggestionBox';
import { AICostEstimatorModal } from './AICostEstimatorModal';

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
  // Determine if current user is manager or shop-floor technician
  const isManagerOrHigher = ['SUPER_ADMIN', 'ADMIN', 'FLOOR_MANAGER'].includes(currentRole);
  
  // Default to technician mode for technicians, or allow manager to toggle
  const [viewMode, setViewMode] = useState<'TECHNICIAN' | 'MANAGER'>(
    isManagerOrHigher ? 'MANAGER' : 'TECHNICIAN'
  );

  // Technician Task Filter: ALL | MY_TASKS | PENDING | COMPLETED
  const [techTaskFilter, setTechTaskFilter] = useState<'ALL' | 'MY_TASKS' | 'PENDING' | 'COMPLETED'>('ALL');
  
  // Progressive disclosure accordions for technician view
  const [showVehicleCustomerDetails, setShowVehicleCustomerDetails] = useState(false);
  const [isPlayingHeaderAudio, setIsPlayingHeaderAudio] = useState(false);

  // Manager Tabs
  const [activeTab, setActiveTab] = useState<'tasks' | 'approvals' | 'consumption' | 'qc' | 'delivery' | 'invoice'>('tasks');
  const [isReqModalOpen, setIsReqModalOpen] = useState(false);
  const [isAIEstimatorOpen, setIsAIEstimatorOpen] = useState(false);

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
    dispatchToastNotification({
      type: 'JOB_CARD_CREATED',
      title: 'Gate Exit Recorded',
      message: `${card.vehicle.registrationNumber} dispatched successfully.`,
      vehicleReg: card.vehicle.registrationNumber,
      jobCardId: card.id
    });
  };

  const handleApplyUrgencyToggle = (isUrgent: boolean) => {
    updateJobCard(card.id, (prev) => ({
      ...prev,
      isUrgent
    }));
  };

  const handleSetTargetToday = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    updateJobCard(card.id, (prev) => ({
      ...prev,
      estimatedCompletionDate: todayStr
    }));
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
  const inProgressCount = card.tasks.filter(t => t.status === 'IN_PROGRESS').length;
  const pendingCount = card.tasks.filter(t => t.status === 'PENDING').length;
  const progressPct = card.tasks.length ? Math.round((completedCount / card.tasks.length) * 100) : 0;
  const isWorkCompleted = card.tasks.length > 0 && card.tasks.every(t => t.status === 'COMPLETED');
  const isInspectionDone = Boolean(card.qcPassed);
  const isCheckoutAllowed = isWorkCompleted && isInspectionDone;

  // Filter tasks for technician mode
  const filteredTechTasks = React.useMemo(() => {
    return card.tasks.filter(t => {
      if (techTaskFilter === 'PENDING') return t.status === 'PENDING' || t.status === 'IN_PROGRESS';
      if (techTaskFilter === 'COMPLETED') return t.status === 'COMPLETED';
      if (techTaskFilter === 'MY_TASKS') {
        return t.assignedToName?.toLowerCase().includes(currentRole.toLowerCase()) || 
               t.assignedToId === currentRole;
      }
      return true;
    });
  }, [card.tasks, techTaskFilter, currentRole]);

  // Audio speech summary for technician / shop-floor
  const handlePlayHeaderSpeech = () => {
    if (isPlayingHeaderAudio) {
      stopTechnicianSpeech();
      setIsPlayingHeaderAudio(false);
      return;
    }

    const reg = card.vehicle.registrationNumber;
    const model = `${card.vehicle.make} ${card.vehicle.model}`;
    const total = card.tasks.length;
    const remaining = total - completedCount;

    const speech = `गाड़ी नंबर ${reg}. मॉडल ${model}. इस गाड़ी में कुल ${total} काम हैं. ${completedCount} काम पूरे हो चुके हैं और ${remaining} काम बाकी हैं.`;

    setIsPlayingHeaderAudio(true);
    speakTechnicianPrompt(speech, () => {
      setIsPlayingHeaderAudio(false);
    });
  };

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

    dispatchToastNotification({
      type: 'JOB_CARD_CREATED',
      title: 'Task Added',
      message: `Added "${newTaskTitle}" to ${card.vehicle.registrationNumber}.`,
      vehicleReg: card.vehicle.registrationNumber,
      jobCardId: card.id
    });
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
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-5xl shadow-2xl overflow-hidden my-2 sm:my-6 flex flex-col max-h-[95vh]">
        
        {/* =========================================================================
            TOP CONTROL BAR: VEHICLE IDENTITY + VIEW MODE SWITCH (TECHNICIAN / MANAGER)
           ========================================================================= */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
          
          {/* Left: Indian Registration Number Plate Badge + Car Make Model */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Styled Indian Number Plate Badge */}
            <div className="bg-white text-slate-950 rounded-xl border-2 border-slate-300 px-3 py-1.5 shadow-md flex items-center gap-2 font-mono shrink-0">
              <div className="flex flex-col items-center justify-center border-r border-slate-300 pr-1.5 leading-none">
                <span className="text-[8px] font-black text-blue-700">IND</span>
                <span className="text-[7px] text-slate-500">🇮🇳</span>
              </div>
              <span className="text-base sm:text-lg font-black tracking-wider text-slate-950">
                {card.vehicle.registrationNumber}
              </span>
            </div>

            {/* Vehicle Model & Fuel Badges */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white truncate">
                  {card.vehicle.make} {card.vehicle.model}
                </h2>
                {card.vehicle.variant && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-amber-300 font-bold border border-slate-700">
                    {card.vehicle.variant}
                  </span>
                )}
                {card.isCars24 && (
                  <span className="bg-orange-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                    ⚡ Cars24
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 flex-wrap">
                <span>⛽ {card.vehicle.fuelType || 'Petrol'}</span>
                <span>•</span>
                <span>🎨 {card.vehicle.color || 'Standard'}</span>
                <span>•</span>
                <span className="font-mono text-amber-400">Card: {card.id}</span>
              </div>
            </div>
          </div>

          {/* Right: Audio Speaker Button + View Mode Switch + Close */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
            
            {/* 🔊 Big Audio Speaker: Speak vehicle & task summary in Hindi */}
            <button
              type="button"
              onClick={handlePlayHeaderSpeech}
              className={`px-3.5 py-2 rounded-xl font-black text-xs flex items-center gap-2 transition-all shadow-md active:scale-95 ${
                isPlayingHeaderAudio 
                  ? 'bg-rose-500 text-white animate-pulse' 
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
              }`}
              title="Click to hear summary in Hindi"
            >
              {isPlayingHeaderAudio ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span>{isPlayingHeaderAudio ? 'आवाज बंद करें' : '🔊 बोलकर सुनें'}</span>
            </button>

            {/* View Mode Toggle Button: Technician vs Manager */}
            <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('TECHNICIAN')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                  viewMode === 'TECHNICIAN'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>👷</span>
                <span>मिस्त्री मोड (Simple)</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('MANAGER')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                  viewMode === 'MANAGER'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>👔</span>
                <span>मैनेजर मोड (Full)</span>
              </button>
            </div>

            {/* Close modal */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors ml-auto sm:ml-0"
              title="Close Job Card"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

        </div>

        {/* =========================================================================
            OVERALL WORK PROGRESS STRIP (Simple visual cues for everyone)
           ========================================================================= */}
        <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          
          {/* Progress Gauge */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white text-sm">
                कुल प्रगति (Progress):
              </span>
              <span className="font-mono font-black text-amber-400 text-sm">
                {completedCount} / {card.tasks.length} पूरा ({progressPct}%)
              </span>
            </div>

            <div className="w-28 sm:w-40 bg-slate-700 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-amber-500 to-emerald-500 h-2.5 rounded-full transition-all duration-500" 
                style={{ width: `${progressPct}%` }} 
              />
            </div>
          </div>

          {/* Quick Manager Call / Emergency Assistance Button */}
          <div className="flex items-center gap-2">
            <a
              href="tel:9876543210"
              className="px-3 py-1.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 font-bold text-xs flex items-center gap-1.5 transition-all"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>📞 मैनेजर को फोन करें</span>
            </a>

            {card.isUrgent && (
              <span className="px-3 py-1 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 font-black text-xs flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                <span>🔥 अर्जेन्ट गाड़ी</span>
              </span>
            )}
          </div>

        </div>

        {/* =========================================================================
            VIEW MODE 1: TECHNICIAN & LABOUR FRIENDLY VIEW (Ultra Simple & Precise)
           ========================================================================= */}
        {viewMode === 'TECHNICIAN' && (
          <div className="p-4 sm:p-6 overflow-y-auto grow space-y-5 bg-slate-50/50 dark:bg-slate-950/40">
            
            {/* Task Filter Selector (Big Tap Chips) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {[
                { id: 'ALL', label: `📋 सब काम (All: ${card.tasks.length})` },
                { id: 'PENDING', label: `⏳ बाकी काम (Pending: ${pendingCount + inProgressCount})` },
                { id: 'COMPLETED', label: `✅ पूरे काम (Done: ${completedCount})` },
                { id: 'MY_TASKS', label: `🔧 मेरे काम (My Tasks)` }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTechTaskFilter(f.id as any)}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-black whitespace-nowrap transition-all border shadow-xs ${
                    techTaskFilter === f.id
                      ? 'bg-amber-500 text-slate-950 border-amber-500 scale-[1.02]'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-amber-500/50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* List of Simplified Technician Task Cards */}
            {filteredTechTasks.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h4 className="font-black text-slate-900 dark:text-white text-base">
                  इस लिस्ट में कोई काम बाकी नहीं है!
                </h4>
                <p className="text-xs text-slate-500">
                  ऊपर &quot;सब काम (All)&quot; पर क्लिक करके बाकी काम देख सकते हैं।
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredTechTasks.map(task => (
                  <TechnicianTaskCard
                    key={task.id}
                    card={card}
                    task={task}
                    employees={employees}
                    vendors={vendors}
                    currentRole={currentRole}
                  />
                ))}
              </div>
            )}

            {/* Quick Action Footer for Technicians */}
            <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold">
                  ➕
                </span>
                <div className="text-left">
                  <h4 className="font-black text-xs text-slate-900 dark:text-white">कोई नया काम या खराबी मिली?</h4>
                  <p className="text-[11px] text-slate-500">गाड़ी में कोई एक्स्ट्रा काम मिला तो यहां से जोड़ें</p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setIsStandardCatalogOpen(true)}
                  className="w-1/2 sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold text-xs transition-all"
                >
                  ⚡ स्टैंडर्ड जॉब्स
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddTask(true)}
                  className="w-1/2 sm:w-auto px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>+ नया काम जोड़ें</span>
                </button>
              </div>
            </div>

            {/* Progressive Disclosure Accordion: Vehicle & Customer Info (Hidden by default to avoid clutter) */}
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowVehicleCustomerDetails(prev => !prev)}
                className="w-full p-4 text-left font-extrabold text-xs text-slate-800 dark:text-slate-200 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Car className="w-4 h-4 text-blue-500" />
                  <span>🚗 गाड़ी एवं ग्राहक की अतिरिक्त जानकारी (Show More Details)</span>
                </span>
                {showVehicleCustomerDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showVehicleCustomerDetails && (
                <div className="p-4 pt-0 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                    <span className="text-slate-400 font-medium block text-[10px]">ग्राहक का नाम (Customer):</span>
                    <strong className="text-slate-900 dark:text-white">{card.customer.name}</strong>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                    <span className="text-slate-400 font-medium block text-[10px]">फ़ोन नंबर:</span>
                    <strong className="text-slate-900 dark:text-white">{card.customer.phone}</strong>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                    <span className="text-slate-400 font-medium block text-[10px]">ओडोमीटर (KM):</span>
                    <strong className="text-slate-900 dark:text-white font-mono">{card.vehicle.mileage || 0} KM</strong>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                    <span className="text-slate-400 font-medium block text-[10px]">फ़्लोर मैनेजर:</span>
                    <strong className="text-slate-900 dark:text-white">{card.floorManagerName}</strong>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* =========================================================================
            VIEW MODE 2: MANAGER FULL MODE (Full Invoices, GST, Accounting, QC, Dispatch)
           ========================================================================= */}
        {viewMode === 'MANAGER' && (
          <div className="flex flex-col grow overflow-hidden">
            
            {/* Manager Detailed Metrics Strip */}
            <div className="bg-slate-800/40 p-4 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs shrink-0">
              <div>
                <span className="text-slate-400 font-medium">Customer:</span>
                <p className="font-bold text-slate-900 dark:text-slate-100">{card.customer.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[11px] text-slate-400">{card.customer.phone}</p>
                  <a
                    href={`tel:${card.customer.phone}`}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-[10px] font-bold"
                  >
                    <Phone className="w-3 h-3" />
                    Call
                  </a>
                </div>
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
                  Priority Controls:
                </span>

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

                <button
                  type="button"
                  onClick={handleSetTargetToday}
                  className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500 hover:text-slate-950 font-bold text-xs transition-all flex items-center gap-1.5"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Target Today</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAIEstimatorOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
                  <span>AI Cost Estimator</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsReqModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-amber-300 border border-amber-500/30 font-bold text-xs flex items-center gap-1.5"
                >
                  <PackageCheck className="w-3.5 h-3.5" />
                  <span>+ Requisition</span>
                </button>
              </div>
            </div>

            {/* AI Priority Advisor Box */}
            <AIPrioritySuggestionBox
              card={card}
              onApplyUrgencyToggle={handleApplyUrgencyToggle}
              onSetTargetToday={handleSetTargetToday}
            />

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
                        Detailed manager breakdown with contractor payouts, pricing, and re-allotment controls.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => setIsStandardCatalogOpen(true)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-bold text-xs flex items-center gap-1.5"
                      >
                        <Zap className="w-3.5 h-3.5 fill-amber-300" />
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

                  {/* Tasks List */}
                  {card.tasks.length === 0 ? (
                    <div className="p-8 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-800 text-center space-y-4 bg-slate-50/50 dark:bg-slate-900/30">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
                        <Sparkles className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                          No Tasks Allotted Yet
                        </h4>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto">
                          Use the AI Cost Estimator to auto-calculate parts & labor for this {card.vehicle.make} {card.vehicle.model}.
                        </p>
                      </div>
                    </div>
                  ) : (
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
                  )}
                </div>
              )}

              {/* TAB 2: CUSTOMER APPROVALS */}
              {activeTab === 'approvals' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-amber-500/10 p-4 rounded-xl border border-amber-500/30">
                    <div>
                      <h3 className="font-bold text-amber-700 dark:text-amber-400 text-sm">Customer Approval Link</h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Send customer their estimate approval portal link.
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

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-4 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-bold">Total Items</p>
                          <p className="text-base font-black text-slate-900 dark:text-white font-mono">{consumedItemsList.length}</p>
                        </div>
                        <div className="h-8 w-px bg-slate-200 dark:bg-slate-800"></div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-bold">Total Value</p>
                          <p className="text-base font-black text-amber-600 dark:text-amber-400 font-mono">₹{totalConsumedCost.toLocaleString('en-IN')}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsReqModalOpen(true)}
                        className="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-sm active:scale-95 transition-all shrink-0"
                      >
                        <Plus className="w-4 h-4 stroke-[3]" />
                        <span>Issue Part</span>
                      </button>
                    </div>
                  </div>

                  {/* Consumption History Table */}
                  {consumedItemsList.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                      <PackageCheck className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        No parts or consumables consumed yet for this job card.
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
                            <th className="p-3">Consumed Date</th>
                            <th className="p-3">Completed By</th>
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
                                {item.consumedBy}
                              </td>
                              <td className="p-3 text-center">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Fitted
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
                      <ShieldCheck className="w-4 h-4" /> Open QC Checklist
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
                      Assign a delivery boy to pick up or deliver the vehicle to the customer residence.
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
                <GSTInvoiceView 
                  card={card} 
                  currentRole={currentRole} 
                />
              )}

            </div>

          </div>
        )}

      </div>

      {/* Add New Custom Task Modal (Accessible in both modes) */}
      {showAddTask && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-lg p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h4 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                <span>➕</span>
                <span>नया काम जोड़ें (Add Extra Work)</span>
              </h4>
              <button onClick={() => setShowAddTask(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewTask} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  काम का नाम (Task Title) *
                </label>
                <input
                  type="text"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="उदा. अगला शॉकअप बदलना, ब्रेक ऑयल टॉप-अप..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    विभाग (Category)
                  </label>
                  <select
                    value={newTaskCategory}
                    onChange={(e) => setNewTaskCategory(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white"
                  >
                    <option value="MECHANICAL">🔧 MECHANICAL</option>
                    <option value="DENTING">🔨 DENTING</option>
                    <option value="PAINT">🎨 PAINT</option>
                    <option value="WASHING">🧼 WASHING</option>
                    <option value="SUBLET_VENDOR">🏭 SUBLET VENDOR</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    किसे सौंपें (Assign To)
                  </label>
                  <select
                    value={newTaskAssignedId}
                    onChange={(e) => setNewTaskAssignedId(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white"
                  >
                    <optgroup label="Workshop Staff">
                      {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.specializedTeam})</option>)}
                    </optgroup>
                    <optgroup label="Sublet Vendors">
                      {vendors.map(v => <option key={v.id} value={v.id}>{v.name} ({v.category})</option>)}
                    </optgroup>
                  </select>
                </div>
              </div>

              {isManagerOrHigher && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Cost Price (₹)</label>
                    <input
                      type="number"
                      value={newTaskCost}
                      onChange={(e) => setNewTaskCost(Number(e.target.value))}
                      className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Customer Price (₹)</label>
                    <input
                      type="number"
                      value={newTaskPrice}
                      onChange={(e) => setNewTaskPrice(Number(e.target.value))}
                      className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddTask(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                >
                  रद्द करें (Cancel)
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-500/20"
                >
                  सुरक्षित करें (Save Task)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1-Click Standard Jobs Catalog Modal */}
      <StandardJobsCatalogModal
        card={card}
        isOpen={isStandardCatalogOpen}
        onClose={() => setIsStandardCatalogOpen(false)}
      />

      {/* Gate Departure Check-Out Modal */}
      {isGateCheckOutOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
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

            <form onSubmit={handleExecuteGateCheckOut} className="p-6 space-y-4 text-xs overflow-y-auto">
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
                      alt="Departure preview"
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

      {/* Part Requisition & Consumption Modal */}
      {isReqModalOpen && (
        <PartRequisitionModal
          card={card}
          isOpen={isReqModalOpen}
          onClose={() => setIsReqModalOpen(false)}
        />
      )}

      {/* AI-Powered Cost Estimation Modal */}
      {isAIEstimatorOpen && (
        <AICostEstimatorModal
          card={card}
          isOpen={isAIEstimatorOpen}
          onClose={() => setIsAIEstimatorOpen(false)}
        />
      )}
    </div>
  );
}

