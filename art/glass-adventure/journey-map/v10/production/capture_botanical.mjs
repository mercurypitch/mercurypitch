// Fresh Three.js export proof, matched camera/lighting for 1K and 2K delivery.
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repo = path.resolve(root, '../../../..')
const url = new URL(process.env.GLASS_QA_URL ?? 'http://127.0.0.1:5525')
if (!['localhost', '127.0.0.1'].includes(url.hostname))
  throw new Error('Local proof only')
const output = path.join(root, 'proofs')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 750 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/__botanical-proof', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html><body style="margin:0"></body></html>',
    }),
  )
  await page.goto(new URL('/__botanical-proof', url).href)
  await page.evaluate(
    async ({ repo }) => {
      const THREE = await import(
        `/@fs/${repo}/packages/glass-game/node_modules/three/build/three.module.js`
      )
      const { GLTFLoader } = await import(
        `/@fs/${repo}/packages/glass-game/node_modules/three/examples/jsm/loaders/GLTFLoader.js`
      )
      const { RoomEnvironment } = await import(
        `/@fs/${repo}/packages/glass-game/node_modules/three/examples/jsm/environments/RoomEnvironment.js`
      )
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true,
      })
      renderer.setSize(1000, 750)
      renderer.setPixelRatio(1)
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.2
      document.body.append(renderer.domElement)
      const scene = new THREE.Scene()
      scene.background = new THREE.Color('#e8eeea')
      const pmrem = new THREE.PMREMGenerator(renderer)
      const room = new RoomEnvironment()
      const environment = pmrem.fromScene(room)
      scene.environment = environment.texture
      room.dispose()
      const key = new THREE.DirectionalLight('#fff5df', 3)
      key.position.set(-2, 4, 3)
      scene.add(key, new THREE.HemisphereLight('#ffffff', '#718078', 0.7))
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(20, 20),
        new THREE.MeshStandardMaterial({ color: '#d6ddd5', roughness: 0.9 }),
      )
      ground.rotation.x = -Math.PI / 2
      ground.position.y = -0.002
      scene.add(ground)
      const camera = new THREE.OrthographicCamera(
        -0.72,
        0.72,
        0.54,
        -0.54,
        0.01,
        20,
      )
      camera.position.set(1.2, 1.6, 1.8)
      camera.lookAt(0, 0.19, 0)
      let current
      window.showBotanical = async (url, scale = 1) => {
        if (current) {
          scene.remove(current)
          const geometries = new Set()
          const materials = new Set()
          const textures = new Set()
          current.traverse((node) => {
            if (!node.isMesh) return
            geometries.add(node.geometry)
            for (const material of Array.isArray(node.material)
              ? node.material
              : [node.material]) {
              materials.add(material)
              for (const value of Object.values(material))
                if (value?.isTexture) textures.add(value)
            }
          })
          for (const value of geometries) value.dispose()
          for (const value of materials) value.dispose()
          for (const value of textures) value.dispose()
        }
        const document = await new GLTFLoader().loadAsync(url)
        current = document.scene.getObjectByName('map_flower_cluster')
        if (!current) throw new Error('Exported botanical root missing')
        current.scale.setScalar(scale)
        scene.add(current)
        await renderer.compileAsync(scene, camera)
        renderer.render(scene, camera)
        const bounds = new THREE.Box3().setFromObject(current)
        return {
          drawCalls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          textures: renderer.info.memory.textures,
          width: bounds.max.x - bounds.min.x,
          bottom: bounds.min.y,
          height: bounds.max.y - bounds.min.y,
        }
      }
    },
    { repo },
  )
  const results = []
  for (const size of ['2k', '1k']) {
    const asset = `/@fs/${root}/delivery/camellia-crescent-${size}.glb`
    const close = await page.evaluate(
      (asset) => window.showBotanical(asset),
      asset,
    )
    await page.screenshot({
      path: path.join(output, `three-${size}-close.png`),
    })
    const normal = await page.evaluate(
      (asset) => window.showBotanical(asset, 0.35),
      asset,
    )
    await page.screenshot({
      path: path.join(output, `three-${size}-map-distance.png`),
    })
    results.push({ size, close, normal })
  }
  if (errors.length) throw new Error(errors.join('\n'))
  await writeFile(
    path.join(output, 'three-delivery.json'),
    JSON.stringify(
      {
        results,
        errors,
        renderer:
          'Three.js r185 in Chromium, SwiftShader; visual/export proof, not device performance',
      },
      null,
      2,
    ) + '\n',
  )
  console.log(results)
} finally {
  await browser.close()
}
