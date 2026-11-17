// ============================================================
// Studio MIDI file imports — a picked or dropped .mid file added as new lanes in one undo step, its refusal said as an audio file's is, and what it left out said on the lanes
// ============================================================
//
// docs/plans/studio-midi-clips.md, 1.5. The file is read by the parser in a
// chunk of its own (midi/midi-file-import.ts), against the song as it is
// once the bytes are in. Its lanes go in through the new-clip builder, with
// the tempo a song with no clips takes from the file in the same undo step
// (imports.ts, addMidiClips). Their clips arrive stale, so the workspace
// then asks the render service to keep their renders.
import type { StudioMidiFileClips } from '@/lib/studio/midi/midi-file-clips'
import type { StudioEdit } from '@/lib/studio/model/commands'
import type { StudioNewMidiClip } from '@/lib/studio/model/new-midi-clips'
import type { StudioProject } from '@/lib/studio/model/types'
import { STUDIO_MAX_SEQUENCE_NOTES } from '@/lib/studio/model/validation-midi'

/** The reader, as midi/midi-file-import.ts exports it. */
export interface StudioMidiFileReader {
  studioMidiFileSizeRefusal(size: number): string | null
  studioMidiFileImport(
    bytes: Uint8Array,
    song: Pick<StudioProject, 'tempoBpm' | 'clips'>,
  ): StudioMidiFileClips
}

export interface StudioMidiFileImportOptions {
  project(): StudioProject | null
  canEdit(): boolean
  /** New MIDI clips, with the edits that share their undo step (imports.ts). */
  addMidiClips(
    clips: readonly StudioNewMidiClip[],
    before: readonly StudioEdit[],
  ): Promise<readonly string[] | null>
  /** Clear the last import's refusal, as a new import does. */
  clearRefusal(): void
  /** Say why a file was refused, where an unreadable audio file's refusal is said. */
  refuse(reason: string): void
  /** Say on the lanes what a file left out. */
  notice(text: string): void
  /** The reader, loaded on demand; midi/midi-file-import.ts by default. */
  load?(): Promise<StudioMidiFileReader>
}

const loadReader = (): Promise<StudioMidiFileReader> =>
  import('../midi/midi-file-import')

/** "A", "A and B", "A, B and C". */
function listed(names: readonly string[]): string {
  return names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** What a file left out, in words: its lanes with too many notes, and its time past five minutes. */
export function studioMidiImportNotice(
  read: StudioMidiFileClips,
): string | null {
  const said: string[] = []
  if (read.leftOut.length > 0)
    said.push(
      `${listed(read.leftOut)} ${read.leftOut.length === 1 ? 'was' : 'were'} left out: a MIDI clip holds ${STUDIO_MAX_SEQUENCE_NOTES.toLocaleString('en')} notes at most.`,
    )
  if (read.cutFrom !== undefined) {
    const whole = Math.floor(read.cutFrom)
    const time = `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
    said.push(
      `The file runs ${time}: its clips hold its first five minutes, the most a MIDI clip runs.`,
    )
  }
  return said.length === 0 ? null : said.join(' ')
}

export function createStudioMidiFileImports(
  options: StudioMidiFileImportOptions,
) {
  /** `file`'s tracks as new lanes in one undo step; whether any went in. */
  async function addMidiFile(file: Blob): Promise<boolean> {
    if (options.project() === null || !options.canEdit()) return false
    options.clearRefusal()
    let read: StudioMidiFileClips
    try {
      const reader = await (options.load ?? loadReader)()
      const refusal = reader.studioMidiFileSizeRefusal(file.size)
      if (refusal !== null) throw new Error(refusal)
      const bytes = await file.arrayBuffer()
      const song = options.project()
      if (song === null || !options.canEdit()) return false
      read = reader.studioMidiFileImport(new Uint8Array(bytes), song)
    } catch (error) {
      options.refuse(
        error instanceof Error
          ? error.message
          : 'This MIDI file could not be read.',
      )
      return false
    }
    if (read.clips.length === 0) {
      const left = studioMidiImportNotice(read)
      options.refuse(
        left === null
          ? 'This MIDI file has no notes to add.'
          : `Nothing was added. ${left}`,
      )
      return false
    }
    const before: StudioEdit[] =
      read.songTempoBpm === undefined
        ? []
        : [
            {
              type: 'set-project-settings',
              changes: { tempoBpm: read.songTempoBpm },
            },
          ]
    if ((await options.addMidiClips(read.clips, before)) === null) return false
    const notice = studioMidiImportNotice(read)
    if (notice !== null) options.notice(notice)
    return true
  }

  return { addMidiFile }
}
