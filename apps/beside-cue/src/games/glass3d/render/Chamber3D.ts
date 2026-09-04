// A chamber, drawn.
// ============================================================
//
// The Hallway with the walls moved apart: same rig, same glass, same
// chase camera, and the same discipline -- this object draws what it is
// told and decides nothing. What it adds is the only thing a chamber has
// that a corridor does not: THE FLOOR SAYS WHAT THE ROOM IS DOING.
//
// The pattern is a row of instanced strips down the floor, coloured by
// `|sin(n*pi*x)|` for whichever mode is sounding -- cool and dim where
// the air is still, hot and bright where it is not. It is drawn from the
// same function `sim/chamber3d` judges the floor with, so what the
// player sees and what drops them cannot drift apart. One instanced mesh
// rather than seventy-two objects, because this is redrawn every frame
// and the whole point of it is to be read at a glance while singing.
//
// A single shard batch serves every pane. Two panes cannot be broken at
// once by one voice, and by the time a second goes the first's glass has
// settled -- so the batch simply moves to whichever pane just broke.

import { ACESFilmicToneMapping, AdditiveBlending, AmbientLight, BatchedMesh, BoxGeometry, CircleGeometry, Color, DoubleSide, DynamicDrawUsage, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, Quaternion, Scene, SpotLight, Vector3, } from 'three'
import { WebGPURenderer } from 'three/webgpu'
import { loadPaneShards } from '../assets'
import type { ChamberLevel } from '../levels/chambers'
import { groundIn, standingAmplitude } from '../sim/chamber3d'
import type { ShardLaunch, Vec3 } from '../sim/shatter3d'
import { shardAt } from '../sim/shatter3d'
import type { World3DConfig } from '../world3d-config'
import { FLOOR_STRIPS } from '../world3d-config'
import { aimFromRig, buildCabinetEnvironment, buildRadialFalloff, createBackdrop, RIG, } from './environment'
import { PANE } from './Hallway3D'
import type { MercActor } from './merc'
import { createMerc } from './merc'

const CUSTARD = 0xf2c84b
const TURQUOISE = 0x00777d
const PAPER = 0xfff4e2

/** The lens the rooms were composed through, and the screen shape they
 * were composed on. Same correction as the Hallway: hold the HORIZONTAL
 * angle, because that is the axis the room runs along. */
const DESIGN_FOV_DEG = 42
const DESIGN_ASPECT = 1.5
const MAX_FOV_DEG = 64

/** How many strips the floor pattern is cut into.
 *
 * It has to resolve the busiest mode the rooms use. Mode 5 has five
 * bellies and six nodes across the room, so eleven features -- at 72
 * strips that is six and a half strips per feature, which reads as a
 * pattern rather than as a row of lights. Doubling it buys nothing a
 * player can see at a glance, and this is redrawn every frame. */
const STRIPS = FLOOR_STRIPS

/** How high off the floor the strips sit. Enough to beat the floor's
 * own plane in the depth test, small enough not to be a step. */
const STRIP_Y = 0.004

/** How far down the room the pattern reaches before it fades out, in
 * metres. Roughly the floor's own pool, so the two agree about where
 * the room stops being a room. */
const PATTERN_REACH = 4.6

export interface ChamberView {
  /** Metres along the room, from the near wall. */
  mercX: number
  mercY: number
  mercFacing: 1 | -1
  /** Which mode is sounding, or null for silence. */
  mode: number | null
  /** 0..1. How much of the pattern to show: a voice that is barely
   * there should not paint the floor as though it meant it. */
  strength: number
  /** One flag per pane, in the chamber's own order. */
  paneBroken: readonly boolean[]
  /** The pane whose glass is in the air, and how long it has been. */
  breaking: {
    pane: number
    seconds: number
    launches: readonly ShardLaunch[]
  } | null
  /** 0..1 charge on the pane being sung at, for its glow. */
  resonance: number
  /** Whether the way out has been earned. Every pane gone. */
  exitOpen: boolean
}

export interface Chamber3D {
  init(): Promise<void>
  /**
   * Put a different room in front of Merc, keeping everything that is
   * not the room.
   *
   * The renderer, the environment map, the lighting rig, the shard
   * batch and Merc himself all survive, which is what lets a track walk
   * from one chamber to the next without a black frame -- and, upstream
   * of this, without letting go of the microphone. Only the glass, the
   * ledges and the floor's own divisions are rebuilt.
   */
  load(chamber: ChamberLevel): void
  render(view: ChamberView, dt: number): void
  /** The shard centroids, for the stage to solve a break from. */
  centroids(): readonly Vec3[]
  /** Where a pane stands, in room metres. */
  paneX(index: number): number
  merc(): MercActor | null
  resize(width: number, height: number, pixelRatio: number): void
  backend(): string
  dispose(): void
}

export const createChamber3D = (
  canvas: HTMLCanvasElement,
  cfg: World3DConfig,
  chamber: ChamberLevel,
): Chamber3D => {
  const renderer = new WebGPURenderer({ canvas, antialias: true })
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2

  const scene = new Scene()
  const camera = new PerspectiveCamera(DESIGN_FOV_DEG, 1, 0.05, 40)
  camera.position.set(1.5, 1.0, 2.6)

  // Radius 13, not 11. It is a BackSide sphere on the world ORIGIN, so
  // its radius has to cover the far end of the longest room plus the
  // chase camera standing behind him: at chamber 5's exit the camera is
  // 11.4 out and at its far wall 11.8, both of which put a third of the
  // frame outside a sphere of 11 and showed the clear colour through it.
  // Sized off CHAMBERS' longest (10) rather than a number that has to be
  // remembered when a room is added.
  const backdrop = createBackdrop(13)
  scene.add(backdrop.mesh)
  const environment = buildCabinetEnvironment()
  scene.environment = environment
  scene.environmentIntensity = 1

  // The rig follows Merc rather than the room. A corridor lit from one
  // fixed point is a corridor that goes dark halfway down it, and these
  // rooms are up to eight metres long.
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
  floor.scale.set(1.8, 1, 1)
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

  /** Which room is in front of him. Swapped by `load`. */
  let current = chamber

  // The pattern. Additive, so a strip the colour of the void IS the
  // void -- which is what lets a node be drawn as "nothing here" without
  // a second material or a per-instance alpha.
  //
  // The mesh is permanent and only its matrices move: the strip COUNT is
  // fixed, so a longer room is the same seventy-two strips spread wider,
  // and rebuilding an InstancedMesh per room would be churn for nothing.
  const strips = new InstancedMesh(
    new PlaneGeometry(1, 1.5),
    new MeshBasicMaterial({
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    }),
    STRIPS,
  )
  strips.instanceMatrix.setUsage(DynamicDrawUsage)
  const layOutStrips = (): void => {
    const width = current.length / STRIPS
    const m = new Matrix4()
    const p = new Vector3()
    const q = new Quaternion().setFromAxisAngle(
      new Vector3(1, 0, 0),
      -Math.PI / 2,
    )
    const s = new Vector3(width * 0.82, 1, 1)
    for (let i = 0; i < STRIPS; i++) {
      p.set((i + 0.5) * width, STRIP_Y, 0)
      strips.setMatrixAt(i, m.compose(p, q, s))
    }
    strips.instanceMatrix.needsUpdate = true
    // An InstancedMesh computes its bounding sphere ONCE, the first time
    // the frustum asks, and `setMatrixAt` does not invalidate it. This
    // was harmless while a stage owned one room; a track relays out the
    // strips for every room and the sphere stays the size of the first
    // one, so a longer room's far end was culled -- all seventy-two
    // strips at once, taking the floor pattern with them. Nulling it
    // makes three recompute on the next test.
    strips.boundingSphere = null
  }
  scene.add(strips)

  // The way out.
  //
  // A doorway would want a frame, and the Hallway already learned what a
  // frame does in a room that is mostly void: two dark posts read as
  // floating monoliths, not as a way through. So the exit is LIGHT, in
  // the same language everything else in this room is anchored by -- a
  // pool on the floor and a shaft standing in it.
  //
  // It is also the room's only answer to "what now". Closed it is cool
  // and nearly out; open it is custard and breathing, and it opens the
  // moment the last pane goes. A marker that merely said "the room ends
  // here" would be decoration; this one is the difference between
  // knowing you have finished and wandering to find out.
  const exitMaterial = new MeshBasicMaterial({
    color: TURQUOISE,
    map: buildRadialFalloff(),
    transparent: true,
    opacity: 0.06,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  // The pool is stretched ALONG the room, not around the shaft, and the
  // reason is the chase camera: it sits behind Merc looking back down
  // the room, so it only ever shows about two units ahead of him. A
  // pool the width of the shaft would not appear until he was already
  // standing in it, which is precisely the "walk into the dark to find
  // out" this exists to stop. Wide, and with a radial falloff doing the
  // fading, the light SPILLS back toward him and arrives on screen
  // before the way out does.
  const exitPool = new Mesh(new CircleGeometry(0.75, 48), exitMaterial)
  exitPool.rotation.x = -Math.PI / 2
  exitPool.scale.set(1.35, 1, 1.5)
  // Narrow and tall, and standing IN the pool rather than above it: a
  // radial falloff fades at its own edges, so a shaft that merely
  // touched the floor left a dark seam between the two and read as two
  // separate clouds instead of one way through.
  const exitGlow = new Mesh(new PlaneGeometry(0.62, 2.6), exitMaterial)
  exitGlow.position.y = 0.95
  scene.add(exitPool, exitGlow)

  const placeExit = (): void => {
    const x = current.exitAt * current.length
    // The light stands on whatever the exit stands on. A room can put
    // its way out on a ledge, and a pool painted on the floor under
    // that ledge would point at the one place the exit is not.
    const y = groundIn(current)(x, Number.POSITIVE_INFINITY) ?? 0
    exitPool.position.set(x, y + 0.003, 0)
    exitGlow.position.set(x, y + 0.95, 0)
  }

  const paneMaterial = new MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.04,
    transmission: 1,
    thickness: 0.012,
    ior: 1.5,
    transparent: false,
  })
  const panePoolMaterial = new MeshBasicMaterial({
    color: PAPER,
    map: buildRadialFalloff(),
    transparent: true,
    opacity: 0.1,
    blending: AdditiveBlending,
    depthWrite: false,
  })

  // Ledges. Solid, matte and pale: the one surface in the room that is
  // not glass and does not shake, and it has to look like it.
  const platformMaterial = new MeshStandardMaterial({
    color: 0x2a3a3c,
    roughness: 0.85,
    metalness: 0,
  })
  const PLATFORM_THICK = 0.09

  // Everything a room owns lives in one group, so swapping rooms is
  // emptying it and filling it again rather than remembering which of
  // the scene's children were glass.
  const roomGroup = new Group()
  scene.add(roomGroup)

  let paneXs: number[] = []
  let panes: { mesh: Mesh; light: Mesh }[] = []

  /** Drop the geometry a room owns. Materials and maps are shared or
   * cloned per pane; the clones go with their mesh. */
  const clearRoom = (): void => {
    for (const child of [...roomGroup.children]) {
      roomGroup.remove(child)
      const mesh = child as Mesh
      mesh.geometry?.dispose()
      const material = mesh.material
      if (material instanceof MeshPhysicalMaterial) material.dispose()
    }
    panes = []
    paneXs = []
  }

  const buildRoom = (): void => {
    paneXs = current.panes.map((p) => p.at * current.length)
    panes = current.panes.map((spec, i) => {
      const mesh = new Mesh(
        new BoxGeometry(PANE.thick, spec.height, PANE.width),
        // Each pane gets its own material: they light up independently,
        // and one shared material would glow them all at once.
        paneMaterial.clone(),
      )
      mesh.position.set(paneXs[i]!, spec.height / 2, 0)
      roomGroup.add(mesh)

      const light = new Mesh(new CircleGeometry(0.55, 48), panePoolMaterial)
      light.rotation.x = -Math.PI / 2
      light.position.set(paneXs[i]!, 0.002, 0)
      light.scale.set(0.5, 1, 1)
      roomGroup.add(light)
      return { mesh, light }
    })

    for (const p of current.platforms) {
      const mesh = new Mesh(
        new BoxGeometry(p.width, PLATFORM_THICK, PANE.width * 1.3),
        platformMaterial,
      )
      mesh.position.set(p.at * current.length, p.height - PLATFORM_THICK / 2, 0)
      roomGroup.add(mesh)
    }

    layOutStrips()
    placeExit()
  }
  buildRoom()

  const shardMaterial = new MeshPhysicalMaterial({
    color: 0xe8f7f4,
    metalness: 0,
    roughness: 0.08,
    transmission: 0.25,
    thickness: 0.004,
    ior: 1.5,
    transparent: true,
    opacity: 0.92,
    side: DoubleSide,
  })

  let mercActor: MercActor | null = null
  let shardBatch: BatchedMesh | null = null
  let shardIds: number[] = []
  let shardCentroids: Vec3[] = []
  let disposed = false
  let clock = 0

  const tmpMatrix = new Matrix4()
  const tmpPos = new Vector3()
  const tmpQuat = new Quaternion()
  const tmpAxis = new Vector3()
  const tmpScale = new Vector3(1, 1, 1)
  const safeColour = new Color(TURQUOISE)
  const dangerColour = new Color(0xc93513)
  const stripColour = new Color()

  const positionShards = (
    launches: readonly ShardLaunch[],
    seconds: number,
  ): void => {
    const batch = shardBatch
    if (batch === null) return
    for (let i = 0; i < shardIds.length; i++) {
      const launch = launches[i]
      if (launch === undefined) continue
      const pose = shardAt(launch, seconds, cfg.shatter)
      tmpPos.set(pose.position.x, pose.position.y, pose.position.z)
      tmpAxis
        .set(launch.spinAxis.x, launch.spinAxis.y, launch.spinAxis.z)
        .normalize()
      tmpQuat.setFromAxisAngle(tmpAxis, pose.angle)
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale)
      batch.setMatrixAt(shardIds[i]!, tmpMatrix)
    }
  }

  /**
   * Paint the floor with what the room is doing.
   *
   * Coloured by SAFETY, not by amplitude, and the difference matters. A
   * smooth ramp from cool to hot is a picture of the wave; what a player
   * needs is a picture of the FLOOR, and the floor has a threshold in it
   * -- below `floorThreshold` it holds and above it does not. Drawing
   * the threshold is what makes the pattern something to stand on rather
   * than something to look at, and it is read from the same number
   * `isFloorSafe` judges with, so the two cannot drift apart.
   *
   * Faded with distance from Merc, because the room's floor is a pool of
   * light that follows him and strips glowing on out into the void would
   * read as the room having no walls -- which it does, and should not
   * advertise.
   */
  const paintPattern = (
    mode: number | null,
    strength: number,
    mercX: number,
  ): void => {
    const show = mode === null ? 0 : Math.max(0, Math.min(1, strength))
    const threshold = current.floorThreshold
    for (let i = 0; i < STRIPS; i++) {
      const x01 = (i + 0.5) / STRIPS
      const amp = mode === null ? 0 : standingAmplitude(x01, mode)
      if (amp <= threshold) {
        // Safe, and brightest exactly at a node -- the place worth
        // walking to.
        stripColour.copy(safeColour)
        stripColour.multiplyScalar(0.22 + 0.5 * (1 - amp / (threshold || 1)))
      } else {
        // Not safe, and hotter the worse it gets, so the middle of a
        // belly still reads as the middle of a belly.
        const over = (amp - threshold) / (1 - threshold || 1)
        stripColour.copy(dangerColour)
        stripColour.multiplyScalar(0.35 + 0.65 * over)
      }
      const away = Math.abs(x01 * current.length - mercX)
      const fade = Math.max(0, 1 - away / PATTERN_REACH)
      stripColour.multiplyScalar(show * fade * fade)
      strips.setColorAt(i, stripColour)
    }
    if (strips.instanceColor !== null) strips.instanceColor.needsUpdate = true
  }

  return {
    async init(): Promise<void> {
      await renderer.init()
      if (disposed) return

      const [actor, shards] = await Promise.all([
        createMerc(0.55, environment),
        loadPaneShards(),
      ])
      if (disposed) {
        actor.dispose()
        return
      }
      mercActor = actor
      scene.add(actor.root)

      const geometries = shards.meshes.map((m) => m.geometry)
      const vertexCount = geometries.reduce(
        (sum, g) => sum + g.attributes.position!.count,
        0,
      )
      const indexCount = geometries.reduce(
        (sum, g) => sum + (g.index?.count ?? 0),
        0,
      )
      const batch = new BatchedMesh(
        geometries.length,
        vertexCount,
        indexCount,
        shardMaterial,
      )
      shardCentroids = shards.centroids
      shardIds = geometries.map((g) => {
        const geometryId = batch.addGeometry(g)
        return batch.addInstance(geometryId)
      })
      shardBatch = batch
      scene.add(batch)

      // Link the shard program now, for the reason the Hallway spells
      // out: three compiles on first draw, and first draw would
      // otherwise be the first frame of a break.
      batch.visible = true
      await renderer.compileAsync(batch, camera, scene)
      batch.visible = false
      if (disposed) return
      paintPattern(null, 0, current.startAt * current.length)
    },

    render(view: ChamberView, dt: number): void {
      if (disposed) return
      clock += Math.min(dt, 0.1)

      const breaking = view.breaking
      for (let i = 0; i < panes.length; i++) {
        panes[i]!.mesh.visible = view.paneBroken[i] !== true
      }
      if (shardBatch !== null) {
        const live = breaking !== null && breaking.seconds > 0
        shardBatch.visible = live
        if (live) {
          shardBatch.position.x = paneXs[breaking.pane] ?? 0
          positionShards(breaking.launches, breaking.seconds)
        }
      }

      const actor = mercActor
      if (actor !== null) {
        actor.root.position.x = view.mercX
        actor.root.position.y = view.mercY
        actor.root.rotation.y = 1.05 * view.mercFacing
        actor.update(dt)
      }
      pool.position.x = view.mercX
      poolMaterial.opacity = 0.12 * Math.max(0, 1 - view.mercY * 1.6)
      floor.position.x = view.mercX

      // The lights ride with him, or the far end of an eight-metre room
      // is a place you walk into and vanish.
      key.position.x = view.mercX + (key.position.x - key.target.position.x)
      key.target.position.x = view.mercX
      glint.position.x =
        view.mercX + (glint.position.x - glint.target.position.x)
      glint.target.position.x = view.mercX
      rim.position.x = view.mercX + (rim.position.x - rim.target.position.x)
      rim.target.position.x = view.mercX

      paintPattern(view.mode, view.strength, view.mercX)

      // The chase camera, exactly the Hallway's, biased by facing so
      // walking back down the room does not walk him off his own screen.
      const ahead = view.mercX + 0.9 + 0.6 * view.mercFacing
      const k = 1 - Math.exp(-3.2 * dt)
      camera.position.x += (ahead - camera.position.x) * k
      camera.lookAt(camera.position.x - 1.1, 0.45, 0)

      // The exit breathes when it is open, and the breath is slower than
      // the pane's ring: one is urgency, the other is an invitation.
      const breath = 0.5 + 0.5 * Math.sin(clock * 2.2)
      exitMaterial.color.setHex(view.exitOpen ? CUSTARD : TURQUOISE)
      // Closed is dim but not out: it says "the room ends there, and not
      // yet" to anyone who can see that far. Steady, too -- the breath
      // is what makes the open one read as an invitation, so a closed
      // exit that also breathed would be inviting him through glass.
      exitMaterial.opacity = view.exitOpen ? 0.26 + breath * 0.2 : 0.15

      const pulse = 0.5 + 0.5 * Math.sin(clock * 9)
      for (let i = 0; i < panes.length; i++) {
        const material = panes[i]!.mesh.material as MeshPhysicalMaterial
        const lit = breaking === null && view.resonance > 0
        material.emissive.setHex(CUSTARD)
        material.emissiveIntensity = lit
          ? view.resonance * 0.2 + (view.resonance >= 1 ? pulse * 0.28 : 0)
          : 0
      }

      renderer.render(scene, camera)
    },

    load(next: ChamberLevel): void {
      if (disposed) return
      current = next
      clearRoom()
      buildRoom()
      if (shardBatch !== null) shardBatch.visible = false
      paintPattern(null, 0, next.startAt * next.length)
      // Put the camera where the chase would have eased it to, rather
      // than letting it fly there. `enterRoom` teleports Merc to the new
      // room's start and starts him walking immediately, and the ease
      // has a ~0.3s time constant -- so the handover this whole design
      // exists to make seamless spent up to two thirds of a second with
      // the player steering someone off the side of their own screen.
      camera.position.x = next.startAt * next.length + 1.5
    },

    centroids(): readonly Vec3[] {
      return shardCentroids
    },

    paneX(index: number): number {
      return paneXs[index] ?? 0
    },

    merc(): MercActor | null {
      return mercActor
    },

    resize(width: number, height: number, pixelRatio: number): void {
      const aspect = width / Math.max(height, 1)
      camera.aspect = aspect
      // three's fov is VERTICAL, so a portrait screen keeps the vertical
      // angle and throws the horizontal away -- and the horizontal is
      // the axis the room runs along. Widen to hold it, never narrow.
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
      mercActor?.dispose()
      clearRoom()
      backdrop.dispose()
      environment.dispose()
      strips.dispose()
      exitMaterial.dispose()
      renderer.dispose()
    },
  }
}
