// J2 greeting — real media-clock alignment across a cold dialogue load.
import { expect, test } from '@playwright/test'

interface GreetingStart {
  readonly mediaTime: number
  readonly paused: boolean
}

test('holds the greeting picture at its cue until J2 starts, then reaches P02', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 664 })
  await page.addInitScript(() => {
    const starts: GreetingStart[] = []
    Object.assign(window, { greetingStarts: starts })
    const start = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (...args) {
      const video = document.querySelector<HTMLVideoElement>(
        'video[src*="b01-corky-greeting-j2-direct-to-p02"]',
      )
      const duration = this.buffer?.duration ?? 0
      if (video && duration > 2.5 && duration < 2.9) {
        starts.push({ mediaTime: video.currentTime, paused: video.paused })
      }
      start.apply(this, args)
    }
  })

  const loadFrames: GreetingStart[] = []
  let greetingRequests = 0
  await page.route(
    '**/en__corky__onboarding-greeting__v1_02.m4a',
    async (route) => {
      greetingRequests += 1
      const video = page.locator(
        'video[src*="b01-corky-greeting-j2-direct-to-p02"]',
      )
      loadFrames.push(
        await video.evaluate((element: HTMLVideoElement) => ({
          mediaTime: element.currentTime,
          paused: element.paused,
        })),
      )
      const response = await route.fetch()
      // A cold native read/decode must not let the mouth run ahead of its voice.
      await new Promise((resolve) => setTimeout(resolve, 600))
      loadFrames.push(
        await video.evaluate((element: HTMLVideoElement) => ({
          mediaTime: element.currentTime,
          paused: element.paused,
        })),
      )
      await route.fulfill({ response })
    },
  )

  await page.goto('/')
  await page.getByRole('button', { name: 'Tap to begin' }).click()
  await expect(
    page.getByRole('heading', { name: 'Choose your Pull', exact: true }),
  ).toBeVisible({ timeout: 12_000 })
  const starts = await page.evaluate(
    () =>
      (window as unknown as { greetingStarts: GreetingStart[] }).greetingStarts,
  )
  expect(greetingRequests).toBe(1)
  expect(starts).toHaveLength(1)
  expect(starts[0].mediaTime).toBeGreaterThanOrEqual(0.85)
  // Compare media clocks directly: a busy browser may observe the threshold
  // late, but fetching/decoding must never add further picture/voice drift.
  expect(starts[0].mediaTime).toBeCloseTo(loadFrames[0].mediaTime, 3)
  expect(starts[0].paused).toBe(true)
  expect(loadFrames).toHaveLength(2)
  expect(loadFrames.every((frame) => frame.paused)).toBe(true)
  expect(loadFrames[1].mediaTime).toBeCloseTo(loadFrames[0].mediaTime, 3)
  await expect(
    page.locator('[data-v2-media-target="plate:p02"] img'),
  ).toHaveAttribute('src', /p02-table-ready-v0_17.webp/)
})
