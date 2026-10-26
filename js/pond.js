import * as THREE from 'three';

export const POND_CONTOUR = [
  [-3.7, 1.0], [-3.4, -0.7], [-1.7, -2.1], [1.0, -2.8], [4.2, -2.5],
  [7.7, -1.7], [10.0, 0.0], [11.0, 2.8], [10.7, 5.6], [9.2, 8.3],
  [6.3, 9.9], [3.1, 10.1], [0.4, 9.0], [-1.8, 7.3], [-3.0, 4.7]
];
export const WATER_LEVEL = 0.12;
const BOUNDS = { minX: -4.2, maxX: 11.5, minZ: -3.3, maxZ: 10.7 };
const UP = new THREE.Vector3(0, 1, 0);
const tempObject = new THREE.Object3D();
const tempColor = new THREE.Color();

function mulberry32(seed) {
  return function () {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const random = mulberry32(4172026);
const rand = (a = 0, b = 1) => a + (b - a) * random();

function insidePolygon(x, z) {
  let inside = false;
  for (let i = 0, j = POND_CONTOUR.length - 1; i < POND_CONTOUR.length; j = i++) {
    const xi = POND_CONTOUR[i][0], zi = POND_CONTOUR[i][1];
    const xj = POND_CONTOUR[j][0], zj = POND_CONTOUR[j][1];
    const hit = ((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi + 1e-8) + xi);
    if (hit) inside = !inside;
  }
  return inside;
}

function shapeGeometry() {
  const shape = new THREE.Shape();
  POND_CONTOUR.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z));
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape, 32);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function makeScaleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#858585';
  ctx.fillRect(0, 0, 256, 256);
  ctx.lineWidth = 2;
  for (let row = -1; row < 18; row++) {
    for (let col = -1; col < 18; col++) {
      const x = col * 16 + (row % 2) * 8;
      const y = row * 15;
      const gradient = ctx.createRadialGradient(x + 8, y + 4, 1, x + 8, y + 5, 10);
      gradient.addColorStop(0, '#bcbcbc');
      gradient.addColorStop(.65, '#919191');
      gradient.addColorStop(1, '#515151');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x + 8, y + 3, 9, 0, Math.PI);
      ctx.lineTo(x - 1, y + 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(225,225,225,.5)';
      ctx.beginPath();
      ctx.arc(x + 8, y + 3, 8, .1, Math.PI - .1);
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.2, 1.3);
  texture.anisotropy = 4;
  return texture;
}

function createKoiTexture(palette, index) {
  const canvas = document.createElement('canvas');
  canvas.width = 384; canvas.height = 192;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = palette[0]; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const sheen = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sheen.addColorStop(0, 'rgba(255,255,255,.14)'); sheen.addColorStop(.5, 'rgba(255,255,255,0)'); sheen.addColorStop(1, 'rgba(45,30,15,.12)');
  ctx.fillStyle = sheen; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const patches = 7 + index % 4;
  for (let i = 0; i < patches; i++) {
    const cx = rand(-20, 404), cy = rand(-10, 202);
    const rx = rand(18, 58), ry = rand(12, 43);
    ctx.fillStyle = i % 4 === 3 ? palette[2] : palette[1];
    ctx.beginPath();
    for (let j = 0; j <= 18; j++) {
      const a = j / 18 * Math.PI * 2;
      const wobble = 1 + Math.sin(a * 3 + i) * .13 + Math.cos(a * 5 - index) * .09;
      const x = cx + Math.cos(a) * rx * wobble, y = cy + Math.sin(a) * ry * wobble;
      if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
  }
  // 丹顶品种头顶一点朱砂，沿背部延伸的细金线增加光泽层次。
  if (index % 3 === 0) {
    ctx.fillStyle = palette[1]; ctx.beginPath(); ctx.ellipse(320, 96, 24, 31, .2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,244,197,.15)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 96); ctx.bezierCurveTo(110, 88, 250, 105, 384, 96); ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

function makeFishBodyGeometry() {
  const lengthSegments = 30, radialSegments = 24;
  const positions = [], normals = [], uvs = [], colors = [], indices = [];
  for (let i = 0; i <= lengthSegments; i++) {
    const t = i / lengthSegments;
    const z = THREE.MathUtils.lerp(-.68, .68, t);
    const profile = Math.pow(Math.sin(Math.PI * t), .58) * (.84 + .18 * t);
    for (let j = 0; j <= radialSegments; j++) {
      const u = j / radialSegments;
      const a = u * Math.PI * 2;
      const x = Math.cos(a) * .255 * profile;
      const y = Math.sin(a) * .225 * profile + .025 * Math.sin(t * Math.PI);
      positions.push(x, y, z);
      normals.push(Math.cos(a), Math.sin(a), (t - .5) * -.2);
      uvs.push(u, t);
      colors.push(1, 1, 1);
    }
  }
  for (let i = 0; i < lengthSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * (radialSegments + 1) + j;
      const b = a + radialSegments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function finGeometry(points) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
  geometry.setIndex(points.length === 4 ? [0, 1, 2, 0, 2, 3] : [0, 1, 2]);
  geometry.computeVertexNormals();
  return geometry;
}

const FISH_NAMES = ['丹顶', '墨染', '金鳞', '松烟', '赤霞', '白云', '锦书', '花笺', '琥珀', '青花', '绯扇', '瑞雪', '昭和三色', '小满', '一叶', '灵犀', '朱砂', '月白'];
const PALETTES = [
  ['#f4e7c9', '#d8512f', '#302d27'], ['#eee6d5', '#252a28', '#c76b35'],
  ['#e9a52b', '#f3d77d', '#c56326'], ['#e6dfca', '#343b38', '#9e3d2b'],
  ['#d75a36', '#f2b85c', '#f6e4c6'], ['#f3eee1', '#ddd9c8', '#e6b44e'],
  ['#f1e4cd', '#c94830', '#e4a745'], ['#f0d9c2', '#d56e67', '#f6e9d5'],
  ['#c98328', '#edc060', '#8e4822'], ['#e8e4d7', '#41616a', '#b44b36']
];

function createFish(index, shared) {
  const group = new THREE.Group();
  const visual = new THREE.Group();
  group.add(visual);
  const size = rand(.68, 1.13);
  visual.scale.setScalar(size);
  const palette = PALETTES[index % PALETTES.length];
  const bodyGeometry = shared.bodyGeometry.clone();
  const pos = bodyGeometry.attributes.position;
  const colorAttr = bodyGeometry.attributes.color;
  const base = new THREE.Color(palette[0]);
  const patch = new THREE.Color(palette[1]);
  const accent = new THREE.Color(palette[2]);
  const offset = rand(0, 20);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = Math.sin(z * 8 + offset + Math.sin(x * 17)) + Math.cos(y * 14 - z * 4 + offset) + Math.sin((x + y) * 22 + offset * .7);
    let c = base;
    if (n > .65) c = patch;
    if (n < -1.35 || (index % 3 === 0 && z > .42 && n > .1)) c = accent;
    tempColor.copy(c).multiplyScalar(rand(.93, 1.06));
    colorAttr.setXYZ(i, tempColor.r, tempColor.g, tempColor.b);
  }
  const material = new THREE.MeshPhysicalMaterial({
    map: createKoiTexture(palette, index), vertexColors: false,
    roughness: .27, metalness: .04, clearcoat: .85, clearcoatRoughness: .19,
    bumpMap: shared.scaleTexture, bumpScale: .018, iridescence: .16, iridescenceIOR: 1.3
  });
  const body = new THREE.Mesh(bodyGeometry, material);
  body.castShadow = true;
  body.receiveShadow = true;
  visual.add(body);

  const finMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(palette[1]).lerp(new THREE.Color('#f4d6ad'), .35),
    roughness: .42, transparent: true, opacity: .7, side: THREE.DoubleSide, depthWrite: false,
    transmission: .12, thickness: .02
  });
  const tail = new THREE.Group();
  tail.position.z = -.61;
  const tailMesh = new THREE.Mesh(finGeometry([
    [0, 0, .02], [-.42, .05, -.48], [0, .015, -.33], [.42, .05, -.48]
  ]), finMaterial);
  tailMesh.geometry.setIndex([0, 1, 2, 0, 2, 3]);
  tail.add(tailMesh);
  const tailLower = new THREE.Mesh(finGeometry([[0, 0, 0], [-.24, -.16, -.35], [0, -.06, -.27], [.24, -.16, -.35]]), finMaterial);
  tail.add(tailLower);
  visual.add(tail);

  const leftFin = new THREE.Mesh(finGeometry([[.15, -.04, .25], [.49, -.08, -.08], [.26, -.03, -.22]]), finMaterial);
  const rightFin = new THREE.Mesh(finGeometry([[-.15, -.04, .25], [-.49, -.08, -.08], [-.26, -.03, -.22]]), finMaterial);
  visual.add(leftFin, rightFin);
  const dorsal = new THREE.Mesh(finGeometry([[0, .15, .27], [0, .38, -.05], [0, .18, -.43]]), finMaterial);
  visual.add(dorsal);

  const eyeWhite = new THREE.MeshStandardMaterial({ color: '#cba65e', roughness: .25, metalness: .3 });
  const eyeBlack = new THREE.MeshPhysicalMaterial({ color: '#080b09', roughness: .08, clearcoat: 1 });
  [-1, 1].forEach(side => {
    const rim = new THREE.Mesh(shared.eyeGeometry, eyeWhite);
    rim.position.set(side * .158, .105, .46);
    rim.scale.set(1, .95, .8);
    const pupil = new THREE.Mesh(shared.eyeGeometry, eyeBlack);
    pupil.position.set(side * .172, .112, .473);
    pupil.scale.setScalar(.65);
    visual.add(rim, pupil);
  });
  const mouth = new THREE.Mesh(shared.mouthGeometry, new THREE.MeshStandardMaterial({ color: '#bd826a', roughness: .6 }));
  mouth.position.set(0, -.035, .665);
  mouth.scale.set(1, .65, 1);
  visual.add(mouth);
  [-1, 1].forEach(side => {
    const barbel = new THREE.Mesh(shared.barbelGeometry, finMaterial);
    barbel.position.set(side * .08, -.1, .65);
    barbel.rotation.x = Math.PI / 2;
    barbel.rotation.z = side * .42;
    visual.add(barbel);
  });

  let x, z;
  do { x = rand(-2.4, 9.8); z = rand(-1.5, 9); } while (!insidePolygon(x, z));
  group.position.set(x, rand(-.25, -.1), z);
  const angle = rand(0, Math.PI * 2);
  group.rotation.y = angle;
  group.userData.interaction = 'fish';
  group.userData.label = `锦鲤 · ${FISH_NAMES[index]}`;
  group.userData.fishIndex = index;
  group.userData.description = `${FISH_NAMES[index]}，一袭${index % 2 ? '水墨' : '锦霞'}，在莲叶间自在往来。轻点它，会与它打个招呼。`;
  return {
    group, visual, body, tail, leftFin, rightFin, mouth, size, angle,
    speed: rand(.28, .48), baseSpeed: rand(.32, .52), phase: rand(0, Math.PI * 2),
    depth: rand(-.25, -.12), targetDepth: rand(-.25, -.12), turn: rand(-.25, .25),
    think: rand(1, 5), targetFood: null, feeding: false, excited: 0, eaten: 0,
    home: new THREE.Vector2(rand(0, 6), rand(1, 7)), name: FISH_NAMES[index]
  };
}

function createMaskTexture() {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++) {
    const z = BOUNDS.minZ + (j / (size - 1)) * (BOUNDS.maxZ - BOUNDS.minZ);
    for (let i = 0; i < size; i++) {
      const x = BOUNDS.minX + (i / (size - 1)) * (BOUNDS.maxX - BOUNDS.minX);
      const index = (j * size + i) * 4;
      const value = insidePolygon(x, z) ? 255 : 0;
      data[index] = data[index + 1] = data[index + 2] = value;
      data[index + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  return texture;
}

function createWaterMaterial(mask) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 }, uMask: { value: mask },
      uBounds: { value: new THREE.Vector4(BOUNDS.minX, BOUNDS.minZ, BOUNDS.maxX - BOUNDS.minX, BOUNDS.maxZ - BOUNDS.minZ) },
      uNight: { value: 0 }, uRain: { value: 0 }, uSun: { value: new THREE.Vector3(.4, .8, .2) },
      uDeep: { value: new THREE.Color('#2f7c70') }, uShallow: { value: new THREE.Color('#91c7ad') },
      uSky: { value: new THREE.Color('#e4eee5') }
    },
    vertexShader: `
      uniform float uTime; uniform float uRain;
      varying vec3 vWorld; varying vec3 vView;
      void main(){
        vec3 p=position;
        float w=sin(p.x*2.3+uTime*1.2)*cos(p.y*2.0-uTime*.8)*.012;
        w+=sin(p.x*5.7-p.y*4.1+uTime*1.7)*.004;
        p.z+=w*(1.0+uRain*.6);
        vec4 world=modelMatrix*vec4(p,1.0); vWorld=world.xyz;
        vView=cameraPosition-world.xyz;
        gl_Position=projectionMatrix*viewMatrix*world;
      }`,
    fragmentShader: `
      uniform float uTime; uniform float uNight; uniform float uRain;
      uniform sampler2D uMask; uniform vec4 uBounds; uniform vec3 uSun;
      uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSky;
      varying vec3 vWorld; varying vec3 vView;
      float wave(vec2 p){
        return sin(p.x*3.4+p.y*2.1+uTime*1.25)*.5+sin(p.x*7.3-p.y*4.8-uTime*1.1)*.25+sin(length(p)*8.0-uTime*1.6)*.12;
      }
      void main(){
        vec2 st=(vWorld.xz-uBounds.xy)/uBounds.zw;
        float mask=texture2D(uMask,st).r;
        if(mask<.42) discard;
        vec2 p=vWorld.xz;
        float e=.035;
        float h=wave(p); vec2 grad=vec2(wave(p+vec2(e,0.))-h,wave(p+vec2(0.,e))-h)/e;
        vec3 N=normalize(vec3(-grad.x*.055,1.,-grad.y*.055));
        vec3 V=normalize(vView);
        float fres=pow(1.-max(dot(N,V),0.),2.4);
        float depthTint=smoothstep(-3.,9.,p.y)*.15;
        vec3 col=mix(uDeep,uShallow,.35+h*.07+depthTint);
        col=mix(col,uSky,fres*.72);
        vec3 L=normalize(uSun);
        float spec=pow(max(dot(reflect(-L,N),V),0.),180.);
        float glint=pow(max(dot(reflect(-L,N),V),0.),28.)*.12;
        col+=vec3(1.,.88,.62)*(spec*1.8+glint)*(1.-uNight*.7);
        float threads=smoothstep(.92,1.,sin(p.x*13.+h*2.)*sin(p.y*11.-h*2.));
        col+=threads*.025;
        col=mix(col,col*vec3(.42,.58,.72),uNight*.68);
        float alpha=.34+fres*.25+spec*.16;
        gl_FragColor=vec4(col,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
}

function createBedTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#84927b'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1600; i++) {
    const grey = Math.floor(rand(90, 165));
    ctx.fillStyle = `rgba(${grey},${grey + 8},${grey - 5},${rand(.08, .3)})`;
    ctx.beginPath(); ctx.ellipse(rand(0, 256), rand(0, 256), rand(.5, 3.5), rand(.5, 2), rand(0, 6.28), 0, 6.28); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(.32, .32);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createPond(options = {}) {
  const group = new THREE.Group();
  group.name = '碧池与锦鲤';
  const interactives = [];
  const fish = [];
  const ripples = [];
  const pellets = [];
  const bubbles = [];
  const splashParticles = [];
  let weather = 'sunny', season = 'spring', night = 0, rainRippleTimer = 0;
  let pelletMesh, bubblePoints, splashPoints;

  const bed = new THREE.Mesh(shapeGeometry(), new THREE.MeshStandardMaterial({ map: createBedTexture(), color: '#a2ac91', roughness: .96 }));
  bed.position.y = -.43;
  bed.receiveShadow = true;
  group.add(bed);

  const pebbleGeo = new THREE.DodecahedronGeometry(.12, 0);
  const pebbleMat = new THREE.MeshStandardMaterial({ color: '#8e9782', roughness: .88 });
  const pebbles = new THREE.InstancedMesh(pebbleGeo, pebbleMat, 280);
  for (let i = 0; i < 280; i++) {
    let x, z;
    do { x = rand(-3.4, 10.5); z = rand(-2.3, 9.7); } while (!insidePolygon(x, z));
    tempObject.position.set(x, -.37, z);
    tempObject.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    tempObject.scale.set(rand(.5, 1.8), rand(.3, .65), rand(.6, 1.6));
    tempObject.updateMatrix(); pebbles.setMatrixAt(i, tempObject.matrix);
    pebbles.setColorAt(i, new THREE.Color().setHSL(rand(.18, .3), rand(.03, .14), rand(.38, .65)));
  }
  pebbles.receiveShadow = true;
  group.add(pebbles);

  const caustics = new THREE.Mesh(shapeGeometry(), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uNight: { value: 0 } },
    vertexShader: 'varying vec3 vWorld; void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: `varying vec3 vWorld;uniform float uTime;uniform float uNight;
      void main(){vec2 p=vWorld.xz;float a=sin(p.x*3.2+sin(p.y*2.8+uTime*.8)*1.5+uTime);
      float b=sin(p.y*3.8+sin(p.x*3.1-uTime*.7)*1.4-uTime*.8);
      float c=pow(max(0.,1.-abs(a+b)*1.7),7.);gl_FragColor=vec4(.48,.82,.63,c*.18*(1.-uNight*.8));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`
  }));
  caustics.position.y = -.405;
  caustics.renderOrder = 1;
  group.add(caustics);

  const curve = new THREE.CatmullRomCurve3(POND_CONTOUR.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'catmullrom', .35);
  const rockGeo = new THREE.DodecahedronGeometry(.48, 1);
  const posAttr = rockGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(posAttr, i);
    const scale = 1 + .13 * Math.sin(v.x * 9 + v.y * 7 + v.z * 11);
    v.multiplyScalar(scale); posAttr.setXYZ(i, v.x, v.y, v.z);
  }
  rockGeo.computeVertexNormals();
  const rockMat = new THREE.MeshStandardMaterial({ color: '#a6aa98', roughness: .88, metalness: .02 });
  const shore = new THREE.InstancedMesh(rockGeo, rockMat, 112);
  for (let i = 0; i < 112; i++) {
    const p = curve.getPointAt(i / 112);
    tempObject.position.set(p.x + rand(-.12, .12), rand(-.08, .04), p.z + rand(-.12, .12));
    tempObject.rotation.set(rand(-.3, .3), rand(0, Math.PI), rand(-.2, .2));
    tempObject.scale.set(rand(.7, 1.3), rand(.42, .8), rand(.65, 1.35));
    tempObject.updateMatrix(); shore.setMatrixAt(i, tempObject.matrix);
    shore.setColorAt(i, new THREE.Color().setHSL(rand(.16, .26), rand(.025, .12), rand(.48, .7)));
  }
  shore.castShadow = shore.receiveShadow = true;
  group.add(shore);

  const waterGeometry = new THREE.PlaneGeometry(BOUNDS.maxX - BOUNDS.minX, BOUNDS.maxZ - BOUNDS.minZ, 72, 64);
  const waterMaterial = createWaterMaterial(createMaskTexture());
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.position.set((BOUNDS.minX + BOUNDS.maxX) / 2, WATER_LEVEL, (BOUNDS.minZ + BOUNDS.maxZ) / 2);
  water.renderOrder = 5;
  water.userData.interaction = 'water';
  water.userData.label = '碧池 · 点击撒饵';
  group.add(water);
  interactives.push(water);

  const shared = {
    bodyGeometry: makeFishBodyGeometry(), scaleTexture: makeScaleTexture(),
    eyeGeometry: new THREE.SphereGeometry(.047, 10, 8),
    mouthGeometry: new THREE.TorusGeometry(.04, .012, 6, 12),
    barbelGeometry: new THREE.CylinderGeometry(.006, .003, .18, 5)
  };
  for (let i = 0; i < 18; i++) {
    const koi = createFish(i, shared);
    fish.push(koi); group.add(koi.group); interactives.push(koi.group);
  }

  const pelletGeometry = new THREE.SphereGeometry(.035, 6, 4);
  const pelletMaterial = new THREE.MeshStandardMaterial({ color: '#a78046', roughness: .85 });
  pelletMesh = new THREE.InstancedMesh(pelletGeometry, pelletMaterial, 140);
  pelletMesh.count = 0;
  pelletMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  pelletMesh.renderOrder = 6;
  group.add(pelletMesh);

  const rippleGeometry = new THREE.RingGeometry(.86, 1, 64);
  function addRipple(x, z, strength = 1) {
    if (ripples.length > 35) {
      const old = ripples.shift(); group.remove(old.mesh); old.mesh.material.dispose();
    }
    for (let k = 0; k < 2; k++) {
      const material = new THREE.MeshBasicMaterial({ color: night > .5 ? '#9bbbc4' : '#e2f2dd', transparent: true, opacity: .3 * strength, side: THREE.DoubleSide, depthWrite: false });
      const mesh = new THREE.Mesh(rippleGeometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, WATER_LEVEL + .022 + k * .003, z);
      mesh.scale.setScalar(.05);
      mesh.renderOrder = 7;
      group.add(mesh);
      ripples.push({ mesh, age: -k * .24, life: 2.1 + strength * .35, strength });
    }
  }

  const bubbleTexture = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(13, 11, 1, 16, 16, 15);
    g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(.25, 'rgba(220,245,235,.2)'); g.addColorStop(.72, 'rgba(220,245,235,.05)'); g.addColorStop(.9, 'rgba(255,255,255,.65)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  })();
  const bubbleGeometry = new THREE.BufferGeometry();
  bubbleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(90 * 3), 3));
  bubblePoints = new THREE.Points(bubbleGeometry, new THREE.PointsMaterial({ map: bubbleTexture, size: .09, transparent: true, opacity: .65, depthWrite: false, color: '#d9eee3', sizeAttenuation: true }));
  bubblePoints.renderOrder = 6;
  group.add(bubblePoints);

  const splashGeometry = new THREE.BufferGeometry();
  splashGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(180 * 3), 3));
  splashPoints = new THREE.Points(splashGeometry, new THREE.PointsMaterial({ map: bubbleTexture, size: .07, transparent: true, opacity: .75, depthWrite: false, color: '#e6f4e9' }));
  splashPoints.renderOrder = 8;
  group.add(splashPoints);

  function spawnBubbles(x, z, count = 5) {
    for (let i = 0; i < count && bubbles.length < 90; i++) bubbles.push({ x: x + rand(-.18, .18), y: rand(-.25, .02), z: z + rand(-.18, .18), age: 0, life: rand(.8, 1.7), drift: rand(-.1, .1) });
  }
  function spawnSplash(x, z, count = 12, force = 1) {
    for (let i = 0; i < count && splashParticles.length < 180; i++) splashParticles.push({ x, y: WATER_LEVEL + .04, z, vx: rand(-.42, .42) * force, vy: rand(.45, 1.25) * force, vz: rand(-.42, .42) * force, age: 0, life: rand(.45, .85) });
  }

  function feedAt(point) {
    const x = THREE.MathUtils.clamp(point.x, BOUNDS.minX, BOUNDS.maxX);
    const z = THREE.MathUtils.clamp(point.z, BOUNDS.minZ, BOUNDS.maxZ);
    if (!insidePolygon(x, z)) return false;
    const amount = 12;
    for (let i = 0; i < amount && pellets.length < 140; i++) {
      pellets.push({ x: x + rand(-.42, .42), z: z + rand(-.42, .42), y: WATER_LEVEL + rand(.07, .13), age: 0, eaten: 0, claimed: null, bob: rand(0, 6.28) });
    }
    fish.forEach(koi => { koi.excited = Math.max(koi.excited, 4); koi.think = 0; });
    addRipple(x, z, 1.25); spawnSplash(x, z, 10, .55); spawnBubbles(x, z, 5);
    options.onFeed?.(pellets.length);
    return true;
  }

  function splashAt(point, gentle = false) {
    if (!insidePolygon(point.x, point.z)) return false;
    addRipple(point.x, point.z, gentle ? .7 : 1);
    if (!gentle) { spawnSplash(point.x, point.z, 8, .65); spawnBubbles(point.x, point.z, 3); }
    fish.forEach(koi => {
      const d = Math.hypot(koi.group.position.x - point.x, koi.group.position.z - point.z);
      if (d < 2.2) { koi.excited = Math.max(koi.excited, .9); koi.angle += rand(-.6, .6); }
    });
    return true;
  }

  function greetFish(index) {
    const koi = fish[index];
    if (!koi) return;
    koi.excited = 2.2;
    koi.targetDepth = -.035;
    koi.speed = .9;
    addRipple(koi.group.position.x, koi.group.position.z, .9);
    spawnSplash(koi.group.position.x, koi.group.position.z, 14, .85);
    spawnBubbles(koi.group.position.x, koi.group.position.z, 8);
    options.onGreet?.(koi);
  }

  function updateFish(koi, time, delta) {
    koi.think -= delta;
    koi.excited = Math.max(0, koi.excited - delta);
    const p = koi.group.position;
    if (koi.targetFood && (koi.targetFood.eaten || !pellets.includes(koi.targetFood))) koi.targetFood = null;
    if (!koi.targetFood) {
      let best = null, bestDist = 17;
      for (const pellet of pellets) {
        if (pellet.eaten || (pellet.claimed && pellet.claimed !== koi && random() > .012)) continue;
        const d = Math.hypot(p.x - pellet.x, p.z - pellet.z);
        if (d < bestDist) { best = pellet; bestDist = d; }
      }
      if (best) { koi.targetFood = best; best.claimed = koi; }
    }
    let desiredAngle, desiredSpeed = koi.baseSpeed;
    if (koi.targetFood) {
      const f = koi.targetFood;
      desiredAngle = Math.atan2(f.x - p.x, f.z - p.z);
      const dist = Math.hypot(f.x - p.x, f.z - p.z);
      desiredSpeed = dist < 1 ? .28 : .85 + Math.min(.35, dist * .03);
      koi.targetDepth = dist < 2 ? -.035 : -.09;
      koi.feeding = dist < 2;
      if (dist < .29) {
        f.eaten = 1; koi.targetFood = null; koi.eaten++; koi.excited = .6;
        addRipple(p.x, p.z, .48); spawnSplash(p.x, p.z, 5, .4); spawnBubbles(p.x, p.z, 3);
        options.onEat?.(koi);
      }
    } else {
      koi.feeding = false;
      if (koi.think <= 0) {
        koi.think = rand(2.5, 6.5);
        koi.turn = rand(-.6, .6);
        koi.targetDepth = rand(-.28, -.11);
        if (random() < .25) koi.home.set(rand(-1, 8), rand(0, 8));
      }
      const toHomeX = koi.home.x - p.x, toHomeZ = koi.home.y - p.z;
      desiredAngle = Math.atan2(toHomeX, toHomeZ) + koi.turn + Math.sin(time * .15 + koi.phase) * .22;
      const aheadX = p.x + Math.sin(koi.angle) * 1.1;
      const aheadZ = p.z + Math.cos(koi.angle) * 1.1;
      if (!insidePolygon(aheadX, aheadZ)) {
        desiredAngle = Math.atan2(3.6 - p.x, 3.9 - p.z);
        desiredSpeed *= 1.2;
        koi.think = .5;
      }
      if (koi.excited > 0) desiredSpeed = .82;
    }
    for (const other of fish) {
      if (other === koi) continue;
      const dx = p.x - other.group.position.x, dz = p.z - other.group.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < .65 && d2 > .001) {
        desiredAngle = Math.atan2(dx, dz);
        desiredSpeed *= .72;
        break;
      }
    }
    let diff = ((desiredAngle - koi.angle + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    koi.angle += THREE.MathUtils.clamp(diff, -delta * 2.1, delta * 2.1);
    koi.speed = THREE.MathUtils.lerp(koi.speed, desiredSpeed, 1 - Math.exp(-delta * 2));
    const nx = p.x + Math.sin(koi.angle) * koi.speed * delta;
    const nz = p.z + Math.cos(koi.angle) * koi.speed * delta;
    if (insidePolygon(nx, nz)) { p.x = nx; p.z = nz; }
    else { koi.angle += delta * 2.4; koi.home.set(3.5, 4); }
    koi.depth = THREE.MathUtils.lerp(koi.depth, koi.targetDepth, 1 - Math.exp(-delta * 2.3));
    p.y = koi.depth + Math.sin(time * 1.3 + koi.phase) * .018;
    koi.group.rotation.y = koi.angle;
    koi.visual.rotation.z = Math.sin(time * 1.5 + koi.phase) * .035;
    koi.visual.rotation.x = koi.feeding ? -.12 : Math.sin(time * .8 + koi.phase) * .025;
    const wag = Math.sin(time * (4.2 + koi.speed * 8) + koi.phase) * (.22 + koi.speed * .25);
    koi.tail.rotation.y = wag;
    koi.leftFin.rotation.z = .12 + Math.sin(time * 3.2 + koi.phase) * .22;
    koi.rightFin.rotation.z = -.12 - Math.sin(time * 3.2 + koi.phase + .8) * .22;
    const mouthScale = koi.feeding ? .85 + Math.sin(time * 12 + koi.phase) * .35 : .72;
    koi.mouth.scale.set(mouthScale, mouthScale * .7, 1);
  }

  function updateParticles(delta) {
    for (let i = pellets.length - 1; i >= 0; i--) {
      const f = pellets[i]; f.age += delta;
      if (f.eaten) f.eaten += delta * 5;
      if (f.eaten > 1 || f.age > 38) pellets.splice(i, 1);
    }
    pelletMesh.count = pellets.length;
    pellets.forEach((f, i) => {
      tempObject.position.set(f.x, f.y + Math.sin(f.age * 3 + f.bob) * .012, f.z);
      tempObject.rotation.set(0, f.bob, 0);
      const s = f.eaten ? Math.max(0, 1 - f.eaten) : 1 + Math.sin(f.age * 2 + f.bob) * .08;
      tempObject.scale.setScalar(s); tempObject.updateMatrix(); pelletMesh.setMatrixAt(i, tempObject.matrix);
    });
    pelletMesh.instanceMatrix.needsUpdate = true;
    for (let i = bubbles.length - 1; i >= 0; i--) { const b = bubbles[i]; b.age += delta; b.y += delta * .19; b.x += Math.sin(b.age * 4) * b.drift * delta; if (b.age > b.life || b.y > WATER_LEVEL + .04) bubbles.splice(i, 1); }
    const bp = bubbleGeometry.attributes.position;
    bubbleGeometry.setDrawRange(0, bubbles.length);
    bubbles.forEach((b, i) => bp.setXYZ(i, b.x, b.y, b.z)); bp.needsUpdate = true;
    for (let i = splashParticles.length - 1; i >= 0; i--) { const p = splashParticles[i]; p.age += delta; p.vy -= delta * 2.6; p.x += p.vx * delta; p.y += p.vy * delta; p.z += p.vz * delta; if (p.age > p.life || p.y < WATER_LEVEL) splashParticles.splice(i, 1); }
    const sp = splashGeometry.attributes.position;
    splashGeometry.setDrawRange(0, splashParticles.length);
    splashParticles.forEach((p, i) => sp.setXYZ(i, p.x, p.y, p.z)); sp.needsUpdate = true;
  }

  function update(time, delta, state = {}) {
    weather = state.weather || weather; season = state.season || season; night = state.night || 0;
    waterMaterial.uniforms.uTime.value = time;
    waterMaterial.uniforms.uNight.value = night;
    waterMaterial.uniforms.uRain.value = weather === 'rain' ? 1 : 0;
    caustics.material.uniforms.uTime.value = time;
    caustics.material.uniforms.uNight.value = night;
    fish.forEach(koi => updateFish(koi, time, delta));
    updateParticles(delta);
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i]; r.age += delta;
      if (r.age > r.life) { group.remove(r.mesh); r.mesh.material.dispose(); ripples.splice(i, 1); continue; }
      if (r.age < 0) { r.mesh.visible = false; continue; }
      r.mesh.visible = true;
      const s = .08 + r.age * .62;
      r.mesh.scale.setScalar(s);
      r.mesh.material.opacity = (1 - r.age / r.life) * .27 * r.strength;
    }
    rainRippleTimer -= delta;
    if (weather === 'rain' && rainRippleTimer <= 0) {
      rainRippleTimer = .12;
      let x, z;
      do { x = rand(-3, 10.4); z = rand(-2, 9.5); } while (!insidePolygon(x, z));
      addRipple(x, z, .35);
    }
    if (random() < delta * .65 && fish.length) {
      const koi = fish[Math.floor(rand(0, fish.length))];
      spawnBubbles(koi.group.position.x, koi.group.position.z, 2);
    }
  }

  function setQuality(quality) {
    const segments = quality === 'high' ? 20 : 12;
    shared.scaleTexture.anisotropy = quality === 'high' ? 8 : 2;
    fish.forEach(koi => { koi.body.material.clearcoat = quality === 'low' ? 0 : .85; });
    pebbles.count = quality === 'low' ? 140 : 280;
  }

  return {
    group, water, fish, interactives, feedAt, splashAt, greetFish, update, setQuality,
    contains: insidePolygon, bounds: BOUNDS,
    get foodCount() { return pellets.length; },
    get activeFish() { return fish.filter(f => f.targetFood).length; }
  };
}
