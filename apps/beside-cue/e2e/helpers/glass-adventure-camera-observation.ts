// Camera observation probes — browser-frame evidence for transient headings and trusted key release.

import { expect, type Page } from '@playwright/test'

export async function waitForCameraAngle(
  page: Page,
  reference: number | 'behind-merc',
  comparison: 'above' | 'below',
  radians: number,
  timeout: number,
): Promise<void> {
  // Sample both rendered headings synchronously on browser frames. Two remote
  // attribute reads can straddle frames and miss a transient front-facing view
  // while a trusted arrow key keeps rotating under a busy CI browser.
  const result = await page.waitForFunction(
    ({ reference, comparison, radians }) => {
      const root = document.querySelector('[data-testid="glass-adventure"]')
      const camera = root?.getAttribute('data-camera-yaw')
      const merc = root?.getAttribute('data-merc-yaw')
      if (camera == null || (reference === 'behind-merc' && merc == null))
        return false
      const target =
        reference === 'behind-merc' ? Number(merc) + Math.PI : reference
      const yaw = Number(camera)
      if (!Number.isFinite(yaw) || !Number.isFinite(target)) return false
      const angle = Math.abs(
        Math.atan2(Math.sin(target - yaw), Math.cos(target - yaw)),
      )
      return comparison === 'above' ? angle > radians : angle < radians
    },
    { reference, comparison, radians },
    { polling: 'raf', timeout },
  )
  await result.dispose()
}

export async function waitForJourneyCornerStop(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        let frameId = 0
        let previous: { x: number; z: number; at: number } | null = null
        let stableSince: number | null = null
        let stableFrames = 0
        const deadline = window.setTimeout(() => {
          cancelAnimationFrame(frameId)
          reject(
            new Error(
              `Held Journey chord did not reach a stationary corner within 7 seconds: ${JSON.stringify({ previous, stableFrames })}`,
            ),
          )
        }, 7_000)
        const sample = (at: number) => {
          const root = document.querySelector('[data-testid="glass-adventure"]')
          const x = Number(root?.getAttribute('data-player-x') ?? NaN)
          const z = Number(root?.getAttribute('data-player-z') ?? NaN)
          const travelYaw = Number(root?.getAttribute('data-travel-yaw') ?? NaN)
          if (
            previous !== null &&
            Number.isFinite(travelYaw) &&
            x < 8 &&
            Number.isFinite(z) &&
            Math.hypot(x - previous.x, z - previous.z) < 0.0001
          ) {
            stableSince ??= previous.at
            stableFrames++
            if (stableFrames >= 3 && at - stableSince >= 200) {
              clearTimeout(deadline)
              resolve()
              return
            }
          } else {
            stableSince = null
            stableFrames = 0
          }
          previous = { x, z, at }
          frameId = requestAnimationFrame(sample)
        }
        frameId = requestAnimationFrame(sample)
      }),
  )
}

interface QuietWindowReceipt {
  elapsedMilliseconds: number
  schedulingDelayMilliseconds: number
  graceRemainingAtReleaseMilliseconds: number
  maximumDrift: number
  samples: number
}

interface QuietProbeWindow extends Window {
  journeyQuietProbe?: {
    ready: boolean
    receipt: QuietWindowReceipt | null
    error: string | null
    stop: () => void
  }
}

export async function observeReleasedArrowQuietWindow(
  page: Page,
  releaseArrow: () => Promise<void>,
): Promise<void> {
  await page.evaluate(() => {
    const state = window as QuietProbeWindow
    state.journeyQuietProbe?.stop()
    let frameId = 0
    let previousFrame: number | null = null
    let previousFrameStart: number | null = null
    let quietDeadline: number | null = null
    let releasedAt: number | null = null
    let releasedYaw: number | null = null
    let maximumDrift = 0
    let samples = 0
    const probe = {
      ready: false,
      receipt: null as QuietWindowReceipt | null,
      error: null as string | null,
      stop: () => {
        cancelAnimationFrame(frameId)
        clearTimeout(deadline)
        document.removeEventListener('keyup', receiveRelease, true)
      },
    }
    const deadline = window.setTimeout(() => {
      probe.error =
        'No trusted ArrowRight release and rendered quiet-window evidence within 5 seconds.'
      probe.stop()
    }, 5_000)
    state.journeyQuietProbe = probe
    function receiveRelease(event: KeyboardEvent): void {
      if (!event.isTrusted || event.code !== 'ArrowRight') return
      releasedAt = performance.now()
      // orbit() resets the grace before update() credits the held frame.
      // Its observed frame start is a conservative deadline anchor, even if
      // a long frame was internally capped by the camera controller.
      quietDeadline =
        previousFrameStart === null ? null : previousFrameStart + 1_150
      document.removeEventListener('keyup', receiveRelease, true)
    }
    const sample = (timestamp: number) => {
      probe.ready = previousFrameStart !== null
      if (
        releasedAt !== null &&
        previousFrame !== null &&
        quietDeadline !== null
      ) {
        const rawYaw = document
          .querySelector('[data-testid="glass-adventure"]')
          ?.getAttribute('data-camera-yaw')
        const yaw = Number(rawYaw ?? NaN)
        if (!Number.isFinite(yaw)) {
          probe.error = 'Missing rendered camera yaw after trusted key release.'
          probe.stop()
          return
        }
        // Like Merc's yaw, the DOM heading precedes this frame's render. Pair
        // it with the preceding RAF timestamp, and start at the final held pose.
        releasedYaw ??= yaw
        const elapsedMilliseconds = previousFrame - releasedAt
        if (elapsedMilliseconds >= 0) {
          maximumDrift = Math.max(
            maximumDrift,
            Math.abs(
              Math.atan2(
                Math.sin(yaw - releasedYaw),
                Math.cos(yaw - releasedYaw),
              ),
            ),
          )
          samples++
          if (elapsedMilliseconds >= 800) {
            const schedulingDelayMilliseconds = performance.now() - timestamp
            const graceRemainingAtReleaseMilliseconds =
              quietDeadline - releasedAt
            if (previousFrame >= quietDeadline)
              probe.error = `No rendered sample after 800ms and before the observed held-frame grace boundary: ${JSON.stringify({ elapsedMilliseconds, graceRemainingAtReleaseMilliseconds, schedulingDelayMilliseconds, samples })}`
            else
              probe.receipt = {
                elapsedMilliseconds,
                schedulingDelayMilliseconds,
                graceRemainingAtReleaseMilliseconds,
                maximumDrift,
                samples,
              }
            probe.stop()
            return
          }
        }
      }
      previousFrameStart = previousFrame
      previousFrame = timestamp
      frameId = requestAnimationFrame(sample)
    }
    document.addEventListener('keyup', receiveRelease, true)
    frameId = requestAnimationFrame(sample)
  })
  try {
    const ready = await page.waitForFunction(
      () => (window as QuietProbeWindow).journeyQuietProbe?.ready === true,
      undefined,
      { timeout: 5_000 },
    )
    await ready.dispose()
    await releaseArrow()
    const result = await page.waitForFunction(
      () => {
        const probe = (window as QuietProbeWindow).journeyQuietProbe
        if (probe?.error) throw new Error(probe.error)
        return probe?.receipt ?? false
      },
      undefined,
      { timeout: 5_000 },
    )
    const receipt = await result.jsonValue()
    await result.dispose()
    if (receipt === false)
      throw new Error('Missing rendered quiet-window receipt.')
    expect(receipt.samples, JSON.stringify(receipt)).toBeGreaterThanOrEqual(2)
    expect(receipt.maximumDrift, JSON.stringify(receipt)).toBeLessThan(0.04)
  } finally {
    await page.evaluate(() => {
      const state = window as QuietProbeWindow
      state.journeyQuietProbe?.stop()
      delete state.journeyQuietProbe
    })
  }
}
