import { ACESFilmicToneMapping, BoxGeometry, CanvasTexture, Color, DirectionalLight, HemisphereLight, LinearFilter, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, Scene, SRGBColorSpace, Vector3, WebGLRenderer, } from 'three'
import type { Material, Object3D } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { createCloudwayCrackleAdapter } from '@crackle-adapter'

const ROOT_NAME = 'CloudwayLab_RoseQuartzCrackleFast'
const SHARD_PREFIX = `${ROOT_NAME}__shard_`
const bundle = new URLSearchParams(window.location.search).get('bundle')
const bundleKind = bundle === 'full' ? 'full' : 'bounded'
const materialKinds = new Map<string, 'glass' | 'opaque'>([
  ['RoseRuntimeCrystalShell', 'glass'],
  ['RoseRuntimeProviderIntactExterior', 'opaque'],
  ['RoseRuntimeGoldFramework', 'opaque'],
  ['RoseRuntimeIvoryInlays', 'opaque'],
  ['RoseRuntimeSourceCornerFiligree', 'opaque'],
])
for (let index = 0; index < 18; index += 1) {
  const suffix = index.toString().padStart(3, '0')
  materialKinds.set(`RoseRuntimeShardGlass_${suffix}`, 'glass')
  materialKinds.set(`RoseRuntimeShardSurfaceDetail_${suffix}`, 'opaque')
}

type Phase = 'intact' | 'warning' | 'released' | 'resetting'
type ViewName = 'gameplay' | 'close' | 'fracture'

interface ProofState {
  state: 'loading' | 'ready' | 'error'
  error?: string
  source?: Record<string, unknown>
  current?: Record<string, unknown>
  renderer?: Record<string, unknown>
  setPhase?: (phase: Phase, progress: number) => Record<string, unknown>
  setView?: (view: ViewName) => void
}

declare global {
  interface Window {
    __roseProof: ProofState
  }
}

const stage = document.querySelector<HTMLDivElement>('#stage')!
const status = document.querySelector<HTMLElement>('#status')!
const bundleLabel = document.querySelector<HTMLElement>('#bundle')!
const phaseLabel = document.querySelector<HTMLElement>('#phase')!
const trianglesLabel = document.querySelector<HTMLElement>('#triangles')!
const texturesLabel = document.querySelector<HTMLElement>('#textures')!
const viewLabel = document.querySelector<HTMLElement>('#view')!
window.__roseProof = { state: 'loading' }
bundleLabel.textContent =
  bundleKind === 'full' ? 'Full-resolution archive' : '2K bounded candidate'

const renderer = new WebGLRenderer({ antialias: true, alpha: false })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = SRGBColorSpace
renderer.toneMapping = ACESFilmicToneMapping
renderer.toneMappingExposure = 1.08
renderer.shadowMap.enabled = true
stage.append(renderer.domElement)

const scene = new Scene()
scene.background = new Color('#91aac8')
const camera = new PerspectiveCamera(
  40,
  window.innerWidth / window.innerHeight,
  0.02,
  40,
)
scene.add(new HemisphereLight('#e8f5ff', '#473342', 2.65))
const key = new DirectionalLight('#ffe1ca', 5.2)
key.position.set(3.4, 5.2, 2.8)
key.castShadow = true
scene.add(key)
const fill = new DirectionalLight('#b8d8ff', 3.4)
fill.position.set(-3.4, 2.4, 1.1)
scene.add(fill)
const rim = new DirectionalLight('#ffffff', 2.1)
rim.position.set(-1.2, 3.6, -3.5)
scene.add(rim)

function witnessTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 1024
  const context = canvas.getContext('2d')!
  context.fillStyle = '#eef5ff'
  context.fillRect(0, 0, 1024, 1024)
  const colors = ['#bfd8f2', '#f7d5de', '#f4eee3', '#accbe7']
  for (let index = -5; index < 15; index += 1) {
    context.save()
    context.translate(index * 112, 0)
    context.rotate(-0.22)
    context.fillStyle = colors[(index + 8) % colors.length]!
    context.fillRect(0, -240, 64, 1500)
    context.restore()
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  return texture
}

const floor = new Mesh(
  new PlaneGeometry(5.5, 5.5),
  new MeshStandardMaterial({ map: witnessTexture(), roughness: 0.82 }),
)
floor.rotation.x = -Math.PI / 2
floor.position.y = -0.34
floor.receiveShadow = true
scene.add(floor)
for (const x of [-1.3, 1.3]) {
  const landing = new Mesh(
    new BoxGeometry(0.74, 0.22, 1.9),
    new MeshStandardMaterial({
      color: '#efe6d7',
      roughness: 0.28,
      metalness: 0.03,
    }),
  )
  landing.position.set(x, -0.11, 0)
  landing.castShadow = true
  landing.receiveShadow = true
  scene.add(landing)
}

function meshMaterial(object: Object3D): MeshStandardMaterial {
  const mesh = object as Mesh
  if (!mesh.isMesh || Array.isArray(mesh.material))
    throw new Error(`${object.name}: expected one loaded PBR material`)
  const material = mesh.material as Material & MeshStandardMaterial
  if (!material.isMeshStandardMaterial)
    throw new Error(`${object.name}: GLTFLoader did not create a PBR material`)
  return material
}

function visible(object: Object3D): boolean {
  for (let current: Object3D | null = object; current; current = current.parent)
    if (!current.visible) return false
  return true
}

function rendererIdentity(): Record<string, unknown> {
  const context = renderer.getContext()
  const extension = context.getExtension('WEBGL_debug_renderer_info')
  return {
    webglVersion: context.getParameter(context.VERSION),
    vendor: extension
      ? context.getParameter(extension.UNMASKED_VENDOR_WEBGL)
      : context.getParameter(context.VENDOR),
    renderer: extension
      ? context.getParameter(extension.UNMASKED_RENDERER_WEBGL)
      : context.getParameter(context.RENDERER),
    maxTextureSize: context.getParameter(context.MAX_TEXTURE_SIZE),
  }
}

function setCamera(view: ViewName): void {
  if (view === 'close') {
    camera.position.set(2.02, 0.84, 2.12)
    camera.lookAt(0, -0.105, 0)
    camera.fov = 33
    viewLabel.textContent = 'Closest play inspection'
  } else if (view === 'fracture') {
    camera.position.set(2.72, 1.24, 3.3)
    camera.lookAt(0, -0.18, 0)
    camera.fov = 38
    viewLabel.textContent = 'Early release inspection'
  } else {
    camera.position.set(3.05, 2.18, 3.42)
    camera.lookAt(0, -0.1, 0)
    camera.fov = 40
    viewLabel.textContent = 'Gameplay camera'
  }
  floor.position.y = view === 'fracture' ? -1.05 : -0.34
  camera.updateProjectionMatrix()
}

async function run(): Promise<void> {
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  const loaded = await loader.loadAsync(
    bundleKind === 'full' ? '/rose-full.glb' : '/rose-bounded.glb',
  )
  const source = loaded.scene.getObjectByName(ROOT_NAME)
  if (source === undefined)
    throw new Error('Certified Rose runtime root is absent')
  const bindings = []
  const sourceMeshes: Record<string, unknown>[] = []
  for (const [name, kind] of materialKinds) {
    const object = source.getObjectByName(name)
    if (object === undefined)
      throw new Error(`Missing reviewed material mesh ${name}`)
    const mesh = object as Mesh
    const material = meshMaterial(mesh)
    const physical = material as MeshPhysicalMaterial
    const transmission = physical.isMeshPhysicalMaterial
      ? physical.transmission
      : 0
    bindings.push({ mesh: name, kind, material })
    sourceMeshes.push({
      mesh: name,
      material: material.name,
      kind,
      triangles: mesh.geometry.index
        ? mesh.geometry.index.count / 3
        : mesh.geometry.getAttribute('position').count / 3,
      isPhysical: Boolean(physical.isMeshPhysicalMaterial),
      transmission,
      metalness: material.metalness,
      roughness: material.roughness,
      textureChannels: {
        baseColor: material.map
          ? [material.map.image.width, material.map.image.height]
          : null,
        normal: material.normalMap
          ? [material.normalMap.image.width, material.normalMap.image.height]
          : null,
        metalness: material.metalnessMap
          ? [
              material.metalnessMap.image.width,
              material.metalnessMap.image.height,
            ]
          : null,
        roughness: material.roughnessMap
          ? [
              material.roughnessMap.image.width,
              material.roughnessMap.image.height,
            ]
          : null,
      },
    })
  }
  const platform = {
    id: 'rose-step',
    minX: -0.82,
    maxX: 0.82,
    minZ: -0.82,
    maxZ: 0.82,
    top: 0,
    thickness: 0.24,
    kind: 'deck' as const,
    material: 'stone' as const,
    behavior: {
      kind: 'crackle' as const,
      warningSeconds: 2,
      releaseSeconds: 1.15,
      resetSeconds: 2,
    },
  }
  const adapter = createCloudwayCrackleAdapter({
    source,
    platform,
    materials: bindings,
  })
  scene.add(adapter.root)
  const intact = adapter.root.getObjectByName(
    'RoseRuntimeProviderIntactExterior',
  )!
  const persistent = adapter.root.getObjectByName(
    'RoseRuntimeSourceCornerFiligree',
  )!
  const firstShard = adapter.root.getObjectByName('RoseRuntimeShardGlass_000')!
  const shardRoots = Array.from({ length: 18 }, (_, index) =>
    adapter.root.getObjectByName(
      `${SHARD_PREFIX}${index.toString().padStart(3, '0')}`,
    ),
  )

  const update = (phase: Phase, progress: number): Record<string, unknown> => {
    adapter.update({
      id: platform.id,
      phase,
      phaseProgress: progress,
      offset: { x: 0, y: 0, z: 0 },
      collisionEnabled: phase === 'intact' || phase === 'warning',
    })
    renderer.render(scene, camera)
    renderer.render(scene, camera)
    phaseLabel.textContent = `${phase} · ${progress.toFixed(2)}`
    trianglesLabel.textContent = renderer.info.render.triangles.toLocaleString()
    texturesLabel.textContent = renderer.info.memory.textures.toLocaleString()
    const state = {
      phase,
      progress,
      visibility: {
        intact: visible(intact),
        persistent: visible(persistent),
        firstShard: visible(firstShard),
      },
      shardRootsPresent: shardRoots.every(Boolean),
      firstShardWorldPosition: firstShard
        .getWorldPosition(new Vector3())
        .toArray(),
      render: {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
      },
    }
    window.__roseProof.current = state
    return state
  }

  setCamera('gameplay')
  window.__roseProof = {
    state: 'ready',
    source: {
      bundle: bundleKind,
      root: source.name,
      colliderJson: source.userData.collider_json,
      platformAdapterJson: source.userData.platform_adapter_json,
      meshes: sourceMeshes,
      totalTriangles: sourceMeshes.reduce(
        (sum, item) => sum + Number(item.triangles),
        0,
      ),
    },
    renderer: rendererIdentity(),
    setPhase: update,
    setView: setCamera,
  }
  update('intact', 0)
  status.textContent = 'Loaded · adapter validated'
}

run().catch((error: unknown) => {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error)
  window.__roseProof = { state: 'error', error: message }
  status.textContent = 'Failed'
  status.dataset.kind = 'error'
  console.error(error)
})

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.render(scene, camera)
})
