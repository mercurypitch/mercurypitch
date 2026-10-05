// Cloudway mobile flow — real touch discovers Sing and explains restored locked progress.

import { expect, test, type BrowserContext, type CDPSession, type Page, } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { CLOUDWAY_CURRENT_TRIAL } from '../../../packages/glass-game/src/content/cloudway-layouts'
import { installCloudwayVisit } from './helpers/cloudway-platform-proof'

test.use({
  hasTouch: true,
  isMobile: true,
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})
test.setTimeout(180_000)

const VIEWPORTS = [
  { label: 'phone-320', width: 320, height: 740 },
  { label: 'narrow-phone', width: 390, height: 844 },
  { label: 'phone-landscape', width: 844, height: 390 },
  { label: 'tablet', width: 768, height: 1_024 },
  { label: 'desktop', width: 1_180, height: 800 },
] as const

const preferenceKey = `beside-cue:glass-adventure:tutorial:${CLOUDWAY_CURRENT_TRIAL.id}:cloudway-first-crossing:v2`
const proofDirectory = fileURLToPath(
  new URL(
    '../../../art/glass-adventure/proofs/mobile-playability-2026-09-24/',
    import.meta.url,
  ),
)

async function prepareVisit(page: Page): Promise<void> {
  await installCloudwayVisit(page, { realRendering: false })
  await page.addInitScript(
    (key) => localStorage.setItem(key, 'seen'),
    preferenceKey,
  )
}

async function openVisit(page: Page): Promise<void> {
  const response = await page.goto('/glass-game/?layout=cloudway-current', {
    waitUntil: 'domcontentloaded',
  })
  expect(response?.status()).toBe(200)
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 60_000 },
  )
  await page.clock.install()
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 3_600_000)
}

async function beginStick(
  page: Page,
  context: BrowserContext,
): Promise<{
  cdp: CDPSession
  center: { x: number; y: number }
}> {
  const stick = await page
    .getByRole('group', { name: 'Move Merc' })
    .boundingBox()
  expect(stick).not.toBeNull()
  // Begin inside the bounded visible pad; nearby guidance and the encounter
  // action retain the rest of the screen.
  const center = {
    x: stick!.x + Math.min(60, stick!.width * 0.36),
    y: stick!.y + stick!.height - 64,
  }
  expect(
    await page.evaluate(({ x, y }) => {
      const surface = document.querySelector('[aria-label="Move Merc"]')
      const target = document.elementFromPoint(x, y)
      return target !== null && surface?.contains(target) === true
    }, center),
  ).toBe(true)
  const cdp = await context.newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ id: 1, ...center }],
  })
  await expect(page.getByTestId('floating-stick-base')).toHaveAttribute(
    'data-active',
    'true',
  )
  return { cdp, center }
}

async function moveStick(
  cdp: CDPSession,
  center: { x: number; y: number },
  offset: { x: number; y: number },
): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ id: 1, x: center.x + offset.x, y: center.y + offset.y }],
  })
}

async function releaseStick(page: Page, cdp: CDPSession): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })
  const base = page.getByTestId('floating-stick-base')
  await expect(base).toHaveAttribute('data-active', 'false')
  await expect(base).toHaveCSS('opacity', '0.62')
}

interface TouchTraceSample {
  actionVisible: boolean
  cameraYaw: number
  checkpointId: string | undefined
  notice: string
  x: number
  y: number
  z: number
}

async function touchSample(page: Page): Promise<TouchTraceSample> {
  return page.getByTestId('glass-adventure').evaluate((adventure) => ({
    actionVisible:
      document.querySelector('[data-testid="glass-sing-action"]') !== null,
    cameraYaw: Number(adventure.dataset.cameraYaw),
    checkpointId: adventure.dataset.checkpoint,
    notice:
      document.querySelector('[data-testid="glass-notice"]')?.textContent ?? '',
    x: Number(adventure.dataset.playerX),
    y: Number(adventure.dataset.playerY),
    z: Number(adventure.dataset.playerZ),
  }))
}

async function driveStickUntilAction(
  page: Page,
  cdp: CDPSession,
  center: { x: number; y: number },
  target: { x: number; z: number },
  actionVisible: boolean,
  movementYaw: number,
): Promise<TouchTraceSample[]> {
  const trace: TouchTraceSample[] = []
  for (let frame = 0; frame < 100; frame++) {
    const before = await touchSample(page)
    trace.push(before)
    if (before.actionVisible === actionVisible) return trace
    const deltaX = target.x - before.x
    const deltaZ = target.z - before.z
    const distance = Math.hypot(deltaX, deltaZ)
    if (distance < 0.04) break
    const worldX = deltaX / distance
    const worldZ = deltaZ / distance
    await moveStick(cdp, center, {
      x: 44 * (worldX * Math.cos(movementYaw) - worldZ * Math.sin(movementYaw)),
      y: 44 * (worldX * Math.sin(movementYaw) + worldZ * Math.cos(movementYaw)),
    })
    await page.clock.runFor(32)
  }
  const final = await touchSample(page)
  trace.push(final)
  throw new Error(
    `Touch never made the Sing action ${actionVisible ? 'visible' : 'hidden'} with basis ${movementYaw}: ${JSON.stringify(trace)}`,
  )
}

async function driveFreshTouchUntilAction(
  page: Page,
  context: BrowserContext,
  target: { x: number; z: number },
  actionVisible: boolean,
): Promise<{
  cdp: CDPSession
  trace: TouchTraceSample[]
}> {
  // Ended contacts reset the movement reference to the visible camera.
  await page.clock.runFor(32)
  const { cdp, center } = await beginStick(page, context)
  const movementYaw = (await touchSample(page)).cameraYaw
  try {
    return {
      cdp,
      trace: await driveStickUntilAction(
        page,
        cdp,
        center,
        target,
        actionVisible,
        movementYaw,
      ),
    }
  } catch (error) {
    await releaseStick(page, cdp)
    await page.clock.runFor(32)
    throw error
  }
}

async function driveFixedTouchUntilAction(
  page: Page,
  context: BrowserContext,
  offset: { x: number; y: number },
  actionVisible: boolean,
): Promise<TouchTraceSample[]> {
  // Include travel in the first simulated frame, before the action changes.
  const trace: TouchTraceSample[] = [await touchSample(page)]
  const { cdp, center } = await beginStick(page, context)
  try {
    await moveStick(cdp, center, offset)
    for (let frame = 0; frame < 60; frame++) {
      await page.clock.runFor(32)
      const sample = await touchSample(page)
      trace.push(sample)
      if (sample.actionVisible === actionVisible) return trace
    }
  } finally {
    await releaseStick(page, cdp)
    await page.clock.runFor(32)
  }
  throw new Error(
    `Fixed touch never made the Sing action ${actionVisible ? 'visible' : 'hidden'}: ${JSON.stringify(trace)}`,
  )
}

for (const viewport of VIEWPORTS) {
  test(`touch discovers and starts the first Sing action at ${viewport.label} @smoke`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize(viewport)
    await prepareVisit(page)
    await openVisit(page)

    const sing = page.getByRole('button', { name: /Sing to the glass/ })
    await expect(sing).toBeVisible()
    const awayTrace = await driveFixedTouchUntilAction(
      page,
      context,
      { x: 0, y: 44 },
      false,
    )
    await expect(sing).toHaveCount(0)
    await expect(page.getByTestId('glass-progress-guidance')).toContainText(
      'Follow its glowing circle, then tap Sing.',
    )

    const returnTouch = await driveFreshTouchUntilAction(
      page,
      context,
      { x: 0.3, z: 1.75 },
      true,
    )
    await expect(sing).toBeVisible()
    for (const trace of [awayTrace, returnTouch.trace]) {
      const first = trace[0]!
      const last = trace.at(-1)!
      expect(Math.hypot(last.x - first.x, last.z - first.z)).toBeGreaterThan(
        0.08,
      )
    }
    const touchTrace = [...awayTrace, ...returnTouch.trace]
    expect(touchTrace.every((sample) => sample.y >= -0.01)).toBe(true)
    expect(
      touchTrace.every(
        (sample) => sample.checkpointId === 'cloudway-checkpoint-arrival',
      ),
    ).toBe(true)
    expect(
      touchTrace.some((sample) =>
        sample.notice.includes('Back on solid ground'),
      ),
    ).toBe(false)

    const geometry = await page.evaluate(() => {
      const sing = document.querySelector<HTMLButtonElement>(
        '[data-testid="glass-sing-action"]',
      )
      const movementPad = document.querySelector<HTMLElement>(
        '[role="group"][aria-label="Move Merc"]',
      )
      const jump = document.querySelector<HTMLButtonElement>(
        'button[aria-label="Jump"]',
      )
      const action = sing?.getBoundingClientRect()
      const movementPadBox = movementPad?.getBoundingClientRect()
      const jumpBox = jump?.getBoundingClientRect()
      const counter = document.querySelector<HTMLElement>(
        '[aria-label$="main exhibits opened"] > span:first-child',
      )
      const counterRange = document.createRange()
      if (counter !== null) counterRange.selectNodeContents(counter)
      const overlaps = (left?: DOMRect, right?: DOMRect) =>
        left !== undefined &&
        right !== undefined &&
        left.left < right.right &&
        left.right > right.left &&
        left.top < right.bottom &&
        left.bottom > right.top
      return {
        action:
          action === undefined
            ? null
            : {
                left: action.left,
                right: action.right,
                top: action.top,
                bottom: action.bottom,
                height: action.height,
              },
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        visibleKeyboardHints: [...document.querySelectorAll('kbd')].filter(
          (hint) => hint.getClientRects().length > 0,
        ).length,
        counterLines:
          counter === null
            ? 0
            : new Set(
                [...counterRange.getClientRects()].map((rect) =>
                  Math.round(rect.top),
                ),
              ).size,
        movementPad:
          movementPadBox === undefined
            ? null
            : {
                left: movementPadBox.left,
                right: movementPadBox.right,
                top: movementPadBox.top,
                bottom: movementPadBox.bottom,
              },
        overlapsMovementPad: overlaps(action, movementPadBox),
        overlapsJump: overlaps(action, jumpBox),
      }
    })
    expect(geometry.action).not.toBeNull()
    expect(geometry.action!.height).toBeGreaterThanOrEqual(44)
    expect(geometry.action!.left).toBeGreaterThanOrEqual(0)
    expect(geometry.action!.right).toBeLessThanOrEqual(viewport.width)
    expect(geometry.action!.top).toBeGreaterThanOrEqual(0)
    expect(geometry.action!.bottom).toBeLessThanOrEqual(viewport.height)
    expect(geometry.overflow).toBeLessThanOrEqual(0)
    expect(geometry.visibleKeyboardHints).toBe(0)
    expect(geometry.counterLines).toBe(1)
    expect(geometry.movementPad).not.toBeNull()
    expect(
      geometry.overlapsMovementPad,
      `Sing and movement-pad geometry: ${JSON.stringify(geometry)}`,
    ).toBe(false)
    expect(geometry.overlapsJump).toBe(false)

    await releaseStick(page, returnTouch.cdp)
    await page.clock.runFor(32)

    if (process.env.GLASS_MOBILE_FLOW_PROOF === '1')
      await page.screenshot({
        path: `${proofDirectory}sing-${viewport.label}.png`,
      })

    const button = await sing.boundingBox()
    expect(button).not.toBeNull()
    await page.touchscreen.tap(
      button!.x + button!.width / 2,
      button!.y + button!.height / 2,
    )
    await expect(
      page.getByRole('region', { name: 'Voice challenge' }),
    ).toBeVisible()
  })
}

test('a zero-break finale restore explains the locked portrait and blocks touch traversal @smoke', async ({
  page,
  context,
}) => {
  await page.setViewportSize(VIEWPORTS[0])
  await prepareVisit(page)
  await page.addInitScript(
    ({ key, progress }) => localStorage.setItem(key, JSON.stringify(progress)),
    {
      key: `beside-cue:glass-adventure:progress:${CLOUDWAY_CURRENT_TRIAL.id}`,
      progress: {
        version: 2,
        levelId: CLOUDWAY_CURRENT_TRIAL.id,
        checkpointId: 'cloudway-checkpoint-finale',
        completedBreakableIds: [],
        finished: false,
      },
    },
  )
  await openVisit(page)

  const guidance = page.getByTestId('glass-progress-guidance')
  await expect(guidance).toHaveAttribute('data-guidance-kind', 'locked')
  await expect(guidance).toContainText('The cloudway portrait is still sealed.')
  await expect(guidance).toContainText('Sing to the ribbon goblet first.')
  await expect(
    page.getByRole('button', { name: /Sing to the glass/ }),
  ).toHaveCount(0)

  const { cdp, center } = await beginStick(page, context)
  try {
    await moveStick(cdp, center, { x: 0, y: -44 })
    await page.clock.runFor(1_400)
  } finally {
    await releaseStick(page, cdp)
  }
  const z = Number(
    await page.getByTestId('glass-adventure').getAttribute('data-player-z'),
  )
  expect(z).toBeLessThan(30.75)
  await expect(guidance).toHaveAttribute('data-guidance-kind', 'locked')
})

test('B-side list opens the Promenade without a developer URL and returns @smoke', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('beside-cue:glass-adventure:tutorial', 'seen')
  })
  await page.goto('/?devSeed')
  await page.getByRole('button', { name: /B-side games/u }).tap()
  const entry = page.getByRole('button', { name: /Crystal Promenade/u })
  await expect(entry).toBeVisible()
  const bounds = await entry.boundingBox()
  expect(bounds).not.toBeNull()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390)
  await entry.tap()
  const game = page.getByTestId('glass-adventure')
  await expect(game).toHaveAttribute(
    'data-level-id',
    'cloudway-crystal-promenade-first-slice',
  )
  await expect(game).toHaveAttribute('data-ready', 'true', { timeout: 90_000 })
  await expect(page.locator('.games-stage canvas')).toHaveCount(1)
  const leave = page.getByRole('button', { name: 'Leave museum', exact: true })
  await expect(leave).toBeVisible()
  const leaveBounds = await leave.boundingBox()
  expect(leaveBounds).not.toBeNull()
  const tapPoint = {
    x: leaveBounds!.x + leaveBounds!.width / 2,
    y: leaveBounds!.y + leaveBounds!.height / 2,
  }
  expect(
    await leave.evaluate(
      (element, point) =>
        element.contains(document.elementFromPoint(point.x, point.y)),
      tapPoint,
    ),
  ).toBe(true)
  await page.touchscreen.tap(tapPoint.x, tapPoint.y)
  await expect(entry).toBeVisible()
  await expect(game).toHaveCount(0)
})
