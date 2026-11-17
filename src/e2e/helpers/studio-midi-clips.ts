// Studio MIDI clips for browser tests — the MIDI clips a lane holds as the song saved them, with their sequences and the audio they play; where a second of the song falls across a lane; and the note editor's End handle and the room past it.
import { expect, type Locator, type Page } from '@playwright/test'
import { studioMidiRenderKey } from '@/lib/studio/midi/render-key'
import type { StudioAsset, StudioClip, StudioSequence, StudioTrack, } from '@/lib/studio/model/types'
import { readStudioProject } from './dedicatedstudio-fixture'
import { readNoteRoll } from './studio-note-roll'
import { noteEditor, noteEditorArrived } from './studio-notes'

/** A MIDI clip as the song saved it: its lane, the clip and its sequence. */
export interface SavedMidiClip {
  readonly track: StudioTrack
  readonly clip: StudioClip
  readonly sequence: StudioSequence
}

/** Lane `lane`'s MIDI clips as the song saved them, in time order. */
export async function savedMidiClips(
  page: Page,
  lane: string,
): Promise<SavedMidiClip[]> {
  const song = await readStudioProject(page)
  const track = song.tracks.find((each) => each.name === lane)
  if (track === undefined) return []
  return song.clips
    .filter((clip) => clip.trackId === track.id && clip.midi !== undefined)
    .sort((a, b) => a.startFrame - b.startFrame)
    .map((clip) => ({
      track,
      clip,
      sequence: song.sequences!.find(
        (each) => each.id === clip.midi!.sequenceId,
      )!,
    }))
}

/**
 * Wait for lane `lane`'s first MIDI clip to play a render of its notes.
 * openMidiSong saves its clip with a key that names no notes, so the
 * Studio renders it and keeps the render as the song opens; that changes
 * the song, which lets go of a gesture in the lanes under way.
 */
export async function renderKept(
  page: Page,
  lane = 'Keys',
  sound: 'piano' | 'drums' = 'piano',
): Promise<void> {
  await expect
    .poll(
      async () => {
        const [made] = await savedMidiClips(page, lane)
        return (
          made !== undefined &&
          made.clip.midi?.renderKey ===
            studioMidiRenderKey(made.sequence, sound)
        )
      },
      { timeout: 45_000 },
    )
    .toBe(true)
}

/** Every asset the song keeps, as saved. */
export async function savedAssets(page: Page): Promise<StudioAsset[]> {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('MercuryPitchDB')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      const rows = await new Promise<{ asset: StudioAsset }[]>(
        (resolve, reject) => {
          const request = database
            .transaction('studioAssets', 'readonly')
            .objectStore('studioAssets')
            .getAll()
          request.onsuccess = () =>
            resolve(request.result as { asset: StudioAsset }[])
          request.onerror = () => reject(request.error)
        },
      )
      return rows.map((row) => row.asset)
    } finally {
      database.close()
    }
  })
}

/**
 * Where second `seconds` of the song falls on the page, across the lane of
 * `ruler`, a clip from `from` to `to` seconds: its box measures the lanes'
 * scale, which a phone fits to the song.
 */
export async function laneSecond(
  ruler: Locator,
  span: readonly [number, number],
  seconds: number,
): Promise<{ x: number; y: number }> {
  const box = (await ruler.boundingBox())!
  const perSecond = box.width / (span[1] - span[0])
  return {
    x: box.x + (seconds - span[0]) * perSecond,
    y: box.y + box.height / 2,
  }
}

/** The open editor's End handle on the roll's ruler. */
export function endHandle(page: Page): Locator {
  return noteEditor(page).getByRole('slider', { name: 'Clip end' })
}

/**
 * The open editor showing its whole clip and the room past its end, done
 * sliding in; with where the End handle stands now and where tick `to`
 * falls across the roll, on its ruler.
 */
export async function endDrag(
  page: Page,
  to: number,
  phone = false,
): Promise<{ from: { x: number; y: number }; to: { x: number; y: number } }> {
  const editor = noteEditor(page)
  await noteEditorArrived(editor)
  await editor
    .getByRole('button', { name: 'Show the whole clip', exact: true })
    .click()
  const handle = endHandle(page)
  await expect(handle).toBeVisible()
  const view = await readNoteRoll(page, phone)
  const box = (await handle.boundingBox())!
  const y = box.y + box.height / 2
  return {
    from: { x: box.x + box.width / 2, y },
    to: {
      x: view.left + ((to - view.start) / (view.end - view.start)) * view.width,
      y,
    },
  }
}
