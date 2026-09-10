// Free recording runs real worklet/worker/IndexedDB without a song or physical audio hardware.
import { expect, test, type Page } from '@playwright/test'
import { strFromU8, unzipSync } from 'fflate'
import { readFile } from 'node:fs/promises'
import type { GuitarPracticeScore, GuitarRecording, } from '../lib/guitar/recording-types'
import { installSongAudioProbe, readSongAudio, } from './helpers/guitar-night-audio-probe'
import { enterSong, SONG_TITLE } from './helpers/guitar-night-song'
import { dismissOverlays, openNavTab } from './helpers/ui'

async function readAcceptedMelody(page: Page) {
  return page.evaluate(async () => {
    const request = indexedDB.open('MercuryPitchDB')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const transaction = db.transaction([
      'guitarRecordings',
      'guitarPracticeScores',
    ])
    const read = <T>(store: string) =>
      new Promise<T[]>((resolve, reject) => {
        const query = transaction.objectStore(store).getAll()
        query.onsuccess = () => resolve(query.result)
        query.onerror = () => reject(query.error)
      })
    try {
      const [recordings, scores] = await Promise.all([
        read<GuitarRecording>('guitarRecordings'),
        read<GuitarPracticeScore>('guitarPracticeScores'),
      ])
      return { recordings, scores }
    } finally {
      db.close()
    }
  })
}

test('records and keeps a dry melody without playback, then practices its accepted notes in place @smoke', async ({
  page,
}) => {
  await page.addInitScript(() => {
    ;(window as unknown as { E2E_TEST_MODE: boolean }).E2E_TEST_MODE = true
    const paints: number[] = []
    ;(window as unknown as { recorderPaints: number[] }).recorderPaints = paints
    const clear = CanvasRenderingContext2D.prototype.clearRect
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      if (this.canvas.hasAttribute('data-tab-presentation'))
        paints.push(performance.now())
      return clear.apply(this, args)
    }
    const evidence = { firstPcmAt: 0, firstNoteAt: 0, firstPcmFrames: 0 }
    ;(
      window as unknown as { recorderEvidence: typeof evidence }
    ).recorderEvidence = evidence
    const post = Worker.prototype.postMessage
    Worker.prototype.postMessage = function (message, options) {
      if (message?.type === 'pcm' && evidence.firstPcmAt === 0) {
        evidence.firstPcmAt = performance.now()
        evidence.firstPcmFrames = message.frames
      }
      return post.call(this, message, options as StructuredSerializeOptions)
    }
    new MutationObserver((changes) => {
      for (const change of changes) {
        const element = change.target
        if (
          evidence.firstNoteAt === 0 &&
          element instanceof HTMLCanvasElement &&
          /[1-9]\d* recorded notes/.test(
            element.getAttribute('aria-label') ?? '',
          )
        ) {
          evidence.firstNoteAt = performance.now()
        }
      }
    }).observe(document, {
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-label'],
    })
  })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await installSongAudioProbe(page)
  await page.route('https://**/*', (route) => route.abort())
  await page.goto('/guitar-night')
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await page.getByRole('button', { name: 'Free play', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Free form', exact: true }),
  ).toBeVisible()
  expect(await page.evaluate(() => window.__songAudioProbe.micCalls)).toBe(0)
  await expect(page.getByTestId('guitar-night-free-play-note')).toHaveCount(0)
  await page.setViewportSize({ width: 1440, height: 850 })
  await page
    .getByRole('button', { name: 'Record a melody', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Stop recording', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('status', { name: 'Recording duration', exact: true }),
  ).toContainText('0:06', { timeout: 16000 })
  // Preview arrives in smaller batches than durable PCM checkpoints. Painting
  // still follows the capture clock, never a worker/IndexedDB update cadence.
  const gaps = await page.evaluate(() => {
    const paints = (window as unknown as { recorderPaints: number[] })
      .recorderPaints
    const recent = paints.filter((time) => time > performance.now() - 2500)
    return recent
      .slice(1)
      .map((time, index) => time - recent[index])
      .sort((a, b) => a - b)
  })
  expect(gaps.length).toBeGreaterThan(25)
  expect(gaps[Math.floor(gaps.length / 2)]).toBeLessThan(80)
  const evidence = await page.evaluate(
    () =>
      (
        window as unknown as {
          recorderEvidence: {
            firstPcmAt: number
            firstNoteAt: number
            firstPcmFrames: number
          }
        }
      ).recorderEvidence,
  )
  expect(evidence.firstPcmFrames).toBe(2048)
  expect(evidence.firstNoteAt).toBeGreaterThan(evidence.firstPcmAt)
  // Includes detector settling and UI publication, not physical input latency.
  expect(evidence.firstNoteAt - evidence.firstPcmAt).toBeLessThan(700)
  await test.info().attach('live-preview-timing', {
    body: JSON.stringify({
      ...evidence,
      medianPaintGapMs: gaps[Math.floor(gaps.length / 2)],
    }),
    contentType: 'application/json',
  })
  const flow = page.locator('canvas[data-tab-presentation]')
  await expect(flow).toHaveAttribute(
    'aria-label',
    /Detected melody.*[1-9]\d* recorded notes.*history, not targets/,
  )
  await expect(flow).toHaveAttribute('data-tab-timeline', 'recording-history')
  await page.screenshot({ path: test.info().outputPath('live-notes.png') })
  await page
    .getByRole('button', { name: 'Recorder options', exact: true })
    .click()
  await page.getByTestId('overflow-live-notes').click()
  await expect(flow).not.toHaveAttribute(
    'aria-label',
    /[1-9]\d* recorded notes/,
  )
  await expect(
    page.getByRole('button', { name: 'Stop recording', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Stop recording', exact: true })
    .click()
  const review = page.getByRole('dialog').filter({ hasText: 'Recorded melody' })
  await expect(review).toBeVisible()
  await review
    .getByRole('button', { name: 'Close Jam Doctor', exact: true })
    .click()
  await expect(flow).toHaveAttribute(
    'aria-label',
    /Detected melody.*[1-9]\d* recorded notes/,
  )
  await expect(flow).toHaveAttribute('data-tab-timeline', 'recording-history')
  await page.screenshot({ path: test.info().outputPath('stopped-notes.png') })
  await page.getByRole('button', { name: 'Review take', exact: true }).click()
  await expect(review).toBeVisible()
  await expect(
    review.getByRole('heading', { name: /notes? captured\./ }),
  ).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 850 })
  await review
    .getByRole('button', { name: 'Review and correct notes', exact: true })
    .click()
  const pitch = review.getByRole('spinbutton', {
    name: 'Pitch (MIDI)',
    exact: true,
  })
  const originalPitch = await pitch.inputValue()
  await pitch.fill(String(Number(originalPitch) + 1))
  await pitch.press('Tab')
  await review
    .getByRole('button', { name: 'Hide note corrections', exact: true })
    .click()
  await review
    .getByRole('button', { name: 'Review and correct notes', exact: true })
    .click()
  await review
    .getByRole('button', { name: 'Undo correction', exact: true })
    .click()
  await expect(pitch).toHaveValue(originalPitch)
  await review
    .getByRole('button', { name: 'Hide note corrections', exact: true })
    .click()
  await page.setViewportSize({ width: 1440, height: 850 })
  await review
    .getByRole('textbox', { name: 'Take title', exact: true })
    .fill('First local melody')
  await review.getByRole('button', { name: 'Keep take', exact: true }).click()
  await expect(
    review.getByRole('button', { name: 'Take kept', exact: true }),
  ).toBeDisabled()
  await review
    .getByRole('button', { name: 'Close Jam Doctor', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Play recording', exact: true })
    .click()
  await expect(flow).toHaveAttribute('data-tab-timeline', 'upcoming')
  await expect(
    page.getByRole('status', { name: 'Playback position', exact: true }),
  ).toContainText('0:01')
  await page
    .getByRole('button', { name: 'Pause recording replay', exact: true })
    .click()
  await page.setViewportSize({ width: 1440, height: 850 })
  const stageBefore = (await flow.boundingBox())!
  const libraryButton = page.getByRole('button', {
    name: 'My melodies, 1 recording',
    exact: true,
  })
  await libraryButton.click()
  const gallery = page.getByRole('dialog', { name: 'My melodies', exact: true })
  await expect(
    gallery.getByRole('img', { name: /Captured melody/ }),
  ).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 850 })
  await page.keyboard.press('Escape')
  await expect(gallery).not.toBeVisible()
  await expect(libraryButton).toBeFocused()
  expect((await flow.boundingBox())!.height).toBeCloseTo(stageBefore.height, 0)
  await libraryButton.click()
  await gallery
    .getByRole('button', { name: 'Review First local melody', exact: true })
    .click()
  await expect(review).toBeVisible()
  expect(await page.evaluate(() => window.__songAudioProbe.micCalls)).toBe(1)
  // MicManager releases the lease immediately, then closes hardware after its
  // existing two-second page-switch linger. Do not bypass the shared owner.
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__songAudioProbe.micTracks.every(
          (track) => track.readyState === 'ended',
        ),
      ),
    )
    .toBe(true)
  await review
    .getByRole('button', { name: 'Practice these notes', exact: true })
    .click()
  await expect(review).not.toBeVisible()
  await expect(page.getByTestId('guitar-night-score-room')).toHaveCount(0)
  await expect(
    page
      .getByRole('group', { name: 'Free-form mode', exact: true })
      .getByRole('button', { name: 'Practice', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  const practice = page.getByTestId('guitar-free-form-practice-deck')
  await expect(practice).toBeVisible()
  await expect(
    practice.getByRole('button', { name: 'Play practice', exact: true }),
  ).toBeEnabled()
  await expect(
    page.getByRole('heading', {
      name: 'Free form',
      exact: true,
    }),
  ).toBeVisible()
  await expect(flow).toHaveAttribute(
    'aria-label',
    /First local melody · recorded melody.*[1-9]\d* guided notes/,
  )
  await expect(flow).toHaveAttribute('data-tab-timeline', 'upcoming')
  expect(await page.evaluate(() => window.__songAudioProbe.micCalls)).toBe(1)
  const accepted = await readAcceptedMelody(page)
  expect(accepted.recordings).toHaveLength(1)
  expect(accepted.scores).toHaveLength(1)
  const recordingId = accepted.recordings[0].id
  expect(accepted.recordings[0].scoreId).toBe(accepted.scores[0].id)
  expect(accepted.scores[0].recordingId).toBe(recordingId)
  expect(accepted.scores[0].title).toBe('First local melody')
  expect(accepted.scores[0].notes.length).toBeGreaterThan(0)
  // Inline Practice must still commit the revision durably, even though it no
  // longer navigates away to the separate Rehearse room.
  await page.goto(`/guitar-night?recording=${encodeURIComponent(recordingId)}`)
  const reopened = page
    .getByRole('dialog')
    .filter({ hasText: 'Recorded melody' })
  await expect(
    reopened.getByRole('button', { name: 'Take kept', exact: true }),
  ).toBeDisabled()
  expect(await page.evaluate(() => window.__songAudioProbe.micCalls)).toBe(0)
  expect(await readAcceptedMelody(page)).toEqual(accepted)
  const midiDownload = page.waitForEvent('download')
  await reopened
    .getByRole('button', { name: 'Export MIDI', exact: true })
    .click()
  expect((await midiDownload).suggestedFilename()).toMatch(
    /^melody-first-local-melody-\d{8}-\d{6}\.mid$/,
  )
  const gpDownload = page.waitForEvent('download')
  await expect(
    reopened.getByRole('button', { name: 'Export Guitar Pro', exact: true }),
  ).toHaveAccessibleDescription(/rounds timing to thirty-second notes/)
  await reopened
    .getByRole('button', { name: 'Export Guitar Pro', exact: true })
    .click()
  const downloadedGp = await gpDownload
  expect(downloadedGp.suggestedFilename()).toMatch(
    /^melody-first-local-melody-\d{8}-\d{6}\.gp$/,
  )
  const gpFiles = unzipSync(await readFile((await downloadedGp.path())!))
  expect(strFromU8(gpFiles.VERSION)).toBe('7.0')
  const gpif = strFromU8(gpFiles['Content/score.gpif'])
  expect(gpif).not.toContain('PrimaryTuplet')
  expect(gpif).toContain('<Instrument>Guitar</Instrument>')
  expect(gpif).toContain('<Octave>-1</Octave>')
  await page.goto('/')
  await page.waitForSelector('#app-tabs')
  // This is the first visit to the main app, not a return from its onboarding.
  await page
    .getByRole('dialog', { name: 'Welcome to MercuryPitch', exact: true })
    .getByRole('button', { name: 'Skip', exact: true })
    .click()
  await dismissOverlays(page)
  await openNavTab(page, 'tab-voice-history')
  await expect(page.getByTestId('voice-history-page')).toBeVisible()
  await page
    .getByRole('link', { name: 'Open melody notes', exact: true })
    .click()
  await expect(
    page.getByRole('dialog').filter({ hasText: 'Recorded melody' }),
  ).toBeVisible()
  expect(await page.evaluate(() => window.__songAudioProbe.micCalls)).toBe(0)
  expect(errors).toEqual([])
})

test('captures with a backing at fixed speed and reloads the accepted score placement @smoke', async ({
  page,
}) => {
  await installSongAudioProbe(page)
  await enterSong(page, 2)
  await page
    .getByRole('button', { name: 'Session controls', exact: true })
    .click()
  const session = page.getByRole('dialog', { name: 'Session', exact: true })
  await session
    .getByRole('checkbox', { name: 'Live notes', exact: true })
    .uncheck()
  await session
    .getByRole('button', { name: 'Direct input', exact: true })
    .click()
  await session
    .getByRole('button', { name: 'Close Session', exact: true })
    .click()
  await page.getByRole('button', { name: 'Play backing', exact: true }).click()
  await page
    .getByRole('button', { name: 'Record a melody', exact: true })
    .click()
  await expect(
    page.getByRole('status', { name: 'Recording duration', exact: true }),
  ).toContainText('0:02', { timeout: 12000 })
  await expect(
    page.getByRole('slider', { name: 'Song position', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: /Speed up from/ }),
  ).toBeDisabled()
  await expect(
    page.locator('canvas[data-tab-presentation]'),
  ).not.toHaveAttribute('aria-label', /guided notes/)
  await page.getByRole('button', { name: 'Pause backing', exact: true }).click()
  const review = page.getByRole('dialog').filter({ hasText: 'Recorded melody' })
  await expect(review).toBeVisible()
  await review
    .getByRole('button', { name: 'Attach to a song', exact: true })
    .click()
  await expect(review).not.toBeVisible()
  await page.getByRole('button', { name: 'Enter room', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: SONG_TITLE, exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Session controls', exact: true })
    .click()
  await expect(
    session.getByRole('button', { name: 'First note here', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await session
    .getByRole('button', {
      name: 'Move the tab 0.5 seconds later',
      exact: true,
    })
    .click()
  const mark = await session.getByText(/First note at/).textContent()
  // Await the actual durable placement write, not a delay chosen by the test.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<number>((resolve, reject) => {
            const open = indexedDB.open('MercuryPitchDB')
            open.onerror = () => reject(open.error)
            open.onsuccess = () => {
              const db = open.result
              const query = db
                .transaction('guitarScoreAttachments')
                .objectStore('guitarScoreAttachments')
                .count()
              query.onsuccess = () => {
                db.close()
                resolve(query.result)
              }
            }
          }),
      ),
    )
    .toBe(1)
  await page.reload()
  await page.getByRole('button', { name: 'Enter room', exact: true }).click()
  await page
    .getByRole('button', { name: 'Session controls', exact: true })
    .click()
  await expect(session.getByText(/First note at/)).toHaveText(mark!)
  await expect(
    session.getByRole('group', { name: 'Nudge the tab', exact: true }),
  ).toBeVisible()
})

test('recording borrows live monitoring without muting, adding an output context or releasing its input @smoke', async ({
  page,
}) => {
  await installSongAudioProbe(page)
  await page.route('https://**/*', (route) => route.abort())
  await page.goto('/guitar-night')
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await page.getByRole('button', { name: 'Free play', exact: true }).click()
  await page
    .getByRole('button', { name: 'Session controls', exact: true })
    .click()
  const session = page.getByRole('dialog', { name: 'Session', exact: true })
  await session
    .getByRole('button', { name: 'Direct input', exact: true })
    .click()
  await session
    .getByRole('button', {
      name: 'Start Listening and monitoring',
      exact: true,
    })
    .click()
  await expect(
    session.getByRole('button', { name: 'Turn monitoring off', exact: true }),
  ).toBeVisible()
  await session
    .getByRole('button', { name: 'Close Session', exact: true })
    .click()
  await expect(session).not.toBeVisible()
  await expect
    .poll(() => page.evaluate(() => window.__songAudioProbe.frames.length))
    .toBeGreaterThan(30)
  // The amp runs its Lite tone until the cabinet impulse response has been
  // fetched, checksummed and decoded, then crossfades to Studio, and that swap
  // changes the monitored level on its own. On a loaded runner it lands
  // between the two samples below and reads as the recording changing the mix,
  // which is the one thing this test is asking about. Reproduced by holding
  // the cabinet request back a couple of seconds: the ratio goes to 1.36.
  // Waiting on the "Cabinet IR ready" status is not enough, because the
  // stage's own crossfade follows the decode. So wait for the level itself to
  // stop moving.
  const micLevel = async (): Promise<number> => {
    const read = await readSongAudio(page, 8)
    return (
      read.frames.reduce((sum, frame) => sum + frame.mic, 0) /
      read.frames.length
    )
  }
  let settling = await micLevel()
  await expect
    .poll(
      async () => {
        const next = await micLevel()
        const drift = Math.abs(next / settling - 1)
        settling = next
        return drift
      },
      { intervals: [250], timeout: 20000 },
    )
    .toBeLessThan(0.02)
  const before = await readSongAudio(page, 8)
  const beforeFrames = await page.evaluate(
    () => window.__songAudioProbe.frames.length,
  )
  await page
    .getByRole('button', { name: 'Record a melody', exact: true })
    .click()
  await expect(
    page.getByRole('status', { name: 'Recording duration', exact: true }),
  ).toContainText('0:03', { timeout: 12000 })
  const during = await readSongAudio(page, 8)
  const amplitude = (frames: typeof before.frames): number =>
    frames.reduce((sum, frame) => sum + frame.mic, 0) / frames.length
  expect(amplitude(before.frames)).toBeGreaterThan(0.005)
  expect(amplitude(during.frames) / amplitude(before.frames)).toBeGreaterThan(
    0.85,
  )
  expect(amplitude(during.frames) / amplitude(before.frames)).toBeLessThan(1.15)
  const render = await page.evaluate((start) => {
    const frames = window.__songAudioProbe.frames.slice(start)
    return {
      contexts: [
        ...new Set(
          window.__songAudioProbe.frames.map((frame) => frame.context),
        ),
      ],
      largestGap: Math.max(
        ...frames
          .slice(1)
          .map((frame, index) => frame.time - frames[index].time),
      ),
    }
  }, beforeFrames)
  expect(render.contexts).toHaveLength(1)
  expect(render.largestGap).toBeLessThan(0.05)
  await page
    .getByRole('button', { name: 'Stop recording', exact: true })
    .click()
  const review = page.getByRole('dialog').filter({ hasText: 'Recorded melody' })
  await expect(review).toBeVisible()
  expect(await page.evaluate(() => window.__songAudioProbe.micCalls)).toBe(1)
  expect(
    await page.evaluate(() =>
      window.__songAudioProbe.micTracks.every(
        (track) => track.readyState === 'live',
      ),
    ),
  ).toBe(true)
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('button', { name: 'Mute your monitoring', exact: true }),
  ).toBeVisible()
  await test.info().attach('monitor-and-record-render-check', {
    contentType: 'application/json',
    body: JSON.stringify({
      before: amplitude(before.frames),
      during: amplitude(during.frames),
      ...render,
    }),
  })
})
