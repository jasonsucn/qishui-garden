import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createArchitecture } from './architecture.js';
import { createNature } from './nature.js';
import { createPond, POND_CONTOUR, WATER_LEVEL } from './pond.js';
import { createWeather } from './weather.js';
import { GardenAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const urlParams = new URLSearchParams(location.search);
const staticMode = urlParams.get('static') === '1';
const audio = new GardenAudio();
const state = {
  entered: false, season: 'spring', weather: 'sunny', hour: 8, night: 0,
  feedMode: false, touring: false, muted: false, volume: .65, quality: 'high',
  labels: true, autoRotate: false, currentView: 'overview'
};
let renderer, scene, camera, controls, composer, bloomPass, sun, moonLight, hemi;
let architecture, nature, pond, weatherSystem, groundMaterial, stars, moon;
let cameraTween = null, hourTween = null, tourIndex = 0, tourElapsed = 0;
let pointerDown = null, hoverTime = 0, toastTimer, saveTimer, lastTime = 0;
let feedMessageShown = false, audioReady = false, lastEatSound = 0, lastFrameStamp = 0;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clock = new THREE.Clock();
const pulses = [];
const interactiveRoots = [];
const mouse = { x: 0, y: 0, clientX: 0, clientY: 0, inside: false };
const tempVec = new THREE.Vector3();
const views = [
  { id: 'overview', title: '一院江南', subtitle: '风回一袖，水满清池', position: [28, 24, 32], target: [0, 1.1, 0], poem: '小阁藏春，闲窗锁昼。<br>一池碧水，半日清欢。', source: '栖水园 · 游园偶记' },
  { id: 'pond', title: '鱼戏莲叶', subtitle: '一尾锦霞，拨动碧水', position: [13.8, 11.5, 17.5], target: [3.5, .1, 3.7], poem: '鱼戏莲叶东，鱼戏莲叶西。<br>不觉花影动，方知游鳞归。', source: '汉乐府意 · 观鱼' },
  { id: 'tea', title: '竹里煎茶', subtitle: '且将新火，试一壶新茶', position: [-1.5, 7.5, 12.5], target: [-9.2, 2, 1.2], poem: '竹下忘言对紫茶，<br>全胜羽客醉流霞。', source: '钱起 · 与赵莒茶宴' },
  { id: 'hall', title: '听雨寒窗', subtitle: '黛瓦承珠，木窗含翠', position: [12, 8.5, 5], target: [-1, 2.4, -9], poem: '殷勤昨夜三更雨，<br>又得浮生一日凉。', source: '苏轼 · 鹧鸪天' },
  { id: 'bridge', title: '曲桥枕水', subtitle: '桥分两岸，影落池中', position: [-5, 5.8, 13], target: [2.8, .5, 3], poem: '曲径通幽处，禅房花木深。<br>山光悦鸟性，潭影空人心。', source: '常建 · 题破山寺后禅院' },
  { id: 'moon', title: '月满西楼', subtitle: '灯映池水，风过檐铃', position: [20, 10.5, 17], target: [-1, 2, -3], poem: '疏影横斜水清浅，<br>暗香浮动月黄昏。', source: '林逋 · 山园小梅' }
];
const seasonPoems = {
  spring: ['一汀烟雨杏花寒，<br>竹外新绿上阑干。', '栖水园 · 春信'],
  summer: ['接天莲叶无穷碧，<br>映日荷花别样红。', '杨万里 · 晓出净慈寺'],
  autumn: ['停车坐爱枫林晚，<br>霜叶红于二月花。', '杜牧 · 山行'],
  winter: ['晚来天欲雪，<br>能饮一杯无？', '白居易 · 问刘十九']
};

function loading(progress, text) {
  $('loading-fill').style.width = `${progress}%`;
  $('loading-text').textContent = text;
}
function toast(message, duration = 2600) {
  clearTimeout(toastTimer);
  $('toast').innerHTML = message;
  $('toast').classList.add('visible');
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), duration);
}
function playSound(name, options) {
  if (audioReady && !state.muted) audio.play(name, options);
}
function saveSettings() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem('qishui-garden-v1', JSON.stringify({ season: state.season, weather: state.weather, hour: state.hour, volume: state.volume, quality: state.quality, labels: state.labels, autoRotate: state.autoRotate }));
    } catch (_) { /* 隐私模式下仍可使用，不保存 */ }
  }, 250);
}
function loadSettings() {
  const requestedQuality = urlParams.get('quality');
  if (['high', 'medium', 'low'].includes(requestedQuality)) state.quality = requestedQuality;
  try {
    const saved = JSON.parse(localStorage.getItem('qishui-garden-v1') || '{}');
    if (['spring', 'summer', 'autumn', 'winter'].includes(saved.season)) state.season = saved.season;
    if (['sunny', 'rain', 'snow'].includes(saved.weather)) state.weather = saved.weather;
    if (Number.isFinite(saved.hour)) state.hour = clamp(saved.hour, 0, 24);
    if (Number.isFinite(saved.volume)) state.volume = clamp(saved.volume, 0, 1);
    if (['high', 'medium', 'low'].includes(saved.quality)) state.quality = saved.quality;
    if (typeof saved.labels === 'boolean') state.labels = saved.labels;
    if (typeof saved.autoRotate === 'boolean') state.autoRotate = saved.autoRotate && !reducedMotion;
  } catch (_) { /* 使用默认值 */ }
  if (['high', 'medium', 'low'].includes(requestedQuality)) state.quality = requestedQuality;
  if (['spring', 'summer', 'autumn', 'winter'].includes(urlParams.get('season'))) state.season = urlParams.get('season');
  if (['sunny', 'rain', 'snow'].includes(urlParams.get('weather'))) state.weather = urlParams.get('weather');
  if (urlParams.has('hour') && Number.isFinite(Number(urlParams.get('hour')))) state.hour = clamp(Number(urlParams.get('hour')), 0, 24);
}

function makeGroundTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#b4b69e'; ctx.fillRect(0, 0, 512, 512);
  let seed = 1927;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let i = 0; i < 17000; i++) {
    const light = Math.floor(105 + random() * 100);
    ctx.fillStyle = `rgba(${light},${light + 4},${light - 7},${.04 + random() * .12})`;
    const s = .4 + random() * 1.7;
    ctx.fillRect(random() * 512, random() * 512, s, s);
  }
  for (let i = 0; i < 75; i++) {
    const x = random() * 512, y = random() * 512, r = 5 + random() * 30;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(77,99,62,.1)'); g.addColorStop(1, 'rgba(77,99,62,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 3);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}
function createGround() {
  const baseMat = new THREE.MeshStandardMaterial({ color: '#8b9081', roughness: .82, metalness: .04 });
  const base = new THREE.Mesh(new RoundedBoxGeometry(37.2, 1.05, 29.2, 4, .25), baseMat);
  base.position.y = -.83;
  base.castShadow = base.receiveShadow = true;
  scene.add(base);
  const lower = new THREE.Mesh(new RoundedBoxGeometry(36.5, .36, 28.5, 3, .18), new THREE.MeshStandardMaterial({ color: '#626e64', roughness: .76 }));
  lower.position.y = -1.38; lower.castShadow = true; scene.add(lower);
  const trim = new THREE.Mesh(new RoundedBoxGeometry(37.28, .075, 29.28, 3, .035), new THREE.MeshStandardMaterial({ color: '#b2a77f', roughness: .6, metalness: .2 }));
  trim.position.y = -1.12; scene.add(trim);

  const shape = new THREE.Shape();
  shape.moveTo(-18, -14); shape.lineTo(18, -14); shape.lineTo(18, 14); shape.lineTo(-18, 14); shape.closePath();
  const hole = new THREE.Path();
  POND_CONTOUR.forEach(([x, z], i) => i ? hole.lineTo(x, -z) : hole.moveTo(x, -z));
  hole.closePath(); shape.holes.push(hole);
  const groundGeo = new THREE.ShapeGeometry(shape, 48);
  groundGeo.rotateX(-Math.PI / 2);
  groundMaterial = new THREE.MeshStandardMaterial({ map: makeGroundTexture(), color: '#c2c1a8', roughness: .96 });
  const ground = new THREE.Mesh(groundGeo, groundMaterial);
  ground.position.y = -.08;
  ground.receiveShadow = true;
  scene.add(ground);

  const pathGroup = new THREE.Group();
  const stoneGeo = new RoundedBoxGeometry(1, .12, .7, 2, .06);
  const stoneMat = new THREE.MeshStandardMaterial({ color: '#c5c5b8', roughness: .85 });
  const placements = [];
  for (let z = -7.1; z < 13; z += .82) placements.push([-5.25 + Math.sin(z * .7) * .12, z, 0]);
  for (let x = -4.4; x < 7.3; x += 1.05) placements.push([x, -5.55 + Math.sin(x) * .08, Math.PI / 2]);
  for (let z = -4.4; z < 12.5; z += .86) placements.push([13.1, z, .05]);
  for (let x = -16; x < -5.8; x += 1.05) placements.push([x, 6.6, Math.PI / 2]);
  const stones = new THREE.InstancedMesh(stoneGeo, stoneMat, placements.length);
  const dummy = new THREE.Object3D();
  placements.forEach(([x, z, r], i) => {
    dummy.position.set(x, -.015 + (i % 3) * .008, z);
    dummy.rotation.set(0, r + Math.sin(i * 2.1) * .025, 0);
    dummy.scale.set(.93 + Math.sin(i) * .06, 1, .94 + Math.cos(i) * .04);
    dummy.updateMatrix(); stones.setMatrixAt(i, dummy.matrix);
    stones.setColorAt(i, new THREE.Color().setHSL(.16, .045, .65 + Math.sin(i * 7) * .045));
  });
  stones.receiveShadow = true; stones.castShadow = true;
  pathGroup.add(stones); scene.add(pathGroup);

  const frontStepMat = new THREE.MeshStandardMaterial({ color: '#a5a99b', roughness: .9 });
  for (let i = 0; i < 3; i++) {
    const step = new THREE.Mesh(new RoundedBoxGeometry(5 - i * .35, .22, 1.15, 2, .06), frontStepMat);
    step.position.set(-5.25, -.72 + i * .23, 14.45 - i * .48);
    step.castShadow = step.receiveShadow = true; scene.add(step);
  }
  const plaqueCanvas = document.createElement('canvas'); plaqueCanvas.width = 512; plaqueCanvas.height = 128;
  const ctx = plaqueCanvas.getContext('2d');
  ctx.fillStyle = '#253c32'; ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#a59164'; ctx.lineWidth = 3; ctx.strokeRect(9, 9, 494, 110);
  ctx.fillStyle = '#ddd3b7'; ctx.font = '48px "Noto Serif SC",serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('栖 水 园', 256, 60);
  ctx.font = '14px Arial'; ctx.fillStyle = '#9eaa98'; ctx.fillText('Q I S H U I   G A R D E N', 256, 103);
  const tex = new THREE.CanvasTexture(plaqueCanvas); tex.colorSpace = THREE.SRGBColorSpace;
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 1.2), new THREE.MeshStandardMaterial({ map: tex, roughness: .55 }));
  plaque.position.set(4.6, -.72, 14.615); plaque.rotation.x = -.06;
  plaque.userData.interaction = 'plaque'; plaque.userData.label = '园额 · 栖水园';
  plaque.userData.description = '栖一方清水，养几分闲情。此园以苏式庭院为意，叠石理水，种竹邀风，愿来者都能偷得浮生半日闲。';
  scene.add(plaque); interactiveRoots.push(plaque);

  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshStandardMaterial({ color: '#d4dbd0', roughness: 1 }));
  backdrop.rotation.x = -Math.PI / 2; backdrop.position.y = -1.62; backdrop.receiveShadow = true;
  backdrop.name = 'backdrop'; scene.add(backdrop);
}
function createSky() {
  const positions = [];
  for (let i = 0; i < 420; i++) {
    const theta = Math.random() * Math.PI * 2, phi = Math.random() * Math.PI * .42;
    const r = 75 + Math.random() * 20;
    positions.push(Math.cos(theta) * Math.sin(phi) * r, Math.cos(phi) * r, Math.sin(theta) * Math.sin(phi) * r);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#e6eddc', size: .18, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  scene.add(stars);
  moon = new THREE.Mesh(new THREE.SphereGeometry(2.1, 32, 24), new THREE.MeshBasicMaterial({ color: '#f4edcf', transparent: true, opacity: 0, fog: false }));
  moon.position.set(-29, 29, -42); scene.add(moon);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64,64,8,64,64,64); g.addColorStop(0,'rgba(245,235,199,.32)');g.addColorStop(.35,'rgba(245,235,199,.09)');g.addColorStop(1,'rgba(245,235,199,0)');x.fillStyle=g;x.fillRect(0,0,128,128);return new THREE.CanvasTexture(c); })(),
    transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending
  }));
  halo.scale.set(12, 12, 1); moon.add(halo); moon.userData.halo = halo;
}

function setupRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  $('scene').appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', '栖水园：鼠标拖动旋转，滚轮缩放，点击物件互动');
  renderer.domElement.tabIndex = 0;
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#d7e1d7');
  scene.fog = new THREE.Fog('#d7e1d7', 48, 105);
  camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, .1, 180);
  camera.position.fromArray(views[0].position);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.fromArray(views[0].target);
  controls.enableDamping = true; controls.dampingFactor = .055;
  controls.minDistance = 8; controls.maxDistance = 70;
  controls.minPolarAngle = .15; controls.maxPolarAngle = Math.PI * .475;
  controls.panSpeed = .65; controls.rotateSpeed = .55; controls.zoomSpeed = .75;
  controls.autoRotateSpeed = .32;
  controls.addEventListener('start', () => { cameraTween = null; if (state.touring) stopTour(); });
  controls.update();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = new RoomEnvironment();
  scene.environment = pmrem.fromScene(environment, .04).texture;
  scene.environmentIntensity = .48;
  environment.dispose(); pmrem.dispose();
  hemi = new THREE.HemisphereLight('#e3eee1', '#67705a', 1.75); scene.add(hemi);
  sun = new THREE.DirectionalLight('#fff0cf', 3.1);
  sun.position.set(-18, 28, 16); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -27, right: 27, top: 25, bottom: -25, near: 1, far: 90 });
  sun.shadow.bias = -.00018; sun.shadow.normalBias = .035;
  scene.add(sun);
  moonLight = new THREE.DirectionalLight('#9cb9cf', 0); moonLight.position.set(15, 24, -12); scene.add(moonLight);
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .16, .5, .86);
  composer.addPass(bloomPass); composer.addPass(new OutputPass());
}

function dayFactor(hour) {
  const h = ((hour % 24) + 24) % 24;
  return clamp(Math.sin((h - 5.5) / 13 * Math.PI) * 1.15, 0, 1);
}
function updateLighting() {
  const daylight = dayFactor(state.hour);
  const rainDim = state.weather === 'rain' ? .62 : state.weather === 'snow' ? .8 : 1;
  const night = 1 - daylight;
  state.night = THREE.MathUtils.lerp(state.night, night, .045);
  const angle = (state.hour - 6) / 12 * Math.PI;
  sun.position.set(Math.cos(angle) * 30, Math.max(4, Math.sin(angle) * 32), 14 + Math.sin(angle) * 8);
  sun.intensity = (.12 + daylight * 3.25) * rainDim;
  sun.color.set(state.hour > 16 && state.hour < 19 ? '#ffd0a0' : '#fff0d5');
  hemi.intensity = .38 + daylight * 1.4 * rainDim;
  hemi.color.set(new THREE.Color('#819bab').lerp(new THREE.Color('#e4eee2'), daylight));
  moonLight.intensity = state.night * .68;
  const daySky = new THREE.Color(state.weather === 'rain' ? '#aabbb4' : state.weather === 'snow' ? '#d5ddda' : '#d7e1d7');
  const sunset = clamp(1 - Math.abs(state.hour - 18) / 2, 0, 1);
  if (sunset > 0) daySky.lerp(new THREE.Color('#c5a697'), sunset * .55);
  const sky = daySky.lerp(new THREE.Color('#111f2c'), state.night);
  scene.background.copy(sky); scene.fog.color.copy(sky);
  const backdrop = scene.getObjectByName('backdrop');
  if (backdrop) backdrop.material.color.copy(sky).multiplyScalar(.96);
  stars.material.opacity = state.night * .8 * (state.weather === 'sunny' ? 1 : .15);
  moon.material.opacity = state.night * (state.weather === 'sunny' ? .95 : .25);
  moon.userData.halo.material.opacity = state.night * .7;
  renderer.toneMappingExposure = lerp(.82, 1.08, daylight);
  bloomPass.strength = .14 + state.night * .22;
  architecture?.lanternLights?.forEach(light => {
    light.intensity = state.night * (light.userData.baseIntensity || 9);
    light.visible = state.night > .025;
  });
  document.body.classList.toggle('night-ui', state.night > .58);
}
function updateClockUI() {
  const hour24 = state.hour >= 24 ? 0 : state.hour;
  const h = Math.floor(hour24), m = Math.floor((hour24 - h) * 60);
  const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const chinese = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'][Math.floor(((h + 1) % 24) / 2)];
  $('garden-time').textContent = `${chinese}时 · ${time}`;
  $('time-value').textContent = time;
  $('time-icon').textContent = state.night > .5 ? '☾' : state.weather === 'rain' ? '☂' : '☀';
  $('time-slider').value = state.hour;
  $('time-slider').style.background = `linear-gradient(90deg,var(--jade) ${state.hour / 24 * 100}%,rgba(23,38,31,.12) ${state.hour / 24 * 100}%)`;
}
function setHour(hour, animate = false) {
  const target = clamp(Number(hour), 0, 24);
  if (animate && !reducedMotion) hourTween = { from: state.hour, to: target, elapsed: 0, duration: 2.2 };
  else { state.hour = target; hourTween = null; }
  const targetIsDay = dayFactor(target) > .45;
  $('day-dock-icon').textContent = targetIsDay ? '昼' : '夜';
  $('day-label').textContent = targetIsDay ? '灯火良宵' : '晨曦入园';
  $('day-subtitle').textContent = targetIsDay ? '点亮一园暖灯' : '等一缕晨光';
  updateClockUI(); saveSettings();
}
function setSeason(season, notify = true) {
  state.season = season;
  document.querySelectorAll('.season-button').forEach(button => button.classList.toggle('active', button.dataset.season === season));
  nature?.setSeason?.(season); weatherSystem?.setSeason(season);
  if (state.weather === 'snow' && season !== 'winter') setWeather('sunny', false);
  const groundColors = { spring: '#c2c1a8', summer: '#aebc9c', autumn: '#b9b096', winter: state.weather === 'snow' ? '#e2e4dc' : '#b8b9aa' };
  groundMaterial?.color.set(groundColors[season]);
  const [poem, source] = seasonPoems[season];
  showPoem(poem, source, { spring: '春 · 烟柳', summer: '夏 · 荷风', autumn: '秋 · 枫露', winter: '冬 · 晴雪' }[season]);
  if (notify) { toast({ spring: '春回小院，竹外一枝新绿', summer: '荷风送香气，竹露滴清响', autumn: '枫染疏篱，一叶知秋', winter: '围炉煮茶，静候一场雪' }[season]); playSound('bird'); }
  saveSettings();
}
function setWeather(weather, notify = true) {
  state.weather = weather;
  weatherSystem?.setWeather(weather); audio.setWeather(weather);
  const labels = { sunny: ['烟雨江南', '听檐雨 · 观涟漪', '晴'], rain: ['收一席雨', '云开雾散 · 天青', '雨'], snow: ['雪落无声', '回到晴日 · 融雪', '雪'] };
  $('weather-label').textContent = labels[weather][0];
  $('weather-subtitle').textContent = labels[weather][1];
  $('weather-dock-icon').textContent = labels[weather][2];
  if (groundMaterial && (state.season === 'winter' || weather === 'snow')) groundMaterial.color.set(weather === 'snow' ? '#e1e3db' : '#b8b9aa');
  if (notify) {
    toast(weather === 'rain' ? '雨落青瓦，且听一院江南' : weather === 'snow' ? '疏竹承雪，天地忽然安静' : '雨过天青，水面又映出云影');
    if (weather === 'rain') playSound('rain');
  }
  saveSettings();
}
function toggleDay() {
  const toNight = dayFactor(state.hour) > .45;
  setHour(toNight ? 20 : 8, true);
  $('day-dock-icon').textContent = toNight ? '夜' : '昼';
  $('day-label').textContent = toNight ? '晨曦入园' : '灯火良宵';
  $('day-subtitle').textContent = toNight ? '等一缕晨光' : '点亮一园暖灯';
  toast(toNight ? '暮色四合，为你点亮一园灯火' : '晨光过牖，唤醒一池锦鳞');
  if (toNight) setTimeout(() => playSound('chime'), 700);
}
function setQuality(quality) {
  state.quality = quality;
  const ratio = quality === 'high' ? 1.6 : quality === 'medium' ? 1.15 : .7;
  renderer.setPixelRatio(Math.min(devicePixelRatio, ratio));
  renderer.shadowMap.enabled = quality !== 'low';
  scene.traverse(object => {
    if (!object.material) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material.isMeshPhysicalMaterial) continue;
      if (!material.userData.qishuiPhysical) material.userData.qishuiPhysical = { transmission: material.transmission, clearcoat: material.clearcoat, iridescence: material.iridescence };
      const original = material.userData.qishuiPhysical;
      material.transmission = quality === 'low' ? 0 : original.transmission;
      material.clearcoat = quality === 'low' ? 0 : original.clearcoat;
      material.iridescence = quality === 'low' ? 0 : original.iridescence;
      material.needsUpdate = true;
    }
  });
  const size = quality === 'high' ? 2048 : 1024;
  sun.shadow.mapSize.set(size, size);
  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  bloomPass.enabled = quality === 'high';
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.renderTarget1.samples = quality === 'high' ? 4 : quality === 'medium' ? 2 : 0;
  composer.renderTarget2.samples = composer.renderTarget1.samples;
  pond?.setQuality(quality);
  onResize(); saveSettings();
}

function showPoem(text, source = '栖水园 · 游园偶记', label = '园主手记') {
  $('poem-card').classList.remove('collapsed');
  $('poem-text').innerHTML = text;
  $('poem-source').textContent = `— ${source}`;
  $('poem-label').textContent = label;
}
function setViewTitle(view) {
  $('view-title').textContent = view.title;
  $('view-subtitle').textContent = view.subtitle;
}
function flyTo(view, duration = 2.6) {
  cameraTween = {
    fromPosition: camera.position.clone(), toPosition: new THREE.Vector3().fromArray(view.position),
    fromTarget: controls.target.clone(), toTarget: new THREE.Vector3().fromArray(view.target),
    elapsed: 0, duration: reducedMotion ? .01 : duration
  };
  state.currentView = view.id; setViewTitle(view); showPoem(view.poem, view.source, view.title);
}
function startTour() {
  if (state.touring) { stopTour(); return; }
  cancelFeed();
  state.touring = true; tourIndex = 0; tourElapsed = 0;
  $('tour-button').classList.add('active'); $('tour-progress').classList.add('visible');
  $('interaction-hint').classList.add('hidden');
  goTourStop();
  toast('画中漫游已开启 · 拖动画面可随时退出');
}
function goTourStop() {
  const order = [views[1], views[2], views[4], views[3], views[5], views[0]];
  const view = order[tourIndex % order.length];
  $('tour-stop').textContent = `第${['一','二','三','四','五','六'][tourIndex % 6]}景 · ${view.title}`;
  $('tour-line-fill').style.width = '0%';
  flyTo(view, 3.2); tourElapsed = 0;
}
function stopTour() {
  state.touring = false;
  $('tour-button').classList.remove('active'); $('tour-progress').classList.remove('visible');
  $('interaction-hint').classList.remove('hidden');
}
function setFeedMode(enabled) {
  state.feedMode = enabled;
  $('feed-button').classList.toggle('active', enabled);
  $('feed-banner').classList.toggle('visible', enabled);
  $('interaction-hint').classList.toggle('hidden', enabled);
  if (enabled) {
    stopTour();
    if (!feedMessageShown) { toast('轻点池水撒下鱼食，锦鲤会闻香而来', 3200); feedMessageShown = true; }
    playSound('click');
  } else {
    $('feed-cursor').classList.remove('visible');
    renderer?.domElement.classList.remove('feeding');
  }
}
function cancelFeed() { setFeedMode(false); }
function quickFeed() {
  if (!state.feedMode) setFeedMode(true);
  const point = new THREE.Vector3(3.8, WATER_LEVEL, 4.1);
  if (pond.feedAt(point)) {
    playSound('feed');
    $('scene-status').textContent = '鱼食入水 · 锦鲤正从四面游来';
    toast('鱼食落入池心，且看一池锦霞聚拢');
  }
}

function findInteraction(object) {
  let current = object;
  while (current) {
    if (current.userData?.interaction) return current;
    current = current.parent;
  }
  return null;
}
function setRayFromClient(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
}
function pondPointFromClient(clientX, clientY) {
  setRayFromClient(clientX, clientY);
  const plane = new THREE.Plane(UP, -WATER_LEVEL);
  const point = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, point)) return null;
  return pond.contains(point.x, point.z) ? point : null;
}
function pulseObject(object) {
  pulses.push({ object, elapsed: 0, scale: object.scale.clone() });
}
function handleInteraction(target, hitPoint) {
  const type = target.userData.interaction;
  if (!type) return;
  if (type === 'fish') {
    const index = target.userData.fishIndex;
    pond.greetFish(index); playSound('splash');
    const koi = pond.fish[index];
    showPoem(`${koi.name}摆尾而来，水珠轻溅。<br>它已吞下了 ${koi.eaten} 粒鱼食。`, '一池锦鲤皆有名字', `锦鲤 · ${koi.name}`);
    return;
  }
  if (type === 'water') {
    pond.splashAt(hitPoint); playSound('splash', { volume: .5 }); return;
  }
  if (type === 'lotus') {
    target.getWorldPosition(tempVec); pond.splashAt(tempVec, true); playSound('lotus'); pulseObject(target);
  } else if (type === 'chime') {
    target.userData.active = true; target.userData.clickedAt = clock.elapsedTime; target.userData.impulse = 1;
    playSound('chime');
  } else if (type === 'bell') {
    target.userData.clickedAt = clock.elapsedTime; target.userData.impulse = 1; playSound('bell');
  } else if (type === 'lantern') {
    target.userData.active = target.userData.active === false;
    target.userData.clickedAt = clock.elapsedTime; playSound('chime', { volume: .35 });
  } else if (type === 'door') {
    target.userData.active = !target.userData.active; playSound('click');
  } else if (type === 'tea') {
    playSound('bell', { volume: .25 }); pulseObject(target);
    flyTo(views[2]);
  } else if (type === 'tree') {
    target.userData.impulse = 1; playSound('bird');
  } else if (type === 'rock') {
    playSound('click'); pulseObject(target);
  }
  architecture?.interact?.(target);
  nature?.interact?.(target);
  const descriptions = {
    door: target.userData.active ? '木门轻启，留一缕清风入室。' : '虚掩柴扉，把喧嚣留在园外。',
    lantern: target.userData.active === false ? '收起一盏灯，留一寸月色。' : '一盏灯亮了，池中便有了人间。',
    chime: '檐下风铃轻响，是风经过时留下的诗。',
    tea: '蟹眼已过鱼眼生，飕飕欲作松风鸣。<br>且坐片刻，吃一杯清茶。',
    rock: '太湖石讲究瘦、皱、漏、透。<br>一石之内，也藏着千山万壑。',
    tree: '风过竹梢，叶影婆娑。<br>此刻不必说话，只听风便好。',
    lotus: '水面清圆，一一风荷举。<br>莲叶下的鱼儿，也来看你了。',
    plaque: target.userData.description || '一方匾额，藏着园主的心事。'
  };
  if (descriptions[type]) showPoem(target.userData.description || descriptions[type], target.userData.label || '园中雅物', target.userData.label || '园中雅趣');
  if (type === 'door' || type === 'lantern') toast(descriptions[type]);
}
function pickAt(clientX, clientY, hover = false) {
  setRayFromClient(clientX, clientY);
  const roots = [...interactiveRoots, ...pond.interactives.filter(o => o.userData.interaction !== 'water'), ...(architecture?.interactives || []), ...(nature?.interactives || [])];
  const hits = raycaster.intersectObjects(roots, true).filter(hit => hit.object.visible && hit.object.parent?.visible !== false);
  if (hits.length) {
    const target = findInteraction(hits[0].object);
    if (target) return { target, point: hits[0].point };
  }
  const waterHit = raycaster.intersectObject(pond.water, false)[0];
  if (waterHit && pond.contains(waterHit.point.x, waterHit.point.z)) return { target: pond.water, point: waterHit.point };
  return null;
}
function onCanvasClick(event) {
  if (!state.entered || event.button !== 0) return;
  if (state.feedMode) {
    const point = pondPointFromClient(event.clientX, event.clientY);
    if (point) {
      pond.feedAt(point); playSound('feed');
      setTimeout(() => playSound('splash', { volume: .35 }), 160);
      $('scene-status').textContent = '鱼食入水 · 锦鲤闻香而来';
      if (pond.activeFish > 10) toast('一池锦霞都游来了，且看你投喂的鱼儿');
    } else toast('这里不是池水，请在荷塘中央轻点撒饵');
    return;
  }
  const hit = pickAt(event.clientX, event.clientY);
  if (hit) handleInteraction(hit.target, hit.point);
}
function onPointerMove(event) {
  mouse.clientX = event.clientX; mouse.clientY = event.clientY; mouse.inside = true;
  if (state.feedMode) {
    $('feed-cursor').style.left = `${event.clientX}px`; $('feed-cursor').style.top = `${event.clientY}px`;
    const point = pondPointFromClient(event.clientX, event.clientY);
    $('feed-cursor').classList.toggle('visible', !!point);
  }
}
function updateHover(time) {
  if (!mouse.inside || state.feedMode || !state.labels || time - hoverTime < .09 || $('help-modal').hidden === false || $('settings-modal').hidden === false) return;
  hoverTime = time;
  const hit = pickAt(mouse.clientX, mouse.clientY, true);
  const label = $('cursor-label');
  if (hit?.target.userData.label && hit.target.userData.interaction !== 'water') {
    label.textContent = `${hit.target.userData.label} · 轻点互动`;
    label.style.left = `${mouse.clientX}px`; label.style.top = `${mouse.clientY}px`;
    label.classList.add('visible'); renderer.domElement.style.cursor = 'pointer';
  } else { label.classList.remove('visible'); renderer.domElement.style.cursor = 'grab'; }
}

async function savePhoto() {
  if (!renderer) return;
  toast('正在装裱这一刻的江南…', 1500);
  playSound('photo');
  if (state.quality === 'low') renderer.render(scene, camera); else composer.render();
  const source = renderer.domElement;
  const canvas = document.createElement('canvas');
  canvas.width = source.width; canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0);
  const scale = canvas.width / 1600;
  const gradient = ctx.createLinearGradient(0, canvas.height * .72, 0, canvas.height);
  gradient.addColorStop(0, 'rgba(12,30,23,0)'); gradient.addColorStop(1, 'rgba(12,30,23,.58)');
  ctx.fillStyle = gradient; ctx.fillRect(0, canvas.height * .65, canvas.width, canvas.height * .35);
  ctx.fillStyle = '#f3efdf'; ctx.textAlign = 'left';
  ctx.font = `${Math.round(39 * scale)}px "Noto Serif SC",serif`;
  ctx.fillText('栖 水 园', 55 * scale, canvas.height - 57 * scale);
  ctx.font = `${Math.round(13 * scale)}px "Noto Serif SC",serif`;
  ctx.fillStyle = 'rgba(243,239,223,.75)';
  ctx.fillText(`${{spring:'春',summer:'夏',autumn:'秋',winter:'冬'}[state.season]} · ${state.weather === 'rain' ? '听雨' : state.weather === 'snow' ? '晴雪' : state.night > .5 ? '月夜' : '清游'}  |  一院江南，四季清欢`, 57 * scale, canvas.height - 29 * scale);
  ctx.fillStyle = '#a34d38'; ctx.fillRect(canvas.width - 109 * scale, canvas.height - 100 * scale, 54 * scale, 58 * scale);
  ctx.fillStyle = '#fff1db'; ctx.font = `${Math.round(19 * scale)}px "Noto Serif SC",serif`; ctx.textAlign = 'center';
  ctx.fillText('栖水', canvas.width - 82 * scale, canvas.height - 64 * scale);
  canvas.toBlob(blob => {
    if (!blob) { toast('留影未成，请再试一次'); return; }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url;
    link.download = `栖水园-${state.season}-${new Date().toISOString().slice(0, 10)}.png`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast('已为你装裱留影，珍藏这一刻江南');
  }, 'image/png');
}
function openModal(id) { cancelFeed(); $(id).hidden = false; playSound('click'); }
function closeModal(id) { $(id).hidden = true; playSound('click'); }
async function toggleSound() {
  if (!audioReady) { try { await audio.unlock(); audioReady = true; } catch (_) { toast('当前浏览器暂不支持音频'); return; } }
  state.muted = audio.toggleMuted();
  $('sound-button').classList.toggle('muted', state.muted);
  $('music-toggle').classList.toggle('paused', state.muted);
  $('music-toggle').classList.toggle('playing', !state.muted);
  $('music-title').textContent = state.muted ? '丝竹暂歇' : '枕水听琴';
  toast(state.muted ? '声音已收起，静看一园风景' : '琴音与流水，又回来了');
}
async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch (_) { toast('当前浏览器未允许全屏，可按 F11 试试'); }
}
function bindUI() {
  $('enter-button').addEventListener('click', async () => {
    if (state.entered) return;
    state.entered = true;
    $('entry-screen').classList.add('leaving');
    try { await audio.unlock(); audio.setVolume(state.volume); audio.setWeather(state.weather); audioReady = true; $('music-toggle').classList.add('playing'); }
    catch (_) { toast('音频未能开启，可点击右上角音符重试'); }
    setTimeout(() => { $('entry-screen').style.display = 'none'; }, 1100);
    setTimeout(() => toast('欢迎来到栖水园 · 试着点击一尾锦鲤吧', 3600), 900);
  });
  $('brand-home').addEventListener('click', event => { event.preventDefault(); stopTour(); flyTo(views[0]); });
  $('feed-button').addEventListener('click', () => setFeedMode(!state.feedMode));
  $('cancel-feed').addEventListener('click', cancelFeed);
  $('quick-feed').addEventListener('click', quickFeed);
  $('tour-button').addEventListener('click', startTour);
  $('stop-tour').addEventListener('click', stopTour);
  $('next-tour').addEventListener('click', () => { tourIndex++; goTourStop(); });
  $('weather-button').addEventListener('click', () => setWeather(state.weather === 'sunny' ? 'rain' : state.weather === 'rain' && state.season === 'winter' ? 'snow' : 'sunny'));
  $('day-button').addEventListener('click', toggleDay);
  $('photo-button').addEventListener('click', savePhoto);
  $('sound-button').addEventListener('click', toggleSound);
  $('music-toggle').addEventListener('click', toggleSound);
  $('fullscreen-button').addEventListener('click', toggleFullscreen);
  $('help-button').addEventListener('click', () => openModal('help-modal'));
  $('settings-button').addEventListener('click', () => openModal('settings-modal'));
  $('close-poem').addEventListener('click', () => $('poem-card').classList.add('collapsed'));
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => closeModal(button.dataset.close)));
  document.querySelectorAll('.modal-backdrop').forEach(modal => modal.addEventListener('click', event => { if (event.target === modal) closeModal(modal.id); }));
  document.querySelectorAll('.season-button').forEach(button => button.addEventListener('click', () => setSeason(button.dataset.season)));
  $('time-slider').addEventListener('input', event => setHour(event.target.value));
  $('volume-slider').addEventListener('input', event => {
    state.volume = Number(event.target.value) / 100; audio.setVolume(state.volume);
    $('volume-value').textContent = `${event.target.value}%`;
    event.target.style.background = `linear-gradient(90deg,var(--jade) ${event.target.value}%,rgba(23,38,31,.12) ${event.target.value}%)`;
    saveSettings();
  });
  $('quality-select').addEventListener('change', event => { setQuality(event.target.value); toast('画面品质已调整'); });
  $('rotate-toggle').addEventListener('change', event => { state.autoRotate = event.target.checked; controls.autoRotate = state.autoRotate; saveSettings(); });
  $('labels-toggle').addEventListener('change', event => { state.labels = event.target.checked; $('cursor-label').classList.remove('visible'); saveSettings(); });
  $('reset-view').addEventListener('click', () => { flyTo(views[0]); closeModal('settings-modal'); });
  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', event => { pointerDown = { x: event.clientX, y: event.clientY, button: event.button }; });
  canvas.addEventListener('pointerup', event => {
    if (pointerDown && Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) < 5) onCanvasClick(event);
    pointerDown = null;
  });
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', () => { mouse.inside = false; $('cursor-label').classList.remove('visible'); $('feed-cursor').classList.remove('visible'); });
  canvas.addEventListener('contextmenu', event => { if (state.feedMode) { event.preventDefault(); cancelFeed(); } });
  document.addEventListener('keydown', event => {
    if (event.target.matches('input,select,textarea')) return;
    if (event.key === 'Escape') {
      cancelFeed(); stopTour();
      document.querySelectorAll('.modal-backdrop:not([hidden])').forEach(modal => closeModal(modal.id));
    }
    if (!state.entered) return;
    if (event.code === 'Space' && state.feedMode) { event.preventDefault(); quickFeed(); return; }
    if (event.key === '1') setFeedMode(!state.feedMode);
    if (event.key === '2') startTour();
    if (event.key === '3') $('weather-button').click();
    if (event.key === '4') toggleDay();
    if (event.key.toLowerCase() === 'm') toggleSound();
    if (event.key.toLowerCase() === 'p') savePhoto();
    if (event.key.toLowerCase() === 'h') openModal('help-modal');
    if (event.key.toLowerCase() === 'f') toggleFullscreen();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) audio.suspend(); else if (state.entered && !state.muted) audio.resume(); });
  window.addEventListener('resize', onResize);
}
function onResize() {
  if (!renderer) return;
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  if (innerWidth < 760 && state.currentView === 'overview' && !state.entered) camera.position.set(32, 28, 39);
}

function animate(stamp = 0) {
  requestAnimationFrame(animate);
  const rawDelta = clock.getDelta();
  const delta = Math.min(rawDelta, .05);
  const realDelta = Math.min(rawDelta, .5);
  const time = clock.elapsedTime;
  // 入园页静止时只保留首帧，不让不透明封面后的 3D 场景空耗 GPU。
  if (!state.entered || staticMode) return;
  const frameInterval = state.quality === 'low' ? 1000 / 24 : state.quality === 'medium' ? 1000 / 40 : 0;
  if (frameInterval && stamp - lastFrameStamp < frameInterval) return;
  lastFrameStamp = stamp;
  if (hourTween) {
    hourTween.elapsed += realDelta;
    const t = clamp(hourTween.elapsed / hourTween.duration, 0, 1);
    const smooth = t * t * (3 - 2 * t);
    state.hour = lerp(hourTween.from, hourTween.to, smooth);
    if (t >= 1) hourTween = null;
    updateClockUI();
  }
  if (cameraTween) {
    cameraTween.elapsed += realDelta;
    const t = clamp(cameraTween.elapsed / cameraTween.duration, 0, 1);
    const smooth = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    camera.position.lerpVectors(cameraTween.fromPosition, cameraTween.toPosition, smooth);
    controls.target.lerpVectors(cameraTween.fromTarget, cameraTween.toTarget, smooth);
    if (t >= 1) cameraTween = null;
  }
  if (state.touring) {
    tourElapsed += realDelta;
    $('tour-line-fill').style.width = `${Math.min(100, tourElapsed / 11 * 100)}%`;
    if (tourElapsed > 11) { tourIndex++; goTourStop(); }
  }
  controls.autoRotate = state.autoRotate && !cameraTween && !state.touring;
  controls.update();
  controls.target.x = clamp(controls.target.x, -14, 14);
  controls.target.z = clamp(controls.target.z, -12, 12);
  controls.target.y = clamp(controls.target.y, -.1, 6);
  updateLighting();
  const updateState = { night: state.night, season: state.season, weather: state.weather, hour: state.hour, entered: state.entered };
  architecture?.update?.(time, delta, updateState);
  nature?.update?.(time, delta, updateState);
  pond.update(time, realDelta, updateState);
  weatherSystem?.update(time, delta, updateState);
  for (let i = pulses.length - 1; i >= 0; i--) {
    const p = pulses[i]; p.elapsed += delta;
    const s = 1 + Math.sin(p.elapsed * 12) * Math.exp(-p.elapsed * 4) * .07;
    p.object.scale.copy(p.scale).multiplyScalar(s);
    if (p.elapsed > 1.5) { p.object.scale.copy(p.scale); pulses.splice(i, 1); }
  }
  if (state.entered) updateHover(time);
  const azimuth = controls.getAzimuthalAngle();
  $('compass-needle').style.transform = `rotate(${-azimuth * 180 / Math.PI}deg)`;
  if (Math.floor(time * 2) !== lastTime) {
    lastTime = Math.floor(time * 2);
    if (state.feedMode || pond.foodCount > 0) $('scene-status').textContent = `${pond.activeFish} 尾锦鲤争食 · 池中尚有余饵 ${pond.foodCount} 粒`;
    else $('scene-status').textContent = `${state.weather === 'rain' ? '檐雨潺潺' : state.weather === 'snow' ? '落雪无声' : '微风'} · 18 尾锦鲤正闲游`;
  }
  if (state.quality === 'low') renderer.render(scene, camera); else composer.render();
}

async function init() {
  try {
    loadSettings(); loading(10, '正在铺一席江南烟雨…');
    await new Promise(resolve => requestAnimationFrame(resolve));
    setupRenderer(); loading(24, '叠石理水，唤醒一池锦鳞…');
    await new Promise(resolve => setTimeout(resolve, 20));
    createGround(); createSky();
    pond = createPond({
      onEat: koi => {
        const now = performance.now();
        if (now - lastEatSound > 220) { playSound('splash', { volume: .2, pitch: .8 + Math.random() * .5 }); lastEatSound = now; }
      },
      onGreet: () => {}
    });
    scene.add(pond.group); loading(45, '粉墙黛瓦，竹影渐入窗来…');
    await new Promise(resolve => setTimeout(resolve, 20));
    architecture = createArchitecture(); scene.add(architecture.group);
    loading(65, '种竹邀风，静待四季轮转…');
    await new Promise(resolve => setTimeout(resolve, 20));
    nature = createNature(); scene.add(nature.group);
    weatherSystem = createWeather(scene);
    loading(82, '调一段琴音，点一园暖灯…');
    await new Promise(resolve => setTimeout(resolve, 20));
    bindUI(); setQuality(state.quality);
    setSeason(state.season, false); setWeather(state.weather, false); setHour(state.hour);
    $('volume-slider').value = Math.round(state.volume * 100); $('volume-value').textContent = `${Math.round(state.volume * 100)}%`;
    $('quality-select').value = state.quality; $('rotate-toggle').checked = state.autoRotate; $('labels-toggle').checked = state.labels;
    audio.setVolume(state.volume);
    state.night = 1 - dayFactor(state.hour);
    updateLighting(); controls.update();
    if (state.quality === 'low') renderer.render(scene, camera); else composer.render();
    loading(100, '庭院已落成，等你来小坐。');
    $('enter-button').disabled = false;
    window.__gardenReady = true;
    window.__garden = { scene, camera, renderer, controls, state, pond, architecture, nature, weatherSystem, setHour, setSeason, setWeather, flyTo, views, audio };
    animate();
  } catch (error) {
    console.error('栖水园营造失败：', error);
    $('fatal-error').hidden = false;
    $('error-message').textContent = `营造时遇到问题：${error.message}。请刷新重试，或查看浏览器控制台。`;
  }
}

init();
