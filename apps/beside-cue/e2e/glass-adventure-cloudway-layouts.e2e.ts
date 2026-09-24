// Cloudway layout auditions — real browser input crosses each opening and restores its isolated checkpoint.

import { expect, test, type Page } from '@playwright/test'
import { CLOUDWAY_CURRENT_TRIAL, CLOUDWAY_LAYOUT_AUDITIONS, type CloudwayLayoutAudition, type CloudwayLayoutId, } from '../../../packages/glass-game/src/content/cloudway-layouts'

test.use({
  viewport: { width: 1024, height: 768 },
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})
test.setTimeout(180_000)

const RASTER_METHODS = [
  'clear',
  'drawArrays',
  'drawArraysInstanced',
  'drawElements',
  'drawElementsInstanced',
] as const

const LAYOUT_QUERY: Readonly<Record<CloudwayLayoutId, string>> = {
  crescent: 'cloudway-crescent',
  ribbon: 'cloudway-ribbon',
  terrace: 'cloudway-terrace',
}

async function installVisit(page: Page): Promise<void> {
  await page.addInitScript(
    ({ rasterMethods, realRendering }) => {
      if (!realRendering)
        for (const method of rasterMethods)
          Object.defineProperty(WebGL2RenderingContext.prototype, method, {
            configurable: true,
            value: () => undefined,
          })
      const prefix = 'beside-cue:glass-adventure:'
      localStorage.setItem(`${prefix}tutorial`, 'seen')
      localStorage.setItem(
        `${prefix}museum-audio:v1`,
        JSON.stringify({ muted: true }),
      )
    },
    {
      rasterMethods: RASTER_METHODS,
      realRendering: process.env.GLASS_RENDER_PROOF === '1',
    },
  )
}

async function metric(page: Page, name: string): Promise<number> {
  return Number(
    await page.getByTestId('glass-adventure').getAttribute(`data-${name}`),
  )
}

async function suspendRasterOutput(page: Page): Promise<void> {
  await page
    .getByLabel('Floating glass museum')
    .evaluate((canvas: HTMLCanvasElement, methods) => {
      const gl = canvas.getContext('webgl2')
      if (gl === null)
        throw new Error('The Cloudway WebGL2 context is missing.')
      const context = gl as WebGL2RenderingContext & {
        __cloudwayRasterMethods?: Record<
          string,
          (...args: unknown[]) => unknown
        >
      }
      context.__cloudwayRasterMethods = Object.fromEntries(
        methods.map((name) => [
          name,
          (context[name] as (...args: unknown[]) => unknown).bind(context),
        ]),
      )
      for (const name of methods)
        Object.defineProperty(context, name, {
          configurable: true,
          value: () => undefined,
        })
    }, RASTER_METHODS)
}

async function restoreRasterOutput(page: Page): Promise<void> {
  await page
    .getByLabel('Floating glass museum')
    .evaluate((canvas: HTMLCanvasElement, methods) => {
      const gl = canvas.getContext('webgl2') as
        | (WebGL2RenderingContext & {
            __cloudwayRasterMethods?: Record<
              string,
              (...args: unknown[]) => unknown
            >
          })
        | null
      if (gl?.__cloudwayRasterMethods === undefined)
        throw new Error('Cloudway raster methods were not suspended.')
      for (const name of methods)
        Object.defineProperty(gl, name, {
          configurable: true,
          value: gl.__cloudwayRasterMethods[name],
        })
      delete gl.__cloudwayRasterMethods
    }, RASTER_METHODS)
}

function shortestAngle(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

async function setHeading(page: Page, target: number): Promise<void> {
  const viewport = page.getByLabel('Glass museum; drag to look around')
  const bounds = await viewport.boundingBox()
  if (bounds === null) throw new Error('Missing Cloudway viewport.')
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await metric(page, 'camera-yaw')
    const remaining = shortestAngle(current, target)
    if (Math.abs(remaining) < 0.018) return
    const step = Math.max(-1.35, Math.min(1.35, remaining))
    const start = {
      x: bounds.x + bounds.width * 0.5,
      y: bounds.y + bounds.height * 0.42,
    }
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(start.x - step / 0.005, start.y, { steps: 4 })
    await page.mouse.up()
    await page.clock.runFor(32)
  }
  expect(
    Math.abs(shortestAngle(await metric(page, 'camera-yaw'), target)),
  ).toBeLessThan(0.03)
}

async function driveOpening(
  page: Page,
  audition: CloudwayLayoutAudition,
): Promise<void> {
  const targets = audition.route.waypoints.slice(1, 4)
  const jumpAt = [3.08, 5.33, 7.63]
  for (const [index, target] of targets.entries()) {
    const start = {
      x: await metric(page, 'player-x'),
      z: await metric(page, 'player-z'),
    }
    await setHeading(
      page,
      Math.atan2(-(target.x - start.x), -(target.z - start.z)),
    )
    let jumped = false
    let reached = false
    await page.keyboard.down('KeyW')
    try {
      for (let frame = 0; frame < 320; frame++) {
        await page.clock.runFor(32)
        const x = await metric(page, 'player-x')
        const z = await metric(page, 'player-z')
        if (!jumped && z >= jumpAt[index]!) {
          jumped = true
          await page.keyboard.down('Space')
          await page.clock.runFor(32)
          await page.keyboard.up('Space')
        }
        if (z >= target.z - 0.08 && Math.abs(x - target.x) < 0.42) {
          reached = true
          break
        }
      }
    } finally {
      await page.keyboard.up('KeyW')
      await page.keyboard.up('Space')
    }
    const final = {
      x: await metric(page, 'player-x'),
      y: await metric(page, 'player-y'),
      z: await metric(page, 'player-z'),
      checkpoint: await page
        .getByTestId('glass-adventure')
        .getAttribute('data-checkpoint'),
    }
    expect(
      reached,
      `${audition.id} should reach ${target.platformId}: ${JSON.stringify(final)}`,
    ).toBe(true)
    await page.clock.runFor(180)
  }
}

async function openAudition(
  page: Page,
  audition: CloudwayLayoutAudition,
): Promise<void> {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await installVisit(page)
  await page.clock.install()
  const response = await page.goto(
    `/glass-game/?layout=${LAYOUT_QUERY[audition.id]}`,
    { waitUntil: 'domcontentloaded' },
  )
  expect(response?.status()).toBe(200)
  try {
    await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
      'data-ready',
      'true',
      { timeout: 45_000 },
    )
  } catch (error) {
    throw new Error(`${audition.id} did not open: ${errors.join('; ')}`, {
      cause: error,
    })
  }
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-level-id',
    audition.saveId,
  )
  const skipTutorial = page.getByRole('button', { name: 'Skip tutorial' })
  if (await skipTutorial.isVisible()) await skipTutorial.click()
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 3_600_000)
}

for (const audition of Object.values(CLOUDWAY_LAYOUT_AUDITIONS)) {
  test(`${audition.id} crosses to a zero-break recovery and restores only its own save @smoke`, async ({
    page,
  }, testInfo) => {
    await openAudition(page, audition)
    const adventure = page.getByTestId('glass-adventure')
    await expect(adventure).toHaveAttribute('data-completed', '0')
    if (process.env.GLASS_RENDER_PROOF === '1')
      await page.screenshot({
        path: testInfo.outputPath(`${audition.id}-overview.png`),
      })

    if (process.env.GLASS_RENDER_PROOF === '1') await suspendRasterOutput(page)
    await driveOpening(page, audition)
    await expect(adventure).toHaveAttribute(
      'data-checkpoint',
      'cloudway-checkpoint-frost-catch',
    )
    await expect(adventure).toHaveAttribute('data-completed', '0')
    const rest = audition.route.waypoints[3]!
    expect(await metric(page, 'player-x')).toBeCloseTo(rest.x, 0)
    expect(await metric(page, 'player-z')).toBeCloseTo(rest.z, 0)
    if (process.env.GLASS_RENDER_PROOF === '1') {
      await restoreRasterOutput(page)
      await page.clock.runFor(32)
      await page.screenshot({
        path: testInfo.outputPath(`${audition.id}-recovery-close.png`),
      })
    }

    const progressKey = `beside-cue:glass-adventure:progress:${audition.saveId}`
    const stored = await page.evaluate((key) => {
      const raw = localStorage.getItem(key)
      return raw === null ? null : (JSON.parse(raw) as unknown)
    }, progressKey)
    expect(stored).toMatchObject({
      version: 2,
      levelId: audition.saveId,
      checkpointId: 'cloudway-checkpoint-frost-catch',
      completedBreakableIds: [],
      finished: false,
    })
    const otherKeys = Object.values(CLOUDWAY_LAYOUT_AUDITIONS)
      .filter((item) => item.id !== audition.id)
      .map((item) => `beside-cue:glass-adventure:progress:${item.saveId}`)
    expect(
      await page.evaluate(
        (keys) => keys.map((key) => localStorage.getItem(key)),
        otherKeys,
      ),
    ).toEqual([null, null])

    await page.clock.resume()
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(adventure).toHaveAttribute('data-ready', 'true', {
      timeout: 45_000,
    })
    await page.clock.pauseAt(
      (await page.evaluate(() => Date.now())) + 3_600_000,
    )
    await expect(adventure).toHaveAttribute(
      'data-checkpoint',
      'cloudway-checkpoint-frost-catch',
    )
    await expect(adventure).toHaveAttribute('data-completed', '0')
    expect(await metric(page, 'player-x')).toBeCloseTo(rest.x, 5)
    expect(await metric(page, 'player-z')).toBeCloseTo(rest.z, 5)
  })
}

test('the current query resolves the campaign trial under its isolated save identity', async ({
  page,
}) => {
  await installVisit(page)
  const response = await page.goto('/glass-game/?layout=cloudway-current', {
    waitUntil: 'domcontentloaded',
  })
  expect(response?.status()).toBe(200)
  const adventure = page.getByTestId('glass-adventure')
  await expect(adventure).toHaveAttribute('data-ready', 'true', {
    timeout: 45_000,
  })
  await expect(adventure).toHaveAttribute(
    'data-level-id',
    CLOUDWAY_CURRENT_TRIAL.id,
  )
  expect(CLOUDWAY_CURRENT_TRIAL.id).not.toBe(
    CLOUDWAY_LAYOUT_AUDITIONS.crescent.saveId,
  )
})

test.describe('touch route input', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })

  test('crescent accepts simultaneous stick and jump input across its first gap @smoke', async ({
    page,
    context,
  }) => {
    const audition = CLOUDWAY_LAYOUT_AUDITIONS.crescent
    await openAudition(page, audition)
    const stick = await page
      .getByRole('group', { name: 'Move Merc' })
      .boundingBox()
    const jump = await page
      .getByRole('button', { name: 'Jump', exact: true })
      .boundingBox()
    expect(stick).not.toBeNull()
    expect(jump).not.toBeNull()
    const centre = {
      x: stick!.x + stick!.width / 2,
      y: stick!.y + stick!.height / 2,
    }
    const movement = { id: 1, x: centre.x, y: centre.y - 28 }
    const jumpPoint = {
      id: 2,
      x: jump!.x + jump!.width / 2,
      y: jump!.y + jump!.height / 2,
    }
    const cdp = await context.newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ id: 1, ...centre }],
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [movement],
    })
    for (let frame = 0; frame < 160; frame++) {
      await page.clock.runFor(32)
      if ((await metric(page, 'player-z')) >= 3.08) break
    }
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [movement, jumpPoint],
    })
    await page.clock.runFor(100)
    expect(await metric(page, 'player-y')).toBeGreaterThan(0.1)
    for (let frame = 0; frame < 120; frame++) {
      await page.clock.runFor(32)
      if ((await metric(page, 'player-z')) >= 4.35) break
    }
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchCancel',
      touchPoints: [],
    })
    await cdp.detach()
    expect(await metric(page, 'player-z')).toBeGreaterThan(4.3)
    expect(await metric(page, 'player-y')).toBeGreaterThanOrEqual(0)
    await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
      'data-checkpoint',
      'cloudway-checkpoint-arrival',
    )
  })
})
