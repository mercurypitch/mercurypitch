// Optional finale regression — real PCM through the pitch detector, explicit recording and local replay.
import { expect, test } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { GLASSWORKS_JOURNEY } from '../../../packages/glass-game/src/content/glassworks-journey'
import { readProgress } from '../../../packages/glass-game/src/core/progress'

declare global {
  interface Window {
    encoreTrace: { samples: unknown[]; timer: ReturnType<typeof setInterval> }
    encoreFixture: {
      streams: MediaStream[]
      recordings: number
      sing(): void
      silent(): void
    }
  }
}
test.use({
  viewport: { width: 1024, height: 900 },
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})
test.setTimeout(120_000)

test('optional encore records only with consent, preserves completion and fits mobile @smoke', async ({
  page,
}, testInfo) => {
  const level = GLASSWORKS_JOURNEY
  const complete = {
    ...readProgress(level, null),
    completedBreakableIds: level.breakables
      .filter((item) => !item.optional)
      .map((item) => item.id),
    finished: true,
  }
  await page.addInitScript(
    ({ complete }) => {
      // This is a PCM, storage and overlay test; separate rendered proofs own the world.
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
      localStorage.setItem('beside-cue:glass-adventure:tutorial', 'seen')
      localStorage.setItem('beside-cue:glass-adventure:comfortable-note', '60')
      if (
        localStorage.getItem(
          `beside-cue:glass-adventure:progress:${complete.levelId}`,
        ) === null
      )
        localStorage.setItem(
          `beside-cue:glass-adventure:progress:${complete.levelId}`,
          JSON.stringify(complete),
        )
      const streams: MediaStream[] = []
      const sources: Array<{
        context: AudioContext
        oscillator: OscillatorNode
        gain: GainNode
      }> = []
      const recorderStart = MediaRecorder.prototype.start
      let recordings = 0
      MediaRecorder.prototype.start = function (...args) {
        recordings++
        recorderStart.apply(this, args)
      }
      navigator.mediaDevices.getUserMedia = async () => {
        const context = new AudioContext()
        await context.resume()
        const oscillator = context.createOscillator()
        oscillator.frequency.value = 261.625565
        const gain = context.createGain()
        gain.gain.value = 0
        const output = context.createMediaStreamDestination()
        oscillator.connect(gain).connect(output)
        oscillator.start()
        const track = output.stream.getAudioTracks()[0]!
        const stop = track.stop.bind(track)
        track.stop = () => {
          stop()
          oscillator.stop()
          oscillator.disconnect()
          gain.disconnect()
          void context.close()
        }
        sources.push({ context, oscillator, gain })
        streams.push(output.stream)
        return output.stream
      }
      window.encoreFixture = {
        streams,
        get recordings() {
          return recordings
        },
        sing() {
          const current = sources.at(-1)!
          const at = current.context.currentTime
          current.gain.gain.setValueAtTime(0.25, at)
          const frequency = current.oscillator.frequency
          frequency.cancelScheduledValues(at)
          frequency.setValueAtTime(261.625565, at)
          // Give the live judge time to acquire the first anchor, then follow
          // the original 0 -> 2 -> 0-semitone shape at an unhurried vocal pace.
          frequency.setValueAtTime(261.625565, at + 0.8)
          frequency.exponentialRampToValueAtTime(293.664768, at + 1.45)
          frequency.setValueAtTime(293.664768, at + 1.9)
          frequency.exponentialRampToValueAtTime(261.625565, at + 2.55)
        },
        silent() {
          for (const source of sources)
            if (source.context.state !== 'closed')
              source.gain.gain.setValueAtTime(0, source.context.currentTime)
        },
      }
    },
    { complete },
  )
  await page.goto('/glass-game/?layout=journey')
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 60_000 },
  )
  await page.getByRole('button', { name: 'Sing an optional encore' }).click()
  const dialog = page.getByRole('dialog', { name: 'Leave a little light.' })
  await expect(dialog).toBeVisible()
  const consent = dialog.getByRole('checkbox', {
    name: 'Keep a recording of my next melody',
  })
  await expect(consent).not.toBeChecked()
  const practice = dialog.locator('section[data-mode]')
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.screenshot({ path: testInfo.outputPath(`encore-${width}.png`) })
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true)
  }
  await page.setViewportSize({ width: 1024, height: 1000 })
  await dialog
    .getByRole('button', { name: 'Sing the melody', exact: true })
    .click()
  await expect(practice).toHaveAttribute('data-mode', 'singing', {
    timeout: 15_000,
  })
  expect(await page.evaluate(() => window.encoreFixture.recordings)).toBe(0)
  await expect(
    dialog.getByRole('progressbar', { name: 'Melody progress' }),
  ).toHaveAttribute('aria-valuenow', '0')
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.encoreFixture.streams.every((stream) =>
          stream
            .getAudioTracks()
            .every((track) => track.readyState === 'ended'),
        ),
      ),
    )
    .toBe(true)
  await consent.check()
  await dialog
    .getByRole('button', { name: 'Sing the melody', exact: true })
    .click()
  await expect(practice).toHaveAttribute('data-mode', 'reference')
  expect(await page.evaluate(() => window.encoreFixture.recordings)).toBe(0)
  await expect(practice).toHaveAttribute('data-mode', 'singing', {
    timeout: 15_000,
  })
  await practice.evaluate((section) => {
    const samples: unknown[] = []
    const timer = setInterval(() => {
      samples.push({
        at: performance.now(),
        mode: section.getAttribute('data-mode'),
        progress: section
          .querySelector('[role=progressbar]')
          ?.getAttribute('aria-valuenow'),
        circles: [...section.querySelectorAll('circle')].map((circle) => [
          circle.getAttribute('r'),
          circle.getAttribute('cx'),
          circle.getAttribute('cy'),
        ]),
        guidance: section.querySelector('h3')?.textContent,
      })
    }, 50)
    window.encoreTrace = { samples, timer }
    return true
  })
  await page.evaluate(() => window.encoreFixture.sing())
  try {
    await expect(practice).toHaveAttribute('data-mode', 'complete', {
      timeout: 15_000,
    })
  } finally {
    const trace = await page.evaluate(() => {
      clearInterval(window.encoreTrace.timer)
      return window.encoreTrace.samples
    })
    await writeFile(
      testInfo.outputPath('live-pitch-trace.json'),
      JSON.stringify(trace, null, 2),
    )
  }
  expect(await page.evaluate(() => window.encoreFixture.recordings)).toBe(1)
  expect(await page.evaluate(() => window.encoreFixture.streams)).toHaveLength(
    2,
  )
  await expect(
    dialog.getByRole('region', { name: 'New recording' }),
  ).toBeVisible()
  await dialog.getByRole('button', { name: 'Save take', exact: true }).click()
  await expect(
    dialog.getByText('Saved on this device. No recording was uploaded.'),
  ).toBeVisible()
  await dialog.getByRole('button', { name: 'Listen', exact: true }).click()
  await expect(
    dialog.getByRole('button', { name: 'Stop listening' }),
  ).toBeVisible()
  await dialog.getByRole('button', { name: 'Stop listening' }).click()
  await dialog.getByRole('button', { name: 'Back to completion card' }).click()
  await expect(dialog).not.toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Sing an optional encore' }),
  ).toBeFocused()
  await page.reload()
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 60_000 },
  )
  await page.getByRole('button', { name: 'Sing an optional encore' }).click()
  await expect(
    dialog.getByRole('region', { name: 'Saved recording' }),
  ).toBeVisible()
  await expect(consent).not.toBeChecked()
  await expect(
    dialog.getByText('First light echo', { exact: true }),
  ).toBeVisible()
  await dialog.getByRole('button', { name: 'Back to completion card' }).click()
  await page.goto('/glass-game/?campaign=1')
  await page.getByRole('button', { name: 'Open museum collection' }).click()
  const album = page.getByRole('dialog', {
    name: 'Your museum collection',
    exact: true,
  })
  await album.getByRole('button', { name: 'Sing or hear your encore' }).click()
  await expect(
    dialog.getByRole('region', { name: 'Saved recording' }),
  ).toBeVisible()
  await expect(consent).not.toBeChecked()
  await dialog.getByRole('button', { name: 'Listen', exact: true }).click()
  await expect(
    dialog.getByRole('button', { name: 'Stop listening' }),
  ).toBeVisible()
  await dialog.getByRole('button', { name: 'Stop listening' }).click()
  await dialog.getByRole('button', { name: 'Delete saved take' }).click()
  await expect(
    dialog.getByRole('region', { name: 'Saved recording' }),
  ).not.toBeVisible()
  await dialog.getByRole('button', { name: 'Back to collection' }).click()
  await expect(
    album.getByRole('button', { name: 'Sing or hear your encore' }),
  ).toBeFocused()
  expect(
    await page.evaluate(
      (id) =>
        JSON.parse(
          localStorage.getItem(`beside-cue:glass-adventure:progress:${id}`)!,
        ).finished,
      level.id,
    ),
  ).toBe(true)
})
