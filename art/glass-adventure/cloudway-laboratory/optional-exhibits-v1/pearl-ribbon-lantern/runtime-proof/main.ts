import { ACESFilmicToneMapping, Box3, Color, DirectionalLight, HemisphereLight, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, Scene, SRGBColorSpace, Vector3, WebGLRenderer, } from 'three'
import type { Material, Object3D } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'

const ROOT_NODE = 'Cloudway_PearlRibbonLantern_OptionalExhibitV1'
const GEOMETRY_NODE = 'PearlRibbonLanternGeometry'
const renderer = new WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
})
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = SRGBColorSpace
renderer.toneMapping = ACESFilmicToneMapping
renderer.toneMappingExposure = 1.08
renderer.shadowMap.enabled = true
document.body.prepend(renderer.domElement)

const scene = new Scene()
scene.background = new Color('#050913')
const camera = new PerspectiveCamera(
  36,
  window.innerWidth / window.innerHeight,
  0.04,
  30,
)
camera.position.set(2.8, 2.15, 4.25)
camera.lookAt(0, 0.68, 0)
scene.add(new HemisphereLight('#d9edff', '#241a2b', 2.6))
const key = new DirectionalLight('#ffd6a6', 6.2)
key.position.set(3.5, 5.5, 4)
key.castShadow = true
scene.add(key)
const rim = new DirectionalLight('#8aa4ff', 4.1)
rim.position.set(-4, 3, -3)
scene.add(rim)
const floor = new Mesh(
  new PlaneGeometry(8, 5),
  new MeshStandardMaterial({
    color: '#14283b',
    roughness: 0.32,
    metalness: 0.08,
  }),
)
floor.rotation.x = -Math.PI / 2
floor.receiveShadow = true
scene.add(floor)

interface LanternProof {
  readonly ready: boolean
  readonly renderer: Readonly<Record<string, unknown>>
  readonly lods: readonly Record<string, unknown>[]
}

declare global {
  interface Window {
    __PEARL_LANTERN_PROOF__?: LanternProof
  }
}

function materialRecord(material: Material): Record<string, unknown> {
  const standard = material as MeshStandardMaterial
  const physical = material as MeshPhysicalMaterial
  return {
    name: material.name,
    standard: Boolean(standard.isMeshStandardMaterial),
    physical: Boolean(physical.isMeshPhysicalMaterial),
    transparent: material.transparent,
    textureChannels: {
      baseColor: Boolean(standard.map),
      normal: Boolean(standard.normalMap),
      metalness: Boolean(standard.metalnessMap),
      roughness: Boolean(standard.roughnessMap),
    },
  }
}

async function loadLod(
  loader: GLTFLoader,
  lod: 'lod0' | 'lod1',
  x: number,
): Promise<Record<string, unknown>> {
  const gltf = await loader.loadAsync(`/${lod}.glb`)
  const root = gltf.scene.getObjectByName(ROOT_NODE)
  if (root === undefined) throw new Error(`${lod}: missing ${ROOT_NODE}`)
  const geometryNode = root.getObjectByName(GEOMETRY_NODE)
  if (geometryNode === undefined)
    throw new Error(`${lod}: missing ${GEOMETRY_NODE}`)
  root.updateMatrixWorld(true)
  const sourceBounds = new Box3().setFromObject(root)
  const size = sourceBounds.getSize(new Vector3())
  let triangles = 0
  let drawCalls = 0
  let vertices = 0
  const materials: Record<string, unknown>[] = []
  root.traverse((object: Object3D) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    drawCalls += Array.isArray(mesh.material) ? mesh.material.length : 1
    const position = mesh.geometry.getAttribute('position')
    vertices += position.count
    triangles += mesh.geometry.index
      ? mesh.geometry.index.count / 3
      : position.count / 3
    for (const material of Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material])
      materials.push(materialRecord(material))
    mesh.castShadow = true
    mesh.receiveShadow = true
  })
  root.position.x = x
  scene.add(root)
  return {
    lod,
    root: root.name,
    geometryNode: geometryNode.name,
    bounds: {
      min: sourceBounds.min.toArray(),
      max: sourceBounds.max.toArray(),
      size: size.toArray(),
    },
    triangles,
    vertices,
    drawCalls,
    materials,
    contractJson: root.userData.asset_contract_json,
    lightAnchor: Boolean(root.getObjectByName('PearlRibbonLanternLightAnchor')),
    supportAnchor: Boolean(
      root.getObjectByName('PearlRibbonLanternSupportAnchor'),
    ),
  }
}

async function run(): Promise<void> {
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  const lods = await Promise.all([
    loadLod(loader, 'lod0', -0.66),
    loadLod(loader, 'lod1', 0.66),
  ])
  renderer.render(scene, camera)
  renderer.render(scene, camera)
  const context = renderer.getContext()
  const debug = context.getExtension('WEBGL_debug_renderer_info')
  window.__PEARL_LANTERN_PROOF__ = {
    ready: true,
    renderer: {
      webglVersion: context.getParameter(context.VERSION),
      renderer: debug
        ? context.getParameter(debug.UNMASKED_RENDERER_WEBGL)
        : context.getParameter(context.RENDERER),
      outputColorSpace: renderer.outputColorSpace,
      toneMapping: renderer.toneMapping,
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
    },
    lods,
  }
  document.body.dataset.ready = 'true'
}

run().catch((error: unknown) => {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error)
  document.body.dataset.error = message
  console.error(error)
})

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.render(scene, camera)
})
