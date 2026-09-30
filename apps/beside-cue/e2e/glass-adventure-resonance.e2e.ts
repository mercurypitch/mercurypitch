// Resonance trial browser gate — real PCM earns a Rosebud break and saved progress survives a fresh renderer.
import { expect, test, type Page } from '@playwright/test'

interface ResonanceVoiceSource {
  context: AudioContext
  gain: GainNode
  track: MediaStreamTrack
}

declare global {
  interface Window {
    resonanceVoice: {
      sources: ResonanceVoiceSource[]
      setAmplitude(value: number): void
      dispose(): Promise<void>
    }
  }
}

test.use({
  viewport: { width: 640, height: 480 },
  deviceScaleFactor: 1,
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})
test.setTimeout(150_000)

async function prepareTrial(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const prefix = 'beside-cue:glass-adventure:'
    localStorage.setItem(`${prefix}tutorial`, 'seen')
    localStorage.setItem(`${prefix}automatic-singing`, 'off')
    localStorage.setItem(`${prefix}render-quality:v1`, 'balanced')
    localStorage.setItem(
      `${prefix}museum-audio:v1`,
      JSON.stringify({ muted: true }),
    )
    localStorage.setItem(`${prefix}comfortable-note`, '57')
    if (localStorage.getItem(`${prefix}progress:living-glass`) === null) {
      // A reached checkpoint shortens traversal covered by platform tests.
      // It grants no singing progress or completion; the oscillator supplies
      // actual PCM to the existing microphone capture and pitch detector.
      localStorage.setItem(
        `${prefix}progress:living-glass`,
        JSON.stringify({
          version: 1,
          levelId: 'living-glass',
          checkpointId: 'living-glass-rosebud',
          completedBreakableIds: [],
        }),
      )
    }
    let amplitude = 0
    const sources: ResonanceVoiceSource[] = []
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    )
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      if (!constraints?.audio) return original(constraints)
      const context = new AudioContext()
      await context.resume()
      const oscillator = context.createOscillator()
      oscillator.frequency.value = 220
      const gain = context.createGain()
      gain.gain.value = amplitude
      const destination = context.createMediaStreamDestination()
      oscillator.connect(gain).connect(destination)
      oscillator.start()
      const track = destination.stream.getAudioTracks()[0]!
      const stop = track.stop.bind(track)
      track.stop = () => {
        if (track.readyState === 'ended') return
        stop()
        oscillator.stop()
        oscillator.disconnect()
        gain.disconnect()
        void context.close()
      }
      sources.push({ context, gain, track })
      return destination.stream
    }
    window.resonanceVoice = {
      sources,
      setAmplitude(value) {
        amplitude = value
        for (const source of sources) {
          if (source.track.readyState === 'live')
            source.gain.gain.setValueAtTime(value, source.context.currentTime)
        }
      },
      async dispose() {
        for (const source of sources) source.track.stop()
        await Promise.all(
          sources.map((source) =>
            source.context.state === 'closed'
              ? Promise.resolve()
              : source.context.close(),
          ),
        )
      },
    }
  })
}

async function beginSinging(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Sing to the glass' }).click()
  await expect(page.getByLabel('Voice challenge')).toHaveAttribute(
    'data-voice-mode',
    'singing',
    { timeout: 10_000 },
  )
}

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.resonanceVoice?.dispose())
})

test('Rosebud draws, cancels partial resonance, then breaks through real singing and restores @smoke', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await prepareTrial(page)
  const asset = page.waitForResponse((response) =>
    response.url().includes('/games/resonance/assets/resonance-rosebud-v1.glb'),
  )
  await page.goto('/glass-game/?layout=living-glass', {
    waitUntil: 'domcontentloaded',
  })
  expect((await asset).status()).toBe(200)
  const adventure = page.getByTestId('glass-adventure')
  await expect(adventure).toHaveAttribute('data-ready', 'true', {
    timeout: 90_000,
  })
  await expect(adventure).toHaveAttribute('data-level-id', 'living-glass')
  await expect(adventure).toHaveAttribute('data-completed', '0')
  await page.screenshot({ path: testInfo.outputPath('rosebud-idle.png') })

  await beginSinging(page)
  const resonance = page.getByRole('progressbar', { name: 'Glass resonance' })
  await expect(resonance).toHaveAttribute('aria-valuenow', '0')
  await page.evaluate(
    () => new Promise<void>((resolve) => setTimeout(resolve, 1600)),
  )
  await expect(adventure).toHaveAttribute('data-completed', '0')
  await page.evaluate(() => window.resonanceVoice.setAmplitude(0.1))
  await expect
    .poll(async () => Number(await resonance.getAttribute('aria-valuenow')), {
      timeout: 10_000,
    })
    .toBeGreaterThanOrEqual(30)
  await page.evaluate(() => window.resonanceVoice.setAmplitude(0))
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(adventure).toHaveAttribute('data-completed', '0')
  await expect(adventure).toHaveAttribute(
    'data-challenge-camera-mode',
    'exploration',
    { timeout: 10_000 },
  )
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          window.resonanceVoice.sources.every(
            (source) => source.track.readyState === 'ended',
          ),
        ),
      { timeout: 6000 },
    )
    .toBe(true)

  // Camera drag uses actual pointer events after cancellation, never scene mutation.
  const viewport = page.getByLabel('Glass museum; drag to look around')
  const bounds = await viewport.boundingBox()
  if (bounds === null) throw new Error('Missing Resonance trial viewport.')
  await page.mouse.move(
    bounds.x + bounds.width * 0.5,
    bounds.y + bounds.height * 0.35,
  )
  await page.mouse.down()
  await page.mouse.move(
    bounds.x + bounds.width * 0.58,
    bounds.y + bounds.height * 0.4,
    { steps: 8 },
  )
  await page.mouse.up()
  await expect(adventure).toHaveAttribute('data-ready', 'true')

  await beginSinging(page)
  await expect(resonance).toHaveAttribute('aria-valuenow', '0')
  await page.evaluate(() => window.resonanceVoice.setAmplitude(0.1))
  await expect(adventure).toHaveAttribute('data-completed', '1', {
    timeout: 15_000,
  })
  await page.evaluate(() => window.resonanceVoice.setAmplitude(0))
  await page.screenshot({
    path: testInfo.outputPath('rosebud-earned-release.png'),
  })
  await expect(adventure).toHaveAttribute(
    'data-challenge-camera-mode',
    'exploration',
    { timeout: 10_000 },
  )
  const saved = await page.evaluate(
    () =>
      JSON.parse(
        localStorage.getItem(
          'beside-cue:glass-adventure:progress:living-glass',
        ) ?? 'null',
      ) as { completedBreakableIds: string[] },
  )
  expect(saved.completedBreakableIds).toEqual(['living-glass/rosebud'])
  await page.reload()
  await expect(adventure).toHaveAttribute('data-ready', 'true', {
    timeout: 90_000,
  })
  await expect(adventure).toHaveAttribute('data-completed', '1')
  expect(await page.evaluate(() => window.resonanceVoice.sources.length)).toBe(
    0,
  )
  await page.screenshot({ path: testInfo.outputPath('rosebud-restored.png') })
  expect(errors).toEqual([])
})
