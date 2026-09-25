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
import { getStandardJobs, getVehiclePanels } from '../lib/storage';
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
    id: 'spoiler',
    code: 'SPOILER',
    nameEn: 'Rear Spoiler',
    nameHi: 'रियर स्पॉइलर (Rear Spoiler)',
    standardJobId: 'std-spoiler-full',
    view: 'TOP',
    svgShape: {
      type: 'rect',
      x: 172,
      y: 328,
      width: 96,
      height: 5,
      rx: 1
    },
    labelPos: { x: 220, y: 322 },
    defaultPrice: 1200
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
  },
  {
    id: 'pillar_a',
    code: 'P-A',
    nameEn: 'A-Pillar',
    nameHi: 'ए-पिलर (A-Pillar - Inside Only)',
    standardJobId: 'std-pillar-a',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 152 140 L 162 140 L 170 180 L 160 180 Z M 278 140 L 288 140 L 280 180 L 270 180 Z'
    },
    labelPos: { x: 220, y: 124 },
    defaultPrice: 800
  },
  {
    id: 'pillar_b',
    code: 'P-B',
    nameEn: 'B-Pillar',
    nameHi: 'बी-पिलर (B-Pillar - Inside Only)',
    standardJobId: 'std-pillar-b',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 164 230 L 174 230 L 174 245 L 164 245 Z M 266 230 L 276 230 L 276 245 L 266 245 Z'
    },
    labelPos: { x: 220, y: 215 },
    defaultPrice: 800
  },
  {
    id: 'pillar_c',
    code: 'P-C',
    nameEn: 'C-Pillar',
    nameHi: 'सी-पिलर (C-Pillar - Inside Only)',
    standardJobId: 'std-pillar-c',
    view: 'TOP',
    svgShape: {
      type: 'path',
      d: 'M 166 290 L 174 290 L 164 330 L 156 330 Z M 266 290 L 274 290 L 284 330 L 276 330 Z'
    },
    labelPos: { x: 220, y: 326 },
    defaultPrice: 800
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

  const effectivePanels = useMemo(() => {
    return getVehiclePanels();
  }, []);

  // Lifted state to control dicky and bonnet open states
  const [bonnetOpen, setBonnetOpen] = useState(false);
  const [dickyOpen, setDickyOpen] = useState(false);

  // Local state to track scope overrides or panel clicks locally so the interactive preview updates in real-time
  const [localInspections, setLocalInspections] = useState<Record<string, PanelInspectionItem>>({});
  const [panelToDeselect, setPanelToDeselect] = useState<PanelDefinition | null>(null);

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

  const confirmDeselect = () => {
    if (!panelToDeselect) return;
    const panel = panelToDeselect;
    setPanelToDeselect(null);

    const isInsideOnly = panel.id.startsWith('pillar_') || panel.id === 'boot_floor';
    const updatedObj = {
      panelId: panel.id,
      nameEn: panel.nameEn,
      nameHi: panel.nameHi,
      category: 'EXTERIOR_BODY' as const,
      selected: false,
      paintScope: (isInsideOnly ? 'INSIDE_JAMB' : 'FULL_OUTER') as PaintScope,
      customPrice: undefined,
      customPainterPayout: undefined,
      customDenterPayout: undefined
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

  const handlePanelClick = (panel: PanelDefinition, forceConfirm = false) => {
    setSelectedPanelForDetail(prev => prev?.id === panel.id ? null : panel);

    const wasActive = isPanelActive(panel.id);

    if (wasActive && !forceConfirm) {
      setPanelToDeselect(panel);
      return;
    }

    const isInsideOnly = panel.id.startsWith('pillar_') || panel.id === 'boot_floor';

    const current = effectiveInspections[panel.id] || {
      panelId: panel.id,
      nameEn: panel.nameEn,
      nameHi: panel.nameHi,
      category: 'EXTERIOR_BODY',
      selected: false,
      paintScope: isInsideOnly ? 'INSIDE_JAMB' : 'FULL_OUTER'
    };

    const updatedObj = {
      ...current,
      selected: !wasActive,
      damageType: !wasActive ? activeSeverity : undefined,
      actionRequired: !wasActive ? activeRepairAction : undefined,
      matchedStandardJobId: panel.standardJobId,
      paintScope: current.paintScope || (isInsideOnly ? 'INSIDE_JAMB' : 'FULL_OUTER')
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
    return effectivePanels.filter(p => isPanelActive(p.id) && (p.id !== 'boot_floor' || dickyOpen || isPanelActive('boot_floor'))).length;
  }, [selectedPanelIds, effectiveInspections, dickyOpen, effectivePanels]);

  const estimatedTotalCost = useMemo(() => {
    return effectivePanels
      .filter(p => isPanelActive(p.id) && (p.id !== 'boot_floor' || dickyOpen || isPanelActive('boot_floor')))
      .reduce((sum, p) => {
        const stdJob = getMatchingStandardJob(p, effectiveStandardJobs);
        if (stdJob) {
          return sum + (isCars24 ? (stdJob.cars24Price ?? stdJob.retailPrice) : stdJob.retailPrice);
        }
        return sum + (isCars24 ? 1350 : (p.defaultPrice || 1350));
      }, 0);
  }, [selectedPanelIds, effectiveInspections, effectiveStandardJobs, isCars24, dickyOpen, effectivePanels]);

  if (compact) {
    return (
      <div className="w-full">
        <Interactive3DVehicleInspectionModel
          mode={mode}
          isCars24={isCars24}
          selectedPanelIds={selectedPanelIds}
          inspections={inspections}
          onInspectionChange={onInspectionChange}
          onPanelToggle={onPanelToggle}
          availableStandardJobs={availableStandardJobs}
          compact={true}
          bonnetOpen={bonnetOpen}
          setBonnetOpen={setBonnetOpen}
          dickyOpen={dickyOpen}
          setDickyOpen={setDickyOpen}
        />
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

        {/* Status Info Badges */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
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

      {/* Main Interactive 3D Work Area */}
      <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Premium 3D Interactive Model */}
        <div className="lg:col-span-7 rounded-3xl overflow-hidden border border-slate-800 bg-slate-950/60 p-1">
          <Interactive3DVehicleInspectionModel
            mode={mode}
            isCars24={isCars24}
            selectedPanelIds={selectedPanelIds}
            inspections={inspections}
            onInspectionChange={onInspectionChange}
            onPanelToggle={(panelId, jobId, scope) => {
              // Sync selected panel details on 3D click so the right edit sidebar updates
              const found = effectivePanels.find(p => p.id === panelId);
              if (found) {
                setSelectedPanelForDetail(found);
              }
              if (onPanelToggle) {
                onPanelToggle(panelId, jobId, scope);
              }
            }}
            availableStandardJobs={availableStandardJobs}
            compact={compact}
            bonnetOpen={bonnetOpen}
            setBonnetOpen={setBonnetOpen}
            dickyOpen={dickyOpen}
            setDickyOpen={setDickyOpen}
          />
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

              const inspection = effectiveInspections[activePanelObj.id];
              const currentScope: PaintScope = inspection?.paintScope || 'FULL_OUTER';
              const isPartialAllowed = isPartialPaintAllowedForPanel(activePanelObj.id);

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

                  {/* Inline Paint Scope Chips */}
                  <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center gap-1">
                    <span className="text-[10px] font-bold text-slate-400 mr-1">Paint Scope:</span>
                    {[
                      { id: 'FULL_OUTER', label: 'Full Paint', icon: '✨' },
                      { id: 'PARTIAL_TOUCHUP', label: 'Partial Paint', icon: '🎨', disabled: !isPartialAllowed },
                      { id: 'INSIDE_JAMB', label: 'Inside Paint', icon: '🚪' },
                      { id: 'FULL_OUTER_AND_INSIDE', label: 'Outer + Inside', icon: '🌟' }
                    ].map(s => {
                      const isInsideOnlyPanel = activePanelObj.id.startsWith('pillar_') || activePanelObj.id === 'boot_floor';
                      const isInsideOnlyDisabled = isInsideOnlyPanel && s.id !== 'INSIDE_JAMB';
                      const isDisabled = s.disabled || isInsideOnlyDisabled;
                      const active = currentScope === s.id;

                      return (
                        <button
                          key={s.id}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => {
                            if (isDisabled) return;
                            
                            // Auto-open Bonnet or Dicky if choosing inside paint scope
                            const isInsideScope = s.id === 'INSIDE_JAMB' || s.id === 'FULL_OUTER_AND_INSIDE';
                            if (isInsideScope) {
                              if (activePanelObj.id === 'hood_bonnet' && !bonnetOpen) {
                                setBonnetOpen(true);
                              }
                              if (activePanelObj.id === 'boot_trunk' && !dickyOpen) {
                                setDickyOpen(true);
                              }
                            }

                            const updatedObj = {
                              ...(effectiveInspections[activePanelObj.id] || { panelId: activePanelObj.id, nameEn: activePanelObj.nameEn, nameHi: activePanelObj.nameHi, category: 'EXTERIOR_BODY', selected: true }),
                              selected: true,
                              paintScope: s.id as PaintScope,
                              customPrice: undefined,
                              customPainterPayout: undefined,
                              customDenterPayout: undefined
                            };

                            setLocalInspections(prev => ({
                              ...prev,
                              [activePanelObj.id]: updatedObj
                            }));

                            if (onPanelToggle) {
                              onPanelToggle(activePanelObj.id, activePanelObj.standardJobId, s.id as PaintScope);
                            }
                            if (onInspectionChange) {
                              const updated = {
                                ...effectiveInspections,
                                [activePanelObj.id]: updatedObj
                              };
                              onInspectionChange(updated);
                            }
                          }}
                          className={`px-2 py-0.5 rounded-lg font-bold text-[10px] transition-all flex items-center gap-1 ${
                            isDisabled
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

          {/* Quick Toggle for Internal Panels & Pillars */}
          <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-2.5">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              अंदरूनी भाग और पिलर (Internal & Pillar Panels):
            </span>
            <p className="text-[10px] text-slate-400">
              इन्हें यहाँ से सीधा एक क्लिक में चुन सकते हैं (Select directly in 1-click):
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { id: 'pillar_a', label: '🚪 A-Pillar (ए-पिलर)' },
                { id: 'pillar_b', label: '🚪 B-Pillar (बी-पिलर)' },
                { id: 'pillar_c', label: '🚪 C-Pillar (सी-पिलर)' },
                { id: 'boot_floor', label: '🚗 Dicky Floor (डिक्की फर्श)' },
                { id: 'spoiler', label: '🏎️ Spoiler (स्पॉइलर)' },
              ].map(item => {
                const isActive = isPanelActive(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (item.id === 'boot_floor' && !dickyOpen) {
                        setDickyOpen(true);
                      }
                      const panelObj = effectivePanels.find(p => p.id === item.id);
                      if (panelObj) {
                        handlePanelClick(panelObj);
                      }
                    }}
                    className={`p-2.5 rounded-xl border font-bold text-left transition-all text-[11px] flex items-center justify-between ${
                      isActive
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 ring-2 ring-emerald-400/40 font-extrabold'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span>{item.label}</span>
                    {isActive ? (
                      <span className="text-[9px] bg-slate-950/20 px-1 rounded text-emerald-950 font-black">ACTIVE</span>
                    ) : (
                      <span className="text-[9px] text-slate-500 font-bold">+ Add</span>
                    )}
                  </button>
                );
              })}
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
              {effectivePanels.filter(p => isPanelActive(p.id) && (p.id !== 'boot_floor' || dickyOpen || isPanelActive('boot_floor'))).length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                  अभी तक कोई पैनल नहीं चुना गया। ऊपर गाड़ी के स्केच पर क्लिक करें।
                </div>
              ) : (
                effectivePanels.filter(p => isPanelActive(p.id) && (p.id !== 'boot_floor' || dickyOpen || isPanelActive('boot_floor'))).map(p => {
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
                          const isInsideOnlyPanel = p.id.startsWith('pillar_') || p.id === 'boot_floor';
                          const isInsideOnlyDisabled = isInsideOnlyPanel && s.id !== 'INSIDE_JAMB';
                          
                          // No longer disabled even when Bonnet/Dicky are closed. We auto-open on click!
                          const isDisabled = s.disabled || isInsideOnlyDisabled;
                          const active = currentScope === s.id;
                          
                          const isInsideScope = s.id === 'INSIDE_JAMB' || s.id === 'FULL_OUTER_AND_INSIDE';
                          const tooltipText = isInsideOnlyDisabled 
                            ? 'Internal panels are inside paint only' 
                            : (s.disabled ? 'Partial paint not allowed for fenders & running boards' : s.label);

                          return (
                            <button
                              key={s.id}
                              type="button"
                              disabled={isDisabled}
                              title={tooltipText}
                              onClick={() => {
                                if (isDisabled) return;
                                
                                // Auto-open Bonnet or Dicky if choosing inside paint scope
                                const isInsideScope = s.id === 'INSIDE_JAMB' || s.id === 'FULL_OUTER_AND_INSIDE';
                                if (isInsideScope) {
                                  if (p.id === 'hood_bonnet' && !bonnetOpen) {
                                    setBonnetOpen(true);
                                  }
                                  if (p.id === 'boot_trunk' && !dickyOpen) {
                                    setDickyOpen(true);
                                  }
                                }

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
                                value={(inspection?.customPrice !== undefined ? inspection.customPrice : rates.price) ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? '' : Number(e.target.value);
                                  if (onInspectionChange) {
                                    onInspectionChange({
                                      ...inspections,
                                      [p.id]: {
                                        ...(inspections[p.id] || { panelId: p.id, nameEn: p.nameEn, nameHi: p.nameHi, category: 'EXTERIOR_BODY', selected: true }),
                                        customPrice: val as any
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
                                value={(inspection?.customPainterPayout !== undefined ? inspection.customPainterPayout : rates.painterPayout) ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? '' : Number(e.target.value);
                                  if (onInspectionChange) {
                                    onInspectionChange({
                                      ...inspections,
                                      [p.id]: {
                                        ...(inspections[p.id] || { panelId: p.id, nameEn: p.nameEn, nameHi: p.nameHi, category: 'EXTERIOR_BODY', selected: true }),
                                        customPainterPayout: val as any
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
                                value={(inspection?.customDenterPayout !== undefined ? inspection.customDenterPayout : rates.denterPayout) ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? '' : Number(e.target.value);
                                  if (onInspectionChange) {
                                    onInspectionChange({
                                      ...inspections,
                                      [p.id]: {
                                        ...(inspections[p.id] || { panelId: p.id, nameEn: p.nameEn, nameHi: p.nameHi, category: 'EXTERIOR_BODY', selected: true }),
                                        customDenterPayout: val as any
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

      {/* Selection Removal Confirmation Modal */}
      {panelToDeselect && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-extrabold text-sm sm:text-base text-white flex items-center gap-2">
                <span className="text-rose-500">⚠️</span>
                <span>चयन हटाना सुनिश्चित करें (Confirm Removal)</span>
              </h3>
              <button
                type="button"
                onClick={() => setPanelToDeselect(null)}
                className="text-slate-400 hover:text-white transition-colors p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-3">
              <div className="text-slate-300 text-sm leading-relaxed">
                क्या आप सचमुच <strong className="text-white font-extrabold">{panelToDeselect.nameHi}</strong> (<span className="text-amber-400 font-semibold">{panelToDeselect.nameEn}</span>) को अपनी सूची से हटाना चाहते हैं?
              </div>
              <p className="text-xs text-slate-400 leading-normal">
                Are you sure you want to remove <strong className="text-white">{panelToDeselect.nameEn}</strong> from the assessment selection? This will clear all recorded paint/damage details for this panel.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950/40 border-t border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setPanelToDeselect(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              >
                नहीं, रखें (Keep)
              </button>
              <button
                type="button"
                onClick={() => confirmDeselect()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-lg shadow-rose-900/20"
              >
                <span>हाँ, हटाएं (Yes, Remove)</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
