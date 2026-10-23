// Glass studios — emissive-panel rooms prefiltered once at load, so every glass piece reflects and refracts the same lit studio in any room.
import type { Texture, WebGLRenderer } from 'three'
import { BackSide, CircleGeometry, Color, CylinderGeometry, DoubleSide, Mesh, MeshBasicMaterial, PlaneGeometry, PMREMGenerator, Scene, SphereGeometry, } from 'three'

/**
 * - `warm-bright-field`: a bright band all round the horizon, so whatever lies
 *   behind amber, opal or frosted glass from any viewpoint is light.
 * - `cool-dark-field`: a dark room with vertical strips, so clear glass reads
 *   by its bright edges.
 * - `sparkle`: small hot cards for cut crystal.
 */
export type GlassStudioKind =
  | 'warm-bright-field'
  | 'cool-dark-field'
  | 'sparkle'

export const GLASS_STUDIO_KINDS: readonly GlassStudioKind[] = [
  'warm-bright-field',
  'cool-dark-field',
  'sparkle',
]

/** Linear radiance; values above 1 are light sources. */
function glow(r: number, g: number, b: number, intensity: number) {
  return new MeshBasicMaterial({
    color: new Color(r * intensity, g * intensity, b * intensity),
    side: DoubleSide,
    toneMapped: false,
  })
}

function shell(scene: Scene, r: number, g: number, b: number): void {
  scene.add(
    new Mesh(
      new SphereGeometry(12, 32, 16),
      new MeshBasicMaterial({ color: new Color(r, g, b), side: BackSide }),
    ),
  )
}

function floor(scene: Scene, r: number, g: number, b: number): void {
  const disk = new Mesh(new CircleGeometry(11, 48), glow(r, g, b, 1))
  disk.rotation.x = -Math.PI / 2
  disk.position.y = -1.2
  scene.add(disk)
}

/** A panel `distance` metres out at `azimuth` and `elevation` (radians), facing the centre. */
function panel(
  scene: Scene,
  width: number,
  height: number,
  azimuth: number,
  elevation: number,
  distance: number,
  material: MeshBasicMaterial,
): void {
  const mesh = new Mesh(new PlaneGeometry(width, height), material)
  mesh.position.set(
    Math.sin(azimuth) * Math.cos(elevation) * distance,
    Math.sin(elevation) * distance,
    Math.cos(azimuth) * Math.cos(elevation) * distance,
  )
  mesh.lookAt(0, 0, 0)
  scene.add(mesh)
}

// Deterministic placement for the sparkle cards.
function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

export function createGlassStudioScene(kind: GlassStudioKind): Scene {
  const scene = new Scene()
  scene.name = `glass-studio:${kind}`
  if (kind === 'warm-bright-field') {
    shell(scene, 0.05, 0.042, 0.034)
    floor(scene, 0.06, 0.045, 0.03)
    // The band behind the glass from every side: near 1.5 radiance, the level
    // at which the concept's amber reads gold.
    const band = new Mesh(
      new CylinderGeometry(7, 7, 3.2, 64, 1, true),
      glow(1, 0.94, 0.86, 1.5),
    )
    band.material.side = BackSide
    band.position.y = 0.4
    scene.add(band)
    // Light from above brings glass to life; two key boxes give the highlights.
    panel(scene, 5, 5, 0, Math.PI / 2, 6, glow(1, 0.96, 0.9, 3))
    panel(scene, 1.4, 2.6, -0.8, 0.6, 5, glow(1, 0.97, 0.92, 6))
    panel(scene, 1.4, 2.6, 0.9, 0.55, 5, glow(1, 0.95, 0.88, 4))
    return scene
  }
  if (kind === 'cool-dark-field') {
    shell(scene, 0.008, 0.01, 0.012)
    floor(scene, 0.004, 0.005, 0.006)
    for (let i = 0; i < 6; i += 1)
      panel(
        scene,
        0.35,
        4.5,
        (i / 6) * Math.PI * 2 + 0.26,
        0.15,
        5.5,
        glow(0.9, 0.97, 1, 5),
      )
    panel(scene, 4, 4, 0, Math.PI / 2, 6, glow(0.9, 0.95, 1, 0.6))
    return scene
  }
  shell(scene, 0.01, 0.01, 0.012)
  floor(scene, 0.004, 0.004, 0.005)
  const random = seeded(7)
  for (let i = 0; i < 48; i += 1)
    panel(
      scene,
      0.14,
      0.14,
      random() * Math.PI * 2,
      0.1 + random() * 1.2,
      6,
      glow(1, 0.98, 0.95, 10 + random() * 10),
    )
  panel(scene, 0.3, 4, 0.5, 0.2, 5.5, glow(1, 1, 1, 4))
  panel(scene, 0.3, 4, 3.6, 0.2, 5.5, glow(1, 1, 1, 4))
  return scene
}

function disposeScene(scene: Scene): void {
  scene.traverse((object) => {
    if (object instanceof Mesh) {
      object.geometry.dispose()
      ;(object.material as MeshBasicMaterial).dispose()
    }
  })
}

export interface GlassStudios {
  readonly textures: Readonly<Record<GlassStudioKind, Texture>>
  dispose(): void
}

/** Prefilters each studio once. `size` is the PMREM cube size. */
export function createGlassStudios(
  renderer: WebGLRenderer,
  size = 256,
): GlassStudios {
  const pmrem = new PMREMGenerator(renderer)
  const targets = GLASS_STUDIO_KINDS.map((kind) => {
    const scene = createGlassStudioScene(kind)
    const target = pmrem.fromScene(scene, 0.02, 0.1, 30, { size })
    disposeScene(scene)
    return [kind, target] as const
  })
  pmrem.dispose()
  return {
    textures: Object.fromEntries(
      targets.map(([kind, target]) => [kind, target.texture]),
    ) as Record<GlassStudioKind, Texture>,
    dispose: () => targets.forEach(([, target]) => target.dispose()),
  }
}
