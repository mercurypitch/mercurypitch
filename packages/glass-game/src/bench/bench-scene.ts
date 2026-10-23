// Glass bench objects — reference spheres, a colour checker, swatches, a plinth and the cards behind them, in metres on a fixed layout.
import type { Material } from 'three'
import { BoxGeometry, Color, CylinderGeometry, DataTexture, Group, LatheGeometry, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, RepeatWrapping, SphereGeometry, SRGBColorSpace, Vector2, } from 'three'

/** The museum's exhibit plinth (content/solid-props.ts). */
export const BENCH_PLINTH = {
  radiusTop: 0.25,
  radiusBottom: 0.29,
  height: 0.24,
} as const

/** Wall thickness of each wedge step, in metres. */
export const WEDGE_STEPS = [0.004, 0.008, 0.016, 0.032, 0.064] as const

/** ColorChecker Classic patches, sRGB, row by row from dark skin. */
const COLOR_CHECKER = [
  0x735244, 0xc29682, 0x627a9d, 0x576c43, 0x8580b1, 0x67bdaa, 0xd67e2c,
  0x505ba6, 0xc15a63, 0x5e3c6c, 0x9dbc40, 0xe0a32e, 0x383d96, 0x469449,
  0xaf363c, 0xe7c71f, 0xbb5695, 0x0885a1, 0xf3f3f2, 0xc8c8c8, 0xa0a0a0,
  0x7a7a79, 0x555555, 0x343434,
] as const

function checkerTexture(): DataTexture {
  const size = 8
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y += 1)
    for (let x = 0; x < size; x += 1) {
      const value = (x + y) % 2 === 0 ? 232 : 46
      data.set([value, value, value, 255], (y * size + x) * 4)
    }
  const texture = new DataTexture(data, size, size)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.needsUpdate = true
  return texture
}

/** A checker card: refraction that the look loses shows as a missing pattern. */
export function createCheckerCard(
  width: number,
  height: number,
  squares: number,
): Mesh {
  const map = checkerTexture()
  map.repeat.set(squares / 8, (squares * height) / width / 8)
  return new Mesh(
    new PlaneGeometry(width, height),
    new MeshStandardMaterial({ map, roughness: 0.85 }),
  )
}

export function createReferenceSpheres(): Group {
  const group = new Group()
  group.name = 'bench-references'
  const chrome = new Mesh(
    new SphereGeometry(0.06, 48, 24),
    new MeshStandardMaterial({
      color: 0xffffff,
      metalness: 1,
      roughness: 0.02,
    }),
  )
  // A diffuse sphere at 18% linear reflectance.
  const grey = new Mesh(
    new SphereGeometry(0.06, 48, 24),
    new MeshStandardMaterial({
      color: new Color(0.18, 0.18, 0.18),
      metalness: 0,
      roughness: 1,
    }),
  )
  chrome.name = 'chrome-sphere'
  grey.name = 'grey-sphere'
  chrome.position.set(-0.56, 0.06, 0.42)
  grey.position.set(-0.4, 0.06, 0.42)
  group.add(chrome, grey)
  return group
}

/** Lit patches show the light; the unlit row shows the target values untouched. */
export function createColorChecker(): Group {
  const group = new Group()
  group.name = 'bench-color-checker'
  const patch = new BoxGeometry(0.034, 0.034, 0.004)
  const grid = (unlit: boolean, originX: number, scale: number) =>
    COLOR_CHECKER.forEach((hex, index) => {
      const material = unlit
        ? new MeshBasicMaterial({ color: hex, toneMapped: false })
        : new MeshStandardMaterial({ color: hex, roughness: 0.9 })
      const mesh = new Mesh(patch, material)
      mesh.scale.setScalar(scale)
      mesh.position.set(
        originX + (index % 6) * 0.038 * scale,
        0.02 + (3 - Math.floor(index / 6)) * 0.038 * scale,
        0,
      )
      group.add(mesh)
    })
  grid(false, 0, 1)
  grid(true, 0.24, 0.5)
  group.position.set(0.2, 0, 0.42)
  group.rotation.x = -0.35
  return group
}

export function createPlinth(): { readonly plinth: Mesh; readonly top: Mesh } {
  const plinth = new Mesh(
    new CylinderGeometry(
      BENCH_PLINTH.radiusTop,
      BENCH_PLINTH.radiusBottom,
      BENCH_PLINTH.height,
      64,
    ),
    new MeshStandardMaterial({ color: 0xb8b2a6, roughness: 0.78 }),
  )
  plinth.position.y = BENCH_PLINTH.height / 2
  plinth.receiveShadow = true
  // The exhibit kit's lit plinth top; dark unless the kit is on.
  const top = new Mesh(
    new CylinderGeometry(
      BENCH_PLINTH.radiusTop * 0.86,
      BENCH_PLINTH.radiusTop * 0.86,
      0.004,
      64,
    ),
    new MeshBasicMaterial({ color: 0x000000, toneMapped: true }),
  )
  top.position.y = BENCH_PLINTH.height + 0.002
  top.name = 'plinth-glow'
  return { plinth, top }
}

export function createFloor(): Mesh {
  const floor = new Mesh(
    new PlaneGeometry(12, 12),
    new MeshStandardMaterial({
      color: new Color(0.2, 0.2, 0.2),
      roughness: 0.8,
    }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  return floor
}

/** A gallery wall card for the in-game environments. */
export function createWallCard(): Mesh {
  const wall = new Mesh(
    new PlaneGeometry(5, 3.2),
    new MeshStandardMaterial({ color: 0x8c8274, roughness: 0.9 }),
  )
  wall.position.set(0, 1.6, -1.3)
  wall.receiveShadow = true
  return wall
}

export interface BenchSwatches {
  readonly group: Group
  readonly sphere: Mesh
  readonly tumbler: Mesh
  /** One mesh per entry of WEDGE_STEPS, thinnest first. */
  readonly wedge: readonly Mesh[]
}

/** A closed, thick-walled tumbler: 12 mm walls and an 18 mm base. */
function tumblerGeometry(): LatheGeometry {
  const outer = 0.075
  const inner = 0.063
  const height = 0.18
  const base = 0.018
  const points = [
    new Vector2(0, 0),
    new Vector2(outer - 0.004, 0),
    new Vector2(outer, 0.004),
    new Vector2(outer, height),
    new Vector2(inner, height),
    new Vector2(inner, base),
    new Vector2(0, base),
  ]
  return new LatheGeometry(points, 96)
}

export function createSwatches(
  material: (thickness: number) => Material,
): BenchSwatches {
  const group = new Group()
  group.name = 'bench-swatches'
  const sphere = new Mesh(new SphereGeometry(0.09, 96, 48), material(0.18))
  sphere.position.set(-0.42, 0.33, 0)
  const tumbler = new Mesh(tumblerGeometry(), material(0.024))
  tumbler.position.set(-0.12, 0.24, 0)
  const wedge = WEDGE_STEPS.map((thickness, index) => {
    const step = new Mesh(
      new BoxGeometry(0.07, 0.16, thickness),
      material(thickness),
    )
    step.position.set(0.12 + index * 0.08, 0.32, 0)
    return step
  })
  const stand = new Mesh(
    new BoxGeometry(1.25, 0.24, 0.32),
    new MeshStandardMaterial({ color: 0xb8b2a6, roughness: 0.78 }),
  )
  stand.position.set(0, 0.12, 0)
  stand.receiveShadow = true
  group.add(stand, sphere, tumbler, ...wedge)
  return { group, sphere, tumbler, wedge }
}
