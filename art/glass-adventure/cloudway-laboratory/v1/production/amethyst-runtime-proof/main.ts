import { ACESFilmicToneMapping, BoxGeometry, CanvasTexture, Color, DirectionalLight, HemisphereLight, LinearFilter, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, Scene, SRGBColorSpace, WebGLRenderer, } from 'three'
import type { Material, Object3D } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { createCloudwayCrackleAdapter, type CloudwayCrackleMaterialBinding, } from '@crackle-adapter'

type ViewName = 'intact' | 'close' | 'fractured'
type AssetVariant = 'full-detail' | 'bounded-2k'

interface ProofState {
  state: 'loading' | 'ready' | 'error'
  error?: string
  renderer?: Record<string, unknown>
  source?: Record<string, unknown>
  setView?: (view: ViewName) => Record<string, unknown>
}

declare global {
  interface Window {
    __amethystProof: ProofState
  }
}

const ROOT = 'CloudwayLab_AmethystCrackleSlow'
const PERSISTENT = `${ROOT}__persistent`
const INTACT = `${ROOT}__intact`
const CONTACT = `${ROOT}__contact`
const SHARD_PREFIX = `${ROOT}__shard_`
const GLASS_MATERIAL = 'CloudwayLab_Amethyst__glass'
const assetVariant: AssetVariant =
  new URLSearchParams(window.location.search).get('asset') === 'full'
    ? 'full-detail'
    : 'bounded-2k'
const assetUrl =
  assetVariant === 'full-detail'
    ? '/amethyst-full-detail.glb'
    : '/amethyst-runtime-v1.glb'
const platform = {
  id: `amethyst-crackle-${assetVariant}`,
  minX: -0.82,
  maxX: 0.82,
  minZ: -0.55,
  maxZ: 0.55,
  top: 0,
  thickness: 0.25,
  kind: 'deck',
  material: 'stone',
  behavior: {
    kind: 'crackle',
    warningSeconds: 4,
    releaseSeconds: 1.15,
    resetSeconds: 2,
  },
} as const

const stage = document.querySelector<HTMLDivElement>('#stage')!
const status = document.querySelector<HTMLElement>('#status')!
const viewLabel = document.querySelector<HTMLElement>('#view')!
const materialsLabel = document.querySelector<HTMLElement>('#materials')!
const trianglesLabel = document.querySelector<HTMLElement>('#triangles')!
const assetLabel = document.querySelector<HTMLElement>('#asset')!
window.__amethystProof = { state: 'loading' }
assetLabel.textContent = assetVariant

const renderer = new WebGLRenderer({ antialias: true, alpha: false })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = SRGBColorSpace
renderer.toneMapping = ACESFilmicToneMapping
renderer.toneMappingExposure = 1.15
renderer.shadowMap.enabled = true
stage.append(renderer.domElement)

const scene = new Scene()
scene.background = new Color('#14122c')
const camera = new PerspectiveCamera(
  38,
  window.innerWidth / window.innerHeight,
  0.02,
  40,
)
scene.add(new HemisphereLight('#e5ebff', '#28173f', 2.6))
const key = new DirectionalLight('#fff0d7', 5.6)
key.position.set(3.8, 5.8, 2.8)
key.castShadow = true
scene.add(key)
const rim = new DirectionalLight('#8a6dff', 4.2)
rim.position.set(-3.4, 2.8, -3.6)
scene.add(rim)

function witnessTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 1024
  const context = canvas.getContext('2d')!
  const colours = ['#168cb5', '#ee715c', '#e8f1ef', '#6542a4']
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      context.fillStyle = colours[(x + y) % colours.length]!
      context.fillRect(x * 128, y * 128, 128, 128)
    }
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  return texture
}

const witness = new Mesh(
  new PlaneGeometry(6, 6),
  new MeshStandardMaterial({ map: witnessTexture(), roughness: 0.82 }),
)
witness.rotation.x = -Math.PI / 2
witness.position.y = -0.34
witness.receiveShadow = true
scene.add(witness)

const landingMaterial = new MeshPhysicalMaterial({
  color: '#e7d8ca',
  metalness: 0.05,
  roughness: 0.28,
  clearcoat: 0.35,
  clearcoatRoughness: 0.18,
})
for (const x of [-1.22, 1.22]) {
  const landing = new Mesh(new BoxGeometry(0.62, 0.18, 1.5), landingMaterial)
  landing.position.set(x, -0.09, 0)
  landing.castShadow = true
  landing.receiveShadow = true
  scene.add(landing)
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

function oneMaterial(object: Object3D): Material {
  const mesh = object as Mesh
  if (!mesh.isMesh || Array.isArray(mesh.material))
    throw new Error(`${object.name}: expected one material`)
  return mesh.material
}

function visible(object: Object3D | undefined): boolean {
  for (let node = object; node; node = node.parent ?? undefined)
    if (!node.visible) return false
  return object !== undefined
}

function setCamera(view: ViewName): void {
  if (view === 'close') {
    camera.position.set(2.05, 0.77, 1.72)
    camera.lookAt(0, -0.07, 0)
    camera.fov = 32
  } else if (view === 'fractured') {
    camera.position.set(2.75, 2.15, 2.85)
    camera.lookAt(0, 0.12, 0)
    camera.fov = 40
  } else {
    camera.position.set(2.7, 1.75, 2.65)
    camera.lookAt(0, -0.06, 0)
    camera.fov = 38
  }
  camera.updateProjectionMatrix()
}

async function run(): Promise<void> {
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  const loaded = await loader.loadAsync(assetUrl)
  const root = loaded.scene.getObjectByName(ROOT)
  if (root === undefined)
    throw new Error('Amethyst candidate root missing after GLTFLoader')
  const persistent = root.getObjectByName(PERSISTENT)
  const intact = root.getObjectByName(INTACT)
  const contact = root.getObjectByName(CONTACT)
  if (!persistent || !intact || !contact)
    throw new Error('Required crackle roles missing')
  const shards = Array.from({ length: 18 }, (_, index) => {
    const shard = root.getObjectByName(
      `${SHARD_PREFIX}${index.toString().padStart(3, '0')}`,
    )
    if (!shard) throw new Error(`Shard ${index} missing`)
    return shard
  })
  const meshRecords: Array<Record<string, unknown>> = []
  const materialRecords = new Map<string, Record<string, unknown>>()
  const bindings: CloudwayCrackleMaterialBinding[] = []
  const boundMeshes = new Set<string>()
  let triangles = 0
  for (const role of [intact, persistent, ...shards]) {
    role.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh) return
      if (boundMeshes.has(mesh.name))
        throw new Error(`Duplicate visible mesh name ${mesh.name}`)
      boundMeshes.add(mesh.name)
      const material = oneMaterial(mesh)
      const standard = material as MeshStandardMaterial
      if (!standard.isMeshStandardMaterial)
        throw new Error(`${mesh.name}: expected a PBR material`)
      const physical = material as MeshPhysicalMaterial
      const triangleCount = mesh.geometry.index
        ? mesh.geometry.index.count / 3
        : mesh.geometry.attributes.position.count / 3
      triangles += triangleCount
      meshRecords.push({
        mesh: mesh.name,
        material: material.name,
        triangles: triangleCount,
      })
      materialRecords.set(material.name, {
        name: material.name,
        type: material.type,
        baseColor: standard.color.toArray(),
        transmission: physical.isMeshPhysicalMaterial
          ? physical.transmission
          : 0,
        metalness: standard.metalness,
        emissive: standard.emissive.toArray(),
        emissiveIntensity: standard.emissiveIntensity,
        transparent: material.transparent,
      })
      bindings.push({
        mesh: mesh.name,
        kind: material.name === GLASS_MATERIAL ? 'glass' : 'opaque',
        material: standard,
      })
    })
  }
  const glass = materialRecords.get(GLASS_MATERIAL)
  const detail = materialRecords.get('CloudwayLab_Amethyst__internal_detail')
  if (!glass || Number(glass.transmission) < 0.9 || glass.metalness !== 0)
    throw new Error(
      'Primary glass material did not load as nonmetallic transmission',
    )
  const glassBaseColor = glass.baseColor as number[]
  const glassEmissive = glass.emissive as number[]
  if (
    glassBaseColor.length !== 3 ||
    !(glassBaseColor[2]! > glassBaseColor[0]!) ||
    !(glassBaseColor[0]! > glassBaseColor[1]!) ||
    glassBaseColor[2]! - glassBaseColor[1]! > 0.4 ||
    !glassEmissive.every((value) => Math.abs(value) < 1e-8)
  )
    throw new Error(
      'Primary glass material did not load the reviewed pale non-emissive tint',
    )
  if (!detail || Number(detail.transmission) !== 0)
    throw new Error(
      'Exact provider intact body unexpectedly loaded transmission',
    )
  const authoredSourceBody = root.getObjectByName(
    'AmethystRuntimeSourceIntactBody',
  )
  const authoredAccent = root.getObjectByName('AmethystRuntimeLuminousAccents')
  if (
    authoredSourceBody?.parent !== intact ||
    authoredAccent?.parent !== intact
  )
    throw new Error('Breakable source-body/accent hierarchy changed')
  const adapter = createCloudwayCrackleAdapter({
    source: root,
    platform,
    materials: bindings,
  })
  scene.add(adapter.root)
  const runtimeIntact = adapter.root.getObjectByName(INTACT)
  const runtimePersistent = adapter.root.getObjectByName(PERSISTENT)
  const runtimeSourceBody = adapter.root.getObjectByName(
    'AmethystRuntimeSourceIntactBody',
  )
  const runtimeShards = Array.from({ length: 18 }, (_, index) => {
    const shard = adapter.root.getObjectByName(
      `${SHARD_PREFIX}${index.toString().padStart(3, '0')}`,
    )
    if (!shard) throw new Error(`Adapter shard ${index} missing`)
    return shard
  })
  const setView = (view: ViewName): Record<string, unknown> => {
    const fractured = view === 'fractured'
    adapter.update({
      id: platform.id,
      phase: fractured ? 'released' : 'intact',
      phaseProgress: fractured ? 0.26 : 0,
      offset: { x: 0, y: 0, z: 0 },
      collisionEnabled: !fractured,
    })
    setCamera(view)
    viewLabel.textContent = view
    renderer.render(scene, camera)
    renderer.render(scene, camera)
    return {
      view,
      phase: fractured ? 'released' : 'intact',
      phaseProgress: fractured ? 0.26 : 0,
      intactVisible: visible(runtimeIntact),
      visibleShards: runtimeShards.filter((shard) => visible(shard)).length,
      sourceBodyVisible: visible(runtimeSourceBody),
      persistentVisible: visible(runtimePersistent),
      rootScale: adapter.root.scale.toArray(),
      rootPosition: adapter.root.position.toArray(),
    }
  }
  const current = setView('intact')
  status.textContent =
    'Actual GLTFLoader + shared adapter + WebGLRenderer ready'
  materialsLabel.textContent = String(materialRecords.size)
  trianglesLabel.textContent = Math.round(triangles).toLocaleString()
  window.__amethystProof = {
    state: 'ready',
    renderer: rendererIdentity(),
    source: {
      root: root.name,
      adapterRoot: adapter.root.name,
      assetVariant,
      assetUrl,
      adapter: 'packages/glass-game/src/render/cloudway-crackle-adapter.ts',
      reviewedBindings: bindings.map(({ mesh, kind, material }) => ({
        mesh,
        kind,
        material: material.name,
      })),
      meshes: meshRecords,
      materials: [...materialRecords.values()],
      initial: current,
    },
    setView,
  }
}

run().catch((error: unknown) => {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error)
  status.textContent = message
  window.__amethystProof = { state: 'error', error: message }
})

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight)
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
})
