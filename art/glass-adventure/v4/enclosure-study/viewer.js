// Separate enclosure authoring viewer, using local Three.js and immutable staged GLBs.
import * as THREE from '../../../../packages/glass-game/node_modules/three/build/three.module.js'
import { OrbitControls } from '../../../../packages/glass-game/node_modules/three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from '../../../../packages/glass-game/node_modules/three/examples/jsm/loaders/GLTFLoader.js'
import { RGBELoader } from '../../../../packages/glass-game/node_modules/three/examples/jsm/loaders/RGBELoader.js'

const viewport = document.querySelector('#viewport')
const canvas = viewport.querySelector('canvas')
const status = document.querySelector('#status')
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x657c83)
const camera = new THREE.PerspectiveCamera(65, 1, 0.025, 150)
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 0.8
const controls = new OrbitControls(camera, canvas)
controls.enablePan = true
controls.minDistance = 0.1
controls.maxDistance = 60
controls.listenToKeyEvents(canvas)
const owned = new Set()
let dead = false
function disposeTree(object) {
  object.traverse((node) => {
    if (!node.isMesh) return
    owned.add(node.geometry)
    for (const material of [node.material].flat()) {
      owned.add(material)
      for (const value of Object.values(material))
        if (value?.isTexture) owned.add(value)
    }
  })
}
function render() {
  if (!dead && !document.hidden) renderer.render(scene, camera)
}
controls.addEventListener('change', render)
const observer = new ResizeObserver(() => {
  renderer.setSize(viewport.clientWidth, viewport.clientHeight, false)
  camera.aspect = viewport.clientWidth / viewport.clientHeight
  camera.updateProjectionMatrix()
  render()
})
observer.observe(viewport)
scene.add(new THREE.HemisphereLight(0xd9edff, 0x80775f, 0.8))
const key = new THREE.DirectionalLight(0xffedcf, 1.5)
key.position.set(-5, 8, 4)
scene.add(key)
const asset = new URLSearchParams(location.search).get('asset') ?? 'room'
const entries = {
  room: ['enclosure-study-v1.glb', 'Museum room study'],
  window: [
    '../architecture/exports/museum-window-bay-01-final-v1.glb',
    'Open window bay',
  ],
  screen: [
    '../architecture/exports/museum-screen-bay-01-final-v1.glb',
    'Solid marble screen',
  ],
}
function view(name) {
  const views =
    asset === 'room'
      ? {
          interior: [
            [0, 1.45, 2.7],
            [0, 1.55, -2.8],
          ],
          overview: [
            [11, 10, 12],
            [0, 1.05, -0.35],
          ],
          window: [
            [-2.55, 1.18, 0.2],
            [-2.6, 1.35, -5.5],
          ],
        }
      : {
          interior: [
            [4, 2.7, 6],
            [0, 1.8, 0],
          ],
        }
  const [position, target] = views[name] ?? views.interior
  camera.fov = asset === 'room' && name === 'overview' ? 38 : 65
  camera.updateProjectionMatrix()
  camera.position.set(...position)
  controls.target.set(...target)
  controls.update()
  render()
}
async function start() {
  if (!entries[asset]) throw new Error('Unknown enclosure asset')
  document.querySelector('#title').textContent = entries[asset][1]
  const hdr = await new RGBELoader().loadAsync(
    '/games/adventure-v2/environment/golden-coast.hdr',
  )
  if (dead) {
    hdr.dispose()
    return
  }
  const generator = new THREE.PMREMGenerator(renderer)
  const environment = generator.fromEquirectangular(hdr)
  hdr.dispose()
  generator.dispose()
  owned.add(environment)
  scene.environment = environment.texture
  scene.environmentIntensity = 0.7
  const sky = await new THREE.TextureLoader().loadAsync(
    '/games/adventure/museum-sky.webp',
  )
  if (dead) {
    sky.dispose()
    return
  }
  sky.colorSpace = THREE.SRGBColorSpace
  sky.mapping = THREE.EquirectangularReflectionMapping
  owned.add(sky)
  scene.background = sky
  const gltf = await new GLTFLoader().loadAsync(
    new URL(entries[asset][0], location.href).href,
  )
  disposeTree(gltf.scene)
  if (dead) {
    for (const resource of owned) resource.dispose()
    return
  }
  scene.add(gltf.scene)
  view('interior')
  for (const button of document.querySelectorAll('button')) {
    button.disabled =
      asset !== 'room' && ['overview', 'window'].includes(button.id)
    button.addEventListener('click', () =>
      view(button.id === 'reset' ? 'interior' : button.id),
    )
  }
  let triangles = 0
  gltf.scene.traverse((node) => {
    if (node.isMesh)
      triangles +=
        (node.geometry.index?.count ??
          node.geometry.attributes.position.count) / 3
  })
  canvas.dataset.ready = 'true'
  status.textContent = `${Math.round(triangles).toLocaleString()} instanced triangles · actual staged model · no collision or gameplay`
}
document.addEventListener('visibilitychange', render)
window.addEventListener('pagehide', () => {
  dead = true
  observer.disconnect()
  controls.dispose()
  for (const resource of owned) resource.dispose()
  renderer.dispose()
})
start().catch((error) => {
  status.textContent = `Preview unavailable: ${error.message}`
  console.error(error)
})
