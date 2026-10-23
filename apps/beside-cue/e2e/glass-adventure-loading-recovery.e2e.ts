// Pending-load recovery — retire a real gallery context before its held image settles.
import { expect, test } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const renderRoot = fileURLToPath(
  new URL('../../../packages/glass-game/src/render/', import.meta.url),
)

test.use({
  headless: process.env.GLASS_GPU_RENDER_PROOF !== '1',
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  hasTouch: true,
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

test('pending gallery loss retires real GPU work and Retry reaches its first frame @smoke', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    localStorage.setItem('beside-cue:glass-adventure:tutorial', 'seen')
    localStorage.setItem(
      'beside-cue:glass-adventure:render-quality:v1',
      'balanced',
    )
    // Observe real draws/uploads on each canvas without suppressing any call.
    for (const name of [
      'drawArrays',
      'drawElements',
      'drawArraysInstanced',
      'drawElementsInstanced',
      'texImage2D',
      'texSubImage2D',
    ] as const) {
      const original = WebGL2RenderingContext.prototype[name]
      Object.defineProperty(WebGL2RenderingContext.prototype, name, {
        configurable: true,
        value: function (this: WebGL2RenderingContext, ...args: unknown[]) {
          const canvas = this.canvas as HTMLCanvasElement & {
            __recoveryCalls?: { draws: number; uploads: number }
          }
          const counts = (canvas.__recoveryCalls ??= { draws: 0, uploads: 0 })
          if (name.startsWith('draw')) counts.draws++
          else counts.uploads++
          return (original as (...args: unknown[]) => unknown).apply(this, args)
        },
      })
    }
  })
  let release!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  let heldRequest = false
  await page.route(
    '**/games/adventure-v2/textures/warm-carrara-normal.webp',
    async (route) => {
      if (!heldRequest) {
        heldRequest = true
        await held
      }
      if (!page.isClosed()) await route.continue().catch(() => undefined)
    },
  )
  try {
    await page.goto(
      '/glass-game/?layout=crystal-interiors&interior=aurora-heart',
      { waitUntil: 'domcontentloaded' },
    )
    await expect.poll(() => heldRequest).toBe(true)
    const cover = page.getByTestId('glass-loading-screen')
    await expect(cover).toHaveAttribute('data-phase', 'loading-assets')
    const canvas = page.locator('canvas[aria-label="Floating glass museum"]')
    const old = await canvas.elementHandle()
    expect(old).not.toBeNull()
    const instance = await old!.evaluate(async (element, root) => {
      const { getGraphicsCanvasDiagnostic } = await import(
        `${root}graphics-diagnostics.ts`
      )
      const gl = (element as HTMLCanvasElement).getContext('webgl2')!
      const loss = gl.getExtension('WEBGL_lose_context')
      if (loss === null)
        throw new Error('Real WebGL context-loss capability is required')
      const before = getGraphicsCanvasDiagnostic(element as HTMLCanvasElement)
      const lost = new Promise<void>((resolve) =>
        element.addEventListener('webglcontextlost', () => resolve(), {
          once: true,
        }),
      )
      loss.loseContext()
      await lost
      return before?.instance
    }, `/@fs${renderRoot}`)
    expect(instance).toBeGreaterThan(0)
    await expect(cover).toHaveAttribute('data-phase', 'error')
    await expect(cover.locator('canvas')).toHaveCount(0)
    await expect(cover.locator('img')).toBeVisible()
    const retired = await old!.evaluate(async (element, root) => {
      const { getGraphicsCanvasDiagnostic } = await import(
        `${root}graphics-diagnostics.ts`
      )
      return {
        connected: element.isConnected,
        diagnostic: getGraphicsCanvasDiagnostic(element as HTMLCanvasElement),
        calls: {
          ...(element as HTMLCanvasElement & { __recoveryCalls: object })
            .__recoveryCalls,
        },
      }
    }, `/@fs${renderRoot}`)
    expect(retired.connected).toBe(false)
    expect(retired.diagnostic).toMatchObject({
      instance,
      lifecycle: 'disposed',
    })
    await cover.getByRole('button', { name: 'Retry', exact: true }).tap()
    await expect(cover).toHaveAttribute('data-phase', 'loading-assets')
    await expect
      .poll(async () =>
        canvas.evaluate(async (element, root) => {
          const { getGraphicsCanvasDiagnostic } = await import(
            `${root}graphics-diagnostics.ts`
          )
          return getGraphicsCanvasDiagnostic(element as HTMLCanvasElement)
            ?.instance
        }, `/@fs${renderRoot}`),
      )
      .not.toBe(instance)
    release()
    await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
      'data-ready',
      'true',
      { timeout: 60_000 },
    )
    await expect(cover).toHaveCount(0)
    const ready = await canvas.evaluate(async (element, root) => {
      const { getGraphicsCanvasDiagnostic } = await import(
        `${root}graphics-diagnostics.ts`
      )
      const gl = (element as HTMLCanvasElement).getContext('webgl2')!
      const debug = gl.getExtension('WEBGL_debug_renderer_info')
      return {
        diagnostic: getGraphicsCanvasDiagnostic(element as HTMLCanvasElement),
        calls: (
          element as HTMLCanvasElement & {
            __recoveryCalls?: { draws: number; uploads: number }
          }
        ).__recoveryCalls,
        renderer:
          debug === null
            ? 'unavailable'
            : String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)),
      }
    }, `/@fs${renderRoot}`)
    expect(ready.diagnostic).toMatchObject({
      scene: 'gallery',
      lifecycle: 'active',
    })
    expect(ready.calls?.draws).toBeGreaterThan(0)
    expect(ready.calls?.uploads).toBeGreaterThan(0)
    if (process.env.GLASS_GPU_RENDER_PROOF === '1')
      expect(ready.renderer).not.toMatch(/unavailable|SwiftShader|llvmpipe/i)
    expect(
      await old!.evaluate((element) => ({
        ...(element as HTMLCanvasElement & { __recoveryCalls: object })
          .__recoveryCalls,
      })),
    ).toEqual(retired.calls)
    expect(errors).toEqual([])
    await page.screenshot({
      path: testInfo.outputPath('retry-first-frame.png'),
    })
    writeFileSync(
      testInfo.outputPath('real-draw-recovery.json'),
      `${JSON.stringify({ retired, ready, errors, nativeCauseReproduced: false }, null, 2)}\n`,
    )
  } finally {
    release()
  }
})
