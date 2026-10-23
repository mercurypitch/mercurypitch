// ============================================================
// Splat backdrop world — a procedural museum archipelago as raw Gaussian splats.
// ============================================================
//
// The Cloudway art review asks for "complete scenic islands… distant museum
// structures" beyond the route. This builds them as splats: ivory terraces on
// rock, domes, towers, colonnades and crystal gardens, waterfalls, light arcs
// and cloud banks, all outside the playable radius. Lighting and distance
// haze are baked into each splat's color, because splats cannot be relit and
// three.js fog does not reach them. The output is plain arrays so it can be
// tested without a GPU; the renderer pushes them into Spark.

export interface SplatBackdropWorldOptions {
  seed: number
  /** Centre of the playable route in world metres. */
  centre: { readonly x: number; readonly y: number; readonly z: number }
  /** Horizontal radius of the playable route; scenery stays outside it. */
  routeRadius: number
  /** 1 on High; lower values thin every element evenly. */
  density: number
}

export interface SplatBackdropWorld {
  count: number
  /** xyz per splat, world metres. */
  centres: Float32Array
  /** Standard deviation along each local axis, metres. */
  scales: Float32Array
  /** Unit quaternion xyzw per splat. */
  quaternions: Float32Array
  /** sRGB 0–1 per splat, lighting and haze already applied. */
  colors: Float32Array
  opacities: Float32Array
}

type Rgb = readonly [number, number, number]
type Vec3 = readonly [number, number, number]

const IVORY: Rgb = [0.93, 0.89, 0.8]
const GOLD: Rgb = [0.86, 0.71, 0.44]
const TEAL: Rgb = [0.13, 0.42, 0.46]
const STONE: Rgb = [0.74, 0.68, 0.62]
const DEEP_STONE: Rgb = [0.5, 0.46, 0.46]
/** Cloudway's pearl distance fog, so far scenery settles into the same air. */
const HAZE: Rgb = [0.89, 0.906, 0.937]
const CLOUD_LIT: Rgb = [0.99, 0.95, 0.9]
const CLOUD_SHADE: Rgb = [0.78, 0.8, 0.86]
const JEWELS: readonly Rgb[] = [
  [0.62, 0.42, 0.88],
  [0.42, 0.84, 0.9],
  [0.96, 0.78, 0.36],
  [0.95, 0.55, 0.66],
]
const SUN = normalize([-0.42, 0.72, 0.55])
const SUN_RGB: Rgb = [1.0, 0.9, 0.76]
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
const TAU = Math.PI * 2

type StructureKind = 'dome' | 'tower' | 'colonnade' | 'arch' | 'obelisk'

function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / length, v[1] / length, v[2] / length]
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}
const mix = (a: number, b: number, t: number): number => a + (b - a) * t

/** Builder with growable storage; every element funnels through push(). */
class SplatList {
  count = 0
  private capacity = 4096
  centres = new Float32Array(this.capacity * 3)
  scales = new Float32Array(this.capacity * 3)
  quaternions = new Float32Array(this.capacity * 4)
  colors = new Float32Array(this.capacity * 3)
  opacities = new Float32Array(this.capacity)

  push(
    centre: Vec3,
    scale: Vec3,
    quaternion: readonly [number, number, number, number],
    color: Rgb,
    opacity: number,
  ): void {
    if (this.count === this.capacity) this.grow()
    const i = this.count++
    this.centres.set(centre, i * 3)
    this.scales.set(scale, i * 3)
    this.quaternions.set(quaternion, i * 4)
    this.colors[i * 3] = Math.min(1, Math.max(0, color[0]))
    this.colors[i * 3 + 1] = Math.min(1, Math.max(0, color[1]))
    this.colors[i * 3 + 2] = Math.min(1, Math.max(0, color[2]))
    this.opacities[i] = Math.min(1, Math.max(0, opacity))
  }

  private grow(): void {
    this.capacity *= 2
    const grow = <T extends Float32Array>(old: T, width: number) => {
      const next = new Float32Array(this.capacity * width)
      next.set(old)
      return next
    }
    this.centres = grow(this.centres, 3)
    this.scales = grow(this.scales, 3)
    this.quaternions = grow(this.quaternions, 4)
    this.colors = grow(this.colors, 3)
    this.opacities = grow(this.opacities, 1)
  }

  finish(): SplatBackdropWorld {
    return {
      count: this.count,
      centres: this.centres.slice(0, this.count * 3),
      scales: this.scales.slice(0, this.count * 3),
      quaternions: this.quaternions.slice(0, this.count * 4),
      colors: this.colors.slice(0, this.count * 3),
      opacities: this.opacities.slice(0, this.count),
    }
  }
}

/** Rotate local +Z onto the normal, then spin by a random angle around it. */
function surfaceQuaternion(
  normal: Vec3,
  spin: number,
): [number, number, number, number] {
  const [nx, ny, nz] = normal
  let ax: number, ay: number, az: number, aw: number
  if (nz < -0.999999) {
    ax = 1
    ay = 0
    az = 0
    aw = 0
  } else {
    const length = Math.hypot(-ny, nx, 1 + nz)
    ax = -ny / length
    ay = nx / length
    az = 0
    aw = (1 + nz) / length
  }
  const sz = Math.sin(spin / 2)
  const cz = Math.cos(spin / 2)
  return [
    ax * cz + ay * sz,
    ay * cz - ax * sz,
    aw * sz + az * cz,
    aw * cz - az * sz,
  ]
}

export function createSplatBackdropWorld(
  options: SplatBackdropWorldOptions,
): SplatBackdropWorld {
  const random = mulberry32(options.seed * 2654435761 + 7)
  const density = Math.min(1.5, Math.max(0.1, options.density))
  const { centre } = options
  const routeRadius = Math.max(4, options.routeRadius)
  const list = new SplatList()
  // Far islands are small and hazy on screen, so their ring draws fewer splats.
  let detail = 1
  const count = (base: number) =>
    Math.max(8, Math.round(base * density * detail))

  const shade = (base: Rgb, normal: Vec3, occlusion = 1): Rgb => {
    const light = Math.max(
      0,
      normal[0] * SUN[0] + normal[1] * SUN[1] + normal[2] * SUN[2],
    )
    const sky = 0.5 + 0.5 * normal[1]
    const ambient = [
      mix(0.52, 0.5, sky),
      mix(0.47, 0.52, sky),
      mix(0.44, 0.56, sky),
    ]
    return [
      base[0] * (ambient[0] * occlusion + SUN_RGB[0] * light * 0.62),
      base[1] * (ambient[1] * occlusion + SUN_RGB[1] * light * 0.62),
      base[2] * (ambient[2] * occlusion + SUN_RGB[2] * light * 0.62),
    ]
  }
  // Aerial perspective from the route centre: far islands settle into the fog color.
  const haze = (color: Rgb, position: Vec3): Rgb => {
    const distance = Math.hypot(position[0] - centre.x, position[2] - centre.z)
    const amount =
      smoothstep(routeRadius + 4, routeRadius + 85, distance) * 0.74
    return [
      mix(color[0], HAZE[0], amount),
      mix(color[1], HAZE[1], amount),
      mix(color[2], HAZE[2], amount),
    ]
  }
  const surface = (
    position: Vec3,
    normal: Vec3,
    size: number,
    color: Rgb,
    opacity: number,
  ) => {
    list.push(
      position,
      [size, size * (0.65 + 0.3 * random()), size * 0.08],
      surfaceQuaternion(normal, random() * TAU),
      haze(color, position),
      opacity,
    )
  }

  function terrace(x: number, y: number, z: number, radius: number): void {
    const n = count(950 * radius)
    const spacing = radius * Math.sqrt(Math.PI / n)
    for (let i = 0; i < n; i++) {
      const r = radius * Math.sqrt((i + 0.5) / n)
      const a = i * GOLDEN_ANGLE
      const rim = radius - r
      const inlay =
        Math.abs(Math.cos(4 * a)) > 0.94 &&
        r > radius * 0.3 &&
        r < radius * 0.62
      const base = rim < spacing * 1.6 ? GOLD : inlay ? TEAL : IVORY
      surface(
        [x + r * Math.cos(a), y, z + r * Math.sin(a)],
        [0, 1, 0],
        spacing * 0.75,
        shade(base, [0, 1, 0], rim < radius * 0.12 ? 0.88 : 1),
        0.96,
      )
    }
  }

  function underside(
    x: number,
    y: number,
    z: number,
    radius: number,
    depth: number,
  ): void {
    const n = count(700 * radius)
    for (let made = 0; made < n; ) {
      const h = random()
      const ring = radius * (1 - 0.9 * Math.pow(h, 0.8))
      if (random() > ring / radius) continue
      made++
      const a = random() * TAU
      const bump = 0.86 + 0.28 * random()
      const normal = normalize([Math.cos(a), -0.6 - 0.4 * h, Math.sin(a)])
      const base: Rgb = [
        mix(STONE[0], DEEP_STONE[0], h),
        mix(STONE[1], DEEP_STONE[1], h),
        mix(STONE[2], DEEP_STONE[2], h),
      ]
      surface(
        [
          x + ring * bump * Math.cos(a),
          y - 0.15 - h * depth,
          z + ring * bump * Math.sin(a),
        ],
        normal,
        0.16 + 0.1 * random(),
        shade(base, normal, mix(1, 0.62, h)),
        0.97,
      )
    }
  }

  function structure(
    kind: StructureKind,
    x: number,
    y: number,
    z: number,
    radius: number,
    yaw: number,
  ): void {
    if (kind === 'dome') {
      const drum = radius * 0.42
      for (let i = 0, n = count(520 * radius); i < n; i++) {
        const a = random() * TAU
        const h = random() * radius * 0.35
        const normal: Vec3 = [Math.cos(a), 0, Math.sin(a)]
        const column = Math.abs(Math.cos(a * 6)) > 0.8
        surface(
          [x + drum * normal[0], y + h, z + drum * normal[2]],
          normal,
          0.1,
          shade(column ? IVORY : [0.82, 0.78, 0.7], normal, column ? 1 : 0.8),
          0.96,
        )
      }
      for (let i = 0, n = count(760 * radius); i < n; i++) {
        const u = random()
        const a = random() * TAU
        const elevation = Math.asin(u)
        const normal: Vec3 = [
          Math.cos(elevation) * Math.cos(a),
          Math.sin(elevation),
          Math.cos(elevation) * Math.sin(a),
        ]
        const rib = Math.abs(Math.cos(a * 8)) > 0.95
        const glass: Rgb = rib
          ? GOLD
          : [0.5 + 0.3 * u, 0.78 + 0.12 * u, 0.82 + 0.1 * u]
        surface(
          [
            x + normal[0] * drum,
            y + radius * 0.35 + normal[1] * drum,
            z + normal[2] * drum,
          ],
          normal,
          0.11,
          shade(glass, normal),
          rib ? 0.96 : 0.82,
        )
      }
    } else if (kind === 'tower') {
      const height = radius * 2.6
      for (let i = 0, n = count(900 * radius); i < n; i++) {
        const a = random() * TAU
        const t = random()
        const r = radius * 0.24 * (1 - 0.45 * t)
        const normal = normalize([Math.cos(a), 0.12, Math.sin(a)])
        const band = Math.abs(t - 0.62) < 0.02 || t > 0.93
        surface(
          [x + r * Math.cos(a), y + t * height, z + r * Math.sin(a)],
          normal,
          0.1,
          shade(band ? GOLD : IVORY, normal),
          0.97,
        )
      }
      for (let i = 0, n = count(260); i < n; i++) {
        const t = random()
        const a = random() * TAU
        const r = radius * 0.12 * (1 - t)
        surface(
          [
            x + r * Math.cos(a),
            y + height + t * radius * 0.7,
            z + r * Math.sin(a),
          ],
          normalize([Math.cos(a), 0.5, Math.sin(a)]),
          0.07,
          shade(GOLD, [0, 1, 0]),
          0.95,
        )
      }
    } else if (kind === 'colonnade') {
      const columns = 10
      for (let k = 0; k < columns; k++) {
        const a = (k / columns) * TAU
        const cx = x + Math.cos(a) * radius * 0.62
        const cz = z + Math.sin(a) * radius * 0.62
        for (let i = 0, n = count(150); i < n; i++) {
          const ca = random() * TAU
          const normal: Vec3 = [Math.cos(ca), 0, Math.sin(ca)]
          surface(
            [
              cx + 0.12 * normal[0],
              y + random() * radius * 0.85,
              cz + 0.12 * normal[2],
            ],
            normal,
            0.07,
            shade(IVORY, normal),
            0.97,
          )
        }
      }
      for (let i = 0, n = count(420 * radius); i < n; i++) {
        const a = random() * TAU
        const r = radius * (0.5 + 0.24 * random())
        surface(
          [x + Math.cos(a) * r, y + radius * 0.85, z + Math.sin(a) * r],
          [0, 1, 0],
          0.1,
          shade(random() < 0.2 ? GOLD : IVORY, [0, 1, 0]),
          0.96,
        )
      }
    } else if (kind === 'arch') {
      const ux = Math.cos(yaw)
      const uz = Math.sin(yaw)
      const span = radius * 0.58
      for (let i = 0, n = count(620 * radius); i < n; i++) {
        const t = random() * Math.PI
        const width = (random() - 0.5) * 0.36
        const depth = (random() - 0.5) * 0.3
        const r = span + width
        const normal = normalize([
          ux * Math.cos(t),
          Math.sin(t),
          uz * Math.cos(t),
        ])
        const inlay = Math.abs(width) < 0.05
        surface(
          [
            x + ux * Math.cos(t) * r - uz * depth,
            y + Math.sin(t) * r * 1.25,
            z + uz * Math.cos(t) * r + ux * depth,
          ],
          normal,
          0.09,
          inlay ? [0.4, 0.82, 0.86] : shade(IVORY, normal),
          inlay ? 0.85 : 0.96,
        )
      }
    } else {
      const height = radius * 1.9
      for (let i = 0, n = count(420 * radius); i < n; i++) {
        const t = random()
        const face = Math.floor(random() * 4)
        const half = radius * 0.16 * (1 - 0.7 * t)
        const along = (random() * 2 - 1) * half
        const fx = face < 2 ? (face === 0 ? half : -half) : along
        const fz = face < 2 ? along : face === 2 ? half : -half
        const normal: Vec3 =
          face < 2
            ? [face === 0 ? 1 : -1, 0.15, 0]
            : [0, 0.15, face === 2 ? 1 : -1]
        surface(
          [x + fx, y + t * height, z + fz],
          normal,
          0.08,
          shade(t > 0.94 ? GOLD : IVORY, normalize(normal)),
          0.97,
        )
      }
    }
  }

  function crystals(x: number, y: number, z: number, radius: number): void {
    const clusters = 3 + Math.floor(random() * 3)
    for (let c = 0; c < clusters; c++) {
      const a = random() * TAU
      const r = radius * (0.55 + 0.35 * random())
      const tint = JEWELS[Math.floor(random() * JEWELS.length)]
      const bx = x + Math.cos(a) * r
      const bz = z + Math.sin(a) * r
      for (let k = 0, spires = 2 + Math.floor(random() * 3); k < spires; k++) {
        const height = 0.5 + random() * 1.3
        const tilt = (random() - 0.5) * 0.5
        const ox = (random() - 0.5) * 0.6
        const oz = (random() - 0.5) * 0.6
        for (let i = 0, n = count(140 * height); i < n; i++) {
          const t = random()
          const ca = random() * TAU
          const rr = 0.13 * (1 - Math.max(0, t - 0.75) * 4)
          const normal = normalize([Math.cos(ca), 0.3, Math.sin(ca)])
          const glow = 0.4 + 0.6 * t
          const lit = shade(tint, normal)
          surface(
            [
              bx + ox + Math.cos(ca) * rr + tilt * t * height,
              y + t * height,
              bz + oz + Math.sin(ca) * rr,
            ],
            normal,
            0.05,
            [
              lit[0] * 0.7 + tint[0] * 0.45 * glow,
              lit[1] * 0.7 + tint[1] * 0.45 * glow,
              lit[2] * 0.7 + tint[2] * 0.45 * glow,
            ],
            0.55 + 0.35 * t,
          )
        }
      }
    }
  }

  function waterfall(
    x: number,
    y: number,
    z: number,
    outward: Vec3,
    drop: number,
  ): void {
    for (let i = 0, n = count(900); i < n; i++) {
      const t = random()
      const spread = (random() - 0.5) * (0.5 + t * 1.6)
      const side = normalize([-outward[2], 0, outward[0]])
      const fall = t * drop
      const reach = 0.25 + t * t * 1.2
      const position: Vec3 = [
        x + outward[0] * reach + side[0] * spread,
        y - fall,
        z + outward[2] * reach + side[2] * spread,
      ]
      list.push(
        position,
        [0.06 + 0.14 * t, 0.22 + 0.2 * t, 0.06 + 0.14 * t],
        [0, 0, 0, 1],
        haze([0.84 + 0.1 * t, 0.94, 0.98], position),
        (0.5 - 0.35 * t) * (0.7 + 0.3 * random()),
      )
    }
  }

  function lightArc(from: Vec3, to: Vec3): void {
    const lift = 3 + random() * 4
    for (let i = 0, n = count(420); i < n; i++) {
      const t = random()
      const position: Vec3 = [
        mix(from[0], to[0], t),
        mix(from[1], to[1], t) + Math.sin(t * Math.PI) * lift,
        mix(from[2], to[2], t),
      ]
      list.push(
        position,
        [0.05, 0.05, 0.05],
        [0, 0, 0, 1],
        haze([1.0, 0.86, 0.58], position),
        0.7,
      )
    }
  }

  function cloudBank(n: number): void {
    for (let i = 0; i < n; i++) {
      const a = random() * TAU
      const distance = routeRadius + 6 + Math.pow(random(), 0.7) * 85
      const high = random() < 0.18
      const y = centre.y + (high ? 9 + random() * 10 : -6 - random() * 9)
      const size = (high ? 1.4 : 2.0) + random() * 2.6
      const lit = 0.55 + 0.45 * random()
      const position: Vec3 = [
        centre.x + Math.cos(a) * distance,
        y,
        centre.z + Math.sin(a) * distance,
      ]
      const color: Rgb = [
        mix(CLOUD_SHADE[0], CLOUD_LIT[0], lit),
        mix(CLOUD_SHADE[1], CLOUD_LIT[1], lit),
        mix(CLOUD_SHADE[2], CLOUD_LIT[2], lit),
      ]
      list.push(
        position,
        [size * 1.7, size * (high ? 0.22 : 0.42), size * 1.3],
        surfaceQuaternion([0, 0, 1], random() * TAU),
        haze(color, position),
        high ? 0.16 : 0.24 + 0.14 * random(),
      )
    }
  }

  // Two rings of islands: a nearer ring that reads clearly past the fog line,
  // and a far ring of larger, hazier silhouettes.
  const kinds: StructureKind[] = [
    'dome',
    'tower',
    'colonnade',
    'arch',
    'obelisk',
  ]
  const anchors: Vec3[] = []
  const rings = [
    // Below the route, so the camera sees terraces and buildings, not rock.
    {
      islands: 5,
      distance: [16, 26],
      radius: [2.4, 3.6],
      height: [-7, -2],
      detail: 1,
    },
    {
      islands: 7,
      distance: [34, 62],
      radius: [3.8, 6.2],
      height: [-13, 1],
      detail: 0.5,
    },
  ]
  let kindIndex = Math.floor(random() * kinds.length)
  rings.forEach((ring, ringIndex) => {
    detail = ring.detail
    const phase = random() * TAU
    for (let k = 0; k < ring.islands; k++) {
      const a = phase + (k / ring.islands) * TAU + (random() - 0.5) * 0.5
      const distance =
        routeRadius + mix(ring.distance[0], ring.distance[1], random())
      const radius = mix(ring.radius[0], ring.radius[1], random())
      const x = centre.x + Math.cos(a) * distance
      const z = centre.z + Math.sin(a) * distance
      const y = centre.y + mix(ring.height[0], ring.height[1], random())
      const kind = kinds[kindIndex++ % kinds.length]
      terrace(x, y, z, radius)
      underside(x, y, z, radius, radius * (1.6 + random() * 0.8))
      structure(kind, x, y, z, radius, a + Math.PI / 2)
      crystals(x, y, z, radius)
      if (ringIndex === 0 || random() < 0.4) {
        const outward = normalize([Math.cos(a), 0, Math.sin(a)])
        const edge = radius * 0.96
        waterfall(
          x + outward[0] * edge,
          y - 0.05,
          z + outward[2] * edge,
          outward,
          7 + random() * 6,
        )
      }
      anchors.push([x, y + radius * 0.4, z])
    }
  })
  detail = 1
  for (let k = 0; k + 1 < rings[0].islands; k += 2)
    lightArc(anchors[k], anchors[k + 1])
  cloudBank(count(900))
  return list.finish()
}
