// Studio recording — a take sung into the fake microphone lands at the playhead on the selected lane, or on a new lane when a clip is in the way, as long as it ran and trimmed at its start by the count-in and the round trip Studio applied; the microphone is given back, undo takes the take out, and the next Play starts it as soon as it starts an imported take.
import { expect, type Locator, type Page, test } from '@playwright/test'
import type { StudioAsset, StudioClip } from '../lib/studio/model/types'
import { openArrangement, readStudioProject, studioClip, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { audioClock, captureStudioOutput, clearClicks, importWav, readClicks, untilAudioClock, } from './helpers/studio-output-capture'
import { steadyWav } from './helpers/studio-output'
import type { PhaseReading } from './helpers/studio-perf'
import { firstSoundOf, installPerfProbes, lastPress, measurePhase, openCpuCounters, } from './helpers/studio-perf'
import { fakeMicArgs, TONE_HZ, writeToneWav } from './helpers/tone-wav'

const TONE_WAV = writeToneWav(TONE_HZ, 20)
const RATE = 48_000
/** One bar of 4/4 at the 120 bpm a new song starts at. */
const COUNT_IN_SECONDS = 2
/** The recorder starts its capture this long after the press (studio-recorder.ts). */
const START_LEAD_SECONDS = 0.1
/** The Studio's own frame requests while the song plays under a take: none of its own. */
const playingFramesBudget = 0

test.use({
  launchOptions: { args: fakeMicArgs(TONE_WAV) },
  permissions: ['microphone'],
  viewport: { width: 1440, height: 900 },
})

/** Keep every stream the page opens, to see the microphone given back. */
async function keepStreams(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const devices = navigator.mediaDevices
    if (!devices) return
    const open = devices.getUserMedia.bind(devices)
    const kept: MediaStream[] = []
    ;(window as unknown as { __streams: MediaStream[] }).__streams = kept
    devices.getUserMedia = async (constraints) => {
      const stream = await open(constraints)
      kept.push(stream)
      return stream
    }
  })
}

const liveMicTracks = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __streams?: MediaStream[] }).__streams
        ?.flatMap((stream) => stream.getAudioTracks())
        .filter((track) => track.readyState === 'live').length ?? 0,
  )

/**
 * Count the animation frames the page asks for: the Studio's own (its
 * chunk is on the stack) and everyone else's. The practice controller runs
 * a frame loop while any feature holds the microphone
 * (usePracticeController.ts, micDeviceOpen), so an armed Studio wakes it.
 */
async function countFrames(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const request = window.requestAnimationFrame.bind(window)
    const counter = window as unknown as {
      __frames: { studio: number; other: number }
    }
    counter.__frames = { studio: 0, other: 0 }
    window.requestAnimationFrame = (callback) => {
      if ((new Error().stack ?? '').includes('/StudioPage-'))
        counter.__frames.studio++
      else counter.__frames.other++
      return request(callback)
    }
  })
}

const frameRequests = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __frames: { studio: number; other: number } })
        .__frames,
  )

/** Frame requests between two readings. */
const framesBetween = (
  before: { studio: number; other: number },
  after: { studio: number; other: number },
) => ({
  studio: after.studio - before.studio,
  other: after.other - before.other,
})

async function readAsset(page: Page, id: string): Promise<StudioAsset> {
  return page.evaluate(async (assetId) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('MercuryPitchDB')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      return await new Promise<StudioAsset>((resolve, reject) => {
        const request = database
          .transaction('studioAssets', 'readonly')
          .objectStore('studioAssets')
          .get(assetId)
        // The row keeps the asset beside its project and digest (studio-records.ts).
        request.onsuccess = () =>
          resolve((request.result as { asset: StudioAsset }).asset)
        request.onerror = () => reject(request.error)
      })
    } finally {
      database.close()
    }
  }, id)
}

/** Keys go to the workspace, wherever a click or a closed panel left the focus. */
async function focusWorkspace(page: Page): Promise<void> {
  await studioRegion(page).locator('[data-tour="studio.workspace"]').focus()
}

async function closeSound(page: Page): Promise<void> {
  await studioRegion(page)
    .getByRole('button', { name: 'Close Sound', exact: true })
    .click()
}

/** A take's clip: its name starts with its lane's, then the take's file. */
function takeClip(page: Page, title: string): Locator {
  return studioRegion(page).getByRole('button', {
    name: new RegExp(`, ${title}\\.wav, `),
  })
}

function recordButton(page: Page): Locator {
  return studioRegion(page).locator('[data-studio-record]')
}

/** Arm the selected lane with R; resolves once the microphone is open. */
async function arm(page: Page): Promise<void> {
  await expect(recordButton(page)).toHaveAccessibleName('Record')
  await page.keyboard.press('r')
  await expect(recordButton(page)).toHaveAccessibleName('Start recording', {
    timeout: 15_000,
  })
  await expect(
    studioRegion(page).locator('[data-studio-lane-meter]'),
  ).toBeVisible()
}

/**
 * Start the armed take with R, record `seconds` of the audio clock after
 * the count-in, `during` that time if given, and stop with R. Resolves
 * once the take is kept, with the seconds from the end of the count-in to
 * the stop press on the audio clock.
 */
async function recordArmed(
  page: Page,
  title: string,
  seconds: number,
  during?: () => Promise<void>,
): Promise<number> {
  const studio = studioRegion(page)
  const button = recordButton(page)
  await clearClicks(page)
  await page.keyboard.press('r')
  await expect(button).toHaveAccessibleName('Cancel the count-in')
  await expect(button).toHaveAccessibleName('Stop recording', {
    timeout: 10_000,
  })
  // An overdub: the song plays under the take, and the take grows in its lane.
  await expect(
    studio.getByRole('button', { name: 'Pause song', exact: true }),
  ).toBeVisible()
  await expect(studio.locator('[data-studio-live-take]')).toBeVisible()
  const until = (await audioClock(page)) + seconds
  if (during) await during()
  await untilAudioClock(page, until)
  await page.keyboard.press('r')
  await expect(button).toHaveAccessibleName('Record', { timeout: 30_000 })
  await expect(takeClip(page, title)).toHaveCount(1)
  await expect(
    studio.getByText('Saved in this browser', { exact: true }),
  ).toBeVisible({ timeout: 30_000 })
  const [start, stop] = (await readClicks(page)).filter(
    ({ kind }) => kind === 'key',
  )
  return (
    stop.contextTime - start.contextTime - START_LEAD_SECONDS - COUNT_IN_SECONDS
  )
}

/** The round trip the Sound panel says Studio applied to the last take, offset aside. */
async function appliedRoundTripMs(page: Page): Promise<number> {
  const studio = studioRegion(page)
  await studio.getByRole('button', { name: 'Sound', exact: true }).click()
  const help = studio.getByText(/^Studio starts each new take \d+ ms earlier/)
  await expect(help).toBeVisible()
  const ms = Number(
    /(\d+) ms earlier/.exec((await help.textContent()) ?? '')![1],
  )
  await closeSound(page)
  return ms
}

async function clipOf(page: Page, assetTitle: string): Promise<StudioClip> {
  const project = await readStudioProject(page)
  const assetIds = new Set<string>()
  for (const clip of project.clips) {
    const asset = await readAsset(page, clip.assetId)
    if (asset?.originalName?.startsWith(assetTitle)) assetIds.add(asset.id)
  }
  const clip = project.clips.find((item) => assetIds.has(item.assetId))
  if (!clip) throw new Error(`No clip of ${assetTitle} in the song.`)
  return clip
}

const laneName = async (page: Page, trackId: string) =>
  (await readStudioProject(page)).tracks.find((track) => track.id === trackId)
    ?.name

async function press(page: Page, target: Locator): Promise<number> {
  const box = (await target.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.up()
  return lastPress(page)
}

test.describe('Studio recording', () => {
  test('records onto the selected lane at the playhead, or a new lane when a clip is in the way, lined up and as long as it ran', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    await keepStreams(page)
    await captureStudioOutput(page)
    await openArrangement(page)
    const studio = studioRegion(page)

    // An empty lane, selected: the take lands on it at the playhead.
    await studio.getByRole('button', { name: 'New lane', exact: true }).click()
    await arm(page)
    await expect(
      studio.getByText('Armed on Lane 2. Press Record to start.'),
    ).toBeVisible()
    const firstRan = await recordArmed(page, 'Take 1', 3)
    await expect.poll(() => liveMicTracks(page)).toBe(0)

    const first = await clipOf(page, 'Take 1')
    const firstTripMs = await appliedRoundTripMs(page)
    const firstSeconds = (first.sourceOutFrame - first.sourceInFrame) / RATE
    // The count-in and the round trip are trimmed from the take's start.
    const firstTrim = first.sourceInFrame - COUNT_IN_SECONDS * RATE
    console.log(
      `[studio-record] ${JSON.stringify({
        take: 1,
        startFrame: first.startFrame,
        sourceInFrame: first.sourceInFrame,
        roundTripMs: firstTripMs,
        trimMs: firstTrim / 48,
        clipSeconds: firstSeconds,
        ranSeconds: firstRan,
        lengthErrorMs: (firstSeconds - firstRan) * 1000,
      })}`,
    )
    expect(await laneName(page, first.trackId)).toBe('Lane 2')
    expect(first.startFrame).toBe(0)
    expect(Math.abs(firstTrim - firstTripMs * 48)).toBeLessThanOrEqual(48)
    expect(Math.abs(firstSeconds - firstRan)).toBeLessThan(0.03)
    const asset = await readAsset(page, first.assetId)
    expect(asset.provenance.kind).toBe('recording')
    expect(asset.normalizedFrameCount).toBeGreaterThanOrEqual(
      first.sourceOutFrame,
    )

    // A later take, 40 ms earlier by the line-up offset, on the Phrase lane,
    // whose clip is under the playhead: it gets a lane of its own.
    await studio.getByRole('button', { name: 'Sound', exact: true }).click()
    const offset = studio.getByLabel('Line-up offset in milliseconds', {
      exact: true,
    })
    await offset.fill('40')
    await offset.press('Tab')
    await closeSound(page)
    await studioClip(page, 'Phrase').click()
    await page.keyboard.press('Home')
    await arm(page)
    await expect(
      studio.getByText('Armed on Phrase. Press Record to start.'),
    ).toBeVisible()
    await recordArmed(page, 'Take 2', 2)
    await expect.poll(() => liveMicTracks(page)).toBe(0)

    const second = await clipOf(page, 'Take 2')
    const secondTripMs = await appliedRoundTripMs(page)
    const secondTrim = second.sourceInFrame - COUNT_IN_SECONDS * RATE
    console.log(
      `[studio-record] ${JSON.stringify({
        take: 2,
        sourceInFrame: second.sourceInFrame,
        roundTripMs: secondTripMs,
        trimMs: secondTrim / 48,
      })}`,
    )
    expect(await laneName(page, second.trackId)).toBe('Take 2')
    expect(second.startFrame).toBe(0)
    expect(Math.abs(secondTrim - (secondTripMs + 40) * 48)).toBeLessThanOrEqual(
      48,
    )

    // Undo takes the take out, redo puts it back.
    await takeClip(page, 'Take 1').click()
    await page.keyboard.press('Control+z')
    await expect(takeClip(page, 'Take 2')).toHaveCount(0)
    await page.keyboard.press('Control+Shift+z')
    await expect(takeClip(page, 'Take 2')).toHaveCount(1)
  })

  test('Play after a recorded take starts as soon as a Play with nothing new to build, and the Studio asks for no animation frames while armed or recording', async ({
    page,
  }) => {
    test.setTimeout(240_000)
    // Hold the playback tier, as studio-play-start does: a tier change
    // rebuilds the graph whatever the edit.
    await page.addInitScript(() =>
      localStorage.setItem('mercurypitch.studio.playbackQuality', 'balanced'),
    )
    await countFrames(page)
    await installPerfProbes(page)
    await captureStudioOutput(page)
    await openArrangement(page)
    const studio = studioRegion(page)
    const cdp = await openCpuCounters(page)
    const toggle = studio.getByRole('button', { name: /^(Play|Pause) song$/ })
    /** Play from the start after three seconds of the clock; the reading, then Pause. */
    const playFromStart = async () => {
      await focusWorkspace(page)
      await page.keyboard.press('Home')
      await untilAudioClock(page, (await audioClock(page)) + 3)
      const reading = await firstSoundOf(page, () => press(page, toggle))
      await press(page, toggle)
      await expect(toggle).toHaveAccessibleName('Play song')
      return reading
    }
    const phase = (name: string) =>
      measurePhase(page, cdp, name, async () =>
        untilAudioClock(page, (await audioClock(page)) + 3),
      )

    // The first Play makes the clock; every reading below is a later Play.
    await toggle.click()
    await expect(toggle).toHaveAccessibleName('Pause song')
    await untilAudioClock(page, (await audioClock(page)) + 1)
    await press(page, toggle)
    await expect(toggle).toHaveAccessibleName('Play song')
    await importWav(page, 'Air', steadyWav(20, [660], 0.05))
    const afterImport = await playFromStart()

    await focusWorkspace(page)
    await page.keyboard.press('Home')
    let frames = await frameRequests(page)
    const idle = await phase('idle')
    const idleFrames = framesBetween(frames, await frameRequests(page))
    await toggle.click()
    const playing = await phase('playing')
    await press(page, toggle)
    await expect(toggle).toHaveAccessibleName('Play song')
    await page.keyboard.press('Home')
    await arm(page)
    frames = await frameRequests(page)
    const armed = await phase('armed')
    const armedFrames = framesBetween(frames, await frameRequests(page))
    let recording: PhaseReading | undefined
    let recordingFrames = { studio: 0, other: 0 }
    await recordArmed(page, 'Take 1', 4, async () => {
      const before = await frameRequests(page)
      recording = await phase('recording')
      recordingFrames = framesBetween(before, await frameRequests(page))
    })
    const afterTake = await playFromStart()
    const noEdit = await playFromStart()

    console.log(
      `[studio-record-perf] ${JSON.stringify({
        playAfterImport: afterImport,
        playAfterRecordedTake: afterTake,
        playWithNoEdit: noEdit,
        cpu: {
          idle: idle.cpu,
          playing: playing.cpu,
          armed: armed.cpu,
          recording: recording?.cpu,
        },
        longTasks: {
          idle: idle.longTasks,
          playing: playing.longTasks,
          armed: armed.longTasks,
          recording: recording?.longTasks,
        },
        frameRequests: {
          idle: idleFrames,
          armed: armedFrames,
          recording: recordingFrames,
        },
      })}`,
    )
    expect(afterImport.halfLevelMs).not.toBeNull()
    expect(afterTake.halfLevelMs).not.toBeNull()
    expect(noEdit.halfLevelMs).not.toBeNull()
    // The take's lane was built ahead like an imported one: its Play is as
    // soon as the next Play of the same song, with a device callback
    // (21.3 ms) of slack for where each press lands on the clock.
    expect(afterTake.halfLevelMs!).toBeLessThan(noEdit.halfLevelMs! + 25)
    // The level and the growing take move with signals, styles and a canvas
    // drawn per chunk, never with an animation frame of their own.
    expect(idleFrames.studio).toBe(0)
    expect(armedFrames.studio).toBe(0)
    expect(recordingFrames.studio).toBeLessThanOrEqual(playingFramesBudget)
  })
})
