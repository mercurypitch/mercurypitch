// Graphics recovery — real Three constructor failures must not outlive their canvas owner.
import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const renderRoot = fileURLToPath(
  new URL('../../../packages/glass-game/src/render/', import.meta.url),
)

test.use({
  viewport: { width: 487, height: 1055 },
  hasTouch: true,
  launchOptions: {
    env: { ...process.env, CHROME_DESKTOP: 'agent-browser.desktop' },
    args: [
      '--class=agent-browser',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
    ],
  },
})

test('a lost context during Merc construction cannot crash when restored @smoke', async ({
  page,
}) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.route('**/__context-recovery', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<html><body></body></html>',
    }),
  )
  await page.goto('/__context-recovery')
  const result = await page.evaluate(async (root) => {
    const { createLoadingMerc } = await import(`${root}loading-merc.ts`)
    const { getGraphicsCanvasDiagnostic } = await import(
      `${root}graphics-diagnostics.ts`
    )
    const canvas = document.createElement('canvas')
    document.body.append(canvas)
    const gl = canvas.getContext('webgl2')!
    const loss = gl.getExtension('WEBGL_lose_context')!
    const lost = new Promise<void>((resolve) => {
      canvas.addEventListener(
        'webglcontextlost',
        (event) => {
          event.preventDefault()
          resolve()
        },
        { once: true },
      )
    })
    loss.loseContext()
    await lost
    let constructionError = ''
    try {
      createLoadingMerc(canvas, {
        modelUrl: '/unused.glb',
        reducedMotion: true,
        onFirstFrame: () => undefined,
        onError: () => undefined,
      })
    } catch (error) {
      constructionError = (error as Error).message
    }
    const diagnostic = getGraphicsCanvasDiagnostic(canvas)
    const restored = new Promise<void>((resolve) =>
      canvas.addEventListener('webglcontextrestored', () => resolve(), {
        once: true,
      }),
    )
    // Restoration must start after the loss event dispatch has completed.
    setTimeout(() => loss.restoreContext(), 0)
    await restored
    canvas.remove()
    return { constructionError, diagnostic, contextLost: gl.isContextLost() }
  }, `/@fs${renderRoot}`)
  expect(result.constructionError).not.toBe('')
  expect(result.contextLost).toBe(false)
  expect(pageErrors).toEqual([])
  expect(result.diagnostic).toMatchObject({
    scene: 'loading-merc',
    lifecycle: 'disposed',
  })
})

for (const { location, paused } of [
  { location: 'rooms', paused: false },
  { location: 'rooms', paused: true },
  { location: 'cloudway-crescent', paused: false },
  { location: 'cloudway-crescent', paused: true },
]) {
  test(`${location} context loss ${paused ? 'while paused' : 'while playing'} keeps recovery free of new WebGL work @smoke`, async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.addInitScript(() => {
      localStorage.setItem('beside-cue:glass-adventure:tutorial', 'seen')
      // The first test exercises real GPU loss/restore. This app case retains
      // Three and real contexts while omitting pixels unrelated to UI ownership.
      for (const method of [
        'clear',
        'drawArrays',
        'drawArraysInstanced',
        'drawElements',
        'drawElementsInstanced',
      ])
        Object.defineProperty(WebGL2RenderingContext.prototype, method, {
          configurable: true,
          value: () => undefined,
        })
    })
    await page.goto(
      location === 'rooms' ? '/glass-game/' : `/glass-game/?layout=${location}`,
    )
    const game = page.getByTestId('glass-adventure')
    await expect(game).toHaveAttribute('data-ready', 'true', {
      timeout: 60_000,
    })
    if (location !== 'rooms')
      await page.getByRole('button', { name: 'Skip tutorial' }).click()
    if (paused)
      await page.getByRole('button', { name: 'Open settings' }).click()
    await expect(page.getByTestId('glass-loading-merc')).toHaveCount(0)
    const retired = await page
      .locator('canvas[aria-label="Floating glass museum"]')
      .evaluate(async (element, root) => {
        const { getGraphicsCanvasDiagnostic } = await import(
          `${root}graphics-diagnostics.ts`
        )
        const canvas = element as HTMLCanvasElement
        const gl = canvas.getContext('webgl2')!
        const loss = gl.getExtension('WEBGL_lose_context')!
        const lost = new Promise<void>((resolve) =>
          canvas.addEventListener('webglcontextlost', () => resolve(), {
            once: true,
          }),
        )
        loss.loseContext()
        await lost
        const diagnostic = getGraphicsCanvasDiagnostic(canvas)
        const restored = new Promise<void>((resolve) =>
          canvas.addEventListener('webglcontextrestored', () => resolve(), {
            once: true,
          }),
        )
        setTimeout(() => loss.restoreContext(), 0)
        await restored
        return { diagnostic, contextLost: gl.isContextLost() }
      }, `/@fs${renderRoot}`)
    expect(retired).toMatchObject({
      diagnostic: { scene: 'gallery', lifecycle: 'disposed' },
      contextLost: false,
    })
    const cover = page.getByTestId('glass-loading-screen')
    await expect(cover).toHaveAttribute('data-phase', 'error')
    await expect(cover.locator('canvas')).toHaveCount(0)
    await expect(cover.locator('img')).toBeVisible()
    await cover.getByRole('button', { name: 'Retry', exact: true }).click()
    await expect(game).toHaveAttribute('data-ready', 'true', {
      timeout: 60_000,
    })
    await expect(cover).toHaveCount(0)
    expect(pageErrors).toEqual([])
  })
}
