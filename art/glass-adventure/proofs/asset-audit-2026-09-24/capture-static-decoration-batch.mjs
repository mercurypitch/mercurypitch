// Actual exported planter comparison: identical composition, fewer room-owned draws.
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(directory, '../../../..')
const origin = new URL(process.env.GLASS_QA_URL ?? 'http://127.0.0.1:5525')
if (!['localhost', '127.0.0.1'].includes(origin.hostname))
  throw new Error('Local proof only')
const output = path.join(directory, 'static-planters')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 750 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/__static-planter-proof', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html><body style="margin:0"></body></html>',
    }),
  )
  await page.goto(new URL('/__static-planter-proof', origin).href)
  const result = await page.evaluate(
    async ({ repo }) => {
      const base = `/@fs/${repo}/packages/glass-game`
      const T = await import(`${base}/node_modules/three/build/three.module.js`)
      const { GLTFLoader } = await import(
        `${base}/node_modules/three/examples/jsm/loaders/GLTFLoader.js`
      )
      const { createRoomDecorations } = await import(
        `${base}/src/render/room-decorations.ts`
      )
      const { createKitInstance } = await import(
        `${base}/src/render/kit-instance.ts`
      )
      const { createMaterialLibrary } = await import(
        `${base}/src/render/material-library.ts`
      )
      const { createMuseumMaterials } = await import(
        `${base}/src/render/materials.ts`
      )
      const { CLOUDWAY_CURRENT_TRIAL } = await import(
        `${base}/src/content/cloudway-layouts.ts`
      )
      const loaded = await new GLTFLoader().loadAsync(
        '/games/adventure-v5/museum-decor.glb',
      )
      const template = loaded.scene.getObjectByName('decor_crystal_planter')
      const renderer = new T.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true,
      })
      renderer.setSize(1000, 750)
      renderer.setPixelRatio(1)
      renderer.toneMapping = T.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.2
      document.body.append(renderer.domElement)
      const scene = new T.Scene()
      scene.background = new T.Color('#e7ebe5')
      const light = new T.DirectionalLight('#fff4dd', 3)
      light.position.set(-2, 4, 3)
      scene.add(light, new T.HemisphereLight('#ffffff', '#546d61', 2))
      const materialLibrary = createMaterialLibrary()
      const materials = createMuseumMaterials()
      const definitions = CLOUDWAY_CURRENT_TRIAL.presentation.decorations.map(
        (definition, index) => ({
          ...definition,
          position: {
            x: ((index % 3) - 1) * 1.15,
            y: 0,
            z: Math.floor(index / 3) * 1.1,
          },
          yaw: (index - 2) * 0.19,
          coveredSolidIds: [],
        }),
      )
      const level = {
        ...CLOUDWAY_CURRENT_TRIAL,
        presentation: {
          ...CLOUDWAY_CURRENT_TRIAL.presentation,
          decorations: definitions,
        },
      }
      const manager = createRoomDecorations(level, materials, materialLibrary)
      const batched = new T.Group()
      batched.add(...manager.instances.map((instance) => instance.root))
      manager.installBundle(loaded.scene, 'museum-decor-v5')
      const ordinary = new T.Group()
      for (const definition of definitions) {
        const art = createKitInstance(template, materials, {}, materialLibrary)
        art.position.copy(definition.position)
        art.rotation.y = definition.yaw
        art.scale.setScalar(definition.scale)
        ordinary.add(art)
      }
      const camera = new T.PerspectiveCamera(35, 4 / 3, 0.01, 40)
      camera.position.set(2.6, 3.3, 5)
      camera.lookAt(0, 0.3, 0.6)
      const pixels = () => {
        const value = new Uint8Array(1000 * 750 * 4)
        const gl = renderer.getContext()
        gl.readPixels(0, 0, 1000, 750, gl.RGBA, gl.UNSIGNED_BYTE, value)
        return value
      }
      scene.add(ordinary)
      await renderer.compileAsync(scene, camera)
      renderer.render(scene, camera)
      const before = pixels()
      const beforeCalls = renderer.info.render.calls
      const beforeTriangles = renderer.info.render.triangles
      scene.remove(ordinary)
      scene.add(batched)
      await renderer.compileAsync(scene, camera)
      renderer.render(scene, camera)
      const after = pixels()
      let changedChannels = 0,
        absoluteError = 0,
        largestError = 0
      for (let i = 0; i < before.length; i++) {
        const error = Math.abs(before[i] - after[i])
        if (error) changedChannels++
        absoluteError += error
        largestError = Math.max(largestError, error)
      }
      const result = {
        placements: definitions.length,
        beforeCalls,
        afterCalls: renderer.info.render.calls,
        beforeTriangles,
        afterTriangles: renderer.info.render.triangles,
        changedChannelFraction: changedChannels / before.length,
        meanAbsoluteChannelError: absoluteError / before.length,
        largestError,
      }
      window.planterProof = { scene, renderer, camera, ordinary, batched }
      if (
        result.afterCalls >= result.beforeCalls ||
        result.afterTriangles !== beforeTriangles ||
        result.meanAbsoluteChannelError > 0.1
      )
        throw new Error(
          `Instancing changed the export or did not reduce draws: ${JSON.stringify(result)}`,
        )
      return result
    },
    { repo },
  )
  await page.screenshot({ path: path.join(output, 'instanced.png') })
  await page.evaluate(() => {
    const { scene, renderer, camera, ordinary, batched } = window.planterProof
    scene.remove(batched)
    scene.add(ordinary)
    renderer.render(scene, camera)
  })
  await page.screenshot({ path: path.join(output, 'individual.png') })
  if (errors.length) throw new Error(errors.join('\n'))
  await writeFile(
    path.join(output, 'receipt.json'),
    JSON.stringify(
      {
        result,
        errors,
        scope:
          'Actual GLB and runtime room decoration manager; deterministic arranged prop comparison, not a full-level or physical-device performance claim.',
      },
      null,
      2,
    ) + '\n',
  )
  console.log(result)
} finally {
  await browser.close()
}
