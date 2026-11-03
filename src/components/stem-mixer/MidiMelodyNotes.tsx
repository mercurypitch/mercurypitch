// ============================================================
// MidiMelodyNotes — the MIDI Melody panel's Notes view
// ============================================================
//
// The panel's melody on a staff: the notes the roll draws, written at the
// song's tempo in 4/4 from the song's first second, with the transport's
// cursor. Read-only, so a click on a note seeks there.
//
// SheetMusicView is loaded on first use, inside its own Suspense: VexFlow is
// a notation surface's cost, not the mixer's, and a lazy component with no
// boundary of its own would suspend whichever ancestor boundary it found.

import { createMemo, lazy, Show, Suspense } from 'solid-js'
import type { EditableNote } from '@/features/stem-mixer/pitch-edit-model'
import { safeBpm, shownNotesToMelody, } from '@/features/stem-mixer/vocal-notation'
import styles from './MidiMelodyNotes.module.css'

const SheetMusicView = lazy(async () =>
  import('@/components/SheetMusicView').then((module) => ({
    default: module.SheetMusicView,
  })),
)

export interface MidiMelodyNotesProps {
  /** The panel's melody in seconds, as the singer hears it. */
  notes: () => readonly EditableNote[]
  /** The song's tempo; anything but a positive number reads as 120. */
  bpm: () => number
  musicKey: () => string
  scaleType: () => string
  title: () => string
  /** Transport position in seconds. */
  elapsed: () => number
  playing: () => boolean
  onSeek: (seconds: number) => void
}

/** "92 BPM, 4/4": the grid the bar lines are drawn on. */
export function tempoCaption(bpm: number): string {
  const tenths = Math.round(bpm * 10) / 10
  const shown = Number.isInteger(tenths) ? String(tenths) : tenths.toFixed(1)
  return `${shown} BPM, 4/4`
}

export function MidiMelodyNotes(props: MidiMelodyNotesProps) {
  const bpm = (): number => safeBpm(props.bpm())
  const melody = createMemo(() => shownNotesToMelody(props.notes(), bpm()))

  return (
    <div
      class={styles.body}
      data-testid="stem-mixer-midi-notes"
      data-note-count={melody().length}
      data-note-pitches={melody()
        .map((item) => item.note.midi)
        .join(' ')}
    >
      <Show
        when={melody().length > 0}
        fallback={
          <p class={styles.empty} role="status">
            The notes appear here once the pitch analysis has run.
          </p>
        }
      >
        <Suspense>
          <SheetMusicView
            melody={melody}
            musicKey={props.musicKey}
            scaleType={props.scaleType}
            melodyName={props.title}
            beatsPerBar={4}
            currentBeat={() => (props.elapsed() * bpm()) / 60}
            isPlaying={props.playing}
            onSeek={(beat) => props.onSeek((beat * 60) / bpm())}
            toolbar={() => <p class={styles.tempo}>{tempoCaption(bpm())}</p>}
          />
        </Suspense>
      </Show>
    </div>
  )
}
