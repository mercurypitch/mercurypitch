// Real browser chord preview and post-stop model processing retain continuous monitored audio and explicit acceptance.
import { expect, test } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { encodeMonoPcmSamplesToWav } from '../lib/audio-buffer-wav'
import { createGuitarChordFixtures } from '../lib/guitar/recording-chord-fixtures'
import { installSongAudioProbe } from './helpers/guitar-night-audio-probe'

const fixture = createGuitarChordFixtures().find(
  (item) => item.id === 'power-chord',
)!
const audioBase64 = Buffer.from(
  encodeMonoPcmSamplesToWav(fixture.samples, fixture.sampleRate),
).toString('base64')

test('live chord switches preserve monitoring and Stop prepares a reversible proposal @smoke', async ({
  page,
}) => {
  test.setTimeout(60000)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await installSongAudioProbe(page, { autoRefineAfterStop: true, audioBase64 })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    type Result = {
      notes: Array<{ midi: number }>
      processingMs: number
      workerId: number
    }
    const activity = {
      liveResults: [] as Result[],
      liveWorkers: 0,
      aliveLive: 0,
      postWorkers: 0,
      overlapped: false,
    }
    Object.assign(window, { chordActivity: activity })
    const Original = Worker
    window.Worker = class extends Original {
      private live: boolean
      private retired = false
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options)
        this.live = String(url).includes('guitar-live-chords.worker')
        if (this.live) {
          const workerId = ++activity.liveWorkers
          activity.aliveLive++
          this.addEventListener('message', ({ data }) => {
            if (data.type === 'result')
              activity.liveResults.push({ ...data.result, workerId })
          })
        }
        if (String(url).includes('guitar-refinement.worker')) {
          activity.postWorkers++
          activity.overlapped ||= activity.aliveLive > 0
        }
      }
      terminate() {
        if (this.live && !this.retired) {
          activity.aliveLive--
          this.retired = true
        }
        super.terminate()
      }
    }
  })
  await page.route('https://**/*', (route) => route.abort())
  await page.goto('/guitar-night')
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await page.getByRole('button', { name: 'Free play', exact: true }).click()
  await page
    .getByRole('button', { name: 'Session controls', exact: true })
    .click()
  const session = page.getByRole('dialog', { name: 'Session', exact: true })
  const live = session.getByRole('switch', { name: 'Live chords', exact: true })
  await expect(live).not.toBeChecked()
  await expect(
    session.getByRole('switch', { name: 'Refine after Stop' }),
  ).toBeChecked()
  await session
    .getByRole('button', { name: 'Direct input', exact: true })
    .click()
  await live.check()
  await session
    .getByRole('button', {
      name: 'Start Listening and monitoring',
      exact: true,
    })
    .click()
  await expect(
    session.getByText('Live chord preview is running.', { exact: false }),
  ).toBeVisible({ timeout: 20000 })
  const activity = () =>
    page.evaluate(
      () =>
        (
          window as unknown as {
            chordActivity: {
              liveResults: Array<{
                notes: Array<{ midi: number }>
                processingMs: number
                workerId: number
              }>
              liveWorkers: number
              aliveLive: number
              postWorkers: number
              overlapped: boolean
            }
          }
        ).chordActivity,
    )
  await expect
    .poll(
      async () =>
        (await activity()).liveResults.some((result) =>
          [40, 47, 52].every((pitch) =>
            result.notes.some((note) => note.midi === pitch),
          ),
        ),
      { timeout: 15000 },
    )
    .toBe(true)
  const before = await page.evaluate(
    () => window.__songAudioProbe.frames.at(-1)!.time,
  )
  await live.uncheck()
  await expect.poll(async () => (await activity()).aliveLive).toBe(0)
  await expect
    .poll(() =>
      page.evaluate((time) => {
        const frames = window.__songAudioProbe.frames.filter(
          (frame) => frame.time > time + 0.15,
        )
        return frames.some((frame) =>
          frame.samples.some((sample) => Math.abs(sample) > 0.001),
        )
      }, before),
    )
    .toBe(true)
  expect(await page.evaluate(() => window.__songAudioProbe.micCalls)).toBe(1)
  expect(
    await page.evaluate(() =>
      window.__songAudioProbe.micTracks.map((track) => track.readyState),
    ),
  ).toEqual(['live'])
  await live.check()
  await expect(
    session.getByText('Live chord preview is running.', { exact: false }),
  ).toBeVisible({ timeout: 15000 })
  // Both widths use the actual Session DOM and CSS, including switch hit areas.
  const controls = session.getByRole('group', {
    name: 'Chord detection Experimental',
  })
  await controls.screenshot({
    path: test.info().outputPath('chord-settings-desktop.png'),
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await controls.scrollIntoViewIfNeeded()
  const fits = await session.evaluate(
    (element) => element.scrollWidth <= element.clientWidth + 1,
  )
  expect(fits).toBe(true)
  await controls.screenshot({
    path: test.info().outputPath('chord-settings-mobile.png'),
  })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await session
    .getByRole('button', { name: 'Close Session', exact: true })
    .click()
  const workersBeforeRecording = (await activity()).liveWorkers
  await page
    .getByRole('button', { name: 'Record a melody', exact: true })
    .click()
  await expect
    .poll(
      async () =>
        (await activity()).liveResults.some(
          (result) =>
            result.workerId > workersBeforeRecording &&
            [40, 47, 52].every((pitch) =>
              result.notes.some((note) => note.midi === pitch),
            ),
        ),
      { timeout: 15000 },
    )
    .toBe(true)
  expect((await activity()).aliveLive).toBe(1)
  await expect
    .poll(async () => {
      const duration = await page
        .getByRole('status', { name: 'Recording duration', exact: true })
        .textContent()
      const [minutes, seconds] = (duration ?? '').split(':').map(Number)
      return minutes * 60 + seconds
    })
    .toBeGreaterThanOrEqual(3)
  await page
    .getByRole('button', { name: 'Stop recording', exact: true })
    .click()
  const review = page.getByRole('dialog').filter({ hasText: 'Recorded melody' })
  await expect(
    review.getByRole('button', { name: 'Use refined notes', exact: true }),
  ).toBeVisible({ timeout: 20000 })
  const result = await activity()
  expect(result.aliveLive).toBe(0)
  expect(result.postWorkers).toBe(1)
  expect(result.overlapped).toBe(false)
  await review
    .getByRole('button', { name: 'Close Jam Doctor', exact: true })
    .click()
  await page.getByRole('button', { name: 'Review take', exact: true }).click()
  await expect(
    review.getByRole('button', { name: 'Refine chords', exact: true }),
  ).toBeVisible()
  expect((await activity()).postWorkers).toBe(1)
  const timings = result.liveResults
    .map((item) => item.processingMs)
    .sort((a, b) => a - b)
  const runtimePath = test.info().outputPath('live-chord-runtime.json')
  await writeFile(
    runtimePath,
    JSON.stringify({
      windows: timings.length,
      medianMs: timings[Math.floor(timings.length / 2)],
      maxMs: timings.at(-1),
      overlapped: result.overlapped,
    }),
  )
  await test.info().attach('live-chord-runtime', {
    path: runtimePath,
    contentType: 'application/json',
  })
  expect(errors).toEqual([])
})
