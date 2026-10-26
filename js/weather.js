import * as THREE from 'three';

const MIN_X = -22;
const MAX_X = 22;
const MIN_Z = -18;
const MAX_Z = 18;
const MIN_Y = 0;
const MAX_Y = 18;

const RAIN_COUNT = 680;
const SNOW_COUNT = 360;
const MOTE_COUNT = 36;
const BIRD_COUNT = 4;
const TWO_PI = Math.PI * 2;

const SEASON_ALIASES = {
  spring: 'spring',
  summer: 'summer',
  autumn: 'autumn',
  fall: 'autumn',
  winter: 'winter',
  春: 'spring',
  夏: 'summer',
  秋: 'autumn',
  冬: 'winter',
};

const SEASON_PALETTES = {
  spring: { rain: 0x9dbbc7, snow: 0xf3f8ff, mote: 0xffe3a1 },
  summer: { rain: 0x91b5c5, snow: 0xf4f7ff, mote: 0xffd273 },
  autumn: { rain: 0xa7b8bf, snow: 0xfff6e9, mote: 0xffbd70 },
  winter: { rain: 0xa6c2d0, snow: 0xeaf3ff, mote: 0xffd89a },
};

function normalizeWeather(type) {
  return type === 'rain' || type === 'snow' ? type : 'sunny';
}

function normalizeSeason(season) {
  return SEASON_ALIASES[season] || 'spring';
}

// A repeatable distribution avoids an unfortunate cluster on any one page load.
function createRandom(seed) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

// Procedural RGBA texture: a round, firm core with a genuinely soft outer edge.
function createSoftDiscTexture() {
  const size = 64;
  const data = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x + 0.5 - size / 2) / (size / 2);
      const dy = (y + 0.5 - size / 2) / (size / 2);
      const distance = Math.sqrt(dx * dx + dy * dy);
      const fade = THREE.MathUtils.clamp((1 - distance) / 0.56, 0, 1);
      const alpha = fade * fade * (3 - 2 * fade);
      const offset = (y * size + x) * 4;
      data[offset] = 255;
      data[offset + 1] = 255;
      data[offset + 2] = 255;
      data[offset + 3] = Math.round(alpha * 255);
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.name = 'weather-soft-disc';
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export function createWeather(scene) {
  const random = createRandom(0x51a7c3d9);
  const softDiscTexture = createSoftDiscTexture();
  const particleBounds = new THREE.Sphere(new THREE.Vector3(0, 9, 0), 30);

  let currentWeather = 'sunny';
  let currentSeason = 'spring';
  let night = false;
  let elapsed = 0;

  // Rain is one line-segment draw call, with only two vertices per streak.
  const rainPositions = new Float32Array(RAIN_COUNT * 2 * 3);
  const rainX = new Float32Array(RAIN_COUNT);
  const rainY = new Float32Array(RAIN_COUNT);
  const rainZ = new Float32Array(RAIN_COUNT);
  const rainSpeed = new Float32Array(RAIN_COUNT);
  const rainLength = new Float32Array(RAIN_COUNT);
  const rainGeometry = new THREE.BufferGeometry();
  const rainPositionAttribute = new THREE.BufferAttribute(rainPositions, 3);
  rainPositionAttribute.setUsage(THREE.DynamicDrawUsage);
  rainGeometry.setAttribute('position', rainPositionAttribute);
  rainGeometry.boundingSphere = particleBounds;

  for (let i = 0; i < RAIN_COUNT; i += 1) {
    const length = 0.28 + random() * 0.34;
    rainX[i] = MIN_X + random() * (MAX_X - MIN_X);
    rainY[i] = length + random() * (MAX_Y - length);
    rainZ[i] = MIN_Z + random() * (MAX_Z - MIN_Z);
    rainSpeed[i] = 8.5 + random() * 4.5;
    rainLength[i] = length;

    const offset = i * 6;
    rainPositions[offset] = rainX[i];
    rainPositions[offset + 1] = rainY[i];
    rainPositions[offset + 2] = rainZ[i];
    rainPositions[offset + 3] = rainX[i] - length * 0.1;
    rainPositions[offset + 4] = rainY[i] - length;
    rainPositions[offset + 5] = rainZ[i] - length * 0.028;
  }

  const rainMaterial = new THREE.LineBasicMaterial({
    color: SEASON_PALETTES.spring.rain,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    toneMapped: false,
  });
  const rain = new THREE.LineSegments(rainGeometry, rainMaterial);
  rain.name = 'weather-rain';
  rain.renderOrder = 2;

  // Snow is one Points draw call. The sparse field stays readable, not fog-like.
  const snowPositions = new Float32Array(SNOW_COUNT * 3);
  const snowSpeed = new Float32Array(SNOW_COUNT);
  const snowPhase = new Float32Array(SNOW_COUNT);
  const snowGeometry = new THREE.BufferGeometry();
  const snowPositionAttribute = new THREE.BufferAttribute(snowPositions, 3);
  snowPositionAttribute.setUsage(THREE.DynamicDrawUsage);
  snowGeometry.setAttribute('position', snowPositionAttribute);
  snowGeometry.boundingSphere = particleBounds;

  for (let i = 0; i < SNOW_COUNT; i += 1) {
    const offset = i * 3;
    snowPositions[offset] = MIN_X + random() * (MAX_X - MIN_X);
    snowPositions[offset + 1] = MIN_Y + 0.1 + random() * (MAX_Y - 0.1);
    snowPositions[offset + 2] = MIN_Z + random() * (MAX_Z - MIN_Z);
    snowSpeed[i] = 0.48 + random() * 0.58;
    snowPhase[i] = random() * TWO_PI;
  }

  const snowMaterial = new THREE.PointsMaterial({
    color: SEASON_PALETTES.spring.snow,
    size: 0.17,
    map: softDiscTexture,
    transparent: true,
    opacity: 0.9,
    alphaTest: 0.015,
    depthWrite: false,
    sizeAttenuation: true,
    toneMapped: false,
  });
  const snow = new THREE.Points(snowGeometry, snowMaterial);
  snow.name = 'weather-snow';
  snow.renderOrder = 2;

  // By day these are tiny dust motes; at night the same points become fireflies.
  const motePositions = new Float32Array(MOTE_COUNT * 3);
  const moteBaseX = new Float32Array(MOTE_COUNT);
  const moteBaseY = new Float32Array(MOTE_COUNT);
  const moteBaseZ = new Float32Array(MOTE_COUNT);
  const motePhase = new Float32Array(MOTE_COUNT);
  const moteRadius = new Float32Array(MOTE_COUNT);
  const moteGeometry = new THREE.BufferGeometry();
  const motePositionAttribute = new THREE.BufferAttribute(motePositions, 3);
  motePositionAttribute.setUsage(THREE.DynamicDrawUsage);
  moteGeometry.setAttribute('position', motePositionAttribute);
  moteGeometry.boundingSphere = particleBounds;

  for (let i = 0; i < MOTE_COUNT; i += 1) {
    moteBaseX[i] = -17 + random() * 34;
    moteBaseY[i] = 0.9 + random() * 4.9;
    moteBaseZ[i] = -13 + random() * 26;
    motePhase[i] = random() * TWO_PI;
    moteRadius[i] = 0.35 + random() * 0.85;
  }

  const moteMaterial = new THREE.PointsMaterial({
    color: SEASON_PALETTES.spring.mote,
    size: 0.065,
    map: softDiscTexture,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    toneMapped: false,
  });
  const motes = new THREE.Points(moteGeometry, moteMaterial);
  motes.name = 'weather-motes';
  motes.renderOrder = 3;

  // All four birds share a single dynamic mesh: eight wing triangles, one call.
  const birdPositions = new Float32Array(BIRD_COUNT * 6 * 3);
  const birdPhase = new Float32Array(BIRD_COUNT);
  const birdSpeed = new Float32Array(BIRD_COUNT);
  const birdRadiusX = new Float32Array(BIRD_COUNT);
  const birdRadiusZ = new Float32Array(BIRD_COUNT);
  const birdHeight = new Float32Array(BIRD_COUNT);
  const birdGeometry = new THREE.BufferGeometry();
  const birdPositionAttribute = new THREE.BufferAttribute(birdPositions, 3);
  birdPositionAttribute.setUsage(THREE.DynamicDrawUsage);
  birdGeometry.setAttribute('position', birdPositionAttribute);
  birdGeometry.boundingSphere = particleBounds;

  for (let i = 0; i < BIRD_COUNT; i += 1) {
    birdPhase[i] = (i / BIRD_COUNT) * TWO_PI + random() * 0.45;
    birdSpeed[i] = 0.045 + random() * 0.022;
    birdRadiusX[i] = 16.5 + random() * 2.2;
    birdRadiusZ[i] = 11.8 + random() * 2.1;
    birdHeight[i] = 11.3 + random() * 2.5;
  }

  const birdMaterial = new THREE.MeshBasicMaterial({
    color: 0x34464b,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.76,
    depthWrite: false,
    toneMapped: false,
  });
  const birds = new THREE.Mesh(birdGeometry, birdMaterial);
  birds.name = 'weather-birds';

  function syncVisibility() {
    rain.visible = currentWeather === 'rain';
    snow.visible = currentWeather === 'snow';
    motes.visible = currentWeather === 'sunny';
    birds.visible = currentWeather === 'sunny' && !night;
  }

  function applyAppearance() {
    const palette = SEASON_PALETTES[currentSeason];
    rainMaterial.color.set(night ? 0xc2dfed : palette.rain);
    rainMaterial.opacity = night ? 0.48 : 0.34;
    snowMaterial.color.set(night ? 0xf5f9ff : palette.snow);
    snowMaterial.opacity = night ? 0.96 : 0.88;
    snowMaterial.size = night ? 0.19 : 0.17;
    moteMaterial.color.set(palette.mote);
    moteMaterial.size = night ? 0.19 : 0.065;
    moteMaterial.opacity = night ? 0.78 : 0.2;
  }

  function setWeather(type) {
    currentWeather = normalizeWeather(type);
    // Visibility is changed here, not deferred until the next animation frame.
    syncVisibility();
  }

  function setSeason(season) {
    currentSeason = normalizeSeason(season);
    applyAppearance();
  }

  function updateMotes(time) {
    for (let i = 0; i < MOTE_COUNT; i += 1) {
      const offset = i * 3;
      const phase = motePhase[i];
      const radius = moteRadius[i];
      motePositions[offset] = moteBaseX[i] + Math.sin(time * 0.24 + phase) * radius;
      motePositions[offset + 1] = moteBaseY[i] + Math.sin(time * 0.42 + phase * 1.7) * 0.32;
      motePositions[offset + 2] = moteBaseZ[i] + Math.cos(time * 0.2 + phase) * radius * 0.7;
    }
    motePositionAttribute.needsUpdate = true;

    if (night) {
      moteMaterial.opacity = 0.76 + Math.sin(time * 1.35) * 0.1;
    }
  }

  function updateBirds(time) {
    for (let i = 0; i < BIRD_COUNT; i += 1) {
      const phase = birdPhase[i];
      const angle = phase + time * birdSpeed[i];
      const radiusX = birdRadiusX[i];
      const radiusZ = birdRadiusZ[i];
      const centerX = Math.cos(angle) * radiusX;
      const centerY = birdHeight[i] + Math.sin(angle * 2 + phase) * 0.34;
      const centerZ = Math.sin(angle) * radiusZ;

      let forwardX = -Math.sin(angle) * radiusX;
      let forwardZ = Math.cos(angle) * radiusZ;
      const inverseLength = 1 / Math.max(0.0001, Math.hypot(forwardX, forwardZ));
      forwardX *= inverseLength;
      forwardZ *= inverseLength;
      const sideX = -forwardZ;
      const sideZ = forwardX;

      const span = 0.43 + i * 0.035;
      const flap = 0.06 + Math.sin(time * (2.15 + i * 0.12) + phase * 2) * 0.24;
      const noseX = centerX + forwardX * 0.2;
      const noseY = centerY;
      const noseZ = centerZ + forwardZ * 0.2;
      const tailX = centerX - forwardX * 0.16;
      const tailY = centerY - 0.015;
      const tailZ = centerZ - forwardZ * 0.16;
      const leftX = centerX + sideX * span - forwardX * 0.06;
      const leftY = centerY + flap;
      const leftZ = centerZ + sideZ * span - forwardZ * 0.06;
      const rightX = centerX - sideX * span - forwardX * 0.06;
      const rightY = leftY;
      const rightZ = centerZ - sideZ * span - forwardZ * 0.06;

      const offset = i * 18;
      birdPositions[offset] = noseX;
      birdPositions[offset + 1] = noseY;
      birdPositions[offset + 2] = noseZ;
      birdPositions[offset + 3] = leftX;
      birdPositions[offset + 4] = leftY;
      birdPositions[offset + 5] = leftZ;
      birdPositions[offset + 6] = tailX;
      birdPositions[offset + 7] = tailY;
      birdPositions[offset + 8] = tailZ;
      birdPositions[offset + 9] = noseX;
      birdPositions[offset + 10] = noseY;
      birdPositions[offset + 11] = noseZ;
      birdPositions[offset + 12] = tailX;
      birdPositions[offset + 13] = tailY;
      birdPositions[offset + 14] = tailZ;
      birdPositions[offset + 15] = rightX;
      birdPositions[offset + 16] = rightY;
      birdPositions[offset + 17] = rightZ;
    }
    birdPositionAttribute.needsUpdate = true;
  }

  function update(time, delta, state) {
    const step = Number.isFinite(delta) ? THREE.MathUtils.clamp(delta, 0, 0.1) : 1 / 60;
    elapsed += step;
    const now = Number.isFinite(time) ? time : elapsed;

    if (state) {
      if (state.weather && state.weather !== currentWeather) {
        setWeather(state.weather);
      }
      if (state.season && normalizeSeason(state.season) !== currentSeason) {
        setSeason(state.season);
      }
      if (state.night !== undefined && Boolean(state.night) !== night) {
        night = Boolean(state.night);
        syncVisibility();
        applyAppearance();
      }
    }

    if (rain.visible) {
      for (let i = 0; i < RAIN_COUNT; i += 1) {
        const length = rainLength[i];
        let x = rainX[i] + step * 0.72;
        let y = rainY[i] - rainSpeed[i] * step;
        let z = rainZ[i] + step * 0.2;

        if (y <= length) y = MAX_Y;
        if (x > MAX_X) x = MIN_X;
        if (z > MAX_Z) z = MIN_Z;
        rainX[i] = x;
        rainY[i] = y;
        rainZ[i] = z;

        const offset = i * 6;
        rainPositions[offset] = x;
        rainPositions[offset + 1] = y;
        rainPositions[offset + 2] = z;
        rainPositions[offset + 3] = x - length * 0.1;
        rainPositions[offset + 4] = y - length;
        rainPositions[offset + 5] = z - length * 0.028;
      }
      rainPositionAttribute.needsUpdate = true;
    }

    if (snow.visible) {
      for (let i = 0; i < SNOW_COUNT; i += 1) {
        const offset = i * 3;
        const phase = snowPhase[i];
        let x = snowPositions[offset] + (0.08 + Math.sin(now * 0.68 + phase) * 0.19) * step;
        let y = snowPositions[offset + 1] - snowSpeed[i] * step;
        let z = snowPositions[offset + 2] + Math.cos(now * 0.51 + phase * 1.31) * 0.15 * step;

        if (y < MIN_Y + 0.06) y = MAX_Y;
        if (x > MAX_X) x = MIN_X;
        if (x < MIN_X) x = MAX_X;
        if (z > MAX_Z) z = MIN_Z;
        if (z < MIN_Z) z = MAX_Z;
        snowPositions[offset] = x;
        snowPositions[offset + 1] = y;
        snowPositions[offset + 2] = z;
      }
      snowPositionAttribute.needsUpdate = true;
    }

    if (motes.visible) updateMotes(now);
    if (birds.visible) updateBirds(now);
  }

  updateMotes(0);
  updateBirds(0);
  syncVisibility();
  applyAppearance();

  // No host-side scene wiring is required.
  scene.add(rain, snow, motes, birds);

  return { update, setWeather, setSeason };
}
