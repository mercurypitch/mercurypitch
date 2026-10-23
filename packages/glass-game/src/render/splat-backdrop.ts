// ============================================================
// Splat backdrop — a Gaussian splat world drawn as Cloudway's living sky plate.
// ============================================================
//
// Development spike. The painted sky plate and the splat world render into
// one sRGB target each frame, and that target replaces the plate as the scene
// background and the backdrop-fog source. Three things follow from drawing
// the splats as a background layer instead of into the main pass:
//   - fogged platforms still dissolve into whatever is behind them, because
//     backdrop fog samples this target;
//   - glass refracts the splats, because three's transmission pass draws the
//     scene background into its refraction image;
//   - splats never sort against gameplay meshes. The route always stands in
//     front of its backdrop, so nothing is lost.
// Spark is imported only by development builds. Production bundles contain no
// splat renderer until this graduates from the spike.

import type * as Spark from '@sparkjsdev/spark'
import type { Texture, WebGLRenderer } from 'three'
import { Color, LinearFilter, PerspectiveCamera, Quaternion, Scene, SRGBColorSpace, UnsignedByteType, Vector2, Vector3, WebGLRenderTarget, } from 'three'
import type { LevelDefinition } from '../contracts'
import { CLOUDWAY_FOG_COLOR } from './cloudway-scene'
import type { GlassRenderQualityProfile } from './render-quality'
import type { SplatBackdropRequest } from './splat-backdrop-request'
import { createSplatBackdropWorld } from './splat-backdrop-world'

/** Far enough for the outer island ring; the main camera's far plane is not used. */
const BACKDROP_FAR_METERS = 600
const RESOLUTION_SCALE: Record<GlassRenderQualityProfile, number> = {
  high: 1,
  balanced: 0.75,
}
const PROCEDURAL_DENSITY: Record<GlassRenderQualityProfile, number> = {
  high: 1,
  balanced: 0.6,
}
const LOD_SPLAT_SCALE: Record<GlassRenderQualityProfile, number> = {
  high: 1,
  balanced: 0.5,
}

export interface SplatBackdropStatus {
  readonly splats: number
}

export interface SplatBackdrop {
  /** Scene background and backdrop-fog source; shows the plate until splats load. */
  readonly texture: Texture
  /** Splats are drawing; `null` when disposed first. Rejects if loading failed. */
  readonly ready: Promise<SplatBackdropStatus | null>
  setSky(texture: Texture): void
  setQuality(profile: GlassRenderQualityProfile): void
  /** Call once per frame with the final camera, before the main scene renders. */
  render(renderer: WebGLRenderer, camera: PerspectiveCamera): void
  dispose(): void
}

// Type-only: the runtime import below stays dynamic and development-only.
type SparkModule = typeof Spark

async function loadSpark(): Promise<SparkModule> {
  if (!import.meta.env.DEV)
    throw new Error('Splat backdrops are a development preview.')
  return import('@sparkjsdev/spark')
}

/** Route centre and horizontal radius from the level's authored world bounds. */
export function splatBackdropFrame(level: LevelDefinition): {
  centre: { x: number; y: number; z: number }
  routeRadius: number
} {
  const bounds = level.presentation?.worldBounds
  if (bounds === undefined)
    return { centre: { x: 0, y: 0, z: 0 }, routeRadius: 12 }
  return {
    centre: {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
      z: (bounds.minZ + bounds.maxZ) / 2,
    },
    routeRadius:
      Math.hypot(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) / 2,
  }
}

export function createSplatBackdrop(
  request: SplatBackdropRequest,
  level: LevelDefinition,
  renderer: WebGLRenderer,
  profile: GlassRenderQualityProfile,
): SplatBackdrop {
  const scene = new Scene()
  scene.background = new Color(CLOUDWAY_FOG_COLOR)
  const camera = new PerspectiveCamera()
  // Linear shader output is encoded by the sRGB attachment, matching how the
  // painted plate is sampled and how backdrop fog reads its texels.
  const target = new WebGLRenderTarget(1, 1, {
    type: UnsignedByteType,
    colorSpace: SRGBColorSpace,
    depthBuffer: false,
    generateMipmaps: false,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
  })
  const drawingBuffer = new Vector2()
  let resolutionScale = RESOLUTION_SCALE[profile]
  let disposed = false
  let releaseSplats: (() => void) | undefined
  let setLodScale: ((scale: number) => void) | undefined
  const frame = splatBackdropFrame(level)

  const ready = loadSpark().then(async (spark) => {
    if (disposed) return null
    const sparkRenderer = new spark.SparkRenderer({
      renderer,
      maxStdDev: Math.sqrt(6),
      lodSplatScale: LOD_SPLAT_SCALE[profile],
    })
    const mesh =
      request.kind === 'procedural'
        ? proceduralMesh(
            spark,
            request.seed,
            frame,
            PROCEDURAL_DENSITY[profile],
          )
        : fileMesh(spark, request, frame.centre)
    scene.add(sparkRenderer, mesh)
    releaseSplats = () => {
      scene.remove(sparkRenderer, mesh)
      mesh.dispose()
      sparkRenderer.dispose()
    }
    setLodScale = (scale) => {
      sparkRenderer.lodSplatScale = scale
    }
    await mesh.initialized
    if (disposed) return null
    return { splats: mesh.numSplats }
  })

  return {
    texture: target.texture,
    ready,
    setSky(texture) {
      if (!disposed) scene.background = texture
    },
    setQuality(next) {
      resolutionScale = RESOLUTION_SCALE[next]
      setLodScale?.(LOD_SPLAT_SCALE[next])
    },
    render(activeRenderer, viewCamera) {
      if (disposed) return
      activeRenderer.getDrawingBufferSize(drawingBuffer)
      const width = Math.max(1, Math.round(drawingBuffer.x * resolutionScale))
      const height = Math.max(1, Math.round(drawingBuffer.y * resolutionScale))
      if (target.width !== width || target.height !== height)
        target.setSize(width, height)
      camera.copy(viewCamera, false)
      camera.far = BACKDROP_FAR_METERS
      camera.updateProjectionMatrix()
      const previous = activeRenderer.getRenderTarget()
      activeRenderer.setRenderTarget(target)
      try {
        activeRenderer.render(scene, camera)
      } finally {
        activeRenderer.setRenderTarget(previous)
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      releaseSplats?.()
      scene.background = null
      target.dispose()
    },
  }
}

function proceduralMesh(
  spark: SparkModule,
  seed: number,
  frame: ReturnType<typeof splatBackdropFrame>,
  density: number,
) {
  const world = createSplatBackdropWorld({ seed, ...frame, density })
  const centre = new Vector3()
  const scales = new Vector3()
  const quaternion = new Quaternion()
  const color = new Color()
  return new spark.SplatMesh({
    constructSplats: (splats) => {
      for (let i = 0; i < world.count; i++) {
        centre.fromArray(world.centres, i * 3)
        scales.fromArray(world.scales, i * 3)
        quaternion.fromArray(world.quaternions, i * 4)
        // Spark stores sRGB values and linearizes them when it draws.
        color.setRGB(
          world.colors[i * 3],
          world.colors[i * 3 + 1],
          world.colors[i * 3 + 2],
        )
        splats.pushSplat(centre, scales, quaternion, world.opacities[i], color)
      }
    },
  })
}

function fileMesh(
  spark: SparkModule,
  request: Extract<SplatBackdropRequest, { kind: 'url' }>,
  centre: { x: number; y: number; z: number },
) {
  const mesh = new spark.SplatMesh({
    url: request.url,
    // A prebuilt .rad level-of-detail tree streams by HTTP Range requests.
    paged: /\.rad(?:$|[?#])/i.test(request.url),
  })
  // Marble and most capture tools write OpenCV axes (+y down, +z forward);
  // a half turn around X maps them onto three.js.
  mesh.quaternion.set(1, 0, 0, 0)
  mesh.scale.setScalar(request.scale)
  mesh.position.set(centre.x, centre.y + request.offsetY, centre.z)
  return mesh
}
