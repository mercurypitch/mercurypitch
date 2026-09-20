// Enclosed museum acceptance — loaded art, real controls and saved gate traversal.

import { expect, test, type Page } from '@playwright/test'

test.use({
  viewport: { width: 640, height: 480 },
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})
test.setTimeout(240_000)

async function metric(page: Page, name: string): Promise<number> {
  return Number(
    await page.getByTestId('glass-adventure').getAttribute(`data-${name}`),
  )
}

async function ready(page: Page): Promise<void> {
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 60_000 },
  )
}

async function pauseClock(page: Page): Promise<void> {
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 3_600_000)
}

/** Keep the real initialized frame; traversal still runs real animation frames. */
async function suspendDrawing(page: Page): Promise<void> {
  await page
    .getByLabel('Floating glass museum')
    .evaluate((canvas: HTMLCanvasElement) => {
      const gl = canvas.getContext('webgl2')
      if (gl === null) throw new Error('A real WebGL scene is required')
      for (const method of [
        'clear',
        'drawArrays',
        'drawArraysInstanced',
        'drawElements',
        'drawElementsInstanced',
      ]) {
        Object.defineProperty(gl, method, {
          configurable: true,
          value: () => undefined,
        })
      }
    })
}

/** Orient through the public mouse gesture; reduced motion holds this view during travel. */
async function faceNorth(page: Page): Promise<void> {
  const bounds = await page
    .getByLabel('Glass museum; drag to look around')
    .boundingBox()
  expect(bounds).not.toBeNull()
  for (let attempt = 0; attempt < 4; attempt++) {
    const yaw = await metric(page, 'camera-yaw')
    const error = Math.atan2(Math.sin(Math.PI - yaw), Math.cos(Math.PI - yaw))
    if (Math.abs(error) < 0.015) return
    const step = Math.max(-1.2, Math.min(1.2, error))
    const x = bounds!.x + bounds!.width / 2
    const y = bounds!.y + bounds!.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x - step / 0.005, y, { steps: 4 })
    await page.mouse.up()
    await page.clock.runFor(32)
  }
  const yaw = await metric(page, 'camera-yaw')
  expect(
    Math.abs(Math.atan2(Math.sin(Math.PI - yaw), Math.cos(Math.PI - yaw))),
  ).toBeLessThan(0.02)
}

async function walk(
  page: Page,
  axis: 'x' | 'z',
  target: number,
): Promise<void> {
  await faceNorth(page)
  const start = await metric(page, `player-${axis}`)
  const direction = Math.sign(target - start)
  if (Math.abs(target - start) < 0.06) return
  const key =
    axis === 'x'
      ? direction > 0
        ? 'KeyA'
        : 'KeyD'
      : direction > 0
        ? 'KeyW'
        : 'KeyS'
  await page.keyboard.down(key)
  let reached = false
  try {
    // The longest leg is 12m; Merc's accepted walking speed is 1.15m/s.
    // Allow acceleration and observation margin within a bounded 19.2s.
    for (let frame = 0; frame < 600; frame++) {
      await page.clock.runFor(32)
      // Every join in the required route is level and continuously supported.
      expect(await metric(page, 'player-y')).toBeGreaterThanOrEqual(-0.015)
      if (
        direction * ((await metric(page, `player-${axis}`)) - target) >=
        -0.025
      ) {
        reached = true
        break
      }
    }
  } finally {
    await page.keyboard.up(key)
  }
  await page.clock.runFor(180)
  const endedAt = {
    x: await metric(page, 'player-x'),
    z: await metric(page, 'player-z'),
    yaw: await metric(page, 'camera-yaw'),
  }
  expect(
    reached,
    `Reach ${axis}=${String(target)} without a jump or respawn; ended ${JSON.stringify(endedAt)}`,
  ).toBe(true)
}

const LEVEL_ID = 'glassworks-chamber/chamber'
const PROGRESS_KEY = `beside-cue:glass-adventure:progress:${LEVEL_ID}`
const FIRST = `${LEVEL_ID}/chamber/encounter/threshold-goblet`
const SECOND = `${LEVEL_ID}/reveal/encounter/passage-decanter`

async function restoreProgress(
  page: Page,
  completed: string[],
  checkpoint: string,
): Promise<void> {
  await page.evaluate(
    ({ key, levelId, completed, checkpoint }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          levelId,
          checkpointId: `${levelId}/${checkpoint}`,
          completedBreakableIds: completed,
          finished: false,
        }),
      )
    },
    { key: PROGRESS_KEY, levelId: LEVEL_ID, completed, checkpoint },
  )
  await page.clock.resume()
  await page.reload({ waitUntil: 'domcontentloaded' })
  await ready(page)
  await pauseClock(page)
  await suspendDrawing(page)
}

test('the enclosed route loads its art, respects both gates and crosses every seam without jumping @smoke', async ({
  page,
}) => {
  const errors: string[] = []
  const loaded = new Set<string>()
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('response', (response) => {
    if (response.ok() && response.url().includes('/games/adventure-v4/'))
      loaded.add(new URL(response.url()).pathname)
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    localStorage.setItem('beside-cue:glass-adventure:tutorial', 'seen')
    localStorage.setItem(
      'beside-cue:glass-adventure:museum-audio:v1',
      JSON.stringify({ muted: true }),
    )
  })
  await page.clock.install()
  expect(
    (
      await page.goto('/glass-game/?layout=chamber', {
        waitUntil: 'domcontentloaded',
      })
    )?.status(),
  ).toBe(200)
  await ready(page)
  expect([...loaded].sort()).toEqual([
    '/games/adventure-v4/museum-screen-bay.glb',
    '/games/adventure-v4/museum-window-bay.glb',
  ])
  const originalSave = JSON.stringify({
    version: 1,
    levelId: 'glassworks',
    checkpointId: 'goblet',
    completedBreakableIds: [],
    finished: false,
  })
  await page.evaluate(
    (save) =>
      localStorage.setItem(
        'beside-cue:glass-adventure:progress:glassworks',
        save,
      ),
    originalSave,
  )
  await pauseClock(page)
  await suspendDrawing(page)
  await walk(page, 'z', 0)
  await faceNorth(page)
  await page.keyboard.down('KeyA')
  await page.clock.runFor(3500)
  await page.keyboard.up('KeyA')
  await page.clock.runFor(180)
  expect(await metric(page, 'player-x')).toBeGreaterThan(3.8)
  expect(await metric(page, 'player-x')).toBeLessThan(4.3)

  // Restoration uses the same public save contract as a previously earned
  // hold; the pure content tests exercise earning both holds with pitch input.
  await restoreProgress(page, [FIRST], 'chamber/checkpoint/arrival')
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-completed',
    '1',
  )
  await walk(page, 'z', 0)
  await walk(page, 'x', 12.096)
  await walk(page, 'z', 6.6)
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-checkpoint',
    `${LEVEL_ID}/reveal/checkpoint/entry`,
  )
  await page.keyboard.down('KeyW')
  await page.clock.runFor(1600)
  await page.keyboard.up('KeyW')
  await page.clock.runFor(180)
  expect(await metric(page, 'player-z')).toBeGreaterThan(7)
  expect(await metric(page, 'player-z')).toBeLessThan(7.5)
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await restoreProgress(page, [FIRST, SECOND], 'reveal/checkpoint/entry')
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-completed',
    '2',
  )
  await walk(page, 'z', 12.1)
  await page.keyboard.down('KeyW')
  await page.clock.runFor(1000)
  await page.keyboard.up('KeyW')
  await expect(page.getByRole('dialog')).toBeVisible()
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? 'null') as unknown,
    PROGRESS_KEY,
  )
  expect(saved).toMatchObject({
    finished: true,
    completedBreakableIds: [FIRST, SECOND],
  })
  expect(
    await page.evaluate(() =>
      localStorage.getItem('beside-cue:glass-adventure:progress:glassworks'),
    ),
  ).toBe(originalSave)
  expect(errors).toEqual([])
})
