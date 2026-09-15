// Adventure voice regression — real PCM, YIN capture, lifecycle and saved success.
import { expect, test, type Page } from '@playwright/test'

interface VoiceSource {
  context: AudioContext
  gain: GainNode
  track: MediaStreamTrack
}
declare global {
  interface Window {
    glassVoiceFixture: {
      sources: VoiceSource[]
      setAmplitude(value: number): void
      dispose(): Promise<void>
    }
  }
}

test.use({
  viewport: { width: 640, height: 480 },
  launchOptions: {
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
    ],
  },
})
test.setTimeout(60_000)

async function openMuseum(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const prefix = 'beside-cue:glass-adventure:'
    localStorage.setItem(`${prefix}tutorial`, 'seen')
    // A legitimate reached checkpoint shortens traversal covered by controls tests.
    // This grants no break, bridge or target note; all singing below is real PCM.
    if (localStorage.getItem(`${prefix}progress:glassworks`) === null) {
      localStorage.setItem(
        `${prefix}progress:glassworks`,
        JSON.stringify({
          version: 1,
          levelId: 'glassworks',
          checkpointId: 'goblet',
          completedBreakableIds: [],
        }),
      )
    }
    let amplitude = 0
    const sources: VoiceSource[] = []
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
      const track = destination.stream.getAudioTracks()[0]
      const stop = track.stop.bind(track)
      track.stop = () => {
        stop()
        oscillator.stop()
        oscillator.disconnect()
        gain.disconnect()
        void context.close()
      }
      sources.push({ context, gain, track })
      return destination.stream
    }
    window.glassVoiceFixture = {
      sources,
      setAmplitude(value) {
        amplitude = value
        for (const source of sources)
          if (source.track.readyState === 'live')
            source.gain.gain.setValueAtTime(value, source.context.currentTime)
      },
      async dispose() {
        for (const source of sources)
          if (source.track.readyState === 'live') source.track.stop()
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
  await page.goto('/glass-game/')
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 20_000 },
  )
  await expect(
    page.getByRole('button', { name: 'Sing to the glass' }),
  ).toBeVisible()
}

async function expectMicrophoneOff(page: Page): Promise<void> {
  // MicManager intentionally retains an unowned stream for a two-second handoff.
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          window.glassVoiceFixture.sources.every(
            (source) => source.track.readyState === 'ended',
          ),
        ),
      { timeout: 6000 },
    )
    .toBe(true)
}

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.glassVoiceFixture?.dispose())
})

test('silence cannot earn progress; a fresh comfortable hold breaks and survives reload', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await openMuseum(page)
  await page.getByRole('button', { name: 'Sing to the glass' }).click()
  await expect(
    page.getByRole('heading', { name: 'Hum a comfortable note.' }),
  ).toBeVisible()
  const startedAt = await page.evaluate(
    () => window.glassVoiceFixture.sources[0].context.currentTime,
  )
  await expect
    .poll(
      () =>
        page.evaluate(
          () => window.glassVoiceFixture.sources[0].context.currentTime,
        ),
      { timeout: 6000 },
    )
    .toBeGreaterThan(startedAt + 1.5)
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-completed',
    '0',
  )
  expect(
    await page.evaluate(() =>
      localStorage.getItem('beside-cue:glass-adventure:comfortable-note'),
    ),
  ).toBeNull()

  await page.evaluate(() => window.glassVoiceFixture.setAmplitude(0.1))
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          localStorage.getItem('beside-cue:glass-adventure:comfortable-note'),
        ),
      { timeout: 12_000 },
    )
    .toBe('57')
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-completed',
    '1',
    { timeout: 15_000 },
  )
  await expectMicrophoneOff(page)
  const saved = await page.evaluate(
    () =>
      JSON.parse(
        localStorage.getItem(
          'beside-cue:glass-adventure:progress:glassworks',
        ) ?? 'null',
      ) as { completedBreakableIds: string[] },
  )
  expect(saved.completedBreakableIds).toEqual(['glassworks.first-goblet'])
  await page.reload()
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 20_000 },
  )
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-completed',
    '1',
  )
  expect(
    await page.evaluate(() => window.glassVoiceFixture.sources.length),
  ).toBe(0)
  expect(errors).toEqual([])
})

test('cancel and page background stop capture; return requires an explicit fresh start', async ({
  page,
}) => {
  await openMuseum(page)
  await page.getByRole('button', { name: 'Sing to the glass' }).click()
  await expect(
    page.getByRole('heading', { name: 'Hum a comfortable note.' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expectMicrophoneOff(page)
  await expect(
    page.getByRole('button', { name: 'Sing to the glass' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Sing to the glass' }).click()
  await expect(
    page.getByRole('heading', { name: 'Hum a comfortable note.' }),
  ).toBeVisible()
  expect(
    await page.evaluate(() => window.glassVoiceFixture.sources.length),
  ).toBe(2)
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pagehide')),
  )
  await expect(page.getByRole('dialog')).toContainText('The microphone is off.')
  await expectMicrophoneOff(page)
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pageshow')),
  )
  await expect(
    page.getByRole('button', { name: 'Back to the museum' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Back to the museum' }).click()
  expect(
    await page.evaluate(() => window.glassVoiceFixture.sources.length),
  ).toBe(2)
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-completed',
    '0',
  )
  await page.evaluate(() => window.glassVoiceFixture.setAmplitude(0.1))
  await page.getByRole('button', { name: 'Sing to the glass' }).click()
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-completed',
    '1',
    { timeout: 20_000 },
  )
  expect(
    await page.evaluate(() => window.glassVoiceFixture.sources.length),
  ).toBe(3)
  await expectMicrophoneOff(page)
})
