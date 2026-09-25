// Final Journey portrait proof — bounded real raster confirms upright picture-bearing shards and the restored reward.

import { expect, test, type Page, type TestInfo } from '@playwright/test'
import sharp from 'sharp'
import { restoreRasterOutput, suspendRasterOutput, } from './helpers/cloudway-platform-proof'

declare global {
  interface Window {
    portraitProofGain?: GainNode
    portraitProofTrack?: MediaStreamTrack
  }
}

test.use({
  viewport: { width: 1024, height: 768 },
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})
test.setTimeout(360_000)

async function advanceUntil(
  page: Page,
  condition: () => Promise<boolean>,
  frames = 240,
): Promise<void> {
  for (let frame = 0; frame < frames; frame++) {
    if (await condition()) return
    await page.clock.runFor(32)
  }
  expect(await condition()).toBe(true)
}

async function capturePortraitStage(
  page: Page,
  testInfo: TestInfo,
  stage: 'before' | 'during' | 'after',
): Promise<void> {
  for (const [device, viewport] of [
    ['desktop', { width: 960, height: 540 }],
    ['tablet', { width: 768, height: 576 }],
  ] as const) {
    await page.setViewportSize(viewport)
    // Let ResizeObserver and renderer sizing settle while raster stays off.
    // The following enabled frame then paints at the requested dimensions.
    await page.clock.runFor(20)
    await restoreRasterOutput(page)
    const rasterMilliseconds =
      stage === 'during' && device === 'desktop'
        ? 140
        : stage === 'before' && device === 'tablet'
          ? 40
          : 20
    await page.clock.runFor(rasterMilliseconds)
    const canvas = page.getByLabel('Floating glass museum')
    const pixels = await canvas.screenshot()
    const metadata = await sharp(pixels).metadata()
    if (metadata.width === undefined || metadata.height === undefined)
      throw new Error(`Missing ${stage} ${device} canvas dimensions.`)
    const stats = await sharp(pixels)
      .extract({
        left: Math.floor(metadata.width * 0.2),
        top: Math.floor(metadata.height * 0.12),
        width: Math.floor(metadata.width * 0.6),
        height: Math.floor(metadata.height * 0.7),
      })
      .removeAlpha()
      .stats()
    const deviation = Math.max(
      ...stats.channels.slice(0, 3).map((channel) => channel.stdev),
    )
    expect(
      deviation,
      `${stage} ${device} canvas should contain a painted 3D scene`,
    ).toBeGreaterThan(10)
    await page.screenshot({
      path: testInfo.outputPath(`portrait-${stage}-${device}.png`),
    })
    await suspendRasterOutput(page)
  }
}

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.portraitProofTrack?.stop()).catch(() => {})
})

test('captures the upright final portrait before, during and after its picture-bearing shatter', async ({
  page,
}, testInfo) => {
  test.skip(
    process.env.GLASS_PORTRAIT_RENDER_PROOF !== '1',
    'Set GLASS_PORTRAIT_RENDER_PROOF=1 for actual-pixel review.',
  )
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.addInitScript(() => {
    const prefix = 'beside-cue:glass-adventure:'
    localStorage.setItem(`${prefix}tutorial`, 'seen')
    localStorage.setItem(
      `${prefix}museum-audio:v1`,
      JSON.stringify({ muted: true }),
    )
    localStorage.setItem(`${prefix}comfortable-note`, '57')
    const progressKey = `${prefix}progress:glassworks-journey/journey`
    if (localStorage.getItem(progressKey) === null)
      localStorage.setItem(
        progressKey,
        JSON.stringify({
          version: 1,
          levelId: 'glassworks-journey/journey',
          checkpointId: 'glassworks-journey/journey/portrait/checkpoint/entry',
          completedBreakableIds: [
            'glassworks-journey/journey/vestibule/encounter/vestibule-goblet',
            'glassworks-journey/journey/garden/encounter/garden-decanter',
            'glassworks-journey/journey/archive/encounter/archive-carafe',
          ],
          finished: false,
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
      window.portraitProofGain = gain
      window.portraitProofTrack = track
      return destination.stream
    }
  })
  await page.clock.install()
  await page.goto('/glass-game/?layout=journey', {
    waitUntil: 'domcontentloaded',
  })
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 3_600_000)
  const game = page.getByTestId('glass-adventure')
  await expect(game).toHaveAttribute(
    'data-loading-phase',
    'awaiting-first-frame',
    { timeout: 90_000 },
  )
  await suspendRasterOutput(page)
  for (let frame = 0; frame < 120; frame++) {
    if ((await game.getAttribute('data-ready')) === 'true') break
    await page.clock.runFor(32)
  }
  await expect(game).toHaveAttribute('data-ready', 'true')
  await expect(game).toHaveAttribute(
    'data-checkpoint',
    'glassworks-journey/journey/portrait/checkpoint/entry',
  )
  const sing = page.getByRole('button', { name: 'Sing to the glass' })
  await page.keyboard.down('KeyW')
  await advanceUntil(page, async () => sing.isVisible())
  await page.keyboard.up('KeyW')
  const notice = page.getByTestId('glass-notice')
  await capturePortraitStage(page, testInfo, 'before')
  // Voice playback and Web Audio share a real clock. Resume after the bounded
  // traversal so the authored reference can complete before microphone input.
  await page.clock.resume()

  await sing.click()
  const panel = page.getByLabel('Voice challenge', { exact: true })
  await expect(panel).toHaveAttribute('data-voice-mode', 'singing', {
    timeout: 45_000,
  })
  await page.evaluate(() => {
    const gain = window.portraitProofGain
    if (gain === undefined) throw new Error('Missing portrait proof gain.')
    gain.gain.setValueAtTime(0.1, gain.context.currentTime)
  })
  await expect(game).toHaveAttribute('data-completed', '4', {
    timeout: 15_000,
  })
  await page.evaluate(() => {
    const gain = window.portraitProofGain
    if (gain !== undefined)
      gain.gain.setValueAtTime(0, gain.context.currentTime)
  })
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 100)
  await page.clock.runFor(300)
  await expect(notice).toBeHidden()
  await capturePortraitStage(page, testInfo, 'during')

  await page.clock.runFor(3_000)
  await expect(notice).toBeVisible()
  await capturePortraitStage(page, testInfo, 'after')
  await expect(game).toHaveAttribute('data-completed', '4')

  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(game).toHaveAttribute(
    'data-loading-phase',
    'awaiting-first-frame',
    { timeout: 90_000 },
  )
  await suspendRasterOutput(page)
  await advanceUntil(
    page,
    async () => (await game.getAttribute('data-ready')) === 'true',
  )
  await expect(game).toHaveAttribute('data-completed', '4')
  expect(errors).toEqual([])
})
