import * as THREE from 'three';

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

const SEASON_PALETTE = {
  spring: {
    bamboo: 0x4f9960,
    bambooNode: 0x326d48,
    bambooLeaf: 0x62ac70,
    bark: 0x4d3c2d,
    barkLight: 0x70503a,
    pine: 0x1d4c38,
    pineTip: 0x39734d,
    willow: 0x79b97b,
    willowCluster: 0x4b9862,
    maple: 0x75ad68,
    mapleCluster: 0x4d8d57,
    shrub: 0x4f945b,
    grass: 0x6ea75e,
    orchid: 0x5b9d61,
    orchidFlower: 0xe7a7b9,
    moss: 0x547d45,
    rock: 0x858b80,
    rockDark: 0x303c35,
    pebble: 0xb0b2a4,
    lily: 0x4d9b68,
    lilyVein: 0x9bc17e,
    lotus: 0xe9a4b7,
    lotusInner: 0xffe5e4,
    lotusCenter: 0xe7bf55,
    stem: 0x59834d,
  },
  summer: {
    bamboo: 0x327d50,
    bambooNode: 0x245b3d,
    bambooLeaf: 0x439761,
    bark: 0x49382b,
    barkLight: 0x684a35,
    pine: 0x173f31,
    pineTip: 0x2d6545,
    willow: 0x59a66a,
    willowCluster: 0x347e50,
    maple: 0x4f9258,
    mapleCluster: 0x327344,
    shrub: 0x367d4b,
    grass: 0x4f9552,
    orchid: 0x43884f,
    orchidFlower: 0xe39aae,
    moss: 0x426d3d,
    rock: 0x7c847b,
    rockDark: 0x2d3832,
    pebble: 0xa6aaa0,
    lily: 0x39875b,
    lilyVein: 0x87b574,
    lotus: 0xe79ab2,
    lotusInner: 0xffe2e2,
    lotusCenter: 0xe5b94b,
    stem: 0x4c7947,
  },
  autumn: {
    bamboo: 0x4b8150,
    bambooNode: 0x365f3e,
    bambooLeaf: 0x6b9957,
    bark: 0x4b382b,
    barkLight: 0x71503a,
    pine: 0x1c4434,
    pineTip: 0x356446,
    willow: 0x9a9e59,
    willowCluster: 0x6d804c,
    maple: 0xc65e3e,
    mapleCluster: 0x9d4b37,
    shrub: 0x597c48,
    grass: 0x8b9450,
    orchid: 0x65864e,
    orchidFlower: 0xd88c9e,
    moss: 0x5d7340,
    rock: 0x808279,
    rockDark: 0x30372f,
    pebble: 0xa7a496,
    lily: 0x5c8c59,
    lilyVein: 0xa0b477,
    lotus: 0xd98d9f,
    lotusInner: 0xf4d4d1,
    lotusCenter: 0xd9ac4b,
    stem: 0x66734a,
  },
  winter: {
    bamboo: 0x52755a,
    bambooNode: 0x3b5945,
    bambooLeaf: 0x668568,
    bark: 0x42362e,
    barkLight: 0x604b3b,
    pine: 0x21483a,
    pineTip: 0x3c6650,
    willow: 0x7e8965,
    willowCluster: 0x5c6e57,
    maple: 0x795044,
    mapleCluster: 0x5b453c,
    shrub: 0x5b7255,
    grass: 0x84906a,
    orchid: 0x6d805e,
    orchidFlower: 0xc58e9e,
    moss: 0x64784f,
    rock: 0x858982,
    rockDark: 0x343a35,
    pebble: 0xb0b0a6,
    lily: 0x668668,
    lilyVein: 0x9cae88,
    lotus: 0xc78f9f,
    lotusInner: 0xe5cfd0,
    lotusCenter: 0xc7a55b,
    stem: 0x68765a,
  },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeBladeGeometry() {
  const segments = 5;
  const positions = [];
  const indices = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const width = Math.sin(Math.PI * Math.pow(t, 0.8)) * 0.5;
    const curl = Math.sin(t * Math.PI) * 0.06;
    positions.push(
      t, -width, curl,
      t, 0, curl + Math.sin(t * Math.PI) * 0.035,
      t, width, curl,
    );
  }
  for (let i = 0; i < segments; i += 1) {
    const a = i * 3;
    const b = (i + 1) * 3;
    indices.push(
      a, b, a + 1,
      a + 1, b, b + 1,
      a + 1, b + 1, a + 2,
      a + 2, b + 1, b + 2,
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makePetalGeometry() {
  const segments = 5;
  const positions = [];
  const indices = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const width = Math.sin(Math.PI * Math.pow(t, 0.72)) * 0.55;
    const curl = Math.sin(t * Math.PI * 0.9) * 0.16;
    positions.push(
      t, -width, curl,
      t, 0, curl + Math.sin(t * Math.PI) * 0.045,
      t, width, curl,
    );
  }
  for (let i = 0; i < segments; i += 1) {
    const a = i * 3;
    const b = (i + 1) * 3;
    indices.push(
      a, b, a + 1,
      a + 1, b, b + 1,
      a + 1, b + 1, a + 2,
      a + 2, b + 1, b + 2,
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeMapleLeafGeometry() {
  const points = [
    [0, -0.58], [-0.12, -0.18], [-0.42, -0.28], [-0.32, -0.02],
    [-0.62, 0.08], [-0.28, 0.18], [-0.38, 0.46], [-0.12, 0.34],
    [0, 0.68], [0.12, 0.34], [0.38, 0.46], [0.28, 0.18],
    [0.62, 0.08], [0.32, -0.02], [0.42, -0.28], [0.12, -0.18],
  ];
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) {
    shape.lineTo(points[i][0], points[i][1]);
  }
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.translate(0, 0.58, 0);
  geometry.computeVertexNormals();
  return geometry;
}

function makeFlowerGeometry() {
  const shape = new THREE.Shape();
  const points = 10;
  for (let i = 0; i < points; i += 1) {
    const angle = (i / points) * TAU - Math.PI / 2;
    const radius = i % 2 === 0 ? 1 : 0.43;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function makeMossGeometry() {
  const segments = 11;
  const positions = [0, 0.012, 0];
  const indices = [];
  for (let i = 0; i < segments; i += 1) {
    const angle = (i / segments) * TAU;
    const radius = 0.82 + 0.14 * Math.sin(i * 2.7) + 0.06 * Math.cos(i * 4.1);
    positions.push(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  }
  for (let i = 0; i < segments; i += 1) {
    const next = (i + 1) % segments;
    indices.push(0, next + 1, i + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeLilyPadGeometry(notch) {
  const segments = 32;
  const rings = 3;
  const positions = [0, 0.018, 0];
  const indices = [];
  for (let ring = 1; ring <= rings; ring += 1) {
    const radius = ring / rings;
    for (let j = 0; j <= segments; j += 1) {
      const angle = notch * 0.5 + (TAU - notch) * (j / segments);
      const y = 0.018 + radius * radius * 0.018 + Math.sin(angle * 3 + ring) * 0.006 * radius;
      positions.push(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    }
  }
  for (let j = 0; j < segments; j += 1) {
    indices.push(0, j + 2, j + 1);
  }
  for (let ring = 1; ring < rings; ring += 1) {
    for (let j = 0; j < segments; j += 1) {
      const a = 1 + (ring - 1) * (segments + 1) + j;
      const b = a + 1;
      const c = 1 + ring * (segments + 1) + j;
      const d = c + 1;
      indices.push(a, b, d, a, d, c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeLilyVeinGeometry() {
  const positions = [];
  const addLine = (ax, az, bx, bz) => {
    positions.push(ax, 0.044, az, bx, 0.044, bz);
  };
  for (let i = 0; i < 9; i += 1) {
    const angle = 0.22 + (TAU - 0.44) * (i / 8);
    addLine(0.03 * Math.cos(angle), 0.03 * Math.sin(angle), 0.88 * Math.cos(angle), 0.88 * Math.sin(angle));
    if (i > 0 && i < 8) {
      const bx = 0.46 * Math.cos(angle);
      const bz = 0.46 * Math.sin(angle);
      const side = i % 2 === 0 ? 0.12 : -0.12;
      addLine(bx, bz, 0.69 * Math.cos(angle + side), 0.69 * Math.sin(angle + side));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

function makeRockGeometry(seed) {
  const geometry = new THREE.IcosahedronGeometry(1, 1);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const n = 1 + 0.13 * Math.sin(x * 5.1 + seed) + 0.09 * Math.cos(z * 6.3 - seed * 0.7);
    position.setXYZ(
      i,
      x * n + 0.045 * Math.sin(y * 8 + seed),
      y * (1 + 0.1 * Math.sin(z * 4.2 + seed)) + 0.035 * Math.cos(x * 7 - seed),
      z * n + 0.04 * Math.cos(y * 6 + seed * 0.5),
    );
  }
  geometry.computeVertexNormals();
  return geometry;
}

export function createNature() {
  const group = new THREE.Group();
  group.name = 'JiangnanNature';
  group.userData.nature = true;
  const interactives = [];
  const windNodes = [];
  const floatingNodes = [];
  const seasonalFoliage = [];
  const roleMaterials = [];

  let seed = 0x4f1a2b3c;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rand = (min, max) => min + (max - min) * random();
  const pick = (array) => array[Math.floor(random() * array.length)];

  const colorCache = {};
  for (const seasonName of Object.keys(SEASON_PALETTE)) {
    colorCache[seasonName] = {};
    for (const [role, hex] of Object.entries(SEASON_PALETTE[seasonName])) {
      colorCache[seasonName][role] = new THREE.Color(hex);
    }
  }

  let season = 'summer';
  let weather = 'clear';
  const roleMaterial = (role, options = {}) => {
    const material = new THREE.MeshStandardMaterial({
      color: colorCache[season][role],
      roughness: 0.86,
      ...options,
    });
    material.userData.natureRole = role;
    roleMaterials.push({ material, role });
    return material;
  };

  const materials = {
    bamboo: roleMaterial('bamboo', { roughness: 0.74 }),
    bambooNode: roleMaterial('bambooNode', { roughness: 0.82 }),
    bambooLeaf: roleMaterial('bambooLeaf', { side: THREE.DoubleSide, vertexColors: true }),
    bark: roleMaterial('bark', { roughness: 1 }),
    barkLight: roleMaterial('barkLight', { roughness: 1 }),
    pine: roleMaterial('pine', { flatShading: true, roughness: 0.96 }),
    pineTip: roleMaterial('pineTip', { flatShading: true, roughness: 0.92 }),
    willow: roleMaterial('willow', { side: THREE.DoubleSide, vertexColors: true }),
    willowCluster: roleMaterial('willowCluster', { flatShading: true }),
    maple: roleMaterial('maple', { side: THREE.DoubleSide, vertexColors: true }),
    mapleCluster: roleMaterial('mapleCluster', { flatShading: true }),
    shrub: roleMaterial('shrub', { flatShading: true, vertexColors: true }),
    grass: roleMaterial('grass', { side: THREE.DoubleSide, vertexColors: true }),
    orchid: roleMaterial('orchid', { side: THREE.DoubleSide, vertexColors: true }),
    orchidFlower: roleMaterial('orchidFlower', { side: THREE.DoubleSide, vertexColors: true }),
    moss: roleMaterial('moss', { flatShading: true, roughness: 1 }),
    rock: roleMaterial('rock', { flatShading: true, roughness: 0.97 }),
    rockDark: roleMaterial('rockDark', { flatShading: true, roughness: 1 }),
    pebble: roleMaterial('pebble', { flatShading: true, vertexColors: true, roughness: 0.94 }),
    lily: roleMaterial('lily', { side: THREE.DoubleSide, roughness: 0.72 }),
    lotus: roleMaterial('lotus', { side: THREE.DoubleSide, roughness: 0.68 }),
    lotusInner: roleMaterial('lotusInner', { side: THREE.DoubleSide, roughness: 0.64 }),
    lotusCenter: roleMaterial('lotusCenter', { roughness: 0.72 }),
    stem: roleMaterial('stem', { roughness: 0.92 }),
    lilyVein: new THREE.LineBasicMaterial({ color: colorCache[season].lilyVein, transparent: true, opacity: 0.52 }),
    petal: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      roughness: 0.8,
    }),
    rain: new THREE.LineBasicMaterial({ color: 0x9dbbc1, transparent: true, opacity: 0.24, depthWrite: false }),
    firefly: new THREE.MeshBasicMaterial({ color: 0xd8ef9b, transparent: true, opacity: 0, depthWrite: false }),
  };

  const geometry = {
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 8, 1, false),
    trunk: new THREE.CylinderGeometry(0.74, 1, 1, 8, 1, false),
    slimCylinder: new THREE.CylinderGeometry(1, 1, 1, 6, 1, false),
    node: new THREE.TorusGeometry(1, 0.065, 5, 10),
    ico: new THREE.IcosahedronGeometry(1, 1),
    icoLow: new THREE.IcosahedronGeometry(1, 0),
    pebble: new THREE.IcosahedronGeometry(1, 1),
    sphere: new THREE.SphereGeometry(1, 8, 5),
    smallSphere: new THREE.SphereGeometry(1, 6, 4),
    cone: new THREE.ConeGeometry(1, 1, 7, 1),
    blade: makeBladeGeometry(),
    petal: makePetalGeometry(),
    mapleLeaf: makeMapleLeafGeometry(),
    flower: makeFlowerGeometry(),
    moss: makeMossGeometry(),
    lily: [makeLilyPadGeometry(0.22), makeLilyPadGeometry(0.3), makeLilyPadGeometry(0.38)],
    lilyVein: makeLilyVeinGeometry(),
    rock: [0, 1, 2, 3, 4].map((index) => makeRockGeometry(index * 1.73 + 0.4)),
    rockRim: new THREE.TorusGeometry(1, 0.12, 5, 10),
  };
  geometry.node.rotateX(Math.PI / 2);

  const tempMatrix = new THREE.Matrix4();
  const tempBasis = new THREE.Matrix4();
  const tempPosition = new THREE.Vector3();
  const tempScale = new THREE.Vector3();
  const tempDirection = new THREE.Vector3();
  const tempQuaternion = new THREE.Quaternion();
  const tempQuaternion2 = new THREE.Quaternion();
  const tempEuler = new THREE.Euler();
  const tempColor = new THREE.Color();
  const tempSide = new THREE.Vector3();
  const tempNormal = new THREE.Vector3();

  function makeInstanced(geo, material, count, dynamic = false) {
    const mesh = new THREE.InstancedMesh(geo, material, count);
    mesh.instanceMatrix.setUsage(dynamic ? THREE.DynamicDrawUsage : THREE.StaticDrawUsage);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    if (dynamic) mesh.frustumCulled = false;
    return mesh;
  }

  function setInstanceBetween(mesh, index, a, b, radius) {
    tempDirection.subVectors(b, a);
    const length = tempDirection.length();
    tempPosition.copy(a).add(b).multiplyScalar(0.5);
    tempQuaternion.setFromUnitVectors(UP, tempDirection.normalize());
    tempScale.set(radius, length, radius);
    tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
    mesh.setMatrixAt(index, tempMatrix);
  }

  function setGrayTint(mesh, index, value = rand(0.78, 1.04)) {
    tempColor.setRGB(value, value, value);
    mesh.setColorAt(index, tempColor);
  }

  // 树干、枝条、荷茎按父级和材质合批；父级仍是风摆/交互节点。
  const cylinderBatches = new Map();
  function addCylinderBetween(parent, a, b, radius, material, geo = geometry.trunk, castShadow = true) {
    const key = `${parent.uuid}:${geo.uuid}:${material.uuid}:${castShadow}`;
    let batch = cylinderBatches.get(key);
    if (!batch) {
      batch = { parent, geo, material, castShadow, records: [] };
      cylinderBatches.set(key, batch);
    }
    batch.records.push({ a: a.clone(), b: b.clone(), radius });
    return null;
  }

  function finalizeCylinderBatches() {
    for (const batch of cylinderBatches.values()) {
      const mesh = makeInstanced(batch.geo, batch.material, batch.records.length);
      mesh.castShadow = batch.castShadow;
      mesh.receiveShadow = true;
      batch.records.forEach((record, index) => {
        setInstanceBetween(mesh, index, record.a, record.b, record.radius);
      });
      mesh.instanceMatrix.needsUpdate = true;
      batch.parent.add(mesh);
    }
    cylinderBatches.clear();
  }

  const staticBatches = new Map();
  function queueInstance(parent, geo, material, position, quaternion, scale, castShadow = false) {
    const key = `${parent.uuid}:${geo.uuid}:${material.uuid}:${castShadow}`;
    let batch = staticBatches.get(key);
    if (!batch) {
      batch = { parent, geo, material, castShadow, matrices: [] };
      staticBatches.set(key, batch);
    }
    batch.matrices.push(new THREE.Matrix4().compose(position, quaternion, scale));
  }

  function finalizeStaticBatches() {
    for (const batch of staticBatches.values()) {
      const mesh = makeInstanced(batch.geo, batch.material, batch.matrices.length);
      mesh.castShadow = batch.castShadow;
      mesh.receiveShadow = true;
      batch.matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
      mesh.instanceMatrix.needsUpdate = true;
      batch.parent.add(mesh);
    }
    staticBatches.clear();
  }

  function registerWind(object, amplitude, speed = 1) {
    windNodes.push({
      object,
      amplitude,
      speed,
      phase: rand(0, TAU),
      baseX: object.rotation.x,
      baseZ: object.rotation.z,
    });
  }

  function registerFloating(object, amplitude = 0.014, speed = 1) {
    floatingNodes.push({
      object,
      amplitude,
      speed,
      phase: rand(0, TAU),
      baseY: object.position.y,
      baseRotationZ: object.rotation.z,
    });
  }

  function addInteractive(object, interaction, label) {
    object.userData.interaction = interaction;
    object.userData.label = label;
    interactives.push(object);
  }

  // 与主程序池塘轮廓保持一致；局部复制避免自然模块与水面模块产生依赖。
  const pondOutline = [
    [-3.7, 1.0], [-3.4, -0.7], [-1.7, -2.1], [1.0, -2.8], [4.2, -2.5],
    [7.7, -1.7], [10.0, 0.0], [11.0, 2.8], [10.7, 5.6], [9.2, 8.3],
    [6.3, 9.9], [3.1, 10.1], [0.4, 9.0], [-1.8, 7.3], [-3.0, 4.7],
  ];
  function pointInPond(x, z) {
    let inside = false;
    for (let i = 0, j = pondOutline.length - 1; i < pondOutline.length; j = i, i += 1) {
      const xi = pondOutline[i][0];
      const zi = pondOutline[i][1];
      const xj = pondOutline[j][0];
      const zj = pondOutline[j][1];
      const hit = ((zi > z) !== (zj > z)) && (x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-8) + xi);
      if (hit) inside = !inside;
    }
    return inside;
  }

  function isPond(x, z, margin = 0) {
    // 保守的近似矩形负责批量植被 rejection，多边形及其邻域负责真实曲线岸。
    if (x > -3 - margin && x < 11 + margin && z > -2 - margin && z < 10 + margin) return true;
    if (pointInPond(x, z)) return true;
    if (margin > 0) {
      for (let i = 0; i < 8; i += 1) {
        const angle = (i / 8) * TAU;
        if (pointInPond(x + Math.cos(angle) * margin, z + Math.sin(angle) * margin)) return true;
      }
    }
    return false;
  }

  function fitLilySpot(x, z, radius) {
    let px = x;
    let pz = z;
    // 只向池塘中心微调，既保证整片叶子在水内，也不把岸边荷叶带入中央开阔水域。
    for (let attempt = 0; attempt < 16; attempt += 1) {
      let fits = pointInPond(px, pz);
      for (let i = 0; fits && i < 8; i += 1) {
        const angle = (i / 8) * TAU;
        fits = pointInPond(px + Math.cos(angle) * radius * 0.78, pz + Math.sin(angle) * radius * 0.78);
      }
      if (fits) break;
      px += (3.6 - px) * 0.1;
      pz += (3.6 - pz) * 0.1;
    }
    return { x: px, z: pz };
  }

  function isHall(x, z, margin = 0) {
    return x > -8 - margin && x < 6 + margin && z > -13 - margin && z < -7 + margin;
  }

  function safeGroundPoint(x, z, margin = 0.2) {
    return x > -17.5 && x < 17.5 && z > -13.5 && z < 13.5 && !isPond(x, z, margin) && !isHall(x, z, margin);
  }

  function randomGroundPoint(margin = 0.25) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const x = rand(-17, 17);
      const z = rand(-13, 13);
      if (safeGroundPoint(x, z, margin)) return { x, z };
    }
    return { x: -15, z: 12 };
  }

  function addMossPatch(x, z, size = 0.7, rotation = 0) {
    if (!safeGroundPoint(x, z, 0.05)) return null;
    const patch = new THREE.Mesh(geometry.moss, materials.moss);
    patch.position.set(x, 0.025, z);
    patch.rotation.y = rotation;
    patch.scale.set(size, 1, size * rand(0.62, 0.9));
    patch.receiveShadow = true;
    group.add(patch);
    return patch;
  }

  // 太湖石：多个扰动几何叠置，再用深色凹面与石缘表现孔洞。
  function createRock(x, z, scale, label, variant = 0) {
    const rock = new THREE.Group();
    rock.name = `TaihuRock_${variant}`;
    rock.position.set(x, 0, z);
    rock.scale.setScalar(scale);
    const pieces = [
      { x: 0, y: 0.68, z: 0, sx: 0.86, sy: 1.2, sz: 0.72, ry: 0.12 },
      { x: -0.54, y: 0.36, z: 0.08, sx: 0.6, sy: 0.68, sz: 0.54, ry: -0.32 },
      { x: 0.5, y: 0.34, z: -0.08, sx: 0.58, sy: 0.62, sz: 0.5, ry: 0.44 },
      { x: 0.1, y: 1.38, z: 0.02, sx: 0.46, sy: 0.62, sz: 0.42, ry: 0.28 },
    ];
    pieces.forEach((piece, index) => {
      const mesh = new THREE.Mesh(geometry.rock[(variant + index) % geometry.rock.length], materials.rock);
      mesh.position.set(piece.x, piece.y, piece.z);
      mesh.scale.set(piece.sx, piece.sy, piece.sz);
      mesh.rotation.set(rand(-0.12, 0.12), piece.ry + rand(-0.2, 0.2), rand(-0.1, 0.1));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      rock.add(mesh);
    });

    const holeNormals = [
      new THREE.Vector3(-0.32, 0.12, 1).normalize(),
      new THREE.Vector3(0.38, 0.22, 1).normalize(),
      new THREE.Vector3(-0.85, 0.18, 0.42).normalize(),
    ];
    holeNormals.forEach((normal, index) => {
      const size = [0.23, 0.17, 0.14][index];
      const center = new THREE.Vector3(
        normal.x * (index === 2 ? 0.7 : 0.67),
        0.67 + normal.y * 0.76 + (index === 1 ? 0.27 : 0),
        normal.z * 0.64,
      );
      const hole = new THREE.Mesh(geometry.sphere, materials.rockDark);
      hole.position.copy(center);
      hole.quaternion.setFromUnitVectors(Z_AXIS, normal);
      hole.scale.set(size, size * 0.78, 0.045);
      hole.receiveShadow = true;
      rock.add(hole);
      const rim = new THREE.Mesh(geometry.rockRim, materials.rock);
      rim.position.copy(center).addScaledVector(normal, 0.025);
      rim.quaternion.setFromUnitVectors(Z_AXIS, normal);
      rim.scale.set(size * 1.08, size * 0.84, 1);
      rim.castShadow = true;
      rock.add(rim);
    });
    addInteractive(rock, 'rock', label);
    group.add(rock);
    return rock;
  }

  const rockSpots = [
    [-4.35, -2.95, 1.12, '太湖石 · 云窟藏幽'],
    [11.95, 1.1, 0.9, '太湖石 · 涵虚'],
    [3.1, 10.95, 1.02, '太湖石 · 青皱'],
    [-4.15, 8.25, 0.82, '太湖石 · 小洞天'],
    [8.1, -4.8, 1.18, '太湖石 · 疏影'],
    [-12.1, -5.8, 1.22, '太湖石 · 瘦云'],
  ];
  rockSpots.forEach((spot, index) => {
    createRock(spot[0], spot[1], spot[2], spot[3], index);
    addMossPatch(spot[0] - 0.45, spot[1] + 0.32, spot[2] * 0.8, rand(0, TAU));
    addMossPatch(spot[0] + 0.42, spot[1] - 0.28, spot[2] * 0.56, rand(0, TAU));
  });

  // 池岸卵石：沿主程序同一条曲线岸边的各边外侧实例化。
  const pebbleCount = 184;
  const pebbles = makeInstanced(geometry.pebble, materials.pebble, pebbleCount);
  for (let i = 0; i < pebbleCount; i += 1) {
    const edge = i % pondOutline.length;
    const a = pondOutline[edge];
    const b = pondOutline[(edge + 1) % pondOutline.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const length = Math.hypot(dx, dz) || 1;
    const tx = dx / length;
    const tz = dz / length;
    // 轮廓按顺时针绕行，(dz,-dx) 是朝外法线。
    const nx = tz;
    const nz = -tx;
    const t = random();
    const offset = rand(0.08, 0.58);
    const tangentJitter = rand(-0.16, 0.16);
    const x = a[0] + dx * t + nx * offset + tx * tangentJitter;
    const z = a[1] + dz * t + nz * offset + tz * tangentJitter;
    tempPosition.set(x, rand(0.065, 0.15), z);
    tempEuler.set(rand(-0.35, 0.35), rand(0, TAU), rand(-0.35, 0.35));
    tempQuaternion.setFromEuler(tempEuler);
    tempScale.set(rand(0.12, 0.31), rand(0.08, 0.18), rand(0.1, 0.27));
    tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
    pebbles.setMatrixAt(i, tempMatrix);
    tempColor.setRGB(rand(0.66, 0.96), rand(0.68, 0.96), rand(0.7, 0.98));
    pebbles.setColorAt(i, tempColor);
  }
  pebbles.instanceMatrix.needsUpdate = true;
  pebbles.instanceColor.needsUpdate = true;
  group.add(pebbles);

  function createBambooGrove(x, z, count, heightScale, label) {
    const grove = new THREE.Group();
    grove.name = 'BambooGrove';
    grove.position.set(x, 0, z);
    const maxSegments = 10;
    const stalks = makeInstanced(geometry.cylinder, materials.bamboo, count * maxSegments);
    const nodes = makeInstanced(geometry.node, materials.bambooNode, count * maxSegments);
    const leaves = makeInstanced(geometry.blade, materials.bambooLeaf, count * maxSegments * 3);
    let stalkIndex = 0;
    let nodeIndex = 0;
    let leafIndex = 0;
    for (let i = 0; i < count; i += 1) {
      const bx = rand(-1.45, 1.45);
      const bz = rand(-1.25, 1.25);
      const height = rand(3.1, 5.35) * heightScale;
      const segments = clamp(Math.round(height / 0.62), 5, maxSegments);
      const radius = rand(0.055, 0.095) * (0.85 + heightScale * 0.15);
      const leanX = rand(-0.42, 0.42);
      const leanZ = rand(-0.36, 0.36);
      for (let j = 0; j < segments; j += 1) {
        const y0 = (j / segments) * height;
        const y1 = ((j + 1) / segments) * height;
        const p0 = new THREE.Vector3(bx + leanX * (y0 / height), y0, bz + leanZ * (y0 / height));
        const p1 = new THREE.Vector3(bx + leanX * (y1 / height), y1, bz + leanZ * (y1 / height));
        setInstanceBetween(stalks, stalkIndex, p0, p1, radius);
        setGrayTint(stalks, stalkIndex, rand(0.85, 1.08));
        stalkIndex += 1;
        if (j > 0) {
          tempPosition.copy(p0);
          tempQuaternion.identity();
          tempScale.set(radius * 1.04, radius * 1.04, radius * 1.04);
          tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
          nodes.setMatrixAt(nodeIndex, tempMatrix);
          nodeIndex += 1;
        }
      }
      for (let j = Math.max(2, Math.floor(segments * 0.38)); j <= segments; j += 1) {
        const y = (j / segments) * height;
        const origin = new THREE.Vector3(bx + leanX * (j / segments), y, bz + leanZ * (j / segments));
        for (let k = 0; k < 3; k += 1) {
          const angle = rand(0, TAU);
          tempDirection.set(Math.cos(angle) * rand(0.65, 1), rand(0.1, 0.55), Math.sin(angle) * rand(0.65, 1)).normalize();
          tempQuaternion.setFromUnitVectors(X_AXIS, tempDirection);
          tempQuaternion2.setFromAxisAngle(tempDirection, rand(-0.6, 0.6));
          tempQuaternion.multiply(tempQuaternion2);
          tempPosition.copy(origin).addScaledVector(tempDirection, rand(0.02, 0.13));
          tempScale.set(rand(0.64, 1.2), rand(0.075, 0.14), rand(0.7, 1.15));
          tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
          leaves.setMatrixAt(leafIndex, tempMatrix);
          setGrayTint(leaves, leafIndex, rand(0.76, 1.06));
          leafIndex += 1;
        }
      }
    }
    stalks.count = stalkIndex;
    nodes.count = nodeIndex;
    leaves.count = leafIndex;
    stalks.instanceMatrix.needsUpdate = true;
    nodes.instanceMatrix.needsUpdate = true;
    leaves.instanceMatrix.needsUpdate = true;
    if (stalks.instanceColor) stalks.instanceColor.needsUpdate = true;
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
    grove.add(stalks, nodes, leaves);
    // 新笋让竹丛底部也有尺度变化。
    for (let i = 0; i < 3; i += 1) {
      const shoot = new THREE.Mesh(geometry.cone, materials.bamboo);
      shoot.position.set(rand(-1.4, 1.4), rand(0.22, 0.38), rand(-1.2, 1.2));
      shoot.scale.set(0.12, rand(0.35, 0.62), 0.12);
      shoot.castShadow = true;
      grove.add(shoot);
    }
    addInteractive(grove, 'tree', label);
    registerWind(grove, 0.026 + heightScale * 0.006, 0.82);
    group.add(grove);
    return grove;
  }

  [
    [-14, -9, 10, 1.06, '翠竹 · 西墙修篁'],
    [-10.8, 10.8, 12, 0.9, '翠竹 · 南岸竹影'],
    [13, -10, 11, 1.15, '翠竹 · 北径竹声'],
    [11.8, 11.4, 9, 0.84, '翠竹 · 东隅筛风'],
    [-11.7, -4.4, 8, 0.74, '翠竹 · 西窗弄影'],
  ].forEach((item) => createBambooGrove(...item));

  function createPine(x, z, scale, label) {
    const tree = new THREE.Group();
    tree.name = 'BlackPine';
    tree.position.set(x, 0, z);
    tree.scale.setScalar(scale);
    const trunk = new THREE.Group();
    const crown = new THREE.Group();
    const foliage = new THREE.Group();
    tree.add(trunk, crown);
    crown.add(foliage);

    const trunkPoints = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.1, 0.85, 0.02),
      new THREE.Vector3(-0.12, 1.75, 0.04),
      new THREE.Vector3(0.18, 2.6, -0.03),
      new THREE.Vector3(0.08, 3.45, 0.02),
      new THREE.Vector3(0.28, 4.1, 0),
    ];
    for (let i = 0; i < trunkPoints.length - 1; i += 1) {
      addCylinderBetween(trunk, trunkPoints[i], trunkPoints[i + 1], 0.24 - i * 0.035, materials.bark);
    }
    for (let i = 0; i < 5; i += 1) {
      const angle = (i / 5) * TAU + rand(-0.2, 0.2);
      addCylinderBetween(
        trunk,
        new THREE.Vector3(0, 0.12, 0),
        new THREE.Vector3(Math.cos(angle) * rand(0.45, 0.8), 0.035, Math.sin(angle) * rand(0.45, 0.8)),
        0.1,
        materials.bark,
      );
    }

    const branchLevels = [1.25, 1.8, 2.35, 2.85, 3.35, 3.7];
    branchLevels.forEach((y, level) => {
      const branches = level < 2 ? 3 : 4;
      for (let i = 0; i < branches; i += 1) {
        const angle = (i / branches) * TAU + level * 1.37 + rand(-0.25, 0.25);
        const length = (1.85 - level * 0.17) * rand(0.85, 1.15);
        const start = new THREE.Vector3(0.04, y, 0);
        const mid = new THREE.Vector3(Math.cos(angle) * length * 0.54, y + rand(0.05, 0.28), Math.sin(angle) * length * 0.54);
        const end = new THREE.Vector3(Math.cos(angle) * length, y + rand(0.18, 0.52), Math.sin(angle) * length);
        addCylinderBetween(crown, start, mid, 0.105 - level * 0.009, materials.bark);
        addCylinderBetween(crown, mid, end, 0.065 - level * 0.006, materials.barkLight);
        for (let k = 0; k < 3; k += 1) {
          tempPosition.copy(end).add(new THREE.Vector3(rand(-0.36, 0.36), rand(-0.1, 0.22), rand(-0.32, 0.32)));
          tempEuler.set(rand(-0.2, 0.2), rand(0, TAU), rand(-0.2, 0.2));
          tempQuaternion.setFromEuler(tempEuler);
          tempScale.set(rand(0.46, 0.76), rand(0.22, 0.38), rand(0.38, 0.66));
          queueInstance(foliage, geometry.ico, k === 2 ? materials.pineTip : materials.pine, tempPosition, tempQuaternion, tempScale);
        }
        tempPosition.copy(end).add(new THREE.Vector3(0, 0.22, 0));
        tempEuler.set(0, 0, rand(-0.35, 0.35));
        tempQuaternion.setFromEuler(tempEuler);
        tempScale.set(0.16, 0.46, 0.16);
        queueInstance(foliage, geometry.cone, materials.pineTip, tempPosition, tempQuaternion, tempScale);
      }
    });
    tempPosition.set(0.28, 4.2, 0);
    tempQuaternion.identity();
    tempScale.set(0.52, 0.7, 0.48);
    queueInstance(foliage, geometry.ico, materials.pine, tempPosition, tempQuaternion, tempScale);
    addInteractive(tree, 'tree', label);
    registerWind(crown, 0.032, 0.68);
    seasonalFoliage.push({ object: foliage, type: 'pine', baseScale: 1 });
    group.add(tree);
    return tree;
  }

  createPine(-14, -2, 1.08, '黑松 · 听涛');
  createPine(13.2, -7, 0.94, '黑松 · 云龙');
  createPine(7.2, 12.6, 0.82, '黑松 · 迎风');

  function createWillow(x, z, scale) {
    const tree = new THREE.Group();
    tree.name = 'WeepingWillow';
    tree.position.set(x, 0, z);
    tree.scale.setScalar(scale);
    const trunk = new THREE.Group();
    const crown = new THREE.Group();
    const foliage = new THREE.Group();
    tree.add(trunk, crown);
    crown.add(foliage);
    const trunkPoints = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-0.12, 1.1, 0.05),
      new THREE.Vector3(0.16, 2.15, 0),
      new THREE.Vector3(0.02, 3.15, -0.06),
    ];
    for (let i = 0; i < trunkPoints.length - 1; i += 1) {
      addCylinderBetween(trunk, trunkPoints[i], trunkPoints[i + 1], 0.28 - i * 0.055, materials.bark);
    }
    for (let i = 0; i < 4; i += 1) {
      const angle = (i / 4) * TAU;
      addCylinderBetween(trunk, new THREE.Vector3(0, 0.1, 0), new THREE.Vector3(Math.cos(angle) * 0.72, 0.03, Math.sin(angle) * 0.72), 0.11, materials.bark);
    }

    const fronds = [];
    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * TAU + rand(-0.15, 0.15);
      const start = new THREE.Vector3(0, rand(2.25, 2.8), 0);
      const mid = new THREE.Vector3(Math.cos(angle) * 1.05, rand(3.1, 3.65), Math.sin(angle) * 1.05);
      const end = new THREE.Vector3(Math.cos(angle) * rand(1.65, 2.2), rand(2.8, 3.3), Math.sin(angle) * rand(1.65, 2.2));
      addCylinderBetween(crown, start, mid, 0.095, materials.bark);
      addCylinderBetween(crown, mid, end, 0.05, materials.barkLight);
      tempPosition.copy(mid).add(new THREE.Vector3(0, 0.12, 0));
      tempEuler.set(0, rand(0, TAU), 0);
      tempQuaternion.setFromEuler(tempEuler);
      tempScale.set(rand(0.58, 0.88), rand(0.32, 0.5), rand(0.55, 0.84));
      queueInstance(foliage, geometry.ico, materials.willowCluster, tempPosition, tempQuaternion, tempScale);
      for (let j = 0; j < 3; j += 1) {
        const top = end.clone().add(new THREE.Vector3(rand(-0.25, 0.25), rand(-0.05, 0.2), rand(-0.25, 0.25)));
        const bottom = top.clone().add(new THREE.Vector3(rand(-0.38, 0.38), -rand(1.2, 2.35), rand(-0.38, 0.38)));
        addCylinderBetween(crown, top, bottom, 0.016, materials.stem, geometry.slimCylinder, false);
        fronds.push({ top, bottom, angle: angle + rand(-0.5, 0.5) });
      }
    }
    const leaves = makeInstanced(geometry.blade, materials.willow, fronds.length * 8);
    let leafIndex = 0;
    fronds.forEach((frond) => {
      for (let i = 0; i < 8; i += 1) {
        const t = (i + 0.35) / 8;
        tempPosition.lerpVectors(frond.top, frond.bottom, t);
        const sideAngle = frond.angle + (i % 2 === 0 ? 0.7 : -0.7);
        tempDirection.set(Math.cos(sideAngle) * 0.34, -0.86, Math.sin(sideAngle) * 0.34).normalize();
        tempQuaternion.setFromUnitVectors(X_AXIS, tempDirection);
        tempScale.set(rand(0.38, 0.66), rand(0.07, 0.12), rand(0.42, 0.65));
        tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
        leaves.setMatrixAt(leafIndex, tempMatrix);
        setGrayTint(leaves, leafIndex, rand(0.78, 1.05));
        leafIndex += 1;
      }
    });
    leaves.instanceMatrix.needsUpdate = true;
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
    foliage.add(leaves);
    addInteractive(tree, 'tree', '垂柳 · 一堤烟雨');
    registerWind(crown, 0.048, 0.74);
    seasonalFoliage.push({ object: foliage, type: 'willow', baseScale: 1 });
    group.add(tree);
    return tree;
  }

  createWillow(-9.3, 4.1, 1.04);

  function createMaple(x, z, scale, label) {
    const tree = new THREE.Group();
    tree.name = 'RedMaple';
    tree.position.set(x, 0, z);
    tree.scale.setScalar(scale);
    const trunk = new THREE.Group();
    const crown = new THREE.Group();
    const foliage = new THREE.Group();
    tree.add(trunk, crown);
    crown.add(foliage);
    addCylinderBetween(trunk, new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.12, 1.35, 0.06), 0.23, materials.bark);
    addCylinderBetween(trunk, new THREE.Vector3(-0.12, 1.35, 0.06), new THREE.Vector3(0.14, 2.7, 0), 0.16, materials.bark);
    for (let i = 0; i < 4; i += 1) {
      const angle = i * Math.PI / 2 + 0.3;
      addCylinderBetween(trunk, new THREE.Vector3(0, 0.08, 0), new THREE.Vector3(Math.cos(angle) * 0.58, 0.025, Math.sin(angle) * 0.58), 0.085, materials.bark);
    }
    const leafTips = [];
    for (let i = 0; i < 11; i += 1) {
      const angle = (i / 11) * TAU + rand(-0.18, 0.18);
      const start = new THREE.Vector3(0.02, rand(1.45, 2.45), 0);
      const mid = new THREE.Vector3(Math.cos(angle) * 0.72, start.y + rand(0.35, 0.65), Math.sin(angle) * 0.72);
      const end = new THREE.Vector3(Math.cos(angle) * rand(1.25, 1.85), mid.y + rand(0.15, 0.65), Math.sin(angle) * rand(1.25, 1.85));
      addCylinderBetween(crown, start, mid, 0.07, materials.bark);
      addCylinderBetween(crown, mid, end, 0.038, materials.barkLight);
      leafTips.push(end);
      tempPosition.copy(end).add(new THREE.Vector3(0, 0.05, 0));
      tempEuler.set(0, rand(0, TAU), 0);
      tempQuaternion.setFromEuler(tempEuler);
      tempScale.set(rand(0.4, 0.65), rand(0.24, 0.42), rand(0.4, 0.65));
      queueInstance(foliage, geometry.icoLow, materials.mapleCluster, tempPosition, tempQuaternion, tempScale);
    }
    const leaves = makeInstanced(geometry.mapleLeaf, materials.maple, leafTips.length * 15);
    let leafIndex = 0;
    leafTips.forEach((tip) => {
      for (let i = 0; i < 15; i += 1) {
        tempPosition.copy(tip).add(new THREE.Vector3(rand(-0.64, 0.64), rand(-0.24, 0.44), rand(-0.64, 0.64)));
        tempNormal.set(rand(-0.48, 0.48), 1, rand(-0.48, 0.48)).normalize();
        tempQuaternion.setFromUnitVectors(Z_AXIS, tempNormal);
        tempQuaternion2.setFromAxisAngle(tempNormal, rand(0, TAU));
        tempQuaternion.multiply(tempQuaternion2);
        const size = rand(0.21, 0.38);
        tempScale.set(size, size, size);
        tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
        leaves.setMatrixAt(leafIndex, tempMatrix);
        setGrayTint(leaves, leafIndex, rand(0.78, 1.08));
        leafIndex += 1;
      }
    });
    leaves.instanceMatrix.needsUpdate = true;
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
    foliage.add(leaves);
    addInteractive(tree, 'tree', label);
    registerWind(crown, 0.038, 0.88);
    seasonalFoliage.push({ object: foliage, type: 'maple', baseScale: 1 });
    group.add(tree);
    return tree;
  }

  createMaple(13.6, -2.9, 1.02, '红枫 · 霜叶映水');
  createMaple(-12.2, -11.1, 0.72, '红枫 · 墙角秋声');

  // 灌木合批：每丛由数个低多边形团块构成，避免大量独立材质。
  const shrubCenters = [
    [-16, -11], [-10, -11], [-15.5, -5], [-16, 6], [-12, 12], [-7, 12],
    [12, 12], [16, 11], [16, 3], [14, -5], [9, -11], [7, -9],
    [-7, -4], [-15, 12], [15, -12], [-10, 7],
  ];
  const shrubs = makeInstanced(geometry.ico, materials.shrub, shrubCenters.length * 5);
  let shrubIndex = 0;
  shrubCenters.forEach(([cx, cz]) => {
    for (let i = 0; i < 5; i += 1) {
      const x = cx + rand(-0.48, 0.48);
      const z = cz + rand(-0.42, 0.42);
      tempPosition.set(x, rand(0.25, 0.52), z);
      tempEuler.set(rand(-0.15, 0.15), rand(0, TAU), rand(-0.15, 0.15));
      tempQuaternion.setFromEuler(tempEuler);
      tempScale.set(rand(0.32, 0.58), rand(0.28, 0.52), rand(0.3, 0.56));
      tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
      shrubs.setMatrixAt(shrubIndex, tempMatrix);
      setGrayTint(shrubs, shrubIndex, rand(0.78, 1.06));
      shrubIndex += 1;
    }
    if (random() > 0.35) addMossPatch(cx + rand(-0.6, 0.6), cz + rand(-0.6, 0.6), rand(0.45, 0.85), rand(0, TAU));
  });
  shrubs.count = shrubIndex;
  shrubs.instanceMatrix.needsUpdate = true;
  if (shrubs.instanceColor) shrubs.instanceColor.needsUpdate = true;
  group.add(shrubs);

  // 地被草与兰草共用叶片几何，按实例一次绘制。
  const grassPatches = shrubCenters.concat([[-6, 12], [12, -5], [-14, -7], [15, 5], [-6, -5], [7, -6]]);
  const grass = makeInstanced(geometry.blade, materials.grass, grassPatches.length * 16);
  let grassIndex = 0;
  grassPatches.forEach(([cx, cz]) => {
    for (let i = 0; i < 16; i += 1) {
      const x = cx + rand(-0.9, 0.9);
      const z = cz + rand(-0.75, 0.75);
      if (!safeGroundPoint(x, z, 0.08)) continue;
      tempPosition.set(x, 0.025, z);
      tempDirection.set(rand(-0.32, 0.32), 1, rand(-0.32, 0.32)).normalize();
      tempQuaternion.setFromUnitVectors(X_AXIS, tempDirection);
      tempQuaternion2.setFromAxisAngle(tempDirection, rand(0, TAU));
      tempQuaternion.multiply(tempQuaternion2);
      tempScale.set(rand(0.25, 0.62), rand(0.055, 0.105), rand(0.28, 0.58));
      tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
      grass.setMatrixAt(grassIndex, tempMatrix);
      setGrayTint(grass, grassIndex, rand(0.74, 1.05));
      grassIndex += 1;
    }
  });
  grass.count = grassIndex;
  grass.instanceMatrix.needsUpdate = true;
  if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
  group.add(grass);

  const orchidCenters = [
    [-5, -4], [12, 2], [4, 12], [-5, 8], [8, -5], [-12, -6],
    [-14, 9], [15, 9], [10, -10], [-10, -10], [15, -1], [-15, 2],
  ];
  const orchidLeaves = makeInstanced(geometry.blade, materials.orchid, orchidCenters.length * 10);
  const orchidFlowers = makeInstanced(geometry.flower, materials.orchidFlower, orchidCenters.length * 4);
  const orchidCentersMesh = makeInstanced(geometry.smallSphere, materials.lotusCenter, orchidCenters.length * 4);
  const orchidStems = makeInstanced(geometry.slimCylinder, materials.stem, orchidCenters.length * 4);
  let orchidLeafIndex = 0;
  let orchidFlowerIndex = 0;
  orchidCenters.forEach(([cx, cz]) => {
    for (let i = 0; i < 10; i += 1) {
      const angle = rand(0, TAU);
      tempPosition.set(cx + rand(-0.18, 0.18), 0.03, cz + rand(-0.18, 0.18));
      tempDirection.set(Math.cos(angle) * rand(0.25, 0.65), rand(0.65, 1), Math.sin(angle) * rand(0.25, 0.65)).normalize();
      tempQuaternion.setFromUnitVectors(X_AXIS, tempDirection);
      tempScale.set(rand(0.38, 0.72), rand(0.045, 0.085), rand(0.4, 0.7));
      tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
      orchidLeaves.setMatrixAt(orchidLeafIndex, tempMatrix);
      setGrayTint(orchidLeaves, orchidLeafIndex, rand(0.8, 1.06));
      orchidLeafIndex += 1;
    }
    for (let i = 0; i < 4; i += 1) {
      const base = new THREE.Vector3(cx + rand(-0.22, 0.22), 0.04, cz + rand(-0.22, 0.22));
      const top = base.clone().add(new THREE.Vector3(rand(-0.09, 0.09), rand(0.35, 0.62), rand(-0.09, 0.09)));
      setInstanceBetween(orchidStems, orchidFlowerIndex, base, top, 0.012);
      tempPosition.copy(top);
      tempEuler.set(rand(-0.22, 0.22), rand(0, TAU), rand(-0.22, 0.22));
      tempQuaternion.setFromEuler(tempEuler);
      const flowerSize = rand(0.105, 0.17);
      tempScale.set(flowerSize, flowerSize, flowerSize);
      tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
      orchidFlowers.setMatrixAt(orchidFlowerIndex, tempMatrix);
      setGrayTint(orchidFlowers, orchidFlowerIndex, rand(0.88, 1.06));
      tempPosition.y += 0.025;
      tempScale.setScalar(0.035);
      tempMatrix.compose(tempPosition, tempQuaternion.identity(), tempScale);
      orchidCentersMesh.setMatrixAt(orchidFlowerIndex, tempMatrix);
      orchidFlowerIndex += 1;
    }
    addMossPatch(cx, cz, 0.5, rand(0, TAU));
  });
  orchidLeaves.count = orchidLeafIndex;
  orchidFlowers.count = orchidFlowerIndex;
  orchidCentersMesh.count = orchidFlowerIndex;
  orchidStems.count = orchidFlowerIndex;
  [orchidLeaves, orchidFlowers, orchidCentersMesh, orchidStems].forEach((mesh) => {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
  });

  // 余下苔藓以安全区域 rejection sampling 分布，不侵入主厅和池塘。
  for (let i = 0; i < 26; i += 1) {
    const point = randomGroundPoint(0.18);
    addMossPatch(point.x, point.z, rand(0.25, 0.72), rand(0, TAU));
  }

  // 荷叶全部贴岸或位于角隅，中央 x[0,8]、z[1,8] 保留开阔喂鱼水面。
  const lilySpots = [
    [-2.35, -1.1, 0.62], [-0.9, -1.35, 0.48], [1.1, -1.43, 0.56],
    [3.3, -1.38, 0.45], [7.9, -1.35, 0.6], [9.7, -0.95, 0.5],
    [10.35, 0.3, 0.62], [10.42, 2.2, 0.46], [10.3, 4.0, 0.56],
    [10.4, 6.2, 0.48], [10.15, 8.3, 0.64], [8.8, 9.38, 0.52],
    [6.7, 9.5, 0.62], [4.6, 9.48, 0.46], [2.5, 9.5, 0.6],
    [0.3, 9.35, 0.48], [-1.5, 9.15, 0.62], [-2.35, 7.6, 0.52],
    [-2.42, 5.6, 0.62], [-2.35, 3.7, 0.46], [-2.42, 1.75, 0.56], [-2.3, 0.1, 0.45],
  ];
  const lilyPads = [];
  function createLilyPad(x, z, radius, index) {
    const fitted = fitLilySpot(x, z, radius);
    const pad = new THREE.Group();
    pad.name = `LilyPad_${index + 1}`;
    pad.position.set(fitted.x, 0.15, fitted.z);
    pad.rotation.y = rand(0, TAU);
    const leaf = new THREE.Mesh(geometry.lily[index % geometry.lily.length], materials.lily);
    leaf.scale.setScalar(radius);
    leaf.receiveShadow = true;
    const veins = new THREE.LineSegments(geometry.lilyVein, materials.lilyVein);
    veins.scale.setScalar(radius);
    veins.renderOrder = 1;
    pad.add(leaf, veins);
    pad.userData.natureType = 'lilyPad';
    pad.userData.waterY = 0.15;
    addInteractive(pad, 'lotus', '睡莲荷叶 · 点击泛起涟漪');
    registerFloating(pad, 0.012, rand(0.72, 1.05));
    group.add(pad);
    lilyPads.push(pad);
    return pad;
  }
  lilySpots.forEach((spot, index) => createLilyPad(spot[0], spot[1], spot[2], index));

  function petalQuaternion(angle, tilt) {
    tempDirection.set(Math.cos(angle) * Math.cos(tilt), Math.sin(tilt), Math.sin(angle) * Math.cos(tilt)).normalize();
    tempSide.set(Math.sin(angle), 0, -Math.cos(angle)).normalize();
    tempNormal.crossVectors(tempDirection, tempSide).normalize();
    tempBasis.makeBasis(tempDirection, tempSide, tempNormal);
    return tempQuaternion.setFromRotationMatrix(tempBasis);
  }

  function createLotus(pad, index) {
    const flower = new THREE.Group();
    flower.name = `LotusFlower_${index + 1}`;
    flower.position.set(pad.position.x + rand(-0.12, 0.12), 0.15, pad.position.z + rand(-0.12, 0.12));
    addCylinderBetween(flower, new THREE.Vector3(0, -0.03, 0), new THREE.Vector3(0, 0.34, 0), 0.025, materials.stem, geometry.slimCylinder, false);
    const layers = [
      { count: 8, length: 0.58, width: 0.25, tilt: 0.16, y: 0.3, material: materials.lotus },
      { count: 7, length: 0.45, width: 0.21, tilt: 0.47, y: 0.34, material: materials.lotus },
      { count: 5, length: 0.3, width: 0.16, tilt: 0.82, y: 0.38, material: materials.lotusInner },
    ];
    layers.forEach((layer, layerIndex) => {
      for (let i = 0; i < layer.count; i += 1) {
        const angle = (i / layer.count) * TAU + layerIndex * 0.36;
        const petal = new THREE.Mesh(geometry.petal, layer.material);
        petal.position.set(Math.cos(angle) * 0.025, layer.y, Math.sin(angle) * 0.025);
        petal.quaternion.copy(petalQuaternion(angle, layer.tilt));
        petal.scale.set(layer.length, layer.width, layer.length);
        petal.receiveShadow = true;
        flower.add(petal);
      }
    });
    const center = new THREE.Mesh(geometry.sphere, materials.lotusCenter);
    center.position.set(0, 0.43, 0);
    center.scale.set(0.12, 0.075, 0.12);
    flower.add(center);
    flower.userData.natureType = 'lotusFlower';
    addInteractive(flower, 'lotus', '粉白荷花 · 风露清芳');
    registerFloating(flower, 0.016, rand(0.65, 0.9));
    group.add(flower);
    return flower;
  }
  [1, 5, 8, 13, 18].forEach((padIndex, index) => createLotus(lilyPads[padIndex], index));

  // 花瓣/落叶：单个动态 InstancedMesh，季节只触发一次颜色重建。
  const particleSources = [
    new THREE.Vector3(13.6, 4.1, -2.9),
    new THREE.Vector3(-12.2, 3.1, -11.1),
    new THREE.Vector3(-9.3, 4.2, 4.1),
    new THREE.Vector3(-14, 3.7, -9),
    new THREE.Vector3(15, 3.4, 8),
  ];
  const maxParticles = 110;
  const particles = Array.from({ length: maxParticles }, () => ({ x: 0, y: 0, z: 0, vx: 0, vz: 0, speed: 0, size: 0, rx: 0, ry: 0, rz: 0, spin: 0, phase: 0 }));
  const particleMesh = makeInstanced(geometry.petal, materials.petal, maxParticles, true);
  particleMesh.receiveShadow = false;
  particleMesh.renderOrder = 2;
  group.add(particleMesh);

  function resetParticle(particle, initial = false) {
    const source = pick(particleSources);
    particle.x = source.x + rand(-2.4, 2.4);
    particle.z = source.z + rand(-2.1, 2.1);
    particle.y = initial ? rand(0.2, 5.8) : source.y + rand(-0.25, 1.1);
    particle.vx = rand(-0.13, 0.13);
    particle.vz = rand(-0.1, 0.1);
    particle.speed = rand(0.18, 0.52);
    particle.size = rand(0.065, 0.14);
    particle.rx = rand(0, TAU);
    particle.ry = rand(0, TAU);
    particle.rz = rand(0, TAU);
    particle.spin = rand(0.45, 1.5);
    particle.phase = rand(0, TAU);
  }
  particles.forEach((particle) => resetParticle(particle, true));

  function particleColors() {
    let colors;
    if (weather === 'snow') colors = [0xf4f5f1, 0xdde6e5, 0xffffff];
    else if (season === 'autumn') colors = [0xcf7246, 0xb84e36, 0xe09a52, 0x9d673d];
    else if (season === 'winter') colors = [0xb49a83, 0xd1c2ac, 0x9c826c];
    else if (season === 'summer') colors = [0xf2c3cf, 0xffe3e2, 0xd9a5b7];
    else colors = [0xf2a9bd, 0xffd2d8, 0xffe5e2, 0xe6b3c5];
    for (let i = 0; i < maxParticles; i += 1) {
      tempColor.setHex(colors[i % colors.length]);
      particleMesh.setColorAt(i, tempColor);
    }
    if (particleMesh.instanceColor) particleMesh.instanceColor.needsUpdate = true;
  }

  function updateParticleCount() {
    const counts = { spring: 86, summer: 46, autumn: 110, winter: 30 };
    particleMesh.count = weather === 'snow' ? 82 : counts[season];
  }
  updateParticleCount();
  particleColors();

  // 细雨仅用 72 条线段的动态缓冲，非雨天不更新也不绘制。
  const rainDropCount = 72;
  const rainDrops = Array.from({ length: rainDropCount }, () => ({ x: rand(-17, 17), y: rand(1, 10), z: rand(-13, 13), speed: rand(5.5, 8.5) }));
  const rainPositions = new Float32Array(rainDropCount * 6);
  const rainGeometry = new THREE.BufferGeometry();
  rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3).setUsage(THREE.DynamicDrawUsage));
  const rain = new THREE.LineSegments(rainGeometry, materials.rain);
  rain.frustumCulled = false;
  rain.visible = false;
  group.add(rain);

  // 夜间流萤是无纹理低面数实例，不添加点光源。
  const fireflyCount = 18;
  const fireflies = makeInstanced(geometry.smallSphere, materials.firefly, fireflyCount, true);
  fireflies.receiveShadow = false;
  const fireflyData = Array.from({ length: fireflyCount }, () => ({
    x: rand(-15, 15),
    y: rand(0.45, 2.1),
    z: rand(-11, 12),
    phase: rand(0, TAU),
    speed: rand(0.35, 0.75),
  }));
  group.add(fireflies);

  function applySeason(nextSeason) {
    if (!SEASON_PALETTE[nextSeason] || nextSeason === season) return;
    season = nextSeason;
    updateParticleCount();
    particleColors();
  }

  function normalizeWeather(value) {
    const raw = typeof value === 'string' ? value : value && (value.type || value.name || value.condition);
    const name = String(raw || 'clear').toLowerCase();
    if (name.includes('storm')) return 'storm';
    if (name.includes('rain') || name.includes('drizzle')) return 'rain';
    if (name.includes('snow')) return 'snow';
    if (name.includes('cloud') || name.includes('overcast')) return 'cloudy';
    return 'clear';
  }

  function updatePalette(night) {
    const dim = 1 - night * 0.48;
    const weatherDim = weather === 'storm' ? 0.82 : weather === 'rain' || weather === 'cloudy' ? 0.92 : 1;
    for (const entry of roleMaterials) {
      entry.material.color.copy(colorCache[season][entry.role]).multiplyScalar(dim * weatherDim);
    }
    materials.lilyVein.color.copy(colorCache[season].lilyVein).multiplyScalar(dim * weatherDim);
    materials.lilyVein.opacity = 0.52 - night * 0.16;
    materials.petal.opacity = (season === 'winter' ? 0.6 : 0.82) * (1 - night * 0.32);
    materials.rain.opacity = weather === 'storm' ? 0.34 : 0.22;
  }

  function updateParticles(time, delta, wind) {
    const snowing = weather === 'snow';
    const fallScale = snowing ? 0.42 : season === 'autumn' ? 0.85 : 0.64;
    for (let i = 0; i < particleMesh.count; i += 1) {
      const particle = particles[i];
      particle.y -= (particle.speed + fallScale) * delta;
      particle.x += (particle.vx + wind * 0.19 + Math.sin(time * 0.8 + particle.phase) * 0.07) * delta;
      particle.z += (particle.vz + Math.cos(time * 0.64 + particle.phase) * 0.055) * delta;
      particle.rx += particle.spin * delta;
      particle.ry += particle.spin * 0.72 * delta;
      particle.rz += particle.spin * 0.43 * delta;
      if (particle.y < 0.06 || particle.x < -19 || particle.x > 19 || particle.z < -15 || particle.z > 15) {
        resetParticle(particle, false);
      }
      tempPosition.set(particle.x, particle.y, particle.z);
      tempEuler.set(particle.rx, particle.ry, particle.rz);
      tempQuaternion.setFromEuler(tempEuler);
      tempScale.set(particle.size, particle.size * (season === 'autumn' ? 0.9 : 0.68), particle.size);
      tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
      particleMesh.setMatrixAt(i, tempMatrix);
    }
    particleMesh.instanceMatrix.needsUpdate = true;
  }

  function updateRain(delta, wind) {
    const visible = weather === 'rain' || weather === 'storm';
    rain.visible = visible;
    if (!visible) return;
    const slant = 0.07 + wind * 0.045;
    for (let i = 0; i < rainDropCount; i += 1) {
      const drop = rainDrops[i];
      drop.y -= drop.speed * delta;
      drop.x += wind * delta * 0.52;
      if (drop.y < 0.1 || drop.x > 19) {
        drop.x = rand(-18, 17);
        drop.y = rand(7, 11);
        drop.z = rand(-13, 13);
      }
      const offset = i * 6;
      rainPositions[offset] = drop.x;
      rainPositions[offset + 1] = drop.y;
      rainPositions[offset + 2] = drop.z;
      rainPositions[offset + 3] = drop.x - slant;
      rainPositions[offset + 4] = drop.y - (weather === 'storm' ? 0.78 : 0.54);
      rainPositions[offset + 5] = drop.z - 0.025;
    }
    rainGeometry.attributes.position.needsUpdate = true;
  }

  function updateFireflies(time, night) {
    const visible = night > 0.04 && weather !== 'rain' && weather !== 'storm' && season !== 'winter';
    fireflies.visible = visible;
    materials.firefly.opacity = visible ? night * 0.78 : 0;
    if (!visible) return;
    for (let i = 0; i < fireflyCount; i += 1) {
      const fly = fireflyData[i];
      const phase = time * fly.speed + fly.phase;
      tempPosition.set(fly.x + Math.sin(phase) * 0.55, fly.y + Math.sin(phase * 1.7) * 0.22, fly.z + Math.cos(phase * 0.83) * 0.45);
      const pulse = 0.025 + (Math.sin(phase * 3.1) * 0.5 + 0.5) * 0.025;
      tempScale.setScalar(pulse);
      tempQuaternion.identity();
      tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
      fireflies.setMatrixAt(i, tempMatrix);
    }
    fireflies.instanceMatrix.needsUpdate = true;
  }

  function update(time = 0, delta = 0.016, state = {}) {
    const t = Number.isFinite(time) ? time : 0;
    const dt = clamp(Number.isFinite(delta) ? delta : 0.016, 0, 0.05);
    const safeState = state || {};
    const night = clamp(Number.isFinite(safeState.night) ? safeState.night : 0, 0, 1);
    const nextWeather = normalizeWeather(safeState.weather);
    if (nextWeather !== weather) {
      weather = nextWeather;
      updateParticleCount();
      particleColors();
    }
    applySeason(safeState.season || 'summer');
    updatePalette(night);

    const wind = (0.74 + Math.sin(t * 0.23) * 0.16) * (weather === 'storm' ? 1.9 : weather === 'rain' ? 1.32 : 1);
    for (const node of windNodes) {
      const primary = Math.sin(t * node.speed + node.phase) * node.amplitude * wind;
      const secondary = Math.cos(t * node.speed * 0.73 + node.phase * 1.3) * node.amplitude * 0.55 * wind;
      node.object.rotation.z = node.baseZ + primary;
      node.object.rotation.x = node.baseX + secondary;
    }
    for (const node of floatingNodes) {
      const wave = Math.sin(t * node.speed + node.phase);
      node.object.position.y = node.baseY + wave * node.amplitude;
      node.object.rotation.z = node.baseRotationZ + wave * 0.012;
    }
    const seasonBlend = 1 - Math.exp(-dt * 3.2);
    for (const entry of seasonalFoliage) {
      let target = 1;
      if (season === 'winter') target = entry.type === 'maple' ? 0.3 : entry.type === 'willow' ? 0.46 : 0.86;
      else if (season === 'autumn' && entry.type === 'maple') target = 1.08;
      else if (season === 'spring' && entry.type === 'willow') target = 1.04;
      const desired = entry.baseScale * target;
      entry.object.scale.x += (desired - entry.object.scale.x) * seasonBlend;
      entry.object.scale.y += (desired - entry.object.scale.y) * seasonBlend;
      entry.object.scale.z += (desired - entry.object.scale.z) * seasonBlend;
    }
    updateParticles(t, dt, wind);
    updateRain(dt, wind);
    updateFireflies(t, night);
  }

  // 所有静态团块与枝条已登记，集中生成实例后再初始化动态矩阵，避免首帧原点闪烁。
  finalizeStaticBatches();
  finalizeCylinderBatches();
  update(0, 0, { night: 0, season: 'summer', weather: 'clear' });

  return { group, interactives, update };
}
