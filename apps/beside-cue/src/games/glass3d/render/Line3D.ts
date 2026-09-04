// The Sorting Line's room, in three.
// ============================================================
//
// Chamber3D's sibling, and a fork of it on purpose (docs/games/
// sorting-line.md §10): the environment, the lighting rig, the floor
// pool, the exit and the chase camera are the chamber's, and everything
// that made a chamber a chamber -- panes, modes, the wave field, the
// shard batch -- is not here, because the room is INERT. What is new is
// small: a plate with a slot in it, whose mouth lights when he fits.
// (The plan also drew a ghost of him at the band's centre; maff's phone
// read it as a bulge aligned with the plate, so it is gone -- §15.)
//
// THE CAMERA IS CENTRED. The chamber's chase frames him 0.4 m left of
// centre so a walk back down the room does not walk him off his own
// screen. Step 4a measured what that does to a puddle: at the flat end
// the torso's left edge sits 4 px past a 390 px phone. This world's
// Merc is wide by design, so its camera keeps him nearer the middle and
// pulls back a little further.

import { ACESFilmicToneMapping, AdditiveBlending, AmbientLight, BoxGeometry, CircleGeometry, ExtrudeGeometry, Group, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, Scene, Shape, SpotLight, Vector3, } from 'three'
import { WebGPURenderer } from 'three/webgpu'
import type { LineFurniture, LineLevel } from '../levels/lines'
import { meshLayout, SLAT } from '../levels/lines'
import type { World3DConfig } from '../world3d-config'
import { aimFromRig, buildCabinetEnvironment, buildRadialFalloff, createBackdrop, RIG, } from './environment'
import { PANE } from './Hallway3D'
import type { MercActor } from './merc'
import { createMerc } from './merc'

const CUSTARD = 0xf2c84b
const TURQUOISE = 0x00777d
const PAPER = 0xfff4e2

const DESIGN_FOV_DEG = 42
const DESIGN_ASPECT = 1.5
const MAX_FOV_DEG = 64

/** How tall a plate stands. There is no ceiling in the void; this is
 * high enough that a thread cannot see over it. */
const PLATE_HEIGHT = 2.1

/** The chute's colour: an ember, so a drop is warm and wrong rather
 * than turquoise and fine. */
const EMBER = 0xff7a45

export interface LineGateView {
  /** The furniture's derived number, in metres: a horizontal slot's
   * height, a vertical slot's width, a grate's gap, a wedge's ceiling
   * at its mouth. */
  size: number
  /** A wedge's ceiling at its far end. 0 for everything else. */
  sizeOut: number
  /** Whether he currently gets past it. Lights the mouth. */
  open: boolean
  /** Whether he has been through. */
  passed: boolean
}

export interface LineView {
  mercX: number
  mercY: number
  mercFacing: 1 | -1
  /** Merc's body right now, as scale factors against rest. */
  widthScale: number
  heightScale: number
  gates: readonly LineGateView[]
  exitOpen: boolean
  /** 0 while he walks; climbs to 1 through a drop. The chute flares
   * with it. */
  falling: number
}

export interface Line3D {
  init(): Promise<void>
  /** Put a different room in front of him, keeping everything that is
   * not the room -- the renderer, the environment, Merc, the mic. */
  load(room: LineLevel, furniture: readonly LineFurniture[]): void
  render(view: LineView, dt: number): void
  merc(): MercActor | null
  camera(): PerspectiveCamera
  resize(width: number, height: number, pixelRatio: number): void
  backend(): string
  dispose(): void
}

export const createLine3D = (
  canvas: HTMLCanvasElement,
  cfg: World3DConfig,
  room: LineLevel,
): Line3D => {
  void cfg
  const renderer = new WebGPURenderer({ canvas, antialias: true })
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2

  const scene = new Scene()
  const camera = new PerspectiveCamera(DESIGN_FOV_DEG, 1, 0.05, 40)
  camera.position.set(1.5, 1.0, 2.9)

  // Sized as the chamber's is, off the longest room plus the camera
  // standing behind him. Rooms here are 5 and 7 m; 13 covers both with
  // the same margin the chambers keep.
  const backdrop = createBackdrop(13)
  scene.add(backdrop.mesh)
  const environment = buildCabinetEnvironment()
  scene.environment = environment

  // The chamber's rig, verbatim: one warm key, a turquoise glint from
  // behind, a paper rim. It is what makes Merc belong in the room.
  const key = new SpotLight(CUSTARD, 55, 12, Math.PI / 10, 0.85, 1.6)
  aimFromRig(key, RIG.key, new Vector3(0, 0.5, 0), 2.8)
  scene.add(key, key.target)

  const glint = new SpotLight(TURQUOISE, 30, 9, Math.PI / 7, 0.7, 1.6)
  aimFromRig(glint, RIG.glint, new Vector3(0, 0.6, 0), 2.24)
  scene.add(glint, glint.target)

  const rim = new SpotLight(PAPER, 16, 7, Math.PI / 6, 0.8, 1.5)
  aimFromRig(rim, RIG.back, new Vector3(0, 0.45, 0.4), 2.09)
  scene.add(rim, rim.target)

  scene.add(new AmbientLight(0xffffff, 0.07))

  const floorMaterial = new MeshBasicMaterial({
    color: 0x0b1011,
    alphaMap: buildRadialFalloff(),
    transparent: true,
    depthWrite: false,
  })
  const floor = new Mesh(new CircleGeometry(3.0, 48), floorMaterial)
  floor.rotation.x = -Math.PI / 2
  floor.scale.set(1.6, 1, 1)
  scene.add(floor)

  const poolMaterial = new MeshBasicMaterial({
    color: CUSTARD,
    map: buildRadialFalloff(),
    transparent: true,
    opacity: 0.12,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  const pool = new Mesh(new CircleGeometry(0.5, 48), poolMaterial)
  pool.rotation.x = -Math.PI / 2
  pool.position.y = 0.001
  scene.add(pool)

  // The way out: the chamber's light, exactly (slice 3d).
  const exitMaterial = new MeshBasicMaterial({
    color: TURQUOISE,
    map: buildRadialFalloff(),
    transparent: true,
    opacity: 0.06,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  const exitPool = new Mesh(new CircleGeometry(0.75, 48), exitMaterial)
  exitPool.rotation.x = -Math.PI / 2
  exitPool.scale.set(1.35, 1, 1.5)
  const exitGlow = new Mesh(new PlaneGeometry(0.62, 2.6), exitMaterial)
  exitGlow.position.y = 0.95
  scene.add(exitPool, exitGlow)

  // A plate is the pane's glass, standing on a slot instead of on the
  // floor. Shared across plates: they do not light independently, the
  // mouth beneath them does.
  const plateMaterial = new MeshPhysicalMaterial({
    color: 0xe8f7f4,
    metalness: 0,
    roughness: 0.06,
    transmission: 0.9,
    thickness: 0.02,
    ior: 1.5,
    transparent: true,
    opacity: 0.9,
  })
  const mouthMaterial = new MeshBasicMaterial({
    color: TURQUOISE,
    transparent: true,
    opacity: 0.55,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  // A grate's bars: paper, lit by the rig, so they read as floor that
  // is there rather than as light. Under them the chute: an ember that
  // is barely on until he goes through it.
  const slatMaterial = new MeshStandardMaterial({
    color: 0xd9e4e1,
    roughness: 0.55,
    metalness: 0.1,
  })
  const chuteMaterial = new MeshBasicMaterial({
    color: EMBER,
    map: buildRadialFalloff(),
    transparent: true,
    opacity: 0.06,
    blending: AdditiveBlending,
    depthWrite: false,
  })

  const roomGroup = new Group()
  scene.add(roomGroup)

  interface PlateParts {
    kind: 'slot'
    axis: 'h' | 'v'
    /** The plate, or for a vertical slot the near half of it. */
    plate: Mesh
    /** The far half of a vertical slot's plate. */
    far: Mesh | null
    mouth: Mesh
    material: MeshBasicMaterial
  }
  interface GrateParts {
    kind: 'mesh'
    spec: { readonly from: number; readonly to: number }
    slats: Group
    glow: Mesh
    /** The gap the slats were last laid for, so a range that widens
     * re-lays them and a frame that does not changes nothing. */
    laidFor: number
  }
  interface WedgeParts {
    kind: 'wedge'
    spec: { readonly from: number; readonly to: number }
    plate: Mesh
    mouth: Mesh
    material: MeshBasicMaterial
    /** The ceilings the plate was last cut for. */
    cutFor: { size: number; sizeOut: number }
  }
  type Parts = PlateParts | GrateParts | WedgeParts
  let parts: Parts[] = []
  let current = room

  const disposeChildren = (group: Group): void => {
    for (const child of [...group.children]) {
      group.remove(child)
      const mesh = child as Mesh
      mesh.geometry?.dispose()
      if (mesh.children.length > 0) disposeChildren(mesh as unknown as Group)
    }
  }

  const clearRoom = (): void => {
    disposeChildren(roomGroup)
    for (const p of parts) if (p.kind !== 'mesh') p.material.dispose()
    parts = []
  }

  /** The corridor's width, as the panes span it. */
  const SPAN = PANE.width * 1.15

  /** Lay a grate's bars for a gap. The gaps are exactly the judged
   * size and the two lips take the remainder, per `meshLayout`. */
  const layGrate = (g: GrateParts, size: number): void => {
    disposeChildren(g.slats)
    const { gaps, lip } = meshLayout(g.spec, size)
    const bar = (x0: number, width: number): void => {
      const slat = new Mesh(new BoxGeometry(width, 0.025, SPAN), slatMaterial)
      slat.position.set(x0 + width / 2, 0.0125, 0)
      g.slats.add(slat)
    }
    bar(g.spec.from, lip)
    let x = g.spec.from + lip
    for (let i = 0; i < gaps; i++) {
      x += size
      if (i < gaps - 1) {
        bar(x, SLAT)
        x += SLAT
      }
    }
    bar(g.spec.to - lip, lip)
    g.laidFor = size
  }

  /** Cut a wedge's plate: the part above a ceiling that falls from
   * `size` at the mouth to `sizeOut` at the far end. A trapezoid in
   * x-y, extruded across the corridor. */
  const cutWedge = (w: WedgeParts, size: number, sizeOut: number): void => {
    w.plate.geometry.dispose()
    const shape = new Shape()
    shape.moveTo(w.spec.from, size)
    shape.lineTo(w.spec.to, sizeOut)
    shape.lineTo(w.spec.to, PLATE_HEIGHT)
    shape.lineTo(w.spec.from, PLATE_HEIGHT)
    shape.closePath()
    w.plate.geometry = new ExtrudeGeometry(shape, {
      depth: SPAN,
      bevelEnabled: false,
    })
    w.plate.position.set(0, 0, -SPAN / 2)
    w.cutFor = { size, sizeOut }
  }

  const buildRoom = (furniture: readonly LineFurniture[]): void => {
    parts = furniture.map((f): Parts => {
      if (f.kind === 'wedge') {
        const plate = new Mesh(new BoxGeometry(0.01, 0.01, 0.01), plateMaterial)
        roomGroup.add(plate)
        const material = mouthMaterial.clone()
        // The mouth runs the wedge's whole floor: it is lit while he
        // fits where he stands, which changes as he walks.
        const mouth = new Mesh(
          new BoxGeometry(f.to - f.from, 0.012, SPAN),
          material,
        )
        mouth.position.set((f.from + f.to) / 2, 0.006, 0)
        roomGroup.add(mouth)
        const w: WedgeParts = {
          kind: 'wedge',
          spec: f,
          plate,
          mouth,
          material,
          cutFor: { size: -1, sizeOut: -1 },
        }
        return w
      }
      if (f.kind === 'mesh') {
        const slats = new Group()
        roomGroup.add(slats)
        // The chute under the grate. It sits just below the floor so
        // the bars occlude nothing of it: the floor here is a gradient
        // that writes no depth, and additive light through a dark disc
        // reads as a glow seen through a grate.
        const glow = new Mesh(
          new PlaneGeometry(f.to - f.from, SPAN),
          chuteMaterial,
        )
        glow.rotation.x = -Math.PI / 2
        glow.position.set((f.from + f.to) / 2, -0.02, 0)
        roomGroup.add(glow)
        const g: GrateParts = {
          kind: 'mesh',
          spec: f,
          slats,
          glow,
          laidFor: -1,
        }
        return g
      }
      const material = mouthMaterial.clone()
      if (f.axis === 'h') {
        // The plate is the part ABOVE the slot; the slot is the gap
        // between it and the floor. Its bottom edge is set per frame
        // from the gate's size, which is per player.
        const plate = new Mesh(
          new BoxGeometry(PANE.thick, 1, SPAN),
          plateMaterial,
        )
        plate.position.set(f.x, PLATE_HEIGHT / 2, 0)
        roomGroup.add(plate)
        // The mouth: a thin lit bar across the slot's opening, on the
        // floor -- the "this is open now" light borrowed from the exit.
        const mouth = new Mesh(new BoxGeometry(0.03, 0.012, SPAN), material)
        mouth.position.set(f.x, 0.006, 0)
        roomGroup.add(mouth)
        return { kind: 'slot', axis: 'h', plate, far: null, mouth, material }
      }
      // A vertical slot: the plate in two halves, either side of a gap
      // up the middle whose width is set per frame. The mouth is the
      // gap's own width, on the floor between them.
      const plate = new Mesh(
        new BoxGeometry(PANE.thick, PLATE_HEIGHT, 1),
        plateMaterial,
      )
      const far = new Mesh(
        new BoxGeometry(PANE.thick, PLATE_HEIGHT, 1),
        plateMaterial,
      )
      plate.position.set(f.x, PLATE_HEIGHT / 2, 0)
      far.position.set(f.x, PLATE_HEIGHT / 2, 0)
      roomGroup.add(plate, far)
      const mouth = new Mesh(new BoxGeometry(0.03, 0.012, 1), material)
      mouth.position.set(f.x, 0.006, 0)
      roomGroup.add(mouth)
      return { kind: 'slot', axis: 'v', plate, far, mouth, material }
    })
    exitPool.position.set(current.exitX, 0.003, 0)
    exitGlow.position.set(current.exitX, 0.95, 0)
  }

  let mercActor: MercActor | null = null
  let disposed = false
  let clock = 0

  return {
    async init(): Promise<void> {
      await renderer.init()
      if (disposed) return
      const actor = await createMerc(0.55, environment)
      if (disposed) {
        actor.dispose()
        return
      }
      mercActor = actor
      scene.add(actor.root)
    },

    load(next, furniture): void {
      if (disposed) return
      current = next
      clearRoom()
      buildRoom(furniture)
      // Put the camera where the chase would have eased it to, rather
      // than letting it fly there across the handover (slice 3's fix).
      camera.position.x = next.startX + 1.15
    },

    render(view: LineView, dt: number): void {
      if (disposed) return
      clock += Math.min(dt, 0.1)

      const actor = mercActor
      if (actor !== null) {
        actor.root.position.x = view.mercX
        // His TORSO stands on the floor. The root origin is his centre,
        // and the chambers put that centre at floor level, which reads
        // as hovering against a floor that is only a gradient. This room
        // has furniture with real heights: a plate whose slot sat above
        // the visible half of him while the sim said he did not fit is
        // what maff's phone found. `feetBelowRoot` is the torso bottom,
        // held still across every shape by the anchor.
        actor.root.position.y = view.mercY + actor.metrics().feetBelowRoot
        actor.root.rotation.y = 1.05 * view.mercFacing
        actor.setShape(view.widthScale, view.heightScale)
        actor.update(dt)
      }
      pool.position.x = view.mercX
      poolMaterial.opacity =
        0.12 * Math.max(0, Math.min(1, 1 - view.mercY * 1.6))
      floor.position.x = view.mercX

      key.position.x = view.mercX + (key.position.x - key.target.position.x)
      key.target.position.x = view.mercX
      glint.position.x =
        view.mercX + (glint.position.x - glint.target.position.x)
      glint.target.position.x = view.mercX
      rim.position.x = view.mercX + (rim.position.x - rim.target.position.x)
      rim.target.position.x = view.mercX

      const pulse = 0.5 + 0.5 * Math.sin(clock * 6)
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i]!
        const g = view.gates[i]
        if (g === undefined) continue
        if (p.kind === 'mesh') {
          if (Math.abs(p.laidFor - g.size) > 0.0005) layGrate(p, g.size)
          continue
        }
        if (p.kind === 'wedge') {
          if (
            Math.abs(p.cutFor.size - g.size) > 0.0005 ||
            Math.abs(p.cutFor.sizeOut - g.sizeOut) > 0.0005
          ) {
            cutWedge(p, g.size, g.sizeOut)
          }
          p.material.color.setHex(g.open ? CUSTARD : TURQUOISE)
          p.material.opacity = g.open ? 0.4 + pulse * 0.2 : 0.18
          continue
        }
        if (p.axis === 'h') {
          const top = PLATE_HEIGHT
          const bottom = g.size
          p.plate.scale.y = Math.max(0.01, top - bottom)
          p.plate.position.y = bottom + (top - bottom) / 2
        } else {
          const half = Math.max(0.01, (SPAN - g.size) / 2)
          p.plate.scale.z = half
          p.plate.position.z = g.size / 2 + half / 2
          p.far!.scale.z = half
          p.far!.position.z = -(g.size / 2 + half / 2)
          p.mouth.scale.z = g.size
        }
        p.material.color.setHex(g.open ? CUSTARD : TURQUOISE)
        p.material.opacity = g.open ? 0.55 + pulse * 0.3 : 0.28
      }
      // The chute is barely there until he is going through it.
      chuteMaterial.opacity = 0.06 + 0.7 * view.falling

      // The chase camera, centred. Where the chamber looks 1.1 ahead of
      // the camera and chases 0.9 + 0.6*facing ahead of him, this looks
      // the same 1.1 ahead and chases 1.1 + 0.15*facing, so he sits
      // 0.15 m off centre rather than 0.4 -- and it stands 0.3 further
      // back, for a body that is wide on purpose.
      const ahead = view.mercX + 1.1 + 0.15 * view.mercFacing
      const k = 1 - Math.exp(-3.2 * dt)
      camera.position.x += (ahead - camera.position.x) * k
      camera.lookAt(camera.position.x - 1.1, 0.42, 0)

      const breath = 0.5 + 0.5 * Math.sin(clock * 2.2)
      exitMaterial.color.setHex(view.exitOpen ? CUSTARD : TURQUOISE)
      exitMaterial.opacity = view.exitOpen ? 0.26 + breath * 0.2 : 0.15

      renderer.render(scene, camera)
    },

    merc(): MercActor | null {
      return mercActor
    },

    camera(): PerspectiveCamera {
      return camera
    },

    resize(width: number, height: number, pixelRatio: number): void {
      const aspect = width / Math.max(height, 1)
      camera.aspect = aspect
      // three's fov is VERTICAL; a portrait screen keeps the vertical
      // angle and throws the horizontal away, and the horizontal is the
      // axis the room runs along. Widen to hold it, never narrow.
      const designHalfH = (DESIGN_FOV_DEG * Math.PI) / 360
      const halfW = Math.atan(Math.tan(designHalfH) * DESIGN_ASPECT)
      const wanted = (2 * Math.atan(Math.tan(halfW) / aspect) * 180) / Math.PI
      camera.fov = Math.min(MAX_FOV_DEG, Math.max(DESIGN_FOV_DEG, wanted))
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(pixelRatio)
      renderer.setSize(width, height, false)
    },

    backend(): string {
      const b = renderer.backend as { isWebGPUBackend?: boolean }
      return b.isWebGPUBackend === true ? 'WebGPU' : 'WebGL2'
    },

    dispose(): void {
      disposed = true
      clearRoom()
      mercActor?.dispose()
      backdrop.dispose()
      environment.dispose()
      floor.geometry.dispose()
      floorMaterial.dispose()
      pool.geometry.dispose()
      poolMaterial.dispose()
      exitPool.geometry.dispose()
      exitGlow.geometry.dispose()
      exitMaterial.dispose()
      plateMaterial.dispose()
      slatMaterial.dispose()
      chuteMaterial.dispose()
      mouthMaterial.dispose()
      renderer.dispose()
    },
  }
}
