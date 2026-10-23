// Renderer ownership — real GPU lookup textures retire with their renderer.
import { expect, test } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const threeModule = `/@fs${fileURLToPath(import.meta.resolve('three'))}`

test.use({
  headless: process.env.GLASS_GPU_RENDER_PROOF !== '1',
  launchOptions: {
    env: { ...process.env, CHROME_DESKTOP: 'agent-browser.desktop' },
    args: [
      '--class=agent-browser',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling',
      ...(process.env.GLASS_GPU_RENDER_PROOF === '1'
        ? [
            '--ignore-gpu-blocklist',
            '--use-gl=angle',
            '--use-angle=gl',
            '--ozone-platform=wayland',
          ]
        : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']),
    ],
  },
})

test('lookup GPU ownership survives disposal, concurrent renderers and context restoration @smoke', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  // This fixture imports the installed entrypoint without starting another app renderer.
  await page.route('**/renderer-ownership.html', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Renderer ownership</title><body></body>',
    }),
  )
  await page.goto('/renderer-ownership.html')
  const result = await page.evaluate(async (moduleUrl) => {
    const THREE = (await import(moduleUrl)) as typeof import('three')
    const size = 128
    function make(
      sharedMaterial?: InstanceType<typeof THREE.MeshStandardMaterial>,
    ) {
      const renderer = new THREE.WebGLRenderer({
        antialias: false,
        preserveDrawingBuffer: true,
      })
      renderer.setSize(size, size)
      renderer.setPixelRatio(1)
      document.body.append(renderer.domElement)
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x132438)
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
      camera.position.set(0, 0, 4)
      const geometry = new THREE.BoxGeometry(1.4, 1.4, 1.4)
      const material =
        sharedMaterial ??
        new THREE.MeshStandardMaterial({
          color: 0xf3ce91,
          metalness: 0.2,
          roughness: 0.35,
        })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.rotation.set(0.2, 0.4, 0)
      scene.add(mesh, new THREE.AmbientLight(0xffffff, 1.2))
      const light = new THREE.DirectionalLight(0xffffff, 3)
      light.position.set(2, 3, 4)
      scene.add(light)
      const draw = () => {
        renderer.render(scene, camera)
        const gl = renderer.getContext()
        const pixels = new Uint8Array(size * size * 4)
        gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
        let hash = 2166136261
        const colors = new Set<number>()
        for (let i = 0; i < pixels.length; i++) {
          hash = Math.imul(hash ^ pixels[i], 16777619)
          if (i % 4 === 0)
            colors.add(pixels[i] + 256 * pixels[i + 1] + 65536 * pixels[i + 2])
        }
        return {
          hash: (hash >>> 0).toString(16),
          colors: colors.size,
          error: gl.getError(),
          contextLost: gl.isContextLost(),
          calls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          textures: renderer.info.memory.textures,
        }
      }
      const dispose = () => {
        geometry.dispose()
        if (sharedMaterial === undefined) material.dispose()
        renderer.dispose()
        // Check before deliberate context loss: losing a context can hide a retained texture.
        const textures = renderer.info.memory.textures
        renderer.forceContextLoss()
        renderer.domElement.remove()
        return textures
      }
      return { renderer, draw, dispose }
    }

    const cycles = []
    for (let i = 0; i < 8; i++) {
      const fixture = make()
      const frame = fixture.draw()
      cycles.push({ frame, disposedTextures: fixture.dispose() })
    }

    // Material sharing must not make one renderer own the other's GPU allocation.
    const shared = new THREE.MeshStandardMaterial({
      color: 0xf3ce91,
      metalness: 0.2,
      roughness: 0.35,
    })
    const first = make(shared)
    const second = make(shared)
    const firstFrame = first.draw()
    const secondFrame = second.draw()
    const firstDisposedTextures = first.dispose()
    const secondTexturesAfterFirstDispose = second.renderer.info.memory.textures
    const secondAfterFirstDispose = second.draw()
    const secondDisposedTextures = second.dispose()
    shared.dispose()

    const restored = make()
    const beforeRestore = restored.draw()
    const oldInfo = restored.renderer.info
    const gl = restored.renderer.getContext()
    const debug = gl.getExtension('WEBGL_debug_renderer_info')
    const gpu =
      debug === null
        ? 'unavailable'
        : String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL))
    const loss = gl.getExtension('WEBGL_lose_context')
    if (loss === null) throw new Error('Real context-loss support is required')
    const waitForEvent = (name: string) =>
      new Promise<void>((resolve, reject) => {
        const listener = () => {
          clearTimeout(timer)
          resolve()
        }
        const timer = setTimeout(() => {
          restored.renderer.domElement.removeEventListener(name, listener)
          reject(new Error(`${name} did not arrive`))
        }, 10_000)
        restored.renderer.domElement.addEventListener(name, listener, {
          once: true,
        })
      })
    const lostEvent = waitForEvent('webglcontextlost')
    loss.loseContext()
    await lostEvent
    // Restore is legal only after the context-lost event finishes dispatching.
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    const restoredEvent = waitForEvent('webglcontextrestored')
    loss.restoreContext()
    await restoredEvent
    const oldTexturesAfterRestore = oldInfo.memory.textures
    const afterRestore = restored.draw()
    const disposedRestoredTextures = restored.dispose()
    return {
      cycles,
      concurrent: {
        firstFrame,
        secondFrame,
        firstDisposedTextures,
        secondTexturesAfterFirstDispose,
        secondAfterFirstDispose,
        secondDisposedTextures,
      },
      restoration: {
        beforeRestore,
        afterRestore,
        oldTexturesAfterRestore,
        disposedRestoredTextures,
      },
      gpu,
    }
  }, threeModule)

  writeFileSync(
    testInfo.outputPath('renderer-ownership.json'),
    `${JSON.stringify({ ...result, errors, nativeCauseReproduced: false }, null, 2)}\n`,
  )
  const frames = [
    ...result.cycles.map((cycle) => cycle.frame),
    result.concurrent.firstFrame,
    result.concurrent.secondFrame,
    result.concurrent.secondAfterFirstDispose,
    result.restoration.beforeRestore,
    result.restoration.afterRestore,
  ]
  for (const frame of frames) {
    expect(frame.calls).toBeGreaterThan(0)
    expect(frame.triangles).toBeGreaterThan(0)
    expect(frame.colors).toBeGreaterThan(1)
    expect(frame.textures).toBe(1)
    expect(frame.contextLost).toBe(false)
    expect(frame.error).toBe(0)
  }
  for (const cycle of result.cycles) expect(cycle.disposedTextures).toBe(0)
  expect(result.concurrent.firstDisposedTextures).toBe(0)
  expect(result.concurrent.secondTexturesAfterFirstDispose).toBe(1)
  expect(result.concurrent.secondDisposedTextures).toBe(0)
  expect(result.concurrent.secondAfterFirstDispose.hash).toBe(
    result.concurrent.secondFrame.hash,
  )
  expect(result.restoration.oldTexturesAfterRestore).toBe(0)
  expect(result.restoration.disposedRestoredTextures).toBe(0)
  expect(result.restoration.afterRestore.hash).toBe(
    result.restoration.beforeRestore.hash,
  )
  if (process.env.GLASS_GPU_RENDER_PROOF === '1')
    expect(result.gpu).not.toMatch(/unavailable|SwiftShader|llvmpipe/i)
  expect(errors).toEqual([])
})
