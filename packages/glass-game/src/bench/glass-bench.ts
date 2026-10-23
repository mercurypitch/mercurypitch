// Glass look bench — a fixed look-development rig on the game's renderer settings, for judging one glass look under several lights.
import type { Material, MeshBasicMaterial, Object3D, Texture } from 'three'
import { ACESFilmicToneMapping, AgXToneMapping, Box3, Color, DirectionalLight, FogExp2, Group, HemisphereLight, Mesh, NeutralToneMapping, OrthographicCamera, PCFShadowMap, PerspectiveCamera, PMREMGenerator, Scene, SRGBColorSpace, Vector3, WebGLRenderer, } from 'three'
import { ColorEnvironment } from 'three/addons/environments/ColorEnvironment.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
import { createResidentExhibitLights } from '../render/exhibit-lights'
import { createGlassStudios } from '../render/glass-studios'
import type { BenchLookId } from './bench-looks'
import { BENCH_LOOKS, createLookDresser, studioAmber, todaysAmber, } from './bench-looks'
import { BENCH_PLINTH, createCheckerCard, createColorChecker, createFloor, createPlinth, createReferenceSpheres, createSwatches, createWallCard, } from './bench-scene'

/**
 * - `room`, `grey` and `hdr` are image light only: three's RoomEnvironment, a
 *   uniform grey energy check, and the game's own HDR.
 * - `gallery` is today's gallery: its hemisphere, key and rim, its HDR at the
 *   gallery's 0.65, a wall behind the exhibit.
 * - `kit` is the gallery plus the exhibit kit: resident spots and a lit plinth top.
 */
export type BenchEnvironment = 'room' | 'grey' | 'hdr' | 'gallery' | 'kit'
export const BENCH_ENVIRONMENTS: readonly BenchEnvironment[] = [
  'room',
  'grey',
  'hdr',
  'gallery',
  'kit',
]
export type BenchSubject = 'hero' | 'swatches'
export type BenchCamera = 'front' | 'three-quarter'
export type BenchToneMapping = 'aces' | 'neutral' | 'agx'

export interface BenchShot {
  readonly hero: string
  readonly environment: BenchEnvironment
  readonly look: BenchLookId
  readonly subject: BenchSubject
  readonly camera: BenchCamera
  /** Turntable angle of the subject, in degrees. */
  readonly yaw: number
  readonly toneMapping: BenchToneMapping
  readonly exposure: number
  /** White subject on black, for measuring regions. */
  readonly mask: boolean
}

/** The game's gallery renderer runs ACES at exposure 0.9 (render/glass-renderer.ts). */
export const GALLERY_EXPOSURE = 0.9
export const GALLERY_ENVIRONMENT_INTENSITY = 0.65

export function parseBenchShot(
  params: URLSearchParams,
  hero: string,
): BenchShot {
  const pick = <T extends string>(
    name: string,
    values: readonly T[],
    fallback: T,
  ): T => {
    const value = params.get(name) as T | null
    return value !== null && values.includes(value) ? value : fallback
  }
  return {
    hero: params.get('hero') ?? hero,
    environment: pick('environment', BENCH_ENVIRONMENTS, 'gallery'),
    look: pick('look', BENCH_LOOKS, 'authored'),
    subject: pick('subject', ['hero', 'swatches'] as const, 'hero'),
    camera: pick(
      'camera',
      ['front', 'three-quarter'] as const,
      'three-quarter',
    ),
    yaw: Number(params.get('yaw') ?? 0),
    toneMapping: pick(
      'toneMapping',
      ['aces', 'neutral', 'agx'] as const,
      'aces',
    ),
    exposure: Number(params.get('exposure') ?? GALLERY_EXPOSURE),
    mask: params.get('mask') === '1',
  }
}

export interface GlassBench {
  readonly shot: BenchShot
  /** Applies a shot, renders it and resolves once the frame is on the canvas. */
  set(shot: Partial<BenchShot>): Promise<BenchShot>
  dispose(): void
}

export interface GlassBenchOptions {
  readonly hero: string
  readonly hdr: string
  /** CSS size of the square canvas. */
  readonly size?: number
  /** Drawing-buffer scale; 2 supersamples a 1024 canvas. */
  readonly pixelRatio?: number
  readonly studioSize?: number
}

const TONE_MAPPING = {
  aces: ACESFilmicToneMapping,
  neutral: NeutralToneMapping,
  agx: AgXToneMapping,
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

/** The breakable's intact node, recentred with its base on y = 0; shards and colliders stay out. */
function intactOf(root: Object3D): Object3D {
  let intact: Object3D | undefined
  root.traverse((o) => {
    if (intact === undefined && /_intact$/i.test(o.name)) intact = o
  })
  const node = intact ?? root
  node.removeFromParent()
  const holder = new Group()
  holder.add(node)
  node.updateMatrixWorld(true)
  const box = new Box3().setFromObject(node)
  const centre = box.getCenter(new Vector3())
  node.position.x -= centre.x
  node.position.z -= centre.z
  node.position.y -= box.min.y
  node.traverse((o) => {
    if (o instanceof Mesh) o.castShadow = true
  })
  return holder
}

export async function mountGlassBench(
  canvas: HTMLCanvasElement,
  options: GlassBenchOptions,
): Promise<GlassBench> {
  const size = options.size ?? 1024
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  })
  renderer.setPixelRatio(options.pixelRatio ?? 2)
  renderer.setSize(size, size, false)
  renderer.outputColorSpace = SRGBColorSpace
  // Maximum quality until performance is measured (glass look plan §4.4).
  renderer.transmissionResolutionScale = 1
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap

  const scene = new Scene()
  const studios = createGlassStudios(renderer, options.studioSize ?? 512)
  const warmStudio = () => studios.textures['warm-bright-field']

  const pmrem = new PMREMGenerator(renderer)
  const room = pmrem.fromScene(new RoomEnvironment(), 0.04)
  const grey = pmrem.fromScene(
    new ColorEnvironment(new Color(0.5, 0.5, 0.5)),
    0,
  )
  const hdrSource = await new HDRLoader().loadAsync(options.hdr)
  const hdr = pmrem.fromEquirectangular(hdrSource)
  hdrSource.dispose()
  pmrem.dispose()
  const environments: Record<BenchEnvironment, Texture> = {
    room: room.texture,
    grey: grey.texture,
    hdr: hdr.texture,
    gallery: hdr.texture,
    kit: hdr.texture,
  }

  // Today's gallery rig: render/glass-renderer.ts and render/scene-catalog.ts.
  const hemisphere = new HemisphereLight(0xcceaff, 0x243e42, 0.6)
  const key = new DirectionalLight(0xffdfaa, 2.5)
  key.position.set(-0.55, 1, 0.65).multiplyScalar(6)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.camera.left = key.shadow.camera.bottom = -2
  key.shadow.camera.right = key.shadow.camera.top = 2
  key.shadow.camera.near = 0.5
  key.shadow.camera.far = 20
  key.shadow.normalBias = 0.018
  key.shadow.bias = -0.00015
  const rim = new DirectionalLight(0x73ddd9, 0.75)
  rim.position.set(1, 0.45, -0.5).multiplyScalar(6)
  const resident = createResidentExhibitLights()
  const galleryLights = [hemisphere, key, key.target, rim]
  scene.add(...galleryLights, ...resident.objects)

  const floor = createFloor()
  const wall = createWallCard()
  const checker = createCheckerCard(2.4, 1.8, 24)
  checker.position.set(0, 0.9, -0.95)
  const references = createReferenceSpheres()
  const colorChecker = createColorChecker()
  const { plinth, top: plinthTop } = createPlinth()
  const turntable = new Group()
  turntable.position.y = BENCH_PLINTH.height
  const heroStage = new Group()
  heroStage.add(plinth, plinthTop, turntable)
  scene.add(floor, wall, checker, references, colorChecker, heroStage)

  const swatchSets = {
    authored: createSwatches((t) => todaysAmber(t)),
    'studio-amber': createSwatches((t) =>
      studioAmber(warmStudio(), { thickness: t, attenuationDistance: 0.02 }),
    ),
  } satisfies Record<BenchLookId, ReturnType<typeof createSwatches>>
  const swatchStage = new Group()
  Object.values(swatchSets).forEach((set) => swatchStage.add(set.group))
  scene.add(swatchStage)

  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  const heroes = new Map<string, Promise<Object3D>>()
  const loadHero = (url: string) => {
    let hero = heroes.get(url)
    if (hero === undefined) {
      hero = loader.loadAsync(url).then((gltf) => intactOf(gltf.scene))
      heroes.set(url, hero)
    }
    return hero
  }
  const dresser = createLookDresser(warmStudio)

  const perspective = new PerspectiveCamera(28, 1, 0.05, 60)
  const orthographic = new OrthographicCamera(-0.78, 0.78, 1.5, -0.06, 0.1, 30)

  let shot = parseBenchShot(new URLSearchParams(), options.hero)
  const background = new Color()
  const fog = new FogExp2(0x59899e, 0.009)

  async function set(next: Partial<BenchShot>): Promise<BenchShot> {
    shot = { ...shot, ...next }
    const hero = await loadHero(shot.hero)
    turntable.clear()
    turntable.add(hero)

    const inGallery =
      shot.environment === 'gallery' || shot.environment === 'kit'
    scene.environment = environments[shot.environment]
    scene.environmentIntensity = inGallery ? GALLERY_ENVIRONMENT_INTENSITY : 1
    galleryLights.forEach((light) => (light.visible = inGallery))
    resident.key.visible = resident.glint.visible = shot.environment === 'kit'
    const heroBox = new Box3().setFromObject(hero)
    resident.aim({
      x: 0,
      y: BENCH_PLINTH.height,
      z: 0,
      facingYaw: 0,
      height: heroBox.getSize(new Vector3()).y / 2,
    })
    // The lit plinth top sits near 1.45 radiance, where amber reads gold.
    const lit = shot.environment === 'kit'
    ;(plinthTop.material as MeshBasicMaterial).color.setRGB(
      lit ? 1.45 : 0.02,
      lit ? 1.22 : 0.02,
      lit ? 0.92 : 0.02,
    )
    wall.visible = inGallery
    checker.visible = !inGallery
    scene.fog = inGallery ? fog : null
    background.set(inGallery ? 0x59899e : 0x767676)
    scene.background = background

    const heroShot = shot.subject === 'hero'
    heroStage.visible = heroShot
    swatchStage.visible = !heroShot
    swatchSets.authored.group.visible = shot.look === 'authored'
    swatchSets['studio-amber'].group.visible = shot.look === 'studio-amber'
    turntable.rotation.y = (shot.yaw * Math.PI) / 180
    swatchStage.rotation.y = (shot.yaw * Math.PI) / 180

    dresser.wear(hero, shot.mask ? 'mask' : shot.look)
    // A mask is the hero alone, white on black.
    const masked = shot.mask
    floor.visible = references.visible = colorChecker.visible = !masked
    plinth.visible = plinthTop.visible = !masked
    if (masked) {
      checker.visible = wall.visible = swatchStage.visible = false
      background.set(0x000000)
      scene.fog = null
    }
    renderer.toneMapping = TONE_MAPPING[shot.toneMapping]
    renderer.toneMappingExposure = shot.exposure

    const target = heroShot
      ? new Vector3(
          0,
          BENCH_PLINTH.height + heroBox.getSize(new Vector3()).y * 0.45,
          0,
        )
      : new Vector3(0.02, 0.32, 0)
    const camera = shot.camera === 'front' ? orthographic : perspective
    if (shot.camera === 'front') {
      orthographic.position.set(0, target.y, 6)
      orthographic.lookAt(0, target.y, 0)
      orthographic.top = heroShot ? 0.82 : 0.5
      orthographic.bottom = heroShot ? -0.82 : -0.4
      orthographic.left = heroShot ? -0.82 : -0.7
      orthographic.right = heroShot ? 0.82 : 0.7
      orthographic.updateProjectionMatrix()
    } else {
      const distance = heroShot ? 3.4 : 2.3
      const azimuth = ((heroShot ? 35 : 22) * Math.PI) / 180
      const elevation = (13 * Math.PI) / 180
      perspective.position.set(
        Math.sin(azimuth) * Math.cos(elevation) * distance,
        target.y + Math.sin(elevation) * distance,
        Math.cos(azimuth) * Math.cos(elevation) * distance,
      )
      perspective.lookAt(target)
      perspective.updateProjectionMatrix()
    }
    // Twice: the first render settles shadows and the transmission target.
    renderer.render(scene, camera)
    renderer.render(scene, camera)
    await nextFrame()
    return shot
  }

  return {
    get shot() {
      return shot
    },
    set,
    dispose() {
      studios.dispose()
      room.dispose()
      grey.dispose()
      hdr.dispose()
      scene.traverse((object) => {
        if (!(object instanceof Mesh)) return
        object.geometry.dispose()
        ;([] as Material[]).concat(object.material).forEach((m) => m.dispose())
      })
      renderer.dispose()
    },
  }
}
