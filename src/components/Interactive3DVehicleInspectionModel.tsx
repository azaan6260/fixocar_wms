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
}

export function Interactive3DVehicleInspectionModel({
  mode = 'INTERACTIVE_SELECT',
  isCars24 = false,
  selectedPanelIds = [],
  inspections = {},
  onInspectionChange,
  onPanelToggle,
  availableStandardJobs = [],
  compact = false
}: Interactive3DVehicleInspectionModelProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  // States
  const [activePanelId, setActivePanelId] = useState<string | null>(null);
  const [hoveredPanelId, setHoveredPanelId] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Open / Close Hinged Parts State
  const [doorsOpen, setDoorsOpen] = useState(true);
  const [bonnetOpen, setBonnetOpen] = useState(false);
  const [dickyOpen, setDickyOpen] = useState(false);

  // Camera preset view
  const [cameraPreset, setCameraPreset] = useState<'ISO' | 'FRONT' | 'REAR' | 'LHS' | 'RHS' | 'TOP' | 'UNDERBODY'>('ISO');

  // References for Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
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
    return VEHICLE_PANELS.find(p => p.id === (activePanelId || hoveredPanelId)) || null;
  }, [activePanelId, hoveredPanelId]);

  const activeInspection = activePanelObj ? inspections[activePanelObj.id] : undefined;
  const currentScope: PaintScope = activeInspection?.paintScope || 'FULL_OUTER';

  // Toggle panel selection
  const handlePanelClick = (panelId: string, scope?: PaintScope) => {
    setActivePanelId(panelId);
    const panelObj = VEHICLE_PANELS.find(p => p.id === panelId);
    if (!panelObj) return;

    const existing = inspections[panelId];
    const newSelected = existing ? !existing.selected : true;
    const targetScope = scope || existing?.paintScope || 'FULL_OUTER';

    if (onInspectionChange) {
      const updated = {
        ...inspections,
        [panelId]: {
          panelId,
          nameEn: panelObj.nameEn,
          nameHi: panelObj.nameHi,
          category: 'EXTERIOR_BODY' as const,
          selected: newSelected,
          paintScope: targetScope,
          customPrice: undefined,
          customPainterPayout: undefined,
          customDenterPayout: undefined
        }
      };
      onInspectionChange(updated);
    }

    if (onPanelToggle) {
      onPanelToggle(panelId, panelObj.standardJobId, targetScope);
    }
  };

  // Voice speech handler
  const speakPanelInfo = (panel: PanelDefinition) => {
    const inspection = inspections[panel.id];
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

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a); // slate-900
    scene.fog = new THREE.FogExp2(0x0f172a, 0.035);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(4.5, 2.5, 5.5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xfff5ea, 1.4);
    dirLight1.position.set(6, 10, 6);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 1024;
    dirLight1.shadow.mapSize.height = 1024;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.6); // cool fill
    dirLight2.position.set(-6, 6, -6);
    scene.add(dirLight2);

    const rimLight = new THREE.DirectionalLight(0xf59e0b, 0.8); // warm rim
    rimLight.position.set(0, -6, 0);
    scene.add(rimLight);

    // 5. Grid Floor & Pedestal
    const gridHelper = new THREE.GridHelper(12, 24, 0x3b82f6, 0x1e293b);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    const floorGeo = new THREE.PlaneGeometry(12, 12);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.8, metalness: 0.2 });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -0.02;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // 6. Base Vehicle Assembly Setup
    const carGroup = new THREE.Group();
    scene.add(carGroup);

    // Common Base Materials - Default Alpine / Pearl White Body Finish
    const defaultPaintMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc, // Alpine Crisp White
      roughness: 0.18, // High-gloss automotive clearcoat
      metalness: 0.15
    });

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.5,
      roughness: 0.1,
      metalness: 0.9,
      transmission: 0.7
    });

    const interiorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.08, metalness: 0.98 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.9 });
    const engineMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.4 });
    const headlightMat = new THREE.MeshStandardMaterial({ color: 0xfffbe1, emissive: 0xfef08a, emissiveIntensity: 0.8, roughness: 0.1 });
    const taillightMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xd97706, emissiveIntensity: 0.7, roughness: 0.1 });
    const grilleMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });

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

    // A. VEHICLE CHASSIS & INTERIOR CABIN BASE
    const cabinGeo = new THREE.BoxGeometry(1.6, 1.1, 2.8);
    const cabinMesh = new THREE.Mesh(cabinGeo, interiorMat);
    cabinMesh.position.set(0, 0.75, 0);
    carGroup.add(cabinMesh);

    // Dashboard & Seats
    const seatGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const seatFL = new THREE.Mesh(seatGeo, interiorMat);
    seatFL.position.set(-0.4, 0.65, 0.2);
    const seatFR = new THREE.Mesh(seatGeo, interiorMat);
    seatFR.position.set(0.4, 0.65, 0.2);
    carGroup.add(seatFL, seatFR);

    // B. WHEELS & BRAKE CALIPERS
    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 24);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelPositions = [
      new THREE.Vector3(-0.9, 0.35, 1.2),  // FL
      new THREE.Vector3(0.9, 0.35, 1.2),   // FR
      new THREE.Vector3(-0.9, 0.35, -1.2), // RL
      new THREE.Vector3(0.9, 0.35, -1.2)   // RR
    ];
    wheelPositions.forEach(pos => {
      const wheel = new THREE.Mesh(wheelGeo, tireMat);
      wheel.position.copy(pos);
      carGroup.add(wheel);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.26, 12), chromeMat);
      rim.rotation.z = Math.PI / 2;
      wheel.add(rim);
    });

    // C. FRONT END: BUMPER, RADIATOR GRILLE, HEADLIGHTS (Clear Bonnet Front Identification)
    const frontBumperGeo = new THREE.BoxGeometry(1.85, 0.4, 0.4);
    const frontBumperMesh = registerPanelMesh('bumper_front', frontBumperGeo, defaultPaintMat, undefined, new THREE.Vector3(0, 0.4, 2.1));

    // Front Grille Mesh
    const grilleMesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.05), grilleMat);
    grilleMesh.position.set(0, 0.45, 2.31);
    carGroup.add(grilleMesh);

    // Left & Right LED Headlights
    const headlightGeo = new THREE.BoxGeometry(0.35, 0.15, 0.08);
    const hlL = new THREE.Mesh(headlightGeo, headlightMat);
    hlL.position.set(-0.65, 0.52, 2.31);
    const hlR = new THREE.Mesh(headlightGeo, headlightMat);
    hlR.position.set(0.65, 0.52, 2.31);
    carGroup.add(hlL, hlR);

    // D. REAR END: BUMPER & TAILLIGHTS (Clear Rear Trunk Identification)
    const rearBumperGeo = new THREE.BoxGeometry(1.85, 0.4, 0.4);
    registerPanelMesh('bumper_rear', rearBumperGeo, defaultPaintMat, undefined, new THREE.Vector3(0, 0.4, -2.1));

    // Rear Tail Lights (Red Lenses)
    const taillightGeo = new THREE.BoxGeometry(0.4, 0.16, 0.08);
    const tlL = new THREE.Mesh(taillightGeo, taillightMat);
    tlL.position.set(-0.65, 0.72, -2.28);
    const tlR = new THREE.Mesh(taillightGeo, taillightMat);
    tlR.position.set(0.65, 0.72, -2.28);
    carGroup.add(tlL, tlR);

    // E. FRONT FENDERS
    const fenderGeo = new THREE.BoxGeometry(0.2, 0.65, 0.9);
    registerPanelMesh('fender_lhs', fenderGeo, defaultPaintMat, undefined, new THREE.Vector3(-0.88, 0.72, 1.35));
    registerPanelMesh('fender_rhs', fenderGeo, defaultPaintMat, undefined, new THREE.Vector3(0.88, 0.72, 1.35));

    // F. RUNNING BOARDS (SILL)
    const runningBoardGeo = new THREE.BoxGeometry(0.18, 0.2, 1.6);
    registerPanelMesh('running_board_lhs', runningBoardGeo, defaultPaintMat, undefined, new THREE.Vector3(-0.88, 0.28, 0));
    registerPanelMesh('running_board_rhs', runningBoardGeo, defaultPaintMat, undefined, new THREE.Vector3(0.88, 0.28, 0));

    // G. QUARTER PANELS
    const quarterGeo = new THREE.BoxGeometry(0.22, 0.7, 1.0);
    registerPanelMesh('quarter_panel_lhs', quarterGeo, defaultPaintMat, undefined, new THREE.Vector3(-0.88, 0.75, -1.35));
    registerPanelMesh('quarter_panel_rhs', quarterGeo, defaultPaintMat, undefined, new THREE.Vector3(0.88, 0.75, -1.35));

    // H. ROOF & WINDSHIELDS
    const roofGeo = new THREE.BoxGeometry(1.5, 0.1, 1.5);
    registerPanelMesh('roof', roofGeo, defaultPaintMat, undefined, new THREE.Vector3(0, 1.35, -0.1));

    const wsFrontGeo = new THREE.BoxGeometry(1.45, 0.6, 0.08);
    wsFrontGeo.rotateX(-Math.PI / 6);
    registerPanelMesh('windshield_front', wsFrontGeo, glassMat, undefined, new THREE.Vector3(0, 1.15, 0.8));

    const wsRearGeo = new THREE.BoxGeometry(1.45, 0.55, 0.08);
    wsRearGeo.rotateX(Math.PI / 6);
    registerPanelMesh('windshield_rear', wsRearGeo, glassMat, undefined, new THREE.Vector3(0, 1.15, -0.95));

    // I. ENGINE BAY APRONS & UNDERBODY
    const apronLhsGeo = new THREE.BoxGeometry(0.35, 0.45, 0.8);
    const apronRhsGeo = new THREE.BoxGeometry(0.35, 0.45, 0.8);
    registerPanelMesh('apron_lhs', apronLhsGeo, defaultPaintMat, undefined, new THREE.Vector3(-0.55, 0.6, 1.4));
    registerPanelMesh('apron_rhs', apronRhsGeo, defaultPaintMat, undefined, new THREE.Vector3(0.55, 0.6, 1.4));

    const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.7), engineMat);
    engineBlock.position.set(0, 0.55, 1.4);
    carGroup.add(engineBlock);

    const underbodyGeo = new THREE.BoxGeometry(1.65, 0.12, 3.8);
    registerPanelMesh('underbody', underbodyGeo, defaultPaintMat, undefined, new THREE.Vector3(0, 0.15, 0));

    // J. HINGED DOORS (FRONT LHS, FRONT RHS, REAR LHS, REAR RHS)
    const doorGeo = new THREE.BoxGeometry(0.12, 0.72, 0.78);
    const innerJambGeo = new THREE.BoxGeometry(0.1, 0.68, 0.74);

    // Door LHS Front Group
    const doorLhsFrontPivot = new THREE.Group();
    doorLhsFrontPivot.position.set(-0.82, 0.72, 0.75); // Hinge position
    carGroup.add(doorLhsFrontPivot);
    registerPanelMesh('door_lhs_front', doorGeo, defaultPaintMat, doorLhsFrontPivot, new THREE.Vector3(0, 0, -0.38));
    // Inner jamb mesh
    const innerJambLFR = new THREE.Mesh(innerJambGeo, defaultPaintMat);
    innerJambLFR.position.set(0.06, 0, -0.38);
    innerJambLFR.userData = { panelId: 'door_lhs_front', isInnerJamb: true };
    doorLhsFrontPivot.add(innerJambLFR);

    // Door RHS Front Group
    const doorRhsFrontPivot = new THREE.Group();
    doorRhsFrontPivot.position.set(0.82, 0.72, 0.75);
    carGroup.add(doorRhsFrontPivot);
    registerPanelMesh('door_rhs_front', doorGeo, defaultPaintMat, doorRhsFrontPivot, new THREE.Vector3(0, 0, -0.38));
    const innerJambRFR = new THREE.Mesh(innerJambGeo, defaultPaintMat);
    innerJambRFR.position.set(-0.06, 0, -0.38);
    innerJambRFR.userData = { panelId: 'door_rhs_front', isInnerJamb: true };
    doorRhsFrontPivot.add(innerJambRFR);

    // Door LHS Rear Group
    const doorLhsRearPivot = new THREE.Group();
    doorLhsRearPivot.position.set(-0.82, 0.72, -0.05);
    carGroup.add(doorLhsRearPivot);
    registerPanelMesh('door_lhs_rear', doorGeo, defaultPaintMat, doorLhsRearPivot, new THREE.Vector3(0, 0, -0.38));
    const innerJambLRR = new THREE.Mesh(innerJambGeo, defaultPaintMat);
    innerJambLRR.position.set(0.06, 0, -0.38);
    innerJambLRR.userData = { panelId: 'door_lhs_rear', isInnerJamb: true };
    doorLhsRearPivot.add(innerJambLRR);

    // Door RHS Rear Group
    const doorRhsRearPivot = new THREE.Group();
    doorRhsRearPivot.position.set(0.82, 0.72, -0.05);
    carGroup.add(doorRhsRearPivot);
    registerPanelMesh('door_rhs_rear', doorGeo, defaultPaintMat, doorRhsRearPivot, new THREE.Vector3(0, 0, -0.38));
    const innerJambRRR = new THREE.Mesh(innerJambGeo, defaultPaintMat);
    innerJambRRR.position.set(-0.06, 0, -0.38);
    innerJambRRR.userData = { panelId: 'door_rhs_rear', isInnerJamb: true };
    doorRhsRearPivot.add(innerJambRRR);

    // K. FRONT BONNET / HOOD (Long Sloped Front Snout)
    const bonnetPivot = new THREE.Group();
    bonnetPivot.position.set(0, 0.95, 0.9);
    carGroup.add(bonnetPivot);
    const bonnetGeo = new THREE.BoxGeometry(1.5, 0.1, 1.2);
    registerPanelMesh('hood_bonnet', bonnetGeo, defaultPaintMat, bonnetPivot, new THREE.Vector3(0, 0, 0.6));

    // L. REAR TRUNK / BOOT LID & BOOT FLOOR (Rear Notchback)
    const bootPivot = new THREE.Group();
    bootPivot.position.set(0, 1.05, -1.35);
    carGroup.add(bootPivot);
    const bootGeo = new THREE.BoxGeometry(1.5, 0.45, 0.7);
    registerPanelMesh('boot_trunk', bootGeo, defaultPaintMat, bootPivot, new THREE.Vector3(0, -0.15, -0.35));

    const bootFloorGeo = new THREE.BoxGeometry(1.4, 0.12, 0.7);
    registerPanelMesh('boot_floor', bootFloorGeo, defaultPaintMat, undefined, new THREE.Vector3(0, 0.45, -1.5));

    hingedGroupsRef.current = {
      doorLhsFront: doorLhsFrontPivot,
      doorRhsFront: doorRhsFrontPivot,
      doorLhsRear: doorLhsRearPivot,
      doorRhsRear: doorRhsRearPivot,
      hoodBonnet: bonnetPivot,
      bootTrunk: bootPivot
    };

    // 7. Raycasting & Mouse Interaction Setup
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    let isMouseDown = false;
    let previousMousePosition = { x: 0, y: 0 };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      isMouseDown = true;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      previousMousePosition = { x: clientX, y: clientY };
    };

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      if (isMouseDown) {
        const deltaX = clientX - previousMousePosition.x;
        const deltaY = clientY - previousMousePosition.y;

        carGroup.rotation.y += deltaX * 0.008;
        carGroup.rotation.x = Math.max(-0.8, Math.min(0.8, carGroup.rotation.x + deltaY * 0.008));

        previousMousePosition = { x: clientX, y: clientY };
      } else {
        // Raycast for hover
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(carGroup.children, true);
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
      if (isMouseDown) {
        isMouseDown = false;
      }
    };

    const handleCanvasClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(carGroup.children, true);
      if (intersects.length > 0) {
        const hit = intersects[0].object;
        if (hit.userData && hit.userData.panelId) {
          handlePanelClick(hit.userData.panelId);
        }
      }
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('mousedown', handlePointerDown);
    domElem.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    domElem.addEventListener('click', handleCanvasClick);

    domElem.addEventListener('touchstart', handlePointerDown);
    domElem.addEventListener('touchmove', handlePointerMove);
    window.addEventListener('touchend', handlePointerUp);

    // 8. Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Idle subtle spin if not interacting
      if (!isMouseDown) {
        carGroup.rotation.y += 0.0015;
      }

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

    if (h.doorLhsFront) h.doorLhsFront.rotation.y = doorAngleLHS;
    if (h.doorRhsFront) h.doorRhsFront.rotation.y = doorAngleRHS;
    if (h.doorLhsRear) h.doorLhsRear.rotation.y = doorAngleLHS;
    if (h.doorRhsRear) h.doorRhsRear.rotation.y = doorAngleRHS;
    if (h.hoodBonnet) h.hoodBonnet.rotation.x = bonnetAngle;
    if (h.bootTrunk) h.bootTrunk.rotation.x = bootAngle;
  }, [doorsOpen, bonnetOpen, dickyOpen]);

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

  // Update Material Colors based on Selected Inspections & Paint Scope
  useEffect(() => {
    const meshes = meshesMapRef.current;
    if (!meshes) return;

    VEHICLE_PANELS.forEach(panel => {
      const mesh = meshes.get(panel.id);
      if (!mesh) return;

      const inspection = inspections[panel.id];
      const isSelected = Boolean(inspection?.selected || selectedPanelIds.includes(panel.id));
      const isHovered = hoveredPanelId === panel.id;
      const scope: PaintScope = inspection?.paintScope || 'FULL_OUTER';

      const mat = (mesh as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (!mat) return;

      if (!isSelected) {
        if (isHovered) {
          // Hovered unselected panel: Subtle cyan glow highlight
          mat.color.setHex(0xe2e8f0);
          mat.emissive.setHex(0x0284c7);
          mat.emissiveIntensity = 0.4;
        } else {
          // Unselected default Alpine White finish
          mat.color.setHex(0xf8fafc);
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0;
        }
      } else {
        // Selected Panel: High-contrast Paint Scope Highlights
        switch (scope) {
          case 'FULL_OUTER':
            // High-Gloss Amber/Gold Outer Shell
            mat.color.setHex(0xf59e0b);
            mat.emissive.setHex(0x78350f);
            mat.emissiveIntensity = isHovered ? 0.8 : 0.4;
            break;
          case 'PARTIAL_TOUCHUP':
            // Vibrant Cyan/Electric Blue
            mat.color.setHex(0x06b6d4);
            mat.emissive.setHex(0x082f49);
            mat.emissiveIntensity = isHovered ? 0.8 : 0.4;
            break;
          case 'INSIDE_JAMB':
            // Inner Jamb / Door Frame Emerald Green
            mat.color.setHex(0x10b981);
            mat.emissive.setHex(0x064e3b);
            mat.emissiveIntensity = isHovered ? 0.8 : 0.4;
            break;
          case 'FULL_OUTER_AND_INSIDE':
            // Outer + Inside Glowing Warm Gold
            mat.color.setHex(0xeab308);
            mat.emissive.setHex(0x713f12);
            mat.emissiveIntensity = isHovered ? 0.8 : 0.4;
            break;
        }
      }
    });
  }, [inspections, selectedPanelIds, hoveredPanelId]);

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
            { id: 'ISO', label: '3D ISO', icon: '🧊' },
            { id: 'FRONT', label: 'Front / Bonnet', icon: '🚘' },
            { id: 'LHS', label: 'Left Doors', icon: '👈' },
            { id: 'RHS', label: 'Right Doors', icon: '👉' },
            { id: 'REAR', label: 'Rear / Dicky', icon: '🚗' },
            { id: 'UNDERBODY', label: 'Underbody', icon: '⚡' },
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

      {/* 3D Canvas Viewport */}
      <div className="relative w-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
        <div ref={mountRef} className="w-full h-[380px] sm:h-[460px] cursor-grab active:cursor-grabbing" />

        {/* Legend Overlay on Canvas */}
        <div className="absolute top-3 left-3 bg-slate-950/85 backdrop-blur-md p-2.5 rounded-xl border border-slate-800 text-[10px] space-y-1.5 shadow-xl">
          <div className="font-bold text-slate-400 uppercase tracking-wider mb-1">कलर लेजेंड (Color Codes):</div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-slate-100 border border-slate-300 inline-block shadow-sm" />
            <span className="text-slate-200 font-bold">Alpine White (डिफ़ॉल्ट गाड़ी का रंग)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-500 inline-block shadow-sm" />
            <span className="text-amber-300 font-bold">Full Paint (बाहर पूरा)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500 inline-block shadow-sm" />
            <span className="text-emerald-300 font-bold">Inside Paint (अंदर पिलर/फर्श)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-cyan-400 inline-block shadow-sm" />
            <span className="text-cyan-300 font-bold">Partial Touchup (आधा/पैच)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-yellow-400 inline-block shadow-sm" />
            <span className="text-yellow-300 font-bold">Outer + Inside (दोनों)</span>
          </div>
        </div>

        {/* Hovered Panel Floating Pill */}
        {activePanelObj && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-amber-500/40 shadow-xl flex items-center gap-3">
            <div>
              <div className="text-[10px] text-amber-400 font-bold uppercase">चयनित 3D पैनल</div>
              <div className="text-xs font-black text-white">{activePanelObj.nameHi}</div>
              <div className="text-[10.5px] font-mono text-amber-300 font-extrabold">
                {formatPaintTaskTitle(activePanelObj.nameEn, currentScope)}
              </div>
            </div>

            <button
              type="button"
              onClick={() => speakPanelInfo(activePanelObj)}
              className="p-2 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-slate-950 transition-colors"
              title="बोलकर सुनें"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>
        )}
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
              { id: 'FULL_OUTER', label: 'Full Paint (बाहर पूरा)', icon: '✨' },
              { id: 'PARTIAL_TOUCHUP', label: 'Partial Paint (आधा/टचअप)', icon: '🎨', disabled: !isPartialPaintAllowedForPanel(activePanelObj.id) },
              { id: 'INSIDE_JAMB', label: 'Inside Paint (अंदर पिलर)', icon: '🚪' },
              { id: 'FULL_OUTER_AND_INSIDE', label: 'Outer + Inside (दोनों)', icon: '🌟' }
            ].map(s => {
              const active = currentScope === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={s.disabled}
                  onClick={() => handlePanelClick(activePanelObj.id, s.id as PaintScope)}
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
