// Studio MIDI files in — on a computer and a phone, a MIDI file chosen from Add takes, or dropped on the lanes, comes into the song as lanes of its own: a Piano lane and a Drums lane from the song's start, at the file's tempo in a song with no clips and through it into a song with some, every note saved in the song and their renders kept as their audio, one undo taking it all back; a file the parser refuses is said where an unreadable audio file's refusal is; and the Studio's own MIDI file, exported and chosen again, brings back the notes it was written from. The sampled grand's samples are refused, so the piano's synth plays every render. Nothing reaches the live site.
import { type Download, expect, type Page, test } from '@playwright/test'
import { createStudioMidiKeys } from '@/lib/studio/midi/clip-keys'
import type { StudioMidiFileNote } from '@/lib/studio/midi/midi-file'
import { writeStudioMidiFile } from '@/lib/studio/midi/midi-file'
import type { StudioNote, StudioProject } from '@/lib/studio/model/types'
import { audioFixture, openArrangement, readStudioProject, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { routeNetwork } from './helpers/studio-midi'
import { DRUM_NOTES, KEYS_NOTES, openMidiSong } from './helpers/studio-notes'
import { dismissOverlays, waitForNav } from './helpers/ui'

const note = (
  pitch: number,
  startTick: number,
  endTick: number,
  velocity: number,
  releaseVelocity = 64,
): StudioMidiFileNote => ({
  pitch,
  startTick,
  endTick,
  velocity,
  releaseVelocity,
})

/** Two bars at 96 bpm: a chord, a run, two G4s that overlap, and a release velocity. */
const PIANO = [
  note(60, 0, 1920, 80),
  note(64, 0, 1920, 90),
  note(67, 0, 1920, 100),
  note(72, 1920, 2880, 127, 40),
  note(71, 2880, 3840, 70),
  note(67, 3840, 5760, 60),
  note(67, 4800, 6720, 110),
  note(65, 5760, 7680, 50),
]

/** Two bars of a beat on channel 10: kick, snare and closed hi-hat. */
const KIT = Array.from({ length: 16 }, (_, step) => [
  note(42, step * 480, step * 480 + 120, 70),
  ...(step % 4 === 0 ? [note(36, step * 480, step * 480 + 120, 120)] : []),
  ...(step % 4 === 2 ? [note(38, step * 480, step * 480 + 120, 100)] : []),
]).flat()

/** The file: a piano track and a kit track, at 96 bpm. */
const BAND = Buffer.from(
  writeStudioMidiFile({
    name: 'Band',
    tempoBpm: 96,
    tracks: [
      { name: 'Piano', channel: 0, program: 0, endTick: 7680, notes: PIANO },
      { name: 'Kit', channel: 9, endTick: 7680, notes: KIT },
    ],
  }),
)

const MIDI_FILE = { name: 'Band.mid', mimeType: 'audio/midi', buffer: BAND }

const round4 = (value: number) => Math.round(value * 10_000) / 10_000

/** `notes` of the file as a song at `tempoBpm` saves them: their seconds in its ticks, on `channel`. */
function asSaved(
  notes: readonly StudioMidiFileNote[],
  channel: number,
  tempoBpm = 96,
) {
  const tick = (fileTick: number) => Math.round((fileTick * tempoBpm) / 96)
  return notes
    .map((each) => ({
      pitch: each.pitch,
      startTick: tick(each.startTick),
      lengthTicks: tick(each.endTick) - tick(each.startTick),
      velocity: round4(each.velocity / 127),
      ...(each.releaseVelocity !== 64 && {
        releaseVelocity: round4(each.releaseVelocity / 127),
      }),
      ...(channel !== 0 && { channel }),
    }))
    .sort((a, b) => a.startTick - b.startTick || a.pitch - b.pitch)
}

/** The notes of the one clip on the song's lane `index`, from the top, without their ids. */
function laneNotes(song: StudioProject, index: number) {
  const track = [...song.tracks].sort((a, b) => a.order - b.order)[index]
  const clips = song.clips.filter((clip) => clip.trackId === track.id)
  expect(clips).toHaveLength(1)
  const sequence = song.sequences!.find(
    (each) => each.id === clips[0].midi!.sequenceId,
  )!
  return sequence.notes.map(({ id: _id, ...rest }) => rest)
}

/** Notes as pitch, start, length and velocity in a file's 127 steps, in time order: what a file round trip keeps. */
function inSteps(notes: readonly Omit<StudioNote, 'id'>[]) {
  return notes
    .map((each) => [
      each.pitch,
      each.startTick,
      each.lengthTicks,
      Math.round(each.velocity * 127),
    ])
    .sort((a, b) => a[1] - b[1] || a[0] - b[0])
}

/** The song once every MIDI clip's render is kept as its audio, as saved. */
async function renderedSong(page: Page): Promise<StudioProject> {
  const keys = createStudioMidiKeys()
  await expect
    .poll(
      async () => {
        const song = await readStudioProject(page)
        return song.clips.some((clip) => clip.midi) &&
          keys.staleClips(song).length === 0
          ? 'kept'
          : 'rendering'
      },
      { timeout: 45_000 },
    )
    .toBe('kept')
  await expect(studioRegion(page).getByText('Rendering…')).toHaveCount(0)
  return readStudioProject(page)
}

/** A new song with no clips, open in the Studio: Add takes opens with it. */
async function openEmptySong(page: Page): Promise<void> {
  await page.addInitScript(() => {
    ;(window as unknown as { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
  })
  await page.goto('/studio-night')
  await waitForNav(page, 30_000)
  await dismissOverlays(page)
  await studioRegion(page)
    .getByRole('button', { name: 'Create project', exact: true })
    .click()
  await expect(
    studioRegion(page).getByRole('button', { name: /^Choose file/ }),
  ).toBeVisible()
}

/** Choose `file` with Add takes' Choose file, by a click or a tap, opening Add takes first when it is closed. */
async function chooseFile(
  page: Page,
  file: { name: string; mimeType: string; buffer: Buffer },
  press: 'click' | 'tap' = 'click',
): Promise<void> {
  const studio = studioRegion(page)
  const add = studio.locator('[data-tour="studio.add-takes"]')
  if ((await add.getAttribute('aria-expanded')) !== 'true') await add[press]()
  const choose = studio.getByRole('button', { name: /^Choose file/ })
  await expect(choose).toContainText('WAV, MP3 and other audio, or a MIDI file')
  const chooser = page.waitForEvent('filechooser')
  await choose[press]()
  await (await chooser).setFiles(file)
}

/** The bytes of the download `act` starts. */
async function downloadedBytes(
  page: Page,
  act: () => Promise<void>,
): Promise<{ name: string; buffer: Buffer }> {
  const download: Promise<Download> = page.waitForEvent('download')
  await act()
  const stream = await (await download).createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return {
    name: (await download).suggestedFilename(),
    buffer: Buffer.concat(chunks),
  }
}

test.describe('Studio MIDI files in, on a computer', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('a file chosen from Add takes comes in as a Piano and a Drums lane at its tempo, its notes saved and their renders kept, and one undo takes it back @smoke', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const live = await routeNetwork(page)
    await openEmptySong(page)
    const studio = studioRegion(page)

    await chooseFile(page, MIDI_FILE)

    await expect(studio.locator('[data-midi-clip]')).toHaveCount(2)
    await expect(
      studio.getByText(
        'Band.mid added as MIDI lanes. Their sound is rendering.',
        { exact: true },
      ),
    ).toBeAttached()
    const song = await renderedSong(page)
    expect(song.tempoBpm).toBe(96)
    expect(song.tracks.map((lane) => [lane.name, lane.role])).toEqual([
      ['Piano', 'keys'],
      ['Kit', 'drums'],
    ])
    // Two bars at 96 bpm are five seconds, from the song's start.
    expect(
      song.clips.map((clip) => [
        clip.startFrame,
        clip.sourceOutFrame - clip.sourceInFrame,
      ]),
    ).toEqual([
      [0, 240_000],
      [0, 240_000],
    ])
    expect(laneNotes(song, 0)).toEqual(asSaved(PIANO, 0))
    expect(laneNotes(song, 1)).toEqual(asSaved(KIT, 9))
    // Each clip plays its own render now, no longer the silence they shared.
    expect(new Set(song.clips.map((clip) => clip.assetId)).size).toBe(2)
    for (const lane of ['Piano', 'Kit'])
      await expect(
        studio.getByRole('button', { name: `${lane} details`, exact: true }),
      ).toBeVisible()

    const undo = studio.getByRole('button', { name: /^Undo / })
    await expect(undo).toHaveAccessibleName('Undo add lanes')
    await undo.click()

    await expect
      .poll(async () => {
        const undone = await readStudioProject(page)
        return [undone.tracks.length, undone.clips.length, undone.tempoBpm]
      })
      .toEqual([0, 0, 120])
    await expect(studio.locator('[data-midi-clip]')).toHaveCount(0)
    expect(live).toEqual([])
  })

  test('a file dropped with audio comes in through the tempo of a song with clips, as lanes of its own, the audio where it was dropped', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const live = await routeNetwork(page)
    await openArrangement(page)
    const before = await readStudioProject(page)
    const studio = studioRegion(page)
    const below = studio.locator('[data-studio-new-lane]')
    const lane = studio.locator('[data-studio-lane-audio]').first()
    const laneBounds = (await lane.boundingBox())!
    const bounds = (await below.boundingBox())!
    const transfer = await page.evaluateHandle(
      ({ midi, wav }) => {
        const bytes = (encoded: string) =>
          Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0))
        const data = new DataTransfer()
        data.items.add(new File([bytes(midi)], 'Band.mid', { type: '' }))
        data.items.add(
          new File([bytes(wav)], 'Harmony.wav', { type: 'audio/wav' }),
        )
        return data
      },
      {
        midi: BAND.toString('base64'),
        wav: audioFixture(2).toString('base64'),
      },
    )
    try {
      const at = {
        clientX: laneBounds.x + 160,
        clientY: bounds.y + bounds.height / 2,
      }
      await below.dispatchEvent('dragover', { dataTransfer: transfer, ...at })
      await below.dispatchEvent('drop', { dataTransfer: transfer, ...at })

      await expect
        .poll(async () => (await readStudioProject(page)).tracks.length)
        .toBe(4)
    } finally {
      await transfer.dispose()
    }
    const song = await renderedSong(page)
    // The song had a clip, so it keeps 120 bpm and the file's seconds land
    // in its ticks: five seconds, rounded up to three of its bars.
    expect(song.tempoBpm).toBe(120)
    expect(song.tracks.map((each) => each.name)).toEqual([
      before.tracks[0].name,
      'Piano',
      'Kit',
      'Harmony',
    ])
    const midiClips = song.clips.filter((clip) => clip.midi)
    expect(
      midiClips.map((clip) => [
        clip.startFrame,
        clip.sourceOutFrame - clip.sourceInFrame,
      ]),
    ).toEqual([
      [0, 288_000],
      [0, 288_000],
    ])
    expect(laneNotes(song, 1)).toEqual(asSaved(PIANO, 0, 120))
    expect(laneNotes(song, 2)).toEqual(asSaved(KIT, 9, 120))
    const harmony = song.clips.find(
      (clip) =>
        clip.trackId ===
        song.tracks.find((each) => each.name === 'Harmony')!.id,
    )!
    expect(harmony.midi).toBeUndefined()
    expect(harmony.startFrame).toBeGreaterThan(0)
    expect(song.clips.find((clip) => clip.id === before.clips[0].id)).toEqual(
      before.clips[0],
    )
    expect(live).toEqual([])
  })

  test('a file the parser refuses is said where an unreadable audio file’s refusal is, and changes nothing', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await openArrangement(page)
    const before = await readStudioProject(page)
    const studio = studioRegion(page)

    await studio.getByLabel('Upload audio', { exact: true }).setInputFiles({
      name: 'Broken.mid',
      mimeType: 'audio/midi',
      buffer: Buffer.from('RIFF\u0000\u0000\u0000\u0000WAVEfmt '),
    })

    const refusal = studio.locator('[data-studio-import-refusal]')
    await expect(refusal).toContainText(
      'This MIDI file could not be read: MIDI file must begin with an MThd header.',
    )
    await expect(refusal).toHaveAttribute('role', 'alert')
    const after = await readStudioProject(page)
    expect(after.revision).toBe(before.revision)
    expect(after.tracks).toEqual(before.tracks)
    await refusal.getByRole('button', { name: 'Dismiss', exact: true }).click()
    await expect(refusal).toHaveCount(0)
  })

  test('the song’s own MIDI file, exported and chosen again, brings back its notes on a lane of their own', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const live = await routeNetwork(page)
    await openMidiSong(page)
    const studio = studioRegion(page)
    await studio.getByRole('button', { name: 'Export', exact: true }).click()
    const exported = await downloadedBytes(page, () =>
      studio
        .locator('[data-studio-midi-export]')
        .getByRole('button', { name: 'Export MIDI' })
        .click(),
    )
    await studio
      .getByRole('button', { name: 'Close Export', exact: true })
      .click()

    await chooseFile(page, {
      name: exported.name,
      mimeType: 'audio/midi',
      buffer: exported.buffer,
    })

    await expect(studio.locator('[data-midi-clip]')).toHaveCount(2)
    const song = await renderedSong(page)
    expect(song.tempoBpm).toBe(120)
    expect(song.tracks.map((each) => [each.name, each.role])).toEqual([
      ['Keys', 'keys'],
      ['Keys', 'keys'],
    ])
    expect(laneNotes(song, 0)).toEqual(
      KEYS_NOTES.map(({ id: _id, ...rest }) => rest),
    )
    expect(inSteps(laneNotes(song, 1))).toEqual(inSteps(KEYS_NOTES))
    expect(live).toEqual([])
  })
})

test.describe('Studio MIDI files in, on a phone', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })

  test('a file chosen in the Add takes sheet comes in as its lanes, its notes saved and their renders kept', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const live = await routeNetwork(page)
    await openEmptySong(page)
    const studio = studioRegion(page)

    await chooseFile(page, MIDI_FILE, 'tap')

    await expect(
      studio.getByRole('dialog', { name: 'Add takes', exact: true }),
    ).toHaveCount(0)
    const clips = studio.locator('[data-midi-clip]')
    await expect(clips).toHaveCount(2)
    await expect(clips.nth(0)).toHaveAccessibleName(/^Piano, /)
    await expect(clips.nth(1)).toHaveAccessibleName(/^Kit, /)
    const song = await renderedSong(page)
    expect(song.tempoBpm).toBe(96)
    expect(song.tracks.map((lane) => [lane.name, lane.role])).toEqual([
      ['Piano', 'keys'],
      ['Kit', 'drums'],
    ])
    expect(laneNotes(song, 0)).toEqual(asSaved(PIANO, 0))
    expect(laneNotes(song, 1)).toEqual(asSaved(KIT, 9))
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false)
    expect(live).toEqual([])
  })

  test('the kit’s MIDI file, exported and chosen again, brings back its hits on channel 10 on a Drums lane', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const live = await routeNetwork(page)
    await openMidiSong(page, { notes: DRUM_NOTES, lane: 'Drums' })
    const studio = studioRegion(page)
    await studio.getByRole('button', { name: 'Export', exact: true }).tap()
    const sheet = studio.getByRole('dialog', { name: 'Export', exact: true })
    const exportMidi = sheet.getByRole('button', { name: 'Export MIDI' })
    await exportMidi.scrollIntoViewIfNeeded()
    const exported = await downloadedBytes(page, () => exportMidi.tap())
    await sheet.getByRole('button', { name: 'Close Export', exact: true }).tap()

    await chooseFile(
      page,
      { name: exported.name, mimeType: 'audio/midi', buffer: exported.buffer },
      'tap',
    )

    await expect(studio.locator('[data-midi-clip]')).toHaveCount(2)
    const song = await renderedSong(page)
    expect(song.tracks.map((each) => [each.name, each.role])).toEqual([
      ['Drums', 'drums'],
      ['Drums', 'drums'],
    ])
    const imported = laneNotes(song, 1)
    expect(inSteps(imported)).toEqual(inSteps(DRUM_NOTES))
    expect(new Set(imported.map((each) => each.channel))).toEqual(new Set([9]))
    expect(live).toEqual([])
  })
})
