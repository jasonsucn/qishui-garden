import * as THREE from 'three';

/**
 * 纯程序化江南庭院建筑。
 * 主程序负责把返回的 group 加入场景，并把射线命中的物件向上解析到
 * interactives 中的对象。door / lantern / chime 通过 userData.active 驱动。
 */
export function createArchitecture() {
  const group = new THREE.Group();
  group.name = '江南庭院 · 建筑';

  const interactives = [];
  const lanternLights = [];
  const doors = [];
  const lanterns = [];
  const chimes = [];
  const batches = new Map();
  const TAU = Math.PI * 2;
  const clamp = THREE.MathUtils.clamp;

  let randomState = 0x6d2b79f5;
  function random() {
    randomState |= 0;
    randomState = (randomState + 0x6d2b79f5) | 0;
    let t = randomState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function canvasTexture(width, height, paint) {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return null;
    paint(context, width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
  }

  const woodTexture = canvasTexture(256, 256, (ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    gradient.addColorStop(0, '#62402e');
    gradient.addColorStop(0.45, '#80563b');
    gradient.addColorStop(1, '#5b3929');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 95; i++) {
      const x = random() * w;
      const sway = 2 + random() * 8;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      for (let y = 0; y <= h; y += 12) {
        ctx.lineTo(x + Math.sin(y * 0.055 + i) * sway, y);
      }
      ctx.strokeStyle = `rgba(${random() > 0.45 ? '35,17,10' : '225,178,118'},${0.025 + random() * 0.08})`;
      ctx.lineWidth = 0.5 + random() * 1.2;
      ctx.stroke();
    }
    for (let i = 0; i < 7; i++) {
      const x = random() * w;
      const y = random() * h;
      ctx.strokeStyle = 'rgba(40,20,12,.16)';
      ctx.beginPath();
      ctx.ellipse(x, y, 3 + random() * 5, 12 + random() * 15, 0, 0, TAU);
      ctx.stroke();
    }
  });
  if (woodTexture) {
    woodTexture.wrapS = woodTexture.wrapT = THREE.RepeatWrapping;
    woodTexture.repeat.set(1, 2);
  }

  const lanternTexture = canvasTexture(512, 256, (ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#7f160f');
    gradient.addColorStop(0.22, '#d34a28');
    gradient.addColorStop(0.52, '#e65b30');
    gradient.addColorStop(0.82, '#c53a20');
    gradient.addColorStop(1, '#74130e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) {
      const x = (i / 16) * w;
      ctx.fillStyle = 'rgba(255,195,93,.34)';
      ctx.fillRect(x, 0, 2, h);
      ctx.fillStyle = 'rgba(67,5,3,.24)';
      ctx.fillRect(x + 3, 0, 2, h);
    }
    ctx.fillStyle = 'rgba(255,202,104,.55)';
    ctx.fillRect(0, 8, w, 5);
    ctx.fillRect(0, h - 13, w, 5);
    ctx.strokeStyle = 'rgba(255,215,132,.34)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
  });
  if (lanternTexture) lanternTexture.wrapS = THREE.RepeatWrapping;

  const materials = {
    wall: new THREE.MeshStandardMaterial({ color: 0xe9e5da, roughness: 0.94 }),
    wallAged: new THREE.MeshStandardMaterial({ color: 0xc9c7bc, roughness: 1 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x76503a, map: woodTexture, roughness: 0.72 }),
    woodDark: new THREE.MeshStandardMaterial({ color: 0x3d251d, map: woodTexture, roughness: 0.78 }),
    woodLight: new THREE.MeshStandardMaterial({ color: 0x936448, map: woodTexture, roughness: 0.68 }),
    woodUnderside: new THREE.MeshStandardMaterial({ color: 0x39271f, map: woodTexture, roughness: 0.86, side: THREE.DoubleSide }),
    tile: new THREE.MeshStandardMaterial({ color: 0x394148, roughness: 0.79, metalness: 0.04, side: THREE.DoubleSide }),
    roofBase: new THREE.MeshStandardMaterial({ color: 0x252d33, roughness: 0.92, side: THREE.DoubleSide }),
    ridge: new THREE.MeshStandardMaterial({ color: 0x30383e, roughness: 0.77 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x92938d, roughness: 0.96 }),
    stoneDark: new THREE.MeshStandardMaterial({ color: 0x626762, roughness: 0.98 }),
    stoneLight: new THREE.MeshStandardMaterial({ color: 0xb0aea3, roughness: 0.96 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc79a50, metalness: 0.65, roughness: 0.35 }),
    ceramic: new THREE.MeshStandardMaterial({ color: 0xb9c7bc, roughness: 0.3, metalness: 0.03 }),
    tea: new THREE.MeshStandardMaterial({ color: 0x3b2112, roughness: 0.25 }),
    cushion: new THREE.MeshStandardMaterial({ color: 0x52666a, roughness: 0.96 }),
    cord: new THREE.MeshStandardMaterial({ color: 0x39241b, roughness: 0.9 }),
  };

  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const columnGeometry = new THREE.CylinderGeometry(1, 1, 1, 14);
  const fineCylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 10);
  const handleGeometry = new THREE.TorusGeometry(0.072, 0.012, 6, 18);
  const gateRingGeometry = new THREE.TorusGeometry(1.35, 0.075, 9, 72);
  const stoneCapGeometry = new THREE.ConeGeometry(0.55, 0.3, 4, 1);
  const stoneGlowGeometry = new THREE.BoxGeometry(0.38, 0.43, 0.38);
  const cupGeometry = new THREE.CylinderGeometry(0.057, 0.043, 0.08, 12);
  const teaSurfaceGeometry = new THREE.CylinderGeometry(0.047, 0.047, 0.006, 12);
  const slabGeometry = new THREE.CylinderGeometry(1, 1, 0.12, 7);

  function createTileGeometry() {
    const positions = [];
    const uvs = [];
    const indices = [];
    const crossSegments = 8;
    const lengthSegments = 2;
    for (let j = 0; j <= lengthSegments; j++) {
      const v = j / lengthSegments;
      for (let i = 0; i <= crossSegments; i++) {
        const u = i / crossSegments;
        const angle = -Math.PI / 2 + u * Math.PI;
        positions.push(Math.sin(angle) * 0.11, (v - 0.5) * 0.5, Math.cos(angle) * 0.058);
        uvs.push(u, v);
      }
    }
    const stride = crossSegments + 1;
    for (let j = 0; j < lengthSegments; j++) {
      for (let i = 0; i < crossSegments; i++) {
        const a = j * stride + i;
        const b = a + 1;
        const d = a + stride;
        const c = d + 1;
        indices.push(a, d, b, b, d, c);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }
  const tileGeometry = createTileGeometry();

  const ridgeCurlGeometry = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.22, 0.1, 0),
      new THREE.Vector3(0.33, 0.32, 0),
      new THREE.Vector3(0.29, 0.55, 0),
      new THREE.Vector3(0.12, 0.7, 0),
    ]),
    18,
    0.065,
    7,
    false,
  );

  function combineGeometries(sources) {
    const positions = [];
    const normals = [];
    const uvs = [];
    for (const source of sources) {
      const geometry = source.index ? source.toNonIndexed() : source;
      const p = geometry.getAttribute('position');
      const n = geometry.getAttribute('normal');
      const uv = geometry.getAttribute('uv');
      for (let i = 0; i < p.count; i++) {
        positions.push(p.getX(i), p.getY(i), p.getZ(i));
        normals.push(n.getX(i), n.getY(i), n.getZ(i));
        if (uv) uvs.push(uv.getX(i), uv.getY(i));
        else uvs.push(0, 0);
      }
      if (geometry !== source) geometry.dispose();
    }
    const result = new THREE.BufferGeometry();
    result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    result.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    result.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    result.computeBoundingSphere();
    return result;
  }

  function transformed(geometry, x, y, z, rx = 0, ry = 0, rz = 0) {
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(1, 1, 1),
    );
    geometry.applyMatrix4(matrix);
    return geometry;
  }

  const lanternBodyGeometry = new THREE.LatheGeometry([
    new THREE.Vector2(0.13, -0.43),
    new THREE.Vector2(0.24, -0.35),
    new THREE.Vector2(0.31, -0.18),
    new THREE.Vector2(0.33, 0),
    new THREE.Vector2(0.30, 0.2),
    new THREE.Vector2(0.23, 0.36),
    new THREE.Vector2(0.13, 0.43),
  ], 24);
  const lanternFixtureGeometry = combineGeometries([
    transformed(new THREE.CylinderGeometry(0.18, 0.18, 0.065, 16), 0, 0.445, 0),
    transformed(new THREE.CylinderGeometry(0.18, 0.18, 0.065, 16), 0, -0.445, 0),
    transformed(new THREE.CylinderGeometry(0.018, 0.018, 0.38, 7), 0, 0.66, 0),
    transformed(new THREE.CylinderGeometry(0.018, 0.018, 0.38, 7), 0, -0.67, 0),
    transformed(new THREE.ConeGeometry(0.065, 0.18, 9), 0, -0.93, 0),
    transformed(new THREE.SphereGeometry(0.055, 10, 7), 0, 0.51, 0),
  ]);

  const teaPotGeometry = combineGeometries([
    new THREE.LatheGeometry([
      new THREE.Vector2(0.07, 0),
      new THREE.Vector2(0.12, 0.025),
      new THREE.Vector2(0.155, 0.105),
      new THREE.Vector2(0.13, 0.19),
      new THREE.Vector2(0.075, 0.22),
    ], 20),
    transformed(new THREE.CylinderGeometry(0.082, 0.09, 0.025, 16), 0, 0.225, 0),
    transformed(new THREE.SphereGeometry(0.025, 10, 7), 0, 0.255, 0),
    transformed(new THREE.CylinderGeometry(0.024, 0.052, 0.22, 10), -0.17, 0.145, 0, 0, 0, Math.PI / 3),
    transformed(new THREE.TorusGeometry(0.09, 0.018, 7, 18), 0.155, 0.125, 0),
  ]);

  const vaseGeometry = new THREE.LatheGeometry([
    new THREE.Vector2(0.09, 0),
    new THREE.Vector2(0.15, 0.04),
    new THREE.Vector2(0.19, 0.22),
    new THREE.Vector2(0.13, 0.38),
    new THREE.Vector2(0.075, 0.46),
    new THREE.Vector2(0.08, 0.51),
  ], 20);

  function queueMatrix(parent, geometry, material, matrix, color = null, castShadow = true, receiveShadow = true) {
    let parentBatches = batches.get(parent);
    if (!parentBatches) {
      parentBatches = new Map();
      batches.set(parent, parentBatches);
    }
    const key = `${geometry.uuid}:${material.uuid}:${castShadow ? 1 : 0}:${receiveShadow ? 1 : 0}`;
    let batch = parentBatches.get(key);
    if (!batch) {
      batch = { geometry, material, castShadow, receiveShadow, matrices: [], colors: [], hasColors: false };
      parentBatches.set(key, batch);
    }
    batch.matrices.push(matrix);
    batch.colors.push(color);
    if (color) batch.hasColors = true;
  }

  function place(parent, geometry, material, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0, frame = null, color = null, castShadow = true, receiveShadow = true) {
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(sx, sy, sz),
    );
    if (frame) matrix.premultiply(frame);
    queueMatrix(parent, geometry, material, matrix, color, castShadow, receiveShadow);
  }

  function box(parent, material, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, frame = null, color = null) {
    place(parent, unitBox, material, x, y, z, sx, sy, sz, rx, ry, rz, frame, color);
  }

  function cylinder(parent, material, x, y, z, radius, height, rx = 0, ry = 0, rz = 0, frame = null, geometry = columnGeometry) {
    place(parent, geometry, material, x, y, z, radius, height, radius, rx, ry, rz, frame);
  }

  function frameOf(x, y, z, ry = 0) {
    return new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)),
      new THREE.Vector3(1, 1, 1),
    );
  }

  function directMesh(parent, geometry, material, name = '') {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function markInteractive(object, interaction, label, active, extra = {}) {
    object.userData.interaction = interaction;
    object.userData.label = label;
    Object.assign(object.userData, extra);
    if (active !== undefined) {
      object.userData.active = active;
      object.userData.toggle = () => {
        object.userData.active = !object.userData.active;
        return object.userData.active;
      };
    }
    interactives.push(object);
  }

  function flushBatches() {
    const white = new THREE.Color(1, 1, 1);
    for (const [parent, parentBatches] of batches) {
      for (const batch of parentBatches.values()) {
        const count = batch.matrices.length;
        if (!count) continue;
        const mesh = new THREE.InstancedMesh(batch.geometry, batch.material, count);
        mesh.name = `建筑构件 × ${count}`;
        mesh.castShadow = batch.castShadow;
        mesh.receiveShadow = batch.receiveShadow;
        mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
        for (let i = 0; i < count; i++) {
          mesh.setMatrixAt(i, batch.matrices[i]);
          if (batch.hasColors) mesh.setColorAt(i, batch.colors[i] || white);
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
        parent.add(mesh);
        batch.matrices.length = 0;
        batch.colors.length = 0;
      }
    }
    batches.clear();
  }

  function appendPatch(data, nu, nv, point, flip = false) {
    const offset = data.positions.length / 3;
    for (let j = 0; j <= nv; j++) {
      for (let i = 0; i <= nu; i++) {
        const p = point(i / nu, j / nv);
        data.positions.push(p.x, p.y, p.z);
        data.uvs.push(i / nu, j / nv);
      }
    }
    const stride = nu + 1;
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const a = offset + j * stride + i;
        const b = a + 1;
        const d = a + stride;
        const c = d + 1;
        if (flip) data.indices.push(a, d, b, b, d, c);
        else data.indices.push(a, b, d, b, c, d);
      }
    }
  }

  function surfaceFromPatches(data) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));
    geometry.setIndex(data.indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  function queueSurfaceTile(parent, center, start, end, acrossHint, widthScale = 1) {
    const down = end.clone().sub(start);
    const length = down.length();
    if (length < 0.001) return;
    down.normalize();
    const normal = new THREE.Vector3().crossVectors(acrossHint, down);
    if (normal.lengthSq() < 0.00001) return;
    normal.normalize();
    if (normal.y < 0) normal.negate();
    const across = new THREE.Vector3().crossVectors(down, normal).normalize();
    const position = center.clone().addScaledVector(normal, 0.035);
    const matrix = new THREE.Matrix4().makeBasis(across, down, normal);
    matrix.scale(new THREE.Vector3(widthScale, (length * 1.13) / 0.5, 1));
    matrix.setPosition(position);
    const shade = 0.86 + random() * 0.14;
    queueMatrix(parent, tileGeometry, materials.tile, matrix, new THREE.Color(shade, shade, Math.min(1, shade * 1.025)));
  }

  function roofHeight(x, t, p) {
    const edge = Math.abs(x) / (p.width / 2);
    return p.eave
      + (p.ridge - p.eave) * Math.pow(Math.max(0, 1 - t), 1.58)
      + p.upturn * Math.pow(t, 7)
      + p.corner * Math.pow(edge, 7) * Math.pow(t, 4);
  }

  function createGableRoof(parent, options) {
    const p = {
      upturn: 0.18,
      corner: 0.28,
      tileSpacing: 0.23,
      rowLength: 0.43,
      under: true,
      beams: true,
      ornate: false,
      ornamentScale: 1,
      ...options,
    };
    const data = { positions: [], uvs: [], indices: [] };
    const segmentsX = Math.min(40, Math.max(12, Math.ceil(p.width / 0.55)));
    const segmentsSlope = 12;
    for (const side of [-1, 1]) {
      appendPatch(
        data,
        segmentsX,
        segmentsSlope,
        (u, t) => {
          const x = (u - 0.5) * p.width;
          return new THREE.Vector3(x, roofHeight(x, t, p), side * p.halfDepth * t);
        },
        side === 1,
      );
    }
    const geometry = surfaceFromPatches(data);
    const shell = directMesh(parent, geometry, materials.roofBase, '曲面筒瓦屋面');
    shell.castShadow = true;
    if (p.under) {
      const underside = directMesh(parent, geometry, materials.woodUnderside, '木望板');
      underside.position.y = -0.105;
      underside.castShadow = false;
    }

    const columns = Math.max(4, Math.round(p.width / p.tileSpacing));
    const spacing = p.width / columns;
    const rows = Math.max(2, Math.ceil(p.halfDepth / p.rowLength));
    for (const side of [-1, 1]) {
      for (let row = 0; row < rows; row++) {
        const t0 = row / rows;
        const t1 = (row + 1) / rows;
        const tc = (t0 + t1) / 2;
        for (let column = 0; column < columns; column++) {
          const x = -p.width / 2 + (column + 0.5) * spacing;
          const pointAt = (t) => new THREE.Vector3(x, roofHeight(x, t, p), side * p.halfDepth * t);
          queueSurfaceTile(
            parent,
            pointAt(tc),
            pointAt(t0),
            pointAt(t1),
            new THREE.Vector3(1, 0, 0),
            Math.min(1.12, spacing / 0.22),
          );
        }
      }
    }

    box(parent, materials.ridge, 0, p.ridge + 0.035, 0, p.width + 0.06, 0.17, 0.22);
    const capCount = Math.max(3, Math.ceil(p.width / 0.4));
    const capSpacing = p.width / capCount;
    for (let i = 0; i < capCount; i++) {
      const matrix = new THREE.Matrix4().makeBasis(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, 1, 0),
      );
      matrix.scale(new THREE.Vector3(1.18, (capSpacing * 1.1) / 0.5, 1.25));
      matrix.setPosition(-p.width / 2 + (i + 0.5) * capSpacing, p.ridge + 0.145, 0);
      queueMatrix(parent, tileGeometry, materials.ridge, matrix);
    }

    if (p.ornate) {
      for (const side of [-1, 1]) {
        place(
          parent,
          ridgeCurlGeometry,
          materials.ridge,
          side * (p.width / 2 - 0.08),
          p.ridge + 0.12,
          0,
          p.ornamentScale,
          p.ornamentScale,
          p.ornamentScale,
          0,
          side < 0 ? Math.PI : 0,
        );
      }
    }

    if (p.beams) {
      for (const side of [-1, 1]) {
        box(parent, materials.woodDark, 0, p.eave - 0.04, side * (p.halfDepth - 0.13), p.width - 0.32, 0.15, 0.16);
        const rafters = Math.floor(p.width / 0.58);
        for (let i = 0; i <= rafters; i++) {
          const x = -p.width / 2 + 0.2 + (i / rafters) * (p.width - 0.4);
          box(parent, materials.wood, x, p.eave - 0.11, side * (p.halfDepth - 0.35), 0.075, 0.09, 0.52);
        }
      }
    }
    return p;
  }

  function createHipRoof(parent, options) {
    const p = {
      upturn: 0.17,
      corner: 0.43,
      tileSpacing: 0.23,
      rows: 11,
      ...options,
    };
    function point(side, u, t) {
      const x = u * p.halfSize * t;
      const z = p.halfSize * t;
      const y = p.eave
        + (p.apex - p.eave) * Math.pow(Math.max(0, 1 - t), 1.52)
        + p.upturn * Math.pow(t, 7)
        + p.corner * Math.pow(Math.abs(u), 6) * Math.pow(t, 4);
      const angle = side * Math.PI / 2;
      return new THREE.Vector3(
        Math.cos(angle) * x + Math.sin(angle) * z,
        y,
        -Math.sin(angle) * x + Math.cos(angle) * z,
      );
    }

    const data = { positions: [], uvs: [], indices: [] };
    for (let side = 0; side < 4; side++) {
      appendPatch(data, 16, 14, (u, t) => point(side, u * 2 - 1, t), true);
    }
    const geometry = surfaceFromPatches(data);
    directMesh(parent, geometry, materials.roofBase, '四坡攒尖屋面');
    const underside = directMesh(parent, geometry, materials.woodUnderside, '茶亭木望板');
    underside.position.y = -0.1;
    underside.castShadow = false;

    for (let side = 0; side < 4; side++) {
      for (let row = 0; row < p.rows; row++) {
        const t0 = row / p.rows;
        const t1 = (row + 1) / p.rows;
        const tc = (t0 + t1) / 2;
        const count = Math.max(1, Math.round((2 * p.halfSize * tc) / p.tileSpacing));
        for (let column = 0; column < count; column++) {
          const u = -1 + ((column + 0.5) / count) * 2;
          const across = point(side, Math.min(1, u + 0.01), tc).sub(point(side, Math.max(-1, u - 0.01), tc));
          queueSurfaceTile(
            parent,
            point(side, u, tc),
            point(side, u, t0),
            point(side, u, t1),
            across,
            Math.min(1.12, ((2 * p.halfSize * tc) / count / 0.22) * 1.06),
          );
        }
      }
    }

    const hipPoints = [];
    for (let i = 0; i <= 10; i++) hipPoints.push(point(0, 1, i / 10));
    const hipGeometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hipPoints), 24, 0.067, 7, false);
    for (let side = 0; side < 4; side++) {
      place(parent, hipGeometry, materials.ridge, 0, 0.025, 0, 1, 1, 1, 0, side * Math.PI / 2);
    }

    for (const side of [-1, 1]) {
      box(parent, materials.woodDark, 0, p.eave - 0.035, side * (p.halfSize - 0.15), p.halfSize * 2 - 0.35, 0.15, 0.16);
      box(parent, materials.woodDark, side * (p.halfSize - 0.15), p.eave - 0.035, 0, 0.16, 0.15, p.halfSize * 2 - 0.35);
    }
    cylinder(parent, materials.ridge, 0, p.apex + 0.08, 0, 0.19, 0.16);
    place(parent, new THREE.SphereGeometry(0.15, 12, 8), materials.ridge, 0, p.apex + 0.24, 0);
    place(parent, new THREE.ConeGeometry(0.12, 0.42, 10), materials.ridge, 0, p.apex + 0.49, 0);
    place(parent, new THREE.SphereGeometry(0.055, 10, 7), materials.brass, 0, p.apex + 0.72, 0);
  }

  function bracketSet(parent, x, y, z, scale = 1) {
    const s = scale;
    box(parent, materials.woodLight, x, y, z, 0.34 * s, 0.13 * s, 0.34 * s);
    box(parent, materials.woodDark, x, y + 0.11 * s, z, 0.61 * s, 0.1 * s, 0.19 * s);
    box(parent, materials.woodDark, x, y + 0.11 * s, z, 0.19 * s, 0.1 * s, 0.61 * s);
    box(parent, materials.woodLight, x, y + 0.22 * s, z, 0.84 * s, 0.1 * s, 0.17 * s);
    box(parent, materials.woodLight, x, y + 0.22 * s, z, 0.17 * s, 0.1 * s, 0.84 * s);
    for (const side of [-1, 1]) {
      box(parent, materials.wood, x + side * 0.28 * s, y + 0.29 * s, z, 0.4 * s, 0.09 * s, 0.13 * s, 0, 0, side * 0.3);
      box(parent, materials.wood, x, y + 0.29 * s, z + side * 0.28 * s, 0.13 * s, 0.09 * s, 0.4 * s, -side * 0.3);
    }
  }

  function column(parent, x, z, floor, top, radius = 0.14, bracketScale = 1) {
    box(parent, materials.stoneDark, x, floor + 0.05, z, radius * 3.6, 0.1, radius * 3.6);
    cylinder(parent, materials.stone, x, floor + 0.15, z, radius * 1.75, 0.16);
    const bottom = floor + 0.2;
    cylinder(parent, materials.woodDark, x, (bottom + top) / 2, z, radius, top - bottom);
    cylinder(parent, materials.brass, x, bottom + 0.055, z, radius * 1.035, 0.035, 0, 0, 0, null, fineCylinderGeometry);
    bracketSet(parent, x, top - 0.03, z, bracketScale);
  }

  function latticePanel(parent, x, y, z, width, height, ry = 0, solidLower = 0.68, ornate = true) {
    const frame = frameOf(x, y, z, ry);
    const side = 0.075;
    box(parent, materials.woodDark, -width / 2, 0, 0, side, height + side, 0.1, 0, 0, 0, frame);
    box(parent, materials.woodDark, width / 2, 0, 0, side, height + side, 0.1, 0, 0, 0, frame);
    box(parent, materials.woodDark, 0, -height / 2, 0, width, side, 0.1, 0, 0, 0, frame);
    box(parent, materials.woodDark, 0, height / 2, 0, width, side, 0.1, 0, 0, 0, frame);

    const lowerTop = -height / 2 + solidLower;
    if (solidLower > 0.02) {
      box(parent, materials.wood, 0, -height / 2 + solidLower / 2, 0, width - 0.08, solidLower - 0.035, 0.075, 0, 0, 0, frame);
      box(parent, materials.woodLight, 0, -height / 2 + solidLower / 2, 0.045, width - 0.25, Math.max(0.05, solidLower - 0.2), 0.025, 0, 0, 0, frame);
    }
    const upperHeight = height - solidLower;
    const upperCenter = lowerTop + upperHeight / 2;
    box(parent, materials.woodDark, 0, lowerTop, 0, width, 0.075, 0.11, 0, 0, 0, frame);
    const verticals = Math.max(2, Math.round(width / 0.28));
    for (let i = 1; i < verticals; i++) {
      const px = -width / 2 + (i / verticals) * width;
      box(parent, materials.woodLight, px, upperCenter, 0, 0.037, upperHeight, 0.052, 0, 0, 0, frame);
    }
    const horizontals = Math.max(2, Math.round(upperHeight / 0.3));
    for (let i = 1; i < horizontals; i++) {
      const py = lowerTop + (i / horizontals) * upperHeight;
      box(parent, materials.woodLight, 0, py, 0, width, 0.038, 0.052, 0, 0, 0, frame);
    }
    if (ornate && upperHeight > 0.65 && width > 0.7) {
      for (const sx of [-1, 1]) {
        const px = sx * (width / 2 - 0.19);
        box(parent, materials.woodLight, px, height / 2 - 0.2, 0.012, 0.035, 0.43, 0.055, 0, 0, sx * 0.72, frame);
        box(parent, materials.woodLight, px, height / 2 - 0.2, 0.012, 0.035, 0.43, 0.055, 0, 0, -sx * 0.72, frame);
      }
    }
  }

  function railing(parent, x1, z1, x2, z2, floor, height = 0.72, material = materials.woodDark) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.hypot(dx, dz);
    if (length < 0.05) return;
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;
    const angle = -Math.atan2(dz, dx);
    box(parent, material, cx, floor + height, cz, length + 0.1, 0.105, 0.105, 0, angle);
    box(parent, material, cx, floor + 0.22, cz, length, 0.075, 0.075, 0, angle);
    const count = Math.max(2, Math.ceil(length / 0.42));
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const x = x1 + dx * t;
      const z = z1 + dz * t;
      const thick = i === 0 || i === count ? 0.105 : 0.052;
      box(parent, material, x, floor + height / 2, z, thick, height, thick);
      if (i > 0 && i < count && i % 2 === 0) {
        box(parent, materials.woodLight, x, floor + height * 0.62, z, 0.085, 0.085, 0.085, 0, angle, Math.PI / 4);
      }
    }
  }

  function makePlaque(parent, text, subtitle, x, y, z, width, height, label, poem, ry = 0) {
    const plaque = new THREE.Group();
    plaque.name = label;
    plaque.position.set(x, y, z);
    plaque.rotation.y = ry;
    parent.add(plaque);
    box(plaque, materials.woodDark, 0, 0, 0, width + 0.16, height + 0.14, 0.12);
    box(plaque, materials.brass, 0, height / 2 + 0.045, 0.067, width + 0.1, 0.025, 0.025);
    box(plaque, materials.brass, 0, -height / 2 - 0.045, 0.067, width + 0.1, 0.025, 0.025);
    box(plaque, materials.brass, -width / 2 - 0.045, 0, 0.067, 0.025, height + 0.1, 0.025);
    box(plaque, materials.brass, width / 2 + 0.045, 0, 0.067, 0.025, height + 0.1, 0.025);

    const canvasHeight = Math.max(192, Math.min(512, Math.round((1024 * height) / width)));
    const texture = canvasTexture(1024, canvasHeight, (ctx, w, h) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, '#34241c');
      gradient.addColorStop(0.5, '#171b18');
      gradient.addColorStop(1, '#302117');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#b88b45';
      ctx.lineWidth = Math.max(3, h * 0.018);
      ctx.strokeRect(h * 0.055, h * 0.055, w - h * 0.11, h - h * 0.11);
      ctx.fillStyle = '#e2bd72';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `600 ${Math.round(h * (subtitle ? 0.43 : 0.53))}px STKaiti, KaiTi, "Noto Serif CJK SC", serif`;
      ctx.fillText(text, w / 2, subtitle ? h * 0.41 : h * 0.51, w * 0.88);
      if (subtitle) {
        ctx.fillStyle = '#bda77b';
        ctx.font = `${Math.round(h * 0.15)}px STKaiti, KaiTi, serif`;
        ctx.fillText(subtitle, w / 2, h * 0.76, w * 0.82);
      }
    });
    const material = new THREE.MeshBasicMaterial({ map: texture, color: texture ? 0xffffff : 0x34251b, toneMapped: false });
    const face = directMesh(plaque, new THREE.PlaneGeometry(width, height), material, '匾额字面');
    face.position.z = 0.066;
    face.castShadow = false;
    face.receiveShadow = false;
    markInteractive(plaque, 'plaque', label, undefined, { poem, message: poem, description: poem });
    return plaque;
  }

  function makeScroll(parent, x, y, z) {
    const texture = canvasTexture(384, 896, (ctx, w, h) => {
      ctx.fillStyle = '#ddd5bc';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#6b7a68';
      ctx.fillRect(0, 0, w, 44);
      ctx.fillRect(0, h - 44, w, 44);
      ctx.strokeStyle = 'rgba(80,62,39,.25)';
      ctx.lineWidth = 3;
      ctx.strokeRect(24, 62, w - 48, h - 124);
      ctx.fillStyle = '#30342d';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '76px STKaiti, KaiTi, serif';
      ['听', '雨', '煎', '茶'].forEach((character, i) => ctx.fillText(character, w / 2, 190 + i * 145));
      ctx.fillStyle = '#9b3c2c';
      ctx.fillRect(w - 83, h - 155, 37, 37);
    });
    const material = new THREE.MeshStandardMaterial({ map: texture, color: texture ? 0xffffff : 0xddd5bc, roughness: 0.95 });
    const scroll = directMesh(parent, new THREE.PlaneGeometry(0.95, 2.15), material, '听雨煎茶挂轴');
    scroll.position.set(x, y, z);
    scroll.castShadow = false;
    cylinder(parent, materials.woodDark, x, y + 1.11, z + 0.015, 0.035, 1.1, 0, 0, Math.PI / 2);
    cylinder(parent, materials.woodDark, x, y - 1.11, z + 0.015, 0.035, 1.1, 0, 0, Math.PI / 2);
  }

  function makeTeaSetting(parent, x, y, z, scale, label, poem) {
    const teaGroup = new THREE.Group();
    teaGroup.name = label;
    teaGroup.position.set(x, y, z);
    teaGroup.scale.setScalar(scale);
    parent.add(teaGroup);

    box(teaGroup, materials.woodLight, 0, 0.61, 0, 1.85, 0.11, 0.9);
    box(teaGroup, materials.woodDark, 0, 0.5, 0, 1.58, 0.12, 0.68);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        box(teaGroup, materials.woodDark, sx * 0.72, 0.29, sz * 0.29, 0.11, 0.55, 0.11);
      }
    }
    box(teaGroup, materials.woodDark, 0, 0.19, 0, 1.48, 0.07, 0.07);
    box(teaGroup, materials.woodDark, 0, 0.68, 0, 0.92, 0.035, 0.54);

    const stools = [
      [-1.18, 0], [1.18, 0], [0, -0.82], [0, 0.82],
    ];
    for (const [sx, sz] of stools) {
      cylinder(teaGroup, materials.woodDark, sx, 0.19, sz, 0.23, 0.34);
      cylinder(teaGroup, materials.cushion, sx, 0.385, sz, 0.255, 0.065);
      cylinder(teaGroup, materials.brass, sx, 0.35, sz, 0.238, 0.025);
    }

    const pot = directMesh(teaGroup, teaPotGeometry, materials.ceramic, '青瓷茶壶');
    pot.position.set(0, 0.704, 0);
    const cupPositions = [[-0.34, -0.16], [0.34, -0.16], [-0.34, 0.16], [0.34, 0.16]];
    for (const [cx, cz] of cupPositions) {
      place(teaGroup, cupGeometry, materials.ceramic, cx, 0.735, cz);
      place(teaGroup, teaSurfaceGeometry, materials.tea, cx, 0.778, cz);
    }
    markInteractive(teaGroup, 'tea', label, undefined, { poem, message: poem, description: poem });
    return teaGroup;
  }

  function makeChime(parent, x, y, z) {
    const pivot = new THREE.Group();
    pivot.name = '檐角风铃';
    pivot.position.set(x, y, z);
    parent.add(pivot);
    cylinder(pivot, materials.cord, 0, -0.16, 0, 0.009, 0.32, 0, 0, 0, null, fineCylinderGeometry);
    cylinder(pivot, materials.brass, 0, -0.34, 0, 0.14, 0.045);
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * TAU;
      const px = Math.cos(angle) * 0.1;
      const pz = Math.sin(angle) * 0.1;
      const length = 0.32 + (i % 3) * 0.07;
      cylinder(pivot, materials.cord, px, -0.43, pz, 0.005, 0.18, 0, 0, 0, null, fineCylinderGeometry);
      cylinder(pivot, materials.brass, px, -0.52 - length / 2, pz, 0.025, length, 0, 0, 0, null, fineCylinderGeometry);
    }
    cylinder(pivot, materials.cord, 0, -0.69, 0, 0.006, 0.62, 0, 0, 0, null, fineCylinderGeometry);
    place(pivot, new THREE.SphereGeometry(0.055, 10, 7), materials.brass, 0, -0.72, 0);
    box(pivot, materials.woodLight, 0, -1.04, 0, 0.13, 0.19, 0.025, 0, 0, 0.12);
    markInteractive(pivot, 'chime', '檐角风铃 · 清风入韵', false, {
      poem: '檐马叮咚惊宿雨，一帘幽梦入江南。',
      message: '点击即可为风铃添一阵清风，随后便随园内风力渐渐摆荡。',
    });
    chimes.push({ pivot, angle: 0, velocity: 0, phase: random() * TAU, lastActive: false });
  }

  function makeHangingLantern(parent, x, y, z, scale, withLight, label, intensity = 11) {
    const lantern = new THREE.Group();
    lantern.name = label;
    lantern.position.set(x, y, z);
    lantern.scale.setScalar(scale);
    parent.add(lantern);

    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: lanternTexture,
      emissive: 0xff8a43,
      emissiveMap: lanternTexture,
      emissiveIntensity: 0.18,
      roughness: 0.66,
    });
    const body = directMesh(lantern, lanternBodyGeometry, material, '朱红纱灯');
    body.castShadow = false;
    const fixture = directMesh(lantern, lanternFixtureGeometry, materials.brass, '灯盖与流苏');
    fixture.castShadow = false;

    let light = null;
    if (withLight) {
      light = new THREE.PointLight(0xffa45c, 0, 7.5, 2);
      light.name = `${label} · 暖光`;
      light.position.set(0, -0.05, 0);
      light.castShadow = false;
      light.userData.lantern = lantern;
      light.userData.baseIntensity = intensity;
      lantern.add(light);
      lanternLights.push(light);
    }
    markInteractive(lantern, 'lantern', label, true, {
      message: '点击可熄灭或点亮这盏灯；暖光会随夜色渐亮。',
    });
    lanterns.push({
      group: lantern,
      material,
      light,
      intensity,
      level: 1,
      phase: random() * TAU,
      sway: true,
    });
    return lantern;
  }

  function makeStoneLantern(parent, x, z, withLight, label) {
    const lantern = new THREE.Group();
    lantern.name = label;
    lantern.position.set(x, 0, z);
    parent.add(lantern);
    box(lantern, materials.stoneDark, 0, 0.1, 0, 0.72, 0.2, 0.72);
    box(lantern, materials.stone, 0, 0.25, 0, 0.52, 0.12, 0.52);
    cylinder(lantern, materials.stone, 0, 0.67, 0, 0.16, 0.76);
    cylinder(lantern, materials.stoneLight, 0, 0.4, 0, 0.22, 0.1);
    box(lantern, materials.stoneDark, 0, 1.07, 0, 0.56, 0.12, 0.56);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        box(lantern, materials.stone, sx * 0.225, 1.34, sz * 0.225, 0.07, 0.48, 0.07);
      }
    }
    const material = new THREE.MeshStandardMaterial({
      color: 0xffd6a0,
      emissive: 0xff8738,
      emissiveIntensity: 0.15,
      roughness: 0.72,
    });
    const body = directMesh(lantern, stoneGlowGeometry, material, '石灯暖芯');
    body.position.y = 1.33;
    body.castShadow = false;
    place(lantern, stoneCapGeometry, materials.stoneDark, 0, 1.72, 0, 1, 1, 1, 0, Math.PI / 4);
    box(lantern, materials.stone, 0, 1.56, 0, 0.66, 0.09, 0.66);
    cylinder(lantern, materials.stone, 0, 1.94, 0, 0.09, 0.2);
    place(lantern, new THREE.SphereGeometry(0.105, 10, 7), materials.stone, 0, 2.07, 0);

    let light = null;
    if (withLight) {
      light = new THREE.PointLight(0xffad68, 0, 6.5, 2);
      light.position.set(0, 1.34, 0);
      light.castShadow = false;
      light.name = `${label} · 暖光`;
      light.userData.lantern = lantern;
      light.userData.baseIntensity = 8;
      lantern.add(light);
      lanternLights.push(light);
    }
    markInteractive(lantern, 'lantern', label, true, {
      message: '点击可熄灭或点亮石灯笼。',
    });
    lanterns.push({ group: lantern, material, light, intensity: 8, level: 1, phase: random() * TAU, sway: false });
  }

  function makePlainWall(parent, x, z, length, height, rotation = 0) {
    const wall = new THREE.Group();
    wall.name = '白粉墙与瓦脊';
    wall.position.set(x, 0, z);
    wall.rotation.y = rotation;
    parent.add(wall);
    box(wall, materials.stoneDark, 0, 0.11, 0, length + 0.08, 0.22, 0.4);
    box(wall, materials.wall, 0, height / 2, 0, length, height, 0.32);
    box(wall, materials.wallAged, 0, 0.36, 0.172, length, 0.42, 0.025);
    createGableRoof(wall, {
      width: length + 0.32,
      halfDepth: 0.4,
      eave: height + 0.04,
      ridge: height + 0.34,
      upturn: 0.035,
      corner: 0.025,
      rowLength: 0.34,
      under: false,
      beams: false,
    });
    return wall;
  }

  function makeMoonWall(parent, x, z, length, rotation, title, poem) {
    const wall = new THREE.Group();
    wall.name = `${title} · 月洞门墙`;
    wall.position.set(x, 0, z);
    wall.rotation.y = rotation;
    parent.add(wall);
    const height = 3.25;
    const thickness = 0.34;
    const shape = new THREE.Shape();
    shape.moveTo(-length / 2, 0);
    shape.lineTo(length / 2, 0);
    shape.lineTo(length / 2, height);
    shape.lineTo(-length / 2, height);
    shape.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, 1.45, 1.31, 0, TAU, true);
    shape.holes.push(hole);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 64 });
    geometry.translate(0, 0, -thickness / 2);
    directMesh(wall, geometry, materials.wall, '真实镂空月洞门');
    box(wall, materials.stoneDark, 0, 0.065, 0, length, 0.13, 0.39);
    box(wall, materials.stoneLight, 0, 0.065, 0, 2.35, 0.13, 0.76);
    for (const side of [-1, 1]) {
      place(wall, gateRingGeometry, materials.stoneDark, 0, 1.45, side * 0.185);
      for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * TAU;
        box(
          wall,
          materials.stoneLight,
          Math.cos(angle) * 1.35,
          1.45 + Math.sin(angle) * 1.35,
          side * 0.235,
          0.018,
          0.115,
          0.018,
          0,
          0,
          angle - Math.PI / 2,
        );
      }
    }
    createGableRoof(wall, {
      width: length + 0.3,
      halfDepth: 0.44,
      eave: 3.31,
      ridge: 3.62,
      upturn: 0.045,
      corner: 0.05,
      rowLength: 0.34,
      under: false,
      beams: false,
    });
    makePlaque(wall, title, '', 0, 3.025, 0.245, 1.32, 0.36, `${title} · 月洞门匾`, poem);
    return wall;
  }

  function makeGableInfill(parent, x, baseY, halfSpan, roofOptions) {
    const shape = new THREE.Shape();
    shape.moveTo(-halfSpan, 0);
    shape.lineTo(halfSpan, 0);
    const samples = 18;
    for (let i = 0; i <= samples; i++) {
      const localZ = halfSpan - (i / samples) * halfSpan * 2;
      const t = Math.abs(localZ) / roofOptions.halfDepth;
      const y = roofHeight(x, t, roofOptions) - baseY - 0.12;
      shape.lineTo(localZ, Math.max(0.02, y));
    }
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: false });
    geometry.translate(0, 0, -0.08);
    place(parent, geometry, materials.wall, x, baseY, 0, 1, 1, 1, 0, Math.PI / 2);
    box(parent, materials.woodDark, x, baseY + 0.8, 0, 0.14, 1.6, 0.13);
  }

  function makeMainHall() {
    const hall = new THREE.Group();
    hall.name = '听雨堂 · 北岸主厅';
    hall.position.set(-1, 0, -10);
    group.add(hall);

    box(hall, materials.stoneDark, 0, 0.13, 0, 14.75, 0.26, 5.55);
    box(hall, materials.stoneLight, 0, 0.3, 0, 14.5, 0.16, 5.35);
    box(hall, materials.wood, 0, 0.425, 0, 13.75, 0.09, 4.55);
    for (let i = 0; i < 3; i++) {
      box(hall, materials.stone, 0, 0.3 - i * 0.1, 2.9 + i * 0.38, 4.5 + i * 0.25, 0.2, 0.46);
    }

    box(hall, materials.wall, 0, 1.95, -2.22, 13.35, 2.95, 0.18);
    box(hall, materials.woodDark, 0, 0.82, -2.105, 13.25, 0.65, 0.08);
    box(hall, materials.wood, 0, 1.18, -2.095, 13.3, 0.09, 0.1);
    for (const side of [-1, 1]) {
      box(hall, materials.wall, side * 6.65, 0.82, 0, 0.18, 0.7, 4.25);
      box(hall, materials.wall, side * 6.65, 3.29, 0, 0.18, 0.26, 4.25);
      latticePanel(hall, side * 6.65, 2.22, 0, 3.95, 1.82, Math.PI / 2, 0.12, true);
    }

    const xs = [-6.4, -3.84, -1.28, 1.28, 3.84, 6.4];
    for (const z of [-2.08, 2.08]) {
      for (const x of xs) column(hall, x, z, 0.47, 3.54, 0.145, 1);
    }
    for (const side of [-1, 1]) column(hall, side * 6.4, 0, 0.47, 3.54, 0.145, 0.9);
    for (const z of [-2.08, 2.08]) {
      box(hall, materials.woodDark, 0, 3.53, z, 13.25, 0.23, 0.22);
      box(hall, materials.woodLight, 0, 3.38, z + 0.015, 13.1, 0.065, 0.25);
    }
    for (const side of [-1, 1]) box(hall, materials.woodDark, side * 6.4, 3.52, 0, 0.22, 0.23, 4.35);

    const frontBays = [[-6.4, -3.84], [-3.84, -1.28], [1.28, 3.84], [3.84, 6.4]];
    for (const [left, right] of frontBays) {
      latticePanel(hall, (left + right) / 2, 1.85, 2.095, right - left - 0.13, 2.73, 0, 0.72, true);
    }

    const doorAssembly = new THREE.Group();
    doorAssembly.name = '听雨堂双扇格栅门';
    doorAssembly.position.set(0, 0.48, 2.16);
    hall.add(doorAssembly);
    const leafWidth = 1.245;
    const leafHeight = 2.73;
    for (const direction of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.x = direction * 1.28;
      doorAssembly.add(pivot);
      const leafDirection = -direction;
      latticePanel(pivot, leafDirection * leafWidth / 2, leafHeight / 2, 0, leafWidth, leafHeight, 0, 0.75, true);
      place(pivot, handleGeometry, materials.brass, leafDirection * (leafWidth - 0.18), 1.34, 0.09);
      const openSign = direction;
      const current = 1;
      pivot.rotation.y = openSign * current * 1.18;
      doors.push({ control: doorAssembly, pivot, openSign, angle: 1.18, current });
    }
    markInteractive(doorAssembly, 'door', '听雨堂 · 双扇格栅门', true, {
      message: '点击开合堂前格栅门。门扇透空，仍可望见室内茶席。',
    });

    railing(hall, -6.55, 2.57, -2.55, 2.57, 0.47, 0.62);
    railing(hall, 2.55, 2.57, 6.55, 2.57, 0.47, 0.62);
    makePlaque(hall, '听雨堂', '一庭烟雨半卷书', 0, 3.62, 2.39, 3.05, 0.58, '听雨堂匾额', '小楼一夜听春雨，深巷明朝卖杏花。');
    makeTeaSetting(hall, 0, 0.48, -0.12, 1.08, '听雨堂 · 山泉茶席', '寒夜客来茶当酒，竹炉汤沸火初红。');

    box(hall, materials.woodDark, 0, 0.97, -1.82, 3.25, 0.12, 0.55);
    for (const side of [-1, 1]) box(hall, materials.woodDark, side * 1.35, 0.69, -1.82, 0.12, 0.54, 0.45);
    for (const side of [-1, 1]) {
      const vase = directMesh(hall, vaseGeometry, materials.ceramic, '青瓷花器');
      vase.position.set(side * 1.15, 1.04, -1.82);
    }
    makeScroll(hall, 0, 2.32, -2.115);

    const roofOptions = {
      width: 15.55,
      halfDepth: 3.24,
      eave: 4.0,
      ridge: 5.92,
      upturn: 0.22,
      corner: 0.4,
      under: true,
      ornate: true,
      ornamentScale: 1.05,
    };
    makeGableInfill(hall, -6.65, 3.43, 2.28, roofOptions);
    makeGableInfill(hall, 6.65, 3.43, 2.28, roofOptions);
    createGableRoof(hall, roofOptions);

    makeHangingLantern(hall, -5.08, 3.02, 2.59, 0.9, true, '听雨堂 · 左纱灯', 12);
    makeHangingLantern(hall, 5.08, 3.02, 2.59, 0.9, true, '听雨堂 · 右纱灯', 12);
  }

  function makeCorridor(x, z, rotation, name, plaqueText, poem) {
    const corridor = new THREE.Group();
    corridor.name = name;
    corridor.position.set(x, 0, z);
    corridor.rotation.y = rotation;
    group.add(corridor);
    const length = 18.4;

    box(corridor, materials.stoneDark, 0, 0.1, 0, length + 0.35, 0.2, 2.62);
    box(corridor, materials.stoneLight, 0, 0.235, 0, length + 0.18, 0.09, 2.46);
    const columns = [-8.4, -5.6, -2.8, 0, 2.8, 5.6, 8.4];
    for (const px of columns) {
      column(corridor, px, -1.02, 0.28, 2.88, 0.115, 0.72);
      if (px !== 0) column(corridor, px, 1.02, 0.28, 2.88, 0.115, 0.72);
    }
    for (const side of [-1, 1]) box(corridor, materials.woodDark, 0, 2.87, side * 1.02, length - 0.45, 0.19, 0.18);
    for (let i = 0; i < columns.length - 1; i++) {
      const left = columns[i];
      const right = columns[i + 1];
      latticePanel(corridor, (left + right) / 2, 1.62, -1.03, right - left - 0.15, 2.25, 0, 0.7, i % 2 === 0);
    }
    box(corridor, materials.wall, 0, 0.66, -1.12, length - 0.5, 0.7, 0.12);
    railing(corridor, -8.75, 1.04, -1.35, 1.04, 0.28, 0.65);
    railing(corridor, 1.35, 1.04, 8.75, 1.04, 0.28, 0.65);
    railing(corridor, -1.35, -1.04, -1.35, 1.04, 0.28, 0.65);
    railing(corridor, 1.35, -1.04, 1.35, 1.04, 0.28, 0.65);

    createGableRoof(corridor, {
      width: length + 0.65,
      halfDepth: 1.72,
      eave: 3.19,
      ridge: 4.22,
      upturn: 0.15,
      corner: 0.25,
      under: true,
      ornate: false,
    });
    makePlaque(corridor, plaqueText, '', 0, 2.77, 1.18, 1.52, 0.43, `${name}匾额`, poem);
    makeHangingLantern(corridor, -5.6, 2.47, 0, 0.76, false, `${name} · 南灯`);
    makeHangingLantern(corridor, 0, 2.47, 0, 0.76, true, `${name} · 中灯`, 10);
    makeHangingLantern(corridor, 5.6, 2.47, 0, 0.76, false, `${name} · 北灯`);
    return corridor;
  }

  function makePavilion() {
    const pavilion = new THREE.Group();
    pavilion.name = '藕香榭 · 临水茶亭';
    pavilion.position.set(-10, 0, 2);
    group.add(pavilion);

    box(pavilion, materials.stoneDark, 0, 0.14, 0, 5.25, 0.28, 5.25);
    box(pavilion, materials.stoneLight, 0, 0.32, 0, 5.05, 0.1, 5.05);
    box(pavilion, materials.wood, 0, 0.405, 0, 4.75, 0.07, 4.75);
    for (let i = 0; i < 3; i++) {
      box(pavilion, materials.stone, 2.72 + i * 0.34, 0.28 - i * 0.09, 0, 0.42, 0.18, 2.1 + i * 0.2);
    }

    for (const x of [-2, 2]) {
      for (const z of [-2, 2]) column(pavilion, x, z, 0.44, 3.04, 0.14, 0.86);
    }
    for (const side of [-1, 1]) {
      box(pavilion, materials.woodDark, 0, 3.03, side * 2, 4.25, 0.2, 0.19);
      box(pavilion, materials.woodDark, side * 2, 3.03, 0, 0.19, 0.2, 4.25);
    }
    latticePanel(pavilion, -2.03, 1.82, 0, 3.65, 1.95, Math.PI / 2, 0.38, true);
    railing(pavilion, -2.08, -2.08, 2.08, -2.08, 0.44, 0.7);
    railing(pavilion, -2.08, 2.08, 2.08, 2.08, 0.44, 0.7);
    railing(pavilion, -2.08, -2.08, -2.08, 2.08, 0.44, 0.7);
    railing(pavilion, 2.08, -2.08, 2.08, -1.15, 0.44, 0.7);
    railing(pavilion, 2.08, 1.15, 2.08, 2.08, 0.44, 0.7);

    makeTeaSetting(pavilion, 0, 0.44, 0, 0.9, '藕香榭 · 临水茶席', '松风竹炉初沸雪，一曲清波一盏春。');
    makePlaque(pavilion, '藕香榭', '临水试茶', 2.13, 2.8, 0, 2.05, 0.55, '藕香榭匾额', '四面荷风三面柳，一城山色半城湖。', Math.PI / 2);
    createHipRoof(pavilion, { halfSize: 3.18, eave: 3.31, apex: 5.18, upturn: 0.18, corner: 0.46 });
    makeHangingLantern(pavilion, -1.62, 2.52, 1.58, 0.76, false, '藕香榭 · 西灯');
    makeHangingLantern(pavilion, 1.62, 2.52, 1.58, 0.76, true, '藕香榭 · 东灯', 10);
    makeChime(pavilion, 1.96, 3.18, 1.96);
  }

  function makeCoveredBridge() {
    const bridge = new THREE.Group();
    bridge.name = '卧波廊 · 池塘北缘廊桥';
    bridge.position.set(1, 0, -3.35);
    group.add(bridge);
    const length = 8.35;
    box(bridge, materials.stoneDark, 0, 0.12, 0, length + 0.25, 0.24, 1.85);
    for (const side of [-1, 1]) box(bridge, materials.woodDark, 0, 0.27, side * 0.58, length, 0.16, 0.15);
    const planks = 30;
    for (let i = 0; i < planks; i++) {
      const x = -length / 2 + ((i + 0.5) / planks) * length;
      box(bridge, materials.woodLight, x, 0.35, 0, length / planks - 0.015, 0.07, 1.62);
    }
    const columns = [-3.75, -1.88, 0, 1.88, 3.75];
    for (const x of columns) {
      for (const side of [-1, 1]) column(bridge, x, side * 0.7, 0.39, 2.34, 0.105, 0.62);
    }
    for (const side of [-1, 1]) {
      box(bridge, materials.woodDark, 0, 2.33, side * 0.7, length - 0.35, 0.18, 0.16);
      railing(bridge, -4.02, side * 0.77, 4.02, side * 0.77, 0.39, 0.62);
    }
    for (const side of [-1, 1]) {
      box(bridge, materials.stone, side * 4.32, 0.18, 0, 0.38, 0.22, 1.8);
      box(bridge, materials.stone, side * 4.58, 0.09, 0, 0.32, 0.16, 1.95);
    }
    createGableRoof(bridge, {
      width: 9.0,
      halfDepth: 1.28,
      eave: 2.68,
      ridge: 3.57,
      upturn: 0.14,
      corner: 0.23,
      under: true,
      ornate: true,
      ornamentScale: 0.6,
    });
    makePlaque(bridge, '卧波廊', '', 0, 2.31, 0.87, 1.72, 0.43, '卧波廊匾额', '长桥卧波，未云何龙？复道行空，不霁何虹。');
    makeHangingLantern(bridge, -2.55, 2.18, 0, 0.68, false, '卧波廊 · 西灯');
    makeHangingLantern(bridge, 2.55, 2.18, 0, 0.68, true, '卧波廊 · 东灯', 9);
  }

  function steppingStone(x, z, sx, sz, rotation = 0) {
    const shade = 0.86 + random() * 0.13;
    place(group, slabGeometry, materials.stone, x, 0.06, z, sx, 1, sz, 0, rotation, 0, null, new THREE.Color(shade, shade, shade));
  }

  // 北界与东西庭院围墙。月洞门为真实几何空洞，不是贴图或黑板。
  makePlainWall(group, 0, -13.75, 35.2, 2.85);
  makePlainWall(group, -16.4, -10.875, 5.75, 2.85, Math.PI / 2);
  makePlainWall(group, 16.4, -10.875, 5.75, 2.85, Math.PI / 2);
  makeMoonWall(group, -16.4, 2.8, 21.6, Math.PI / 2, '入画', '移步换景，月洞藏春。');
  makeMoonWall(group, 16.4, 2.8, 21.6, Math.PI / 2, '揽月', '掬水月在手，弄花香满衣。');

  makeMainHall();
  makeCorridor(-14.05, 2.8, Math.PI / 2, '西侧揽月游廊', '揽月', '曲廊通幽处，禅房花木深。');
  makeCorridor(14.05, 2.8, -Math.PI / 2, '东侧听雨游廊', '听雨', '殷勤昨夜三更雨，又得浮生一日凉。');
  makePavilion();
  makeCoveredBridge();

  // 石灯与汀步均落在主池塘 x[-3,11]、z[-2,10] 之外。
  makeStoneLantern(group, -4.65, 8.75, true, '西汀石灯笼');
  makeStoneLantern(group, 12.25, 8.55, true, '东汀石灯笼');
  makeStoneLantern(group, 10.1, -3.25, false, '北岸石灯笼');

  [-6.55, -5.72, -4.89, -4.06].forEach((z, i) => steppingStone(-1 + (i % 2 ? 0.09 : -0.06), z, 0.62, 0.43, i * 0.31));
  [-6.55, -5.63, -4.72, -3.82].forEach((x, i) => steppingStone(x, 2 + (i % 2 ? 0.1 : -0.08), 0.52, 0.42, i * 0.47));

  flushBatches();

  function update(time = 0, delta = 0, state = {}) {
    const dt = clamp(Number.isFinite(delta) ? delta : 0, 0, 0.08);
    const night = clamp(Number.isFinite(state?.night) ? state.night : 0, 0, 1);
    const weather = state?.weather;
    const weatherType = typeof weather === 'string' ? weather : weather?.type || 'clear';
    const season = state?.season || 'spring';
    let wind = weatherType === 'storm' ? 2.1 : weatherType === 'wind' ? 1.65 : weatherType === 'rain' ? 1.12 : 0.68;
    if (season === 'autumn') wind *= 1.18;
    if (season === 'winter') wind *= 1.08;
    if (typeof weather === 'object' && Number.isFinite(weather?.wind)) wind *= clamp(weather.wind, 0, 3);

    for (const door of doors) {
      const target = door.control.userData.active === false ? 0 : 1;
      door.current = THREE.MathUtils.damp(door.current, target, 6.5, dt);
      door.pivot.rotation.y = door.openSign * door.current * door.angle;
    }

    for (const lantern of lanterns) {
      const active = lantern.group.userData.active !== false;
      lantern.level = THREE.MathUtils.damp(lantern.level, active ? 1 : 0, 8, dt);
      const flicker = 1
        + Math.sin(time * 7.1 + lantern.phase) * 0.025
        + Math.sin(time * 13.7 + lantern.phase * 1.7) * 0.012;
      lantern.material.emissiveIntensity = 0.07 + lantern.level * (0.16 + night * 2.25) * flicker;
      if (lantern.light) {
        lantern.light.intensity = lantern.intensity * lantern.level * night * flicker;
        lantern.light.visible = lantern.light.intensity > 0.015;
      }
      if (lantern.sway) {
        lantern.group.rotation.z = Math.sin(time * 0.82 + lantern.phase) * 0.012 * wind;
        lantern.group.rotation.x = Math.sin(time * 0.63 + lantern.phase * 0.7) * 0.006 * wind;
      }
    }

    for (const chime of chimes) {
      const active = chime.pivot.userData.active === true;
      const impulse = Number.isFinite(chime.pivot.userData.impulse) ? clamp(chime.pivot.userData.impulse, 0, 2) : 0;
      if (impulse > 0) {
        chime.velocity += 2.25 * impulse;
        chime.pivot.userData.impulse = 0;
      } else if (active && !chime.lastActive) {
        chime.velocity += 2.25;
      }
      chime.lastActive = active;
      const drive = Math.sin(time * 1.55 + chime.phase) * 0.2 * wind
        + (active ? Math.sin(time * 4.4 + chime.phase) * 0.34 : 0);
      chime.velocity += (-10.5 * chime.angle - 2.15 * chime.velocity + drive * 2.8) * dt;
      chime.angle += chime.velocity * dt;
      chime.angle = clamp(chime.angle, -0.52, 0.52);
      chime.pivot.rotation.z = chime.angle;
      chime.pivot.rotation.x = Math.sin(time * 1.2 + chime.phase) * Math.abs(chime.angle) * 0.35;
    }
  }

  update(0, 0, { night: 0, season: 'spring', weather: 'clear' });
  group.userData.description = '听雨堂、藕香榭、东西游廊、卧波廊桥、月洞门与暖色灯组';

  return { group, interactives, lanternLights, update };
}
