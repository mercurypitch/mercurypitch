// Challenge camera browser smoke — live panel-safe framing, input lock and return.

import { expect, test, type BrowserContext, type Page } from '@playwright/test'

interface CameraMetrics {
  mode: 'exploration' | 'entering' | 'holding' | 'restoring'
  settled: boolean
  safeBottomFraction: number
  position: { x: number; y: number; z: number }
  mercFrame: { minX: number; maxX: number; minY: number; maxY: number } | null
  targetFrame: { minX: number; maxX: number; minY: number; maxY: number } | null
  combinedFrame: {
    minX: number
    maxX: number
    minY: number
    maxY: number
  } | null
  safeBottomNdc: number | null
}

declare global {
  interface Window {
    cameraVoiceTrack?: MediaStreamTrack
    cameraVoiceGain?: GainNode
  }
}

test.use({
  viewport: { width: 640, height: 480 },
  hasTouch: true,
  launchOptions: {
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
    ],
  },
})
test.setTimeout(240_000)

async function metrics(page: Page): Promise<CameraMetrics> {
  const raw = await page
    .getByTestId('glass-adventure')
    .getAttribute('data-challenge-camera')
  if (raw === null || raw === 'null') throw new Error('Missing camera metrics.')
  return JSON.parse(raw) as CameraMetrics
}

async function settledCameraMetrics(page: Page): Promise<CameraMetrics> {
  let previous = await metrics(page)
  for (let attempt = 0; attempt < 12; attempt++) {
    await page.waitForTimeout(150)
    const current = await metrics(page)
    const distance = Math.hypot(
      current.position.x - previous.position.x,
      current.position.y - previous.position.y,
      current.position.z - previous.position.z,
    )
    if (current.mode === 'exploration' && distance < 0.002) return current
    previous = current
  }
  throw new Error('Exploration camera did not settle.')
}

async function settledChallengeMetrics(page: Page): Promise<CameraMetrics> {
  await expect
    .poll(
      async () => {
        const current = await metrics(page)
        return current.mode === 'holding' && current.settled
      },
      { timeout: 30_000, intervals: [100] },
    )
    .toBe(true)
  return metrics(page)
}

async function installCameraVoice(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // This spec asserts camera metrics and input behavior. Pixel output has
    // separate compiled screenshot proofs, so skip costly SwiftShader draws.
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
    const prefix = 'beside-cue:glass-adventure:'
    localStorage.setItem(`${prefix}tutorial`, 'seen')
    localStorage.setItem(`${prefix}comfortable-note`, '57')
    localStorage.setItem(
      `${prefix}progress:glassworks`,
      JSON.stringify({
        version: 1,
        levelId: 'glassworks',
        checkpointId: 'goblet',
        completedBreakableIds: [],
      }),
    )
    navigator.mediaDevices.getUserMedia = async () => {
      const audio = new AudioContext()
      await audio.resume()
      const oscillator = audio.createOscillator()
      const gain = audio.createGain()
      gain.gain.value = 0
      oscillator.frequency.value = 220
      const destination = audio.createMediaStreamDestination()
      oscillator.connect(gain).connect(destination)
      oscillator.start()
      const track = destination.stream.getAudioTracks()[0]
      const stop = track.stop.bind(track)
      track.stop = () => {
        stop()
        oscillator.stop()
        void audio.close()
      }
      window.cameraVoiceGain = gain
      window.cameraVoiceTrack = track
      return destination.stream
    }
  })
}

async function openComfortMuseum(page: Page): Promise<void> {
  await installCameraVoice(page)
  const response = await page.goto('/glass-game/')
  expect(response?.status()).toBe(200)
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 40_000 },
  )
}

async function numericAttribute(page: Page, name: string): Promise<number> {
  const value = await page
    .getByTestId('glass-adventure')
    .getAttribute(`data-${name}`)
  if (value === null || !Number.isFinite(Number(value)))
    throw new Error(`Missing numeric adventure attribute: ${name}`)
  return Number(value)
}

function angleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

async function dragMuseumWithMouse(
  page: Page,
  pixels: number,
): Promise<number> {
  const viewport = page.getByLabel('Glass museum; drag to look around')
  const bounds = await viewport.boundingBox()
  if (bounds === null) throw new Error('Missing museum viewport.')
  const before = await numericAttribute(page, 'camera-yaw')
  const x = bounds.x + bounds.width * 0.35
  const y = bounds.y + bounds.height * 0.48
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + pixels, y, { steps: 6 })
  await page.mouse.up()
  await page.waitForTimeout(50)
  return Math.abs(
    angleDelta(before, await numericAttribute(page, 'camera-yaw')),
  )
}

async function dragMuseumWithTouch(
  page: Page,
  context: BrowserContext,
  pixels: number,
): Promise<number> {
  const viewport = page.getByLabel('Glass museum; drag to look around')
  const bounds = await viewport.boundingBox()
  if (bounds === null) throw new Error('Missing museum viewport.')
  const before = await numericAttribute(page, 'camera-yaw')
  const x = bounds.x + bounds.width * 0.45
  const y = bounds.y + bounds.height * 0.46
  const cdp = await context.newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ id: 10, x, y }],
  })
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ id: 10, x: x + pixels, y }],
  })
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })
  await page.waitForTimeout(50)
  await cdp.detach()
  return Math.abs(
    angleDelta(before, await numericAttribute(page, 'camera-yaw')),
  )
}

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.cameraVoiceTrack?.stop()).catch(() => {})
})

test('camera presets persist and scale real mouse orbit while keyboard turns stay bounded @smoke', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openComfortMuseum(page)
  const tune = page.getByRole('button', { name: 'Camera tuning' })
  await tune.click()
  let panel = page.getByRole('dialog', { name: 'Camera comfort tuning' })
  await panel.getByRole('button', { name: 'Gentle', exact: true }).click()
  await panel.getByRole('button', { name: 'Close camera tuning' }).click()
  const gentleOrbit = await dragMuseumWithMouse(page, 80)

  await page.getByRole('button', { name: 'Recenter camera' }).click()
  await tune.click()
  panel = page.getByRole('dialog', { name: 'Camera comfort tuning' })
  await panel.getByRole('button', { name: 'Responsive', exact: true }).click()
  await panel.getByRole('button', { name: 'Close camera tuning' }).click()
  const responsiveOrbit = await dragMuseumWithMouse(page, 80)
  expect(responsiveOrbit / gentleOrbit).toBeCloseTo(1.5, 1)

  await page.reload()
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 40_000 },
  )
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-look-sensitivity',
    '1.2',
  )
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-follow-smoothness',
    '0.12',
  )
  await page.getByRole('button', { name: 'Camera tuning' }).click()
  panel = page.getByRole('dialog', { name: 'Camera comfort tuning' })
  await expect(
    panel.getByRole('button', { name: 'Responsive', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await panel.getByRole('button', { name: 'Copy preset' }).click()
  await expect(panel.getByRole('button', { name: 'Copied' })).toBeVisible()
  expect(
    JSON.parse(await page.evaluate(() => navigator.clipboard.readText())),
  ).toEqual({
    cameraComfort: {
      lookSensitivity: 1.2,
      followSmoothnessSeconds: 0.12,
    },
  })
  await panel.getByRole('button', { name: 'Gentle', exact: true }).click()
  await panel.getByRole('button', { name: 'Close camera tuning' }).click()

  await page.clock.install()
  await page.keyboard.down('KeyW')
  await page.clock.runFor(400)
  await page.keyboard.up('KeyW')
  const settledYaw = await numericAttribute(page, 'merc-yaw')
  await page.keyboard.down('KeyA')
  await page.clock.runFor(50)
  const firstYaw = await numericAttribute(page, 'merc-yaw')
  const firstTurn = Math.abs(angleDelta(settledYaw, firstYaw))
  const travelYaw = await numericAttribute(page, 'travel-yaw')
  const firstError = Math.abs(angleDelta(firstYaw, travelYaw + Math.PI))
  expect(firstTurn).toBeGreaterThan(0)
  expect(firstTurn).toBeLessThan(0.16)
  await page.clock.runFor(450)
  expect(
    Math.abs(
      angleDelta(
        await numericAttribute(page, 'merc-yaw'),
        (await numericAttribute(page, 'travel-yaw')) + Math.PI,
      ),
    ),
  ).toBeLessThan(firstError)
  await page.keyboard.up('KeyA')

  await page.getByRole('button', { name: 'Camera tuning' }).click()
  panel = page.getByRole('dialog', { name: 'Camera comfort tuning' })
  await panel.getByRole('button', { name: 'Reset defaults' }).click()
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-look-sensitivity',
    '1',
  )
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-follow-smoothness',
    '0.2',
  )
})

test('phone tuner fits the viewport and real touch orbit and steering stay smooth @smoke', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openComfortMuseum(page)
  const tune = page.getByRole('button', { name: 'Camera tuning' })
  await tune.click()
  let panel = page.getByRole('dialog', { name: 'Camera comfort tuning' })
  const panelBounds = await panel.boundingBox()
  expect(panelBounds).not.toBeNull()
  expect(panelBounds!.x).toBeGreaterThanOrEqual(0)
  expect(panelBounds!.y).toBeGreaterThanOrEqual(0)
  expect(panelBounds!.x + panelBounds!.width).toBeLessThanOrEqual(390)
  expect(panelBounds!.y + panelBounds!.height).toBeLessThanOrEqual(844)
  await panel.getByRole('button', { name: 'Gentle', exact: true }).click()
  await panel.getByRole('button', { name: 'Close camera tuning' }).click()
  const gentleOrbit = await dragMuseumWithTouch(page, context, 80)

  await page.getByRole('button', { name: 'Recenter camera' }).click()
  await tune.click()
  panel = page.getByRole('dialog', { name: 'Camera comfort tuning' })
  await panel.getByRole('button', { name: 'Responsive', exact: true }).click()
  await panel.getByRole('button', { name: 'Close camera tuning' }).click()
  const responsiveOrbit = await dragMuseumWithTouch(page, context, 80)
  expect(responsiveOrbit / gentleOrbit).toBeCloseTo(1.5, 1)

  const cdp = await context.newCDPSession(page)
  const stick = await page
    .getByRole('group', { name: 'Move Merc' })
    .boundingBox()
  expect(stick).not.toBeNull()
  const centre = {
    x: stick!.x + stick!.width / 2,
    y: stick!.y + stick!.height / 2,
  }
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ id: 20, ...centre }],
  })
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ id: 20, x: centre.x, y: centre.y - 38 }],
  })
  await page.waitForTimeout(450)
  const settledYaw = await numericAttribute(page, 'merc-yaw')
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ id: 20, x: centre.x + 38, y: centre.y }],
  })
  await page.waitForTimeout(50)
  const firstYaw = await numericAttribute(page, 'merc-yaw')
  const firstTurn = Math.abs(angleDelta(settledYaw, firstYaw))
  const firstError = Math.abs(
    angleDelta(
      firstYaw,
      (await numericAttribute(page, 'travel-yaw')) + Math.PI,
    ),
  )
  expect(firstTurn).toBeGreaterThan(0)
  expect(firstTurn).toBeLessThan(0.18)
  await page.waitForTimeout(450)
  expect(
    Math.abs(
      angleDelta(
        await numericAttribute(page, 'merc-yaw'),
        (await numericAttribute(page, 'travel-yaw')) + Math.PI,
      ),
    ),
  ).toBeLessThan(firstError)
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })
  await cdp.detach()
  expect(
    await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    })),
  ).toEqual({ width: 390, height: 844 })
})

test('frames Merc and the exhibit above the phone panel and restores after cancel @smoke', async ({
  page,
}) => {
  await installCameraVoice(page)
  await page.goto('/glass-game/')
  const adventure = page.getByTestId('glass-adventure')
  await expect(adventure).toHaveAttribute('data-ready', 'true', {
    timeout: 40_000,
  })
  await expect(
    page.getByRole('button', { name: 'Sing to the glass' }),
  ).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  const movementControls = page.getByLabel('Movement controls', {
    exact: true,
  })
  await expect(movementControls).toBeVisible()
  const before = await settledCameraMetrics(page)

  await page.keyboard.press('KeyF')
  const panel = page.getByLabel('Voice challenge', { exact: true })
  await expect(panel).toHaveAttribute('data-voice-mode', 'singing', {
    timeout: 20_000,
  })
  await expect(adventure).toHaveAttribute(
    'data-challenge-camera-mode',
    'holding',
    { timeout: 30_000 },
  )
  await expect(movementControls).toBeHidden()
  const held = await settledChallengeMetrics(page)
  const panelBounds = await panel.boundingBox()
  expect(panelBounds).not.toBeNull()
  expect(held.safeBottomFraction).toBeGreaterThan(0.2)
  expect(held.mercFrame).not.toBeNull()
  expect(held.targetFrame).not.toBeNull()
  expect(held.combinedFrame!.minX).toBeGreaterThanOrEqual(-0.9)
  expect(held.combinedFrame!.maxX).toBeLessThanOrEqual(0.9)
  expect(held.combinedFrame!.minY).toBeGreaterThanOrEqual(
    (held.safeBottomNdc ?? -1) - 0.01,
  )
  expect(held.combinedFrame!.maxY).toBeLessThanOrEqual(0.88)

  const viewport = page.getByLabel('Glass museum; drag to look around')
  const viewportBounds = await viewport.boundingBox()
  if (viewportBounds === null) throw new Error('Missing museum viewport.')
  await page.mouse.move(
    viewportBounds.x + viewportBounds.width * 0.5,
    viewportBounds.y + viewportBounds.height * 0.35,
  )
  await page.mouse.down()
  await page.mouse.move(
    viewportBounds.x + viewportBounds.width * 0.8,
    viewportBounds.y + viewportBounds.height * 0.2,
    { steps: 8 },
  )
  await page.mouse.wheel(0, 500)
  await page.mouse.up()
  const afterInput = await settledChallengeMetrics(page)
  expect(afterInput.mode).toBe('holding')
  expect(afterInput.position.x).toBeCloseTo(held.position.x, 3)
  expect(afterInput.position.y).toBeCloseTo(held.position.y, 3)
  expect(afterInput.position.z).toBeCloseTo(held.position.z, 3)

  await panel.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(adventure).toHaveAttribute(
    'data-challenge-camera-mode',
    'exploration',
    { timeout: 30_000 },
  )
  const returned = await settledCameraMetrics(page)
  expect(returned.position.x).toBeCloseTo(before.position.x, 3)
  expect(returned.position.y).toBeCloseTo(before.position.y, 3)
  expect(returned.position.z).toBeCloseTo(before.position.z, 3)
  await expect(movementControls).toBeVisible()
})

test('tap entry holds the shot through the full shatter before restoring @smoke', async ({
  page,
}) => {
  await installCameraVoice(page)
  await page.goto('/glass-game/')
  const adventure = page.getByTestId('glass-adventure')
  await expect(adventure).toHaveAttribute('data-ready', 'true', {
    timeout: 40_000,
  })
  const sing = page.getByRole('button', { name: 'Sing to the glass' })
  const movementControls = page.getByLabel('Movement controls', {
    exact: true,
  })
  await expect(sing).toBeVisible()
  await expect(movementControls).toBeVisible()
  const before = await settledCameraMetrics(page)
  await sing.tap()
  const panel = page.getByLabel('Voice challenge', { exact: true })
  await expect(panel).toHaveAttribute('data-voice-mode', 'singing', {
    timeout: 20_000,
  })
  await expect(adventure).toHaveAttribute(
    'data-challenge-camera-mode',
    'holding',
    { timeout: 30_000 },
  )
  await expect(movementControls).toBeHidden()

  await page.evaluate(() => {
    const gain = window.cameraVoiceGain
    if (gain === undefined) throw new Error('Missing microphone gain.')
    gain.gain.setValueAtTime(0.1, gain.context.currentTime)
  })
  await expect(adventure).toHaveAttribute('data-completed', '1', {
    timeout: 20_000,
  })
  await expect(movementControls).toBeHidden()
  await expect(adventure).toHaveAttribute(
    'data-challenge-camera-mode',
    'holding',
  )
  await expect(adventure).toHaveAttribute(
    'data-challenge-camera-mode',
    'restoring',
    { timeout: 20_000 },
  )
  await expect(adventure).toHaveAttribute(
    'data-challenge-camera-mode',
    'exploration',
    { timeout: 90_000 },
  )
  const returned = await settledCameraMetrics(page)
  expect(returned.position.x).toBeCloseTo(before.position.x, 3)
  expect(returned.position.y).toBeCloseTo(before.position.y, 3)
  expect(returned.position.z).toBeCloseTo(before.position.z, 3)
  await expect(movementControls).toBeVisible()
})
