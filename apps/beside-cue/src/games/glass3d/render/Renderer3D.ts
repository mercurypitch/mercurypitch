// The Cabinet, drawn.
// ============================================================
//
// One imperative object that owns the three.js scene and nothing else.
// It takes the world's state each frame and puts it on screen; it never
// decides anything. Every number that shapes behaviour lives in
// `world3d-config.ts`, and every rule lives in `sim/` — which is what
// lets the whole simulation be tested without a GPU.
//
// The renderer is `WebGPURenderer` with its automatic backend: one
// object that runs on WebGPU where the device has it and falls back to
// WebGL2 where it does not. That is why the shatter is animated from
// the CPU rather than from a compute shader — see `positionShards`.

import type { Object3D } from 'three'
import { ACESFilmicToneMapping, AmbientLight, BatchedMesh, Color, CylinderGeometry, DataTexture, EquirectangularReflectionMapping, Group, Matrix4, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, PerspectiveCamera, Quaternion, Scene, SpotLight, SRGBColorSpace, Vector3, } from 'three'
import { WebGPURenderer } from 'three/webgpu'
import { loadGlass, loadShards } from '../assets'
import type { ShardLaunch, Vec3 } from '../sim/shatter3d'
import { shardAt } from '../sim/shatter3d'
import type { World3DConfig } from '../world3d-config'

/**
 * The room, as something to reflect: a small equirectangular gradient
 * carrying the same three colours the lights use.
 */
const buildCabinetEnvironment = (): DataTexture => {
  const w = 32
  const h = 16
  const data = new Uint8Array(w * h * 4)
  const warm = [0.98, 0.78, 0.36]
  const cold = [0.16, 0.55, 0.6]
  const floor = [0.09, 0.06, 0.05]

  for (let y = 0; y < h; y++) {
    // 0 at the top of the sphere, 1 at the bottom.
    const v = y / (h - 1)
    for (let x = 0; x < w; x++) {
      const u = x / (w - 1)
      // The key light sits up and to one side; the glint opposes it.
      const keySide = Math.max(0, Math.cos((u - 0.15) * Math.PI * 2))
      const glintSide = Math.max(0, Math.cos((u - 0.65) * Math.PI * 2))
      const sky = Math.max(0, 1 - v * 1.6)
      const i = (y * w + x) * 4
      for (let c = 0; c < 3; c++) {
        const lit =
          warm[c]! * keySide * sky * 1.15 + cold[c]! * glintSide * sky * 0.5
        data[i + c] = Math.round(Math.min(1, floor[c]! + lit) * 255)
      }
      data[i + 3] = 255
    }
  }

  const tex = new DataTexture(data, w, h)
  tex.mapping = EquirectangularReflectionMapping
  tex.colorSpace = SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

/** The Cabinet's palette, from the brand tokens (§2 of the art plan). */
const INK = 0x241913 // the void — warm near-black, never pure black
const CUSTARD = 0xf2c84b // the one spotlight
const TURQUOISE = 0x00777d // the cold glint that keeps glass from going flat

export interface StageView {
  /** 0 = intact, 1 = fully broken. Drives the shard positions. */
  shatterProgress: number
  /** Seconds since the break began; the shard solver's clock. */
  shatterSeconds: number
  /** 0..1 charge, brightens the glass as the note takes hold. */
  resonance: number
  launches: readonly ShardLaunch[] | null
}

export interface Renderer3D {
  /** Build the scene and load the assets. Await before the first draw. */
  init(): Promise<void>
  render(view: StageView): void
  /** Where each shard sat in the intact glass — solveShatter's input.
   * Empty until `init` resolves. */
  centroids(): readonly Vec3[]
  resize(width: number, height: number, pixelRatio: number): void
  /** Which backend the device actually gave us, for the HUD. */
  backend(): string
  dispose(): void
}

export const createRenderer3D = (
  canvas: HTMLCanvasElement,
  cfg: World3DConfig,
): Renderer3D => {
  const renderer = new WebGPURenderer({ canvas, antialias: true })
  // Without tone mapping every lit surface clips straight to its hue, so
  // a near-black plinth under a warm spotlight renders as flat gold.
  // This is a dark room with one bright source — exactly the case that
  // needs a curve rather than a clamp.
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  const scene = new Scene()
  scene.background = new Color(INK)

  // A fixed cinematic stage (§3, decided): the camera never moves, so the
  // composition is authored once rather than defended against a player.
  const camera = new PerspectiveCamera(38, 1, 0.05, 20)
  camera.position.set(0.42, 0.3, 0.52)
  camera.lookAt(0, 0.16, 0)

  // One spotlight. The scene is genuinely dark otherwise, which is the
  // point: the voice is what lights the room.
  // Intensity is in candela (three r155+ uses physical units) and the
  // glass is 22 cm tall, so these numbers are larger than they look.
  const key = new SpotLight(CUSTARD, 30, 6, Math.PI / 14, 0.9, 1.8)
  key.position.set(-0.5, 0.95, 0.4)
  key.target.position.set(0, 0.17, 0)
  scene.add(key, key.target)

  const glint = new SpotLight(TURQUOISE, 16, 4, Math.PI / 6, 0.6, 1.6)
  glint.position.set(0.8, 0.5, -0.6)
  glint.target.position.set(0, 0.16, 0)
  scene.add(glint, glint.target)

  // Just enough ambient that the unlit side is not a silhouette.
  scene.add(new AmbientLight(0xffffff, 0.06))

  // Glass is only glass because of what it bends. With no environment a
  // transmissive material has nothing to refract and reads as a dim
  // outline -- which is exactly how the first build looked.
  //
  // This is a hand-built equirectangular gradient rather than
  // PMREMGenerator + RoomEnvironment, for two reasons. PMREMGenerator
  // does not work with WebGPURenderer in this version (it reaches into
  // WebGL render-target internals and throws on `buffers`, leaving init
  // unresolved and the screen black). And a generic bright room is the
  // wrong content anyway: what the glass should be reflecting is THIS
  // room -- warm above where the key light is, cold on the turquoise
  // side, near-black below. Two kilobytes, and it matches the lighting.
  scene.environment = buildCabinetEnvironment()
  scene.environmentIntensity = 0.55

  const glassMaterial = new MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.04,
    transmission: 1,
    thickness: 0.004,
    ior: 1.5,
    transparent: false,
  })

  // The plinth. The shatter already bounces shards off y = 0; without
  // something drawn there they rebound off nothing, and the glass floats.
  // Sized against the glass, not the frame: the bowl is 46 mm across, so
  // a 130 mm plinth reads as a stage rather than a stand. Rough and very
  // dark, or it takes the spotlight and becomes the brightest thing in a
  // room whose whole point is that almost nothing is lit.
  const plinth = new Mesh(
    new CylinderGeometry(0.055, 0.062, 0.014, 48),
    // Unlit, deliberately. A lit plinth sits directly in the beam and
    // comes back as the brightest object on screen no matter how low its
    // albedo goes -- a dielectric still reflects the light and the warm
    // environment, and dimming it further just makes a dark yellow disc.
    // In a void the base is supposed to be a silhouette that stops the
    // glass floating, so it opts out of the lighting model entirely.
    new MeshBasicMaterial({ color: 0x161010 }),
  )
  plinth.position.y = -0.007
  scene.add(plinth)

  const root = new Group()
  scene.add(root)

  let intact: Object3D | null = null
  let shardBatch: BatchedMesh | null = null
  let shardIds: number[] = []
  let shardCentroids: Vec3[] = []
  let disposed = false

  const tmpMatrix = new Matrix4()
  const tmpPos = new Vector3()
  const tmpQuat = new Quaternion()
  const tmpAxis = new Vector3()
  const tmpScale = new Vector3(1, 1, 1)

  /**
   * Put every shard where the simulation says it is.
   *
   * `shardAt` is the specification for shard motion and it already
   * exists, tested, on the CPU. Re-implementing that arithmetic in a
   * vertex shader would buy one thing — no per-frame CPU work — and cost
   * a second copy of the rule that has to stay in step with the first.
   * At ~100 shards the work being avoided is ~100 matrix composes a
   * frame, which is nothing; a `BatchedMesh` keeps it to one draw call
   * either way. If a mechanic ever wants thousands of pieces, the shader
   * path is still open, and `shardAt` is what it must match.
   */
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

      const [glass, shards] = await Promise.all([loadGlass(), loadShards()])
      if (disposed) return

      glass.traverse((o) => {
        const mesh = o as Mesh
        if (mesh.isMesh === true) mesh.material = glassMaterial
      })
      intact = glass
      root.add(glass)

      // One BatchedMesh for every shard: one draw call, and the per-shard
      // transforms stay ordinary CPU-side matrices.
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
        glassMaterial,
      )
      shardCentroids = shards.centroids
      shardIds = geometries.map((g) => {
        const geometryId = batch.addGeometry(g)
        return batch.addInstance(geometryId)
      })
      batch.visible = false
      shardBatch = batch
      root.add(batch)
    },

    render(view: StageView): void {
      if (disposed) return

      const breaking = view.launches !== null && view.shatterProgress > 0
      if (intact !== null) intact.visible = !breaking
      if (shardBatch !== null) shardBatch.visible = breaking

      if (breaking && view.launches !== null) {
        positionShards(view.launches, view.shatterSeconds)
      }

      // The glass gathering charge is the only pre-break feedback there
      // is, so it has to be visible without being a UI element: the
      // spotlight leans warmer and brighter as the note holds.
      key.intensity = 30 + view.resonance * 60

      renderer.render(scene, camera)
    },

    centroids(): readonly Vec3[] {
      return shardCentroids
    },

    resize(width: number, height: number, pixelRatio: number): void {
      camera.aspect = width / Math.max(height, 1)
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(pixelRatio)
      renderer.setSize(width, height, false)
    },

    backend(): string {
      // `renderer.backend` is typed as the base Backend; only the WebGPU
      // one carries this flag, and which we got is exactly the question.
      const b = renderer.backend as { isWebGPUBackend?: boolean }
      return b.isWebGPUBackend === true ? 'WebGPU' : 'WebGL2'
    },

    dispose(): void {
      disposed = true
      shardBatch?.dispose()
      plinth.geometry.dispose()
      ;(plinth.material as MeshBasicMaterial).dispose()
      scene.environment?.dispose()
      glassMaterial.dispose()
      intact?.traverse((o) => {
        const mesh = o as Mesh
        if (mesh.isMesh === true) mesh.geometry.dispose()
      })
      // One renderer per app lifetime is the rule (§5.5); this is the
      // teardown that makes a remount safe under HMR.
      void renderer.dispose()
    },
  }
}
