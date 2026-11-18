// three_preview.mjs — a GLB rendered by the game's own three.js, lights and tone mapping, in seconds.
//
// node three_preview.mjs IN.glb OUT.png [--size 640] [--views front,three_quarter,side,low,top] [--elevation 8]
//                        [--dump] [--set glass_waves.metalness=0.6,gold_trim.roughness=0.4] [--env museum|room]
//
// The runtime proof answers "does it work in the game"; this answers "how do its
// materials read in three.js" fast enough to tune them. It uses the same r185
// build the game ships, ACES filmic tone mapping at exposure 0.9, the museum's
// golden-coast HDR as the environment at intensity 0.65, the game's hemisphere,
// key and rim lights, and a pale marble-toned backdrop so transmission has
// something to show. Shards and collision proxies are hidden; the intact is
// centred and framed. Views are tiled left to right into OUT.png.
//
// Tuning without a rebuild: --dump prints every material as three.js loaded it
// (factors, which maps it has, vertex colours); --set overrides properties by
// material name for this render only (numbers, #rrggbb for colours, one number
// for both parts of normalScale);
// --env room swaps the museum HDR for three's neutral RoomEnvironment, which
// tells a material problem from what the museum's sky and ground reflect.

import { createServer } from 'node:http'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../../../..')
const APP = join(REPO, 'apps/beside-cue')
const require = createRequire(join(APP, 'package.json'))
const { chromium } = require('@playwright/test')
const THREE_DIR = realpathSync(join(APP, 'node_modules/three')) // the build the game ships
const HDR = join(APP, 'public/games/adventure-v2/environment/golden-coast.hdr')

const argv = process.argv.slice(2)
const opt = (flag, fallback) =>
  argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : fallback
const glbPath = resolve(argv[0])
const outPath = resolve(argv[1])
const size = Number(opt('--size', 640))
const views = opt('--views', 'front,three_quarter').split(',')
const elevation = Number(opt('--elevation', 8))
const dump = argv.includes('--dump')
const env = opt('--env', 'museum')
const overrides = (opt('--set', '') || '')
  .split(',')
  .filter(Boolean)
  .map((item) => {
    const [target, value] = item.split('=')
    const dot = target.indexOf('.')
    return {
      material: target.slice(0, dot),
      prop: target.slice(dot + 1),
      value,
    }
  })
if (
  !existsSync(HDR) ||
  readFileSync(HDR).subarray(0, 10).toString('latin1').startsWith('version')
)
  throw new Error(`museum HDR missing or a Git LFS pointer: ${HDR}`)

const page = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#222}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
</head><body><script type="module">
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
const size = ${size}, views = ${JSON.stringify(views)}, elevation = ${elevation} * Math.PI / 180
const overrides = ${JSON.stringify(overrides)}
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
renderer.setSize(size * views.length, size)
renderer.setScissorTest(true)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 0.9
document.body.appendChild(renderer.domElement)
const scene = new THREE.Scene()
scene.background = new THREE.Color(0xd9d6cf)
scene.environmentIntensity = 0.65
const hemisphere = new THREE.HemisphereLight(0xcceaff, 0x243e42, 0.6)
const key = new THREE.DirectionalLight(0xffdfaa, 2.5)
key.position.set(-2, 4, 3)
const rim = new THREE.DirectionalLight(0x73ddd9, 0.75)
rim.position.set(3, 2, -3)
scene.add(hemisphere, key, rim)
const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), new THREE.MeshStandardMaterial({ color: 0xece7de, roughness: 0.6 }))
backdrop.position.set(0, 3, -1.6)
const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.35 }))
floor.rotation.x = -Math.PI / 2
scene.add(backdrop, floor)
const pmrem = new THREE.PMREMGenerator(renderer)
scene.environment = ${env === 'room'}
  ? pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  : pmrem.fromEquirectangular(await new HDRLoader().loadAsync('/env.hdr')).texture
const loader = new GLTFLoader()
loader.setMeshoptDecoder(MeshoptDecoder)
const gltf = await loader.loadAsync('/asset.glb')
gltf.scene.traverse((o) => {
  if (/_shard_|^COLLIDER/i.test(o.name) || o.userData?.collision_proxy) o.visible = false
})
scene.add(gltf.scene)
const materials = new Map()
gltf.scene.traverse((o) => {
  if (o.visible && o.material) for (const m of [o.material].flat()) materials.set(m.name, { m, mesh: o })
})
for (const { material, prop, value } of overrides) {
  const m = materials.get(material)?.m
  if (!m || !(prop in m)) throw new Error('--set: no ' + material + '.' + prop)
  if (m[prop]?.isColor) m[prop].set(value)
  else if (m[prop]?.isVector2) m[prop].setScalar(Number(value))
  else m[prop] = Number(value)
  m.needsUpdate = true
}
const maps = ['map', 'normalMap', 'metalnessMap', 'roughnessMap', 'transmissionMap', 'thicknessMap',
  'sheenColorMap', 'iridescenceMap', 'emissiveMap', 'aoMap', 'clearcoatMap']
const factors = ['metalness', 'roughness', 'transmission', 'thickness', 'ior', 'sheen', 'sheenRoughness',
  'iridescence', 'iridescenceIOR', 'clearcoat', 'clearcoatRoughness', 'envMapIntensity', 'opacity']
window.__materials = [...materials.values()].map(({ m, mesh }) => ({
  name: m.name, type: m.type, mesh: mesh.name,
  color: m.color?.getHexString(THREE.LinearSRGBColorSpace) + ' (linear)',
  ...Object.fromEntries(factors.filter((f) => f in m).map((f) => [f, Math.round(m[f] * 1000) / 1000])),
  sheenColor: m.sheenColor?.getHexString(THREE.LinearSRGBColorSpace),
  attenuationColor: m.attenuationColor?.getHexString(THREE.LinearSRGBColorSpace),
  attenuationDistance: m.attenuationDistance,
  vertexColors: m.vertexColors, side: m.side, transparent: m.transparent,
  maps: maps.filter((k) => m[k]),
  attributes: Object.keys(mesh.geometry.attributes),
}))
let intact = null
gltf.scene.traverse((o) => {
  if (!intact && /_intact$/.test(o.name)) intact = o
})
const box = new THREE.Box3().setFromObject(intact ?? gltf.scene)
const centre = box.getCenter(new THREE.Vector3())
const height = Math.max(box.max.y - box.min.y, (box.max.x - box.min.x) * 0.9, (box.max.z - box.min.z) * 0.9)
const camera = new THREE.PerspectiveCamera(26, 1, 0.01, 50)
// azimuth from the front toward +x (the right handle), and elevation in degrees (null: --elevation)
const presets = { front: [0, null], three_quarter: [Math.PI / 5, null], side: [Math.PI / 2, null],
                  low: [Math.PI / 5, 4], top: [0, 88] }
views.forEach((view, i) => {
  if (!presets[view]) throw new Error('unknown view ' + view + '; use ' + Object.keys(presets).join(', '))
  const [azimuth, degrees] = presets[view]
  const lift = degrees === null ? elevation : degrees * Math.PI / 180
  const distance = height * 2.6
  camera.position.set(centre.x + Math.sin(azimuth) * Math.cos(lift) * distance,
                      centre.y + Math.sin(lift) * distance,
                      centre.z + Math.cos(azimuth) * Math.cos(lift) * distance)
  camera.lookAt(centre)
  renderer.setViewport(i * size, 0, size, size)
  renderer.setScissor(i * size, 0, size, size)
  renderer.render(scene, camera)
})
window.__ready = true
</script></body></html>`

const types = { '.js': 'text/javascript', '.json': 'application/json' }
const server = createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0])
  let file = null
  if (url === '/') return res.end(page)
  if (url === '/favicon.ico') {
    res.statusCode = 204
    return res.end()
  }
  if (url === '/asset.glb') file = glbPath
  else if (url === '/env.hdr') file = HDR
  else if (url.startsWith('/three/'))
    file = join(THREE_DIR, url.slice('/three/'.length))
  const allowed =
    file === glbPath ||
    file === HDR ||
    (file && file.startsWith(THREE_DIR + '/'))
  if (!allowed || !existsSync(file)) {
    res.statusCode = 404
    return res.end()
  }
  res.setHeader(
    'content-type',
    types[extname(file)] ?? 'application/octet-stream',
  )
  res.end(readFileSync(file))
})
await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
const port = server.address().port
const preinstalled = process.env.PROOF_CHROMIUM ?? '/opt/pw-browsers/chromium'
const browser = await chromium.launch({
  executablePath: existsSync(preinstalled) ? preinstalled : undefined,
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
})
try {
  const tab = await browser.newPage({
    viewport: { width: size * views.length, height: size },
  })
  const errors = []
  tab.on('pageerror', (error) => errors.push(String(error)))
  tab.on(
    'console',
    (message) => message.type() === 'error' && errors.push(message.text()),
  )
  await tab.goto(`http://127.0.0.1:${port}/`)
  await tab.waitForFunction(() => window.__ready === true, undefined, {
    timeout: 240_000,
  })
  await tab.locator('canvas').screenshot({ path: outPath, timeout: 180_000 })
  if (dump)
    console.log(
      JSON.stringify(await tab.evaluate(() => window.__materials), null, 1),
    )
  console.log(
    JSON.stringify({
      out: outPath,
      views,
      env,
      overrides: overrides.length,
      errors,
    }),
  )
  if (errors.length) process.exitCode = 1
} finally {
  await browser.close()
  server.close()
}
