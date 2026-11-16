// Studio MIDI files out — Export offers the MIDI file beside the WAV, off and saying why while the song has no MIDI clip; on a computer, a tablet and a phone the song's MIDI file and a clip's download, named after the song, and read back from their bytes they hold the notes the song plays, a track per MIDI lane, a kit on channel 10 and a piano on channel 1 after the acoustic grand.
import { type Download, expect, type Page, test } from '@playwright/test'
import type { StudioNote } from '@/lib/studio/model/types'
import { readStudioMidiFile, type StudioMidiRead, } from '@/tests/utils/studio-midi-file.fixture'
import { center, openArrangement, readStudioProject, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { DRUM_NOTES, KEYS_NOTES, openMidiSong } from './helpers/studio-notes'

/** A download's file name and its bytes read back as a MIDI file. */
async function readDownload(
  download: Download,
): Promise<{ name: string; file: StudioMidiRead }> {
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return {
    name: download.suggestedFilename(),
    file: readStudioMidiFile(new Uint8Array(Buffer.concat(chunks))),
  }
}

/** The download `act` starts. */
async function downloaded(
  page: Page,
  act: () => Promise<void>,
): Promise<{ name: string; file: StudioMidiRead }> {
  const download = page.waitForEvent('download')
  await act()
  return readDownload(await download)
}

/** `notes` as a file holds them on `channel`, `offset` ticks on: a clip at the song's tempo keeps its ticks. */
function asFiled(notes: readonly StudioNote[], channel: number, offset = 0) {
  return notes
    .map((note) => ({
      channel,
      pitch: note.pitch,
      startTick: note.startTick + offset,
      endTick: note.startTick + note.lengthTicks + offset,
      velocity: Math.round(note.velocity * 127),
      releaseVelocity: 64,
    }))
    .sort((a, b) => a.startTick - b.startTick || a.pitch - b.pitch)
}

test.describe('Studio MIDI files on a computer', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('Export’s MIDI file is off, and says why, while the song has no MIDI clip', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await openArrangement(page)
    const studio = studioRegion(page)

    await studio.getByRole('button', { name: 'Export', exact: true }).click()

    await expect(studio.getByText('MIDI file (.mid)')).toBeVisible()
    const exportMidi = studio.getByRole('button', { name: 'Export MIDI' })
    await expect(exportMidi).toBeDisabled()
    await expect(exportMidi).toHaveAccessibleDescription(
      'This song has no MIDI clips yet.',
    )
    await expect(
      studio.getByRole('button', { name: 'Export WAV', exact: true }),
    ).toBeEnabled()
  })

  test('the song’s MIDI file and a clip’s download, named after the song, holding their notes @smoke', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const clip = await openMidiSong(page)
    const studio = studioRegion(page)
    // A copy of the clip after it, on its lane: the song plays the notes twice.
    await clip.click()
    await studio
      .locator('[aria-label="Selected clip"]')
      .getByRole('button', { name: 'Duplicate', exact: true })
      .click()
    await expect(studio.locator('[data-midi-clip]')).toHaveCount(2)
    const song = await readStudioProject(page)
    expect(new Set(song.clips.map((each) => each.trackId)).size).toBe(1)

    await studio.getByRole('button', { name: 'Export', exact: true }).click()
    const midi = studio.locator('[data-studio-midi-export]')
    await expect(midi.getByText('Tracks').locator('xpath=..')).toContainText(
      'Keys',
    )
    await expect(midi.getByText('Tempo').locator('xpath=..')).toContainText(
      '120 bpm · 4/4',
    )
    const whole = await downloaded(page, () =>
      midi.getByRole('button', { name: 'Export MIDI' }).click(),
    )
    await expect(midi.getByRole('status')).toHaveText(
      'Download requested. Your browser handles the file.',
    )

    expect(whole.name).toBe('Untitled song.mid')
    expect(whole.file.format).toBe(1)
    expect(whole.file.ppq).toBe(960)
    expect(whole.file.tempos).toEqual([
      { tick: 0, microsecondsPerQuarter: 500_000 },
    ])
    expect(whole.file.meters).toEqual([
      { tick: 0, numerator: 4, denominator: 4 },
    ])
    expect(whole.file.tracks.map((track) => track.name)).toEqual([
      'Untitled song',
      'Keys',
    ])
    expect(whole.file.tracks[1].programs).toEqual([
      { tick: 0, channel: 0, program: 0 },
    ])
    expect(whole.file.tracks[1].notes).toEqual([
      ...asFiled(KEYS_NOTES, 0),
      ...asFiled(KEYS_NOTES, 0, 7680),
    ])

    // The first clip alone, from Clip details.
    await studio
      .getByRole('button', { name: 'Close Export', exact: true })
      .click()
    await clip.first().click()
    await studio
      .locator('[aria-label="Selected clip"]')
      .getByRole('button', { name: 'Details', exact: true })
      .click()
    const details = studio.getByRole('region', { name: 'Clip details' })
    await expect(
      details.getByRole('button', { name: 'Edit notes', exact: true }),
    ).toBeVisible()
    const alone = await downloaded(page, () =>
      details.getByRole('button', { name: 'Export MIDI', exact: true }).click(),
    )
    await expect(details.getByRole('status')).toHaveText(
      'Download requested. Your browser handles the file.',
    )

    expect(alone.name).toBe('Untitled song - Phrase.mid')
    expect(alone.file.tracks.map((track) => track.name)).toEqual([
      'Untitled song',
      'Keys',
    ])
    expect(alone.file.tracks[1].notes).toEqual(asFiled(KEYS_NOTES, 0))
    expect(alone.file.tracks[1].endTick).toBe(7680)
  })
})

test.describe('Studio MIDI files on a tablet', () => {
  test.use({ viewport: { width: 1180, height: 820 }, hasTouch: true })

  test('Clip details saves a clip’s MIDI file at a tap, its actions sized for a finger', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const clip = await openMidiSong(page)
    const studio = studioRegion(page)

    const point = await center(clip)
    await page.touchscreen.tap(point.x, point.y)
    await studio
      .locator('[aria-label="Selected clip"]')
      .getByRole('button', { name: 'Details', exact: true })
      .tap()
    const details = studio.locator('[data-studio-panel]')
    const save = details.getByRole('button', {
      name: 'Export MIDI',
      exact: true,
    })
    await expect(save).toBeVisible()
    for (const action of [
      details.getByRole('button', { name: 'Edit notes', exact: true }),
      save,
    ])
      expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    const alone = await downloaded(page, () => save.tap())

    expect(alone.name).toBe('Untitled song - Phrase.mid')
    expect(alone.file.tracks[1].notes).toEqual(asFiled(KEYS_NOTES, 0))
  })
})

test.describe('Studio MIDI files on a phone', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })

  test('the song’s MIDI file and a clip’s download from Export and the clip’s note, the kit on channel 10', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const clip = await openMidiSong(page, { notes: DRUM_NOTES, lane: 'Drums' })
    const studio = studioRegion(page)

    await studio.getByRole('button', { name: 'Export', exact: true }).tap()
    const sheet = studio.getByRole('dialog', { name: 'Export', exact: true })
    const exportMidi = sheet.getByRole('button', { name: 'Export MIDI' })
    await exportMidi.scrollIntoViewIfNeeded()
    await expect(exportMidi).toBeInViewport({ ratio: 1 })
    const box = (await exportMidi.boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(44)
    const whole = await downloaded(page, () => exportMidi.tap())

    expect(whole.name).toBe('Untitled song.mid')
    expect(whole.file.tracks.map((track) => track.name)).toEqual([
      'Untitled song',
      'Drums',
    ])
    expect(whole.file.tracks[1].programs).toEqual([])
    expect(whole.file.tracks[1].notes).toEqual(asFiled(DRUM_NOTES, 9))

    // The clip alone, from its note: a phone has no Clip details.
    await sheet.getByRole('button', { name: 'Close Export', exact: true }).tap()
    const point = await center(clip)
    await page.touchscreen.tap(point.x, point.y)
    const save = studio.getByRole('button', {
      name: 'Export MIDI',
      exact: true,
    })
    await expect(save).toBeVisible()
    // The note's three actions: whole, finger-sized and on the screen.
    const note = save.locator('xpath=..')
    for (const name of ['Edit notes', 'Export MIDI', 'Range']) {
      const action = (await note
        .getByRole('button', { name, exact: true })
        .boundingBox())!
      expect(action.height).toBeGreaterThanOrEqual(40)
      expect(action.x + action.width).toBeLessThanOrEqual(390)
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false)
    const alone = await downloaded(page, () => save.tap())

    expect(alone.name).toBe('Untitled song - Phrase.mid')
    expect(alone.file.tracks[1].notes).toEqual(asFiled(DRUM_NOTES, 9))
  })
})
