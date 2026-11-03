// Studio recording over a range — a punch keeps exactly the range, lined up as a plain take is, and stops the song at its out point; a loop keeps every pass exactly the range long on one clip that plays the newest whole pass, any pass is picked back and undone, and the next Play starts as soon as a Play with nothing new to build.
import { expect, type Locator, type Page, test } from '@playwright/test'
import type { StudioAsset, StudioClip } from '../lib/studio/model/types'
import { openArrangement, readStudioProject, setClipStart, studioClip, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { audioClock, captureStudioOutput, importWav, untilAudioClock, } from './helpers/studio-output-capture'
import { steadyWav } from './helpers/studio-output'
import { firstSoundOf, installPerfProbes, lastPress, } from './helpers/studio-perf'
import { fakeMicArgs, TONE_HZ, writeToneWav } from './helpers/tone-wav'

const TONE_WAV = writeToneWav(TONE_HZ, 40)
const RATE = 48_000
/** The range: the Phrase clip, moved to 6 s, four seconds long. */
const IN = 6 * RATE
const OUT = 10 * RATE
/** One bar of 4/4 at the 120 bpm a new song starts at: the punch's pre-roll and the loop's count-in. */
const BAR = 2 * RATE

test.use({
  launchOptions: { args: fakeMicArgs(TONE_WAV) },
  permissions: ['microphone'],
  viewport: { width: 1440, height: 900 },
})

function recordButton(page: Page): Locator {
  return studioRegion(page).locator('[data-studio-record]')
}

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
        request.onsuccess = () =>
          resolve((request.result as { asset: StudioAsset }).asset)
        request.onerror = () => reject(request.error)
      })
    } finally {
      database.close()
    }
  }, id)
}

/** The clip of the newest take: the one clip not of the Phrase or Air. */
async function takeClip(page: Page): Promise<StudioClip> {
  const project = await readStudioProject(page)
  const takes: StudioClip[] = []
  for (const clip of project.clips) {
    const asset = await readAsset(page, clip.assetId)
    if (asset.provenance.kind === 'recording') takes.push(clip)
  }
  expect(takes).toHaveLength(1)
  return takes[0]
}

/** The round trip the Sound panel says Studio applied to the last take, offset aside. */
async function appliedRoundTripMs(page: Page): Promise<number> {
  const studio = studioRegion(page)
  await studio.getByRole('button', { name: 'Sound', exact: true }).click()
  const help = studio.getByText(
    /^Studio already moves each take \d+ ms earlier/,
  )
  await expect(help).toBeVisible()
  const ms = Number(
    /(\d+) ms earlier/.exec((await help.textContent()) ?? '')![1],
  )
  await studio.getByRole('button', { name: 'Close Sound', exact: true }).click()
  return ms
}

/** The Phrase clip at 6 s, the range set to it from its toolbar, and an empty lane selected to record on. */
async function rangeOverPhrase(page: Page): Promise<void> {
  const studio = studioRegion(page)
  await setClipStart(page, 6)
  await studioClip(page, 'Phrase').click()
  await studio
    .getByRole('toolbar', { name: 'Selected clip' })
    .getByRole('button', { name: 'Range', exact: true })
    .click()
  await expect(
    studio.getByRole('slider', { name: 'Range start', exact: true }),
  ).toHaveAttribute('aria-valuetext', '0:06.000')
  await expect(
    studio.getByRole('slider', { name: 'Range end', exact: true }),
  ).toHaveAttribute('aria-valuetext', '0:10.000')
  await studio.getByRole('button', { name: 'New lane', exact: true }).click()
}

async function arm(page: Page): Promise<void> {
  await expect(recordButton(page)).toHaveAccessibleName('Record')
  await page.keyboard.press('r')
  await expect(recordButton(page)).toHaveAccessibleName('Start recording', {
    timeout: 15_000,
  })
}

async function press(page: Page, target: Locator): Promise<number> {
  const box = (await target.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.up()
  return lastPress(page)
}

test.describe('Studio recording over a range', () => {
  test('a punch keeps exactly the range, lined up, and stops the song at its out point', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    await captureStudioOutput(page)
    await openArrangement(page)
    const studio = studioRegion(page)
    await rangeOverPhrase(page)
    const punch = studio.getByRole('button', { name: 'Punch in', exact: true })
    await punch.click()
    await expect(punch).toHaveAttribute('aria-pressed', 'true')

    await arm(page)
    await page.keyboard.press('r')
    // The pre-roll fits before the range: no count-in, the song plays in.
    await expect(recordButton(page)).toHaveAccessibleName('Stop recording')
    await expect(
      studio.locator('[data-studio-record-status="recording"]'),
    ).toContainText('Recording on Lane 2 from 0:06')
    // Range and Repeat hold still while the take runs.
    await expect(
      studio.getByRole('button', { name: 'Repeat range', exact: true }),
    ).toBeDisabled()
    await expect(
      studio.getByRole('slider', { name: 'Range start', exact: true }),
    ).toHaveCount(0)
    await expect(
      studio.locator('[data-studio-record-status="recording"]'),
    ).toContainText('Recording on Lane 2 until 0:10', { timeout: 10_000 })
    // It stops by itself at the out point, and so does the song.
    await expect(recordButton(page)).toHaveAccessibleName('Record', {
      timeout: 20_000,
    })
    await expect(
      studio.getByRole('button', { name: 'Play song', exact: true }),
    ).toBeVisible()
    await expect(
      studio.getByText('Saved in this browser', { exact: true }),
    ).toBeVisible({ timeout: 30_000 })

    const clip = await takeClip(page)
    const asset = await readAsset(page, clip.assetId)
    const tripMs = await appliedRoundTripMs(page)
    // The capture starts as Record is pressed and the song a bar before the
    // range, as soon as the transport can start it: the take keeps the
    // pre-roll, the round trip Studio applied and that start.
    const songStartFrames = clip.sourceInFrame - BAR - tripMs * 48
    const fadeIn = clip.fades.in
    const fadeOut = clip.fades.out
    console.log(
      `[studio-record-range] ${JSON.stringify({
        mode: 'punch',
        startError: clip.startFrame - IN,
        endError:
          clip.startFrame + clip.sourceOutFrame - clip.sourceInFrame - OUT,
        sourceInFrame: clip.sourceInFrame,
        roundTripMs: tripMs,
        songStartMs: songStartFrames / 48,
        fadeFrames: [
          fadeIn ? fadeIn.toSourceFrame - fadeIn.fromSourceFrame : null,
          fadeOut ? fadeOut.toSourceFrame - fadeOut.fromSourceFrame : null,
        ],
        captureFrames: asset.normalizedFrameCount,
      })}`,
    )
    const project = await readStudioProject(page)
    expect(
      project.tracks.find((track) => track.id === clip.trackId)?.name,
    ).toBe('Lane 2')
    expect(clip.startFrame).toBe(IN)
    expect(clip.sourceOutFrame - clip.sourceInFrame).toBe(OUT - IN)
    expect(songStartFrames).toBeGreaterThanOrEqual(0)
    expect(songStartFrames).toBeLessThan(0.5 * RATE)
    expect(fadeIn).toEqual({
      fromSourceFrame: clip.sourceInFrame,
      toSourceFrame: clip.sourceInFrame + 240,
    })
    expect(fadeOut).toEqual({
      fromSourceFrame: clip.sourceOutFrame - 240,
      toSourceFrame: clip.sourceOutFrame,
    })
    // The whole capture is kept: the clip can be opened out over the pre-roll.
    expect(asset.normalizedFrameCount).toBeGreaterThanOrEqual(
      clip.sourceOutFrame,
    )
  })

  test('a loop keeps each pass exactly the range long, plays the newest whole one, and Play after it starts on time', async ({
    page,
  }) => {
    test.setTimeout(240_000)
    await page.addInitScript(() =>
      localStorage.setItem('mercurypitch.studio.playbackQuality', 'balanced'),
    )
    await installPerfProbes(page)
    await captureStudioOutput(page)
    await openArrangement(page)
    const studio = studioRegion(page)
    const toggle = studio.getByRole('button', { name: /^(Play|Pause) song$/ })
    // The first Play makes the clock; a steady lane sounds from 0 for the
    // Play readings at the end.
    await toggle.click()
    await expect(toggle).toHaveAccessibleName('Pause song')
    await untilAudioClock(page, (await audioClock(page)) + 1)
    await toggle.click()
    await expect(toggle).toHaveAccessibleName('Play song')
    await importWav(page, 'Air', steadyWav(20, [660], 0.05))
    await rangeOverPhrase(page)
    const repeat = studio.getByRole('button', {
      name: 'Repeat range',
      exact: true,
    })
    await repeat.click()
    await expect(repeat).toHaveAttribute('aria-pressed', 'true')

    await arm(page)
    await page.keyboard.press('r')
    await expect(recordButton(page)).toHaveAccessibleName('Cancel the count-in')
    await expect(recordButton(page)).toHaveAccessibleName('Stop recording', {
      timeout: 10_000,
    })
    const status = studio.locator('[data-studio-record-status="recording"]')
    // The Air and the Phrase have lanes: the take records on the third.
    await expect(status).toContainText('Recording pass 1 on Lane 3')
    // Two whole passes and half of a third.
    const started = await audioClock(page)
    await expect(status).toContainText('Recording pass 3 on Lane 3', {
      timeout: 15_000,
    })
    await untilAudioClock(page, started + 10)
    await page.keyboard.press('r')
    await expect(recordButton(page)).toHaveAccessibleName('Record', {
      timeout: 30_000,
    })
    await expect(
      studio.getByText('Saved in this browser', { exact: true }),
    ).toBeVisible({ timeout: 30_000 })

    const clip = await takeClip(page)
    const passes = clip.passes ?? []
    const lengths: number[] = []
    for (const id of passes)
      lengths.push((await readAsset(page, id)).normalizedFrameCount)
    const titles: string[] = []
    for (const id of passes)
      titles.push((await readAsset(page, id)).originalName ?? '')
    console.log(
      `[studio-record-range] ${JSON.stringify({
        mode: 'loop',
        passes: passes.length,
        heard: passes.indexOf(clip.assetId) + 1,
        lengthErrors: lengths.map((frames) => frames - (OUT - IN)),
        startError: clip.startFrame - IN,
        clipFrames: clip.sourceOutFrame - clip.sourceInFrame,
        titles,
      })}`,
    )
    expect(passes).toHaveLength(3)
    expect(clip.assetId).toBe(passes[1])
    expect(lengths).toEqual([OUT - IN, OUT - IN, OUT - IN])
    expect(titles).toEqual([
      'Take 1, pass 1.wav',
      'Take 1, pass 2.wav',
      'Take 1, pass 3.wav',
    ])
    expect(clip.startFrame).toBe(IN)
    expect(clip.sourceInFrame).toBe(0)
    expect(clip.sourceOutFrame).toBe(OUT - IN)

    // Another pass from the clip's toolbar, and undo puts the heard one back.
    const take = studio.getByRole('button', { name: /, Take 1, pass 2 of 3, / })
    await take.click()
    const picker = studio.getByRole('combobox', {
      name: 'Pass this clip plays',
    })
    await expect(picker).toHaveValue(passes[1])
    await picker.selectOption({ label: '3 of 3' })
    await expect
      .poll(async () => (await takeClip(page)).assetId)
      .toBe(passes[2])
    await expect(
      studio.getByRole('button', { name: /, Take 1, pass 3 of 3, / }),
    ).toHaveCount(1)
    await studio.locator('[data-tour="studio.workspace"]').focus()
    await page.keyboard.press('Control+z')
    await expect
      .poll(async () => (await takeClip(page)).assetId)
      .toBe(passes[1])

    // Repeat off: Play from the start, after the take and with nothing new.
    await repeat.click()
    await expect(
      studio.getByRole('button', { name: 'Repeat range', exact: true }),
    ).toHaveAttribute('aria-pressed', 'false')
    const playFromStart = async () => {
      await studio.locator('[data-tour="studio.workspace"]').focus()
      await page.keyboard.press('Home')
      await untilAudioClock(page, (await audioClock(page)) + 3)
      const reading = await firstSoundOf(page, () => press(page, toggle))
      await press(page, toggle)
      await expect(toggle).toHaveAccessibleName('Play song')
      return reading
    }
    const afterTake = await playFromStart()
    const noEdit = await playFromStart()
    console.log(
      `[studio-record-range] ${JSON.stringify({
        playAfterLoopTake: afterTake,
        playWithNoEdit: noEdit,
      })}`,
    )
    expect(afterTake.halfLevelMs).not.toBeNull()
    expect(noEdit.halfLevelMs).not.toBeNull()
    expect(afterTake.halfLevelMs!).toBeLessThan(noEdit.halfLevelMs! + 25)
  })
})
