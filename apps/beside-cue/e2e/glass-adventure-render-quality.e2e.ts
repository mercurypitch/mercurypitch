// Render quality browser proof — stable mobile policy, persistence and exact recurring WebGL work.

import { writeFileSync } from 'node:fs'
import { expect, test, type BrowserContext, type Locator, type Page, } from '@playwright/test'

type QualityPreference = 'auto' | 'high' | 'balanced'

interface DrawRecord {
  count: number
  framebuffer: string
  frameTime: number
  instances: number
  method: string
  mode: number
  viewport: [number, number, number, number]
}

interface PassReceipt {
  drawCalls: number
  targetPixels: number
  targets: number
  triangles: number
  viewport: [number, number]
}

interface FrameReceipt {
  canvas: {
    cssHeight: number
    cssWidth: number
    devicePixelRatio: number
    height: number
    pixelRatio: number
    width: number
  }
  drawCalls: number
  passes: Partial<Record<'screen' | 'shadow' | 'transmission', PassReceipt>>
  preference: string | null
  profile: string | null
  targetPixels: number
  triangles: number
}

const QUALITY_KEY = 'beside-cue:glass-adventure:render-quality:v1'
const FIXED_TIME = Date.UTC(2026, 8, 24, 12)
const PROOF_ENABLED = process.env.GLASS_RENDER_QUALITY_PROOF === '1'

test.use({
  deviceScaleFactor: 3,
  hasTouch: true,
  isMobile: true,
  reducedMotion: 'reduce',
  viewport: { width: 390, height: 844 },
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})
test.setTimeout(300_000)

async function installProofHooks(
  page: Page,
  preference: QualityPreference,
): Promise<void> {
  await page.addInitScript(
    ({ qualityKey, preference }) => {
      localStorage.setItem('beside-cue:glass-adventure:tutorial', 'seen')
      localStorage.setItem(
        'beside-cue:glass-adventure:museum-audio:v1',
        JSON.stringify({ muted: true }),
      )
      if (localStorage.getItem(qualityKey) === null)
        localStorage.setItem(qualityKey, preference)
      const drawMethods = [
        'drawArrays',
        'drawArraysInstanced',
        'drawElements',
        'drawElementsInstanced',
      ] as const
      const prototype = WebGL2RenderingContext.prototype
      const originals = Object.fromEntries(
        [...drawMethods, 'clear'].map((name) => [name, prototype[name]]),
      ) as Record<string, (...args: unknown[]) => unknown>
      for (const method of drawMethods)
        Object.defineProperty(prototype, method, {
          configurable: true,
          value: function (
            this: WebGL2RenderingContext,
            ...args: unknown[]
          ): unknown {
            const state = window as Window & {
              __renderProofDraws?: DrawRecord[]
              __renderProofFramebufferIds?: WeakMap<WebGLFramebuffer, number>
              __renderProofNextFramebufferId?: number
              __renderProofRasterEnabled?: boolean
            }
            state.__renderProofDraws ??= []
            state.__renderProofFramebufferIds ??= new WeakMap()
            state.__renderProofNextFramebufferId ??= 1
            const framebuffer = this.getParameter(
              this.DRAW_FRAMEBUFFER_BINDING,
            ) as WebGLFramebuffer | null
            let framebufferName = 'screen'
            if (framebuffer !== null) {
              let id = state.__renderProofFramebufferIds.get(framebuffer)
              if (id === undefined) {
                id = state.__renderProofNextFramebufferId++
                state.__renderProofFramebufferIds.set(framebuffer, id)
              }
              framebufferName = `offscreen-${id}`
            }
            const viewport = Array.from(
              this.getParameter(this.VIEWPORT) as Int32Array,
            ) as [number, number, number, number]
            const count = Number(
              method === 'drawArrays' || method === 'drawArraysInstanced'
                ? args[2]
                : args[1],
            )
            const instances = Number(
              method === 'drawArraysInstanced'
                ? args[3]
                : method === 'drawElementsInstanced'
                  ? args[4]
                  : 1,
            )
            state.__renderProofDraws.push({
              count,
              framebuffer: framebufferName,
              frameTime: performance.now(),
              instances,
              method,
              mode: Number(args[0]),
              viewport,
            })
            if (state.__renderProofRasterEnabled === true)
              return originals[method]!.apply(this, args)
            return undefined
          },
        })
      Object.defineProperty(prototype, 'clear', {
        configurable: true,
        value: function (
          this: WebGL2RenderingContext,
          ...args: unknown[]
        ): unknown {
          const state = window as Window & {
            __renderProofRasterEnabled?: boolean
          }
          if (state.__renderProofRasterEnabled === true)
            return originals.clear!.apply(this, args)
          return undefined
        },
      })
    },
    { qualityKey: QUALITY_KEY, preference },
  )
}

async function openMuseum(page: Page): Promise<void> {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  const response = await page.goto('/glass-game/?layout=cloudway-current', {
    waitUntil: 'domcontentloaded',
  })
  expect(response?.status()).toBe(200)
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 90_000 },
  )
  const skipTutorial = page.getByRole('button', { name: 'Skip tutorial' })
  if (await skipTutorial.isVisible()) await skipTutorial.click()
  expect(errors).toEqual([])
}

async function expectQualitySelectorWithinViewport(page: Page): Promise<void> {
  const panel = page.getByRole('dialog', { name: 'Camera comfort tuning' })
  const quality = panel.getByRole('group', { name: 'Graphics quality' })
  const bounds = await quality.boundingBox()
  const viewport = page.viewportSize()
  expect(bounds).not.toBeNull()
  expect(viewport).not.toBeNull()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.y).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport!.width)
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport!.height)
  for (const label of ['Auto', 'High', 'Balanced'])
    await expect(
      quality.getByRole('button', { name: label, exact: true }),
    ).toBeVisible()
}

async function tap(
  page: Page,
  context: BrowserContext,
  locator: Locator,
): Promise<void> {
  const bounds = await locator.boundingBox()
  if (bounds === null) throw new Error('Touch target is not visible.')
  const point = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  }
  const cdp = await context.newCDPSession(page)
  try {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ id: 1, ...point }],
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
  } finally {
    await cdp.detach()
  }
}

function triangleCount(draw: DrawRecord): number {
  if (draw.mode === 4) return (draw.count / 3) * draw.instances
  if (draw.mode === 5 || draw.mode === 6)
    return Math.max(0, draw.count - 2) * draw.instances
  return 0
}

async function captureFrame(page: Page): Promise<FrameReceipt> {
  await page.evaluate(() => {
    const state = window as Window & {
      __renderProofDraws?: DrawRecord[]
      __renderProofRasterEnabled?: boolean
    }
    state.__renderProofDraws = []
    state.__renderProofRasterEnabled = true
  })
  await page.clock.runFor(17)
  const draws = await page.evaluate(() => {
    const state = window as Window & {
      __renderProofDraws?: DrawRecord[]
      __renderProofRasterEnabled?: boolean
    }
    state.__renderProofRasterEnabled = false
    return state.__renderProofDraws ?? []
  })
  const latestFrameTime = Math.max(...draws.map((draw) => draw.frameTime))
  const frameDraws = draws.filter((draw) => draw.frameTime === latestFrameTime)
  expect(frameDraws.length).toBeGreaterThan(0)
  const passState = new Map<
    'screen' | 'shadow' | 'transmission',
    {
      drawCalls: number
      targets: Map<string, [number, number]>
      triangles: number
      viewport: [number, number]
    }
  >()
  for (const draw of frameDraws) {
    const width = draw.viewport[2]
    const height = draw.viewport[3]
    const kind =
      draw.framebuffer === 'screen'
        ? 'screen'
        : width === 1024 && height === 1024
          ? 'shadow'
          : 'transmission'
    const pass = passState.get(kind) ?? {
      drawCalls: 0,
      targets: new Map(),
      triangles: 0,
      viewport: [width, height] as [number, number],
    }
    pass.drawCalls++
    pass.targets.set(draw.framebuffer, [width, height])
    pass.triangles += triangleCount(draw)
    passState.set(kind, pass)
  }
  const passes: FrameReceipt['passes'] = {}
  for (const [kind, pass] of passState)
    passes[kind] = {
      drawCalls: pass.drawCalls,
      targetPixels: [...pass.targets.values()].reduce(
        (total, [width, height]) => total + width * height,
        0,
      ),
      targets: pass.targets.size,
      triangles: pass.triangles,
      viewport: pass.viewport,
    }
  const canvas = page.getByLabel('Floating glass museum')
  const canvasMetrics = await canvas.evaluate((element: HTMLCanvasElement) => {
    const bounds = element.getBoundingClientRect()
    return {
      cssHeight: bounds.height,
      cssWidth: bounds.width,
      devicePixelRatio: window.devicePixelRatio,
      height: element.height,
      pixelRatio: element.width / bounds.width,
      width: element.width,
    }
  })
  const game = page.getByTestId('glass-adventure')
  return {
    canvas: canvasMetrics,
    drawCalls: frameDraws.length,
    passes,
    preference: await game.getAttribute('data-render-quality-preference'),
    profile: await game.getAttribute('data-render-quality-profile'),
    targetPixels: Object.values(passes).reduce(
      (total, pass) => total + pass.targetPixels,
      0,
    ),
    triangles: frameDraws.reduce(
      (total, draw) => total + triangleCount(draw),
      0,
    ),
  }
}

test('auto selects a stable compact-touch profile and explicit choices persist', async ({
  page,
  context,
}) => {
  await installProofHooks(page, 'auto')
  await openMuseum(page)
  const game = page.getByTestId('glass-adventure')
  await expect(game).toHaveAttribute('data-render-quality-preference', 'auto')
  await expect(game).toHaveAttribute('data-render-quality-profile', 'balanced')
  const canvas = page.getByLabel('Floating glass museum')
  expect(
    await canvas.evaluate(
      (element: HTMLCanvasElement) =>
        element.width / element.getBoundingClientRect().width,
    ),
  ).toBeCloseTo(1.25, 2)

  await page.getByRole('button', { name: 'Camera tuning' }).click()
  const panel = page.getByRole('dialog', { name: 'Camera comfort tuning' })
  const quality = panel.getByRole('group', { name: 'Graphics quality' })
  await expectQualitySelectorWithinViewport(page)
  await tap(
    page,
    context,
    quality.getByRole('button', { name: 'High', exact: true }),
  )
  await expect(game).toHaveAttribute('data-render-quality-profile', 'high')
  expect(
    await page.evaluate((key) => localStorage.getItem(key), QUALITY_KEY),
  ).toBe('high')
  await tap(
    page,
    context,
    panel.getByRole('button', { name: 'Close camera tuning' }),
  )
  await expect(panel).toBeHidden()
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(game).toHaveAttribute('data-ready', 'true', { timeout: 90_000 })
  await expect(game).toHaveAttribute('data-render-quality-preference', 'high')
  await expect(game).toHaveAttribute('data-render-quality-profile', 'high')
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 768, height: 1024 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(viewport)
    await page.getByRole('button', { name: 'Camera tuning' }).click()
    await expectQualitySelectorWithinViewport(page)
    await page
      .getByRole('dialog', { name: 'Camera comfort tuning' })
      .getByRole('button', { name: 'Close camera tuning' })
      .click()
  }
})

test('records matched High and Balanced real-render frames', async ({
  page,
}, testInfo) => {
  test.skip(
    !PROOF_ENABLED,
    'Set GLASS_RENDER_QUALITY_PROOF=1 for actual-pixel review.',
  )
  await installProofHooks(page, 'high')
  await page.clock.install({ time: FIXED_TIME })
  await openMuseum(page)
  await page.clock.pauseAt(FIXED_TIME + 3_600_000)
  const canvas = page.getByLabel('Floating glass museum')

  const high = await captureFrame(page)
  await canvas.screenshot({ path: testInfo.outputPath('high.png') })
  expect(high.preference).toBe('high')
  expect(high.profile).toBe('high')
  expect(high.passes.shadow).toBeDefined()

  await page.getByRole('button', { name: 'Camera tuning' }).click()
  const panel = page.getByRole('dialog', { name: 'Camera comfort tuning' })
  await expectQualitySelectorWithinViewport(page)
  await page.screenshot({
    path: testInfo.outputPath('quality-selector-phone.png'),
  })
  await panel
    .getByRole('group', { name: 'Graphics quality' })
    .getByRole('button', { name: 'Balanced', exact: true })
    .click()
  await panel.getByRole('button', { name: 'Close camera tuning' }).click()
  const balancedUpdate = await captureFrame(page)
  await canvas.screenshot({ path: testInfo.outputPath('balanced-update.png') })
  const balancedReuse = await captureFrame(page)
  await canvas.screenshot({ path: testInfo.outputPath('balanced-reuse.png') })
  await page.keyboard.down('KeyW')
  const balancedMovementStart = await captureFrame(page)
  await page.keyboard.up('KeyW')
  await canvas.screenshot({
    path: testInfo.outputPath('balanced-movement-start.png'),
  })

  expect(balancedUpdate.preference).toBe('balanced')
  expect(balancedUpdate.profile).toBe('balanced')
  expect(balancedUpdate.passes.shadow).toBeDefined()
  expect(balancedReuse.passes.shadow).toBeUndefined()
  expect(balancedMovementStart.passes.shadow).toBeDefined()
  expect(balancedUpdate.passes.screen?.triangles).toBe(
    high.passes.screen?.triangles,
  )
  expect(balancedUpdate.passes.transmission?.triangles).toBe(
    high.passes.transmission?.triangles,
  )
  expect(balancedUpdate.canvas.pixelRatio).toBeCloseTo(1.25, 2)
  expect(high.canvas.pixelRatio).toBeCloseTo(1.5, 2)
  const highColorPixels =
    high.passes.screen!.targetPixels + high.passes.transmission!.targetPixels
  const balancedColorPixels =
    balancedUpdate.passes.screen!.targetPixels +
    balancedUpdate.passes.transmission!.targetPixels
  expect(balancedColorPixels / highColorPixels).toBeLessThan(0.71)

  const balancedAverage = {
    drawCalls: (balancedUpdate.drawCalls + balancedReuse.drawCalls) / 2,
    targetPixels:
      (balancedUpdate.targetPixels + balancedReuse.targetPixels) / 2,
    triangles: (balancedUpdate.triangles + balancedReuse.triangles) / 2,
  }
  const receipt = {
    environment: {
      renderer: 'Chromium SwiftShader',
      viewportCssPixels: [390, 844],
      deviceScaleFactor: 3,
      note: 'Submission and pixel-budget evidence only; software render wall time is not phone FPS.',
    },
    high,
    balancedUpdate,
    balancedReuse,
    balancedMovementStart,
    balancedAverage,
    reductions: {
      recurringColorTargetPixels: 1 - balancedColorPixels / highColorPixels,
      averageDrawCalls: 1 - balancedAverage.drawCalls / high.drawCalls,
      averageSubmittedTriangles: 1 - balancedAverage.triangles / high.triangles,
      averageTargetPixels: 1 - balancedAverage.targetPixels / high.targetPixels,
    },
  }
  const receiptPath = testInfo.outputPath('render-quality-receipt.json')
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)
  await testInfo.attach('render-quality-receipt', {
    path: receiptPath,
    contentType: 'application/json',
  })
})
