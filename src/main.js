import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { CATALOG_CATEGORIES, FURNITURE_CATALOG } from "./furnitureData.js";

const ROOM_SPACING = 6.5; // Distancia vertical entre salas

const canvas = document.getElementById("stage-canvas");
const crescentNav = document.getElementById("crescent-nav");
const crescentContainer = document.getElementById("crescent-items");
const btnPrev = document.getElementById("btn-prev");
const btnNext = document.getElementById("btn-next");
const navCounter = document.getElementById("nav-counter");

const menuToggleBtn = document.getElementById("menu-toggle");
const drawerCloseBtn = document.getElementById("drawer-close");
const categoryDrawer = document.getElementById("category-drawer");
const categoryListEl = document.getElementById("category-list");
const categoryEmptyMsg = document.getElementById("category-empty-msg");
const activeFilterChip = document.getElementById("active-filter-chip");

const scalePropBar = document.getElementById("scale-prop-bar");
const btnAvonToggle = document.getElementById("btn-avon-toggle");
const btnAvonRotate = document.getElementById("btn-avon-rotate");

const infoCard = document.getElementById("info-card");
const infoToggleBtn = document.getElementById("info-toggle");
const infoIndex = document.getElementById("info-index");
const infoCategory = document.getElementById("info-category");
const infoTitle = document.getElementById("info-title");
const infoDesc = document.getElementById("info-desc");
const infoDims = document.getElementById("info-dims");
const infoMaterials = document.getElementById("info-materials");
const infoPalette = document.getElementById("info-palette");
const brandDot = document.getElementById("brand-dot");

const isPortraitLayout = () =>
  window.matchMedia("(max-width: 820px) and (orientation: portrait)").matches;
const isLandscapeMobile = () =>
  window.matchMedia("(max-height: 540px) and (orientation: landscape)").matches;

const SVG_LOCK_OPEN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2.5"></rect><path d="M8 11V7a4 4 0 0 1 7.6-1.7"></path></svg>`;
const SVG_LOCK_CLOSED = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2.5"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>`;
const SVG_CLOSE_X = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>`;
const SVG_EXPAND_PLUS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>`;

/**
 * Entorno de estudio nocturno con softboxes direccionales 360°
 * para que las micro-aristas (0.6 mm) y micro-relieves ST9 capturen brillos realistas.
 */
function buildDarkStudioEnv(targetRenderer) {
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color("#0d1324");

  const addPanel = (color, intensity, pos, rot, size) => {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(intensity),
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), mat);
    mesh.position.set(...pos);
    mesh.rotation.set(...rot);
    envScene.add(mesh);
  };

  addPanel("#fff9f0", 3.6, [0, 6.2, 0.8], [Math.PI / 2, 0, 0], [4.0, 4.0]);
  addPanel("#fff5ea", 2.9, [5.0, 2.0, 2.6], [0, -Math.PI * 0.34, 0], [2.4, 3.8]);
  addPanel("#f3ece4", 2.2, [4.6, 2.4, -3.2], [0, -Math.PI * 0.68, 0], [2.2, 3.4]);
  addPanel("#e6eeff", 2.5, [-4.8, 2.1, 2.8], [0, Math.PI * 0.34, 0], [2.3, 3.6]);
  addPanel("#cfe0ff", 2.4, [-4.5, 2.6, -4.0], [0, Math.PI * 0.72, 0], [2.6, 3.4]);

  const pmrem = new THREE.PMREMGenerator(targetRenderer);
  const rt = pmrem.fromScene(envScene, 0.032);
  pmrem.dispose();
  return rt;
}

// Renderer principal transparente + Postprocesado MSAA + SMAA (elimina dientes de sierra fijos y al girar)
const pixelRatio = Math.min(window.devicePixelRatio, 2);
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 0.94;

const studioEnvRT = buildDarkStudioEnv(renderer);

const scene = new THREE.Scene();
scene.background = null;
scene.fog = null;
scene.environment = studioEnvRT.texture;
scene.environmentIntensity = 0.52;

const camera = new THREE.PerspectiveCamera(
  35,
  window.innerWidth / window.innerHeight,
  0.015,
  80
);

const composerTarget = new THREE.WebGLRenderTarget(
  Math.max(1, Math.floor(window.innerWidth * pixelRatio)),
  Math.max(1, Math.floor(window.innerHeight * pixelRatio)),
  {
    type: THREE.HalfFloatType,
    samples: 4,
  }
);
const composer = new EffectComposer(renderer, composerTarget);
composer.setPixelRatio(pixelRatio);
composer.setSize(window.innerWidth, window.innerHeight);

const renderPass = new RenderPass(scene, camera);
renderPass.clear = true;
renderPass.clearAlpha = 0;
composer.addPass(renderPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

const smaaPass = new SMAAPass(
  Math.max(1, Math.floor(window.innerWidth * pixelRatio)),
  Math.max(1, Math.floor(window.innerHeight * pixelRatio))
);
composer.addPass(smaaPass);

const hemiLight = new THREE.HemisphereLight("#f7f4ee", "#151d34", 0.32);
scene.add(hemiLight);

const keyRakeLight = new THREE.DirectionalLight("#fff6eb", 1.1);
keyRakeLight.position.set(-2.4, 1.7, 2.2);
scene.add(keyRakeLight);

const sideRakeLight = new THREE.DirectionalLight("#fff8f0", 0.96);
sideRakeLight.position.set(2.6, 1.35, -0.7);
scene.add(sideRakeLight);

const rimLight = new THREE.DirectionalLight("#dce8ff", 0.82);
rimLight.position.set(-1.6, 2.1, -2.5);
scene.add(rimLight);

// Estado de catálogo, filtros, candadito, tarjeta plegable, cuadernillo A4 y cámara
let selectedCategory = "Todos";
let filteredIndices = FURNITURE_CATALOG.map((_, idx) => idx);
let activeSlot = 0;
let activeIndex = filteredIndices[0];
let currentSlotProgress = 0;
let targetSlotProgress = 0;
let currentAnchorY = 0.66;

let isLocked = false;
let isInfoCollapsed = false;
let isDrawerOpen = false;

let currentAzimuth = FURNITURE_CATALOG[0].defaultYaw;
let targetAzimuth = FURNITURE_CATALOG[0].defaultYaw;
let currentPolar = FURNITURE_CATALOG[0].defaultPitch;
let targetPolar = FURNITURE_CATALOG[0].defaultPitch;
let currentRadius = 1.85;
let targetRadius = 1.85;

const currentPan = new THREE.Vector3();
const targetPan = new THREE.Vector3();

const MIN_POLAR = 0.03;
const MAX_POLAR = Math.PI / 2 - 0.025;
const MIN_RADIUS = 0.22;
const MAX_RADIUS = 12.5;

let isDragging = false;
let isPanning = false;
let lastPointerX = 0;
let lastPointerY = 0;
let dragDistance = 0;
let pointerDownButton = 0;
let userInteracted = false;
const activePointers = new Map();
let lastPinchDist = null;
let lastPinchCenter = null;

const pressedKeys = new Set();
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
const interactivePartByMesh = new WeakMap();

const rooms = [];
const maxAniso = renderer.capabilities.getMaxAnisotropy();

/**
 * Crea un cuadernillo A4 clásico de Avon anillado (21.0 × 29.7 × 0.8 cm) en escala real 1:1
 * con portada naranja + paisaje de atardecer en lago y anillado metálico, arrastrable sobre el mueble.
 */
function createAvonCatalogProp() {
  const widthM = 0.21;
  const depthM = 0.297;
  const heightM = 0.008;

  const coverCanvas = document.createElement("canvas");
  coverCanvas.width = 512;
  coverCanvas.height = 724;
  const ctx = coverCanvas.getContext("2d");

  // Fondo naranja cálido de tapa Avon
  const baseOrange = ctx.createLinearGradient(0, 0, 512, 724);
  baseOrange.addColorStop(0, "#f59e0b");
  baseOrange.addColorStop(0.45, "#f38b0a");
  baseOrange.addColorStop(1, "#e06d06");
  ctx.fillStyle = baseOrange;
  ctx.fillRect(0, 0, 512, 724);

  // Recuadro principal con escena de atardecer sobre lago (Nudgee Beach | Australia)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(42, 22);
  ctx.lineTo(486, 22);
  ctx.lineTo(486, 540);
  ctx.quadraticCurveTo(465, 588, 340, 575);
  ctx.quadraticCurveTo(175, 558, 72, 468);
  ctx.quadraticCurveTo(42, 435, 42, 340);
  ctx.closePath();
  ctx.clip();

  // Cielo crepuscular violeta-magenta-ámbar
  const skyGrad = ctx.createLinearGradient(110, 20, 390, 340);
  skyGrad.addColorStop(0, "#7c4d96");
  skyGrad.addColorStop(0.32, "#a95aa4");
  skyGrad.addColorStop(0.58, "#df799f");
  skyGrad.addColorStop(0.82, "#f59e42");
  skyGrad.addColorStop(1, "#fde047");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(40, 20, 450, 330);

  // Nubes violáceas suaves
  const cloudCenters = [
    [220, 105, 110, 48, "rgba(116, 62, 138, 0.42)"],
    [340, 82, 130, 54, "rgba(232, 162, 202, 0.36)"],
    [410, 165, 120, 46, "rgba(155, 82, 146, 0.38)"],
    [290, 205, 140, 40, "rgba(251, 146, 60, 0.32)"],
  ];
  for (const [cx, cy, rx, ry, col] of cloudCenters) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    const cg = ctx.createRadialGradient(0, 0, rx * 0.1, 0, 0, rx);
    cg.addColorStop(0, col);
    cg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Agua reflejando el atardecer
  const waterGrad = ctx.createLinearGradient(110, 330, 390, 585);
  waterGrad.addColorStop(0, "#facc15");
  waterGrad.addColorStop(0.28, "#fb923c");
  waterGrad.addColorStop(0.55, "#c04b7a");
  waterGrad.addColorStop(0.82, "#ea580c");
  waterGrad.addColorStop(1, "#f38b0a");
  ctx.fillStyle = waterGrad;
  ctx.fillRect(40, 330, 450, 270);

  // Destello dorado en la línea del horizonte y reflejo
  const sunGlow = ctx.createRadialGradient(255, 332, 8, 255, 332, 145);
  sunGlow.addColorStop(0, "rgba(254, 240, 138, 0.92)");
  sunGlow.addColorStop(0.42, "rgba(251, 191, 36, 0.45)");
  sunGlow.addColorStop(1, "rgba(251, 146, 60, 0)");
  ctx.fillStyle = sunGlow;
  ctx.fillRect(40, 210, 450, 260);

  // Siluetas de árboles costeros sobre el horizonte
  ctx.fillStyle = "#2b131c";
  ctx.fillRect(40, 326, 450, 8);
  const trees = [
    [95, 328, 34], [128, 324, 42], [164, 327, 28],
    [352, 328, 26], [388, 325, 36], [428, 324, 40], [462, 327, 30],
  ];
  for (const [tx, ty, tr] of trees) {
    ctx.beginPath();
    ctx.arc(tx, ty - tr * 0.45, tr * 0.65, 0, Math.PI * 2);
    ctx.arc(tx - tr * 0.35, ty - tr * 0.25, tr * 0.45, 0, Math.PI * 2);
    ctx.arc(tx + tr * 0.35, ty - tr * 0.28, tr * 0.48, 0, Math.PI * 2);
    ctx.fill();
  }

  // Reflejo oscuro suave de arboledas en el agua
  ctx.fillStyle = "rgba(43, 19, 28, 0.48)";
  for (const [tx, ty, tr] of trees) {
    ctx.beginPath();
    ctx.ellipse(tx, ty + tr * 0.55, tr * 0.72, tr * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Difuminado cálido superior/derecho/inferior para fundir la foto en la tapa naranja
  const edgeTop = ctx.createLinearGradient(0, 18, 0, 72);
  edgeTop.addColorStop(0, "rgba(243, 139, 10, 0.96)");
  edgeTop.addColorStop(1, "rgba(243, 139, 10, 0)");
  ctx.fillStyle = edgeTop;
  ctx.fillRect(40, 18, 450, 60);

  const edgeRight = ctx.createLinearGradient(490, 0, 444, 0);
  edgeRight.addColorStop(0, "rgba(243, 139, 10, 0.94)");
  edgeRight.addColorStop(1, "rgba(243, 139, 10, 0)");
  ctx.fillStyle = edgeRight;
  ctx.fillRect(444, 18, 48, 560);

  const edgeLeft = ctx.createLinearGradient(40, 0, 96, 0);
  edgeLeft.addColorStop(0, "rgba(243, 139, 10, 0.98)");
  edgeLeft.addColorStop(1, "rgba(243, 139, 10, 0)");
  ctx.fillStyle = edgeLeft;
  ctx.fillRect(40, 18, 60, 560);

  const edgeBottom = ctx.createLinearGradient(0, 580, 0, 470);
  edgeBottom.addColorStop(0, "rgba(232, 118, 4, 1)");
  edgeBottom.addColorStop(1, "rgba(232, 118, 4, 0)");
  ctx.fillStyle = edgeBottom;
  ctx.fillRect(40, 465, 450, 125);
  ctx.restore();

  // Perforaciones circulares para el anillado izquierdo
  ctx.fillStyle = "#4b2304";
  for (let i = 0; i < 22; i++) {
    const py = 28 + i * 31.8;
    ctx.beginPath();
    ctx.arc(17, py, 5.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Texto inferior izquierdo "Nudgee Beach | AUSTRALIA"
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.textAlign = "left";
  ctx.font = "600 13px sans-serif";
  ctx.fillText("Nudgee Beach  |  AUSTRALIA", 48, 676);

  // Marca AVON inferior derecha
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "right";
  ctx.font = "700 52px 'Segoe UI', Arial, sans-serif";
  ctx.fillText("AVON", 468, 682);

  const coverTex = new THREE.CanvasTexture(coverCanvas);
  coverTex.colorSpace = THREE.SRGBColorSpace;
  coverTex.anisotropy = maxAniso;

  const group = new THREE.Group();
  group.name = "Avon_A4_Reference";
  group.visible = false;

  const paperMat = new THREE.MeshStandardMaterial({
    color: "#f4f2eb",
    roughness: 0.78,
    metalness: 0.0,
  });
  const spineMat = new THREE.MeshStandardMaterial({
    color: "#dd7208",
    roughness: 0.36,
    metalness: 0.04,
  });
  const coverMat = new THREE.MeshStandardMaterial({
    map: coverTex,
    roughness: 0.28,
    metalness: 0.04,
  });
  const ringMat = new THREE.MeshStandardMaterial({
    color: "#f1f5f9",
    roughness: 0.24,
    metalness: 0.78,
  });

  // Bloque interior de páginas (levemente remetido desde el lomo anillado)
  const pagesMesh = new THREE.Mesh(
    new THREE.BoxGeometry(widthM - 0.008, heightM - 0.0014, depthM - 0.003),
    paperMat
  );
  pagesMesh.position.set(0.0035, heightM * 0.5, 0);

  // Tapa superior brillante con portada Avon paisaje + atardecer
  const topCoverMesh = new THREE.Mesh(
    new THREE.BoxGeometry(widthM - 0.004, 0.0008, depthM),
    [spineMat, spineMat, coverMat, spineMat, spineMat, spineMat]
  );
  topCoverMesh.position.set(0.002, heightM - 0.0004, 0);

  // Contratapa naranja inferior
  const bottomCoverMesh = new THREE.Mesh(
    new THREE.BoxGeometry(widthM - 0.004, 0.0008, depthM),
    spineMat
  );
  bottomCoverMesh.position.set(0.002, 0.0004, 0);

  // Lomo de borde
  const spineMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.002, heightM, depthM),
    spineMat
  );
  spineMesh.position.set(-widthM * 0.5 + 0.005, heightM * 0.5, 0);

  [pagesMesh, topCoverMesh, bottomCoverMesh, spineMesh].forEach((m) => {
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  });

  // Anillado espiral metálico doble a lo largo del margen izquierdo
  const ringGeo = new THREE.TorusGeometry(0.0068, 0.0011, 8, 18);
  const ringCount = 22;
  for (let i = 0; i < ringCount; i++) {
    const zPos = -depthM * 0.46 + (i / (ringCount - 1)) * (depthM * 0.92);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(-widthM * 0.5 + 0.0032, heightM * 0.5, zPos);
    ring.castShadow = true;
    group.add(ring);
  }

  scene.add(group);
  return {
    group,
    meshes: [pagesMesh, topCoverMesh, bottomCoverMesh, spineMesh],
  };
}

const avonProp = createAvonCatalogProp();
let isAvonVisible = false;
let isDraggingAvon = false;
let avonSurfaceY = 0.7;
let avonTargetYaw = 0.14;
let avonCurrentYaw = 0.14;
const avonDragOffset = new THREE.Vector3();
const avonTempNormal = new THREE.Vector3();
const avonNormalMatrix = new THREE.Matrix3();
const avonDragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const avonPlaneHit = new THREE.Vector3();

function getAvonPlacementTargets(room) {
  const targets = [];
  if (room?.modelRoot) targets.push(room.modelRoot);
  if (room?.pedestal) targets.push(room.pedestal);
  return targets;
}

function placeAvonOnActiveFurniture() {
  const room = rooms[activeIndex];
  if (!room || !room.modelRoot) return;

  room.roomGroup.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(room.modelRoot);
  const center = box.getCenter(new THREE.Vector3());

  // Busca la superficie superior más alta del mueble cerca del centro
  const probeOrigin = new THREE.Vector3(center.x, box.max.y + 0.5, center.z);
  raycaster.set(probeOrigin, new THREE.Vector3(0, -1, 0));
  const hits = raycaster.intersectObjects(getAvonPlacementTargets(room), true);

  let chosenPoint = null;
  for (const hit of hits) {
    if (!hit.face) continue;
    avonNormalMatrix.getNormalMatrix(hit.object.matrixWorld);
    avonTempNormal.copy(hit.face.normal).applyMatrix3(avonNormalMatrix).normalize();
    if (avonTempNormal.y > 0.65) {
      chosenPoint = hit.point.clone();
      break;
    }
  }

  if (!chosenPoint) {
    chosenPoint = new THREE.Vector3(center.x, box.max.y, center.z);
  }

  avonSurfaceY = chosenPoint.y;
  avonProp.group.position.set(chosenPoint.x, chosenPoint.y + 0.0004, chosenPoint.z);
}

function setAvonVisible(visible) {
  isAvonVisible = Boolean(visible);
  avonProp.group.visible = isAvonVisible;
  scalePropBar.classList.toggle("is-active", isAvonVisible);
  btnAvonToggle.classList.toggle("is-active", isAvonVisible);
  btnAvonToggle.setAttribute("aria-pressed", String(isAvonVisible));
  if (isAvonVisible) {
    placeAvonOnActiveFurniture();
  } else {
    isDraggingAvon = false;
    canvas.classList.remove("can-drag-prop", "is-dragging-prop");
  }
}

btnAvonToggle.addEventListener("click", () => setAvonVisible(!isAvonVisible));
btnAvonRotate.addEventListener("click", () => {
  if (!isAvonVisible) setAvonVisible(true);
  avonTargetYaw += Math.PI * 0.5;
});

function updateAvonDragAtPointer(clientX, clientY, isStart = false) {
  const room = rooms[activeIndex];
  if (!room) return;

  const rect = canvas.getBoundingClientRect();
  pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);

  const hits = raycaster.intersectObjects(getAvonPlacementTargets(room), true);
  let placed = false;

  for (const hit of hits) {
    if (!hit.face) continue;
    avonNormalMatrix.getNormalMatrix(hit.object.matrixWorld);
    avonTempNormal.copy(hit.face.normal).applyMatrix3(avonNormalMatrix).normalize();
    if (avonTempNormal.y > 0.65) {
      if (isStart) {
        avonDragOffset.subVectors(avonProp.group.position, hit.point);
        avonDragOffset.y = 0;
      }
      avonSurfaceY = hit.point.y;
      avonProp.group.position.set(
        hit.point.x + avonDragOffset.x,
        hit.point.y + 0.0004,
        hit.point.z + avonDragOffset.z
      );
      placed = true;
      break;
    }
    // Si chocamos de lleno con una cara vertical externa antes de encontrar estante superior, deslizamos sobre el plano horizontal activo
    break;
  }

  if (!placed) {
    avonDragPlane.constant = -avonSurfaceY;
    if (raycaster.ray.intersectPlane(avonDragPlane, avonPlaneHit)) {
      const clampLim = Math.max(0.95, (room.idealRadius || 1.85) * 0.65);
      avonProp.group.position.set(
        Math.max(-clampLim, Math.min(clampLim, avonPlaneHit.x + avonDragOffset.x)),
        avonSurfaceY + 0.0004,
        Math.max(-clampLim, Math.min(clampLim, avonPlaneHit.z + avonDragOffset.z))
      );
    }
  }
}

function createPedestalRoom(item, idx) {
  const roomY = -idx * ROOM_SPACING;
  const roomGroup = new THREE.Group();
  roomGroup.position.y = roomY;

  const floorMat = new THREE.ShadowMaterial({
    color: "#02040a",
    opacity: 0.45,
    transparent: true,
  });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(5.8, 56), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  roomGroup.add(floor);

  const pedestalMat = new THREE.MeshStandardMaterial({
    color: "#151d31",
    roughness: 0.44,
    metalness: 0.16,
  });
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.74, 0.82, 0.14, 64),
    pedestalMat
  );
  pedestal.position.y = 0.07;
  pedestal.receiveShadow = true;
  pedestal.castShadow = true;
  roomGroup.add(pedestal);

  const rimRing = new THREE.Mesh(
    new THREE.RingGeometry(0.82, 0.845, 64),
    new THREE.MeshBasicMaterial({
      color: item.accent,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    })
  );
  rimRing.rotation.x = -Math.PI / 2;
  rimRing.position.y = 0.004;
  roomGroup.add(rimRing);

  const modelPivot = new THREE.Group();
  modelPivot.position.y = 0.14;
  roomGroup.add(modelPivot);

  const spot = new THREE.SpotLight("#fff8ee", 13.5, 6.4, Math.PI * 0.16, 0.85, 2.0);
  spot.position.set(1.45, 3.35, 2.15);
  spot.target.position.set(0, 0.45, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(2048, 2048);
  spot.shadow.camera.near = 1.4;
  spot.shadow.camera.far = 6.5;
  spot.shadow.bias = -0.00015;
  spot.shadow.normalBias = 0.0018;
  roomGroup.add(spot, spot.target);

  scene.add(roomGroup);

  return {
    item,
    roomY,
    roomGroup,
    pedestal,
    rimRing,
    spot,
    modelPivot,
    modelRoot: null,
    modelSize: null,
    targetCenterY: 0.52,
    idealRadius: 1.85,
    interactiveParts: [],
    interactiveMeshes: [],
  };
}

const MATERIAL_TACTILE_PRESETS = {
  Egger_U732_Gris_Macadan: { roughness: 0.56, normalScale: 0.28, envMapIntensity: 0.94 },
  Egger_U999_Negro: { roughness: 0.55, normalScale: 0.28, envMapIntensity: 1.0 },
  Faplac_108TXT_Gris_Humo: { roughness: 0.58, normalScale: 0.25, envMapIntensity: 0.88 },
  Faplac_140BAR_Camellia: { roughness: 0.66, normalScale: 0.30, envMapIntensity: 0.78 },
  Egger_W954_Blanco: { roughness: 0.72, normalScale: 0.24, envMapIntensity: 0.72 },
  Acero_Satinado: { envMapIntensity: 1.12 },
};

function enhancePbrMaterials(root) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((mat) => {
      if (!mat) return;
      [mat.map, mat.normalMap, mat.roughnessMap, mat.metalnessMap].forEach((tex) => {
        if (!tex) return;
        tex.anisotropy = maxAniso;
        tex.needsUpdate = true;
      });
      if (mat.isMeshStandardMaterial) {
        const preset = MATERIAL_TACTILE_PRESETS[mat.name];
        if (preset) {
          if (preset.roughness !== undefined) mat.roughness = preset.roughness;
          if (preset.normalScale !== undefined && mat.normalMap) {
            mat.normalScale.set(preset.normalScale, preset.normalScale);
          }
          mat.envMapIntensity = preset.envMapIntensity ?? 0.82;
        } else {
          mat.envMapIntensity = 0.82;
        }
        mat.needsUpdate = true;
      }
    });
  });
}

function registerInteractiveParts(room, modelRoot) {
  room.interactiveParts = [];
  room.interactiveMeshes = [];
  room.modelPivot.updateMatrixWorld(true);

  const pivotWorldQuat = new THREE.Quaternion();
  room.modelPivot.getWorldQuaternion(pivotWorldQuat);
  const parentWorldQuat = new THREE.Quaternion();
  const invParentQuat = new THREE.Quaternion();

  modelRoot.traverse((node) => {
    const isDrawer = /^(Drawer|Cajon)_/i.test(node.name);
    const isDoor = /^(Door|Puerta)_/i.test(node.name);
    if (!isDrawer && !isDoor) return;

    const partBox = new THREE.Box3().setFromObject(node);
    const partSize = partBox.getSize(new THREE.Vector3());

    let partRecord;
    if (isDrawer) {
      node.parent.getWorldQuaternion(parentWorldQuat);
      invParentQuat.copy(parentWorldQuat).invert();
      const worldFront = new THREE.Vector3(0, 0, 1).applyQuaternion(pivotWorldQuat);
      const localFront = worldFront.applyQuaternion(invParentQuat).normalize();
      const travel = Math.min(0.32, Math.max(0.20, partSize.z * 0.62));
      partRecord = {
        type: "drawer",
        node,
        restPos: node.position.clone(),
        openDelta: localFront.multiplyScalar(travel),
        progress: 0,
        targetProgress: 0,
        isOpen: false,
      };
    } else {
      partRecord = {
        type: "door",
        node,
        restRotY: node.rotation.y,
        openAngle: Math.PI * 0.52,
        progress: 0,
        targetProgress: 0,
        isOpen: false,
      };
    }

    node.traverse((child) => {
      if (child.isMesh) {
        interactivePartByMesh.set(child, partRecord);
        room.interactiveMeshes.push(child);
      }
    });
    room.interactiveParts.push(partRecord);
  });
}

function captureThumbnailFromObject(object3d) {
  const thumbRenderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  thumbRenderer.setSize(240, 240);
  thumbRenderer.toneMapping = THREE.NeutralToneMapping;
  thumbRenderer.toneMappingExposure = 0.98;

  const thumbEnv = buildDarkStudioEnv(thumbRenderer);
  const thumbScene = new THREE.Scene();
  thumbScene.environment = thumbEnv.texture;
  thumbScene.environmentIntensity = 0.52;

  const clone = object3d.clone(true);
  const box = new THREE.Box3().setFromObject(clone);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.1);

  const thumbCam = new THREE.PerspectiveCamera(32, 1, 0.05, 20);
  const dist = maxDim * 1.95;
  thumbCam.position.set(center.x + dist * 0.62, center.y + dist * 0.36, center.z + dist * 0.78);
  thumbCam.lookAt(center);

  thumbScene.add(new THREE.HemisphereLight("#ffffff", "#1d2438", 0.55));
  const key = new THREE.DirectionalLight("#fff8ee", 1.18);
  key.position.set(2.5, 4, 3);
  thumbScene.add(key);

  thumbScene.add(clone);
  thumbRenderer.render(thumbScene, thumbCam);
  const dataUrl = thumbRenderer.domElement.toDataURL("image/png");

  thumbScene.remove(clone);
  thumbEnv.dispose();
  thumbRenderer.dispose();
  return dataUrl;
}

const crescentItemEls = [];

function buildCrescentSkeleton() {
  crescentContainer.innerHTML = "";
  FURNITURE_CATALOG.forEach((item, idx) => {
    const card = document.createElement("div");
    card.className = "crescent-item";
    card.setAttribute("role", "option");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", `${item.id} ${item.title}`);
    card.style.background = `radial-gradient(circle at 35% 30%, ${item.thumbBg[0]}, ${item.thumbBg[1]})`;

    const mediaWrap = document.createElement("div");
    mediaWrap.className = "crescent-media";

    const img = document.createElement("img");
    img.className = "crescent-thumb";
    img.alt = item.title;

    const badge = document.createElement("span");
    badge.className = "crescent-badge";
    badge.textContent = item.id;

    mediaWrap.append(img, badge);

    const lockBtn = document.createElement("button");
    lockBtn.type = "button";
    lockBtn.className = "lock-btn";
    lockBtn.innerHTML = SVG_LOCK_OPEN;
    lockBtn.setAttribute("aria-pressed", "false");
    lockBtn.title = "Fijar vista en este mueble (libertad de movimiento y cajones)";
    lockBtn.setAttribute("aria-label", "Bloquear selección en el mueble actual");
    lockBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleLock();
    });

    const tooltip = document.createElement("span");
    tooltip.className = "crescent-label-tooltip";
    tooltip.textContent = item.title;

    card.append(mediaWrap, lockBtn, tooltip);
    card.addEventListener("click", () => {
      if (isLocked) return;
      const slot = filteredIndices.indexOf(idx);
      if (slot !== -1) selectSlot(slot);
    });
    card.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && !isLocked) {
        e.preventDefault();
        const slot = filteredIndices.indexOf(idx);
        if (slot !== -1) selectSlot(slot);
      }
    });
    crescentContainer.appendChild(card);
    crescentItemEls.push({ btn: card, img, lockBtn });
  });
}

function getMatchingIndices(cat) {
  if (cat === "Todos") return FURNITURE_CATALOG.map((_, idx) => idx);
  return FURNITURE_CATALOG.reduce((acc, item, idx) => {
    if (Array.isArray(item.tags) && item.tags.includes(cat)) {
      acc.push(idx);
    }
    return acc;
  }, []);
}

function setDrawerOpen(open) {
  isDrawerOpen = Boolean(open);
  categoryDrawer.classList.toggle("is-open", isDrawerOpen);
  categoryDrawer.setAttribute("aria-hidden", String(!isDrawerOpen));
  menuToggleBtn.setAttribute("aria-expanded", String(isDrawerOpen));
  if (!isDrawerOpen) {
    categoryEmptyMsg.hidden = true;
  }
}

function buildCategoryMenu() {
  categoryListEl.innerHTML = "";
  CATALOG_CATEGORIES.forEach((cat) => {
    const count = getMatchingIndices(cat).length;
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "category-pill";
    pill.dataset.category = cat;
    if (count === 0) pill.classList.add("is-empty");
    if (cat === selectedCategory) pill.classList.add("is-selected");

    const label = document.createElement("span");
    label.textContent = cat;

    const countBadge = document.createElement("span");
    countBadge.className = "category-count";
    countBadge.textContent = String(count);

    pill.append(label, countBadge);
    pill.addEventListener("click", () => selectCategory(cat));
    categoryListEl.appendChild(pill);
  });
}

function selectCategory(cat) {
  const nextIndices = getMatchingIndices(cat);
  if (nextIndices.length === 0) {
    categoryEmptyMsg.textContent = `Aún no hay muebles cargados en «${cat}».`;
    categoryEmptyMsg.hidden = false;
    return;
  }

  categoryEmptyMsg.hidden = true;
  if (isLocked) setLocked(false);

  selectedCategory = cat;
  filteredIndices = nextIndices;
  activeFilterChip.textContent = selectedCategory;

  categoryListEl.querySelectorAll(".category-pill").forEach((el) => {
    el.classList.toggle("is-selected", el.dataset.category === selectedCategory);
  });

  const preservedSlot = filteredIndices.indexOf(activeIndex);
  const nextSlot = preservedSlot !== -1 ? preservedSlot : 0;
  const prevActive = activeIndex;

  activeSlot = nextSlot;
  activeIndex = filteredIndices[activeSlot];
  currentSlotProgress = activeSlot;
  targetSlotProgress = activeSlot;

  updateInfoPanel(activeIndex);
  if (activeIndex !== prevActive) {
    resetOrbitForRoom(activeIndex);
    if (isAvonVisible) placeAvonOnActiveFurniture();
  }
  layoutCrescentMenu(currentSlotProgress);
  setDrawerOpen(false);
}

menuToggleBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  setDrawerOpen(!isDrawerOpen);
});
drawerCloseBtn.addEventListener("click", () => setDrawerOpen(false));
document.addEventListener("pointerdown", (e) => {
  if (
    isDrawerOpen &&
    !categoryDrawer.contains(e.target) &&
    !menuToggleBtn.contains(e.target)
  ) {
    setDrawerOpen(false);
  }
});

// Cartel de información plegable con X / desplegable con +
function setInfoCollapsed(collapsed) {
  isInfoCollapsed = Boolean(collapsed);
  infoCard.classList.toggle("is-collapsed", isInfoCollapsed);
  infoToggleBtn.innerHTML = isInfoCollapsed ? SVG_EXPAND_PLUS : SVG_CLOSE_X;
  infoToggleBtn.setAttribute("aria-expanded", String(!isInfoCollapsed));
  infoToggleBtn.setAttribute(
    "aria-label",
    isInfoCollapsed ? "Desplegar información" : "Plegar información"
  );
  infoToggleBtn.title = isInfoCollapsed ? "Desplegar información" : "Plegar información";
}

infoToggleBtn.addEventListener("click", () => setInfoCollapsed(!isInfoCollapsed));

function syncLockUI() {
  document.body.classList.toggle("is-locked", isLocked);
  crescentItemEls.forEach(({ lockBtn }) => {
    lockBtn.classList.toggle("is-locked", isLocked);
    lockBtn.innerHTML = isLocked ? SVG_LOCK_CLOSED : SVG_LOCK_OPEN;
    lockBtn.setAttribute("aria-pressed", String(isLocked));
    lockBtn.title = isLocked
      ? "Candado cerrado: clic para desbloquear cambio de mueble"
      : "Fijar vista en este mueble (libertad de movimiento y cajones)";
  });
  btnPrev.disabled = isLocked || activeSlot === 0;
  btnNext.disabled = isLocked || activeSlot >= filteredIndices.length - 1;
  if (!isLocked) {
    canvas.classList.remove("can-interact-part");
  }
}

function setLocked(locked) {
  isLocked = Boolean(locked);
  if (isLocked) {
    userInteracted = true;
  }
  syncLockUI();
  layoutCrescentMenu(currentSlotProgress);
}

function toggleLock() {
  setLocked(!isLocked);
}

function layoutCrescentMenu(slotProgress) {
  const portrait = isPortraitLayout();
  const compactLandscape = isLandscapeMobile();
  const tablet = window.innerWidth <= 1080;

  crescentItemEls.forEach(({ btn }, idx) => {
    const slotIdx = filteredIndices.indexOf(idx);
    if (slotIdx === -1) {
      btn.style.display = "none";
      btn.classList.remove("is-active");
      btn.setAttribute("aria-selected", "false");
      return;
    }

    btn.style.display = "flex";
    const offset = slotIdx - slotProgress;
    const absOff = Math.abs(offset);
    const scale = Math.max(0.46, 1.0 - absOff * 0.25);
    const maxVisibleOff = compactLandscape ? 1.85 : 2.6;
    let opacity = absOff > maxVisibleOff ? 0 : Math.max(0.34, 1 - absOff * 0.24);
    const isActive = idx === activeIndex;

    if (portrait) {
      const maxStepX = Math.min(92, Math.max(72, window.innerWidth * 0.21));
      const arcLift = 18;
      const norm = Math.min(absOff / 2.0, 1.2);
      const x = offset * maxStepX;
      const y = -arcLift * Math.max(0, 1 - norm * norm * 0.85);
      btn.style.transform = `translate3d(calc(-50% + ${x.toFixed(1)}px), ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
    } else {
      const maxStepY = compactLandscape ? 68 : tablet ? 104 : 122;
      const arcDepth = compactLandscape ? 36 : tablet ? 58 : 76;
      const baseX = compactLandscape ? 60 : tablet ? 68 : 78;
      const norm = Math.min(absOff / 2.2, 1.2);
      const x = baseX + arcDepth * Math.max(0, 1 - norm * norm * 0.85);
      const y = offset * maxStepY;
      btn.style.transform = `translate3d(${x.toFixed(1)}px, calc(-50% + ${y.toFixed(1)}px), 0) scale(${scale.toFixed(3)})`;
    }

    if (isLocked && !isActive) {
      opacity = 0.22;
    }

    btn.style.opacity = opacity.toFixed(3);
    btn.style.zIndex = String(Math.round(50 - absOff * 10));
    btn.style.pointerEvents =
      opacity < 0.08 || (isLocked && !isActive) ? "none" : "auto";

    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-selected", String(isActive));
  });
}

function updateInfoPanel(idx) {
  const item = FURNITURE_CATALOG[idx];
  document.documentElement.style.setProperty("--accent", item.accent);
  brandDot.style.backgroundColor = item.accent;
  brandDot.style.boxShadow = `0 0 14px ${item.accent}`;

  infoIndex.textContent = item.id;
  infoCategory.textContent = item.category;
  infoTitle.textContent = item.title;
  infoDesc.textContent = item.description;
  infoDims.textContent = item.dimensions;
  infoMaterials.textContent = item.materialsLabel;

  infoPalette.innerHTML = "";
  item.palette.forEach((hex) => {
    const dot = document.createElement("span");
    dot.className = "swatch-dot";
    dot.style.backgroundColor = hex;
    dot.title = hex;
    infoPalette.appendChild(dot);
  });

  const posStr = String(activeSlot + 1).padStart(2, "0");
  const totalStr = String(filteredIndices.length).padStart(2, "0");
  navCounter.textContent = `${posStr} / ${totalStr}`;
  btnPrev.disabled = isLocked || activeSlot === 0;
  btnNext.disabled = isLocked || activeSlot >= filteredIndices.length - 1;
}

function resetOrbitForRoom(idx) {
  const item = FURNITURE_CATALOG[idx];
  const room = rooms[idx];
  targetAzimuth = item.defaultYaw;
  targetPolar = item.defaultPitch;
  targetRadius = room ? room.idealRadius : 1.85;
  targetPan.set(0, 0, 0);
  userInteracted = false;
}

function clampRadius(r) {
  return Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, r));
}

function stepZoom(factor) {
  userInteracted = true;
  targetRadius = clampRadius(targetRadius * factor);
}

function selectSlot(slot) {
  if (isLocked) return;
  const clampedSlot = Math.max(0, Math.min(filteredIndices.length - 1, slot));
  if (clampedSlot !== activeSlot) {
    activeSlot = clampedSlot;
    activeIndex = filteredIndices[activeSlot];
    targetSlotProgress = clampedSlot;
    updateInfoPanel(activeIndex);
    resetOrbitForRoom(activeIndex);
    if (isAvonVisible) placeAvonOnActiveFurniture();
  }
}

btnPrev.addEventListener("click", () => selectSlot(activeSlot - 1));
btnNext.addEventListener("click", () => selectSlot(activeSlot + 1));

let navSwipeActive = false;
let navSwipeStartX = 0;
let navSwipeStartY = 0;

crescentNav.addEventListener("pointerdown", (e) => {
  if (isLocked || e.target.closest(".lock-btn")) return;
  navSwipeActive = true;
  navSwipeStartX = e.clientX;
  navSwipeStartY = e.clientY;
});

crescentNav.addEventListener("pointermove", (e) => {
  if (!navSwipeActive || isLocked) return;
  const dx = e.clientX - navSwipeStartX;
  const dy = e.clientY - navSwipeStartY;
  const primaryDelta = isPortraitLayout() ? dx : dy;
  if (Math.abs(primaryDelta) > 36) {
    navSwipeActive = false;
    selectSlot(activeSlot + (primaryDelta < 0 ? 1 : -1));
  }
});

const stopNavSwipe = () => {
  navSwipeActive = false;
};
crescentNav.addEventListener("pointerup", stopNavSwipe);
crescentNav.addEventListener("pointercancel", stopNavSwipe);

let wheelCooldown = false;
window.addEventListener(
  "wheel",
  (e) => {
    if (isDrawerOpen && categoryDrawer.contains(e.target)) return;
    e.preventDefault();
    if (isLocked || e.ctrlKey || e.shiftKey) {
      const zoomStep = Math.max(0.00045, targetRadius * 0.0014);
      targetRadius = clampRadius(targetRadius + e.deltaY * zoomStep);
      userInteracted = true;
      return;
    }
    if (wheelCooldown || Math.abs(e.deltaY) < 8) return;
    wheelCooldown = true;
    selectSlot(activeSlot + (e.deltaY > 0 ? 1 : -1));
    setTimeout(() => {
      wheelCooldown = false;
    }, 320);
  },
  { passive: false }
);

window.addEventListener("keydown", (e) => {
  pressedKeys.add(e.key.toLowerCase());

  if (e.key === "Escape") {
    if (isDrawerOpen) {
      setDrawerOpen(false);
      return;
    }
    if (isLocked) {
      setLocked(false);
      return;
    }
  }

  if (e.key === "+" || e.key === "=") {
    stepZoom(0.8);
    return;
  } else if (e.key === "-") {
    stepZoom(1.25);
    return;
  }

  if (isLocked) return;

  if (
    e.key === "ArrowDown" ||
    e.key === "PageDown" ||
    (isPortraitLayout() && e.key === "ArrowRight")
  ) {
    e.preventDefault();
    selectSlot(activeSlot + 1);
  } else if (
    e.key === "ArrowUp" ||
    e.key === "PageUp" ||
    (isPortraitLayout() && e.key === "ArrowLeft")
  ) {
    e.preventDefault();
    selectSlot(activeSlot - 1);
  }
});

window.addEventListener("keyup", (e) => {
  pressedKeys.delete(e.key.toLowerCase());
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

const _panRight = new THREE.Vector3();
const _panUp = new THREE.Vector3();

function getPinchMetrics() {
  if (activePointers.size < 2) return null;
  const pts = Array.from(activePointers.values());
  return {
    dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
    cx: (pts[0].x + pts[1].x) * 0.5,
    cy: (pts[0].y + pts[1].y) * 0.5,
  };
}

function applyPanDelta(dx, dy) {
  const panScale = Math.max(0.00055, currentRadius * (isLocked ? 0.00175 : 0.0014));
  const baseIdeal = rooms[activeIndex]?.idealRadius || 1.85;
  const panLimit = isLocked ? Math.max(1.6, baseIdeal * 1.2) : Math.max(0.42, baseIdeal * 0.48);

  camera.updateMatrixWorld();
  _panRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  _panUp.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
  targetPan.addScaledVector(_panRight, -dx * panScale);
  targetPan.addScaledVector(_panUp, dy * panScale);
  targetPan.x = Math.max(-panLimit, Math.min(panLimit, targetPan.x));
  targetPan.y = Math.max(-panLimit * 0.85, Math.min(panLimit * 1.15, targetPan.y));
  targetPan.z = Math.max(-panLimit, Math.min(panLimit, targetPan.z));
}

function isPointerOverAvon(clientX, clientY) {
  if (!isAvonVisible) return false;
  const rect = canvas.getBoundingClientRect();
  pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);
  return raycaster.intersectObjects(avonProp.meshes, false).length > 0;
}

function tryInteractAtPointer(clientX, clientY, toggleOnHit) {
  if (!isLocked) return false;
  const room = rooms[activeIndex];
  if (!room || room.interactiveMeshes.length === 0) return false;

  const rect = canvas.getBoundingClientRect();
  pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointerNDC, camera);
  const hits = raycaster.intersectObjects(room.interactiveMeshes, false);
  const hitMesh = hits[0]?.object;
  const part = hitMesh ? interactivePartByMesh.get(hitMesh) || null : null;

  canvas.classList.toggle("can-interact-part", Boolean(part));
  if (toggleOnHit && part) {
    part.isOpen = !part.isOpen;
    part.targetProgress = part.isOpen ? 1 : 0;
    return true;
  }
  return Boolean(part);
}

canvas.addEventListener("pointerdown", (e) => {
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (activePointers.size === 2) {
    const metrics = getPinchMetrics();
    lastPinchDist = metrics?.dist ?? null;
    lastPinchCenter = metrics ? { x: metrics.cx, y: metrics.cy } : null;
    isDragging = false;
    isDraggingAvon = false;
    canvas.classList.remove("is-dragging-prop");
    return;
  }

  // Si toca el cuadernillo A4 de Avon, agarrarlo y moverlo por sobre el mueble
  if (e.button === 0 && isPointerOverAvon(e.clientX, e.clientY)) {
    isDraggingAvon = true;
    userInteracted = true;
    canvas.classList.add("is-dragging-prop");
    updateAvonDragAtPointer(e.clientX, e.clientY, true);
    canvas.setPointerCapture(e.pointerId);
    return;
  }

  isDragging = true;
  pointerDownButton = e.button;
  isPanning = e.button === 2 || e.button === 1 || e.shiftKey;
  lastPointerX = e.clientX;
  lastPointerY = e.clientY;
  dragDistance = 0;
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener("pointermove", (e) => {
  if (activePointers.has(e.pointerId)) {
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }
  if (activePointers.size === 2) {
    const metrics = getPinchMetrics();
    if (metrics && lastPinchDist) {
      const ratio = lastPinchDist / metrics.dist;
      targetRadius = clampRadius(targetRadius * ratio);
      if (isLocked && lastPinchCenter) {
        applyPanDelta(metrics.cx - lastPinchCenter.x, metrics.cy - lastPinchCenter.y);
      }
      userInteracted = true;
    }
    lastPinchDist = metrics?.dist ?? null;
    lastPinchCenter = metrics ? { x: metrics.cx, y: metrics.cy } : null;
    return;
  }

  if (isDraggingAvon) {
    updateAvonDragAtPointer(e.clientX, e.clientY, false);
    return;
  }

  if (!isDragging) {
    const overAvon = isPointerOverAvon(e.clientX, e.clientY);
    canvas.classList.toggle("can-drag-prop", overAvon);
    if (!overAvon && isLocked) {
      tryInteractAtPointer(e.clientX, e.clientY, false);
    } else if (overAvon) {
      canvas.classList.remove("can-interact-part");
    }
    return;
  }

  const dx = e.clientX - lastPointerX;
  const dy = e.clientY - lastPointerY;
  dragDistance += Math.hypot(dx, dy);
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
    userInteracted = true;
  }
  lastPointerX = e.clientX;
  lastPointerY = e.clientY;

  if (isPanning || e.shiftKey || (e.buttons & 2) || (e.buttons & 4)) {
    applyPanDelta(dx, dy);
    return;
  }

  const orbitScale = 0.0038 + 0.0046 * Math.min(1.1, Math.max(0.22, currentRadius / 1.85));
  const maxPolarNow = isLocked ? Math.PI / 2 - 0.012 : MAX_POLAR;
  targetAzimuth -= dx * orbitScale;
  targetPolar = Math.max(MIN_POLAR, Math.min(maxPolarNow, targetPolar - dy * orbitScale * 0.9));
});

function stopDragging(e) {
  activePointers.delete(e?.pointerId);
  if (activePointers.size < 2) {
    lastPinchDist = null;
    lastPinchCenter = null;
  }
  if (isDraggingAvon) {
    isDraggingAvon = false;
    canvas.classList.remove("is-dragging-prop");
    if (e?.pointerId !== undefined && canvas.hasPointerCapture?.(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    return;
  }
  if (!isDragging) return;
  const wasClick = dragDistance < 6 && pointerDownButton === 0 && e?.type === "pointerup";
  isDragging = false;
  isPanning = false;
  if (e?.pointerId !== undefined && canvas.hasPointerCapture?.(e.pointerId)) {
    canvas.releasePointerCapture(e.pointerId);
  }
  if (wasClick && isLocked) {
    tryInteractAtPointer(e.clientX, e.clientY, true);
  }
}

canvas.addEventListener("pointerup", stopDragging);
canvas.addEventListener("pointercancel", stopDragging);
canvas.addEventListener("dblclick", (e) => {
  if (isPointerOverAvon(e.clientX, e.clientY)) return;
  resetOrbitForRoom(activeIndex);
  if (isLocked) userInteracted = true;
});

/**
 * Calcula una distancia de cámara adaptativa al aspect ratio y dimensiones reales del mueble
 * para que cada pieza conserve un impacto visual uniforme tanto en móvil vertical como en escritorio.
 */
function computeIdealRadius(size) {
  if (!size) return 1.85;
  const aspect = Math.max(0.32, window.innerWidth / Math.max(1, window.innerHeight));
  const halfVTan = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
  const halfHTan = halfVTan * aspect;

  const majorPlan = Math.max(size.x, size.z);
  const minorPlan = Math.min(size.x, size.z);
  const projW = majorPlan * 0.84 + minorPlan * 0.48;
  const projH = size.y * 0.92 + minorPlan * 0.24;

  const portrait = isPortraitLayout();
  const compactLandscape = isLandscapeMobile();

  if (portrait) {
    const rW = (projW * 0.5) / (halfHTan * 0.68);
    const rH = (projH * 0.5) / (halfVTan * 0.34);
    return clampRadius(Math.max(2.65, rW, rH));
  }

  const fillW = compactLandscape ? 0.44 : 0.44;
  const fillH = compactLandscape ? 0.52 : 0.56;
  const rW = (projW * 0.5) / (halfHTan * fillW);
  const rH = (projH * 0.5) / (halfVTan * fillH);
  return clampRadius(Math.max(1.75, rW, rH));
}

function updateCameraFraming() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;

  if (isPortraitLayout()) {
    const topReserved = Math.min(238, h * 0.29);
    const bottomReserved = Math.min(208, h * 0.25);
    const availableCenterY = topReserved + (h - topReserved - bottomReserved) * 0.5;
    const pixelShiftY = h * 0.5 - availableCenterY;
    camera.setViewOffset(w, h, 0, pixelShiftY, w, h);
  } else if (isLandscapeMobile()) {
    const leftReserved = 150;
    const rightReserved = 250;
    const availableCenter = leftReserved + (w - leftReserved - rightReserved) * 0.5;
    const pixelShiftX = w * 0.5 - availableCenter;
    camera.setViewOffset(w, h, pixelShiftX, 0, w, h);
  } else {
    const leftReserved = w <= 1080 ? 190 : 240;
    const rightReserved = w <= 1080 ? 250 : 320;
    const availableCenter = leftReserved + (w - leftReserved - rightReserved) * 0.5;
    const pixelShiftX = w * 0.5 - availableCenter;
    camera.setViewOffset(w, h, pixelShiftX, 0, w, h);
  }

  camera.updateProjectionMatrix();
}

window.addEventListener("resize", () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h);
  composer.setPixelRatio(dpr);
  composer.setSize(w, h);
  smaaPass.setSize(Math.max(1, Math.floor(w * dpr)), Math.max(1, Math.floor(h * dpr)));
  updateCameraFraming();
  rooms.forEach((room) => {
    if (room.modelSize) {
      room.idealRadius = computeIdealRadius(room.modelSize);
    }
  });
  if (!userInteracted && rooms[activeIndex]) {
    targetRadius = rooms[activeIndex].idealRadius;
  }
  layoutCrescentMenu(currentSlotProgress);
});

// Inicializar salas, UI y cargar GLBs con PBR real
FURNITURE_CATALOG.forEach((item, idx) => {
  rooms.push(createPedestalRoom(item, idx));
});

buildCrescentSkeleton();
buildCategoryMenu();
setInfoCollapsed(false);
updateInfoPanel(activeIndex);
updateCameraFraming();
layoutCrescentMenu(0);
syncLockUI();

const loader = new GLTFLoader();
FURNITURE_CATALOG.forEach((item, idx) => {
  loader.load(
    item.glbPath,
    (gltf) => {
      const modelRoot = gltf.scene;
      enhancePbrMaterials(modelRoot);

      const box = new THREE.Box3().setFromObject(modelRoot);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      modelRoot.position.x -= center.x;
      modelRoot.position.z -= center.z;
      modelRoot.position.y -= box.min.y;

      const room = rooms[idx];
      room.modelPivot.add(modelRoot);
      room.modelRoot = modelRoot;
      room.modelSize = size.clone();
      room.targetCenterY = size.y * 0.52;
      room.idealRadius = computeIdealRadius(size);

      registerInteractiveParts(room, modelRoot);

      const halfFootprint = Math.hypot(size.x, size.z) * 0.5;
      const scaleR = Math.max(1.0, (halfFootprint + 0.16) / 0.74);
      if (scaleR > 1.01) {
        room.pedestal.scale.set(scaleR, 1, scaleR);
        room.rimRing.scale.set(scaleR, scaleR, 1);
        room.spot.position.set(1.45 * scaleR, 3.35 + (scaleR - 1) * 1.1, 2.15 * scaleR);
        room.spot.distance = 6.4 * scaleR;
        room.spot.angle = Math.min(Math.PI * 0.32, Math.PI * 0.16 * Math.sqrt(scaleR));
        room.spot.intensity = 13.5 * Math.pow(scaleR, 1.35);
        room.spot.shadow.camera.far = 6.5 * scaleR;
        room.spot.shadow.camera.updateProjectionMatrix();
      }

      if (idx === activeIndex) {
        currentAnchorY = room.roomY + 0.14 + room.targetCenterY;
        if (!userInteracted) {
          targetRadius = room.idealRadius;
          currentRadius = room.idealRadius;
        }
        if (isAvonVisible) placeAvonOnActiveFurniture();
      }

      crescentItemEls[idx].img.src = captureThumbnailFromObject(modelRoot);
    },
    undefined,
    (err) => {
      console.error(`Error cargando ${item.glbPath}:`, err);
    }
  );
});

const clock = new THREE.Clock();

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  const prevProgress = currentSlotProgress;
  currentSlotProgress += (targetSlotProgress - currentSlotProgress) * Math.min(1, dt * 7.5);
  if (Math.abs(currentSlotProgress - prevProgress) > 0.0002) {
    layoutCrescentMenu(currentSlotProgress);
  }

  if (isLocked) {
    let keyDx = 0;
    let keyDy = 0;
    if (pressedKeys.has("arrowright") || pressedKeys.has("d")) keyDx -= 1;
    if (pressedKeys.has("arrowleft") || pressedKeys.has("a")) keyDx += 1;
    if (pressedKeys.has("arrowup") || pressedKeys.has("w")) keyDy += 1;
    if (pressedKeys.has("arrowdown") || pressedKeys.has("s")) keyDy -= 1;
    if (keyDx !== 0 || keyDy !== 0) {
      applyPanDelta(keyDx * 420 * dt, keyDy * 420 * dt);
    }
  }

  if (!isDragging && !isDraggingAvon && !userInteracted && !isLocked) {
    targetAzimuth += dt * 0.22;
  }

  currentAzimuth += (targetAzimuth - currentAzimuth) * Math.min(1, dt * 10);
  currentPolar += (targetPolar - currentPolar) * Math.min(1, dt * 10);
  currentRadius += (targetRadius - currentRadius) * Math.min(1, dt * 10);
  currentPan.lerp(targetPan, Math.min(1, dt * 10));

  if (isAvonVisible) {
    avonCurrentYaw += (avonTargetYaw - avonCurrentYaw) * Math.min(1, dt * 12);
    avonProp.group.rotation.y = avonCurrentYaw;
  }

  for (const room of rooms) {
    for (const part of room.interactiveParts) {
      if (Math.abs(part.targetProgress - part.progress) > 0.0005) {
        part.progress += (part.targetProgress - part.progress) * Math.min(1, dt * 8.5);
        const eased = easeInOutCubic(part.progress);
        if (part.type === "drawer") {
          part.node.position.copy(part.restPos).addScaledVector(part.openDelta, eased);
        } else {
          part.node.rotation.y = part.restRotY + part.openAngle * eased;
        }
      }
    }
  }

  const activeRoom = rooms[activeIndex];
  const targetAnchorY = activeRoom.roomY + 0.14 + activeRoom.targetCenterY;
  currentAnchorY += (targetAnchorY - currentAnchorY) * Math.min(1, dt * 7.5);

  const targetX = currentPan.x;
  const targetY = currentAnchorY + currentPan.y;
  const targetZ = currentPan.z;

  const sinPhi = Math.sin(currentPolar);
  const camX = targetX + currentRadius * sinPhi * Math.sin(currentAzimuth);
  const camY = targetY + currentRadius * Math.cos(currentPolar);
  const camZ = targetZ + currentRadius * sinPhi * Math.cos(currentAzimuth);

  camera.position.set(camX, camY, camZ);
  camera.lookAt(targetX, targetY, targetZ);

  composer.render();
}

animate();
