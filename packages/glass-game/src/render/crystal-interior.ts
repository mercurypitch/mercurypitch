// Living crystal interiors — build one batched, bounded, animated Three.js effect with deterministic lifecycle controls.

import type { IUniform } from 'three'
import { BufferAttribute, BufferGeometry, CatmullRomCurve3, Color, Float32BufferAttribute, Group, Mesh, Points, PointsMaterial, ShaderMaterial, TubeGeometry, Vector3, } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { CrystalInteriorPalette, CrystalInteriorSettings, NormalizedCrystalInteriorSettings, } from './crystal-interior-config'
import { crystalInteriorRetractionMapping, normalizeCrystalInteriorSettings, } from './crystal-interior-config'
import type { CrystalInteriorLayout, CrystalInteriorPath, } from './crystal-interior-geometry'
import { generateCrystalInteriorLayout } from './crystal-interior-geometry'

export interface CrystalInteriorUpdate {
  readonly deltaSeconds: number
  readonly paused?: boolean
  readonly scrollVisibleFraction?: number
}

export interface CrystalInteriorTuning {
  readonly palette?: Partial<CrystalInteriorPalette>
  readonly intensity?: number
  readonly speed?: number
  readonly reducedMotion?: boolean
}

export interface CrystalInteriorCost {
  readonly drawCalls: number
  readonly triangles: number
  readonly vertices: number
  readonly geometryBytes: number
  readonly textures: 0
}

export interface CrystalInteriorSnapshot {
  readonly preset: NormalizedCrystalInteriorSettings['preset']
  readonly seed: number
  readonly elapsedSeconds: number
  readonly paused: boolean
  readonly scrollVisibleFraction: number
  /** Maximum object-space displacement applied by the vertex shader, in metres. */
  readonly maximumAnimatedDisplacement: number
  readonly settings: NormalizedCrystalInteriorSettings
  readonly cost: CrystalInteriorCost
}

export interface CrystalInteriorEffect {
  readonly root: Group
  update(update: CrystalInteriorUpdate): void
  configure(tuning: CrystalInteriorTuning): void
  reset(): void
  snapshot(): CrystalInteriorSnapshot
  dispose(): void
}

interface CrystalUniforms extends Record<string, IUniform> {
  readonly uTime: { value: number }
  readonly uIntensity: { value: number }
  readonly uVisibility: { value: number }
  readonly uMotion: { value: number }
  readonly uDrift: { value: number }
  readonly uPrimary: { value: Color }
  readonly uSecondary: { value: Color }
  readonly uAccent: { value: Color }
}

const VERTEX_SHADER = /* glsl */ `
  attribute float interiorPhase;
  attribute float interiorPalette;
  uniform float uTime;
  uniform float uMotion;
  uniform float uDrift;
  varying float vPhase;
  varying float vPalette;
  varying vec3 vNormal;
  varying vec3 vViewDirection;

  void main() {
    vPhase = interiorPhase;
    vPalette = interiorPalette;
    vNormal = normalize(normalMatrix * normal);
    vec3 moved = position;
    float wave = sin(position.x * 7.0 + interiorPhase * 6.2831853 + uTime * 0.7);
    moved += normal * wave * uDrift * uMotion;
    vec4 viewPosition = modelViewMatrix * vec4(moved, 1.0);
    vViewDirection = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uVisibility;
  uniform float uMotion;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform vec3 uAccent;
  varying float vPhase;
  varying float vPalette;
  varying vec3 vNormal;
  varying vec3 vViewDirection;

  float circularDistance(float a, float b) {
    float d = abs(fract(a) - fract(b));
    return min(d, 1.0 - d);
  }

  void main() {
    vec3 palette = vPalette < 0.5
      ? uPrimary
      : (vPalette < 1.5 ? uSecondary : uAccent);
    float cursor = fract(uTime * 0.15 * uMotion);
    float pulse = exp(-pow(circularDistance(vPhase, cursor) / 0.105, 2.0));
    float quietPulse = 0.34 + 0.14 * sin((vPhase + uTime * 0.035) * 6.2831853);
    float envelope = mix(quietPulse, 0.2 + pulse, uMotion);
    vec3 normal = normalize(vNormal);
    float facing = abs(dot(normal, normalize(vViewDirection)));
    float edge = pow(1.0 - facing, 1.15);
    vec3 saturatedCore = palette * (0.34 + envelope * 0.24);
    vec3 brightEdge = mix(palette, vec3(1.0), 0.18) * (1.05 + envelope * 1.35);
    vec3 color = mix(saturatedCore, brightEdge, 0.22 + edge * 0.78);
    color *= uIntensity * uVisibility;
    gl_FragColor = vec4(clamp(color, 0.0, 4.0), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

function finite(value: number, label: string): number {
  if (!Number.isFinite(value))
    throw new Error(`Crystal interior ${label} must be finite.`)
  return value
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function colorValue(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback
  if (!Number.isInteger(value) || value < 0 || value > 0xffffff)
    throw new Error(
      'Crystal interior palette values must be 24-bit RGB integers.',
    )
  return value
}

function colorFromHex(value: number): Color {
  return new Color(value)
}

function updateUniformPalette(
  uniforms: CrystalUniforms,
  palette: CrystalInteriorPalette,
): void {
  uniforms.uPrimary.value.setHex(palette.primary)
  uniforms.uSecondary.value.setHex(palette.secondary)
  uniforms.uAccent.value.setHex(palette.accent)
}

function pathGeometry(
  path: CrystalInteriorPath,
  radialSegments: number,
): BufferGeometry[] {
  const result: BufferGeometry[] = []
  const segmentCount = path.points.length - 1
  for (let segment = 0; segment < segmentCount; segment += 1) {
    const start = path.points[segment]!
    const end = path.points[segment + 1]!
    const curve = new CatmullRomCurve3([
      new Vector3(start[0], start[1], start[2]),
      new Vector3(end[0], end[1], end[2]),
    ])
    const tubularSegments = path.kind === 'ribbon' ? 4 : 2
    const radius =
      path.kind === 'tube'
        ? path.radius * (1 - (segment / Math.max(1, segmentCount)) * 0.36)
        : path.radius
    const geometry = new TubeGeometry(
      curve,
      tubularSegments,
      radius,
      radialSegments,
      false,
    )
    const count = geometry.getAttribute('position').count
    const phase = new Float32Array(count)
    const palette = new Float32Array(count)
    const ring = radialSegments + 1
    for (let vertex = 0; vertex < count; vertex += 1) {
      const alongSegment = Math.floor(vertex / ring) / tubularSegments
      phase[vertex] =
        path.phaseOffset + (segment + alongSegment) / Math.max(1, segmentCount)
      palette[vertex] = path.paletteIndex
    }
    geometry.setAttribute('interiorPhase', new BufferAttribute(phase, 1))
    geometry.setAttribute('interiorPalette', new BufferAttribute(palette, 1))
    result.push(geometry)
  }
  return result
}

function mergedPathGeometry(
  layout: CrystalInteriorLayout,
  settings: NormalizedCrystalInteriorSettings,
): BufferGeometry {
  const radialSegments = settings.quality === 'mobile' ? 4 : 7
  const parts = layout.paths.flatMap((path) =>
    pathGeometry(path, radialSegments),
  )
  const merged = mergeGeometries(parts, false)
  parts.forEach((geometry) => geometry.dispose())
  if (merged === null)
    throw new Error('Crystal interior geometry could not be merged.')
  merged.name = `${settings.preset}__batched-static-geometry`
  merged.computeBoundingBox()
  merged.computeBoundingSphere()
  return merged
}

function sparkleGeometry(layout: CrystalInteriorLayout): BufferGeometry | null {
  if (layout.sparkles.length === 0) return null
  const positions = new Float32Array(layout.sparkles.length * 3)
  layout.sparkles.forEach((sparkle, index) => {
    positions[index * 3] = sparkle.position[0]
    positions[index * 3 + 1] = sparkle.position[1]
    positions[index * 3 + 2] = sparkle.position[2]
  })
  const geometry = new BufferGeometry()
  geometry.name = 'frost-roots__sparkles'
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

function bufferBytes(attribute: BufferAttribute): number {
  return attribute.array.byteLength
}

function geometryCost(root: Group): CrystalInteriorCost {
  let drawCalls = 0
  let triangles = 0
  let vertices = 0
  let geometryBytes = 0
  const seen = new Set<BufferGeometry>()
  root.traverse((object) => {
    const renderable = object as unknown as {
      readonly isMesh?: boolean
      readonly isPoints?: boolean
      readonly geometry?: BufferGeometry
    }
    if (renderable.isMesh !== true && renderable.isPoints !== true) return
    drawCalls += 1
    const geometry = renderable.geometry
    if (geometry === undefined || seen.has(geometry)) return
    seen.add(geometry)
    const position = geometry.getAttribute('position')
    vertices += position?.count ?? 0
    if (renderable.isMesh === true)
      triangles += geometry.index
        ? geometry.index.count / 3
        : (position?.count ?? 0) / 3
    if (geometry.index !== null)
      geometryBytes += geometry.index.array.byteLength
    for (const attribute of Object.values(geometry.attributes))
      geometryBytes += bufferBytes(attribute as BufferAttribute)
  })
  return {
    drawCalls,
    triangles,
    vertices,
    geometryBytes,
    textures: 0,
  }
}

function maximumAnimatedDisplacement(
  geometry: BufferGeometry,
  settings: NormalizedCrystalInteriorSettings,
): number {
  if (settings.preset !== 'aurora-heart') return 0
  const box = geometry.boundingBox
  if (box === null)
    throw new Error('Crystal interior geometry must have a bounding box.')
  const { width, height, depth, center, inset } = settings.envelope
  const outerMinimum = [
    center[0] - width / 2,
    center[1] - height / 2,
    center[2] - depth / 2,
  ] as const
  const outerMaximum = [
    center[0] + width / 2,
    center[1] + height / 2,
    center[2] + depth / 2,
  ] as const
  const staticMinimum = [box.min.x, box.min.y, box.min.z] as const
  const staticMaximum = [box.max.x, box.max.y, box.max.z] as const
  const clearance = Math.min(
    ...outerMinimum.map((value, axis) => staticMinimum[axis]! - value),
    ...outerMaximum.map((value, axis) => value - staticMaximum[axis]!),
  )
  if (clearance < -1e-6)
    throw new Error('Crystal interior static geometry exceeds its envelope.')
  const usableHeight = height - inset * 2
  return Math.max(0, Math.min(usableHeight * 0.035, clearance * 0.8))
}

function createUniforms(
  settings: NormalizedCrystalInteriorSettings,
  animatedDisplacement: number,
): CrystalUniforms {
  return {
    uTime: { value: 0 },
    uIntensity: { value: settings.intensity },
    uVisibility: { value: 1 },
    uMotion: { value: settings.reducedMotion ? 0 : 1 },
    uDrift: { value: animatedDisplacement },
    uPrimary: { value: colorFromHex(settings.palette.primary) },
    uSecondary: { value: colorFromHex(settings.palette.secondary) },
    uAccent: { value: colorFromHex(settings.palette.accent) },
  }
}

export function createCrystalInterior(
  requested: CrystalInteriorSettings,
): CrystalInteriorEffect {
  let settings = normalizeCrystalInteriorSettings(requested)
  const layout = generateCrystalInteriorLayout(settings)
  const root = new Group()
  root.name = `crystal-interior__${settings.preset}`
  root.userData.crystalInterior = {
    preset: settings.preset,
    seed: settings.seed,
    envelopeCoordinates:
      'platform-local metres; +Y up; center and inset are explicit',
  }
  const content = new Group()
  content.name = `${settings.preset}__retraction-remap`
  root.add(content)
  const geometry = mergedPathGeometry(layout, settings)
  const animatedDisplacement = maximumAnimatedDisplacement(geometry, settings)
  const uniforms = createUniforms(settings, animatedDisplacement)
  const material = new ShaderMaterial({
    name: `${settings.preset}__contained-emission`,
    uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: false,
    depthTest: true,
    depthWrite: true,
  })
  material.toneMapped = true
  const mesh = new Mesh(geometry, material)
  mesh.name = `${settings.preset}__batched-static-tubes`
  mesh.castShadow = false
  mesh.receiveShadow = false
  mesh.frustumCulled = true
  mesh.userData.excludeFromCameraCollision = true
  content.add(mesh)
  const sparkle = sparkleGeometry(layout)
  let points: Points | null = null
  let sparkleMaterial: PointsMaterial | null = null
  if (sparkle !== null) {
    sparkleMaterial = new PointsMaterial({
      name: 'frost-roots__sparkle-material',
      color: settings.palette.accent,
      size: settings.quality === 'mobile' ? 0.018 : 0.024,
      sizeAttenuation: true,
      transparent: true,
      opacity: settings.reducedMotion ? 0.22 : 0.5,
      depthTest: true,
      depthWrite: false,
    })
    points = new Points(sparkle, sparkleMaterial)
    points.name = 'frost-roots__bounded-sparkles'
    points.userData.excludeFromCameraCollision = true
    content.add(points)
  }
  const cost = geometryCost(root)
  let elapsedSeconds = 0
  let paused = false
  let visibleFraction = 1
  let disposed = false

  function applyFrame(): void {
    const retraction = crystalInteriorRetractionMapping(visibleFraction)
    root.visible = retraction.visible
    uniforms.uVisibility.value = retraction.visibility
    uniforms.uTime.value = elapsedSeconds * settings.speed
    uniforms.uMotion.value = settings.reducedMotion ? 0 : 1
    uniforms.uIntensity.value = settings.intensity
    if (settings.retractionAxis === 'x')
      content.scale.set(retraction.scale, 1, 1)
    else content.scale.set(1, 1, retraction.scale)
    if (sparkleMaterial !== null) {
      const shimmer = settings.reducedMotion
        ? 0.22
        : 0.3 + 0.25 * Math.sin(elapsedSeconds * settings.speed * 1.7) ** 2
      sparkleMaterial.opacity = shimmer * retraction.visibility
    }
  }

  applyFrame()
  return {
    root,
    update(update) {
      if (disposed) throw new Error('Crystal interior is disposed.')
      const delta = finite(update.deltaSeconds, 'deltaSeconds')
      if (delta < 0)
        throw new Error('Crystal interior deltaSeconds cannot be negative.')
      paused = update.paused ?? paused
      if (update.scrollVisibleFraction !== undefined)
        visibleFraction = update.scrollVisibleFraction
      if (!paused && !settings.reducedMotion) elapsedSeconds += delta
      applyFrame()
    },
    configure(tuning) {
      if (disposed) throw new Error('Crystal interior is disposed.')
      const palette = tuning.palette ?? {}
      settings = {
        ...settings,
        palette: {
          primary: colorValue(palette.primary, settings.palette.primary),
          secondary: colorValue(palette.secondary, settings.palette.secondary),
          accent: colorValue(palette.accent, settings.palette.accent),
        },
        intensity:
          tuning.intensity === undefined
            ? settings.intensity
            : clamp(finite(tuning.intensity, 'intensity'), 0, 4),
        speed:
          tuning.speed === undefined
            ? settings.speed
            : clamp(finite(tuning.speed, 'speed'), 0, 4),
        reducedMotion: tuning.reducedMotion ?? settings.reducedMotion,
      }
      updateUniformPalette(uniforms, settings.palette)
      if (sparkleMaterial !== null)
        sparkleMaterial.color.setHex(settings.palette.accent)
      applyFrame()
    },
    reset() {
      if (disposed) throw new Error('Crystal interior is disposed.')
      elapsedSeconds = 0
      paused = false
      visibleFraction = 1
      applyFrame()
    },
    snapshot() {
      if (disposed) throw new Error('Crystal interior is disposed.')
      return {
        preset: settings.preset,
        seed: settings.seed,
        elapsedSeconds,
        paused,
        scrollVisibleFraction: visibleFraction,
        maximumAnimatedDisplacement: animatedDisplacement,
        settings,
        cost,
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      geometry.dispose()
      material.dispose()
      sparkle?.dispose()
      sparkleMaterial?.dispose()
      root.clear()
      root.removeFromParent()
    },
  }
}
