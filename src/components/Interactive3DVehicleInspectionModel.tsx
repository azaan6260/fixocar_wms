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
import { speakTechnicianPrompt, stopTechnicianSpeech } from '../lib/technicianVoiceHelper';
import { formatPaintTaskTitle, isPartialPaintAllowedForPanel, getPanelEnvironmentRates } from '../lib/panelMappingHelper';

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
  const [activePanelId, setActivePanelId] = useState<string | null>(null);
  const [hoveredPanelId, setHoveredPanelId] = useState<string | null>(null);
  const [isPillDismissed, setIsPillDismissed] = useState(false);
  const previousPanelIdRef = useRef<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

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

  // Active panel definition
  const activePanelObj = useMemo(() => {
    return VEHICLE_PANELS.find(p => p.id === activePanelId) || null;
  }, [activePanelId]);

  const activeInspection = activePanelObj ? effectiveInspections[activePanelObj.id] : undefined;
  const currentScope: PaintScope = activeInspection?.paintScope || 'FULL_OUTER';

  // Toggle panel selection
  const handlePanelClick = (panelId: string, scope?: PaintScope) => {
    if (panelId === 'boot_floor' && !dickyOpen) return; // Prevent selection if closed!
    setActivePanelId(panelId);
    const panelObj = VEHICLE_PANELS.find(p => p.id === panelId);
    if (!panelObj) return;

    const existing = effectiveInspections[panelId];
    // If an explicit scope is chosen, keep/force selection to true. If clicking 3D panel without scope, toggle.
    const newSelected = scope ? true : (existing ? !existing.selected : true);
    const targetScope = scope || existing?.paintScope || (panelId.startsWith('pillar_') ? 'INSIDE_JAMB' : 'FULL_OUTER');

    const updatedObj = {
      panelId,
      nameEn: panelObj.nameEn,
      nameHi: panelObj.nameHi,
      category: 'EXTERIOR_BODY' as const,
      selected: newSelected,
      paintScope: targetScope,
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
      onPanelToggle(panelId, panelObj.standardJobId, targetScope);
    }
  };

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
    camera.lookAt(0, 0.3, 0);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
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

    // Main lower chassis tub with sloped front/rear overhangs
    const chassisTubGeo = new THREE.BoxGeometry(1.65, 0.45, 3.8);
    const chassisTub = new THREE.Mesh(chassisTubGeo, interiorMat);
    chassisTub.position.set(0, 0.4, 0);
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
    const pillarAGeo = createRoundedBoxGeometry(0.07, 0.54, 0.07, 0.015);
    const pillarAL = registerPanelMesh('pillar_a', pillarAGeo, defaultPaintMat, undefined, new THREE.Vector3(0.70, 1.06, 0.85));
    pillarAL.rotation.set(-0.6, 0, -0.3);
    pillarAL.userData = { panelId: 'pillar_a', isInnerJamb: true };

    const pillarAR = new THREE.Mesh(pillarAGeo, defaultPaintMat.clone());
    pillarAR.position.set(-0.70, 1.06, 0.85);
    pillarAR.rotation.set(-0.6, 0, 0.3);
    pillarAR.userData = { panelId: 'pillar_a', isInnerJamb: true };
    carGroup.add(pillarAR);

    // Pillar B (Middle Passenger Door Structural Pillars) - Made thicker and offset outward to stand proud of static black pillar
    const pillarBGeo = createRoundedBoxGeometry(0.07, 0.57, 0.09, 0.015);
    const pillarBL = registerPanelMesh('pillar_b', pillarBGeo, defaultPaintMat, undefined, new THREE.Vector3(0.71, 0.96, -0.1));
    pillarBL.userData = { panelId: 'pillar_b', isInnerJamb: true };

    const pillarBR = new THREE.Mesh(pillarBGeo, defaultPaintMat.clone());
    pillarBR.position.set(-0.71, 0.96, -0.1);
    pillarBR.userData = { panelId: 'pillar_b', isInnerJamb: true };
    carGroup.add(pillarBR);

    // Pillar C (Rear Symmetrical Fastback Pillars) - Made thicker and offset outward to stand proud of glass canopy
    const pillarCGeo = createRoundedBoxGeometry(0.07, 0.54, 0.11, 0.015);
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
    const bootGeo = createRoundedBoxGeometry(1.38, 0.02, 0.85, 0.008);
    registerPanelMesh('boot_trunk', bootGeo, defaultPaintMat, bootPivot, new THREE.Vector3(0, -0.01, -0.425));

    // Dicky Inner Panel representing Dicky Inside Paint
    const innerBootGeo = createRoundedBoxGeometry(1.34, 0.015, 0.81, 0.006);
    const innerBoot = new THREE.Mesh(innerBootGeo, defaultPaintMat.clone());
    innerBoot.position.set(0, -0.02, -0.425);
    innerBoot.userData = { panelId: 'boot_trunk', isInnerJamb: true };
    bootPivot.add(innerBoot);

    // Sleek Selectable Rear Spoiler on trunk lid (rotates with bootPivot)
    const spoilerGeo = createRoundedBoxGeometry(1.4, 0.03, 0.12, 0.01);
    const spoilerMesh = registerPanelMesh('spoiler', spoilerGeo, defaultPaintMat, bootPivot, new THREE.Vector3(0, 0.02, -0.82));

    const bootFloorGeo = createRoundedBoxGeometry(1.3, 0.06, 0.64, 0.03);
    const bootFloor = registerPanelMesh('boot_floor', bootFloorGeo, defaultPaintMat, undefined, new THREE.Vector3(0, 0.4, -1.55));
    bootFloor.userData = { panelId: 'boot_floor', isInnerJamb: true };

    hingedGroupsRef.current = {
      doorLhsFront: doorLhsFrontPivot,
      doorRhsFront: doorRhsFrontPivot,
      doorLhsRear: doorLhsRearPivot,
      doorRhsRear: doorRhsRearPivot,
      hoodBonnet: bonnetPivot,
      bootTrunk: bootPivot
    };

    // 7. Raycasting & Mouse/Touch Interaction Setup
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const targetFocus = targetFocusRef.current;
    let isMouseDown = false;
    let isPanning = false;
    let previousMousePosition = { x: 0, y: 0 };

    // Pinch & mobile zoom/pan trackers
    let previousTouchDistance = 0;
    let previousTouchMidpoint = { x: 0, y: 0 };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if ('touches' in e) {
        if (e.touches.length === 1) {
          isMouseDown = true;
          isPanning = false;
          previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e.touches.length === 2) {
          isMouseDown = false;
          isPanning = true;
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
        previousMousePosition = { x: e.clientX, y: e.clientY };
      }
    };

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const clientX = 'touches' in e ? (e.touches.length > 0 ? e.touches[0].clientX : 0) : e.clientX;
      const clientY = 'touches' in e ? (e.touches.length > 0 ? e.touches[0].clientY : 0) : e.clientY;

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
          const dir = new THREE.Vector3().subVectors(camera.position, targetFocus).normalize();
          const dist = camera.position.distanceTo(targetFocus);
          const newDist = Math.max(1.8, Math.min(14.0, dist - pinchDelta * zoomSpeed));
          camera.position.copy(dir.multiplyScalar(newDist).add(targetFocus));
        }
        previousTouchDistance = currentTouchDistance;

        // B. TWO FINGER PAN (Translation)
        const currentMidpoint = {
          x: (touch1.clientX + touch2.clientX) / 2,
          y: (touch1.clientY + touch2.clientY) / 2
        };
        if (previousTouchMidpoint.x > 0 && previousTouchMidpoint.y > 0) {
          const mdx = currentMidpoint.x - previousTouchMidpoint.x;
          const mdy = currentMidpoint.y - previousTouchMidpoint.y;

          const panSpeed = 0.005;
          const rightVector = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0).normalize();
          const upVector = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1).normalize();

          targetFocus.addScaledVector(rightVector, -mdx * panSpeed);
          targetFocus.addScaledVector(upVector, mdy * panSpeed);
          camera.position.addScaledVector(rightVector, -mdx * panSpeed);
          camera.position.addScaledVector(upVector, mdy * panSpeed);
        }
        previousTouchMidpoint = currentMidpoint;

      } else if (isMouseDown) {
        // Mouse drag rotation or mouse panning
        const deltaX = clientX - previousMousePosition.x;
        const deltaY = clientY - previousMousePosition.y;

        if (isPanning) {
          // Pan camera focus target
          const panSpeed = 0.006;
          const rightVector = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0).normalize();
          const upVector = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1).normalize();

          targetFocus.addScaledVector(rightVector, -deltaX * panSpeed);
          targetFocus.addScaledVector(upVector, deltaY * panSpeed);
          camera.position.addScaledVector(rightVector, -deltaX * panSpeed);
          camera.position.addScaledVector(upVector, deltaY * panSpeed);
        } else {
          // Standard rotation
          carGroup.rotation.y += deltaX * 0.008;
          carGroup.rotation.x = Math.max(-0.8, Math.min(0.8, carGroup.rotation.x + deltaY * 0.008));
        }

        previousMousePosition = { x: clientX, y: clientY };
      } else {
        // Raycast for hover
        raycaster.setFromCamera(mouse, camera);
        const selectableObjects: THREE.Object3D[] = [];
        carGroup.traverse((child) => {
          if ((child as THREE.Mesh).isMesh && child.userData && child.userData.panelId) {
            if (child.visible) {
              selectableObjects.push(child);
            }
          }
        });
        const intersects = raycaster.intersectObjects(selectableObjects, true);
        if (intersects.length > 0) {
          const hit = intersects[0].object;
          if (hit.userData && hit.userData.panelId) {
            setHoveredPanelId(hit.userData.panelId);
          }
        } else {
          setHoveredPanelId(null);
        }
      }
    };

    const handlePointerUp = (e: MouseEvent | TouchEvent) => {
      isMouseDown = false;
      isPanning = false;
      previousTouchDistance = 0;
      previousTouchMidpoint = { x: 0, y: 0 };
    };

    const handleCanvasClick = (e: MouseEvent) => {
      // Ignore click triggers if they were meant as panning
      if (e.button === 2 || e.shiftKey) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const selectableObjects: THREE.Object3D[] = [];
      carGroup.traverse((child) => {
        if ((child as THREE.Mesh).isMesh && child.userData && child.userData.panelId) {
          if (child.visible) {
            selectableObjects.push(child);
          }
        }
      });
      const intersects = raycaster.intersectObjects(selectableObjects, true);
      if (intersects.length > 0) {
        const hit = intersects[0].object;
        if (hit.userData && hit.userData.panelId) {
          handlePanelClick(hit.userData.panelId);
        }
      }
    };

    // Zoom via mouse wheel scroll
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomSpeed = 0.005;
      const dir = new THREE.Vector3().subVectors(camera.position, targetFocus).normalize();
      const dist = camera.position.distanceTo(targetFocus);
      const newDist = Math.max(2.0, Math.min(12.0, dist + e.deltaY * zoomSpeed));
      camera.position.copy(dir.multiplyScalar(newDist).add(targetFocus));
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

    // 8. Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Idle subtle spin if not interacting
      if (!isMouseDown && !isPanning) {
        carGroup.rotation.y += 0.0015;
      }

      // Smoothly focus camera onto current focus target
      camera.lookAt(targetFocus);

      renderer.render(scene, camera);
    };
    animate();

    // Clean up
    return () => {
      cancelAnimationFrame(animationFrameId);
      domElem.removeEventListener('mousedown', handlePointerDown);
      domElem.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      domElem.removeEventListener('click', handleCanvasClick);
      domElem.removeEventListener('wheel', handleWheel);
      domElem.removeEventListener('contextmenu', handleContextMenu);
      domElem.removeEventListener('touchstart', handlePointerDown);
      domElem.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
      renderer.dispose();
    };
  }, [compact]);

  // Update Door/Bonnet/Boot Open Hinges Animation
  useEffect(() => {
    const h = hingedGroupsRef.current;
    if (!h) return;

    // Smooth target angles
    const doorAngleLHS = doorsOpen ? Math.PI / 3 : 0;
    const doorAngleRHS = doorsOpen ? -Math.PI / 3 : 0;
    const bonnetAngle = bonnetOpen ? -Math.PI / 3.5 : 0;
    const bootAngle = dickyOpen ? Math.PI / 3.2 : 0;

    // Since LHS and RHS coordinates are mirrored for standard viewport intuition, LHS door is on +x and RHS is on -x.
    // Thus we swap the rotation angles to open outward.
    if (h.doorLhsFront) h.doorLhsFront.rotation.y = doorAngleRHS;
    if (h.doorRhsFront) h.doorRhsFront.rotation.y = doorAngleLHS;
    if (h.doorLhsRear) h.doorLhsRear.rotation.y = doorAngleRHS;
    if (h.doorRhsRear) h.doorRhsRear.rotation.y = doorAngleLHS;
    if (h.hoodBonnet) h.hoodBonnet.rotation.x = bonnetAngle;
    if (h.bootTrunk) h.bootTrunk.rotation.x = bootAngle;
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
  }, [activePanelId]);

  // Automatically clear selected 3D panel floating pill after 3.5 seconds to keep screen clean
  useEffect(() => {
    if (activePanelId && !isPillDismissed) {
      const timer = setTimeout(() => {
        setIsPillDismissed(true);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [activePanelId, isPillDismissed]);

  // Update Camera Preset Views
  useEffect(() => {
    const cam = cameraRef.current;
    if (!cam) return;

    switch (cameraPreset) {
      case 'ISO':
        cam.position.set(4.5, 2.5, 5.5);
        cam.lookAt(0, 0, 0);
        break;
      case 'FRONT':
        cam.position.set(0, 1.2, 5.5);
        cam.lookAt(0, 0.5, 1.2);
        break;
      case 'REAR':
        cam.position.set(0, 1.2, -5.5);
        cam.lookAt(0, 0.5, -1.2);
        break;
      case 'LHS':
        cam.position.set(-5.5, 1.2, 0);
        cam.lookAt(0, 0.6, 0);
        break;
      case 'RHS':
        cam.position.set(5.5, 1.2, 0);
        cam.lookAt(0, 0.6, 0);
        break;
      case 'TOP':
        cam.position.set(0, 7.5, 0.01);
        cam.lookAt(0, 0, 0);
        break;
      case 'UNDERBODY':
        cam.position.set(0, -4.5, 0.1);
        cam.lookAt(0, 0, 0);
        break;
    }
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
          // No active isolation: keep all body panels visible except boot floor which requires dickyOpen
          if (child.userData?.panelId === 'boot_floor') {
            child.visible = dickyOpen;
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
    } else if (isolatedComponent === 'Doors') {
      setCameraPreset('ISO');
    }
  }, [isolatedComponent, dickyOpen]);

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
  }, [isArMode]);

  // Update Material Colors based on Selected Inspections & Paint Scope
  useEffect(() => {
    const carGroup = carGroupRef.current;
    if (!carGroup) return;

    // Helper to generate half-colored high-contrast texture on the fly for partial paint scope
    const makeHalfColorTexture = (colorStr: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Fill left half with high-contrast highlight color
        ctx.fillStyle = colorStr;
        ctx.fillRect(0, 0, 64, 128);
        // Fill right half with default pearl white background
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(64, 0, 64, 128);
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      return texture;
    };

    carGroup.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const panelId = mesh.userData?.panelId;
      if (!panelId) return;

      const inspection = effectiveInspections[panelId];
      const isSelected = Boolean(inspection?.selected || selectedPanelIds.includes(panelId));
      const isHovered = hoveredPanelId === panelId;
      const scope: PaintScope = inspection?.paintScope || 'FULL_OUTER';

      const isInnerJamb = mesh.userData?.isInnerJamb === true;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (!mat) return;

      // Clean up previous map if any to prevent memory leaks
      if (mat.map) {
        mat.map.dispose();
        mat.map = null;
      }

      if (!isSelected) {
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
              // Inner jamb is completely uncolored (default pearl white) for partial outer touchup
              mat.color.setHex(0xf8fafc);
              mat.emissive.setHex(0x000000);
              mat.emissiveIntensity = 0;
            } else {
              // "On selecting partial paint half panel should show colour"
              const tex = makeHalfColorTexture('#06b6d4');
              mat.map = tex;
              mat.color.setHex(0xffffff); // White modulation so the canvas texture colors display perfectly
              mat.emissive.setHex(0x082f49);
              mat.emissiveIntensity = isHovered ? 0.8 : 0.4;
            }
            break;

          case 'INSIDE_JAMB':
            if (isInnerJamb) {
              // "in selecting inside only the inside panel should show colour not outside panel"
              mat.color.setHex(0x10b981); // Beautiful Emerald Green representing inside jamb
              mat.emissive.setHex(0x064e3b);
              mat.emissiveIntensity = isHovered ? 0.8 : 0.4;
            } else {
              // Outer panel is completely uncolored (default pearl white) for inside jamb only paint
              mat.color.setHex(0xf8fafc);
              mat.emissive.setHex(0x000000);
              mat.emissiveIntensity = 0;
            }
            break;

          case 'FULL_OUTER_AND_INSIDE':
            // "On selecting inside plus outside panel both outside and inside should show colour"
            // High contrast glowing gold for both outside and inside jamb
            mat.color.setHex(0xeab308);
            mat.emissive.setHex(0x713f12);
            mat.emissiveIntensity = isHovered ? 0.8 : 0.4;
            break;

          case 'FULL_OUTER':
          default:
            if (isInnerJamb) {
              // Inner jamb is completely uncolored for full outer-only paint
              mat.color.setHex(0xf8fafc);
              mat.emissive.setHex(0x000000);
              mat.emissiveIntensity = 0;
            } else {
              // Outer panel: High-Gloss Amber/Gold
              mat.color.setHex(0xf59e0b);
              mat.emissive.setHex(0x78350f);
              mat.emissiveIntensity = isHovered ? 0.8 : 0.4;
            }
            break;
        }
      }
      mat.needsUpdate = true;
    });
  }, [effectiveInspections, selectedPanelIds, hoveredPanelId]);

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-2xl space-y-4">
      
      {/* Top Header & View Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <h3 className="font-extrabold text-sm sm:text-base text-white">
              🚘 3D Vehicle Interactive Inspector (दरवाजा खोलकर अंदर पेंट देखें)
            </h3>
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

          {/* Hovered Panel Floating Pill */}
          {activePanelObj && !isPillDismissed && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-md px-4 py-2 rounded-2xl border border-amber-500/40 shadow-xl flex items-center justify-between gap-4 z-20 animate-in fade-in zoom-in-95 duration-200">
              <div>
                <div className="text-[9px] text-amber-400 font-black uppercase tracking-wider">चयनित पैनल (Selected Panel)</div>
                <div className="text-xs font-extrabold text-white">{activePanelObj.nameHi}</div>
                <div className="text-[10px] font-mono text-slate-300 font-semibold">
                  {activePanelObj.nameEn}
                </div>
              </div>
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
          )}
        </div>

        {/* 3D AR Sidebar Controller Panel */}
        <div className="lg:col-span-1 bg-slate-950 rounded-2xl border border-slate-800 p-4 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="pb-2 border-b border-slate-800">
              <h4 className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
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
                    <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[8px] font-bold tracking-wider animate-pulse">LIVE</span>
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
                <div className="text-[9px] text-emerald-400 font-extrabold flex items-center gap-1 mt-1 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20 animate-pulse">
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
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase text-amber-400">
                पेंट का दायरा चुनें (Select Paint Scope):
              </span>
              <h4 className="font-extrabold text-sm text-white">
                {activePanelObj.nameHi} ({activePanelObj.nameEn})
              </h4>
            </div>

            <button
              type="button"
              onClick={() => speakPanelInfo(activePanelObj)}
              className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold transition-all ${
                isSpeaking
                  ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500 hover:text-slate-950'
              }`}
            >
              {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span>🔊 सुनिए (Voice Assistant)</span>
            </button>
          </div>

          {/* Scope Selector Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {[
              { id: 'FULL_OUTER', label: 'Full Paint (बाहर पूरा)', icon: '✨', disabled: false, tooltip: 'Full Paint' },
              { id: 'PARTIAL_TOUCHUP', label: 'Partial Paint (आधा/टचअप)', icon: '🎨', disabled: !isPartialPaintAllowedForPanel(activePanelObj.id), tooltip: 'Partial Paint' },
              { id: 'INSIDE_JAMB', label: 'Inside Paint (अंदर पिलर)', icon: '🚪', disabled: false, tooltip: 'Inside Paint' },
              { id: 'FULL_OUTER_AND_INSIDE', label: 'Outer + Inside (दोनों)', icon: '🌟', disabled: false, tooltip: 'Outer + Inside Paint' }
            ].map(s => {
              const active = currentScope === s.id;
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
                  className={`p-2.5 rounded-xl font-extrabold text-xs transition-all flex flex-col items-center justify-center gap-1 text-center ${
                    s.disabled
                      ? 'bg-slate-900/50 text-slate-600 border border-slate-800 cursor-not-allowed opacity-40'
                      : active
                      ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300 shadow-lg'
                      : 'bg-slate-900 text-slate-300 border border-slate-700 hover:border-amber-400/60'
                  }`}
                >
                  <span className="text-base">{s.icon}</span>
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
