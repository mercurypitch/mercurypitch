// Model review — inspect archived donors and accepted Blender exports with local Three.js.
import * as THREE from '../../../packages/glass-game/node_modules/three/build/three.module.js'
import { OrbitControls } from '../../../packages/glass-game/node_modules/three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from '../../../packages/glass-game/node_modules/three/examples/jsm/loaders/GLTFLoader.js'
import { RGBELoader } from '../../../packages/glass-game/node_modules/three/examples/jsm/loaders/RGBELoader.js'

const title = document.querySelector('#title')
const status = document.querySelector('#status')
const variant = document.querySelector('#variant')
const reset = document.querySelector('#reset')
const wireframe = document.querySelector('#wireframe')
const viewport = document.querySelector('#viewport')
const canvas = viewport.querySelector('canvas')
let renderer, controls, environment, observer
let model,
  family,
  meshes = [],
  dead = false,
  generation = 0
const scene = new THREE.Scene()
// Transmission samples the rendered scene, not the CSS behind an alpha canvas.
scene.background = new THREE.Color(0x596b70)
const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100)
const home = new THREE.Vector3(3.4, 2, 4.7)

function disposeModel(object) {
  if (!object) return
  const resources = new Set()
  object.traverse((node) => {
    if (!node.isMesh) return
    resources.add(node.geometry)
    for (const material of [node.material].flat()) {
      resources.add(material)
      for (const value of Object.values(material))
        if (value?.isTexture) resources.add(value)
    }
  })
  for (const resource of resources) resource.dispose()
  object.removeFromParent()
}

function render() {
  if (renderer && !dead && !document.hidden) renderer.render(scene, camera)
}

function resetView() {
  camera.position.copy(home)
  controls.target.set(0, 1.35, 0)
  controls.update()
  render()
}

async function load() {
  const current = ++generation
  const final = variant.value === 'final'
  const path = final ? family.finalGlb : `../v2/meshy/${family.id}-01/donor.glb`
  status.textContent = `Loading ${final ? 'Blender candidate' : 'unchanged Meshy donor'}…`
  reset.disabled = wireframe.disabled = true
  wireframe.setAttribute('aria-pressed', 'false')
  disposeModel(model)
  model = undefined
  render()
  try {
    const result = await new GLTFLoader().loadAsync(
      new URL(path, location.href).href,
    )
    if (dead || current !== generation) {
      disposeModel(result.scene)
      return
    }
    model = result.scene
    // An intact-only view avoids overlaying fracture pieces on the intact surface.
    model.traverse((node) => {
      if (/_shard_\d+/.test(node.name)) node.visible = false
    })
    const box = new THREE.Box3().setFromObject(model)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const scale = 3 / Math.max(size.y, size.x * 0.8, size.z * 0.8, 0.001)
    model.scale.multiplyScalar(scale)
    model.position.add(
      new THREE.Vector3(-center.x, -box.min.y, -center.z).multiplyScalar(scale),
    )
    meshes = []
    let triangles = 0
    model.traverseVisible((node) => {
      if (!node.isMesh) return
      meshes.push(node)
      triangles +=
        (node.geometry.index?.count ??
          node.geometry.attributes.position.count) / 3
    })
    scene.add(model)
    resetView()
    reset.disabled = wireframe.disabled = false
    canvas.dataset.ready = 'true'
    canvas.dataset.variant = variant.value
    status.textContent = `${final ? 'Blender candidate' : 'Original Meshy donor'} · ${Math.round(triangles).toLocaleString()} visible triangles · studio lighting · not integrated in the game`
  } catch (error) {
    if (current === generation && !dead)
      status.textContent = `Model could not load: ${error.message}`
    throw error
  }
}

async function start() {
  const response = await fetch('./review-evidence.json')
  if (!response.ok) throw new Error('Review metadata is unavailable.')
  const evidence = await response.json()
  const id =
    new URLSearchParams(location.search).get('asset') ?? 'gilded-column'
  family = evidence.families.find((item) => item.id === id)
  if (!family?.rawArchived)
    throw new Error('That archived asset is not available in this review.')
  title.textContent = family.id.replaceAll('-', ' ')
  title.style.textTransform = 'capitalize'
  document.title = `${title.textContent} — Glassworks model inspection`
  variant.querySelector('[value="final"]').disabled = !family.finalGlb
  variant.value = family.finalGlb ? 'final' : 'raw'
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.9
  controls = new OrbitControls(camera, canvas)
  controls.enablePan = true
  controls.minDistance = 1
  controls.maxDistance = 14
  controls.addEventListener('change', render)
  scene.add(new THREE.HemisphereLight(0xd8edf4, 0x9e8d6b, 2))
  const key = new THREE.DirectionalLight(0xffefce, 3)
  key.position.set(3, 6, 4)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xc4e7ff, 1.2)
  fill.position.set(-4, 2, -2)
  scene.add(fill)
  observer = new ResizeObserver(() => {
    renderer.setSize(viewport.clientWidth, viewport.clientHeight, false)
    camera.aspect = viewport.clientWidth / viewport.clientHeight
    camera.updateProjectionMatrix()
    render()
  })
  observer.observe(viewport)
  const hdr = await new RGBELoader().loadAsync(
    '/games/adventure-v2/environment/golden-coast.hdr',
  )
  const pmrem = new THREE.PMREMGenerator(renderer)
  environment = pmrem.fromEquirectangular(hdr)
  hdr.dispose()
  pmrem.dispose()
  scene.environment = environment.texture
  scene.environmentIntensity = 0.65
  variant.disabled = false
  variant.addEventListener('change', () => {
    delete canvas.dataset.ready
    load().catch(console.error)
  })
  reset.addEventListener('click', resetView)
  wireframe.addEventListener('click', () => {
    const enabled = wireframe.getAttribute('aria-pressed') !== 'true'
    for (const mesh of meshes)
      for (const material of [mesh.material].flat())
        material.wireframe = enabled
    wireframe.setAttribute('aria-pressed', String(enabled))
    render()
  })
  canvas.addEventListener('keydown', (event) => {
    if (
      ![
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
        '+',
        '=',
        '-',
      ].includes(event.key)
    )
      return
    event.preventDefault()
    const spherical = new THREE.Spherical().setFromVector3(
      camera.position.clone().sub(controls.target),
    )
    if (event.key === 'ArrowLeft') spherical.theta -= 0.15
    if (event.key === 'ArrowRight') spherical.theta += 0.15
    if (event.key === 'ArrowUp') spherical.phi -= 0.1
    if (event.key === 'ArrowDown') spherical.phi += 0.1
    if (event.key === '+' || event.key === '=') spherical.radius *= 0.9
    if (event.key === '-') spherical.radius *= 1.1
    spherical.radius = THREE.MathUtils.clamp(spherical.radius, 1, 14)
    spherical.makeSafe()
    camera.position.setFromSpherical(spherical).add(controls.target)
    controls.update()
  })
  await load()
}

canvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault()
  status.textContent =
    'The browser lost its graphics context. Reload this model view to reconnect.'
})
document.addEventListener('visibilitychange', render)
window.addEventListener('pagehide', () => {
  dead = true
  generation++
  observer?.disconnect()
  controls?.dispose()
  disposeModel(model)
  environment?.dispose()
  renderer?.dispose()
})
start().catch((error) => {
  status.textContent = `Preview unavailable: ${error.message}`
  console.error(error)
})
