// Studio MIDI clips for browser tests — the song's imported take turned into a MIDI clip playing given notes, on a Keys or a Drums lane, saved in the page's database and opened again; and the clip's canvas read back where a note is drawn.
import { expect, type Locator, type Page } from '@playwright/test'
import { summarizeStudioProject } from '@/lib/studio/model/defaults'
import type { StudioNote, StudioProject } from '@/lib/studio/model/types'
import { openArrangement, readStudioProject, studioRegion, } from './dedicatedstudio-fixture'
import { dismissOverlays, waitForNav } from './ui'

/** The take's four seconds at 120 bpm: 7680 ticks. */
const TAKE_TICKS = 7680

/** A chord and a run over the take's four seconds: eight notes, C4 to C5. */
export const KEYS_NOTES: StudioNote[] = [
  { id: 1, pitch: 60, startTick: 0, lengthTicks: 1920, velocity: 0.6 },
  { id: 2, pitch: 64, startTick: 0, lengthTicks: 1920, velocity: 0.7 },
  { id: 3, pitch: 67, startTick: 0, lengthTicks: 1920, velocity: 0.8 },
  { id: 4, pitch: 72, startTick: 1920, lengthTicks: 960, velocity: 1 },
  { id: 5, pitch: 71, startTick: 2880, lengthTicks: 960, velocity: 0.9 },
  { id: 6, pitch: 69, startTick: 3840, lengthTicks: 960, velocity: 0.8 },
  { id: 7, pitch: 67, startTick: 4800, lengthTicks: 960, velocity: 0.7 },
  { id: 8, pitch: 65, startTick: 5760, lengthTicks: 1920, velocity: 0.5 },
]

/** Two bars of a beat: kick, snare and closed hi-hat. */
export const DRUM_NOTES: StudioNote[] = Array.from(
  { length: 16 },
  (_, step) => [
    { pitch: 42, startTick: step * 480, lengthTicks: 120, velocity: 0.6 },
    ...(step % 4 === 0
      ? [{ pitch: 36, startTick: step * 480, lengthTicks: 120, velocity: 1 }]
      : []),
    ...(step % 4 === 2
      ? [{ pitch: 38, startTick: step * 480, lengthTicks: 120, velocity: 0.9 }]
      : []),
  ],
)
  .flat()
  .map((note, index) => ({ ...note, id: index + 1 }))

/** Write `project` over the stored song, as the app would save it. */
async function saveSong(page: Page, project: StudioProject): Promise<void> {
  await page.evaluate(
    async ({ document, summary }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('MercuryPitchDB')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = database.transaction(
            ['studioProjects', 'studioProjectSummaries'],
            'readwrite',
          )
          transaction.objectStore('studioProjects').put(document)
          transaction.objectStore('studioProjectSummaries').put(summary)
          transaction.oncomplete = () => resolve()
          transaction.onerror = () => reject(transaction.error)
        })
      } finally {
        database.close()
      }
    },
    { document: project, summary: summarizeStudioProject(project) },
  )
}

/**
 * A song whose one take plays `notes` as a MIDI clip on a lane named `lane`
 * (Keys plays the piano, Drums the kit), opened in the Studio. Returns the
 * clip's button.
 */
export async function openMidiSong(
  page: Page,
  options: { notes?: StudioNote[]; lane?: 'Keys' | 'Drums' } = {},
): Promise<Locator> {
  const lane = options.lane ?? 'Keys'
  const notes = options.notes ?? KEYS_NOTES
  await openArrangement(page)
  const song = await readStudioProject(page)
  const sequence = {
    id: 'sequence-e2e',
    ppq: 960 as const,
    tempoBpm: song.tempoBpm,
    lengthTicks: TAKE_TICKS,
    nextNoteId: Math.max(...notes.map((note) => note.id)) + 1,
    notes,
  }
  await saveSong(page, {
    ...song,
    revision: song.revision + 1,
    tracks: song.tracks.map((track) => ({
      ...track,
      name: lane,
      role: lane === 'Drums' ? 'drums' : 'keys',
    })),
    clips: song.clips.map((clip) => ({
      ...clip,
      midi: { sequenceId: sequence.id, renderKey: '0123456789abcdef' },
    })),
    sequences: [sequence],
  })
  await page.reload()
  await waitForNav(page, 30_000)
  await dismissOverlays(page)
  const studio = studioRegion(page)
  await studio.getByRole('button', { name: /^Untitled song/ }).click()
  const clip = studio.locator('[data-midi-clip]')
  await expect(clip).toHaveCount(1)
  return clip
}

/** The most opaque the clip's canvas is down column `x` from `top` to `bottom`, 0 to 255: where a note is drawn it is nearly solid. */
export async function clipCanvasAlpha(
  clip: Locator,
  at: { x: number; top: number; bottom: number },
): Promise<number> {
  return clip.locator('canvas').evaluate((canvas: HTMLCanvasElement, band) => {
    const scale = canvas.width / canvas.getBoundingClientRect().width
    const top = Math.floor(band.top * scale)
    const rows = Math.max(1, Math.ceil(band.bottom * scale) - top)
    const pixels = canvas
      .getContext('2d')!
      .getImageData(Math.round(band.x * scale), top, 1, rows).data
    let most = 0
    for (let index = 3; index < pixels.length; index += 4)
      most = Math.max(most, pixels[index])
    return most
  }, at)
}

/** The note editor, by its region's name. */
export function noteEditor(page: Page): Locator {
  return studioRegion(page).getByRole('region', { name: /^Note editor: / })
}
