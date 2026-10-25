import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { 
  RotateCcw, 
  Eye, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  Maximize2, 
  ChevronRight,
  ShieldCheck,
  Compass,
  Layers,
  Wrench,
  CheckCircle2
} from 'lucide-react';
import { VEHICLE_PANELS, PanelDefinition, PanelInspectionItem } from './InteractiveVehicleInspectionChart';
import { PaintScope, StandardJob } from '../types';
import { getVehiclePanels, getStandardJobs } from '../lib/storage';
import { speakTechnicianPrompt, stopTechnicianSpeech } from '../lib/technicianVoiceHelper';
import { formatPaintTaskTitle, isPartialPaintAllowedForPanel, getPanelEnvironmentRates } from '../lib/panelMappingHelper';

// Module-level reusable math objects to eliminate GC allocations during interaction and render loops
const _tmpDir = new THREE.Vector3();
const _tmpRight = new THREE.Vector3();
const _tmpUp = new THREE.Vector3();

// Texture cache for partial paint highlight textures (avoids recreating 128x128 2D canvas per frame)
const halfColorTextureCache = new Map<string, THREE.CanvasTexture>();
function getCachedHalfColorTexture(colorStr: string): THREE.CanvasTexture {
  let tex = halfColorTextureCache.get(colorStr);
  if (!tex) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = colorStr;
      ctx.fillRect(0, 0, 64, 128);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(64, 0, 64, 128);
    }
    tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    halfColorTextureCache.set(colorStr, tex);
  }
  return tex;
}

export interface Interactive3DVehicleInspectionModelProps {
  mode?: 'VIEW' | 'INTERACTIVE_SELECT' | 'INSPECTION_RECORD';
  isCars24?: boolean;
  selectedPanelIds?: string[];
  inspections?: Record<string, PanelInspectionItem>;
  onInspectionChange?: (inspections: Record<string, PanelInspectionItem>) => void;
  onPanelToggle?: (panelId: string, matchedJobId?: string, paintScope?: PaintScope) => void;
  availableStandardJobs?: StandardJob[];
  currentRole?: string;
  vehicleMakeModel?: string;
  compact?: boolean;
  bonnetOpen?: boolean;
  setBonnetOpen?: (open: boolean) => void;
  dickyOpen?: boolean;
  setDickyOpen?: (open: boolean) => void;
}

export function Interactive3DVehicleInspectionModel({
  mode = 'INTERACTIVE_SELECT',
  isCars24 = false,
  selectedPanelIds = [],
  inspections = {},
  onInspectionChange,
  onPanelToggle,
  availableStandardJobs = [],
  compact = false,
  ...props
}: Interactive3DVehicleInspectionModelProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  // States
  const [activePanelId, setActivePanelId] = useState<string | null>(() => {
    if (selectedPanelIds && selectedPanelIds.length > 0) {
      return selectedPanelIds[0];
    }
    return 'hood_bonnet';
  });
  const [hoveredPanelId, setHoveredPanelId] = useState<string | null>(null);
  const [isPillDismissed, setIsPillDismissed] = useState(false);
  const previousPanelIdRef = useRef<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [panelToDeselect, setPanelToDeselect] = useState<{ panelId: string; nameEn: string; nameHi: string } | null>(null);

  // Local state to track scope overrides or panel clicks locally so the interactive preview updates in real-time
  const [localInspections, setLocalInspections] = useState<Record<string, PanelInspectionItem>>({});

  // Merge inspections prop with local interaction overrides
  const effectiveInspections = useMemo(() => {
    return {
      ...inspections,
      ...localInspections
    };
  }, [inspections, localInspections]);

  // Open / Close Hinged Parts State
  const [doorsOpen, setDoorsOpen] = useState(true);
  const [localBonnetOpen, setLocalBonnetOpen] = useState(false);
  const [localDickyOpen, setLocalDickyOpen] = useState(false);

  const bonnetOpen = props.bonnetOpen !== undefined ? props.bonnetOpen : localBonnetOpen;
  const setBonnetOpen = props.setBonnetOpen || setLocalBonnetOpen;

  const dickyOpen = props.dickyOpen !== undefined ? props.dickyOpen : localDickyOpen;
  const setDickyOpen = props.setDickyOpen || setLocalDickyOpen;

  // Isolation and Assembly Reference states
  const [isolatedComponent, setIsolatedComponent] = useState<string | null>(null);
  const carGroupRef = useRef<THREE.Group | null>(null);

  // AR View Mode states
  const [isArMode, setIsArMode] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [arStream, setArStream] = useState<MediaStream | null>(null);
  const [cameraPermissionError, setCameraPermissionError] = useState(false);

  // Camera preset view
  const [cameraPreset, setCameraPreset] = useState<'ISO' | 'FRONT' | 'REAR' | 'LHS' | 'RHS' | 'TOP' | 'UNDERBODY'>('ISO');

  // References for Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const targetFocusRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.5, 0));
  const meshesMapRef = useRef<Map<string, THREE.Mesh | THREE.Group>>(new Map());
  const hingedGroupsRef = useRef<{
    doorLhsFront?: THREE.Group;
    doorRhsFront?: THREE.Group;
    doorLhsRear?: THREE.Group;
    doorRhsRear?: THREE.Group;
    hoodBonnet?: THREE.Group;
    bootTrunk?: THREE.Group;
  }>({});

  // Render-on-demand and animation interpolation refs for zero-thermal operation
  const requestRenderRef = useRef<(frames?: number) => void>(() => {});
  const targetCamPosRef = useRef(new THREE.Vector3(4.8, 2.2, 5.8));
  const targetFocusPosRef = useRef(new THREE.Vector3(0, 0.4, 0));
  const targetHingeAnglesRef = useRef({
    doorLhs: 0,
    doorRhs: 0,
    bonnet: 0,
    boot: 0
  });
  const selectableMeshesRef = useRef<THREE.Mesh[]>([]);

  const effectiveStandardJobs = useMemo(() => {
    return (availableStandardJobs && availableStandardJobs.length > 0)
      ? availableStandardJobs
      : getStandardJobs();
  }, [availableStandardJobs]);

  const effectivePanels = useMemo(() => {
    const stored = getVehiclePanels();
    const map = new Map<string, PanelDefinition>();
    VEHICLE_PANELS.forEach(p => map.set(p.id, p));
    stored.forEach((p: PanelDefinition) => map.set(p.id, p));
    return Array.from(map.values());
  }, []);

  // Sync localInspections with controlled props (inspections & selectedPanelIds) when parent updates
  useEffect(() => {
    if (!onInspectionChange) return;
    setLocalInspections(prev => {
      const next: Record<string, PanelInspectionItem> = {};
      Object.keys(inspections).forEach(k => {
        if (inspections[k]) next[k] = inspections[k];
      });
      selectedPanelIds.forEach(id => {
        if (!next[id]) {
          const panelObj = effectivePanels.find(p => p.id === id);
          if (panelObj) {
            next[id] = prev[id]?.selected ? prev[id] : {
              panelId: id,
              nameEn: panelObj.nameEn,
              nameHi: panelObj.nameHi,
              category: 'EXTERIOR_BODY',
              selected: true,
              paintScope: prev[id]?.paintScope || ((id.startsWith('pillar_') || id === 'boot_floor') ? 'INSIDE_JAMB' : 'FULL_OUTER')
            };
          }
        }
      });
      return next;
    });
  }, [inspections, selectedPanelIds, effectivePanels, Boolean(onInspectionChange)]);

  const isPanelActive = (panelId: string) => {
    const existing = effectiveInspections[panelId];
    if (existing !== undefined) {
      return Boolean(existing.selected);
    }
    return selectedPanelIds.includes(panelId);
  };

  // Active panel definition (guarantees an active panel is selected)
  const activePanelObj = useMemo(() => {
    if (activePanelId) {
      const found = effectivePanels.find(p => p.id === activePanelId);
      if (found) return found;
    }
    if (selectedPanelIds.length > 0) {
      const found = effectivePanels.find(p => p.id === selectedPanelIds[0]);
      if (found) return found;
    }
    return effectivePanels.find(p => p.id === 'hood_bonnet') || effectivePanels[0] || null;
  }, [activePanelId, effectivePanels, selectedPanelIds]);

  const activeInspection = activePanelObj ? effectiveInspections[activePanelObj.id] : undefined;
  const currentScope: PaintScope = activeInspection?.paintScope || 'FULL_OUTER';

  // Confirm removal/deselection of panel
  const confirmDeselect = () => {
    if (!panelToDeselect) return;
    const { panelId } = panelToDeselect;
    const panelObj = effectivePanels.find(p => p.id === panelId);
    if (!panelObj) {
      setPanelToDeselect(null);
      return;
    }

    const isInsideOnly = panelId.startsWith('pillar_') || panelId === 'boot_floor';
    const updatedObj = {
      panelId,
      nameEn: panelObj.nameEn,
      nameHi: panelObj.nameHi,
      category: 'EXTERIOR_BODY' as const,
      selected: false,
      paintScope: (isInsideOnly ? 'INSIDE_JAMB' : 'FULL_OUTER') as PaintScope,
      customPrice: undefined,
      customPainterPayout: undefined,
      customDenterPayout: undefined
    };

    setLocalInspections(prev => ({
      ...prev,
      [panelId]: updatedObj
    }));

    if (onInspectionChange) {
      const updated = {
        ...effectiveInspections,
        [panelId]: updatedObj
      };
      onInspectionChange(updated);
    }

    if (onPanelToggle) {
      onPanelToggle(panelId, panelObj.standardJobId);
    }

    setPanelToDeselect(null);
    requestRenderRef.current(20);
  };

  const lastClickRef = useRef<{ panelId: string; time: number }>({ panelId: '', time: 0 });

  // Toggle panel selection directly on 1-click (select or deselect)
  const handlePanelClick = (panelId: string, scope?: PaintScope) => {
    const now = Date.now();
    if (
      !scope &&
      lastClickRef.current.panelId === panelId &&
      now - lastClickRef.current.time < 300
    ) {
      return; // Ignore duplicate bounce tap on same panel
    }
    lastClickRef.current = { panelId, time: now };

    if ((panelId === 'boot_floor' || panelId === 'boot_trunk') && !dickyOpen) {
      setDickyOpen(true);
    }
    if ((panelId === 'apron_lhs' || panelId === 'apron_rhs') && !bonnetOpen) {
      setBonnetOpen(true);
    }
    setIsPillDismissed(false);
    setActivePanelId(panelId);
    const panelObj = effectivePanels.find(p => p.id === panelId);
    if (!panelObj) return;

    // In pure VIEW mode without interactive handlers, only focus the panel for inspection details/voice
    if (mode === 'VIEW' && !onInspectionChange && !onPanelToggle) {
      requestRenderRef.current(20);
      return;
    }

    const existing = effectiveInspections[panelId];
    const isCurrentlyActive = isPanelActive(panelId);

    // If an explicit scope is chosen, keep/force selection to true. If clicking 3D panel without scope, toggle selection directly.
    const newSelected = scope ? true : !isCurrentlyActive;
    const isInsideOnly = panelId.startsWith('pillar_') || panelId === 'boot_floor';
    const targetScope = scope || existing?.paintScope || (isInsideOnly ? 'INSIDE_JAMB' : 'FULL_OUTER');

    const rates = getPanelEnvironmentRates(panelId, effectiveStandardJobs, isCars24, targetScope);

    const updatedObj = {
      panelId,
      nameEn: panelObj.nameEn,
      nameHi: panelObj.nameHi,
      category: 'EXTERIOR_BODY' as const,
      selected: newSelected,
      paintScope: targetScope,
      customPrice: rates.price > 0 ? rates.price : undefined,
      customPainterPayout: rates.painterPayout > 0 ? rates.painterPayout : undefined,
      customDenterPayout: rates.denterPayout > 0 ? rates.denterPayout : undefined
    };

    setLocalInspections(prev => ({
      ...prev,
      [panelId]: updatedObj
    }));

    if (onInspectionChange) {
      const updated = {
        ...effectiveInspections,
        [panelId]: updatedObj
      };
      onInspectionChange(updated);
    }

    if (onPanelToggle) {
      const targetJobId = rates.standardJob?.id || panelObj.standardJobId;
      onPanelToggle(panelId, targetJobId, newSelected ? targetScope : undefined);
    }
    requestRenderRef.current(25);
  };

  // Refs to ensure Three.js WebGL event listeners always invoke latest handlers without stale closures
  const handlePanelClickRef = useRef(handlePanelClick);
  handlePanelClickRef.current = handlePanelClick;
  const dickyOpenRef = useRef(dickyOpen);
  dickyOpenRef.current = dickyOpen;

  // Voice speech handler
  const speakPanelInfo = (panel: PanelDefinition) => {
    const inspection = effectiveInspections[panel.id];
    const scope = inspection?.paintScope || 'FULL_OUTER';
    const dynamicTitle = formatPaintTaskTitle(panel.nameEn, scope);
    const text = `${panel.nameHi}. ${dynamicTitle}.`;

    setIsSpeaking(true);
    speakTechnicianPrompt(text, () => setIsSpeaking(false));
  };

  // Build Three.js 3D Vehicle Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = compact ? 360 : 480;

    // 1. Scene - Showroom Studio White/Light Grey (Matching Reference Image)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe2e8f0); // Premium light-grey studio
    scene.fog = new THREE.FogExp2(0xe2e8f0, 0.02);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(4.8, 2.2, 5.8);
    camera.lookAt(0, 0.4, 0);
    cameraRef.current = camera;
    targetCamPosRef.current.set(4.8, 2.2, 5.8);
    targetFocusPosRef.current.set(0, 0.4, 0);

    // 3. Renderer with Eco-Thermal Optimization (Render-on-Demand + Default Power)
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true, 
      powerPreference: 'default' // Prevents dedicated GPU from overheating
    });
    renderer.setSize(width, height);
    // Cap pixel ratio to 1.35 to avoid massive fragment rendering cost on 2x/3x/4x mobile screens
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lighting - Premium Studio Light Rigs
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
    mainLight.position.set(8, 12, 8);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024; // 1024x1024 saves 4x fillrate and memory over 2048
    mainLight.shadow.mapSize.height = 1024;
    mainLight.shadow.camera.near = 1;
    mainLight.shadow.camera.far = 30;
    mainLight.shadow.camera.left = -6;
    mainLight.shadow.camera.right = 6;
    mainLight.shadow.camera.top = 6;
    mainLight.shadow.camera.bottom = -6;
    mainLight.shadow.bias = -0.0005;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.8); // Gentle sky-blue bounce fill
    fillLight.position.set(-8, 8, -8);
    scene.add(fillLight);

    const bounceLight = new THREE.DirectionalLight(0xffffff, 0.5); // Underbody ground bounce
    bounceLight.position.set(0, -6, 0);
    scene.add(bounceLight);

    // 5. Light Studio Grid Floor (Checkerboard style matching reference image)
    const gridHelper = new THREE.GridHelper(16, 32, 0x94a3b8, 0xcbd5e1);
    gridHelper.position.y = 0.001;
    scene.add(gridHelper);

    const floorGeo = new THREE.PlaneGeometry(20, 20);
    const floorMat = new THREE.MeshStandardMaterial({ 
      color: 0xf1f5f9, 
      roughness: 0.4, 
      metalness: 0.1 
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = 0;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // 6. Base Vehicle Assembly Setup
    const carGroup = new THREE.Group();
    scene.add(carGroup);
    carGroupRef.current = carGroup;

    // Common Base Materials - Highly realistic Pearl White Automotive Finish (MeshPhysicalMaterial)
    const defaultPaintMat = new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc, // Pure Pearl White
      metalness: 0.15,
      roughness: 0.14,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      reflectivity: 0.9
    });

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.45,
      roughness: 0.05,
      metalness: 0.95,
      transmission: 0.8,
      thickness: 1.0
    });

    const interiorMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85 });
    const tintedGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f172a, // Premium deep tinted luxury glass look
      transparent: true,
      opacity: 0.3, // Semi-transparent so interior/pillars are fully visible!
      roughness: 0.05,
      metalness: 0.95,
      transmission: 0.8,
      thickness: 0.8
    });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.05, metalness: 0.95 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.95 });
    const engineMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.5 });
    const caliperMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.85, roughness: 0.15 }); // Sporty RED Calipers
    const headlightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.2, roughness: 0.05 });
    const taillightMat = new THREE.MeshStandardMaterial({ color: 0xd946ef, emissive: 0xef4444, emissiveIntensity: 1.0, roughness: 0.05 });
    const grilleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });

    const meshesMap = new Map<string, THREE.Mesh | THREE.Group>();
    meshesMapRef.current = meshesMap;

    // Helper builder for panel meshes
    const registerPanelMesh = (panelId: string, geometry: THREE.BufferGeometry, material: THREE.Material, parentGroup?: THREE.Group, pos?: THREE.Vector3) => {
      const mesh = new THREE.Mesh(geometry, material.clone());
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { panelId };
      if (pos) mesh.position.copy(pos);

      if (parentGroup) {
        parentGroup.add(mesh);
      } else {
        carGroup.add(mesh);
      }
      meshesMap.set(panelId, mesh);
      return mesh;
    };

    // Custom Rounded Box Extruder for organically curved panels catching sleek showroom reflections
    const createRoundedBoxGeometry = (w: number, h: number, d: number, r: number) => {
      const shape = new THREE.Shape();
      const x = -w / 2;
      const y = -h / 2;
      
      shape.moveTo(x, y + r);
      shape.lineTo(x, y + h - r);
      shape.quadraticCurveTo(x, y + h, x + r, y + h);
      shape.lineTo(x + w - r, y + h);
      shape.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
      shape.lineTo(x + w, y + r);
      shape.quadraticCurveTo(x + w, y, x + w - r, y);
      shape.lineTo(x + r, y);
      shape.quadraticCurveTo(x, y, x, y + r);

      const depthVal = Math.max(0.01, d - r * 2);
      const extrudeSettings = {
        steps: 1,
        depth: depthVal,
        bevelEnabled: true,
        bevelThickness: r,
        bevelSize: r,
        bevelOffset: 0,
        bevelSegments: 4
      };

      const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      geo.center();
      return geo;
    };

    // A. VEHICLE CHASSIS & AERODYNAMIC HONDA CITY CABIN (Tapered & Rounded for Sedan realism)
    const cabinGroup = new THREE.Group();
    carGroup.add(cabinGroup);

    // Main lower chassis tub with sloped front/rear overhangs - shortened to create a hollow trunk cavity at the rear
    const chassisTubGeo = new THREE.BoxGeometry(1.65, 0.45, 3.0);
    const chassisTub = new THREE.Mesh(chassisTubGeo, interiorMat);
    chassisTub.position.set(0, 0.4, 0.35); // Shifted forward to clear the trunk space
    cabinGroup.add(chassisTub);

    // Aerodynamic Glass Canopy - shaped like the Honda City's fastback roofline
    const canopyGeo = new THREE.BoxGeometry(1.30, 0.65, 2.15);
    const canopyMesh = new THREE.Mesh(canopyGeo, tintedGlassMat);
    canopyMesh.position.set(0, 0.95, -0.15);
    cabinGroup.add(canopyMesh);

    // Premium Glossy Black A, B, and C Window Pillars
    const bPillarGeo = new THREE.BoxGeometry(1.32, 0.65, 0.08);
    const bPillar = new THREE.Mesh(bPillarGeo, interiorMat);
    bPillar.position.set(0, 0.95, -0.15); // Center pillar
    cabinGroup.add(bPillar);

    // Curved Wheel Arches / Wells (Colored in body paint to integrate wheels realistically)
    const archPositions = [
      new THREE.Vector3(-0.86, 0.42, 1.25),
      new THREE.Vector3(0.86, 0.42, 1.25),
      new THREE.Vector3(-0.86, 0.42, -1.25),
      new THREE.Vector3(0.86, 0.42, -1.25)
    ];
    archPositions.forEach(pos => {
      const archGeo = new THREE.RingGeometry(0.36, 0.42, 16);
      archGeo.rotateY(Math.PI / 2);
      const arch = new THREE.Mesh(archGeo, defaultPaintMat);
      arch.position.copy(pos);
      carGroup.add(arch);
    });

    // B. WHEELS, MULTI-SPOKE DIAMOND-CUT RIMS & TYRES
    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.22, 32);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelPositions = [
      new THREE.Vector3(-0.9, 0.35, 1.25),  // Front Left
      new THREE.Vector3(0.9, 0.35, 1.25),   // Front Right
      new THREE.Vector3(-0.9, 0.35, -1.25), // Rear Left
      new THREE.Vector3(0.9, 0.35, -1.25)   // Rear Right
    ];
    wheelPositions.forEach(pos => {
      // Tire
      const wheel = new THREE.Mesh(wheelGeo, tireMat);
      wheel.position.copy(pos);
      carGroup.add(wheel);

      // Multi-spoke sporty alloy rim
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.23, 16), chromeMat);
      rim.rotation.z = Math.PI / 2;
      wheel.add(rim);

      // Sporty Red Caliper Mesh (as in reference image)
      const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.08), caliperMat);
      caliper.position.set(pos.x > 0 ? -0.04 : 0.04, 0.12, 0);
      wheel.add(caliper);

      // Diamond-cut styled spokes
      for (let i = 0; i < 8; i++) {
        const spokeGeo = new THREE.BoxGeometry(0.03, 0.22, 0.03);
        const spoke = new THREE.Mesh(spokeGeo, chromeMat);
        spoke.rotation.x = (i * Math.PI) / 4;
        rim.add(spoke);
      }
    });

    // C. FRONT END: HONDA CITY SOLID WING FACE & LED HEADLAMPS WITH SPORTY BUMPER DESIGN
    const frontBumperGeo = createRoundedBoxGeometry(1.78, 0.42, 0.45, 0.08);
    const frontBumperMesh = registerPanelMesh('bumper_front', frontBumperGeo, defaultPaintMat, undefined, new THREE.Vector3(0, 0.4, 2.0));

    // Sporty Front Bumper Lower Splitter Lip (Dark Chrome finish)
    const frontSplitter = new THREE.Mesh(createRoundedBoxGeometry(1.5, 0.04, 0.3, 0.01), chromeMat);
    frontSplitter.position.set(0, 0.18, 2.05);
    carGroup.add(frontSplitter);

    // Bumper Side Air Vents / Inlets
    const ventL = new THREE.Mesh(createRoundedBoxGeometry(0.18, 0.14, 0.06, 0.01), grilleMat);
    ventL.position.set(-0.62, 0.32, 2.11);
    const ventR = new THREE.Mesh(createRoundedBoxGeometry(0.18, 0.14, 0.06, 0.01), grilleMat);
    ventR.position.set(0.62, 0.32, 2.11);
    carGroup.add(ventL, ventR);

    // Front License Plate Holder
    const frontPlate = new THREE.Mesh(createRoundedBoxGeometry(0.48, 0.11, 0.02, 0.005), chromeMat);
    frontPlate.position.set(0, 0.26, 2.13);
    carGroup.add(frontPlate);

    // Honda Signature "Solid Wing Face" Chrome Grill Bar with horizontal slats
    const chromeGrille = new THREE.Mesh(createRoundedBoxGeometry(1.25, 0.14, 0.06, 0.01), chromeMat);
    chromeGrille.position.set(0, 0.52, 2.11);
    carGroup.add(chromeGrille);

    // 3 Chrome Grille Slats for premium Honda City elegance
    for (let i = 0; i < 3; i++) {
      const slat = new THREE.Mesh(createRoundedBoxGeometry(1.15, 0.02, 0.02, 0.005), chromeMat);
      slat.position.set(0, 0.44 - (i * 0.05), 2.12);
      carGroup.add(slat);
    }

    // Black radiator intake mesh underneath the chrome wing
    const lowerGrille = new THREE.Mesh(createRoundedBoxGeometry(1.1, 0.16, 0.05, 0.01), grilleMat);
    lowerGrille.position.set(0, 0.34, 2.11);
    carGroup.add(lowerGrille);

    // LED Fog Lamp Pods on bumper corners
    const fogL = new THREE.Mesh(createRoundedBoxGeometry(0.12, 0.04, 0.04, 0.01), headlightMat);
    fogL.position.set(-0.58, 0.24, 2.12);
    const fogR = new THREE.Mesh(createRoundedBoxGeometry(0.12, 0.04, 0.04, 0.01), headlightMat);
    fogR.position.set(0.58, 0.24, 2.12);
    carGroup.add(fogL, fogR);

    // TWO HIGHLY PROMINENT ROUND FRONT HEADLIGHT UNITS (Round projector spheres sitting proud on the bumper front face)
    const hlLGeo = new THREE.SphereGeometry(0.12, 32, 32);
    const hlL = new THREE.Mesh(hlLGeo, headlightMat);
    hlL.position.set(-0.55, 0.52, 2.26); // Prominently forward and visible on front bumper
    
    const hlRGeo = new THREE.SphereGeometry(0.12, 32, 32);
    const hlR = new THREE.Mesh(hlRGeo, headlightMat);
    hlR.position.set(0.55, 0.52, 2.26); // Prominently forward and visible on front bumper

    // Elegant chrome surrounding ring plates for the round headlights
    const headlightRingGeo = new THREE.TorusGeometry(0.13, 0.018, 12, 32);
    
    const ringL = new THREE.Mesh(headlightRingGeo, chromeMat);
    ringL.position.set(-0.55, 0.52, 2.25);
    
    const ringR = new THREE.Mesh(headlightRingGeo, chromeMat);
    ringR.position.set(0.55, 0.52, 2.25);
    
    carGroup.add(hlL, hlR, ringL, ringR);

    // D. REAR END: SLEEK DECK TRUNK BUMPER & 3D WRAP-AROUND TAILLIGHTS
    const rearBumperGeo = createRoundedBoxGeometry(1.78, 0.42, 0.45, 0.08);
    registerPanelMesh('bumper_rear', rearBumperGeo, defaultPaintMat, undefined, new THREE.Vector3(0, 0.4, -2.1));

    // Rear Bumper Dark Diffuser (Sporty dual-tone bumper design)
    const rearDiffuser = new THREE.Mesh(createRoundedBoxGeometry(1.5, 0.12, 0.36, 0.02), grilleMat);
    rearDiffuser.position.set(0, 0.24, -2.12);
    carGroup.add(rearDiffuser);

    // Bumper Red Safety Reflectors
    const reflectorL = new THREE.Mesh(createRoundedBoxGeometry(0.16, 0.03, 0.02, 0.005), taillightMat);
    reflectorL.position.set(-0.65, 0.32, -2.13);
    const reflectorR = new THREE.Mesh(createRoundedBoxGeometry(0.16, 0.03, 0.02, 0.005), taillightMat);
    reflectorR.position.set(0.65, 0.32, -2.13);
    carGroup.add(reflectorL, reflectorR);

    // Dual Chrome Exhaust Pipes (Sporty ZX Styling)
    const exhaustL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.16, 8), chromeMat);
    exhaustL.rotation.x = Math.PI / 2;
    exhaustL.position.set(-0.55, 0.18, -2.25);
    const exhaustR = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.16, 8), chromeMat);
    exhaustR.rotation.x = Math.PI / 2;
    exhaustR.position.set(0.55, 0.18, -2.25);
    carGroup.add(exhaustL, exhaustR);

    // Sleek 3D Wrap-Around LED Taillights (with red signature lens)
    const taillightGeo = createRoundedBoxGeometry(0.38, 0.1, 0.08, 0.02);
    const tlL = new THREE.Mesh(taillightGeo, taillightMat);
    tlL.position.set(-0.62, 0.74, -2.25);
    tlL.rotation.y = Math.PI / 12;
    const tlR = new THREE.Mesh(taillightGeo, taillightMat);
    tlR.position.set(0.62, 0.74, -2.25);
    tlR.rotation.y = -Math.PI / 12;
    carGroup.add(tlL, tlR);

    // E. FRONT FENDERS (Sculpted with Side Character Lines)
    const fenderGeo = createRoundedBoxGeometry(0.12, 0.52, 0.82, 0.04);
    registerPanelMesh('fender_lhs', fenderGeo, defaultPaintMat, undefined, new THREE.Vector3(0.82, 0.64, 1.35));
    registerPanelMesh('fender_rhs', fenderGeo, defaultPaintMat, undefined, new THREE.Vector3(-0.82, 0.64, 1.35));

    // F. RUNNING BOARDS (SILL)
    const runningBoardGeo = createRoundedBoxGeometry(0.14, 0.14, 1.6, 0.03);
    registerPanelMesh('running_board_lhs', runningBoardGeo, defaultPaintMat, undefined, new THREE.Vector3(0.82, 0.22, 0));
    registerPanelMesh('running_board_rhs', runningBoardGeo, defaultPaintMat, undefined, new THREE.Vector3(-0.82, 0.22, 0));

    // G. QUARTER PANELS (Contoured rear wheel fenders)
    const quarterGeo = createRoundedBoxGeometry(0.14, 0.58, 0.92, 0.04);
    registerPanelMesh('quarter_panel_lhs', quarterGeo, defaultPaintMat, undefined, new THREE.Vector3(0.82, 0.66, -1.35));
    registerPanelMesh('quarter_panel_rhs', quarterGeo, defaultPaintMat, undefined, new THREE.Vector3(-0.82, 0.66, -1.35));

    // H. ROOF & SHAPED WINDSHIELDS (Sleek coupe outline with Panoramic Sunroof)
    const roofGeo = createRoundedBoxGeometry(1.36, 0.04, 1.5, 0.04);
    const roofMesh = registerPanelMesh('roof', roofGeo, defaultPaintMat, undefined, new THREE.Vector3(0, 1.27, -0.1));

    // Glossy Black Panoramic Sunroof Glass Plate
    const sunroofGeo = createRoundedBoxGeometry(0.95, 0.01, 0.75, 0.02);
    const sunroof = new THREE.Mesh(sunroofGeo, interiorMat);
    sunroof.position.set(0, 0.03, 0.1);
    roofMesh.add(sunroof);

    // Shark-fin Antenna on the back of the roof
    const antennaGeo = new THREE.ConeGeometry(0.05, 0.1, 4);
    antennaGeo.rotateX(Math.PI / 4);
    const antenna = new THREE.Mesh(antennaGeo, chromeMat);
    antenna.position.set(0, 0.08, -0.6);
    roofMesh.add(antenna);

    // Highly sloped windscreens typical of Honda City aerodynamic look
    const wsFrontGeo = createRoundedBoxGeometry(1.3, 0.76, 0.03, 0.02);
    wsFrontGeo.rotateX(-Math.PI / 4.2);
    registerPanelMesh('windshield_front', wsFrontGeo, glassMat, undefined, new THREE.Vector3(0, 1.05, 0.82));

    const wsRearGeo = createRoundedBoxGeometry(1.3, 0.72, 0.03, 0.02);
    wsRearGeo.rotateX(Math.PI / 4.2);
    registerPanelMesh('windshield_rear', wsRearGeo, glassMat, undefined, new THREE.Vector3(0, 1.05, -1.02));

    // Structural Pillars: Pillar A, B, and C (Inside Paint Panels)
    // Pillar A (Front Symmetrical Windshield Pillars) - Made thicker and offset outward to stand proud of glass canopy
    const pillarAGeo = createRoundedBoxGeometry(0.14, 0.54, 0.14, 0.03);
    const pillarAL = registerPanelMesh('pillar_a', pillarAGeo, defaultPaintMat, undefined, new THREE.Vector3(0.70, 1.06, 0.85));
    pillarAL.rotation.set(-0.6, 0, -0.3);
    pillarAL.userData = { panelId: 'pillar_a', isInnerJamb: true };

    const pillarAR = new THREE.Mesh(pillarAGeo, defaultPaintMat.clone());
    pillarAR.position.set(-0.70, 1.06, 0.85);
    pillarAR.rotation.set(-0.6, 0, 0.3);
    pillarAR.userData = { panelId: 'pillar_a', isInnerJamb: true };
    carGroup.add(pillarAR);

    // Pillar B (Middle Passenger Door Structural Pillars) - Made thicker and offset outward to stand proud of static black pillar
    const pillarBGeo = createRoundedBoxGeometry(0.14, 0.57, 0.14, 0.03);
    const pillarBL = registerPanelMesh('pillar_b', pillarBGeo, defaultPaintMat, undefined, new THREE.Vector3(0.71, 0.96, -0.1));
    pillarBL.userData = { panelId: 'pillar_b', isInnerJamb: true };

    const pillarBR = new THREE.Mesh(pillarBGeo, defaultPaintMat.clone());
    pillarBR.position.set(-0.71, 0.96, -0.1);
    pillarBR.userData = { panelId: 'pillar_b', isInnerJamb: true };
    carGroup.add(pillarBR);

    // Pillar C (Rear Symmetrical Fastback Pillars) - Made thicker and offset outward to stand proud of glass canopy
    const pillarCGeo = createRoundedBoxGeometry(0.14, 0.54, 0.18, 0.04);
    const pillarCL = registerPanelMesh('pillar_c', pillarCGeo, defaultPaintMat, undefined, new THREE.Vector3(0.70, 1.03, -0.92));
    pillarCL.rotation.set(0.5, 0, -0.2);
    pillarCL.userData = { panelId: 'pillar_c', isInnerJamb: true };

    const pillarCR = new THREE.Mesh(pillarCGeo, defaultPaintMat.clone());
    pillarCR.position.set(-0.70, 1.03, -0.92);
    pillarCR.rotation.set(0.5, 0, 0.2);
    pillarCR.userData = { panelId: 'pillar_c', isInnerJamb: true };
    carGroup.add(pillarCR);

    // I. ENGINE BAY APRONS, APEX CORES & UNDERBODY
    const apronLhsGeo = createRoundedBoxGeometry(0.28, 0.4, 0.75, 0.04);
    const apronRhsGeo = createRoundedBoxGeometry(0.28, 0.4, 0.75, 0.04);
    registerPanelMesh('apron_lhs', apronLhsGeo, defaultPaintMat, undefined, new THREE.Vector3(-0.5, 0.52, 1.35));
    registerPanelMesh('apron_rhs', apronRhsGeo, defaultPaintMat, undefined, new THREE.Vector3(0.5, 0.52, 1.35));

    const engineBlock = new THREE.Mesh(createRoundedBoxGeometry(0.65, 0.45, 0.65, 0.05), engineMat);
    engineBlock.position.set(0, 0.48, 1.35);
    carGroup.add(engineBlock);

    const underbodyGeo = createRoundedBoxGeometry(1.58, 0.06, 3.65, 0.04);
    registerPanelMesh('underbody', underbodyGeo, defaultPaintMat, undefined, new THREE.Vector3(0, 0.15, 0));

    // J. HONDA DOOR PANELS with Sharp Character Styling Lines & Side Mirrors
    const doorGeo = createRoundedBoxGeometry(0.08, 0.65, 0.74, 0.03);
    const innerJambGeo = createRoundedBoxGeometry(0.06, 0.62, 0.7, 0.02);

    // Decorate doors with chrome handles, crease trims, and sleek Honda side-view mirrors
    const decorateDoor = (doorPivot: THREE.Group, isLhs: boolean, isFront: boolean) => {
      // Body Crease Styling Accent Trim
      const creaseTrim = new THREE.Mesh(createRoundedBoxGeometry(0.02, 0.02, 0.72, 0.005), chromeMat);
      creaseTrim.position.set(isLhs ? -0.06 : 0.06, 0.18, -0.38);
      doorPivot.add(creaseTrim);

      // Sleek Chrome Handle
      const handle = new THREE.Mesh(createRoundedBoxGeometry(0.03, 0.02, 0.12, 0.005), chromeMat);
      handle.position.set(isLhs ? -0.065 : 0.065, 0.08, -0.58);
      doorPivot.add(handle);

      // Aerodynamic side mirrors (front doors only)
      if (isFront) {
        const mirrorGroup = new THREE.Group();
        mirrorGroup.position.set(isLhs ? -0.11 : 0.11, 0.22, -0.05);
        
        const stem = new THREE.Mesh(createRoundedBoxGeometry(0.07, 0.03, 0.03, 0.005), chromeMat);
        const glass = new THREE.Mesh(createRoundedBoxGeometry(0.1, 0.07, 0.14, 0.01), defaultPaintMat);
        glass.position.set(isLhs ? -0.05 : 0.05, 0.02, 0);

        mirrorGroup.add(stem, glass);
        doorPivot.add(mirrorGroup);
      }
    };

    // Door LHS Front Group
    const doorLhsFrontPivot = new THREE.Group();
    doorLhsFrontPivot.position.set(0.8, 0.65, 0.7); // Hinge position
    carGroup.add(doorLhsFrontPivot);
    registerPanelMesh('door_lhs_front', doorGeo, defaultPaintMat, doorLhsFrontPivot, new THREE.Vector3(0, 0, -0.37));
    const innerJambLFR = new THREE.Mesh(innerJambGeo, defaultPaintMat.clone());
    innerJambLFR.position.set(-0.05, 0, -0.37);
    innerJambLFR.userData = { panelId: 'door_lhs_front', isInnerJamb: true };
    doorLhsFrontPivot.add(innerJambLFR);
    decorateDoor(doorLhsFrontPivot, false, true);

    // Door RHS Front Group
    const doorRhsFrontPivot = new THREE.Group();
    doorRhsFrontPivot.position.set(-0.8, 0.65, 0.7);
    carGroup.add(doorRhsFrontPivot);
    registerPanelMesh('door_rhs_front', doorGeo, defaultPaintMat, doorRhsFrontPivot, new THREE.Vector3(0, 0, -0.37));
    const innerJambRFR = new THREE.Mesh(innerJambGeo, defaultPaintMat.clone());
    innerJambRFR.position.set(0.05, 0, -0.37);
    innerJambRFR.userData = { panelId: 'door_rhs_front', isInnerJamb: true };
    doorRhsFrontPivot.add(innerJambRFR);
    decorateDoor(doorRhsFrontPivot, true, true);

    // Door LHS Rear Group
    const doorLhsRearPivot = new THREE.Group();
    doorLhsRearPivot.position.set(0.8, 0.65, -0.04);
    carGroup.add(doorLhsRearPivot);
    registerPanelMesh('door_lhs_rear', doorGeo, defaultPaintMat, doorLhsRearPivot, new THREE.Vector3(0, 0, -0.37));
    const innerJambLRR = new THREE.Mesh(innerJambGeo, defaultPaintMat.clone());
    innerJambLRR.position.set(-0.05, 0, -0.37);
    innerJambLRR.userData = { panelId: 'door_lhs_rear', isInnerJamb: true };
    doorLhsRearPivot.add(innerJambLRR);
    decorateDoor(doorLhsRearPivot, false, false);

    // Door RHS Rear Group
    const doorRhsRearPivot = new THREE.Group();
    doorRhsRearPivot.position.set(-0.8, 0.65, -0.04);
    carGroup.add(doorRhsRearPivot);
    registerPanelMesh('door_rhs_rear', doorGeo, defaultPaintMat, doorRhsRearPivot, new THREE.Vector3(0, 0, -0.37));
    const innerJambRRR = new THREE.Mesh(innerJambGeo, defaultPaintMat.clone());
    innerJambRRR.position.set(0.05, 0, -0.37);
    innerJambRRR.userData = { panelId: 'door_rhs_rear', isInnerJamb: true };
    doorRhsRearPivot.add(innerJambRRR);
    decorateDoor(doorRhsRearPivot, true, false);

    // K. SPORTY HONDA SLOPED BONNET / HOOD (Aerodynamically tapered and elongated - significantly larger than Dicky)
    const bonnetPivot = new THREE.Group();
    bonnetPivot.position.set(0, 0.78, 0.88);
    carGroup.add(bonnetPivot);
    const bonnetGeo = createRoundedBoxGeometry(1.38, 0.04, 1.45, 0.05);
    registerPanelMesh('hood_bonnet', bonnetGeo, defaultPaintMat, bonnetPivot, new THREE.Vector3(0, 0, 0.725));
    
    // Bonnet Inner Panel representing Bonnet Inside Paint
    const innerBonnetGeo = createRoundedBoxGeometry(1.32, 0.03, 1.38, 0.04);
    const innerBonnet = new THREE.Mesh(innerBonnetGeo, defaultPaintMat.clone());
    innerBonnet.position.set(0, -0.025, 0.725);
    innerBonnet.userData = { panelId: 'hood_bonnet', isInnerJamb: true };
    bonnetPivot.add(innerBonnet);

    // L. NOTCHBACK REAR TRUNK / DICKY (Thinner, longer deck lid that covers the inside boot floor nicely)
    const bootPivot = new THREE.Group();
    bootPivot.position.set(0, 0.95, -1.32);
    carGroup.add(bootPivot);
    const bootGeo = createRoundedBoxGeometry(1.38, 0.008, 0.96, 0.003);
    registerPanelMesh('boot_trunk', bootGeo, defaultPaintMat, bootPivot, new THREE.Vector3(0, -0.004, -0.48));

    // Dicky Inner Panel representing Dicky Inside Paint
    const innerBootGeo = createRoundedBoxGeometry(1.34, 0.006, 0.92, 0.002);
    const innerBoot = new THREE.Mesh(innerBootGeo, defaultPaintMat.clone());
    innerBoot.position.set(0, -0.012, -0.48);
    innerBoot.userData = { panelId: 'boot_trunk', isInnerJamb: true };
    bootPivot.add(innerBoot);

    // Sleek Selectable Rear Spoiler on trunk lid (rotates with bootPivot)
    const spoilerGeo = createRoundedBoxGeometry(1.4, 0.03, 0.12, 0.01);
    const spoilerMesh = registerPanelMesh('spoiler', spoilerGeo, defaultPaintMat, bootPivot, new THREE.Vector3(0, 0.014, -0.92));

    const bootFloorGeo = createRoundedBoxGeometry(1.34, 0.20, 0.92, 0.03);
    const bootFloor = registerPanelMesh('boot_floor', bootFloorGeo, defaultPaintMat, undefined, new THREE.Vector3(0, 0.52, -1.65));
    bootFloor.userData = { panelId: 'boot_floor', isInnerJamb: true };

    hingedGroupsRef.current = {
      doorLhsFront: doorLhsFrontPivot,
      doorRhsFront: doorRhsFrontPivot,
      doorLhsRear: doorLhsRearPivot,
      doorRhsRear: doorRhsRearPivot,
      hoodBonnet: bonnetPivot,
      bootTrunk: bootPivot
    };

    // Pre-populate list of raycastable panel meshes for high performance hover/click without traversing
    const allSelectableMeshes: THREE.Mesh[] = [];
    carGroup.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && child.userData && child.userData.panelId) {
        allSelectableMeshes.push(child as THREE.Mesh);
      }
    });
    selectableMeshesRef.current = allSelectableMeshes;

    // 7. Raycasting & Mouse/Touch Interaction Setup
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const targetFocus = targetFocusRef.current;
    let isMouseDown = false;
    let isPanning = false;
    let previousMousePosition = { x: 0, y: 0 };
    let lastHoverRaycastTime = 0;

    // Pinch & mobile zoom/pan trackers
    let previousTouchDistance = 0;
    let previousTouchMidpoint = { x: 0, y: 0 };

    let touchStartInfo = { x: 0, y: 0, time: 0, isTap: false };
    let lastTouchTime = 0;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      requestRender(45);
      if ('touches' in e) {
        lastTouchTime = Date.now();
      } else if (Date.now() - lastTouchTime < 500) {
        return;
      }

      const clientX = 'touches' in e ? (e.touches.length > 0 ? e.touches[0].clientX : 0) : e.clientX;
      const clientY = 'touches' in e ? (e.touches.length > 0 ? e.touches[0].clientY : 0) : e.clientY;
      touchStartInfo = { x: clientX, y: clientY, time: Date.now(), isTap: true };

      if ('touches' in e) {
        if (e.touches.length === 1) {
          isMouseDown = true;
          isPanning = false;
          previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e.touches.length === 2) {
          isMouseDown = false;
          isPanning = true;
          touchStartInfo.isTap = false;
          // Calculate initial touch distance
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          previousTouchDistance = Math.sqrt(dx * dx + dy * dy);

          // Calculate initial touch midpoint
          previousTouchMidpoint = {
            x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
            y: (e.touches[0].clientY + e.touches[1].clientY) / 2
          };
        }
      } else {
        isMouseDown = true;
        // Right click (button 2) or Shift + Left click activates Pan Mode
        isPanning = (e.button === 2 || e.shiftKey);
        if (isPanning) touchStartInfo.isTap = false;
        previousMousePosition = { x: e.clientX, y: e.clientY };
      }
    };

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!('touches' in e) && Date.now() - lastTouchTime < 500) {
        return;
      }
      const rect = renderer.domElement.getBoundingClientRect();
      const clientX = 'touches' in e ? (e.touches.length > 0 ? e.touches[0].clientX : 0) : e.clientX;
      const clientY = 'touches' in e ? (e.touches.length > 0 ? e.touches[0].clientY : 0) : e.clientY;

      if (touchStartInfo.isTap && Math.hypot(clientX - touchStartInfo.x, clientY - touchStartInfo.y) > 12) {
        touchStartInfo.isTap = false;
      }

      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      if ('touches' in e && e.touches.length === 2) {
        // Pinch-to-zoom and two-finger translation pan
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];

        // A. PINCH ZOOM
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        const currentTouchDistance = Math.sqrt(dx * dx + dy * dy);

        if (previousTouchDistance > 0) {
          const pinchDelta = currentTouchDistance - previousTouchDistance;
          const zoomSpeed = 0.008;
          _tmpDir.subVectors(camera.position, targetFocus).normalize();
          const dist = camera.position.distanceTo(targetFocus);
          const newDist = Math.max(1.8, Math.min(14.0, dist - pinchDelta * zoomSpeed));
          camera.position.copy(_tmpDir.multiplyScalar(newDist).add(targetFocus));
          targetCamPosRef.current.copy(camera.position);
          requestRender(20);
        }
        previousTouchDistance = currentTouchDistance;

        // B. TWO FINGER PAN (Translation)
        const currentMidpointX = (touch1.clientX + touch2.clientX) / 2;
        const currentMidpointY = (touch1.clientY + touch2.clientY) / 2;
        if (previousTouchMidpoint.x > 0 && previousTouchMidpoint.y > 0) {
          const mdx = currentMidpointX - previousTouchMidpoint.x;
          const mdy = currentMidpointY - previousTouchMidpoint.y;

          const panSpeed = 0.005;
          _tmpRight.setFromMatrixColumn(camera.matrix, 0).normalize();
          _tmpUp.setFromMatrixColumn(camera.matrix, 1).normalize();

          targetFocus.addScaledVector(_tmpRight, -mdx * panSpeed);
          targetFocus.addScaledVector(_tmpUp, mdy * panSpeed);
          targetFocusPosRef.current.copy(targetFocus);
          camera.position.addScaledVector(_tmpRight, -mdx * panSpeed);
          camera.position.addScaledVector(_tmpUp, mdy * panSpeed);
          targetCamPosRef.current.copy(camera.position);
          requestRender(20);
        }
        previousTouchMidpoint = { x: currentMidpointX, y: currentMidpointY };

      } else if (isMouseDown) {
        // Mouse drag rotation or mouse panning
        const deltaX = clientX - previousMousePosition.x;
        const deltaY = clientY - previousMousePosition.y;

        if (isPanning) {
          // Pan camera focus target
          const panSpeed = 0.006;
          _tmpRight.setFromMatrixColumn(camera.matrix, 0).normalize();
          _tmpUp.setFromMatrixColumn(camera.matrix, 1).normalize();

          targetFocus.addScaledVector(_tmpRight, -deltaX * panSpeed);
          targetFocus.addScaledVector(_tmpUp, deltaY * panSpeed);
          targetFocusPosRef.current.copy(targetFocus);
          camera.position.addScaledVector(_tmpRight, -deltaX * panSpeed);
          camera.position.addScaledVector(_tmpUp, deltaY * panSpeed);
          targetCamPosRef.current.copy(camera.position);
        } else {
          // Standard rotation
          carGroup.rotation.y += deltaX * 0.008;
          carGroup.rotation.x = Math.max(-0.8, Math.min(0.8, carGroup.rotation.x + deltaY * 0.008));
        }

        previousMousePosition = { x: clientX, y: clientY };
        requestRender(20);
      } else {
        // Throttled Hover Raycast (at most once every 50ms)
        const now = Date.now();
        if (now - lastHoverRaycastTime > 50) {
          lastHoverRaycastTime = now;
          raycaster.setFromCamera(mouse, camera);
          const selectable = selectableMeshesRef.current.filter(m => m.visible);
          const intersects = raycaster.intersectObjects(selectable, false);
          if (intersects.length > 0) {
            let hit = intersects[0].object;
            if (
              dickyOpenRef.current &&
              hit.userData?.panelId === 'windshield_rear' &&
              intersects[1]?.object?.userData?.panelId === 'boot_floor'
            ) {
              hit = intersects[1].object;
            }
            if (hit.userData && hit.userData.panelId) {
              const pId = hit.userData.panelId;
              setHoveredPanelId(prev => {
                if (prev !== pId) {
                  requestRender(15);
                  return pId;
                }
                return prev;
              });
            }
          } else {
            setHoveredPanelId(prev => {
              if (prev !== null) {
                requestRender(15);
                return null;
              }
              return prev;
            });
          }
        }
      }
    };

    const processClickOrTap = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const selectable = selectableMeshesRef.current.filter(m => m.visible);
      const intersects = raycaster.intersectObjects(selectable, false);
      if (intersects.length > 0) {
        let hit = intersects[0].object;
        if (
          dickyOpenRef.current &&
          hit.userData?.panelId === 'windshield_rear' &&
          intersects[1]?.object?.userData?.panelId === 'boot_floor'
        ) {
          hit = intersects[1].object;
        }
        if (hit.userData && hit.userData.panelId) {
          handlePanelClickRef.current(hit.userData.panelId);
          requestRender(30);
        }
      }
    };

    const handlePointerUp = (e: MouseEvent | TouchEvent) => {
      requestRender(30);
      if ('changedTouches' in e) {
        lastTouchTime = Date.now();
      } else if (Date.now() - lastTouchTime < 500) {
        isMouseDown = false;
        isPanning = false;
        touchStartInfo.isTap = false;
        return;
      }

      const wasTap = touchStartInfo.isTap;
      touchStartInfo.isTap = false;

      const duration = Date.now() - touchStartInfo.time;
      if (wasTap && duration < 800) {
        const clientX = 'changedTouches' in e && e.changedTouches.length > 0
          ? e.changedTouches[0].clientX
          : touchStartInfo.x;
        const clientY = 'changedTouches' in e && e.changedTouches.length > 0
          ? e.changedTouches[0].clientY
          : touchStartInfo.y;
        processClickOrTap(clientX, clientY);
      }

      isMouseDown = false;
      isPanning = false;
      previousTouchDistance = 0;
      previousTouchMidpoint = { x: 0, y: 0 };
    };

    const handleCanvasClick = (e: MouseEvent) => {
      if (e.button === 2 || e.shiftKey) return;
    };

    // Zoom via mouse wheel scroll
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomSpeed = 0.005;
      _tmpDir.subVectors(camera.position, targetFocus).normalize();
      const dist = camera.position.distanceTo(targetFocus);
      const newDist = Math.max(2.0, Math.min(12.0, dist + e.deltaY * zoomSpeed));
      camera.position.copy(_tmpDir.multiplyScalar(newDist).add(targetFocus));
      targetCamPosRef.current.copy(camera.position);
      requestRender(25);
    };

    // Prevent default right-click menu within WebGL container
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('mousedown', handlePointerDown);
    domElem.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    domElem.addEventListener('click', handleCanvasClick);
    domElem.addEventListener('wheel', handleWheel, { passive: false });
    domElem.addEventListener('contextmenu', handleContextMenu);

    domElem.addEventListener('touchstart', handlePointerDown);
    domElem.addEventListener('touchmove', handlePointerMove);
    window.addEventListener('touchend', handlePointerUp);

    // 8. On-Demand Render Loop with Eco-Thermal Optimization (Zero CPU/GPU heating)
    let animationFrameId: number = 0;
    let renderFramesRemaining = 120; // Initial gentle ~2s intro showcase, then rests
    let isLoopActive = false;
    let isIntersecting = true;
    let isDocVisible = !document.hidden;

    const requestRender = (frames = 30) => {
      renderFramesRemaining = Math.max(renderFramesRemaining, frames);
      if (!isLoopActive && isIntersecting && isDocVisible) {
        isLoopActive = true;
        animationFrameId = requestAnimationFrame(animate);
      }
    };
    requestRenderRef.current = requestRender;

    const animate = () => {
      // Abort if tab is hidden or element is offscreen to preserve zero CPU/GPU cycles
      if (!isIntersecting || !isDocVisible) {
        isLoopActive = false;
        return;
      }

      // Smooth camera interpolation towards target position & focus
      let isCamMoving = false;
      const camDist = camera.position.distanceTo(targetCamPosRef.current);
      if (camDist > 0.01) {
        isCamMoving = true;
        camera.position.lerp(targetCamPosRef.current, 0.14);
      } else {
        camera.position.copy(targetCamPosRef.current);
      }

      const focusDist = targetFocus.distanceTo(targetFocusPosRef.current);
      if (focusDist > 0.005) {
        isCamMoving = true;
        targetFocus.lerp(targetFocusPosRef.current, 0.14);
      } else {
        targetFocus.copy(targetFocusPosRef.current);
      }

      // Smooth door / bonnet / boot opening hinge transitions
      let isHingesMoving = false;
      const h = hingedGroupsRef.current;
      if (h) {
        const t = targetHingeAnglesRef.current;
        const lerpAngle = (curr: number, tgt: number) => {
          const diff = tgt - curr;
          if (Math.abs(diff) > 0.003) {
            isHingesMoving = true;
            return curr + diff * 0.18;
          }
          return tgt;
        };
        if (h.doorLhsFront) h.doorLhsFront.rotation.y = lerpAngle(h.doorLhsFront.rotation.y, t.doorLhs);
        if (h.doorRhsFront) h.doorRhsFront.rotation.y = lerpAngle(h.doorRhsFront.rotation.y, t.doorRhs);
        if (h.doorLhsRear) h.doorLhsRear.rotation.y = lerpAngle(h.doorLhsRear.rotation.y, t.doorLhs);
        if (h.doorRhsRear) h.doorRhsRear.rotation.y = lerpAngle(h.doorRhsRear.rotation.y, t.doorRhs);
        if (h.hoodBonnet) h.hoodBonnet.rotation.x = lerpAngle(h.hoodBonnet.rotation.x, t.bonnet);
        if (h.bootTrunk) h.bootTrunk.rotation.x = lerpAngle(h.bootTrunk.rotation.x, t.boot);
      }

      // Gentle intro spin only during initial presentation frames
      if (renderFramesRemaining > 40 && !isMouseDown && !isPanning) {
        carGroup.rotation.y += 0.0012;
      }

      camera.lookAt(targetFocus);
      renderer.render(scene, camera);

      if (renderFramesRemaining > 0) {
        renderFramesRemaining--;
      }

      // Check whether next frame is needed
      const hasPendingMotion = isMouseDown || isPanning || isCamMoving || isHingesMoving || renderFramesRemaining > 0;
      if (hasPendingMotion) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        isLoopActive = false; // Gracefully pauses rendering until next user action
      }
    };

    // Start initial intro frame
    isLoopActive = true;
    animationFrameId = requestAnimationFrame(animate);

    // Responsive Canvas Resize Observer
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && container) {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentRect.width;
          const h = compact ? 360 : 480;
          if (w > 0 && camera && renderer) {
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
            requestRender(5);
          }
        }
      });
      resizeObserver.observe(container);
    }

    // Visibility & Intersection Observers
    let intersectionObserver: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined' && container) {
      intersectionObserver = new IntersectionObserver((entries) => {
        const entry = entries[0];
        isIntersecting = entry.isIntersecting;
        if (isIntersecting) {
          requestRender(30);
        }
      }, { threshold: 0.05 });
      intersectionObserver.observe(container);
    }

    const handleVisibilityChange = () => {
      isDocVisible = !document.hidden;
      if (isDocVisible) {
        requestRender(30);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Clean up
    return () => {
      cancelAnimationFrame(animationFrameId);
      if (resizeObserver) resizeObserver.disconnect();
      if (intersectionObserver) intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      domElem.removeEventListener('mousedown', handlePointerDown);
      domElem.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      domElem.removeEventListener('click', handleCanvasClick);
      domElem.removeEventListener('wheel', handleWheel);
      domElem.removeEventListener('contextmenu', handleContextMenu);
      domElem.removeEventListener('touchstart', handlePointerDown);
      domElem.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);

      // Deep dispose all geometries, materials, and textures across the 3D scene to free mobile VRAM
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          if (mesh.material) {
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((mat) => {
                if ((mat as any).map) (mat as any).map.dispose();
                mat.dispose();
              });
            } else {
              if ((mesh.material as any).map) (mesh.material as any).map.dispose();
              mesh.material.dispose();
            }
          }
        }
      });

      renderer.dispose();
      if (renderer.forceContextLoss) {
        renderer.forceContextLoss();
      }
      container.innerHTML = '';
    };
  }, [compact]);

  // Update Door/Bonnet/Boot Open Hinges Animation
  useEffect(() => {
    // Smooth target angles
    const doorAngleLHS = doorsOpen ? Math.PI / 3 : 0;
    const doorAngleRHS = doorsOpen ? -Math.PI / 3 : 0;
    const bonnetAngle = bonnetOpen ? -Math.PI / 3.5 : 0;
    const bootAngle = dickyOpen ? Math.PI / 3.2 : 0;

    targetHingeAnglesRef.current = {
      doorLhs: doorAngleRHS,
      doorRhs: doorAngleLHS,
      bonnet: bonnetAngle,
      boot: bootAngle
    };
    requestRenderRef.current(45);
  }, [doorsOpen, bonnetOpen, dickyOpen]);

  // Track panel switches to reactivate floating pill
  useEffect(() => {
    if (activePanelId) {
      if (activePanelId !== previousPanelIdRef.current) {
        setIsPillDismissed(false); // Reset dismissal when shifting to a different panel
        previousPanelIdRef.current = activePanelId;
      }
    } else {
      previousPanelIdRef.current = null;
    }
    requestRenderRef.current(20);
  }, [activePanelId]);

  // Automatically clear selected 3D panel floating pill after timeout (disabled in AR mode so controls remain accessible)
  useEffect(() => {
    if (activePanelId && !isPillDismissed) {
      if (isArMode) {
        // Keep active panel and scope selector visible in AR mode so user can comfortably inspect and choose scope
        return;
      }
      const timer = setTimeout(() => {
        setIsPillDismissed(true);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [activePanelId, isPillDismissed, isArMode]);

  // Update Camera Preset Views
  useEffect(() => {
    switch (cameraPreset) {
      case 'ISO':
        targetCamPosRef.current.set(4.5, 2.5, 5.5);
        targetFocusPosRef.current.set(0, 0.4, 0);
        break;
      case 'FRONT':
        targetCamPosRef.current.set(0, 1.2, 5.5);
        targetFocusPosRef.current.set(0, 0.5, 1.2);
        break;
      case 'REAR':
        targetCamPosRef.current.set(0, 1.2, -5.5);
        targetFocusPosRef.current.set(0, 0.5, -1.2);
        break;
      case 'LHS':
        targetCamPosRef.current.set(-5.5, 1.2, 0);
        targetFocusPosRef.current.set(0, 0.6, 0);
        break;
      case 'RHS':
        targetCamPosRef.current.set(5.5, 1.2, 0);
        targetFocusPosRef.current.set(0, 0.6, 0);
        break;
      case 'TOP':
        targetCamPosRef.current.set(0, 7.5, 0.01);
        targetFocusPosRef.current.set(0, 0.4, 0);
        break;
      case 'UNDERBODY':
        targetCamPosRef.current.set(0, -4.5, 0.1);
        targetFocusPosRef.current.set(0, 0.4, 0);
        break;
    }
    requestRenderRef.current(50);
  }, [cameraPreset]);

  // Update Component Isolation & Mesh Visibility in real-time
  useEffect(() => {
    const carGroup = carGroupRef.current;
    if (!carGroup) return;

    // Mapping of visual control panel components to core 3D panel IDs
    const groupPanelIds: Record<string, string[]> = {
      'Bonnet': ['hood_bonnet'],
      'Dicky': ['boot_trunk', 'boot_floor'],
      'Doors': ['door_lhs_front', 'door_rhs_front', 'door_lhs_rear', 'door_rhs_rear'],
      'Apron': ['apron_lhs', 'apron_rhs'],
      'Underbody': ['underbody'],
    };

    const targetIds = isolatedComponent ? groupPanelIds[isolatedComponent] : null;

    carGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (isolatedComponent) {
          let shouldKeepVisible = false;

          // Check if this child mesh or any parent group is part of the isolation target
          let current: THREE.Object3D | null = child;
          while (current) {
            if (current.userData && current.userData.panelId) {
              if (targetIds?.includes(current.userData.panelId)) {
                shouldKeepVisible = true;
                break;
              }
            }
            current = current.parent;
          }

          // Special exception: preserve inner jamb highlights when door is isolated
          if (isolatedComponent === 'Doors' && child.userData && child.userData.isInnerJamb) {
            shouldKeepVisible = true;
          }

          if (child.userData?.panelId === 'boot_floor') {
            shouldKeepVisible = shouldKeepVisible && dickyOpen;
          }

          child.visible = shouldKeepVisible;
        } else {
          // No active isolation: keep outer panels visible; internal/underbody panels visible when open or selected
          const pId = child.userData?.panelId;
          const isSelected = Boolean(pId && (effectiveInspections[pId]?.selected || selectedPanelIds.includes(pId)));
          if (pId === 'boot_floor') {
            child.visible = dickyOpen || isSelected;
          } else if (pId === 'apron_lhs' || pId === 'apron_rhs') {
            child.visible = bonnetOpen || isSelected;
          } else if (pId === 'underbody') {
            child.visible = cameraPreset === 'UNDERBODY' || isSelected;
          } else {
            child.visible = true;
          }
        }
      }
    });

    // Auto-adjust cameras for the best inspection view of the isolated part
    if (isolatedComponent === 'Underbody') {
      setCameraPreset('UNDERBODY');
    } else if (isolatedComponent === 'Bonnet') {
      setCameraPreset('FRONT');
    } else if (isolatedComponent === 'Dicky') {
      setCameraPreset('REAR');
    } else    if (isolatedComponent === 'Doors') {
      setCameraPreset('ISO');
    }
    requestRenderRef.current(30);
  }, [isolatedComponent, dickyOpen, bonnetOpen, cameraPreset, effectiveInspections, selectedPanelIds]);

  // Handle AR Camera Feed Stream allocation and release
  useEffect(() => {
    if (isArMode) {
      setCameraPermissionError(false);
      navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Rear-facing camera of device
      })
      .then((stream) => {
        setArStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((err) => {
        console.error("AR Mode camera connection failed:", err);
        setCameraPermissionError(true);
        setIsArMode(false);
      });
    } else {
      if (arStream) {
        arStream.getTracks().forEach(track => track.stop());
        setArStream(null);
      }
    }

    return () => {
      if (arStream) {
        arStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isArMode]);

  // Adjust Three.js Scene background transparently when AR mode is active
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (isArMode) {
      // Clear background color and fog to allow DOM background video feed to show through
      scene.background = null;
      scene.fog = null;
    } else {
      // Re-apply premium light grey showroom studio background
      scene.background = new THREE.Color(0xe2e8f0);
      scene.fog = new THREE.FogExp2(0xe2e8f0, 0.02);
    }
    requestRenderRef.current(20);
  }, [isArMode]);

  // Update Material Colors based on Selected Inspections & Paint Scope
  useEffect(() => {
    const carGroup = carGroupRef.current;
    if (!carGroup) return;

    carGroup.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const panelId = mesh.userData?.panelId;
      if (!panelId) return;

      const inspection = effectiveInspections[panelId];
      const isSelected = inspection !== undefined ? Boolean(inspection.selected) : selectedPanelIds.includes(panelId);
      const isHovered = hoveredPanelId === panelId;
      const scope: PaintScope = inspection?.paintScope || 'FULL_OUTER';

      const isInnerJamb = mesh.userData?.isInnerJamb === true;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (!mat) return;

      if (!isSelected) {
        if (mat.map) mat.map = null;
        if (isHovered) {
          // Hovered unselected panel: Subtle cyan glow highlight
          mat.color.setHex(0xe2e8f0);
          mat.emissive.setHex(0x0284c7);
          mat.emissiveIntensity = 0.4;
        } else {
          // Unselected default premium Pearl White finish
          mat.color.setHex(0xf8fafc);
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0;
        }
      } else {
        // Selected Panel: High-contrast Paint Scope Highlights based on user instructions
        switch (scope) {
          case 'PARTIAL_TOUCHUP':
            if (isInnerJamb) {
              if (mat.map) mat.map = null;
              mat.color.setHex(0xf8fafc);
              mat.emissive.setHex(0x000000);
              mat.emissiveIntensity = 0;
            } else {
              // Cached half-color texture prevents garbage collector thrashing
              const tex = getCachedHalfColorTexture('#06b6d4');
              mat.map = tex;
              mat.color.setHex(0xffffff);
              mat.emissive.setHex(0x082f49);
              mat.emissiveIntensity = isHovered ? 0.8 : 0.4;
            }
            break;

          case 'INSIDE_JAMB':
            if (mat.map) mat.map = null;
            if (isInnerJamb) {
              mat.color.setHex(0x10b981);
              mat.emissive.setHex(0x064e3b);
              mat.emissiveIntensity = isHovered ? 0.8 : 0.4;
            } else {
              mat.color.setHex(0xf8fafc);
              mat.emissive.setHex(0x000000);
              mat.emissiveIntensity = 0;
            }
            break;

          case 'FULL_OUTER_AND_INSIDE':
            if (mat.map) mat.map = null;
            mat.color.setHex(0xeab308);
            mat.emissive.setHex(0x713f12);
            mat.emissiveIntensity = isHovered ? 0.8 : 0.4;
            break;

          case 'FULL_OUTER':
          default:
            if (mat.map) mat.map = null;
            if (isInnerJamb) {
              mat.color.setHex(0xf8fafc);
              mat.emissive.setHex(0x000000);
              mat.emissiveIntensity = 0;
            } else {
              mat.color.setHex(0xf59e0b);
              mat.emissive.setHex(0x78350f);
              mat.emissiveIntensity = isHovered ? 0.8 : 0.4;
            }
            break;
        }
      }
      mat.needsUpdate = true;
    });
    requestRenderRef.current(15);
  }, [effectiveInspections, selectedPanelIds, hoveredPanelId]);

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-2xl space-y-4">
      
      {/* Top Header & View Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" title="Eco-Thermal Optimized: Zero Idle CPU/GPU Load" />
            <h3 className="font-extrabold text-sm sm:text-base text-white">
              🚘 3D Vehicle Interactive Inspector (दरवाजा खोलकर अंदर पेंट देखें)
            </h3>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-[10px] font-bold text-emerald-400">
              ❄️ Cool & Eco-Optimized
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            3D गाड़ी को घुमाएं, दरवाजे/बोनट खोलें और अंदर (Inside Paint), बाहर (Outer Paint) या partial पेंट समझें।
          </p>
        </div>

        {/* Preset Angle Buttons */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {[
            { id: 'ISO', label: '3D ISO View', icon: '🧊' },
            { id: 'FRONT', label: 'Front / बोनट', icon: '🚘' },
            { id: 'LHS', label: 'Left (बायां - Passenger Side)', icon: '👈' },
            { id: 'RHS', label: 'Right (दायां - Driver Side)', icon: '👉' },
            { id: 'REAR', label: 'Rear / डिकी', icon: '🚗' },
            { id: 'UNDERBODY', label: 'Underbody / फर्श', icon: '⚡' },
          ].map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setCameraPreset(p.id as any)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
                cameraPreset === p.id
                  ? 'bg-amber-500 text-slate-950 font-black shadow'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>{p.icon}</span>
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Door & Opening Mechanics Toggle Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-950/80 rounded-xl border border-slate-800">
        <span className="text-xs font-extrabold text-amber-300 flex items-center gap-1.5">
          <Wrench className="w-3.5 h-3.5 text-amber-400" />
          पार्ट्स खोलकर देखें (Opening Parts Controls):
        </span>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setDoorsOpen(!doorsOpen)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              doorsOpen
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <span>🚪</span>
            <span>{doorsOpen ? '4 दरवाजे खुले हैं (Doors Open)' : '4 दरवाजे बंद हैं (Doors Closed)'}</span>
          </button>

          <button
            type="button"
            onClick={() => setBonnetOpen(!bonnetOpen)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              bonnetOpen
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <span>⚡</span>
            <span>{bonnetOpen ? 'बोनट खुला (Engine & Apron)' : 'बोनट खोलें (Open Hood)'}</span>
          </button>

          <button
            type="button"
            onClick={() => setDickyOpen(!dickyOpen)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              dickyOpen
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <span>📦</span>
            <span>{dickyOpen ? 'डिक्की खुली (Boot Floor)' : 'डिक्की खोलें (Open Trunk)'}</span>
          </button>
        </div>
      </div>

      {/* 3D Canvas Viewport & Sidebar Control Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* 3D Canvas Viewport */}
        <div className="lg:col-span-3 relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
          {/* Real-world Live Camera feed for AR overlay behind the 3D canvas */}
          {isArMode && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
            />
          )}

          <div ref={mountRef} className="relative w-full h-[380px] sm:h-[460px] cursor-grab active:cursor-grabbing z-10" />

          {/* Hovered / Active Panel Floating Overlay with Direct Scope Selection (Partial, Outer, Inner, Outer + Inner) */}
          {activePanelObj && !isPillDismissed && (
            <div className="absolute bottom-2 sm:bottom-4 left-2 right-2 sm:left-1/2 sm:-translate-x-1/2 sm:w-auto sm:min-w-[460px] max-w-xl bg-slate-900/95 backdrop-blur-md p-3 rounded-2xl border border-amber-500/40 shadow-2xl space-y-2.5 z-20 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[9.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                    isPanelActive(activePanelObj.id)
                      ? currentScope === 'PARTIAL_TOUCHUP'
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        : currentScope === 'INSIDE_JAMB'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : currentScope === 'FULL_OUTER_AND_INSIDE'
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {isPanelActive(activePanelObj.id) ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                        <span>✓ {currentScope === 'PARTIAL_TOUCHUP' ? 'Partial Touchup (आधा)' : currentScope === 'INSIDE_JAMB' ? 'Inside Paint (अंदर)' : currentScope === 'FULL_OUTER_AND_INSIDE' ? 'Outer + Inside (दोनों)' : 'Full Outer (बाहर)'}</span>
                      </>
                    ) : (
                      <span>+ चुनें और पेंट स्कोप सेट करें</span>
                    )}
                  </span>
                  {isArMode && (
                    <span className="text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-1">
                      <span>🎥</span> AR View
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {(onInspectionChange || onPanelToggle) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePanelClick(activePanelObj.id);
                      }}
                      className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black transition-all cursor-pointer whitespace-nowrap ${
                        isPanelActive(activePanelObj.id)
                          ? 'bg-rose-600/80 hover:bg-rose-600 text-white border border-rose-500/50'
                          : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold'
                      }`}
                    >
                      {isPanelActive(activePanelObj.id) ? '✕ हटाएं (Deselect)' : '+ जोड़ें (Select)'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsPillDismissed(true);
                      setActivePanelId(null);
                    }}
                    className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Dismiss"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Panel Titles */}
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs sm:text-sm font-black text-white">{activePanelObj.nameHi}</span>
                  <span className="text-[11px] font-mono text-slate-300 font-semibold">{activePanelObj.nameEn}</span>
                </div>
                <button
                  type="button"
                  onClick={() => speakPanelInfo(activePanelObj)}
                  className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 shrink-0"
                >
                  <Volume2 className="w-3 h-3" />
                  <span>सुनिए</span>
                </button>
              </div>

              {/* Quick Paint Scope Selector: Full Outer, Inner, Partial, Outer + Inner */}
              <div className="grid grid-cols-4 gap-1.5 pt-1.5 border-t border-slate-800">
                {(() => {
                  const isInsideOnlyPanel = activePanelObj.id.startsWith('pillar_') || activePanelObj.id === 'boot_floor';
                  const outerRates = getPanelEnvironmentRates(activePanelObj.id, effectiveStandardJobs, isCars24, 'FULL_OUTER');
                  const innerRates = getPanelEnvironmentRates(activePanelObj.id, effectiveStandardJobs, isCars24, 'INSIDE_JAMB');
                  const partialRates = getPanelEnvironmentRates(activePanelObj.id, effectiveStandardJobs, isCars24, 'PARTIAL_TOUCHUP');
                  const outerInnerRates = getPanelEnvironmentRates(activePanelObj.id, effectiveStandardJobs, isCars24, 'FULL_OUTER_AND_INSIDE');

                  const scopesConfig = [
                    {
                      id: 'FULL_OUTER' as PaintScope,
                      label: 'Full Outer',
                      sub: 'बाहर पूरा',
                      icon: '✨',
                      price: outerRates.price,
                      disabled: isInsideOnlyPanel,
                      activeClass: 'border-amber-400 bg-amber-500 text-slate-950 ring-2 ring-amber-400/50'
                    },
                    {
                      id: 'INSIDE_JAMB' as PaintScope,
                      label: 'Inner Paint',
                      sub: 'अंदर पिलर',
                      icon: '🚪',
                      price: innerRates.price,
                      disabled: false,
                      activeClass: 'border-emerald-400 bg-emerald-500 text-slate-950 ring-2 ring-emerald-400/50'
                    },
                    {
                      id: 'PARTIAL_TOUCHUP' as PaintScope,
                      label: 'Partial Paint',
                      sub: 'आधा / टचअप',
                      icon: '🎨',
                      price: partialRates.price,
                      disabled: isInsideOnlyPanel || !isPartialPaintAllowedForPanel(activePanelObj.id),
                      activeClass: 'border-cyan-400 bg-cyan-500 text-slate-950 ring-2 ring-cyan-400/50'
                    },
                    {
                      id: 'FULL_OUTER_AND_INSIDE' as PaintScope,
                      label: 'Outer + Inner',
                      sub: 'दोनों',
                      icon: '🌟',
                      price: outerInnerRates.price,
                      disabled: isInsideOnlyPanel,
                      activeClass: 'border-purple-400 bg-purple-500 text-white ring-2 ring-purple-400/50'
                    }
                  ];

                  return scopesConfig.map(s => {
                    const isPanelSelected = isPanelActive(activePanelObj.id);
                    const isSelected = isPanelSelected && currentScope === s.id;
                    const isDefault = !isPanelSelected && s.id === 'FULL_OUTER';

                    return (
                      <button
                        key={s.id}
                        type="button"
                        disabled={s.disabled}
                        onClick={(e) => {
                          e.stopPropagation();
                          const isInsideScope = s.id === 'INSIDE_JAMB' || s.id === 'FULL_OUTER_AND_INSIDE';
                          if (isInsideScope) {
                            if (activePanelObj.id === 'hood_bonnet' && !bonnetOpen) {
                              setBonnetOpen(true);
                            }
                            if (activePanelObj.id === 'boot_trunk' && !dickyOpen) {
                              setDickyOpen(true);
                            }
                          }
                          handlePanelClick(activePanelObj.id, s.id);
                        }}
                        className={`p-1.5 rounded-xl font-black text-[10px] sm:text-xs transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
                          s.disabled
                            ? 'bg-slate-950/40 text-slate-600 border border-slate-800/40 cursor-not-allowed opacity-35'
                            : isSelected
                            ? `${s.activeClass} shadow-lg font-black`
                            : isDefault
                            ? 'bg-slate-850 text-amber-300 border border-amber-500/50 hover:bg-slate-800'
                            : 'bg-slate-800/90 text-slate-300 border border-slate-700/80 hover:bg-slate-750 hover:border-slate-500 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <span className="text-xs">{s.icon}</span>
                          <span className="truncate">{s.label}</span>
                        </div>
                        <span className={`text-[10px] font-mono font-black mt-0.5 ${
                          isSelected
                            ? s.id === 'FULL_OUTER_AND_INSIDE' ? 'text-white' : 'text-slate-950'
                            : 'text-amber-400'
                        }`}>
                          ₹{s.price.toLocaleString('en-IN')}
                        </span>
                        <span className={`text-[8.5px] font-medium leading-none ${isSelected ? 'opacity-90 font-bold' : isDefault ? 'text-amber-400 font-bold' : 'text-slate-400'}`}>
                          {isSelected ? '✓ ACTIVE' : isDefault ? 'Default' : s.sub}
                        </span>
                      </button>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </div>

        {/* 3D AR Sidebar Controller Panel */}
        <div className="lg:col-span-1 bg-slate-950 rounded-2xl border border-slate-800 p-4 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="pb-2 border-b border-slate-800">
              <h4 className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>3D AR Control Panel</span>
              </h4>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                पार्ट्स को अलग करके (Isolate) या खोलकर (Open/Hinge) बारीकी से अंदर-बाहर पेंट और डैमेज चेक करें।
              </p>
            </div>

            {/* Futuristic Real-world AR Overlay Camera Toggle */}
            <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-900/40 to-slate-900 border border-indigo-500/30 shadow-md space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-black text-white flex items-center gap-1">
                    <span>🎥 AR Preview Mode</span>
                    <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[8px] font-bold tracking-wider">LIVE</span>
                  </div>
                  <p className="text-[9.5px] text-slate-300 font-medium leading-normal mt-0.5">
                    असली गाड़ी पर 3D कार ओवरले करें। (Overlay 3D car on real car.)
                  </p>
                </div>
                
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={isArMode} 
                    onChange={(e) => setIsArMode(e.target.checked)} 
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-slate-800 rounded-full peer peer-focus:ring-2 peer-focus:ring-indigo-500/50 dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-indigo-500 peer-checked:to-purple-500 peer-checked:after:bg-white peer-checked:after:border-white shadow-inner" />
                </label>
              </div>

              {isArMode && (
                <div className="text-[9px] text-emerald-400 font-extrabold flex items-center gap-1 mt-1 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>🔴 Back Camera Active (Environment Mode)</span>
                </div>
              )}

              {cameraPermissionError && (
                <div className="text-[9.5px] text-rose-300 font-bold bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/30 leading-relaxed space-y-1 mt-1 animate-in fade-in duration-200">
                  <div className="flex items-center gap-1 text-rose-400">
                    <span>⚠️</span>
                    <span>कैमरा परमिशन आवश्यक है (Permission Required)</span>
                  </div>
                  <div>
                    AR प्रीव्यू के लिए अपने ब्राउज़र के एड्रेस बार में कैमरा आइकॉन पर क्लिक करें और <b>'Allow'</b> करें। (Click camera icon in browser address bar to allow.)
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2.5">
              {[
                { 
                  id: 'Bonnet', 
                  labelEn: 'Hood / Bonnet', 
                  labelHi: 'बोनट / इंजन', 
                  icon: '🚘', 
                  isOpen: bonnetOpen, 
                  onToggleOpen: () => setBonnetOpen(!bonnetOpen), 
                  hasHinge: true 
                },
                { 
                  id: 'Dicky', 
                  labelEn: 'Boot / Dicky', 
                  labelHi: 'डिकी / पिछला फर्श', 
                  icon: '🚗', 
                  isOpen: dickyOpen, 
                  onToggleOpen: () => setDickyOpen(!dickyOpen), 
                  hasHinge: true 
                },
                { 
                  id: 'Doors', 
                  labelEn: '4 Side Doors', 
                  labelHi: 'चारों दरवाजे', 
                  icon: '🚪', 
                  isOpen: doorsOpen, 
                  onToggleOpen: () => setDoorsOpen(!doorsOpen), 
                  hasHinge: true 
                },
                { 
                  id: 'Apron', 
                  labelEn: 'Engine Apron', 
                  labelHi: 'इंजन एप्रन (Pillars)', 
                  icon: '⚙️', 
                  hasHinge: false 
                },
                { 
                  id: 'Underbody', 
                  labelEn: 'Underbody Floor', 
                  labelHi: 'गाड़ी का निचला फर्श', 
                  icon: '⚡', 
                  hasHinge: false 
                },
              ].map(comp => {
                const isIsolated = isolatedComponent === comp.id;
                return (
                  <div key={comp.id} className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-850 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{comp.icon}</span>
                        <div>
                          <div className="text-xs font-bold text-slate-100 leading-tight">{comp.labelEn}</div>
                          <div className="text-[10px] text-slate-400 font-semibold">{comp.labelHi}</div>
                        </div>
                      </div>

                      {/* Isolate Button */}
                      <button
                        type="button"
                        onClick={() => setIsolatedComponent(isIsolated ? null : comp.id)}
                        className={`px-2 py-1 rounded-md text-[9.5px] font-black uppercase transition-all tracking-wider cursor-pointer ${
                          isIsolated
                            ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                        title="Isolate this component to view alone"
                      >
                        {isIsolated ? '🔍 Isolated' : ' Isolate'}
                      </button>
                    </div>

                    {/* Hinge open control */}
                    {comp.hasHinge && (
                      <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/60">
                        <span className="text-[10px] text-slate-400 font-bold">Hinge Position:</span>
                        <button
                          type="button"
                          onClick={comp.onToggleOpen}
                          className={`px-2.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                            comp.isOpen
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-800/80 text-slate-400 hover:text-slate-300'
                          }`}
                        >
                          <span>{comp.isOpen ? '🟢 Open (खुला)' : '🔴 Closed (बंद)'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Select Inside Panels & Pillars */}
          <div className="p-3 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-2">
            <div className="text-[10px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <span>🎯 Quick Select Pillars &amp; Dicky Floor</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              {[
                { id: 'pillar_a', label: '🚪 A-Pillar' },
                { id: 'pillar_b', label: '🚪 B-Pillar' },
                { id: 'pillar_c', label: '🚪 C-Pillar' },
                { id: 'boot_floor', label: '🚗 Dicky Floor' },
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
                      handlePanelClick(item.id);
                    }}
                    className={`p-2 rounded-lg border font-bold text-left transition-all flex items-center justify-between cursor-pointer ${
                      isActive
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-extrabold shadow-sm'
                        : 'bg-slate-900/60 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span>{item.label}</span>
                    {isActive ? (
                      <span className="text-[8px] bg-emerald-500/20 px-1 rounded text-emerald-300 font-bold">ON</span>
                    ) : (
                      <span className="text-[8px] text-slate-500 font-bold">+</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reset All Visibility & Hinges Button */}
          <button
            type="button"
            onClick={() => {
              setIsolatedComponent(null);
              setDoorsOpen(true);
              setBonnetOpen(false);
              setDickyOpen(false);
              setCameraPreset('ISO');
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-slate-700 cursor-pointer"
          >
            🔄 Reset View &amp; Hinges
          </button>
        </div>
      </div>

      {/* Repositioned Colour Legends Bar (Clean Horizontal layout beneath the canvas) */}
      <div className="bg-slate-900/85 backdrop-blur-md p-3 rounded-xl border border-slate-800 text-xs shadow-xl">
        <div className="font-bold text-slate-400 uppercase tracking-wider mb-2 text-[10px] text-center sm:text-left">
          🎨 कलर कोड्स एवं लेजेंड (Color Codes & Legends):
        </div>
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5 bg-slate-950/60 px-2 py-1.5 rounded-lg border border-slate-800">
            <span className="w-3.5 h-3.5 rounded bg-white border border-slate-300 inline-block shadow-sm" />
            <span className="text-slate-200 font-bold">Pearl White (डिफ़ॉल्ट)</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-950/60 px-2 py-1.5 rounded-lg border border-slate-800">
            <span className="w-3.5 h-3.5 rounded bg-amber-500 inline-block shadow-sm" />
            <span className="text-amber-300 font-bold">Full Paint (बाहर पूरा)</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-950/60 px-2 py-1.5 rounded-lg border border-slate-800">
            <span className="w-3.5 h-3.5 rounded bg-emerald-500 inline-block shadow-sm" />
            <span className="text-emerald-300 font-bold">Inside Paint (अंदर फर्श/पिलर)</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-950/60 px-2 py-1.5 rounded-lg border border-slate-800">
            <span className="w-3.5 h-3.5 rounded bg-cyan-400 inline-block shadow-sm" />
            <span className="text-cyan-300 font-bold">Partial Touchup (आधा/पैच)</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-950/60 px-2 py-1.5 rounded-lg border border-slate-800">
            <span className="w-3.5 h-3.5 rounded bg-yellow-400 inline-block shadow-sm" />
            <span className="text-yellow-300 font-bold">Outer + Inside (दोनों)</span>
          </div>
        </div>
      </div>

      {/* Selected Panel Detail & Scope Selector */}
      {activePanelObj && (
        <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-black uppercase text-amber-400">
                पेंट का दायरा चुनें (Select Paint Scope):
              </span>
              <h4 className="font-extrabold text-sm text-white">
                {activePanelObj.nameHi} ({activePanelObj.nameEn})
              </h4>
            </div>

            <div className="flex items-center gap-2">
              {(onInspectionChange || onPanelToggle) && (
                <button
                  type="button"
                  onClick={() => handlePanelClick(activePanelObj.id)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    isPanelActive(activePanelObj.id)
                      ? 'bg-rose-600/20 text-rose-300 border-rose-500/40 hover:bg-rose-600 hover:text-white'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500 hover:text-slate-950'
                  }`}
                >
                  {isPanelActive(activePanelObj.id) ? '✕ पैनल हटाएं (Deselect)' : '+ पैनल चुनें (Select)'}
                </button>
              )}

              <button
                type="button"
                onClick={() => speakPanelInfo(activePanelObj)}
                className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold transition-all ${
                  isSpeaking
                    ? 'bg-rose-500 text-white border-rose-400 shadow-sm'
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500 hover:text-slate-950'
                }`}
              >
                {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                <span>🔊 सुनिए (Voice Assistant)</span>
              </button>
            </div>
          </div>

          {/* Scope Selector Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            {(() => {
              const isInsideOnlyPanel = activePanelObj.id.startsWith('pillar_') || activePanelObj.id === 'boot_floor';
              const outerRates = getPanelEnvironmentRates(activePanelObj.id, effectiveStandardJobs, isCars24, 'FULL_OUTER');
              const innerRates = getPanelEnvironmentRates(activePanelObj.id, effectiveStandardJobs, isCars24, 'INSIDE_JAMB');
              const partialRates = getPanelEnvironmentRates(activePanelObj.id, effectiveStandardJobs, isCars24, 'PARTIAL_TOUCHUP');
              const outerInnerRates = getPanelEnvironmentRates(activePanelObj.id, effectiveStandardJobs, isCars24, 'FULL_OUTER_AND_INSIDE');

              const scopeButtons = [
                {
                  id: 'FULL_OUTER' as PaintScope,
                  label: 'Full Outer Paint',
                  labelHi: 'बाहर पूरा पेंट',
                  icon: '✨',
                  rates: outerRates,
                  disabled: isInsideOnlyPanel,
                  tooltip: 'Full Outer Paint (Predefined Standard Job Rate)',
                  activeColor: 'bg-amber-400 text-slate-950 ring-2 ring-amber-300 shadow-xl'
                },
                {
                  id: 'INSIDE_JAMB' as PaintScope,
                  label: 'Inner Paint Only',
                  labelHi: 'अंदर पिलर / जैम',
                  icon: '🚪',
                  rates: innerRates,
                  disabled: false,
                  tooltip: 'Inner Paint Only (Predefined Standard Job Rate)',
                  activeColor: 'bg-emerald-400 text-slate-950 ring-2 ring-emerald-300 shadow-xl'
                },
                {
                  id: 'PARTIAL_TOUCHUP' as PaintScope,
                  label: 'Partial Paint',
                  labelHi: 'आधा / टचअप पेंट',
                  icon: '🎨',
                  rates: partialRates,
                  disabled: isInsideOnlyPanel || !isPartialPaintAllowedForPanel(activePanelObj.id),
                  tooltip: 'Partial Touchup (Predefined Standard Job Rate)',
                  activeColor: 'bg-cyan-400 text-slate-950 ring-2 ring-cyan-300 shadow-xl'
                },
                {
                  id: 'FULL_OUTER_AND_INSIDE' as PaintScope,
                  label: 'Outer Plus Inner Paint',
                  labelHi: 'बाहर + अंदर दोनों',
                  icon: '🌟',
                  rates: outerInnerRates,
                  disabled: isInsideOnlyPanel,
                  tooltip: 'Full Outer + Inside Jamb (Predefined Standard Job Rate)',
                  activeColor: 'bg-purple-500 text-white ring-2 ring-purple-300 shadow-xl'
                }
              ];

              return scopeButtons.map(s => {
                const isSelected = isPanelActive(activePanelObj.id) && currentScope === s.id;
                const isDefault = !isPanelActive(activePanelObj.id) && s.id === 'FULL_OUTER';

                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={s.disabled}
                    title={s.tooltip}
                    onClick={() => {
                      const isInsideScope = s.id === 'INSIDE_JAMB' || s.id === 'FULL_OUTER_AND_INSIDE';
                      if (isInsideScope) {
                        if (activePanelObj.id === 'hood_bonnet' && !bonnetOpen) {
                          setBonnetOpen(true);
                        }
                        if (activePanelObj.id === 'boot_trunk' && !dickyOpen) {
                          setDickyOpen(true);
                        }
                      }
                      handlePanelClick(activePanelObj.id, s.id as PaintScope);
                    }}
                    className={`p-3 rounded-2xl font-extrabold text-xs transition-all flex flex-col items-center justify-between gap-1.5 text-center relative cursor-pointer ${
                      s.disabled
                        ? 'bg-slate-900/40 text-slate-600 border border-slate-800/60 cursor-not-allowed opacity-40'
                        : isSelected
                        ? `${s.activeColor} transform scale-[1.02]`
                        : isDefault
                        ? 'bg-slate-900 text-slate-200 border-2 border-amber-500/70 hover:border-amber-400 shadow-md'
                        : 'bg-slate-900/90 text-slate-300 border border-slate-700/80 hover:border-amber-400/60 hover:bg-slate-800'
                    }`}
                  >
                    {isDefault && (
                      <span className="absolute -top-2 right-2 px-1.5 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 shadow">
                        Default
                      </span>
                    )}
                    {isSelected && (
                      <span className="absolute -top-2 right-2 px-1.5 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider bg-white text-slate-950 shadow">
                        ✓ Selected
                      </span>
                    )}

                    <div className="flex items-center gap-1.5">
                      <span className="text-base">{s.icon}</span>
                      <span className="font-bold text-xs">{s.label}</span>
                    </div>

                    <div className="text-[10px] opacity-80 font-medium">
                      {s.labelHi}
                    </div>

                    {/* Predefined Standard Job Price */}
                    <div className={`mt-1 px-2.5 py-1 rounded-xl font-mono font-black text-sm w-full flex items-center justify-center gap-1 ${
                      isSelected
                        ? s.id === 'FULL_OUTER_AND_INSIDE' ? 'bg-purple-600/50 text-white' : 'bg-slate-950/20 text-slate-950'
                        : 'bg-slate-950/70 text-amber-400 border border-slate-800'
                    }`}>
                      <span>₹{s.rates.price.toLocaleString('en-IN')}</span>
                      {isCars24 && <span className="text-[9px] opacity-75 font-sans font-bold">C24</span>}
                    </div>

                    <div className={`text-[9px] tracking-tight ${isSelected ? 'opacity-85' : 'text-slate-400'}`}>
                      ₹{s.rates.painterPayout}P + ₹{s.rates.denterPayout}D
                    </div>
                  </button>
                );
              });
            })()}
          </div>
        </div>
      )}

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
                onClick={confirmDeselect}
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
