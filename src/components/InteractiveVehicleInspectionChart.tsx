import React, { useState, useMemo } from 'react';
import { 
  Hammer, 
  Paintbrush, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  RotateCcw, 
  Eye, 
  Plus, 
  Trash2, 
  Volume2, 
  VolumeX, 
  Layers, 
  ChevronRight,
  ShieldCheck,
  Check
} from 'lucide-react';
import { speakTechnicianPrompt, stopTechnicianSpeech } from '../lib/technicianVoiceHelper';
import { StandardJob, PaintScope } from '../types';
import { getStandardJobs } from '../lib/storage';
import { mapPanelToStandardJob, getPanelEnvironmentRates, isPartialPaintAllowedForPanel, formatPaintTaskTitle } from '../lib/panelMappingHelper';
import { Interactive3DVehicleInspectionModel } from './Interactive3DVehicleInspectionModel';

export type DamageSeverity = 'SCRATCH' | 'MINOR_DENT' | 'DEEP_DENT' | 'TEAR_CRACK' | 'REPLACE_REQ';
export type RepairAction = 'PAINT_ONLY' | 'DENT_AND_PAINT' | 'DENT_ONLY' | 'REPLACEMENT';

export function getMatchingStandardJob(panel: PanelDefinition, standardJobs: StandardJob[]): StandardJob | undefined {
  if (!panel) return undefined;
  return mapPanelToStandardJob(panel, standardJobs);
}

export interface PanelInspectionItem {
  panelId: string;
  nameEn: string;
  nameHi: string;
  category: 'EXTERIOR_BODY' | 'GLASS' | 'LIGHTS_BUMPER' | 'UNDERBODY';
  damageType?: DamageSeverity;
  actionRequired?: RepairAction;
  notes?: string;
  photoUrl?: string;
  matchedStandardJobId?: string;
  paintScope?: PaintScope;
  selected?: boolean;
  customPrice?: number;
  customPainterPayout?: number;
  customDenterPayout?: number;
  painterName?: string;
  denterName?: string;
}

export interface InteractiveVehicleInspectionChartProps {
  mode?: 'VIEW' | 'INTERACTIVE_SELECT' | 'INSPECTION_RECORD';
  isCars24?: boolean;
  selectedPanelIds?: string[];
  onPanelToggle?: (panelId: string, matchedJobId?: string, paintScope?: PaintScope) => void;
  inspections?: Record<string, PanelInspectionItem>;
  onInspectionChange?: (inspections: Record<string, PanelInspectionItem>) => void;
  availableStandardJobs?: StandardJob[];
  currentRole?: string;
  vehicleMakeModel?: string;
  compact?: boolean;
}

export interface PanelDefinition {
  id: string;
  code: string;
  nameEn: string;
  nameHi: string;
  standardJobId: string;
  cars24StandardJobId?: string;
  view: 'TOP' | 'FRONT' | 'REAR' | 'LHS' | 'RHS';
  // SVG coordinates for drawing representation
  svgShape: {
    type: 'path' | 'rect' | 'polygon';
    d?: string;
    points?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rx?: number;
  };
  labelPos: { x: number; y: number };
  badgePos?: { x: number; y: number };
  defaultPrice: number;
}

// 18 Comprehensive Body Panels mapped to workshop standards
export const VEHICLE_PANELS: PanelDefinition[] = [
  // Front Area
  {
    id: 'bumper_front',
    code: 'FB',
    nameEn: 'Front Bumper',
    nameHi: 'आगे का बंपर (Front Bumper)',
    standardJobId: 'std-bumper-front-full',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 140 30 C 180 15, 260 15, 300 30 C 310 38, 300 55, 290 55 C 240 45, 200 45, 150 55 C 140 55, 130 38, 140 30 Z'
    },
    labelPos: { x: 220, y: 38 },
    defaultPrice: 1350
  },
  {
    id: 'hood_bonnet',
    code: 'BONNET',
    nameEn: 'Hood / Bonnet',
    nameHi: 'बोनट / हुड (Bonnet)',
    standardJobId: 'std-hood-bonnet-full',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 152 60 C 190 52, 250 52, 288 60 L 280 135 C 240 130, 200 130, 160 135 Z'
    },
    labelPos: { x: 220, y: 95 },
    defaultPrice: 2200
  },
  {
    id: 'fender_lhs',
    code: 'F-LHS',
    nameEn: 'Left Front Fender',
    nameHi: 'बायां अगला फेंडर (Left Front Fender)',
    standardJobId: 'std-fender-lhs-full',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 132 38 L 148 58 L 158 135 L 132 135 C 125 100, 125 70, 132 38 Z'
    },
    labelPos: { x: 140, y: 90 },
    defaultPrice: 750
  },
  {
    id: 'fender_rhs',
    code: 'F-RHS',
    nameEn: 'Right Front Fender',
    nameHi: 'दायां अगला फेंडर (Right Front Fender)',
    standardJobId: 'std-fender-rhs-full',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 308 38 L 292 58 L 282 135 L 308 135 C 315 100, 315 70, 308 38 Z'
    },
    labelPos: { x: 300, y: 90 },
    defaultPrice: 750
  },

  // Windshield & Roof
  {
    id: 'windshield_front',
    code: 'WS-FR',
    nameEn: 'Front Windshield Glass',
    nameHi: 'आगे का शीशा (Front Glass)',
    standardJobId: 'std-glass-front',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 163 140 C 200 136, 240 136, 277 140 L 270 180 C 235 178, 205 178, 170 180 Z'
    },
    labelPos: { x: 220, y: 160 },
    defaultPrice: 0
  },
  {
    id: 'roof',
    code: 'ROOF',
    nameEn: 'Roof Panel',
    nameHi: 'छत (Roof)',
    standardJobId: 'std-roof-full',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 172 185 C 205 182, 235 182, 268 185 L 268 290 C 235 293, 205 293, 172 290 Z'
    },
    labelPos: { x: 220, y: 238 },
    defaultPrice: 2600
  },
  {
    id: 'windshield_rear',
    code: 'WS-RR',
    nameEn: 'Rear Windshield Glass',
    nameHi: 'पीछे का शीशा (Rear Glass)',
    standardJobId: 'std-glass-rear',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 172 295 C 205 298, 235 298, 268 295 L 275 330 C 240 334, 200 334, 165 330 Z'
    },
    labelPos: { x: 220, y: 312 },
    defaultPrice: 0
  },

  // Left Side (LHS) Doors & Panels
  {
    id: 'door_lhs_front',
    code: 'D-L-FR',
    nameEn: 'Door LHS Front',
    nameHi: 'बायां अगला दरवाजा (Left Front Door)',
    standardJobId: 'std-door-lhs-front-full',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 130 140 L 168 140 L 168 210 L 130 210 Z'
    },
    labelPos: { x: 148, y: 175 },
    defaultPrice: 1350
  },
  {
    id: 'door_lhs_rear',
    code: 'D-L-RR',
    nameEn: 'Door LHS Rear',
    nameHi: 'बायां पिछला दरवाजा (Left Rear Door)',
    standardJobId: 'std-door-lhs-rear-full',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 130 215 L 168 215 L 168 285 L 130 285 Z'
    },
    labelPos: { x: 148, y: 250 },
    defaultPrice: 1350
  },
  {
    id: 'running_board_lhs',
    code: 'RB-L',
    nameEn: 'Running Board LHS (Sill)',
    nameHi: 'बायां रनिंग बोर्ड / सिल (Left Running Board)',
    standardJobId: 'std-running-board-lhs-full',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 116 142 L 126 142 L 126 283 L 116 283 Z'
    },
    labelPos: { x: 104, y: 212 },
    defaultPrice: 750
  },
  {
    id: 'quarter_panel_lhs',
    code: 'QP-L',
    nameEn: 'Quarter Panel LHS',
    nameHi: 'बायां क्वार्टर पैनल (Left Quarter Panel)',
    standardJobId: 'std-quarter-panel-lhs-full',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 130 290 L 163 290 L 163 355 L 135 355 C 128 335, 126 310, 130 290 Z'
    },
    labelPos: { x: 146, y: 325 },
    defaultPrice: 1350
  },

  // Right Side (RHS) Doors & Panels
  {
    id: 'door_rhs_front',
    code: 'D-R-FR',
    nameEn: 'Door RHS Front',
    nameHi: 'दायां अगला दरवाजा (Right Front Door)',
    standardJobId: 'std-door-rhs-front-full',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 272 140 L 310 140 L 310 210 L 272 210 Z'
    },
    labelPos: { x: 292, y: 175 },
    defaultPrice: 1350
  },
  {
    id: 'door_rhs_rear',
    code: 'D-R-RR',
    nameEn: 'Door RHS Rear',
    nameHi: 'दायां पिछला दरवाजा (Right Rear Door)',
    standardJobId: 'std-door-rhs-rear-full',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 272 215 L 310 215 L 310 285 L 272 285 Z'
    },
    labelPos: { x: 292, y: 250 },
    defaultPrice: 1350
  },
  {
    id: 'running_board_rhs',
    code: 'RB-R',
    nameEn: 'Running Board RHS (Sill)',
    nameHi: 'दायां रनिंग बोर्ड / सिल (Right Running Board)',
    standardJobId: 'std-running-board-rhs-full',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 314 142 L 324 142 L 324 283 L 314 283 Z'
    },
    labelPos: { x: 336, y: 212 },
    defaultPrice: 750
  },
  {
    id: 'quarter_panel_rhs',
    code: 'QP-R',
    nameEn: 'Quarter Panel RHS',
    nameHi: 'दायां क्वार्टर पैनल (Right Quarter Panel)',
    standardJobId: 'std-quarter-panel-rhs-full',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 277 290 L 310 290 C 314 310, 312 335, 305 355 L 277 355 Z'
    },
    labelPos: { x: 294, y: 325 },
    defaultPrice: 1350
  },

  // Rear Area
  {
    id: 'boot_trunk',
    code: 'DICKY',
    nameEn: 'Dicky Door / Boot Lid (Outer Panel)',
    nameHi: 'डिक्की का दरवाजा / बूट लिड (Dicky Door)',
    standardJobId: 'std-boot-trunk-full',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 166 332 C 200 335, 240 335, 274 332 L 280 358 C 240 361, 200 361, 160 358 Z'
    },
    labelPos: { x: 220, y: 345 },
    defaultPrice: 1350
  },
  {
    id: 'boot_floor',
    code: 'DICKY FLR',
    nameEn: 'Dicky Boot Floor / Underbody (Internal Panel)',
    nameHi: 'डिक्की का फर्श (Dicky Boot Floor)',
    standardJobId: 'std-boot-floor-full',
    view: 'TOP',
    svgShape: {
      type: 'rect',
      x: 172,
      y: 362,
      width: 96,
      height: 18,
      rx: 4
    },
    labelPos: { x: 220, y: 371 },
    defaultPrice: 300
  },
  {
    id: 'bumper_rear',
    code: 'RB',
    nameEn: 'Rear Bumper',
    nameHi: 'पीछे का बंपर (Rear Bumper)',
    standardJobId: 'std-bumper-rear-full',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 140 398 C 180 410, 260 410, 300 398 C 308 393, 312 384, 304 384 C 260 393, 180 393, 136 384 C 128 384, 132 393, 140 398 Z'
    },
    labelPos: { x: 220, y: 397 },
    defaultPrice: 1350
  },

  // Engine Bay Aprons & Underbody (Requested Features)
  {
    id: 'apron_lhs',
    code: 'APRON-L',
    nameEn: 'Apron LHS (Left Engine Bay)',
    nameHi: 'बायां अप्रन (Left Engine Apron)',
    standardJobId: 'std-apron-lhs-full',
    view: 'FRONT',
    svgShape: {
      type: 'rect',
      x: 155,
      y: 65,
      width: 25,
      height: 45,
      rx: 3
    },
    labelPos: { x: 167, y: 87 },
    defaultPrice: 1100
  },
  {
    id: 'apron_rhs',
    code: 'APRON-R',
    nameEn: 'Apron RHS (Right Engine Bay)',
    nameHi: 'दायां अप्रन (Right Engine Apron)',
    standardJobId: 'std-apron-rhs-full',
    view: 'FRONT',
    svgShape: {
      type: 'rect',
      x: 260,
      y: 65,
      width: 25,
      height: 45,
      rx: 3
    },
    labelPos: { x: 272, y: 87 },
    defaultPrice: 1100
  },
  {
    id: 'underbody',
    code: 'UNDERBODY',
    nameEn: 'Underbody Chassis Frame',
    nameHi: 'अंडरबॉडी चेसिस (Underbody Painting)',
    standardJobId: 'std-underbody-full',
    view: 'TOP',
    svgShape: {
      type: 'rect',
      x: 170,
      y: 190,
      width: 100,
      height: 95,
      rx: 6
    },
    labelPos: { x: 220, y: 238 },
    defaultPrice: 1800
  }
];

export function InteractiveVehicleInspectionChart({
  mode = 'INTERACTIVE_SELECT',
  isCars24 = false,
  selectedPanelIds = [],
  onPanelToggle,
  inspections = {},
  onInspectionChange,
  availableStandardJobs = [],
  currentRole = 'FLOOR_MANAGER',
  vehicleMakeModel = 'Vehicle Body',
  compact = false
}: InteractiveVehicleInspectionChartProps) {
  const [activeHoveredPanel, setActiveHoveredPanel] = useState<PanelDefinition | null>(null);
  const [selectedPanelForDetail, setSelectedPanelForDetail] = useState<PanelDefinition | null>(null);
  const [viewAngle, setViewAngle] = useState<'TOP' | 'SIDE_LHS' | 'SIDE_RHS'>('TOP');
  const [speakingPanelId, setSpeakingPanelId] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<'3D_INTERACTIVE' | '2D_SKETCH'>('3D_INTERACTIVE');

  // Local state to track scope overrides or panel clicks locally so the interactive preview updates in real-time
  const [localInspections, setLocalInspections] = useState<Record<string, PanelInspectionItem>>({});

  // Merge inspections prop with local interaction overrides
  const effectiveInspections = useMemo(() => {
    return {
      ...inspections,
      ...localInspections
    };
  }, [inspections, localInspections]);

  // Quick damage type selector for Denter/Painter inspection mode
  const [activeSeverity, setActiveSeverity] = useState<DamageSeverity>('MINOR_DENT');
  const [activeRepairAction, setActiveRepairAction] = useState<RepairAction>('DENT_AND_PAINT');

  // Hindi voice reader for the denter/painter
  const handleVoiceSpeakPanel = (panel: PanelDefinition) => {
    if (speakingPanelId === panel.id) {
      stopTechnicianSpeech();
      setSpeakingPanelId(null);
      return;
    }

    const inspection = effectiveInspections[panel.id];
    let speech = `${panel.nameHi}. `;
    if (inspection?.damageType) {
      const dmgMap: Record<DamageSeverity, string> = {
        SCRATCH: 'हल्का खरोंच या स्क्रैच',
        MINOR_DENT: 'छोटा डेंट',
        DEEP_DENT: 'गहरा या बड़ा डेंट',
        TEAR_CRACK: 'कटा या फटा हुआ हिस्सा',
        REPLACE_REQ: 'पैनल बदलना पड़ेगा'
      };
      speech += `खराबी: ${dmgMap[inspection.damageType]}. `;
    }
    if (selectedPanelIds.includes(panel.id)) {
      speech += 'यह पैनल काम के लिए चुना हुआ है।';
    } else {
      speech += 'चुनने के लिए क्लिक करें।';
    }

    setSpeakingPanelId(panel.id);
    speakTechnicianPrompt(speech, () => {
      setSpeakingPanelId(null);
    });
  };

  const isPanelActive = (panelId: string) => {
    if (mode === 'INTERACTIVE_SELECT') {
      return selectedPanelIds.includes(panelId);
    }
    return selectedPanelIds.includes(panelId) || Boolean(effectiveInspections[panelId]?.selected);
  };

  const handlePanelClick = (panel: PanelDefinition) => {
    setSelectedPanelForDetail(prev => prev?.id === panel.id ? null : panel);

    const wasActive = isPanelActive(panel.id);

    const current = effectiveInspections[panel.id] || {
      panelId: panel.id,
      nameEn: panel.nameEn,
      nameHi: panel.nameHi,
      category: 'EXTERIOR_BODY',
      selected: false
    };

    const updatedObj = {
      ...current,
      selected: !wasActive,
      damageType: !wasActive ? activeSeverity : undefined,
      actionRequired: !wasActive ? activeRepairAction : undefined,
      matchedStandardJobId: panel.standardJobId
    };

    setLocalInspections(prev => ({
      ...prev,
      [panel.id]: updatedObj
    }));

    if (onPanelToggle) {
      onPanelToggle(panel.id, panel.standardJobId);
    }

    if (onInspectionChange) {
      const updated = {
        ...effectiveInspections,
        [panel.id]: updatedObj
      };
      onInspectionChange(updated);
    }
  };

  const effectiveStandardJobs = useMemo(() => {
    return availableStandardJobs.length > 0 ? availableStandardJobs : getStandardJobs();
  }, [availableStandardJobs]);

  const selectedCount = useMemo(() => {
    return VEHICLE_PANELS.filter(p => isPanelActive(p.id)).length;
  }, [selectedPanelIds, effectiveInspections]);

  const estimatedTotalCost = useMemo(() => {
    return VEHICLE_PANELS
      .filter(p => isPanelActive(p.id))
      .reduce((sum, p) => {
        const stdJob = getMatchingStandardJob(p, effectiveStandardJobs);
        if (stdJob) {
          return sum + (isCars24 ? (stdJob.cars24Price ?? stdJob.retailPrice) : stdJob.retailPrice);
        }
        return sum + (isCars24 ? 1350 : (p.defaultPrice || 1350));
      }, 0);
  }, [selectedPanelIds, effectiveInspections, effectiveStandardJobs, isCars24]);

  if (compact) {
    return (
      <div className="w-full bg-slate-950 text-white rounded-2xl border border-slate-800 p-4 sm:p-6 flex flex-col items-center justify-center relative shadow-inner">
        {/* Top Orientation Bar */}
        <div className="w-full max-w-[500px] flex items-center justify-between text-xs text-slate-400 mb-3 px-3 font-mono font-bold">
          <span className="flex items-center gap-1.5 text-amber-400">
            <span>⬆️ FRONT (आगे - BONNET)</span>
          </span>
          <span className="text-[11px] text-slate-500 font-semibold">
            (LHS बायां • RHS दायां)
          </span>
          <span className="flex items-center gap-1.5 text-amber-400">
            <span>⬇️ REAR (पीछे - DICKY)</span>
          </span>
        </div>

        {/* SVG Vehicle Blueprint Sketch - Enlarged for maximum panel clarity */}
        <div className="w-full max-w-[460px] sm:max-w-[520px] aspect-[440/440] relative flex items-center justify-center my-2">
          <svg
            viewBox="0 0 440 440"
            className="w-full h-full drop-shadow-2xl select-none"
          >
            <defs>
              <pattern id="tirePattern" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 0 5 L 10 5 M 5 0 L 5 10" stroke="#334155" strokeWidth="1" />
              </pattern>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>

              {/* Dynamic Gradients for Precise Paint Scopes */}
              {VEHICLE_PANELS.map((p) => {
                const inspection = effectiveInspections[p.id];
                const scope: PaintScope = inspection?.paintScope || 'FULL_OUTER';

                if (scope === 'PARTIAL_TOUCHUP') {
                  // Partial Paint: Left half colored cyan, right half uncolored dark grey
                  return (
                    <linearGradient id={`grad-partial-${p.id}`} x1="0%" y1="0%" x2="100%" y2="0%" key={p.id}>
                      <stop offset="50%" stopColor="#06b6d4" />
                      <stop offset="50%" stopColor="#1e293b" />
                    </linearGradient>
                  );
                }

                if (scope === 'INSIDE_JAMB') {
                  // Inside Jamb Only: Edges/boundaries colored purple, outer center uncolored dark grey
                  return (
                    <linearGradient id={`grad-inside-${p.id}`} x1="0%" y1="0%" x2="100%" y2="0%" key={p.id}>
                      <stop offset="15%" stopColor="#8b5cf6" />
                      <stop offset="15%" stopColor="#1e293b" />
                      <stop offset="85%" stopColor="#1e293b" />
                      <stop offset="85%" stopColor="#8b5cf6" />
                    </linearGradient>
                  );
                }

                return null;
              })}
            </defs>

            {/* Ground Shadow & Car Chassis Underbody Outline */}
            <path
              d="M 125 45 C 125 20, 315 20, 315 45 L 325 110 C 330 140, 330 290, 325 330 L 315 395 C 315 415, 125 415, 125 395 L 115 330 C 110 290, 110 140, 115 110 Z"
              fill="#0f172a"
              stroke="#334155"
              strokeWidth="2.5"
              strokeDasharray="4 2"
            />

            {/* 4 Tires (Wheels) */}
            <rect x="94" y="65" width="24" height="60" rx="8" fill="#1e293b" stroke="#475569" strokeWidth="2" />
            <rect x="322" y="65" width="24" height="60" rx="8" fill="#1e293b" stroke="#475569" strokeWidth="2" />
            <rect x="94" y="295" width="24" height="60" rx="8" fill="#1e293b" stroke="#475569" strokeWidth="2" />
            <rect x="322" y="295" width="24" height="60" rx="8" fill="#1e293b" stroke="#475569" strokeWidth="2" />

            {/* Side Mirrors */}
            <path d="M 120 135 C 100 135, 100 150, 120 150 Z" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
            <path d="M 320 135 C 340 135, 340 150, 320 150 Z" fill="#334155" stroke="#64748b" strokeWidth="1.5" />

            {/* Headlights */}
            <path d="M 142 32 C 150 25, 165 25, 175 34 L 165 48 C 155 45, 145 42, 142 32 Z" fill="#fbbf24" opacity="0.8" />
            <path d="M 298 32 C 290 25, 275 25, 265 34 L 275 48 C 285 45, 295 42, 298 32 Z" fill="#fbbf24" opacity="0.8" />

            {/* Tail-lights */}
            <path d="M 142 390 C 150 396, 165 396, 175 390 L 168 378 C 158 382, 148 384, 142 390 Z" fill="#ef4444" opacity="0.8" />
            <path d="M 298 390 C 290 396, 275 396, 265 390 L 272 378 C 282 382, 292 384, 298 390 Z" fill="#ef4444" opacity="0.8" />

            {/* Interactive Panels */}
            {VEHICLE_PANELS.map((panel) => {
              const isActive = isPanelActive(panel.id);
              const isHovered = activeHoveredPanel?.id === panel.id;

              let fillColor = '#1e293b';
              let strokeColor = '#475569';
              let strokeWidth = '1.8';

              if (isActive) {
                const inspection = effectiveInspections[panel.id];
                const currentScope: PaintScope = inspection?.paintScope || 'FULL_OUTER';

                if (currentScope === 'PARTIAL_TOUCHUP') {
                  fillColor = `url(#grad-partial-${panel.id})`; // dynamic half-colored gradient
                  strokeColor = '#a5f3fc';
                } else if (currentScope === 'INSIDE_JAMB') {
                  fillColor = `url(#grad-inside-${panel.id})`; // dynamic inside-only gradient
                  strokeColor = '#ddd6fe';
                } else if (currentScope === 'FULL_OUTER_AND_INSIDE') {
                  fillColor = '#ec4899'; // vibrant pink for outer + inside
                  strokeColor = '#fbcfe8';
                } else {
                  fillColor = '#f59e0b'; // vibrant amber for standard full outer paint
                  strokeColor = '#fef08a';
                }
                strokeWidth = '2.5';
              } else if (isHovered) {
                fillColor = '#334155';
                strokeColor = '#fbbf24';
                strokeWidth = '2.5';
              }

              if (panel.id.includes('windshield')) {
                fillColor = isActive ? '#38bdf8' : '#0f172a';
                strokeColor = isActive ? '#bae6fd' : '#334155';
              }

              return (
                <g
                  key={panel.id}
                  className="cursor-pointer transition-all duration-200"
                  onMouseEnter={() => setActiveHoveredPanel(panel)}
                  onMouseLeave={() => setActiveHoveredPanel(null)}
                  onClick={() => handlePanelClick(panel)}
                >
                  {panel.svgShape.type === 'path' && (
                    <path
                      d={panel.svgShape.d}
                      fill={fillColor}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      filter={isActive ? 'url(#glow)' : undefined}
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
                      className="transition-colors duration-150"
                    />
                  )}

                  {/* Panel Label Pill on SVG */}
                  <text
                    x={panel.labelPos.x}
                    y={panel.labelPos.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={isActive ? '#020617' : '#e2e8f0'}
                    fontSize={panel.id === 'roof' ? '11' : panel.id === 'boot_trunk' ? '10' : '9'}
                    fontWeight="900"
                    fontFamily="system-ui, -apple-system, sans-serif"
                    className="pointer-events-none select-none"
                  >
                    {isActive ? `✓ ${panel.code}` : panel.code}
                  </text>

                  {/* Active tick badge */}
                  {isActive && (
                    <circle
                      cx={panel.labelPos.x + 22}
                      cy={panel.labelPos.y - 10}
                      r="5"
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

        {/* Minimal Sketch Visual Legend */}
        <div className="w-full max-w-[500px] mt-2 pt-2 border-t border-slate-800 flex items-center justify-center gap-6 text-xs flex-wrap font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-slate-800 border border-slate-600 inline-block" />
            <span className="text-slate-400">Regular Panel</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-amber-500 border border-amber-300 inline-block" />
            <span className="text-amber-300 font-bold">🎯 Allotted Panel ({selectedCount})</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 text-white rounded-3xl border border-slate-800 overflow-hidden shadow-2xl flex flex-col">
      
      {/* Header bar with visual instructions */}
      <div className="p-4 sm:p-5 bg-slate-950/80 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-black">
            <Hammer className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm sm:text-base text-white flex items-center gap-1.5">
                <span>🚗 कार बॉडी पैनल चार्ट</span>
                <span className="text-xs text-slate-400 font-medium">(Visual Body Inspection)</span>
              </h3>
              {isCars24 && (
                <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/40 text-[10px] font-black uppercase">
                  Cars24 Fixed Rates
                </span>
              )}
            </div>
            <p className="text-xs text-amber-300/90 mt-0.5">
              👇 <strong>गाड़ी के चित्र पर सीधा टच करें</strong> (डेंटर और पेंटर भाई बिना नाम पढ़े स्केच देखकर काम चुन सकते हैं)
            </p>
          </div>
        </div>

        {/* Mode Tab Switcher (3D Model vs 2D Sketch) */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setDisplayMode('3D_INTERACTIVE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                displayMode === '3D_INTERACTIVE'
                  ? 'bg-amber-400 text-slate-950 font-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🚘</span>
              <span>3D Model (दरवाजे & इनर पेंट)</span>
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('2D_SKETCH')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                displayMode === '2D_SKETCH'
                  ? 'bg-amber-400 text-slate-950 font-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🎨</span>
              <span>2D Sketch Blueprint</span>
            </button>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs">
            <span className="text-slate-400 font-medium mr-1.5">चुने हुए पैनल:</span>
            <strong className="text-amber-400 font-mono text-sm">{selectedCount} Panels</strong>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs">
            <span className="text-emerald-400 font-medium mr-1.5">अनुमानित लागत:</span>
            <strong className="text-emerald-400 font-mono text-sm">₹{estimatedTotalCost.toLocaleString('en-IN')}</strong>
          </div>
        </div>
      </div>

      {/* Conditional 3D Interactive Model or 2D Diagram */}
      {displayMode === '3D_INTERACTIVE' ? (
        <div className="p-4 sm:p-6">
          <Interactive3DVehicleInspectionModel
            mode={mode}
            isCars24={isCars24}
            selectedPanelIds={selectedPanelIds}
            inspections={inspections}
            onInspectionChange={onInspectionChange}
            onPanelToggle={onPanelToggle}
            availableStandardJobs={availableStandardJobs}
            compact={compact}
          />
        </div>
      ) : (
      /* Main Interactive Diagram Workspace (2D) */
      <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Visual Blueprint / Sketch Canvas Area */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center bg-slate-950/60 rounded-3xl p-4 sm:p-6 border border-slate-800/80 relative">
          
          {/* Top Orientation Bar */}
          <div className="w-full flex items-center justify-between text-xs text-slate-400 mb-2 px-2">
            <span className="flex items-center gap-1 font-bold text-amber-400/80">
              <span>⬆️ आगे (FRONT / BONNET)</span>
            </span>
            <span className="text-[11px] text-slate-500">
              (LHS बायां • RHS दायां)
            </span>
            <span className="flex items-center gap-1 font-bold text-amber-400/80">
              <span>⬇️ पीछे (REAR / BOOT)</span>
            </span>
          </div>

          {/* SVG Vehicle Blueprint Sketch */}
          <div className="w-full max-w-[380px] sm:max-w-[420px] aspect-[440/440] relative flex items-center justify-center">
            <svg
              viewBox="0 0 440 440"
              className="w-full h-full drop-shadow-xl select-none"
            >
              <defs>
                {/* Wheels Styling */}
                <pattern id="tirePattern" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 0 5 L 10 5 M 5 0 L 5 10" stroke="#334155" strokeWidth="1" />
                </pattern>
                
                {/* Active Glowing Shadow */}
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* 1. Ground Shadow & Car Chassis Underbody Outline */}
              <path
                d="M 125 45 C 125 20, 315 20, 315 45 L 325 110 C 330 140, 330 290, 325 330 L 315 395 C 315 415, 125 415, 125 395 L 115 330 C 110 290, 110 140, 115 110 Z"
                fill="#0f172a"
                stroke="#334155"
                strokeWidth="2.5"
                strokeDasharray="4 2"
              />

              {/* 2. 4 Tires (Wheels) on Corners */}
              {/* Front Left Tire */}
              <rect x="94" y="65" width="24" height="60" rx="8" fill="#1e293b" stroke="#475569" strokeWidth="2" />
              {/* Front Right Tire */}
              <rect x="322" y="65" width="24" height="60" rx="8" fill="#1e293b" stroke="#475569" strokeWidth="2" />
              {/* Rear Left Tire */}
              <rect x="94" y="295" width="24" height="60" rx="8" fill="#1e293b" stroke="#475569" strokeWidth="2" />
              {/* Rear Right Tire */}
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

              {/* 3. Interactive Panels (Clickable SVG paths) */}
              {VEHICLE_PANELS.map((panel) => {
                const isActive = isPanelActive(panel.id);
                const isHovered = activeHoveredPanel?.id === panel.id;
                const isDetailSelected = selectedPanelForDetail?.id === panel.id;

                // Color themes
                let fillColor = '#1e293b'; // default slate-800
                let strokeColor = '#475569';
                let strokeWidth = '1.8';

                if (isActive) {
                  const inspection = inspections[panel.id];
                  const currentScope: PaintScope = inspection?.paintScope || 'FULL_OUTER';

                  if (currentScope === 'PARTIAL_TOUCHUP') {
                    fillColor = '#06b6d4'; // vibrant cyan for partial paint
                    strokeColor = '#a5f3fc';
                  } else if (currentScope === 'INSIDE_JAMB') {
                    fillColor = '#8b5cf6'; // vibrant purple for inside paint only
                    strokeColor = '#ddd6fe';
                  } else if (currentScope === 'FULL_OUTER_AND_INSIDE') {
                    fillColor = '#ec4899'; // vibrant pink for outer + inside
                    strokeColor = '#fbcfe8';
                  } else {
                    fillColor = '#f59e0b'; // vibrant amber for standard full outer paint
                    strokeColor = '#fef08a';
                  }
                  strokeWidth = '2.5';
                } else if (isHovered) {
                  fillColor = '#334155';
                  strokeColor = '#fbbf24';
                  strokeWidth = '2.5';
                }

                if (panel.id.includes('windshield')) {
                  fillColor = isActive ? '#38bdf8' : '#0f172a';
                  strokeColor = isActive ? '#bae6fd' : '#334155';
                }

                return (
                  <g
                    key={panel.id}
                    className="cursor-pointer transition-all duration-200"
                    onMouseEnter={() => setActiveHoveredPanel(panel)}
                    onMouseLeave={() => setActiveHoveredPanel(null)}
                    onClick={() => handlePanelClick(panel)}
                  >
                    {panel.svgShape.type === 'path' && (
                      <path
                        d={panel.svgShape.d}
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        filter={isActive ? 'url(#glow)' : undefined}
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
                        className="transition-colors duration-150"
                      />
                    )}

                    {/* Panel Label Pill on SVG */}
                    <text
                      x={panel.labelPos.x}
                      y={panel.labelPos.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={isActive ? '#020617' : '#e2e8f0'}
                      fontSize={panel.id === 'roof' ? '11' : '9'}
                      fontWeight="900"
                      fontFamily="system-ui, -apple-system, sans-serif"
                      className="pointer-events-none select-none"
                    >
                      {isActive ? `✓ ${panel.code}` : panel.code}
                    </text>

                    {/* Visual damage / active tick badge */}
                    {isActive && (
                      <circle
                        cx={panel.labelPos.x + 22}
                        cy={panel.labelPos.y - 10}
                        r="5"
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

          {/* Quick Sketch Visual Legend */}
          <div className="w-full mt-4 pt-3 border-t border-slate-800 flex items-center justify-around text-xs flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-slate-800 border border-slate-600 inline-block" />
              <span className="text-slate-400">साफ पैनल (Clean)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-amber-500 border border-amber-300 inline-block" />
              <span className="text-amber-300 font-bold">डेंट/पेंट चुना गया (Selected)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-sky-500 border border-sky-300 inline-block" />
              <span className="text-sky-300">शीशा (Glass)</span>
            </div>
          </div>
        </div>

        {/* Right Detail Panel & Interactive Quick Actions */}
        <div className="lg:col-span-5 space-y-4 flex flex-col justify-between h-full">
          
          {/* Active Hover / Selected Panel Inspector Box */}
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                  {selectedPanelForDetail ? 'चयनित पैनल (Selected Panel)' : 'पैनल जानकारी (Touch Any Panel)'}
                </span>
                <h4 className="font-extrabold text-base text-white leading-tight">
                  {(selectedPanelForDetail || activeHoveredPanel)?.nameHi || 'पैनल पर टच करें'}
                </h4>
                <p className="text-xs text-slate-300 font-mono">
                  {(selectedPanelForDetail || activeHoveredPanel)?.nameEn || 'Touch any sketch area to select'}
                </p>
              </div>

              {(selectedPanelForDetail || activeHoveredPanel) && (
                <button
                  type="button"
                  onClick={() => handleVoiceSpeakPanel(selectedPanelForDetail || activeHoveredPanel!)}
                  className={`p-2 rounded-xl border flex items-center gap-1 text-xs font-bold transition-all ${
                    speakingPanelId === (selectedPanelForDetail || activeHoveredPanel)?.id
                      ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                      : 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500 hover:text-slate-950'
                  }`}
                  title="बोलकर सुनें"
                >
                  {speakingPanelId === (selectedPanelForDetail || activeHoveredPanel)?.id ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                  <span>🔊 सुनें</span>
                </button>
              )}
            </div>

            {(() => {
              const activePanelObj = selectedPanelForDetail || activeHoveredPanel;
              if (!activePanelObj) return null;

              const matchedStdJob = getMatchingStandardJob(activePanelObj, effectiveStandardJobs);
              const activePrice = matchedStdJob
                ? (isCars24 ? (matchedStdJob.cars24Price ?? matchedStdJob.retailPrice) : matchedStdJob.retailPrice)
                : (isCars24 ? 1350 : (activePanelObj.defaultPrice || 1350));

              const activePainterPayout = matchedStdJob
                ? (isCars24 ? (matchedStdJob.cars24PainterPayout ?? matchedStdJob.painterPayout ?? 800) : (matchedStdJob.retailPainterPayout ?? matchedStdJob.painterPayout ?? 950))
                : (isCars24 ? 800 : 950);

              const activeDenterPayout = matchedStdJob
                ? (isCars24 ? (matchedStdJob.cars24DenterPayout ?? matchedStdJob.denterPayout ?? 150) : (matchedStdJob.retailDenterPayout ?? matchedStdJob.denterPayout ?? 200))
                : (isCars24 ? 150 : 200);

              return (
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">स्टैंडर्ड रेट (Standard Rate):</span>
                    <span className="font-extrabold text-amber-400 text-sm flex items-center gap-1.5">
                      ₹{activePrice.toLocaleString('en-IN')}
                      {isCars24 && <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono">Cars24</span>}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>पेंटर + डेंटर हिस्सा:</span>
                    <span className="text-amber-300 font-semibold">
                      ₹{activePainterPayout} (Paint) + ₹{activeDenterPayout} (Dent)
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Quick Filter Buttons for Denter & Painter for Fast Tagging */}
          <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-3">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              खराबी का प्रकार चुनें (Damage Type):
            </span>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { id: 'MINOR_DENT', label: '🔨 छोटा डेंट (Minor Dent)', color: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
                { id: 'DEEP_DENT', label: '💥 गहरा डेंट (Deep Dent)', color: 'border-orange-500/40 bg-orange-500/10 text-orange-300' },
                { id: 'SCRATCH', label: '🎨 केवल स्क्रैच (Scratch Only)', color: 'border-blue-500/40 bg-blue-500/10 text-blue-300' },
                { id: 'TEAR_CRACK', label: '⚡ कटा/टूटा (Crack/Tear)', color: 'border-rose-500/40 bg-rose-500/10 text-rose-300' },
              ].map(d => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setActiveSeverity(d.id as DamageSeverity)}
                  className={`p-2.5 rounded-xl border font-bold text-left transition-all text-xs ${
                    activeSeverity === d.id
                      ? 'ring-2 ring-amber-400 bg-amber-500 text-slate-950 border-amber-400'
                      : `${d.color} hover:opacity-80`
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick List of Active Selected Panels with One-Tap Remove */}
          <div className="space-y-2 grow">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="font-bold">📋 चुने गए पैनल की सूची ({selectedCount})</span>
              {selectedCount > 0 && onInspectionChange && (
                <button
                  type="button"
                  onClick={() => {
                    const cleared: Record<string, PanelInspectionItem> = {};
                    onInspectionChange(cleared);
                  }}
                  className="text-rose-400 hover:underline font-bold text-[11px]"
                >
                  सब हटाएं (Clear All)
                </button>
              )}
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {VEHICLE_PANELS.filter(p => isPanelActive(p.id)).length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                  अभी तक कोई पैनल नहीं चुना गया। ऊपर गाड़ी के स्केच पर क्लिक करें।
                </div>
              ) : (
                VEHICLE_PANELS.filter(p => isPanelActive(p.id)).map(p => {
                  const inspection = effectiveInspections[p.id];
                  const currentScope: PaintScope = inspection?.paintScope || 'FULL_OUTER';
                  const isPartialAllowed = isPartialPaintAllowedForPanel(p.id);

                  const rates = getPanelEnvironmentRates(p, effectiveStandardJobs, isCars24, currentScope);
                  const displayPrice = inspection?.customPrice !== undefined ? inspection.customPrice : rates.price;

                  return (
                    <div
                      key={p.id}
                      className="p-3 rounded-xl bg-slate-800 border border-slate-700 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-amber-500 text-slate-950 font-black text-[10px] flex items-center justify-center">
                            ✓
                          </span>
                          <div>
                            <strong className="text-white block">{p.nameHi}</strong>
                            <span className="text-[10.5px] text-amber-300 font-extrabold font-mono block">
                              {formatPaintTaskTitle(p.nameEn, currentScope)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handlePanelClick(p)}
                            className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20 transition-colors"
                            title="हटाएं"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Painter & Denter Allotment Badges */}
                      {(inspection?.painterName || inspection?.denterName) && (
                        <div className="pt-1 flex flex-wrap gap-1.5 items-center">
                          {inspection?.painterName && (
                            <span className="px-2 py-0.5 rounded bg-purple-500/25 border border-purple-500/40 text-purple-200 font-bold text-[10px] flex items-center gap-1">
                              🎨 Painter: {inspection.painterName}
                            </span>
                          )}
                          {inspection?.denterName && (
                            <span className="px-2 py-0.5 rounded bg-amber-500/25 border border-amber-500/40 text-amber-200 font-bold text-[10px] flex items-center gap-1">
                              🔨 Denter: {inspection.denterName}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Paint Scope Selection Chips */}
                      <div className="pt-2 border-t border-slate-700/60 flex flex-wrap items-center gap-1">
                        <span className="text-[10px] font-bold text-slate-400 mr-1">Paint Scope:</span>
                        {[
                          { id: 'FULL_OUTER', label: 'Full Paint', icon: '✨' },
                          { id: 'PARTIAL_TOUCHUP', label: 'Partial Paint', icon: '🎨', disabled: !isPartialAllowed },
                          { id: 'INSIDE_JAMB', label: 'Inside Paint', icon: '🚪' },
                          { id: 'FULL_OUTER_AND_INSIDE', label: 'Outer + Inside', icon: '🌟' }
                        ].map(s => {
                          const active = currentScope === s.id;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              disabled={s.disabled}
                              title={s.disabled ? 'Partial paint not allowed for fenders & running boards' : s.label}
                              onClick={() => {
                                if (s.disabled) return;
                                
                                const updatedObj = {
                                  ...(effectiveInspections[p.id] || { panelId: p.id, nameEn: p.nameEn, nameHi: p.nameHi, category: 'EXTERIOR_BODY', selected: true }),
                                  paintScope: s.id as PaintScope,
                                  // reset custom rates on scope change to force default rate recalculation
                                  customPrice: undefined,
                                  customPainterPayout: undefined,
                                  customDenterPayout: undefined
                                };

                                setLocalInspections(prev => ({
                                  ...prev,
                                  [p.id]: updatedObj
                                }));

                                if (onPanelToggle) {
                                  onPanelToggle(p.id, p.standardJobId, s.id as PaintScope);
                                }
                                if (onInspectionChange) {
                                  const updated = {
                                    ...effectiveInspections,
                                    [p.id]: updatedObj
                                  };
                                  onInspectionChange(updated);
                                }
                              }}
                              className={`px-2 py-0.5 rounded-lg font-bold text-[10px] transition-all flex items-center gap-1 ${
                                s.disabled
                                  ? 'bg-slate-900/50 text-slate-600 border border-slate-800 cursor-not-allowed opacity-40'
                                  : active
                                  ? 'bg-amber-400 text-slate-950 font-black shadow-sm ring-1 ring-amber-300'
                                  : 'bg-slate-900 text-slate-300 border border-slate-700 hover:border-amber-400/60'
                              }`}
                            >
                              <span>{s.icon}</span>
                              <span>{s.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Custom Payout and Rate Editing for INTERACTIVE MODE */}
                      {mode === 'INTERACTIVE_SELECT' && (
                        <div className="pt-2 border-t border-slate-700/40 grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Billing (Inc. GST)</label>
                            <div className="relative">
                              <span className="absolute left-1 top-1 text-slate-500 text-[9px]">₹</span>
                              <input
                                type="number"
                                className="w-full bg-slate-900 border border-slate-700 rounded px-0.5 pl-3.5 py-0.5 font-mono text-[10px] font-extrabold text-amber-400 focus:outline-none focus:border-amber-400"
                                value={inspection?.customPrice !== undefined ? inspection.customPrice : rates.price}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  if (onInspectionChange) {
                                    onInspectionChange({
                                      ...inspections,
                                      [p.id]: {
                                        ...(inspections[p.id] || { panelId: p.id, nameEn: p.nameEn, nameHi: p.nameHi, category: 'EXTERIOR_BODY', selected: true }),
                                        customPrice: val
                                      }
                                    });
                                  }
                                }}
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Painter Payout</label>
                            <div className="relative">
                              <span className="absolute left-1 top-1 text-slate-500 text-[9px]">₹</span>
                              <input
                                type="number"
                                className="w-full bg-slate-900 border border-slate-700 rounded px-0.5 pl-3.5 py-0.5 font-mono text-[10px] font-extrabold text-emerald-400 focus:outline-none focus:border-emerald-400"
                                value={inspection?.customPainterPayout !== undefined ? inspection.customPainterPayout : rates.painterPayout}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  if (onInspectionChange) {
                                    onInspectionChange({
                                      ...inspections,
                                      [p.id]: {
                                        ...(inspections[p.id] || { panelId: p.id, nameEn: p.nameEn, nameHi: p.nameHi, category: 'EXTERIOR_BODY', selected: true }),
                                        customPainterPayout: val
                                      }
                                    });
                                  }
                                }}
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Denter Payout</label>
                            <div className="relative">
                              <span className="absolute left-1 top-1 text-slate-500 text-[9px]">₹</span>
                              <input
                                type="number"
                                className="w-full bg-slate-900 border border-slate-700 rounded px-0.5 pl-3.5 py-0.5 font-mono text-[10px] font-extrabold text-blue-400 focus:outline-none focus:border-blue-400"
                                value={inspection?.customDenterPayout !== undefined ? inspection.customDenterPayout : rates.denterPayout}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  if (onInspectionChange) {
                                    onInspectionChange({
                                      ...inspections,
                                      [p.id]: {
                                        ...(inspections[p.id] || { panelId: p.id, nameEn: p.nameEn, nameHi: p.nameHi, category: 'EXTERIOR_BODY', selected: true }),
                                        customDenterPayout: val
                                      }
                                    });
                                  }
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>
      )}

      {/* Action Footer */}
      <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-400">
          <ShieldCheck className="w-4 h-4 text-amber-500" />
          <span>पैनल चुनते ही पेंटर और डेंटर के खाते में लेबर रेट अपने आप जुड़ जाती है।</span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-slate-300 font-bold text-xs">
            कुल काम (Total Selected): <strong className="text-amber-400 text-sm">{selectedCount} Panels</strong>
          </span>
        </div>
      </div>

    </div>
  );
}
