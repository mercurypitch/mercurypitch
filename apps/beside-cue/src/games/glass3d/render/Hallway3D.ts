// The Hallway, drawn.
// ============================================================
//
// Slice 1's room: a dark corridor, Merc hovering along it, and one
// glass pane across the way. Same discipline as Renderer3D — this
// object draws what it is told and decides nothing; the traversal
// script and every rule live in the stage component and `sim/`.
//
// The camera is the slice's one new idea: it follows. A gentle
// exponential chase of Merc's x, framed a little ahead of him, so the
// room reads as travel rather than as a diorama.

import { ACESFilmicToneMapping, AdditiveBlending, AmbientLight, BatchedMesh, BoxGeometry, CircleGeometry, DoubleSide, Matrix4, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, PerspectiveCamera, Quaternion, Scene, SpotLight, Vector3, } from 'three'
import { WebGPURenderer } from 'three/webgpu'
import { loadPaneShards } from '../assets'
import type { ShardLaunch, Vec3 } from '../sim/shatter3d'
import { shardAt } from '../sim/shatter3d'
import type { World3DConfig } from '../world3d-config'
import { aimFromRig, buildCabinetEnvironment, buildRadialFalloff, createBackdrop, RIG, } from './environment'
import type { MercActor } from './merc'
import { createMerc } from './merc'

const CUSTARD = 0xf2c84b
const TURQUOISE = 0x00777d
const PAPER = 0xfff4e2

/** The pane, in scene metres. Matches art/pane/make_pane.py. */
export const PANE = { width: 0.72, height: 1.05, thick: 0.006 }

export interface HallwayView {
  /** Where Merc is along the corridor. The stage owns the journey. */
  mercX: number
  /** 0..1 charge on the pane. */
  resonance: number
  ringing: boolean
  shatterSeconds: number
  launches: readonly ShardLaunch[] | null
}

export interface Hallway3D {
  init(): Promise<void>
  render(view: HallwayView, dt: number): void
  centroids(): readonly Vec3[]
  merc(): MercActor | null
  resize(width: number, height: number, pixelRatio: number): void
  backend(): string
  dispose(): void
}

export const createHallway3D = (
  canvas: HTMLCanvasElement,
  cfg: World3DConfig,
): Hallway3D => {
  const renderer = new WebGPURenderer({ canvas, antialias: true })
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2

  const scene = new Scene()
  // A 3/4 chase, not a pure side view -- and that is load-bearing. The
  // pane blocks travel along x, so its face is normal to the corridor:
  // a camera square to the corridor sees the pane EDGE-ON, a six-
  // millimetre sliver with a big dark parallelogram behind it. From the
  // diagonal the face catches the backdrop and reads as glass, and
  // Merc's face turns toward the lens instead of away down the hall.
  const camera = new PerspectiveCamera(40, 1, 0.05, 30)
  camera.position.set(1.5, 1.0, 2.4)

  const backdrop = createBackdrop(9)
  scene.add(backdrop.mesh)
  const environment = buildCabinetEnvironment()
  scene.environment = environment
  scene.environmentIntensity = 1

  // The rig, restaged for a corridor: same three directions as the
  // Cabinet and as the environment map, at a room's distances instead
  // of a tabletop's.
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

  // The floor: the same edgeless disc trick as the plinth, stretched
  // into a long soft pool that follows Merc. The void stays the floor's
  // edges; the light says where "down" is.
  const floorMaterial = new MeshBasicMaterial({
    color: 0x0b1011,
    alphaMap: buildRadialFalloff(),
    transparent: true,
    depthWrite: false,
  })
  const floor = new Mesh(new CircleGeometry(2.6, 48), floorMaterial)
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

  // The pane: BoxGeometry at runtime, no asset — three lines beat a
  // file that must be loaded and versioned (art/pane/make_pane.py says
  // the same from the other side). Same physical glass as the bowl.
  const paneMaterial = new MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.04,
    transmission: 1,
    thickness: 0.012,
    ior: 1.5,
    transparent: false,
  })
  const pane = new Mesh(
    new BoxGeometry(PANE.thick, PANE.height, PANE.width),
    paneMaterial,
  )
  pane.position.set(0, PANE.height / 2, 0)
  scene.add(pane)

  // No frame around it, deliberately: the first build gave it two dark
  // posts, and in a room that is mostly void they read as floating
  // monoliths, not as a doorway. What anchors the pane instead is its
  // own pool of light on the floor -- same trick as the plinth.
  const panePoolMaterial = new MeshBasicMaterial({
    color: PAPER,
    map: buildRadialFalloff(),
    transparent: true,
    opacity: 0.1,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  const panePool = new Mesh(new CircleGeometry(0.55, 48), panePoolMaterial)
  panePool.rotation.x = -Math.PI / 2
  panePool.position.set(0, 0.002, 0)
  panePool.scale.set(0.5, 1, 1)
  scene.add(panePool)

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

      // Link the shard program NOW, while nothing is waiting for it.
      //
      // three does not draw an invisible object, and it does not compile
      // one either: the material's program is built the first time it
      // actually reaches a draw call. The batch is hidden until the pane
      // breaks, so that first draw is the first frame of the shatter --
      // the one frame in the game that must not stall. A WebGL2 program
      // link is not free anywhere and on iOS it is slow enough to read
      // as the animation itself being broken.
      //
      // compileAsync takes the object, the camera it will be seen by,
      // and the scene it belongs to. It has to be visible while it
      // happens, for the same reason it was never compiled.
      batch.visible = true
      await renderer.compileAsync(batch, camera, scene)
      batch.visible = false
      if (disposed) return
    },

    render(view: HallwayView, dt: number): void {
      if (disposed) return
      clock += Math.min(dt, 0.1)

      const breaking = view.launches !== null && view.shatterSeconds > 0
      pane.visible = !breaking
      if (shardBatch !== null) shardBatch.visible = breaking
      if (breaking && view.launches !== null) {
        positionShards(view.launches, view.shatterSeconds)
      }

      // Merc drives everything that moves with him.
      const actor = mercActor
      if (actor !== null) {
        actor.root.position.x = view.mercX
        // Mostly toward travel, cheated toward the lens -- the classic
        // side-scroller lie. Square to the corridor his face is a
        // profile; at ~60 degrees he reads as going somewhere AND as
        // someone.
        actor.root.rotation.y = 1.05
        actor.update(dt)
      }
      pool.position.x = view.mercX
      floor.position.x = view.mercX * 0.6

      // The chase camera: exponential, framed ahead, from the diagonal.
      // dt-independent smoothing -- 1 - exp(-k dt) is the lerp factor
      // that behaves the same at 30 and at 120 fps.
      const ahead = view.mercX + 1.5
      const k = 1 - Math.exp(-3.2 * dt)
      camera.position.x += (ahead - camera.position.x) * k
      camera.lookAt(camera.position.x - 1.1, 0.45, 0)

      // The pane brightens toward the break exactly as the bowl does.
      key.intensity = 55 + view.resonance * 70
      poolMaterial.opacity = 0.12 + view.resonance * 0.2
      const pulse = view.ringing ? 0.5 + 0.5 * Math.sin(clock * 9) : 0
      paneMaterial.emissive.setHex(CUSTARD)
      paneMaterial.emissiveIntensity = view.resonance * 0.2 + pulse * 0.28

      renderer.render(scene, camera)
    },

    centroids(): readonly Vec3[] {
      return shardCentroids
    },

    merc(): MercActor | null {
      return mercActor
    },

    resize(width: number, height: number, pixelRatio: number): void {
      camera.aspect = width / Math.max(height, 1)
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
      shardBatch?.dispose()
      mercActor?.dispose()
      backdrop.dispose()
      environment.dispose()
      floor.geometry.dispose()
      floorMaterial.dispose()
      pool.geometry.dispose()
      poolMaterial.dispose()
      pane.geometry.dispose()
      paneMaterial.dispose()
      panePool.geometry.dispose()
      panePoolMaterial.dispose()
      shardMaterial.dispose()
      void renderer.dispose()
    },
  }
}
