import { ACESFilmicToneMapping, Box3, BoxGeometry, CanvasTexture, Color, DirectionalLight, Group, HemisphereLight, LinearFilter, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, Scene, SRGBColorSpace, Vector3, WebGLRenderer, } from 'three'
import type { Material, Object3D } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { createCloudwayScrollAdapter } from '@scroll-adapter'

const SUPPORT_WIDTH = 0.757494056
const SUPPORT_DEPTH = 2.205964088
const MATERIAL_BINDINGS = {
  ScrollDeckGeometry: 'glass',
  ScrollDeckGoldStarDetailLayer: 'opaque',
  ScrollDeckFrostEtchDetailLayer: 'glass',
  ScrollRollerNegativeGeometry: 'opaque',
  ScrollRollerPositiveGeometry: 'opaque',
} as const

type ViewName = 'normal-play' | 'close-retracted'

interface ProofState {
  state: 'loading' | 'ready' | 'error'
  error?: string
  source?: Record<string, unknown>
  current?: Record<string, unknown>
  renderer?: Record<string, unknown>
  setRatio?: (ratio: number) => Record<string, unknown>
  setView?: (view: ViewName) => void
}

declare global {
  interface Window {
    __scrollProof: ProofState
  }
}

const stage = document.querySelector<HTMLDivElement>('#stage')!
const status = document.querySelector<HTMLElement>('#status')!
const ratioLabel = document.querySelector<HTMLElement>('#ratio')!
const boundsLabel = document.querySelector<HTMLElement>('#bounds')!
const trianglesLabel = document.querySelector<HTMLElement>('#triangles')!
const viewLabel = document.querySelector<HTMLElement>('#view')!

window.__scrollProof = { state: 'loading' }

const renderer = new WebGLRenderer({ antialias: true, alpha: false })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = SRGBColorSpace
renderer.toneMapping = ACESFilmicToneMapping
renderer.toneMappingExposure = 1.12
renderer.shadowMap.enabled = true
stage.append(renderer.domElement)

const scene = new Scene()
scene.background = new Color('#071923')
const camera = new PerspectiveCamera(
  38,
  window.innerWidth / window.innerHeight,
  0.02,
  40,
)

scene.add(new HemisphereLight('#d7f4ff', '#2b201b', 2.1))
const key = new DirectionalLight('#fff0c8', 5.4)
key.position.set(3.5, 5.2, 3.2)
key.castShadow = true
scene.add(key)
const rim = new DirectionalLight('#5cd7ff', 3.2)
rim.position.set(-4, 2.3, -3.5)
scene.add(rim)

function witnessTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 1024
  const context = canvas.getContext('2d')!
  context.fillStyle = '#dbeaf0'
  context.fillRect(0, 0, 1024, 1024)
  const colors = ['#1689b4', '#ed705b', '#e4f2f5', '#146d92', '#f29a75']
  for (let index = -8; index < 16; index += 1) {
    context.save()
    context.translate(index * 132, 0)
    context.rotate(-0.24)
    context.fillStyle = colors[(index + 16) % colors.length]!
    context.fillRect(0, -260, 76, 1540)
    context.restore()
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  return texture
}

const witness = new Mesh(
  new PlaneGeometry(5.2, 5.2),
  new MeshStandardMaterial({ map: witnessTexture(), roughness: 0.84 }),
)
witness.rotation.x = -Math.PI / 2
witness.position.y = -0.46
witness.receiveShadow = true
scene.add(witness)

const landingMaterial = new MeshPhysicalMaterial({
  color: '#e6dfd0',
  roughness: 0.28,
  metalness: 0.03,
  clearcoat: 0.35,
  clearcoatRoughness: 0.2,
})
for (const x of [-0.98, 0.98]) {
  const landing = new Mesh(new BoxGeometry(0.68, 0.22, 2.5), landingMaterial)
  landing.position.set(x, -0.11, 0)
  landing.castShadow = true
  landing.receiveShadow = true
  scene.add(landing)
}

const adapterHost = new Group()
scene.add(adapterHost)

function meshMaterial(object: Object3D): MeshStandardMaterial {
  const mesh = object as Mesh
  if (!mesh.isMesh || Array.isArray(mesh.material))
    throw new Error(`${object.name}: expected one loaded PBR material`)
  const material = mesh.material as Material & MeshStandardMaterial
  if (!material.isMeshStandardMaterial)
    throw new Error(`${object.name}: GLTFLoader did not create a PBR material`)
  return material
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
  if (view === 'close-retracted') {
    camera.position.set(1.78, 0.64, 2.42)
    camera.lookAt(0, -0.085, 0.02)
    camera.fov = 34
    viewLabel.textContent = 'Close retracted · lower profile visible'
  } else {
    camera.position.set(3.15, 2.05, 3.55)
    camera.lookAt(0, -0.02, 0)
    camera.fov = 38
    viewLabel.textContent = 'Normal play'
  }
  camera.updateProjectionMatrix()
}

function format(values: number[]): string {
  return values.map((value) => value.toFixed(3)).join(' × ')
}

async function run(): Promise<void> {
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  const loaded = await loader.loadAsync('/scroll-runtime.glb')
  const source = loaded.scene.getObjectByName(
    'Cloudway_GiltScrollBridge_RuntimeV1',
  )
  if (source === undefined) throw new Error('Certified runtime root is absent')
  const bindings = Object.entries(MATERIAL_BINDINGS).map(([mesh, kind]) => {
    const object = source.getObjectByName(mesh)
    if (object === undefined) throw new Error(`Missing material mesh ${mesh}`)
    return { mesh, kind, material: meshMaterial(object) }
  })
  const platform = {
    id: 'gilt-scroll-runtime-proof',
    minX: -SUPPORT_WIDTH / 2,
    maxX: SUPPORT_WIDTH / 2,
    minZ: -SUPPORT_DEPTH / 2,
    maxZ: SUPPORT_DEPTH / 2,
    top: 0,
    thickness: 0.1,
    kind: 'bridge' as const,
    material: 'brass' as const,
    renderQuarterTurns: 0 as const,
    behavior: {
      kind: 'scroll' as const,
      axis: 'x' as const,
      minLengthRatio: 0.25,
      extendedSeconds: 4,
      retractedSeconds: 3,
      transitionSeconds: 1.5,
      initialState: 'extended' as const,
    },
  }
  const adapter = createCloudwayScrollAdapter({
    source,
    platform,
    materials: bindings,
  })
  adapterHost.add(adapter.root)
  const bounds = new Box3()
  const size = new Vector3()
  const negative = adapter.root.getObjectByName('ScrollRollerNegative')!
  const positive = adapter.root.getObjectByName('ScrollRollerPositive')!
  const deck = adapter.root.getObjectByName('ScrollDeck')!

  const update = (lengthRatio: number): Record<string, unknown> => {
    adapter.update({
      id: platform.id,
      offset: { x: 0, y: 0, z: 0 },
      phase:
        lengthRatio === 1
          ? 'extended'
          : lengthRatio === 0.25
            ? 'retracted'
            : 'retracting',
      phaseProgress: 0,
      collisionEnabled: true,
      lengthRatio,
    })
    adapter.getLiveBounds(bounds)
    bounds.getSize(size)
    renderer.render(scene, camera)
    renderer.render(scene, camera)
    const negativeScale = new Vector3()
    const positiveScale = new Vector3()
    const deckScale = new Vector3()
    const negativePosition = new Vector3()
    const positivePosition = new Vector3()
    negative.getWorldScale(negativeScale)
    positive.getWorldScale(positiveScale)
    deck.getWorldScale(deckScale)
    negative.getWorldPosition(negativePosition)
    positive.getWorldPosition(positivePosition)
    ratioLabel.textContent = lengthRatio.toFixed(3)
    boundsLabel.textContent = format(size.toArray())
    trianglesLabel.textContent = renderer.info.render.triangles.toLocaleString()
    const current = {
      lengthRatio,
      liveBounds: {
        min: bounds.min.toArray(),
        max: bounds.max.toArray(),
        size: size.toArray(),
      },
      transforms: {
        deckScale: deckScale.toArray(),
        negativeRollerScale: negativeScale.toArray(),
        positiveRollerScale: positiveScale.toArray(),
        negativeRollerPosition: negativePosition.toArray(),
        positiveRollerPosition: positivePosition.toArray(),
      },
      render: {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
      },
    }
    window.__scrollProof.current = current
    return current
  }

  setCamera('normal-play')
  const sourceMeshes: Record<string, unknown>[] = []
  source.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    const material = meshMaterial(mesh)
    const physical = material as MeshPhysicalMaterial
    sourceMeshes.push({
      mesh: mesh.name,
      material: material.name,
      triangles: mesh.geometry.index
        ? mesh.geometry.index.count / 3
        : mesh.geometry.getAttribute('position').count / 3,
      kind: MATERIAL_BINDINGS[mesh.name as keyof typeof MATERIAL_BINDINGS],
      isPhysical: Boolean(physical.isMeshPhysicalMaterial),
      transmission: physical.isMeshPhysicalMaterial ? physical.transmission : 0,
      metalness: material.metalness,
      roughness: material.roughness,
      textureChannels: {
        baseColor: Boolean(material.map),
        normal: Boolean(material.normalMap),
        metalness: Boolean(material.metalnessMap),
        roughness: Boolean(material.roughnessMap),
      },
    })
  })
  window.__scrollProof = {
    state: 'ready',
    source: {
      root: source.name,
      colliderJson: source.userData.collider_json,
      platformAdapterJson: source.userData.platform_adapter_json,
      meshes: sourceMeshes,
    },
    renderer: rendererIdentity(),
    setRatio: update,
    setView: setCamera,
  }
  update(1)
  status.textContent = 'Loaded · adapter validated'
}

run().catch((error: unknown) => {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error)
  window.__scrollProof = { state: 'error', error: message }
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
