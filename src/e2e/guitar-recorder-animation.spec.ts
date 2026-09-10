// Decode the actual reel asset while the real recorder still captures and keeps notes.
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { installSongAudioProbe } from './helpers/guitar-night-audio-probe'

test.use({ viewport: { width: 1440, height: 900 } })

async function enterLive(page: Page) {
  await installSongAudioProbe(page)
  await page.route('https://**/*', (route) => route.abort())
  await page.goto('/guitar-night')
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await page
    .getByRole('button', { name: 'Free play', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Session controls', exact: true })
    .click()
  const session = page.getByRole('dialog', { name: 'Session', exact: true })
  await session
    .getByRole('button', { name: 'Direct input', exact: true })
    .click()
  await session
    .getByRole('button', { name: 'Close Session', exact: true })
    .click()
}

test('loops actual reel pixels during capture and releases video when stopped @smoke', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.url().endsWith('melody-recorder-reels-v1.mp4'))
      requests.push(request.url())
  })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await enterLive(page)
  expect(requests).toEqual([])
  // Decoration has no accessibility role; the enclosing button is the action.
  const machine = page.getByRole('button', {
    name: 'Record using tape deck',
    exact: true,
  })
  await machine.click()
  const stop = page.getByRole('button', {
    name: 'Stop using tape deck',
    exact: true,
  })
  const video = stop.locator('video')
  await expect(video).toHaveAttribute('data-playing', 'true')
  const decoded = await video.evaluate(async (element: HTMLVideoElement) => {
    const canvas = document.createElement('canvas')
    canvas.width = 48
    canvas.height = 48
    const context = canvas.getContext('2d')!
    const signatures = new Set<number>()
    let frames = 0
    let loops = 0
    let previousTime = 0
    // Tiny diagnostic samples, not a full-page screenshot during bounded PCM capture.
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new Error('Reel frames stalled')),
        5000,
      )
      const sample: VideoFrameRequestCallback = (_, metadata) => {
        context.drawImage(element, 50, 84, 136, 108, 0, 0, 48, 48)
        const pixels = context.getImageData(0, 0, 48, 48).data
        let hash = 0
        for (let i = 0; i < pixels.length; i += 16)
          hash = (Math.imul(hash, 31) + pixels[i]) | 0
        signatures.add(hash)
        if (metadata.mediaTime < previousTime) loops++
        previousTime = metadata.mediaTime
        if (++frames >= 24 && loops > 0) {
          clearTimeout(timeout)
          resolve()
        } else element.requestVideoFrameCallback(sample)
      }
      element.requestVideoFrameCallback(sample)
    })
    return {
      width: element.videoWidth,
      height: element.videoHeight,
      muted: element.muted,
      duration: element.duration,
      distinctFrames: signatures.size,
      loops,
      mask: getComputedStyle(element).maskImage,
    }
  })
  expect(decoded).toMatchObject({
    width: 384,
    height: 384,
    muted: true,
    duration: 0.75,
  })
  expect(decoded.distinctFrames).toBeGreaterThan(10)
  expect(decoded.loops).toBeGreaterThan(0)
  expect(decoded.mask).toContain('melody-recorder-reels-mask-v1.png')
  await page
    .getByRole('button', { name: 'Stop recording', exact: true })
    .click()
  const review = page.getByRole('dialog').filter({ hasText: 'Recorded melody' })
  await expect(review).toBeVisible()
  await expect(page.locator('video')).toHaveCount(0)
  await expect(
    review.getByRole('button', { name: 'Play take playback', exact: true }),
  ).toBeEnabled()
  await review.getByRole('button', { name: 'Keep take', exact: true }).click()
  await expect(
    review.getByRole('button', { name: 'Take kept', exact: true }),
  ).toBeDisabled()
  await review
    .getByRole('button', { name: 'Close Jam Doctor', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Record using tape deck', exact: true }),
  ).toBeEnabled()
  // Visual artifact is captured only after the recorder has flushed.
  await test.info().attach('recorder-idle-after-animation', {
    body: await page.screenshot({
      path: test.info().outputPath('recorder-idle.png'),
    }),
    contentType: 'image/png',
  })
  expect(errors).toEqual([])
})

test('reduced motion and failed media leave the real Record and Stop actions usable @smoke', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.url().endsWith('melody-recorder-reels-v1.mp4'))
      requests.push(request.url())
  })
  await enterLive(page)
  await page
    .getByRole('button', { name: 'Record using tape deck', exact: true })
    .click()
  await expect(page.getByTestId('guitar-recorder-stage')).toContainText(
    'Recording your idea',
  )
  await expect(page.locator('video')).toHaveCount(0)
  expect(requests).toEqual([])
  // Enabling motion reaches a genuine failed media response, not a fake component.
  await page.route('**/melody-recorder-reels-v1.mp4', (route) => route.abort())
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect.poll(() => requests.length).toBeGreaterThan(0)
  await expect(page.locator('video')).toHaveCount(0)
  await expect(page.getByTestId('guitar-recorder-stage')).toContainText(
    'Recording your idea',
  )
  await page
    .getByRole('button', { name: 'Stop using tape deck', exact: true })
    .click()
  await expect(
    page.getByRole('dialog').filter({ hasText: 'Recorded melody' }),
  ).toBeVisible()
})
