import React, { useState, useMemo } from 'react';
import { JobCard, JobTask, Employee, Vendor, UserRole } from '../../types';
import { VEHICLE_PANELS, PanelDefinition } from '../InteractiveVehicleInspectionChart';
import { 
  Hammer, 
  Paintbrush, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  RotateCcw, 
  Plus, 
  Trash2, 
  Volume2, 
  VolumeX, 
  Layers, 
  ChevronRight,
  ShieldCheck,
  Check,
  Wrench,
  Clock,
  Car,
  PackagePlus,
  Zap,
  Tag
} from 'lucide-react';
import { speakTechnicianPrompt, stopTechnicianSpeech } from '../../lib/technicianVoiceHelper';
import { updateJobCard, addRequisitionToTask, dispatchToastNotification, getStandardJobs } from '../../lib/storage';
import { mapPanelToStandardJob, getPanelEnvironmentRates } from '../../lib/panelMappingHelper';

export type BodyViewFilter = 'ALL_ASSIGNED' | 'DENTER' | 'PAINTER' | 'INSPECTION';

export interface PanelWorkAnalysis {
  panel: PanelDefinition;
  matchedTasks: JobTask[];
  dentingTasks: JobTask[];
  paintingTasks: JobTask[];
  otherTasks: JobTask[];
  hasDenting: boolean;
  hasPainting: boolean;
  isDentingComplete: boolean;
  isPaintingComplete: boolean;
  isAllComplete: boolean;
  assignedDenterName?: string;
  assignedPainterName?: string;
}

interface TechnicianBodyPanelAssessmentChartProps {
  card: JobCard;
  employees?: Employee[];
  vendors?: Vendor[];
  currentRole?: UserRole;
}

export function getPanelWorkAnalysis(panel: PanelDefinition, card: JobCard): PanelWorkAnalysis {
  const pNameEn = panel.nameEn.toLowerCase();
  const pCode = panel.code.toLowerCase();
  const pId = panel.id.toLowerCase();
  
  const matchedTasks = card.tasks.filter(t => {
    // 0. Direct explicit panel key linkage check
    if (t.panelKey && t.panelKey.toLowerCase() === pId) {
      return true;
    }

    const tTitle = t.title.toLowerCase();
    const tStd = t.standardJobId || '';
    
    if (tStd && (tStd === panel.standardJobId || tStd === panel.cars24StandardJobId)) {
      return true;
    }
    
    // Panel specific keyword matches
    if (pId === 'hood_bonnet' && (tTitle.includes('bonnet') || tTitle.includes('hood') || tTitle.includes('बोनट') || tTitle.includes('हुड'))) return true;
    if (pId === 'bumper_front' && (tTitle.includes('front bumper') || (tTitle.includes('bumper') && tTitle.includes('front')) || tTitle.includes('आगे का बंपर'))) return true;
    if (pId === 'bumper_rear' && (tTitle.includes('rear bumper') || (tTitle.includes('bumper') && tTitle.includes('rear')) || tTitle.includes('पीछे का बंपर'))) return true;
    if (pId === 'fender_lhs' && (tTitle.includes('fender') && (tTitle.includes('lhs') || tTitle.includes('left') || tTitle.includes('बायां')))) return true;
    if (pId === 'fender_rhs' && (tTitle.includes('fender') && (tTitle.includes('rhs') || tTitle.includes('right') || tTitle.includes('दायां')))) return true;
    if (pId === 'door_lhs_front' && ((tTitle.includes('door') || tTitle.includes('दरवाजा')) && (tTitle.includes('left front') || tTitle.includes('lhs front') || tTitle.includes('बायां अगला')))) return true;
    if (pId === 'door_lhs_rear' && ((tTitle.includes('door') || tTitle.includes('दरवाजा')) && (tTitle.includes('left rear') || tTitle.includes('lhs rear') || tTitle.includes('बायां पिछला')))) return true;
    if (pId === 'door_rhs_front' && ((tTitle.includes('door') || tTitle.includes('दरवाजा')) && (tTitle.includes('right front') || tTitle.includes('rhs front') || tTitle.includes('दायां अगला')))) return true;
    if (pId === 'door_rhs_rear' && ((tTitle.includes('door') || tTitle.includes('दरवाजा')) && (tTitle.includes('right rear') || tTitle.includes('rhs rear') || tTitle.includes('दायां पिछला')))) return true;
    if (pId === 'running_board_lhs' && (tTitle.includes('running board') && (tTitle.includes('lhs') || tTitle.includes('left') || tTitle.includes('बायां') || tTitle.includes('सिल')))) return true;
    if (pId === 'running_board_rhs' && (tTitle.includes('running board') && (tTitle.includes('rhs') || tTitle.includes('right') || tTitle.includes('दायां')))) return true;
    if (pId === 'quarter_panel_lhs' && (tTitle.includes('quarter') && (tTitle.includes('lhs') || tTitle.includes('left') || tTitle.includes('बायां')))) return true;
    if (pId === 'quarter_panel_rhs' && (tTitle.includes('quarter') && (tTitle.includes('rhs') || tTitle.includes('right') || tTitle.includes('दायां')))) return true;
    if (pId === 'roof' && (tTitle.includes('roof') || tTitle.includes('छत') || tTitle.includes('रूफ'))) return true;
    if (pId === 'boot_trunk' && (tTitle.includes('boot') || tTitle.includes('trunk') || tTitle.includes('tailgate') || tTitle.includes('डिक्की') || tTitle.includes('बूट'))) return true;
    if (pId === 'boot_floor' && (tTitle.includes('floor') || tTitle.includes('underbody') || tTitle.includes('फर्श') || tTitle.includes('अंडरबॉडी'))) return true;
    if (pId === 'windshield_front' && (tTitle.includes('front windshield') || tTitle.includes('front glass') || tTitle.includes('आगे का शीशा'))) return true;
    if (pId === 'windshield_rear' && (tTitle.includes('rear windshield') || tTitle.includes('rear glass') || tTitle.includes('पीछे का शीशा'))) return true;
    
    // Generic fallback match
    return tTitle.includes(pNameEn) || (tTitle.includes(pCode) && pCode.length > 2);
  });

  const dentingTasks = matchedTasks.filter(t => 
    t.category === 'DENTING' || 
    t.title.toLowerCase().includes('dent') || 
    t.title.includes('डेंट') || 
    Boolean(t.denterPayout) ||
    t.assignedToName?.toLowerCase().includes('denter')
  );

  const paintingTasks = matchedTasks.filter(t => 
    t.category === 'PAINT' || 
    t.title.toLowerCase().includes('paint') || 
    t.title.includes('पेंट') || 
    t.title.toLowerCase().includes('coating') || 
    t.title.toLowerCase().includes('touch up') ||
    Boolean(t.painterPayout) ||
    t.assignedToName?.toLowerCase().includes('paint')
  );

  const otherTasks = matchedTasks.filter(t => !dentingTasks.includes(t) && !paintingTasks.includes(t));

  const hasDenting = dentingTasks.length > 0;
  const hasPainting = paintingTasks.length > 0;
  
  const isDentingComplete = hasDenting && dentingTasks.every(t => t.status === 'COMPLETED');
  const isPaintingComplete = hasPainting && paintingTasks.every(t => t.status === 'COMPLETED');
  const isAllComplete = matchedTasks.length > 0 && matchedTasks.every(t => t.status === 'COMPLETED');

  const assignedDenterName = dentingTasks[0]?.assignedToName || (card.tasks.find(t => t.category === 'DENTING')?.assignedToName);
  const assignedPainterName = paintingTasks[0]?.assignedToName || (card.tasks.find(t => t.category === 'PAINT')?.assignedToName);

  return {
    panel,
    matchedTasks,
    dentingTasks,
    paintingTasks,
    otherTasks,
    hasDenting,
    hasPainting,
    isDentingComplete,
    isPaintingComplete,
    isAllComplete,
    assignedDenterName,
    assignedPainterName
  };
}

export function TechnicianBodyPanelAssessmentChart({
  card,
  employees = [],
  vendors = [],
  currentRole = 'FLOOR_MANAGER'
}: TechnicianBodyPanelAssessmentChartProps) {
  // Determine default filter based on active role
  const defaultFilter: BodyViewFilter = useMemo(() => {
    if (currentRole === 'DENTER') return 'DENTER';
    if (currentRole === 'PAINTER') return 'PAINTER';
    return 'ALL_ASSIGNED';
  }, [currentRole]);

  const [viewFilter, setViewFilter] = useState<BodyViewFilter>(defaultFilter);
  const [selectedPanel, setSelectedPanel] = useState<PanelDefinition | null>(VEHICLE_PANELS[1]); // default Bonnet/Hood
  const [hoveredPanel, setHoveredPanel] = useState<PanelDefinition | null>(null);
  const [speakingPanelId, setSpeakingPanelId] = useState<string | null>(null);
  const [customNoteText, setCustomNoteText] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<'MINOR_DENT' | 'DEEP_DENT' | 'SCRATCH' | 'TEAR_CRACK'>('MINOR_DENT');

  // Pre-calculate panel analyses
  const panelAnalyses = useMemo(() => {
    const map: Record<string, PanelWorkAnalysis> = {};
    VEHICLE_PANELS.forEach(p => {
      map[p.id] = getPanelWorkAnalysis(p, card);
    });
    return map;
  }, [card]);

  // Counts for summary badges
  const denterPanelsCount = useMemo(() => {
    return VEHICLE_PANELS.filter(p => panelAnalyses[p.id]?.hasDenting).length;
  }, [panelAnalyses]);

  const painterPanelsCount = useMemo(() => {
    return VEHICLE_PANELS.filter(p => panelAnalyses[p.id]?.hasPainting).length;
  }, [panelAnalyses]);

  const totalAssignedPanelsCount = useMemo(() => {
    return VEHICLE_PANELS.filter(p => panelAnalyses[p.id]?.matchedTasks.length > 0).length;
  }, [panelAnalyses]);

  // Active panel analysis
  const activeAnalysis = selectedPanel ? panelAnalyses[selectedPanel.id] : null;

  // Log / add a new task for the selected panel
  const handleLogRepairTask = (
    panel: PanelDefinition,
    taskType: 'DENTING' | 'PAINT' | 'BOTH' | 'PART_REQUISITION'
  ) => {
    const availableDenter = employees.find(e => e.role === 'DENTER' || e.specializedTeam === 'Denting');
    const availablePainter = employees.find(e => e.role === 'PAINTER' || e.specializedTeam === 'Paint');

    const standardJobs = getStandardJobs();
    const envRates = getPanelEnvironmentRates(panel, standardJobs, card.isCars24);
    const activeStdJob = envRates.standardJob;
    const stdJobId = activeStdJob?.id || panel.standardJobId;

    const tasksToAdd: JobTask[] = [];

    if (taskType === 'DENTING' || taskType === 'BOTH') {
      const dentPrice = Math.round(envRates.price * 0.35);
      const dentCost = Math.round(dentPrice * 0.6);
      tasksToAdd.push({
        id: `task-dent-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        jobCardId: card.id,
        title: `${panel.nameHi} - डेंटिंग रिपेयर (${panel.nameEn} Dent Pulling)`,
        category: 'DENTING',
        panelKey: panel.id,
        assignedToId: availableDenter?.id || 'emp-104',
        assignedToName: availableDenter?.name || 'David O\'Connor (Denter)',
        assignedType: 'EMPLOYEE',
        estimatedCost: dentCost,
        customerPrice: dentPrice,
        status: 'PENDING',
        requiresCustomerApproval: false,
        isCustomerApproved: true,
        notes: customNoteText || `Assessment step inspection request for ${panel.nameEn}`,
        standardJobId: stdJobId,
        denterPayout: envRates.denterPayout
      });
    }

    if (taskType === 'PAINT' || taskType === 'BOTH') {
      const paintPrice = envRates.price;
      const paintCost = Math.round(paintPrice * 0.6);
      tasksToAdd.push({
        id: `task-paint-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        jobCardId: card.id,
        title: `${panel.nameHi} - पेंटिंग व क्लियर कोट (${panel.nameEn} 2K Paint)`,
        category: 'PAINT',
        panelKey: panel.id,
        assignedToId: availablePainter?.id || 'emp-105',
        assignedToName: availablePainter?.name || 'Kenji Sato (Painter)',
        assignedType: 'EMPLOYEE',
        estimatedCost: paintCost,
        customerPrice: paintPrice,
        status: 'PENDING',
        requiresCustomerApproval: false,
        isCustomerApproved: true,
        notes: customNoteText || `Assessment step inspection request for ${panel.nameEn}`,
        standardJobId: stdJobId,
        painterPayout: envRates.painterPayout
      });
    }

    if (tasksToAdd.length > 0) {
      updateJobCard(card.id, (c) => ({
        ...c,
        tasks: [...c.tasks, ...tasksToAdd]
      }));

      dispatchToastNotification({
        type: 'SUCCESS',
        title: `✅ काम दर्ज हुआ (${panel.nameEn})`,
        message: `${tasksToAdd.length} नया रिपेयर कार्य ${card.vehicle.registrationNumber} के लिए सफलतापूर्वक जोड़ा गया। (${card.isCars24 ? 'Cars24 Rate' : 'Retail Rate'}: ₹${envRates.price.toLocaleString('en-IN')})`,
        vehicleReg: card.vehicle.registrationNumber,
        jobCardId: card.id
      });
    }

    if (taskType === 'PART_REQUISITION') {
      const targetTaskId = card.tasks[0]?.id || `task-gen-${card.id}`;
      addRequisitionToTask(card.id, targetTaskId, {
        requestedByEmployeeId: 'TECH-1',
        requestedByEmployeeName: 'Assigned Technician',
        title: `${panel.nameEn} Body Replacement Part`,
        partNumber: panel.code,
        itemType: 'PART',
        quantity: 1,
        suggestedPrice: Math.round(envRates.price * 1.5),
        urgency: 'HIGH',
        reason: `Severe body damage found on ${panel.nameEn} during visual inspection.`
      });

      dispatchToastNotification({
        type: 'SUCCESS',
        title: `📦 स्टोर रिक्विजिशन दर्ज (${panel.code})`,
        message: `${panel.nameEn} के लिए स्टोर से नए पार्ट की मांग दर्ज की गई।`,
        vehicleReg: card.vehicle.registrationNumber,
        jobCardId: card.id
      });
    }

    setCustomNoteText('');
  };

  // Toggle task status from panel inspector
  const handleToggleTaskStatus = (taskId: string, currentStatus: JobTask['status']) => {
    const nextStatus = currentStatus === 'PENDING' ? 'IN_PROGRESS' : currentStatus === 'IN_PROGRESS' ? 'COMPLETED' : 'PENDING';
    updateJobCard(card.id, (c) => ({
      ...c,
      tasks: c.tasks.map(t => t.id === taskId ? { ...t, status: nextStatus, completedAt: nextStatus === 'COMPLETED' ? new Date().toLocaleTimeString() : undefined } : t)
    }));
  };

  // Bilingual Hindi/English voice readout for panel status
  const handleVoiceSpeakPanel = (panel: PanelDefinition) => {
    if (speakingPanelId === panel.id) {
      stopTechnicianSpeech();
      setSpeakingPanelId(null);
      return;
    }

    const analysis = panelAnalyses[panel.id];
    let speech = `${panel.nameHi}. `;
    
    if (analysis) {
      if (analysis.hasDenting && analysis.hasPainting) {
        speech += `इस पैनल पर डेंटिंग और पेंटिंग दोनों काम दर्ज हैं. डेंटर ${analysis.assignedDenterName || 'असाइन'} और पेंटर ${analysis.assignedPainterName || 'असाइन'} इस पर काम करेंगे. `;
      } else if (analysis.hasDenting) {
        speech += `इस पैनल पर केवल डेंटिंग का काम दर्ज है, जो ${analysis.assignedDenterName || 'डेंटर'} को सौंपा गया है. पेंटिंग शामिल नहीं है. `;
      } else if (analysis.hasPainting) {
        speech += `इस पैनल पर केवल पेंटिंग का काम दर्ज है, जो ${analysis.assignedPainterName || 'पेंटर'} को सौंपा गया है. डेंटिंग शामिल नहीं है. `;
      } else {
        speech += `इस पैनल पर फिलहाल कोई डेंटिंग या पेंटिंग का काम दर्ज नहीं है. नया काम जोड़ने के लिए नीचे दिए गए बटन पर क्लिक करें. `;
      }

      if (analysis.isAllComplete) {
        speech += `यह पैनल पूरी तरह से तैयार और पूरा हो चुका है. `;
      }
    }

    setSpeakingPanelId(panel.id);
    speakTechnicianPrompt(speech, () => {
      setSpeakingPanelId(null);
    });
  };

  return (
    <div className="bg-slate-900 text-white rounded-3xl border border-slate-800 overflow-hidden shadow-2xl flex flex-col">
      
      {/* 1. Header with Role Filter Tabs & Summary Counters */}
      <div className="p-4 sm:p-5 bg-slate-950/90 border-b border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-black">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base text-white flex items-center gap-2">
                <span>🚗 कार बॉडी पैनल चार्ट (Interactive Body Inspection)</span>
                {card.isCars24 && (
                  <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/40 text-[10px] font-black uppercase">
                    Cars24 Rates
                  </span>
                )}
              </h3>
              <p className="text-xs text-amber-300/90 mt-0.5">
                👇 <strong>गाड़ी के स्केच पर किसी भी पैनल को टच करें</strong> — डेंटिंग व पेंटिंग की स्थिति देखें व तुरंत नया काम जोड़ें।
              </p>
            </div>
          </div>
        </div>

        {/* View Mode Filters (Denter vs Painter vs All Assigned) */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-700/80 rounded-2xl w-full md:w-auto overflow-x-auto">
          
          <button
            type="button"
            onClick={() => setViewFilter('DENTER')}
            className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 whitespace-nowrap transition-all ${
              viewFilter === 'DENTER'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/40 ring-2 ring-red-400'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Hammer className="w-3.5 h-3.5" />
            <span>🔨 Denter View (डेंटर पैनल)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              viewFilter === 'DENTER' ? 'bg-red-800 text-white' : 'bg-slate-800 text-red-400'
            }`}>
              {denterPanelsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setViewFilter('PAINTER')}
            className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 whitespace-nowrap transition-all ${
              viewFilter === 'PAINTER'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/40 ring-2 ring-red-400'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Paintbrush className="w-3.5 h-3.5" />
            <span>🎨 Painter View (पेंटर पैनल)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              viewFilter === 'PAINTER' ? 'bg-red-800 text-white' : 'bg-slate-800 text-red-400'
            }`}>
              {painterPanelsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setViewFilter('ALL_ASSIGNED')}
            className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 whitespace-nowrap transition-all ${
              viewFilter === 'ALL_ASSIGNED'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>✨ All Work (कुल काम: {totalAssignedPanelsCount})</span>
          </button>

        </div>
      </div>

      {/* Role Notice Banner */}
      {viewFilter === 'DENTER' && (
        <div className="bg-red-950/60 border-b border-red-800/60 px-4 py-2.5 flex items-center justify-between text-xs text-red-200">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping inline-block" />
            <strong className="text-white font-extrabold">🔨 डेंटर व्यू मोड सक्रिय (Denter Active View):</strong>
            <span>इस गाड़ी में डेंटिंग के लिए सौंपे गए सभी पैनल <strong>लाल (RED)</strong> रंग में चमक रहे हैं।</span>
          </div>
          <span className="font-mono font-bold bg-red-500/20 px-2 py-0.5 rounded text-red-300 border border-red-500/30">
            {denterPanelsCount} पैनल डेंटिंग के लिए तय हैं
          </span>
        </div>
      )}

      {viewFilter === 'PAINTER' && (
        <div className="bg-red-950/60 border-b border-red-800/60 px-4 py-2.5 flex items-center justify-between text-xs text-red-200">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping inline-block" />
            <strong className="text-white font-extrabold">🎨 पेंटर व्यू मोड सक्रिय (Painter Active View):</strong>
            <span>इस गाड़ी में पेंटिंग और क्लियर कोट के लिए सौंपे गए सभी पैनल <strong>लाल (RED)</strong> रंग में चमक रहे हैं।</span>
          </div>
          <span className="font-mono font-bold bg-red-500/20 px-2 py-0.5 rounded text-red-300 border border-red-500/30">
            {painterPanelsCount} पैनल पेंटिंग के लिए तय हैं
          </span>
        </div>
      )}

      {/* 2. Main Work Area: SVG Chart on Left, Detail & Action Card on Right */}
      <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* SVG Vehicle Blueprint Sketch */}
        <div className="lg:col-span-6 xl:col-span-7 flex flex-col items-center justify-center bg-slate-950/70 rounded-3xl p-4 sm:p-6 border border-slate-800/80 relative">
          
          {/* Orientation Directions */}
          <div className="w-full flex items-center justify-between text-xs text-slate-400 mb-2 px-2">
            <span className="flex items-center gap-1 font-bold text-amber-400/90">
              <span>⬆️ आगे (FRONT / BONNET)</span>
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              (LHS बायां • RHS दायां)
            </span>
            <span className="flex items-center gap-1 font-bold text-amber-400/90">
              <span>⬇️ पीछे (REAR / BOOT)</span>
            </span>
          </div>

          {/* SVG Vehicle Canvas */}
          <div className="w-full max-w-[380px] sm:max-w-[440px] aspect-[440/440] relative flex items-center justify-center">
            <svg
              viewBox="0 0 440 440"
              className="w-full h-full drop-shadow-2xl select-none"
            >
              <defs>
                {/* Red Glow for Denter/Painter Active Panels */}
                <filter id="redGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#ef4444" floodOpacity="0.9" />
                </filter>

                {/* Amber Glow for Dual Dent & Paint Panels */}
                <filter id="amberGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#f59e0b" floodOpacity="0.9" />
                </filter>

                {/* Blue Glow for Paint Only Panels */}
                <filter id="blueGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#3b82f6" floodOpacity="0.9" />
                </filter>

                {/* Selected Cursor Glow */}
                <filter id="activeCursorGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#facc15" floodOpacity="1" />
                </filter>

                {/* Green Done Glow */}
                <filter id="greenGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#10b981" floodOpacity="0.9" />
                </filter>
              </defs>

              {/* Chassis Underbody Outline */}
              <path
                d="M 125 45 C 125 20, 315 20, 315 45 L 325 110 C 330 140, 330 290, 325 330 L 315 395 C 315 415, 125 415, 125 395 L 115 330 C 110 290, 110 140, 115 110 Z"
                fill="#090d16"
                stroke="#334155"
                strokeWidth="2.5"
                strokeDasharray="4 2"
              />

              {/* 4 Tires */}
              <rect x="94" y="65" width="24" height="60" rx="8" fill="#1e293b" stroke="#475569" strokeWidth="2" />
              <rect x="322" y="65" width="24" height="60" rx="8" fill="#1e293b" stroke="#475569" strokeWidth="2" />
              <rect x="94" y="295" width="24" height="60" rx="8" fill="#1e293b" stroke="#475569" strokeWidth="2" />
              <rect x="322" y="295" width="24" height="60" rx="8" fill="#1e293b" stroke="#475569" strokeWidth="2" />

              {/* Side Mirrors */}
              <path d="M 120 135 C 100 135, 100 150, 120 150 Z" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
              <path d="M 320 135 C 340 135, 340 150, 320 150 Z" fill="#334155" stroke="#64748b" strokeWidth="1.5" />

              {/* Headlights (Yellow Accents) */}
              <path d="M 142 32 C 150 25, 165 25, 175 34 L 165 48 C 155 45, 145 42, 142 32 Z" fill="#fbbf24" opacity="0.8" />
              <path d="M 298 32 C 290 25, 275 25, 265 34 L 275 48 C 285 45, 295 42, 298 32 Z" fill="#fbbf24" opacity="0.8" />

              {/* Tail-lights (Red Accents) */}
              <path d="M 142 390 C 150 396, 165 396, 175 390 L 168 378 C 158 382, 148 384, 142 390 Z" fill="#ef4444" opacity="0.8" />
              <path d="M 298 390 C 290 396, 275 396, 265 390 L 272 378 C 282 382, 292 384, 298 390 Z" fill="#ef4444" opacity="0.8" />

              {/* 18 Interactive Vehicle Body Panels */}
              {VEHICLE_PANELS.map((panel) => {
                const analysis = panelAnalyses[panel.id];
                const isSelected = selectedPanel?.id === panel.id;
                const isHovered = hoveredPanel?.id === panel.id;

                // Color calculation based on active view mode
                let fillColor = '#1e293b'; // neutral dark slate
                let strokeColor = '#475569';
                let strokeWidth = '1.8';
                let filter: string | undefined = undefined;
                let opacity = '1';
                let badgeIcon: string | null = null;
                let badgeText = panel.code;

                if (viewFilter === 'DENTER') {
                  if (analysis?.hasDenting) {
                    fillColor = '#dc2626'; // RED
                    strokeColor = '#fecaca';
                    strokeWidth = '2.5';
                    filter = 'url(#redGlow)';
                    badgeIcon = '🔨';
                    badgeText = `🔨 ${panel.code}`;
                  } else {
                    opacity = '0.55';
                  }
                } else if (viewFilter === 'PAINTER') {
                  if (analysis?.hasPainting) {
                    fillColor = '#dc2626'; // RED (as specifically requested for painter)
                    strokeColor = '#fecaca';
                    strokeWidth = '2.5';
                    filter = 'url(#redGlow)';
                    badgeIcon = '🎨';
                    badgeText = `🎨 ${panel.code}`;
                  } else {
                    opacity = '0.55';
                  }
                } else {
                  // ALL_ASSIGNED
                  if (analysis?.isAllComplete) {
                    fillColor = '#059669'; // Emerald Done
                    strokeColor = '#6ee7b7';
                    strokeWidth = '2.2';
                    filter = 'url(#greenGlow)';
                    badgeText = `✓ ${panel.code}`;
                  } else if (analysis?.hasDenting && analysis?.hasPainting) {
                    fillColor = '#ea580c'; // Vibrant Orange/Crimson
                    strokeColor = '#fed7aa';
                    strokeWidth = '2.5';
                    filter = 'url(#amberGlow)';
                    badgeText = `🔨🎨 ${panel.code}`;
                  } else if (analysis?.hasDenting) {
                    fillColor = '#dc2626'; // Red
                    strokeColor = '#fca5a5';
                    strokeWidth = '2.2';
                    filter = 'url(#redGlow)';
                    badgeText = `🔨 ${panel.code}`;
                  } else if (analysis?.hasPainting) {
                    fillColor = '#2563eb'; // Cobalt Blue
                    strokeColor = '#93c5fd';
                    strokeWidth = '2.2';
                    filter = 'url(#blueGlow)';
                    badgeText = `🎨 ${panel.code}`;
                  }
                }

                // Selected Focus Outline
                if (isSelected) {
                  strokeColor = '#facc15'; // Glowing bright yellow cursor
                  strokeWidth = '3.5';
                  filter = 'url(#activeCursorGlow)';
                  opacity = '1';
                } else if (isHovered) {
                  strokeColor = '#38bdf8';
                  strokeWidth = '2.8';
                }

                // Glass Panels styling
                if (panel.id.includes('windshield')) {
                  if (!analysis?.hasDenting && !analysis?.hasPainting) {
                    fillColor = '#0f172a';
                    strokeColor = '#334155';
                  }
                }

                return (
                  <g
                    key={panel.id}
                    className="cursor-pointer transition-all duration-150"
                    opacity={opacity}
                    onMouseEnter={() => setHoveredPanel(panel)}
                    onMouseLeave={() => setHoveredPanel(null)}
                    onClick={() => setSelectedPanel(panel)}
                  >
                    {panel.svgShape.type === 'path' && (
                      <path
                        d={panel.svgShape.d}
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        filter={filter}
                        className="transition-colors duration-150"
                      />
                    )}

                    {panel.svgShape.type === 'rect' && (
                      <rect
                        x={panel.svgShape.x}
                        y={panel.svgShape.y}
                        width={panel.svgShape.width}
                        height={panel.svgShape.height}
                        rx={panel.svgShape.rx || 4}
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        filter={filter}
                        className="transition-colors duration-150"
                      />
                    )}

                    {/* Text Label on Panel */}
                    <text
                      x={panel.labelPos.x}
                      y={panel.labelPos.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={
                        (viewFilter === 'DENTER' && analysis?.hasDenting) ||
                        (viewFilter === 'PAINTER' && analysis?.hasPainting) ||
                        (analysis?.matchedTasks.length && analysis?.matchedTasks.length > 0)
                          ? '#ffffff'
                          : '#cbd5e1'
                      }
                      fontSize={panel.id === 'roof' ? '11' : '8.5'}
                      fontWeight="900"
                      fontFamily="system-ui, -apple-system, sans-serif"
                      className="pointer-events-none select-none"
                    >
                      {badgeText}
                    </text>

                    {/* Active Tick Indicator */}
                    {analysis?.isAllComplete && (
                      <circle
                        cx={panel.labelPos.x + 20}
                        cy={panel.labelPos.y - 10}
                        r="4.5"
                        fill="#10b981"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* SVG Legend */}
          <div className="w-full mt-4 pt-3 border-t border-slate-800 flex items-center justify-around text-xs flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-red-600 border border-red-400 inline-block shadow-sm" />
              <span className="text-red-300 font-bold">
                {viewFilter === 'DENTER' ? '🔨 डेंटिंग तय (Denting Red)' : viewFilter === 'PAINTER' ? '🎨 पेंटिंग तय (Painting Red)' : '🔴 डेंटिंग (Denting)'}
              </span>
            </div>
            {viewFilter === 'ALL_ASSIGNED' && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-blue-600 border border-blue-400 inline-block" />
                  <span className="text-blue-300 font-bold">🎨 पेंटिंग (Painting)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-orange-600 border border-orange-400 inline-block" />
                  <span className="text-orange-300 font-bold">🔨🎨 दोनों (Both)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-emerald-600 border border-emerald-400 inline-block" />
                  <span className="text-emerald-300 font-bold">✓ पूरा (Done)</span>
                </div>
              </>
            )}
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-slate-800 border border-slate-600 inline-block" />
              <span className="text-slate-400">साफ / अनअसाइंड (Clean)</span>
            </div>
          </div>

        </div>

        {/* Right Interactive Inspector & Repair Logger Card */}
        <div className="lg:col-span-6 xl:col-span-5 space-y-4">
          
          {selectedPanel ? (
            <div className="p-4 sm:p-5 rounded-3xl bg-slate-800/90 border-2 border-amber-500/40 shadow-xl space-y-4">
              
              {/* Panel Header */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-700">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-black text-[10px] tracking-wider uppercase font-mono">
                      {selectedPanel.code}
                    </span>
                    <span className="text-xs text-slate-400 font-bold">
                      {selectedPanel.view} VIEW
                    </span>
                  </div>
                  <h4 className="font-black text-lg text-white mt-1">
                    {selectedPanel.nameHi}
                  </h4>
                  <p className="text-xs text-slate-300 font-mono">
                    {selectedPanel.nameEn}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleVoiceSpeakPanel(selectedPanel)}
                  className={`px-3 py-2 rounded-2xl border flex items-center gap-1.5 text-xs font-black transition-all ${
                    speakingPanelId === selectedPanel.id
                      ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500 hover:text-slate-950'
                  }`}
                  title="स्थिति बोलकर सुनें"
                >
                  {speakingPanelId === selectedPanel.id ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  <span>{speakingPanelId === selectedPanel.id ? 'रोकें' : '🔊 सुनें'}</span>
                </button>
              </div>

              {/* Work Status Indicators for Denting and Painting */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* Denting Inclusion Card */}
                <div className={`p-3.5 rounded-2xl border transition-all ${
                  activeAnalysis?.hasDenting 
                    ? 'bg-red-950/40 border-red-500/60 shadow-lg shadow-red-950/50' 
                    : 'bg-slate-900/80 border-slate-700/60 opacity-80'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase text-red-400 flex items-center gap-1">
                      <Hammer className="w-3.5 h-3.5" />
                      डेंटिंग (Denting)
                    </span>
                    {activeAnalysis?.hasDenting ? (
                      <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-black">
                        ✓ शामिल है
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-bold">
                        ❌ नहीं है
                      </span>
                    )}
                  </div>

                  {activeAnalysis?.hasDenting ? (
                    <div className="mt-2 space-y-1.5 text-xs">
                      {activeAnalysis.dentingTasks.map(t => (
                        <div key={t.id} className="p-2 rounded-xl bg-slate-900 border border-red-900/60 space-y-1">
                          <p className="font-extrabold text-white text-xs truncate">{t.title}</p>
                          <div className="flex items-center justify-between text-[10px] text-slate-300">
                            <span>👤 {t.assignedToName || 'Assigned Denter'}</span>
                            <span className="font-mono font-bold text-red-300">₹{t.customerPrice}</span>
                          </div>
                          <div className="pt-1 flex items-center justify-between">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black ${
                              t.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                              t.status === 'IN_PROGRESS' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                              'bg-slate-800 text-slate-300'
                            }`}>
                              {t.status}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleTaskStatus(t.id, t.status)}
                              className="text-[10px] font-bold text-amber-400 hover:underline"
                            >
                              स्थिति बदलें ➔
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 mt-2">
                      इस जॉब कार्ड में डेंटिंग शामिल नहीं है।
                    </p>
                  )}
                </div>

                {/* Painting Inclusion Card */}
                <div className={`p-3.5 rounded-2xl border transition-all ${
                  activeAnalysis?.hasPainting 
                    ? 'bg-red-950/40 border-red-500/60 shadow-lg shadow-red-950/50' 
                    : 'bg-slate-900/80 border-slate-700/60 opacity-80'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase text-red-400 flex items-center gap-1">
                      <Paintbrush className="w-3.5 h-3.5" />
                      पेंटिंग (Painting)
                    </span>
                    {activeAnalysis?.hasPainting ? (
                      <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-black">
                        ✓ शामिल है
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-bold">
                        ❌ नहीं है
                      </span>
                    )}
                  </div>

                  {activeAnalysis?.hasPainting ? (
                    <div className="mt-2 space-y-1.5 text-xs">
                      {activeAnalysis.paintingTasks.map(t => (
                        <div key={t.id} className="p-2 rounded-xl bg-slate-900 border border-red-900/60 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-extrabold text-white text-xs truncate">{t.title}</p>
                            {t.paintScope && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/40 shrink-0">
                                {t.paintScope === 'PARTIAL_TOUCHUP' ? '🎨 Partial' :
                                 t.paintScope === 'INSIDE_JAMB' ? '🚪 Inside Jamb' :
                                 t.paintScope === 'FULL_OUTER_AND_INSIDE' ? '🌟 Outer+Inside' : '✨ Full Outer'}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-300">
                            <span>👤 {t.assignedToName || 'Assigned Painter'}</span>
                            <span className="font-mono font-bold text-blue-300">₹{t.customerPrice}</span>
                          </div>
                          <div className="pt-1 flex items-center justify-between">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black ${
                              t.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                              t.status === 'IN_PROGRESS' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40' :
                              'bg-slate-800 text-slate-300'
                            }`}>
                              {t.status}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleTaskStatus(t.id, t.status)}
                              className="text-[10px] font-bold text-amber-400 hover:underline"
                            >
                              स्थिति बदलें ➔
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 mt-2">
                      इस जॉब कार्ड में पेंटिंग शामिल नहीं है।
                    </p>
                  )}
                </div>

              </div>

              {/* 1-Tap Quick Repair Request Logger Actions */}
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-400" />
                    इस पैनल के लिए काम दर्ज करें (Log Repair Request):
                  </span>
                  <span className="text-[10px] text-amber-300 font-mono font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                    Std ({card.isCars24 ? 'Cars24' : 'Retail'}): ₹{(getPanelEnvironmentRates(selectedPanel, getStandardJobs(), card.isCars24).price).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  
                  {/* Log Denting Button */}
                  <button
                    type="button"
                    onClick={() => handleLogRepairTask(selectedPanel, 'DENTING')}
                    className="p-3 rounded-2xl bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/50 font-black text-xs flex flex-col items-start gap-1 transition-all active:scale-95 text-left"
                  >
                    <span className="flex items-center gap-1 font-extrabold text-sm">
                      <Hammer className="w-4 h-4" />
                      + डेंटिंग जोड़ें
                    </span>
                    <span className="text-[10px] text-red-200/80 font-normal">
                      Dent Pulling • ₹{Math.round(getPanelEnvironmentRates(selectedPanel, getStandardJobs(), card.isCars24).price * 0.35).toLocaleString('en-IN')} (Payout ₹{getPanelEnvironmentRates(selectedPanel, getStandardJobs(), card.isCars24).denterPayout})
                    </span>
                  </button>

                  {/* Log Painting Button */}
                  <button
                    type="button"
                    onClick={() => handleLogRepairTask(selectedPanel, 'PAINT')}
                    className="p-3 rounded-2xl bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/50 font-black text-xs flex flex-col items-start gap-1 transition-all active:scale-95 text-left"
                  >
                    <span className="flex items-center gap-1 font-extrabold text-sm">
                      <Paintbrush className="w-4 h-4" />
                      + पेंटिंग जोड़ें
                    </span>
                    <span className="text-[10px] text-blue-200/80 font-normal">
                      2K Paint • ₹{getPanelEnvironmentRates(selectedPanel, getStandardJobs(), card.isCars24).price.toLocaleString('en-IN')} (Payout ₹{getPanelEnvironmentRates(selectedPanel, getStandardJobs(), card.isCars24).painterPayout})
                    </span>
                  </button>

                  {/* Log Both Dent & Paint */}
                  <button
                    type="button"
                    onClick={() => handleLogRepairTask(selectedPanel, 'BOTH')}
                    className="p-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>⚡ डेंटिंग + पेंटिंग दोनों जोड़ें</span>
                  </button>

                  {/* Part Replacement Requisition */}
                  <button
                    type="button"
                    onClick={() => handleLogRepairTask(selectedPanel, 'PART_REQUISITION')}
                    className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-600 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
                  >
                    <PackagePlus className="w-3.5 h-3.5 text-amber-400" />
                    <span>📦 नया पैनल मंगाएं</span>
                  </button>

                </div>

                {/* Optional Custom Inspection Note */}
                <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
                  <input
                    type="text"
                    value={customNoteText}
                    onChange={(e) => setCustomNoteText(e.target.value)}
                    placeholder="कोई विशेष खराबी या विवरण लिखें..."
                    className="grow px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                  />
                  {customNoteText && (
                    <button
                      type="button"
                      onClick={() => handleLogRepairTask(selectedPanel, 'DENTING')}
                      className="px-3 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
                    >
                      सुरक्षित करें
                    </button>
                  )}
                </div>

              </div>

            </div>
          ) : (
            <div className="p-8 rounded-3xl bg-slate-800/40 border border-slate-800 text-center space-y-3">
              <Car className="w-12 h-12 text-slate-600 mx-auto" />
              <h4 className="font-bold text-white text-sm">किसी भी पैनल पर क्लिक करें</h4>
              <p className="text-xs text-slate-400">
                गाड़ी के चित्र में किसी भी हिस्से को छूकर जांचें कि उस पर डेंटिंग या पेंटिंग का काम तय है या नहीं।
              </p>
            </div>
          )}

          {/* Quick Stats Strip */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">कुल डेंटिंग</span>
              <strong className="text-red-400 font-mono text-base">{denterPanelsCount} Panels</strong>
            </div>
            <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">कुल पेंटिंग</span>
              <strong className="text-red-400 font-mono text-base">{painterPanelsCount} Panels</strong>
            </div>
            <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">सभी काम</span>
              <strong className="text-amber-400 font-mono text-base">{totalAssignedPanelsCount} Panels</strong>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
