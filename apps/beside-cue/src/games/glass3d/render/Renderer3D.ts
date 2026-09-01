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
//
// On lighting: the room is a photographic setup, not an attempt at
// realism. A key, a rim and a backlight, aimed at a piece of glassware,
// against a dark cyclorama — see `environment.ts` for why the room has
// to be there at all.

import type { Object3D } from 'three'
import { ACESFilmicToneMapping, AdditiveBlending, AmbientLight, BatchedMesh, CircleGeometry, Color, DoubleSide, Matrix4, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, PerspectiveCamera, PlaneGeometry, Quaternion, Scene, SpotLight, Vector3, } from 'three'
import { WebGPURenderer } from 'three/webgpu'
import { loadGlass, loadShards } from '../assets'
import type { ShardLaunch, Vec3 } from '../sim/shatter3d'
import { shardAt } from '../sim/shatter3d'
import type { World3DConfig } from '../world3d-config'
import { buildCabinetEnvironment, buildRadialFalloff, createBackdrop, } from './environment'

/** The Cabinet's palette, from the brand tokens (§2 of the art plan). */
const CUSTARD = 0xf2c84b // the one spotlight
const TURQUOISE = 0x00777d // the cold glint that keeps glass from going flat
const PAPER = 0xfff4e2 // the backlight behind the bowl

/** Where the bowl sits, in metres. Lights and the shatter both aim here. */
const BOWL = { x: 0, y: 0.17, z: 0 }

export interface StageView {
  /** 0 = intact, 1 = fully broken. Drives the shard positions. */
  shatterProgress: number
  /** Seconds since the break began; the shard solver's clock. */
  shatterSeconds: number
  /** 0..1 charge, brightens the glass as the note takes hold. */
  resonance: number
  /** Charged as far as a steady hold can take it — only vibrato moves it
   * now. The scene says so, so the HUD is not the only place that does. */
  ringing: boolean
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
  renderer.toneMappingExposure = 1.25
  const scene = new Scene()

  // A fixed cinematic stage (§3, decided): the camera never moves, so the
  // composition is authored once rather than defended against a player.
  const camera = new PerspectiveCamera(36, 1, 0.05, 20)
  camera.position.set(0.38, 0.28, 0.47)
  camera.lookAt(BOWL.x, 0.15, BOWL.z)

  // The void, as geometry rather than as a clear colour — a transmissive
  // material refracts what is behind it, and a clear colour is not.
  const backdrop = createBackdrop()
  scene.add(backdrop.mesh)

  // Glass is only glass because of what it bends. With no environment a
  // transmissive material has nothing to refract and reads as a dim
  // outline -- which is exactly how the first build looked.
  //
  // Hand-built rather than PMREMGenerator + RoomEnvironment, for two
  // reasons. PMREMGenerator does not work with WebGPURenderer in this
  // version (it reaches into WebGL render-target internals and throws on
  // `buffers`, leaving init unresolved and the screen black). And a
  // generic bright room is the wrong content anyway: what the glass
  // should be reflecting is THIS room.
  const environment = buildCabinetEnvironment()
  scene.environment = environment
  scene.environmentIntensity = 1

  // The key. Intensity is in candela (three r155+ uses physical units)
  // and the glass is 22 cm tall, so these numbers are larger than they
  // look.
  const key = new SpotLight(CUSTARD, 34, 6, Math.PI / 14, 0.9, 1.8)
  key.position.set(-0.5, 0.95, 0.4)
  key.target.position.set(BOWL.x, BOWL.y, BOWL.z)
  scene.add(key, key.target)

  // The cold glint, opposite the key, so the shadow side of the bowl has
  // an edge rather than dissolving into the backdrop.
  const glint = new SpotLight(TURQUOISE, 22, 4, Math.PI / 6, 0.6, 1.6)
  glint.position.set(0.8, 0.5, -0.6)
  glint.target.position.set(BOWL.x, 0.16, BOWL.z)
  scene.add(glint, glint.target)

  // The rim. Behind the glass and low, pointing back at the camera: this
  // is the light that draws the bright outline down the stem, and it is
  // the single biggest reason a glass reads as a glass instead of as a
  // smudge.
  const rim = new SpotLight(PAPER, 12, 3, Math.PI / 7, 0.7, 1.4)
  rim.position.set(-0.15, 0.34, -0.62)
  rim.target.position.set(BOWL.x, BOWL.y, BOWL.z)
  scene.add(rim, rim.target)

  // Just enough ambient that the unlit side is not a silhouette.
  scene.add(new AmbientLight(0xffffff, 0.08))

  // The diffuser panel. A photographer shooting glassware puts a lit
  // white card behind it; the bowl then carries a bright field that its
  // own curvature distorts, which is the glow that says "hollow". A
  // light alone cannot do this — there has to be something bright IN the
  // scene for the transmission pass to find.
  //
  // Placed along the camera's own line of sight rather than at some
  // world-space z, and sized to hide behind the bowl. Put it "behind the
  // glass" in world terms and it lands beside the glass on screen, where
  // it is not a diffuser at all -- it is a large pale rectangle stuck to
  // the side of the frame.
  //
  // Additive, and that is not a style choice. A falloff texture on an
  // ordinary transparent material paints its own black corners over the
  // backdrop: the diffuser stops being light and becomes a black card
  // with a glow on it. Added rather than blended, the dark end of the
  // texture contributes nothing and only the light is left.
  const backPanelMaterial = new MeshBasicMaterial({
    color: PAPER,
    map: buildRadialFalloff(),
    side: DoubleSide,
    transparent: true,
    opacity: 0.85,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  const backPanel = new Mesh(new PlaneGeometry(0.07, 0.13), backPanelMaterial)
  {
    const bowl = new Vector3(BOWL.x, BOWL.y, BOWL.z)
    backPanel.position
      .copy(bowl)
      .sub(camera.position)
      .normalize()
      .multiplyScalar(0.34)
      .add(bowl)
    backPanel.lookAt(camera.position)
  }
  scene.add(backPanel)

  // The plinth. The shatter already bounces shards off y = 0; without
  // something drawn there they rebound off nothing, and the glass floats.
  // Sized against the glass, not the frame: the bowl is 46 mm across, so
  // a 130 mm plinth reads as a stage rather than a stand.
  // Unlit and edgeless. A lit plinth sits directly in the beam and comes
  // back as the brightest object on screen no matter how low its albedo
  // goes -- a dielectric still reflects the light and the warm
  // environment, and dimming it further just makes a dark yellow disc.
  // A solid cylinder is not much better: against a dark backdrop it is a
  // hard black ellipse, which reads as a hole rather than as a floor.
  //
  // So the ground is one flat disc that fades out before it ends, and
  // the light pool below does the actual work of saying where the floor
  // is. The shatter still bounces off y = 0 either way.
  const plinthMaterial = new MeshBasicMaterial({
    color: 0x0a0f10,
    alphaMap: buildRadialFalloff(),
    transparent: true,
    depthWrite: false,
  })
  const plinth = new Mesh(new CircleGeometry(0.085, 48), plinthMaterial)
  plinth.rotation.x = -Math.PI / 2
  plinth.position.y = 0
  scene.add(plinth)

  // Spill: the warm pool the key would throw on the plinth top. Additive
  // and unlit for the same reason the plinth is, and it doubles as the
  // charge readout — it brightens as the note takes hold, under the
  // glass, where the player is already looking.
  const poolMaterial = new MeshBasicMaterial({
    color: CUSTARD,
    map: buildRadialFalloff(),
    transparent: true,
    opacity: 0.07,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  const pool = new Mesh(new CircleGeometry(0.075, 48), poolMaterial)
  pool.rotation.x = -Math.PI / 2
  pool.position.y = 0.0005
  scene.add(pool)

  const glassMaterial = new MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.03,
    transmission: 1,
    // Thicker than the 1.5 mm wall the lathe actually has. `thickness` is
    // a single number standing in for however far light travels inside a
    // solid, and at a true wall thickness it bends almost nothing: the
    // glass comes back as clean as air. Too far the other way and the
    // bowl fills with sludge -- 20 mm of absorption turned the interior
    // into a dark olive blob. This is the knob that decides how much the
    // backdrop distorts through the bowl, and it is a narrow window.
    thickness: 0.008,
    ior: 1.5,
    // The faint green of real glass seen edge-on, from absorption over
    // distance rather than from a tint in the albedo. The distance is
    // long on purpose: the tint should be visible where the glass is
    // thick, at the stem and the foot, and nowhere else.
    attenuationColor: new Color(0xe6f7f2),
    attenuationDistance: 1.2,
    emissive: new Color(CUSTARD),
    emissiveIntensity: 0,
    transparent: false,
  })

  // Shards get their own material, and it is not the glass one. A
  // hundred transmissive pieces means a hundred reads of the
  // transmission buffer, and a shard in flight is on screen for a
  // fraction of a second — what it needs is to be legible, not accurate.
  // Bright, thin and slightly emissive reads as flying glass and costs
  // nothing.
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

  let intact: Object3D | null = null
  let shardBatch: BatchedMesh | null = null
  let shardIds: number[] = []
  let shardCentroids: Vec3[] = []
  let disposed = false
  let clock = 0
  let lastFrame: number | null = null

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
      scene.add(glass)

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
        shardMaterial,
      )
      shardCentroids = shards.centroids
      shardIds = geometries.map((g) => {
        const geometryId = batch.addGeometry(g)
        return batch.addInstance(geometryId)
      })
      batch.visible = false
      shardBatch = batch
      scene.add(batch)
    },

    render(view: StageView): void {
      if (disposed) return

      const now = performance.now()
      clock += lastFrame === null ? 0 : Math.min((now - lastFrame) / 1000, 0.1)
      lastFrame = now

      const breaking = view.launches !== null && view.shatterProgress > 0
      if (intact !== null) intact.visible = !breaking
      if (shardBatch !== null) shardBatch.visible = breaking
      // The diffuser is only ever seen through the glass. With the glass
      // gone it is a bright smudge hanging in mid-air, so it leaves with
      // the thing it was lighting.
      backPanel.visible = !breaking

      if (breaking && view.launches !== null) {
        positionShards(view.launches, view.shatterSeconds)
      }

      // The glass gathering charge is the only pre-break feedback there
      // is, so it has to be visible without being a UI element. Three
      // things move together: the key leans brighter, the pool under the
      // glass warms, and the glass itself starts to glow.
      const res = view.resonance
      key.intensity = 34 + res * 55
      rim.intensity = 12 + res * 10
      poolMaterial.opacity = 0.07 + res * 0.2
      backPanelMaterial.opacity = 0.75 + res * 0.25

      // Once holding alone has done all it can, the glass pulses. That is
      // the scene asking for vibrato, in the same place the player is
      // already looking — a bar that stops moving explains nothing.
      const pulse = view.ringing ? 0.5 + 0.5 * Math.sin(clock * 9) : 0
      glassMaterial.emissiveIntensity = res * 0.22 + pulse * 0.3

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
      backdrop.dispose()
      environment.dispose()
      plinth.geometry.dispose()
      plinthMaterial.dispose()
      pool.geometry.dispose()
      poolMaterial.dispose()
      backPanel.geometry.dispose()
      backPanelMaterial.dispose()
      glassMaterial.dispose()
      shardMaterial.dispose()
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
