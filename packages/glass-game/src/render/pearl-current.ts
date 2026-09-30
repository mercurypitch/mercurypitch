// ============================================================
// Pearl Current interior — accepted authored flow rendered as a portable Three group.
// ============================================================
//
// The host owns response timing. This renderer advances only ambient motion
// from deltaSeconds and places every response band from normalized progress.

import type { BufferAttribute } from 'three'
import type { BufferGeometry } from 'three'
import { CatmullRomCurve3, Color, DynamicDrawUsage, FrontSide, Group, InstancedMesh, Matrix4, Mesh, MeshPhysicalMaterial, Quaternion, SphereGeometry, TubeGeometry, Vector3, } from 'three'
import type { NormalizedPearlCurrentConfig, PearlCurrentConfig, PearlCurrentLayout, PearlCurrentResponse, PearlCurrentResponseFactors, PearlCurrentStream, } from './pearl-current-config'
import { createPearlCurrentLayout, normalizePearlCurrentConfig, PEARL_CURRENT_HIDDEN_SCALE, PEARL_CURRENT_MAX_RADIUS_SCALE, PEARL_CURRENT_QUALITY_CONFIG, pearlCurrentChargeRadius, pearlCurrentRenderBudget, pearlCurrentResponseFactors, pearlCurrentSegmentsFor, } from './pearl-current-config'

export interface PearlCurrentUpdate {
  readonly deltaSeconds: number
  readonly response: PearlCurrentResponse
  readonly progress: number
  readonly strength?: number
  readonly paused?: boolean
}

export interface PearlCurrentSnapshot {
  readonly settings: NormalizedPearlCurrentConfig
  readonly response: PearlCurrentResponse
  readonly progress: number
  readonly particles: number
  readonly renderedTriangles: number
  readonly estimatedGeometryMiB: number
}

export interface PearlCurrentInterior {
  readonly group: Group
  update(input: PearlCurrentUpdate): void
  configure(config: Pick<PearlCurrentConfig, 'reducedMotion'>): void
  reset(): void
  snapshot(): PearlCurrentSnapshot
  dispose(): void
}

interface StreamRender {
  readonly spec: PearlCurrentStream
  readonly curve: CatmullRomCurve3
  readonly mesh: Mesh<TubeGeometry, MeshPhysicalMaterial>
  readonly position: BufferAttribute
  readonly normal: BufferAttribute
  readonly centers: Float32Array
  readonly radials: Float32Array
  readonly tangents: Float32Array
  readonly progress: Float32Array
  readonly progressPerMetre: number
}

interface RenderState {
  readonly streams: readonly StreamRender[]
  readonly streamById: ReadonlyMap<string, StreamRender>
  readonly sphereGeometry: SphereGeometry
  readonly droplets: InstancedMesh<SphereGeometry, MeshPhysicalMaterial>
  readonly junctions: InstancedMesh<SphereGeometry, MeshPhysicalMaterial>
  readonly charges: InstancedMesh<SphereGeometry, MeshPhysicalMaterial>
}

interface Materials {
  readonly streams: readonly [
    MeshPhysicalMaterial,
    MeshPhysicalMaterial,
    MeshPhysicalMaterial,
  ]
  readonly droplet: MeshPhysicalMaterial
  readonly junction: MeshPhysicalMaterial
  readonly charge: MeshPhysicalMaterial
  readonly all: readonly MeshPhysicalMaterial[]
}

const TAU = Math.PI * 2
const WORLD_UP = new Vector3(0, 1, 0)
const WORLD_FORWARD = new Vector3(0, 0, 1)
const IDENTITY_QUATERNION = new Quaternion()

export function createPearlCurrentInterior(
  config: PearlCurrentConfig = {},
): PearlCurrentInterior {
  let settings = normalizePearlCurrentConfig(config)
  const layout = createPearlCurrentLayout(settings)
  const quality = PEARL_CURRENT_QUALITY_CONFIG[settings.quality]
  const budget = pearlCurrentRenderBudget(layout, settings.quality)
  if (
    budget.renderedTriangles > quality.maximumRenderedTriangles ||
    budget.beads > quality.maximumBeads
  )
    throw new Error('Pearl Current authored layout exceeds its quality budget.')

  const group = new Group()
  group.name = 'pearl-current-interior'
  group.userData.excludeFromCameraCollision = true
  const materials = createMaterials(settings)
  const state = createRenderState(group, layout, settings, materials)
  const geometryMiB = estimateGeometryMiB(state)
  const seedPhase = seededPhase(settings.seed)
  const scratch = {
    matrix: new Matrix4(),
    position: new Vector3(),
    tangent: new Vector3(),
    side: new Vector3(),
    up: new Vector3(),
    scale: new Vector3(),
    centre: new Vector3(),
    tangentStart: new Vector3(),
    tangentEnd: new Vector3(),
    responseQuaternion: new Quaternion(),
  }
  let clock = 0
  let response: PearlCurrentResponse = 'rest'
  let progress = 0
  let responseStrength = 1
  let renderedClock: number | undefined
  let renderedResponse: PearlCurrentResponse | undefined
  let renderedProgress: number | undefined
  let renderedStrength: number | undefined
  let disposed = false

  function setInstance(
    mesh: InstancedMesh,
    index: number,
    position: Vector3,
    scale: number,
  ): void {
    scratch.scale.setScalar(scale)
    scratch.matrix.compose(position, IDENTITY_QUATERNION, scratch.scale)
    mesh.setMatrixAt(index, scratch.matrix)
  }

  function setOrientedPulse(
    mesh: InstancedMesh,
    index: number,
    position: Vector3,
    tangent: Vector3,
    scale: number,
  ): void {
    scratch.responseQuaternion.setFromUnitVectors(WORLD_FORWARD, tangent)
    scratch.scale.set(scale * 0.68, scale * 0.68, scale)
    scratch.matrix.compose(position, scratch.responseQuaternion, scratch.scale)
    mesh.setMatrixAt(index, scratch.matrix)
  }

  function renderPearls(factors: PearlCurrentResponseFactors): void {
    let instance = 0
    for (const droplet of layout.droplets) {
      const stream = state.streamById.get(droplet.streamId)!
      const pathT = fract(droplet.pathT + clock * droplet.driftRate)
      stream.curve.getPointAt(pathT, scratch.position)
      stream.curve.getPointAt(Math.max(0, pathT - 0.002), scratch.tangentStart)
      stream.curve.getPointAt(Math.min(1, pathT + 0.002), scratch.tangentEnd)
      scratch.tangent
        .subVectors(scratch.tangentEnd, scratch.tangentStart)
        .normalize()
      makeFrame(scratch.tangent, scratch.side, scratch.up)
      const orbit = droplet.phase + clock * (0.72 + droplet.driftRate * 8)
      const offset = stream.spec.radius * 0.82 + droplet.size * 0.3
      scratch.position.addScaledVector(scratch.side, Math.cos(orbit) * offset)
      scratch.position.addScaledVector(
        scratch.up,
        Math.sin(orbit) * offset * 0.7,
      )
      const networkProgress =
        stream.spec.startProgress +
        (stream.spec.endProgress - stream.spec.startProgress) * pathT
      const pulse = responseScaleAt(networkProgress, factors)
      const size =
        droplet.size * (1 + Math.sin(orbit * 1.7) * 0.07 + pulse * 0.16)
      setInstance(state.droplets, instance++, scratch.position, size)
    }
    for (const terminal of layout.terminals) {
      scratch.position.fromArray(terminal.point)
      const stream = state.streamById.get(terminal.streamId)!
      const networkProgress =
        terminal.pathT === 0
          ? stream.spec.startProgress
          : stream.spec.endProgress
      setInstance(
        state.droplets,
        instance++,
        scratch.position,
        terminal.radius * (1 + responseScaleAt(networkProgress, factors) * 0.1),
      )
    }
    state.droplets.instanceMatrix.needsUpdate = true
  }

  function renderJunctions(factors: PearlCurrentResponseFactors): void {
    layout.junctions.forEach((junction, index) => {
      scratch.position.fromArray(junction.point)
      setInstance(
        state.junctions,
        index,
        scratch.position,
        junction.radius *
          (1 + responseScaleAt(junction.progress, factors) * 0.12),
      )
    })
    state.junctions.instanceMatrix.needsUpdate = true
  }

  function renderCharges(factors: PearlCurrentResponseFactors): void {
    const front =
      response === 'charge'
        ? factors.chargeProgress
        : response === 'release'
          ? factors.releaseProgress
          : -1
    const responseStrength =
      response === 'charge'
        ? factors.chargeStrength
        : response === 'release'
          ? factors.releaseStrength
          : 0
    if (response === 'charge') {
      materials.charge.color.setHex(settings.palette.gold)
      materials.charge.emissive.setHex(settings.palette.glow)
      materials.charge.metalness = 0.68
      materials.charge.iridescence = 0.22
    } else if (response === 'release') {
      materials.charge.color.setHex(settings.palette.release)
      materials.charge.emissive.setHex(settings.palette.glow)
      materials.charge.metalness = 0.22
      materials.charge.iridescence = 0.72
    }
    state.streams.forEach((stream, index) => {
      const span = stream.spec.endProgress - stream.spec.startProgress
      const onPath =
        responseStrength > 0 &&
        front >= stream.spec.startProgress - 1e-6 &&
        front <= stream.spec.endProgress + 1e-6
      if (!onPath) {
        scratch.position.fromArray(stream.spec.points[0]!)
        setInstance(
          state.charges,
          index,
          scratch.position,
          PEARL_CURRENT_HIDDEN_SCALE,
        )
        return
      }
      const pathT = Math.min(
        1,
        Math.max(0, (front - stream.spec.startProgress) / span),
      )
      stream.curve.getPointAt(pathT, scratch.position)
      const size = pearlCurrentChargeRadius(
        stream.spec.radius,
        responseStrength,
      )
      if (response === 'release') {
        stream.curve.getPointAt(
          Math.max(0, pathT - 0.002),
          scratch.tangentStart,
        )
        stream.curve.getPointAt(Math.min(1, pathT + 0.002), scratch.tangentEnd)
        scratch.tangent
          .subVectors(scratch.tangentEnd, scratch.tangentStart)
          .normalize()
        setOrientedPulse(
          state.charges,
          index,
          scratch.position,
          scratch.tangent,
          size,
        )
      } else setInstance(state.charges, index, scratch.position, size)
    })
    state.charges.instanceMatrix.needsUpdate = true
  }

  function renderFrame(factors: PearlCurrentResponseFactors): void {
    for (const stream of state.streams)
      deformStream(stream, clock, seedPhase, factors)
    renderPearls(factors)
    renderJunctions(factors)
    renderCharges(factors)
  }

  function renderIfChanged(): void {
    const strength = responseStrength * Math.min(1, settings.intensity / 1.5)
    if (
      renderedClock === clock &&
      renderedResponse === response &&
      renderedProgress === progress &&
      renderedStrength === strength
    )
      return
    renderFrame(pearlCurrentResponseFactors(response, progress, strength))
    renderedClock = clock
    renderedResponse = response
    renderedProgress = progress
    renderedStrength = strength
  }

  renderIfChanged()

  return {
    group,
    update(input): void {
      if (disposed) throw new Error('Pearl Current interior is disposed.')
      const deltaSeconds = finiteNonNegative(input.deltaSeconds, 'deltaSeconds')
      response = input.response
      progress = unit(input.progress, 'progress')
      responseStrength = unit(input.strength ?? 1, 'strength')
      if (!settings.reducedMotion && input.paused !== true && deltaSeconds > 0)
        clock += Math.min(0.1, deltaSeconds) * settings.speed
      renderIfChanged()
    },
    configure(next): void {
      if (disposed) throw new Error('Pearl Current interior is disposed.')
      settings = {
        ...settings,
        reducedMotion: next.reducedMotion ?? settings.reducedMotion,
      }
      renderIfChanged()
    },
    reset(): void {
      if (disposed) throw new Error('Pearl Current interior is disposed.')
      clock = 0
      response = 'rest'
      progress = 0
      responseStrength = 1
      renderIfChanged()
    },
    snapshot(): PearlCurrentSnapshot {
      return {
        settings,
        response,
        progress,
        particles: budget.beads,
        renderedTriangles: budget.renderedTriangles,
        estimatedGeometryMiB: geometryMiB,
      }
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      group.removeFromParent()
      for (const stream of state.streams) stream.mesh.geometry.dispose()
      state.droplets.dispose()
      state.junctions.dispose()
      state.charges.dispose()
      state.sphereGeometry.dispose()
      materials.all.forEach((material) => material.dispose())
      group.clear()
    },
  }
}

function createRenderState(
  group: Group,
  layout: PearlCurrentLayout,
  settings: NormalizedPearlCurrentConfig,
  materials: Materials,
): RenderState {
  const quality = PEARL_CURRENT_QUALITY_CONFIG[settings.quality]
  const centre = new Vector3()
  const tangent = new Vector3()
  const streams = layout.streams.map((spec): StreamRender => {
    const curve = new CatmullRomCurve3(
      spec.points.map((point) => new Vector3(...point)),
      false,
      'centripetal',
      0.5,
    )
    const tubularSegments = pearlCurrentSegmentsFor(spec.role, quality)
    const geometry = new TubeGeometry(
      curve,
      tubularSegments,
      spec.radius,
      quality.radialSegments,
      false,
    )
    geometry.name = `pearl-current-geometry-${spec.id}`
    const position = geometry.getAttribute('position') as BufferAttribute
    const normal = geometry.getAttribute('normal') as BufferAttribute
    position.setUsage(DynamicDrawUsage)
    normal.setUsage(DynamicDrawUsage)
    const centers = new Float32Array(position.count * 3)
    const radials = new Float32Array(position.count * 3)
    const tangents = new Float32Array(position.count * 3)
    const progress = new Float32Array(position.count)
    const positionArray = position.array as Float32Array
    const verticesPerRing = quality.radialSegments + 1
    for (let ring = 0; ring <= tubularSegments; ring++) {
      const pathT = ring / tubularSegments
      curve.getPointAt(pathT, centre)
      curve.getTangentAt(pathT, tangent).normalize()
      const networkProgress =
        spec.startProgress + (spec.endProgress - spec.startProgress) * pathT
      for (let radial = 0; radial < verticesPerRing; radial++) {
        const vertex = ring * verticesPerRing + radial
        const offset = vertex * 3
        centers[offset] = centre.x
        centers[offset + 1] = centre.y
        centers[offset + 2] = centre.z
        const dx = positionArray[offset]! - centre.x
        const dy = positionArray[offset + 1]! - centre.y
        const dz = positionArray[offset + 2]! - centre.z
        const inverseLength = 1 / Math.max(1e-8, Math.hypot(dx, dy, dz))
        radials[offset] = dx * inverseLength
        radials[offset + 1] = dy * inverseLength
        radials[offset + 2] = dz * inverseLength
        tangents[offset] = tangent.x
        tangents[offset + 1] = tangent.y
        tangents[offset + 2] = tangent.z
        progress[vertex] = networkProgress
      }
    }
    const mesh = new Mesh(geometry, materials.streams[spec.colorIndex])
    mesh.name = `pearl-current-stream-${spec.id}`
    mesh.frustumCulled = false
    mesh.userData.excludeFromCameraCollision = true
    group.add(mesh)
    return {
      spec,
      curve,
      mesh,
      position,
      normal,
      centers,
      radials,
      tangents,
      progress,
      progressPerMetre:
        (spec.endProgress - spec.startProgress) /
        Math.max(1e-6, curve.getLength()),
    }
  })
  const sphereGeometry = new SphereGeometry(
    1,
    quality.sphereWidthSegments,
    quality.sphereHeightSegments,
  )
  sphereGeometry.name = 'pearl-current-shared-bead-geometry'
  const droplets = instanceMesh(
    'pearl-current-pearl-beads',
    sphereGeometry,
    materials.droplet,
    layout.droplets.length + layout.terminals.length,
  )
  const junctions = instanceMesh(
    'pearl-current-gold-junctions',
    sphereGeometry,
    materials.junction,
    layout.junctions.length,
  )
  const charges = instanceMesh(
    'pearl-current-response-band',
    sphereGeometry,
    materials.charge,
    streams.length,
  )
  group.add(droplets, junctions, charges)
  return {
    streams,
    streamById: new Map(streams.map((stream) => [stream.spec.id, stream])),
    sphereGeometry,
    droplets,
    junctions,
    charges,
  }
}

function instanceMesh(
  name: string,
  geometry: SphereGeometry,
  material: MeshPhysicalMaterial,
  count: number,
): InstancedMesh<SphereGeometry, MeshPhysicalMaterial> {
  const mesh = new InstancedMesh(geometry, material, count)
  mesh.name = name
  mesh.frustumCulled = false
  mesh.instanceMatrix.setUsage(DynamicDrawUsage)
  mesh.userData.excludeFromCameraCollision = true
  return mesh
}

function createMaterials(settings: NormalizedPearlCurrentConfig): Materials {
  const streams = settings.palette.streams.map(
    (stream, index) =>
      new MeshPhysicalMaterial({
        name: `pearl-current-stream-material-${index}`,
        color: stream,
        emissive: new Color(stream).multiplyScalar(0.16),
        emissiveIntensity: 0.025 + settings.intensity * 0.018,
        envMapIntensity: 1.05 + settings.intensity * 0.24,
        metalness: 0.055,
        roughness: 0.155,
        clearcoat: 0.95,
        clearcoatRoughness: 0.055,
        iridescence: 0.82,
        iridescenceIOR: 1.31,
        iridescenceThicknessRange: [120, 350],
        sheen: 0.3,
        sheenRoughness: 0.42,
        sheenColor: settings.palette.sheen,
        side: FrontSide,
      }),
  ) as [MeshPhysicalMaterial, MeshPhysicalMaterial, MeshPhysicalMaterial]
  const droplet = new MeshPhysicalMaterial({
    name: 'pearl-current-droplet-material',
    color: settings.palette.pearl,
    emissive: new Color(settings.palette.pearl).multiplyScalar(0.12),
    emissiveIntensity: 0.04 + settings.intensity * 0.025,
    envMapIntensity: 1.2 + settings.intensity * 0.3,
    metalness: 0.035,
    roughness: 0.105,
    clearcoat: 1,
    clearcoatRoughness: 0.045,
    iridescence: 1,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [100, 390],
    sheen: 0.42,
    sheenRoughness: 0.32,
    sheenColor: settings.palette.sheen,
    side: FrontSide,
  })
  const junction = new MeshPhysicalMaterial({
    name: 'pearl-current-junction-material',
    color: settings.palette.gold,
    emissive: new Color(settings.palette.glow).multiplyScalar(0.2),
    emissiveIntensity: 0.08 + settings.intensity * 0.08,
    metalness: 0.82,
    roughness: 0.18,
    clearcoat: 0.7,
    clearcoatRoughness: 0.09,
    side: FrontSide,
  })
  const charge = new MeshPhysicalMaterial({
    name: 'pearl-current-response-material',
    color: settings.palette.glow,
    emissive: new Color(settings.palette.glow).multiplyScalar(0.35),
    emissiveIntensity: 0.28 + settings.intensity * 0.26,
    metalness: 0.45,
    roughness: 0.1,
    clearcoat: 1,
    clearcoatRoughness: 0.035,
    iridescence: 0.3,
    iridescenceThicknessRange: [130, 230],
    side: FrontSide,
  })
  return {
    streams,
    droplet,
    junction,
    charge,
    all: [...streams, droplet, junction, charge],
  }
}

function deformStream(
  stream: StreamRender,
  clock: number,
  seedPhase: number,
  response: PearlCurrentResponseFactors,
): void {
  const positions = stream.position.array as Float32Array
  const normals = stream.normal.array as Float32Array
  for (let vertex = 0; vertex < stream.position.count; vertex++) {
    const offset = vertex * 3
    const progress = stream.progress[vertex]!
    const phase = clock * 1.22 - progress * TAU * 1.72 + seedPhase
    let radiusFactor = 1 + Math.sin(phase) * 0.026
    let derivative = -Math.cos(phase) * 0.026 * TAU * 1.72
    if (response.chargeStrength > 0) {
      const delta = progress - response.chargeProgress
      const band = Math.exp(-(delta * delta) / (0.052 * 0.052))
      const amplitude = response.chargeStrength * 0.052
      radiusFactor += band * amplitude
      derivative += band * ((-2 * delta) / (0.052 * 0.052)) * amplitude
    }
    if (response.releaseStrength > 0) {
      const delta = progress - response.releaseProgress
      const band = Math.exp(-(delta * delta) / (0.04 * 0.04))
      const amplitude = response.releaseStrength * 0.14
      radiusFactor += band * amplitude
      derivative += band * ((-2 * delta) / (0.04 * 0.04)) * amplitude
    }
    if (stream.spec.role === 'tributary') {
      const span = stream.spec.endProgress - stream.spec.startProgress
      const local = (progress - stream.spec.startProgress) / span
      const taperProgress = Math.min(1, Math.max(0, (local - 0.7) / 0.3))
      const taperEase = taperProgress * taperProgress * (3 - 2 * taperProgress)
      const taper = 1 - taperEase * 0.22
      const taperDerivative =
        taperProgress > 0 && taperProgress < 1
          ? (-(6 * taperProgress * (1 - taperProgress)) / 0.3 / span) * 0.22
          : 0
      derivative = derivative * taper + radiusFactor * taperDerivative
      radiusFactor *= taper
    }
    radiusFactor = Math.min(
      PEARL_CURRENT_MAX_RADIUS_SCALE,
      Math.max(0.7, radiusFactor),
    )
    const radius = stream.spec.radius * radiusFactor
    positions[offset] =
      stream.centers[offset]! + stream.radials[offset]! * radius
    positions[offset + 1] =
      stream.centers[offset + 1]! + stream.radials[offset + 1]! * radius
    positions[offset + 2] =
      stream.centers[offset + 2]! + stream.radials[offset + 2]! * radius
    const radiusDerivative =
      stream.spec.radius * derivative * stream.progressPerMetre
    const nx =
      stream.radials[offset]! - stream.tangents[offset]! * radiusDerivative
    const ny =
      stream.radials[offset + 1]! -
      stream.tangents[offset + 1]! * radiusDerivative
    const nz =
      stream.radials[offset + 2]! -
      stream.tangents[offset + 2]! * radiusDerivative
    const inverseLength = 1 / Math.max(1e-8, Math.hypot(nx, ny, nz))
    normals[offset] = nx * inverseLength
    normals[offset + 1] = ny * inverseLength
    normals[offset + 2] = nz * inverseLength
  }
  stream.position.needsUpdate = true
  stream.normal.needsUpdate = true
}

function responseScaleAt(
  progress: number,
  response: PearlCurrentResponseFactors,
): number {
  const chargeDelta = progress - response.chargeProgress
  const releaseDelta = progress - response.releaseProgress
  return (
    Math.exp(-(chargeDelta * chargeDelta) / (0.06 * 0.06)) *
      response.chargeStrength +
    Math.exp(-(releaseDelta * releaseDelta) / (0.045 * 0.045)) *
      response.releaseStrength
  )
}

function makeFrame(tangent: Vector3, side: Vector3, up: Vector3): void {
  side.crossVectors(tangent, WORLD_UP)
  if (side.lengthSq() < 1e-6) side.crossVectors(tangent, WORLD_FORWARD)
  side.normalize()
  up.crossVectors(side, tangent).normalize()
}

function estimateGeometryMiB(state: RenderState): number {
  let bytes = 0
  const geometries = new Set<BufferGeometry>([
    state.sphereGeometry,
    ...state.streams.map((stream) => stream.mesh.geometry),
  ])
  for (const geometry of geometries) {
    for (const attribute of Object.values(geometry.attributes))
      bytes += attribute.array.byteLength
    bytes += geometry.index?.array.byteLength ?? 0
  }
  for (const stream of state.streams)
    bytes +=
      stream.centers.byteLength +
      stream.radials.byteLength +
      stream.tangents.byteLength +
      stream.progress.byteLength
  bytes +=
    state.droplets.instanceMatrix.array.byteLength +
    state.junctions.instanceMatrix.array.byteLength +
    state.charges.instanceMatrix.array.byteLength
  return Math.round((bytes / 1024 ** 2) * 100) / 100
}

function seededPhase(seed: number): number {
  let value = (seed ^ 0x9e37_79b9) >>> 0
  value = Math.imul(value ^ (value >>> 16), 0x21f0_aaad)
  value = Math.imul(value ^ (value >>> 15), 0x735a_2d97)
  value ^= value >>> 15
  return ((value >>> 0) / 0x1_0000_0000) * TAU
}

function fract(value: number): number {
  return value - Math.floor(value)
}

function finiteNonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0)
    throw new Error(`Pearl Current ${label} must be finite and non-negative.`)
  return value
}

function unit(value: number, label: string): number {
  if (!Number.isFinite(value))
    throw new Error(`Pearl Current ${label} must be finite.`)
  return Math.min(1, Math.max(0, value))
}
