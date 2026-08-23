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
  HelpCircle,
  ClipboardCheck
} from 'lucide-react';

import { TaskDetailCard } from './TaskDetailCard';
import { StandardJobsCatalogModal } from './StandardJobsCatalogModal';
import { GSTInvoiceView } from './GSTInvoiceView';
import { PartRequisitionModal } from './PartRequisitionModal';
import { AIPrioritySuggestionBox } from './AIPrioritySuggestionBox';
import { AICostEstimatorModal } from './AICostEstimatorModal';

import { TechnicianStepperNav, TechnicianRepairPhase } from './technician/TechnicianStepperNav';
import { TechnicianInspectionPhase } from './technician/TechnicianInspectionPhase';
import { TechnicianPartsRequestPhase } from './technician/TechnicianPartsRequestPhase';
import { TechnicianRepairPhase as TechnicianRepairWorkPhase } from './technician/TechnicianRepairPhase';
import { TechnicianQualityPhase } from './technician/TechnicianQualityPhase';

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
  const isManagerOrHigher = ['SUPER_ADMIN', 'ADMIN', 'FLOOR_MANAGER'].includes(currentRole);
  
  // Default to technician mode for a technician-first experience
  const [viewMode, setViewMode] = useState<'TECHNICIAN' | 'MANAGER'>(
    isManagerOrHigher ? 'MANAGER' : 'TECHNICIAN'
  );

  // Stepper phase state for technician workflow
  const totalRequisitionsCount = React.useMemo(() => {
    return card.tasks.reduce((sum, t) => sum + (t.requisitions?.length || 0), 0);
  }, [card.tasks]);

  const initialPhase: TechnicianRepairPhase = React.useMemo(() => {
    if (card.status === 'DELIVERED' || card.status === 'READY_FOR_DELIVERY' || card.qcPassed) return 'QC';
    if (card.tasks.some(t => t.status === 'IN_PROGRESS' || t.status === 'COMPLETED')) return 'REPAIR';
    if (card.tasks.some(t => t.requisitions && t.requisitions.length > 0)) return 'PARTS_REQUEST';
    return 'ASSESSMENT';
  }, [card.status, card.qcPassed, card.tasks]);

  const [currentPhase, setCurrentPhase] = useState<TechnicianRepairPhase>(initialPhase);
  const [isPlayingHeaderAudio, setIsPlayingHeaderAudio] = useState(false);

  // Modals
  const [isReqModalOpen, setIsReqModalOpen] = useState(false);
  const [isAIEstimatorOpen, setIsAIEstimatorOpen] = useState(false);
  const [isStandardCatalogOpen, setIsStandardCatalogOpen] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [isGateCheckOutOpen, setIsGateCheckOutOpen] = useState(false);

  // Manager Tabs
  const [activeManagerTab, setActiveManagerTab] = useState<'tasks' | 'approvals' | 'consumption' | 'qc' | 'delivery' | 'invoice'>('tasks');

  // Custom task form state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState<TaskCategory>('MECHANICAL');
  const [newTaskCost, setNewTaskCost] = useState(40);
  const [newTaskPrice, setNewTaskPrice] = useState(85);
  const [newTaskAssignedId, setNewTaskAssignedId] = useState(employees[0]?.id || '');
  const [newTaskRequiresApproval, setNewTaskRequiresApproval] = useState(true);

  // Gate Check-out fields
  const [gateDriverName, setGateDriverName] = useState(card.checkInDriverName || 'Cars24 Fleet Driver');
  const [gateDriverPhone, setGateDriverPhone] = useState(card.checkInDriverPhone || '+91 98200 11223');
  const [gateExitPhotoUrl, setGateExitPhotoUrl] = useState('https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80');

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

    const speech = `गाड़ी नंबर ${reg}. मॉडल ${model}. कुल ${total} काम में से ${completedCount} काम पूरा हो चुका है. ${remaining} काम बाकी है. वर्तमान चरण है ${
      currentPhase === 'INSPECTION' ? 'प्रारंभिक जांच' :
      currentPhase === 'ACTIVE_REPAIR' ? 'मरम्मत एवं पार्ट्स' :
      currentPhase === 'QUALITY_CHECK' ? 'क्वालिटी चेक' : 'डिलीवरी एवं गेट पास'
    }.`;

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

            {/* View Mode Toggle: Technician Stepper vs Manager Suite */}
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
                <span>मिस्त्री मोड (Stepper)</span>
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
            TECHNICIAN-FIRST 4-PHASE STEPPER NAVIGATION (High-Contrast & Tactile)
           ========================================================================= */}
        {viewMode === 'TECHNICIAN' && (
          <TechnicianStepperNav
            currentPhase={currentPhase}
            onPhaseChange={(phase) => setCurrentPhase(phase)}
            completedTasksCount={completedCount}
            totalTasksCount={card.tasks.length}
            requisitionsCount={totalRequisitionsCount}
            qcPassed={Boolean(card.qcPassed)}
            isDelivered={isDelivered}
            vehicleReg={card.vehicle.registrationNumber}
            vehicleMakeModel={`${card.vehicle.make} ${card.vehicle.model}`}
            isCars24={card.isCars24}
          />
        )}

        {/* =========================================================================
            VIEW CONTAINER: STEPPER PHASES (REVEALS ONLY ACTIVE PHASE FIELDS)
           ========================================================================= */}
        <div className="p-4 sm:p-6 overflow-y-auto grow space-y-5 bg-slate-950">
          
          {/* 👷 TECHNICIAN STEPPER WORKFLOW */}
          {viewMode === 'TECHNICIAN' && (
            <div>
              {/* STEP 1: ASSESSMENT & AR BODY PANELS */}
              {currentPhase === 'ASSESSMENT' && (
                <TechnicianInspectionPhase
                  card={card}
                  employees={employees}
                  vendors={vendors}
                  currentRole={currentRole}
                  onProceedToPartsRequest={() => setCurrentPhase('PARTS_REQUEST')}
                  onOpenStandardJobs={() => setIsStandardCatalogOpen(true)}
                />
              )}

              {/* STEP 2: PARTS REQUEST & STORE ISSUES */}
              {currentPhase === 'PARTS_REQUEST' && (
                <TechnicianPartsRequestPhase
                  card={card}
                  onOpenRequisitionModal={() => setIsReqModalOpen(true)}
                  onProceedToRepair={() => setCurrentPhase('REPAIR')}
                  onBackToAssessment={() => setCurrentPhase('ASSESSMENT')}
                />
              )}

              {/* STEP 3: REPAIR ACTION HUB & TASK EXECUTION */}
              {currentPhase === 'REPAIR' && (
                <TechnicianRepairWorkPhase
                  card={card}
                  employees={employees}
                  vendors={vendors}
                  currentRole={currentRole}
                  onRequestParts={() => setIsReqModalOpen(true)}
                  onAddNewTask={() => setShowAddTask(true)}
                  onOpenStandardCatalog={() => setIsStandardCatalogOpen(true)}
                  onProceedToQC={() => setCurrentPhase('QC')}
                  onBackToPartsRequest={() => setCurrentPhase('PARTS_REQUEST')}
                />
              )}

              {/* STEP 4: QC AUDIT, PROOF & GATE EXIT HANDOVER */}
              {currentPhase === 'QC' && (
                <TechnicianQualityPhase
                  card={card}
                  onOpenQCModal={onOpenQCModal}
                  onOpenGateCheckOut={() => setIsGateCheckOutOpen(true)}
                  onBackToRepair={() => setCurrentPhase('REPAIR')}
                />
              )}
            </div>
          )}

          {/* 👔 MANAGER SUITE TABS (Detailed Invoices, AI Estimators, Requisitions, Sublet Vendors) */}
          {viewMode === 'MANAGER' && (
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
                  <p className="text-[11px] text-amber-400 font-semibold">Status: {card.status}</p>
                </div>

                <div>
                  <span className="text-slate-400 font-medium">Task Progress:</span>
                  <p className="font-bold text-white">{completedCount}/{card.tasks.length} Completed ({progressPct}%)</p>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1 overflow-hidden">
                    <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 font-medium">Est. Total Bill:</span>
                  <p className="font-extrabold text-sm text-emerald-400">₹{grandTotal.toLocaleString('en-IN')}</p>
                  <p className="text-[11px] text-slate-400">Advance: ₹{(card.advancePaid || 0).toLocaleString('en-IN')}</p>
                </div>
              </div>

              {/* Priority & AI Estimator Strip */}
              <div className="px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      updateJobCard(card.id, (prev) => ({ ...prev, isUrgent: !prev.isUrgent }));
                    }}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all border ${
                      card.isUrgent
                        ? 'bg-rose-500 text-white border-rose-400 shadow-xs'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-amber-500/50 hover:text-white'
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5 fill-current" />
                    <span>{card.isUrgent ? '🔥 MARKED URGENT' : 'Mark Urgent'}</span>
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
                    onClick={() => setIsReqModalOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-amber-300 border border-amber-500/30 font-bold text-xs flex items-center gap-1.5"
                  >
                    <PackageCheck className="w-3.5 h-3.5" />
                    <span>+ Requisition</span>
                  </button>
                </div>
              </div>

              {/* Manager Tab Switcher */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-1 overflow-x-auto">
                {[
                  { id: 'tasks', label: `Task Allotments (${card.tasks.length})`, icon: Wrench },
                  { id: 'consumption', label: `Part Consumption (${consumedItemsList.length})`, icon: PackageCheck },
                  { id: 'approvals', label: `Customer Approvals (${card.tasks.filter(t => t.requiresCustomerApproval).length})`, icon: AlertCircle },
                  { id: 'qc', label: `QC Inspection (${card.qcPassed ? 'PASSED' : 'PENDING'})`, icon: ShieldCheck },
                  { id: 'delivery', label: 'Pick & Delivery', icon: Truck },
                  { id: 'invoice', label: 'GST Bill & Invoice', icon: FileText },
                ].map((tab) => {
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
              {activeManagerTab === 'tasks' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-sm text-white">Department Task Allotments</h4>
                      <p className="text-xs text-slate-400">Manage labor contractor payouts and assigned mechanics</p>
                    </div>
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
                          <p className="text-xs text-slate-400">Price: ₹{task.customerPrice.toLocaleString('en-IN')}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => respondToCustomerApproval(card.id, task.id, true)}
                            className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => respondToCustomerApproval(card.id, task.id, false, 'Declined')}
                            className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold"
                          >
                            Decline
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

            </div>
          )}

        </div>

      </div>

      {/* Add Custom Task Modal */}
      {showAddTask && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-slate-900 text-white rounded-3xl border border-slate-800 w-full max-w-lg p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h4 className="font-black text-base text-white flex items-center gap-2">
                <span>➕</span>
                <span>नया काम जोड़ें (Add Extra Work)</span>
              </h4>
              <button onClick={() => setShowAddTask(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewTask} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  काम का नाम (Task Title) *
                </label>
                <input
                  type="text"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="उदा. अगला शॉकअप बदलना, ब्रेक ऑयल टॉप-अप..."
                  className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 font-bold text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    विभाग (Category)
                  </label>
                  <select
                    value={newTaskCategory}
                    onChange={(e) => setNewTaskCategory(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 font-bold text-white"
                  >
                    <option value="MECHANICAL">🔧 MECHANICAL</option>
                    <option value="DENTING">🔨 DENTING</option>
                    <option value="PAINT">🎨 PAINT</option>
                    <option value="WASHING">🧼 WASHING</option>
                    <option value="SUBLET_VENDOR">🏭 SUBLET VENDOR</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    किसे सौंपें (Assign To)
                  </label>
                  <select
                    value={newTaskAssignedId}
                    onChange={(e) => setNewTaskAssignedId(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 font-bold text-white"
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

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddTask(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold"
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
                </label>

                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={gateExitPhotoUrl}
                    onChange={(e) => setGateExitPhotoUrl(e.target.value)}
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
