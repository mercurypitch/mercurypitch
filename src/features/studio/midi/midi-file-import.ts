// ============================================================
// Studio MIDI file import — a .mid file's bytes read by the app's strict parser and turned into a song's new lanes, or refused with the parser's reason
// ============================================================
//
// Loaded with import() when a MIDI file comes in, so the parser stays out of
// the Studio's chunk. parseMidiProject (src/features/piano-project/) is
// strict and bounded: a file it refuses is refused here with its reason, as
// an unreadable audio file is. The lanes themselves are midi-file-clips.ts's.
import { parseMidiProject, PIANO_PROJECT_PARSE_LIMITS, PianoProjectParseError, } from '@/features/piano-project/parse-midi-project'
import type { StudioMidiFileClips } from '@/lib/studio/midi/midi-file-clips'
import { studioMidiFileClips } from '@/lib/studio/midi/midi-file-clips'
import type { StudioProject } from '@/lib/studio/model/types'

/** Said for a file the parser refuses: its own reason follows. */
const UNREADABLE = 'This MIDI file could not be read:'

/** Why a file of `size` bytes is not read at all, or null: the parser's own ceiling, checked before the bytes are. */
export function studioMidiFileSizeRefusal(size: number): string | null {
  if (size === 0) return 'This MIDI file is empty.'
  const most = PIANO_PROJECT_PARSE_LIMITS.maxFileBytes
  return size > most
    ? `${UNREADABLE} MIDI files may contain at most ${most.toLocaleString('en')} bytes.`
    : null
}

/** `bytes`, a MIDI file, as new lanes of `song`. Throws an Error that says why a file is refused. */
export function studioMidiFileImport(
  bytes: Uint8Array,
  song: Pick<StudioProject, 'tempoBpm' | 'clips'>,
): StudioMidiFileClips {
  const refusal = studioMidiFileSizeRefusal(bytes.byteLength)
  if (refusal !== null) throw new Error(refusal)
  try {
    const file = parseMidiProject(bytes, {
      id: 'studio-midi-import',
      name: 'MIDI file',
      fileName: 'import.mid',
      sha256: '',
      importedAt: new Date(0).toISOString(),
    })
    return studioMidiFileClips(file, song)
  } catch (error) {
    if (error instanceof PianoProjectParseError)
      throw new Error(`${UNREADABLE} ${error.message}`)
    throw error
  }
}
