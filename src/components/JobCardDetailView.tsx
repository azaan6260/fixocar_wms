import React, { useState } from 'react';
import { JobCard, Employee, Vendor, TaskCategory, SpecializedTeam, JobTask, UserRole, StandardJob } from '../types';
import { 
  updateJobCard, 
  updateTaskStatus, 
  respondToCustomerApproval, 
  createDeliveryRecord, 
  updateVehicleCheckIn, 
  getInventoryConsumptionRecords,
  getStandardJobs,
  dispatchToastNotification,
  reassignAllPaintTasksForJobCard,
  deleteJobCard,
  deleteJobCardTask,
  isCars24JobCard,
  getJobCardHistoryRecords,
  formatJobCardStatus,
  getAuthUser
} from '../lib/storage';
import { PaintBatchAllotmentControl } from './PaintBatchAllotmentControl';
import { AddCustomJobModal } from './AddCustomJobModal';
import { mapPanelToStandardJob, getPanelEnvironmentRates } from '../lib/panelMappingHelper';
import { DigitalSignaturePad } from './DigitalSignaturePad';
import { triggerSuccessHaptic } from '../lib/mobileBridge';
import { ProofMediaGallery } from './ProofMediaGallery';
import { ProofOfWorkModal } from './ProofOfWorkModal';

// Re-export mapping helpers for visual panel IDs to Standard Job IDs
export { mapPanelToStandardJob, getPanelEnvironmentRates };
import { 
  getDeadlineInfo, 
  getLocalDateString, 
  parseDateOnly 
} from '../lib/urgencyHelper';
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
  HelpCircle,
  ClipboardCheck,
  Trash2
} from 'lucide-react';

import { TaskDetailCard } from './TaskDetailCard';
import { StandardJobsCatalogModal } from './StandardJobsCatalogModal';
import { GSTInvoiceView } from './GSTInvoiceView';
import { PartRequisitionModal } from './PartRequisitionModal';
import { RequestAdditionalWorkModal } from './RequestAdditionalWorkModal';
import { AIPrioritySuggestionBox } from './AIPrioritySuggestionBox';
import { AICostEstimatorModal } from './AICostEstimatorModal';

// Remove unused Stepper imports

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
  const currentUser = getAuthUser();
  const isManagerOrHigher = ['SUPER_ADMIN', 'ADMIN', 'SERVICE_ADVISOR', 'FLOOR_MANAGER'].includes(currentRole);
  const isCars24 = isCars24JobCard(card);
  
  const totalRequisitionsCount = React.useMemo(() => {
    return card.tasks.reduce((sum, t) => sum + (t.requisitions?.length || 0), 0);
  }, [card.tasks]);
  const [isPlayingHeaderAudio, setIsPlayingHeaderAudio] = useState(false);

  // Modals
  const [isReqModalOpen, setIsReqModalOpen] = useState(false);
  const [isRequestAddWorkOpen, setIsRequestAddWorkOpen] = useState(false);
  const [isAIEstimatorOpen, setIsAIEstimatorOpen] = useState(false);
  const [isStandardCatalogOpen, setIsStandardCatalogOpen] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [isGateCheckOutOpen, setIsGateCheckOutOpen] = useState(false);
  const [isProofModalOpen, setIsProofModalOpen] = useState(false);
  const [selectedProofTaskId, setSelectedProofTaskId] = useState<string | undefined>(undefined);
  const [isVehiclePhotosModalOpen, setIsVehiclePhotosModalOpen] = useState(false);

  // Manager Tabs
  const [activeManagerTab, setActiveManagerTab] = useState<'huddle' | 'tasks' | 'approvals' | 'proof' | 'consumption' | 'qc' | 'delivery' | 'invoice' | 'history'>('tasks');

  // Urgency & Target Completion State
  const [targetDateInput, setTargetDateInput] = useState<string>(() => {
    if (card.estimatedCompletionDate) {
      const d = parseDateOnly(card.estimatedCompletionDate);
      if (d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
    }
    return '';
  });
  const [cardHuddleNotes, setCardHuddleNotes] = useState<string>(card.huddleNotes || card.notes || '');
  const [isHuddleSaved, setIsHuddleSaved] = useState(false);

  // Keep targetDateInput and cardHuddleNotes synced when card updates
  React.useEffect(() => {
    if (card.estimatedCompletionDate) {
      const d = parseDateOnly(card.estimatedCompletionDate);
      if (d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        setTargetDateInput(`${y}-${m}-${day}`);
      }
    } else {
      setTargetDateInput('');
    }
    setCardHuddleNotes(card.huddleNotes || card.notes || '');
  }, [card.id, card.estimatedCompletionDate, card.huddleNotes, card.notes]);

  const deadlineInfo = getDeadlineInfo(card.estimatedCompletionDate, card.isUrgent);

  const handleSetTargetToday = () => {
    const todayStr = getLocalDateString(0);
    setTargetDateInput(todayStr);
    updateJobCard(card.id, (prev) => ({
      ...prev,
      estimatedCompletionDate: todayStr,
      isUrgent: true
    }));
    triggerSuccessHaptic();
    dispatchToastNotification({
      type: 'STATUS_CHANGE',
      title: '⏰ Target Today Assigned',
      message: `${card.vehicle.registrationNumber} set for Today (${todayStr}) and marked Urgent for Daily Huddle.`,
      vehicleReg: card.vehicle.registrationNumber,
      jobCardId: card.id
    });
  };

  const handleSetTargetTomorrow = () => {
    const tomorrowStr = getLocalDateString(1);
    setTargetDateInput(tomorrowStr);
    updateJobCard(card.id, (prev) => ({
      ...prev,
      estimatedCompletionDate: tomorrowStr,
      isUrgent: true
    }));
    triggerSuccessHaptic();
    dispatchToastNotification({
      type: 'STATUS_CHANGE',
      title: '📅 Target Tomorrow Assigned',
      message: `${card.vehicle.registrationNumber} set for Tomorrow (${tomorrowStr}) and marked Urgent for Daily Huddle.`,
      vehicleReg: card.vehicle.registrationNumber,
      jobCardId: card.id
    });
  };

  const handleSetCustomTargetDate = (dateStr: string) => {
    setTargetDateInput(dateStr);
    updateJobCard(card.id, (prev) => ({
      ...prev,
      estimatedCompletionDate: dateStr
    }));
    triggerSuccessHaptic();
    dispatchToastNotification({
      type: 'STATUS_CHANGE',
      title: 'Promised Delivery Date Set',
      message: `Promised date updated to ${dateStr}.`,
      vehicleReg: card.vehicle.registrationNumber,
      jobCardId: card.id
    });
  };

  const handleClearDeadline = () => {
    setTargetDateInput('');
    updateJobCard(card.id, (prev) => ({
      ...prev,
      estimatedCompletionDate: ''
    }));
    triggerSuccessHaptic();
    dispatchToastNotification({
      type: 'STATUS_CHANGE',
      title: 'Deadline Cleared',
      message: `Promised delivery date cleared for ${card.vehicle.registrationNumber}.`,
      vehicleReg: card.vehicle.registrationNumber,
      jobCardId: card.id
    });
  };

  const handleToggleUrgent = () => {
    const newUrgent = !card.isUrgent;
    updateJobCard(card.id, (prev) => ({
      ...prev,
      isUrgent: newUrgent
    }));
    triggerSuccessHaptic();
    dispatchToastNotification({
      type: 'STATUS_CHANGE',
      title: newUrgent ? '🔥 Marked Urgent for Daily Huddle' : 'Urgency Flag Removed',
      message: newUrgent 
        ? `${card.vehicle.registrationNumber} prioritized for floor team & morning standup.`
        : `${card.vehicle.registrationNumber} normal workflow priority restored.`,
      vehicleReg: card.vehicle.registrationNumber,
      jobCardId: card.id
    });
  };

  const handleSaveHuddleNotes = () => {
    updateJobCard(card.id, (prev) => ({
      ...prev,
      huddleNotes: cardHuddleNotes,
      notes: cardHuddleNotes
    }));
    setIsHuddleSaved(true);
    setTimeout(() => setIsHuddleSaved(false), 2500);
    triggerSuccessHaptic();
    dispatchToastNotification({
      type: 'STATUS_CHANGE',
      title: 'Daily Huddle Notes Saved',
      message: `Standup notes for ${card.vehicle.registrationNumber} saved.`,
      vehicleReg: card.vehicle.registrationNumber,
      jobCardId: card.id
    });
  };

  // Custom task form state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState<TaskCategory>('MECHANICAL');
  const [newTaskCost, setNewTaskCost] = useState(40);
  const [newTaskPrice, setNewTaskPrice] = useState(85);
  const [newTaskAssignedId, setNewTaskAssignedId] = useState(employees[0]?.id || '');
  const [newTaskPairedDenterId, setNewTaskPairedDenterId] = useState('');
  const [newTaskRequiresApproval, setNewTaskRequiresApproval] = useState(true);

  // Gate Check-out fields
  const [gateDriverName, setGateDriverName] = useState(card.checkInDriverName || 'Cars24 Fleet Driver');
  const [gateDriverPhone, setGateDriverPhone] = useState(card.checkInDriverPhone || '+91 98200 11223');
  const [gateExitPhotoUrl, setGateExitPhotoUrl] = useState('https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80');
  const [gateDriverSignature, setGateDriverSignature] = useState<string>(card.checkOutDriverSignatureUrl || '');

  // Counts & Progress
  const completedCount = card.tasks.filter(t => t.status === 'COMPLETED').length;
  const inProgressCount = card.tasks.filter(t => t.status === 'IN_PROGRESS').length;
  const pendingCount = card.tasks.filter(t => t.status === 'PENDING').length;
  const progressPct = card.tasks.length ? Math.round((completedCount / card.tasks.length) * 100) : 0;
  const isWorkCompleted = card.tasks.length > 0 && card.tasks.every(t => t.status === 'COMPLETED');
  const isInspectionDone = Boolean(card.qcPassed);
  const isDelivered = card.status === 'DELIVERED';

  // Part Consumption Compilation
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

  const totalMediaCount = React.useMemo(() => {
    const ids = new Set<string>();
    if (Array.isArray(card.proofMedia)) {
      card.proofMedia.forEach(p => ids.add(p.id || p.url));
    }
    if (Array.isArray(card.attachments)) {
      card.attachments.forEach(a => ids.add(a.id || a.url));
    }
    return ids.size;
  }, [card.proofMedia, card.attachments]);

  const totalConsumedCost = consumedItemsList.reduce((sum, item) => sum + item.totalCost, 0);

  // Billing calculations
  const totalTaskPrice = card.tasks
    .filter(t => t.isCustomerApproved !== false)
    .reduce((sum, t) => sum + (t.customerPrice || 0), 0);

  const discountVal = card.discount || 0;
  const taxableAmount = Math.max(0, totalTaskPrice - discountVal);
  const taxVal = Math.round((taxableAmount * (card.taxRate || 18)) / 100);
  const grandTotal = taxableAmount + taxVal;
  const balanceDue = Math.max(0, grandTotal - (card.advancePaid || 0));

  // Speech summary
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

    const speech = `गाड़ी नंबर ${reg}. मॉडल ${model}. कुल ${total} काम में से ${completedCount} काम पूरा हो चुका है. ${remaining} काम बाकी है. स्थिति: ${formatJobCardStatus(card.status)}.`;

    setIsPlayingHeaderAudio(true);
    speakTechnicianPrompt(speech, () => {
      setIsPlayingHeaderAudio(false);
    });
  };

  // Create Task
  const handleCreateNewTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const assignedEmp = employees.find(e => e.id === newTaskAssignedId);
    const assignedVen = vendors.find(v => v.id === newTaskAssignedId);
    const pairedDenterEmp = employees.find(e => e.id === newTaskPairedDenterId);

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
      pairedDenterId: newTaskCategory === 'PAINT' ? (newTaskPairedDenterId || undefined) : undefined,
      pairedDenterName: newTaskCategory === 'PAINT' ? (pairedDenterEmp?.name || undefined) : undefined,
      denterPayout: newTaskCategory === 'PAINT' ? 150 : undefined,
      painterPayout: newTaskCategory === 'PAINT' ? Number(newTaskCost) || 800 : undefined
    };

    const additionalTasks: JobTask[] = [newTask];

    // If Paint task and paired denter is set, also create pre-denting task if not already existing
    if (newTaskCategory === 'PAINT' && newTaskPairedDenterId) {
      const predentTask: JobTask = {
        id: `task-predent-add-${Date.now()}`,
        jobCardId: card.id,
        title: `Pre-Denting: ${newTaskTitle} (डेंटिंग व पैनल तैयारी)`,
        category: 'DENTING',
        assignedToId: newTaskPairedDenterId,
        assignedToName: pairedDenterEmp?.name,
        assignedType: 'EMPLOYEE',
        estimatedCost: 150,
        customerPrice: 0,
        status: 'PENDING',
        requiresCustomerApproval: false,
        isCustomerApproved: true,
        isContractBasis: true,
        contractorPayout: 150,
        denterPayout: 150
      };
      additionalTasks.push(predentTask);
    }

    updateJobCard(card.id, (prev) => ({
      ...prev,
      tasks: [...prev.tasks, ...additionalTasks],
      status: newTaskRequiresApproval ? 'ESTIMATE_PENDING' : prev.status
    }));

    setNewTaskTitle('');
    setNewTaskPairedDenterId('');
    setShowAddTask(false);

    dispatchToastNotification({
      type: 'JOB_CARD_CREATED',
      title: 'Task Added',
      message: `Added "${newTaskTitle}" to ${card.vehicle.registrationNumber}.`,
      vehicleReg: card.vehicle.registrationNumber,
      jobCardId: card.id
    });
  };

  // Gate check out execution
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
      checkOutDriverSignatureUrl: gateDriverSignature || undefined,
    }));

    if (card.checkInRecordId) {
      updateVehicleCheckIn(card.checkInRecordId, (prev) => ({
        ...prev,
        status: 'CHECKED_OUT',
        checkedOutAt: nowStr,
        checkOutDriverName: gateDriverName,
        checkOutDriverPhone: gateDriverPhone,
        checkOutPhotoWithDriverUrl: gateExitPhotoUrl,
        checkOutDriverSignatureUrl: gateDriverSignature || undefined,
      }));
    }

    triggerSuccessHaptic();
    setIsGateCheckOutOpen(false);
    dispatchToastNotification({
      type: 'JOB_CARD_CREATED',
      title: 'Gate Exit Recorded',
      message: `${card.vehicle.registrationNumber} dispatched successfully.`,
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
      <div className="bg-slate-950 text-white rounded-3xl border border-slate-800 w-full max-w-5xl shadow-2xl overflow-hidden my-2 sm:my-6 flex flex-col max-h-[95vh]">
        
        {/* =========================================================================
            TOP CONTROL BAR: VEHICLE IDENTITY + VIEW MODE SWITCH (TECHNICIAN / MANAGER)
           ========================================================================= */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
          
          {/* Left: Indian Registration Number Plate Badge + Car Make Model */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="bg-white text-slate-950 rounded-xl border-2 border-slate-300 px-3 py-1.5 shadow-md flex items-center gap-2 font-mono shrink-0">
              <div className="flex flex-col items-center justify-center border-r border-slate-300 pr-1.5 leading-none">
                <span className="text-[8px] font-black text-blue-700">IND</span>
                <span className="text-[7px] text-slate-500">🇮🇳</span>
              </div>
              <span className="text-base sm:text-lg font-black tracking-wider text-slate-950">
                {card.vehicle.registrationNumber}
              </span>
            </div>

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
                {isCars24 && (
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
            
            {/* 📸 वाहन के फोटो व वीडियो प्रमाण (Vehicle Photos & Proof Gallery Modal) */}
            <button
              type="button"
              onClick={() => {
                setSelectedProofTaskId(undefined);
                setIsVehiclePhotosModalOpen(true);
              }}
              className="px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 hover:border-amber-400 active:scale-95 shadow-xs cursor-pointer"
              title="गाड़ी के सभी फोटो व वीडियो देखें (Open Vehicle Photos & Work Proof)"
            >
              <Camera className="w-4 h-4 text-amber-400" />
              <span>वाहन फोटो ({card.proofMedia?.length || 0})</span>
            </button>

            {/* 🔊 Hindi Speech Summary Button */}
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

            {/* Delete Job Card Button */}
            {isManagerOrHigher && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`🗑️ Delete Job Card ${card.id}?\n\nVehicle: ${card.vehicle.registrationNumber} (${card.vehicle.make} ${card.vehicle.model})\nCustomer: ${card.customer.name}\nStatus: ${card.status}\n\nAre you sure you want to permanently delete this job card? This action cannot be undone.`)) {
                    deleteJobCard(card.id);
                    onClose();
                  }
                }}
                className="px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 hover:bg-rose-500 text-rose-400 hover:text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm active:scale-95"
                title="Delete this active Job Card"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden md:inline">Delete Job Card</span>
              </button>
            )}

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

        {/* VIEW CONTAINER */}
        <div className="p-4 sm:p-6 overflow-y-auto grow space-y-5 bg-slate-950">
          <div className="space-y-6">
              
              {/* Manager Metrics Strip */}
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 font-medium">Customer:</span>
                  <p className="font-bold text-white">{card.customer.name}</p>
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
                  <span className="text-slate-400 font-medium">Floor Supervisor:</span>
                  <p className="font-bold text-white">{card.floorManagerName}</p>
                  <p className="text-[11px] text-amber-400 font-semibold">Status: {formatJobCardStatus(card.status)}</p>
                </div>

                <div>
                  <span className="text-slate-400 font-medium">Task Progress:</span>
                  <p className="font-bold text-white">{completedCount}/{card.tasks.length} Completed ({progressPct}%)</p>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1 overflow-hidden">
                    <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>

                {isManagerOrHigher && (
                  <div>
                    <span className="text-slate-400 font-medium">Est. Total Bill:</span>
                    <p className="font-extrabold text-sm text-emerald-400">₹{grandTotal.toLocaleString('en-IN')}</p>
                    <p className="text-[11px] text-slate-400">Advance: ₹{(card.advancePaid || 0).toLocaleString('en-IN')}</p>
                  </div>
                )}
              </div>

              {/* Associated Gate Pass & Work Order Summary */}
              {(card.workOrderNo || card.workOrderNotes || card.checkInDriverName) && (
                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <h3 className="font-black text-xs text-white uppercase tracking-wide flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-blue-400" />
                      Associated Work Order & Gate Entry Pass
                    </h3>
                    <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-black uppercase">
                      Gate-Checked
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    {/* Work Order Info */}
                    <div className="md:col-span-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-medium">Work Order Ref:</span>
                        <span className="font-mono font-black text-amber-300 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded text-[11px]">
                          {card.workOrderNo || 'N/A (Direct Check-In)'}
                        </span>
                      </div>
                      {card.workOrderNotes && (
                        <div>
                          <span className="text-slate-400 font-medium block mb-1">Customer-Demanded Tasks / Symptoms:</span>
                          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 text-slate-300 whitespace-pre-wrap leading-relaxed font-semibold">
                            {card.workOrderNotes}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Gate Check-In Driver & Photo */}
                    <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/80 space-y-2">
                      <div className="flex items-start gap-2">
                        {card.checkInPhotoWithDriverUrl && (
                          <img
                            src={card.checkInPhotoWithDriverUrl}
                            alt="Gate Entry Photo"
                            className="w-12 h-12 rounded-lg object-cover border border-slate-700 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <div className="min-w-0">
                          <span className="text-[10px] text-slate-500 font-black block uppercase">Arrival Driver</span>
                          <p className="font-bold text-white truncate">{card.checkInDriverName || 'N/A'}</p>
                          {card.checkInDriverPhone && (
                            <p className="text-[10px] font-mono text-slate-400 mt-0.5">{card.checkInDriverPhone}</p>
                          )}
                        </div>
                      </div>
                      {card.checkedInAt && (
                        <div className="text-[10px] text-slate-500 flex items-center justify-between border-t border-slate-800/60 pt-1.5 mt-1.5">
                          <span>Gate Entry Time:</span>
                          <span className="font-bold text-slate-400">{card.checkedInAt}</span>
                        </div>
                      )}
                    </div>

                    {/* Gate Check-Out Driver, Photo & Digital Signature */}
                    {card.checkedOutAt && (
                      <div className="bg-emerald-950/20 p-3 rounded-xl border border-emerald-500/30 space-y-2 col-span-full">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex items-start gap-2">
                            {card.checkOutPhotoWithDriverUrl && (
                              <img
                                src={card.checkOutPhotoWithDriverUrl}
                                alt="Gate Exit Photo"
                                className="w-12 h-12 rounded-lg object-cover border border-emerald-500 shrink-0"
                                referrerPolicy="no-referrer"
                              />
                            )}
                            <div>
                              <span className="text-[10px] text-emerald-400 font-black block uppercase">Pickup Driver / Handover</span>
                              <p className="font-bold text-white truncate">{card.checkOutDriverName || 'Driver'}</p>
                              {card.checkOutDriverPhone && (
                                <p className="text-[10px] font-mono text-slate-400 mt-0.5">{card.checkOutDriverPhone}</p>
                              )}
                              <p className="text-[10px] text-slate-400 mt-0.5">Dispatched: <strong className="text-emerald-400">{card.checkedOutAt}</strong></p>
                            </div>
                          </div>

                          {card.checkOutDriverSignatureUrl && (
                            <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800 flex flex-col items-center">
                              <span className="text-[9px] text-slate-500 font-bold uppercase mb-0.5">Verified Signature</span>
                              <img
                                src={card.checkOutDriverSignatureUrl}
                                alt="Driver Signature"
                                className="h-9 max-w-[120px] object-contain"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Ready for Checkout (RFC) informational box */}
              {card.status === 'RFC' && (
                <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-300 flex items-start gap-3 text-xs">
                  <div className="text-lg">ℹ️</div>
                  <div className="space-y-1">
                    <p className="font-extrabold text-blue-400 uppercase tracking-wide">Vehicle is in Ready for Checkout (RFC) state</p>
                    <p className="font-semibold leading-relaxed">
                      {isCars24 ? (
                        "This vehicle is fully processed, invoice finalized, and PDI complete. As a CARS24 Fleet vehicle, it will remain parked inside the workshop until their designated driver performs the physical gate collection with the Gate Pass checkout."
                      ) : (
                        "This vehicle has completed all workshop repairs, passed quality check audits, and the invoice is fully generated. It is ready for final customer payout and gate pass clearance."
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Priority, Urgency & AI Estimator Strip (Managers only) */}
              {isManagerOrHigher && (
                <div className="px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-2.5 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Urgent toggle */}
                    <button
                      type="button"
                      onClick={handleToggleUrgent}
                      className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all border ${
                        card.isUrgent
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md animate-pulse'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-amber-500/50 hover:text-white'
                      }`}
                    >
                      <Flame className={`w-3.5 h-3.5 ${card.isUrgent ? 'fill-current' : 'text-amber-500'}`} />
                      <span>{card.isUrgent ? '🔥 MARKED URGENT' : 'Mark Urgent'}</span>
                    </button>

                    {/* Target Today Button */}
                    <button
                      type="button"
                      onClick={handleSetTargetToday}
                      title="Promised delivery today & mark urgent for standup"
                      className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all border ${
                        deadlineInfo.isToday
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                          : 'bg-slate-800 text-emerald-300 border-slate-700 hover:border-emerald-500/50 hover:text-white'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{deadlineInfo.isToday ? '⏰ Due Today' : 'Target Today'}</span>
                    </button>

                    {/* Target Tomorrow Button */}
                    <button
                      type="button"
                      onClick={handleSetTargetTomorrow}
                      title="Promised delivery tomorrow & mark urgent for standup"
                      className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all border ${
                        deadlineInfo.status === 'TOMORROW'
                          ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                          : 'bg-slate-800 text-blue-300 border-slate-700 hover:border-blue-500/50 hover:text-white'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5 text-blue-400" />
                      <span>{deadlineInfo.status === 'TOMORROW' ? '📅 Due Tomorrow' : 'Target Tomorrow'}</span>
                    </button>

                    {/* Deadline Status Badge */}
                    <button
                      type="button"
                      onClick={() => setActiveManagerTab('huddle')}
                      className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition-all ${deadlineInfo.color}`}
                      title="Click to manage Daily Huddle & Urgency settings"
                    >
                      <Clock className="w-3 h-3" />
                      <span className="font-black text-xs">{deadlineInfo.label}</span>
                      <span className="opacity-80 text-[10px] font-medium font-mono hidden sm:inline">{deadlineInfo.subtext}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsAIEstimatorOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95"
                    >
                      <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
                      <span>AI Cost Estimator</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveManagerTab('huddle')}
                      className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 border transition-all ${
                        activeManagerTab === 'huddle'
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-sm'
                          : 'bg-slate-800 text-amber-300 border-amber-500/30 hover:bg-slate-700'
                      }`}
                    >
                      <Flame className="w-3.5 h-3.5 text-amber-400" />
                      <span>Huddle Tab</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsReqModalOpen(true)}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-amber-300 border border-amber-500/30 font-bold text-xs flex items-center gap-1.5"
                    >
                      <PackageCheck className="w-3.5 h-3.5" />
                      <span>+ Requisition</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Manager Tab Switcher */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-1 overflow-x-auto">
                {[
                  { id: 'huddle', label: `🔥 Daily Huddle & Urgency${card.isUrgent ? ' (URGENT)' : ''}`, icon: Flame, managerOnly: true },
                  { id: 'tasks', label: `Task Allotments (${card.tasks.length})`, icon: Wrench, managerOnly: false },
                  { id: 'proof', label: `📸 Proof & Attachments (${totalMediaCount})`, icon: Camera, managerOnly: false },
                  { id: 'consumption', label: `Part Consumption (${consumedItemsList.length})`, icon: PackageCheck, managerOnly: false },
                  { id: 'approvals', label: `Customer Approvals (${card.tasks.filter(t => t.requiresCustomerApproval).length})`, icon: AlertCircle, managerOnly: true },
                  { id: 'qc', label: `QC Inspection (${card.qcPassed ? 'PASSED' : 'PENDING'})`, icon: ShieldCheck, managerOnly: false },
                  { id: 'delivery', label: 'Pick & Delivery', icon: Truck, managerOnly: true },
                  { id: 'invoice', label: 'GST Bill & Invoice', icon: FileText, managerOnly: true },
                  { id: 'history', label: '📜 Status Audit Trail', icon: Clock, managerOnly: true },
                ].filter(tab => isManagerOrHigher || !tab.managerOnly).map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeManagerTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveManagerTab(tab.id as any)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Manager Tab Contents */}
              {activeManagerTab === 'huddle' && (
                <div className="space-y-4">
                  {/* Banner: Current Delivery Urgency Status */}
                  <div className={`p-4 rounded-3xl border ${deadlineInfo.color} space-y-2`}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-2xl bg-black/20">
                          {deadlineInfo.isOverdue ? (
                            <AlertTriangle className="w-6 h-6 text-rose-500 animate-bounce" />
                          ) : deadlineInfo.isToday ? (
                            <Clock className="w-6 h-6 text-amber-400" />
                          ) : (
                            <Calendar className="w-6 h-6 text-blue-400" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-black text-sm text-white flex items-center gap-2">
                            <span>{deadlineInfo.label}</span>
                            {card.isUrgent && (
                              <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                                🔥 HIGH PRIORITY
                              </span>
                            )}
                          </h4>
                          <p className="text-xs text-slate-300 font-medium">
                            {deadlineInfo.subtext}
                          </p>
                        </div>
                      </div>

                      {/* Clear deadline button if set */}
                      {card.estimatedCompletionDate && (
                        <button
                          type="button"
                          onClick={handleClearDeadline}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition-colors"
                        >
                          Clear Deadline
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 1-Click Target Date Presets & Custom Date Picker */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4">
                    <div>
                      <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-400" />
                        <span>Promised Delivery Target Date</span>
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Set the customer promised delivery timeline. Updating this will update the Daily Standup Huddle view and manager dashboard.
                      </p>
                    </div>

                    {/* Quick 1-Click Buttons */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <button
                        type="button"
                        onClick={handleSetTargetToday}
                        className={`p-3 rounded-2xl border text-xs font-black flex flex-col items-center justify-center gap-1.5 transition-all ${
                          deadlineInfo.isToday
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-md ring-2 ring-emerald-500/30'
                            : 'bg-slate-800/80 text-slate-200 border-slate-700 hover:bg-emerald-950/40 hover:border-emerald-500/50 hover:text-emerald-300'
                        }`}
                      >
                        <Clock className="w-4 h-4 text-emerald-400" />
                        <span>⏰ Target Today</span>
                        <span className="text-[10px] font-mono opacity-75">{getLocalDateString(0)}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSetTargetTomorrow}
                        className={`p-3 rounded-2xl border text-xs font-black flex flex-col items-center justify-center gap-1.5 transition-all ${
                          deadlineInfo.status === 'TOMORROW'
                            ? 'bg-blue-600 text-white border-blue-500 shadow-md ring-2 ring-blue-500/30'
                            : 'bg-slate-800/80 text-slate-200 border-slate-700 hover:bg-blue-950/40 hover:border-blue-500/50 hover:text-blue-300'
                        }`}
                      >
                        <Calendar className="w-4 h-4 text-blue-400" />
                        <span>📅 Target Tomorrow</span>
                        <span className="text-[10px] font-mono opacity-75">{getLocalDateString(1)}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSetCustomTargetDate(getLocalDateString(2))}
                        className="p-3 rounded-2xl border bg-slate-800/80 text-slate-200 border-slate-700 hover:bg-slate-700/80 hover:text-white text-xs font-black flex flex-col items-center justify-center gap-1.5 transition-all"
                      >
                        <Calendar className="w-4 h-4 text-indigo-400" />
                        <span>🗓️ +2 Days</span>
                        <span className="text-[10px] font-mono opacity-75">{getLocalDateString(2)}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSetCustomTargetDate(getLocalDateString(3))}
                        className="p-3 rounded-2xl border bg-slate-800/80 text-slate-200 border-slate-700 hover:bg-slate-700/80 hover:text-white text-xs font-black flex flex-col items-center justify-center gap-1.5 transition-all"
                      >
                        <Calendar className="w-4 h-4 text-purple-400" />
                        <span>🗓️ +3 Days</span>
                        <span className="text-[10px] font-mono opacity-75">{getLocalDateString(3)}</span>
                      </button>
                    </div>

                    {/* Custom Date Input Row */}
                    <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <div className="flex-1">
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">
                          Custom Promised Date:
                        </label>
                        <input
                          type="date"
                          value={targetDateInput}
                          onChange={(e) => setTargetDateInput(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 font-bold text-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                      <div className="sm:self-end">
                        <button
                          type="button"
                          onClick={() => {
                            if (targetDateInput) {
                              handleSetCustomTargetDate(targetDateInput);
                            }
                          }}
                          disabled={!targetDateInput}
                          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs transition-all shadow-md active:scale-95"
                        >
                          Save Promised Date
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Daily Standup Urgency Toggle */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Flame className={`w-5 h-5 ${card.isUrgent ? 'text-amber-500 fill-current' : 'text-slate-500'}`} />
                        <h4 className="font-black text-sm text-white">Daily Standup Urgency Priority</h4>
                        {card.isUrgent && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-extrabold text-[10px] border border-amber-500/40">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 max-w-xl">
                        When enabled, this vehicle is marked with a flame badge across all lists, prioritized in search filters, and placed at the top of the Morning Huddle dashboard.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleToggleUrgent}
                      className={`px-5 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 transition-all shadow-md active:scale-95 shrink-0 ${
                        card.isUrgent
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                      }`}
                    >
                      <Flame className="w-4 h-4" />
                      <span>{card.isUrgent ? 'Urgent Priority Active' : 'Enable Urgent Priority'}</span>
                    </button>
                  </div>

                  {/* Standup Blockers & Bay Notes */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-400" />
                          <span>Daily Huddle Discussion & Blocker Notes</span>
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Log vehicle impediments discussed during floor standup (parts pending, paint drying, test drive issues, etc.).
                        </p>
                      </div>

                      {isHuddleSaved && (
                        <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold text-xs border border-emerald-500/40 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>Saved!</span>
                        </span>
                      )}
                    </div>

                    {/* Quick 1-tap blocker tag chips */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-bold text-slate-400 mr-1">Quick Tags:</span>
                      {[
                        '⚠️ Awaiting Spare Parts',
                        '🎨 Paint Booth Drying',
                        '📞 Customer Approval Pending',
                        '🏎️ Road Test Required',
                        '⚡ VIP Handover Today',
                        '🧼 Final Washing & Detailing',
                        '🔧 Lathe Work Sublet Pending'
                      ].map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            setCardHuddleNotes((prev) => {
                              const trimmed = prev.trim();
                              if (!trimmed) return tag;
                              if (trimmed.includes(tag)) return trimmed;
                              return `${trimmed} | ${tag}`;
                            });
                          }}
                          className="px-2.5 py-1 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 text-[11px] font-bold border border-slate-700 transition-colors"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>

                    <textarea
                      rows={3}
                      value={cardHuddleNotes}
                      onChange={(e) => setCardHuddleNotes(e.target.value)}
                      placeholder="e.g. Front bumper paint clear coat curing until 2 PM. Delivery requested at 4:30 PM. Customer wants wheel alignment report."
                      className="w-full p-3 rounded-2xl bg-slate-800 border border-slate-700 font-medium text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleSaveHuddleNotes}
                        className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs transition-all shadow-md active:scale-95 flex items-center gap-2"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Save Huddle Notes</span>
                      </button>
                    </div>
                  </div>

                  {/* Vehicle Readiness & Department Status Quick Overview */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Unassigned Tasks */}
                    <div 
                      onClick={() => setActiveManagerTab('tasks')}
                      className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer space-y-1 transition-all"
                    >
                      <span className="text-[11px] font-bold text-slate-400">Technician Allocation</span>
                      <p className="text-sm font-black text-white">
                        {card.tasks.filter(t => !t.assignedToId && t.status !== 'COMPLETED').length > 0 ? (
                          <span className="text-amber-400">
                            ⚠️ {card.tasks.filter(t => !t.assignedToId && t.status !== 'COMPLETED').length} Tasks Unassigned
                          </span>
                        ) : (
                          <span className="text-emerald-400">
                            ✅ All Tasks Assigned
                          </span>
                        )}
                      </p>
                      <span className="text-[10px] text-slate-500">Click to view Task Allotments</span>
                    </div>

                    {/* Customer Approvals */}
                    <div 
                      onClick={() => setActiveManagerTab('approvals')}
                      className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer space-y-1 transition-all"
                    >
                      <span className="text-[11px] font-bold text-slate-400">Customer Estimate</span>
                      <p className="text-sm font-black text-white">
                        {card.tasks.filter(t => t.requiresCustomerApproval && t.isCustomerApproved === null).length > 0 ? (
                          <span className="text-rose-400">
                            🚨 {card.tasks.filter(t => t.requiresCustomerApproval && t.isCustomerApproved === null).length} Pending Approval
                          </span>
                        ) : (
                          <span className="text-emerald-400">
                            ✅ Approvals Clear
                          </span>
                        )}
                      </p>
                      <span className="text-[10px] text-slate-500">Click to view Customer Portal</span>
                    </div>

                    {/* QC Audit */}
                    <div 
                      onClick={() => setActiveManagerTab('qc')}
                      className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer space-y-1 transition-all"
                    >
                      <span className="text-[11px] font-bold text-slate-400">Floor QC Inspection</span>
                      <p className="text-sm font-black text-white">
                        {card.qcPassed ? (
                          <span className="text-emerald-400">
                            ✅ QC Passed
                          </span>
                        ) : (
                          <span className="text-amber-400">
                            ⏳ QC Audit Pending
                          </span>
                        )}
                      </p>
                      <span className="text-[10px] text-slate-500">Click to perform QC Inspection</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Manager Tab Contents */}
              {activeManagerTab === 'tasks' && (
                <div className="space-y-4">
                  {/* Vehicle Paint & Dent Batch Allotment Protocol */}
                  {card.tasks.some(t => t.category === 'PAINT') && (
                    <PaintBatchAllotmentControl
                      paintTasks={card.tasks.filter(t => t.category === 'PAINT')}
                      employees={employees}
                      vehicleReg={card.vehicle.registrationNumber}
                      isCars24={isCars24}
                      onApplyBatchAllotment={(pId, pName, dId, dName) => {
                        reassignAllPaintTasksForJobCard(card.id, pId, pName, dId, dName);
                        dispatchToastNotification({
                          type: 'STATUS_CHANGE',
                          title: 'Paint Panels Reassigned',
                          message: `Reassigned all paint panels on ${card.vehicle.registrationNumber} to ${pName || 'Unassigned Painter'} & ${dName || 'Unassigned Denter'}.`,
                          vehicleReg: card.vehicle.registrationNumber,
                          jobCardId: card.id
                        });
                      }}
                    />
                  )}

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-sm text-white">Department Task Allotments</h4>
                      <p className="text-xs text-slate-400">Manage labor contractor payouts and assigned mechanics</p>
                    </div>
                    {isManagerOrHigher ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setIsStandardCatalogOpen(true)}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 text-amber-300 border border-amber-500/30 font-bold text-xs"
                        >
                          ⚡ 1-Click Standard Jobs
                        </button>
                        <button
                          onClick={() => setShowAddTask(true)}
                          className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs"
                        >
                          + Custom Task
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsRequestAddWorkOpen(true)}
                        className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/10 active:scale-95 transition-all"
                        title="Submit request for additional job for manager approval"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Request Additional Work</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {card.tasks.map((task) => (
                      <TaskDetailCard
                        key={task.id}
                        card={card}
                        task={task}
                        employees={employees}
                        vendors={vendors}
                        currentRole={currentRole}
                        onTaskStatusChange={(taskId, status) => updateTaskStatus(card.id, taskId, status)}
                        onRemoveTask={(taskId) => {
                          deleteJobCardTask(card.id, taskId);
                          dispatchToastNotification({
                            type: 'JOB_CARD_CREATED',
                            title: 'Job Removed',
                            message: `Removed task from ${card.vehicle.registrationNumber}.`,
                            vehicleReg: card.vehicle.registrationNumber,
                            jobCardId: card.id
                          });
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {activeManagerTab === 'approvals' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-amber-500/10 p-4 rounded-2xl border border-amber-500/30">
                    <div>
                      <h4 className="font-bold text-amber-400 text-sm">Customer Approval Portal</h4>
                      <p className="text-xs text-slate-300">Share instant live approval link with customer.</p>
                    </div>
                    <button
                      onClick={() => onOpenCustomerApprovalPortal(card.id)}
                      className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1.5"
                    >
                      Open Approval Portal <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {card.tasks.filter(t => t.requiresCustomerApproval).map((task) => (
                      <div key={task.id} className="p-4 rounded-2xl border border-slate-800 bg-slate-900 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-sm text-white">{task.title}</p>
                          {isManagerOrHigher && (
                            <p className="text-xs text-slate-400">Price: ₹{task.customerPrice.toLocaleString('en-IN')}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => respondToCustomerApproval(card.id, task.id, true)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => respondToCustomerApproval(card.id, task.id, false, 'Declined')}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors"
                          >
                            Decline
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to remove "${task.title}" from this job card?`)) {
                                deleteJobCardTask(card.id, task.id);
                                dispatchToastNotification({
                                  type: 'JOB_CARD_CREATED',
                                  title: 'Task Removed',
                                  message: `Removed ${task.title} from ${card.vehicle.registrationNumber}.`,
                                  vehicleReg: card.vehicle.registrationNumber,
                                  jobCardId: card.id
                                });
                              }
                            }}
                            className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                            title="Remove task from job card"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeManagerTab === 'consumption' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-slate-900 p-4 rounded-2xl border border-slate-800">
                    <div>
                      <h4 className="font-extrabold text-white text-sm">Part & Consumable Consumption Audit</h4>
                      <p className="text-xs text-slate-400">Fitted parts on Job Card {card.id}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Consumed Value</span>
                      <strong className="text-base font-black text-amber-400 font-mono">₹{totalConsumedCost.toLocaleString('en-IN')}</strong>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-900">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="bg-slate-800 text-slate-400 font-bold border-b border-slate-700">
                          <th className="p-3">Part Name</th>
                          <th className="p-3">Task</th>
                          <th className="p-3 text-center">Qty</th>
                          <th className="p-3 text-right">Cost</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {consumedItemsList.map((item, idx) => (
                          <tr key={`${item.id}-${idx}`}>
                            <td className="p-3 font-bold text-white">{item.title}</td>
                            <td className="p-3 text-slate-400">{item.taskTitle}</td>
                            <td className="p-3 text-center font-mono">{item.quantity}</td>
                            <td className="p-3 text-right font-mono font-bold text-amber-400">₹{item.totalCost.toLocaleString('en-IN')}</td>
                            <td className="p-3 text-emerald-400 font-bold">✓ Fitted</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeManagerTab === 'proof' && (
                <ProofMediaGallery
                  jobCard={card}
                  currentUser={currentUser}
                  onOpenAddModal={(taskId?: string) => {
                    setSelectedProofTaskId(taskId);
                    setIsProofModalOpen(true);
                  }}
                />
              )}

              {activeManagerTab === 'qc' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-sm text-white">Floor Manager Quality Inspection</h4>
                      <p className="text-xs text-slate-400">12-point pre-delivery audit</p>
                    </div>
                    <button
                      onClick={() => onOpenQCModal(card.id)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold"
                    >
                      Open QC Audit
                    </button>
                  </div>
                </div>
              )}

              {activeManagerTab === 'delivery' && (
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                  <h4 className="font-extrabold text-sm text-cyan-400 flex items-center gap-2">
                    <Truck className="w-4 h-4" /> Pick & Delivery Service
                  </h4>
                  <p className="text-xs text-slate-300">
                    Assign a delivery driver to pick up or deliver the vehicle.
                  </p>
                  <button
                    onClick={handleAssignDeliveryDriver}
                    className="px-4 py-2 bg-cyan-500 text-slate-950 font-black text-xs rounded-xl"
                  >
                    Dispatch Delivery Driver
                  </button>
                </div>
              )}

              {activeManagerTab === 'invoice' && (
                <GSTInvoiceView card={card} currentRole={currentRole} />
              )}

              {activeManagerTab === 'history' && (() => {
                const LIFECYCLE_STAGES = [
                  { status: 'CREATED', label: 'Created', desc: 'Job card initialized' },
                  { status: 'JOB_ALLOCATED', label: 'Allocated', desc: 'Tasks & staff allotted' },
                  { status: 'IN_PROGRESS', label: 'In Progress', desc: 'Repairs ongoing' },
                  { status: 'QC_PENDING', label: 'QC & PDI', desc: '12-point inspection' },
                  { status: 'RFC', label: 'RFC (Ready to Go)', desc: 'Invoice made, ready for checkout' },
                  { status: 'DELIVERED', label: 'Delivered', desc: 'Vehicle checked out' },
                ];
                
                const currentStatusIndex = LIFECYCLE_STAGES.findIndex(s => s.status === card.status);
                const activeIndex = card.status === 'CLOSED' ? 5 : (currentStatusIndex !== -1 ? currentStatusIndex : 0);
                const historyRecords = getJobCardHistoryRecords(card.id);

                return (
                  <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-6">
                    {/* Visual Status Node Line */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-black text-xs text-slate-300 uppercase tracking-wide">Vehicle Lifecycle Timeline Progress</h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">Real-time tracking of the car through key workshop milestones.</p>
                      </div>

                      {/* Desktop Node Row */}
                      <div className="hidden md:grid grid-cols-6 gap-2 relative pt-2">
                        {/* Connecting line */}
                        <div className="absolute top-[26px] left-[8%] right-[8%] h-1 bg-slate-800 z-0">
                          <div 
                            className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 transition-all duration-500"
                            style={{ width: `${(activeIndex / 5) * 100}%` }}
                          />
                        </div>

                        {LIFECYCLE_STAGES.map((stage, idx) => {
                          const isCompleted = idx < activeIndex;
                          const isActive = idx === activeIndex;

                          let circleClass = '';
                          let textClass = '';
                          let icon = null;

                          if (isCompleted) {
                            circleClass = 'bg-emerald-500 text-slate-950 border-emerald-400';
                            textClass = 'text-emerald-400 font-bold';
                            icon = <Check className="w-3.5 h-3.5 stroke-[3]" />;
                          } else if (isActive) {
                            circleClass = 'bg-amber-500 text-slate-950 border-amber-400 ring-4 ring-amber-500/20 animate-pulse';
                            textClass = 'text-amber-400 font-extrabold';
                            icon = <span className="w-2 h-2 rounded-full bg-slate-950" />;
                          } else {
                            circleClass = 'bg-slate-800 text-slate-500 border-slate-700';
                            textClass = 'text-slate-500 font-medium';
                            icon = <span className="text-[10px] font-mono">{idx + 1}</span>;
                          }

                          return (
                            <div key={stage.status} className="flex flex-col items-center text-center z-10 relative">
                              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${circleClass}`}>
                                {icon}
                              </div>
                              <p className={`text-xs mt-2 truncate max-w-full ${textClass}`}>
                                {stage.label}
                              </p>
                              <p className="text-[10px] text-slate-500 mt-0.5 max-w-[120px] leading-tight">
                                {stage.desc}
                              </p>
                            </div>
                          );
                        })}
                      </div>

                      {/* Mobile Node Row */}
                      <div className="md:hidden space-y-2 pl-2">
                        {LIFECYCLE_STAGES.map((stage, idx) => {
                          const isCompleted = idx < activeIndex;
                          const isActive = idx === activeIndex;
                          
                          let indicator = '';
                          let textStyle = '';
                          if (isCompleted) {
                            indicator = '🟢 Completed';
                            textStyle = 'text-emerald-400';
                          } else if (isActive) {
                            indicator = '🟡 Active Phase';
                            textStyle = 'text-amber-400 font-bold';
                          } else {
                            indicator = '⚪ Pending';
                            textStyle = 'text-slate-500';
                          }

                          return (
                            <div key={stage.status} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-950/40 border border-slate-800/60">
                              <span className={`font-bold ${textStyle}`}>{idx + 1}. {stage.label}</span>
                              <span className="text-[10px] text-slate-400">{indicator}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <hr className="border-slate-800" />

                    {/* Detailed Change Audit Log */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-black text-xs text-slate-300 uppercase tracking-wide">Detailed Change Audit Logs</h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">Every system action, manual transition, and user approval record.</p>
                        </div>
                        <span className="text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded font-mono font-bold">
                          {historyRecords.length} EVENTS
                        </span>
                      </div>

                      {historyRecords.length === 0 ? (
                        <div className="py-8 text-center text-slate-500 text-xs">
                          No status changes logged yet for this Job Card.
                        </div>
                      ) : (
                        <div className="space-y-4 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-800">
                          {historyRecords.map((rec) => (
                            <div key={rec.id} className="relative pl-8 text-xs group">
                              {/* Left dot indicator */}
                              <div className="absolute left-2 top-2.5 w-3 h-3 rounded-full bg-amber-500 border-2 border-slate-900 -translate-x-1/2 transition-transform group-hover:scale-125" />
                              
                              <div className="bg-slate-950/80 hover:bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 transition-all shadow-xs space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-900 pb-2">
                                  {/* Title of transition */}
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-black text-slate-200">
                                      {rec.previousStatus ? (
                                        <>
                                          <span className="text-slate-400 line-through mr-1 font-semibold">{formatJobCardStatus(rec.previousStatus)}</span>
                                          <span className="text-slate-500">➔</span>
                                        </>
                                      ) : (
                                        <span className="text-slate-400 font-semibold mr-1">Initialized ➔</span>
                                      )}
                                      <span className="text-amber-400 font-extrabold ml-1 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                                        {formatJobCardStatus(rec.newStatus)}
                                      </span>
                                    </span>
                                  </div>
                                  
                                  {/* Timestamp */}
                                  <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1 shrink-0">
                                    📅 {new Date(rec.createdAt).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}
                                  </span>
                                </div>

                                {/* Notes/Comments */}
                                {rec.notes && (
                                  <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 text-slate-300 font-semibold leading-relaxed">
                                    {rec.notes}
                                  </div>
                                )}

                                {/* Performed By & Metadata */}
                                <div className="flex items-center justify-between text-[10px] text-slate-400 flex-wrap gap-2 pt-1">
                                  <div className="flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-slate-500" />
                                    <span>
                                      Performed By: <strong className="text-slate-300">{rec.changedByName || 'System Process'}</strong> 
                                      <span className="text-slate-500 font-medium ml-1">({rec.changedByRole || 'Staff'})</span>
                                    </span>
                                  </div>
                                  
                                  <span className="uppercase text-[9px] font-black px-2 py-0.5 bg-slate-800 text-slate-400 rounded-md border border-slate-700">
                                    {rec.actionType || 'STATUS_CHANGE'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

            </div>

        </div>

      </div>

      {/* Add Custom Task Modal */}
      <AddCustomJobModal
        isOpen={showAddTask}
        onClose={() => setShowAddTask(false)}
        employees={employees}
        vendors={vendors}
        onAddJob={(newCustomJob) => {
          const newTask: JobTask = {
            id: `task-add-${Date.now()}`,
            jobCardId: card.id,
            title: newCustomJob.title,
            category: newCustomJob.category,
            assignedToId: newCustomJob.assignedToId,
            assignedToName: newCustomJob.assignedToName,
            assignedType: newCustomJob.assignedType,
            estimatedCost: newCustomJob.estimatedCost,
            customerPrice: newCustomJob.customerPrice,
            status: 'PENDING',
            requiresCustomerApproval: newCustomJob.requiresCustomerApproval,
            isCustomerApproved: newCustomJob.requiresCustomerApproval ? null : true,
            isAdditionalWork: true,
            approvalStatus: newCustomJob.requiresCustomerApproval ? 'PENDING' : 'APPROVED',
            isContractBasis: newCustomJob.isContractBasis,
            contractorPayout: newCustomJob.contractorPayout,
            painterPayout: newCustomJob.painterPayout,
            denterPayout: newCustomJob.denterPayout,
            pairedDenterId: newCustomJob.pairedDenterId,
            pairedDenterName: newCustomJob.pairedDenterName,
            isOutsourced: newCustomJob.isOutsourced,
            outsourcedVendorId: newCustomJob.outsourcedVendorId,
            outsourcedVendorName: newCustomJob.outsourcedVendorName,
          };

          const additionalTasks: JobTask[] = [newTask];

          // If Paint task and paired denter is set, also create pre-denting task
          if (newCustomJob.category === 'PAINT' && newCustomJob.pairedDenterId) {
            const predentTask: JobTask = {
              id: `task-predent-add-${Date.now()}`,
              jobCardId: card.id,
              title: `Pre-Denting: ${newCustomJob.title} (डेंटिंग व पैनल तैयारी)`,
              category: 'DENTING',
              assignedToId: newCustomJob.pairedDenterId,
              assignedToName: newCustomJob.pairedDenterName,
              assignedType: 'EMPLOYEE',
              estimatedCost: newCustomJob.denterPayout || 150,
              customerPrice: 0,
              status: 'PENDING',
              requiresCustomerApproval: false,
              isCustomerApproved: true,
              isContractBasis: true,
              contractorPayout: newCustomJob.denterPayout || 150,
              denterPayout: newCustomJob.denterPayout || 150
            };
            additionalTasks.push(predentTask);
          }

          updateJobCard(card.id, (prev) => ({
            ...prev,
            tasks: [...prev.tasks, ...additionalTasks],
            status: newCustomJob.requiresCustomerApproval ? 'ESTIMATE_PENDING' : prev.status
          }));

          dispatchToastNotification({
            type: 'INFO',
            title: 'Custom Job Added',
            message: `Added ${newCustomJob.title} to Job Card.`,
          });
        }}
      />

      {/* 1-Click Standard Jobs Catalog Modal */}
      <StandardJobsCatalogModal
        card={{ ...card, isCars24 }}
        isOpen={isStandardCatalogOpen}
        onClose={() => setIsStandardCatalogOpen(false)}
      />

      {/* Gate Departure Check-Out Modal */}
      {isGateCheckOutOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 text-white rounded-3xl border border-slate-800 max-w-lg w-full shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
            <div className="p-6 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
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
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-2xl space-y-1 text-emerald-300">
                <span className="font-bold flex items-center gap-1 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Pre-Delivery Inspection Complete & Invoice Ready
                </span>
                <p className="text-[11px] text-slate-300">
                  Verify the driver picking up the car and capture the departure verification photo with driver.
                </p>
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Pickup Driver Name *</label>
                <input
                  type="text"
                  placeholder="Driver picking up vehicle"
                  value={gateDriverName}
                  onChange={(e) => setGateDriverName(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 font-bold text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Driver Phone Number</label>
                <input
                  type="text"
                  placeholder="+91 98200 00000"
                  value={gateDriverPhone}
                  onChange={(e) => setGateDriverPhone(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 font-mono text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Camera className="w-3.5 h-3.5 text-emerald-500" /> Departure Photo of Car with Driver
                  </span>
                  <label 
                    htmlFor="departure-cam-input" 
                    className="cursor-pointer text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 active:scale-95 transition-all"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Snap Photo</span>
                  </label>
                </label>

                <input
                  id="departure-cam-input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        if (ev.target?.result) {
                          setGateExitPhotoUrl(ev.target.result as string);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />

                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={gateExitPhotoUrl}
                    onChange={(e) => setGateExitPhotoUrl(e.target.value)}
                    placeholder="Photo URL or snap with camera button above"
                    className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 font-mono text-[11px] text-white"
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

              {/* Digital Signature Pad for Driver / Handover */}
              <div className="pt-1">
                <DigitalSignaturePad
                  label="Pickup Driver / Customer Digital Signature"
                  signeeName={gateDriverName}
                  initialSignature={gateDriverSignature}
                  height={130}
                  onSave={(dataUrl) => setGateDriverSignature(dataUrl)}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsGateCheckOutOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
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

      {/* Part Requisition Modal */}
      {isReqModalOpen && (
        <PartRequisitionModal
          card={card}
          isOpen={isReqModalOpen}
          onClose={() => setIsReqModalOpen(false)}
        />
      )}

      {/* Request Additional Work Modal */}
      {isRequestAddWorkOpen && (
        <RequestAdditionalWorkModal
          card={card}
          isOpen={isRequestAddWorkOpen}
          onClose={() => setIsRequestAddWorkOpen(false)}
          currentRole={currentRole}
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

      {/* Dedicated Vehicle Photos & Proofs Modal (Accessible from anywhere in the Job Card) */}
      {isVehiclePhotosModalOpen && (
        <ProofMediaGallery
          jobCard={card}
          currentUser={currentUser}
          isModal={true}
          isOpen={isVehiclePhotosModalOpen}
          initialFilterTaskId={selectedProofTaskId}
          onClose={() => {
            setIsVehiclePhotosModalOpen(false);
            setSelectedProofTaskId(undefined);
          }}
          onOpenAddModal={(taskId?: string) => {
            setSelectedProofTaskId(taskId);
            setIsProofModalOpen(true);
          }}
        />
      )}

      {/* Proof of Work Media Modal (Photos & Videos on Supabase Storage) */}
      {isProofModalOpen && (
        <ProofOfWorkModal
          isOpen={isProofModalOpen}
          onClose={() => {
            setIsProofModalOpen(false);
            setSelectedProofTaskId(undefined);
          }}
          jobCard={card}
          currentUser={currentUser}
          initialTaskId={selectedProofTaskId}
        />
      )}
    </div>
  );
}
