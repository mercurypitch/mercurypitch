// Journey water — bounded animated waterfall sheets, basin ripples and pooled impact mist.

import type { IUniform } from 'three'
import { AdditiveBlending, BufferAttribute, BufferGeometry, CircleGeometry, DoubleSide, DynamicDrawUsage, Euler, Group, InstancedMesh, Matrix4, Mesh, NormalBlending, Points, Quaternion, ShaderMaterial, Vector3, } from 'three'

export interface JourneyWaterSpillway {
  readonly id: string
  readonly position: readonly [number, number, number]
  readonly width: number
  readonly height: number
  /** Rotation around world Y. Local +Z is the outward flow direction. */
  readonly yaw: number
}

export interface JourneyWaterOptions {
  /** Proof and low-detail seam. The animated sheets and basins remain enabled. */
  readonly mist?: boolean
}

export interface JourneyWaterMetrics {
  readonly spillways: number
  readonly drawCalls: number
  readonly triangles: number
  readonly geometries: number
  readonly materials: number
  readonly mistParticles: number
  readonly secondaryRenderPasses: 0
}

export interface JourneyWater {
  readonly root: Group
  update(visibleSeconds: number, dt: number): void
  setReducedMotion(reduced: boolean): void
  getMetrics(): JourneyWaterMetrics
  dispose(): void
}

const WIDTH_SEGMENTS = 14
const FALL_SEGMENTS = 24
const BASIN_SEGMENTS = 48
const MIST_PARTICLES_PER_SPILLWAY = 18
const MAX_ANIMATION_STEP_SECONDS = 0.1

interface OwnedUniforms {
  [uniform: string]: IUniform
  uTime: { value: number }
  uMotion: { value: number }
}

const WATER_VERTEX_SHADER = /* glsl */ `
  attribute float aFall;
  attribute float aAcross;
  attribute float aWaveScale;
  uniform float uTime;
  uniform float uMotion;
  varying vec2 vWaterUv;
  varying vec3 vWorldPosition;

  void main() {
    vec3 transformed = position;
    float topPin = smoothstep(0.0, 0.085, aFall);
    float bottomTurbulence = smoothstep(0.62, 1.0, aFall);
    float side = aAcross * 2.0 - 1.0;
    float edge = pow(abs(side), 5.0);
    float phaseA = aFall * 19.0 - uTime * 3.4 + aAcross * 4.7;
    float phaseB = aFall * 10.0 - uTime * 2.1 - aAcross * 8.2;
    transformed.z +=
      (sin(phaseA) * 0.032 + sin(phaseB) * 0.018) *
      topPin * (0.72 + bottomTurbulence * 0.72) * aWaveScale * uMotion;
    transformed.x +=
      sin(aFall * 12.0 - uTime * 2.2 + aAcross * 5.0) *
      0.015 * topPin * aWaveScale * uMotion;
    transformed.x +=
      sign(side) * edge *
      sin(aFall * 24.0 - uTime * 4.1 + aAcross * 2.7) *
      (0.018 + bottomTurbulence * 0.04) * topPin * aWaveScale * uMotion;
    transformed.y +=
      sin(aAcross * 23.0 + aFall * 7.0 - uTime * 2.7) *
      0.013 * topPin * (0.45 + bottomTurbulence) * aWaveScale * uMotion;

    vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
    vWaterUv = uv;
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const WATER_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uMotion;
  varying vec2 vWaterUv;
  varying vec3 vWorldPosition;

  float hash21(vec2 point) {
    vec3 packed = fract(vec3(point.xyx) * vec3(0.1031, 0.103, 0.0973));
    packed += dot(packed, packed.yzx + 33.33);
    return fract((packed.x + packed.y) * packed.z);
  }

  float valueNoise(vec2 point) {
    vec2 cell = floor(point);
    vec2 fraction = fract(point);
    fraction = fraction * fraction * (3.0 - 2.0 * fraction);
    float lower = mix(hash21(cell), hash21(cell + vec2(1.0, 0.0)), fraction.x);
    float upper = mix(hash21(cell + vec2(0.0, 1.0)), hash21(cell + 1.0), fraction.x);
    return mix(lower, upper, fraction.y);
  }

  void main() {
    float time = uTime * uMotion;
    float across = vWaterUv.x;
    float fall = vWaterUv.y;
    float advected = fall - time * 0.19;
    float broadWarp = (valueNoise(vec2(across * 5.0, advected * 3.2)) - 0.5) * 2.2;
    float fineStrand = pow(
      0.5 + 0.5 * sin(across * 104.0 + broadWarp * 2.4),
      13.0
    );
    float broadStrand = pow(
      0.5 + 0.5 * sin(across * 37.0 - broadWarp * 1.3 + 1.1),
      8.0
    );
    float brokenLength = smoothstep(
      0.36,
      0.74,
      valueNoise(vec2(across * 14.0 + 2.4, advected * 15.0))
    );
    float silverFilaments =
      (fineStrand * 0.82 + broadStrand * 0.42) *
      (0.24 + brokenLength * 0.76);
    float smallerFoam = smoothstep(
      0.58,
      0.84,
      valueNoise(vec2(across * 29.0 - 4.7, advected * 25.0))
    );
    float bottomTurbulence = smoothstep(0.66, 1.0, fall) *
      smoothstep(
        0.24,
        0.78,
        valueNoise(vec2(across * 18.0 + time * 0.25, advected * 19.0))
      );
    float topLip = (1.0 - smoothstep(0.025, 0.14, fall)) *
      (0.48 + valueNoise(vec2(across * 13.0, time * 0.34)) * 0.52);

    float edgeDistance = min(across, 1.0 - across);
    float edgeVariation = valueNoise(vec2(fall * 8.0 - time * 0.31, across * 3.0));
    float edgeThreshold = 0.012 + edgeVariation * (0.035 + bottomTurbulence * 0.018);
    float raggedEdge = smoothstep(edgeThreshold, edgeThreshold + 0.032, edgeDistance);

    vec3 dx = dFdx(vWorldPosition);
    vec3 dy = dFdy(vWorldPosition);
    vec3 normal = normalize(cross(dx, dy));
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float fresnel = pow(1.0 - abs(dot(normal, viewDirection)), 2.2);

    vec3 deepTurquoise = vec3(0.018, 0.30, 0.34);
    vec3 clearAqua = vec3(0.11, 0.69, 0.7);
    vec3 silverFoam = vec3(0.82, 0.97, 0.94);
    float flowFoam = clamp(
      silverFilaments * (0.6 + smallerFoam * 0.4) +
      bottomTurbulence * 0.62 + topLip * 0.48,
      0.0,
      1.0
    );
    float core = 1.0 - abs(across * 2.0 - 1.0);
    vec3 outgoingLight = mix(
      deepTurquoise,
      clearAqua,
      0.38 + core * 0.26 + fresnel * 0.32
    );
    outgoingLight = mix(outgoingLight, silverFoam, flowFoam * 0.88);
    float alpha = clamp(
      (0.48 + core * 0.12 + fresnel * 0.22 + flowFoam * 0.24) * raggedEdge,
      0.0,
      0.94
    );
    if (alpha < 0.012) discard;
    gl_FragColor = vec4(outgoingLight, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

const BASIN_VERTEX_SHADER = /* glsl */ `
  varying vec2 vBasinUv;

  void main() {
    vBasinUv = uv;
    vec4 localPosition = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      localPosition = instanceMatrix * localPosition;
    #endif
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * localPosition;
  }
`

const BASIN_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uMotion;
  varying vec2 vBasinUv;

  void main() {
    vec2 centered = vBasinUv - 0.5;
    float radius = length(centered) * 2.0;
    if (radius > 1.0) discard;
    float time = uTime * uMotion;
    float ringA = 1.0 - smoothstep(0.035, 0.11, abs(fract(radius * 3.2 - time * 0.52) - 0.5));
    float ringB = 1.0 - smoothstep(0.03, 0.095, abs(fract(radius * 4.8 - time * 0.34 + 0.27) - 0.5));
    float centerFoam = 1.0 - smoothstep(0.08, 0.38, radius);
    float edgeFade = 1.0 - smoothstep(0.58, 1.0, radius);
    vec3 turquoise = vec3(0.045, 0.52, 0.53);
    vec3 highlight = vec3(0.68, 0.96, 0.87);
    float foam = clamp(centerFoam * 0.65 + ringA * 0.28 + ringB * 0.2, 0.0, 1.0);
    gl_FragColor = vec4(mix(turquoise, highlight, foam), edgeFade * (0.34 + foam * 0.38));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

const MIST_VERTEX_SHADER = /* glsl */ `
  attribute float aSeed;
  attribute float aSize;
  attribute vec3 aOutward;
  uniform float uTime;
  uniform float uMotion;
  varying float vMistAlpha;

  void main() {
    float cycle = fract(aSeed + uTime * (0.12 + aSeed * 0.055));
    vec3 transformed = position;
    transformed += aOutward * cycle * (0.12 + aSeed * 0.16) * uMotion;
    transformed.y += cycle * (0.18 + aSeed * 0.28) * uMotion;
    transformed.x += sin(aSeed * 31.0 + uTime * 0.8) * 0.035 * cycle * uMotion;
    vec4 modelViewPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_PointSize = clamp(aSize * 190.0 / max(0.15, -modelViewPosition.z), 1.0, 18.0);
    gl_Position = projectionMatrix * modelViewPosition;
    vMistAlpha = sin(cycle * 3.14159265) * uMotion;
  }
`

const MIST_FRAGMENT_SHADER = /* glsl */ `
  varying float vMistAlpha;

  void main() {
    vec2 centered = gl_PointCoord - 0.5;
    float radius = length(centered) * 2.0;
    float alpha = (1.0 - smoothstep(0.08, 1.0, radius)) * vMistAlpha * 0.34;
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(0.64, 0.95, 0.9, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`)
  return value
}

function validateSpillways(spillways: readonly JourneyWaterSpillway[]): void {
  const ids = new Set<string>()
  for (const spillway of spillways) {
    if (spillway.id.length === 0)
      throw new Error('Journey water spillway IDs must not be empty.')
    if (ids.has(spillway.id))
      throw new Error(`Duplicate journey water spillway ID: ${spillway.id}`)
    ids.add(spillway.id)
    spillway.position.forEach((value, index) =>
      finite(value, `${spillway.id}.position[${index}]`),
    )
    finite(spillway.yaw, `${spillway.id}.yaw`)
    if (!Number.isFinite(spillway.width) || spillway.width <= 0)
      throw new Error(`${spillway.id}.width must be greater than zero.`)
    if (!Number.isFinite(spillway.height) || spillway.height <= 0)
      throw new Error(`${spillway.id}.height must be greater than zero.`)
  }
}

function spillwayOutset(spillway: JourneyWaterSpillway): number {
  return clamp(spillway.height * 0.18 + spillway.width * 0.035, 0.22, 0.82)
}

function createSheetGeometry(spillway: JourneyWaterSpillway): BufferGeometry {
  const positions: number[] = []
  const uvs: number[] = []
  const falls: number[] = []
  const acrossValues: number[] = []
  const waveScales: number[] = []
  const indices: number[] = []
  const outset = spillwayOutset(spillway)
  const waveScale = clamp(Math.min(spillway.width, spillway.height), 0.65, 1.6)

  for (let row = 0; row <= FALL_SEGMENTS; row++) {
    const fall = row / FALL_SEGMENTS
    const bodyCurve = fall * fall * (3 - 2 * fall)
    const lipProgress = clamp(fall / 0.16, 0, 1)
    const lipCurve = lipProgress * lipProgress * (3 - 2 * lipProgress)
    const curve = outset * (bodyCurve * 0.8 + lipCurve * 0.2)
    for (let column = 0; column <= WIDTH_SEGMENTS; column++) {
      const across = column / WIDTH_SEGMENTS
      positions.push(
        (across - 0.5) * spillway.width,
        -fall * spillway.height,
        curve,
      )
      uvs.push(across, fall)
      falls.push(fall)
      acrossValues.push(across)
      waveScales.push(waveScale)
    }
  }
  for (let row = 0; row < FALL_SEGMENTS; row++) {
    for (let column = 0; column < WIDTH_SEGMENTS; column++) {
      const upperLeft = row * (WIDTH_SEGMENTS + 1) + column
      const lowerLeft = upperLeft + WIDTH_SEGMENTS + 1
      indices.push(
        upperLeft,
        lowerLeft,
        upperLeft + 1,
        upperLeft + 1,
        lowerLeft,
        lowerLeft + 1,
      )
    }
  }

  const geometry = new BufferGeometry()
  geometry.name = `journey-water-sheet:${spillway.id}`
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array(positions), 3),
  )
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2))
  geometry.setAttribute(
    'aFall',
    new BufferAttribute(new Float32Array(falls), 1),
  )
  geometry.setAttribute(
    'aAcross',
    new BufferAttribute(new Float32Array(acrossValues), 1),
  )
  geometry.setAttribute(
    'aWaveScale',
    new BufferAttribute(new Float32Array(waveScales), 1),
  )
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

function createWaterMaterial(uniforms: OwnedUniforms): ShaderMaterial {
  const material = new ShaderMaterial({
    name: 'journey-water-sheet-material',
    uniforms,
    vertexShader: WATER_VERTEX_SHADER,
    fragmentShader: WATER_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: NormalBlending,
    toneMapped: true,
  })
  material.forceSinglePass = true
  return material
}

function createBasinMaterial(uniforms: OwnedUniforms): ShaderMaterial {
  const material = new ShaderMaterial({
    name: 'journey-water-basin-material',
    uniforms,
    vertexShader: BASIN_VERTEX_SHADER,
    fragmentShader: BASIN_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: NormalBlending,
    toneMapped: true,
  })
  material.forceSinglePass = true
  return material
}

function seededUnit(id: string, index: number): number {
  let hash = 0x811c9dc5 ^ index
  for (let cursor = 0; cursor < id.length; cursor++) {
    hash ^= id.charCodeAt(cursor)
    hash = Math.imul(hash, 0x01000193)
  }
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x21f0aaad)
  hash ^= hash >>> 15
  return (hash >>> 0) / 0x1_0000_0000
}

function createMist(
  spillways: readonly JourneyWaterSpillway[],
  uniforms: OwnedUniforms,
): { points: Points; geometry: BufferGeometry; material: ShaderMaterial } {
  const positions: number[] = []
  const seeds: number[] = []
  const sizes: number[] = []
  const outward: number[] = []

  for (const spillway of spillways) {
    const outset = spillwayOutset(spillway)
    const sine = Math.sin(spillway.yaw)
    const cosine = Math.cos(spillway.yaw)
    const direction = new Vector3(sine, 0, cosine)
    const lateral = new Vector3(cosine, 0, -sine)
    const center = new Vector3(...spillway.position)
      .addScaledVector(direction, outset)
      .add(new Vector3(0, -spillway.height + 0.045, 0))
    for (let index = 0; index < MIST_PARTICLES_PER_SPILLWAY; index++) {
      const seed = seededUnit(spillway.id, index)
      const lateralOffset =
        (seededUnit(spillway.id, index + 97) - 0.5) * spillway.width * 0.72
      const depthOffset = (seededUnit(spillway.id, index + 193) - 0.5) * 0.18
      const position = center
        .clone()
        .addScaledVector(lateral, lateralOffset)
        .addScaledVector(direction, depthOffset)
      positions.push(position.x, position.y, position.z)
      seeds.push(seed)
      sizes.push(0.06 + seededUnit(spillway.id, index + 389) * 0.07)
      outward.push(direction.x, direction.y, direction.z)
    }
  }

  const geometry = new BufferGeometry()
  geometry.name = 'journey-water-mist-pool'
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array(positions), 3),
  )
  geometry.setAttribute(
    'aSeed',
    new BufferAttribute(new Float32Array(seeds), 1),
  )
  geometry.setAttribute(
    'aSize',
    new BufferAttribute(new Float32Array(sizes), 1),
  )
  geometry.setAttribute(
    'aOutward',
    new BufferAttribute(new Float32Array(outward), 3),
  )
  const material = new ShaderMaterial({
    name: 'journey-water-mist-material',
    uniforms,
    vertexShader: MIST_VERTEX_SHADER,
    fragmentShader: MIST_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: true,
  })
  const points = new Points(geometry, material)
  points.name = 'journey-water-mist'
  points.frustumCulled = false
  return { points, geometry, material }
}

/**
 * Build map-scale waterfalls with one shared animated clock and no render loop.
 * The caller owns when visible time advances and must call dispose on removal.
 */
export function createJourneyWater(
  spillways: readonly JourneyWaterSpillway[],
  options: JourneyWaterOptions = {},
): JourneyWater {
  validateSpillways(spillways)
  const root = new Group()
  root.name = 'journey-water'
  const uniforms: OwnedUniforms = {
    uTime: { value: 0 },
    uMotion: { value: 1 },
  }
  const ownedGeometries = new Set<BufferGeometry>()
  const ownedMaterials = new Set<ShaderMaterial>()
  const waterMaterial = createWaterMaterial(uniforms)
  const basinMaterial = createBasinMaterial(uniforms)
  ownedMaterials.add(waterMaterial)
  ownedMaterials.add(basinMaterial)

  for (const spillway of spillways) {
    const geometry = createSheetGeometry(spillway)
    ownedGeometries.add(geometry)
    const sheet = new Mesh(geometry, waterMaterial)
    sheet.name = `journey-water-sheet:${spillway.id}`
    sheet.position.set(...spillway.position)
    sheet.rotation.y = spillway.yaw
    sheet.castShadow = false
    sheet.receiveShadow = false
    root.add(sheet)
  }

  const basinGeometry = new CircleGeometry(1, BASIN_SEGMENTS)
  basinGeometry.name = 'journey-water-basin-shared'
  ownedGeometries.add(basinGeometry)
  const basins = new InstancedMesh(
    basinGeometry,
    basinMaterial,
    spillways.length,
  )
  basins.name = 'journey-water-basins'
  basins.instanceMatrix.setUsage(DynamicDrawUsage)
  basins.castShadow = false
  basins.receiveShadow = false
  const basinMatrix = new Matrix4()
  const basinPosition = new Vector3()
  const basinScale = new Vector3()
  const basinRotation = new Quaternion()
  const horizontal = new Quaternion().setFromEuler(
    new Euler(-Math.PI / 2, 0, 0),
  )
  const yawRotation = new Quaternion()
  for (const [index, spillway] of spillways.entries()) {
    const outset = spillwayOutset(spillway)
    basinPosition
      .set(...spillway.position)
      .add(
        new Vector3(
          Math.sin(spillway.yaw) * outset,
          -spillway.height + 0.018,
          Math.cos(spillway.yaw) * outset,
        ),
      )
    yawRotation.setFromAxisAngle(new Vector3(0, 1, 0), spillway.yaw)
    basinRotation.copy(yawRotation).multiply(horizontal)
    basinScale.set(
      Math.max(0.32, spillway.width * 0.58),
      Math.max(0.24, spillway.width * 0.32),
      1,
    )
    basinMatrix.compose(basinPosition, basinRotation, basinScale)
    basins.setMatrixAt(index, basinMatrix)
  }
  basins.instanceMatrix.needsUpdate = true
  if (spillways.length > 0) root.add(basins)

  const includeMist = options.mist !== false && spillways.length > 0
  const mist = includeMist ? createMist(spillways, uniforms) : undefined
  if (mist !== undefined) {
    ownedGeometries.add(mist.geometry)
    ownedMaterials.add(mist.material)
    root.add(mist.points)
  }

  const sheetTriangles = spillways.length * WIDTH_SEGMENTS * FALL_SEGMENTS * 2
  const basinTriangles = spillways.length * BASIN_SEGMENTS
  const metrics: JourneyWaterMetrics = Object.freeze({
    spillways: spillways.length,
    drawCalls:
      spillways.length + (spillways.length > 0 ? 1 : 0) + (includeMist ? 1 : 0),
    triangles: sheetTriangles + basinTriangles,
    geometries: ownedGeometries.size,
    materials: ownedMaterials.size,
    mistParticles: includeMist
      ? spillways.length * MIST_PARTICLES_PER_SPILLWAY
      : 0,
    secondaryRenderPasses: 0,
  })
  let disposed = false
  let reducedMotion = false
  let flowSeconds = 0
  let previousVisibleSeconds: number | undefined

  return {
    root,
    update(visibleSeconds, dt) {
      if (disposed) return
      const safeVisibleSeconds = Number.isFinite(visibleSeconds)
        ? Math.max(0, visibleSeconds)
        : 0
      const safeDelta = Number.isFinite(dt)
        ? clamp(dt, 0, MAX_ANIMATION_STEP_SECONDS)
        : 0
      if (previousVisibleSeconds === undefined) {
        previousVisibleSeconds = safeVisibleSeconds
      } else if (!reducedMotion) {
        const visibleDelta = clamp(
          safeVisibleSeconds - previousVisibleSeconds,
          0,
          MAX_ANIMATION_STEP_SECONDS,
        )
        flowSeconds += Math.min(visibleDelta, safeDelta)
        previousVisibleSeconds = safeVisibleSeconds
      } else {
        previousVisibleSeconds = safeVisibleSeconds
      }
      uniforms.uTime.value = flowSeconds
    },
    setReducedMotion(reduced) {
      if (disposed || reducedMotion === reduced) return
      reducedMotion = reduced
      uniforms.uMotion.value = reduced ? 0 : 1
      if (mist !== undefined) mist.points.visible = !reduced
    },
    getMetrics() {
      return metrics
    },
    dispose() {
      if (disposed) return
      disposed = true
      root.clear()
      basins.dispose()
      ownedGeometries.forEach((geometry) => geometry.dispose())
      ownedMaterials.forEach((material) => material.dispose())
      ownedGeometries.clear()
      ownedMaterials.clear()
    },
  }
}
