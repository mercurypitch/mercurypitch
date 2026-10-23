// Catalog image orientation — actual bitmap and canvas resizes must preserve sampled texels.
import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const profileModule = `/@fs${fileURLToPath(new URL('../../../packages/glass-game/src/render/asset-texture-profile.ts', import.meta.url))}`
const threeModule = `/@fs${fileURLToPath(new URL('../../../packages/glass-game/node_modules/three/build/three.module.js', import.meta.url))}`

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

for (const path of ['bitmap', 'canvas'] as const) {
  test(`mobile catalog ${path} resize preserves actual GPU orientation @smoke`, async ({
    page,
  }) => {
    await page.route('**/__texture-orientation', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<html><body></body></html>',
      }),
    )
    await page.goto('/__texture-orientation')
    const result = await page.evaluate(
      async ({ module, threeModule, path }) => {
        const { applyOwnedAssetTextureProfile } = await import(module)
        const THREE = await import(threeModule)
        const source = document.createElement('canvas')
        source.width = source.height = 1024
        const ctx = source.getContext('2d')!
        for (const [color, x, y] of [
          ['#ff0000', 0, 0],
          ['#00ff00', 512, 0],
          ['#0000ff', 0, 512],
          ['#ffff00', 512, 512],
        ] as const) {
          ctx.fillStyle = color
          ctx.fillRect(x, y, 512, 512)
        }
        const imageUrl = source.toDataURL()
        const canvas = document.createElement('canvas')
        document.body.append(canvas)
        const renderer = new THREE.WebGLRenderer({
          canvas,
          preserveDrawingBuffer: true,
        })
        renderer.setSize(32, 32)
        const gl = renderer.getContext()
        const scene = new THREE.Scene()
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
        camera.position.z = 1
        const material = new THREE.MeshBasicMaterial({ toneMapped: false })
        const geometry = new THREE.PlaneGeometry(2, 2)
        scene.add(new THREE.Mesh(geometry, material))
        const textures: import('three').Texture[] = []
        const bitmap = globalThis.createImageBitmap
        let bitmapCalls = 0
        if (path === 'bitmap' && typeof bitmap !== 'function')
          throw new Error('Actual bitmap resize capability is required')
        try {
          const render = (texture: import('three').Texture) => {
            material.map = texture
            material.needsUpdate = true
            renderer.render(scene, camera)
            return [
              [8, 8],
              [24, 8],
              [8, 24],
              [24, 24],
            ].map(([x, y]) => {
              const pixel = new Uint8Array(4)
              gl.readPixels(x!, y!, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
              return [...pixel]
            })
          }
          const load = async () => {
            const texture = await new THREE.TextureLoader().loadAsync(imageUrl)
            texture.flipY = false
            texture.colorSpace = THREE.NoColorSpace
            texture.minFilter = texture.magFilter = THREE.NearestFilter
            textures.push(texture)
            return texture
          }
          const baseline = render(await load())
          const texture = await load()
          globalThis.createImageBitmap =
            path === 'canvas'
              ? (undefined as unknown as typeof bitmap)
              : async (...args: Parameters<typeof bitmap>) => {
                  bitmapCalls++
                  return bitmap(...args)
                }
          const metrics = await applyOwnedAssetTextureProfile(
            texture,
            'roughnessMap',
            'mobile',
          )
          const image = texture.source.data as ImageBitmap | HTMLCanvasElement
          return {
            baseline,
            resized: render(texture),
            metrics,
            width: image.width,
            height: image.height,
            bitmapCalls,
            imageKind: image.constructor.name,
            glError: gl.getError(),
          }
        } finally {
          globalThis.createImageBitmap = bitmap
          for (const texture of textures) {
            const image = texture.source.data as { close?: () => void }
            texture.dispose()
            image.close?.()
          }
          material.dispose()
          geometry.dispose()
          renderer.dispose()
          renderer.forceContextLoss()
          canvas.remove()
        }
      },
      { module: profileModule, threeModule, path },
    )
    expect(result.metrics.resizedSources).toBe(1)
    expect([result.width, result.height]).toEqual([512, 512])
    expect(result.imageKind).toBe(
      path === 'bitmap' ? 'ImageBitmap' : 'HTMLCanvasElement',
    )
    expect(result.bitmapCalls).toBe(path === 'bitmap' ? 1 : 0)
    expect(result.baseline).toEqual([
      [255, 0, 0, 255],
      [0, 255, 0, 255],
      [0, 0, 255, 255],
      [255, 255, 0, 255],
    ])
    expect(result.resized).toEqual(result.baseline)
    expect(result.glError).toBe(0)
  })
}
