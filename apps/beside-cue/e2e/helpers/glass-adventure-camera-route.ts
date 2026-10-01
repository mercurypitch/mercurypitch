// Journey camera route probes — physical traversal, rendered turn timing and lifecycle cleanup.

import { expect, type BrowserContext, type Page } from '@playwright/test'
import { observeReleasedArrowQuietWindow, waitForCameraAngle, waitForJourneyCornerStop, } from './glass-adventure-camera-observation'

export interface PlayerPosition {
  x: number
  y: number
  z: number
}

interface MercTurnSample {
  at: number
  yaw: number
}

interface MercTurnWindow {
  start: MercTurnSample
  end: MercTurnSample
}

interface MercTurnProbeWindow extends Window {
  cameraMercTurnProbe?: {
    ready: boolean
    receipt: MercTurnWindow | null
    error: string | null
    stop: () => void
  }
}

export async function measureDeliveredMercTurn(
  page: Page,
  deliverTouchTurn: () => Promise<unknown>,
): Promise<MercTurnWindow> {
  await page.evaluate(() => {
    const state = window as MercTurnProbeWindow
    state.cameraMercTurnProbe?.stop()
    let frameId = 0
    let previousFrame: number | null = null
    let delivered = false
    let start: MercTurnSample | null = null
    const probe = {
      ready: false,
      receipt: null as MercTurnWindow | null,
      error: null as string | null,
      stop: () => {
        cancelAnimationFrame(frameId)
        document.removeEventListener('pointermove', receiveTurn, true)
      },
    }
    state.cameraMercTurnProbe = probe
    function receiveTurn(event: PointerEvent): void {
      if (
        !event.isTrusted ||
        event.pointerType !== 'touch' ||
        !(event.target instanceof Element) ||
        event.target.closest('[aria-label="Move Merc"]') === null
      )
        return
      delivered = true
      document.removeEventListener('pointermove', receiveTurn, true)
    }
    const sample = (timestamp: number) => {
      if (previousFrame !== null) {
        const rawYaw = document
          .querySelector('[data-testid="glass-adventure"]')
          ?.getAttribute('data-merc-yaw')
        if (rawYaw == null || !Number.isFinite(Number(rawYaw))) {
          probe.error = 'Missing rendered Merc yaw.'
          probe.stop()
          return
        }
        // This observer follows the game RAF. refresh() publishes Merc's
        // existing yaw before render() advances him, so this DOM sample
        // belongs to the preceding render timestamp, not the event/current RAF.
        const current = { at: previousFrame, yaw: Number(rawYaw) }
        probe.ready = true
        if (delivered) {
          start ??= current
          if (current.at - start.at >= 50) {
            probe.receipt = { start, end: current }
            probe.stop()
            return
          }
        }
      }
      previousFrame = timestamp
      frameId = requestAnimationFrame(sample)
    }
    document.addEventListener('pointermove', receiveTurn, true)
    frameId = requestAnimationFrame(sample)
  })
  const status = () =>
    page.evaluate(() => {
      const probe = (window as MercTurnProbeWindow).cameraMercTurnProbe
      if (probe === undefined || probe.error !== null)
        throw new Error(probe?.error ?? 'Missing Merc turn observer.')
      return { ready: probe.ready, receipt: probe.receipt }
    })
  try {
    await expect
      .poll(async () => (await status()).ready, { timeout: 5_000 })
      .toBe(true)
    await deliverTouchTurn()
    await expect
      .poll(async () => (await status()).receipt !== null, { timeout: 5_000 })
      .toBe(true)
    const receipt = (await status()).receipt
    if (receipt === null) throw new Error('Missing Merc turn frame window.')
    return receipt
  } finally {
    await page.evaluate(() => {
      const state = window as MercTurnProbeWindow
      state.cameraMercTurnProbe?.stop()
      delete state.cameraMercTurnProbe
    })
  }
}

export async function numericAdventureAttribute(
  page: Page,
  name: string,
): Promise<number> {
  const value = await page
    .getByTestId('glass-adventure')
    .getAttribute(`data-${name}`)
  if (value === null || !Number.isFinite(Number(value)))
    throw new Error(`Missing numeric adventure attribute: ${name}`)
  return Number(value)
}

export async function adventurePlayerPosition(
  page: Page,
): Promise<PlayerPosition> {
  return {
    x: await numericAdventureAttribute(page, 'player-x'),
    y: await numericAdventureAttribute(page, 'player-y'),
    z: await numericAdventureAttribute(page, 'player-z'),
  }
}

export function cameraAngleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

async function pointCameraAt(page: Page, targetYaw: number): Promise<void> {
  const initialDelta = cameraAngleDelta(
    await numericAdventureAttribute(page, 'camera-yaw'),
    targetYaw,
  )
  if (Math.abs(initialDelta) < 0.08) return
  const key = initialDelta > 0 ? 'ArrowRight' : 'ArrowLeft'
  await page.keyboard.down(key)
  try {
    await expect
      .poll(
        async () =>
          Math.abs(
            cameraAngleDelta(
              await numericAdventureAttribute(page, 'camera-yaw'),
              targetYaw,
            ),
          ),
        { timeout: 4_000, intervals: [16] },
      )
      .toBeLessThan(0.08)
  } finally {
    await page.keyboard.up(key)
  }
}

export async function traverseJourneyPassageAndCorner(
  page: Page,
): Promise<void> {
  const start = await adventurePlayerPosition(page)
  const north = Math.PI

  // Step around the central decanter, then return to the route spine before
  // crossing the garden's visible north threshold.
  await pointCameraAt(page, north)
  await page.keyboard.down('KeyD')
  try {
    await expect
      .poll(
        async () =>
          start.x - (await numericAdventureAttribute(page, 'player-x')),
        { timeout: 4_000, intervals: [16] },
      )
      .toBeGreaterThan(1.25)
  } finally {
    await page.keyboard.up('KeyD')
  }

  await pointCameraAt(page, north)
  await page.keyboard.down('KeyW')
  try {
    await expect
      .poll(
        async () =>
          (await numericAdventureAttribute(page, 'player-z')) - start.z,
        { timeout: 5_000, intervals: [16] },
      )
      .toBeGreaterThan(5.3)
  } finally {
    await page.keyboard.up('KeyW')
  }

  await pointCameraAt(page, north)
  await page.keyboard.down('KeyA')
  try {
    await expect
      .poll(async () => await numericAdventureAttribute(page, 'player-x'), {
        timeout: 4_000,
        intervals: [16],
      })
      .toBeGreaterThan(start.x - 0.2)
  } finally {
    await page.keyboard.up('KeyA')
  }

  await pointCameraAt(page, north)
  await page.keyboard.down('KeyW')
  try {
    await expect
      .poll(
        async () =>
          (await numericAdventureAttribute(page, 'player-z')) - start.z,
        { timeout: 6_000, intervals: [16] },
      )
      .toBeGreaterThan(13.35)
  } finally {
    await page.keyboard.up('KeyW')
  }
  const beyondGardenThreshold = await adventurePlayerPosition(page)
  expect(beyondGardenThreshold.z - start.z).toBeGreaterThan(13.35)

  // At the authored right turn, W+A initially asks for the diagonal. The
  // north wall redirects Merc east, so the follow camera must settle on the
  // stable effective route heading without feeding that yaw back into WASD.
  await pointCameraAt(page, north)
  await page.keyboard.down('KeyW')
  await page.keyboard.down('KeyA')
  try {
    await page.waitForTimeout(50)
    const chordHeading = await numericAdventureAttribute(page, 'travel-yaw')
    await expect
      .poll(
        async () =>
          (await numericAdventureAttribute(page, 'player-x')) - start.x,
        { timeout: 7_000, intervals: [16] },
      )
      .toBeGreaterThan(7)
    await expect
      .poll(
        async () =>
          Math.abs(
            cameraAngleDelta(
              await numericAdventureAttribute(page, 'camera-yaw'),
              (await numericAdventureAttribute(page, 'merc-yaw')) + Math.PI,
            ),
          ),
        { timeout: 6_000 },
      )
      .toBeLessThan(0.16)
    expect(
      Math.abs(
        cameraAngleDelta(
          await numericAdventureAttribute(page, 'camera-yaw'),
          chordHeading,
        ),
      ),
    ).toBeGreaterThan(0.3)
  } finally {
    await page.keyboard.up('KeyA')
    await page.keyboard.up('KeyW')
  }

  const afterCorner = await adventurePlayerPosition(page)
  expect(afterCorner.x - start.x).toBeGreaterThan(7)
  expect(afterCorner.z - start.z).toBeGreaterThan(15.5)
  expect(afterCorner.z).toBeLessThan(25.9)
  expect(
    Math.abs(
      cameraAngleDelta(
        await numericAdventureAttribute(page, 'camera-yaw'),
        (await numericAdventureAttribute(page, 'merc-yaw')) + Math.PI,
      ),
    ),
  ).toBeLessThan(0.16)
}

export async function verifyBlockedJourneyCameraReacquisition(
  page: Page,
): Promise<void> {
  const initialYaw = await numericAdventureAttribute(page, 'camera-yaw')
  const initialPosition = await adventurePlayerPosition(page)

  await page.keyboard.down('ArrowRight')
  try {
    await waitForCameraAngle(page, initialYaw, 'above', 0.2, 5_000)
  } finally {
    await page.keyboard.up('ArrowRight')
  }
  expect(
    Math.abs(
      cameraAngleDelta(
        initialYaw,
        await numericAdventureAttribute(page, 'camera-yaw'),
      ),
    ),
  ).toBeGreaterThan(0.2)
  expect(
    Math.hypot(
      (await numericAdventureAttribute(page, 'player-x')) - initialPosition.x,
      (await numericAdventureAttribute(page, 'player-z')) - initialPosition.z,
    ),
  ).toBeLessThan(0.02)

  await page.getByRole('button', { name: 'Recenter camera' }).click()
  await page.waitForTimeout(50)
  await page.keyboard.down('KeyW')
  await page.keyboard.down('KeyD')
  try {
    await waitForCameraAngle(page, initialYaw, 'above', 0.35, 5_000)
    await expect
      .poll(
        async () =>
          initialPosition.x -
          (await numericAdventureAttribute(page, 'player-x')),
        { timeout: 7_000 },
      )
      .toBeGreaterThan(2.5)
    await expect
      .poll(
        async () =>
          (await numericAdventureAttribute(page, 'player-z')) -
          initialPosition.z,
        { timeout: 7_000 },
      )
      .toBeGreaterThan(3)
    await waitForJourneyCornerStop(page)
    await waitForCameraAngle(page, 'behind-merc', 'below', 0.16, 7_000)

    await page.keyboard.down('ArrowRight')
    try {
      await waitForCameraAngle(page, 'behind-merc', 'above', 3, 8_000)
      await observeReleasedArrowQuietWindow(page, () =>
        page.keyboard.up('ArrowRight'),
      )
    } finally {
      await page.keyboard.up('ArrowRight')
    }
    await waitForCameraAngle(page, 'behind-merc', 'below', 0.16, 6_000)
  } finally {
    await page.keyboard.up('KeyD')
    await page.keyboard.up('KeyW')
  }
}

export async function verifyHeldJourneyTouchContinuity(
  page: Page,
  context: BrowserContext,
): Promise<void> {
  const start = await adventurePlayerPosition(page)
  await pointCameraAt(page, await numericAdventureAttribute(page, 'merc-yaw'))
  await page.waitForTimeout(650)
  await page.evaluate(() => {
    const original = document.querySelector<HTMLElement>(
      '[aria-label="Move Merc"]',
    )!
    const continuity = {
      original,
      pointerId: null as number | null,
      removed: false,
      lostCapture: false,
      offerVisible: false,
      sawOfferWhileHeld: false,
      sawOfferExitWhileHeld: false,
      cleanup: (): void => undefined,
    }
    ;(
      window as typeof window & { journeyTouchContinuity?: typeof continuity }
    ).journeyTouchContinuity = continuity
    const recordOffer = (): void => {
      const visible =
        document.querySelector('[data-testid="glass-sing-action"]') !== null
      if (continuity.pointerId !== null) {
        if (visible) continuity.sawOfferWhileHeld = true
        if (continuity.offerVisible && !visible)
          continuity.sawOfferExitWhileHeld = true
      }
      continuity.offerVisible = visible
    }
    const observer = new MutationObserver((mutations) => {
      const containsOriginal = (node: Node): boolean =>
        node === original ||
        (node instanceof Element && node.contains(original))
      if (
        mutations.some(
          (mutation) =>
            mutation.type === 'childList' &&
            [...mutation.removedNodes].some(containsOriginal),
        )
      )
        continuity.removed = true
      recordOffer()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    const receivePointer = (event: PointerEvent): void => {
      continuity.pointerId = event.pointerId
      recordOffer()
    }
    const loseCapture = (): void => {
      continuity.lostCapture = true
    }
    original.addEventListener('pointerdown', receivePointer)
    original.addEventListener('lostpointercapture', loseCapture)
    continuity.cleanup = () => {
      observer.disconnect()
      original.removeEventListener('pointerdown', receivePointer)
      original.removeEventListener('lostpointercapture', loseCapture)
    }
  })

  const cdp = await context.newCDPSession(page)
  const stick = await page
    .getByRole('group', { name: 'Move Merc' })
    .boundingBox()
  expect(stick).not.toBeNull()
  const origin = {
    x: stick!.x + Math.min(60, stick!.width * 0.36),
    y: stick!.y + stick!.height - 64,
  }
  try {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ id: 20, ...origin }],
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ id: 20, x: origin.x - 38, y: origin.y }],
    })
    await expect
      .poll(
        async () =>
          start.x - (await numericAdventureAttribute(page, 'player-x')),
        { timeout: 8_000, intervals: [16] },
      )
      .toBeGreaterThan(1.25)

    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ id: 20, x: origin.x, y: origin.y + 38 }],
    })
    await expect
      .poll(
        async () =>
          (await numericAdventureAttribute(page, 'player-z')) - start.z,
        { timeout: 12_000, intervals: [16] },
      )
      .toBeGreaterThan(5.3)
    await page.waitForTimeout(300)
    expect(
      await page.evaluate(() => {
        const continuity = (
          window as typeof window & {
            journeyTouchContinuity?: {
              original: HTMLElement
              pointerId: number | null
              removed: boolean
              lostCapture: boolean
              sawOfferWhileHeld: boolean
              sawOfferExitWhileHeld: boolean
            }
          }
        ).journeyTouchContinuity!
        return {
          removed: continuity.removed,
          lostCapture: continuity.lostCapture,
          currentIsOriginal:
            document.querySelector('[aria-label="Move Merc"]') ===
            continuity.original,
          captured:
            continuity.pointerId !== null &&
            continuity.original.hasPointerCapture(continuity.pointerId),
        }
      }),
    ).toEqual({
      removed: false,
      lostCapture: false,
      currentIsOriginal: true,
      captured: true,
    })

    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ id: 20, x: origin.x + 38, y: origin.y }],
    })
    await expect(page.getByTestId('floating-stick-knob')).toHaveCSS(
      'transform',
      'matrix(1, 0, 0, 1, 38, 0)',
    )
    await expect
      .poll(async () => await numericAdventureAttribute(page, 'player-x'), {
        timeout: 8_000,
        intervals: [16],
      })
      .toBeGreaterThan(start.x - 0.2)
    expect(
      await page.evaluate(() => {
        const continuity = (
          window as typeof window & {
            journeyTouchContinuity?: {
              sawOfferWhileHeld: boolean
              sawOfferExitWhileHeld: boolean
            }
          }
        ).journeyTouchContinuity!
        return {
          sawOfferWhileHeld: continuity.sawOfferWhileHeld,
          sawOfferExitWhileHeld: continuity.sawOfferExitWhileHeld,
        }
      }),
    ).toEqual({ sawOfferWhileHeld: true, sawOfferExitWhileHeld: true })
  } finally {
    try {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      })
    } finally {
      try {
        await page.evaluate(() => {
          ;(
            window as typeof window & {
              journeyTouchContinuity?: { cleanup: () => void }
            }
          ).journeyTouchContinuity?.cleanup()
        })
      } finally {
        await cdp.detach()
      }
    }
  }
  await expect(page.getByTestId('floating-stick-base')).toHaveAttribute(
    'data-active',
    'false',
  )
}

export async function verifyHeldArrowLifecycleCleanup(
  page: Page,
): Promise<void> {
  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(200)
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  const blurReleasedYaw = await numericAdventureAttribute(page, 'camera-yaw')
  await page.waitForTimeout(250)
  expect(
    Math.abs(
      cameraAngleDelta(
        blurReleasedYaw,
        await numericAdventureAttribute(page, 'camera-yaw'),
      ),
    ),
  ).toBeLessThan(0.02)
  await page.keyboard.up('ArrowRight')

  await page.keyboard.down('ArrowLeft')
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: 'Pause game' }).click()
  await expect(
    page.getByRole('dialog', { name: 'Take a little breath.' }),
  ).toBeVisible()
  const modalReleasedYaw = await numericAdventureAttribute(page, 'camera-yaw')
  await page.waitForTimeout(250)
  expect(
    Math.abs(
      cameraAngleDelta(
        modalReleasedYaw,
        await numericAdventureAttribute(page, 'camera-yaw'),
      ),
    ),
  ).toBeLessThan(0.02)
  await page.keyboard.up('ArrowLeft')
}
