// Studio MIDI download — the song's notes, or one MIDI clip's, written as a Standard MIDI File and handed to the browser to save, named after the song.
//
// Nothing renders: the notes are the source (docs/plans/studio-midi.md,
// decision 7), so the file is written from the song as it stands and saved
// at once. A clip's file is named after the song and the clip, so it does
// not take the song's file's name.
import { writeStudioMidiFile } from '@/lib/studio/midi/midi-file'
import { studioClipMidiFile, studioSongMidiFile, } from '@/lib/studio/midi/song-midi-file'
import type { StudioAsset, StudioProject } from '@/lib/studio/model/types'
import { studioClipTakeName } from '../timeline/clip-take-name'
import { studioDownloadName } from './export-download'

/** How long a file's object URL outlives its click: past any browser's start of the download. */
const URL_LIFETIME_MS = 10_000

function save(bytes: Uint8Array<ArrayBuffer>, name: string): void {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/midi' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  try {
    document.body.append(anchor)
    anchor.click()
  } finally {
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), URL_LIFETIME_MS)
  }
}

/** Save the song's notes, every lane holding a MIDI clip, as `<title>.mid`; the name it was given. */
export function downloadStudioSongMidi(project: StudioProject): string {
  const name = studioDownloadName(project.title, 'mid')
  save(writeStudioMidiFile(studioSongMidiFile(project)), name)
  return name
}

/**
 * Save MIDI clip `clipId` alone, where the song has it, as `<title> -
 * <clip>.mid`, the clip named as its band names it; the name it was given,
 * or null when the song holds no MIDI clip by that id.
 */
export function downloadStudioClipMidi(
  project: StudioProject,
  assets: readonly StudioAsset[],
  clipId: string,
): string | null {
  const file = studioClipMidiFile(project, clipId)
  const clip = project.clips.find((each) => each.id === clipId)
  if (file === null || clip === undefined) return null
  const take = studioClipTakeName(
    assets.find((asset) => asset.id === clip.assetId),
    file.tracks[0].name,
  )
  const name = studioDownloadName(`${project.title} - ${take}`, 'mid')
  save(writeStudioMidiFile(file), name)
  return name
}
